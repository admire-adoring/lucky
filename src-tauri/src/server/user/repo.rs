//! 成员名单的 SQL。没有"登录 / 密码"那一半 —— 单机应用只有"谁是谁"。
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;
use crate::server::user::model::{User, UserInput, UserRefs};

const COLS: &str = "id, code, display_name, created_at";

fn row_to_user(row: &Row<'_>) -> rusqlite::Result<User> {
    Ok(User {
        id: row.get(0)?,
        code: row.get(1)?,
        display_name: row.get(2)?,
        created_at: row.get(3)?,
        is_me: false,
        refs: UserRefs { projects: 0, tasks: 0, docs: 0, activities: 0 },
    })
}

/// 全部成员，按 `code` 排（头像字母的顺序稳定）。`is_me` = id 为 `me` 的那一行。
pub fn list(conn: &Connection) -> Result<Vec<User>> {
    let mut stmt = conn.prepare(&format!("SELECT {COLS} FROM app_user ORDER BY code"))?;
    let mut rows = stmt
        .query_map([], row_to_user)?
        .collect::<rusqlite::Result<Vec<User>>>()?;
    drop(stmt);
    for user in &mut rows {
        user.is_me = user.id == "me";
        user.refs = count_refs(conn, &user.id, &user.code)?;
    }
    Ok(rows)
}

/// 新建或改名。`id` 不给 = 新建（`code` 必填、两位大写字母）；给了 = 只改 `display_name`。
pub fn save(conn: &Connection, input: &UserInput) -> Result<User> {
    let name = input.display_name.trim();
    if name.is_empty() {
        return Err(Error::Invalid("名字不能为空".into()));
    }

    let id = match &input.id {
        Some(id) => {
            let n = conn.execute("UPDATE app_user SET display_name = ?2 WHERE id = ?1", params![id, name])?;
            if n == 0 {
                return Err(Error::NotFound(format!("成员 {id}")));
            }
            id.clone()
        }
        None => {
            let code = input
                .code
                .as_deref()
                .unwrap_or("")
                .trim()
                .to_uppercase();
            if code.len() < 2 || code.len() > 3 || !code.chars().all(|c| c.is_ascii_uppercase()) {
                return Err(Error::Invalid("缩写要 2–3 个大写字母（头像上那两个）".into()));
            }
            let exists: bool = conn
                .query_row("SELECT COUNT(*) > 0 FROM app_user WHERE code = ?1", [&code], |row| row.get(0))?;
            if exists {
                return Err(Error::Invalid(format!("缩写 {code} 已经有人用了")));
            }
            let id = new_id("u");
            conn.execute(
                "INSERT INTO app_user (id, code, display_name, created_at)
                 VALUES (?1, ?2, ?3, strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
                params![id, code, name],
            )?;
            id
        }
    };
    get(conn, &id)
}

/// 删除。被引用时挡住，并把"被谁用着"说清楚 —— 静默失败会让人以为点了没反应。
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    let user = get(conn, id)?;
    if user.is_me {
        return Err(Error::Invalid("不能删掉自己".into()));
    }
    let refs = user.refs;
    if refs.projects + refs.tasks + refs.docs + refs.activities > 0 {
        return Err(Error::Invalid(format!(
            "「{}」还被引用着（项目 {} / 任务 {} / 文档 {} / 动态 {}），先把它们改给别人",
            user.display_name, refs.projects, refs.tasks, refs.docs, refs.activities
        )));
    }
    conn.execute("DELETE FROM app_user WHERE id = ?1", [id])?;
    Ok(())
}

fn get(conn: &Connection, id: &str) -> Result<User> {
    let mut user = conn
        .query_row(&format!("SELECT {COLS} FROM app_user WHERE id = ?1"), [id], row_to_user)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("成员 {id}")))?;
    user.is_me = user.id == "me";
    user.refs = count_refs(conn, &user.id, &user.code)?;
    Ok(user)
}

/// 引用计数。四处口径：项目（负责人 + 成员）、任务（按 code）、文档（作者）、动态（操作人）。
fn count_refs(conn: &Connection, id: &str, code: &str) -> Result<UserRefs> {
    let projects: i64 = conn.query_row(
        "SELECT (SELECT COUNT(*) FROM project WHERE owner_id = ?1)
              + (SELECT COUNT(*) FROM project_member WHERE user_id = ?1)",
        [id],
        |row| row.get(0),
    )?;
    let tasks: i64 =
        conn.query_row("SELECT COUNT(*) FROM task WHERE owner_code = ?1", [code], |row| row.get(0))?;
    let docs: i64 =
        conn.query_row("SELECT COUNT(*) FROM doc WHERE author_id = ?1", [id], |row| row.get(0))?;
    let activities: i64 = conn.query_row(
        "SELECT COUNT(*) FROM project_activity WHERE actor_id = ?1",
        [id],
        |row| row.get(0),
    )?;
    Ok(UserRefs { projects, tasks, docs, activities })
}
