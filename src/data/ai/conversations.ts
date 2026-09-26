import { AI_FACTS } from './facts'
import { DEFAULT_CONTEXTS } from './contexts'
import type { IconName } from '../../types'
import type { AiMessage, AiQuickPrompt, AiSession } from './types'

/**
 * AI 助手的会话内容层。
 *
 * ============================================================================
 * 这一层**不编数字**，也不假装有后端
 * ============================================================================
 * 逐条说明每一段的来源与降级：
 *
 * | 内容 | 来源 | 说明 |
 * | --- | --- | --- |
 * | 会话标题 / 分组 / 置顶 | 原型 | 是"界面示例数据"，不是统计数字，保留 |
 * | 助手回答里的每个数字 | `AI_FACTS` | 由 `projects.ts` + 生成物聚合派生，项目增删就跟着动 |
 * | 思考链的每一步 | 与回答**同一批事实** | 描述这次派生实际做了什么，不是摆设 |
 * | 「3 个日程」这类原型数字 | —— | 应用里**没有日程数据源**，所以明说，不照搬 |
 * | 附件分析（CSV 转化率） | —— | 解析要后端（应用里没有文件解析与统计服务），明说 |
 *
 * ⚠️ **两处刻意的偏离原型，都是"原件在说谎"的那种**：
 *
 *   ① **不搬思考步骤的耗时**。原型每一步都挂着 `0.1s / 0.6s / 0.9s`，
 *      消息头还有 `总计 1.2s`。那些是**演示稿随手写的**：应用里这条链路是
 *      **本地同步计算**（读 `projects.ts` 现算），根本没有可测的分步耗时。
 *      填一组好看的数是"编数字"，而这不是统计口径问题、是凭空。所以
 *      `AiThoughtStep.time` / `AiMessage.totalTime` 整体不填，
 *      渲染层那两个槽位直接不渲染（原型里它们是 `.tc-time` / `.tp-total-time`）。
 *      卡片头上保留的「思考了 N 步」是**真的**（N 就是步骤数）。
 *
 *   ② **不搬会话菜单里的"导出"**。原型的导出只弹一个 toast（
 *      `toast('已导出为 Markdown')`），而应用里没有文件写入通道 ——
 *      弹一句"已导出"等于撒谎。改为明确说明"还没有写入通道"。
 */

/* ---------- 开场白（新建对话时的那条） ---------- */

/**
 * 开场快捷入口。`ask` 是**真的会被发出去**的那句话 ——
 * 原型里 `data-quick` 也是这么用的（点击 = 填入输入框并发送）。
 */
export const AI_QUICK_PROMPTS: AiQuickPrompt[] = [
  { label: '全域概览', hint: '看整体进度与风险', ask: '全域现在什么情况', icon: 'i-grid' },
  { label: '工作域周况', hint: '看工作域进度', ask: '帮我看看工作域这周的整体情况', icon: 'i-project' },
  { label: '逾期任务', hint: '列出需要先处理的', ask: '有哪些逾期任务', icon: 'i-clock' },
  { label: '写周报', hint: '按本周数据生成', ask: '写一份本周周报', icon: 'i-edit' },
]

/** 欢迎语。`name` 由调用方给（登录态里的用户名），数据层不去读 store */
export function greetingMessage(name: string, time: string): AiMessage {
  return {
    id: 'greeting',
    role: 'assistant',
    time,
    text: [
      { text: `你好，${name}。我是你的个人系统助手。可以问项目、任务、进度与周报 —— 这些都能从 ` },
      { text: `${AI_FACTS.projectCount} 个项目、${AI_FACTS.tasks.total} 条任务`, em: true },
      { text: ' 里现算。' },
      { text: '\n涉及日程（会议表）与附件解析的问题，目前还没有数据源，我会直说。', em: true },
    ],
    thought: [
      { title: '初始化会话', desc: [{ text: '加载本轮可用的事实源。' }] },
      {
        title: '准备快捷指令',
        desc: [{ text: `生成 ${AI_QUICK_PROMPTS.length} 个入口，每一个都指向一份已有口径的数据。` }],
        key: [{ text: '四条快捷入口都能真的算出答案' }],
      },
    ],
    quickPrompts: AI_QUICK_PROMPTS,
  }
}

