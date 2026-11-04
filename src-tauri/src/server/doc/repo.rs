//! 文档索引的 SQL，以及"库 ↔ 文件"的两处协同：
//! 写入时落盘（`create` / `write`），读取时做**被动同步**（`read` 比对内容指纹）。
//!
//! 宿主是多态的（`owner_kind` + `owner_id`）：SQLite 不能按行切换外键，
//! 所以宿主的一致性靠写入路径校验，删除宿主时的清理由 `cleanup_by_owner` 完成。
//!
//! 同步方向：**文件是正文的源**。库里 `content_hash` 与文件对不上 = 这份正文在外部编辑器
//! 被改过 ⇒ 就地更新索引里的指纹与时间，并回 `changed = true` 让界面提一句。
use rusqlite::{params, Connection, OptionalExtension, Row, Transaction};

use crate::server::doc::file;
use crate::server::doc::model::{DocContent, DocLinkInput, Document, DocumentInput, DocumentLink};
use crate::server::error::{Error, Result};
use crate::server::id::new_id;
use crate::server::store::Store;

/// 宿主类型：项目 / 服务器 / 工作模块的文档索引 / 学习笔记（都是模块级容器）。
const OWNER_KINDS: &[&str] = &["project", "server", "work", "note"];

/// 词表随宿主不同：项目文档 / 笔记 7 值，服务器上的部署文档 3 值。
/// 因为一张表装三种词表，`kind` 列不写 CHECK（写了就只能取并集、失去按宿主的约束），
/// 由这里校验 —— 与 DDL 的 CHECK 是同一批规则的两次书写。
const PROJECT_KINDS: &[&str] = &["plan", "design", "api", "test", "spec", "research", "ref"];
const SERVER_KINDS: &[&str] = &["manual", "process", "script"];

const SOURCES: &[&str] = &[
    "local_md",
    "tencent_doc",
    "yuque",
    "git",
    "company_wiki",
    "deploy",
    "external",
    "meeting",
];
const LINK_KINDS: &[&str] = &["out", "risk", "meet", "bind", "ref"];
const LINK_TARGETS: &[&str] = &["task", "doc", "bug", "meeting"];

const COLS: &str = "id, owner_kind, owner_id, project_id, name, module, func, kind, source, \
                    version, file_path, content_hash, synced_at, summary, author_id, \
                    updated_at, sort_order";

const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn row_to_document(row: &Row<'_>) -> rusqlite::Result<Document> {
    Ok(Document {
        id: row.get(0)?,
        owner_kind: row.get(1)?,
        owner_id: row.get(2)?,
        project_id: row.get(3)?,
        name: row.get(4)?,
        module: row.get(5)?,
        func: row.get(6)?,
        kind: row.get(7)?,
        source: row.get(8)?,
        version: row.get(9)?,
        file_path: row.get(10)?,
        content_hash: row.get(11)?,
        synced_at: row.get(12)?,
        summary: row.get(13)?,
        author_id: row.get(14)?,
        author: String::new(),
        updated_at: row.get(15)?,
        sort_order: row.get(16)?,
        links: Vec::new(),
        back: Vec::new(),
    })
}

/// 文档列表。三个过滤都可选：`owner`（某宿主下的）、`project_id`（某项目名下的，含挂在
/// 机器上的部署文档）、`kind`（某一类）。都不给就是全部（将来的全局文档库）。
pub fn list(
    conn: &Connection,
    owner_kind: Option<&str>,
    owner_id: Option<&str>,
    project_id: Option<&str>,
    kind: Option<&str>,
) -> Result<Vec<Document>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {COLS} FROM doc
         WHERE (?1 IS NULL OR owner_kind = ?1)
           AND (?2 IS NULL OR owner_id = ?2)
           AND (?3 IS NULL OR project_id = ?3)
           AND (?4 IS NULL OR kind = ?4)
         ORDER BY sort_order, module, func, name"
    ))?;
    let mut rows = stmt
        .query_map(params![owner_kind, owner_id, project_id, kind], row_to_document)?
        .collect::<rusqlite::Result<Vec<Document>>>()?;
    drop(stmt);
    for doc in &mut rows {
        hydrate_links(conn, doc)?;
    }
    Ok(rows)
}

pub fn get(conn: &Connection, id: &str) -> Result<Document> {
    let mut doc = conn
        .query_row(&format!("SELECT {COLS} FROM doc WHERE id = ?1"), [id], row_to_document)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("文档 {id}")))?;
    hydrate_links(conn, &mut doc)?;
    Ok(doc)
}

