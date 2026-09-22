import { buildTasks, computeStats } from '../derive'
import { PROJECTS } from '../projects'
import { WORKBENCH_AGG, projectById } from '../workbench'
import type { Project, Task } from '../../types'

/**
 * AI 助手的**事实层** —— 这一页所有数字的唯一出处。
 *
 * ============================================================================
 * 为什么必须有这一层
 * ============================================================================
 * 原型是一个演示稿，它那条示例对话里写着一串数字（「3 个日程」「5 个任务」「2 个逾期」
 * 「29 / 54 完成」「低于全域 17 个百分点」）。照搬会踩两条红线：
 *
 *   ① **项目的铁律是不允许编数字**：`projects.ts` 的 8 个项目是唯一事实源，
 *      派生值（进度、完成率、域均值）都从它算出来，项目增删数字就要跟着动。
 *   ② 同一句话在两处各写一遍，迟早会漂 —— 工作台的内容层已经用一次**指纹守卫**
 *      证明过这一点（`data/workbench.ts` 开头那段）。
 *
 * ⚠️ 但也不能因此把这页做成空的。实测发现原型那几个数字**本来就是真算出来的**：
 *    · 「工作域平均进度 42%、低于全域 17 个百分点」→ `DOM.work.avg = 42`、`GLOBAL_AVG = 59`
 *    · 「29 / 54 完成（53.7%）」→ `DOM.work.done / DOM.work.total`、`DOM.work.rate`
 *    也就是说原型作者当时也读的是这一份聚合。所以口径是：**能对上的直接用，对不上的明说**。
 *
 * ============================================================================
 * 每一项的口径都写在字段注释里；没有来源的**不写**
 * ============================================================================
 * 用 `WORKBENCH_AGG` 而不是自己再 `reduce` 一遍：它是生成物
 * （`design/gen-modules.mjs` 产出、`data/workbench.ts` 用指纹守着），
 * 工作台与项目页读的也是它 —— 同一句话在三个页面里必须是同几个数。
 */

const stats = computeStats(PROJECTS)

/**
 * 逾期任务。
 *
 * 判据直接用 `Task.late`（`derive.ts` 里由 `due.includes('逾期')` 得出，
 * 且只有 `status === 'risk'` 的项目才会产生逾期项）—— **不在这里另算一套"是否逾期"**。
 * 另算一套的代价是：改派生规则时两处不同步，而页面上没人会发现哪个才对。
 */
const lateTasks: Array<{ project: Project; task: Task }> = PROJECTS.flatMap((project) =>
  buildTasks(project)
    .filter((task) => task.late)
    .map((task) => ({ project, task })),
)

/**
 * 剩余天数最紧的两个**未完成**项目。
 *
 * 顺序取自 `WORKBENCH_AGG.BY_DAYS` —— 那一列在生成器里已经按 `daysLeft` 升序排好了，
 * 这里只做 id → Project 的解析，不再排一次（再排一次就等于把"谁更紧"这个口径抄了两份）。
 */
const dueFirst = WORKBENCH_AGG.BY_DAYS.map((id) => projectById(id)).filter(
  (project): project is Project => project !== undefined,
)

/**
 * 某个域里**进度最低的未完成项目** —— 回答"拖累项是哪个"时的口径。
 *
 * ⚠️ 这是**推导**，不是数据字段：原型那句「主要拖累是「团队 OKR 落地推进」（12%）」
 *    在应用里没有对应的"拖累项"字段。判据取"该域里 progress 最小的未完成项目"，
 *    与工作台把 `DOM.<域>.avg` 说成"域均值"是同一个立场 —— 都从 `projects.ts` 现算。
 *    注释写明是推论，是为了让下一个人能判断什么时候该换口径。
 */
function laggardOf(scope: Project['scope']): Project | undefined {
  return PROJECTS.filter((project) => project.scope === scope && project.status !== 'done').sort(
    (a, b) => a.progress - b.progress,
  )[0]
}

export const AI_FACTS = {
  /** 已接入的项目数 —— 与顶栏徽标、工作台摘要同一口径 */
  projectCount: PROJECTS.length,
  /** 任务总量 / 已完成 / 待办 / 完成率 */
  tasks: WORKBENCH_AGG.TASKS,
  /** 全域平均进度 */
  globalAvg: WORKBENCH_AGG.GLOBAL_AVG,
  /** 三个域（life / work / learn）的聚合 */
  dom: WORKBENCH_AGG.DOM,
  /** 项目统计（进行中 / 风险 / 已完成 / 平均进度） */
  stats,
  /** 逾期任务（含所属项目） */
  lateTasks,
  lateCount: lateTasks.length,
  /** 按剩余天数升序的未完成项目 */
  dueFirst,
  /** 剩余天数最紧的两个（这一页多处引用，取一次免得各处 slice） */
  dueTop2: dueFirst.slice(0, 2),
  /** 预算总额（元） */
  budgetTotal: WORKBENCH_AGG.BUDGET_TOTAL,
  /** 每个域里进度最低的未完成项目（推导，见 laggardOf） */
  laggard: {
    life: laggardOf('life'),
    work: laggardOf('work'),
    learn: laggardOf('learn'),
  },
} as const

/** 「8 个项目 · 164 条任务」这种摘要行 —— 顶栏会话头与助手栏共用同一句 */
export const AI_SCOPE_LINE = `已接入 ${AI_FACTS.projectCount} 个项目 · ${AI_FACTS.tasks.total} 条任务 · 全域平均 ${AI_FACTS.globalAvg}%`
