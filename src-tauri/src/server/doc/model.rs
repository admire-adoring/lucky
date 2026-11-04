//! 文档的模型。一张表挂多种主实体（项目 / 服务器 / 将来的笔记），正文在文件或原工具里。
use serde::{Deserialize, Serialize};

/// 一条关联（出边或反链）。`name` / `meta` 由 hydrate 按 `to_kind` 补：
/// 目标标题 + 它自己的读数（文档＝种类码、任务＝状态码、会议＝开始时刻）。
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
    /// 宿主类型：`project` / `server` / `note`
    pub owner_kind: String,
    /// 宿主 id：项目 id / 机器名 / 笔记 id
    pub owner_id: String,
    /// 可选的项目关联（部署文档挂在机器上，但仍要说清属于哪个项目）
    pub project_id: Option<String>,
    pub name: String,
    /// 「模块 → 功能」两层分组（项目文档用；部署文档两列为空）
    pub module: String,
    pub func: String,
    /// 它是什么。词表随宿主不同：项目 / 笔记 7 值，服务器 3 值（写入路径校验）
    pub kind: String,
    /// 正文在哪：`local_md`（本地文件）/ 腾讯文档 / 语雀 / Git / 公司 wiki / 部署 / 外部 / 会议
    pub source: String,
    /// 部署文档的版本号；其余留空
    pub version: String,
    /// 相对文档根目录的路径（`<owner_kind>/<owner_id>/<文件名>`）；只有 `local_md` 有
    pub file_path: Option<String>,
    pub content_hash: Option<String>,
    pub synced_at: Option<String>,
    pub summary: String,
    pub author_id: Option<String>,
    /// 作者的显示名（hydrate 时按 `author_id` 查 `app_user`）；没有作者给空串
    pub author: String,
    pub updated_at: String,
    pub sort_order: i64,
    pub links: Vec<DocumentLink>,
    /// 谁指向我 —— 反向查出来的，不落第二份
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

/// 写形态。`content` 只在 `source = 'local_md'` 时用（create 时是初始正文）。
/// `file_path` 不在其中：落点由后端按宿主 + 标题算，创建后就固定（改名不挪文件）。
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocumentInput {
    pub owner_kind: String,
    pub owner_id: String,
    #[serde(default)]
    pub project_id: Option<String>,
    pub name: String,
    #[serde(default)]
    pub module: String,
    #[serde(default)]
    pub func: String,
    pub kind: String,
    pub source: String,
    #[serde(default)]
    pub version: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub links: Vec<DocLinkInput>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub sort_order: Option<i64>,
}

/// 正文读回。`changed = true`：文件与索引不同步，刚刚已把索引更新。
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DocContent {
    pub content: String,
    pub hash: String,
    pub synced_at: String,
    pub changed: bool,
}
