import { invoke } from '@tauri-apps/api/core'
import { call } from './error'

/* ============================================================================
   终端 · 前端绑定
   ----------------------------------------------------------------------------
   对面是 `src-tauri/src/server/srv/term.rs`：真连 SSH、真跑命令、真读 /proc。
   会话只活在应用进程里（`Hub`），关掉窗口就没了；落库的是审计行
   （`srv_term_session` / `srv_term_command`），用来跨会话取命令历史。

   这些命令只在 Tauri 窗口里可用；浏览器里 `invoke` 会抛错，页面走错误态。
   ============================================================================ */

/** 一条会话开头（认通时机器自报的身份）。 */
export interface TermOpen {
  sessionId: string
  host: string
  ip: string
  /** 登录账户 */
  user: string
  /** `sudo` 提权成功时是提权到的账户，否则就是登录账户 */
  effectiveUser: string
  os: string
  shell: string
  home: string
  cwd: string
  connectedAt: string
  /** 这台机器累计第几次开会话（落库计数） */
  sessionNo: number
  connectMs: number
  /** 台账里的提权配置被跳过时的说明（空串 = 没跳过） */
  escNote: string
}

/** 一条命令的执行结果。 */
export interface TermRun {
  stdout: string
  stderr: string
  /** 退出码；`-1` = 没跑起来 */
  code: number
  durationMs: number
  cwd: string
  /** 输出超过上限被截过 */
  truncated: boolean
  /** 这条命令把会话关了（`exit` / `logout`） */
  closed: boolean
}

export interface TermProc {
  pid: number
  user: string
  cpu: number
  mem: number
  command: string
}

/** 真负载。`available` 为 false 时整块显示「—」，不拿 0 冒充读数。 */
export interface TermStats {
  available: boolean
  note: string
  cpu: number
  cores: number
  cpuBars: number[]
  mem: number
  memUsedMb: number
  memTotalMb: number
  load: number[]
  tasks: number
  threads: number
  running: number
  processes: TermProc[]
}

export interface TermTail {
  /** 跟的哪个文件；`journalctl` 表示系统日志 */
  source: string
  text: string
  lineCount: number
}

/** 一条命令记录（历史与审计）。 */
export interface TermCommandRecord {
  id: string
  command: string
  exitCode: number | null
  durationMs: number
  cwd: string
  ranAt: string
}

/** 一条会话记录。 */
export interface TermSessionRecord {
  id: string
  loginUser: string
  os: string
  cwd: string
  startedAt: string
  endedAt: string | null
  /** open / closed / lost */
  status: string
  commandCount: number
}

export const termKeys = {
  all: ['terminal'] as const,
  history: (host: string) => [...termKeys.all, 'history', host] as const,
  sessions: (host: string) => [...termKeys.all, 'sessions', host] as const,
}

/** 连上这台机器。凭据取台账里存的那份（解密只在后端内存里过一手）。 */
export function openTerminal(host: string): Promise<TermOpen> {
  return call(() => invoke<TermOpen>('term_open', { host }))
}

/** 在会话里跑一条命令。`cd` 的目录变化会留在会话上。 */
export function runTerminalCommand(sessionId: string, command: string): Promise<TermRun> {
  return call(() => invoke<TermRun>('term_exec', { sessionId, command }))
}

/** 真读一次负载（CPU / 内存 / load / 进程表）。 */
export function readTerminalStats(sessionId: string): Promise<TermStats> {
  return call(() => invoke<TermStats>('term_stats', { sessionId }))
}

/** 跟日志。`path` 不给时后端按常见位置挑一个，都没有就退回 `journalctl`。 */
export function tailTerminalLog(sessionId: string, path?: string, lines = 40): Promise<TermTail> {
  return call(() => invoke<TermTail>('term_tail', { sessionId, path, lines }))
}

/** 关会话（收主连接 + 落库 `closed`）。 */
export function closeTerminal(sessionId: string): Promise<void> {
  return call(() => invoke<void>('term_close', { sessionId }))
}

/** 这台机器上敲过的命令，新的在前。 */
export function fetchTermHistory(host: string, limit = 200): Promise<TermCommandRecord[]> {
  return call(() => invoke<TermCommandRecord[]>('term_history', { host, limit }))
}

/** 这台机器上的终端会话记录。 */
export function fetchTermSessions(host: string, limit = 20): Promise<TermSessionRecord[]> {
  return call(() => invoke<TermSessionRecord[]>('term_sessions', { host, limit }))
}
