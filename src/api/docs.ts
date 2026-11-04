import { invoke } from '@tauri-apps/api/core'
import { call } from './error'
import { docUpdatedText } from '../data/derive'
import { DOC_KIND_LABEL } from '../data/content-pool'
import { DOC_SOURCE_META, TASK_STATUS_META } from '../data/meta'
import type { DocKind, DocLink, DocLinkFamily, DocLinkKind, DocumentItem } from '../types'

/**
 * 文档（项目族的索引 + 本地正文）。
 *
 * 形态换算集中在这里：库里的 `source` 是 code、关联目标是 `toKind` 码与原始读数，
 * 而 `DocumentItem.source` / `DocLink` 要的是人话 —— 组件拿到的仍是原样的形状。
 */
export const docKeys = {
  all: ['docs'] as const,
  list: (projectId: string) => [...docKeys.all, 'list', projectId] as const,
  /** 某项目的部署文档（宿主是机器，按 projectId 查出来的那一批） */
  deploy: (projectId: string) => [...docKeys.all, 'deploy', projectId] as const,
  /** 某台机器名下的文档（机器详情书架） */
  host: (host: string) => [...docKeys.all, 'host', host] as const,
  /** 任意宿主（模块级容器，如学习笔记的 `note/learn`） */
  owner: (kind: string, id: string) => [...docKeys.all, 'owner', kind, id] as const,
  content: (id: string) => [...docKeys.all, 'content', id] as const,
}

export interface RawLink {
  kind: string
  toKind: string
  toId: string
  name: string
  /** 原始码/值：文档＝种类码、任务＝状态码、会议＝ISO 时刻 */
  meta: string
}

/** 后端 `Document` 的出参（一张表挂多种主实体）。 */
export interface DocRow {
  id: string
  ownerKind: string
  ownerId: string
  projectId: string | null
  name: string
  module: string
  func: string
  kind: string
  source: string
  version: string
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

function toDocumentItem(raw: DocRow): DocumentItem {
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

/** 一个项目的文档索引（宿主 = 项目）。没有项目 id 时给空集，不打命令。 */
export function fetchDocs(projectId: string | undefined): Promise<DocumentItem[]> {
  if (!projectId) return Promise.resolve([])
  return call(() =>
    invoke<DocRow[]>('doc_list', { ownerKind: 'project', ownerId: projectId }).then((rows) =>
      rows.map(toDocumentItem),
    ),
  )
}

/**
 * 一个项目的**部署文档**（宿主 = 机器，但 `projectId` 指向它）。
 * 项目详情运维分区、机器详情书架都读它；形状是 `DeployDocItem`（用 `toDeployDocItem` 转）。
 */
export function fetchDeployDocs(projectId: string | undefined): Promise<DocRow[]> {
  if (!projectId) return Promise.resolve([])
  return call(() => invoke<DocRow[]>('doc_list', { ownerKind: 'server', projectId }))
}

/** 一台机器名下的全部文档（机器详情的书架按项目分排时用）。 */
export function fetchServerDocs(host: string | undefined): Promise<DocRow[]> {
  if (!host) return Promise.resolve([])
  return call(() => invoke<DocRow[]>('doc_list', { ownerKind: 'server', ownerId: host }))
}

/**
 * 任意宿主下的文档（模块级容器用它）。
 * 学习模块的「笔记」页：宿主 `note` + `owner_id='learn'`；工作模块的文档索引同理。
 */
export function fetchOwnerDocs(ownerKind: string, ownerId: string): Promise<DocumentItem[]> {
  return call(() =>
    invoke<DocRow[]>('doc_list', { ownerKind, ownerId }).then((rows) => rows.map(toDocumentItem)),
  )
}

/** 后端 `DocumentInput`（写形态）。`file_path` 不在其中：落点由后端按宿主 + 标题算。 */
export interface DocInput {
  ownerKind: string
  ownerId: string
  projectId?: string | null
  name: string
  module?: string
  func?: string
  kind: string
  source: string
  version?: string
  summary?: string
  content?: string | null
  links?: { kind: string; toKind: string; toId: string }[]
}

/** 新建文档索引。`source='local_md'` 时后端会先落一份（可为空的）正文文件再登记。 */
export function createDoc(input: DocInput): Promise<DocRow> {
  return call(() => invoke<DocRow>('doc_create', { input }))
}

/** 编辑索引（带 `content` 时连正文一起写）。**不能换宿主、不能换来源**（后端会拦）。 */
export function updateDoc(id: string, input: DocInput): Promise<DocRow> {
  return call(() => invoke<DocRow>('doc_update', { id, input }))
}

/** 删除：索引与正文文件一起走（不可恢复）。 */
export function deleteDoc(id: string): Promise<void> {
  return call(() => invoke<void>('doc_delete', { id }))
}

/* ============================================================
   本地正文的读与写
   ------------------------------------------------------------
   只有 `source = 'local_md'` 的那些有本地正文（其余在腾讯文档 / 语雀 / Git 里）。
   ============================================================ */

export interface DocContent {
  content: string
  hash: string
  syncedAt: string
  /** 文件在外部被改过：后端读的时候已经把索引同步掉了（界面可提一句） */
  changed: boolean
}

export function fetchDocContent(id: string): Promise<DocContent> {
  return call(() => invoke<DocContent>('doc_read', { id }))
}

/** 写回 `.md` 文件；`name` 是编辑器里可能改过的标题（不给就不动索引里的名字）。 */
export function saveDocContent(id: string, content: string, name?: string): Promise<void> {
  return call(() => invoke<void>('doc_write', { id, content, name: name ?? null }))
}
