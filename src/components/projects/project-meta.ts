import type { ProjectPatch } from '../../api/projects'
import type { Priority, Project, ProjectStatus, Scope, ScopeFilter, SortMode, ViewMode } from '../../types'

/**
 * 项目卡 / 项目弹窗共用的标签与选项表 —— 原型 `project_index.html` 顶上那几张常量表。
 *
 * 与 `data/meta.ts` 的 `SCOPE_META` / `STATUS_META` / `PRIORITY_META` 不是同一套：
 *    那几张服务的是 Tailwind 工具类那一代组件（旧列表页 / 工作台），文案也不同
 *    （「待启动」对「规划中」、「高」对「P0」）。这一套是项目页与它的弹窗读的，
 *    两份并存是既有事实，不要互相转写 —— 转写会把两种文案混在同一个页面上。
 *
 * 枚举只在这一个文件里定义。原型的弹窗就是这么做的：
 *    `PM_STATUSES` 直接列 `STATUS_LABEL` 的键 —— 否则加了新状态（「已归档」正是这么加进来的）
 *    之后弹窗里选不到它，而列表已经能筛出它了。
 */

export const SCOPE_LABEL: Record<Scope, string> = { life: '生活', work: '工作', learn: '学习' }
export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: '规划中',
  active: '进行中',
  risk: '风险阻塞',
  done: '已完成',
  archived: '已归档',
}

/**
 * 状态徽标只复用已有的四支，不新造一套。
 *
 * 归档与"规划中"同用中性灰：两者都是"还没（或不再）进到台面中央"，只是方向相反。
 * 给归档另配一支颜色的话，它会与"风险"抢读 —— 而这个页面的色权要留给状态本身。
 */
export const STATUS_BADGE: Record<ProjectStatus, string> = {
  planning: 'badge-neutral',
  active: 'badge-doing',
  risk: 'badge-danger',
  done: 'badge-ok',
  archived: 'badge-neutral',
}

export const PRIO_LABEL: Record<Priority, string> = { high: 'P0', mid: 'P1', low: 'P2' }
export const PRIO_CLASS: Record<Priority, string> = { high: 'prio-P0', mid: 'prio-P1', low: 'prio-P2' }

/** 状态组（`''` = 本组不筛，理由见 `ProjectFilter.status`）。顺序即 chip 的顺序 */
export const STATUS_FACETS: Array<{ key: '' | ProjectStatus; label: string }> = [
  { key: '', label: '全部' },
  { key: 'active', label: '进行中' },
  { key: 'risk', label: '风险阻塞' },
  { key: 'done', label: '已完成' },
  { key: 'archived', label: '已归档' },
]

/** 类型组（`'all'` = 本组不筛） */
export const SCOPE_FACETS: Array<{ key: ScopeFilter; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'life', label: '生活' },
  { key: 'work', label: '工作' },
  { key: 'learn', label: '学习' },
]

export const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'default', label: '默认排序' },
  { value: 'due', label: '截止最近' },
  { value: 'progress', label: '进度最高' },
  { value: 'priority', label: '优先级最高' },
]

export const VIEW_OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: 'cards', label: '卡片' },
  { value: 'table', label: '表格' },
  /* 取值是应用既有的 `ViewMode`（`cards | table | kanban`），不是原型脚本里那个
     `projView = 'cards' | 'table' | 'board'` —— 三者对应的是同一种视图、同一个标签，
     而这一支类型是全站共用的（`ui-store` 与工作模块的项目抽屉都读它）。
     原型那个 `board` 只是它自己的内部键，改类型去对齐它要连带改三处，不值。 */
  { value: 'kanban', label: '看板' },
]

/** 看板四栏的次序。与任务看板的三栏不同 —— 项目是按状态分栏的。
 *  不含「已归档」：归档是从台面上收走，它不该再占看板的一栏（原型同此）。 */
export const BOARD_ORDER: ProjectStatus[] = ['planning', 'active', 'risk', 'done']

/* ---------- 编辑弹窗的下拉项 ---------- */

export const FORM_SCOPES: Array<{ value: Scope; label: string }> = [
  { value: 'life', label: '生活' },
  { value: 'work', label: '工作' },
  { value: 'learn', label: '学习' },
]

export const FORM_PRIORITIES: Array<{ value: Priority; label: string }> = [
  { value: 'high', label: 'P0 · 最高' },
  { value: 'mid', label: 'P1 · 中' },
  { value: 'low', label: 'P2 · 低' },
]

/** 状态这一列直接吃 `STATUS_LABEL` 的键 —— 加了新状态就不必再改这里 */
export const FORM_STATUSES: ProjectStatus[] = ['planning', 'active', 'risk', 'done', 'archived']

/**
 * 一条项目 → 弹窗的表单值（编辑模式用；新建模式用 `api/projects.ts` 的 `blankProjectPatch`）。
 *
 * 多值字段拷一份数组：表单是"草稿"，直接引用原数组的话，
 *    点一个胶囊就改到了数据里那一条（提交前就已经生效，取消也回不去）。
 * `path` 落成 `''` 而不是 `undefined` —— 输入框的 `value` 不接受 undefined
 *    （受控/非受控切换的经典坑）。
 */
export function formValueOf(project: Project): ProjectPatch {
  return {
    name: project.name,
    description: project.description,
    scope: project.scope,
    priority: project.priority,
    status: project.status,
    dueDate: project.dueDate,
    tags: [...project.tags],
    owners: [...project.owners],
    milestone: project.milestone,
    path: project.path ?? '',
  }
}
