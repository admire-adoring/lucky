import { create } from 'zustand'
import type { ProjectStatus, ScopeFilter, SortMode, ViewMode } from '../types'

interface UiState {
  /**
   * 状态筛选。`''` 表示本组不筛，而不是 `null`。
   *
   * 取值与其它三个字段不同源：这里是原型的 `let projStatus = ''` 逐字搬过来的
   *    （`''` 就是那两组 chip 里的「全部」这一项的 key，见 `ProjectsListPage` 的
   *    `STATUS_FACETS`）。用 `''` 而不是 `'all'` 是因为「全部」在状态组里没有对应的
   *    `ProjectStatus`，硬造一个 `'all'` 会让 `status` 的类型变成三元组之外的第四个值。
   */
  status: '' | ProjectStatus
  /** scope 筛选（原型的类型组，`'all'` = 不筛。两组各有一个「全部」但取值不同源，见上条） */
  scope: ScopeFilter
  /** 视图：卡片 / 表格 / 看板 */
  view: ViewMode
  sort: SortMode
  /** 搜索关键词（已防抖后的值） */
  query: string
  /** ≤860px 时的侧边栏抽屉 */
  sidebarOpen: boolean
  /**
   * AI 助手抽屉（`components/ai-drawer/`）。
   *
   * 它是应用级的开合状态，不是某个页面的：抽屉挂在路由之外，
   *    而开关在顶栏（`ShellTopbar`）—— 两者不在同一棵子树里，只能走 store。
   *    放在这里而不是 `ai-store`：那边装的是会话（消息/草稿/生成中），
   *    这边装的是界面开合，与 `sidebarOpen` 同类。
   *    分开之后有一条好处：抽屉的开合不影响会话，会话的变化也不触发顶栏重渲染。
   */
  aiDrawerOpen: boolean

  setStatus: (status: '' | ProjectStatus) => void
  setScope: (scope: ScopeFilter) => void
  setView: (view: ViewMode) => void
  setSort: (sort: SortMode) => void
  setQuery: (query: string) => void
  openSidebar: () => void
  closeSidebar: () => void
  openAiDrawer: () => void
  closeAiDrawer: () => void
  toggleAiDrawer: () => void
  resetFilters: () => void
}

/**
 * 列表页 UI 状态：三视图切换不做路由，用 view 状态 + 懒渲染，
 * 这样切视图不会丢滚动位置（与原型 README 的落地建议一致）。
 *
 * 2026-09-27：这四个筛选字段（status / scope / view / sort / query）必须住在 store 里，
 *    不能退回页面局部 state —— 侧栏「概览」槽要读同一批数。原型把同样四个值放在
 *    模块级全局（`projStatus` / `projScope` / `projQuery` / `projSort` / `projView`），
 *    理由写在 `renderOverviewSlot` 上面那句：槽在另一栏，但说的是同一批数
 *    （"跟着筛选走"）。React 里两个组件不在同一棵子树里，只能走 store。
 *    代价是它同时被工作模块的项目抽屉（`ProjectDrawers`）读 —— 那一条本来就是共享的
 *    （sort 偏好跨页一致），不是这次新引入的耦合。
 */
export const useUiStore = create<UiState>((set) => ({
  status: '',
  scope: 'all',
  view: 'cards',
  sort: 'default',
  query: '',
  sidebarOpen: false,
  /* 默认关着：它是"叫它才出来"的伴生面板，不是常驻的一栏 */
  aiDrawerOpen: false,

  setStatus: (status) => set({ status }),
  setScope: (scope) => set({ scope }),
  setView: (view) => set({ view }),
  setSort: (sort) => set({ sort }),
  setQuery: (query) => set({ query }),
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
  openAiDrawer: () => set({ aiDrawerOpen: true }),
  closeAiDrawer: () => set({ aiDrawerOpen: false }),
  toggleAiDrawer: () => set((state) => ({ aiDrawerOpen: !state.aiDrawerOpen })),
  resetFilters: () => set({ status: '', scope: 'all', query: '' }),
}))
