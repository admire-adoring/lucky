import { buildTasks, ownerDisplayName, relativeDate, taskQuad } from '../derive'
import type { Project, Task } from '../../types'

/* ============================================================================
   工作模块 · 任务页（`design/work/work_task.html`，2026-10-14 版）

   这一层只做两件事：把 `derive.buildTasks` 的 `Task` 折成这一页要用的行，
   以及四档视图要的几个读数（分布 / 近 7 天节奏 / 日历格子）。
   视图与壳都不在这里 —— 组件是 `components/workspace/work/WorkTaskBoard.tsx`。

   ----------------------------------------------------------------------------
   与原型的那份池子
   ----------------------------------------------------------------------------
   原型自带 15 条工作域任务、4 个样本项目（支付系统重构 / 用户中心改版 /
   数据看板 / 性能优化专项）。那不是数据源（`ProjectDrawers` 文件头同一条），
   应用里真实的工作项目在 `data/projects.ts`，这一层从 `buildTasks` 拉平。

   四象限照原型的口径落在 `derive.taskQuad`：原型那一页的 `q` 是显式字段并注明
   "接真实数据时读优先级位"，应用里没有这个字段，可用的是两个真信号。

   ⚠️ 到期的"第几天"读 `Task.dueDays`，**不从 `Task.due` 那句文案反解析**。
      日历与「近 7 天完成节奏」要的是数；反解析会在改文案时静默漏掉一批格子。
   ============================================================================ */

/** 视图里的状态三档。`blocked` 归入 `doing` —— 与 `data/workspace/project.ts` 同一条 */
export type WorkTaskState = 'todo' | 'doing' | 'done'

export interface WorkTaskRow {
  id: string
  title: string
  /** 身份行第一段：项目名 */
  project: string
  /** 身份行第二段：承担人（原型那一格是"卡在哪"，应用里没有这个字段，不编） */
  note: string
  state: WorkTaskState
  /** 到期日相对今天的天数（负 = 逾期） */
  dueDays: number
  /** 到期文案（行尾那一列 / 看板卡脚） */
  dueText: string
  /** 完成日相对今天的天数（只有已完成的条目有；0 = 今天完成） */
  doneDays: number | null
  q: 1 | 2 | 3 | 4
  /** 项目身份色（侧轨「按项目」那一组的分量色） */
  tone: string
}

/**
 * 项目身份色。取自原型书架上那四支，按项目在位次上取，多了就循环 ——
 * 它只承担"这几块不是同一块"，不表达状态（状态有自己那三档色）。
 */
const PROJECT_TONES = ['#B03044', '#5A4189', '#0B6A85', '#4B5E75', '#A16207', '#0F766E'] as const

export function projectTone(index: number): string {
  return PROJECT_TONES[index % PROJECT_TONES.length] as string
}

function stateOf(status: Task['status']): WorkTaskState {
  if (status === 'done') return 'done'
  if (status === 'doing' || status === 'blocked') return 'doing'
  return 'todo'
}

/** 一个项目的任务 → 这一页的行。`tone` 由调用方给（跨项目时按位次，单项目时给第一支） */
export function workTaskRows(project: Project, tasks: Task[], tone: string): WorkTaskRow[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.name,
    project: project.name,
    note: ownerDisplayName(task.owner),
    state: stateOf(task.status),
    dueDays: task.dueDays,
    dueText: task.due,
    doneDays: task.doneDays,
    q: taskQuad(task),
    tone,
  }))
}

/** 跨项目：按 `projects` 的次序取身份色，任务由 `buildTasks` 派生 */
export function buildWorkTaskRows(projects: Project[]): WorkTaskRow[] {
  return projects.flatMap((project, index) => workTaskRows(project, buildTasks(project), projectTone(index)))
}

/* ---------------------------------------------------------------------------
   勾选：状态记在宿主的一张覆盖表里
   ---------------------------------------------------------------------------
   不重建派生数据的一份副本 —— 副本要在 effect 里同步，会多出一个
   "数据刷新冲掉刚勾的状态"的竞态（与项目详情页同一条）。
   --------------------------------------------------------------------------- */

