//! 文档索引的 SQL，以及"库 ↔ 文件"的两处协同：
//! 写入时落盘（`create` / `write`），读取时做**被动同步**（`read` 比对内容指纹）。
//!
//! 同步方向：**文件是正文的源**。库里 `content_hash` 与文件对不上 = 这份正文在外部编辑器
//! 被改过 ⇒ 就地更新索引里的指纹与时间，并回 `changed = true` 让界面提一句。
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;
use crate::server::project::doc::file;
use crate::server::project::doc::model::{
    DocContent, DocLinkInput, Document, DocumentInput, DocumentLink,
};
use crate::server::store::Store;

const KINDS: &[&str] = &["plan", "design", "api", "test", "spec", "research", "ref"];
const SOURCES: &[&str] = &["local_md", "tencent_doc", "yuque", "git"];
const LINK_KINDS: &[&str] = &["out", "risk", "meet", "bind", "ref"];
const LINK_TARGETS: &[&str] = &["task", "doc", "bug", "meeting"];

const COLS: &str = "id, project_id, name, module, func, kind, source, file_path, content_hash, \
                    synced_at, summary, author_id, updated_at, sort_order";

const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn row_to_document(row: &Row<'_>) -> rusqlite::Result<Document> {
    Ok(Document {
        id: row.get(0)?,
        project_id: row.get(1)?,
        name: row.get(2)?,
        module: row.get(3)?,
        func: row.get(4)?,
        kind: row.get(5)?,
        source: row.get(6)?,
        file_path: row.get(7)?,
        content_hash: row.get(8)?,
        synced_at: row.get(9)?,
        summary: row.get(10)?,
        author_id: row.get(11)?,
        author: String::new(),
        updated_at: row.get(12)?,
        sort_order: row.get(13)?,
        links: Vec::new(),
        back: Vec::new(),
    })
}

/// 一个项目的文档，按模块 / 功能 / 登记顺序。
pub fn list(conn: &Connection, project_id: &str) -> Result<Vec<Document>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM project_document WHERE project_id = ?1 \
         ORDER BY sort_order, module, func, name"
    ))?;
    let mut rows = stmt
        .query_map([project_id], row_to_document)?
        .collect::<rusqlite::Result<Vec<Document>>>()?;
    drop(stmt);
    for doc in &mut rows {
        hydrate_links(conn, doc)?;
    }
    Ok(rows)
}

pub fn get(conn: &Connection, id: &str) -> Result<Document> {
    let mut doc = conn
        .query_row(&format!("SELECT {COLS} FROM project_document WHERE id = ?1"), [id], row_to_document)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("文档 {id}")))?;
    hydrate_links(conn, &mut doc)?;
    Ok(doc)
}

/// 新建。`local_md` 的先落文件、再登记索引 —— 文件成功才进库；
/// 库插失败最多留一个孤儿文件（下次重建索引时能收回来），比"索引指向不存在的文件"轻。
pub fn create(store: &Store, input: &DocumentInput) -> Result<Document> {
    validate(input)?;
    let root = store.documents_root();
    if input.source != "local_md" && input.content.is_some() {
        return Err(Error::Invalid("只有本地正文（local_md）能带正文".into()));
    }

    let id = new_id("dc");
    let mut file_path: Option<String> = None;
    let mut hash: Option<String> = None;
    if input.source == "local_md" {
        let content = input.content.clone().unwrap_or_default();
        let rel = file::unique_path(root, &input.project_id, &input.name);
        file::write(root, &rel, &content)?;
        hash = Some(file::content_hash(&content));
        file_path = Some(rel);
    }

    let conn = store.conn()?;
    let tx = conn.unchecked_transaction()?;
    tx.execute(
        &format!(
            "INSERT INTO project_document
               (id, project_id, name, module, func, kind, source, file_path, content_hash,
                synced_at, summary, author_id, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9,
                     CASE WHEN ?8 IS NULL THEN NULL ELSE {NOW} END,
                     ?10, 'me', {NOW}, COALESCE(?11, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM project_document WHERE project_id = ?2)))"
        ),
        params![
            id,
            input.project_id,
            input.name,
            input.module,
            input.func,
            input.kind,
            input.source,
            file_path,
            hash,
            input.summary,
            input.sort_order,
        ],
    )?;
    write_links(&tx, &id, &input.links)?;
    tx.commit()?;
    get(&conn, &id)
}

