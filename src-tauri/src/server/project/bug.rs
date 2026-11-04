//! 项目问题清单（`project_bug`）。与 `project_risk` 的分工写在 DDL 注释里：
//! **风险是"可能出事"，Bug 是"已经出事"** —— 后者有严重度、版本与修复状态。
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBug {
    pub id: String,
    pub project_id: String,
    pub title: String,
    /// critical / major / minor
    pub level: String,
    /// open / fixing / fixed
    pub status: String,
    pub version: String,
    pub reporter_id: Option<String>,
    /// 提出人显示名（hydrate）
    pub reporter_name: String,
    pub found_at: String,
    pub detail: String,
    pub sort_order: i64,
    pub updated_at: String,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectBugInput {
    pub title: String,
    #[serde(default = "default_level")]
    pub level: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub reporter_id: Option<String>,
    pub found_at: String,
    #[serde(default)]
    pub detail: String,
}

fn default_level() -> String {
    "minor".into()
}
fn default_status() -> String {
    "open".into()
}

const COLS: &str = "id, project_id, title, level, status, version, reporter_id, found_at, detail, \
                    sort_order, updated_at";

const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn row_to_bug(row: &Row<'_>) -> rusqlite::Result<ProjectBug> {
    Ok(ProjectBug {
        id: row.get(0)?,
        project_id: row.get(1)?,
        title: row.get(2)?,
        level: row.get(3)?,
        status: row.get(4)?,
        version: row.get(5)?,
        reporter_id: row.get(6)?,
        reporter_name: String::new(),
        found_at: row.get(7)?,
        detail: row.get(8)?,
        sort_order: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

pub fn list(conn: &Connection, project_id: &str) -> Result<Vec<ProjectBug>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM project_bug WHERE project_id = ?1 ORDER BY sort_order, found_at"
    ))?;
    let mut rows = stmt
        .query_map([project_id], row_to_bug)?
        .collect::<rusqlite::Result<Vec<ProjectBug>>>()?;
    drop(stmt);
    for bug in &mut rows {
        hydrate(conn, bug)?;
    }
    Ok(rows)
}

pub fn create(conn: &Connection, project_id: &str, input: &ProjectBugInput) -> Result<ProjectBug> {
    validate(input)?;
    let id = new_id("bug");
    conn.execute(
        &format!(
            "INSERT INTO project_bug
               (id, project_id, title, level, status, version, reporter_id, found_at, detail,
                sort_order, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM project_bug WHERE project_id = ?2),
                     {NOW})"
        ),
        params![
            id,
            project_id,
            input.title,
            input.level,
            input.status,
            input.version,
            input.reporter_id,
            input.found_at,
            input.detail,
        ],
    )?;
    get(conn, &id)
}

pub fn update(conn: &Connection, id: &str, input: &ProjectBugInput) -> Result<ProjectBug> {
    validate(input)?;
    let n = conn.execute(
        &format!(
            "UPDATE project_bug SET
               title = ?2, level = ?3, status = ?4, version = ?5, reporter_id = ?6,
               found_at = ?7, detail = ?8, updated_at = {NOW}
             WHERE id = ?1"
        ),
        params![
            id,
            input.title,
            input.level,
            input.status,
            input.version,
            input.reporter_id,
            input.found_at,
            input.detail,
        ],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("问题 {id}")));
    }
    get(conn, id)
}

/// 只改修复状态（"标记已修复"那类短动作，与全量编辑分开）。
pub fn set_status(conn: &Connection, id: &str, status: &str) -> Result<ProjectBug> {
    if !["open", "fixing", "fixed"].contains(&status) {
        return Err(Error::Invalid(format!("状态取值不对：{status}")));
    }
    let n = conn.execute(
        &format!("UPDATE project_bug SET status = ?2, updated_at = {NOW} WHERE id = ?1"),
        params![id, status],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("问题 {id}")));
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM project_bug WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("问题 {id}")));
    }
    Ok(())
}

fn get(conn: &Connection, id: &str) -> Result<ProjectBug> {
    let mut bug = conn
        .query_row(&format!("SELECT {COLS} FROM project_bug WHERE id = ?1"), [id], row_to_bug)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("问题 {id}")))?;
    hydrate(conn, &mut bug)?;
    Ok(bug)
}

fn hydrate(conn: &Connection, bug: &mut ProjectBug) -> Result<()> {
    bug.reporter_name = match &bug.reporter_id {
        Some(id) => conn
            .query_row("SELECT display_name FROM app_user WHERE id = ?1", [id], |row| row.get(0))
            .optional()?
            .unwrap_or_default(),
        None => String::new(),
    };
    Ok(())
}

fn validate(input: &ProjectBugInput) -> Result<()> {
    if input.title.trim().is_empty() {
        return Err(Error::Invalid("问题标题不能为空".into()));
    }
    if !["critical", "major", "minor"].contains(&input.level.as_str()) {
        return Err(Error::Invalid(format!("严重度取值不对：{}", input.level)));
    }
    if !["open", "fixing", "fixed"].contains(&input.status.as_str()) {
        return Err(Error::Invalid(format!("状态取值不对：{}", input.status)));
    }
    if input.found_at.trim().is_empty() {
        return Err(Error::Invalid("发现时间不能为空".into()));
    }
    Ok(())
}
