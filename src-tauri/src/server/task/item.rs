//! 任务检查项（`task_item`）—— 一个任务的多条子记录。
//!
//! 它只服务"任务详情里那几个可勾的步骤"，不参与列表 / 看板 / 日历的派生
//! （那些读主表的 `state` 与 `due_at`）。所以它是**按需读**：任务列表不带它，
//! 只有详情打开了才查（`task_item_list`）。
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskItem {
    pub id: String,
    pub task_id: String,
    pub title: String,
    pub done: bool,
    pub sort_order: i64,
}

const COLS: &str = "id, task_id, title, done, sort_order";
const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn row_to_item(row: &Row<'_>) -> rusqlite::Result<TaskItem> {
    Ok(TaskItem {
        id: row.get(0)?,
        task_id: row.get(1)?,
        title: row.get(2)?,
        done: row.get::<_, i64>(3)? != 0,
        sort_order: row.get(4)?,
    })
}

pub fn list(conn: &Connection, task_id: &str) -> Result<Vec<TaskItem>> {
    let mut stmt =
        conn.prepare(&format!("SELECT {COLS} FROM task_item WHERE task_id = ?1 ORDER BY sort_order"))?;
    let rows = stmt
        .query_map([task_id], row_to_item)?
        .collect::<rusqlite::Result<Vec<TaskItem>>>()?;
    Ok(rows)
}

/// 新建。顺序取该任务现有最大值 + 1 —— 新勾的一项排在末尾。
pub fn create(conn: &Connection, task_id: &str, title: &str) -> Result<TaskItem> {
    let name = title.trim();
    if name.is_empty() {
        return Err(Error::Invalid("检查项不能为空".into()));
    }
    /* 任务不存在时直接报错，而不是插一条指向空气的子记录（外键会挡，但文案说不清） */
    let exists: bool =
        conn.query_row("SELECT COUNT(*) > 0 FROM task WHERE id = ?1", [task_id], |row| row.get(0))?;
    if !exists {
        return Err(Error::NotFound(format!("任务 {task_id}")));
    }

    let id = new_id("ti");
    conn.execute(
        &format!(
            "INSERT INTO task_item (id, task_id, title, done, sort_order, created_at)
             VALUES (?1, ?2, ?3, 0,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM task_item WHERE task_id = ?2),
                     {NOW})"
        ),
        params![id, task_id, name],
    )?;
    get(conn, &id)
}

pub fn toggle(conn: &Connection, id: &str, done: bool) -> Result<TaskItem> {
    let n = conn.execute("UPDATE task_item SET done = ?2 WHERE id = ?1", params![id, if done { 1 } else { 0 }])?;
    if n == 0 {
        return Err(Error::NotFound(format!("检查项 {id}")));
    }
    get(conn, id)
}

pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM task_item WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("检查项 {id}")));
    }
    Ok(())
}

fn get(conn: &Connection, id: &str) -> Result<TaskItem> {
    conn.query_row(&format!("SELECT {COLS} FROM task_item WHERE id = ?1"), [id], row_to_item)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("检查项 {id}")))
}