/// 新建。`local_md` 的先落文件、再登记索引 —— 文件成功才进库；
/// 库插失败最多留一个孤儿文件（能收回来），比"索引指向不存在的文件"轻。
fn bound_file(conn: &Connection, input: &DocumentInput) -> Result<Option<String>> {
    let Some(raw) = input.file.as_deref().map(str::trim).filter(|s| !s.is_empty()) else {
        return Ok(None);
    };
    let path = std::path::Path::new(raw);
    if !path.is_absolute() {
        return Err(Error::Invalid("绑定本机文件要给绝对路径".into()));
    }
    let lower = raw.to_lowercase();
    if !(lower.ends_with(".md") || lower.ends_with(".markdown")) {
        return Err(Error::Invalid("只能绑定 Markdown 文件".into()));
    }
    if !path.is_file() {
        return Err(Error::NotFound(format!("文件 {raw}")));
    }
    let taken: Option<String> = conn
        .query_row("SELECT id FROM doc WHERE file_path = ?1", [raw], |row| row.get(0))
        .optional()?;
    if taken.is_some() {
        return Err(Error::Invalid(format!("这个文件已经挂在别的文档下：{raw}")));
    }
    Ok(Some(raw.to_string()))
}

pub fn create(store: &Store, input: &DocumentInput) -> Result<Document> {
    validate(input)?;
    let root = store.documents_root();
    if input.source != "local_md" && input.content.is_some() {
        return Err(Error::Invalid("只有本地正文（local_md）能带正文".into()));
    }

    let id = new_id("dc");
    let conn = store.conn()?;
    let mut file_path: Option<String> = None;
    let mut hash: Option<String> = None;
    if input.source == "local_md" {
        if let Some(abs) = bound_file(&conn, input)? {
            /* 绑定本机已有的文件：正文就是它，不另建、不覆盖 */
            let content = file::read(root, &abs)?;
            hash = Some(file::content_hash(&content));
            file_path = Some(abs);
        } else {
            let content = input.content.clone().unwrap_or_default();
            /* 落点：给了 `dir` 就落在那个目录里（可以相对文档根，也可以是选择器里挑的绝对路径），
               没给就按宿主分目录 */
            let dir = match input.dir.as_deref() {
                Some(raw) if !raw.trim().is_empty() => raw.to_string(),
                _ => format!("{}/{}", input.owner_kind, input.owner_id),
            };
            let dest = file::dest_for(root, &dir, &input.name)?;
            file::write(root, &dest, &content)?;
            hash = Some(file::content_hash(&content));
            file_path = Some(dest);
        }
    }

    let tx = conn.unchecked_transaction()?;
    tx.execute(
        &format!(
            "INSERT INTO doc
               (id, owner_kind, owner_id, project_id, name, module, func, kind, source, version,
                file_path, content_hash, synced_at, summary, author_id, updated_at, sort_order)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                     ?11, ?12,
                     CASE WHEN ?11 IS NULL THEN NULL ELSE {NOW} END,
                     ?13, 'me', {NOW},
                     COALESCE(?14, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM doc
                                    WHERE owner_kind = ?2 AND owner_id = ?3)))"
        ),
        params![
            id,
            input.owner_kind,
            input.owner_id,
            input.project_id,
            input.name,
            input.module,
            input.func,
            input.kind,
            input.source,
            input.version,
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

    /* 宿主与正文坐标都不在这里改：换宿主 / 换落点要连带挪文件，那是另一件事 —— 现在只拦下来 */
    if existing.owner_kind != input.owner_kind || existing.owner_id != input.owner_id {
        return Err(Error::Invalid("文档不能换宿主（那要连带挪正文文件，请新建一份）".into()));
    }
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
            "UPDATE doc SET
               project_id = ?2, name = ?3, module = ?4, func = ?5, kind = ?6, version = ?7,
               summary = ?8, content_hash = ?9,
               synced_at = CASE WHEN ?9 IS NULL THEN synced_at ELSE {NOW} END,
               sort_order = COALESCE(?10, sort_order), updated_at = {NOW}
             WHERE id = ?1"
        ),
        params![
            id,
            input.project_id,
            input.name,
            input.module,
            input.func,
            input.kind,
            input.version,
            input.summary,
            hash,
            input.sort_order,
        ],
    )?;
    write_links(&tx, id, &input.links)?;
    tx.commit()?;
    get(&conn, id)
}

/// 删除：索引与正文文件一起走。
pub fn delete(store: &Store, id: &str) -> Result<()> {
    let root = store.documents_root();
    let conn = store.conn()?;
    let existing = get(&conn, id)?;
    if let Some(rel) = &existing.file_path {
        file::remove(root, rel)?;
    }
    conn.execute("DELETE FROM doc WHERE id = ?1", [id])?;
    Ok(())
}

