import { useCallback, useState } from 'react'

/**
 * 模块页的弹窗状态：**一个正在显示的弹窗 + 它的触发参数**，外加一个「详情待迁移」的占位。
 *
 * 为什么把这两件事放一起：原型的弹窗有两种语义 ——
 *  · 「新建 X」这类**没有参数**：打开的就是那张固定表单；
 *  · 「打开某个东西」这类**有参数**：`openRecipe('番茄牛腩')` 打开的是那一行。
 * 两者在 React 里都是"当前显示哪个弹窗 + 带着什么参数"，用一个 state 表达更省、也不会出现
 * "参数换了但弹窗没换"的半更新状态。
 *
 * `pending` 是给那族**数据驱动**的详情视图留的位置（见 PendingDetail 的注释）：
 * 它们的模板还没迁移，但入口不能点了没反应，所以统一落到一个说明性的占位弹窗上。
 */
export function useModuleModals<K extends string>() {
  const [key, setKey] = useState<K | null>(null)
  const [arg, setArg] = useState('')
  const [pending, setPending] = useState<string | null>(null)

  const open = useCallback((next: K, nextArg = '') => {
    setArg(nextArg)
    setKey(next)
  }, [])

  return {
    key,
    arg,
    pending,
    open,
    close: () => setKey(null),
    openPending: (title: string) => setPending(title),
    closePending: () => setPending(null),
  }
}
