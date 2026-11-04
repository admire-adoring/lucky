//! 文档域。门面：取锁 + 调 repo + 组装错误。
//!
//! 文档是**一张表挂多种主实体**：项目（`/projects`、各域的项目分区）、服务器（那台机器上的
//! 部署手册）、将来的知识库笔记。宿主由 `owner_kind` + `owner_id` 表达（多态，无外键），
//! 删宿主时的清理由 `cleanup_by_owner` 完成。
//!
//! 它不属于项目族 —— 这正是它从 `project/doc/` 迁出来的原因（见 `全局架构.md` §九）。
//!
//! 正文两类存法：`local_md` 是本地 `.md` 文件（`<documents 根>/<owner_kind>/<owner_id>/…`，
//! 文件是正文的源），其余来源的正文留在原工具，这里只有索引与链接。
mod file;
mod model;
mod repo;

// 全量导出是这一层的公共面（`Document.links` 的元素类型也在其中）；命令层只消费一部分。
#[allow(unused_imports)]
pub use model::{
    BrowseEntry, DirListing, DocContent, DocDirs, DocLinkInput, Document, DocumentInput, DocumentLink,
};

use crate::server::error::Result;
use crate::server::store::Store;

/// 文档列表。过滤都可选：`owner_kind` / `owner_id`（某宿主下的）、`project_id`
/// （某项目名下的，含挂在机器上的部署文档）、`kind`（某一类）。
pub fn list(
    store: &Store,
    owner_kind: Option<&str>,
    owner_id: Option<&str>,
    project_id: Option<&str>,
    kind: Option<&str>,
) -> Result<Vec<Document>> {
    let conn = store.conn()?;
    repo::list(&conn, owner_kind, owner_id, project_id, kind)
}

pub fn get(store: &Store, id: &str) -> Result<Document> {
    let conn = store.conn()?;
    repo::get(&conn, id)
}

/// 新建：`local_md` 会先落一份（空）正文文件，再登记索引。
/// 落点由 `input.dir`（相对文档根）定，不给就按宿主分目录。
pub fn create(store: &Store, input: &DocumentInput) -> Result<Document> {
    repo::create(store, input)
}

/// 文档根 + 根下的目录 —— 新建文档时挑存放位置。
pub fn dirs(store: &Store) -> DocDirs {
    let root = store.documents_root();
    DocDirs {
        root: root.display().to_string(),
        dirs: file::list_dirs(root),
    }
}

/// 浏览本机目录：新建文档时挑文件夹，或直接绑定本机已有的 `.md`。
/// `path` 为空 ⇒ 从文档根开始。
pub fn browse(store: &Store, path: Option<&str>) -> Result<DirListing> {
    let root = store.documents_root();
    let listing = file::browse(root, path)?;
    Ok(DirListing {
        path: listing.path,
        parent: listing.parent,
        home: listing.home,
        root: listing.root,
        entries: listing
            .entries
            .into_iter()
            .map(|e| BrowseEntry {
                name: e.name,
                path: e.path,
                is_dir: e.is_dir,
                size: e.size,
                modified: e.modified,
                items: e.items,
            })
            .collect(),
    })
}

/// 编辑索引；带 `content` 时连正文一起写（一次提交改两半）。不能换宿主。
pub fn update(store: &Store, id: &str, input: &DocumentInput) -> Result<Document> {
    repo::update(store, id, input)
}

/// 删除索引与正文文件。
pub fn delete(store: &Store, id: &str) -> Result<()> {
    repo::delete(store, id)
}

/// 清一个宿主的全部文档（删项目 / 删机器之前调）。
pub fn cleanup_by_owner(store: &Store, owner_kind: &str, owner_id: &str) -> Result<()> {
    repo::cleanup_by_owner(store, owner_kind, owner_id)
}

/// 读正文（顺带做一次被动同步：文件被外部改过就把索引更新掉）。
pub fn read(store: &Store, id: &str) -> Result<DocContent> {
    repo::read(store, id)
}

/// 写正文（文件 + 指纹 + 时间）；`name` 给了就顺手把索引里的标题改掉。
pub fn write(store: &Store, id: &str, content: &str, name: Option<&str>) -> Result<Document> {
    repo::write(store, id, content, name)
}
