//! 生活域数据库操作。
//!
//! 6 个子模块各一组 CRUD，互不引用。习惯多了打卡动作（`toggle_log`），
//! 日记按 `log_date` 唯一，所以是 `upsert` 而非 `create`。
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;

use super::model::{
    LifeFinance, LifeFinanceInput, LifeHabit, LifeHabitInput, LifeHabitLog, LifeJournal,
    LifeJournalInput, LifePet, LifePetInput, LifeRecipe, LifeRecipeInput, LifeWorkout,
    LifeWorkoutInput,
};

const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

/* ============================================================
   习惯（life_habit）+ 打卡（life_habit_log）
   ============================================================ */

const HABIT_COLS: &str = "id, name, icon, color, target_per_week, enabled, sort_order, created_at";

fn row_to_habit(row: &Row<'_>) -> rusqlite::Result<LifeHabit> {
    Ok(LifeHabit {
        id: row.get(0)?,
        name: row.get(1)?,
        icon: row.get(2)?,
        color: row.get(3)?,
        target_per_week: row.get(4)?,
        enabled: row.get(5)?,
        sort_order: row.get(6)?,
        created_at: row.get(7)?,
    })
}

pub fn habit_list(conn: &Connection) -> Result<Vec<LifeHabit>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {HABIT_COLS} FROM life_habit ORDER BY sort_order, created_at"
    ))?;
    let rows = stmt
        .query_map([], row_to_habit)?
        .collect::<rusqlite::Result<Vec<LifeHabit>>>()?;
    Ok(rows)
}

pub fn habit_create(conn: &Connection, input: &LifeHabitInput) -> Result<LifeHabit> {
    habit_validate(input)?;
    let id = new_id("habit");
    conn.execute(
        &format!(
            "INSERT INTO life_habit
               (id, name, icon, color, target_per_week, enabled, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM life_habit),
                     {NOW})"
        ),
        params![
            id,
            input.name,
            input.icon,
            input.color,
            input.target_per_week,
            input.enabled as i64,
        ],
    )?;
    habit_get(conn, &id)
}

pub fn habit_update(conn: &Connection, id: &str, input: &LifeHabitInput) -> Result<LifeHabit> {
    habit_validate(input)?;
    let n = conn.execute(
        &format!(
            "UPDATE life_habit SET
               name = ?2, icon = ?3, color = ?4, target_per_week = ?5, enabled = ?6
             WHERE id = ?1"
        ),
        params![
            id,
            input.name,
            input.icon,
            input.color,
            input.target_per_week,
            input.enabled as i64,
        ],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("习惯 {id}")));
    }
    habit_get(conn, id)
}

pub fn habit_delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM life_habit WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("习惯 {id}")));
    }
    Ok(())
}

fn habit_get(conn: &Connection, id: &str) -> Result<LifeHabit> {
    conn.query_row(
        &format!("SELECT {HABIT_COLS} FROM life_habit WHERE id = ?1"),
        [id],
        row_to_habit,
    )
    .optional()?
    .ok_or_else(|| Error::NotFound(format!("习惯 {id}")))
}

fn habit_validate(input: &LifeHabitInput) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(Error::Invalid("习惯名称不能为空".into()));
    }
    if !(1..=7).contains(&input.target_per_week) {
        return Err(Error::Invalid(format!(
            "每周目标次数必须在 1-7 之间：{}",
            input.target_per_week
        )));
    }
    Ok(())
}

/* —— 打卡 —— */

const LOG_COLS: &str = "id, habit_id, log_date, done";

fn row_to_log(row: &Row<'_>) -> rusqlite::Result<LifeHabitLog> {
    Ok(LifeHabitLog {
        id: row.get(0)?,
        habit_id: row.get(1)?,
        log_date: row.get(2)?,
        done: row.get(3)?,
    })
}

