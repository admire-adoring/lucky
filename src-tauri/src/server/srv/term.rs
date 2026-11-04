//! 终端页的真后端：在台账里那台机器上跑真命令、读真负载、跟真日志。
//!
//! 三件事决定了这里的写法：
//!
//! 1. **用系统 `ssh`，不用 ssh2 crate** —— 与 `probe` / `draft` 同一条路：
//!    macOS / Linux 自带客户端，零编译依赖，连接挂死也只死一个子进程。
//! 2. **连接复用**（ControlMaster + ControlPersist）—— 终端是一问一答的：
//!    每敲一条命令重新握手，密码档每次都要走 askpass，延迟按秒算。
//!    第一个连接成为主连接，后续命令挂在同一个 socket 上，往返降到几十毫秒。
//! 3. **脚本走 stdin**（`ssh target sh -s`）—— 用户敲的命令原样嵌进脚本，
//!    不经过任何一层引号拼接；输出用长度前缀成帧，命令里出现什么字符都不会串位。
//!
//! 不做的事，写在这里免得下次当 bug 修：
//! · 不申请伪终端。`top` / `vim` 这类全屏程序会报 "not a terminal" —— 真交互式
//!   终端要 PTY + 终端模拟器，这一版只做逐条执行的命令终端。
//! · 不持久化环境变量（`export` 只在那一条命令里有效）；`cd` 例外，见 `exec`。
use std::collections::HashMap;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::Mutex;
use std::time::{Duration, Instant};

use serde::Serialize;

use crate::server::error::{Error, Result};
use crate::server::id::new_id;
use crate::server::store::Store;

use super::draft::{self, Credential};
use super::probe::ssh_failure;
use super::repo;
use super::term_repo::{self, TermCommandRow, TermSessionRow};

/// 一条命令最多等多久。远端卡住（`tail -f`、程序等输入）时由本地掐掉。
/// 给两分钟是因为构建 / 重启服务这类命令本来就慢；再长的请拆成两条或去机器上跑。
const RUN_TIMEOUT: Duration = Duration::from_secs(120);
/// 开连接比跑命令慢：密码认证要握手两轮。
const OPEN_TIMEOUT: Duration = Duration::from_secs(25);
/// 采样脚本自己 sleep 0.3s，超时给宽一点。
const SAMPLE_TIMEOUT: Duration = Duration::from_secs(15);
/// 单条命令的输出上限。超了从头截断 —— 留尾巴比留开头有用（报错在最后）。
const OUTPUT_LIMIT: usize = 200_000;
/// 成帧头。`\x1e` 是记录分隔符，正常命令输出里不会出现。
const MARK: &[u8] = b"\x1eLUCKY\x1f";

/* ------------------------------------------------------------------ *
 * 会话
 * ------------------------------------------------------------------ */

#[derive(Clone)]
struct Session {
    id: String,
    server_id: String,
    host: String,
    ip: String,
    port: u16,
    user: String,
    esc: String,
    esc_user: String,
    cred: Credential,
    /// 认证方式的码（`key` / `pwd`）：断开时给失败文案用，从凭据推出来
    auth_kind: &'static str,
    control: PathBuf,
    cwd: String,
    home: String,
    shell: String,
    os: String,
}

impl Session {
    /// 命令要走的那层壳。提权档把整段脚本交给 sudo 下的 sh。
    fn remote_shell(&self) -> Result<String> {
        if self.esc != "sudo" {
            return Ok("sh -s".to_string());
        }
        let who = self.esc_user.trim();
        if who.is_empty() || who == "root" || who == self.user {
            return Ok("sudo -n sh -s".to_string());
        }
        if !who.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c)) {
            return Err(Error::Invalid(format!("提权账户里有不合法字符：{who:?}")));
        }
        Ok(format!("sudo -n -u {who} sh -s"))
    }
}

/// 进程内的会话表。key 是会话 id，值是连接参数 —— 掉电即失，落库的是审计行。
pub struct Hub {
    sessions: Mutex<HashMap<String, Session>>,
}

impl Hub {
    pub fn new() -> Self {
        Self { sessions: Mutex::new(HashMap::new()) }
    }

    fn get(&self, session_id: &str) -> Result<Session> {
        self.sessions
            .lock()
            .map_err(|_| Error::Invalid("终端会话表已中毒，需要重启应用".into()))?
            .get(session_id)
            .cloned()
            .ok_or_else(|| Error::NotFound("这个终端会话（多半是连接断了，点右上角重连）".into()))
    }

    fn put(&self, session: Session) -> Result<()> {
        self.sessions
            .lock()
            .map_err(|_| Error::Invalid("终端会话表已中毒，需要重启应用".into()))?
            .insert(session.id.clone(), session);
        Ok(())
    }

    fn drop_session(&self, session_id: &str) -> Option<Session> {
        self.sessions.lock().ok()?.remove(session_id)
    }

    /// 只更新还活着的会话。命令跑的过程中用户可能已经关掉窗口 ——
    /// 这时把会话重新塞回去会"复活"一条已关闭的记录。
    fn update_cwd(&self, session_id: &str, cwd: &str) {
        if let Ok(mut map) = self.sessions.lock() {
            if let Some(session) = map.get_mut(session_id) {
                session.cwd = cwd.to_string();
            }
        }
    }
}

impl Default for Hub {
    fn default() -> Self {
        Self::new()
    }
}

