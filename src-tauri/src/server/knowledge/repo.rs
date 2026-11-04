//! 知识库数据库操作。
use rusqlite::{params, Connection, OptionalExtension, Row};

use crate::server::error::{Error, Result};
use crate::server::id::new_id;

use super::model::{KnowledgeNote, KnowledgeNoteInput, KnowledgeTag, KnowledgeTagInput, NoteFilter};

const NOTE_COLS: &str = "id, title, content, excerpt, status, favorited, owner_id, sort_order, \
                        created_at, updated_at";
const TAG_COLS: &str = "id, name, is_topic, color, sort_order, created_at";
const NOW: &str = "strftime('%Y-%m-%dT%H:%M:%SZ','now')";

fn row_to_note(row: &Row<'_>) -> rusqlite::Result<KnowledgeNote> {
    Ok(KnowledgeNote {
        id: row.get(0)?,
        title: row.get(1)?,
        content: row.get(2)?,
        excerpt: row.get(3)?,
        status: row.get(4)?,
        favorited: row.get::<_, i64>(5)? != 0,
        owner_id: row.get(6)?,
        sort_order: row.get(7)?,
        created_at: row.get(8)?,
        updated_at: row.get(9)?,
        tags: Vec::new(),
    })
}

fn row_to_tag(row: &Row<'_>) -> rusqlite::Result<KnowledgeTag> {
    Ok(KnowledgeTag {
        id: row.get(0)?,
        name: row.get(1)?,
        is_topic: row.get::<_, i64>(2)? != 0,
        color: row.get(3)?,
        sort_order: row.get(4)?,
        created_at: row.get(5)?,
    })
}

/// 按 filter 组合查笔记；每条笔记的 tags 在这里 hydrate。
pub fn list_notes(conn: &Connection, filter: &NoteFilter) -> Result<Vec<KnowledgeNote>> {
    let mut sql = format!("SELECT {NOTE_COLS} FROM knowledge_note");
    let mut clauses: Vec<&str> = Vec::new();
    let mut args: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
    if let Some(status) = &filter.status {
        clauses.push("status = ?");
        args.push(Box::new(status.clone()));
    }
    if let Some(fav) = filter.favorited {
        clauses.push("favorited = ?");
        args.push(Box::new(fav as i64));
    }
    if let Some(tag_id) = &filter.tag_id {
        clauses.push("id IN (SELECT note_id FROM knowledge_note_tag WHERE tag_id = ?)");
        args.push(Box::new(tag_id.clone()));
    }
    if !clauses.is_empty() {
        sql.push_str(" WHERE ");
        sql.push_str(&clauses.join(" AND "));
    }
    sql.push_str(" ORDER BY sort_order, updated_at DESC");
    let mut stmt = conn.prepare(&sql)?;
    let mut rows = stmt
        .query_map(rusqlite::params_from_iter(args.iter()), row_to_note)?
        .collect::<rusqlite::Result<Vec<KnowledgeNote>>>()?;
    drop(stmt);
    for note in &mut rows {
        hydrate_note_tags(conn, note)?;
    }
    Ok(rows)
}

pub fn create_note(conn: &mut Connection, input: &KnowledgeNoteInput) -> Result<KnowledgeNote> {
    validate_note(input)?;
    let id = new_id("note");
    conn.execute(
        &format!(
            "INSERT INTO knowledge_note
               (id, title, content, excerpt, status, favorited, owner_id, sort_order,
                created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM knowledge_note),
                     {NOW}, {NOW})"
        ),
        params![
            id,
            input.title,
            input.content,
            input.excerpt,
            input.status,
            input.favorited as i64,
            input.owner_id,
        ],
    )?;
    get_note(conn, &id)
}

pub fn update_note(conn: &mut Connection, id: &str, input: &KnowledgeNoteInput) -> Result<KnowledgeNote> {
    validate_note(input)?;
    let n = conn.execute(
        &format!(
            "UPDATE knowledge_note SET
               title = ?2, content = ?3, excerpt = ?4, status = ?5, favorited = ?6,
               owner_id = ?7, updated_at = {NOW}
             WHERE id = ?1"
        ),
        params![
            id,
            input.title,
            input.content,
            input.excerpt,
            input.status,
            input.favorited as i64,
            input.owner_id,
        ],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("笔记 {id}")));
    }
    get_note(conn, id)
}

/// 翻转收藏位（收藏/取消收藏是同一个动作的两态）。
pub fn toggle_favorite(conn: &mut Connection, id: &str) -> Result<KnowledgeNote> {
    let n = conn.execute(
        &format!(
            "UPDATE knowledge_note SET favorited = CASE WHEN favorited = 0 THEN 1 ELSE 0 END,
             updated_at = {NOW} WHERE id = ?1"
        ),
        [id],
    )?;
    if n == 0 {
        return Err(Error::NotFound(format!("笔记 {id}")));
    }
    get_note(conn, id)
}