/// 打卡 / 取消打卡：当天有记录就翻转 `done`，没有就插一条 `done=1`。
pub fn habit_toggle_log(conn: &Connection, habit_id: &str, log_date: &str) -> Result<LifeHabitLog> {
    // 先确认习惯存在（外键约束也会挡，但提前给出 NotFound 更可读）。
    habit_get(conn, habit_id)?;
    let existing: Option<bool> = conn
        .query_row(
            "SELECT done FROM life_habit_log WHERE habit_id = ?1 AND log_date = ?2",
            [habit_id, log_date],
            |row| row.get(0),
        )
        .optional()?;
    match existing {
        Some(done) => {
            conn.execute(
                "UPDATE life_habit_log SET done = ?3 WHERE habit_id = ?1 AND log_date = ?2",
                params![habit_id, log_date, !done as i64],
            )?;
        }
        None => {
            let id = new_id("habit");
            conn.execute(
                "INSERT INTO life_habit_log (id, habit_id, log_date, done) VALUES (?1, ?2, ?3, 1)",
                params![id, habit_id, log_date],
            )?;
        }
    }
    conn.query_row(
        &format!(
            "SELECT {LOG_COLS} FROM life_habit_log WHERE habit_id = ?1 AND log_date = ?2"
        ),
        [habit_id, log_date],
        row_to_log,
    )
    .optional()?
    .ok_or_else(|| Error::NotFound(format!("习惯 {habit_id} 在 {log_date} 的打卡记录")))
}

/* ============================================================
   财务（life_finance）
   ============================================================ */

const FINANCE_COLS: &str =
    "id, kind, amount_cents, category, note, log_date, sort_order, created_at";

fn row_to_finance(row: &Row<'_>) -> rusqlite::Result<LifeFinance> {
    Ok(LifeFinance {
        id: row.get(0)?,
        kind: row.get(1)?,
        amount_cents: row.get(2)?,
        category: row.get(3)?,
        note: row.get(4)?,
        log_date: row.get(5)?,
        sort_order: row.get(6)?,
        created_at: row.get(7)?,
    })
}

pub fn finance_list(conn: &Connection, limit: i64) -> Result<Vec<LifeFinance>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {FINANCE_COLS} FROM life_finance ORDER BY log_date DESC, sort_order LIMIT ?1"
    ))?;
    let rows = stmt
        .query_map([limit], row_to_finance)?
        .collect::<rusqlite::Result<Vec<LifeFinance>>>()?;
    Ok(rows)
}

pub fn finance_create(conn: &Connection, input: &LifeFinanceInput) -> Result<LifeFinance> {
    finance_validate(input)?;
    let id = new_id("finance");
    conn.execute(
        &format!(
            "INSERT INTO life_finance
               (id, kind, amount_cents, category, note, log_date, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM life_finance),
                     {NOW})"
        ),
        params![
            id,
            input.kind,
            input.amount_cents,
            input.category,
            input.note,
            input.log_date,
        ],
    )?;
    finance_get(conn, &id)
}

pub fn finance_delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM life_finance WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("财务记录 {id}")));
    }
    Ok(())
}

fn finance_get(conn: &Connection, id: &str) -> Result<LifeFinance> {
    conn.query_row(
        &format!("SELECT {FINANCE_COLS} FROM life_finance WHERE id = ?1"),
        [id],
        row_to_finance,
    )
    .optional()?
    .ok_or_else(|| Error::NotFound(format!("财务记录 {id}")))
}

fn finance_validate(input: &LifeFinanceInput) -> Result<()> {
    if !["income", "expense"].contains(&input.kind.as_str()) {
        return Err(Error::Invalid(format!("财务类型取值不对：{}", input.kind)));
    }
    if input.amount_cents < 0 {
        return Err(Error::Invalid(format!(
            "金额不能为负：{} 分",
            input.amount_cents
        )));
    }
    if input.log_date.trim().is_empty() {
        return Err(Error::Invalid("财务记录日期不能为空".into()));
    }
    Ok(())
}

/* ============================================================
   运动（life_workout）
   ============================================================ */

const WORKOUT_COLS: &str =
    "id, kind, duration_min, distance_km, calories, note, log_date, sort_order, created_at";

fn row_to_workout(row: &Row<'_>) -> rusqlite::Result<LifeWorkout> {
    Ok(LifeWorkout {
        id: row.get(0)?,
        kind: row.get(1)?,
        duration_min: row.get(2)?,
        distance_km: row.get(3)?,
        calories: row.get(4)?,
        note: row.get(5)?,
        log_date: row.get(6)?,
        sort_order: row.get(7)?,
        created_at: row.get(8)?,
    })
}

pub fn workout_list(conn: &Connection, limit: i64) -> Result<Vec<LifeWorkout>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {WORKOUT_COLS} FROM life_workout ORDER BY log_date DESC, sort_order LIMIT ?1"
    ))?;
    let rows = stmt
        .query_map([limit], row_to_workout)?
        .collect::<rusqlite::Result<Vec<LifeWorkout>>>()?;
    Ok(rows)
}