/* ---------- 种子会话（原型 s1 的形状，数字换成真实派生） ---------- */

function seedMessages(): AiMessage[] {
  const { tasks, lateCount, lateTasks, dueTop2, dom, globalAvg, laggard } = AI_FACTS
  const firstLate = lateTasks[0]
  const workGap = globalAvg - dom.work.avg

  return [
    {
      id: 's1-m1',
      role: 'user',
      time: '16:04',
      text: [{ text: '今天有什么安排？' }],
    },
    {
      id: 's1-m2',
      role: 'assistant',
      time: '16:04',
      thought: [
        {
          title: '解析用户意图',
          desc: [{ text: '识别查询类型：日程 + 任务概览。' }],
        },
        {
          title: '并行检索可用事实源',
          desc: [
            { text: '查日程表、任务表、项目表三类来源，' },
            { text: '日程表不存在', em: true },
            { text: '，改用任务与项目。' },
          ],
          branches: [
            { text: '日程表：应用里没有这个数据源', status: 'skip' },
            { text: `任务：${tasks.total} 条（待办 ${tasks.todo}）`, status: 'done' },
            { text: `逾期：${lateCount} 条`, status: 'done' },
          ],
        },
        {
          title: '组装输出',
          desc: [{ text: '只讲有口径的部分，缺的当场说明。' }],
          key: [{ text: '今天没有可读的日程表，能确定的是任务与项目' }],
        },
      ],
      text: [
        { text: '今天没有可读的' },
        { text: '日程表', em: true },
        { text: ' —— 应用里还没有日程数据源，这一段我不会替你编。能确定的是：' },
      ],
      quote: {
        lines: [
          [{ text: `待办任务 ${tasks.todo} 条，已完成 ${tasks.done} / ${tasks.total}（${tasks.rate}%）` }],
          [
            {
              text: lateCount
                ? `逾期 ${lateCount} 条${firstLate ? `，例如「${firstLate.task.name}」（${firstLate.project.name}）` : ''}`
                : '没有逾期任务',
            },
          ],
          ...dueTop2.map((project) => [
            { text: `${project.name} —— 剩余 ${project.daysLeft} 天 · ${project.progress}%` },
          ]),
        ],
      },
    },
    {
      id: 's1-m3',
      role: 'user',
      time: '16:05',
      text: [{ text: '帮我看看工作域这周的整体情况' }],
    },
    {
      id: 's1-m4',
      role: 'assistant',
      time: '16:05',
      thought: [
        {
          title: '解析查询意图',
          desc: [{ text: '识别为「工作域周况」查询，需聚合域内项目与任务。' }],
        },
        {
          title: '读取工作域数据',
          desc: [
            { text: `扫描 ${AI_FACTS.projectCount} 个项目，按 scope=work 过滤，统计 ${dom.work.total} 条任务。` },
          ],
          branches: [
            { text: `完成度：${dom.work.done} / ${dom.work.total}（${dom.work.rate}%）`, status: 'done' },
            { text: `域均值：${dom.work.avg}%`, status: 'done' },
            { text: `跨域对比（全域平均 ${globalAvg}%）`, status: 'done' },
            { text: '工时表 —— 应用里没有该数据源', status: 'skip' },
          ],
        },
        {
          title: '计算与定位',
          desc: [
            { text: `工作域 ${dom.work.avg}% 低于全域 ${globalAvg}%，共 ` },
            { text: `${workGap} 个百分点`, em: true },
            { text: '。' },
          ],
        },
        {
          title: '生成建议',
          desc: [{ text: '定位域内进度最低的未完成项目。' }],
          key: laggard.work
            ? [{ text: `先看「${laggard.work.name}」（${laggard.work.progress}%）` }]
            : [{ text: '工作域没有未完成项目' }],
        },
      ],
      text: [
        { text: '工作域平均进度 ' },
        { text: `${dom.work.avg}%`, em: true },
        { text: `，低于全域 ${workGap} 个百分点。` },
      ],
      quote: {
        lines: [
          [{ text: `任务：${dom.work.done} / ${dom.work.total} 完成（${dom.work.rate}%）` }],
          [{ text: `待办：${dom.work.todo} 条` }],
          [{ text: `域均值：${dom.work.avg}%（生活 ${dom.life.avg}% / 学习 ${dom.learn.avg}%）` }],
          ...(laggard.work ? [[{ text: `拖累项：${laggard.work.name}（${laggard.work.progress}%）` }]] : []),
        ],
      },
      suggestions: ['工作域有哪些逾期任务', '对比工作 / 学习 / 生活的投入', '写一份本周周报'],
    },
    {
      id: 's1-m5',
      role: 'user',
      time: '16:06',
      text: [{ text: '帮我分析一下这份数据报告，重点看转化率' }],
      attachments: [{ name: 'data_report_Q2.csv', size: '1.2 MB', type: 'CSV' }],
    },
    {
      id: 's1-m6',
      role: 'assistant',
      time: '16:06',
      thought: [
        {
          title: '接收附件',
          desc: [{ text: '文件已随消息带上（名称、大小、类型都是本机文件的元数据）。' }],
        },
        {
          title: '尝试解析',
          desc: [
            { text: '应用里没有文件解析与统计服务，' },
            { text: '这一步做不了', em: true },
            { text: '。' },
          ],
          key: [{ text: '附件分析需要后端，界面这一层不替它编数字' }],
        },
      ],
      text: [
        { text: '已收到 ' },
        { text: 'data_report_Q2.csv（1.2 MB）', em: true },
        { text: '，但' },
        { text: '解析这一步需要后端', em: true },
        { text: '：应用里没有 CSV 解析与统计服务，我不会给你一个编出来的转化率。' },
        { text: '\n接入之后，这里会给出分渠道的转化率与异常点。', em: true },
      ],
    },
  ]
}

