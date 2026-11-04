//! 日历域门面。
mod model;
mod repo;

pub use model::{CalendarEvent, CalendarEventInput};

use crate::server::error::Result;
use crate::server::store::Store;

pub fn list_range(store: &Store, start: &str, end: &str) -> Result<Vec<CalendarEvent>> {
    let conn = store.conn()?;
    repo::list_range(&conn, start, end)
}

pub fn list_all(store: &Store, limit: i64) -> Result<Vec<CalendarEvent>> {
    let conn = store.conn()?;
    repo::list_all(&conn, limit)
}

pub fn create(store: &Store, input: &CalendarEventInput) -> Result<CalendarEvent> {
    let mut conn = store.conn()?;
    repo::create(&mut conn, input)
}

pub fn update(store: &Store, id: &str, input: &CalendarEventInput) -> Result<CalendarEvent> {
    let mut conn = store.conn()?;
    repo::update(&mut conn, id, input)
}

pub fn delete(store: &Store, id: &str) -> Result<()> {
    let mut conn = store.conn()?;
    repo::delete(&mut conn, id)
}
