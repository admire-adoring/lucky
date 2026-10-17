import { invoke } from '@tauri-apps/api/core'
import { buildActivity, buildDocuments, buildMilestones, buildTasks, dueText } from '../data/derive'
import { VISIBILITY_META } from '../data/meta'
import { FALLBACK_PROJECT_ID, PROJECTS } from '../data/projects'
import { isTauri } from '../lib/env'
import type { Priority, Project, ProjectDetail, ProjectStatus, Scope, Task, TaskStatus } from '../types'

/**
 * 数据访问层 —— 全应用唯一的数据源分派点。
 *
 * 两条路：桌面壳（Tauri）里走 `invoke` 打真实库；浏览器（`vite dev` / `dist` 预览）里
 * 回落 `data/projects.ts` 那份演示种子。判据是 `lib/env.ts` 的 `isTauri()`。
 * 上层的 TanStack Query hooks 与组件对两条路无感 —— 出参都是 `types/index.ts` 的形状。
 */
export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
}

/** 项目表单提交的那几项 —— 与原型 `submitProjectModal` 收的字段一致 */
export interface ProjectPatch {
  name: string
  description: string
  scope: Scope
  priority: Priority
  status: ProjectStatus
  dueDate: string
  /** 多值字段：草稿集合直接写回（不解析文本） */
  tags: string[]
  owners: string[]
  milestone: string
  /** 本地目录。`''` = 没填 —— 写回时落成 `null`（"没有"与"空字符串"是两回事） */
  path: string
}

const DAY_MS = 86_400_000
const pad = (n: number) => String(n).padStart(2, '0')

/* ============================================================================
   一、真实后端（Tauri）
   ----------------------------------------------------------------------------
   后端出参是表列形态（camelCase）；展示派生（日期三种写法 / 剩余天数 / 预算文案 /
   可见性中文 / 任务到期文案）全部在这一层算齐 —— 组件拿到的仍是原样的 `Project`。
   剩余天数按**本地日**算（不是 86400 秒的差），用的也是真实系统时间：
   换源之后没有"演示快照日"这回事了。
   ============================================================================ */

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

/** 「今天」的零点（本地时区）。 */
function startOfToday(): number {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
}

/** ISO 日期（`YYYY-MM-DD`）→ 当天零点的时间戳；解析不出来回 null。 */
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
    /* 已完成的不再谈哪天到期（与 `derive.buildTasks` 同一条），文案口径共用 `dueText` */
    due: finished ? '已完成' : dueText(dueDays),
    late: !finished && dueDays < 0,
    dueDays,
    doneDays,
  }
}

/**
 * 前端写形态 → 后端 `ProjectInput`。只传表单真有的那几项：
 * 缺省的（开始日期 / 进度 / 预算 / 可见性 / 仓库 / 资料）在 create 时由后端按 scope 推、
 * 在 update 时保留原值 —— 前端没显示的列不该被一次编辑清空。
 * `path` 例外：每次都传（表单总会带上它），清空就是清空（`'' → null`）。
 */
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

async function realFetchProjects(): Promise<Project[]> {
  const rows = await invoke<RawProject[]>('project_list')
  return rows.map(toProject)
}

async function realFetchProjectDetail(id: string | undefined): Promise<ProjectDetail> {
  if (!id) throw new Error('缺少项目 id')
  const project = toProject(await invoke<RawProject>('project_get', { id }))
  const tasks = (await invoke<RawTask[]>('task_list', { projectId: project.id })).map(toTask)
  return {
    project,
    tasks,
    /* 文档不在这里派生：它有自己的查询（`api/docs.ts` 的 `fetchDocs`，真实库 / 演示池两条路）。
       真实路径下给空数组 —— 不让这个字段变成"看着像数据的假数据"。 */
    documents: [],
    /* 里程碑 / 动态两族仍走前端派生：表里还没有数据、界面也还没有写入方。
       后端的读接口等它们各有入口时一并补。 */
    milestones: buildMilestones(project),
    activity: buildActivity(project),
  }
}

async function realCreateProject(patch: ProjectPatch): Promise<Project> {
  return toProject(await invoke<RawProject>('project_create', { input: toInput(patch) }))
}

async function realUpdateProject(id: string, patch: ProjectPatch): Promise<Project> {
  return toProject(await invoke<RawProject>('project_update', { id, input: toInput(patch) }))
}

async function realSetProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
  return toProject(await invoke<RawProject>('project_set_status', { id, status }))
}

async function realDeleteProject(id: string): Promise<void> {
  await invoke('project_delete', { id })
}

/* ============================================================================
   二、演示回落（浏览器）
   ----------------------------------------------------------------------------
   改的是 `data/projects.ts` 那份种子数组本体：它是演示态下唯一的事实源
   （`data/ai/facts.ts` 的助手事实与 `derive` 的派生都读它）。刷新即回到种子。
   ============================================================================ */

const LATENCY_MS = 260

function respond<T>(value: T, ms: number = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms)
  })
}

/**
 * 演示数据里的"今天" —— 与种子 `daysLeft` 用的是同一天（09-18 快照）。
 * 只有演示路径还在用它：真实数据按真实今天算。
 */
const DATA_TODAY = new Date('2026-09-18T00:00:00')

