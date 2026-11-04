//! 学习域数据库操作。6 张表互不引用，并列管理。
use rusqlite::{params, Connection, Row};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;

use super::model::{
    LearningGoal, LearningGoalInput, LearningOutput, LearningOutputInput, LearningOverview,
    LearningResource, LearningResourceInput, LearningReview, LearningReviewInput, LearningSkill,
    LearningSkillInput, LearningStudyLog, LearningStudyLogInput,
};

const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn validate_title(title: &str) -> Result<()> {
    if title.trim().is_empty() {
        return Err(Error::Invalid("标题不能为空".into()));
    }
    Ok(())
}

fn validate_progress(progress: i64) -> Result<()> {
    if !(0..=100).contains(&progress) {
        return Err(Error::Invalid("进度必须在 0-100".into()));
    }
    Ok(())
}

fn validate_level(level: i64) -> Result<()> {
    if !(1..=5).contains(&level) {
        return Err(Error::Invalid("技能等级必须在 1-5".into()));
    }
    Ok(())
}

fn validate_grade(grade: i64) -> Result<()> {
    if !(0..=3).contains(&grade) {
        return Err(Error::Invalid("评分必须在 0-3".into()));
    }
    Ok(())
}

/* ============ 学习目标 ============ */

const GOAL_COLS: &str = "id, title, description, progress, target_date, status, \
                         sort_order, created_at, updated_at";

fn row_to_goal(row: &Row<'_>) -> rusqlite::Result<LearningGoal> {
    Ok(LearningGoal {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        progress: row.get(3)?,
        target_date: row.get(4)?,
        status: row.get(5)?,
        sort_order: row.get(6)?,
        created_at: row.get(7)?,
        updated_at: row.get(8)?,
    })
}

pub fn goal_list(conn: &Connection) -> Result<Vec<LearningGoal>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {GOAL_COLS} FROM learning_goal ORDER BY sort_order, created_at"
    ))?;
    let rows = stmt.query_map([], row_to_goal)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Error::from)
}

pub fn goal_create(conn: &Connection, input: &LearningGoalInput) -> Result<LearningGoal> {
    validate_title(&input.title)?;
    validate_progress(input.progress)?;
    let id = new_id("goal");
    conn.execute(
        &format!(
            "INSERT INTO learning_goal (id, title, description, progress, target_date, status, \
             sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, \
             (SELECT COALESCE(MAX(sort_order),-1)+1 FROM learning_goal), {NOW}, {NOW})"
        ),
        params![id, input.title, input.description, input.progress, input.target_date, input.status],
    )?;
    get_goal(conn, &id)
}

pub fn goal_update(conn: &Connection, id: &str, input: &LearningGoalInput) -> Result<LearningGoal> {
    validate_title(&input.title)?;
    validate_progress(input.progress)?;
    let affected = conn.execute(
        &format!(
            "UPDATE learning_goal SET title=?2, description=?3, progress=?4, target_date=?5, \
             status=?6, updated_at={NOW} WHERE id=?1"
        ),
        params![id, input.title, input.description, input.progress, input.target_date, input.status],
    )?;
    if affected == 0 {
        return Err(Error::NotFound("记录不存在".into()));
    }
    get_goal(conn, id)
}

pub fn goal_delete(conn: &Connection, id: &str) -> Result<()> {
    let affected = conn.execute("DELETE FROM learning_goal WHERE id=?1", params![id])?;
    if affected == 0 {
        return Err(Error::NotFound("记录不存在".into()));
    }
    Ok(())
}

fn get_goal(conn: &Connection, id: &str) -> Result<LearningGoal> {
    conn.query_row(
        &format!("SELECT {GOAL_COLS} FROM learning_goal WHERE id=?1"),
        params![id],
        row_to_goal,
    )
    .map_err(Error::from)
}

/* ============ 技能 ============ */

const SKILL_COLS: &str = "id, name, level, category, sort_order, created_at, updated_at";

fn row_to_skill(row: &Row<'_>) -> rusqlite::Result<LearningSkill> {
    Ok(LearningSkill {
        id: row.get(0)?,
        name: row.get(1)?,
        level: row.get(2)?,
        category: row.get(3)?,
        sort_order: row.get(4)?,
        created_at: row.get(5)?,
        updated_at: row.get(6)?,
    })
}