/* ------------------------------------------------------------------ *
 * 出参
 * ------------------------------------------------------------------ */

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TermOpen {
    pub session_id: String,
    pub host: String,
    pub ip: String,
    pub user: String,
    /// `sudo` 提权成功时是提权到的账户，否则就是登录账户
    pub effective_user: String,
    pub os: String,
    pub shell: String,
    pub home: String,
    pub cwd: String,
    pub connected_at: String,
    /// 这台机器累计第几次开会话（落库计数，重启不清零）
    pub session_no: i64,
    /// 建连耗时（毫秒）—— 开屏那行「已连接 · 128ms」
    pub connect_ms: i64,
    /// 台账里的提权配置被跳过时的说明（空串 = 没跳过）。
    /// 静悄悄改掉配置是另一回事，得让用户在这一页看见它为什么没生效。
    pub esc_note: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TermRun {
    pub stdout: String,
    pub stderr: String,
    /// 退出码；`-1` = 没跑起来
    pub code: i32,
    pub duration_ms: i64,
    pub cwd: String,
    /// 输出超过上限被截过
    pub truncated: bool,
    /// 这条命令把会话关了（`exit` / `logout`）
    pub closed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TermProc {
    pub pid: i64,
    pub user: String,
    pub cpu: f64,
    pub mem: f64,
    pub command: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TermStats {
    /// 机器采不到（非 Linux、没有 /proc）时为 false，前端显示「—」而不是编个数
    pub available: bool,
    pub note: String,
    pub cpu: f64,
    pub cores: i64,
    pub cpu_bars: Vec<f64>,
    pub mem: f64,
    pub mem_used_mb: i64,
    pub mem_total_mb: i64,
    pub load: Vec<f64>,
    pub tasks: i64,
    pub threads: i64,
    pub running: i64,
    pub processes: Vec<TermProc>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TermTail {
    /// 跟的是哪个文件；`journalctl` 表示走了系统日志
    pub source: String,
    pub text: String,
    pub line_count: i64,
}

/* ------------------------------------------------------------------ *
 * 开 / 关
 * ------------------------------------------------------------------ */

/// 这次会话真正要用的提权方式。root 登录没有更高的账户可提，
/// `sudo` 默认档与 `su` 一律按 `none` —— 但 `sudo -u 别人` 得留着，
/// 那是换身份不是提权，root 做这事不需要密码。
fn esc_mode_for(user: &str, mode: &str, esc_user: &str) -> String {
    if user.trim() != "root" {
        return mode.to_string();
    }
    let who = esc_user.trim();
    let same = who.is_empty() || who == "root" || who == user.trim();
    match mode {
        "sudo" if same => "none".to_string(),
        "su" => "none".to_string(),
        other => other.to_string(),
    }
}

/// 打开一条真连接。凭据来自 `srv_server.secret`（解密后只在本进程内存里过一手）。
pub fn open(store: &Store, hub: &Hub, host: &str) -> Result<TermOpen> {
    let (params, secret) = {
        let conn = store.conn()?;
        let params = repo::conn_params(&conn, host)?;
        let secret = repo::secret(&conn, host)?;
        (params, secret)
    };

    if params.user.trim().is_empty() {
        return Err(Error::Invalid("这台机器没有登记登录账户".into()));
    }

    /* 登录账户本来就是 root 时没有可提的权：留着 `sudo` 只会多绕一层，
       而它一旦要密码，就把一条本来能用的连接挡在门外；
       `su` 更是直接要 tty。这两档在 root 登录下按 `none` 处理。 */
    let esc_mode = esc_mode_for(&params.user, &params.esc_mode, &params.esc_user);
    if esc_mode == "su" {
        return Err(Error::Invalid(
            "su 提权要一个真终端（tty），命令式终端给不了 —— 把提权方式改成 sudo 或 none".into(),
        ));
    }

    let credential = match params.auth_code.as_str() {
        "pwd" => match secret {
            Some(value) if !value.is_empty() => Credential::Password(value),
            _ => {
                return Err(Error::Invalid(
                    "这台机器没存密码 —— 先在台账的编辑页填一次，再打开终端".into(),
                ))
            }
        },
        _ => match secret {
            Some(value) if !value.is_empty() => {
                let path = draft::expand_home(value.trim());
                if !path.is_file() {
                    return Err(Error::Invalid(format!("找不到私钥文件：{}", path.display())));
                }
                Credential::Key(path)
            }
            _ => {
                return Err(Error::Invalid(
                    "这台机器没存私钥路径 —— 先在台账的编辑页填一次，再打开终端".into(),
                ))
            }
        },
    };

    let session_id = new_id("ts");
    let started_at = now_iso();
    let control = control_socket(&session_id);

    let mut session = Session {
        id: session_id.clone(),
        server_id: params.id.clone(),
        host: params.host.clone(),
        ip: params.ip.clone(),
        port: params.port,
        user: params.user.clone(),
        esc: esc_mode.clone(),
        esc_user: params.esc_user.clone(),
        auth_kind: if params.auth_code == "pwd" { "pwd" } else { "key" },
        cred: credential,
        control,
        cwd: String::new(),
        home: String::new(),
        shell: String::new(),
        os: String::new(),
    };

    let begin = Instant::now();
    let outcome = run_ssh(&session, "sh -s", CONNECT_SCRIPT.as_bytes(), OPEN_TIMEOUT)?;
    if outcome.code != 0 {
        return Err(Error::Invalid(ssh_failure(
            &String::from_utf8_lossy(&outcome.stderr),
            &session.ip,
            session.port,
            session.auth_kind,
        )));
    }
    let facts = split_facts(&String::from_utf8_lossy(&outcome.stdout));
    session.home = facts.home.clone();
    session.shell = facts.shell.clone();
    session.os = facts.os.clone();
    session.cwd = facts.cwd.clone();

    prime_sudo(&session)?;

    let effective_user = if session.esc == "sudo" {
        let who = session.esc_user.trim();
        if who.is_empty() { "root".to_string() } else { who.to_string() }
    } else {
        session.user.clone()
    };

    /* 落库要在连上之后：连不上不该留下一条"开过的会话"。
       会话计数与 stale 清理放在同一个锁里，两个窗口不会各记一次。 */
    let session_no = {
        let conn = store.conn()?;
        term_repo::close_stale(&conn, &session.server_id)?;
        term_repo::create_session(
            &conn,
            &session.id,
            &session.server_id,
            &session.user,
            &session.os,
            &session.cwd,
        )?;
        term_repo::session_count(&conn, &session.server_id)?
    };

    let connect_ms = begin.elapsed().as_millis() as i64;
    let esc_note = if esc_mode != params.esc_mode {
        format!(
            "台账里登记的提权方式 {} 已跳过：登录账户本来就是 root",
            params.esc_mode
        )
    } else {
        String::new()
    };
    let open = TermOpen {
        session_id: session.id.clone(),
        host: session.host.clone(),
        ip: session.ip.clone(),
        user: session.user.clone(),
        effective_user,
        os: session.os.clone(),
        shell: session.shell.clone(),
        home: session.home.clone(),
        cwd: session.cwd.clone(),
        connected_at: started_at,
        session_no,
        connect_ms,
        esc_note,
    };

    hub.put(session)?;
    Ok(open)
}

/// 关会话：杀掉主连接、收掉 socket、把库里的行标成 `closed`。
pub fn close(store: &Store, hub: &Hub, session_id: &str) -> Result<()> {
    let Some(session) = hub.drop_session(session_id) else {
        return Ok(());
    };
    let _ = stop_master(&session);
    let _ = std::fs::remove_file(&session.control);

    let conn = store.conn()?;
    term_repo::finish_session(&conn, session_id, "closed")?;
    Ok(())
}

/* ------------------------------------------------------------------ *
 * 执行
 * ------------------------------------------------------------------ */

/// 跑一条命令。`cd` 的目录变化会被记住 —— 脚本里 `cd` 与随后的命令在同一个 shell 里，
/// 帧尾回传 `pwd -P`，下一条命令从这里接着走。
pub fn exec(store: &Store, hub: &Hub, session_id: &str, command: &str) -> Result<TermRun> {
    let command = command.trim();
    if command.is_empty() {
        return Err(Error::Invalid("命令是空的".into()));
    }
    let mut session = hub.get(session_id)?;

    /* `exit` / `logout` 交给宿主实现：真跑会把脚本壳退掉，连帧都回不来 */
    if matches!(command, "exit" | "logout") {
        let conn = store.conn()?;
        term_repo::add_command(
            &conn,
            &session.id,
            &session.server_id,
            command,
            Some(0),
            0,
            0,
            &session.cwd,
        )?;
        drop(conn);
        close(store, hub, session_id)?;
        return Ok(TermRun {
            stdout: String::new(),
            stderr: String::new(),
            code: 0,
            duration_ms: 0,
            cwd: session.cwd,
            truncated: false,
            closed: true,
        });
    }

    let script = exec_script(&session.cwd, command);
    let begin = Instant::now();
    let remote = session.remote_shell()?;
    let mut outcome = run_ssh(&session, &remote, script.as_bytes(), RUN_TIMEOUT)?;

    /* sudo 的凭据缓存会过期（默认 5 分钟）。报这个错就重新喂一次密码再重试一遍，
       不让用户为"我什么都没改，怎么突然要密码了"去查文档。 */
    if outcome.code != 0 && is_sudo_password_error(&outcome.stderr) && session.esc == "sudo" {
        prime_sudo(&session)?;
        outcome = run_ssh(&session, &remote, script.as_bytes(), RUN_TIMEOUT)?;
    }

    if outcome.code == 255 {
        let message = ssh_failure(
            &String::from_utf8_lossy(&outcome.stderr),
            &session.ip,
            session.port,
            session.auth_kind,
        );
        let conn = store.conn()?;
        term_repo::finish_session(&conn, session_id, "lost")?;
        drop(conn);
        hub.drop_session(session_id);
        return Err(Error::Invalid(format!("连接断了：{message}")));
    }

    let frame = parse_frame(&outcome.stdout).ok_or_else(|| {
        let stderr = String::from_utf8_lossy(&outcome.stderr);
        let tail = stderr.lines().rev().take(3).collect::<Vec<_>>().join("\n");
        Error::Invalid(if tail.is_empty() {
            "远端没有回执行结果 —— 命令可能把 shell 关了".to_string()
        } else {
            tail
        })
    })?;

    let (stdout, out_cut) = clip(&frame.stdout);
    let (stderr, err_cut) = clip(&frame.stderr);
    let duration_ms = begin.elapsed().as_millis() as i64;

    {
        let conn = store.conn()?;
        term_repo::add_command(
            &conn,
            &session.id,
            &session.server_id,
            command,
            Some(frame.code as i64),
            duration_ms,
            (frame.stdout.len() + frame.stderr.len()) as i64,
            &frame.cwd,
        )?;
    }

    if frame.cwd != session.cwd && !frame.cwd.is_empty() {
        session.cwd = frame.cwd.clone();
        hub.update_cwd(&session.id, &frame.cwd);
    }

    Ok(TermRun {
        stdout,
        stderr,
        code: frame.code,
        duration_ms,
        cwd: frame.cwd,
        truncated: out_cut || err_cut,
        closed: false,
    })
}

/* ------------------------------------------------------------------ *
 * 采样
 * ------------------------------------------------------------------ */

/// 真读一次负载：CPU（0.3 秒两次采样的差值）、内存、load、进程表。
pub fn stats(hub: &Hub, session_id: &str) -> Result<TermStats> {
    let session = hub.get(session_id)?;
    let outcome = run_ssh(&session, "sh -s", STATS_SCRIPT.as_bytes(), SAMPLE_TIMEOUT)?;
    if outcome.code != 0 {
        return Err(Error::Invalid(format!(
            "采不到负载：{}",
            first_line(&String::from_utf8_lossy(&outcome.stderr))
        )));
    }
    Ok(parse_stats(&String::from_utf8_lossy(&outcome.stdout)))
}

/// 跟日志。`path` 为空时按常见位置挑一个能读的，都没有就退回 `journalctl`。
pub fn tail(hub: &Hub, session_id: &str, path: Option<&str>, lines: i64) -> Result<TermTail> {
    let session = hub.get(session_id)?;
    let lines = lines.clamp(1, 500);
    let path = path.unwrap_or("").trim();
    if path.contains('\n') {
        return Err(Error::Invalid("日志路径里有换行".into()));
    }
    let script = tail_script(path, lines);
    let outcome = run_ssh(&session, "sh -s", script.as_bytes(), SAMPLE_TIMEOUT)?;
    if outcome.code != 0 {
        return Err(Error::Invalid(format!(
            "读不到日志：{}",
            first_line(&String::from_utf8_lossy(&outcome.stderr))
        )));
    }
    let raw = &outcome.stdout;
    match parse_tail(raw) {
        Some(tail) => Ok(TermTail {
            line_count: tail.text.lines().count() as i64,
            source: tail.source,
            text: tail.text,
        }),
        None => Err(Error::Invalid("日志回包解析不了".into())),
    }
}

/* ------------------------------------------------------------------ *
 * 审计查询
 * ------------------------------------------------------------------ */

pub fn history(store: &Store, host: &str, limit: i64) -> Result<Vec<TermCommandRow>> {
    let conn = store.conn()?;
    term_repo::history(&conn, host, limit.clamp(1, 500))
}

pub fn sessions(store: &Store, host: &str, limit: i64) -> Result<Vec<TermSessionRow>> {
    let conn = store.conn()?;
    term_repo::sessions(&conn, host, limit.clamp(1, 100))
}

/* ------------------------------------------------------------------ *
 * ssh
 * ------------------------------------------------------------------ */

struct RunOutcome {
    code: i32,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
}

/// 跑一次 ssh：脚本从 stdin 进，stdout/stderr 分两路读完，超时由本地掐。
fn run_ssh(session: &Session, remote: &str, payload: &[u8], timeout: Duration) -> Result<RunOutcome> {
    let mut command = Command::new("ssh");
    let control = format!("ControlPath={}", session.control.display());
    command
        .args(["-o", "ConnectTimeout=6"])
        .args(["-o", "StrictHostKeyChecking=accept-new"])
        .args(["-o", "ServerAliveInterval=30"])
        .args(["-o", "ControlMaster=auto"])
        .args(["-o", control.as_str()])
        .args(["-o", "ControlPersist=300"])
        .arg("-p")
        .arg(session.port.to_string());

    /* askpass 目录要活到子进程结束；密码档之外是 None */
    let _askpass = draft::apply_auth(&mut command, &session.cred)?;

    command
        .arg(format!("{}@{}", session.user, session.ip))
        .arg(remote)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut child = command
        .spawn()
        .map_err(|error| Error::Invalid(format!("起不了 ssh 进程：{error}")))?;

    if let Some(mut stdin) = child.stdin.take() {
        /* 远端可能提前退出（认证失败），写失败不算错 —— 结论由退出码与 stderr 给 */
        let _ = stdin.write_all(payload);
    }

    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| Error::Invalid("拿不到 ssh 的 stdout".into()))?;
    let mut stderr = child
        .stderr
        .take()
        .ok_or_else(|| Error::Invalid("拿不到 ssh 的 stderr".into()))?;
    let out_thread = std::thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = stdout.read_to_end(&mut buffer);
        buffer
    });
    let err_thread = std::thread::spawn(move || {
        let mut buffer = Vec::new();
        let _ = stderr.read_to_end(&mut buffer);
        buffer
    });

    let begin = Instant::now();
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if begin.elapsed() > timeout {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = out_thread.join();
                    let _ = err_thread.join();
                    return Ok(RunOutcome {
                        code: 124,
                        stdout: Vec::new(),
                        stderr: format!(
                            "命令超过 {} 秒没结束，已终止（远端可能还在跑）",
                            timeout.as_secs()
                        )
                        .into_bytes(),
                    });
                }
                std::thread::sleep(Duration::from_millis(20));
            }
            Err(error) => return Err(Error::Invalid(format!("等不到 ssh 结束：{error}"))),
        }
    };

    let stdout = out_thread.join().unwrap_or_default();
    let stderr = err_thread.join().unwrap_or_default();
    Ok(RunOutcome { code: status.code().unwrap_or(-1), stdout, stderr })
}

