import { useEffect } from 'react'
import { AI_STAGE_DURATIONS } from '../../data/ai/conversations'
import { findGenerating, nowTime, useAiStore } from '../../stores/ai-store'

/**
 * 阶段推进器 —— **全应用唯一的一处 AI 计时**。
 *
 * ============================================================================
 * 为什么它从页面里搬出来了
 * ============================================================================
 * 原来这个 effect 写在 `AiAssistantPage` 里，注释还写着「唯一的计时处」。
 * 那是真的 —— 只要AI 助手**只有一个视图**。现在它有两个：
 *   · `/ai` 完整页；
 *   · 全局抽屉（每个页面都能弹，`App.tsx` 挂一次）。
 *
 * 两个视图**共享同一份会话**（同一个 `ai-store`），于是"谁推进阶段"就成了必须回答的问题：
 *   · 两边各写一份 effect ⇒ 同一条消息被推进两次，阶段**跳着涨**（这是第一版
 *     组件自持 interval 时踩过的同一个坑，只是这次是"两个组件"而不是"重挂载"）；
 *   · 只有页面那一份 ⇒ 在 `/life` 打开抽屉提问，抽屉里永远停在第一拍。
 *
 * 正解是把它提到**视图之外**：抽屉的宿主（`AiDrawerHost`，挂在路由之外、登录后常驻）
 * 渲一次它。于是"计时只存在一份"这条不变量重新成立，而且与当前在哪个页面无关。
 * ⚠️ 谁再往页面里加第二份计时，症状就是"两个视图同时开着时阶段走得飞快"。
 */
export function AiStageTicker() {
  const generatingMessage = useAiStore((state) => findGenerating(state.sessions))
  const advanceStage = useAiStore((state) => state.advanceStage)

  /**
   * 依赖只放"哪一条 + 它的第几拍"：任一变化就重新排一个 setTimeout。
   * 跑满四拍时 `advanceStage` 内部会落到 `settle`，于是 `generating` 变 false、
   * 依赖变化、effect 清理 —— 不需要额外判断。
   */
  useEffect(() => {
    if (!generatingMessage) return
    const stage = generatingMessage.stageIdx ?? 0
    const done = stage >= AI_STAGE_DURATIONS.length
    const timer = setTimeout(
      () => advanceStage(generatingMessage.id, nowTime()),
      done ? 120 : AI_STAGE_DURATIONS[stage],
    )
    return () => clearTimeout(timer)
  }, [generatingMessage, generatingMessage?.stageIdx, advanceStage])

  return null
}
