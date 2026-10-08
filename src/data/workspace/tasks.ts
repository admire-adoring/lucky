/**
 * 「任务」模块（`design/task/task_index.html`）的演示数据 + 派生层。
 *
 * ============================================================================
 * 这个文件解决的事情
 * ============================================================================
 *
 * 原型把同一批任务手写了五份（全部任务 / 今日时间轴 / 看板 / 四象限 / 日历），
 * 再加一份 `TASK_FIELDS` 台账在启动时按标题把字段水合回各个视图。
 * 那份台账存在的唯一理由是"原型没法从一份数据渲染五个视图"。
 * React 里这条路不必走：一份 `TASKS`，五个视图各自从它派生，
 * 于是"同一任务在五个视图里读数一致"是构造保证的，不再靠水合维持。
 *
 * 原型的 `data-*` 派生标记（`data-today` / `data-overdue` / `data-when` /
 * `data-filter` / `data-group` / `data-count`）一条都不搬 —— 它们是原型
 * 为了让视图能查询而存在的水合产物，落库就是一堆会不同步的冗余列。
 *
 * ============================================================================
 * 演示口径（必须显式写出来，否则下一个人会当成真实业务数据）
 * ============================================================================
 *
 * 1. `DEMO_NOW` 是写死的"现在"（2026-09-20 12:00），与原型一致。
 *    时间轴的"现在线"、KPI 的"下一件事 · 还有 2 小时"、周节奏的"今天"
 *    全部以它为基准 —— 用真实系统时间的话，这份演示数据会整体漂成
 *    "逾期 300 天"，读起来完全不是原型的样子。
 *    真实实现取系统时间，并把这一个常量换掉即可（其余派生全部跟着走）。
 *
 * 2. 没有后端任务表（`backend/` 下没有 tasks 域，`src/api/` 只有 projects），
 *    所以这一份是演示数据。判据仍是"它会不会显示一个系统里不存在的东西"：
 *    下面每一项都对应原型里真实可点、可勾、可排的一行，没有凭空生成的统计
 *    （每一个读数都能由这份数据算出来，见文件末尾的派生函数）。
 *
 * 3. `dueLabel` 是手写文案，不是派生值。原型里"今天 14:00" / "今天"
 *    这两种写法都出现在 due 落在今天同一批任务上（能否派生出"14:00"看不出一条规则：
 *    有排期的更新接口文档反而只写"今天"）。项目口径里"编出的数字"要禁止、
 *    "文案"可以显式给 —— 所以这里给字段，并在此注明真实实现应由 `dueAt` 派生
 *    （规则见 `design/task/task_module_spec.md` §2）。
 *
 * 4. `inToday` 有一处与 spec 不一致，这里照原型的标记走：
 *    spec §5-2 的顺延规则是"未完成 ∧ 逾期 ≤ 3 天 ⇒ 顺延进今日"，
 *    按它算"优化首页加载速度"（逾期 2 天）也该进今日；而原型标记里它是
 *    `data-today="0"`（"今日到期 6"因此成立）。这一处按原型保真，别处照规则。
 *
 * 5. `quad`（四象限落格）与 `calDay` / `calLabel`（日历落格与短名）同样是显式字段：
 *    原型的象限分配（买猫粮落"紧急不重要"、整理房间落"重要不紧急"）与
 *    spec §6 的推导式（重要 = 优先级高/中，紧急 = 已逾期）对不上，
 *    推导会得到另一套格子。保真优先 ⇒ 显式给。
 */

/* ============================================================
 * 一 · 页面骨架：分区 / 视图 / 二级筛选
 * ============================================================ */

/**
 * 「任务」的分区只有范围四个：今日 / 全部任务 / 收件箱 / 已完成。
 *
 * 「看板 / 四象限 / 日历」不是分区，它们是「全部任务」这一批任务的
 *    另外三种排列（见 `TASK_VIEWS`）。原型的注释把判据写得很清楚：
 *    一层里只允许一种性质（范围 / 排列混排 ⇒ 用户不知道按什么找），
 *    而且任一条任务的归属不能有两个默认答案 —— 旧版把"写周报"同时算作
 *    全部任务 / 看板 / 四象限三处的内容，那正是把排列当成了分区。
 */
export const TASK_SECTIONS = [
  { key: 'today', label: '今日' },
  { key: 'all', label: '全部任务' },
  { key: 'inbox', label: '收件箱' },
  { key: 'done', label: '已完成' },
] as const

export type TaskSectionKey = (typeof TASK_SECTIONS)[number]['key']

/** 每个分区的一句话说明（页头副标题；切分区时也跟着换） */
export const SECTION_DESC: Record<TaskSectionKey, string> = {
  today: '今天的时间轴（窗口 08:00–22:00，可配置）：排得下就排，排不下会直说。',
  all: '跨领域任务总览，按截止时间排序。',
  inbox: '随手收集，尚未归类整理。',
  done: '本周完成的 6 项，含今日 2 项。',
}

