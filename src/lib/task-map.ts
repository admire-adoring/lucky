/**
 * 任务接口层的**纯映射**（不 import Tauri、不碰数据库）。
 *
 * 单独成文件只为一件事：能在 Node 里直接跑测试（`scripts/verify-task-map.mjs`）。
 * `api/tasks.ts` 里那些 `invoke` 调用在测试环境里没有实现，映射逻辑没必要被它们连累。
 *
 * 派生字段（`inToday` / `overdueDays` / `dueLabel` / `quad` / `calDay` / `calLabel`）全在这里算：
 * 存进库第二天就会说错话（"今天到期"会永远是建库那天）。
 */
import type { TaskKind, TaskPrio, TaskRow, TaskScope, TaskState } from '../data/workspace/tasks'

export interface RawTask {
  id: string
  scope: string
  /** null = 收件箱里的任务（不挂项目） */
  projectId: string | null
  /** 项目名（后端 hydrate）—— 任务行要显示它 */
  projectName: string
  ownerCode: string | null
  title: string
  state: string
  priority: string
  dueAt: string | null
  scheduledStart: string | null
  estimateMin: number | null
  completedAt: string | null
  sourceKind: string | null
  inboxAt: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  /** 检查项（子表）—— 只有 `task_get` 会填，列表是空数组 */
  items: TaskItemRow[]
}

export interface TaskItemRow {
  id: string
  taskId: string
  title: string
  done: boolean
  sortOrder: number
}

const DAY_MS = 86_400_000

export function startOfToday(): number {
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  return now.getTime()
}

/**
 * ISO（`2026-11-17` 或带时间）→ 距今天数；`null` = 没定日期。
 *
 * **只取日期部分**再算。原先直接 `Date.parse(带时间)` 再 `Math.round`：今天 18:00 距今天 0 点
 * 是 0.75 天，四舍五入成 **1** —— 于是"今天到期"的任务会被算成明天（`scripts/verify-task-map.mjs`
 * 第一版就是这么把它抓出来的）。
 */
export function dayDiff(iso: string | null): number | null {
  if (!iso) return null
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return null
  const then = new Date(y, m - 1, d).getTime()
  return Math.round((then - startOfToday()) / DAY_MS)
}

export function ymd(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function toTaskRow(raw: RawTask): TaskRow {
  const dueDays = dayDiff(raw.dueAt)
  const today = ymd(new Date())
  const dueDate = raw.dueAt?.slice(0, 10) ?? ''
  const important = raw.priority === 'high' || raw.priority === 'mid'
  const urgent = (dueDays ?? 0) < 0 || raw.state === 'doing'
  return {
    id: raw.id,
    title: raw.title,
    scope: raw.scope as TaskScope,
    prio: raw.priority as TaskPrio,
    state: raw.state as TaskState,
    kind: (raw.sourceKind ?? undefined) as TaskKind | undefined,
    inToday: dueDate === today,
    overdueDays: Math.max(0, -(dueDays ?? 0)),
    estMin: raw.estimateMin ?? undefined,
    dueAt: raw.dueAt ?? `${today}T18:00`,
    scheduledStart: raw.scheduledStart ?? undefined,
    pooled: !raw.scheduledStart && raw.state !== 'done',
    completedAt: raw.completedAt ?? undefined,
    inboxAt: raw.inboxAt ?? undefined,
    project: raw.projectName || undefined,
    createdAt: raw.createdAt.slice(0, 10),
    updatedAt: raw.updatedAt.slice(0, 10),
    dueLabel: dueDays === null ? '未定' : dueDays === 0 ? '今天' : dueDays < 0 ? `逾期 ${-dueDays} 天` : `${dueDays} 天后`,
    quad: (important ? (urgent ? 1 : 2) : urgent ? 3 : 4) as 1 | 2 | 3 | 4,
    calDay: dueDate ? Number(dueDate.slice(8, 10)) : undefined,
    calLabel: raw.title.slice(0, 6),
  }
}
