/**
 * 知识库 hooks。
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createNote,
  createTag,
  deleteNote,
  deleteTag,
  fetchNotes,
  fetchTags,
  knowledgeKeys,
  setNoteTags,
  toggleFavorite,
  updateNote,
  type KnowledgeNoteInput,
  type KnowledgeTagInput,
  type NoteFilter,
} from '../api/knowledge'
import { toast } from '../stores/toast-store'

const DEFAULT_FILTER: NoteFilter = { status: 'published', favorited: null, tagId: null }

export function useNotes(filter: NoteFilter = DEFAULT_FILTER) {
  return useQuery({
    queryKey: knowledgeKeys.notes(filter),
    queryFn: () => fetchNotes(filter),
  })
}

export function useTags(isTopic: boolean | null = null) {
  return useQuery({
    queryKey: knowledgeKeys.tags(isTopic),
    queryFn: () => fetchTags(isTopic),
  })
}

export function useNoteActions() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: knowledgeKeys.all })
  return {
    create: useMutation({
      mutationFn: (input: KnowledgeNoteInput) => createNote(input),
      onSuccess: () => { invalidate(); toast('已添加笔记') },
      onError: (e: Error) => toast(`添加失败：${e.message}`),
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: KnowledgeNoteInput }) => updateNote(id, input),
      onSuccess: () => { invalidate(); toast('已保存') },
      onError: (e: Error) => toast(`保存失败：${e.message}`),
    }),
    toggleFav: useMutation({
      mutationFn: (id: string) => toggleFavorite(id),
      onSuccess: () => invalidate(),
      onError: (e: Error) => toast(`操作失败：${e.message}`),
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteNote(id),
      onSuccess: () => { invalidate(); toast('已删除笔记') },
      onError: (e: Error) => toast(`删除失败：${e.message}`),
    }),
    setTags: useMutation({
      mutationFn: ({ noteId, tagIds }: { noteId: string; tagIds: string[] }) => setNoteTags(noteId, tagIds),
      onSuccess: () => invalidate(),
      onError: (e: Error) => toast(`标签更新失败：${e.message}`),
    }),
    createTag: useMutation({
      mutationFn: (input: KnowledgeTagInput) => createTag(input),
      onSuccess: () => { invalidate(); toast('已添加标签') },
      onError: (e: Error) => toast(`添加失败：${e.message}`),
    }),
    deleteTag: useMutation({
      mutationFn: (id: string) => deleteTag(id),
      onSuccess: () => { invalidate(); toast('已删除标签') },
      onError: (e: Error) => toast(`删除失败：${e.message}`),
    }),
  }
}
