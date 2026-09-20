import { create } from 'zustand'
import { WORKBENCH_HOME_KEY } from '../data/workbench'

interface WorkbenchState {
  /** 当前模块 key。它是"整页重置"的唯一开关：背景氛围、Hero、磁贴面板、助手对话一起跟着走 */
  series: string
  /** 助手栏是否收起。**不持久化** —— 它是"临时看一眼"的动作，刷新应回到展开态 */
  railCollapsed: boolean

  setSeries: (series: string) => void
  setRailCollapsed: (collapsed: boolean) => void
  toggleRail: () => void
  resetSeries: () => void
}

/**
 * 工作台状态。
 *
 * ⚠️ 这里**只管 UI 状态**，不存"当前模块有哪些磁贴/对话" —— 那些是纯派生数据，
 *    从 `data/workbench.ts` 按 key 现取。往 store 里放一份就是第二个事实源。
 *
 * ⚠️ 也有意**不做持久化**：当前模块属于"看到哪儿算哪儿"的会话态。
 *    持久化它会让下次打开时停在一个莫名其妙的模块上，
 *    而用户对首页的预期是"回到工作台"。
 */
export const useWorkbenchStore = create<WorkbenchState>((set, get) => ({
  series: WORKBENCH_HOME_KEY,
  railCollapsed: false,

  setSeries: (series) => set({ series }),
  setRailCollapsed: (railCollapsed) => set({ railCollapsed }),
  toggleRail: () => set({ railCollapsed: !get().railCollapsed }),
  resetSeries: () => set({ series: WORKBENCH_HOME_KEY }),
}))