/// `ssh -O exit`：把主连接收掉，别让它 ControlPersist 里挂着。
fn stop_master(session: &Session) -> Result<()> {
    let mut command = Command::new("ssh");
    let control = format!("ControlPath={}", session.control.display());
    command
        .args(["-o", "ControlMaster=no"])
        .args(["-o", control.as_str()])
        .arg("-O")
        .arg("exit")
        .arg("-p")
        .arg(session.port.to_string())
        .arg(format!("{}@{}", session.user, session.ip));
    let _ = draft::apply_auth(&mut command, &session.cred);
    command
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|_| ())
        .map_err(|error| Error::Invalid(format!("收不了主连接：{error}")))
}

/// sudo 的凭据缓存：密码档先喂一次 `sudo -S -v`，之后每条命令用 `sudo -n`。
fn prime_sudo(session: &Session) -> Result<()> {
    if session.esc != "sudo" {
        return Ok(());
    }
    let who = session.esc_user.trim();
    let target = if who.is_empty() || who == "root" || who == session.user {
        "true".to_string()
    } else if who.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c)) {
        format!("sudo -n -u {who} true")
    } else {
        return Err(Error::Invalid(format!("提权账户里有不合法字符：{who:?}")));
    };

    if let Credential::Password(password) = &session.cred {
        let feed = format!("{password}\n");
        let _ = run_ssh(session, "sudo -S -p '' -v", feed.as_bytes(), SAMPLE_TIMEOUT)?;
    }

    let remote = if target == "true" { "sudo -n true".to_string() } else { target };
    let outcome = run_ssh(session, &remote, b"", SAMPLE_TIMEOUT)?;
    if outcome.code != 0 {
        return Err(Error::Invalid(format!(
            "sudo 提权不可用：{}（这台机器要免密 sudo，或改用 none）",
            first_line(&String::from_utf8_lossy(&outcome.stderr))
        )));
    }
    Ok(())
}

