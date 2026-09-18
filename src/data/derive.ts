import { ACTIVITY_TIMES, DOC_SOURCES, POOL } from './content-pool'
import type { ActivityItem, DocumentItem, Milestone, MilestoneState, Project, Task, TaskStatus } from '../types'
import { PRIORITY_META } from './meta'

/** 稳定哈希（与原型一致，用于从内容池确定性取值） */
export function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

/** 从内容池按种子稳定取 count 项（池子不够时循环复用） */
function pick<T>(pool: readonly T[], seed: string, count: number): T[] {
  const h = hash(seed)
  const out: T[] = []
  for (let i = 0; i < count; i += 1) {
    out.push(pool[(h + i * 3) % pool.length] as T)
  }
  return out
}

/* ============================================================
   头像
   ------------------------------------------------------------
   列表页按「索引」着色（原型 projects.html 的 owners()），
   详情页按「名字哈希」着色（原型 project-detail.html 的 avatar()）。
   两者取色逻辑不同，为保持视觉一致这里都按原型原样复刻。
   ============================================================ */

const LIST_OWNER_HUES = [265, 215, 158]
const DETAIL_AVATAR_HUES = [265, 215, 158, 25, 340]

/** 列表卡片 / 表格 / 看板里的负责人头像底色 */
export function ownerAvatarStyle(index: number): string {
  const hue = LIST_OWNER_HUES[index % LIST_OWNER_HUES.length] as number
  return `linear-gradient(135deg,hsl(${hue},72%,64%),hsl(${hue - 30},68%,52%))`
}

/** 详情页里的头像底色 */
export function memberAvatarStyle(name: string): string {
  const hue = DETAIL_AVATAR_HUES[hash(name) % DETAIL_AVATAR_HUES.length] as number
  return `linear-gradient(135deg,hsl(${hue},72%,64%),hsl(${(hue + 330) % 360},68%,52%))`
}

const OWNER_NAMES: Record<string, string> = { LY: '刘阳' }

export function ownerDisplayName(code: string): string {
  return OWNER_NAMES[code] ?? code
}

/* ============================================================
   派生数据
   ============================================================ */

/** 任务：前 done 个已完成，随后 1-2 个进行中/阻塞，其余待办；未完成排在前面 */
export function buildTasks(project: Project): Task[] {
  const names = pick(POOL[project.scope].tasks, `${project.id}task`, project.tasksTotal)
  const list: Task[] = []

  for (let i = 0; i < project.tasksTotal; i += 1) {
    const status: TaskStatus =
      i < project.tasksDone
        ? 'done'
        : i < project.tasksDone + 2
          ? project.status === 'risk'
            ? 'blocked'
            : 'doing'
          : 'todo'

    const due =
      project.status === 'done'
        ? '已完成'
        : i % 5 === 0 && project.status === 'risk'
          ? '已逾期 2 天'
          : `${(i % 4) + 1} 天后`

    list.push({
      id: `${project.id}-t${i + 1}`,
      name: names[i] as string,
      status,
      priority: i % 4 === 0 ? 'high' : i % 3 === 0 ? 'mid' : 'low',
      owner: project.owners[i % project.owners.length] as string,
      due,
      late: due.includes('逾期'),
    })
  }

  // 未完成的任务排前面（Array.prototype.sort 稳定，组内保持原顺序）
  return list.sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0))
}

/** 里程碑：按整体进度决定已完成个数，下一个为进行中 */
export function buildMilestones(project: Project): Milestone[] {
  const names = POOL[project.scope].milestones
  const doneCount = Math.min(names.length, Math.max(0, Math.round((project.progress / 100) * names.length)))

  return names.map((name, i) => {
    const state: MilestoneState = i < doneCount ? 'done' : i === doneCount ? 'now' : 'todo'
    return {
      id: `${project.id}-m${i + 1}`,
      name,
      state,
      date: state === 'done' ? '已完成' : state === 'now' ? '进行中' : '待启动',
      detail: state === 'done' ? '已于计划内完成' : state === 'now' ? '当前所处阶段' : '等待前序阶段',
    }
  })
}

/** 文档索引：仅存索引与链接，正文留在原工具 */
export function buildDocuments(project: Project): DocumentItem[] {
  const seed = hash(project.id)
  return pick(POOL[project.scope].documents, `${project.id}doc`, 4).map((name, i) => ({
    id: `${project.id}-d${i + 1}`,
    name,
    source: DOC_SOURCES[(seed + i) % DOC_SOURCES.length] as string,
    summary: '索引与外部链接，正文由原工具维护',
    updatedAt: `${i * 2 + 1} 天前更新`,
  }))
}

/** 项目动态 */
export function buildActivity(project: Project): ActivityItem[] {
  return POOL[project.scope].activity.map((action, i) => ({
    id: `${project.id}-a${i + 1}`,
    who: project.owners[i % project.owners.length] as string,
    action,
    time: ACTIVITY_TIMES[i % ACTIVITY_TIMES.length] as string,
  }))
}

/* ============================================================
   列表页派生统计
   ============================================================ */

export interface ProjectStats {
  total: number
  active: number
  risk: number
  done: number
  averageProgress: number
  scopeSegments: { scope: Project['scope']; label: string; percent: number }[]
  scopeCounts: Record<Project['scope'], number>
}

export function computeStats(projects: Project[]): ProjectStats {
  const total = projects.length
  const scopeCounts = { life: 0, work: 0, learn: 0 }
  let progressSum = 0

  for (const project of projects) {
    scopeCounts[project.scope] += 1
    progressSum += project.progress
  }

  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100)

  return {
    total,
    active: projects.filter((p) => p.status === 'active').length,
    risk: projects.filter((p) => p.status === 'risk').length,
    done: projects.filter((p) => p.status === 'done').length,
    averageProgress: total === 0 ? 0 : Math.round(progressSum / total),
    scopeSegments: [
      { scope: 'life', label: '生活', percent: pct(scopeCounts.life) },
      { scope: 'work', label: '工作', percent: pct(scopeCounts.work) },
      { scope: 'learn', label: '学习', percent: pct(scopeCounts.learn) },
    ],
    scopeCounts,
  }
}

/** 截止日期临近（≤14 天且未完成）时高亮 */
export function isDueSoon(project: Project): boolean {
  return project.status !== 'done' && project.daysLeft >= 0 && project.daysLeft <= 14
}

/** 卡片上“逾期/临近”的警示样式只对非风险中项目生效（原型 card 的判断） */
export function isCardDueWarn(project: Project): boolean {
  return project.status !== 'done' && project.status !== 'risk' && project.daysLeft >= 0 && project.daysLeft <= 14
}

export function priorityRank(project: Project): number {
  return PRIORITY_META[project.priority].rank
}
