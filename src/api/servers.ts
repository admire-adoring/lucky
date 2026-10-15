import { invoke } from '@tauri-apps/api/core'
import { call } from './error'

/* ============================================================================
   服务器台账 · 前端绑定
   ----------------------------------------------------------------------------
   对面是 `src-tauri/src/server`（SQLite），经 `src-tauri/src/lib.rs` 的
   `srv_*` 命令转发。字段名与 Rust 那边的 `#[serde(rename_all = "camelCase")]`
   一一对齐，改一处要两边一起改。

   业务键是 `host`（路由 `/work/servers/:host` 用它），不是主键 id；
   发布记录与部署文档没有路由级业务键，读写直接用 id。

   注意：这些命令只在 Tauri 窗口里可用；浏览器里跑 `vite dev` 时 `invoke` 会抛错。
   命令错误统一经 `api/error.ts` 换成 ApiError（带 code，message 可直接展示）。
   ============================================================================ */

/** 这台机器服务的一个项目。终端 / 日志 / 部署三条路由都要用 id 拼地址。 */
export interface ServerProjectRef {
  id: string
  name: string
}

/** 应用端口。与 `sshPort` 是两件事：那个是连它的入口，这个是它对外跑的服务。 */
export interface ServerPort {
  port: number
  svc: string
}

/** 一条文件位置（读出来的形态）。 */
export interface ServerPath {
  id: string
  group: string
  use: string
  path: string
  note: string
}

/** 写入时的一条文件位置（还没有 id）。 */
export interface ServerPathInput {
  group: string
  use: string
  path: string
  note?: string
}

/**
 * 台账里的一台机器 —— 主表一行，加上项目 / 端口 / 标签 / 文件位置。
 *
 * 凭据不在其中：密码与私钥正文存本机钥匙串，这里只有 `credRef`（引用）与
 * `authCode` / `escMode` / `escUser`（怎么连，不是用什么连）。
 */
export interface Server {
  id: string
  /** 机器名，业务键；也是列表里的主标签 */
  host: string
  /** 主机地址：IPv4 或内网域名 */
  ip: string
  /** SSH 端口 */
  sshPort: number
  os: string
  cores: number | null
  memGb: number | null
  diskGb: number | null
  /** 角色：web / db / cache */
  roleCode: string
  /** 环境：prod / stage / test / local */
  envCode: string
  loginUser: string
  /** 认证方式：key（密钥文件）/ pwd（密码） */
  authCode: string
  /** 提权方式：none / su / sudo */
  escMode: string
  /** 提权到的账户；none 时为空串 */
  escUser: string
  /** 钥匙串条目引用；null = 凭据不在本机 */
  credRef: string | null
  /** 这台机器是干什么的 */
  note: string
  sortOrder: number
  /** null = 在册；有值 = 已从台账收走 */
  removedAt: string | null
  createdAt: string
  updatedAt: string
  /** 服务哪些项目；顺序即主项目在前 */
  projects: ServerProjectRef[]
  ports: ServerPort[]
  tags: string[]
  /** 文件位置的分组，顺序即显示顺序 */
  pathGroups: string[]
  paths: ServerPath[]
}

/** 新增 / 编辑的入参。除标识与分类外都可缺省，缺省即取表上的默认值。 */
export interface ServerInput {
  host: string
  ip: string
  /** 缺省 22 */
  sshPort?: number
  os?: string
  cores?: number | null
  memGb?: number | null
  diskGb?: number | null
  roleCode: string
  envCode: string
  loginUser?: string
  /** 缺省 'key' */
  authCode?: string
  /** 缺省 'none' */
  escMode?: string
  escUser?: string
  credRef?: string | null
  note?: string
  /** 有序：首位是主项目 */
  projectIds?: string[]
  ports?: ServerPort[]
  tags?: string[]
  pathGroups?: string[]
  paths?: ServerPathInput[]
}

export const serverKeys = {
  all: ['servers'] as const,
  list: () => [...serverKeys.all, 'list'] as const,
  one: (host: string) => [...serverKeys.all, 'one', host] as const,
}

/** 在册机器（已收走的不在其中）。 */
export function listServers(): Promise<Server[]> {
  return call(() => invoke<Server[]>('srv_list'))
}

/** 按机器名取一台，带项目 / 端口 / 标签 / 文件位置。 */
export function getServer(host: string): Promise<Server> {
  return call(() => invoke<Server>('srv_get', { host }))
}

export function createServer(input: ServerInput): Promise<Server> {
  return call(() => invoke<Server>('srv_create', { input }))
}

/** `host` 是改动前的机器名；`input.host` 可以是新名字。 */
export function updateServer(host: string, input: ServerInput): Promise<Server> {
  return call(() => invoke<Server>('srv_update', { host, input }))
}

/** 从台账收走（软删）。机器本身不受影响。 */
export function removeServer(host: string): Promise<void> {
  return call(() => invoke<void>('srv_remove', { host }))
}

/** 彻底删除（连带端口 / 标签 / 文件位置）。 */
export function deleteServer(host: string): Promise<void> {
  return call(() => invoke<void>('srv_delete', { host }))
}