/** 会话列表 —— 与原型同形（1 个有内容的种子会话 + 6 个只有标题的） */
export function seedSessions(): AiSession[] {
  /* 种子会话的上下文：两个事实源 + 最紧的两个项目（都是真实来源，见 contexts.ts） */
  const seedContexts = [...DEFAULT_CONTEXTS, ...AI_FACTS.dueTop2.map((project) => `p:${project.id}`)]
  return [
    { id: 's1', title: '今天有什么安排', pinned: false, group: '今天', contexts: seedContexts, messages: seedMessages() },
    { id: 's2', title: 'React 19 ref 变化', pinned: false, group: '今天', contexts: [], messages: [] },
    { id: 's3', title: '支付系统重构方案', pinned: true, group: '今天', contexts: [], messages: [] },
    { id: 's4', title: '周报怎么写', pinned: false, group: '昨天', contexts: [], messages: [] },
    { id: 's5', title: '评估一下学习计划', pinned: false, group: '昨天', contexts: [], messages: [] },
    { id: 's6', title: '构建耗时优化', pinned: false, group: '更早', contexts: [], messages: [] },
    { id: 's7', title: '弥散风格 UI 设计', pinned: false, group: '更早', contexts: [], messages: [] },
  ]
}

/* ---------- 模型档位 ---------- */

/**
 * 模型档位。
 *
 * ⚠️ `grad` 是**模型品牌标记**（GPT 那个绿是它的品牌色，不是应用的成功色），
 *    所以生成器**没有**把它们改道到 `--c-success`；照原样保留原型的六位色。
 *    这也是本页唯一几处"色值不由令牌层给"的地方，理由在此。
 *
 * ⚠️ **2026-09-25 纯色化**：四支原来是 135° 的双色渐变，现在各取**两端的中点色**
 *    （`#6366F1+#8B5CF6 → #7761F3` 等），键名 `grad` 保留（含义已变成"标记实色"，
 *    与 `--grad-ai` 同一处理口径）。取中点是为了**只换材质、不动明度**。
 *    实测这四个标记上的白色缩写是 3.5~4.3:1 —— **未达 4.5:1，但这是原渐变本来就有的
 *    状态**（渐变两端同样在 3.5~4.4 之间），本轮不顺手改对比度：
 *    改它要按色相逐个往深里解，那是"改配色"而不是"去渐变"，属另一件事。
 *
 * ⚠️ 这四个档位是**原型内容**：应用里没有模型网关，选了不会真的换模型。
 *    所以 `stores/ai-store.ts` 只把它当作"偏好"存着，并在切换的 toast 里写明。
 */