/// 清掉一个宿主的全部文档（删项目 / 删机器之前调）。
/// **文件先于索引走**：反过来失败时留下的是看不见的孤儿；这一边失败能看见
/// —— `read` 会说"正文不存在"，用户可以重写。
pub fn cleanup_by_owner(store: &Store, owner_kind: &str, owner_id: &str) -> Result<()> {
    let root = store.documents_root();
    let conn = store.conn()?;
    let mut stmt = conn.prepare(
        "SELECT id, file_path FROM doc WHERE owner_kind = ?1 AND owner_id = ?2",
    )?;
    let rows = stmt
        .query_map([owner_kind, owner_id], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, Option<String>>(1)?))
        })?
        .collect::<rusqlite::Result<Vec<(String, Option<String>)>>>()?;
    drop(stmt);
    for (_, path) in &rows {
        if let Some(rel) = path {
            file::remove(root, rel)?;
        }
    }
    conn.execute("DELETE FROM doc WHERE owner_kind = ?1 AND owner_id = ?2", [owner_kind, owner_id])?;
    file::remove_host_dir(root, owner_kind, owner_id)
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
                "UPDATE doc SET content_hash = ?2, synced_at = {NOW}, updated_at = {NOW} WHERE id = ?1"
            ),
            params![id, hash],
        )?;
    }
    let synced_at: String = conn
        .query_row("SELECT COALESCE(synced_at, '') FROM doc WHERE id = ?1", [id], |row| row.get(0))?;
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
            "UPDATE doc SET content_hash = ?2, synced_at = {NOW}, updated_at = {NOW},
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
        "SELECT kind, to_kind, to_id FROM doc_link WHERE from_doc_id = ?1",
        &doc.id,
    )?;
    doc.back = read_links(
        conn,
        "SELECT kind, to_kind, from_doc_id FROM doc_link WHERE to_kind = 'doc' AND to_id = ?1",
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
        "doc" => "SELECT name, kind FROM doc WHERE id = ?1",
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
    tx.execute("DELETE FROM doc_link WHERE from_doc_id = ?1", [doc_id])?;
    for link in links {
        tx.execute(
            "INSERT OR IGNORE INTO doc_link (from_doc_id, kind, to_kind, to_id) VALUES (?1, ?2, ?3, ?4)",
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

/// 宿主的词表。项目与笔记同一套 7 值，服务器是部署文档那 3 值。
fn kinds_of(owner_kind: &str) -> &'static [&'static str] {
    match owner_kind {
        "server" => SERVER_KINDS,
        _ => PROJECT_KINDS,
    }
}

/// 与 DDL 的 CHECK 同一批规则（含 `local_md ⇒ file_path` 那条跨列约束）。
fn validate(input: &DocumentInput) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(Error::Invalid("文档名不能为空".into()));
    }
    check_enum("宿主类型", &input.owner_kind, OWNER_KINDS)?;
    if input.owner_id.trim().is_empty() {
        return Err(Error::Invalid("宿主 id 不能为空".into()));
    }
    check_enum("文档种类", &input.kind, kinds_of(&input.owner_kind))?;
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::server::store::Store;
    use std::fs;
    use std::path::PathBuf;

    /// 一次性 Store：临时库里跑迁移（`'me'` 由种子写入），文档根也落在同一个临时目录。
    fn temp_store(tag: &str) -> (Store, PathBuf) {
        let base = std::env::temp_dir().join(format!("lucky-doc-repo-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        let store = Store::open(base.join("test.db"), base.join("documents")).unwrap();
        (store, base)
    }

    fn input(dir: Option<&str>) -> DocumentInput {
        DocumentInput {
            owner_kind: "project".into(),
            owner_id: "pj-1".into(),
            project_id: None,
            name: "登录 鉴权".into(),
            module: String::new(),
            func: String::new(),
            kind: "plan".into(),
            source: "local_md".into(),
            dir: dir.map(str::to_string),
            file: None,
            version: String::new(),
            summary: String::new(),
            links: Vec::new(),
            content: Some("# 登录鉴权".into()),
            sort_order: None,
        }
    }

    #[test]
    fn create_lands_in_given_dir() {
        let (store, base) = temp_store("dir");
        let doc = create(&store, &input(Some("project/pj-1/技术方案"))).unwrap();
        assert_eq!(doc.file_path.as_deref(), Some("project/pj-1/技术方案/登录-鉴权.md"));
        assert!(base.join("documents/project/pj-1/技术方案/登录-鉴权.md").exists());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn create_without_dir_falls_back_to_host_dir() {
        let (store, base) = temp_store("default");
        let doc = create(&store, &input(None)).unwrap();
        assert_eq!(doc.file_path.as_deref(), Some("project/pj-1/登录-鉴权.md"));
        assert!(base.join("documents/project/pj-1/登录-鉴权.md").exists());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn create_rejects_escaping_dir() {
        let (store, base) = temp_store("escape");
        assert!(create(&store, &input(Some("../外面"))).is_err());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn create_can_land_outside_root() {
        let (store, base) = temp_store("outside");
        let out = base.join("仓库文档");
        fs::create_dir_all(&out).unwrap();
        let doc = create(&store, &input(Some(out.to_str().unwrap()))).unwrap();
        let expected = out.join("登录-鉴权.md");
        assert_eq!(doc.file_path.as_deref(), Some(expected.to_str().unwrap()));
        assert!(expected.exists());
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn create_binds_existing_file_without_copying() {
        let (store, base) = temp_store("bind");
        let src = base.join("readme.md");
        fs::write(&src, "# 原来的正文").unwrap();

        let mut bound = input(None);
        bound.file = Some(src.to_str().unwrap().to_string());
        let doc = create(&store, &bound).unwrap();
        assert_eq!(doc.file_path.as_deref(), Some(src.to_str().unwrap()));
        /* 不搬、不复制：文档根里不该多出同一份 */
        assert!(!base.join("documents/project/pj-1/登录-鉴权.md").exists());

        /* 同一份文件不能挂两篇 */
        let again = create(&store, &bound);
        assert!(again.is_err());

        /* 绑定 = 改的就是原文件 */
        write(&store, &doc.id, "# 改过", None).unwrap();
        assert_eq!(fs::read_to_string(&src).unwrap(), "# 改过");

        /* 删文档只解绑，原文件留着 */
        delete(&store, &doc.id).unwrap();
        assert!(src.exists(), "绑定的文件不属于应用，删文档不能把它带走");
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn bind_rejects_missing_or_non_markdown() {
        let (store, base) = temp_store("bind-bad");
        let jar = base.join("pay.jar");
        fs::write(&jar, "x").unwrap();
        let mut bad = input(None);
        bad.file = Some(jar.to_str().unwrap().to_string());
        assert!(create(&store, &bad).is_err(), "非 Markdown 不收");

        let mut missing = input(None);
        missing.file = Some(base.join("没有这个.md").to_str().unwrap().to_string());
        assert!(create(&store, &missing).is_err());

        let mut relative = input(None);
        relative.file = Some("readme.md".into());
        assert!(create(&store, &relative).is_err(), "绑定必须是绝对路径");
        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn deploy_doc_lands_under_the_machine_and_lists_by_project() {
        let (store, base) = temp_store("deploy");

        /* doc.project_id 有外键 —— 先立一个项目，模拟"库里真有这个项目" */
        {
            let conn = store.conn().unwrap();
            conn.execute(
                "INSERT INTO project (id, owner_id, scope, name, status, priority, start_date,
                                      due_date, visibility, created_at, updated_at)
                 VALUES ('pj-1', 'me', 'work', '智慧供应链', 'active', 'high',
                         '2026-01-01', '2026-12-31', 'work_internal', '2026-01-01', '2026-01-01')",
                [],
            )
            .unwrap();
        }

        /* 「新建部署文档」那一档的入参：宿主是机器、宿主类型 server、kind 三选一 */
        let mut deploy = input(None);
        deploy.owner_kind = "server".into();
        deploy.owner_id = "CSCM内网".into();
        deploy.project_id = Some("pj-1".into());
        deploy.kind = "manual".into();
        deploy.name = "发版流程".into();
        deploy.content = Some("# 发版流程\n\n## 步骤\n\n1. \n".into());

        let doc = create(&store, &deploy).unwrap();
        assert_eq!(doc.file_path.as_deref(), Some("server/CSCM内网/发版流程.md"));
        assert!(base.join("documents/server/CSCM内网/发版流程.md").exists());

        /* 书架按项目查：`doc_list(ownerKind='server', projectId)` 要能看见它 */
        let conn = store.conn().unwrap();
        let rows = list(&conn, Some("server"), None, Some("pj-1"), None).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].id, doc.id);
        drop(conn);

        /* 建完直接进编辑面 —— 正文读得回来，改得动 */
        let content = read(&store, &doc.id).unwrap();
        assert!(content.content.contains("## 步骤"));
        write(&store, &doc.id, "# 发版流程\n\n## 步骤\n\n1. 停流量\n", None).unwrap();
        assert_eq!(
            fs::read_to_string(base.join("documents/server/CSCM内网/发版流程.md")).unwrap(),
            "# 发版流程\n\n## 步骤\n\n1. 停流量\n"
        );

        let _ = fs::remove_dir_all(&base);
    }

    #[test]
    fn deploy_doc_rejects_a_project_kind() {
        let (store, base) = temp_store("deploy-kind");
        let mut bad = input(None);
        bad.owner_kind = "server".into();
        bad.owner_id = "web-01".into();
        bad.kind = "plan".into();
        assert!(create(&store, &bad).is_err(), "机器上只收手册 / 流程 / 脚本");
        let _ = fs::remove_dir_all(&base);
    }
}
