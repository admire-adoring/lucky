//! 表单草稿的连通性检查 —— 添加服务器时机器还没进台账，连接参数只能来自输入框。
//!
//! 与 `probe` 的分工：那个按机器名读库、成功后把规格写回表；这里只回答"连得上吗"，
//! 一行都不写。拆成两条命令是因为耗时不一样：解析与端口是本机动作（毫秒级，最坏
//! 3 秒超时），认证 / 提权 / 系统要等 SSH 往返。合成一条，前两行会陪着 SSH 干等。
//!
//! 两档认证都验：密钥走 `-i`；密码走 `SSH_ASKPASS`（OpenSSH ≥ 8.4）——
//! `ssh` 在无终端环境下会执行那个小程序取密码，于是不必依赖 sshpass（macOS 没有）。
//! 密码只经环境变量进子进程，不进 argv、不落盘，临时脚本跑完即删。
//! 提权那一行跟着认证方式换：密钥用 `sudo -n`，密码用 `sudo -S` 从 stdin 喂。
use std::net::{SocketAddr, TcpStream, ToSocketAddrs};
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::time::Duration;

use crate::server::error::{Error, Result};

use super::probe::{split_facts, ssh_failure, validate_part, Facts, REMOTE_SCRIPT};

/// 一行检查的结论。三档而不是布尔 —— 前一步没过的时候，这一步是"没做"，
/// 不该和"做了但失败"共用一个颜色。
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Serialize)]
#[serde(rename_all = "lowercase")]
pub enum StepState {
    Ok,
    Fail,
    Skip,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeStep {
    pub state: StepState,
    /// 检查行右侧那格显示的短值（`root · 密钥`、`:22 开放`）
    pub value: String,
    /// 不成的时候说清为什么；成的时候为空
    pub message: String,
}

impl ProbeStep {
    fn ok(value: impl Into<String>) -> Self {
        Self { state: StepState::Ok, value: value.into(), message: String::new() }
    }

    fn fail(value: impl Into<String>, message: impl Into<String>) -> Self {
        Self { state: StepState::Fail, value: value.into(), message: message.into() }
    }

