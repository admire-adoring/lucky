import { invoke } from '@tauri-apps/api/core'
import { buildDocuments, docUpdatedText } from '../data/derive'
import { DOC_KIND_LABEL } from '../data/content-pool'
import { DOC_SOURCE_META, TASK_STATUS_META } from '../data/meta'
import { PROJECTS } from '../data/projects'
import { isTauri } from '../lib/env'
import type { DocKind, DocLink, DocLinkFamily, DocLinkKind, DocumentItem } from '../types'

/**
 * 文档（项目族的索引 + 本地正文）。列表两条路：Tauri 里走 `project_doc_list`（真实库），
 * 浏览器里回落 `derive.buildDocuments`（演示池）——与 `api/projects.ts` 同一条降级思路。
 *
 * 形态换算集中在这里：库里的 `source` 是 code、关联目标是 `toKind` 码与原始读数，
 * 而 `DocumentItem.source` / `DocLink` 要的是人话 —— 组件拿到的仍是原样的形状。
 */
export const docKeys = {
  all: ['docs'] as const,
  list: (projectId: string) => [...docKeys.all, 'list', projectId] as const,
  content: (id: string) => [...docKeys.all, 'content', id] as const,
}

interface RawLink {
  kind: string
  toKind: string
  toId: string
  name: string
  /** 原始码/值：文档＝种类码、任务＝状态码、会议＝ISO 时刻 */
  meta: string
}

interface RawDocument {
  id: string
  projectId: string
  name: string
  module: string
  func: string
  kind: string
  source: string
  filePath: string | null
  contentHash: string | null
  syncedAt: string | null
  summary: string
  authorId: string | null
  author: string
  updatedAt: string
  sortOrder: number
  links: RawLink[]
  back: RawLink[]
}

const HOUR_MS = 3_600_000

/** 关联目标的读数：库里是码，这里换成人话（各自查一张已有的标签表）。 */
function linkMeta(family: DocLinkFamily, raw: string): string {
  if (!raw) return ''
  switch (family) {
    case 'doc':
      return DOC_KIND_LABEL[raw as DocKind] ?? raw
    case 'task':
      return TASK_STATUS_META[raw as keyof typeof TASK_STATUS_META]?.label ?? raw
    case 'meeting':
      /* 会议给的是 ISO 时刻，取「10月12日」那种 —— 与文档列表同一档精度 */
      return raw.slice(5, 10).replace('-', '月') + '日'
    default:
      return ''
  }
}

function toDocLink(raw: RawLink): DocLink {
  const family = raw.toKind as DocLinkFamily
  return {
    kind: raw.kind as DocLinkKind,
    family,
    id: raw.toId,
    label: raw.name,
    meta: linkMeta(family, raw.meta),
  }
}

function toDocumentItem(raw: RawDocument): DocumentItem {
  const updatedHours = raw.updatedAt
    ? Math.max(0, Math.round((Date.now() - Date.parse(raw.updatedAt)) / HOUR_MS))
    : 0
  return {
    id: raw.id,
    name: raw.name,
    kind: raw.kind as DocKind,
    module: raw.module,
    func: raw.func,
    links: raw.links.map(toDocLink),
    back: raw.back.map(toDocLink),
    source: DOC_SOURCE_META[raw.source] ?? raw.source,
    summary: raw.summary,
    updatedAt: docUpdatedText(updatedHours),
    updatedHours,
    author: raw.author,
    filePath: raw.filePath,
  }
}

async function realFetchDocs(projectId: string): Promise<DocumentItem[]> {
  const rows = await invoke<RawDocument[]>('project_doc_list', { projectId })
  return rows.map(toDocumentItem)
}

function demoFetchDocs(projectId: string): Promise<DocumentItem[]> {
  const project = PROJECTS.find((item) => item.id === projectId)
  return Promise.resolve(project ? buildDocuments(project) : [])
}

/** 一个项目的文档索引。没有项目 id（数据还没到）时给空集，不打命令。 */
export function fetchDocs(projectId: string | undefined): Promise<DocumentItem[]> {
  if (!projectId) return Promise.resolve([])
  return isTauri() ? realFetchDocs(projectId) : demoFetchDocs(projectId)
}

/* ============================================================
   本地正文的读与写
   ------------------------------------------------------------
   只有 `source = 'local_md'` 的那些有本地正文（其余在腾讯文档 / 语雀 / Git 里）。
   浏览器预览里没有"本地正文"这一说 ⇒ 读直接拒绝，调用方回落演示稿。
   ============================================================ */

export interface DocContent {
  content: string
  hash: string
  syncedAt: string
  /** 文件在外部被改过：后端读的时候已经把索引同步掉了（界面可提一句） */
  changed: boolean
}

export function fetchDocContent(id: string): Promise<DocContent> {
  if (!isTauri()) return Promise.reject(new Error('浏览器预览里没有本地正文'))
  return invoke<DocContent>('project_doc_read', { id })
}

/** 写回 `.md` 文件；`name` 是编辑器里可能改过的标题（不给就不动索引里的名字）。 */
export function saveDocContent(id: string, content: string, name?: string): Promise<void> {
  return invoke('project_doc_write', { id, content, name: name ?? null })
}
