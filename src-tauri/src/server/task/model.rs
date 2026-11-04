//! 任务的模型。字段与 `task` 表列一一对应，序列化后 camelCase。
use serde::{Deserialize, Serialize};

/// 读形态：表一行。前端的展示文案（`due` / `late` / `dueDays` / `doneDays`）在 api 层
/// 由 `dueAt` / `completedAt` 现算，不落库（D1）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub scope: String,
    /// 没挂项目 = 收件箱里的任务（`NULL` 是事实，不是缺数据）。
    pub project_id: Option<String>,
    /// 项目名（hydrate 时按 `project_id` 查）。任务行要显示它，前端不该为了一个名字再查项目表。
    #[serde(default)]
    pub project_name: String,
    /// 负责人码（`'LY'`），与 `Project.owners` 同一套码。
    pub owner_code: Option<String>,
    pub title: String,
    pub state: String,
    pub priority: String,
    pub due_at: Option<String>,
    /// 排期落点，时间轴用它定位；与 `estimate_min` 成对（DDL 有 CHECK）。
    pub scheduled_start: Option<String>,
    pub estimate_min: Option<i64>,
    pub completed_at: Option<String>,
    /// 从哪来：`todo` / `idea` / `ref`。
    pub source_kind: Option<String>,
    /// 进收件箱的时刻（算"停留超过 N 天"）。
    pub inbox_at: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
    /// 检查项（子表）。**列表不带**（`None` 之外的空数组 = 还没查）；
    /// 只有 `task_get` 会填 —— 列表逐条查子表是 N+1。
    #[serde(default)]
    pub items: Vec<crate::server::task::item::TaskItem>,
}

/// 写形态。`scope` 在挂项目时可以不传（取项目的），不挂项目时必须传。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskInput {
    #[serde(default)]
    pub scope: Option<String>,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub owner_code: Option<String>,
    pub title: String,
    pub state: String,
    pub priority: String,
    #[serde(default)]
    pub due_at: Option<String>,
    #[serde(default)]
    pub scheduled_start: Option<String>,
    #[serde(default)]
    pub estimate_min: Option<i64>,
    #[serde(default)]
    pub source_kind: Option<String>,
    #[serde(default)]
    pub sort_order: Option<i64>,
}
