/** 三域：生活 / 工作 / 学习 */
export type Scope = 'life' | 'work' | 'learn'

/**
 * 项目状态（与后端枚举对齐）。
 *
 * `archived`（已归档）不是 `done` 的另一种说法，两者的区别是"台面上还有没有它"：
 *    · `done`     = 做完了，但仍是这一域的成果，出现在「已完成」里、也出现在「全部」里；
 *    · `archived` = 从台面上收走（软删除），「全部」不含它，它自己有一项筛选项。
 *    判据收口在 `lib/filter-projects.ts` 的 `STATUS_MATCH` / `isClosed` 两处 ——
 *    别在各处再写 `status !== 'done'`，那句话现在会漏掉归档。
 */
export type ProjectStatus = 'planning' | 'active' | 'risk' | 'done' | 'archived'

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
  | 'i-chevron-right'
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
  | 'i-archive'
  | 'i-trash'
  | 'i-refresh'
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
  /**
   * 本地目录（可选）。
   *
   * 可选不是数据不齐，是事实如此：只有"落盘在某个目录里"的项目才有它
   *    （「团队 OKR」「年度体检」本来就没有一个目录可指）。
   *    所以读它的一律是"有才显示"，不给 `—` 占位 —— 缺一项却留个空壳，看着像渲染坏了。
   */
  path?: string
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

/**
 * 文档种类 —— 文档列表页（`design/work/work_project_detail_document.html`）的子类轴。
 *
 * 与 `DocumentItem.source`（腾讯文档 / 语雀 / …）是两件不同的事：
 *    `source` = 这篇东西存在哪儿，`kind` = 它是什么。
 *    列表页左边的子类栏筛的是后者，所以两者都留在数据上，谁也别替谁。
 *    7 个取值与原型 `TYPE_MAP` 一一对应，顺序也照它（栏里的次序由 `DOC_KINDS` 给）。
 */
export type DocKind = 'plan' | 'design' | 'api' | 'test' | 'spec' | 'research' | 'ref'

/**
 * 关联的意图 —— 一条边一种意图，每种意图只指向一族目标（`content-pool.ts` 的
 * `links` 逐条声明，`derive.ts` 的 `resolveDocLink` 按它解析）：
 *
 *   `out`  产出 → 工作项（任务）  这份文档拆出 / 决定了哪几个任务
 *   `risk` 风险 → 问题清单        这份文档要处理的那几条（词随项目类型走：Bug / 风险 / 问题）
 *   `meet` 会议 → 会议            这份文档是哪场会的产物
 *   `bind` 约定 · `ref` 参考 → 另一篇文档
 *
 * 服务器 / 账户不接：它们与文档的关系在「运维」那一格已经表达过（部署文档就挂在
 *    那台机器旁边），搬到这里要另编一套语义。
 */
export type DocLinkKind = 'out' | 'risk' | 'meet' | 'bind' | 'ref'

/** 目标族。与 `DocLinkKind` 一一对应、不自由组合：out→task、risk→bug、meet→meeting、bind/ref→doc */
export type DocLinkFamily = 'task' | 'bug' | 'meeting' | 'doc'

/**
 * 一条关联（边）。
 *
 * 目标存 id + 一份给人读的快照，不是"只存 id、渲染时联查"：
 *    · 文档在本仓是索引（正文留在原工具里）⇒ 关联天生是快照性质；
 *    · 图谱与详情屏要的都是"这条边通向谁、它现在什么读数"，只存 id 就得把任务 / 问题 /
 *      会议三组数据也塞进这一格的 props 里再解析一遍。
 * 反链（`back`）不手挂：它由所有文档的 `links` 扫出来（谁指向我）——
 *    挂两份迟早对不上（与"真双链做不了、能做的是显式关联 + 自动反链"同一条口径）。
 */
export interface DocLink {
  kind: DocLinkKind
  family: DocLinkFamily
  /** 目标那条的 id（任务 / 问题 / 会议 / 另一篇文档） */
  id: string
  /** 目标的名字。文档名不带书名号，加不加由渲染那一层决定 */
  label: string
  /** 它自己的读数：任务＝状态或截止 · 问题＝状态 · 会议＝月日 · 文档＝类型名 */
  meta: string
}

export interface DocumentItem {
  id: string
  name: string
  /** 种类（子类轴）。来源是内容池里声明的，不是按哈希轮转出来的，见 `content-pool.ts` */
  kind: DocKind
  /**
   * 模块 —— 筛选栏「模块 → 功能」两层目录里粗的那一层。
   * 它是内容数据（各 scope 自己的一小组），不是 `DocKind` 那样的枚举：
   *    顺序从池子去重保序取，不写顺序表，也不按"哪类多"重排（位置稳定才找得到）。
   */
  module: string
  /** 功能点 —— 细的那一层。一个模块下的一小组（登录鉴权 / 迁移与发布 …） */
  func: string
  /** 手挂的关联（出边）。派生时就解析成 `DocLink`（目标解析不到的那条直接丢） */
  links: DocLink[]
  /** 谁指向我（反链）。算出来的，见 `buildDocuments` 末尾那一段 */
  back: DocLink[]
  /** 存在的工具（腾讯文档 / 语雀 / Git 仓库 / 本地 Markdown） */
  source: string
  summary: string
  /** 给人读的「多久没更新」。由 `updatedHours` 算（`docUpdatedText()`），不单独维护 */
  updatedAt: string
  /**
   * 距上次更新多少小时 —— 排序与"是不是新文档"用的是它。
   * 留着它而不是再加一个 `isNew` 布尔：那个布尔是 `hours < 24` 的复制品，
   *    两个字段迟早会有一个忘了改。判据写在 `DocLibrary` 的 `isNew()`。
   */
  updatedHours: number
  /** 负责人。取项目负责人轮转，与 `buildActivity` / `buildMeetings` 同一条口径 */
  author: string
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
  /**
   * 附带动作（如删除后的「撤销」）。
   *
   * 带动作的提示停留更久（见 `ToastHost`）：撤销是"要看清楚再点"的动作，
   *    破坏性操作必须留够后悔的时间 —— 2200ms 那档是给"知道了"这类提示的。
   */
  action?: { label: string; onClick: () => void }
}
