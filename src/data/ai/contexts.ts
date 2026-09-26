import { STATUS_META } from '../meta'
import { PROJECTS } from '../projects'
import { AI_FACTS } from './facts'
import type { AiContextOption } from './types'

/**
 * 「上下文」的目录 —— 可以被加进某轮问答的真实来源。
 *
 * ============================================================================
 * 与原型最大的差别：这里**没有一条演示数据**
 * ============================================================================
 * 原型第二轮加了「添加上下文」选择器，它的目录是 8 条写死的条目：
 *   支付系统重构 / React 19 笔记 / 本周日程 / 团队 OKR / 鉴权迁移风险 /
 *   弥散风格 UI 设计要点 / 2026 Q2 数据报告 / 跑者训练计划
 * —— 名字像真的，但条目本身不在任何一张表里，`sub` 里的「笔记 · 12 条」
 *    「日程 · 本周 8 项」更是编的。照搬过来，选择器一打开就是 8 条假数据，
 *    而这一页的其它部分全是真算的（见 `facts.ts`）。
 *
 * 换成**这一页真的会读的东西**，只有两类：
 *   ① **事实层**：全部任务、三域聚合 —— 它们就是规则引擎实际会读的两个来源；
 *   ② **项目**：`projects.ts` 的 8 个项目，`sub` 用真实状态与进度算。
 * 于是"选中的上下文"不再是一串装饰性的名字，而是"这一轮允许读哪些来源"。
 *
 * ⚠️ 降级写在明面：**选了不会真的改变回答**（引擎读的是全部事实层）。
 *    这一条与右栏那六支"能力开关"同一个处境，理由也相同：
 *    它们是**配置**，不是"显示一个系统里不存在的状态"。真的接上之后，
 *    这个 `contexts` 数组就是那份读取范围 —— 也就是说，接口已经就位，缺的是消费者。
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

const PROJECT_OPTIONS: AiContextOption[] = PROJECTS.map((project) => ({
  id: `p:${project.id}`,
  name: project.name,
  sub: `项目 · ${STATUS_META[project.status].label} · ${project.progress}%`,
  // 风险中的项目换成警示图标 —— 这一条是**从数据推的**（status === 'risk'），不是手挑的
  icon: project.status === 'risk' ? 'i-alert' : 'i-project',
}))

export const AI_CONTEXT_CATALOG: AiContextOption[] = [...SOURCES, ...PROJECT_OPTIONS]

const BY_ID = new Map(AI_CONTEXT_CATALOG.map((option) => [option.id, option]))

/**
 * 取目录项。取不到返回 `undefined`（由渲染层决定怎么降级）——
 * **不回落成"第一个"**：那样会让一条失效的上下文看起来仍然有效。
 * （对照：`api/projects.ts` 里 id 不匹配回落 p1 是另一个口径，那里是用户可见的入口。）
 */
export function contextById(id: string): AiContextOption | undefined {
  return BY_ID.get(id)
}

/** 会话默认的上下文：两个事实源。种子会话另外挂了两个"最紧的项目" */
export const DEFAULT_CONTEXTS: string[] = ['src:tasks', 'src:domains']
