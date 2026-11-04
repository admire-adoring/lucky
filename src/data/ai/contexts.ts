import { AI_FACTS } from './facts'
import type { AiContextOption } from './types'

/**
 * 「上下文」的目录 —— 可以被加进某轮问答的真实来源。
 *
 * AI 助手是规则引擎（不是 LLM），目录列的是事实源与项目 —— 它们就是规则引擎实际会读的来源。
 * 事实层由 `updateAiFacts(projects)` 在数据到达时更新，这里读到的数字是真实的。
 */

const SOURCES: AiContextOption[] = [
  { id: 'src:tasks', name: '全部任务', sub: `任务 · ${AI_FACTS.tasks.total} 条`, icon: 'i-list' },
  {
    id: 'src:domains',
    name: '三域聚合',
    sub: `聚合 · 生活 ${AI_FACTS.dom.life.avg}% / 工作 ${AI_FACTS.dom.work.avg}% / 学习 ${AI_FACTS.dom.learn.avg}%`,
    icon: 'i-grid',
  },
]

export const AI_CONTEXT_CATALOG: AiContextOption[] = SOURCES

const BY_ID = new Map(AI_CONTEXT_CATALOG.map((option) => [option.id, option]))

export function contextById(id: string): AiContextOption | undefined {
  return BY_ID.get(id)
}

/** 会话默认的上下文：两个事实源 */
export const DEFAULT_CONTEXTS: string[] = ['src:tasks', 'src:domains']