pub fn skill_list(conn: &Connection) -> Result<Vec<LearningSkill>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {SKILL_COLS} FROM learning_skill ORDER BY sort_order, created_at"
    ))?;
    let rows = stmt.query_map([], row_to_skill)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Error::from)
}

pub fn skill_create(conn: &Connection, input: &LearningSkillInput) -> Result<LearningSkill> {
    validate_title(&input.name)?;
    validate_level(input.level)?;
    let id = new_id("skill");
    conn.execute(
        &format!(
            "INSERT INTO learning_skill (id, name, level, category, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, \
             (SELECT COALESCE(MAX(sort_order),-1)+1 FROM learning_skill), {NOW}, {NOW})"
        ),
        params![id, input.name, input.level, input.category],
    )?;
    get_skill(conn, &id)
}

pub fn skill_update(conn: &Connection, id: &str, input: &LearningSkillInput) -> Result<LearningSkill> {
    validate_title(&input.name)?;
    validate_level(input.level)?;
    let affected = conn.execute(
        &format!(
            "UPDATE learning_skill SET name=?2, level=?3, category=?4, updated_at={NOW} WHERE id=?1"
        ),
        params![id, input.name, input.level, input.category],
    )?;
    if affected == 0 {
        return Err(Error::NotFound("记录不存在".into()));
    }
    get_skill(conn, id)
}

pub fn skill_delete(conn: &Connection, id: &str) -> Result<()> {
    let affected = conn.execute("DELETE FROM learning_skill WHERE id=?1", params![id])?;
    if affected == 0 {
        return Err(Error::NotFound("记录不存在".into()));
    }
    Ok(())
}

fn get_skill(conn: &Connection, id: &str) -> Result<LearningSkill> {
    conn.query_row(
        &format!("SELECT {SKILL_COLS} FROM learning_skill WHERE id=?1"),
        params![id],
        row_to_skill,
    )
    .map_err(Error::from)
}

/* ============ 学习资源 ============ */

const RES_COLS: &str = "id, title, kind, progress, tags, status, last_study_at, owner_id, \
                        sort_order, created_at, updated_at";

fn row_to_resource(row: &Row<'_>) -> rusqlite::Result<LearningResource> {
    Ok(LearningResource {
        id: row.get(0)?,
        title: row.get(1)?,
        kind: row.get(2)?,
        progress: row.get(3)?,
        tags: row.get(4)?,
        status: row.get(5)?,
        last_study_at: row.get(6)?,
        owner_id: row.get(7)?,
        sort_order: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

pub fn resource_list(conn: &Connection) -> Result<Vec<LearningResource>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {RES_COLS} FROM learning_resource ORDER BY sort_order, created_at"
    ))?;
    let rows = stmt.query_map([], row_to_resource)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Error::from)
}

pub fn resource_create(conn: &Connection, input: &LearningResourceInput) -> Result<LearningResource> {
    validate_title(&input.title)?;
    validate_progress(input.progress)?;
    let id = new_id("resource");
    conn.execute(
        &format!(
            "INSERT INTO learning_resource (id, title, kind, progress, tags, status, last_study_at, \
             owner_id, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, \
             (SELECT COALESCE(MAX(sort_order),-1)+1 FROM learning_resource), {NOW}, {NOW})"
        ),
        params![id, input.title, input.kind, input.progress, input.tags, input.status,
            input.last_study_at, input.owner_id],
    )?;
    get_resource(conn, &id)
}

pub fn resource_update(conn: &Connection, id: &str, input: &LearningResourceInput) -> Result<LearningResource> {
    validate_title(&input.title)?;
    validate_progress(input.progress)?;
    let affected = conn.execute(
        &format!(
            "UPDATE learning_resource SET title=?2, kind=?3, progress=?4, tags=?5, status=?6, \
             last_study_at=?7, owner_id=?8, updated_at={NOW} WHERE id=?1"
        ),
        params![id, input.title, input.kind, input.progress, input.tags, input.status,
            input.last_study_at, input.owner_id],
    )?;
    if affected == 0 {
        return Err(Error::NotFound("记录不存在".into()));
    }
    get_resource(conn, id)
}

