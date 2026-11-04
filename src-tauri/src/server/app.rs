//! 应用级信息：库与文档落在哪、各有多少。给「账户」页的「本机数据」卡用。
//!
//! 这不是配置的副本 —— 路径取的是**实际打开的那一份**（`Store` 里记着），
//! 所以 `config.toml` 改了之后这里显示的就是新值，不会两处漂。
use serde::Serialize;

use crate::server::error::Result;
use crate::server::store::Store;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub db_path: String,
    pub documents_root: String,
    pub projects: i64,
    pub tasks: i64,
    pub docs: i64,
    pub users: i64,
}

pub fn info(store: &Store) -> Result<AppInfo> {
    let conn = store.conn()?;
    let count = |sql: &str| -> Result<i64> { Ok(conn.query_row(sql, [], |row| row.get(0))?) };
    Ok(AppInfo {
        db_path: store.db_path().display().to_string(),
        documents_root: store.documents_root().display().to_string(),
        projects: count("SELECT COUNT(*) FROM project")?,
        tasks: count("SELECT COUNT(*) FROM task")?,
        docs: count("SELECT COUNT(*) FROM doc")?,
        users: count("SELECT COUNT(*) FROM app_user")?,
    })
}