fn is_sudo_password_error(stderr: &[u8]) -> bool {
    let text = String::from_utf8_lossy(stderr);
    text.contains("a password is required") || text.contains("no tty present")
}

/* ------------------------------------------------------------------ *
 * 脚本
 * ------------------------------------------------------------------ */

/// 认通之后机器自报的身份。每行 `key=value`，值里可以带空格（只按第一个 `=` 切）。
const CONNECT_SCRIPT: &str = r#"
for f in "$HOME/.profile" "$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
  if [ -f "$f" ]; then . "$f" >/dev/null 2>&1; fi
done
printf 'user=%s\n' "${USER:-$(id -un 2>/dev/null)}"
printf 'home=%s\n' "$HOME"
printf 'shell=%s\n' "${SHELL:-/bin/sh}"
printf 'os=%s\n' "$(uname -sr 2>/dev/null)"
printf 'cwd=%s\n' "$(pwd -P 2>/dev/null)"
"#;

/// 执行脚本。用户命令原样放在 `{ }` 中间：它和 `pwd` 在同一个 shell 里，
/// 所以 `cd` 会留下来 —— 这正是"下一条命令接着在这个目录跑"的实现。
fn exec_script(cwd: &str, command: &str) -> String {
    let into = if cwd.trim().is_empty() {
        "cd \"$HOME\" 2>/dev/null".to_string()
    } else {
        format!("cd {} 2>/dev/null || cd \"$HOME\" 2>/dev/null", quote(cwd))
    };
    format!(
        r#"{into}
out=$(mktemp "${{TMPDIR:-/tmp}}/lucky-out.XXXXXX")
err=$(mktemp "${{TMPDIR:-/tmp}}/lucky-err.XXXXXX")
{{
{command}
}} >"$out" 2>"$err"
code=$?
ol=$(wc -c <"$out" | tr -d ' ')
el=$(wc -c <"$err" | tr -d ' ')
cwd=$(pwd -P 2>/dev/null)
cl=$(printf %s "$cwd" | wc -c | tr -d ' ')
printf '\036LUCKY\037%s\037%s\037%s\037%s\037\n' "$code" "$ol" "$el" "$cl"
cat "$out"
cat "$err"
printf %s "$cwd"
rm -f "$out" "$err"
"#
    )
}

/// 负载采样。Linux 走 `/proc`（两次采样算 CPU 差值），采不到的段直接不输出 ——
/// 前端看到 `available=false` 会显示「—」，而不是拿 0 冒充读数。
///
/// `LUCKY_PROC` 只为测试留的开关：单元测试拿一份 /proc 的拷贝喂同一个脚本，
/// 不必真有一台 Linux。生产路径上没人给它赋值。
const STATS_SCRIPT: &str = r#"
P=${LUCKY_PROC:-/proc}
for f in "$HOME/.profile" "$HOME/.bash_profile" "$HOME/.bashrc" "$HOME/.zshrc"; do
  if [ -f "$f" ]; then . "$f" >/dev/null 2>&1; fi
done

