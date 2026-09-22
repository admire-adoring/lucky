import type { WorkspaceModuleKey } from './types'

/**
 * 「模块工作区」外壳的导航 —— 5 个分组、9 个菜单项。
 *
 * 事实源是 `design/*_index.html` 的 `.sidebar`：9 个原型里那一栏**逐字一致**
 * （分组名、顺序、标签全同），所以这里只写一份。
 *
 * 与旧侧栏（`src/data/meta.ts` 的 NAV_GROUPS）的关系：那是 v1.0 的三分组，
 * 只有「项目」是真的能跳的，其余点了弹"未实现"。这里是有序的九域导航，
 * 与工作台环上的九个模块、Prism 的九组模块色槽**同一套口径**。
 *
 * ⚠️ 「工作台」有自己的页面了（`/home`），**不再是 `/` 的一个别名**。
 *    2026-09-22 把工作台也统一到侧栏那套外壳之后，它和其余八域一样有了分区
 *    （今日概览 / 最近活动 / AI 简报），而分区必须能深链 —— 所以它需要一段自己的基路径。
 *    `/` 仍然可用（重定向到 `/home`），老书签、以及 `EntryRedirect` 的落点都不受影响。
 */
export interface NavItem {
  key: WorkspaceModuleKey
  label: string
  path: string
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const WORKSPACE_NAV: NavGroup[] = [
  {
    label: '全局层',
    items: [
      { key: 'dashboard', label: '工作台', path: '/home' },
      { key: 'tasks', label: '任务清单', path: '/tasks' },
      { key: 'calendar', label: '日程', path: '/calendar' },
    ],
  },
  {
    label: '领域层',
    items: [
      { key: 'life', label: '生活', path: '/life' },
      { key: 'work', label: '工作', path: '/work' },
      { key: 'learning', label: '学习', path: '/learning' },
    ],
  },
  { label: '执行层', items: [{ key: 'projects', label: '项目', path: '/projects' }] },
  { label: '沉淀层', items: [{ key: 'knowledge', label: '知识库', path: '/knowledge' }] },
  { label: '支撑层', items: [{ key: 'settings', label: '设置', path: '/settings' }] },
]

/** 展开成一维，供「按 key 取标签」与「按路径找模块」用。 */
export const WORKSPACE_NAV_FLAT: NavItem[] = WORKSPACE_NAV.flatMap((group) => group.items)

/** 每个模块的路由前缀 —— 与 `docs/模块设计.md` 的路由口径一致。 */
export const MODULE_BASE_PATH: Record<WorkspaceModuleKey, string> = {
  dashboard: '/home',
  tasks: '/tasks',
  calendar: '/calendar',
  life: '/life',
  work: '/work',
  learning: '/learning',
  projects: '/projects',
  knowledge: '/knowledge',
  settings: '/settings',
}

export function navLabel(key: WorkspaceModuleKey): string {
  return WORKSPACE_NAV_FLAT.find((item) => item.key === key)?.label ?? key
}