    fn skip(value: impl Into<String>, message: impl Into<String>) -> Self {
        Self { state: StepState::Skip, value: value.into(), message: message.into() }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReachOutcome {
    pub dns: ProbeStep,
    pub port: ProbeStep,
}

/// 认证阶段的入参：全部来自表单，没有一样是从库里读的。
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginProbeInput {
    pub host: String,
    pub port: u16,
    pub login_user: String,
    /// `key` / `pwd`
    pub auth_code: String,
    /// 密钥模式的私钥路径；`pwd` 档忽略
    pub key_path: Option<String>,
    /// 密码模式的登录密码；只在本次进程内存与子进程环境里过一手
    pub password: Option<String>,
    /// 编辑态：两格留空时，由门面按这个机器名从库里取上次那份填进上面两个字段
    /// （见 `srv::probe_login`）。本模块不碰数据库。
    pub saved_host: Option<String>,
    /// `none` / `su` / `sudo`
    pub esc_mode: String,
    pub esc_user: Option<String>,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoginOutcome {
    pub auth: ProbeStep,
    pub esc: ProbeStep,
    pub os: ProbeStep,
    /// 认通了才有 —— 表单拿它填「添加后」预览里的系统与规格
    pub facts: Option<Facts>,
}

/* ------------------------------------------------------------------ *
 * 地址解析 + 端口连通
 * ------------------------------------------------------------------ */

pub fn reach(host: &str, port: u16) -> Result<ReachOutcome> {
    let (name, inline_port) = split_host_port(host);
    let port = inline_port.unwrap_or(port);
    if name.is_empty() {
        return Err(Error::Invalid("先填主机地址".into()));
    }

    let addrs: Vec<SocketAddr> = match (name, port).to_socket_addrs() {
        Ok(iter) => iter.collect(),
        Err(error) => {
            return Ok(ReachOutcome {
                dns: ProbeStep::fail("—", format!("解析不了 {name}：{error}")),
                port: ProbeStep::skip("—", "地址没解析出来，端口没试"),
            })
        }
    };
    let Some(first) = addrs.first().copied() else {
        return Ok(ReachOutcome {
            dns: ProbeStep::fail("—", format!("{name} 没解析出任何地址")),
            port: ProbeStep::skip("—", "地址没解析出来，端口没试"),
        });
    };

    let dns = ProbeStep::ok(first.ip().to_string());
    let mut last_error = None;
    for addr in &addrs {
        match TcpStream::connect_timeout(addr, Duration::from_secs(3)) {
            Ok(_) => return Ok(ReachOutcome { dns, port: ProbeStep::ok(format!(":{port} 开放")) }),
            Err(error) => last_error = Some(error),
        }
    }

    let reason = match last_error.map(|error| error.kind()) {
        Some(std::io::ErrorKind::ConnectionRefused) => "端口拒绝连接 —— 服务没起来，或者 SSH 不在这个端口".to_string(),
        Some(std::io::ErrorKind::TimedOut) => "端口没回应 —— 安全组 / 防火墙没放行，或者机器不在了".to_string(),
        _ => "端口连不上".to_string(),
    };
    Ok(ReachOutcome {
        dns,
        port: ProbeStep::fail(format!(":{port} 关闭"), reason),
    })
}

/* ------------------------------------------------------------------ *
 * 认证 + 提权 + 系统识别
 * ------------------------------------------------------------------ */

pub fn login(input: &LoginProbeInput) -> Result<LoginOutcome> {
    let (name, inline_port) = split_host_port(&input.host);
    let port = inline_port.unwrap_or(input.port);
    validate_part("登录用户", &input.login_user)?;
    validate_part("地址", name)?;

    let user = input.login_user.trim();
    let target = format!("{user}@{name}");
    let kind_code = if input.auth_code == "pwd" { "pwd" } else { "key" };

    /* 走不到"没填"这一步：门面会先用库里存的那份填上。真到这儿说明这台机器
       从来没存过凭据 —— 说清楚，别让人以为是密码敲错了。 */
    let credential = if input.auth_code == "pwd" {
        let password = input.password.as_deref().unwrap_or("");
        if password.is_empty() {
            return Ok(stop_at_auth(ProbeStep::fail(
                format!("{user} · 密码"),
                "没有可用的密码 —— 这台机器没存过，先在表单里填一次",
            )));
        }
        Credential::Password(password.to_string())
    } else {
        let raw_key = input.key_path.as_deref().unwrap_or("").trim();
        if raw_key.is_empty() {
            return Ok(stop_at_auth(ProbeStep::fail(
                format!("{user} · 密钥"),
                "没有可用的私钥路径 —— 这台机器没存过，先在表单里填一次",
            )));
        }
        let key = expand_home(raw_key);
        if !key.is_file() {
            return Ok(stop_at_auth(ProbeStep::fail(
                format!("{user} · 密钥"),
                format!("找不到私钥文件：{}", key.display()),
            )));
        }
        Credential::Key(key)
    };
    let kind = match &credential {
        Credential::Key(_) => "密钥",
        Credential::Password(_) => "密码",
    };

    let output = run_ssh(&credential, &target, port, REMOTE_SCRIPT, None)?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Ok(stop_at_auth(ProbeStep::fail(
            format!("{user} · {kind}"),
            ssh_failure(&stderr, name, port, kind_code),
        )));
    }

    let facts = split_facts(&String::from_utf8_lossy(&output.stdout));
    let auth = ProbeStep::ok(format!("{user} · {kind}"));

    let esc = if input.esc_mode == "none" {
        ProbeStep::skip("不需要", "")
    } else {
        check_esc(&credential, &target, port, &input.esc_mode, input.esc_user.as_deref().unwrap_or(""), user)?
    };

    let os = if facts.os.is_empty() {
        ProbeStep::fail("—", "连上了，但没读到系统信息")
    } else {
        ProbeStep::ok(os_text(&facts))
    };
    let has_facts = !facts.os.is_empty();

    Ok(LoginOutcome { auth, esc, os, facts: if has_facts { Some(facts) } else { None } })
}

/// 认证没过时后三行的统一交代：没做，不报错也不报成。
fn stop_at_auth(auth: ProbeStep) -> LoginOutcome {
    LoginOutcome {
        auth,
        esc: ProbeStep::skip("—", "认证没通过，没试提权"),
        os: ProbeStep::skip("—", "认证没通过，没读到"),
        facts: None,
    }
}

/// `sudo` / `su` 各跑一次判提权。
///
/// 密钥登录用 `-n`：撞到密码就退出，不挂在那里等人输。密码登录则走 `sudo -S`，
/// 把登录密码从 SSH 的 stdin 送进去 —— 远端 sudo 从标准输入读，不需要 tty。
fn check_esc(
    credential: &Credential,
    target: &str,
    port: u16,
    mode: &str,
    esc_user: &str,
    login_user: &str,
) -> Result<ProbeStep> {
    let who = if esc_user.trim().is_empty() { "root" } else { esc_user.trim() };
    /* 账户名会被拼进远端 shell 命令串 —— 这里必须比 `validate_part` 更严 */
    if !who.chars().all(|c| c.is_ascii_alphanumeric() || "._-".contains(c)) {
        return Err(Error::Invalid(format!("提权账户里有不合法字符：{esc_user:?}")));
    }

    let same_account = who == "root" || who == login_user;
    let (script, feed) = match credential {
        Credential::Password(password) => {
            let script = if mode == "sudo" {
                if same_account {
                    "sudo -S -p '' true".to_string()
                } else {
                    format!("sudo -S -p '' -u {who} true")
                }
            } else {
                format!("su - {who} -c true")
            };
            (script, Some(password.as_str()))
        }
        Credential::Key(_) => {
            let script = if mode == "sudo" {
                if same_account {
                    "sudo -n true".to_string()
                } else {
                    format!("sudo -n -u {who} true")
                }
            } else {
                format!("su - {who} -c true")
            };
            (script, None)
        }
    };

    let output = run_ssh(credential, target, port, &script, feed)?;
    if output.status.success() {
        return Ok(ProbeStep::ok(format!("{mode} · {who}")));
    }

    let stderr = String::from_utf8_lossy(&output.stderr);
    let message = if stderr.contains("password is required") || stderr.contains("no tty present") {
        format!("{who} 要密码：非交互检查里输不了 —— 保存后在终端执行时会暂停等你输入")
    } else if stderr.contains("not in the sudoers") {
        format!("{login_user} 不在 sudoers 里，{who} 提权过不去")
    } else if stderr.contains("must be a tty") || stderr.contains("Sorry") {
        format!("{mode} 到 {who} 需要 tty，非交互检查判不了")
    } else if stderr.contains("incorrect password") || stderr.contains("Authentication failure") {
        format!("{who} 提权时密码被拒 —— 登录密码与提权密码不是同一个？")
    } else {
        format!("{mode} 失败：{}", stderr.lines().next().unwrap_or("没拿到 stderr"))
    };
    Ok(ProbeStep::fail(format!("{mode} · {who}"), message))
}

/// 认证用的凭据。
#[derive(Debug, Clone)]
pub(super) enum Credential {
    Key(PathBuf),
    Password(String),
}

/// 把认证参数挂到一条 `ssh` 命令上。返回值是 askpass 临时目录：它必须活到子进程结束，
/// 由调用方持有。密码档之外一律为 `None`。
pub(super) fn apply_auth(command: &mut Command, credential: &Credential) -> Result<Option<Askpass>> {
    match credential {
        Credential::Key(path) => {
            command
                .arg("-i")
                .arg(path)
                .args(["-o", "IdentitiesOnly=yes"])
                .args(["-o", "BatchMode=yes"]);
            Ok(None)
        }
        Credential::Password(password) => {
            let created = Askpass::create()?;
            command
                .env("SSH_ASKPASS", created.script())
                .env("SSH_ASKPASS_REQUIRE", "force")
                .env("DISPLAY", ":0")
                .env(ASKPASS_VAR, password)
                /* BatchMode 必须关：开着等于禁止密码交互，askpass 根本不会被调用 */
                .args(["-o", "BatchMode=no"])
                .args(["-o", "PubkeyAuthentication=no"])
                .args(["-o", "PreferredAuthentications=password,keyboard-interactive"])
                .args(["-o", "NumberOfPasswordPrompts=1"]);
            Ok(Some(created))
        }
    }
}


/// 密码登录靠 `SSH_ASKPASS`：`ssh` 在无终端环境下会去执行这个程序取密码
/// （OpenSSH ≥ 8.4 的 `SSH_ASKPASS_REQUIRE=force` 保证它一定走这条路）。
///
/// 密码只走环境变量：不进 argv（`ps` 看得见），不写进脚本（那是个脚本文件，
/// 只读 `$LUCKY_SSH_PASSWORD`）。脚本与本目录 0700，跑完就删。
pub(super) struct Askpass {
    dir: PathBuf,
}

const ASKPASS_VAR: &str = "LUCKY_SSH_PASSWORD";

impl Askpass {
    pub(super) fn create() -> Result<Self> {
        use std::os::unix::fs::PermissionsExt;

        let stamp = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|elapsed| elapsed.as_nanos())
            .unwrap_or(0);
        let dir = std::env::temp_dir().join(format!("lucky-askpass-{}-{stamp}", std::process::id()));
        std::fs::create_dir_all(&dir)?;
        std::fs::set_permissions(&dir, std::fs::Permissions::from_mode(0o700))?;

        let script = dir.join("askpass.sh");
        std::fs::write(&script, format!("#!/bin/sh\nprintf '%s\\n' \"${ASKPASS_VAR}\"\n"))?;
        std::fs::set_permissions(&script, std::fs::Permissions::from_mode(0o700))?;

        Ok(Self { dir })
    }

    pub(super) fn script(&self) -> PathBuf {
        self.dir.join("askpass.sh")
    }}

impl Drop for Askpass {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.dir);
    }
}

