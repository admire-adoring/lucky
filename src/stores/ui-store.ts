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

  setScope: (scope: ScopeFilter) => void
  setView: (view: ViewMode) => void
  setSort: (sort: SortMode) => void
  setQuery: (query: string) => void
  openSidebar: () => void
  closeSidebar: () => void
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

  setScope: (scope) => set({ scope }),
  setView: (view) => set({ view }),
  setSort: (sort) => set({ sort }),
  setQuery: (query) => set({ query }),
  openSidebar: () => set({ sidebarOpen: true }),
  closeSidebar: () => set({ sidebarOpen: false }),
  resetFilters: () => set({ scope: 'all', query: '' }),
}))
