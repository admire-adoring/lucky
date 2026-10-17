//! 执行层「项目」域。门面：取锁 + 调 repo + 组装错误 —— 本模块是该域唯一的 `pub` 面。
//!
//! 起居 / 工作 / 学习三个域的 `/x/projects` 入口都调这里的函数，只是 `scope` 不同；
//! 项目域自己的跨域总览（`/projects`）传 `None`。见 `design/sql-design/全局架构.md` §五。
//!
//! 文档子域（`project_document` / `project_document_link`）住在 `doc/` 下 ——
//! 它属项目族，但不是项目本体：一个管"项目是什么"，一个管"这个项目的资料在哪"。
pub mod doc;
mod model;
mod repo;

#[allow(unused_imports)]
pub use doc::{DocContent, Document, DocumentInput, DocumentLink};
pub use model::{Project, ProjectInput, ProjectRisk};

use crate::server::error::Result;
use crate::server::store::Store;

/// 项目列表。`scope` 不给就是全部（跨域总览）。
pub fn list(store: &Store, scope: Option<&str>) -> Result<Vec<Project>> {
    let conn = store.conn()?;
    repo::list(&conn, scope)
}

pub fn get(store: &Store, id: &str) -> Result<Project> {
    let conn = store.conn()?;
    repo::get(&conn, id)
}

pub fn create(store: &Store, input: &ProjectInput) -> Result<Project> {
    let mut conn = store.conn()?;
    repo::create(&mut conn, input)
}

pub fn update(store: &Store, id: &str, input: &ProjectInput) -> Result<Project> {
    let mut conn = store.conn()?;
    repo::update(&mut conn, id, input)
}

/// 归档 / 完成 / 恢复：换一个 status（软删就是 `archived`）。
pub fn set_status(store: &Store, id: &str, status: &str) -> Result<Project> {
    let mut conn = store.conn()?;
    repo::set_status(&mut conn, id, status)
}

/// 彻底删除（卫星表级联；该项目下的任务回到收件箱）。
pub fn delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::delete(&conn, id)
}

/// 追加一条项目动态。
pub fn log_activity(store: &Store, id: &str, action: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::log_activity(&conn, id, action)
}
