import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/**
 * 最近访问 —— 侧栏「最近」槽的事实源。
 *
 * 为什么要有这个 store：原型那一槽里是四条写死的示例（"客户资料 · 需求 2h"…）。
 * 照搬就是编数据（项目明令禁止），删掉又会让"最近"这一槽没有内容可显示。
 * 而**真实的最近访问**本来就可记录 —— 每一次 Tab 切换都是它的一条数据。
 * 所以这一槽的内容不是模拟出来的，是**用户自己走过的路**。
 *
 * 三条纪律：
 *  · **只记 Tab 级**（`/life/habits`），不记弹窗、筛选项 —— 后两者刷新即失效，
 *    进去之后看到的不是同一屏，那样的"最近"点了会让人困惑。
 *  · **去重按路径**，同一个 Tab 反复进只保留最新一条（否则会被一个页面占满）。
 *  · **上限 8 条**：界面上只显示 4 条，留一倍余量给"当前这一页也在里面"的情况。
 *
 * localStorage 的 key 带 `lucky-y/` 前缀（与 `auth-store` 同一口径）。
 * 「最近访问」是本机行为，不进后端、不跨设备 —— 它没有服务端事实源。
 */
export interface RecentEntry {
  /** 路由路径，例如 `/life/habits` */
  path: string
  /** 显示名，例如「生活 · 习惯」 */
  label: string
  /** 记录时刻（ms）。用于排序，也用于显示相对时间 */
  at: number
}

const MAX = 8

interface RecentsState {
  entries: RecentEntry[]
  record: (path: string, label: string) => void
  clear: () => void
}

export const useRecentsStore = create<RecentsState>()(
  persist(
    (set) => ({
      entries: [],
      record: (path, label) =>
        set((state) => {
          const rest = state.entries.filter((e) => e.path !== path)
          return { entries: [{ path, label, at: Date.now() }, ...rest].slice(0, MAX) }
        }),
      clear: () => set({ entries: [] }),
    }),
    { name: 'lucky-y/recents' },
  ),
)