export interface TaskOverride {
  /** 现在这一档 */
  state: WorkTaskState
  /** 勾之前那一档。取消完成要回到**它**，不是一律退回「待办」 ——
      一条「进行中」被勾掉再取消，不该降级成「待办」。 */
  prev: WorkTaskState
}

export const NO_OVERRIDE: Record<string, TaskOverride> = {}

/** 勾一次。调用方负责回执，这一层只算下一状态 */
export function toggleOverride(
  target: { id: string; state: WorkTaskState },
  override: Record<string, TaskOverride>,
): Record<string, TaskOverride> {
  const hit = override[target.id]
  const now = hit?.state ?? target.state
  if (now === 'done') {
    const back = hit?.prev ?? 'todo'
    return { ...override, [target.id]: { state: back, prev: back } }
  }
  return { ...override, [target.id]: { state: 'done', prev: now } }
}

export function applyOverride(rows: WorkTaskRow[], override: Record<string, TaskOverride>): WorkTaskRow[] {
  return rows.map((row) => {
    const hit = override[row.id]
    if (!hit || hit.state === row.state) return row
    /* 刚勾上的算"今天完成"（右上那片「近 7 天节奏」与「已完成 · 今天」都看它）；
       退回未完成就没有完成日了。 */
    return { ...row, state: hit.state, doneDays: hit.state === 'done' ? 0 : null }
  })
}

/* ---------------------------------------------------------------------------
   视图条
   --------------------------------------------------------------------------- */

export type WorkTaskViewKey = 'list' | 'board' | 'quad' | 'calendar'

/** 四档 + 右边那句"这一档在排什么"（原型 `TASK_HINTS`） */
export const WORK_TASK_VIEWS: { key: WorkTaskViewKey; label: string; hint: string }[] = [
  { key: 'list', label: '列表', hint: '按「逾期 → 今天 → 之后」排，未完成在前。' },
  { key: 'board', label: '看板', hint: '列按状态；时间信息在每张卡的行尾。' },
  { key: 'quad', label: '四象限', hint: '按重要 × 紧急落格；已完成的不参与。' },
  { key: 'calendar', label: '日历', hint: '滚动 5 周的到期分布；点某天可在那天新建。' },
]

/** 四象限的格名。顺序 = 格位 1..4（重要且紧急 → 不重要不紧急） */
export const QUAD_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: '重要且紧急',
  2: '重要不紧急',
  3: '不重要紧急',
  4: '不重要不紧急',
}

/* ---------------------------------------------------------------------------
   列表档的分组
   --------------------------------------------------------------------------- */

/** 未完成：按「逾期 → 今天 → 之后」排；同一档里保持池子原序 */
export function openRows(rows: WorkTaskRow[]): WorkTaskRow[] {
  return rows.filter((row) => row.state !== 'done').sort((a, b) => a.dueDays - b.dueDays)
}

/** 已完成 · 今天（`doneDays === 0`）与更早完成的条数 */
export function doneRows(rows: WorkTaskRow[]): { today: WorkTaskRow[]; earlier: number } {
  const done = rows.filter((row) => row.state === 'done')
  const today = done.filter((row) => row.doneDays === 0)
  return { today, earlier: done.length - today.length }
}

/* ---------------------------------------------------------------------------
   侧轨①：分布（按项目 / 按状态）
   --------------------------------------------------------------------------- */

export interface BarRow {
  name: string
  n: number
  /** 分量色。项目那一组是身份色，状态那一组走三档中性/强调 */
  color: string
}

export function projectBars(rows: WorkTaskRow[]): BarRow[] {
  const seen = new Map<string, BarRow>()
  rows.forEach((row) => {
    const hit = seen.get(row.project)
    if (hit) hit.n += 1
    else seen.set(row.project, { name: row.project, n: 1, color: row.tone })
  })
  /* 这一批里没有那个项目就不列 —— 0 条不占版面（原型同） */
  return [...seen.values()]
}

export function stateBars(rows: WorkTaskRow[]): BarRow[] {
  const spec: { key: WorkTaskState; name: string; color: string }[] = [
    { key: 'todo', name: '待办', color: 'var(--mw-text-muted)' },
    { key: 'doing', name: '进行中', color: 'var(--wt-fill)' },
    { key: 'done', name: '已完成', color: 'var(--g-ctl-line)' },
  ]
  return spec.map((item) => ({
    name: item.name,
    n: rows.filter((row) => row.state === item.key).length,
    color: item.color,
  }))
}