if [ -r "$P/stat" ]; then
  t1=$(mktemp "${TMPDIR:-/tmp}/lucky-cpu1.XXXXXX")
  t2=$(mktemp "${TMPDIR:-/tmp}/lucky-cpu2.XXXXXX")
  grep '^cpu' "$P/stat" > "$t1"
  sleep 0.3
  grep '^cpu' "$P/stat" > "$t2"
  awk 'FNR==NR { total1[$1]=0; for (i=2;i<=NF;i++) total1[$1]+=$i; idle1[$1]=$5+$6; next }
       { total2=0; for (i=2;i<=NF;i++) total2+=$i
         idle2=$5+$6
         dt=total2-total1[$1]; di=idle2-idle1[$1]
         pct=(dt>0) ? 100*(dt-di)/dt : 0
         printf "cpu %s %.1f\n", $1, pct }' "$t1" "$t2"
  rm -f "$t1" "$t2"
fi

if [ -r "$P/meminfo" ]; then
  awk '/^MemTotal:/{t=$2} /^MemAvailable:/{a=$2} /^MemFree:/{f=$2} /^Buffers:/{b=$2} /^Cached:/{c=$2}
       END { if (t=="") exit; if (a=="") a=f+b+c; printf "mem %d %d\n", t, a }' "$P/meminfo"
fi

if [ -r "$P/loadavg" ]; then
  set -- $(cat "$P/loadavg")
  printf 'load %s %s %s\n' "$1" "$2" "$3"
  printf 'procs %s\n' "$4"
fi

printf 'tasks %s\n' "$(ps ax 2>/dev/null | wc -l | tr -d ' ')"

ps_out=$(ps -eo pid=,user=,pcpu=,pmem=,args= --sort=-pcpu 2>/dev/null | head -n 9)
if [ -z "$ps_out" ]; then
  ps_out=$(ps ax -o pid=,user=,pcpu=,pmem=,command= -r 2>/dev/null | head -n 9)
fi
printf 'ps_begin\n%s\nps_end\n' "$ps_out"
"#;

/// 跟日志的脚本。挑不到文件就退回 `journalctl`；两者都没有就是一句实话。
fn tail_script(path: &str, lines: i64) -> String {
    let preset = if path.is_empty() {
        String::new()
    } else {
        format!("p={}", quote(path))
    };
    format!(
        r#"p=""
{preset}
if [ -z "$p" ]; then
  for f in /var/log/nginx/access.log /var/log/nginx/error.log /var/log/syslog /var/log/messages /var/log/auth.log; do
    if [ -r "$f" ]; then p="$f"; break; fi
  done
fi
if [ -n "$p" ] && [ -r "$p" ]; then
  body=$(tail -n {lines} "$p" 2>&1)
elif command -v journalctl >/dev/null 2>&1; then
  p="journalctl"
  body=$(journalctl -n {lines} --no-pager -o short-iso 2>&1)
else
  p=""
  body="这台机器上没找到可读的日志文件"
fi
sl=$(printf %s "$p" | wc -c | tr -d ' ')
bl=$(printf %s "$body" | wc -c | tr -d ' ')
printf '\036TAIL\037%s\037%s\037' "$sl" "$bl"
printf %s "$p"
printf %s "$body"
"#
    )
}

/* ------------------------------------------------------------------ *
 * 解析
 * ------------------------------------------------------------------ */

struct Facts {
    home: String,
    shell: String,
    os: String,
    cwd: String,
}

fn split_facts(stdout: &str) -> Facts {
    let mut facts = Facts {
        home: String::new(),
        shell: String::new(),
        os: String::new(),
        cwd: String::new(),
    };
    for line in stdout.lines() {
        let Some((key, value)) = line.split_once('=') else { continue };
        match key.trim() {
            "home" => facts.home = value.trim().to_string(),
            "shell" => facts.shell = value.trim().to_string(),
            "os" => facts.os = value.trim().to_string(),
            "cwd" => facts.cwd = value.trim().to_string(),
            _ => {}
        }
    }
    facts
}

struct Frame {
    code: i32,
    stdout: Vec<u8>,
    stderr: Vec<u8>,
    cwd: String,
}

/// 长度前缀成帧：`\x1eLUCKY\x1f<code>\x1f<out_len>\x1f<err_len>\x1f<cwd_len>\x1f` + 三段正文。
/// 用字节数而不是分隔符，命令输出里出现什么字符都不会串位。
fn parse_frame(raw: &[u8]) -> Option<Frame> {
    let start = raw.windows(MARK.len()).position(|window| window == MARK)? + MARK.len();
    let end = raw[start..].iter().position(|byte| *byte == b'\n')? + start;
    let header = std::str::from_utf8(&raw[start..end]).ok()?;
    let mut parts = header.split('\x1f');
    let code: i32 = parts.next()?.trim().parse().ok()?;
    let out_len: usize = parts.next()?.trim().parse().ok()?;
    let err_len: usize = parts.next()?.trim().parse().ok()?;
    let cwd_len: usize = parts.next()?.trim().parse().ok()?;

    let body = &raw[end + 1..];
    if body.len() < out_len + err_len + cwd_len {
        return None;
    }
    let stdout = body[..out_len].to_vec();
    let stderr = body[out_len..out_len + err_len].to_vec();
    let cwd = String::from_utf8_lossy(&body[out_len + err_len..out_len + err_len + cwd_len])
        .trim()
        .to_string();

    Some(Frame { code, stdout, stderr, cwd })
}

struct TailFrame {
    source: String,
    text: String,
}

fn parse_tail(raw: &[u8]) -> Option<TailFrame> {
    const HEAD: &[u8] = b"\x1eTAIL\x1f";
    let start = raw.windows(HEAD.len()).position(|window| window == HEAD)? + HEAD.len();

    /* 头是 `<src_len>\x1f<text_len>\x1f`，两个字段都是 `\x1f` 结尾，正文紧接其后 */
    let first = raw[start..].iter().position(|byte| *byte == b'\x1f')? + start;
    let second = raw[first + 1..].iter().position(|byte| *byte == b'\x1f')? + first + 1;
    let src_len: usize = std::str::from_utf8(&raw[start..first]).ok()?.trim().parse().ok()?;
    let text_len: usize = std::str::from_utf8(&raw[first + 1..second]).ok()?.trim().parse().ok()?;

    let body = &raw[second + 1..];
    if body.len() < src_len + text_len {
        return None;
    }
    let source = String::from_utf8_lossy(&body[..src_len]).trim().to_string();
    let text = String::from_utf8_lossy(&body[src_len..src_len + text_len]).to_string();
    Some(TailFrame { source, text: strip_ansi(&text) })
}

impl Default for TermStats {
    fn default() -> Self {
        Self {
            available: false,
            note: String::new(),
            cpu: 0.0,
            cores: 0,
            cpu_bars: Vec::new(),
            mem: 0.0,
            mem_used_mb: 0,
            mem_total_mb: 0,
            load: Vec::new(),
            tasks: 0,
            threads: 0,
            running: 0,
            processes: Vec::new(),
        }
    }
}

