//! 连接探测：真跑一次 SSH，成功则把机器自报的规格缓存进表。
//!
//! 三个决定：
//! 1. **用系统 `ssh`，不用 ssh2/openssh crate** —— macOS 与 Linux 都自带客户端，
//!    零额外编译依赖；进程调用也天然隔离（连接挂起不会拖死应用）。
//! 2. **`BatchMode=yes`**：非交互。密钥不对立刻失败，不会挂起等人输密码 ——
//!    代价是**密码认证（`auth_code='pwd'`）连不了**：`ssh` 没有非交互传密码的方式
//!    （`sshpass` 在 macOS 上默认没有）。这类机器返回明确的错误，而不是让用户干等。
//! 3. `StrictHostKeyChecking=accept-new`：首次连接自动接受新指纹。
//!    known_hosts 里**已有**的机器如果指纹变了仍然拒绝（中间人检测保留）。
use rusqlite::{params, Connection, OptionalExtension};

use crate::server::error::{Error, Result};

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProbeOutcome {
    pub ok: bool,
    pub message: String,
    /// `uname -sr`（如 `Linux 6.8.0-45-generic`）
    pub os: String,
    pub cores: Option<i64>,
    pub mem_gb: Option<i64>,
    pub disk_gb: Option<i64>,
}

/// 远端采集脚本。每段用 `---` 分隔，全部带 `2>/dev/null` 与回退 ——
/// 目标机器可能是 Linux 也可能是 macOS（free/sysctl 只有一边有）。
const REMOTE_SCRIPT: &str = "uname -sr; echo ---; nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null; echo ---; (free -m 2>/dev/null | awk '/Mem:/{print $2}') || (sysctl -n hw.memsize 2>/dev/null | awk '{printf \"%d\", $1/1048576}'); echo ---; (df -k / 2>/dev/null | tail -1 | awk '{print $2}')";

/// 按 host 读库里的连接参数 → 跑 SSH → 解析 → 把规格写回表。
pub fn probe(conn: &Connection, host: &str) -> Result<ProbeOutcome> {
    let row = conn
        .query_row(
            "SELECT ip, ssh_port, login_user, auth_code FROM srv_server WHERE host = ?1",
            [host],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                ))
            },
        )
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("机器 {host}")))?;
    let (ip, port, user, auth_code) = row;

    if auth_code == "pwd" {
        return Err(Error::Invalid(
            "这台机器用密码认证 —— 密码没法在非交互的 SSH 里传递，请改用密钥认证（把本机公钥放进它的 authorized_keys）".into(),
        ));
    }
    /* user 与 ip 会被拼进 SSH 的目标参数（`user@ip`）。不经 shell 所以没有注入，
       但空格与控制字符会拆坏参数 —— 直接拒绝，别让一条坏数据伪装成"连接失败"。 */
    for (what, value) in [("登录用户", user.as_str()), ("地址", ip.as_str())] {
        if value.is_empty()
            || !value
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || "@._-".contains(c))
        {
            return Err(Error::Invalid(format!("{what}里有不合法字符：{value:?}")));
        }
    }

    let output = std::process::Command::new("ssh")
        .args(["-o", "BatchMode=yes"])
        .args(["-o", "ConnectTimeout=5"])
        .args(["-o", "StrictHostKeyChecking=accept-new"])
        .args(["-p", &port.to_string()])
        .arg(format!("{user}@{ip}"))
        .arg(REMOTE_SCRIPT)
        .output()
        .map_err(|error| Error::Invalid(format!("起不了 ssh 进程：{error}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        let message = if stderr.contains("Permission denied") {
            "密钥被拒绝 —— 确认本机公钥已在目标机器的 authorized_keys 里".to_string()
        } else if stderr.contains("Connection timed out") || stderr.contains("Connection refused") {
            format!("连不上 {ip}:{port} —— 机器关着、端口没开，或者 IP 不对")
        } else if stderr.contains("Could not resolve hostname") {
            format!("解析不了主机名 {ip}")
        } else {
            format!("SSH 失败：{}", stderr.lines().next().unwrap_or("未知错误"))
        };
        return Ok(ProbeOutcome {
            ok: false,
            message,
            os: String::new(),
            cores: None,
            mem_gb: None,
            disk_gb: None,
        });
    }

    /* 解析：四段（内核 / 核数 / 内存 MB / 磁盘 KB），段间 `---`。任何一段拿不到就留空 ——
       采集是尽力而为，不该因为目标机器少一个 free 命令就把"连上了"判成失败。 */
    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut parts = stdout.split("---").map(|part| part.trim().to_string());
    let os = parts.next().unwrap_or_default();
    let cores = parts.next().and_then(|text| text.lines().next()?.trim().parse().ok());
    let mem_mb = parts.next().and_then(|text| text.lines().next()?.trim().parse::<i64>().ok());
    let disk_kb = parts.next().and_then(|text| text.lines().next()?.trim().parse::<i64>().ok());

    let mem_gb = mem_mb.map(|mb| (mb / 1024).max(1));
    let disk_gb = disk_kb.map(|kb| (kb / 1_048_576).max(1));

    /* 规格写回：表里这四列的设计就是"机器自己会报，连上一次后缓存"。 */
    conn.execute(
        "UPDATE srv_server SET os = ?2, cores = ?3, mem_gb = ?4, disk_gb = ?5,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
         WHERE host = ?1",
        params![host, os, cores, mem_gb, disk_gb],
    )?;

    Ok(ProbeOutcome {
        ok: true,
        message: format!("已连接 {user}@{ip}:{port} · {os} · {cores:?} 核"),
        os,
        cores,
        mem_gb,
        disk_gb,
    })
}
