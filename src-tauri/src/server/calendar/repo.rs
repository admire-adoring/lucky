//! 日历事件数据库操作。
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;

use super::model::{CalendarEvent, CalendarEventInput};

const COLS: &str = "id, title, detail, start_at, end_at, all_day, location, color, scope, \
                    project_id, owner_id, sort_order, created_at, updated_at";
const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn row_to_event(row: &Row<'_>) -> rusqlite::Result<CalendarEvent> {
    Ok(CalendarEvent {
        id: row.get(0)?,
        title: row.get(1)?,
        detail: row.get(2)?,
        start_at: row.get(3)?,
        end_at: row.get(4)?,
        all_day: row.get(5)?,
        location: row.get(6)?,
        color: row.get(7)?,
        scope: row.get(8)?,
        project_id: row.get(9)?,
        owner_id: row.get(10)?,
        sort_order: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

/// 按日期范围查（月/周/日视图都是范围查）。
pub fn list_range(conn: &Connection, start: &str, end: &str) -> Result<Vec<CalendarEvent>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM calendar_event
         WHERE start_at >= ?1 AND start_at < ?2
         ORDER BY start_at, sort_order"
    ))?;
    let rows = stmt
        .query_map([start, end], row_to_event)?
        .collect::<rusqlite::Result<Vec<CalendarEvent>>>()?;
    Ok(rows)
}

/// 全部事件（议程视图）。
pub fn list_all(conn: &Connection, limit: i64) -> Result<Vec<CalendarEvent>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM calendar_event ORDER BY start_at DESC, sort_order LIMIT ?1"
    ))?;
    let rows = stmt
        .query_map([limit], row_to_event)?
        .collect::<rusqlite::Result<Vec<CalendarEvent>>>()?;
    Ok(rows)
}

pub fn create(conn: &mut Connection, input: &CalendarEventInput) -> Result<CalendarEvent> {
    validate(input)?;
    let id = new_id("evt");
    conn.execute(
        &format!(
            "INSERT INTO calendar_event
               (id, title, detail, start_at, end_at, all_day, location, color, scope,
                project_id, owner_id, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM calendar_event),
                     {NOW}, {NOW})"
        ),
        params![
            id,
            input.title,
            input.detail,
            input.start_at,
            input.end_at,
            input.all_day as i64,
            input.location,
            input.color,
            input.scope,
            input.project_id,
            input.owner_id,
        ],
    )?;
    get(conn, &id)
}

pub fn update(conn: &mut Connection, id: &str, input: &CalendarEventInput) -> Result<CalendarEvent> {
    validate(input)?;
    let n = conn.execute(
        &format!(
            "UPDATE calendar_event SET
               title = ?2, detail = ?3, start_at = ?4, end_at = ?5, all_day = ?6,
               location = ?7, color = ?8, scope = ?9, project_id = ?10, owner_id = ?11,
               updated_at = {NOW}
             WHERE id = ?1"
        ),
        params![
            id,
            input.title,
            input.detail,
            input.start_at,
            input.end_at,
            input.all_day as i64,
            input.location,
            input.color,
            input.scope,
            input.project_id,
            input.owner_id,
        ],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("事件 {id}")));
    }
    get(conn, id)
}

pub fn delete(conn: &mut Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM calendar_event WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("事件 {id}")));
    }
    Ok(())
}

fn get(conn: &Connection, id: &str) -> Result<CalendarEvent> {
    conn.query_row(&format!("SELECT {COLS} FROM calendar_event WHERE id = ?1"), [id], row_to_event)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("事件 {id}")))
}

fn validate(input: &CalendarEventInput) -> Result<()> {
    if input.title.trim().is_empty() {
        return Err(Error::Invalid("事件标题不能为空".into()));
    }
    if input.start_at.trim().is_empty() {
        return Err(Error::Invalid("开始时间不能为空".into()));
    }
    if input.end_at.trim().is_empty() {
        return Err(Error::Invalid("结束时间不能为空".into()));
    }
    Ok(())
}
