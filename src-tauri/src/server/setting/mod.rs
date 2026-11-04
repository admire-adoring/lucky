//! 设置域门面。
mod model;
mod repo;

pub use model::{SettingItem, SettingItemInput};

use crate::server::error::Result;
use crate::server::store::Store;

pub fn list_all(store: &Store) -> Result<Vec<SettingItem>> {
    let conn = store.conn()?;
    repo::list_all(&conn)
}

pub fn list_by_category(store: &Store, category: &str) -> Result<Vec<SettingItem>> {
    let conn = store.conn()?;
    repo::list_by_category(&conn, category)
}

pub fn get_value(store: &Store, key: &str) -> Result<Option<String>> {
    let conn = store.conn()?;
    repo::get_value(&conn, key)
}

pub fn upsert(store: &Store, input: &SettingItemInput) -> Result<SettingItem> {
    let mut conn = store.conn()?;
    repo::upsert(&mut conn, input)
}

pub fn set_value(store: &Store, key: &str, value: &str) -> Result<()> {
    let mut conn = store.conn()?;
    repo::set_value(&mut conn, key, value)
}

pub fn delete(store: &Store, id: &str) -> Result<()> {
    let mut conn = store.conn()?;
    repo::delete(&mut conn, id)
}
