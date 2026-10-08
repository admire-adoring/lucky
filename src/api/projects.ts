import { buildActivity, buildDocuments, buildMilestones, buildTasks } from '../data/derive'
import { FALLBACK_PROJECT_ID, PROJECTS } from '../data/projects'
import type { Priority, Project, ProjectDetail, ProjectStatus, Scope } from '../types'

/**
 * 数据访问层。
 * 当前用仓库内的静态数据模拟一个异步后端；接入真实服务时只需替换本文件的实现，
 * 上层的 TanStack Query hooks 与组件无需改动。
 */
const LATENCY_MS = 260

function respond<T>(value: T, ms: number = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms)
  })
}

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
}

export function fetchProjects(): Promise<Project[]> {
  /* 每次回一份浅拷贝：列表里可能就地排序，而调用方拿到的应当是一份快照 ——
     写操作之后靠 invalidate 重新取，而不是靠某个引用在背后悄悄变了 */
  return respond([...PROJECTS])
}

export function fetchProjectDetail(id: string | undefined): Promise<ProjectDetail> {
  // 与原型保持一致：id 不匹配时回落到 p1（接后端后此处应改为抛 404）
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

/* ============================================================
   写操作 —— 当前是内存里的假后端
   ------------------------------------------------------------
   改的是 `data/projects.ts` 那份种子数组本体，不是另存一份 `store`：
      它是全应用唯一的事实源（`data/ai/facts.ts` 的助手事实、`derive` 的派生、
      详情页的查找都读它）。另存一份的话，编辑完一个项目就会出现
      "列表是新的、助手说的是旧的"这种两套账。刷新即回到种子（原型同此），
      接真实服务时把这四个函数换成请求即可。
   ============================================================ */

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
  /** 本地目录。`''` = 没填 —— 写回时落成 `undefined`（"没有"与"空字符串"是两回事） */
  path: string
}

/**
 * 数据里的"今天" —— 与种子数据 `daysLeft` 用的是同一天（快照日）。
 *
 * 不取真实今天：真实今天会让"同一个截止日在不同卡片上算出不同的剩余天数"，
 *    编辑完一个项目顺带把它自己挪到另一条时间线上（原型同一判据）。
 */
const DATA_TODAY = new Date('2026-09-18T00:00:00')
const DAY_MS = 86_400_000

/** 改截止日 = 连带重算「10月01日」与「剩 N 天」—— 它们是同一件事的三种写法，
 *  只改一处必然出现"截止写 12月31日、右边还写着剩 13 天"。 */
function syncDue(project: Project, dueDate: string): void {
  const date = new Date(`${dueDate}T00:00:00`)
  if (Number.isNaN(date.getTime())) return

  const pad = (n: number) => String(n).padStart(2, '0')
  project.dueDate = dueDate
  project.dueShort = `${date.getMonth() + 1}月${pad(date.getDate())}日`
  project.dueLong = `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日`
  project.daysLeft = Math.round((date.getTime() - DATA_TODAY.getTime()) / DAY_MS)
}

/** 本地日期的 ISO（不用 `toISOString`：那是 UTC，+8 时区会把"今天+30 天"算成少一天） */
function isoOf(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

/** 新建表单的初值。没有 id 也先算好截止日 —— 弹窗里那个日期框不能是空的。 */
export function blankProjectPatch(scope: Scope): ProjectPatch {
  const due = isoOf(new Date(DATA_TODAY.getTime() + 30 * DAY_MS))
  return {
    name: '',
    description: '',
    scope,
    priority: 'mid',
    status: 'planning',
    dueDate: due,
    tags: [],
    owners: ['LY'],
    milestone: '',
    path: '',
  }
}

/**
 * 新建 —— 造一条与真项目完全同构的记录（卡片 / 筛选 / 详情都按同一形状读它）。
 *
 * 几个字段必须是"说得过去的默认值"而不是空串：新建的项目点进详情不能是空白页，
 *    所以 `owners` / `milestone` / `visibility` 这些"详情态一定要显示"的字段给默认值
 *    （原型同一判据：空字符串会让详情页那几行看起来像坏了）。
 * `progress` / `tasksTotal` 给 0 是对的：它确实还没有任务，
 *    卡片上因此显示"还没有任务"而不是"0/0 任务"（两句都是真的，前者更像人话）。
 */
function blankProject(scope: Scope): Project {
  const due = isoOf(new Date(DATA_TODAY.getTime() + 30 * DAY_MS))
  const pad = (n: number) => String(n).padStart(2, '0')
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
    startDate: `${DATA_TODAY.getFullYear()}年${pad(DATA_TODAY.getMonth() + 1)}月${pad(DATA_TODAY.getDate())}日`,
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
  /* 三种日期写法一次算齐（弹窗里改过截止日也一样走这条） */
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

export function createProject(patch: ProjectPatch): Promise<Project[]> {
  const project = blankProject(patch.scope)
  applyPatch(project, patch)
  PROJECTS.unshift(project)
  return respond([...PROJECTS])
}

export function updateProject(id: string, patch: ProjectPatch): Promise<Project[]> {
  const project = PROJECTS.find((item) => item.id === id)
  if (!project) return Promise.reject(new Error('项目不存在'))

  applyPatch(project, patch)
  return respond([...PROJECTS])
}

/**
 * 归档 / 恢复 / 撤销归档 —— 三处都是换一个 status，不是另起一个 `archived: true` 布尔：
 * 它要能被「已归档」筛出来、被「全部」排除、不再占"未收口"的名额 ——
 * 三件事 `ProjectStatus` 已经在管；另起一个布尔就得在四处分别补判据，迟早漏一处。
 *
 * 所以这里只有一个函数、而不是 `archiveProject` + `restoreProject` 两个：
 *    「撤销归档」要回到归档前那个状态（它不一定是"进行中"），
 *    而那个状态只有调用方知道 —— 拆成两个具名函数就表达不了"回到 prev"这件事。
 */
export function setProjectStatus(id: string, status: ProjectStatus): Promise<Project[]> {
  const project = PROJECTS.find((item) => item.id === id)
  if (!project) return Promise.reject(new Error('项目不存在'))
  project.status = status
  return respond([...PROJECTS])
}

/** 删除时返回的"取回凭据"：撤销要把它插回原来的位置，
 *  位置一变"撤销"看起来就没生效（列表顺序跳了）。 */
export interface RemovedProject {
  project: Project
  index: number
}

export function deleteProject(id: string): Promise<RemovedProject> {
  const index = PROJECTS.findIndex((item) => item.id === id)
  if (index < 0) return Promise.reject(new Error('项目不存在'))

  const [project] = PROJECTS.splice(index, 1)
  return respond({ project: project as Project, index })
}

export function insertProject(removed: RemovedProject): Promise<Project[]> {
  PROJECTS.splice(removed.index, 0, removed.project)
  return respond([...PROJECTS])
}

/** 演示账号 —— 原型已预填，点击登录即可进入 */
export const DEMO_ACCOUNT = {
  email: 'me@lucky-y.app',
  password: 'lucky-y-2026',
}