pub fn delete_note(conn: &mut Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM knowledge_note WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("笔记 {id}")));
    }
    Ok(())
}

pub fn list_tags(conn: &Connection, is_topic: Option<bool>) -> Result<Vec<KnowledgeTag>> {
    if let Some(t) = is_topic {
        let mut stmt = conn.prepare(&format!(
            "SELECT {TAG_COLS} FROM knowledge_tag WHERE is_topic = ?1 ORDER BY sort_order, name"
        ))?;
        let tags = stmt
            .query_map([t as i64], row_to_tag)?
            .collect::<rusqlite::Result<Vec<KnowledgeTag>>>()?;
        Ok(tags)
    } else {
        let mut stmt = conn.prepare(&format!(
            "SELECT {TAG_COLS} FROM knowledge_tag ORDER BY sort_order, name"
        ))?;
        let tags = stmt
            .query_map([], row_to_tag)?
            .collect::<rusqlite::Result<Vec<KnowledgeTag>>>()?;
        Ok(tags)
    }
}

pub fn create_tag(conn: &mut Connection, input: &KnowledgeTagInput) -> Result<KnowledgeTag> {
    validate_tag(input)?;
    let id = new_id("tag");
    conn.execute(
        &format!(
            "INSERT INTO knowledge_tag (id, name, is_topic, color, sort_order, created_at)
             VALUES (?1, ?2, ?3, ?4,
                     (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM knowledge_tag),
                     {NOW})"
        ),
        params![id, input.name, input.is_topic as i64, input.color],
    )?;
    get_tag(conn, &id)
}

pub fn delete_tag(conn: &mut Connection, id: &str) -> Result<()> {
    let n = conn.execute("DELETE FROM knowledge_tag WHERE id = ?1", [id])?;
    if n == 0 {
        return Err(Error::NotFound(format!("标签 {id}")));
    }
    Ok(())
}

/// 全量替换笔记的标签关联：先清空再逐条插入。
pub fn set_note_tags(conn: &mut Connection, note_id: &str, tag_ids: &[String]) -> Result<()> {
    conn.execute("DELETE FROM knowledge_note_tag WHERE note_id = ?1", [note_id])?;
    for tag_id in tag_ids {
        conn.execute(
            "INSERT OR IGNORE INTO knowledge_note_tag (note_id, tag_id) VALUES (?1, ?2)",
            params![note_id, tag_id],
        )?;
    }
    Ok(())
}

pub fn get_note_tags(conn: &Connection, note_id: &str) -> Result<Vec<KnowledgeTag>> {
    let mut stmt = conn.prepare(&format!(
        "SELECT {TAG_COLS} FROM knowledge_tag t
         WHERE t.id IN (SELECT tag_id FROM knowledge_note_tag WHERE note_id = ?1)
         ORDER BY t.sort_order, t.name"
    ))?;
    let tags = stmt
        .query_map([note_id], row_to_tag)?
        .collect::<rusqlite::Result<Vec<KnowledgeTag>>>()?;
    Ok(tags)
}

fn get_note(conn: &Connection, id: &str) -> Result<KnowledgeNote> {
    let mut note = conn
        .query_row(&format!("SELECT {NOTE_COLS} FROM knowledge_note WHERE id = ?1"), [id], row_to_note)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("笔记 {id}")))?;
    hydrate_note_tags(conn, &mut note)?;
    Ok(note)
}

fn get_tag(conn: &Connection, id: &str) -> Result<KnowledgeTag> {
    conn.query_row(&format!("SELECT {TAG_COLS} FROM knowledge_tag WHERE id = ?1"), [id], row_to_tag)
        .optional()?
        .ok_or_else(|| Error::NotFound(format!("标签 {id}")))
}

fn hydrate_note_tags(conn: &Connection, note: &mut KnowledgeNote) -> Result<()> {
    note.tags = get_note_tags(conn, &note.id)?;
    Ok(())
}

fn validate_note(input: &KnowledgeNoteInput) -> Result<()> {
    if input.title.trim().is_empty() {
        return Err(Error::Invalid("笔记标题不能为空".into()));
    }
    if !["draft", "published", "archived"].contains(&input.status.as_str()) {
        return Err(Error::Invalid(format!("状态取值不对：{}", input.status)));
    }
    Ok(())
}

fn validate_tag(input: &KnowledgeTagInput) -> Result<()> {
    if input.name.trim().is_empty() {
        return Err(Error::Invalid("标签名不能为空".into()));
    }
    Ok(())
}
