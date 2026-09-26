import { create } from 'zustand'
import type { ScopeFilter, SortMode, ViewMode } from '../types'

interface UiState {
  /** scope 筛选 */
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
   * ⚠️ 它是**应用级**的开合状态，不是某个页面的：抽屉挂在路由之外，
   *    而开关在顶栏（`ShellTopbar`）—— 两者不在同一棵子树里，只能走 store。
   *    放在这里而不是 `ai-store`：那边装的是**会话**（消息/草稿/生成中），
   *    这边装的是**界面开合**，与 `sidebarOpen` 同类。
   *    分开之后有一条好处：抽屉的开合不影响会话，会话的变化也不触发顶栏重渲染。
   */
  aiDrawerOpen: boolean

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
 */
export const useUiStore = create<UiState>((set) => ({
  scope: 'all',
  view: 'cards',
  sort: 'default',
  query: '',
  sidebarOpen: false,
  /* 默认**关着**：它是"叫它才出来"的伴生面板，不是常驻的一栏 */
  aiDrawerOpen: false,

  setScope: (scope) => set({ scope }),
  setView: (view) => set({ view }),
  setSort: (sort) => set({ sort }),
  setQuery: (query) => set({ query }),
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
  openAiDrawer: () => set({ aiDrawerOpen: true }),
  closeAiDrawer: () => set({ aiDrawerOpen: false }),
  toggleAiDrawer: () => set((state) => ({ aiDrawerOpen: !state.aiDrawerOpen })),
  resetFilters: () => set({ scope: 'all', query: '' }),
}))
