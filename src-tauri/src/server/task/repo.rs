//! 任务的 SQL。它属于全局层「任务清单」域（`/tasks`），不是项目族的从属表 ——
//! `project_id` 可空就是"还没归项目的收件箱任务"。
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;
use crate::server::project;
use crate::server::store::Store;
use crate::server::task::model::{Task, TaskInput};

const STATES: &[&str] = &["todo", "doing", "blocked", "done"];
const PRIORITIES: &[&str] = &["high", "mid", "low"];
const SOURCE_KINDS: &[&str] = &["todo", "idea", "ref"];

const COLS: &str = "id, scope, project_id, owner_code, title, state, priority, due_at, \
                    scheduled_start, estimate_min, completed_at, source_kind, inbox_at, \
                    sort_order, created_at, updated_at";

const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn row_to_task(row: &Row<'_>) -> rusqlite::Result<Task> {
    Ok(Task {
        id: row.get(0)?,
        scope: row.get(1)?,
        project_id: row.get(2)?,
        owner_code: row.get(3)?,
        title: row.get(4)?,
        state: row.get(5)?,
        priority: row.get(6)?,
        due_at: row.get(7)?,
        scheduled_start: row.get(8)?,
        estimate_min: row.get(9)?,
        completed_at: row.get(10)?,
        source_kind: row.get(11)?,
        inbox_at: row.get(12)?,
        sort_order: row.get(13)?,
        created_at: row.get(14)?,
        updated_at: row.get(15)?,
    })
}

/// 任务列表。两个过滤都可选：`project_id` 给"某项目的任务"，`scope` 给"某域的任务清单"，
/// 都不给就是全部（收件箱跨域看的时候用）。
pub fn list(conn: &Connection, project_id: Option<&str>, scope: Option<&str>) -> Result<Vec<Task>> {
    let sql = format!(
        "SELECT {COLS} FROM task
         WHERE (?1 IS NULL OR project_id = ?1) AND (?2 IS NULL OR scope = ?2)
         ORDER BY sort_order, due_at, created_at"
    );
    let mut stmt = conn.prepare(&sql)?;
    let rows = stmt
        .query_map(params![project_id, scope], row_to_task)?
        .collect::<rusqlite::Result<Vec<Task>>>()?;
    Ok(rows)
}

pub fn get(conn: &Connection, id: &str) -> Result<Task> {
    conn.query_row(&format!("SELECT {COLS} FROM task WHERE id = ?1"), [id], row_to_task)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("任务 {id}")))
}

/// 新建。挂项目时 `scope` 取项目的（一致性由写入路径保证），不挂时按传入值，
/// 并记 `inbox_at` —— "在收件箱停留超过 N 天"要有个起点。
pub fn create(store: &Store, input: &TaskInput) -> Result<Task> {
    validate(input)?;
    let scope = resolve_scope(store, input)?;
    let conn = store.conn()?;
    let id = new_id("tk");
    conn.execute(
        &format!(
            "INSERT INTO task
               (id, scope, project_id, owner_code, title, state, priority, due_at,
                scheduled_start, estimate_min, completed_at, source_kind, inbox_at,
                sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                     CASE WHEN ?6 = 'done' THEN {NOW} ELSE NULL END,
                     ?11,
                     CASE WHEN ?3 IS NULL THEN {NOW} ELSE NULL END,
                     COALESCE(?12, 0), {NOW}, {NOW})"
        ),
        params![
            id,
            scope,
            input.project_id,
            input.owner_code,
            input.title,
            input.state,
            input.priority,
            input.due_at,
            input.scheduled_start,
            input.estimate_min,
            input.source_kind,
            input.sort_order,
        ],
    )?;
    get(&conn, &id)
}

/// 编辑。`project_id` 改了要重算 `scope`（挂上项目就跟随项目，摘下来用传入的 scope）。
pub fn update(store: &Store, id: &str, input: &TaskInput) -> Result<Task> {
    validate(input)?;
    let scope = resolve_scope(store, input)?;
    let conn = store.conn()?;
    let n = conn.execute(
        &format!(
            "UPDATE task SET
               scope = ?2, project_id = ?3, owner_code = ?4, title = ?5, state = ?6,
               priority = ?7, due_at = ?8, scheduled_start = ?9, estimate_min = ?10,
               source_kind = ?11, sort_order = COALESCE(?12, sort_order), updated_at = {NOW}
             WHERE id = ?1"
        ),
        params![
            id,
            scope,
            input.project_id,
            input.owner_code,
            input.title,
            input.state,
            input.priority,
            input.due_at,
            input.scheduled_start,
            input.estimate_min,
            input.source_kind,
            input.sort_order,
        ],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("任务 {id}")));
    }
    get(&conn, id)
}

/// 换一档状态。完成时写 `completed_at`（前端的 `doneDays` 由它算），回到未完成时清掉 ——
/// "完成过又打开"的任务不该留着上一次的完成时刻。
pub fn set_state(store: &Store, id: &str, state: &str) -> Result<Task> {
    check_enum("状态", state, STATES)?;
    let conn = store.conn()?;
    let n = conn.execute(
        &format!(
            "UPDATE task SET state = ?2,
               completed_at = CASE WHEN ?2 = 'done' THEN {NOW} ELSE NULL END,
               updated_at = {NOW}
             WHERE id = ?1"
        ),
        params![id, state],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("任务 {id}")));
    }
    get(&conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM task WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("任务 {id}")));
    }
    Ok(())
}

/* ============================================================
   内部
   ============================================================ */

/// 定 `scope`。挂项目时读项目那一行取 scope —— 跨域读走对方门面，不 JOIN 它的表。
fn resolve_scope(store: &Store, input: &TaskInput) -> Result<String> {
    match &input.project_id {
        Some(project_id) => Ok(project::get(store, project_id)?.scope),
        None => {
            let scope = input
                .scope
                .clone()
                .ok_or_else(|| Error::Invalid("不挂项目时要给域（scope）".into()))?;
            check_enum("域", &scope, &["life", "work", "learn"])?;
            Ok(scope)
        }
    }
}

fn check_enum(what: &str, value: &str, allowed: &[&str]) -> Result<()> {
    if allowed.contains(&value) {
        return Ok(());
    }
    Err(Error::Invalid(format!("{what}的取值不对：{value}")))
}

/// 与 DDL 的 CHECK 同一批规则：这里先拦，报错说得上人话。
fn validate(input: &TaskInput) -> Result<()> {
    if input.title.trim().is_empty() {
        return Err(Error::Invalid("任务标题不能为空".into()));
    }
    check_enum("状态", &input.state, STATES)?;
    check_enum("优先级", &input.priority, PRIORITIES)?;
    if let Some(kind) = &input.source_kind {
        check_enum("来源", kind, SOURCE_KINDS)?;
    }
    if input.scheduled_start.is_some() && input.estimate_min.is_none() {
        return Err(Error::Invalid("有排期就要给预估时长（时间轴要按它算块高）".into()));
    }
    if let Some(min) = input.estimate_min {
        if min <= 0 {
            return Err(Error::Invalid("预估时长要大于 0".into()));
        }
    }
    Ok(())
}