/* ============================================================================
   发布记录（srv_deploy_release）
   ============================================================================ */

/**
 * 一条发布记录（读出形态）。`released_at` 是 ISO 时刻，「昨天 / 5 天前」由视图层派生；
 * `durationSec` 存秒，回滚那条没有耗时；`changes` 一个字段两种读法
 * （成功 = 变更说明，回滚 = 原因）。
 */
export interface DeployRelease {
  id: string
  projectId: string
  /** 连接 project 表带出的项目名 —— 发布清单与 KPI 卡都直接读它 */
  projectName: string
  /** 落库的机器 id；机器被硬删后为 null（外键 ON DELETE SET NULL） */
  serverId: string | null
  /** 机器名，由 serverId 连接带出；与 serverId 同空 */
  serverHost: string | null
  version: string
  /** success / rollback */
  resultCode: string
  releasedAt: string
  /** 操作人码（'LY' 这种）；中文名前端换 */
  operatorCode: string | null
  /** 部署耗时（秒）；回滚没有这个概念 */
  durationSec: number | null
  commitSha: string
  changes: string
  /** 仅 resultCode = rollback 有值 */
  rollbackTo: string | null
}

/** 新增 / 编辑一条发布记录的入参。机器按业务键 host 引用，不是 serverId。 */
export interface DeployReleaseInput {
  projectId: string
  /** 缺省 null = 不挂机器 */
  serverHost?: string | null
  version: string
  resultCode: string
  /** 缺省 = 发布时刻（补录历史时才需要给；编辑缺省 = 保留原值） */
  releasedAt?: string
  /** 缺省 null = 没登记操作人 */
  operatorCode?: string | null
  durationSec?: number | null
  commitSha?: string
  changes?: string
  rollbackTo?: string | null
}

/** 台账徽标的聚合计数：一台机器名下有几条发布记录。 */
export interface ServerReleaseCount {
  host: string
  count: number
}

export const releaseKeys = {
  all: ['releases'] as const,
  byProject: (projectId: string) => [...releaseKeys.all, 'project', projectId] as const,
  last: () => [...releaseKeys.all, 'last'] as const,
  counts: () => [...releaseKeys.all, 'counts'] as const,
}

/** 一个项目的发布记录，新的在前。 */
export function listReleases(projectId: string): Promise<DeployRelease[]> {
  return call(() => invoke<DeployRelease[]>('srv_release_list_by_project', { projectId }))
}

/** 跨项目的最近一条（KPI「最近发布」）；一条都没有时回 null。 */
export function lastRelease(): Promise<DeployRelease | null> {
  return call(() => invoke<DeployRelease | null>('srv_release_last'))
}

/** 每台机器名下的发布条数。 */
export function listReleaseCounts(): Promise<ServerReleaseCount[]> {
  return call(() => invoke<ServerReleaseCount[]>('srv_release_counts'))
}

export function createRelease(input: DeployReleaseInput): Promise<DeployRelease> {
  return call(() => invoke<DeployRelease>('srv_release_create', { input }))
}

/** `releasedAt` 缺省时保留原值 —— 改错字不该把发布时刻改成现在。 */
export function updateRelease(id: string, input: DeployReleaseInput): Promise<DeployRelease> {
  return call(() => invoke<DeployRelease>('srv_release_update', { id, input }))
}

export function deleteRelease(id: string): Promise<void> {
  return call(() => invoke<void>('srv_release_delete', { id }))
}

/* ============================================================================
   部署文档（srv_deploy_doc）
   ============================================================================ */

/** 一份部署文档（读出形态）。归属是项目，不是机器 —— 书架按项目分排。 */
export interface DeployDoc {
  id: string
  projectId: string
  name: string
  /** manual / process / script；「手册 / 流程 / 脚本」是前端的事 */
  kindCode: string
  version: string
  /** 「多久没更新」的文案由视图层从这一列派生 */
  updatedAt: string
  sortOrder: number
}

/** 新增 / 编辑的入参。`updatedAt` 不收：它就是"这次更新"的时刻。 */
export interface DeployDocInput {
  projectId: string
  name: string
  kindCode: string
  version?: string
}

export const deployDocKeys = {
  all: ['deployDocs'] as const,
  byProject: (projectId: string) => [...deployDocKeys.all, 'project', projectId] as const,
}

/** 一个项目的部署文档，按登记顺序。 */
export function listDeployDocs(projectId: string): Promise<DeployDoc[]> {
  return call(() => invoke<DeployDoc[]>('srv_doc_list', { projectId }))
}

export function createDeployDoc(input: DeployDocInput): Promise<DeployDoc> {
  return call(() => invoke<DeployDoc>('srv_doc_create', { input }))
}

export function updateDeployDoc(id: string, input: DeployDocInput): Promise<DeployDoc> {
  return call(() => invoke<DeployDoc>('srv_doc_update', { id, input }))
}

export function deleteDeployDoc(id: string): Promise<void> {
  return call(() => invoke<void>('srv_doc_delete', { id }))
}
