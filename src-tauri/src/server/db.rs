//! 连接与迁移。
//!
//! 迁移源是 `design/sql-design/` 下那三份 DDL，`include_str!` 在同一处引用，
//! 不另存副本。数组顺序即 `PRAGMA user_version`。
use std::path::Path;

use rusqlite::Connection;

use crate::server::error::Result;

const MIGRATIONS: &[(i64, &str)] = &[
    (
        1,
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../design/sql-design/work-design/0001_init.sql"
        )),
    ),
    (
        2,
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../design/sql-design/work-design/0002_work.sql"
        )),
    ),
    (
        3,
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../design/sql-design/srv-design/0003_srv.sql"
        )),
    ),
];

/// 打开（或新建）一个数据库文件，把外键打开、跑到最新版本。
///
/// 外键必须在每次连接建立后显式打开：SQLite 默认关，关了之后 `ON DELETE CASCADE`
/// 与那些复合外键都只是注释。
pub fn open(path: &Path) -> Result<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA foreign_keys = ON;")?;
    conn.execute_batch("PRAGMA journal_mode = WAL;")?;
    migrate(&conn)?;
    Ok(conn)
}

/// 只跑还没跑过的迁移。逐个文件比较版本号，不做"整份重放"。
pub fn migrate(conn: &Connection) -> Result<()> {
    let current: i64 = conn.query_row("PRAGMA user_version", [], |row| row.get(0))?;
    for (version, sql) in MIGRATIONS {
        if *version <= current {
            continue;
        }
        conn.execute_batch(sql)?;
        conn.execute_batch(&format!("PRAGMA user_version = {version};"))?;
    }
    Ok(())
}