/* ---------------------------------------------------------------------------
   侧轨②：近 7 天完成节奏
   --------------------------------------------------------------------------- */

export interface WeekBar {
  /** 相对今天的天数：-6 … 0（0 = 今天） */
  off: number
  label: string
  n: number
  today: boolean
}

const WEEK_LABEL = ['日', '一', '二', '三', '四', '五', '六']

/* 本地年月日的换算统一走 `derive` 那三条（`relativeDate`）。
   不用 `toISOString()`：那是 UTC，东八区的晚上会整体偏一天。
   日历还需要"星期几 / 几号 / 是不是 1 号"，那几样 `relativeDate` 给不了，所以这里
   另有一个 `dayAt` 出 `Date`，键仍由 `relativeDate` 拼 —— 两处不会各说一个日期。 */
const TODAY = new Date()

function dayAt(off: number): Date {
  return new Date(TODAY.getFullYear(), TODAY.getMonth(), TODAY.getDate() + off)
}

/**
 * 滚动 7 天（今天在最右），**不是"本周"** —— 周一、周二打开时"本周"只有一两根，
 * 看不出节奏。柱高由组件按峰值折算成像素。
 */
export function weekBars(rows: WorkTaskRow[]): WeekBar[] {
  const done = rows.filter((row) => row.state === 'done')
  return Array.from({ length: 7 }, (_, i) => {
    const off = i - 6
    return {
      off,
      label: WEEK_LABEL[dayAt(off).getDay()] as string,
      n: done.filter((row) => row.doneDays === off).length,
      today: off === 0,
    }
  })
}

/* ---------------------------------------------------------------------------
   日历：滚动 5 周（周一起，起点 = 今天所在周的周一往前两周）
   ---------------------------------------------------------------------------
   取这个窗口而不是"本月"：到期日 = 今天 ± N 天，按本月切必然漏掉跨月的那几条，
   而且漏得无声。已完成的不进日历 —— 它在数据里是"今天完成了"，没有"哪一天到期"。
   --------------------------------------------------------------------------- */

export interface CalCell {
  key: string
  num: number
  /** 每月 1 号那格要标月份（跨月时只说日号看不出来是哪个月） */
  monthLabel: number | null
  today: boolean
  past: boolean
  rows: WorkTaskRow[]
  /** 一格最多摆 3 枚，多的收成「+N」 */
  overflow: number
}

export const CAL_WEEKS = 5
export const CAL_MAX_PER_DAY = 3
export const CAL_WEEK_HEADS = ['一', '二', '三', '四', '五', '六', '日']

export function calCells(
  rows: WorkTaskRow[],
  weeks = CAL_WEEKS,
  maxPerDay = CAL_MAX_PER_DAY,
): { cells: CalCell[]; outside: WorkTaskRow[] } {
  const mondayOffset = (TODAY.getDay() + 6) % 7 /* 周一 = 0，周日 = 6 */
  const planned = rows.filter((row) => row.state !== 'done')

  const days = Array.from({ length: weeks * 7 }, (_, i) => {
    const off = i - mondayOffset - 14
    const d = dayAt(off)
    return {
      off,
      key: relativeDate(off),
      num: d.getDate(),
      monthLabel: d.getDate() === 1 ? d.getMonth() + 1 : null,
      today: off === 0,
      past: off < 0,
    }
  })

  const keys = new Set(days.map((d) => d.key))
  const byDay = new Map<string, WorkTaskRow[]>()
  planned.forEach((row) => {
    const key = relativeDate(row.dueDays)
    if (!keys.has(key)) return
    const bucket = byDay.get(key)
    if (bucket) bucket.push(row)
    else byDay.set(key, [row])
  })

  const cells = days.map((d) => {
    const items = byDay.get(d.key) ?? []
    return {
      ...d,
      rows: items.slice(0, maxPerDay),
      overflow: Math.max(0, items.length - maxPerDay),
    }
  })

  return { cells, outside: planned.filter((row) => !keys.has(relativeDate(row.dueDays))) }
}
