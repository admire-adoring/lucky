import type { Server, DeployDoc, DeployRelease } from '../api/servers'
import { LOG_SOURCES } from '../data/content-pool'
import {
  docUpdatedText,
  ownerDisplayName,
  type DeployDocItem,
  type DeployItem,
  type LedgerServer,
  type ServerItem,
} from '../data/derive'

/* ============================================================================
   真实数据 → 视图形状
   ----------------------------------------------------------------------------
   页面的标记 / 类名 / 样式是照原型定的，不因为换了数据来源而重画。
   这一层只做三件事：把 code 换成中文、把 DB 里没有的读数补成空值、把
   数字列写成视图要的字符串。台账吃 `toLedgerServer`；项目页运维分区、
   日志 / 部署两个下钻窗口吃 `toOpsServer`；发布记录与部署文档各有各的换算。
   ============================================================================ */

const ENV_LABEL: Record<string, string> = {
  prod: '生产',
  stage: '预发',
  test: '测试',
  local: '本机',
}

const ROLE_LABEL: Record<string, string> = {
  web: 'Web 层',
  db: '数据库',
  cache: '缓存',
}

const DEPLOY_DOC_KIND_LABEL: Record<string, string> = {
  manual: '手册',
  process: '流程',
  script: '脚本',
}

/** 视图两档：卡片只分"生产 / 非生产"（生产那一支才染运维绿），四档环境的中文名走 envLabel */
function envOf(server: Server): 'prod' | 'test' {
  return server.envCode === 'prod' ? 'prod' : 'test'
}

export function toLedgerServer(server: Server): LedgerServer {
  return {
    host: server.host,
    ip: server.ip,
    os: server.os,
    role: server.roleCode,
    roleLabel: ROLE_LABEL[server.roleCode] ?? server.roleCode,
    env: envOf(server),
    envLabel: ENV_LABEL[server.envCode] ?? server.envCode,
    projects: server.projects.map((project) => ({ id: project.id, name: project.name })),
    cores: server.cores ?? 0,
    memGb: server.memGb ?? 0,
    user: server.loginUser,
    auth: server.authCode === 'pwd' ? 'pwd' : 'key',
    esc: server.escMode === 'su' || server.escMode === 'sudo' ? server.escMode : 'none',
    ports: server.ports.map((port) => ({ port: String(port.port), svc: port.svc })),
    /* 这个角色配了几份日志源 —— 与运维分区读的是同一张表 */
    logCount: (LOG_SOURCES[server.roleCode] ?? []).length,
    /* 发布记录还没有落库的读接口，台账先按 0 报（徽标在 0 时不渲染） */
    deployCount: 0,
    pathGroups: server.pathGroups,
    paths: server.paths,
  }
}

/**
 * 真实 Server → 运维分区的 ServerItem。负载 / 运行时长 / 版本是"连上才读得到"的
 * 读数，库里没有也不编 —— 全部给零值，页面那几处本来就有 `??` 与条件渲染兜着。
 */
export function toOpsServer(server: Server): ServerItem {
  const spec = server.cores != null && server.memGb != null ? `${server.cores}C${server.memGb}G` : '—'
  return {
    id: server.id,
    name: server.host,
    role: server.roleCode,
    env: envOf(server),
    on: true,
    ip: server.ip,
    spec,
    cores: server.cores ?? 0,
    memGb: server.memGb ?? 0,
    os: server.os,
    user: server.loginUser,
    auth: server.authCode === 'pwd' ? 'pwd' : 'key',
    esc: server.escMode === 'su' || server.escMode === 'sudo' ? server.escMode : 'none',
    info: [
      { label: '磁盘', value: server.diskGb != null ? `${server.diskGb}G` : '—', inMeta: true },
      { label: 'SSH 端口', value: String(server.sshPort) },
      ...(server.note ? [{ label: '备注', value: server.note }] : []),
    ],
    logCount: (LOG_SOURCES[server.roleCode] ?? []).length,
    cpu: 0,
    mem: 0,
    disk: 0,
    alert: false,
    uptimeDays: 0,
    version: '—',
    ports: server.ports.map((port) => ({ port: String(port.port), svc: port.svc })),
    pathGroups: server.pathGroups,
    paths: server.paths.map((p) => ({ group: p.group, use: p.use, path: p.path, note: p.note })),
    fsExtra: [],
    fsHome: [],
    series: { cpu: [], mem: [], disk: [] },
    diskUsage: [],
    diskUsedGb: 0,
    diskTotalGb: server.diskGb ?? 0,
  }
}

/** 真实 DeployDoc → 书架那一排。kind 的中文在这里换，不落库（D3）。 */
export function toDeployDocItem(doc: DeployDoc): DeployDocItem {
  const updatedHours = doc.updatedAt
    ? Math.max(0, Math.round((Date.now() - Date.parse(doc.updatedAt)) / 3_600_000))
    : Number.MAX_SAFE_INTEGER
  return {
    id: doc.id,
    name: doc.name,
    kind: DEPLOY_DOC_KIND_LABEL[doc.kindCode] ?? doc.kindCode,
    version: doc.version || '—',
    updatedAt: docUpdatedText(updatedHours),
    updatedHours,
  }
}

/** 发布时刻 → `今天 14:20` / `昨天 09:30` / `N 天前` / 跨月给 `M月D日`。台账与发布记录行共用。 */
export function releasedText(iso: string): string {
  const at = Date.parse(iso)
  if (Number.isNaN(at)) return '—'
  const days = Math.floor((Date.now() - at) / 86_400_000)
  const hm = new Date(at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  if (days <= 0) return `今天 ${hm}`
  if (days === 1) return `昨天 ${hm}`
  if (days < 7) return `${days} 天前`
  return `${new Date(at).getMonth() + 1}月${new Date(at).getDate()}日`
}

/** 真实 DeployRelease → 发布记录行。耗时存秒、回滚没有耗时的口径与表一致。 */
export function toDeployItem(release: DeployRelease): DeployItem {
  const durationSec = release.durationSec
  return {
    id: release.id,
    version: release.version || '—',
    result: release.resultCode === 'rollback' ? 'rollback' : 'success',
    when: releasedText(release.releasedAt),
    server: release.serverHost ?? '—',
    who: release.operatorCode ? ownerDisplayName(release.operatorCode) : '—',
    duration:
      release.resultCode === 'rollback' || durationSec == null
        ? ''
        : `${Math.floor(durationSec / 60)}m ${String(durationSec % 60).padStart(2, '0')}s`,
    commit: release.commitSha ? release.commitSha.slice(0, 7) : '—',
    changes: release.changes || '—',
    rollbackTo: release.rollbackTo,
  }
}