pub fn resource_delete(conn: &Connection, id: &str) -> Result<()> {
    let affected = conn.execute("DELETE FROM learning_resource WHERE id=?1", params![id])?;
    if affected == 0 {
        return Err(Error::NotFound("记录不存在".into()));
    }
    Ok(())
}

fn get_resource(conn: &Connection, id: &str) -> Result<LearningResource> {
    conn.query_row(
        &format!("SELECT {RES_COLS} FROM learning_resource WHERE id=?1"),
        params![id],
        row_to_resource,
    )
    .map_err(Error::from)
}

/* ============ 复习卡片（SM-2 简化）============ */

const REVIEW_COLS: &str = "id, question, answer, tag, due_date, interval_days, ease_factor, \
                           reviewed_count, owner_id, sort_order, created_at, updated_at";

fn row_to_review(row: &Row<'_>) -> rusqlite::Result<LearningReview> {
    Ok(LearningReview {
        id: row.get(0)?,
        question: row.get(1)?,
        answer: row.get(2)?,
        tag: row.get(3)?,
        due_date: row.get(4)?,
        interval_days: row.get(5)?,
        ease_factor: row.get(6)?,
        reviewed_count: row.get(7)?,
        owner_id: row.get(8)?,
        sort_order: row.get(9)?,
        created_at: row.get(10)?,
        updated_at: row.get(11)?,
    })
}

pub fn review_list(conn: &Connection) -> Result<Vec<LearningReview>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {REVIEW_COLS} FROM learning_review ORDER BY due_date, sort_order"
    ))?;
    let rows = stmt.query_map([], row_to_review)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Error::from)
}

/// 只查到期日 <= today 的卡。
pub fn review_due(conn: &Connection, today: &str) -> Result<Vec<LearningReview>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {REVIEW_COLS} FROM learning_review
         WHERE due_date <= ?1
         ORDER BY due_date, sort_order"
    ))?;
    let rows = stmt.query_map([today], row_to_review)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Error::from)
}

pub fn review_create(conn: &Connection, input: &LearningReviewInput) -> Result<LearningReview> {
    validate_title(&input.question)?;
    let due = if input.due_date.trim().is_empty() {
        today_iso()?
    } else {
        input.due_date.clone()
    };
    let id = new_id("review");
    conn.execute(
        &format!(
            "INSERT INTO learning_review (id, question, answer, tag, due_date, interval_days, \
             ease_factor, reviewed_count, owner_id, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, 1, 2.5, 0, ?6, \
             (SELECT COALESCE(MAX(sort_order),-1)+1 FROM learning_review), {NOW}, {NOW})"
        ),
        params![id, input.question, input.answer, input.tag, due, input.owner_id],
    )?;
    get_review(conn, &id)
}

pub fn review_update(conn: &Connection, id: &str, input: &LearningReviewInput) -> Result<LearningReview> {
    validate_title(&input.question)?;
    let affected = conn.execute(
        &format!(
            "UPDATE learning_review SET question=?2, answer=?3, tag=?4, due_date=?5, owner_id=?6, \
             updated_at={NOW} WHERE id=?1"
        ),
        params![id, input.question, input.answer, input.tag, input.due_date, input.owner_id],
    )?;
    if affected == 0 {
        return Err(Error::NotFound("记录不存在".into()));
    }
    get_review(conn, id)
}

pub fn review_delete(conn: &Connection, id: &str) -> Result<()> {
    let affected = conn.execute("DELETE FROM learning_review WHERE id=?1", params![id])?;
    if affected == 0 {
        return Err(Error::NotFound("记录不存在".into()));
    }
    Ok(())
}

