//! 学习域结构体。6 张表：目标 / 技能 / 资源 / 复习 / 输出 / 学习日志。
//!
//! 字段命名一律 camelCase 序列化；时间戳 ISO 字符串。
use serde::{Deserialize, Serialize};

/* ============ 学习目标 ============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningGoal {
    pub id: String,
    pub title: String,
    pub description: String,
    pub progress: i64,
    pub target_date: String,
    pub status: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningGoalInput {
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub progress: i64,
    #[serde(default)]
    pub target_date: String,
    #[serde(default = "default_status_active")]
    pub status: String,
}

fn default_status_active() -> String {
    "active".into()
}

/* ============ 技能 ============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningSkill {
    pub id: String,
    pub name: String,
    pub level: i64,
    pub category: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningSkillInput {
    pub name: String,
    #[serde(default = "default_level")]
    pub level: i64,
    #[serde(default)]
    pub category: String,
}

fn default_level() -> i64 {
    1
}

/* ============ 学习资源 ============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningResource {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub progress: i64,
    pub tags: String,
    pub status: String,
    pub last_study_at: String,
    pub owner_id: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningResourceInput {
    pub title: String,
    #[serde(default = "default_kind_doc")]
    pub kind: String,
    #[serde(default)]
    pub progress: i64,
    #[serde(default)]
    pub tags: String,
    #[serde(default = "default_status_active")]
    pub status: String,
    #[serde(default)]
    pub last_study_at: String,
    #[serde(default)]
    pub owner_id: String,
}

fn default_kind_doc() -> String {
    "doc".into()
}

/* ============ 复习卡片（SM-2 简化）============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningReview {
    pub id: String,
    pub question: String,
    pub answer: String,
    pub tag: String,
    pub due_date: String,
    pub interval_days: i64,
    pub ease_factor: f64,
    pub reviewed_count: i64,
    pub owner_id: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningReviewInput {
    pub question: String,
    #[serde(default)]
    pub answer: String,
    #[serde(default)]
    pub tag: String,
    #[serde(default)]
    pub due_date: String,
    #[serde(default)]
    pub owner_id: String,
}

/* ============ 输出作品 ============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningOutput {
    pub id: String,
    pub title: String,
    pub kind: String,
    pub status: String,
    pub published_at: String,
    pub url: String,
    pub summary: String,
    pub owner_id: String,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningOutputInput {
    pub title: String,
    #[serde(default = "default_kind_blog")]
    pub kind: String,
    #[serde(default = "default_status_draft")]
    pub status: String,
    #[serde(default)]
    pub published_at: String,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub owner_id: String,
}

fn default_kind_blog() -> String {
    "blog".into()
}
fn default_status_draft() -> String {
    "draft".into()
}

/* ============ 学习日志（概览统计用）============ */

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningStudyLog {
    pub id: String,
    pub log_date: String,
    pub duration_min: i64,
    pub resource_id: String,
    pub note: String,
    pub owner_id: String,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningStudyLogInput {
    pub log_date: String,
    #[serde(default)]
    pub duration_min: i64,
    #[serde(default)]
    pub resource_id: String,
    #[serde(default)]
    pub note: String,
    #[serde(default)]
    pub owner_id: String,
}

/// 概览统计聚合（本周学习时长、待复习数、进行中资源数）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LearningOverview {
    pub week_minutes: i64,
    pub pending_review: i64,
    pub active_resource: i64,
    pub today_review: i64,
    pub total_output: i64,
    pub active_goal: i64,
}