/**
 * 「全部任务」里的四种排列。四种排列的结构不同（行 / 三列 / 2×2 / 7 列网格），
 * 所以各自独立渲染、切换只切显隐：勾选、排期、二级筛选的状态全留着
 * （原型原文："切视图不重渲"）。
 */
export const TASK_VIEWS = [
  { key: 'list', label: '列表', desc: '按「逾期 → 今天 → 之后」排，未完成在前。' },
  { key: 'board', label: '看板', desc: '按状态分三列；卡上的 → 直接推进到下一列。' },
  { key: 'matrix', label: '四象限', desc: '按重要 × 紧急划格；✓ 一下就从格里划掉。' },
  { key: 'calendar', label: '日历', desc: '点某一天在那天新建任务，点任务看详情。' },
] as const

export type TaskViewKey = (typeof TASK_VIEWS)[number]['key']

/**
 * 二级筛选：分区的下一步过滤。
 *
 * 原型里这一层挂在侧栏圆盘的第三级上（点当前分区 → 环上换成 3 个子项）。
 *    应用里环是八个模块共享的外壳件（`components/shell/RingNav.tsx`），
 *    它的文件头已经把"没有三级"写成了一条既定决定（理由：Tab 没有子项，
 *    硬搬就得编子项与计数）。所以这里把同一件事落在页面内：
 *    一条筛选条 + 一个"正在看什么 / 怎么退回去"的 chip（原型的 `.filter-chip`
 *    本来就是这个出口，它的注释写着"三级筛选是真的在过滤，所以必须有个可见出口"）。
 *    过滤规则一行一条，与原型 `ROW_FILTER` 逐字对应。
 */
export interface SubFilterItem {
  key: string
  label: string
}

export const SUB_FILTERS: Partial<Record<TaskSectionKey, SubFilterItem[]>> = {
  today: [
    { key: 'overdue', label: '已逾期' },
    { key: 'high', label: '高优先级' },
    { key: 'rest', label: '其余' },
  ],
  all: [
    { key: 'life', label: '生活' },
    { key: 'work', label: '工作' },
    { key: 'learn', label: '学习' },
  ],
  inbox: [
    { key: 'todo', label: '未整理' },
    { key: 'idea', label: '想法' },
    { key: 'ref', label: '参考' },
  ],
}

/** 二级筛选的一行判据。原型的 `ROW_FILTER` 逐条抄过来，一行一个判据。 */
export function matchesSubFilter(row: TaskRow, section: TaskSectionKey, key: string): boolean {
  if (section === 'all') return row.scope === key
  if (section === 'inbox') return row.kind === key
  if (section === 'today') {
    if (key === 'overdue') return row.overdueDays > 0
    if (key === 'high') return row.prio === 'high'
    /* 「其余」= 既不逾期也不高优先级 —— 与原型那一条三元表达式一致 */
    return row.overdueDays === 0 && row.prio !== 'high'
  }
  return true
}

/* ============================================================
 * 二 · 时间轴窗口
 * ============================================================ */

/**
 * 时间轴窗口（spec §5-1：可配置，存用户设置，默认 08:00–22:00）。
 *
 * 原型里"窗口 = 28 行 × 30min"，而且这个数字同时写在三处（`.tl` 的 `data-rows`、
 * CSS 的 `repeat(28, …)` 和刻度标签的 `grid-row`）。这里收口成一份：
 * 行数由 `(end - start) / rowMin` 算出来，CSS 用 `--tl-rows` 消费它。
 */
export const TL_WINDOW = { startMin: 8 * 60, endMin: 22 * 60, rowMin: 30 }
export const TL_ROWS = (TL_WINDOW.endMin - TL_WINDOW.startMin) / TL_WINDOW.rowMin // 28
/** 刻度标签打在这些行上（每 2 小时一条） */
export const TL_TICKS = [1, 5, 9, 13, 17, 21, 25]

/* ============================================================
 * 三 · 任务台账（16 项）
 * ============================================================ */

export type TaskScope = 'life' | 'work' | 'learn'
export type TaskPrio = 'high' | 'mid' | 'low'
export type TaskState = 'todo' | 'doing' | 'done'
export type TaskKind = 'todo' | 'idea' | 'ref'

