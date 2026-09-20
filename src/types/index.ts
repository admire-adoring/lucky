/** 三域：生活 / 工作 / 学习 */
export type Scope = 'life' | 'work' | 'learn'

/** 项目状态（与后端枚举对齐） */
export type ProjectStatus = 'planning' | 'active' | 'risk' | 'done'

/** 优先级（与后端枚举对齐） */
export type Priority = 'high' | 'mid' | 'low'

/** 任务状态 */
export type TaskStatus = 'todo' | 'doing' | 'blocked' | 'done'

/** 里程碑状态 */
export type MilestoneState = 'done' | 'now' | 'todo'

export type ViewMode = 'cards' | 'table' | 'kanban'
export type SortMode = 'default' | 'due' | 'progress' | 'priority'
export type ScopeFilter = 'all' | Scope
export type DetailTab = 'overview' | 'tasks' | 'milestones' | 'docs' | 'timeline'

export type IconName =
  | 'i-life'
  | 'i-work'
  | 'i-learn'
  | 'i-project'
  | 'i-knowledge'
  | 'i-settings'
  | 'i-search'
  | 'i-bell'
  | 'i-plus'
  | 'i-grid'
  | 'i-list'
  | 'i-kanban'
  | 'i-calendar'
  | 'i-check'
  | 'i-check-xs'
  | 'i-check-strong'
  | 'i-check-circle'
  | 'i-more'
  | 'i-chevron'
  | 'i-arrow-right'
  | 'i-clock'
  | 'i-alert'
  | 'i-users'
  | 'i-download'
  | 'i-hamburger'
  | 'i-trend'
  | 'i-layer'
  | 'i-play'
  | 'i-empty'
  | 'i-file'
  | 'i-link'
  | 'i-flag'
  | 'i-lock'
  | 'i-git'
  | 'i-layers'
  | 'i-layers-3'
  | 'i-edit'
  | 'i-share'
  | 'i-github'
  | 'i-mail'
  | 'i-eye'
  // 自绘窗口控制（原生标题栏已关闭，见 src-tauri/tauri.conf.json 的 decorations）
  // Windows / Linux 字形
  | 'i-win-min'
  | 'i-win-max'
  | 'i-win-restore'
  | 'i-win-close'
  // macOS 圆点内部的字形（笔画更粗，见 IconSprite 注释）
  | 'i-mac-close'
  | 'i-mac-min'
  | 'i-mac-full'
  // 账户菜单
  | 'i-user'
  | 'i-settings'
  | 'i-logout'
  // 工作台：主题切换（日/月）与助手头像（星芒）
  | 'i-sun'
  | 'i-moon'
  | 'i-spark'

/**
 * 项目 —— 统一执行层的唯一模型，用 scope 隔离归属。
 * 与 docs/模块设计.md 的 Project 结构保持一致。
 */
export interface Project {
  id: string
  ownerId: string
  scope: Scope
  name: string
  description: string
  status: ProjectStatus
  priority: Priority
  progress: number
  tags: string[]
  startDate: string
  dueDate: string
  /** 列表页短日期，如「10月01日」 */
  dueShort: string
  /** 详情页长日期，如「2026年10月01日」 */
  dueLong: string
  /** 距截止日期的天数，负数表示已过期 */
  daysLeft: number
  tasksDone: number
  tasksTotal: number
  owners: string[]
  milestone: string
  budget: string
  visibility: string
  repoUrl: string
  docsUrl: string
  risk: ProjectRisk | null
}

export interface ProjectRisk {
  title: string
  description: string
}

export interface Task {
  id: string
  name: string
  status: TaskStatus
  priority: Priority
  owner: string
  due: string
  late: boolean
}

export interface Milestone {
  id: string
  name: string
  state: MilestoneState
  date: string
  detail: string
}

export interface DocumentItem {
  id: string
  name: string
  source: string
  summary: string
  updatedAt: string
}

export interface ActivityItem {
  id: string
  who: string
  action: string
  time: string
}

export interface ProjectDetail {
  project: Project
  tasks: Task[]
  milestones: Milestone[]
  documents: DocumentItem[]
  activity: ActivityItem[]
}

export interface AuthUser {
  name: string
  email: string
  initials: string
}

export interface Toast {
  id: number
  message: string
}
