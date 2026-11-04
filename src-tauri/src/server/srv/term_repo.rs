//! 终端会话与命令的 SQL。
//!
//! 两张表都是审计用途：会话记"谁在哪台机器上开了终端、怎么结束的"，
//! 命令记"敲过什么、退出码多少、跑了多久"。命令输出不落库 —— 一条 `cat` 就能
//! 拉出几 MB 文本，库里只留字节数，够判断该不该截断。
use rusqlite::{params, Connection, OptionalExtension};
use serde::Serialize;

use crate::server::error::Result;

use super::repo;

/// 一条会话（读出形态）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TermSessionRow {
    pub id: String,
    pub login_user: String,
    pub os: String,
    pub cwd: String,
    pub started_at: String,
    pub ended_at: Option<String>,
    /// open / closed / lost
    pub status: String,
    pub command_count: i64,
}

/// 一条命令（读出形态，历史记录用）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TermCommandRow {
    pub id: String,
    pub command: String,
    /// `None` = 没跑起来（连接断了 / 超时被杀）
    pub exit_code: Option<i64>,
    pub duration_ms: i64,
    pub cwd: String,
    pub ran_at: String,
}

/// 新会话落库。
pub fn create_session(
    conn: &Connection,
    id: &str,
    server_id: &str,
    login_user: &str,
    os: &str,
    cwd: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO srv_term_session (id, server_id, login_user, os, cwd, started_at, status)
         VALUES (?1, ?2, ?3, ?4, ?5, strftime('%Y-%m-%dT%H:%M:%SZ','now'), 'open')",
        params![id, server_id, login_user, os, cwd],
    )?;
    Ok(())
}

/// 这台机器上一条会话如果还挂着 `open`，说明应用退过或窗口被关掉 —— 它不可能还活着
/// （会话只活在内存里），标成 `lost` 比留一条永远 `open` 的假记录诚实。
pub fn close_stale(conn: &Connection, server_id: &str) -> Result<()> {
    conn.execute(
        "UPDATE srv_term_session SET status = 'lost', ended_at = COALESCE(ended_at, started_at)
         WHERE server_id = ?1 AND status = 'open'",
        [server_id],
    )?;
    Ok(())
}

/// 收会话：`closed` 是正常断开，`lost` 是连接自己断了。
pub fn finish_session(conn: &Connection, session_id: &str, status: &str) -> Result<()> {
    conn.execute(
        "UPDATE srv_term_session
         SET status = ?2, ended_at = COALESCE(ended_at, strftime('%Y-%m-%dT%H:%M:%SZ','now'))
         WHERE id = ?1",
        params![session_id, status],
    )?;
    Ok(())
}

/// 一条命令落库，同时把会话的命令数加一。
pub fn add_command(
    conn: &Connection,
    session_id: &str,
    server_id: &str,
    command: &str,
    exit_code: Option<i64>,
    duration_ms: i64,
    output_bytes: i64,
    cwd: &str,
) -> Result<()> {
    conn.execute(
        "INSERT INTO srv_term_command
           (id, session_id, server_id, command, exit_code, duration_ms, output_bytes, cwd, ran_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
        params![
            crate::server::id::new_id("tc"),
            session_id,
            server_id,
            command,
            exit_code,
            duration_ms,
            output_bytes,
            cwd
        ],
    )?;
    conn.execute(
        "UPDATE srv_term_session SET command_count = command_count + 1 WHERE id = ?1",
        [session_id],
    )?;
    Ok(())
}

/// 这台机器上跑过的命令，新的在前。上/下方向键跨会话取的就是它。
pub fn history(conn: &Connection, host: &str, limit: i64) -> Result<Vec<TermCommandRow>> {
    let server_id = repo::conn_params(conn, host)?.id;
    let mut stmt = conn.prepare(
        "SELECT id, command, exit_code, duration_ms, cwd, ran_at
         FROM srv_term_command WHERE server_id = ?1
         ORDER BY ran_at DESC, rowid DESC LIMIT ?2",
    )?;
    let rows = stmt
        .query_map(params![server_id, limit], |row| {
            Ok(TermCommandRow {
                id: row.get(0)?,
                command: row.get(1)?,
                exit_code: row.get(2)?,
                duration_ms: row.get(3)?,
                cwd: row.get(4)?,
                ran_at: row.get(5)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// 这台机器上的会话，新的在前。
pub fn sessions(conn: &Connection, host: &str, limit: i64) -> Result<Vec<TermSessionRow>> {
    let server_id = repo::conn_params(conn, host)?.id;
    let mut stmt = conn.prepare(
        "SELECT id, login_user, os, cwd, started_at, ended_at, status, command_count
         FROM srv_term_session WHERE server_id = ?1
         ORDER BY started_at DESC, rowid DESC LIMIT ?2",
    )?;
    let rows = stmt
        .query_map(params![server_id, limit], |row| {
            Ok(TermSessionRow {
                id: row.get(0)?,
                login_user: row.get(1)?,
                os: row.get(2)?,
                cwd: row.get(3)?,
                started_at: row.get(4)?,
                ended_at: row.get(5)?,
                status: row.get(6)?,
                command_count: row.get(7)?,
            })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(rows)
}

/// 这台机器累计开过几次终端（开屏那句「第 N 次会话」用它）。
pub fn session_count(conn: &Connection, server_id: &str) -> Result<i64> {
    let count: Option<i64> = conn
        .query_row(
            "SELECT COUNT(*) FROM srv_term_session WHERE server_id = ?1",
            [server_id],
            |row| row.get(0),
        )
        .optional()?;
    Ok(count.unwrap_or(0))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::server::store::Store;

    /// 一张真库：迁移要跑得过（`srv_term_*` 是新表），四件事要串得起来 ——
    /// 开会话、记命令、按机器翻历史、收会话。
    #[test]
    fn session_and_command_rows_round_trip() {
        let dir = std::env::temp_dir().join(format!("lucky-term-repo-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let store = Store::open(dir.join("lucky.db"), dir.join("docs")).unwrap();

        let conn = store.conn().unwrap();
        conn.execute(
            "INSERT INTO srv_server (id, host, ip, role_code, env_code, created_at, updated_at)
             VALUES ('srv-1', 'm1', '10.0.0.1', 'web', 'prod', '2026-11-04T00:00:00Z', '2026-11-04T00:00:00Z')",
            [],
        )
        .unwrap();

        create_session(&conn, "ts-1", "srv-1", "root", "Linux 6.1", "/root").unwrap();
        assert_eq!(session_count(&conn, "srv-1").unwrap(), 1);

        add_command(&conn, "ts-1", "srv-1", "ls -la", Some(0), 12, 40, "/root").unwrap();
        add_command(&conn, "ts-1", "srv-1", "false", Some(1), 3, 0, "/tmp").unwrap();

        let rows = history(&conn, "m1", 10).unwrap();
        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].command, "false", "新的在前");
        assert_eq!(rows[0].exit_code, Some(1));

        let open = sessions(&conn, "m1", 10).unwrap();
        assert_eq!(open[0].status, "open");
        assert_eq!(open[0].command_count, 2);

        /* 应用重启过：上一条还挂着 open 的会话该被标成 lost */
        close_stale(&conn, "srv-1").unwrap();
        assert_eq!(sessions(&conn, "m1", 10).unwrap()[0].status, "lost");

        finish_session(&conn, "ts-1", "closed").unwrap();
        assert_eq!(sessions(&conn, "m1", 10).unwrap()[0].status, "closed");

        drop(conn);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
