//! 会议的 SQL。参会人整组替换（先删后插），与项目的 tags/owners 同一条。
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;
use crate::server::work::model::{Meeting, MeetingAttendee, MeetingInput};

const COLS: &str = "id, project_id, title, starts_at, ends_at, location, status, minutes_doc, \
                    owner_id";

const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn row_to_meeting(row: &Row<'_>) -> rusqlite::Result<Meeting> {
    Ok(Meeting {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        starts_at: row.get(3)?,
        ends_at: row.get(4)?,
        location: row.get(5)?,
        status: row.get(6)?,
        minutes_doc: row.get(7)?,
        owner_id: row.get(8)?,
        owner_name: String::new(),
        attendees: Vec::new(),
    })
}

/// 会议列表。`project_id` 给了就只取那个项目的；不给是全部（跨项目的会也在里面）。
pub fn list(conn: &Connection, project_id: Option<&str>) -> Result<Vec<Meeting>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM work_meeting
         WHERE (?1 IS NULL OR project_id = ?1)
         ORDER BY starts_at DESC"
    ))?;
    let mut rows = stmt
        .query_map([project_id], row_to_meeting)?
        .collect::<rusqlite::Result<Vec<Meeting>>>()?;
    drop(stmt);
    for meeting in &mut rows {
        hydrate(conn, meeting)?;
    }
    Ok(rows)
}

pub fn create(conn: &mut Connection, input: &MeetingInput) -> Result<Meeting> {
    validate(input)?;
    let id = new_id("mt");
    let tx = conn.transaction()?;
    tx.execute(
        &format!(
            "INSERT INTO work_meeting
               (id, owner_id, project_id, title, starts_at, ends_at, location, minutes_doc, status,
                created_at, updated_at)
             VALUES (?1, 'me', ?2, ?3, ?4, ?5, ?6, ?7, ?8, {NOW}, {NOW})"
        ),
        params![
            id,
            input.project_id,
            input.title,
            input.starts_at,
            input.ends_at,
            input.location,
            input.minutes_doc,
            input.status,
        ],
    )?;
    write_attendees(&tx, &id, &input.attendee_ids)?;
    tx.commit()?;
    get(conn, &id)
}

pub fn update(conn: &mut Connection, id: &str, input: &MeetingInput) -> Result<Meeting> {
    validate(input)?;
    let tx = conn.transaction()?;
    let n = tx.execute(
        &format!(
            "UPDATE work_meeting SET
               project_id = ?2, title = ?3, starts_at = ?4, ends_at = ?5, location = ?6,
               minutes_doc = ?7, status = ?8, updated_at = {NOW}
             WHERE id = ?1"
        ),
        params![
            id,
            input.project_id,
            input.title,
            input.starts_at,
            input.ends_at,
            input.location,
            input.minutes_doc,
            input.status,
        ],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("会议 {id}")));
    }
    write_attendees(&tx, id, &input.attendee_ids)?;
    tx.commit()?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM work_meeting WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("会议 {id}")));
    }
    Ok(())
}

fn get(conn: &Connection, id: &str) -> Result<Meeting> {
    let mut meeting = conn
        .query_row(&format!("SELECT {COLS} FROM work_meeting WHERE id = ?1"), [id], row_to_meeting)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("会议 {id}")))?;
    hydrate(conn, &mut meeting)?;
    Ok(meeting)
}

fn hydrate(conn: &Connection, meeting: &mut Meeting) -> Result<()> {
    meeting.owner_name = conn
        .query_row("SELECT display_name FROM app_user WHERE id = ?1", [&meeting.owner_id], |row| row.get(0))
        .optional()?
        .unwrap_or_default();
    let mut stmt = conn.prepare(
        "SELECT a.user_id, u.display_name FROM work_meeting_attendee a
         JOIN app_user u ON u.id = a.user_id
         WHERE a.meeting_id = ?1
         ORDER BY u.code",
    )?;
    meeting.attendees = stmt
        .query_map([&meeting.id], |row| {
            Ok(MeetingAttendee { user_id: row.get(0)?, name: row.get(1)? })
        })?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    Ok(())
}

fn write_attendees(tx: &Transaction<'_>, meeting_id: &str, ids: &[String]) -> Result<()> {
    tx.execute("DELETE FROM work_meeting_attendee WHERE meeting_id = ?1", [meeting_id])?;
    for user_id in ids {
        tx.execute(
            "INSERT OR IGNORE INTO work_meeting_attendee (meeting_id, user_id) VALUES (?1, ?2)",
            params![meeting_id, user_id],
        )?;
    }
    Ok(())
}

fn validate(input: &MeetingInput) -> Result<()> {
    if input.title.trim().is_empty() {
        return Err(Error::Invalid("会议标题不能为空".into()));
    }
    if input.starts_at.trim().is_empty() {
        return Err(Error::Invalid("开始时间不能为空".into()));
    }
    if !["planned", "done", "canceled"].contains(&input.status.as_str()) {
        return Err(Error::Invalid(format!("状态取值不对：{}", input.status)));
    }
    Ok(())
}
