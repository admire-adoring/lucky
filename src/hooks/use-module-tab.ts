import { useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { ModuleTab } from '../data/workspace/types'

/**
 * Tab 状态 —— **由路由驱动**，不是组件内部 state。
 *
 * 为什么不用 `useState`：原型的 Tab 是纯前端状态，刷新就回到第一个；
 * 而 `docs/模块设计.md` 给每个页面都规定了子路径（`/life/habits` 这类）。
 * 走路由之后，深链、后退键、以及"从别处跳进某个 Tab"三件事同时成立 ——
 * 用 state 实现这三件事都要额外补代码，还补不全。
 *
 * 三个约定：
 *  1. **首个 Tab 用裸路径**（`/life` 而不是 `/life/overview`）。理由：`/life` 是
 *     从侧栏点进来的地址，它必须能直接打开；若默认 Tab 也占一段路径，
 *     侧栏就得知道每个模块的第一个 Tab 叫什么，多一处耦合。
 *  2. **未知 Tab 静默回落到首个 Tab**，不改地址。直接 404 页对"地址手抖打错"
 *     太重了；而静默回落 + 高亮第一个 Tab，用户能立刻看出自己在哪。
 *  3. `select` 用 `replace: false`，让 Tab 之间的切换进历史栈 ——
 *     这正好是"后半部分操作回到上一个 Tab"的期望行为。
 */
export function useModuleTab(basePath: string, tabs: ModuleTab[]) {
  const navigate = useNavigate()
  const { tab: rawTab } = useParams<{ tab?: string }>()

  const fallback = tabs[0]?.key ?? ''
  const active = tabs.some((t) => t.key === rawTab) ? (rawTab as string) : fallback

  const select = useCallback(
    (key: string) => {
      navigate(key === fallback ? basePath : `${basePath}/${key}`)
    },
    [basePath, fallback, navigate],
  )

  return { active, select }
}