/// 跑一次 SSH。`stdin_line` 有值时写进 ssh 的标准输入（远端 `sudo -S` 从那里读密码）。
fn run_ssh(
    credential: &Credential,
    target: &str,
    port: u16,
    script: &str,
    stdin_line: Option<&str>,
) -> Result<Output> {
    let mut command = Command::new("ssh");
    command
        .args(["-o", "ConnectTimeout=5"])
        .args(["-o", "StrictHostKeyChecking=accept-new"])
        .arg("-p")
        .arg(port.to_string());

    /* askpass 目录要活到子进程跑完 —— 拿在手里，等 output 回来再随作用域销毁 */
    let askpass = apply_auth(&mut command, credential)?;

    command.arg(target).arg(script);

    let output = match stdin_line {
        Some(line) => {
            use std::io::Write;
            use std::process::Stdio;

            command.stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped());
            let mut child =
                command.spawn().map_err(|error| Error::Invalid(format!("起不了 ssh 进程：{error}")))?;
            if let Some(mut stdin) = child.stdin.take() {
                /* 远端可能提前退出，写失败不算错 —— 结论由退出码与 stderr 给 */
                let _ = stdin.write_all(line.as_bytes());
                let _ = stdin.write_all(b"\n");
            }
            child
                .wait_with_output()
                .map_err(|error| Error::Invalid(format!("ssh 没回来：{error}")))?
        }
        None => command
            .stdin(std::process::Stdio::null())
            .output()
            .map_err(|error| Error::Invalid(format!("起不了 ssh 进程：{error}")))?,
    };

    drop(askpass);
    Ok(output)
}

