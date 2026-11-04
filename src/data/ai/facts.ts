import type { Project } from '../../types'

/**
 * AI 助手的事实层。
 *
 * 这是一个规则引擎（不是 LLM）：从真实项目数据算统计值，reply.ts 据此生成回复。
 * 没有 AI 模型后端 —— 所有数字来自 useProjects() 的真实 SQLite 数据。
 *
 * `AI_FACTS` 是可变对象：组件在数据到达时调 `updateAiFacts(projects)` 更新它，
 * reply.ts 在 buildReply() 调用时读到最新值。
 */

interface AiTasks {
  total: number
  done: number
  todo: number
  rate: number
}
interface AiDomEntry {
  avg: number
  count: number
  done: number
  total: number
  todo: number
  rate: number
}

export interface AiFacts {
  projectCount: number
  tasks: AiTasks
  globalAvg: number
  dom: {
    life: AiDomEntry
    work: AiDomEntry
    learn: AiDomEntry
  }
  stats: { active: number; risk: number; done: number; averageProgress: number }
  lateCount: number
  dueFirst: Project[]
  dueTop2: Project[]
  budgetTotal: number
  laggard: {
    life: Project | undefined
    work: Project | undefined
    learn: Project | undefined
  }
}

const EMPTY_DOM: AiDomEntry = { avg: 0, count: 0, done: 0, total: 0, todo: 0, rate: 0 }

export const AI_FACTS: AiFacts = {
  projectCount: 0,
  tasks: { total: 0, done: 0, todo: 0, rate: 0 },
  globalAvg: 0,
  dom: {
    life: { ...EMPTY_DOM },
    work: { ...EMPTY_DOM },
    learn: { ...EMPTY_DOM },
  },
  stats: { active: 0, risk: 0, done: 0, averageProgress: 0 },
  lateCount: 0,
  dueFirst: [],
  dueTop2: [],
  budgetTotal: 0,
  laggard: { life: undefined, work: undefined, learn: undefined },
}

function domEntry(projects: Project[]): AiDomEntry {
  const total = projects.reduce((s, p) => s + p.tasksTotal, 0)
  const done = projects.reduce((s, p) => s + p.tasksDone, 0)
  const todo = total - done
  const avg = projects.length ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length) : 0
  const rate = total ? Math.round((done / total) * 100) : 0
  return { avg, count: projects.length, done, total, todo, rate }
}

/** 从真实项目数据计算事实层，写回 AI_FACTS。由 React 组件在数据到达时调用。 */
export function updateAiFacts(projects: Project[]): void {
  const byScope = (scope: 'life' | 'work' | 'learn') => projects.filter((p) => p.scope === scope)

  const dom = {
    life: domEntry(byScope('life')),
    work: domEntry(byScope('work')),
    learn: domEntry(byScope('learn')),
  }
  const total = projects.reduce((s, p) => s + p.tasksTotal, 0)
  const done = projects.reduce((s, p) => s + p.tasksDone, 0)
  const todo = total - done
  const averageProgress = projects.length
    ? Math.round(projects.reduce((s, p) => s + p.progress, 0) / projects.length)
    : 0

  const active = projects.filter((p) => p.status === 'active').length
  const risk = projects.filter((p) => p.status === 'risk').length
  const doneProjects = projects.filter((p) => p.status === 'done').length

  // 到期排序：天数少（含负数=逾期）的在前
  const dueFirst = [...projects]
    .filter((p) => p.status !== 'archived' && p.status !== 'done')
    .sort((a, b) => a.daysLeft - b.daysLeft)
  const dueTop2 = dueFirst.slice(0, 2)

  // 各域进度最低的未完成项目
  const laggardOf = (scope: 'life' | 'work' | 'learn') =>
    byScope(scope)
      .filter((p) => p.status !== 'archived' && p.status !== 'done')
      .sort((a, b) => a.progress - b.progress)[0]

  // 逾期项目（daysLeft < 0 的未完成项目）
  const overdueProjects = projects.filter((p) => p.daysLeft < 0 && p.status !== 'archived' && p.status !== 'done')

  AI_FACTS.projectCount = projects.length
  AI_FACTS.tasks = { total, done, todo, rate: total ? Math.round((done / total) * 100) : 0 }
  AI_FACTS.globalAvg = averageProgress
  AI_FACTS.dom = dom
  AI_FACTS.stats = { active, risk, done: doneProjects, averageProgress }
  AI_FACTS.lateCount = overdueProjects.length
  AI_FACTS.dueFirst = dueFirst
  AI_FACTS.dueTop2 = dueTop2
  AI_FACTS.budgetTotal = 0
  AI_FACTS.laggard = {
    life: laggardOf('life'),
    work: laggardOf('work'),
    learn: laggardOf('learn'),
  }
}

/** 摘要行 —— 助手栏状态 */
export function aiScopeLine(): string {
  const f = AI_FACTS
  if (!f.projectCount) return '还没有项目数据'
  return `${f.projectCount} 个项目 · 平均进度 ${f.stats.averageProgress}% · 任务完成率 ${f.tasks.rate}%`
}
