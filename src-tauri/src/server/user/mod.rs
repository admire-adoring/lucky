//! 用户域（成员名单）。门面：取锁 + 调 repo。
//!
//! 单机应用没有登录与密码 —— 账户页回答的是"我是谁"和"还有谁在干活"，
//! 这两件事的真实载体是 `app_user`（项目负责人 / 任务指派 / 文档作者都引用它）。
mod model;
mod repo;

#[allow(unused_imports)]
pub use model::{User, UserInput, UserRefs};

use crate::server::error::Result;
use crate::server::store::Store;

/// 全部成员（`me` 那行带 `is_me`）。
pub fn list(store: &Store) -> Result<Vec<User>> {
    let conn = store.conn()?;
    repo::list(&conn)
}

/// 新建 / 改名。
pub fn save(store: &Store, input: &UserInput) -> Result<User> {
    let conn = store.conn()?;
    repo::save(&conn, input)
}

/// 删除（被引用时拒绝）。
pub fn delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::delete(&conn, id)
}