pub fn workout_create(conn: &Connection, input: &LifeWorkoutInput) -> Result<LifeWorkout> {
    workout_validate(input)?;
    let id = new_id("workout");
    conn.execute(
        &format!(
            "INSERT INTO life_workout
               (id, kind, duration_min, distance_km, calories, note, log_date, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM life_workout),
                     {NOW})"
        ),
        params![
            id,
            input.kind,
            input.duration_min,
            input.distance_km,
            input.calories,
            input.note,
            input.log_date,
        ],
    )?;
    workout_get(conn, &id)
}

pub fn workout_delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM life_workout WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("运动记录 {id}")));
    }
    Ok(())
}

fn workout_get(conn: &Connection, id: &str) -> Result<LifeWorkout> {
    conn.query_row(
        &format!("SELECT {WORKOUT_COLS} FROM life_workout WHERE id = ?1"),
        [id],
        row_to_workout,
    )
    .optional()?
    .ok_or_else(|| Error::NotFound(format!("运动记录 {id}")))
}

fn workout_validate(input: &LifeWorkoutInput) -> Result<()> {
    if input.log_date.trim().is_empty() {
        return Err(Error::Invalid("运动记录日期不能为空".into()));
    }
    Ok(())
}

/* ============================================================
   食谱（life_recipe）
   ============================================================ */

const RECIPE_COLS: &str = "id, name, ingredients, steps, tags, sort_order, created_at";

fn row_to_recipe(row: &Row<'_>) -> rusqlite::Result<LifeRecipe> {
    Ok(LifeRecipe {
        id: row.get(0)?,
        name: row.get(1)?,
        ingredients: row.get(2)?,
        steps: row.get(3)?,
        tags: row.get(4)?,
        sort_order: row.get(5)?,
        created_at: row.get(6)?,
    })
}

pub fn recipe_list(conn: &Connection) -> Result<Vec<LifeRecipe>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {RECIPE_COLS} FROM life_recipe ORDER BY sort_order, created_at"
    ))?;
    let rows = stmt
        .query_map([], row_to_recipe)?
        .collect::<rusqlite::Result<Vec<LifeRecipe>>>()?;
    Ok(rows)
}

pub fn recipe_create(conn: &Connection, input: &LifeRecipeInput) -> Result<LifeRecipe> {
    recipe_validate(input)?;
    let id = new_id("recipe");
    conn.execute(
        &format!(
            "INSERT INTO life_recipe
               (id, name, ingredients, steps, tags, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM life_recipe),
                     {NOW})"
        ),
        params![id, input.name, input.ingredients, input.steps, input.tags,],
    )?;
    recipe_get(conn, &id)
}

pub fn recipe_update(conn: &Connection, id: &str, input: &LifeRecipeInput) -> Result<LifeRecipe> {
    recipe_validate(input)?;
    let n = conn.execute(
        "UPDATE life_recipe SET
           name = ?2, ingredients = ?3, steps = ?4, tags = ?5
         WHERE id = ?1",
        params![id, input.name, input.ingredients, input.steps, input.tags,],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("食谱 {id}")));
    }
    recipe_get(conn, id)
}

pub fn recipe_delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM life_recipe WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("食谱 {id}")));
    }
    Ok(())
}

fn recipe_get(conn: &Connection, id: &str) -> Result<LifeRecipe> {
    conn.query_row(
        &format!("SELECT {RECIPE_COLS} FROM life_recipe WHERE id = ?1"),
        [id],
        row_to_recipe,
    )
    .optional()?
    .ok_or_else(|| Error::NotFound(format!("食谱 {id}")))
}

fn recipe_validate(input: &LifeRecipeInput) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(Error::Invalid("食谱名称不能为空".into()));
    }
    Ok(())
}

/* ============================================================
   宠物（life_pet）
   ============================================================ */

const PET_COLS: &str = "id, name, species, birth_date, reminder, sort_order, created_at";

fn row_to_pet(row: &Row<'_>) -> rusqlite::Result<LifePet> {
    Ok(LifePet {
        id: row.get(0)?,
        name: row.get(1)?,
        species: row.get(2)?,
        birth_date: row.get(3)?,
        reminder: row.get(4)?,
        sort_order: row.get(5)?,
        created_at: row.get(6)?,
    })
}

pub fn pet_list(conn: &Connection) -> Result<Vec<LifePet>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {PET_COLS} FROM life_pet ORDER BY sort_order, created_at"
    ))?;
    let rows = stmt
        .query_map([], row_to_pet)?
        .collect::<rusqlite::Result<Vec<LifePet>>>()?;
    Ok(rows)
}

