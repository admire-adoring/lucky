//! 生活域结构体。7 张表互不引用，是并列的个人记录。
//!
//! 字段命名一律 camelCase 序列化（`#[serde(rename_all = "camelCase")]`）；
//! 布尔字段在 Rust 用 `bool`，DB 用 `INTEGER`（0/1），读写时 `as i64` / `row.get` 转换。
use serde::{Deserialize, Serialize};

/* ============ 习惯 ============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifeHabit {
    pub id: String,
    pub name: String,
    pub icon: String,
    pub color: String,
    pub target_per_week: i64,
    pub enabled: bool,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifeHabitInput {
    pub name: String,
    #[serde(default)]
    pub icon: String,
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default = "default_target_per_week")]
    pub target_per_week: i64,
    #[serde(default = "default_enabled")]
    pub enabled: bool,
}

fn default_color() -> String {
    "blue".into()
}
fn default_target_per_week() -> i64 {
    7
}
fn default_enabled() -> bool {
    true
}

/* ============ 习惯打卡 ============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifeHabitLog {
    pub id: String,
    pub habit_id: String,
    pub log_date: String,
    pub done: bool,
}

/* ============ 财务 ============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifeFinance {
    pub id: String,
    /// income / expense
    pub kind: String,
    pub amount_cents: i64,
    pub category: String,
    pub note: String,
    pub log_date: String,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifeFinanceInput {
    /// income / expense
    pub kind: String,
    pub amount_cents: i64,
    #[serde(default)]
    pub category: String,
    #[serde(default)]
    pub note: String,
    pub log_date: String,
}

/* ============ 运动 ============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifeWorkout {
    pub id: String,
    /// run/cycle/swim/strength/yoga/other
    pub kind: String,
    pub duration_min: i64,
    pub distance_km: f64,
    pub calories: i64,
    pub note: String,
    pub log_date: String,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifeWorkoutInput {
    #[serde(default = "default_workout_kind")]
    pub kind: String,
    #[serde(default)]
    pub duration_min: i64,
    #[serde(default)]
    pub distance_km: f64,
    #[serde(default)]
    pub calories: i64,
    #[serde(default)]
    pub note: String,
    pub log_date: String,
}

fn default_workout_kind() -> String {
    "run".into()
}

/* ============ 食谱 ============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifeRecipe {
    pub id: String,
    pub name: String,
    pub ingredients: String,
    pub steps: String,
    pub tags: String,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifeRecipeInput {
    pub name: String,
    #[serde(default)]
    pub ingredients: String,
    #[serde(default)]
    pub steps: String,
    #[serde(default)]
    pub tags: String,
}

/* ============ 宠物 ============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifePet {
    pub id: String,
    pub name: String,
    pub species: String,
    pub birth_date: String,
    pub reminder: String,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifePetInput {
    pub name: String,
    #[serde(default = "default_species")]
    pub species: String,
    #[serde(default)]
    pub birth_date: String,
    #[serde(default)]
    pub reminder: String,
}

fn default_species() -> String {
    "cat".into()
}

/* ============ 日记 ============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifeJournal {
    pub id: String,
    pub log_date: String,
    /// happy/calm/neutral/sad/angry
    pub mood: String,
    pub content: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifeJournalInput {
    pub log_date: String,
    #[serde(default = "default_mood")]
    pub mood: String,
    #[serde(default)]
    pub content: String,
}

fn default_mood() -> String {
    "neutral".into()
}