/// SM-2 评分：grade 0=忘了/1=模糊/2=记得/3=很熟。
/// 忘了重置间隔为 1 天；记得则按 ease_factor 放大间隔。
pub fn review_grade(conn: &Connection, id: &str, grade: i64) -> Result<LearningReview> {
    validate_grade(grade)?;
    let current = get_review(conn, id)?;
    // ease_factor 在 1.3-3.0 区间，grade<3 时下调。
    let new_ease = (current.ease_factor + (0.1 - (3.0 - grade as f64) * 0.28).max(0.0)).max(1.3).min(3.0);
    let new_interval = if grade < 2 {
        1
    } else if current.reviewed_count == 0 {
        1
    } else if current.reviewed_count == 1 {
        3
    } else {
        ((current.interval_days as f64) * new_ease).round() as i64
    };
    let new_due = add_days(&today_iso()?, new_interval)?;
    let new_count = current.reviewed_count + 1;
    conn.execute(
        &format!(
            "UPDATE learning_review SET interval_days=?2, ease_factor=?3, reviewed_count=?4, \
             due_date=?5, updated_at={NOW} WHERE id=?1"
        ),
        params![id, new_interval, new_ease, new_count, new_due],
    )?;
    get_review(conn, id)
}

fn get_review(conn: &Connection, id: &str) -> Result<LearningReview> {
    conn.query_row(
        &format!("SELECT {REVIEW_COLS} FROM learning_review WHERE id=?1"),
        params![id],
        row_to_review,
    )
    .map_err(Error::from)
}

/* ============ 输出作品 ============ */

const OUTPUT_COLS: &str = "id, title, kind, status, published_at, url, summary, owner_id, \
                           sort_order, created_at, updated_at";

fn row_to_output(row: &Row<'_>) -> rusqlite::Result<LearningOutput> {
    Ok(LearningOutput {
        id: row.get(0)?,
        title: row.get(1)?,
        kind: row.get(2)?,
        status: row.get(3)?,
        published_at: row.get(4)?,
        url: row.get(5)?,
        summary: row.get(6)?,
        owner_id: row.get(7)?,
        sort_order: row.get(8)?,
        created_at: row.get(9)?,
        updated_at: row.get(10)?,
    })
}

pub fn output_list(conn: &Connection) -> Result<Vec<LearningOutput>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {OUTPUT_COLS} FROM learning_output ORDER BY sort_order, created_at DESC"
    ))?;
    let rows = stmt.query_map([], row_to_output)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Error::from)
}

pub fn output_create(conn: &Connection, input: &LearningOutputInput) -> Result<LearningOutput> {
    validate_title(&input.title)?;
    let id = new_id("output");
    conn.execute(
        &format!(
            "INSERT INTO learning_output (id, title, kind, status, published_at, url, summary, \
             owner_id, sort_order, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, \
             (SELECT COALESCE(MAX(sort_order),-1)+1 FROM learning_output), {NOW}, {NOW})"
        ),
        params![id, input.title, input.kind, input.status, input.published_at,
            input.url, input.summary, input.owner_id],
    )?;
    get_output(conn, &id)
}

pub fn output_update(conn: &Connection, id: &str, input: &LearningOutputInput) -> Result<LearningOutput> {
    validate_title(&input.title)?;
    let affected = conn.execute(
        &format!(
            "UPDATE learning_output SET title=?2, kind=?3, status=?4, published_at=?5, url=?6, \
             summary=?7, owner_id=?8, updated_at={NOW} WHERE id=?1"
        ),
        params![id, input.title, input.kind, input.status, input.published_at,
            input.url, input.summary, input.owner_id],
    )?;
    if affected == 0 {
        return Err(Error::NotFound("记录不存在".into()));
    }
    get_output(conn, id)
}

pub fn output_delete(conn: &Connection, id: &str) -> Result<()> {
    let affected = conn.execute("DELETE FROM learning_output WHERE id=?1", params![id])?;
    if affected == 0 {
        return Err(Error::NotFound("记录不存在".into()));
    }
    Ok(())
}

fn get_output(conn: &Connection, id: &str) -> Result<LearningOutput> {
    conn.query_row(
        &format!("SELECT {OUTPUT_COLS} FROM learning_output WHERE id=?1"),
        params![id],
        row_to_output,
    )
    .map_err(Error::from)
}

/* ============ 学习日志 ============ */

const LOG_COLS: &str = "id, log_date, duration_min, resource_id, note, owner_id, created_at";

