import { invoke } from '@tauri-apps/api/core'
import { call } from './error'
import { dueText } from '../data/derive'
import { VISIBILITY_META } from '../data/meta'
import type { ActivityItem, Milestone, MilestoneState, Priority, Project, ProjectDetail, ProjectStatus, Scope, Task, TaskStatus } from '../types'

/**
 * 数据访问层 —— 项目域。全部走真实后端（Tauri invoke → SQLite）。
 */

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
}

/** 项目表单提交的那几项 */
export interface ProjectPatch {
  name: string
  description: string
  scope: Scope
  priority: Priority
  status: ProjectStatus
  dueDate: string
  tags: string[]
  owners: string[]
  milestone: string
  path: string
}

const DAY_MS = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')

interface RawProject {
  id: string
  ownerId: string
  scope: string
  name: string
  description: string
  status: string
  priority: string
  progress: number
  milestone: string
  startDate: string
  dueDate: string
  budgetCents: number | null
  visibility: string
  repoUrl: string | null
  docsRef: string | null
  path: string | null
  sortOrder: number
  createdAt: string
  updatedAt: string
  owners: string[]
  tags: string[]
  tasksTotal: number
  tasksDone: number
  risk: { title: string; description: string } | null
}

interface RawTask {
  id: string
  scope: string
  projectId: string | null
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
}

interface RawMilestone {
  id: string
  projectId: string
  name: string
  state: string
  dueDate: string | null
  detail: string
  sortOrder: number
}

interface RawActivity {
  id: string
  projectId: string
  actorId: string | null
  who: string
  action: string
  at: string
}

function startOfToday(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

function atMidnight(iso: string | null): number | null {
  if (!iso) return null
  const at = new Date(`${iso}T00:00:00`).getTime()
  return Number.isNaN(at) ? null : at
}

function cnDate(at: number): string {
  const d = new Date(at)
  return `${d.getFullYear()}年${pad(d.getMonth() + 1)}月${pad(d.getDate())}日`
}

function toProject(raw: RawProject): Project {
  const due = atMidnight(raw.dueDate)
  const start = atMidnight(raw.startDate)
  return {
    id: raw.id,
    ownerId: raw.ownerId,
    scope: raw.scope as Scope,
    name: raw.name,
    description: raw.description,
    status: raw.status as ProjectStatus,
    priority: raw.priority as Priority,
    progress: raw.progress,
    tags: raw.tags,
    startDate: start == null ? '' : cnDate(start),
    dueDate: raw.dueDate,
    dueShort: due == null ? raw.dueDate : `${new Date(due).getMonth() + 1}月${pad(new Date(due).getDate())}日`,
    dueLong: due == null ? raw.dueDate : cnDate(due),
    daysLeft: due == null ? 0 : Math.round((due - startOfToday()) / DAY_MS),
    tasksDone: raw.tasksDone,
    tasksTotal: raw.tasksTotal,
    owners: raw.owners,
    milestone: raw.milestone,
    budget: raw.budgetCents == null ? '—' : `¥${(raw.budgetCents / 100).toLocaleString('zh-CN')}`,
    visibility: VISIBILITY_META[raw.visibility] ?? raw.visibility,
    repoUrl: raw.repoUrl ?? '—',
    docsUrl: raw.docsRef ?? '',
    path: raw.path ?? undefined,
    risk: raw.risk,
  }
}

function toTask(raw: RawTask): Task {
  const due = atMidnight(raw.dueAt)
  const done = raw.completedAt ? new Date(raw.completedAt).getTime() : null
  const today = startOfToday()
  const dueDays = due == null ? 0 : Math.round((due - today) / DAY_MS)
  const doneDays =
    done == null || Number.isNaN(done) ? null : Math.round((atMidnight(new Date(done).toISOString().slice(0, 10))! - today) / DAY_MS)
  const finished = raw.state === 'done'
  return {
    id: raw.id,
    name: raw.title,
    status: raw.state as TaskStatus,
    priority: raw.priority as Priority,
    owner: raw.ownerCode ?? '',
    due: finished ? '已完成' : dueText(dueDays),
    late: !finished && dueDays < 0,
    dueDays,
    doneDays,
  }
}

function toMilestone(raw: RawMilestone): Milestone {
  return {
    id: raw.id,
    name: raw.name,
    state: raw.state as MilestoneState,
    date: raw.dueDate ?? '',
    detail: raw.detail,
  }
}

function toActivity(raw: RawActivity): ActivityItem {
  return {
    id: raw.id,
    who: raw.who || '我',
    action: raw.action,
    time: raw.at,
  }
}

function toInput(patch: ProjectPatch) {
  return {
    name: patch.name,
    description: patch.description,
    scope: patch.scope,
    priority: patch.priority,
    status: patch.status,
    dueDate: patch.dueDate,
    tags: patch.tags,
    owners: patch.owners,
    milestone: patch.milestone,
    path: patch.path.trim() || null,
  }
}

function isoOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function fetchProjects(): Promise<Project[]> {
  return call(() => invoke<RawProject[]>('project_list').then((rows) => rows.map(toProject)))
}

export function fetchProjectDetail(id: string | undefined): Promise<ProjectDetail> {
  if (!id) throw new Error('缺少项目 id')
  return call(async () => {
    const project = toProject(await invoke<RawProject>('project_get', { id }))
    const tasks = (await invoke<RawTask[]>('task_list', { projectId: project.id })).map(toTask)
    const milestones = (await invoke<RawMilestone[]>('project_milestone_list', { projectId: project.id })).map(toMilestone)
    const activity = (await invoke<RawActivity[]>('project_list_activity', { projectId: project.id, limit: 20 })).map(toActivity)
    return {
      project,
      tasks,
      milestones,
      activity,
      documents: [],
    }
  })
}

export function createProject(patch: ProjectPatch): Promise<Project> {
  return call(() => invoke<RawProject>('project_create', { input: toInput(patch) }).then(toProject))
}

export function updateProject(id: string, patch: ProjectPatch): Promise<Project> {
  return call(() => invoke<RawProject>('project_update', { id, input: toInput(patch) }).then(toProject))
}

export function setProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
  return call(() => invoke<RawProject>('project_set_status', { id, status }).then(toProject))
}