fn parse_stats(raw: &str) -> TermStats {
    let mut stats = TermStats::default();
    let mut bars: Vec<(i64, f64)> = Vec::new();
    let mut total_cpu: Option<f64> = None;
    let mut mem_total_kb = 0f64;
    let mut mem_avail_kb = 0f64;
    let mut in_ps = false;

    for line in raw.lines() {
        let line = line.trim_end();
        if line == "ps_begin" {
            in_ps = true;
            continue;
        }
        if line == "ps_end" {
            in_ps = false;
            continue;
        }
        if in_ps {
            if let Some(proc) = parse_proc(line) {
                stats.processes.push(proc);
            }
            continue;
        }
        let mut parts = line.split_whitespace();
        match parts.next() {
            Some("cpu") => {
                let Some(name) = parts.next() else { continue };
                let Some(value) = parts.next().and_then(|text| text.parse::<f64>().ok()) else {
                    continue;
                };
                if name == "cpu" {
                    total_cpu = Some(value);
                } else if let Some(index) = name.trim_start_matches("cpu").parse::<i64>().ok() {
                    bars.push((index, value));
                }
            }
            Some("mem") => {
                let total = parts.next().and_then(|text| text.parse::<f64>().ok());
                let avail = parts.next().and_then(|text| text.parse::<f64>().ok());
                if let (Some(total), Some(avail)) = (total, avail) {
                    mem_total_kb = total;
                    mem_avail_kb = avail;
                }
            }
            Some("load") => {
                stats.load = parts.take(3).filter_map(|text| text.parse::<f64>().ok()).collect();
            }
            Some("procs") => {
                if let Some(pair) = parts.next() {
                    let mut split = pair.split('/');
                    stats.running = split.next().and_then(|t| t.parse().ok()).unwrap_or(0);
                    stats.threads = split.next().and_then(|t| t.parse().ok()).unwrap_or(0);
                }
            }
            Some("tasks") => {
                stats.tasks = parts.next().and_then(|text| text.parse().ok()).unwrap_or(0);
            }
            _ => {}
        }
    }

    bars.sort_by_key(|(index, _)| *index);
    stats.cpu_bars = bars.into_iter().map(|(_, value)| value).collect();
    stats.cores = stats.cpu_bars.len() as i64;
    stats.cpu = total_cpu.unwrap_or_else(|| {
        if stats.cpu_bars.is_empty() {
            0.0
        } else {
            stats.cpu_bars.iter().sum::<f64>() / stats.cpu_bars.len() as f64
        }
    });
    stats.available = total_cpu.is_some();

    if mem_total_kb > 0.0 {
        stats.mem_total_mb = (mem_total_kb / 1024.0).round() as i64;
        stats.mem_used_mb = ((mem_total_kb - mem_avail_kb) / 1024.0).max(0.0).round() as i64;
        stats.mem = ((mem_total_kb - mem_avail_kb) / mem_total_kb * 100.0).clamp(0.0, 100.0);
        stats.available = true;
    }
    if !stats.available {
        stats.note = "这台机器没暴露 /proc，负载读不到".to_string();
    }
    stats.processes.truncate(8);
    stats
}

fn parse_proc(line: &str) -> Option<TermProc> {
    let mut parts = line.split_whitespace();
    let pid = parts.next()?.parse::<i64>().ok()?;
    let user = parts.next()?.to_string();
    let cpu = parts.next()?.parse::<f64>().unwrap_or(0.0);
    let mem = parts.next()?.parse::<f64>().unwrap_or(0.0);
    let command = parts.collect::<Vec<_>>().join(" ");
    Some(TermProc { pid, user, cpu, mem, command })
}

/* ------------------------------------------------------------------ *
 * 小件
 * ------------------------------------------------------------------ */

/// POSIX 单引号转义。脚本里所有来自外部的字符串（工作目录、日志路径）都过这里。
fn quote(value: &str) -> String {
    format!("'{}'", value.replace('\'', "'\\''"))
}

/// 截断：留尾巴。报错在最后几行，砍头比砍尾有用。
fn clip(bytes: &[u8]) -> (String, bool) {
    let text = String::from_utf8_lossy(bytes).to_string();
    let clean = strip_ansi(&text);
    if clean.len() <= OUTPUT_LIMIT {
        return (clean, false);
    }
    let mut start = clean.len() - OUTPUT_LIMIT;
    while start < clean.len() && !clean.is_char_boundary(start) {
        start += 1;
    }
    (format!("…（前 {} 字节已截断）\n{}", start, &clean[start..]), true)
}

/// 去掉终端控制序列：颜色、光标、以及 `\r` 覆盖写（进度条）。
/// 真终端里 `\r` 是回到行首重画，这里按"只留最后一次覆盖"处理。
fn strip_ansi(text: &str) -> String {
    let mut out = String::with_capacity(text.len());
    let mut chars = text.chars().peekable();
    while let Some(ch) = chars.next() {
        match ch {
            '\u{1b}' => match chars.next() {
                /* CSI：ESC [ … 终止字节 0x40-0x7e */
                Some('[') => {
                    for next in chars.by_ref() {
                        if ('@'..='~').contains(&next) {
                            break;
                        }
                    }
                }
                /* OSC：ESC ] … BEL 或 ST */
                Some(']') => {
                    while let Some(next) = chars.next() {
                        if next == '\u{7}' {
                            break;
                        }
                        if next == '\u{1b}' && chars.peek() == Some(&'\\') {
                            chars.next();
                            break;
                        }
                    }
                }
                _ => {}
            },
            '\r' => {
                /* 覆盖写：把当前行清掉，后面的内容重新算作同一行 */
                if let Some(pos) = out.rfind('\n') {
                    out.truncate(pos + 1);
                } else {
                    out.clear();
                }
            }
            '\u{8}' => {
                out.pop();
            }
            _ => out.push(ch),
        }
    }
    out
}

fn first_line(text: &str) -> String {
    text.lines().next().unwrap_or("没拿到错误详情").trim().to_string()
}

fn now_iso() -> String {
    /* std 没有日期格式化：用 `date` 的一条命令比引一个 crate 便宜 */
    Command::new("date")
        .arg("-u")
        .arg("+%Y-%m-%dT%H:%M:%SZ")
        .output()
        .ok()
        .and_then(|output| String::from_utf8(output.stdout).ok())
        .map(|text| text.trim().to_string())
        .filter(|text| !text.is_empty())
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_string())
}

/// 主连接的 socket。路径要短：Unix socket 全路径上限 104 字节，
/// macOS 的 `env::temp_dir()` 是 `/var/folders/…`，再拼会话 id 就超了。
fn control_socket(session_id: &str) -> PathBuf {
    let dir = Path::new("/tmp").join(format!("lucky-term-{}", std::process::id()));
    let _ = std::fs::create_dir_all(&dir);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700));
    }
    let short = session_id.rsplit('-').next().unwrap_or("0");
    dir.join(format!("{short}.sock"))
}

