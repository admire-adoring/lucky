import type { ActivityItem, DocumentItem, Milestone, Project, Task } from '../../types'

/**
 * 项目工作区的**适配层与演示数据**。
 *
 * 这个工作区的设计来自 `design/project/project_index.html`。移植时的口径是：
 *
 *   · **有真实来源的一律用真实数据** —— 任务 / 里程碑 / 文档 / 动态来自
 *     `src/api/projects.ts` 的 `fetchProjectDetail`（它按 `Project` 派生），
 *     所以 8 个项目打开是 8 份不同的内容，不是同一个模板。
 *   · **没有来源的才用演示数据**，并且**集中在这一处**、显式标注 ——
 *     笔记、笔记之间的连线、复盘。应用当前没有这三张表。
 *
 * 为什么强调这一点：原型里的任务/里程碑/文档/笔记**全都是写死的**，
 * 照搬过来会让 8 个项目长得一模一样 —— 那是"编数字"，比少一块功能糟得多。
 *
 * ⚠️ 演示数据里也不编数字：文字是**设计推理的记录**（为什么选弥散、为什么留在 HashRouter），
 *    那些是原型的作者在项目里真实写下的结论，不是占位符。
 */

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

/** 四象限。键与 CSS 的 `.quad.q1..q4` 和 `--q1..--q4` 色槽同源。 */
export const QUADS = {
  q1: { name: '重要且紧急', hint: '立即执行' },
  q2: { name: '重要不紧急', hint: '计划安排' },
  q3: { name: '紧急不重要', hint: '委托或快速清' },
  q4: { name: '不重要不紧急', hint: '少做或删除' },
} as const

export type QuadKey = keyof typeof QUADS

/** 任务状态在原型里只有三档（没有 blocked），徽标文案与 CSS `.pill-*` 同源。 */
export const TASK_STATUS = {
  todo: { label: '待办', pill: 'pill-todo' },
  doing: { label: '进行中', pill: 'pill-doing' },
  done: { label: '已完成', pill: 'pill-done' },
} as const

export type WsTaskStatus = keyof typeof TASK_STATUS

/**
 * 应用的任务优先级是三档（high / mid / low），原型的徽标是四档（P0..P3）。
 *
 * ⚠️ 这里**不造第四档**：映射到 P2 封顶，于是 P3 只是样式表里备着、当前不会出现。
 * 硬凑一个 P3 出来就是编数据 —— 而 `.prio-P3` 没被用到并不算缺陷。
 */
const PRIO_OF: Record<Task['priority'], 'P0' | 'P1' | 'P2'> = {
  high: 'P0',
  mid: 'P1',
  low: 'P2',
}

/* ------------------------------------------------------------------ *
 * 适配后的形状（组件只认这些）
 * ------------------------------------------------------------------ */

export interface WsTask {
  id: string
  title: string
  status: WsTaskStatus
  quad: QuadKey
  prio: 'P0' | 'P1' | 'P2' | 'P3'
  due: string
  late: boolean
  /** 承担人（应用的真实字段；原型这一格是"标签"，这里不编标签） */
  owner: string
}

export interface WsMilestone {
  id: string
  name: string
  state: 'done' | 'now' | 'todo'
  detail: string
}

export type WsDoc = DocumentItem

export interface WsActivity {
  id: string
  text: string
  time: string
}

/** 富文本片段：`code` 与 `strong` 是内联强调，渲染层决定套什么标签。 */
export interface WsRun {
  text: string
  code?: boolean
  strong?: boolean
}

export interface WsBlock {
  h: string
  p?: WsRun[]
  ul?: WsRun[][]
}

export interface WsNote {
  id: string
  title: string
  time: string
  tag: string
  star: boolean
  body: WsBlock[]
  /**
   * 关联任务用**下标**而不是 id：任务来自真实派生，id 形如 `p2-t7`，
   * 而笔记是演示数据 —— 写死 id 会在别的项目上全部落空。
   */
  taskIndexes: number[]
}

export interface WsEdge {
  a: string
  b: string
  label: string
}

export interface WsReview {
  verdict: string
  score: number
  good: string[]
  improve: string[]
  lesson: string[]
}

/* ------------------------------------------------------------------ *
 * 富文本：把 `` `code` `` / `**强调**` 解析成片段
 * ------------------------------------------------------------------ */

/**
 * 为什么要有它：原型的演示文案里带着 `<code>` 这类内联 HTML。
 * 直接 `dangerouslySetInnerHTML` 是不行的（见 `src/types/workbench.ts` 的 TextRun 注释），
 * 而全部剥掉又会丢掉"这是一个专有名词"的信号。所以改成在数据里写反引号 / 双星号，
 * 由这里解析成片段数组 —— 数据仍然可读，渲染层拿到的是结构化数据。
 */
