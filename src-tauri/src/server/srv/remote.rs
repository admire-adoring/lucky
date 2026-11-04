//! 服务器那台机器上的文件与命令 —— 部署页真正要读的那一侧。
//!
//! 三件事都走 `term::run_job`（一次性 SSH，复用 ControlMaster）：
//! 列一层目录、探一个路径、跑一段命令、收一个上传。不开终端会话，
//! 也不往审计表里塞行 —— 这些是页面的读操作，不是人敲的命令。
//!
//! 为什么不用 sftp/scp：远端机器只要开得了 ssh 就能用 `sh` + `cat`，
//! 而 sftp 子系统被关掉的机器并不少见。上传于是走 `ssh 'sh -c "cat > 路径"'`，
//! 文件内容从 stdin 流进去，本地只占一个读缓冲。
//!
//! 为什么列目录要两套脚本：`find -printf` 只有 GNU find 有（Linux）。
//! macOS 的 BSD find 认得 `-printf` 却不认 `%Y`，所以探测要用真正要用的那个格式：
//! 能过就走 find（一次遍历、名字里的空格与引号都不用转义），过不了退回 POSIX 循环。
use std::path::Path;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::server::error::{Error, Result};
use crate::server::store::Store;

use super::term::{self, shell_quote as q};

/// 列目录/探路径：正常几十毫秒，给 20 秒是留给密码档首次握手。
const PROBE_TIMEOUT: Duration = Duration::from_secs(20);
/// 部署命令可能包含构建 / 重启，比终端里那条给得宽一些。
const RUN_TIMEOUT: Duration = Duration::from_secs(300);
/// 几百兆的包 + 慢链路，给足。
const UPLOAD_TIMEOUT: Duration = Duration::from_secs(900);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteEntry {
    pub name: String,
    pub dir: bool,
    pub size: i64,
    /// epoch 毫秒。文案（今天 / 昨天 / 9月18日）由前端按本地时区拼。
    pub mtime: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteDir {
    pub path: String,
    pub entries: Vec<RemoteEntry>,
    /// 只有"有话要说"时非空：读不到的项、权限不足的行。
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoteMeta {
    pub name: String,
    pub dir: bool,
    pub size: i64,
    pub mtime: i64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecOutcome {
    pub code: i32,
    pub stdout: String,
    pub stderr: String,
    pub duration_ms: i64,
    /// 这条命令是带着输入跑的（远端开了 pty ⇒ stderr 已并进 stdout）
    pub fed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadOutcome {
    /// 本机文件的总字节数
    pub bytes: i64,
    pub duration_ms: i64,
    /// 远端落地后的字节数（`wc -c`）。与 `bytes` 不等说明传坏了。
    pub remote_size: i64,
    /// 从第几个字节接着传的（0 = 从头传）
    pub resumed_from: i64,
}

/* ------------------------------------------------------------------ *
 * 路径
 * ------------------------------------------------------------------ */

/// 远端路径只接受绝对路径。相对路径在 `cd` 之后含义就变了，
/// 而这里的每一条调用都发生在别的目录里 —— 与其猜，不如拒绝。
fn absolute(path: &str) -> Result<String> {
    let clean = path.trim();
    if !clean.starts_with('/') {
        return Err(Error::Invalid(format!("要绝对路径（从 / 开始）：{clean}")));
    }
    /* 收尾斜杠去掉，但根目录要留住 —— 空的 `P=` 会让脚本里所有判断失效 */
    let trimmed = clean.trim_end_matches('/');
    Ok(if trimmed.is_empty() { "/".to_string() } else { trimmed.to_string() })
}

/// 太长的一行 stderr 不适合放进界面提示。
fn first_line(text: &str) -> String {
    text.lines().map(str::trim).find(|line| !line.is_empty()).unwrap_or("").to_string()
}

/// `%T@` 给的是 `1699999999.0000000000`，只留秒。
fn epoch_ms(raw: &str) -> i64 {
    let secs = raw.split('.').next().unwrap_or("0").trim().parse::<i64>().unwrap_or(0);
    secs * 1000
}

/* ------------------------------------------------------------------ *
 * 列目录
 * ------------------------------------------------------------------ */

/// 读远端一层目录。目录不存在 → 报错（前端据此提示"路径没了"），
/// 目录存在但读不全 → 有 entries 的同时带一句 note。
pub fn list(store: &Store, host: &str, path: &str) -> Result<RemoteDir> {
    let dir = absolute(path)?;
    let script = format!(
        r#"D={dir}
if [ ! -d "$D" ]; then printf 'MISS\n'; exit 0; fi
if find "$D" -maxdepth 0 -printf '%Y' >/dev/null 2>&1; then
  find "$D" -mindepth 1 -maxdepth 1 -printf '%Y\t%s\t%T@\t%f\n' 2>/dev/null
else
  for f in "$D"/* "$D"/.[!.]* "$D"/..?*; do
    if [ -d "$f" ]; then
      t=d; s=0
    elif [ -e "$f" ] || [ -L "$f" ]; then
      t=f; s=$(stat -c %s "$f" 2>/dev/null || stat -f %z "$f" 2>/dev/null || echo 0)
    else
      continue
    fi
    m=$(stat -c %Y "$f" 2>/dev/null || stat -f %m "$f" 2>/dev/null || echo 0)
    printf '%s\t%s\t%s\t%s\n' "$t" "$s" "$m" "$(basename "$f")"
  done
fi"#,
        dir = q(&dir)
    );

    let run = term::run_job(store, host, &script, PROBE_TIMEOUT)?;
    if run.code != 0 {
        return Err(Error::Invalid(format!(
            "读不了 {dir}：{}",
            first_line(&run.stderr)
        )));
    }
    if run.stdout.trim() == "MISS" {
        return Err(Error::Invalid(format!("远端没有这个目录：{dir}")));
    }

    let entries = parse_entries(&run.stdout);

    Ok(RemoteDir {
        path: dir,
        entries,
        note: first_line(&run.stderr),
    })
}

/// `find -printf '%Y\t%s\t%T@\t%f'` 与回退分支都给同一种行：类型 / 字节 / 秒 / 文件名。
/// 只按前三刀切 —— 文件名里出现制表符时，剩下的整段都算名字。
fn parse_entries(stdout: &str) -> Vec<RemoteEntry> {
    stdout
        .lines()
        .filter_map(|line| {
            let mut parts = line.splitn(4, '\t');
            let kind = parts.next()?;
            let size = parts.next().and_then(|v| v.parse::<i64>().ok()).unwrap_or(0);
            let mtime = parts.next().map(epoch_ms).unwrap_or(0);
            let name = parts.next().unwrap_or("").to_string();
            if name.is_empty() {
                return None;
            }
            /* `%Y` 是跟随软链之后的类型：指向目录的软链要能点进去 */
            let dir = kind == "d";
            Some(RemoteEntry {
                name,
                dir,
                size: if dir { 0 } else { size },
                mtime,
            })
        })
        .collect()
}

/* ------------------------------------------------------------------ *
 * 探一个路径
 * ------------------------------------------------------------------ */

/// 存在就回大小与时间，不存在回 `None`（不报错 —— "没有"是正常答案）。
/// 权限不足仍然报错：那和"没有"是两件事，混成一句会让人去建一个已存在的目录。
pub fn stat(store: &Store, host: &str, path: &str) -> Result<Option<RemoteMeta>> {
    let target = absolute(path)?;
    let script = format!(
        r#"P={path}
if [ -d "$P" ]; then
  printf 'OK\td\t0\t%s\t%s\n' "$(stat -c %Y "$P" 2>/dev/null || stat -f %m "$P" 2>/dev/null || echo 0)" "$(basename "$P")"
elif [ -e "$P" ] || [ -L "$P" ]; then
  printf 'OK\tf\t%s\t%s\t%s\n' "$(stat -c %s "$P" 2>/dev/null || stat -f %z "$P" 2>/dev/null || echo 0)" "$(stat -c %Y "$P" 2>/dev/null || stat -f %m "$P" 2>/dev/null || echo 0)" "$(basename "$P")"
else
  printf 'MISS\n'
fi"#,
        path = q(&target)
    );

    let run = term::run_job(store, host, &script, PROBE_TIMEOUT)?;
    /* `stat` 报权限不足时脚本走不到 printf，stderr 非空且 stdout 空 —— 按错误报 */
    if run.code != 0 || (run.stdout.trim().is_empty() && !run.stderr.trim().is_empty()) {
        return Err(Error::Invalid(format!(
            "探不了 {target}：{}",
            first_line(&run.stderr)
        )));
    }
    let line = run.stdout.lines().next().unwrap_or("").trim();
    if line == "MISS" || line.is_empty() {
        return Ok(None);
    }
    let mut parts = line.splitn(5, '\t');
    if parts.next() != Some("OK") {
        return Ok(None);
    }
    let dir = parts.next() == Some("d");
    let size = parts.next().and_then(|v| v.parse::<i64>().ok()).unwrap_or(0);
    let mtime = parts.next().map(epoch_ms).unwrap_or(0);
    let name = parts.next().unwrap_or("").to_string();
    Ok(Some(RemoteMeta {
        name,
        dir,
        size: if dir { 0 } else { size },
        mtime,
    }))
}

/// 选择器该从哪一层开始：目录取自己、文件取父级、整条都不存在就往上退到最近存在的目录。
/// 在远端一次算完 —— 让前端拿着一条不存在的路径开一个空选择器，是最容易被当成 bug 的行为。
pub fn dir_for(store: &Store, host: &str, path: &str) -> Result<String> {
    let target = absolute(path)?;
    let script = format!(
        r#"P={path}
while :; do
  if [ -d "$P" ]; then printf '%s\n' "$P"; exit 0; fi
  if [ -e "$P" ] || [ -L "$P" ]; then printf '%s\n' "$(dirname "$P")"; exit 0; fi
  if [ "$P" = "/" ]; then printf '/\n'; exit 0; fi
  P=$(dirname "$P")
done"#,
        path = q(&target)
    );
    let run = term::run_job(store, host, &script, PROBE_TIMEOUT)?;
    if run.code != 0 {
        return Err(Error::Invalid(format!(
            "定不了 {target} 的目录：{}",
            first_line(&run.stderr)
        )));
    }
    let dir = run.stdout.trim();
    Ok(if dir.is_empty() { "/".to_string() } else { dir.to_string() })
}

/* ------------------------------------------------------------------ *
 * 跑命令
 * ------------------------------------------------------------------ */

/// 在 `cwd` 下真跑一条命令，回退出码与两路输出。
///
/// 命令原样嵌进脚本（与终端页同一条路）：它是用户自己写的启动命令，
/// 不是拼接出来的字符串，任何一层额外转义都会把它改坏。
///
/// `feed` 是给交互式命令的输入（`su` 要密码、`read` 要答案）。
/// 给了它就走 `run_job_fed`：命令改从 argv 进、stdin 留给输入、远端开伪终端。
/// 代价是 stderr 并进 stdout —— pty 只有一条流，`fed` 字段把这件事告诉前端。
pub fn run(
    store: &Store,
    host: &str,
    cwd: &str,
    command: &str,
    feed: Option<&str>,
) -> Result<ExecOutcome> {
    let command = command.trim();
    if command.is_empty() {
        return Err(Error::Invalid("命令是空的".into()));
    }
    let script = match cwd.trim() {
        "" => command.to_string(),
        dir => {
            let dir = absolute(dir)?;
            format!(
                "cd {dir} 2>/dev/null || {{ echo \"目录不存在：{dir}\" >&2; exit 127; }}\n{command}",
                dir = q(&dir),
            )
        }
    };

    let fed = feed.map(str::trim).filter(|text| !text.is_empty());
    let begin = Instant::now();
    let run = match fed {
        Some(text) => term::run_job_fed(store, host, &script, text, RUN_TIMEOUT)?,
        None => term::run_job(store, host, &script, RUN_TIMEOUT)?,
    };
    Ok(ExecOutcome {
        code: run.code,
        stdout: run.stdout,
        stderr: run.stderr,
        duration_ms: begin.elapsed().as_millis() as i64,
        fed: fed.is_some(),
    })
}

/* ------------------------------------------------------------------ *
 * 上传
 * ------------------------------------------------------------------ */

/// 上一次中断留在远端的 `.part` 决定这次从哪儿开始。
#[derive(Debug, PartialEq)]
enum Plan {
    /// 没有残片（或残片不可信）：清掉重传
    Fresh,
    /// 残片比源文件还长：这不是这次文件的进度，删掉重来
    Resume(u64),
    /// 残片正好等于源文件：上次写完了但没来得及改名，收尾即可
    Finish,
}

fn plan(have: Option<u64>, total: u64) -> Plan {
    match have {
        None => Plan::Fresh,
        Some(n) if n > total => Plan::Fresh,
        Some(n) if n == total => Plan::Finish,
        Some(n) => Plan::Resume(n),
    }
}

/// 把本机一个文件送到远端某个路径（父目录不存在就建）。
///
/// 落地是"先写 `<目标>.part`，字节数对上再 `mv` 到正式名"：
/// 传一半断掉不会留下一个看起来正常、实际半个的包；重跑时 `.part` 就是进度，
/// 从断点接着传（大包跨网络断了不必从头来）。
///
/// 最后仍然 `wc -c` 核对：上传"没报错"不等于"完整落地"，
/// 链路被掐断时 ssh 的退出码也可能是 0。
pub fn upload(store: &Store, host: &str, local: &str, remote: &str) -> Result<UploadOutcome> {
    let source = Path::new(local.trim());
    let meta = std::fs::metadata(source)
        .map_err(|error| Error::Invalid(format!("读不了本机文件 {}：{error}", source.display())))?;
    if !meta.is_file() {
        return Err(Error::Invalid(format!(
            "{} 不是文件（这个入口只收单个文件）",
            source.display()
        )));
    }

    let target = absolute(remote)?;
    let parent = match Path::new(&target).parent() {
        Some(dir) if !dir.as_os_str().is_empty() => dir.to_string_lossy().to_string(),
        _ => return Err(Error::Invalid(format!("目标路径没有父目录：{target}"))),
    };

    let total = meta.len();
    let part = format!("{target}.part");
    let have = stat(store, host, &part)?.filter(|row| !row.dir).map(|row| row.size.max(0) as u64);
    let step = plan(have, total);

    let begin = Instant::now();
    let (offset, script, finishing) = match step {
        Plan::Finish => (
            0,
            format!(
                r#"mv -f {part} {target} && wc -c < {target}"#,
                part = q(&part),
                target = q(&target)
            ),
            true,
        ),
        Plan::Fresh => (
            0,
            format!(
                "mkdir -p {parent}\nrm -f {part}\ncat >> {part}\n{tail}",
                parent = q(&parent),
                part = q(&part),
                tail = verify_and_rename(&part, &target, total),
            ),
            false,
        ),
        Plan::Resume(from) => (
            from,
            format!(
                "mkdir -p {parent}\ncat >> {part}\n{tail}",
                parent = q(&parent),
                part = q(&part),
                tail = verify_and_rename(&part, &target, total),
            ),
            false,
        ),
    };

    let run = if finishing {
        term::run_job(store, host, &script, UPLOAD_TIMEOUT)?
    } else {
        term::run_job_with_file(store, host, &script, source, offset, UPLOAD_TIMEOUT)?
    };

    if run.code != 0 {
        return Err(Error::Invalid(format!(
            "上传到 {target} 失败（已传的字节留在 {part}，重试会接着传）：{}",
            first_line(&run.stderr)
        )));
    }

    let bytes = total as i64;
    let remote_size = run.stdout.trim().parse::<i64>().unwrap_or(-1);
    if remote_size != bytes {
        return Err(Error::Invalid(format!(
            "上传不完整：本机 {bytes} 字节，远端 {remote_size} 字节"
        )));
    }

    Ok(UploadOutcome {
        bytes,
        duration_ms: begin.elapsed().as_millis() as i64,
        remote_size,
        resumed_from: offset as i64,
    })
}

/// 收尾那一段：核对字节数，对得上才改名到正式路径，最后回声最终大小。
fn verify_and_rename(part: &str, target: &str, total: u64) -> String {
    format!(
        r#"n=$(wc -c < {part} | tr -d ' ')
if [ "$n" != "{total}" ]; then
  echo "只传到 $n / {total} 字节" >&2
  exit 3
fi
mv -f {part} {target} && wc -c < {target}"#,
        part = q(part),
        target = q(target),
        total = total
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn entries_come_from_the_print_f_lines() {
        /* GNU find 的分支：类型 / 字节 / 秒 / 名字，制表符分隔 */
        let raw = "d\t4096\t1793786109.1234567890\tsub\nf\t10\t1793786109.0000000000\tapp.jar\n";
        let rows = parse_entries(raw);
        assert_eq!(rows.len(), 2);
        assert!(rows[0].dir);
        assert_eq!(rows[0].size, 0, "目录的大小一律归 0");
        assert_eq!(rows[0].mtime, 1_793_786_109_000);
        assert_eq!(rows[1].name, "app.jar");
        assert_eq!(rows[1].size, 10);
    }

    #[test]
    fn a_name_with_tabs_stays_whole() {
        /* 只按前三刀切：名字里真有制表符时，剩下整段都算名字 */
        let rows = parse_entries("f\t3\t100\twe\tird\n");
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].name, "we\tird");
    }

    #[test]
    fn broken_symlinks_are_files_not_directories() {
        /* `%Y` 对断链给 N —— 当成文件，点进去会报错，但不会假装是个目录 */
        let rows = parse_entries("N\t0\t100\tgone\n");
        assert_eq!(rows.len(), 1);
        assert!(!rows[0].dir);
    }

    #[test]
    fn blank_lines_are_dropped() {
        assert!(parse_entries("\n\n").is_empty());
        assert!(parse_entries("f\t1\t2\t\n").is_empty());
    }

    #[test]
    fn only_absolute_paths_get_through() {
        assert_eq!(absolute("/opt/app/").unwrap(), "/opt/app");
        assert_eq!(absolute("/").unwrap(), "/");
        assert_eq!(absolute("  /var/www  ").unwrap(), "/var/www");
        assert!(absolute("opt/app").is_err());
        assert!(absolute("").is_err());
    }

    #[test]
    fn epoch_is_seconds_times_a_thousand() {
        assert_eq!(epoch_ms("1793786109.987654"), 1_793_786_109_000);
        assert_eq!(epoch_ms(""), 0);
    }

    #[test]
    fn upload_resumes_only_from_a_credible_partial() {
        /* 没有残片：从头传 */
        assert_eq!(plan(None, 100), Plan::Fresh);
        /* 残片比源文件小：接着传 */
        assert_eq!(plan(Some(40), 100), Plan::Resume(40));
        /* 残片正好等于源文件：上次写完了没改名，收尾 */
        assert_eq!(plan(Some(100), 100), Plan::Finish);
        /* 残片比源文件还长：这不是这次文件的进度（换过包 / 传过别的），删掉重来 */
        assert_eq!(plan(Some(200), 100), Plan::Fresh);
        /* 空文件 */
        assert_eq!(plan(Some(0), 0), Plan::Finish);
    }

    #[test]
    fn the_rename_step_refuses_a_short_file() {
        /* 字节数对不上就不许改名 —— 半个包出现在正式路径上比没有更糟 */
        let step = verify_and_rename("/opt/app.jar.part", "/opt/app.jar", 100);
        assert!(step.contains(r#""$n" != "100""#));
        assert!(step.contains("mv -f '/opt/app.jar.part' '/opt/app.jar'"));
    }

    #[test]
    fn always_absolute_for_the_target_too() {
        /* 上传目标同样只收绝对路径（相对路径在 cd 之后含义会变） */
        assert!(absolute("opt/app.jar").is_err());
    }
}