export function deleteProject(id: string): Promise<void> {
  return call(() => invoke<void>('project_delete', { id }))
}

export function blankProjectPatch(scope: Scope): ProjectPatch {
  const today = new Date()
  const due = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30)
  return {
    name: '',
    description: '',
    scope,
    priority: 'mid',
    status: 'planning',
    dueDate: isoOf(due),
    tags: [],
    owners: ['LY'],
    milestone: '',
    path: '',
  }
}

/* —— 里程碑 CRUD —— */

export interface MilestonePatch {
  name: string
  state: MilestoneState
  dueDate: string | null
  detail: string
}

export function fetchMilestones(projectId: string): Promise<Milestone[]> {
  return call(() => invoke<RawMilestone[]>('project_milestone_list', { projectId }).then((rows) => rows.map(toMilestone)))
}

export function createMilestone(projectId: string, patch: MilestonePatch): Promise<Milestone> {
  return call(() => invoke<RawMilestone>('project_milestone_create', { projectId, input: patch }).then(toMilestone))
}

export function updateMilestone(id: string, patch: MilestonePatch): Promise<Milestone> {
  return call(() => invoke<RawMilestone>('project_milestone_update', { id, input: patch }).then(toMilestone))
}

export function setMilestoneState(id: string, state: MilestoneState): Promise<Milestone> {
  return call(() => invoke<RawMilestone>('project_milestone_set_state', { id, state }).then(toMilestone))
}

export function deleteMilestone(id: string): Promise<void> {
  return call(() => invoke<void>('project_milestone_delete', { id }))
}

/* —— 动态流 —— */

export function fetchProjectActivity(projectId: string, limit?: number): Promise<ActivityItem[]> {
  return call(() => invoke<RawActivity[]>('project_list_activity', { projectId, limit: limit ?? null }).then((rows) => rows.map(toActivity)))
}

/** 跨项目最近动态（工作台首页用），带项目名 */
export interface RecentActivity extends ActivityItem {
  projectId: string
  projectName: string
}

interface RawRecentActivity extends RawActivity {
  projectName: string
}

export function fetchRecentActivity(limit: number = 12): Promise<RecentActivity[]> {
  return call(() =>
    invoke<RawRecentActivity[]>('project_recent_activity', { limit }).then((rows) =>
      rows.map((raw) => ({
        id: raw.id,
        projectId: raw.projectId,
        projectName: raw.projectName,
        who: raw.who || '我',
        action: raw.action,
        time: raw.at,
      })),
    ),
  )
}
