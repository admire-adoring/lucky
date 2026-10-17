//! 项目族的 SQL。读走视图 `v_project_list`（拿任务计数），写走一次事务：
//! 主表 + 成员 / 标签整组替换（同 `srv` 的 `write_children` 口径）。
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;
use crate::server::project::model::{Project, ProjectInput, ProjectRisk};

const STATUSES: &[&str] = &["planning", "active", "risk", "done", "archived"];
const PRIORITIES: &[&str] = &["high", "mid", "low"];

const COLS: &str = "p.id, p.owner_id, p.scope, p.name, p.description, p.status, p.priority, \
                    p.progress, p.current_milestone, p.start_date, p.due_date, p.budget_cents, \
                    p.visibility, p.repo_url, p.docs_ref, p.path, p.sort_order, \
                    p.created_at, p.updated_at";

const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn row_to_project(row: &Row<'_>) -> rusqlite::Result<Project> {
    Ok(Project {
        id: row.get(0)?,
        owner_id: row.get(1)?,
        scope: row.get(2)?,
        name: row.get(3)?,
        description: row.get(4)?,
        status: row.get(5)?,
        priority: row.get(6)?,
        progress: row.get(7)?,
        current_milestone: row.get(8)?,
        start_date: row.get(9)?,
        due_date: row.get(10)?,
        budget_cents: row.get(11)?,
        visibility: row.get(12)?,
        repo_url: row.get(13)?,
        docs_ref: row.get(14)?,
        path: row.get(15)?,
        sort_order: row.get(16)?,
        created_at: row.get(17)?,
        updated_at: row.get(18)?,
        tasks_total: row.get(19)?,
        tasks_done: row.get(20)?,
        owners: Vec::new(),
        tags: Vec::new(),
        risk: None,
    })
}

/// 项目列表。`scope` 给了就按域过滤（生活 / 工作 / 学习三个入口走的就是这一条）。
pub fn list(conn: &Connection, scope: Option<&str>) -> Result<Vec<Project>> {
    let sql = format!(
        "SELECT {COLS}, tasks_total, tasks_done FROM v_project_list p
         WHERE (?1 IS NULL OR p.scope = ?1)
         ORDER BY p.sort_order, p.due_date, p.name"
    );
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt
        .query_map([scope], row_to_project)?
        .collect::<rusqlite::Result<Vec<Project>>>()?;
    drop(stmt);
    for project in &mut rows {
        hydrate(conn, project)?;
    }
    Ok(rows)
}

/// 按 id 取一个，带全部派生项。
pub fn get(conn: &Connection, id: &str) -> Result<Project> {
    let mut project = conn
        .query_row(
            &format!("SELECT {COLS}, tasks_total, tasks_done FROM v_project_list p WHERE p.id = ?1"),
            [id],
            row_to_project,
        )
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("项目 {id}")))?;
    hydrate(conn, &mut project)?;
    Ok(project)
}

/// 新建。主表 + 成员 / 标签（整组替换）+ 一条动态，一次事务。
pub fn create(conn: &mut Connection, input: &ProjectInput) -> Result<Project> {
    validate(input)?;
    let id = new_id("pj");
    let tx = conn.transaction()?;
    tx.execute(
        &format!(
            "INSERT INTO project
               (id, owner_id, scope, name, description, status, priority, progress,
                current_milestone, start_date, due_date, budget_cents, visibility,
                repo_url, docs_ref, path, sort_order, created_at, updated_at)
             VALUES (?1, 'me', ?2, ?3, ?4, ?5, ?6, COALESCE(?7, 0),
                     ?8, COALESCE(?9, date('now')), ?10, ?11, COALESCE(?12, ?13),
                     ?14, ?15, ?16,
                     (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM project),
                     {NOW}, {NOW})"
        ),
        params![
            id,
            input.scope,
            input.name,
            input.description,
            input.status,
            input.priority,
            input.progress,
            input.current_milestone,
            input.start_date,
            input.due_date,
            input.budget_cents,
            input.visibility,
            default_visibility(&input.scope),
            input.repo_url,
            input.docs_ref,
            input.path,
        ],
    )?;
    write_members(&tx, &id, &input.owners)?;
    write_tags(&tx, &id, &input.tags)?;
    add_activity(&tx, &id, "创建了项目")?;
    tx.commit()?;
    get(conn, &id)
}