/** 本地日期的 ISO（不用 `toISOString`：那是 UTC，+8 时区会把"今天+30 天"算成少一天） */
function isoOf(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 改截止日 = 连带重算「10月01日」与「剩 N 天」—— 它们是同一件事的三种写法。 */
function syncDue(project: Project, dueDate: string): void {
  const date = new Date(`${dueDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return

  project.dueDate = dueDate
  project.dueShort = `${date.getMonth() + 1}月${pad(date.getDate())}日`
  project.dueLong = `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日`
  project.daysLeft = Math.round((date.getTime() - DATA_TODAY.getTime()) / DAY_MS)
}

function demoFetchProjects(): Promise<Project[]> {
  /* 每次回一份浅拷贝：列表里可能就地排序，而调用方拿到的应当是一份快照 */
  return respond([...PROJECTS])
}

function demoFetchProjectDetail(id: string | undefined): Promise<ProjectDetail> {
  const project = PROJECTS.find((item) => item.id === id) ?? PROJECTS.find((item) => item.id === FALLBACK_PROJECT_ID)

  if (!project) {
    return Promise.reject(new Error('项目数据未初始化'))
  }

  return respond({
    project,
    tasks: buildTasks(project),
    milestones: buildMilestones(project),
    documents: buildDocuments(project),
    activity: buildActivity(project),
  })
}

/**
 * 新建 —— 造一条与真项目完全同构的记录（卡片 / 筛选 / 详情都按同一形状读它）。
 * 几个字段必须是"说得过去的默认值"：新建的项目点进详情不能是空白页。
 */
function demoBlankProject(scope: Scope): Project {
  const due = isoOf(new Date(DATA_TODAY.getTime() + 30 * DAY_MS))
  const project: Project = {
    /* 与既有 p1…p8 不会撞：它们是一位数字，这里是 6 位时间戳尾数 */
    id: `p${Date.now().toString().slice(-6)}`,
    ownerId: 'me',
    scope,
    name: '',
    description: '',
    status: 'planning',
    priority: 'mid',
    progress: 0,
    tags: [],
    startDate: cnDate(DATA_TODAY.getTime()),
    dueDate: due,
    dueShort: '',
    dueLong: '',
    daysLeft: 0,
    tasksDone: 0,
    tasksTotal: 0,
    owners: ['LY'],
    milestone: '待定',
    budget: '—',
    visibility: scope === 'work' ? '工作内部' : '私有',
    repoUrl: '—',
    docsUrl: '',
    risk: null,
  }
  syncDue(project, due)
  return project
}

/** 把表单值写进一条记录 —— 编辑与新建共用（两处各写一遍，新加的字段迟早只落一处） */
function applyPatch(project: Project, patch: ProjectPatch): void {
  project.name = patch.name
  project.description = patch.description
  project.scope = patch.scope
  project.priority = patch.priority
  project.status = patch.status
  project.tags = [...patch.tags]
  project.owners = [...patch.owners]
  project.milestone = patch.milestone
  project.path = patch.path.trim() || undefined
  syncDue(project, patch.dueDate)
}

function demoCreateProject(patch: ProjectPatch): Promise<Project> {
  const project = demoBlankProject(patch.scope)
  applyPatch(project, patch)
  PROJECTS.unshift(project)
  return respond(project)
}

function demoUpdateProject(id: string, patch: ProjectPatch): Promise<Project> {
  const project = PROJECTS.find((item) => item.id === id)
  if (!project) return Promise.reject(new Error('项目不存在'))

  applyPatch(project, patch)
  return respond(project)
}

function demoSetProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
  const project = PROJECTS.find((item) => item.id === id)
  if (!project) return Promise.reject(new Error('项目不存在'))
  project.status = status
  return respond(project)
}

function demoDeleteProject(id: string): Promise<void> {
  const index = PROJECTS.findIndex((item) => item.id === id)
  if (index < 0) return Promise.reject(new Error('项目不存在'))

  PROJECTS.splice(index, 1)
  return respond(undefined)
}

/* ============================================================================
   三、分派 —— 上面两条路在这里合流，导出面只有这一层
   ============================================================================ */

export function fetchProjects(): Promise<Project[]> {
  return isTauri() ? realFetchProjects() : demoFetchProjects()
}

export function fetchProjectDetail(id: string | undefined): Promise<ProjectDetail> {
  return isTauri() ? realFetchProjectDetail(id) : demoFetchProjectDetail(id)
}

export function createProject(patch: ProjectPatch): Promise<Project> {
  return isTauri() ? realCreateProject(patch) : demoCreateProject(patch)
}

export function updateProject(id: string, patch: ProjectPatch): Promise<Project> {
  return isTauri() ? realUpdateProject(id, patch) : demoUpdateProject(id, patch)
}

/**
 * 归档 / 恢复 / 撤销归档 —— 三处都是换一个 status，不是另起一个 `archived: true` 布尔：
 * 它要能被「已归档」筛出来、被「全部」排除、不再占"未收口"的名额 —— 三件事
 * `ProjectStatus` 已经在管；另起一个布尔就得在四处分别补判据，迟早漏一处。
 */
export function setProjectStatus(id: string, status: ProjectStatus): Promise<Project> {
  return isTauri() ? realSetProjectStatus(id, status) : demoSetProjectStatus(id, status)
}

/**
 * 删除。**不可恢复**：落地成真实库之后，"撤销"没有对应的命令
 * （`project_delete` 是硬删，卫星表级联、任务回到收件箱）——
 * 界面上的撤销入口随这一次换源一并撤掉，不再承诺一件做不到的事。
 */
export function deleteProject(id: string): Promise<void> {
  return isTauri() ? realDeleteProject(id) : demoDeleteProject(id)
}

/** 新建表单的初值。截止日按**真实今天** + 30 天（弹窗里那个日期框不能是空的）。 */
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

/** 演示账号 —— 原型已预填，点击登录即可进入 */
export const DEMO_ACCOUNT = {
  email: 'me@lucky-y.app',
  password: 'lucky-y-2026',
}
