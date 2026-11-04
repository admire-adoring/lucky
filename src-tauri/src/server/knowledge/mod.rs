//! 知识库域门面。
mod model;
mod repo;

pub use model::{KnowledgeNote, KnowledgeNoteInput, KnowledgeTag, KnowledgeTagInput, NoteFilter};

use crate::server::error::Result;
use crate::server::store::Store;

pub fn list_notes(store: &Store, filter: &NoteFilter) -> Result<Vec<KnowledgeNote>> {
    let conn = store.conn()?;
    repo::list_notes(&conn, filter)
}

pub fn create_note(store: &Store, input: &KnowledgeNoteInput) -> Result<KnowledgeNote> {
    let mut conn = store.conn()?;
    repo::create_note(&mut conn, input)
}

pub fn update_note(store: &Store, id: &str, input: &KnowledgeNoteInput) -> Result<KnowledgeNote> {
    let mut conn = store.conn()?;
    repo::update_note(&mut conn, id, input)
}

pub fn toggle_favorite(store: &Store, id: &str) -> Result<KnowledgeNote> {
    let mut conn = store.conn()?;
    repo::toggle_favorite(&mut conn, id)
}

pub fn delete_note(store: &Store, id: &str) -> Result<()> {
    let mut conn = store.conn()?;
    repo::delete_note(&mut conn, id)
}

pub fn list_tags(store: &Store, is_topic: Option<bool>) -> Result<Vec<KnowledgeTag>> {
    let conn = store.conn()?;
    repo::list_tags(&conn, is_topic)
}

pub fn create_tag(store: &Store, input: &KnowledgeTagInput) -> Result<KnowledgeTag> {
    let mut conn = store.conn()?;
    repo::create_tag(&mut conn, input)
}

pub fn delete_tag(store: &Store, id: &str) -> Result<()> {
    let mut conn = store.conn()?;
    repo::delete_tag(&mut conn, id)
}

pub fn set_note_tags(store: &Store, note_id: &str, tag_ids: &[String]) -> Result<()> {
    let mut conn = store.conn()?;
    repo::set_note_tags(&mut conn, note_id, tag_ids)
}

pub fn get_note_tags(store: &Store, note_id: &str) -> Result<Vec<KnowledgeTag>> {
    let conn = store.conn()?;
    repo::get_note_tags(&conn, note_id)
}
