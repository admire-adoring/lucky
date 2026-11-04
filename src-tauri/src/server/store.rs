//! Store：连接 + 文档根 + 锁。从 `srv/mod.rs` 提出到 crate 根 —— 第二个域出现后它不该再属于 srv。
//!
//! 它是"应用的存储上下文"：数据库连接与文档正文的根目录绑在一起，
//! 因为文档索引（库）与正文（文件）是一件事的两半，域门面不该自己去拼路径。
//! 它只管拿这两样；业务入口是各域的门面自由函数（`srv::list(&store)` 这种），
//! 不在 Store 上按操作堆方法 —— 那样方法名会被迫带域前缀，而且第二个域照样往
//! 同一个 impl 上加。
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

use crate::server::db;
use crate::server::error::{Error, Result};

/// 领域层对外的唯一入口。壳层拿到的是它，业务函数收 `&Store`，
/// 不知道 SQLite 与文件系统长什么样。
pub struct Store {
    conn: Mutex<Connection>,
    /// 实际打开的那个库文件 —— 账户页的「本机数据」要显示它，
    /// 取这里而不是重新读 config，避免"显示的"与"用着的"两处漂。
    db_path: PathBuf,
    documents_root: PathBuf,
}

impl Store {
    pub fn open(db_path: impl AsRef<Path>, documents_root: impl AsRef<Path>) -> Result<Self> {
        let conn = db::open(db_path.as_ref())?;
        Ok(Self {
            conn: Mutex::new(conn),
            db_path: db_path.as_ref().to_path_buf(),
            documents_root: documents_root.as_ref().to_path_buf(),
        })
    }

    /// `pub(crate)`：连接只在域门面里出现，repo 收的也只是 `&Connection`。
    pub(crate) fn conn(&self) -> Result<MutexGuard<'_, Connection>> {
        self.conn
            .lock()
            .map_err(|_| Error::Invalid("数据库连接已中毒，需要重启应用".into()))
    }

    /// 库文件的绝对路径（账户页展示用）。
    pub(crate) fn db_path(&self) -> &Path {
        &self.db_path
    }

    /// 文档正文的根目录（`<root>/<owner_kind>/<owner_id>/<文件名>.md`）。
    pub(crate) fn documents_root(&self) -> &Path {
        &self.documents_root
    }
}
