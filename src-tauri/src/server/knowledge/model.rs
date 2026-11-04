//! 知识库结构体：笔记与标签。
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeNote {
    pub id: String,
    pub title: String,
    pub content: String,
    pub excerpt: String,
    /// draft / published / archived
    pub status: String,
    pub favorited: bool,
    pub owner_id: Option<String>,
    pub sort_order: i64,
    pub created_at: String,
    pub updated_at: String,
    /// 笔记挂的标签（hydrate 时填充，入参不带）。
    pub tags: Vec<KnowledgeTag>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeNoteInput {
    pub title: String,
    #[serde(default)]
    pub content: String,
    #[serde(default)]
    pub excerpt: String,
    #[serde(default = "default_status")]
    pub status: String,
    #[serde(default)]
    pub favorited: bool,
    #[serde(default)]
    pub owner_id: Option<String>,
}

fn default_status() -> String {
    "published".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeTag {
    pub id: String,
    pub name: String,
    /// 0=普通标签，1=主题（在"主题"tab 里单独展示）
    pub is_topic: bool,
    pub color: String,
    pub sort_order: i64,
    pub created_at: String,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KnowledgeTagInput {
    pub name: String,
    #[serde(default)]
    pub is_topic: bool,
    #[serde(default = "default_color")]
    pub color: String,
}

fn default_color() -> String {
    "blue".into()
}

/// 笔记列表筛选：三个条件都是可选，组合使用。
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NoteFilter {
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub favorited: Option<bool>,
    #[serde(default)]
    pub tag_id: Option<String>,
}