fn row_to_log(row: &Row<'_>) -> rusqlite::Result<LearningStudyLog> {
    Ok(LearningStudyLog {
        id: row.get(0)?,
        log_date: row.get(1)?,
        duration_min: row.get(2)?,
        resource_id: row.get(3)?,
        note: row.get(4)?,
        owner_id: row.get(5)?,
        created_at: row.get(6)?,
    })
}

pub fn log_list(conn: &Connection, limit: i64) -> Result<Vec<LearningStudyLog>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {LOG_COLS} FROM learning_study_log ORDER BY log_date DESC, created_at DESC LIMIT ?1"
    ))?;
    let rows = stmt.query_map([limit], row_to_log)?;
    rows.collect::<rusqlite::Result<Vec<_>>>().map_err(Error::from)
}

pub fn log_create(conn: &Connection, input: &LearningStudyLogInput) -> Result<LearningStudyLog> {
    if input.log_date.trim().is_empty() {
        return Err(Error::Invalid("学习日期不能为空".into()));
    }
    let id = new_id("studylog");
    conn.execute(
        &format!(
            "INSERT INTO learning_study_log (id, log_date, duration_min, resource_id, note, owner_id, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, {NOW})"
        ),
        params![id, input.log_date, input.duration_min, input.resource_id, input.note, input.owner_id],
    )?;
    conn.query_row(
        &format!("SELECT {LOG_COLS} FROM learning_study_log WHERE id=?1"),
        params![id],
        row_to_log,
    )
    .map_err(Error::from)
}

pub fn log_delete(conn: &Connection, id: &str) -> Result<()> {
    let affected = conn.execute("DELETE FROM learning_study_log WHERE id=?1", params![id])?;
    if affected == 0 {
        return Err(Error::NotFound("记录不存在".into()));
    }
    Ok(())
}

/* ============ 概览统计 ============ */

pub fn overview(conn: &Connection) -> Result<LearningOverview> {
    let week_start = week_start_iso()?;
    let today = today_iso()?;
    let week_minutes: i64 = conn.query_row(
        "SELECT COALESCE(SUM(duration_min),0) FROM learning_study_log WHERE log_date >= ?1",
        params![week_start],
        |r| r.get(0),
    )?;
    let pending_review: i64 = conn.query_row(
        "SELECT COUNT(*) FROM learning_review WHERE due_date <= ?1",
        params![today],
        |r| r.get(0),
    )?;
    let today_review: i64 = conn.query_row(
        "SELECT COUNT(*) FROM learning_review WHERE due_date = ?1",
        params![today],
        |r| r.get(0),
    )?;
    let active_resource: i64 = conn.query_row(
        "SELECT COUNT(*) FROM learning_resource WHERE status = 'active'",
        [],
        |r| r.get(0),
    )?;
    let total_output: i64 = conn.query_row(
        "SELECT COUNT(*) FROM learning_output WHERE status = 'published'",
        [],
        |r| r.get(0),
    )?;
    let active_goal: i64 = conn.query_row(
        "SELECT COUNT(*) FROM learning_goal WHERE status = 'active'",
        [],
        |r| r.get(0),
    )?;
    Ok(LearningOverview {
        week_minutes,
        pending_review,
        active_resource,
        today_review,
        total_output,
        active_goal,
    })
}

/* ============ 日期工具：用 SQLite date 函数，不依赖 chrono ============ */

fn today_iso() -> Result<String> {
    Ok(Connection::open_in_memory()?.query_row("SELECT date('now')", [], |r| r.get::<_, String>(0))?)
}

fn week_start_iso() -> Result<String> {
    // 周一为一周起点：当前日期减去 (weekday-1) 天。SQLite 的 %w 周日=0。
    Ok(Connection::open_in_memory()?.query_row(
        "SELECT date('now', '-' || ((strftime('%w','now') + 6) % 7) || ' days')",
        [],
        |r| r.get::<_, String>(0),
    )?)
}

fn add_days(base: &str, days: i64) -> Result<String> {
    Ok(Connection::open_in_memory()?.query_row(
        "SELECT date(?1, '+' || ?2 || ' days')",
        params![base, days],
        |r| r.get::<_, String>(0),
    )?)
}
