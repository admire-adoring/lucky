import type { Server } from '../api/servers'
import { LOG_SOURCES } from '../data/content-pool'
import type { LedgerServer } from '../data/derive'

/* ============================================================================
   真实数据 → 台账视图形状
   ----------------------------------------------------------------------------
   台账页与详情页的标记 / 类名 / 样式是照原型定的，不因为换了数据来源而重画。
   这一层只做三件事：把 code 换成中文、把 DB 里没有的读数补成空值、把
   `srv_server_port.port`（整数）写成 `PortChip.port`（字符串）。

   为什么不直接把 `LedgerServer` 换成 `Server`：那要改两个大组件里每一处
   `env` / `role` / `logCount` 的读法，而它们的取值规则（哪几个码算生产、
   角色怎么叫、日志源按角色数）正是这里要收口的东西。
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

export function toLedgerServer(server: Server): LedgerServer {
  return {
    host: server.host,
    ip: server.ip,
    os: server.os,
    role: server.roleCode,
    roleLabel: ROLE_LABEL[server.roleCode] ?? server.roleCode,
    /* 卡片只分"生产 / 非生产"两态（生产那一支才染运维绿），四档环境的中文名走 envLabel */
    env: server.envCode === 'prod' ? 'prod' : 'test',
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