pub fn pet_create(conn: &Connection, input: &LifePetInput) -> Result<LifePet> {
    pet_validate(input)?;
    let id = new_id("pet");
    conn.execute(
        &format!(
            "INSERT INTO life_pet
               (id, name, species, birth_date, reminder, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM life_pet),
                     {NOW})"
        ),
        params![id, input.name, input.species, input.birth_date, input.reminder,],
    )?;
    pet_get(conn, &id)
}

pub fn pet_update(conn: &Connection, id: &str, input: &LifePetInput) -> Result<LifePet> {
    pet_validate(input)?;
    let n = conn.execute(
        "UPDATE life_pet SET
           name = ?2, species = ?3, birth_date = ?4, reminder = ?5
         WHERE id = ?1",
        params![id, input.name, input.species, input.birth_date, input.reminder,],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("宠物 {id}")));
    }
    pet_get(conn, id)
}

pub fn pet_delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM life_pet WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("宠物 {id}")));
    }
    Ok(())
}

fn pet_get(conn: &Connection, id: &str) -> Result<LifePet> {
    conn.query_row(
        &format!("SELECT {PET_COLS} FROM life_pet WHERE id = ?1"),
        [id],
        row_to_pet,
    )
    .optional()?
    .ok_or_else(|| Error::NotFound(format!("宠物 {id}")))
}

fn pet_validate(input: &LifePetInput) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(Error::Invalid("宠物名称不能为空".into()));
    }
    Ok(())
}

/* ============================================================
   日记（life_journal）—— 按 log_date 唯一，所以用 upsert
   ============================================================ */

const JOURNAL_COLS: &str = "id, log_date, mood, content, created_at, updated_at";

fn row_to_journal(row: &Row<'_>) -> rusqlite::Result<LifeJournal> {
    Ok(LifeJournal {
        id: row.get(0)?,
        log_date: row.get(1)?,
        mood: row.get(2)?,
        content: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

pub fn journal_list(conn: &Connection, limit: i64) -> Result<Vec<LifeJournal>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {JOURNAL_COLS} FROM life_journal ORDER BY log_date DESC LIMIT ?1"
    ))?;
    let rows = stmt
        .query_map([limit], row_to_journal)?
        .collect::<rusqlite::Result<Vec<LifeJournal>>>()?;
    Ok(rows)
}

pub fn journal_get_by_date(conn: &Connection, log_date: &str) -> Result<Option<LifeJournal>> {
    let journal = conn
        .query_row(
            &format!("SELECT {JOURNAL_COLS} FROM life_journal WHERE log_date = ?1"),
            [log_date],
            row_to_journal,
        )
        .optional()?;
    Ok(journal)
}

/// 按 `log_date` 唯一：当天有记录就更新 mood/content，没有就插入新记录。
/// 不走 SQLite 的 `ON CONFLICT DO UPDATE`，是为了在新建分支里用 `new_id` 生成 id，
/// 与其它实体保持一致。
pub fn journal_upsert(conn: &Connection, input: &LifeJournalInput) -> Result<LifeJournal> {
    journal_validate(input)?;
    if let Some(existing) = journal_get_by_date(conn, &input.log_date)? {
        conn.execute(
            &format!(
                "UPDATE life_journal SET mood = ?2, content = ?3, updated_at = {NOW}
                 WHERE id = ?1"
            ),
            params![existing.id, input.mood, input.content,],
        )?;
        journal_get(conn, &existing.id)
    } else {
        let id = new_id("journal");
        conn.execute(
            &format!(
                "INSERT INTO life_journal (id, log_date, mood, content, created_at, updated_at)
                 VALUES (?1, ?2, ?3, ?4, {NOW}, {NOW})"
            ),
            params![id, input.log_date, input.mood, input.content,],
        )?;
        journal_get(conn, &id)
    }
}

pub fn journal_delete(conn: &Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM life_journal WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("日记 {id}")));
    }
    Ok(())
}

fn journal_get(conn: &Connection, id: &str) -> Result<LifeJournal> {
    conn.query_row(
        &format!("SELECT {JOURNAL_COLS} FROM life_journal WHERE id = ?1"),
        [id],
        row_to_journal,
    )
    .optional()?
    .ok_or_else(|| Error::NotFound(format!("日记 {id}")))
}

fn journal_validate(input: &LifeJournalInput) -> Result<()> {
    if input.log_date.trim().is_empty() {
        return Err(Error::Invalid("日记日期不能为空".into()));
    }
    if !["happy", "calm", "neutral", "sad", "angry"].contains(&input.mood.as_str()) {
        return Err(Error::Invalid(format!("心情取值不对：{}", input.mood)));
    }
    Ok(())
}
