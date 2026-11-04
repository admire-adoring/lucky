//! 连接探测：真跑一次 SSH，成功则把机器自报的规格缓存进表。
//!
//! 三个决定：
//! 1. **用系统 `ssh`，不用 ssh2/openssh crate** —— macOS 与 Linux 都自带客户端，
//!    零额外编译依赖；进程调用也天然隔离（连接挂起不会拖死应用）。
//! 2. **非交互**：密钥档 `BatchMode=yes`，不对就立刻失败，不会挂起等人输密码；
//!    密码档走 `SSH_ASKPASS`（见 `draft.rs`）—— 密码从钥匙串里取，不进 argv。
//!    两条入口共用 `draft::login`，不存在"表单能连、台账连不上"。
//! 3. `StrictHostKeyChecking=accept-new`：首次连接自动接受新指纹。
//!    known_hosts 里**已有**的机器如果指纹变了仍然拒绝（中间人检测保留）。
//!
//! 采集脚本与失败文案的映射放在本文件、给 `draft.rs` 复用：表单里的「检查连接」
//! 与台账里的「测试连接」读的是同一台机器的同一批字段，各写一份必然分叉。
use rusqlite::{params, Connection, OptionalExtension};

use crate::server::error::{Error, Result};

use super::draft::{self, LoginProbeInput, StepState};

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

/// 机器自报的规格。台账探测把它写回表，表单检查把它回给预览。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Facts {
    /// `uname -sr`
    pub os: String,
    pub cores: Option<i64>,
    pub mem_gb: Option<i64>,
    pub disk_gb: Option<i64>,
}

/// 远端采集脚本。每段用 `---` 分隔，全部带 `2>/dev/null` 与回退 ——
/// 目标机器可能是 Linux 也可能是 macOS（free/sysctl 只有一边有）。
pub(super) const REMOTE_SCRIPT: &str = "uname -sr; echo ---; nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null; echo ---; (free -m 2>/dev/null | awk '/Mem:/{print $2}') || (sysctl -n hw.memsize 2>/dev/null | awk '{printf \"%d\", $1/1048576}'); echo ---; (df -k / 2>/dev/null | tail -1 | awk '{print $2}')";

/// 四段解析（内核 / 核数 / 内存 MB / 磁盘 KB），段间 `---`。
/// 任何一段拿不到就留空 —— 采集是尽力而为，不该因为目标机器少一个 `free`
/// 就把"连上了"判成失败。
pub(super) fn split_facts(stdout: &str) -> Facts {
    let mut parts = stdout.split("---").map(|part| part.trim().to_string());
    let os = parts.next().unwrap_or_default();
    let cores = parts.next().and_then(|text| text.lines().next()?.trim().parse().ok());
    let mem_mb = parts.next().and_then(|text| text.lines().next()?.trim().parse::<i64>().ok());
    let disk_kb = parts.next().and_then(|text| text.lines().next()?.trim().parse::<i64>().ok());

    Facts {
        os,
        cores,
        mem_gb: mem_mb.map(|mb| (mb / 1024).max(1)),
        disk_gb: disk_kb.map(|kb| (kb / 1_048_576).max(1)),
    }
}

/// SSH 的 stderr → 一句能照着动手的话。`target` 是主机（不带端口）。
pub(super) fn ssh_failure(stderr: &str, target: &str, port: u16) -> String {
    if stderr.contains("Permission denied") {
        "密钥被拒绝 —— 确认本机公钥已在目标机器的 authorized_keys 里".to_string()
    } else if stderr.contains("Connection timed out") || stderr.contains("Connection refused") {
        format!("连不上 {target}:{port} —— 机器关着、端口没开，或者 IP 不对")
    } else if stderr.contains("Could not resolve hostname") {
        format!("解析不了主机名 {target}")
    } else if stderr.contains("No such file") || stderr.contains("not accessible") {
        "私钥文件读不了 —— 路径对不对，有没有权限".to_string()
    } else if stderr.contains("Host key verification failed") {
        format!("{target} 的指纹与 known_hosts 里记的不一致，连下去有中间人风险")
    } else {
        format!(
            "SSH 失败：{}",
            stderr
                .lines()
                .next()
                .unwrap_or("没拿到 stderr")
        )
    }
}

/// `user` 与地址会被拼进 `user@host`。不经 shell 所以没有注入，但空格与控制字符
/// 会拆坏参数 —— 直接拒绝，别让一条坏数据伪装成"连接失败"。
pub(super) fn validate_part(what: &str, value: &str) -> Result<()> {
    if value.is_empty()
        || !value
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || "@._-".contains(c))
    {
        return Err(Error::Invalid(format!("{what}里有不合法字符：{value:?}")));
    }
    Ok(())
}

/// 按 host 读库里的连接参数 → 跑 SSH → 解析 → 把规格写回表。
///
/// 凭据（密码 / 私钥路径）不在库里，按 `cred_ref` 去钥匙串取 —— 走的是与表单
/// 「检查连接」同一条 `draft::login`，两台入口不会出现"一处能连一处连不上"。
/// 提权那一步这里不做：台账的「测试连接」只回答"通不通"。
pub fn probe(conn: &Connection, host: &str) -> Result<ProbeOutcome> {
    let row = conn
        .query_row(
            "SELECT ip, ssh_port, login_user, auth_code, cred_ref FROM srv_server WHERE host = ?1",
            [host],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, String>(3)?,
                    row.get::<_, Option<String>>(4)?,
                ))
            },
        )
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("机器 {host}")))?;
    let (ip, port, user, auth_code, cred_ref) = row;

    let input = LoginProbeInput {
        host: ip.clone(),
        port: port as u16,
        login_user: user.clone(),
        auth_code,
        key_path: None,
        password: None,
        cred_ref,
        esc_mode: "none".to_string(),
        esc_user: None,
    };
    let outcome = draft::login(&input)?;

    if outcome.auth.state != StepState::Ok {
        return Ok(ProbeOutcome {
            ok: false,
            message: outcome.auth.message,
            os: String::new(),
            cores: None,
            mem_gb: None,
            disk_gb: None,
        });
    }

    let facts = outcome.facts.unwrap_or(Facts {
        os: String::new(),
        cores: None,
        mem_gb: None,
        disk_gb: None,
    });

    /* 规格写回：表里这四列的设计就是"机器自己会报，连上一次后缓存"。 */
    conn.execute(
        "UPDATE srv_server SET os = ?2, cores = ?3, mem_gb = ?4, disk_gb = ?5,
         updated_at = strftime('%Y-%m-%dT%H:%M:%SZ','now')
         WHERE host = ?1",
        params![host, facts.os, facts.cores, facts.mem_gb, facts.disk_gb],
    )?;

    Ok(ProbeOutcome {
        ok: true,
        message: format!("已连接 {user}@{ip}:{port} · {} · {:?} 核", facts.os, facts.cores),
        os: facts.os,
        cores: facts.cores,
        mem_gb: facts.mem_gb,
        disk_gb: facts.disk_gb,
    })
}