#[cfg(test)]
mod tests {
    use super::{
        clip, esc_mode_for, exec_script, parse_frame, parse_stats, parse_tail, quote, strip_ansi,
        tail_script, OUTPUT_LIMIT,
    };

    #[test]
    fn root_login_does_not_escalate() {
        /* root 登录再 sudo 是白绕一层，而它一旦要密码就把连接挡住了 */
        assert_eq!(esc_mode_for("root", "sudo", ""), "none");
        assert_eq!(esc_mode_for("root", "sudo", "root"), "none");
        assert_eq!(esc_mode_for("  root  ", "sudo", " "), "none");
        /* su 对 root 也没意义，还非要 tty */
        assert_eq!(esc_mode_for("root", "su", ""), "none");
        /* 但 `sudo -u 别人` 是换身份，root 做这事不要密码 —— 留着 */
        assert_eq!(esc_mode_for("root", "sudo", "postgres"), "sudo");
        /* 普通账户照登记的执行 */
        assert_eq!(esc_mode_for("deploy", "sudo", ""), "sudo");
        assert_eq!(esc_mode_for("deploy", "none", ""), "none");
    }

    #[test]
    fn frame_round_trip() {
        let mut raw = b"noise\n".to_vec();
        raw.extend_from_slice(b"\x1eLUCKY\x1f0\x1f5\x1f3\x1f4\x1f\n");
        raw.extend_from_slice(b"hello");
        raw.extend_from_slice(b"bad");
        raw.extend_from_slice(b"/tmp");

        let frame = parse_frame(&raw).expect("该解析出帧");
        assert_eq!(frame.code, 0);
        assert_eq!(frame.stdout, b"hello");
        assert_eq!(frame.stderr, b"bad");
        assert_eq!(frame.cwd, "/tmp");
    }

    #[test]
    fn frame_with_broken_lengths_is_rejected() {
        let raw = b"\x1eLUCKY\x1f0\x1f99\x1f0\x1f0\x1f\nhi";
        assert!(parse_frame(raw).is_none());
    }

    #[test]
    fn ansi_and_carriage_returns_are_cleaned() {
        assert_eq!(strip_ansi("\u{1b}[32mgreen\u{1b}[0m ok"), "green ok");
        assert_eq!(strip_ansi("10%\r50%\r100%\nnext"), "100%\nnext");
        assert_eq!(strip_ansi("abc\u{8}d"), "abd");
    }

    #[test]
    fn clip_keeps_the_tail() {
        let big = "x".repeat(OUTPUT_LIMIT + 40);
        let (text, cut) = clip(big.as_bytes());
        assert!(cut);
        assert!(text.ends_with(&"x".repeat(100)));
        assert!(text.contains("已截断"));
    }

    #[test]
    fn quote_escapes_single_quotes() {
        assert_eq!(quote("/var/log/it's.log"), "'/var/log/it'\\''s.log'");
    }

    #[test]
    fn exec_script_keeps_cd_in_the_same_shell() {
        let script = exec_script("/srv/app", "cd sub && ls");
        assert!(script.contains("cd '/srv/app'"));
        assert!(script.contains("cd sub && ls"));
        assert!(script.contains("pwd -P"));
        /* cd 与收尾的 pwd 必须在同一个 `{ }` 里，否则目录变化丢了 */
        assert!(script.contains("{\ncd sub && ls\n} >"));
    }

    #[test]
    fn tail_script_defaults_and_quotes_path() {
        assert!(tail_script("", 40).contains("/var/log/nginx/access.log"));
        assert!(tail_script("/tmp/a b.log", 40).contains("p='/tmp/a b.log'"));
        assert!(tail_script("", 40).contains("tail -n 40"));
    }

    #[test]
    fn stats_parse_reads_real_shape() {
        let raw = "\
cpu cpu0 12.5
cpu cpu1 7.5
mem 16384000 8192000
load 0.42 0.38 0.35
procs 1/214
tasks 87
ps_begin
1204 guest 12.4 3.2 node server.ts
892 systemd 4.1 1.8 postgres -D /var/lib/postgres
ps_end
";
        let stats = parse_stats(raw);
        assert!(stats.available);
        assert_eq!(stats.cores, 2);
        assert_eq!(stats.cpu, 10.0);
        assert_eq!(stats.cpu_bars, vec![12.5, 7.5]);
        assert_eq!(stats.mem_total_mb, 16000);
        assert_eq!(stats.mem_used_mb, 8000);
        assert!((stats.mem - 50.0).abs() < 0.01);
        assert_eq!(stats.running, 1);
        assert_eq!(stats.threads, 214);
        assert_eq!(stats.tasks, 87);
        assert_eq!(stats.processes.len(), 2);
        assert_eq!(stats.processes[0].command, "node server.ts");
    }

    #[test]
    fn stats_without_proc_is_honest() {
        let stats = parse_stats("tasks 0\nps_begin\nps_end\n");
        assert!(!stats.available);
        assert!(!stats.note.is_empty());
    }

    #[test]
    fn tail_frame_reads_source_and_text() {
        let mut raw = b"\x1eTAIL\x1f15\x1f5\x1f".to_vec();
        raw.extend_from_slice(b"/var/log/syslog");
        raw.extend_from_slice(b"hello");
        let tail = parse_tail(&raw).expect("该解析出日志帧");
        assert_eq!(tail.source, "/var/log/syslog");
        assert_eq!(tail.text, "hello");
    }

    /* ---------- 脚本本身：用本机 sh 跑一遍，验证成帧与目录语义 ---------- */

    fn run_script(script: &str, envs: &[(&str, &str)]) -> (i32, Vec<u8>, Vec<u8>) {
        use std::io::Write;
        use std::process::{Command, Stdio};

        let mut command = Command::new("sh");
        command
            .arg("-s")
            .env_clear()
            .env("PATH", "/usr/bin:/bin:/usr/sbin:/sbin")
            .env("HOME", "/tmp");
        for (key, value) in envs {
            command.env(key, value);
        }
        command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
        let mut child = command.spawn().expect("起不了 sh");
        child
            .stdin
            .take()
            .expect("拿不到 stdin")
            .write_all(script.as_bytes())
            .expect("写不进脚本");
        let output = child.wait_with_output().expect("sh 没回来");
        (output.status.code().unwrap_or(-1), output.stdout, output.stderr)
    }

    fn temp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("lucky-term-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        /* macOS 的 /var 是 /private/var 的软链接，`pwd -P` 给的是解析后的路径 */
        std::fs::canonicalize(&dir).unwrap()
    }