export interface TaskRow {
  id: string
  title: string
  scope: TaskScope
  prio: TaskPrio
  state: TaskState
  /** 收件箱项的类型。有它 = 这一项属于收件箱，不进「全部任务」列表（与原型一致）。 */
  kind?: TaskKind
  /**
   * 是否算作"今天"（对应原型的 `data-today`）。
   * 见文件头 4：这一处照原型标记，不按 spec 的顺延公式重算。
   */
  inToday: boolean
  /** 逾期天数（0 = 未逾期）。由 `dueAt` 与 `DEMO_NOW` 派生，见 `withDerived`。 */
  overdueDays: number
  /**
   * 预估时长（分钟）。spec §1.1 的 `estimate_min`。
   * 可缺：spec §5-4 定的是"缺失就不进时间轴"（默认值会让空档失真 ——
   * 你以为半小时、实际两小时，"排得下"就成了假答案）。就地新增的任务就没有它，
   * 点「排进去」时先弹时长选择补齐。
   */
  estMin?: number
  dueAt: string
  /**
   * 排期落点 `HH:MM`（spec §1.1 的 `scheduled_start`）。有它 = 在时间轴上。
   */
  scheduledStart?: string
  /**
   * 在「待排池」里。
   *
   * 这是一个独立的成员标志，不是"未排期"的派生值 —— 原型的注释写得很清楚：
   *    "已排进时间轴的池项：退出计数、文字降级，但留在池里 ——
   *     否则'我刚排的那个去哪了'要靠记忆回答"。
   *    所以"排进去"只改它那一行的样子，不会把它从池里挪走。
   */
  pooled?: boolean
  completedAt?: string
  inboxAt?: string
  project?: string
  createdAt: string
  updatedAt: string
  /** 行上那枚时间 chip 的文案。见文件头 3：原型是手写文案。 */
  dueLabel: string
  /** 四象限落格。见文件头 5。 */
  quad?: 1 | 2 | 3 | 4
  /** 日历落格（9 月的日）。 */
  calDay?: number
  /** 日历格子里的短名（格子放不下全称）。 */
  calLabel?: string
  /**
   * 勾选完成之前的状态。原型把它记在 `data-prev-state` 上，
   * 原因是"取消完成"要回到原状态：一条"进行中"的任务被勾掉再取消，
   * 不该降级成"待办"。渲染时用不到它，但少了它就会丢这个信息。
   */
  prevState?: TaskState
}

