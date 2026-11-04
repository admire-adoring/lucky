//! 联系人（`work_contact`）。客户 / 同事 / 合作方三类 —— `role_code` 是它唯一的轴。
//!
//! `last_touch_at` 只存时刻，"3 天前"是展示层算的（与文档的"多久没更新"同一条口径）。
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Contact {
    pub id: String,
    pub owner_id: String,
    pub name: String,
    pub org: String,
    /// customer / colleague / partner
    pub role_code: String,
    pub title: String,
    pub phone: Option<String>,
    pub email: Option<String>,
    pub wechat: Option<String>,
    pub note: String,
    pub last_touch_at: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContactInput {
    pub name: String,
    #[serde(default)]
    pub org: String,
    #[serde(default = "default_role")]
    pub role_code: String,
    #[serde(default)]
    pub title: String,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub email: Option<String>,
    #[serde(default)]
    pub wechat: Option<String>,
    #[serde(default)]
    pub note: String,
}

fn default_role() -> String {
    "colleague".into()
}

const COLS: &str = "id, owner_id, name, org, role_code, title, phone, email, wechat, note, \
                    last_touch_at, sort_order, created_at, updated_at";

const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn row_to_contact(row: &Row<'_>) -> rusqlite::Result<Contact> {
    Ok(Contact {
        id: row.get(0)?,
        owner_id: row.get(1)?,
        name: row.get(2)?,
        org: row.get(3)?,
        role_code: row.get(4)?,
        title: row.get(5)?,
        phone: row.get(6)?,
        email: row.get(7)?,
        wechat: row.get(8)?,
        note: row.get(9)?,
        last_touch_at: row.get(10)?,
        sort_order: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

pub fn list(conn: &Connection, role_code: Option<&str>) -> Result<Vec<Contact>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM work_contact
         WHERE (?1 IS NULL OR role_code = ?1)
         ORDER BY sort_order, org, name"
    ))?;
    let rows = stmt
        .query_map([role_code], row_to_contact)?
        .collect::<rusqlite::Result<Vec<Contact>>>()?;
    Ok(rows)
}

pub fn create(conn: &Connection, input: &ContactInput) -> Result<Contact> {
    validate(input)?;
    let id = new_id("ct");
    conn.execute(
        &format!(
            "INSERT INTO work_contact
               (id, owner_id, name, org, role_code, title, phone, email, wechat, note,
                sort_order, created_at, updated_at)
             VALUES (?1, 'me', ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM work_contact),
                     {NOW}, {NOW})"
        ),
        params![
            id,
            input.name,
            input.org,
            input.role_code,
            input.title,
            input.phone,
            input.email,
            input.wechat,
            input.note,
        ],
    )?;
    get(conn, &id)
}

pub fn update(conn: &Connection, id: &str, input: &ContactInput) -> Result<Contact> {
    validate(input)?;
    let n = conn.execute(
        &format!(
            "UPDATE work_contact SET
               name = ?2, org = ?3, role_code = ?4, title = ?5, phone = ?6, email = ?7,
               wechat = ?8, note = ?9, updated_at = {NOW}
             WHERE id = ?1"
        ),
        params![
            id,
            input.name,
            input.org,
            input.role_code,
            input.title,
            input.phone,
            input.email,
            input.wechat,
            input.note,
        ],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("联系人 {id}")));
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM work_contact WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("联系人 {id}")));
    }
    Ok(())
}

fn get(conn: &Connection, id: &str) -> Result<Contact> {
    conn.query_row(&format!("SELECT {COLS} FROM work_contact WHERE id = ?1"), [id], row_to_contact)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("联系人 {id}")))
}

fn validate(input: &ContactInput) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(Error::Invalid("姓名不能为空".into()));
    }
    if !["customer", "colleague", "partner"].contains(&input.role_code.as_str()) {
        return Err(Error::Invalid(format!("角色取值不对：{}", input.role_code)));
    }
    Ok(())
}
