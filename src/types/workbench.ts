import type { IconName } from './index'

/**
 * 工作台内容层的类型 —— 由 `design/export-workbench-content.mjs` 导出、`gen-modules.mjs` 生产。
 *
 * 为什么要单独一层类型而不是复用 Project：
 *   工作台的 45 块磁贴里，**只有一部分**是项目数据，其余是聚合值（待办分布、预算总额、
 *   可见性分布…）与纯展示文案。把它们硬塞进 Project 会让 Project 变成万能结构；
 *   反过来，若在组件里现算，又会出现"同一句话在两处各写一遍"。
 *   所以这里定义的是一棵**已算好的展示树**：组件只负责渲染，不做业务计算。
 *
 * ⚠️ 这些类型的**事实源在 `design/gen-modules.mjs`**。改了那边的磁贴结构，
 *    这里要同步 —— `export-workbench-content.mjs --check` 会在产物过期时拦下来。
 */

/** 三域（与 Project['scope'] 同源，这里别名一下免得两处名字漂移） */
export type WbScope = 'life' | 'work' | 'learn'
export type WbStatus = 'planning' | 'active' | 'risk' | 'done'

/**
 * 富文本片段。
 *
 * 原型里强调是直接写 `<b class="…">…</b>` 的。移植到 React 时**不**用
 * `dangerouslySetInnerHTML` —— 那等于把一段 HTML 字符串当代码执行，
 * 而这批文本虽然是自己生成的、将来却可能来自用户的笔记内容。
 * 所以导出时就拆成片段数组，渲染层按 `em` 决定要不要套一层 <strong>。
 */
export interface TextRun {
  text: string
  /** 强调（原型的 <b>）：字重与颜色都更高一档 */
  em?: boolean
}

/* ---------- 迷你柱图 ---------- */

/** 一根柱：`[x 像素偏移, 柱高像素]`。几何在导出时就算好了 —— 见 MiniChart 的注释 */
export type ChartBar = [number, number]

export interface ChartGroup {
  /** 柱色。取的是**不承载文字**的色阶（色条/填充档），不是徽标用的 -strong */
  color: string
  /** 柱宽 */
  w: number
  bars: ChartBar[]
}

export interface MiniChartSpec {
  groups: ChartGroup[]
  width: number
  height: number
  /** 基线 y：柱从它往上长 */
  baseline: number
}

/* ---------- 磁贴 ---------- */

/** 「规划中」清单：知识库"数据接入"磁贴里那块占位清单 */
export interface PlannedBlock {
  kind: 'planned'
  items: string[]
  /** 右侧统一标注（"规划中"） */
  note: string
}

export interface KpiTileSpec {
  kind: 'kpi'
  icon: IconName
  title: string
  /** 副标题：说明这枚数字的**口径**（"柱高 = 待办条数"这类） */
  sub: string
  value: string
  unit?: string
  /** 大数字右侧的小圆点类名（域色/状态色） */
  dot?: string
  /** 图表区。null 表示这块磁贴用 tail 顶替 */
  chart: MiniChartSpec | null
  /** 图表下方的刻度标签，列数由它决定 */
  labels?: string[]
  /** 图例：[色点类名, 文案][] */
  legend?: Array<[string, string]>
  tail?: PlannedBlock
}

/** 项目行：只存 id，运行时从 PROJECTS 取 —— 避免同一份项目数据在包里出现两遍 */
export interface ProjectRowSpec {
  kind: 'project'
  id: string
}

/** 扁平行：域汇总、按天/按月这类"不是具体项目"的行 */
export interface FlatRowSpec {
  kind: 'flat'
  /** 左侧色条类名 */
  dot: string
  /** 进度条填充渐变类名 */
  grad: string
  name: string
  meta: string
  pct: number
  pctCls?: string
}

/** 事件行：知识库索引、关键节点这类"点 + 正文 + 副标"的行 */
export interface EventRowSpec {
  kind: 'event'
  dot: string
  text: TextRun[]
  sub: string
  right: string
  tone?: string
}

export type TileRow = ProjectRowSpec | FlatRowSpec | EventRowSpec

export interface ListTileSpec {
  kind: 'list'
  icon: IconName
  title: string
  /** 右上角的口径说明（"全部 8 个项目"这类） */
  right: string
  body: TileRow[]
}

export type TileSpec = KpiTileSpec | ListTileSpec

/* ---------- 焦点与对话 ---------- */

/** 焦点项的语气：风险红 / 临期橙 / 中性墨 —— 只影响颜色，不影响语义 */
export type FocusTone = 'danger' | 'warn' | 'ink'

export interface FocusItem {
  name: string
  meta: string
  tag: string
  tone: FocusTone
}

export interface ChatMessage {
  role: 'ai' | 'user'
  content: TextRun[]
  time: string
}

/** 「进入主页面」CTA。路由取自 docs/模块设计.md，不自造 */
export interface ModuleEnter {
  text: string
  path: string
  /** 工作台是**本页**：按钮保留但置灰，不能藏 —— 藏了 Hero 会矮一截 */
  self?: boolean
}

/* ---------- 模块 ---------- */

export interface WorkbenchModule {
  key: string
  label: string
  /** 环下方的摘要行（"全域平均进度 59% · 8 个项目 · 164 条任务"） */
  summary: string
  icon: IconName
  focus: FocusItem[]
  tiles: TileSpec[]
  chat: ChatMessage[]
  enter: ModuleEnter
}

/* ---------- 聚合值 ---------- */

export interface ScopeAggregate {
  total: number
  done: number
  todo: number
  /** 域平均进度（%） */
  avg: number
  /** 域任务完成率（%） */
  rate: number
}

export interface WorkbenchAggregates {
  TASKS: { total: number; done: number; todo: number; rate: number }
  GLOBAL_AVG: number
  MONTHS: string[]
  BUDGET_TOTAL: number
  /** 按剩余天数升序的未完成项目 id */
  BY_DAYS: string[]
  /** 可见性分布：[可见性, 数量][] —— 只含数量 > 0 的档 */
  VIS: Array<[string, number]>
  DOM: Record<WbScope, ScopeAggregate>
}
