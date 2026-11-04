//! 设置项结构体。
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingItem {
    pub id: String,
    pub category: String,
    pub item_key: String,
    pub label: String,
    pub value: String,
    pub description: String,
    pub sort_order: i64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingItemInput {
    pub category: String,
    pub item_key: String,
    pub label: String,
    #[serde(default)]
    pub value: String,
    #[serde(default)]
    pub description: String,
}
