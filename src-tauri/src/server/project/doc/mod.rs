//! 项目文档子域。门面：取锁 + 调 repo + 组装错误。
//!
//! 它属于项目族（`project_document` / `project_document_link`），所以住在 `project/` 下，
//! 不另立一个文档模块 —— 见 `全局架构.md` §九。
//!
//! 正文两类存法：`local_md` 是本地 `.md` 文件（`<documents 根>/<projectId>/…`，文件是正文的源），
//! 其余三种来源（腾讯文档 / 语雀 / Git）正文留在原工具，这里只有索引与链接。
mod file;
mod model;
mod repo;

// 全量导出是这一层的公共面（`Document.links` 的元素类型也在其中）；命令层只消费一部分。
#[allow(unused_imports)]
pub use model::{DocContent, DocLinkInput, Document, DocumentInput, DocumentLink};

use crate::server::error::Result;
use crate::server::store::Store;

/// 一个项目的文档索引（含出边与反链）。
pub fn list(store: &Store, project_id: &str) -> Result<Vec<Document>> {
    let conn = store.conn()?;
    repo::list(&conn, project_id)
}

pub fn get(store: &Store, id: &str) -> Result<Document> {
    let conn = store.conn()?;
    repo::get(&conn, id)
}

/// 新建：`local_md` 会先落一份（空）正文文件，再登记索引。
pub fn create(store: &Store, input: &DocumentInput) -> Result<Document> {
    repo::create(store, input)
}

/// 编辑索引；带 `content` 时连正文一起写（一次提交改两半）。
pub fn update(store: &Store, id: &str, input: &DocumentInput) -> Result<Document> {
    repo::update(store, id, input)
}

/// 删除索引与正文文件。
pub fn delete(store: &Store, id: &str) -> Result<()> {
    repo::delete(store, id)
}

/// 读正文（顺带做一次被动同步：文件被外部改过就把索引更新掉）。
pub fn read(store: &Store, id: &str) -> Result<DocContent> {
    repo::read(store, id)
}

/// 写正文（文件 + 指纹 + 时间）；`name` 给了就顺手把索引里的标题改掉。
pub fn write(store: &Store, id: &str, content: &str, name: Option<&str>) -> Result<Document> {
    repo::write(store, id, content, name)
}
