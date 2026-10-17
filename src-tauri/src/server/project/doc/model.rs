//! 文档索引的模型。库只存索引与文件坐标，正文在文件里（`source = 'local_md'` 时）。
use serde::{Deserialize, Serialize};

/// 一条关联（出边或反链）。`name` 与 `meta` 由 hydrate 时按 `to_kind` 补：
/// 目标标题 + 它自己的读数（文档＝种类码、任务＝状态码、会议＝开始时刻）；
/// 没有表可查的族（bug）两者都给空串。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentLink {
    pub kind: String,
    pub to_kind: String,
    pub to_id: String,
    pub name: String,
    /// 原始码/值，文案（`plan` → 「方案」）由展示层换 —— 与 D3 同一条分工。
    pub meta: String,
}

/// 读形态：索引一行 + 出边 + 反链。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Document {
    pub id: String,
    pub project_id: String,
    pub name: String,
    /// 「模块 → 功能」两层分组（自由文本）。
    pub module: String,
    pub func: String,
    /// 它是什么：`plan` / `design` / `api` / `test` / `spec` / `research` / `ref`
    pub kind: String,
    /// 素在哪儿：`local_md`（正文是本地文件）/ `tencent_doc` / `yuque` / `git`
    pub source: String,
    /// 相对文档根目录的路径；只有 `local_md` 有。
    pub file_path: Option<String>,
    /// 上次同步时正文的指纹（FNV-1a）。
    pub content_hash: Option<String>,
    pub synced_at: Option<String>,
    pub summary: String,
    pub author_id: Option<String>,
    /// 作者的显示名（hydrate 时按 `author_id` 查 `app_user`）；没有作者给空串。
    pub author: String,
    pub updated_at: String,
    pub sort_order: i64,
    pub links: Vec<DocumentLink>,
    /// 谁指向我 —— 反向查出来的，不落第二份。
    pub back: Vec<DocumentLink>,
}

/// 写入时的一条关联。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocLinkInput {
    pub kind: String,
    pub to_kind: String,
    pub to_id: String,
}

/// 写形态。`content` 只在 `source = 'local_md'` 时用：
/// create 时为正文字数（可为空串 —— 先建空文档再写也是正常路径）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentInput {
    pub project_id: String,
    pub name: String,
    #[serde(default)]
    pub module: String,
    #[serde(default)]
    pub func: String,
    pub kind: String,
    pub source: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub links: Vec<DocLinkInput>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

/// 正文读回。`changed = true` 表示"文件与索引不同步，刚刚已把索引更新"——
/// 页面据此提示"这份正文在外部被改过"。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocContent {
    pub content: String,
    pub hash: String,
    pub synced_at: String,
    pub changed: bool,
}
