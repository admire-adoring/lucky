import { AI_FACTS } from './facts'
import type { AiAttachment, AiMessage, AiThoughtStep } from './types'

/**
 * 意图 → 回复。**每个数字都从 `AI_FACTS` 现算**，没有口径的明说。
 *
 * ============================================================================
 * 为什么不像原型那样写一段固定文案
 * ============================================================================
 * 原型的 `buildReply` 是四个 `if (/正则/.test(t))` 分支，每个分支返回一段写死的
 * 中文（含写死的数字）。照搬的话，用户换了项目、改了进度，回答还是那句 ——
 * 这比"回答不了"更糟：它看起来是对的。
 *
 * 所以这里的每个分支都做同一件事：**读真实派生 → 拼句子**。
 * 没有数据源的意图（日程 / 附件 / 联网）**直接说没有**，不回一段像模像样的话。
 *
 * ⚠️ 有一处必须点明：应用里**没有任何模型调用**。这不是"接了个假模型"，
 *    而是一条**确定性的规则引擎** —— 它只回答能从本地数据算出来的问题。
 *    所以对超出能力的问题，正确的行为是承认，而不是生成一段话。
 *    这一条写进了开场白（"涉及日程与附件解析的问题，我会直说"）。
 */

export interface ReplyInput {
  /** 用户原话 */
  text: string
  /** 本次带上的附件（只有元数据） */
  attachments: AiAttachment[]
  /** 消息 id（由 store 生成，保证唯一） */
  id: string
  /** 显示用时间（时:分） */
  time: string
}

/** 四拍思考链的公共第一步：意图分类。写一次，六个分支共用 */
function intentStep(label: string): AiThoughtStep {
  return { title: '解析用户意图', desc: [{ text: `识别为「${label}」。` }] }
}

/** 缺数据源时的公共收尾步骤 */
function missingSourceStep(what: string): AiThoughtStep {
  return {
    title: '检查数据源',
    desc: [{ text: `${what}在本应用里没有对应的事实源，这一步跳过。` }],
    branches: [{ text: `${what}：没有数据源`, status: 'skip' }],
    key: [{ text: '没有来源的数字不写进回答' }],
  }
}

