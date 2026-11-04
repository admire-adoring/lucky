//! 生活域门面。
//!
//! 与 `calendar/mod.rs` 同结构：每个函数收 `&Store`，转给 `repo::*`。
//! 6 个子模块互不引用，门面也不在它们之间做聚合 —— 各自一组 list/create/...。
mod model;
mod repo;

pub use model::{
    LifeFinance, LifeFinanceInput, LifeHabit, LifeHabitInput, LifeHabitLog, LifeJournal,
    LifeJournalInput, LifePet, LifePetInput, LifeRecipe, LifeRecipeInput, LifeWorkout,
    LifeWorkoutInput,
};

use crate::server::error::Result;
use crate::server::store::Store;

/* ---------- 习惯 ---------- */

pub fn habit_list(store: &Store) -> Result<Vec<LifeHabit>> {
    let conn = store.conn()?;
    repo::habit_list(&conn)
}

pub fn habit_create(store: &Store, input: &LifeHabitInput) -> Result<LifeHabit> {
    let conn = store.conn()?;
    repo::habit_create(&conn, input)
}

pub fn habit_update(store: &Store, id: &str, input: &LifeHabitInput) -> Result<LifeHabit> {
    let conn = store.conn()?;
    repo::habit_update(&conn, id, input)
}

pub fn habit_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::habit_delete(&conn, id)
}

/// 打卡 / 取消打卡：当天有记录就翻转 `done`，没有就插一条 `done=1`。
pub fn habit_toggle_log(store: &Store, habit_id: &str, log_date: &str) -> Result<LifeHabitLog> {
    let conn = store.conn()?;
    repo::habit_toggle_log(&conn, habit_id, log_date)
}

/* ---------- 财务 ---------- */

pub fn finance_list(store: &Store, limit: i64) -> Result<Vec<LifeFinance>> {
    let conn = store.conn()?;
    repo::finance_list(&conn, limit)
}

pub fn finance_create(store: &Store, input: &LifeFinanceInput) -> Result<LifeFinance> {
    let conn = store.conn()?;
    repo::finance_create(&conn, input)
}

pub fn finance_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::finance_delete(&conn, id)
}

/* ---------- 运动 ---------- */

pub fn workout_list(store: &Store, limit: i64) -> Result<Vec<LifeWorkout>> {
    let conn = store.conn()?;
    repo::workout_list(&conn, limit)
}

pub fn workout_create(store: &Store, input: &LifeWorkoutInput) -> Result<LifeWorkout> {
    let conn = store.conn()?;
    repo::workout_create(&conn, input)
}

pub fn workout_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::workout_delete(&conn, id)
}

/* ---------- 食谱 ---------- */

pub fn recipe_list(store: &Store) -> Result<Vec<LifeRecipe>> {
    let conn = store.conn()?;
    repo::recipe_list(&conn)
}

pub fn recipe_create(store: &Store, input: &LifeRecipeInput) -> Result<LifeRecipe> {
    let conn = store.conn()?;
    repo::recipe_create(&conn, input)
}

pub fn recipe_update(store: &Store, id: &str, input: &LifeRecipeInput) -> Result<LifeRecipe> {
    let conn = store.conn()?;
    repo::recipe_update(&conn, id, input)
}

pub fn recipe_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::recipe_delete(&conn, id)
}

/* ---------- 宠物 ---------- */

pub fn pet_list(store: &Store) -> Result<Vec<LifePet>> {
    let conn = store.conn()?;
    repo::pet_list(&conn)
}

pub fn pet_create(store: &Store, input: &LifePetInput) -> Result<LifePet> {
    let conn = store.conn()?;
    repo::pet_create(&conn, input)
}

pub fn pet_update(store: &Store, id: &str, input: &LifePetInput) -> Result<LifePet> {
    let conn = store.conn()?;
    repo::pet_update(&conn, id, input)
}

pub fn pet_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::pet_delete(&conn, id)
}

/* ---------- 日记 ---------- */

pub fn journal_list(store: &Store, limit: i64) -> Result<Vec<LifeJournal>> {
    let conn = store.conn()?;
    repo::journal_list(&conn, limit)
}

pub fn journal_get_by_date(store: &Store, log_date: &str) -> Result<Option<LifeJournal>> {
    let conn = store.conn()?;
    repo::journal_get_by_date(&conn, log_date)
}

/// 按 `log_date` 唯一：当天有记录就更新，没有就插入。
pub fn journal_upsert(store: &Store, input: &LifeJournalInput) -> Result<LifeJournal> {
    let conn = store.conn()?;
    repo::journal_upsert(&conn, input)
}

pub fn journal_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::journal_delete(&conn, id)
}