    #[test]
    fn exec_script_runs_locally_and_reports_exit_code() {
        let dir = temp_dir("exec");
        let script = exec_script(dir.to_str().unwrap(), "echo hi; pwd; echo bad >&2; false");
        let (code, out, err) = run_script(&script, &[]);
        assert_eq!(code, 0, "脚本自己该正常收尾：{err:?}");

        let frame = parse_frame(&out).expect("该解析出帧");
        assert_eq!(frame.code, 1, "命令的退出码要穿过来");
        assert!(String::from_utf8_lossy(&frame.stdout).contains("hi"));
        assert!(String::from_utf8_lossy(&frame.stderr).contains("bad"));
        assert_eq!(frame.cwd, dir.to_str().unwrap());
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn exec_script_keeps_cd_between_commands() {
        let start = temp_dir("cd");
        let target = temp_dir("cd-target");

        let script = exec_script(start.to_str().unwrap(), &format!("cd {}", quote(target.to_str().unwrap())));
        let (_, out, _) = run_script(&script, &[]);
        let frame = parse_frame(&out).expect("该解析出帧");
        assert_eq!(frame.code, 0);
        assert_eq!(frame.cwd, target.to_str().unwrap(), "cd 要留到帧尾的 pwd 里");

        let _ = std::fs::remove_dir_all(&start);
        let _ = std::fs::remove_dir_all(&target);
    }

    #[test]
    fn stats_script_reads_a_proc_fixture() {
        let base = temp_dir("stats");
        std::fs::write(
            base.join("stat"),
            "cpu  100 0 100 800 0 0 0 0 0 0\ncpu0 50 0 50 400 0 0 0 0 0 0\ncpu1 50 0 50 400 0 0 0 0 0 0\n",
        )
        .unwrap();
        std::fs::write(
            base.join("meminfo"),
            "MemTotal:       16384000 kB\nMemFree:         2000000 kB\nMemAvailable:    8192000 kB\n",
        )
        .unwrap();
        std::fs::write(base.join("loadavg"), "0.42 0.38 0.35 1/214 9999\n").unwrap();

        let bin = base.join("bin");
        std::fs::create_dir_all(&bin).unwrap();
        let fake = bin.join("ps");
        std::fs::write(&fake, "#!/bin/sh\necho '1204 guest 12.4 3.2 node server.ts'\n").unwrap();
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&fake, std::fs::Permissions::from_mode(0o755)).unwrap();
        }

        let path = format!("{}:/usr/bin:/bin", bin.display());
        let (code, out, err) = run_script(
            super::STATS_SCRIPT,
            &[("LUCKY_PROC", base.to_str().unwrap()), ("PATH", path.as_str())],
        );
        assert_eq!(code, 0, "采样脚本该正常退出：{err:?}");

        let stats = parse_stats(&String::from_utf8_lossy(&out));
        assert_eq!(stats.cores, 2, "两个核该出两条柱");
        assert_eq!(stats.mem_total_mb, 16000);
        assert_eq!(stats.mem_used_mb, 8000);
        assert_eq!(stats.load, vec![0.42, 0.38, 0.35]);
        assert_eq!(stats.running, 1);
        assert_eq!(stats.threads, 214);
        assert_eq!(stats.tasks, 1);
        assert_eq!(stats.processes.len(), 1);
        assert_eq!(stats.processes[0].command, "node server.ts");
        let _ = std::fs::remove_dir_all(&base);
    }

    #[test]
    fn tail_script_reads_the_real_tail() {
        let base = temp_dir("tail");
        let log = base.join("app.log");
        std::fs::write(&log, "one\ntwo\nthree\n").unwrap();

        let script = tail_script(log.to_str().unwrap(), 2);
        let (code, out, err) = run_script(&script, &[]);
        assert_eq!(code, 0, "跟日志的脚本该正常退出：{err:?}");

        let tail = parse_tail(&out).expect("该解析出日志帧");
        assert_eq!(tail.source, log.to_str().unwrap());
        assert_eq!(tail.text.trim(), "two\nthree");
        let _ = std::fs::remove_dir_all(&base);
    }

    /// 真连一台台账里的机器。默认不跑 —— 它用的是真实凭据与真实网络。
    ///
    ///     LUCKY_LIVE_HOST='CSCM内网' cargo test --lib live_term -- --ignored --nocapture
    ///
    /// 用库的副本而不是原库：迁移与审计写入都落在临时目录，跑完就删。
    #[test]
    #[ignore = "要真机器：设 LUCKY_LIVE_HOST 后加 --ignored 跑"]
    fn live_term_against_the_ledger_machine() {
        use crate::server::store::Store;
        use super::Hub;

        let Ok(host) = std::env::var("LUCKY_LIVE_HOST") else {
            println!("没给 LUCKY_LIVE_HOST，跳过");
            return;
        };
        let base = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../db/lucky");
        let dir = std::env::temp_dir().join(format!("lucky-live-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::copy(base.join("lucky.db"), dir.join("lucky.db")).unwrap();
        let _ = std::fs::copy(base.join("lucky.db-wal"), dir.join("lucky.db-wal"));
        std::fs::copy(base.join("vault.key"), dir.join("vault.key")).unwrap();

        let store = Store::open(dir.join("lucky.db"), dir.join("docs")).unwrap();
        let hub = Hub::new();

        let open = super::open(&store, &hub, &host).expect("连接失败");
        println!("open: {open:?}");
        assert!(!open.cwd.is_empty(), "认通了该拿到工作目录");

        for command in ["pwd", "cd /tmp && pwd", "ls /tmp | head -3", "echo 中文测试", "echo oops >&2; exit 3"] {
            let run = super::exec(&store, &hub, &open.session_id, command).expect("命令没跑起来");
            println!("$ {command}\n  code={} cwd={} ms={}\n  out={:?}\n  err={:?}", run.code, run.cwd, run.duration_ms, run.stdout, run.stderr);
        }

        let stats = super::stats(&hub, &open.session_id).expect("采不到负载");
        println!("stats: cpu={:.1} cores={} mem={:.1}% total={}MB tasks={} procs={}", stats.cpu, stats.cores, stats.mem, stats.mem_total_mb, stats.tasks, stats.processes.len());
        assert!(stats.available, "真机器该采到负载");

        let tail = super::tail(&hub, &open.session_id, None, 20).expect("读不到日志");
        println!("tail: {} ({} 行)", tail.source, tail.line_count);

        let history = super::history(&store, &host, 10).unwrap();
        println!("history: {} 条", history.len());
        assert!(history.len() >= 5);
        let sessions = super::sessions(&store, &host, 5).unwrap();
        assert_eq!(sessions[0].status, "open");

        super::close(&store, &hub, &open.session_id).unwrap();
        let after = super::sessions(&store, &host, 5).unwrap();
        assert_eq!(after[0].status, "closed");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