/** 台账：字段与原型 `TASK_FIELDS` 一一对应（`estimate` 小时 → `estMin` 分钟）。 */
const LEDGER: Omit<TaskRow, 'overdueDays'>[] = [
  /* ---- 「全部任务」列表里的 8 项 ---- */
  {
    id: 't-load', title: '优化首页加载速度', scope: 'work', prio: 'high', state: 'doing',
    inToday: false, estMin: 60, dueAt: '2026-09-18T18:00', pooled: true,
    project: '个人系统前端', createdAt: '2026-09-10', updatedAt: '2026-09-18',
    dueLabel: '逾期 2 天', quad: 1, calDay: 18, calLabel: '优化加载',
  },
  {
    id: 't-catfood', title: '买猫粮', scope: 'life', prio: 'mid', state: 'todo',
    inToday: true, estMin: 30, dueAt: '2026-09-19T20:00', pooled: true,
    createdAt: '2026-09-18', updatedAt: '2026-09-19',
    dueLabel: '昨天到期', quad: 3, calDay: 20, calLabel: '买猫粮',
  },
  {
    id: 't-review', title: '准备项目评审', scope: 'work', prio: 'high', state: 'doing',
    inToday: true, estMin: 120, dueAt: '2026-09-20T14:00', scheduledStart: '14:00',
    project: '客户门户改版', createdAt: '2026-09-12', updatedAt: '2026-09-20',
    dueLabel: '今天 14:00', quad: 1, calDay: 20, calLabel: '准备项目评审',
  },
  {
    id: 't-api', title: '更新接口文档', scope: 'work', prio: 'mid', state: 'todo',
    inToday: true, estMin: 60, dueAt: '2026-09-20T18:00', scheduledStart: '09:00',
    project: '支付系统重构', createdAt: '2026-09-15', updatedAt: '2026-09-20',
    dueLabel: '今天', quad: 2,
  },
  {
    id: 't-react', title: '复习 React 19 笔记', scope: 'learn', prio: 'mid', state: 'todo',
    inToday: true, estMin: 60, dueAt: '2026-09-20T20:00', scheduledStart: '13:00',
    project: '学习计划', createdAt: '2026-09-16', updatedAt: '2026-09-20',
    dueLabel: '今天', quad: 2, calDay: 20, calLabel: '复习 React',
  },
  {
    id: 't-room', title: '整理房间', scope: 'life', prio: 'low', state: 'todo',
    inToday: false, estMin: 30, dueAt: '2026-09-26T18:00', pooled: true,
    createdAt: '2026-09-19', updatedAt: '2026-09-19',
    dueLabel: '本周', quad: 2,
  },
  {
    id: 't-login', title: '修复登录页样式', scope: 'work', prio: 'mid', state: 'done',
    inToday: true, estMin: 30, dueAt: '2026-09-20T12:00', scheduledStart: '10:30',
    completedAt: '2026-09-20T10:30', project: '个人系统前端',
    createdAt: '2026-09-14', updatedAt: '2026-09-20',
    dueLabel: '10:30',
  },
  {
    id: 't-litter', title: '铲屎', scope: 'life', prio: 'low', state: 'done',
    inToday: true, estMin: 30, dueAt: '2026-09-20T09:00', scheduledStart: '08:00',
    completedAt: '2026-09-20T08:00', createdAt: '2026-09-20', updatedAt: '2026-09-20',
    dueLabel: '08:00',
  },

  /* ---- 本周完成、但不在「全部任务」列表里的 4 项 ---- */
  {
    id: 't-vite', title: '搭 Vite + React + TS 框架', scope: 'learn', prio: 'low', state: 'done',
    inToday: false, estMin: 120, dueAt: '2026-09-19T18:00', completedAt: '2026-09-19T15:20',
    project: '个人系统前端', createdAt: '2026-09-19', updatedAt: '2026-09-19',
    dueLabel: '9/19', calDay: 19, calLabel: '搭 Vite 框架',
  },
  {
    id: 't-codereview', title: '代码评审', scope: 'work', prio: 'mid', state: 'done',
    inToday: false, estMin: 60, dueAt: '2026-09-19T12:00', completedAt: '2026-09-19T11:00',
    project: '支付系统重构', createdAt: '2026-09-18', updatedAt: '2026-09-19',
    dueLabel: '9/19',
  },
  {
    id: 't-grocery', title: '买菜', scope: 'life', prio: 'mid', state: 'done',
    inToday: false, estMin: 30, dueAt: '2026-09-18T19:00', completedAt: '2026-09-18T18:40',
    createdAt: '2026-09-18', updatedAt: '2026-09-18',
    dueLabel: '9/18', calDay: 18, calLabel: '买菜',
  },
  {
    id: 't-weekly', title: '写周报', scope: 'work', prio: 'mid', state: 'done',
    inToday: false, estMin: 60, dueAt: '2026-09-17T20:00', completedAt: '2026-09-17T19:10',
    project: '内部', createdAt: '2026-09-17', updatedAt: '2026-09-17',
    dueLabel: '9/17', calDay: 17, calLabel: '写周报',
  },

  /* ---- 收件箱的 4 条（有 kind ⇒ 不进「全部任务」列表） ---- */
  {
    id: 'i-reactdoc', title: '看看新的 React 19 文档', scope: 'learn', prio: 'low', state: 'todo',
    kind: 'ref', inToday: false, estMin: 30, dueAt: '2026-09-27T18:00', inboxAt: '2026-09-18T21:10',
    createdAt: '2026-09-18', updatedAt: '2026-09-18', dueLabel: '2 天前',
  },
  {
    id: 'i-viteplugin', title: '研究一下 Vite 插件', scope: 'learn', prio: 'low', state: 'todo',
    kind: 'idea', inToday: false, estMin: 60, dueAt: '2026-09-27T18:00', inboxAt: '2026-09-17T22:30',
    createdAt: '2026-09-17', updatedAt: '2026-09-17', dueLabel: '3 天前',
  },
  {
    id: 'i-worklog', title: '整理上周的工作记录', scope: 'work', prio: 'mid', state: 'todo',
    kind: 'todo', inToday: false, estMin: 30, dueAt: '2026-09-21T18:00', inboxAt: '2026-09-20T11:05',
    createdAt: '2026-09-20', updatedAt: '2026-09-20', dueLabel: '今天',
  },
  {
    id: 'i-holiday', title: '想想国庆去哪玩', scope: 'life', prio: 'low', state: 'todo',
    kind: 'idea', inToday: false, estMin: 30, dueAt: '2026-09-30T18:00', inboxAt: '2026-09-20T12:40',
    createdAt: '2026-09-20', updatedAt: '2026-09-20', dueLabel: '今天',
  },
]

/* ============================================================
 * 四 · 时间基准与格式化
 * ============================================================ */

/** 演示用的"现在"（见文件头 1）。所有相对读数都以它为基准。 */
export const DEMO_NOW = '2026-09-20T12:00'
export const DEMO_TODAY = DEMO_NOW.slice(0, 10)

const DAY_MS = 24 * 60 * 60 * 1000

function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(`${a}T00:00`) - Date.parse(`${b}T00:00`)) / DAY_MS)
}