/// 编辑索引。带 `content` 且是本地正文时，顺带把文件也写一遍（正文与索引同一次提交）。
pub fn update(store: &Store, id: &str, input: &DocumentInput) -> Result<Document> {
    validate(input)?;
    let root = store.documents_root();
    let conn = store.conn()?;
    let existing = get(&conn, id)?;

    /* 正文坐标不在这里改：换素（source）要连带换落点，那是另一件事 —— 现在只拦下来 */
    let keeps_file = input.source == "local_md";
    if keeps_file && existing.file_path.is_none() {
        return Err(Error::Invalid("这份索引没有本地正文，不能直接改成本地正文（新建一份）".into()));
    }
    if !keeps_file && existing.file_path.is_some() {
        return Err(Error::Invalid("本地正文不能改成外部登记（正文文件还在）".into()));
    }

    let mut hash = existing.content_hash.clone();
    if keeps_file {
        if let Some(content) = &input.content {
            let rel = existing.file_path.clone().unwrap_or_default();
            file::write(root, &rel, content)?;
            hash = Some(file::content_hash(content));
        }
    }

    let tx = conn.unchecked_transaction()?;
    tx.execute(
        &format!(
            "UPDATE project_document SET
               name = ?2, module = ?3, func = ?4, kind = ?5, summary = ?6,
               content_hash = ?7,
               synced_at = CASE WHEN ?7 IS NULL THEN synced_at ELSE {NOW} END,
               sort_order = COALESCE(?8, sort_order),
               updated_at = {NOW}
             WHERE id = ?1"
        ),
        params![id, input.name, input.module, input.func, input.kind, input.summary, hash, input.sort_order],
    )?;
    write_links(&tx, id, &input.links)?;
    tx.commit()?;
    get(&conn, id)
}

/// 删除：索引与正文文件一起走（本地正文的那份文件由这里删掉）。
pub fn delete(store: &Store, id: &str) -> Result<()> {
    let root = store.documents_root();
    let conn = store.conn()?;
    let existing = get(&conn, id)?;
    if let Some(rel) = &existing.file_path {
        file::remove(root, rel)?;
    }
    conn.execute("DELETE FROM project_document WHERE id = ?1", [id])?;
    Ok(())
}

/// 读正文 —— **被动同步**发生在这里：指纹对不上就就地更新索引，并回 `changed = true`。
pub fn read(store: &Store, id: &str) -> Result<DocContent> {
    let root = store.documents_root();
    let conn = store.conn()?;
    let doc = get(&conn, id)?;
    let rel = doc
        .file_path
        .clone()
        .ok_or_else(|| Error::Invalid(format!("「{}」没有本地正文，只有外部索引", doc.name)))?;

    let content = file::read(root, &rel)?;
    let hash = file::content_hash(&content);
    let changed = doc.content_hash.as_deref() != Some(hash.as_str());
    if changed {
        conn.execute(
            &format!(
                "UPDATE project_document SET content_hash = ?2, synced_at = {NOW}, updated_at = {NOW} WHERE id = ?1"
            ),
            params![id, hash],
        )?;
    }
    let synced_at: String = conn
        .query_row("SELECT COALESCE(synced_at, '') FROM project_document WHERE id = ?1", [id], |row| row.get(0))?;
    Ok(DocContent { content, hash, synced_at, changed })
}

/// 写正文：文件 + 指纹 + 时间一次更新；`name` 给了就连索引里的标题一起改
/// （编辑器里能改标题，改完不落库就等于静默丢改动）。
pub fn write(store: &Store, id: &str, content: &str, name: Option<&str>) -> Result<Document> {
    let root = store.documents_root();
    let conn = store.conn()?;
    let doc = get(&conn, id)?;
    let rel = doc
        .file_path
        .clone()
        .ok_or_else(|| Error::Invalid(format!("「{}」没有本地正文，只有外部索引", doc.name)))?;

    file::write(root, &rel, content)?;
    let hash = file::content_hash(content);
    let trimmed = name.map(str::trim).filter(|n| !n.is_empty());
    conn.execute(
        &format!(
            "UPDATE project_document SET content_hash = ?2, synced_at = {NOW}, updated_at = {NOW},
               name = COALESCE(?3, name)
             WHERE id = ?1"
        ),
        params![id, hash, trimmed],
    )?;
    get(&conn, id)
}

