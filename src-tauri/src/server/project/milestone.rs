//! 项目里程碑（`project_milestone`）。一个项目的阶段清单，按 sort_order 排。
//!
//! `state` 三态：`done`（已完成）/ `now`（当前阶段）/ `todo`（待开始）。
//! 表上 `ux_milestone_now` 保证一个项目至多一条 `now` —— 设为 `now` 时先把已有的 `now` 降为 `todo`。
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectMilestone {
    pub id: String,
    pub project_id: String,
    pub name: String,
    /// done / now / todo
    pub state: String,
    /// ISO 日期；NULL = 没定截止
    pub due_date: Option<String>,
    pub detail: String,
    pub sort_order: i64,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MilestoneInput {
    pub name: String,
    #[serde(default = "default_state")]
    pub state: String,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub detail: String,
}

fn default_state() -> String {
    "todo".into()
}

const COLS: &str = "id, project_id, name, state, due_date, detail, sort_order";

fn row_to_milestone(row: &Row<'_>) -> rusqlite::Result<ProjectMilestone> {
    Ok(ProjectMilestone {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        state: row.get(3)?,
        due_date: row.get(4)?,
        detail: row.get(5)?,
        sort_order: row.get(6)?,
    })
}

pub fn list(conn: &Connection, project_id: &str) -> Result<Vec<ProjectMilestone>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM project_milestone WHERE project_id = ?1 ORDER BY sort_order, due_date"
    ))?;
    let rows = stmt
        .query_map([project_id], row_to_milestone)?
        .collect::<rusqlite::Result<Vec<ProjectMilestone>>>()?;
    Ok(rows)
}

pub fn create(conn: &mut Connection, project_id: &str, input: &MilestoneInput) -> Result<ProjectMilestone> {
    validate(input)?;
    let id = new_id("ms");
    let tx = conn.transaction()?;
    // 设为 now 时先把同项目已有的 now 降为 todo（ux_milestone_now 唯一索引）
    if input.state == "now" {
        tx.execute(
            "UPDATE project_milestone SET state = 'todo' WHERE project_id = ?1 AND state = 'now'",
            [project_id],
        )?;
    }
    tx.execute(
        &format!(
            "INSERT INTO project_milestone
               (id, project_id, name, state, due_date, detail, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM project_milestone WHERE project_id = ?2))"
        ),
        params![id, project_id, input.name, input.state, input.due_date, input.detail],
    )?;
    tx.commit()?;
    get(conn, &id)
}

pub fn update(conn: &mut Connection, id: &str, input: &MilestoneInput) -> Result<ProjectMilestone> {
    validate(input)?;
    let tx = conn.transaction()?;
    // 改成 now 时先把同项目的 now 降级（排除自己）
    if input.state == "now" {
        tx.execute(
            "UPDATE project_milestone SET state = 'todo'
             WHERE project_id = (SELECT project_id FROM project_milestone WHERE id = ?1)
               AND state = 'now' AND id <> ?1",
            [id],
        )?;
    }
    let n = tx.execute(
        "UPDATE project_milestone SET name = ?2, state = ?3, due_date = ?4, detail = ?5 WHERE id = ?1",
        params![id, input.name, input.state, input.due_date, input.detail],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("里程碑 {id}")));
    }
    tx.commit()?;
    get(conn, id)
}

/// 只改状态（"标记为当前阶段"那类短动作）。设为 now 时先把同项目的 now 降为 todo。
pub fn set_state(conn: &mut Connection, id: &str, state: &str) -> Result<ProjectMilestone> {
    if !["done", "now", "todo"].contains(&state) {
        return Err(Error::Invalid(format!("里程碑状态取值不对：{state}")));
    }
    let tx = conn.transaction()?;
    if state == "now" {
        tx.execute(
            "UPDATE project_milestone SET state = 'todo'
             WHERE project_id = (SELECT project_id FROM project_milestone WHERE id = ?1)
               AND state = 'now' AND id <> ?1",
            [id],
        )?;
    }
    let n = tx.execute(
        "UPDATE project_milestone SET state = ?2 WHERE id = ?1",
        params![id, state],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("里程碑 {id}")));
    }
    tx.commit()?;
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM project_milestone WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("里程碑 {id}")));
    }
    Ok(())
}

fn get(conn: &Connection, id: &str) -> Result<ProjectMilestone> {
    conn.query_row(
        &format!("SELECT {COLS} FROM project_milestone WHERE id = ?1"),
        [id],
        row_to_milestone,
    )
    .optional()?
    .ok_or_else(|| Error::NotFound(format!("里程碑 {id}")))
}

fn validate(input: &MilestoneInput) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(Error::Invalid("里程碑名称不能为空".into()));
    }
    if !["done", "now", "todo"].contains(&input.state.as_str()) {
        return Err(Error::Invalid(format!("里程碑状态取值不对：{}", input.state)));
    }
    Ok(())
}
