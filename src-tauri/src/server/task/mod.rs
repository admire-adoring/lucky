//! 全局层「任务清单」域（`/tasks`）。门面：取锁 + 调 repo + 组装错误。
//!
//! 项目详情页的「任务」分区也读这里，只是带上 `project_id` 过滤 —— 任务不挂死在项目上。
mod item;
mod model;
mod repo;

pub use item::TaskItem;
pub use model::{Task, TaskInput};

use crate::server::error::Result;
use crate::server::store::Store;

/// 任务列表。两个过滤都可选：`projectId` 给"某项目的任务"，`scope` 给"某域的任务清单"。
pub fn list(store: &Store, project_id: Option<&str>, scope: Option<&str>) -> Result<Vec<Task>> {
    let conn = store.conn()?;
    repo::list(&conn, project_id, scope)
}

/// 新建。挂项目时 `scope` 跟随项目；不挂时落在收件箱（记 `inbox_at`）。
pub fn create(store: &Store, input: &TaskInput) -> Result<Task> {
    repo::create(store, input)
}

pub fn update(store: &Store, id: &str, input: &TaskInput) -> Result<Task> {
    repo::update(store, id, input)
}

/// 换一档状态；完成时写 `completed_at`，回到未完成时清掉。
pub fn set_state(store: &Store, id: &str, state: &str) -> Result<Task> {
    repo::set_state(store, id, state)
}

pub fn delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::delete(&conn, id)
}

/// 任务的检查项（子表）。前端只有详情弹窗用它。
pub fn item_list(store: &Store, task_id: &str) -> Result<Vec<TaskItem>> {
    let conn = store.conn()?;
    item::list(&conn, task_id)
}

pub fn item_create(store: &Store, task_id: &str, title: &str) -> Result<TaskItem> {
    let conn = store.conn()?;
    item::create(&conn, task_id, title)
}

pub fn item_toggle(store: &Store, id: &str, done: bool) -> Result<TaskItem> {
    let conn = store.conn()?;
    item::toggle(&conn, id, done)
}

pub fn item_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    item::delete(&conn, id)
}