/// 编辑。表单没显示的列（开始日期 / 进度 / 预算 / 可见性 / 仓库 / 资料）保留原值；
/// 表单总会传的那几项（含 `path`，清空即落 NULL）按传入值覆盖。
///
/// `scope` 改动会连带把该项目下任务的 `scope` 同步 —— 两者的一致性由写入路径保证
/// （见 `0001_init.sql` 的注释），不能让它们各自漂。
pub fn update(conn: &mut Connection, id: &str, input: &ProjectInput) -> Result<Project> {
    validate(input)?;
    let tx = conn.transaction()?;
    let n = tx.execute(
        &format!(
            "UPDATE project SET
               scope = ?2, name = ?3, description = ?4, status = ?5, priority = ?6, due_date = ?7,
               start_date = COALESCE(?8, start_date), progress = COALESCE(?9, progress),
               current_milestone = ?10, budget_cents = COALESCE(?11, budget_cents),
               visibility = COALESCE(?12, visibility), repo_url = COALESCE(?13, repo_url),
               docs_ref = COALESCE(?14, docs_ref), path = ?15,
               updated_at = {NOW}
             WHERE id = ?1"
        ),
        params![
            id,
            input.scope,
            input.name,
            input.description,
            input.status,
            input.priority,
            input.due_date,
            input.start_date,
            input.progress,
            input.current_milestone,
            input.budget_cents,
            input.visibility,
            input.repo_url,
            input.docs_ref,
            input.path,
        ],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("项目 {id}")));
    }
    tx.execute("UPDATE task SET scope = ?2 WHERE project_id = ?1", params![id, input.scope])?;
    write_members(&tx, id, &input.owners)?;
    write_tags(&tx, id, &input.tags)?;
    add_activity(&tx, id, "更新了项目")?;
    tx.commit()?;
    get(conn, id)
}

/// 归档 / 完成 / 恢复 —— 都只是换一个 status（软删走 `archived`，见全局架构 §四）。
pub fn set_status(conn: &mut Connection, id: &str, status: &str) -> Result<Project> {
    check_enum("状态", status, STATUSES)?;
    let tx = conn.transaction()?;
    let n = tx.execute(
        &format!("UPDATE project SET status = ?2, updated_at = {NOW} WHERE id = ?1"),
        params![id, status],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("项目 {id}")));
    }
    let action = match status {
        "archived" => "归档了项目",
        "done" => "完成了项目",
        _ => "恢复了项目",
    };
    add_activity(&tx, id, action)?;
    tx.commit()?;
    get(conn, id)
}

/// 彻底删除。六张卫星表 `ON DELETE CASCADE` 跟着走；
/// 该项目的任务**不删**（`task.project_id` 是 `ON DELETE SET NULL`）——它们回到收件箱。
pub fn delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM project WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("项目 {id}")));
    }
    Ok(())
}

/// 往项目动态里追加一条（详情页「动态」分区的写入方）。
pub fn log_activity(conn: &Connection, id: &str, action: &str) -> Result<()> {
    let exists = conn
        .query_row("SELECT 1 FROM project WHERE id = ?1", [id], |_| Ok(()))
        .optional()?
        .is_some();
    if !exists {
        return Err(Error::NotFound(format!("项目 {id}")));
    }
    conn.execute(
        &format!(
            "INSERT INTO project_activity (id, project_id, actor_id, action, at)
             VALUES (?1, ?2, 'me', ?3, {NOW})"
        ),
        params![new_id("ac"), id, action],
    )?;
    Ok(())
}

/* ============================================================
   内部：hydrate / 子表 / 校验
   ============================================================ */

fn hydrate(conn: &Connection, project: &mut Project) -> Result<()> {
    let mut stmt = conn.prepare(
        "SELECT u.code FROM project_member m
         JOIN app_user u ON u.id = m.user_id
         WHERE m.project_id = ?1
         ORDER BY m.sort_order",
    )?;
    project.owners = stmt
        .query_map([&project.id], |row| row.get(0))?
        .collect::<rusqlite::Result<Vec<String>>>()?;
    drop(stmt);

    let mut stmt = conn.prepare(
        "SELECT t.name FROM project_tag pt
         JOIN tag t ON t.id = pt.tag_id
         WHERE pt.project_id = ?1
         ORDER BY t.id",
    )?;
    project.tags = stmt
        .query_map([&project.id], |row| row.get(0))?
        .collect::<rusqlite::Result<Vec<String>>>()?;
    drop(stmt);

    /* 清单一整表是 1:N，出参只取"当前最该看的那条"：最早一条未关闭的 */
    project.risk = conn
        .query_row(
            "SELECT title, description FROM project_risk
             WHERE project_id = ?1 AND closed_at IS NULL
             ORDER BY opened_at LIMIT 1",
            [&project.id],
            |row| Ok(ProjectRisk { title: row.get(0)?, description: row.get(1)? }),
        )
        .optional()?;
    Ok(())
}