export function buildReply(input: ReplyInput): AiMessage {
  const t = input.text
  const f = AI_FACTS

  /* ---------- ① 全域概览 ---------- */
  if (/全域|整体|概览|总览|全部|overview/i.test(t)) {
    return {
      id: input.id,
      role: 'assistant',
      time: input.time,
      thought: [
        intentStep('全域概览'),
        {
          title: '聚合全域数据',
          desc: [{ text: `读 ${f.projectCount} 个项目与 ${f.tasks.total} 条任务的聚合值。` }],
          branches: [
            { text: `进行中 ${f.stats.active} 个 · 风险 ${f.stats.risk} 个 · 已完成 ${f.stats.done} 个`, status: 'done' },
            { text: `平均进度 ${f.stats.averageProgress}%`, status: 'done' },
            { text: `域均值：生活 ${f.dom.life.avg}% / 工作 ${f.dom.work.avg}% / 学习 ${f.dom.learn.avg}%`, status: 'done' },
          ],
        },
        {
          title: '排序与定位',
          desc: [{ text: '按剩余天数排出最紧的项目。' }],
          key: f.dueTop2.length
            ? [{ text: `先看「${f.dueTop2[0].name}」（剩余 ${f.dueTop2[0].daysLeft} 天）` }]
            : [{ text: '没有待到期项目' }],
        },
      ],
      text: [
        { text: '全域平均进度 ' },
        { text: `${f.stats.averageProgress}%`, em: true },
        { text: `，共 ${f.projectCount} 个项目：进行中 ${f.stats.active} 个，风险 ${f.stats.risk} 个，已完成 ${f.stats.done} 个。` },
      ],
      quote: {
        lines: [
          [{ text: `任务：${f.tasks.done} / ${f.tasks.total} 完成（${f.tasks.rate}%）· 待办 ${f.tasks.todo} 条` }],
          [{ text: `域均值：生活 ${f.dom.life.avg}% · 工作 ${f.dom.work.avg}% · 学习 ${f.dom.learn.avg}%` }],
          ...f.dueTop2.map((p) => [{ text: `最紧：${p.name} —— 剩余 ${p.daysLeft} 天 · ${p.progress}%` }]),
        ],
      },
      suggestions: ['工作域这周怎么样', '有哪些逾期任务', '写一份本周周报'],
    }
  }

  /* ---------- ② 某个域 ---------- */
  const domain =
    /工作|work/i.test(t) && /域|周|进度|情况/.test(t)
      ? ({ key: 'work', label: '工作' } as const)
      : /生活|life/i.test(t) && /域|周|进度|情况/.test(t)
        ? ({ key: 'life', label: '生活' } as const)
        : /学习|learn/i.test(t) && /域|周|进度|情况/.test(t)
          ? ({ key: 'learn', label: '学习' } as const)
          : null

  if (domain) {
    const agg = f.dom[domain.key]
    const gap = f.globalAvg - agg.avg
    const lag = f.laggard[domain.key]
    return {
      id: input.id,
      role: 'assistant',
      time: input.time,
      thought: [
        intentStep(`${domain.label}域周况`),
        {
          title: `读取${domain.label}域数据`,
          desc: [{ text: `按 scope=${domain.key} 过滤 ${f.projectCount} 个项目，统计 ${agg.total} 条任务。` }],
          branches: [
            { text: `完成度：${agg.done} / ${agg.total}（${agg.rate}%）`, status: 'done' },
            { text: `域均值：${agg.avg}%`, status: 'done' },
            { text: `跨域对比（全域 ${f.globalAvg}%）`, status: 'done' },
          ],
        },
        {
          title: '计算与定位',
          desc: [
            { text: `${domain.label}域 ${agg.avg}% 与全域 ${f.globalAvg}% 相差 ` },
            { text: `${gap >= 0 ? '低' : '高'} ${Math.abs(gap)} 个百分点`, em: true },
            { text: '。' },
          ],
        },
        {
          title: '生成建议',
          desc: [{ text: '取该域内进度最低的未完成项目。' }],
          key: lag ? [{ text: `先看「${lag.name}」（${lag.progress}%）` }] : [{ text: `${domain.label}域没有未完成项目` }],
        },
      ],
      text: [
        { text: `${domain.label}域平均进度 ` },
        { text: `${agg.avg}%`, em: true },
        {
          text:
            gap > 0
              ? `，低于全域 ${gap} 个百分点。`
              : gap < 0
                ? `，高于全域 ${-gap} 个百分点。`
                : '，与全域持平。',
        },
      ],
      quote: {
        lines: [
          [{ text: `任务：${agg.done} / ${agg.total} 完成（${agg.rate}%）` }],
          [{ text: `待办：${agg.todo} 条` }],
          ...(lag ? [[{ text: `拖累项：${lag.name}（${lag.progress}%）` }]] : []),
        ],
      },
      suggestions: [`${domain.label}域有哪些逾期任务`, '全域现在什么情况', '写一份本周周报'],
    }
  }

  /* ---------- ③ 逾期 / 任务 ---------- */
  if (/逾期|超期|late/i.test(t)) {
    const lines = f.lateTasks.slice(0, 6).map(({ project, task }) => [
      { text: `· ${task.name}（${project.name}）` },
    ])
    return {
      id: input.id,
      role: 'assistant',
      time: input.time,
      thought: [
        intentStep('逾期任务'),
        {
          title: '按项目展开任务',
          desc: [{ text: `对 ${f.projectCount} 个项目逐个派生任务，再筛出 late。` }],
          branches: [
            { text: `任务总量 ${f.tasks.total} 条`, status: 'done' },
            { text: `逾期 ${f.lateCount} 条`, status: f.lateCount ? 'done' : 'skip' },
            { text: `待办 ${f.tasks.todo} 条（含未到期的）`, status: 'done' },
          ],
        },
        {
          title: '组装输出',
          desc: [{ text: '列出逾期项及其所属项目。' }],
          key: f.lateCount ? [{ text: `共 ${f.lateCount} 条逾期，先处理最靠前的` }] : [{ text: '没有逾期任务' }],
        },
      ],
      text: f.lateCount
        ? [
            { text: '当前有 ' },
            { text: `${f.lateCount} 条逾期任务`, em: true },
            { text: '：' },
          ]
        : [
            { text: '当前' },
            { text: '没有逾期任务', em: true },
            { text: `。待办 ${f.tasks.todo} 条都还在期限内。` },
          ],
      quote: f.lateCount ? { lines } : undefined,
      suggestions: ['全域现在什么情况', '写一份本周周报'],
    }
  }

  if (/任务|待办|todo|清单/i.test(t)) {
    return {
      id: input.id,
      role: 'assistant',
      time: input.time,
      thought: [
        intentStep('任务概览'),
        {
          title: '聚合任务',
          desc: [{ text: `读 ${f.tasks.total} 条任务的完成情况。` }],
          branches: [
            { text: `已完成 ${f.tasks.done} 条（${f.tasks.rate}%）`, status: 'done' },
            { text: `待办 ${f.tasks.todo} 条`, status: 'done' },
            { text: `逾期 ${f.lateCount} 条`, status: 'done' },
          ],
        },
      ],
      text: [
        { text: `共 ${f.tasks.total} 条任务，已完成 ` },
        { text: `${f.tasks.done} 条（${f.tasks.rate}%）`, em: true },
        { text: `，待办 ${f.tasks.todo} 条` },
        { text: f.lateCount ? `，其中 ${f.lateCount} 条已逾期` : '' },
        { text: '。' },
      ],
      suggestions: ['有哪些逾期任务', '全域现在什么情况'],
    }
  }

  /* ---------- ④ 日程：**没有数据源，明说** ---------- */
  if (/日程|会议|安排|schedule|calendar/i.test(t)) {
    return {
      id: input.id,
      role: 'assistant',
      time: input.time,
      thought: [
        intentStep('日程查询'),
        missingSourceStep('日程表（会议 / 时间块）'),
        {
          title: '改用可得的来源',
          desc: [{ text: '退一步给出"最待到期"的项目 —— 那是同一类问题里唯一有口径的答案。' }],
          key: [{ text: '没有日程数据源，只给有口径的部分' }],
        },
      ],
      text: [
        { text: '这一条我答不了：应用里' },
        { text: '没有日程数据源', em: true },
        { text: '（没有会议表、也没有时间块），所以没有"今天几点到几点"这种东西。' },
        { text: '\n能确定的是任务与项目的到期情况：', em: true },
      ],
      quote: {
        lines: [
          [{ text: `待办 ${f.tasks.todo} 条${f.lateCount ? ` · 逾期 ${f.lateCount} 条` : ''}` }],
          ...f.dueTop2.map((p) => [{ text: `${p.name} —— 剩余 ${p.daysLeft} 天 · ${p.progress}%` }]),
        ],
      },
      suggestions: ['有哪些逾期任务', '全域现在什么情况'],
    }
  }

  /* ---------- ⑤ 周报：按真实数据拼，不编 ---------- */
  if (/周报|总结|汇总|report/i.test(t)) {
    return {
      id: input.id,
      role: 'assistant',
      time: input.time,
      thought: [
        intentStep('生成周报草稿'),
        {
          title: '收集本周口径',
          desc: [{ text: '取全域与三域的完成度、均值和最紧项目。' }],
          branches: [
            { text: `任务完成率 ${f.tasks.rate}%`, status: 'done' },
            { text: `三域均值 生活 ${f.dom.life.avg}% / 工作 ${f.dom.work.avg}% / 学习 ${f.dom.learn.avg}%`, status: 'done' },
            { text: '本周每日工时 —— 应用里没有该数据源', status: 'skip' },
          ],
        },
        {
          title: '成文',
          desc: [{ text: '按"完成任务 / 进度分布 / 风险 / 下周重点"四段拼。' }],
          key: [{ text: '草稿里的每个数字都可回溯到 projects.ts' }],
        },
      ],
      text: [
        { text: '这是按当前数据拼的周报草稿 —— 每个数字都能在项目页找到出处：' },
      ],
      quote: {
        lines: [
          [{ text: `1 · 完成任务：${f.tasks.done} / ${f.tasks.total}（${f.tasks.rate}%）` }],
          [{ text: `2 · 进度分布：生活 ${f.dom.life.avg}% · 工作 ${f.dom.work.avg}% · 学习 ${f.dom.learn.avg}%` }],
          [
            {
              text: `3 · 风险：${f.stats.risk} 个风险项目${f.lateCount ? `，逾期任务 ${f.lateCount} 条` : ''}`,
            },
          ],
          ...(f.laggard.work ? [[{ text: `4 · 下周重点：推进「${f.laggard.work.name}」` }]] : []),
        ],
      },
      suggestions: ['全域现在什么情况', '有哪些逾期任务'],
    }
  }

  /* ---------- ⑥ 附件 / 数据分析：**需要后端，明说** ---------- */
  if (input.attachments.length || /报告|数据|分析|转化|csv|excel/i.test(t)) {
    const names = input.attachments.map((a) => a.name).join('、')
    return {
      id: input.id,
      role: 'assistant',
      time: input.time,
      thought: [
        {
          title: '检查附件',
          desc: [
            {
              text: input.attachments.length
                ? `收到 ${input.attachments.length} 个附件：${names}。`
                : '本条消息没有附件。',
            },
          ],
        },
        missingSourceStep('文件解析与统计服务'),
        {
          title: '如实回复',
          desc: [{ text: '不给编造的统计结果。' }],
          key: [{ text: '附件分析需要后端，界面这一层不替它编数字' }],
        },
      ],
      text: [
        { text: '这一类问题需要' },
        { text: '后端', em: true },
        { text: '：应用里没有文件解析与统计服务' },
        { text: input.attachments.length ? '（附件本身已经收到，但打不开）' : '' },
        { text: '。接入之后这里会给出分渠道的数字与异常点，现在我不给你编一个。' },
      ],
      suggestions: ['全域现在什么情况', '写一份本周周报'],
    }
  }

  /* ---------- ⑦ 兜底：**承认能力边界** ---------- */
  return {
    id: input.id,
    role: 'assistant',
    time: input.time,
    thought: [
      {
        title: '解析输入',
        desc: [{ text: '没有匹配到已知意图。' }],
      },
      missingSourceStep('通用问答（需要模型网关）'),
      {
        title: '如实回复',
        desc: [{ text: '列出这一页真能回答的四类问题。' }],
        key: [{ text: '超出能力就承认，比生成一段像样的话更负责' }],
      },
    ],
    text: [
      { text: '这条我答不了 —— 应用里' },
      { text: '没有接模型', em: true },
      { text: '，这一页跑的是一条确定性的规则引擎，只回答能从本地数据算出来的问题。\n目前能回答的是：' },
    ],
    quote: {
      lines: [
        [{ text: '· 全域 / 某个域的进度与任务完成情况' }],
        [{ text: '· 逾期任务清单' }],
        [{ text: '· 按当前数据拼一份周报草稿' }],
        [{ text: '· 项目剩余天数与风险' }],
      ],
    },
    suggestions: ['全域现在什么情况', '有哪些逾期任务', '写一份本周周报'],
  }
}
