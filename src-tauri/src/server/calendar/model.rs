//! 日历事件结构体。
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEvent {
    pub id: String,
    pub title: String,
    pub detail: String,
    pub start_at: String,
    pub end_at: String,
    pub all_day: bool,
    pub location: String,
    pub color: String,
    pub scope: String,
    pub project_id: Option<String>,
    pub owner_id: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CalendarEventInput {
    pub title: String,
    #[serde(default)]
    pub detail: String,
    pub start_at: String,
    pub end_at: String,
    #[serde(default)]
    pub all_day: bool,
    #[serde(default)]
    pub location: String,
    #[serde(default = "default_color")]
    pub color: String,
    #[serde(default = "default_scope")]
    pub scope: String,
    #[serde(default)]
    pub project_id: Option<String>,
    #[serde(default)]
    pub owner_id: Option<String>,
}

fn default_color() -> String {
    "blue".into()
}
fn default_scope() -> String {
    "global".into()
}