/** 分钟数 → `HH:MM` */
export function minToClock(min: number): string {
  const m = ((min % 1440) + 1440) % 1440
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

/** `HH:MM` → 分钟数 */
export function clockToMin(clock: string): number {
  const [h, m] = clock.split(':').map(Number)
  return h * 60 + m
}

/**
 * 时间轴的行号 → 时刻。
 *
 * 这是"行网格"与"时钟"之间唯一的换算：块的 `grid-row` 由它反推、
 *    空档落点的时刻也由它给。原型把 `(row-1)*30 + 480` 这个式子散写在好几处
 *    （`tlTimeOfRow` / 现在线注释 / 刻度标签），这里收成一处。
 */
export function rowToClock(row: number): string {
  return minToClock(TL_WINDOW.startMin + (row - 1) * TL_WINDOW.rowMin)
}

/** 时长（分钟）的显示文案：`30min` / `1h` / `1.5h`（原型的 `durationText`） */
export function durationText(min: number): string {
  if (min < 60) return `${min}min`
  const hours = min / 60
  return Number.isInteger(hours) ? `${hours}h` : `${Math.round(hours * 100) / 100}h`
}

/** 小时数的显示文案（读「已排 / 空档」用）：`5h` / `0.5h` */
export function hoursText(hours: number): string {
  return Number.isInteger(hours) ? `${hours}h` : `${Math.round(hours * 100) / 100}h`
}

/** 一条任务的时长文案。没填时长的明说没填，不拿默认值凑（spec §5-4）。 */
export function estText(row: TaskRow): string {
  return row.estMin ? durationText(row.estMin) : '未估时'
}

/** `2026-09-20T14:00` → `09/20 14:00`（详情弹窗的字段用） */
export function stampLabel(iso?: string): string {
  if (!iso) return '—'
  const day = iso.slice(5, 10).replace('-', '/')
  return iso.length > 10 ? `${day} ${iso.slice(11, 16)}` : day
}

/** `2026-09-20T14:00` → `14:00–15:00`（时间轴块的 title） */
export function rangeLabel(startClock: string, estMin: number): string {
  const from = clockToMin(startClock)
  return `${minToClock(from)}–${minToClock(from + estMin)}`
}

/* ============================================================
 * 五 · 初始数据与派生
 * ============================================================ */

function withDerived(row: Omit<TaskRow, 'overdueDays'>): TaskRow {
  const dueDay = row.dueAt.slice(0, 10)
  const late = row.state !== 'done' && dueDay < DEMO_TODAY
  return { ...row, overdueDays: late ? Math.max(1, dayDiff(DEMO_TODAY, dueDay)) : 0 }
}

/** 页面初始的任务数组（组件持有它的副本，交互改副本）。 */
export function initialTasks(): TaskRow[] {
  return LEDGER.map(withDerived)
}

/** 这条任务今天完成了没 —— 「全部任务列表的已完成组」「看板第三列」都用它 */
export function completedToday(row: TaskRow): boolean {
  return !!row.completedAt && row.completedAt.slice(0, 10) === DEMO_TODAY
}

/** 是否属于"全部任务"这一批（= 原型的列表视图口径：收件箱项不在内） */
function inAllBucket(row: TaskRow): boolean {
  return !row.kind
}

const PRIO_RANK: Record<TaskPrio, number> = { high: 0, mid: 1, low: 2 }

/** 列表视图的行：未完成的在前（按 逾期 → 截止），今天是今天完成的、排在后面 */
export function listRows(tasks: TaskRow[]): { open: TaskRow[]; done: TaskRow[] } {
  const bucket = tasks.filter(inAllBucket)
  const open = bucket
    .filter((row) => row.state !== 'done')
    .sort((a, b) => {
      /* 「逾期 → 今天 → 之后」——逾期天数降序 = 越早到期越靠前 */
      if (a.overdueDays !== b.overdueDays) return b.overdueDays - a.overdueDays
      return a.dueAt.localeCompare(b.dueAt)
    })
  const done = bucket.filter((row) => row.state === 'done' && completedToday(row))
  return { open, done }
}

/** 看板三列：列内按「逾期 → 高 → 中 → 低」（原型那句副标题说的就是它） */
export function boardColumns(tasks: TaskRow[]): { todo: TaskRow[]; doing: TaskRow[]; done: TaskRow[] } {
  const bucket = tasks.filter(inAllBucket)
  const sort = (a: TaskRow, b: TaskRow) => {
    if (a.overdueDays !== b.overdueDays) return b.overdueDays - a.overdueDays
    if (PRIO_RANK[a.prio] !== PRIO_RANK[b.prio]) return PRIO_RANK[a.prio] - PRIO_RANK[b.prio]
    return a.dueAt.localeCompare(b.dueAt)
  }
  return {
    todo: bucket.filter((row) => row.state === 'todo').sort(sort),
    doing: bucket.filter((row) => row.state === 'doing').sort(sort),
    done: bucket.filter((row) => row.state === 'done' && completedToday(row)).sort(sort),
  }
}

/** 四象限：只描述未完成的那一批（已完成的 2 项不参与划分，与原型同） */
export function matrixBoxes(tasks: TaskRow[]): Record<1 | 2 | 3 | 4, TaskRow[]> {
  const open = tasks.filter((row) => inAllBucket(row) && row.state !== 'done')
  /**
   * 格内顺序：今天已有排期落点的排在前面，其余保持数据顺序。
   * 为什么不是"按截止时间排"：q1 里"准备项目评审"（今天 14:00，已排期）排在
   * "优化首页加载速度"（逾期 2 天）前面，而 q2 里又是纯粹的截止时间升序 ——
   * 一条规则盖不住两格（原型的矩阵顺序是手写的）。这条规则是能同时说通两格的那一条：
   * 已排期的今天真的要动手，所以它在前。
   */
  const rank = (a: TaskRow, b: TaskRow) => Number(!!b.scheduledStart) - Number(!!a.scheduledStart)
  return {
    1: open.filter((row) => row.quad === 1).sort(rank),
    2: open.filter((row) => row.quad === 2).sort(rank),
    3: open.filter((row) => row.quad === 3).sort(rank),
    4: open.filter((row) => row.quad === 4).sort(rank),
  }
}

export const MATRIX_TITLES: Record<1 | 2 | 3 | 4, string> = {
  1: '🔥 重要紧急',
  2: '📌 重要不紧急',
  3: '⏰ 紧急不重要',
  4: '☕ 不紧急不重要',
}

/** 时间轴：块（按排期定位）与空档（窗口 − 已排区间） */
export interface TimelineBlock {
  row: TaskRow
  startRow: number
  span: number
}
export interface TimelineGap {
  startRow: number
  span: number
  minutes: number
}

export interface Timeline {
  blocks: TimelineBlock[]
  gaps: TimelineGap[]
}

/**
 * 由数据算出时间轴。
 *
 * 空档是算出来的，不是写死的 —— 这正是"今天到底排不排得下"这句话的依据：
 *    排进去一项，空档自己变短、负荷自己变大。
 * 只有 ≥2 行（≥1 小时）的空档会渲染出来（一行高的空档放不下"空档 1h"这几个字），
 *    而"空档 Xh"这个读数只统计渲染出来的那些 —— 与原型一致
 *    （原型的 `tlGap()` 就是遍历 `.tl-gap` 求和）。别顺手把它改成"全量空档"，
 *    那样读数会从 8h 变成 9h、和原型对不上。
 */
export function timeline(tasks: TaskRow[]): Timeline {
  const placed = tasks
    .filter((row) => row.scheduledStart)
    .map((row) => {
      const startRow = (clockToMin(row.scheduledStart!) - TL_WINDOW.startMin) / TL_WINDOW.rowMin + 1
      return { row, startRow, span: Math.max(1, Math.round((row.estMin ?? TL_WINDOW.rowMin) / TL_WINDOW.rowMin)) }
    })
    .filter((block) => block.startRow >= 1 && block.startRow + block.span - 1 <= TL_ROWS)
    .sort((a, b) => a.startRow - b.startRow)

  const gaps: TimelineGap[] = []
  let cursor = 1
  for (const block of placed) {
    const free = block.startRow - cursor
    if (free >= 2) gaps.push({ startRow: cursor, span: free, minutes: free * TL_WINDOW.rowMin })
    cursor = Math.max(cursor, block.startRow + block.span)
  }
  const tail = TL_ROWS - cursor + 1
  if (tail >= 2) gaps.push({ startRow: cursor, span: tail, minutes: tail * TL_WINDOW.rowMin })

  return { blocks: placed, gaps }
}

/** 「已排」总时长（分钟）—— 时间轴上所有块的和 */
export function timelineLoad(tasks: TaskRow[]): number {
  return timeline(tasks).blocks.reduce((sum, block) => sum + (block.row.estMin ?? 0), 0)
}

/** 「空档」总时长（分钟）—— 只统计渲染出来的空档（见 `timeline` 的注释） */
export function timelineGapMinutes(tasks: TaskRow[]): number {
  return timeline(tasks).gaps.reduce((sum, gap) => sum + gap.minutes, 0)
}

/**
 * 待排池：今天（`inToday`）与本周两组。
 *
 * 成员关系只看 `pooled`，不看有没有排期 —— 排进去之后那一行留在原地
 *    （文字降级 + 按钮变成「已排 HH:MM」），见 `TaskRow.pooled` 的注释。
 *    原型的"今天 · 1 项 / 本周 · 2 项"就是这一刀（买猫粮 inToday ⇒ 今天；
 *    优化首页 / 整理房间 ⇒ 本周）。
 */
export function poolGroups(tasks: TaskRow[]): { today: TaskRow[]; week: TaskRow[] } {
  const pending = tasks.filter((row) => row.pooled)
  return {
    today: pending.filter((row) => row.inToday),
    week: pending.filter((row) => !row.inToday),
  }
}

/** 排期时最后一个够长的空档（放不下就返回 null —— 绝不插到半个格子上） */
export function findSlot(tasks: TaskRow[], needMin: number): TimelineGap | null {
  const need = Math.max(1, Math.round(needMin / TL_WINDOW.rowMin))
  const gaps = timeline(tasks).gaps
  for (let i = gaps.length - 1; i >= 0; i -= 1) {
    if (gaps[i].span >= need) return gaps[i]
  }
  return null
}

/** 已完成分区：本周完成，按「今天 / 昨天 / 更早」分组 */
export function doneGroups(tasks: TaskRow[]): { key: string; label: string; rows: TaskRow[] }[] {
  const done = tasks
    .filter((row) => row.state === 'done' && !row.kind)
    .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  const pick = (predicate: (row: TaskRow) => boolean) => done.filter(predicate)
  const today = pick((row) => dayDiff(row.completedAt!.slice(0, 10), DEMO_TODAY) === 0)
  const yesterday = pick((row) => dayDiff(row.completedAt!.slice(0, 10), DEMO_TODAY) === 1)
  const earlier = pick((row) => dayDiff(row.completedAt!.slice(0, 10), DEMO_TODAY) > 1)
  return [
    { key: 'today', label: '今天', rows: today },
    { key: 'yesterday', label: '昨天', rows: yesterday },
    { key: 'earlier', label: '更早', rows: earlier },
  ]
}

/** 分布条（侧轨）：按领域 / 按优先级 —— 统计的只有列表视图的行 */
export function distribution(tasks: TaskRow[]) {
  const { open, done } = listRows(tasks)
  /* 统计口径 = 列表视图的行。看板卡 / 四象限项 / 日历 chip 也参与二级筛选，
     但它们不能进统计 —— 否则同一任务被数四遍（原型那条注释说的就是这件事）。 */
  const visible = [...open, ...done]
  const byScope = (['work', 'life', 'learn'] as TaskScope[]).map((key) => ({
    key,
    label: SCOPE_LABEL[key],
    count: visible.filter((row) => row.scope === key).length,
  }))
  const byPrio = (['high', 'mid', 'low'] as TaskPrio[]).map((key) => ({
    key,
    label: PRIO_LABEL[key],
    count: visible.filter((row) => row.prio === key).length,
  }))
  return { total: visible.length, byScope, byPrio }
}

/** 本周完成节奏：周一~周日各完成几项（柱高 = 计数） */
export function weekRhythm(tasks: TaskRow[]) {
  /* 2026-09-20 是周日 ⇒ 本周一是 09-14。周一起算（spec §5-3）。 */
  const monday = '2026-09-14'
  const days = ['一', '二', '三', '四', '五', '六', '日']
  const done = tasks.filter((row) => row.state === 'done' && !row.kind && row.completedAt)
  const counts = days.map((_, index) => {
    const date = new Date(Date.parse(`${monday}T00:00`) + index * DAY_MS).toISOString().slice(0, 10)
    return done.filter((row) => row.completedAt!.slice(0, 10) === date).length
  })
  const peak = Math.max(1, ...counts)
  return { days, counts, peak, total: counts.reduce((a, b) => a + b, 0) }
}

export const SCOPE_LABEL: Record<TaskScope, string> = { life: '生活', work: '工作', learn: '学习' }
export const PRIO_LABEL: Record<TaskPrio, string> = { high: '高', mid: '中', low: '低' }
export const KIND_LABEL: Record<TaskKind, string> = { todo: '未整理', idea: '想法', ref: '参考' }
export const STATE_LABEL: Record<TaskState, string> = { todo: '待办', doing: '进行中', done: '已完成' }

/** 行上那枚 chip 的修饰类（原型的 `.tag-life` / `.tag-high` / `.tag-todo` …） */
export function scopeTagClass(scope: TaskScope): string {
  return `tag-${scope}`
}
export function prioTagClass(prio: TaskPrio): string {
  return `tag-${prio}`
}
export function kindTagClass(kind: TaskKind): string {
  return `tag-${kind}`
}

/* ============================================================
 * 六 · 日历（2026 年 9 月）
 * ============================================================ */

export interface CalCell {
  num: number
  muted: boolean
  today: boolean
  tasks: { id: string; label: string; scope: TaskScope }[]
  overflow: number
}

/**
 * 九月的 42 格。落格只认有明确日期的任务（写"本周"的整理房间不落格）——
 * 原型的注脚就是这么说的。9/20 那格另有 3 项收在「+3」里（原型里它们没有名字，
 * 所以这里也只能是个数字：不编三条假任务出来）。
 *
 * 已完成的也落格（9/17 写周报、9/18 买菜、9/19 搭 Vite 框架都是 done）——
 *    日历回答的是"那一天有什么"，不是"那一天还剩什么"。
 *
 * 格内顺序（`CAL_STATE_RANK`）：已完成 → 进行中 → 待办。原型的格内顺序是手写的，
 *    这条规则是唯一能同时说通两格的那一条：18 号"买菜"（已完成）排在
 *    "优化加载"（进行中）前面；20 号"准备项目评审"（进行中）排在两个待办前面。
 */
const CAL_STATE_RANK: Record<TaskState, number> = { done: 0, doing: 1, todo: 2 }

export function calendarCells(tasks: TaskRow[]): CalCell[] {
  const cells: CalCell[] = []
  /* 8/31 起，共 42 格；muted = 不属于 9 月 */
  const start = Date.parse('2026-08-31T00:00')
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start + i * DAY_MS).toISOString().slice(0, 10)
    const num = Number(date.slice(8, 10))
    const muted = date.slice(5, 7) !== '09'
    const day = Number(date.slice(8, 10))
    const onThisDay = muted
      ? []
      : tasks
          .filter((row) => row.calDay === day)
          .sort((a, b) => CAL_STATE_RANK[a.state] - CAL_STATE_RANK[b.state])
          .map((row) => ({ id: row.id, label: row.calLabel ?? row.title, scope: row.scope }))
    cells.push({
      num,
      muted,
      today: date === DEMO_TODAY,
      tasks: onThisDay,
      /* 9/20 那格原型折了 3 项（见函数注释） */
      overflow: !muted && day === 20 ? 3 : 0,
    })
  }
  return cells
}

