//! 工作模块域（当前一段：会议）。
//!
//! 文档索引已并入统一的 `doc`（宿主 `work`），所以这里只剩会议 —— 它是跨项目的，
//! 但项目详情那一格需要按项目筛，于是 0007 给它加了可空的 `project_id`。
mod contact;
mod model;
mod repo;

#[allow(unused_imports)]
pub use contact::{Contact, ContactInput};
pub use model::{Meeting, MeetingAttendee, MeetingInput};

use crate::server::error::Result;
use crate::server::store::Store;

pub fn meeting_list(store: &Store, project_id: Option<&str>) -> Result<Vec<Meeting>> {
    let conn = store.conn()?;
    repo::list(&conn, project_id)
}

pub fn meeting_create(store: &Store, input: &MeetingInput) -> Result<Meeting> {
    let mut conn = store.conn()?;
    repo::create(&mut conn, input)
}

pub fn meeting_update(store: &Store, id: &str, input: &MeetingInput) -> Result<Meeting> {
    let mut conn = store.conn()?;
    repo::update(&mut conn, id, input)
}

pub fn meeting_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::delete(&conn, id)
}

/* ---------- 联系人 ---------- */

pub fn contact_list(store: &Store, role_code: Option<&str>) -> Result<Vec<Contact>> {
    let conn = store.conn()?;
    contact::list(&conn, role_code)
}

pub fn contact_create(store: &Store, input: &ContactInput) -> Result<Contact> {
    let conn = store.conn()?;
    contact::create(&conn, input)
}

pub fn contact_update(store: &Store, id: &str, input: &ContactInput) -> Result<Contact> {
    let conn = store.conn()?;
    contact::update(&conn, id, input)
}

pub fn contact_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    contact::delete(&conn, id)
}
