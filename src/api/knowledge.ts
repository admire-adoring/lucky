/**
 * 知识库数据访问层。全部走真实后端。
 */
import { invoke } from '@tauri-apps/api/core'
import { call } from './error'

export interface KnowledgeTag {
  id: string
  name: string
  isTopic: boolean
  color: string
  sortOrder: number
  createdAt: string
}

export interface KnowledgeNote {
  id: string
  title: string
  content: string
  excerpt: string
  status: string
  favorited: boolean
  ownerId: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  tags: KnowledgeTag[]
}

export interface KnowledgeNoteInput {
  title: string
  content: string
  excerpt: string
  status: string
  favorited: boolean
  ownerId: string | null
}

export interface KnowledgeTagInput {
  name: string
  isTopic: boolean
  color: string
}

export interface NoteFilter {
  status: string | null
  favorited: boolean | null
  tagId: string | null
}

export const knowledgeKeys = {
  all: ['knowledge'] as const,
  notes: (filter: NoteFilter) => [...knowledgeKeys.all, 'notes', filter] as const,
  tags: (isTopic: boolean | null) => [...knowledgeKeys.all, 'tags', isTopic] as const,
}

export function fetchNotes(filter: NoteFilter): Promise<KnowledgeNote[]> {
  return call(() => invoke<KnowledgeNote[]>('note_list', { filter }))
}

export function createNote(input: KnowledgeNoteInput): Promise<KnowledgeNote> {
  return call(() => invoke<KnowledgeNote>('note_create', { input }))
}

export function updateNote(id: string, input: KnowledgeNoteInput): Promise<KnowledgeNote> {
  return call(() => invoke<KnowledgeNote>('note_update', { id, input }))
}

export function toggleFavorite(id: string): Promise<KnowledgeNote> {
  return call(() => invoke<KnowledgeNote>('note_toggle_favorite', { id }))
}

export function deleteNote(id: string): Promise<void> {
  return call(() => invoke<void>('note_delete', { id }))
}

export function fetchTags(isTopic: boolean | null): Promise<KnowledgeTag[]> {
  return call(() => invoke<KnowledgeTag[]>('tag_list', { isTopic }))
}

export function createTag(input: KnowledgeTagInput): Promise<KnowledgeTag> {
  return call(() => invoke<KnowledgeTag>('tag_create', { input }))
}

export function deleteTag(id: string): Promise<void> {
  return call(() => invoke<void>('tag_delete', { id }))
}

export function setNoteTags(noteId: string, tagIds: string[]): Promise<void> {
  return call(() => invoke<void>('note_set_tags', { noteId, tagIds }))
}

export function getNoteTags(noteId: string): Promise<KnowledgeTag[]> {
  return call(() => invoke<KnowledgeTag[]>('note_get_tags', { noteId }))
}
