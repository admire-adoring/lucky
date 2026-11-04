//! 执行层「项目」域。门面：取锁 + 调 repo + 组装错误 —— 本模块是该域唯一的 `pub` 面。
//!
//! 起居 / 工作 / 学习三个域的 `/x/projects` 入口都调这里的函数，只是 `scope` 不同；
//! 项目域自己的跨域总览（`/projects`）传 `None`。见 `design/sql-design/全局架构.md` §五。
//!
//! 文档**不在这个域里**：它是 `server/doc`（一张表挂多种主实体 —— 项目 / 服务器 / 未来的笔记）。
//! 删项目时这里只负责调 `doc::cleanup_by_owner(store, "project", id)` 把它的文档一起清掉。
mod account;
mod bug;
mod html;
mod milestone;
mod model;
mod repo;

pub use account::{ProjectAccount, ProjectAccountInput};
pub use bug::{ProjectBug, ProjectBugInput};
pub use html::HtmlFile;
pub use milestone::{MilestoneInput, ProjectMilestone};
pub use model::{Project, ProjectInput, ProjectRisk};

use serde::Serialize;

/// 动态流的一行。`who` 是操作人显示名（hydrate 自 app_user）。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ActivityRow {
    pub id: String,
    pub project_id: String,
    pub actor_id: Option<String>,
    pub who: String,
    pub action: String,
    pub at: String,
}

/// 跨项目最近动态的一行（工作台首页用），带项目名。
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecentActivityRow {
    pub id: String,
    pub project_id: String,
    pub project_name: String,
    pub actor_id: Option<String>,
    pub who: String,
    pub action: String,
    pub at: String,
}

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

/// 彻底删除（先清正文文件、再删索引；卫星表级联；该项目下的任务回到收件箱）。
pub fn delete(store: &Store, id: &str) -> Result<()> {
    repo::delete(store, id)
}

/// 追加一条项目动态。
pub fn log_activity(store: &Store, id: &str, action: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::log_activity(&conn, id, action)
}

/// 项目目录下的 HTML（流程图 / 架构图那一类）。
pub fn html_list(store: &Store, project_id: &str) -> Result<Vec<HtmlFile>> {
    let conn = store.conn()?;
    html::list(&conn, project_id)
}

/// 校验并给出 html 的绝对路径。开窗口在壳层 —— 这一层不许 `use tauri`。
pub fn html_resolve(store: &Store, project_id: &str, rel: &str) -> Result<std::path::PathBuf> {
    let conn = store.conn()?;
    html::resolve(&conn, project_id, rel)
}

/// 项目账户（凭据）。元信息在库、明文在钥匙串。
pub fn account_list(store: &Store, project_id: &str) -> Result<Vec<ProjectAccount>> {
    let conn = store.conn()?;
    account::list(&conn, project_id)
}

pub fn account_create(
    store: &Store,
    project_id: &str,
    input: &ProjectAccountInput,
) -> Result<ProjectAccount> {
    let mut conn = store.conn()?;
    account::create(&mut conn, project_id, input)
}

pub fn account_update(store: &Store, id: &str, input: &ProjectAccountInput) -> Result<ProjectAccount> {
    let mut conn = store.conn()?;
    account::update(&mut conn, id, input)
}

pub fn account_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    account::delete(&conn, id)
}

/// 读明文 —— 走本机钥匙串，库里没有。
pub fn account_secret(store: &Store, id: &str) -> Result<String> {
    let conn = store.conn()?;
    account::secret(&conn, id)
}

/// 项目问题清单（`project_bug`）。
pub fn bug_list(store: &Store, project_id: &str) -> Result<Vec<ProjectBug>> {
    let conn = store.conn()?;
    bug::list(&conn, project_id)
}

pub fn bug_create(store: &Store, project_id: &str, input: &ProjectBugInput) -> Result<ProjectBug> {
    let conn = store.conn()?;
    bug::create(&conn, project_id, input)
}

pub fn bug_update(store: &Store, id: &str, input: &ProjectBugInput) -> Result<ProjectBug> {
    let conn = store.conn()?;
    bug::update(&conn, id, input)
}

pub fn bug_set_status(store: &Store, id: &str, status: &str) -> Result<ProjectBug> {
    let conn = store.conn()?;
    bug::set_status(&conn, id, status)
}

pub fn bug_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    bug::delete(&conn, id)
}

/* —— 里程碑（project_milestone）—— */

pub fn milestone_list(store: &Store, project_id: &str) -> Result<Vec<ProjectMilestone>> {
    let conn = store.conn()?;
    milestone::list(&conn, project_id)
}

pub fn milestone_create(
    store: &Store,
    project_id: &str,
    input: &MilestoneInput,
) -> Result<ProjectMilestone> {
    let mut conn = store.conn()?;
    milestone::create(&mut conn, project_id, input)
}

pub fn milestone_update(
    store: &Store,
    id: &str,
    input: &MilestoneInput,
) -> Result<ProjectMilestone> {
    let mut conn = store.conn()?;
    milestone::update(&mut conn, id, input)
}

pub fn milestone_set_state(
    store: &Store,
    id: &str,
    state: &str,
) -> Result<ProjectMilestone> {
    let mut conn = store.conn()?;
    milestone::set_state(&mut conn, id, state)
}

pub fn milestone_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    milestone::delete(&conn, id)
}

/* —— 动态（project_activity）—— */

/// 项目的动态流（按时间倒序）。`limit` 不给就全取。
pub fn list_activity(store: &Store, project_id: &str, limit: Option<i64>) -> Result<Vec<ActivityRow>> {
    let conn = store.conn()?;
    repo::list_activity(&conn, project_id, limit)
}

/// 跨项目的最近动态（工作台首页用）。
pub fn recent_activity(store: &Store, limit: i64) -> Result<Vec<RecentActivityRow>> {
    let conn = store.conn()?;
    repo::recent_activity(&conn, limit)
}
