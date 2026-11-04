//! 设置项数据库操作。
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;

use super::model::{SettingItem, SettingItemInput};

const COLS: &str = "id, category, item_key, label, value, description, sort_order, updated_at";
const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn row_to_item(row: &Row<'_>) -> rusqlite::Result<SettingItem> {
    Ok(SettingItem {
        id: row.get(0)?,
        category: row.get(1)?,
        item_key: row.get(2)?,
        label: row.get(3)?,
        value: row.get(4)?,
        description: row.get(5)?,
        sort_order: row.get(6)?,
        updated_at: row.get(7)?,
    })
}

pub fn list_all(conn: &Connection) -> Result<Vec<SettingItem>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM setting_item ORDER BY category, sort_order"
    ))?;
    let rows = stmt
        .query_map([], row_to_item)?
        .collect::<rusqlite::Result<Vec<SettingItem>>>()?;
    Ok(rows)
}

pub fn list_by_category(conn: &Connection, category: &str) -> Result<Vec<SettingItem>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM setting_item WHERE category = ?1 ORDER BY sort_order"
    ))?;
    let rows = stmt
        .query_map([category], row_to_item)?
        .collect::<rusqlite::Result<Vec<SettingItem>>>()?;
    Ok(rows)
}

/// 按 key 查单个值（前端读配置用）。
pub fn get_value(conn: &Connection, key: &str) -> Result<Option<String>> {
    conn.query_row(
        "SELECT value FROM setting_item WHERE item_key = ?1",
        [key],
        |row| row.get(0),
    )
    .optional()
    .map_err(Into::into)
}

/// upsert：有就更新 value，没有就插入。
pub fn upsert(conn: &mut Connection, input: &SettingItemInput) -> Result<SettingItem> {
    validate(input)?;
    let existing = conn
        .query_row(
            "SELECT id FROM setting_item WHERE item_key = ?1",
            [&input.item_key],
            |row| row.get::<_, String>(0),
        )
        .optional()?;

    if let Some(id) = existing {
        conn.execute(
            &format!(
                "UPDATE setting_item SET label = ?2, value = ?3, description = ?4, updated_at = {NOW}
                 WHERE id = ?1"
            ),
            params![id, input.label, input.value, input.description],
        )?;
        return get(conn, &id);
    }

    let id = new_id("set");
    conn.execute(
        &format!(
            "INSERT INTO setting_item (id, category, item_key, label, value, description, sort_order, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM setting_item WHERE category = ?2),
                     {NOW})"
        ),
        params![id, input.category, input.item_key, input.label, input.value, input.description],
    )?;
    get(conn, &id)
}

/// 只改 value（前端开关切换用）。
pub fn set_value(conn: &mut Connection, key: &str, value: &str) -> Result<()> {
    let n = conn.execute(
        &format!("UPDATE setting_item SET value = ?2, updated_at = {NOW} WHERE item_key = ?1"),
        params![key, value],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("设置项 {key}")));
    }
    Ok(())
}

pub fn delete(conn: &mut Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM setting_item WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("设置项 {id}")));
    }
    Ok(())
}

fn get(conn: &Connection, id: &str) -> Result<SettingItem> {
    conn.query_row(&format!("SELECT {COLS} FROM setting_item WHERE id = ?1"), [id], row_to_item)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("设置项 {id}")))
}

fn validate(input: &SettingItemInput) -> Result<()> {
    if input.item_key.trim().is_empty() {
        return Err(Error::Invalid("设置项 key 不能为空".into()));
    }
    if input.label.trim().is_empty() {
        return Err(Error::Invalid("设置项 label 不能为空".into()));
    }
    Ok(())
}
