import type { IconName } from '../../types'
import type { TextRun } from '../../types/workbench'

/**
 * AI 助手（`/ai`）这一页的类型。
 *
 * ============================================================================
 * 富文本为什么是 `TextRun[]` 而不是 HTML 字符串
 * ============================================================================
 * 原型把强调直接写在字符串里（`今天有 <b>3 个日程</b>`），然后在脚本里
 * `innerHTML = m.text`。移植时**不能用 `dangerouslySetInnerHTML`** ——
 * 那等于把一段 HTML 当代码执行，而这段文本将来会来自用户自己的输入。
 * 项目里已经为这件事定过一次口径：`types/workbench.ts` 的 `TextRun`（`em` 片段数组），
 * `AssistantRail` 就按它渲染成 `<strong>`。这里**沿用同一套**，不另发明一份。
 *
 * ⚠️ 配套：生成器把原型 CSS 里的 `b` 选择器改道成了 `strong`（见 `build-ai-css.mjs` 的
 *    TAG_REMAP）。两边不改一致的后果是"渲染 `<strong>`、CSS 配 `b`"——
 *    一个元素都匹配不到，强调色与字重静默失效。 */

export type AiRole = 'user' | 'assistant'

/** 附件 chip。原型里的 `{ name, size, type }` 三项都是**用户文件自己的元数据**，不是编的 */
export interface AiAttachment {
  name: string
  size: string
  /** 扩展名大写，最多 4 个字符（原型 `.slice(0,4)` 的口径） */
  type: string
}

/** 思考链里的一条分支（时间轴面板的"分支"块） */
export interface AiThoughtBranch {
  text: string
  status: 'done' | 'skip' | 'pending'
}

/** 思考链的一步 */
export interface AiThoughtStep {
  title: string
  /**
   * 这一步的耗时。
   *
   * ⚠️ **本页不填它**（`time?` 因此是可选）。原型每一步都挂着 `0.1s / 0.6s`，
   *    消息头还有 `总计 1.2s` —— 那些是演示稿随手写的数：应用里这条链路是
   *    **本地同步计算**，没有分步可测的耗时。理由与处置写在 `conversations.ts` 的文件头。
   *    类型里保留这个槽位，是为了"将来真的接了后端"时有地方放，而不是现在编一个。
   */
  time?: string
  desc: TextRun[]
  branches?: AiThoughtBranch[]
  /** 关键结论（时间轴面板里的高亮块） */
  key?: TextRun[]
}

/** 气泡里的引用块（原型 `.msg-quote`：一组「· xxx」行） */
export interface AiQuote {
  lines: TextRun[][]
}

/** 开场消息里的快捷入口（原型 `.quick-prompt`） */
export interface AiQuickPrompt {
  /** 加粗的那半句 */
  label: string
  /** 后面的说明 */
  hint: string
  /** 点击后**真的发出去**的那句话 */
  ask: string
  icon: IconName
}

export interface AiMessage {
  id: string
  role: AiRole
  /** 只写到时:分（原型口径） */
  time: string
  text: TextRun[]
  /** 气泡里的引用块 */
  quote?: AiQuote
  /** 助手的思考链；用户消息没有 */
  thought?: AiThoughtStep[]
  /** 思考链总耗时 */
  totalTime?: string
  /** 「可以继续问」 */
  suggestions?: string[]
  attachments?: AiAttachment[]
  quickPrompts?: AiQuickPrompt[]

  /* ---------- 第二轮原型新增：状态进数据 ---------- */

  /**
   * 正在生成。
   *
   * ⚠️ 原型第二轮把"生成中"从**全局变量**搬进了**消息自身**
   *    （`state.generating` → `msg.generating`，注释写的是「#17 存入数据」）。
   *    这一步是"继续生成"与"切会话不丢"能成立的前提：
   *    原来那条生成中的消息是临时 DOM，切走再切回来就没了。
   */
  generating?: boolean
  /** 生成进行到第几拍（配合 `AI_STAGE_DURATIONS`） */
  stageIdx?: number
  /** 思考卡的展开态。原型把它存进数据（「#2 记住偏好」），切会话再回来不会折回去 */
  thoughtOpen?: boolean
  /** 实时思考流的展开态 */
  liveOpen?: boolean
  /** 被用户停下来了（可「继续生成」） */
  stopped?: boolean
  /** 重新生成产生的多个版本；长度 > 1 时消息上出现版本切换器 */
  versions?: AiReplyVersion[]
  /** 当前展示第几版 */
  versionIdx?: number
}

/**
 * 一个回答版本。
 *
 * ⚠️ 与原型的关键差别：原型的「重新生成」是 `buildReply(userText)` 再跑一遍 ——
 *    而它是**确定性**的，所以新版本和旧版本**文本完全一样**（唯一不同的是
 *    `totalTime` 那个 `Math.random()` 造出来的数）。也就是说原型的版本切换
 *    切了个寂寞，还顺带编了一个耗时。
 *    本页的处置见 `data/ai/reply.ts` 的 `variant`：事实同源，换的是**讲法**
 *    （摘要 / 逐项 / 精简），于是版本切换真的有东西可切，且没有任何新数字。
 */
export interface AiReplyVersion {
  /** 讲法名，用在切换器的 title 上（"摘要 / 逐项 / 精简"） */
  variantName: string
  variant: ReplyVariant
  text: TextRun[]
  quote?: AiQuote
  thought?: AiThoughtStep[]
}

export type ReplyVariant = 0 | 1 | 2

/** 「上下文」目录里用到的图标（都在精灵里，不新增资产） */
export type AiContextOptionIcon = 'i-list' | 'i-grid' | 'i-project' | 'i-alert'

/** 「添加上下文」选择器里的一项。目录的构造见 `data/ai/contexts.ts` */
export interface AiContextOption {
  /** 稳定 id：`src:<key>` 或 `p:<项目 id>` */
  id: string
  name: string
  sub: string
  icon: AiContextOptionIcon
}

/**
 * 生成中排队的消息（第二轮原型新增的"队列"）。
 *
 * ⚠️ 它是**输入区的内容**而不是消息：入队时用户还没"发出去"，
 *    原型也是把队列放在 `state` 顶层（不是 `sessions` 里）。
 *    下一轮开始时才把 `text`/`attachments` 变成一条真正的用户消息。
 */
export interface AiQueueItem {
  id: string
  text: string
  attachments: AiAttachment[]
}

/** 会话分组。顺序即渲染顺序（原型 `order = ['今天','昨天','更早']`） */
export const AI_SESSION_GROUPS = ['今天', '昨天', '更早'] as const
export type AiSessionGroup = (typeof AI_SESSION_GROUPS)[number]

export interface AiSession {
  id: string
  title: string
  pinned: boolean
  group: AiSessionGroup
  messages: AiMessage[]
  /**
   * 这一轮问答复用的上下文（第二轮原型新增）。
   *
   * ⚠️ 存的是**目录项的 id**，不是名字 —— 原型存的是 `['支付系统重构', 'React 19 笔记']`
   *    这类写死的字符串。名字当主键有两个毛病：改名就对不上、以及**它只能是演示数据**。
   *    本页的目录来自 `data/ai/contexts.ts`，里面每一项都有真实来源（项目表 / 事实层）。
   */
  contexts: string[]
}

/** 模型档位（原型 `.model-option`）。`grad` 是**模型品牌标记**，不是应用状态色 —— 见 aside 的注释 */
export interface AiModel {
  name: string
  sub: string
  /** 两字缩写（`.mo-icon`） */
  short: string
  grad: string
}