/* ============================================================
   内部
   ============================================================ */

/// 出边 + 反链，两边的目标名与读数各自补上（`to_kind` 决定查哪张表）。
fn hydrate_links(conn: &Connection, doc: &mut Document) -> Result<()> {
    doc.author = match &doc.author_id {
        Some(id) => conn
            .query_row("SELECT display_name FROM app_user WHERE id = ?1", [id], |row| row.get(0))
            .optional()?
            .unwrap_or_default(),
        None => String::new(),
    };
    doc.links = read_links(
        conn,
        "SELECT kind, to_kind, to_id FROM project_document_link WHERE from_doc_id = ?1",
        &doc.id,
    )?;
    doc.back = read_links(
        conn,
        "SELECT kind, to_kind, from_doc_id FROM project_document_link WHERE to_kind = 'doc' AND to_id = ?1",
        &doc.id,
    )?;
    Ok(())
}

fn read_links(conn: &Connection, sql: &str, id: &str) -> Result<Vec<DocumentLink>> {
    let mut stmt = conn.prepare(sql)?;
    let mut rows = stmt
        .query_map([id], |row| {
            Ok(DocumentLink {
                kind: row.get(0)?,
                to_kind: row.get(1)?,
                to_id: row.get(2)?,
                name: String::new(),
                meta: String::new(),
            })
        })?
        .collect::<rusqlite::Result<Vec<DocumentLink>>>()?;
    drop(stmt);
    for link in &mut rows {
        let (name, meta) = target_ref(conn, &link.to_kind, &link.to_id)?;
        link.name = name;
        link.meta = meta;
    }
    Ok(rows)
}

/// 目标的（标题，读数）。读数是**原始码/值**：文档给种类、任务给状态、会议给开始时刻 ——
/// 换成人话是展示层的事（前端各有一张标签表）。`bug` 还没落表 ⇒ 两者都空。
fn target_ref(conn: &Connection, to_kind: &str, to_id: &str) -> Result<(String, String)> {
    let sql = match to_kind {
        "doc" => "SELECT name, kind FROM project_document WHERE id = ?1",
        "task" => "SELECT title, state FROM task WHERE id = ?1",
        "meeting" => "SELECT title, starts_at FROM work_meeting WHERE id = ?1",
        _ => return Ok((String::new(), String::new())),
    };
    Ok(conn
        .query_row(sql, [to_id], |row| Ok((row.get(0)?, row.get(1)?)))
        .optional()?
        .unwrap_or_default())
}

fn write_links(tx: &Transaction<'_>, doc_id: &str, links: &[DocLinkInput]) -> Result<()> {
    tx.execute("DELETE FROM project_document_link WHERE from_doc_id = ?1", [doc_id])?;
    for link in links {
        tx.execute(
            "INSERT OR IGNORE INTO project_document_link (from_doc_id, kind, to_kind, to_id)
             VALUES (?1, ?2, ?3, ?4)",
            params![doc_id, link.kind, link.to_kind, link.to_id],
        )?;
    }
    Ok(())
}

fn check_enum(what: &str, value: &str, allowed: &[&str]) -> Result<()> {
    if allowed.contains(&value) {
        return Ok(());
    }
    Err(Error::Invalid(format!("{what}的取值不对：{value}")))
}

/// 与 DDL 的 CHECK 同一批规则（含 `local_md ⇒ file_path` 那条跨列约束）。
fn validate(input: &DocumentInput) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(Error::Invalid("文档名不能为空".into()));
    }
    check_enum("文档种类", &input.kind, KINDS)?;
    check_enum("来源", &input.source, SOURCES)?;
    for link in &input.links {
        check_enum("关联类型", &link.kind, LINK_KINDS)?;
        check_enum("关联目标族", &link.to_kind, LINK_TARGETS)?;
        if link.to_id.trim().is_empty() {
            return Err(Error::Invalid("关联的目标不能为空".into()));
        }
    }
    Ok(())
}
