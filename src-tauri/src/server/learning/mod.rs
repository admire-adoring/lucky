//! 学习域门面。6 张表各自一组 list/create/...，门面不在表间做聚合。
mod model;
mod repo;

pub use model::{
    LearningGoal, LearningGoalInput, LearningOutput, LearningOutputInput, LearningOverview,
    LearningResource, LearningResourceInput, LearningReview, LearningReviewInput, LearningSkill,
    LearningSkillInput, LearningStudyLog, LearningStudyLogInput,
};

use crate::server::error::Result;
use crate::server::store::Store;

/* ---------- 学习目标 ---------- */

pub fn goal_list(store: &Store) -> Result<Vec<LearningGoal>> {
    let conn = store.conn()?;
    repo::goal_list(&conn)
}
pub fn goal_create(store: &Store, input: &LearningGoalInput) -> Result<LearningGoal> {
    let conn = store.conn()?;
    repo::goal_create(&conn, input)
}
pub fn goal_update(store: &Store, id: &str, input: &LearningGoalInput) -> Result<LearningGoal> {
    let conn = store.conn()?;
    repo::goal_update(&conn, id, input)
}
pub fn goal_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::goal_delete(&conn, id)
}

/* ---------- 技能 ---------- */

pub fn skill_list(store: &Store) -> Result<Vec<LearningSkill>> {
    let conn = store.conn()?;
    repo::skill_list(&conn)
}
pub fn skill_create(store: &Store, input: &LearningSkillInput) -> Result<LearningSkill> {
    let conn = store.conn()?;
    repo::skill_create(&conn, input)
}
pub fn skill_update(store: &Store, id: &str, input: &LearningSkillInput) -> Result<LearningSkill> {
    let conn = store.conn()?;
    repo::skill_update(&conn, id, input)
}
pub fn skill_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::skill_delete(&conn, id)
}

/* ---------- 学习资源 ---------- */

pub fn resource_list(store: &Store) -> Result<Vec<LearningResource>> {
    let conn = store.conn()?;
    repo::resource_list(&conn)
}
pub fn resource_create(store: &Store, input: &LearningResourceInput) -> Result<LearningResource> {
    let conn = store.conn()?;
    repo::resource_create(&conn, input)
}
pub fn resource_update(store: &Store, id: &str, input: &LearningResourceInput) -> Result<LearningResource> {
    let conn = store.conn()?;
    repo::resource_update(&conn, id, input)
}
pub fn resource_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::resource_delete(&conn, id)
}

/* ---------- 复习卡片 ---------- */

pub fn review_list(store: &Store) -> Result<Vec<LearningReview>> {
    let conn = store.conn()?;
    repo::review_list(&conn)
}
pub fn review_due(store: &Store, today: &str) -> Result<Vec<LearningReview>> {
    let conn = store.conn()?;
    repo::review_due(&conn, today)
}
pub fn review_create(store: &Store, input: &LearningReviewInput) -> Result<LearningReview> {
    let conn = store.conn()?;
    repo::review_create(&conn, input)
}
pub fn review_update(store: &Store, id: &str, input: &LearningReviewInput) -> Result<LearningReview> {
    let conn = store.conn()?;
    repo::review_update(&conn, id, input)
}
pub fn review_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::review_delete(&conn, id)
}
/// SM-2 评分：grade 0-3。
pub fn review_grade(store: &Store, id: &str, grade: i64) -> Result<LearningReview> {
    let conn = store.conn()?;
    repo::review_grade(&conn, id, grade)
}

/* ---------- 输出作品 ---------- */

pub fn output_list(store: &Store) -> Result<Vec<LearningOutput>> {
    let conn = store.conn()?;
    repo::output_list(&conn)
}
pub fn output_create(store: &Store, input: &LearningOutputInput) -> Result<LearningOutput> {
    let conn = store.conn()?;
    repo::output_create(&conn, input)
}
pub fn output_update(store: &Store, id: &str, input: &LearningOutputInput) -> Result<LearningOutput> {
    let conn = store.conn()?;
    repo::output_update(&conn, id, input)
}
pub fn output_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::output_delete(&conn, id)
}

/* ---------- 学习日志 ---------- */

pub fn log_list(store: &Store, limit: i64) -> Result<Vec<LearningStudyLog>> {
    let conn = store.conn()?;
    repo::log_list(&conn, limit)
}
pub fn log_create(store: &Store, input: &LearningStudyLogInput) -> Result<LearningStudyLog> {
    let conn = store.conn()?;
    repo::log_create(&conn, input)
}
pub fn log_delete(store: &Store, id: &str) -> Result<()> {
    let conn = store.conn()?;
    repo::log_delete(&conn, id)
}

/* ---------- 概览统计 ---------- */

pub fn overview(store: &Store) -> Result<LearningOverview> {
    let conn = store.conn()?;
    repo::overview(&conn)
}
