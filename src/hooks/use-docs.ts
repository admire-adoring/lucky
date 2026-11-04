import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createDoc,
  deleteDoc,
  docKeys,
  fetchDeployDocs,
  fetchDocContent,
  fetchDocDirs,
  fetchDocs,
  fetchOwnerDocs,
  fetchServerDocs,
  saveDocContent,
  updateDoc,
  type DocInput,
} from '../api/docs'
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
 * 任意宿主下的文档（模块级容器用）。学习「笔记」页传 `('note', 'learn')`。
 * 浏览器预览里回落 `LEARN_NOTES`，与真实路径同一形状。
 */
export function useOwnerDocs(ownerKind: string, ownerId: string): DocumentItem[] {
  const { data } = useQuery({
    queryKey: docKeys.owner(ownerKind, ownerId),
    queryFn: () => fetchOwnerDocs(ownerKind, ownerId),
    staleTime: 5 * 60 * 1000,
  })
  return data ?? []
}

/**
 * 一个项目的**部署文档**（宿主是机器，`projectId` 指向这个项目）。
 * 返回原始行，调用方用 `lib/server-view` 的 `toDeployDocItem` 转成书架的形状。
 */
export function useDeployDocs(projectId: string | undefined) {
  return useQuery({
    queryKey: docKeys.deploy(projectId ?? ''),
    queryFn: () => fetchDeployDocs(projectId),
    enabled: Boolean(projectId),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 一台机器名下的全部文档（机器详情的书架按项目分排时用 —— 一次查完、前端分组，
 * 不再按项目逐条查）。
 */
export function useServerDocs(host: string | undefined) {
  return useQuery({
    queryKey: docKeys.host(host ?? ''),
    queryFn: () => fetchServerDocs(host),
    enabled: Boolean(host),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 文档根与根下的目录 —— 新建文档时给人挑「存到哪个文件夹」。
 * 只在打开新建弹窗时才需要，`enabled` 由调用方按弹窗状态传；
 * 浏览器预览里命令不存在 ⇒ `retry: false`，失败就退回"只有默认目录"。
 */
export function useDocDirs(enabled: boolean) {
  return useQuery({
    queryKey: [...docKeys.all, 'dirs'] as const,
    queryFn: () => fetchDocDirs(),
    enabled,
    staleTime: 30 * 1000,
    retry: false,
  })
}

/**
 * 文档的写操作：新建 / 编辑索引 / 删除。收在 `docKeys.all` 一处失效上
 * （列表、"多久没更新"、正文缓存一起刷）。正文写回走 `useDocActions().save`。
 *
 * 三个动作都只在 Tauri 里有效 —— 浏览器预览里 `api/docs.ts` 会明确报错，
 * 不给"保存成功"的假回执。
 */
export function useDocMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: docKeys.all })

  return {
    create: useMutation({ mutationFn: (input: DocInput) => createDoc(input), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: DocInput }) => updateDoc(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteDoc(id), onSuccess: invalidate }),
  }
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