fn os_text(facts: &Facts) -> String {
    let spec = match (facts.cores, facts.mem_gb) {
        (Some(cores), Some(mem)) => format!("{cores}C{mem}G"),
        (Some(cores), None) => format!("{cores}C"),
        _ => "—".to_string(),
    };
    format!("{} · {}", facts.os, spec)
}

/* ------------------------------------------------------------------ *
 * 小件
 * ------------------------------------------------------------------ */

/// 表单的地址框允许写 `host:端口`（提交校验也放这个形状）。SSH 端口另有输入框，
/// 两处都给了就以地址串里写死的为准 —— 那是用户明确打进去的。
fn split_host_port(host: &str) -> (&str, Option<u16>) {
    match host.rsplit_once(':') {
        Some((name, tail))
            if !tail.is_empty()
                && !name.contains(':')
                && tail.chars().all(|c| c.is_ascii_digit()) =>
        {
            match tail.parse::<u16>() {
                Ok(port) if !name.is_empty() => (name, Some(port)),
                _ => (host, None),
            }
        }
        _ => (host, None),
    }
}

/// `~/.ssh/id_ed25519` 这种写法在表单里很常见，而 `ssh -i` 不做家目录展开。
pub(super) fn expand_home(path: &str) -> PathBuf {
    if let Some(rest) = path.strip_prefix("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return Path::new(&home).join(rest);
        }
    }
    PathBuf::from(path)
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{expand_home, reach, split_host_port, Askpass, StepState, ASKPASS_VAR};

    #[test]
    fn host_without_port_is_kept_whole() {
        assert_eq!(split_host_port("47.100.23.11"), ("47.100.23.11", None));
        assert_eq!(split_host_port("web-03.internal"), ("web-03.internal", None));
    }

    #[test]
    fn host_with_port_splits() {
        assert_eq!(split_host_port("web-03.internal:2222"), ("web-03.internal", Some(2222)));
        assert_eq!(split_host_port("47.100.23.11:22"), ("47.100.23.11", Some(22)));
    }

    #[test]
    fn ipv6_and_garbage_are_not_split() {
        assert_eq!(split_host_port("::1"), ("::1", None));
        assert_eq!(split_host_port("web-03:abc"), ("web-03:abc", None));
    }

    #[test]
    fn askpass_hands_the_password_over_and_cleans_up() {
        let askpass = Askpass::create().expect("建不了 askpass 脚本");
        let dir = askpass.dir.clone();
        let output = std::process::Command::new("sh")
            .arg(askpass.script())
            .env(ASKPASS_VAR, "s3cr3t pass")
            .output()
            .expect("跑不了 askpass 脚本");
        assert_eq!(String::from_utf8_lossy(&output.stdout).trim_end(), "s3cr3t pass");
        assert!(dir.is_dir());
        drop(askpass);
        assert!(!dir.exists(), "跑完该删掉临时目录");
    }

    #[test]
    fn loopback_resolves() {
        let outcome = reach("127.0.0.1", 22).expect("回环地址不该报错");
        assert_eq!(outcome.dns.state, StepState::Ok);
        assert_eq!(outcome.dns.value, "127.0.0.1");
    }

    #[test]
    fn home_prefix_expands() {
        /* 不改 HOME：改了之后同一个进程里找钥匙串的测试会去 ~/Library 里翻一个不存在的
           用户目录，报 "A default keychain could not be found" */
        let home = std::env::var("HOME").expect("测试环境没有 HOME");
        assert_eq!(expand_home("~/.ssh/id_ed25519"), PathBuf::from(&home).join(".ssh/id_ed25519"));
        assert_eq!(expand_home("/abs/key"), PathBuf::from("/abs/key"));
    }
}