export const AI_MODELS = [
  { name: 'Claude Sonnet', sub: '快速 · 均衡', short: 'CS', grad: '#7761F3' },
  { name: 'GPT-4o', sub: '多模态 · 强推理', short: 'G4', grad: '#0CA075' },
  { name: 'Gemini 2.5 Pro', sub: '超长上下文', short: 'GM', grad: '#636FF6' },
  { name: '本地 Llama 3', sub: '私有 · 离线', short: 'LL', grad: '#F27E27' },
]

/* ---------- 右栏的「工具」开关 ---------- */

/**
 * AI 能力开关。`on` 是原型的初始态。
 *
 * ⚠️ 这六项**没有消费者**（没有后端）。为什么仍然保留：
 *    它们是"配置"，不是"数据" —— 一个开关的选中态本身不会在界面上显示
 *    一个系统里不存在的状态（那是原型"点一下就变"的演示后门才会有的问题）。
 *    但为了避免"点了没反应"的观感，右栏底部那条**隐私说明**里明写了后端未接入。
 */
export const AI_TOOLS = [
  { key: 'read-tasks', label: '读任务', icon: 'i-list', on: true },
  { key: 'read-projects', label: '读项目', icon: 'i-project', on: true },
  { key: 'read-calendar', label: '读日程', icon: 'i-calendar', on: true },
  { key: 'read-notes', label: '读笔记', icon: 'i-file', on: true },
  { key: 'write-tasks', label: '写任务', icon: 'i-edit', on: false },
  { key: 'search-web', label: '联网搜索', icon: 'i-search', on: false },
] as const satisfies ReadonlyArray<{ key: string; label: string; icon: IconName; on: boolean }>

/* ---------- 输入区的四个能力 chip（原型 `.tool-chip`） ---------- */

export const AI_COMPOSER_CHIPS = [
  { key: 'search', label: '联网', icon: 'i-search', on: false },
  { key: 'context', label: '读数据', icon: 'i-layers', on: true },
  { key: 'code', label: '代码', icon: 'i-edit', on: false },
  { key: 'write', label: '写作', icon: 'i-file', on: false },
]

/**
 * 生成中的四拍阶段。
 *
 * 图标取自应用已有的精灵（`IconSprite`），**没有新增图标资产** ——
 * 判据与侧栏那次一致：新增图标要同时动 `IconSprite.tsx` 与 `IconName` 联合类型两处，
 * 而"解析 / 检索 / 分析 / 组装"这四拍用现成的钟表、放大镜、对勾已经够表意了。
 */
export const AI_STAGES = [
  { name: '解析', icon: 'i-clock' },
  { name: '检索', icon: 'i-search' },
  { name: '分析', icon: 'i-trend' },
  { name: '组装', icon: 'i-check' },
] as const satisfies ReadonlyArray<{ name: string; icon: IconName }>

/**
 * 四拍各自的停留时长（毫秒）。
 *
 * ⚠️ 原型第二轮把它改成了**不等长**的 `[300, 700, 500, 400]`（注释写「#16 各阶段耗时不同」），
 *    理由是"看起来更像真的在干活"。照搬即可 —— 它是**界面节奏**，不是对数据的声明
 *    （与"思考步骤的耗时"不同：那个是假装在报处理时间，已按前面的理由整族不填）。
 */
export const AI_STAGE_DURATIONS = [300, 700, 500, 400]

/** 生成中的实时步骤（与阶段指示器是两个东西：阶段是横向四拍，步骤是纵向明细） */
export const AI_LIVE_STEPS = [
  { title: '解析用户意图', desc: '识别查询类型与关键实体。' },
  { title: '检索可用事实源', desc: '读取项目、任务与域聚合，并标出缺失的数据源。' },
  { title: '计算与排序', desc: '按优先级与剩余天数排序。' },
  { title: '组装最终回答', desc: '结构化输出并标注关键结论。' },
]