export function parseRuns(text: string): WsRun[] {
  const out: WsRun[] = []
  const pattern = /`([^`]+)`|\*\*([^*]+)\*\*/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = pattern.exec(text))) {
    if (m.index > last) out.push({ text: text.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ text: m[1], code: true })
    else if (m[2] !== undefined) out.push({ text: m[2], strong: true })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ text: text.slice(last) })
  return out.length ? out : [{ text }]
}

/* ------------------------------------------------------------------ *
 * 真实数据 → 工作区形状
 * ------------------------------------------------------------------ */

/**
 * 四象限是**推导**出来的，不是数据里写的。
 *
 * 判据（艾森豪威尔矩阵的原始定义）：
 *   重要 = 优先级 高 / 中；  紧急 = 已逾期。
 * 应用的任务模型里只有 `late` 这一个"紧急"信号（没有"临近几天"这一档），
 * 所以只按它判 —— 不额外编一个"3 天内算紧急"的阈值。
 *
 * 推论：只有**风险中项目**才会有 q1/q3 的任务，其余项目 q1/q3 是空的。
 * 这正是四象限想说的话（"没有既重要又紧急的事"），原型的空态文案也是这么写的。
 */
function quadOf(task: Task): QuadKey {
  const important = task.priority !== 'low'
  if (important) return task.late ? 'q1' : 'q2'
  return task.late ? 'q3' : 'q4'
}

/** 任务状态：应用的 `blocked` 归入 `doing` —— 原型只有三档，而"阻塞"仍然在做。 */
function statusOf(task: Task): WsTaskStatus {
  if (task.status === 'done') return 'done'
  if (task.status === 'doing' || task.status === 'blocked') return 'doing'
  return 'todo'
}

export function adaptTasks(tasks: Task[]): WsTask[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.name,
    status: statusOf(task),
    quad: quadOf(task),
    prio: PRIO_OF[task.priority],
    due: task.due,
    late: task.late,
    owner: task.owner,
  }))
}

export function adaptMilestones(milestones: Milestone[]): WsMilestone[] {
  return milestones.map((m) => ({
    id: m.id,
    name: m.name,
    state: m.state === 'now' ? 'now' : m.state === 'done' ? 'done' : 'todo',
    detail: m.detail,
  }))
}

export function adaptDocs(docs: DocumentItem[]): WsDoc[] {
  return docs
}

export function adaptActivity(activity: ActivityItem[]): WsActivity[] {
  return activity.map((a) => ({ id: a.id, text: `${a.who} ${a.action}`, time: a.time }))
}

/* ------------------------------------------------------------------ *
 * 演示数据（应用里没有这张表的部分）
 * ------------------------------------------------------------------ */

/** 笔记：原型的 6 条。内容是关于这个项目自己的设计推理，不是占位文案。 */
export const DEMO_NOTES: WsNote[] = [
  {
    id: 'n1',
    title: '弥散风格 UI 设计笔记',
    time: '昨天',
    tag: '学习',
    star: true,
    taskIndexes: [0, 2],
    body: [
      {
        h: '为什么选弥散',
        p: parseRuns(
          '个人系统的信息密度低、停留时间长。卡片之间的边界感太强，会让人一直处在"处理任务"的状态；弥散（大半径模糊的色团 + 半透明面板）把边界磨掉，整页读起来更像一张纸。',
        ),
      },
      {
        h: '三支色团怎么选',
        p: parseRuns(
          '色团不是装饰，它是氛围的色相来源。低饱和 + 低透明度，三支取相邻色相。饱和度一高，色团自己就变成主角，开始和卡片抢注意力。',
        ),
      },
      {
        h: '面板透过率的代价',
        p: parseRuns(
          '透过率越高越"像玻璃"，但文字对比度会一起掉。实测亮色主题 α 可以低到 .30，但 `暗色不能跟着降` —— 两端都在暗端，一降就直接沉回底衬。',
        ),
      },
    ],
  },
  {
    id: 'n2',
    title: 'React 19 新特性整理',
    time: '3 天前',
    tag: '学习',
    star: false,
    taskIndexes: [],
    body: [
      {
        h: '值得用的',
        p: parseRuns(
          '`use()` 读 Promise 与 Context，配合 Suspense 能把"加载中"从组件里挪出去；表单的 action + `useFormStatus` 省掉一层受控状态。',
        ),
      },
      {
        h: '暂不上车',
        p: parseRuns(
          'React Compiler 还在演进。本项目组件量不大，手写 `memo` 的成本可控，不值得为它引入编译期依赖。',
        ),
      },
      {
        h: '与工作台的关系',
        p: parseRuns('工作台的模块切换是整页重置，用不上并发渲染；真正能省代码的只有 `use()` + Suspense 这一对。'),
      },
    ],
  },
  {
    id: 'n3',
    title: 'Vite 构建优化记录',
    time: '上周',
    tag: '工作',
    star: false,
    taskIndexes: [1],
    body: [
      { h: '起点', p: parseRuns('打包产物 JS 455 KB，在桌面壳里首屏要 400ms 以上。') },
      {
        h: '做法',
        ul: [
          parseRuns('路由级 `lazy()` 拆包；'),
          parseRuns('把令牌表与工作台 Hero 的样式提到首屏；'),
          parseRuns('其余模块按需加载。'),
        ],
      },
      {
        h: '结果与一个坑',
        p: parseRuns(
          '首屏 JS 降到约 180 KB。⚠️ `base=\'./\'` 下产物必须落在 `dist` 根目录 —— 放子目录会 404，而且不报错。',
        ),
      },
    ],
  },
  {
    id: 'n4',
    title: '玻璃材质上的对比度实测记录',
    time: '08-30',
    tag: '设计',
    star: true,
    taskIndexes: [],
    body: [
      {
        h: '为什么不能算',
        p: parseRuns('玻璃的合成亮度取决于它背后是什么。同一个令牌放在纯色底和极光底上，量出来的对比度能差一倍以上。'),
      },
      {
        h: '判据',
        p: parseRuns('一律取"最差相位"：把那块玻璃移到极光最浓的位置再量，而不是在它最舒服的位置量。'),
      },
      {
        h: '刻意保留的偏差',
        p: parseRuns('元信息层 3.14~3.92、发丝线 1.2~1.5。前者可接受，后者只用于分隔、不承载文字。'),
      },
    ],
  },
  {
    id: 'n5',
    title: 'HashRouter 与 file:// 的取舍',
    time: '08-12',
    tag: '架构',
    star: true,
    taskIndexes: [0],
    body: [
      {
        h: '要解决的问题',
        p: parseRuns('同一份产物，既要能被桌面壳内嵌，也要能双击 `dist/index.html` 直接打开。'),
      },
      {
        h: '结论',
        p: parseRuns('HashRouter + `base=\'./\'`。代价是 URL 带 `#`，外链分享要额外拼装。'),
      },
      {
        h: '它牵连到的事',
        p: parseRuns('这条决定同时否掉了"后端独立起 HTTP 服务"的方案 —— 双击打开时没有服务端可以改写路径。'),
      },
    ],
  },
  {
    id: 'n6',
    title: 'Tauri 自绘标题栏的三个坑',
    time: '08-08',
    tag: '外壳',
    star: false,
    taskIndexes: [],
    body: [
      {
        h: '一次拿走四样',
        p: parseRuns('`decorations:false` 会同时去掉窗口控制、拖动、双击缩放、窗口圆角。前三样必须自己补。'),
      },
      {
        h: '圆角',
        p: parseRuns('透明窗口 + 自绘；`Cargo.toml` 的 feature 也要开，否则 `cargo check` 报 allowlist 不匹配。'),
      },
      { h: '代价', p: parseRuns('`macOSPrivateApi` 会让应用无法上架 App Store。这条是明账，不是意外。') },
    ],
  },
]

