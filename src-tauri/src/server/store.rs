//! Store：连接 + 锁。从 `srv/mod.rs` 提出到 crate 根 —— 第二个域出现后它不该再属于 srv。
//!
//! 它只管拿连接；业务入口是各域的门面自由函数（`srv::list(&store)` 这种），
//! 不在 Store 上按操作堆方法 —— 那样方法名会被迫带域前缀，而且第二个域照样往
//! 同一个 impl 上加。
use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

use crate::server::db;
use crate::server::error::{Error, Result};

/// 领域层对外的唯一入口。壳层拿到的是它，业务函数收 `&Store`，
/// 不知道 SQLite 的存在。
pub struct Store {
    conn: Mutex<Connection>,
}

impl Store {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let conn = db::open(path.as_ref())?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    /// `pub(crate)`：连接只在域门面里出现，repo 收的也只是 `&Connection`。
    pub(crate) fn conn(&self) -> Result<MutexGuard<'_, Connection>> {
        self.conn
            .lock()
            .map_err(|_| Error::Invalid("数据库连接已中毒，需要重启应用".into()))
    }
}
