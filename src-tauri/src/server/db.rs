//! 连接与迁移。
//!
//! 迁移源是 `design/sql-design/` 下那三份 DDL，`include_str!` 在同一处引用，
//! 不另存副本。数组顺序即 `PRAGMA user_version`。
use std::path::Path;

use rusqlite::Connection;

use crate::server::error::{Error, Result};

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
    (
        4,
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../design/sql-design/work-design/0004_project_account.sql"
        )),
    ),
    (
        5,
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../design/sql-design/work-design/0005_task_item.sql"
        )),
    ),
    (
        6,
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../design/sql-design/work-design/0006_project_bug.sql"
        )),
    ),
    (
        7,
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../design/sql-design/work-design/0007_meeting_project.sql"
        )),
    ),
    (
        8,
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../design/sql-design/work-design/0008_calendar_event.sql"
        )),
    ),
    (
        9,
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../design/sql-design/work-design/0009_knowledge.sql"
        )),
    ),
    (
        10,
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../design/sql-design/work-design/0010_life.sql"
        )),
    ),
    (
        11,
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../design/sql-design/work-design/0011_setting.sql"
        )),
    ),
    (
        12,
        include_str!(concat!(
            env!("CARGO_MANIFEST_DIR"),
            "/../design/sql-design/work-design/0012_learning.sql"
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
    check_shape(&conn)?;
    Ok(conn)
}

/// 跑完迁移后的结构体检：关键表 / 列必须在。
///
/// 为什么需要它：`user_version` 只是一个数字 —— 手工建过、或从更早版本拷来的库
/// 可能把版本号写成最新而结构停在旧版。本仓 2026-10-17 就踩到一次：
/// 库里缺 `project.path`、没有 `doc` 表，但 `user_version=3`，于是迁移全跳过，
/// 每条项目查询都报 `no such column` —— 看起来像"功能坏了"，实际是"库旧了"。
/// 这里把它变成一句能照做的错误。
///
/// 清单要跟着 DDL 走：表被删了（如 `work_doc` 并入 `doc`）就要把对应项摘掉，
/// 否则老库过不了校验、新库照样过不了 —— 这道闸门自己也会变成"启动失败"的来源。
const REQUIRED: &[(&str, &str)] = &[
    ("project", "path"),
    ("task", "scope"),
    ("doc", "owner_kind"),
    ("doc", "file_path"),
    ("srv_server", "cred_ref"),
];

fn check_shape(conn: &Connection) -> Result<()> {
    for (table, column) in REQUIRED {
        /* 表名 / 列名都是本文件的常量，拼接没有注入面 */
        let sql =
            format!("SELECT COUNT(*) > 0 FROM pragma_table_info('{table}') WHERE name = '{column}'");
        let ok: bool = conn.query_row(&sql, [], |row| row.get(0))?;
        if !ok {
            return Err(Error::Invalid(format!(
                "库结构落后：{table}.{column} 不存在。删掉库文件让应用重建，或补一份迁移（见 全局架构.md §七）"
            )));
        }
    }
    Ok(())
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