/** 日历标题：「2026 年 9 月」+「N 天有安排」 */
export function calendarSummary(cells: CalCell[]) {
  return { title: '2026 年 9 月', busyDays: cells.filter((cell) => cell.tasks.length > 0).length }
}

/* ============================================================
 * 七 · 读数（KPI / 区块计数）—— 一律现算，不写死
 * ============================================================ */

export interface TaskStats {
  /* 「全部任务」的 4 张 KPI */
  total: number
  totalDesc: string
  todayDue: number
  todayDueDesc: string
  overdue: number
  overdueDesc: string
  week: number
  weekDesc: string
  /* 「今日」的 4 张 KPI */
  todayOpen: number
  todayOpenDesc: string
  todayDone: number
  todayLoad: number
  todayLoadDesc: string
  todayNext: string
  todayNextDesc: string
  /* 侧栏副标题与顶栏徽标 */
  openCount: number
}

/**
 * 「下一件事」= 时间轴上起点在现在之后的第一个块（按开始时刻）。
 * 没有未来块时给"—"，不编一个时刻出来。
 */
function nextUp(tasks: TaskRow[]): { clock: string; row: TaskRow } | null {
  const nowMin = clockToMin(DEMO_NOW.slice(11, 16))
  const future = timeline(tasks).blocks
    .filter((block) => clockToMin(block.row.scheduledStart!) > nowMin)
    .sort((a, b) => clockToMin(a.row.scheduledStart!) - clockToMin(b.row.scheduledStart!))
  if (!future.length) return null
  return { clock: future[0].row.scheduledStart!, row: future[0].row }
}

