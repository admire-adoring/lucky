import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { docKeys, fetchDocContent, fetchDocs, saveDocContent } from '../api/docs'
import type { DocumentItem } from '../types'

/**
 * 一个项目的文档索引。数据来自真实库还是演示池由 `api/docs.ts` 按宿主分派。
 * 形态与 `useProjectServers` 一致：直接给数组，调用方不做 undefined 判断。
 */
export function useDocs(projectId: string | undefined): DocumentItem[] {
  const { data } = useQuery({
    queryKey: docKeys.list(projectId ?? ''),
    queryFn: () => fetchDocs(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  })
  return data ?? []
}

/**
 * 本地正文（原文页读的那一份）。只有带 `filePath` 的文档有 —— 其余读不到，
 * hook 给 `isError`，调用方回落演示稿。`retry: false`：没有就是没有，别反复打。
 */
export function useDocContent(id: string | undefined) {
  return useQuery({
    queryKey: docKeys.content(id ?? ''),
    queryFn: () => fetchDocContent(id as string),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
    retry: false,
  })
}

/**
 * 写回正文。保存后把文档那一族全失效（列表的「多久没更新」与正文一起变）——
 * 与 `useProjectActions` 失效整族是同一个理由。
 */
export function useDocActions() {
  const queryClient = useQueryClient()
  return {
    save: useMutation({
      mutationFn: ({ id, content, name }: { id: string; content: string; name?: string }) =>
        saveDocContent(id, content, name),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: docKeys.all }),
    }),
  }
}