/**
 * 笔记之间的连线。
 *
 * ⚠️ **这是演示数据，而且只有一条是"真的"** —— 应用当前没有双链表，
 * 任何边都是编出来的。所以这里只保留原型里那条有明确语义的关系（同题），
 * 不再多接：原型的注释写着「留一个孤立节点比把它硬接上去诚实」。
 *
 * 后果要如实说：图谱上大部分节点会是"未连线"。那既是数据的现状，
 * 也正是这个视图想暴露的东西（清单里按连接数排序、未连线单独标色）。
 */
export const DEMO_EDGES: WsEdge[] = [{ a: 'n1', b: 'n4', label: '同题' }]

/** 复盘：原型的演示内容。 */
export const DEMO_REVIEW: WsReview = {
  verdict: '部分达成',
  score: 4,
  good: ['主题系统抽象成 CSS 变量，切换成本低', '项目模块用 scope 隔离，复用度高'],
  improve: ['路由接入延期，前期低估工作量', '文档更新滞后，应边做边写'],
  lesson: ['弥散风格 UI 适合个人系统，氛围好', '色团低饱和 + 低透明度，避免视觉趋同'],
}

export const REVIEW_SECTIONS = [
  { key: 'good', label: '做得好', ph: '写下这次做得好的地方' },
  { key: 'improve', label: '待改进', ph: '写下这次没做好、下次要改的' },
  { key: 'lesson', label: '经验沉淀', ph: '可以复用到别处的结论' },
] as const

export type ReviewKey = (typeof REVIEW_SECTIONS)[number]['key']

export const REVIEW_VERDICTS = ['达成', '部分达成', '未达成'] as const

export const VERDICT_CLASS: Record<string, string> = {
  达成: 'is-ok',
  部分达成: 'is-warn',
  未达成: 'is-danger',
}

export function cloneReview(review: WsReview): WsReview {
  return {
    verdict: review.verdict,
    score: review.score,
    good: review.good.slice(),
    improve: review.improve.slice(),
    lesson: review.lesson.slice(),
  }
}

/* ------------------------------------------------------------------ *
 * 页面用的聚合形状
 * ------------------------------------------------------------------ */

export interface ProjectBundle {
  project: Project
  tasks: WsTask[]
  milestones: WsMilestone[]
  docs: WsDoc[]
  activity: WsActivity[]
  notes: WsNote[]
}

const DOC_ICONS = ['📄', '📘', '🔗', '📎']

export function docIcon(index: number): string {
  return DOC_ICONS[index % DOC_ICONS.length] as string
}