export function taskStats(tasks: TaskRow[]): TaskStats {
  const { open, done } = listRows(tasks)
  const bucket = tasks.filter(inAllBucket)
  const todayRows = bucket.filter((row) => row.inToday)
  const todayOpenRows = todayRows.filter((row) => row.state !== 'done')
  const overdueRows = open.filter((row) => row.overdueDays > 0)
  const doneRows = tasks.filter((row) => row.state === 'done' && !row.kind)
  const weekDone = doneRows.length
  const weekToday = doneRows.filter(completedToday).length
  const load = timelineLoad(tasks)
  const gap = timelineGapMinutes(tasks)
  const next = nextUp(tasks)

  return {
    total: open.length + done.length,
    totalDesc: `待办 ${bucket.filter((r) => r.state === 'todo').length} · 进行中 ${
      bucket.filter((r) => r.state === 'doing').length
    } · 已完成 ${bucket.filter((r) => r.state === 'done').length}`,
    todayDue: todayRows.length,
    todayDueDesc: `已完成 ${todayRows.length - todayOpenRows.length} · 剩余 ${todayOpenRows.length}`,
    overdue: overdueRows.length,
    /* 「今天 N · 更早 M」是原型的口径：它把"逾期 1 天"算作"今天（刚过期）"。
       按原型的写法是 `今天 1 · 更早 ${overdue - 1}`，这里按同一口径推导，
       不写死那个 1 —— 否则勾掉一条逾期项之后这个数字就对不上了。 */
    overdueDesc: `今天 ${overdueRows.filter((r) => r.overdueDays === 1).length} · 更早 ${
      overdueRows.filter((r) => r.overdueDays > 1).length
    }`,
    week: weekDone,
    weekDesc: `今天 ${weekToday} · 更早 ${weekDone - weekToday}`,

    todayOpen: todayOpenRows.length,
    todayOpenDesc: `高优先级 ${todayOpenRows.filter((r) => r.prio === 'high').length} · 其余 ${
      todayOpenRows.filter((r) => r.prio !== 'high').length
    }`,
    todayDone: todayRows.filter((r) => r.state === 'done').length,
    todayLoad: load,
    todayLoadDesc: `空档 ${hoursText(gap / 60)} · 待排 ${poolGroups(tasks).today.length + poolGroups(tasks).week.length} 项`,
    todayNext: next ? next.clock : '—',
    todayNextDesc: next
      ? `${next.row.title} · 还有 ${hoursText(
          (clockToMin(next.clock) - clockToMin(DEMO_NOW.slice(11, 16))) / 60,
        )} 小时`
      : '今天没有排期',

    openCount: open.length,
  }
}

/** 收件箱的「整理建议」—— 原型里是 3 条写死的建议，这里保留原文案（没有推导来源） */
export const INBOX_SUGGESTIONS = [
  { id: 's1', text: '「研究一下 Vite 插件」像学习事项', action: '归学习' },
  { id: 's2', text: '「看看新的 React 19 文档」可拆成 3 步', action: 'AI 拆解' },
  { id: 's3', text: '2 条想法已停留超过 3 天', action: '做决定' },
]
