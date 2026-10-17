//! 项目的模型。字段与表列一一对应，序列化后是 camelCase，与前端 `types/index.ts` 对齐。
use serde::{Deserialize, Serialize};

/// 一条风险。表里是 1:N（`project_risk`），出参只给"当前最该看的那条"——
/// 最早一条未关闭的；前端 `Project.risk` 是单值，形状不变。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectRisk {
    pub title: String,
    pub description: String,
}

/// 读形态：主表一行 + 视图计数（`tasks_total` / `tasks_done`）+ hydrate（成员 / 标签 / 风险）。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Project {
    pub id: String,
    pub owner_id: String,
    pub scope: String,
    pub name: String,
    pub description: String,
    pub status: String,
    pub priority: String,
    pub progress: i64,
    /// 出参名是前端的 `milestone`；列名 `current_milestone` 是为了与 `project_milestone` 表分开
    /// （那份是里程碑清单，这份是"当前阶段"一句话）。
    #[serde(rename = "milestone")]
    pub current_milestone: String,
    /// ISO 日期。前端的「2026年10月01日」是渲染层的事。
    pub start_date: String,
    pub due_date: String,
    pub budget_cents: Option<i64>,
    pub visibility: String,
    pub repo_url: Option<String>,
    pub docs_ref: Option<String>,
    pub path: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,

    /* —— 不在主表里的那几项 —— */
    /// 负责人码（`'LY'`），按 `project_member.sort_order` 排。
    pub owners: Vec<String>,
    pub tags: Vec<String>,
    /// 列表页读数，来自视图 `v_project_list`（D1：能算的不落列）。
    pub tasks_total: i64,
    pub tasks_done: i64,
    pub risk: Option<ProjectRisk>,
}

/// 写形态。前端表单只传其中一部分（见 `api/projects.ts` 的 `ProjectPatch`）：
/// 缺省的项在 create 时按 scope 推默认、在 update 时保留原值，不会把没显示的列清空。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInput {
    pub name: String,
    #[serde(default)]
    pub description: String,
    pub scope: String,
    pub priority: String,
    pub status: String,
    /// ISO 日期，必填（表单那个日期框不能是空的）。
    pub due_date: String,
    #[serde(default)]
    pub start_date: Option<String>,
    #[serde(default)]
    pub progress: Option<i64>,
    #[serde(default)]
    pub tags: Vec<String>,
    /// 负责人码数组。查不到对应 `app_user.code` 时报 Invalid。
    #[serde(default)]
    pub owners: Vec<String>,
    #[serde(default, rename = "milestone")]
    pub current_milestone: String,
    #[serde(default)]
    pub budget_cents: Option<i64>,
    #[serde(default)]
    pub visibility: Option<String>,
    #[serde(default)]
    pub repo_url: Option<String>,
    #[serde(default)]
    pub docs_ref: Option<String>,
    /// 本地目录。**这一项 update 时总是覆盖**（前端表单每次都会传，清空即落 NULL）。
    #[serde(default)]
    pub path: Option<String>,
}
