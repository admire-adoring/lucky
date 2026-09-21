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
 * ⚠️ 「工作台」的 path 是 `/` —— 工作台不是「九个模块之一」，它是这张地图本身。
 *    原型里 9 个侧栏把它排在第 1 项，所以这里照排；但它的页面仍由工作台自己渲染
 *    （九宫环那套，见 pages/WorkbenchPage.tsx），不套这一层外壳。
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
      { key: 'dashboard', label: '工作台', path: '/' },
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
  dashboard: '/',
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