/// 成员整组替换。`owners` 是码（`'LY'`），落库换成 `app_user.id`。
/// 名单不全时这里直接拦下 —— 空项目成员会让详情页那排头像消失，而原因在数据不在界面。
fn write_members(tx: &Transaction<'_>, project_id: &str, owners: &[String]) -> Result<()> {
    tx.execute("DELETE FROM project_member WHERE project_id = ?1", [project_id])?;
    for (i, code) in owners.iter().enumerate() {
        let user_id: String = tx
            .query_row("SELECT id FROM app_user WHERE code = ?1", [code], |row| row.get(0))
            .optional()?
            .ok_or_else(|| Error::Invalid(format!("成员名单里没有 {code}")))?;
        tx.execute(
            "INSERT OR IGNORE INTO project_member (project_id, user_id, sort_order) VALUES (?1,?2,?3)",
            params![project_id, user_id, i as i64],
        )?;
    }
    Ok(())
}

/// 标签整组替换。标签池是共享的：同名复用，不重复建（同 `srv` 的 `srv_tag`）。
fn write_tags(tx: &Transaction<'_>, project_id: &str, tags: &[String]) -> Result<()> {
    tx.execute("DELETE FROM project_tag WHERE project_id = ?1", [project_id])?;
    for name in tags {
        tx.execute("INSERT OR IGNORE INTO tag (name) VALUES (?1)", [name])?;
        let tag_id: i64 =
            tx.query_row("SELECT id FROM tag WHERE name = ?1", [name], |row| row.get(0))?;
        tx.execute(
            "INSERT OR IGNORE INTO project_tag (project_id, tag_id) VALUES (?1, ?2)",
            params![project_id, tag_id],
        )?;
    }
    Ok(())
}

fn add_activity(tx: &Transaction<'_>, project_id: &str, action: &str) -> Result<()> {
    tx.execute(
        &format!(
            "INSERT INTO project_activity (id, project_id, actor_id, action, at)
             VALUES (?1, ?2, 'me', ?3, {NOW})"
        ),
        params![new_id("ac"), project_id, action],
    )?;
    Ok(())
}

fn check_enum(what: &str, value: &str, allowed: &[&str]) -> Result<()> {
    if allowed.contains(&value) {
        return Ok(());
    }
    Err(Error::Invalid(format!("{what}的取值不对：{value}")))
}

/// 没填可见性时按域推一个合法值（DDL 的 `scope × visibility` 约束不允许跨域取值）。
fn default_visibility(scope: &str) -> &'static str {
    match scope {
        "work" => "work_internal",
        _ => "private",
    }
}

/// 与 DDL 的 CHECK 是**同一批规则的两次书写**（见全局架构 §二 D 判据）：
/// 写入路径先拦，报错才说得上人话；CHECK 兜住绕过门面的路径。
fn validate(input: &ProjectInput) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(Error::Invalid("项目名不能为空".into()));
    }
    check_enum("域", &input.scope, &["life", "work", "learn"])?;
    check_enum("状态", &input.status, STATUSES)?;
    check_enum("优先级", &input.priority, PRIORITIES)?;

    if let Some(progress) = input.progress {
        if !(0..=100).contains(&progress) {
            return Err(Error::Invalid("进度要在 0 到 100 之间".into()));
        }
    }

    if !is_iso_date(&input.due_date) {
        let what = if input.due_date.is_empty() { "截止日期必填".to_string() } else {
            format!("截止日期格式不对：{}", input.due_date)
        };
        return Err(Error::Invalid(what));
    }
    if let Some(start) = &input.start_date {
        if !is_iso_date(start) {
            return Err(Error::Invalid(format!("开始日期格式不对：{start}")));
        }
    }

    if let Some(visibility) = &input.visibility {
        let allowed: &[&str] = match input.scope.as_str() {
            "work" => &["work_internal", "confidential"],
            "learn" => &["private", "public"],
            _ => &["private", "family"],
        };
        if !allowed.contains(&visibility.as_str()) {
            return Err(Error::Invalid(format!("可见性与域不匹配：{visibility}")));
        }
    }
    Ok(())
}

/// `YYYY-MM-DD` 粗判：SQLite 没有日期类型，格式错了要在写入路径就说清楚。
fn is_iso_date(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 10
        && bytes[4] == b'-'
        && bytes[7] == b'-'
        && bytes
            .iter()
            .enumerate()
            .all(|(i, b)| i == 4 || i == 7 || b.is_ascii_digit())
}
