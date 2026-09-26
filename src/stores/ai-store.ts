import { create } from 'zustand'
import {
  AI_COMPOSER_CHIPS,
  AI_LIVE_STEPS,
  AI_MODELS,
  AI_STAGE_DURATIONS,
  AI_TOOLS,
  greetingMessage,
  seedSessions,
} from '../data/ai/conversations'
import { DEFAULT_CONTEXTS } from '../data/ai/contexts'
import { buildReply, buildVersion, AI_VARIANTS } from '../data/ai/reply'
import type { AiAttachment, AiMessage, AiQueueItem, AiReplyVersion, AiSession, ReplyVariant } from '../data/ai/types'
import type { TextRun } from '../types/workbench'

/**
 * AI 助手的会话状态。
 *
 * ============================================================================
 * 四条纪律
 * ============================================================================
 *
 * ① **不做持久化。** 会话列表、模型档位、能力开关、上下文都不写 localStorage。
 *    理由不是"省事"：一个**持久化了但背后没有服务**的偏好会在下次打开时显示
 *    一个"我已经选过了"的状态，而那个状态什么也不影响。
 *
 * ② **计时器不进 store。** `advanceStage()` / `settle()` 只做状态转移，
 *    中间那段阶段动画由页面用自己的 `setTimeout` 驱动（见 `AiAssistantPage`）。
 *    store 里因此没有悬挂的定时器，卸载/切路由不会留下"半条消息"。
 *
 * ③ **"生成中"是消息自己的字段**（第二轮原型：`state.generating` → `msg.generating`）。
 *    这一步换来三件事：切会话不丢、可「继续生成」、思考链面板能显示"生成中"。
 *    代价是"同时只有一条在生成"这条不变量要自己守 —— 见 `findGenerating()` 与 `ask()`。
 *
 * ④ **队列与生成同源**：生成中再发 = 入队；一次生成结束就**立刻**取队首开下一轮
 *    （原型是在 `finishGenerate` 里回填输入框再调 `send()`，中间还等 200ms）。
 */

let seq = 0
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`

/** 一条消息的纯文本（引用块的每一行也算进去） */
export function messageText(message: AiMessage): string {
  const head = message.text.map((run) => run.text).join('')
  const quote = message.quote?.lines.map((line) => line.map((run) => run.text).join('')).join('\n')
  return quote ? `${head}\n${quote}` : head
}

/**
 * 当前正在生成的那一条（跨会话找）。
 *
 * ⚠️ 刻意**不**只看当前会话：生成中的消息如果只在"它在的那一页"才推进，
 *    切走再切回来这段时间它会停住（原型就是这样）。跨会话推进更符合直觉，
 *    也让"同时只有一条"这条不变量有一个单一的实现处。
 */
export function findGenerating(sessions: AiSession[]): AiMessage | undefined {
  for (const session of sessions) {
    const found = session.messages.find((message) => message.generating)
    if (found) return found
  }
  return undefined
}

interface AiState {
  sessions: AiSession[]
  activeId: string
  draft: string
  attachments: AiAttachment[]
  /** 光标位置（语音「插入光标处」要用）。由输入区在打开语音浮层时记一次 */
  caret: number
  model: string
  tools: Record<string, boolean>
  chips: Record<string, boolean>
  /** 生成中排队的消息（原型第二轮新增） */
  queue: AiQueueItem[]
  /** 思考链浮板当前展示的消息 id（null = 收起） */
  thoughtMessageId: string | null
  /**
   * 需要"锚点高亮"的那条消息（搜索命中 / 面板定位）。
   *
   * ⚠️ 这是一个**一次性信号**而不是状态：页面滚动到它、亮 1.6s 之后会把
   *    `highlightId` 清回 null（效果由页面那个 `setTimeout` 负责）。
   *    放在 store 里的理由：触发者在顶栏（搜索框）或浮板里，
   *    与消息列表不在同一棵子树 —— 用 props 传要穿过整个页面。
   */
  highlightId: string | null

  createSession: (userName: string, time: string) => void
  select: (id: string) => void
  togglePin: (id: string) => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void
  /**
   * 清空**当前会话**的消息（抽屉头部那颗「清空对话」）。
   *
   * 它与 `remove`（删掉整个会话）是两件事：会话还在列表里，只是里面的话被清掉，
   * 于是欢迎语会重新出现（欢迎语是**渲染**出来的，不在数据里 —— 见页面的笔记）。
   *
   * ⚠️ 顺手把 `queue` 也清掉：队列里那几条属于"上一轮还没发出去的话"，
   *    会话都清空了还留着，会在下一轮生成时突然冒出来。
   */
  clearActive: () => void

  setDraft: (value: string) => void
  addAttachments: (list: AiAttachment[]) => void
  removeAttachment: (index: number) => void
  setCaret: (value: number) => void
  /** 发一句话。生成中 → 入队；空闲 → 开一轮 */
  ask: (text: string, time: string) => void
  /** 从输入框发送 */
  send: (time: string) => void

  /** 推进一拍；跑满四拍就落到 `settle` */
  advanceStage: (messageId: string, time: string) => void
  /** 把回复填进那条消息，并消费队列 */
  settle: (messageId: string, time: string) => void
  /** 停止 */
  stop: (messageId: string) => void
  /** 停止后继续生成 */
  continueMessage: (messageId: string) => void
  /** 重新生成 → 追加一个"讲法"版本 */
  regenerate: (messageId: string, time: string) => void
  /** 切到第 n 版 */
  setVersion: (messageId: string, index: number) => void

  setModel: (name: string) => void
  toggleTool: (key: string) => void
  toggleChip: (key: string) => void
  toggleThoughtOpen: (messageId: string) => void
  toggleLiveOpen: (messageId: string) => void
  openThought: (messageId: string) => void
  closeThought: () => void
  /** 思考链浮板翻页：在当前会话里"有思考链的消息"之间前后移动 */
  stepThought: (delta: number) => void

  setContexts: (ids: string[]) => void
  removeContext: (id: string) => void
  /** 请求把某条消息滚到视野中央并高亮（搜索命中、面板「定位」都走它） */
  jumpTo: (messageId: string | null) => void
}

/** 开关初值：`on` 字段是原型给的初始态 */
const initialFlags = (rows: ReadonlyArray<{ key: string; on: boolean }>): Record<string, boolean> =>
  Object.fromEntries(rows.map((row) => [row.key, row.on]))

/** 会话级更新：把 `patch` 应用到指定会话的消息列表 */
function patchMessages(
  sessions: AiSession[],
  sessionId: string,
  fn: (messages: AiMessage[]) => AiMessage[],
): AiSession[] {
  return sessions.map((session) =>
    session.id === sessionId ? { ...session, messages: fn(session.messages) } : session,
  )
}

/** 找到某条消息所在的会话（跨会话按 id 定位） */
function locate(sessions: AiSession[], messageId: string): { session: AiSession; index: number } | null {
  for (const session of sessions) {
    const index = session.messages.findIndex((message) => message.id === messageId)
    if (index >= 0) return { session, index }
  }
  return null
}

/**
 * 开一轮问答：追加用户消息 + 追加一条"生成中"的助手消息。
 *
 * ⚠️ 这两条**一起**写进去，而不是"先加用户消息、回复等会儿再 push"——
 *    第二轮原型的关键改动正是这个：生成中的助手消息**当场就在数据里**，
 *    所以刷新/切会话之后它还在，`advanceStage` 才找得到它。
 */
function startRound(
  state: AiState,
  text: string,
  attachments: AiAttachment[],
  time: string,
): Partial<AiState> {
  const session = state.sessions.find((item) => item.id === state.activeId)
  if (!session) return {}
  const userMessage: AiMessage = {
    id: uid('u'),
    role: 'user',
    time,
    text: [{ text }],
    ...(attachments.length ? { attachments } : {}),
  }
  const assistantMessage: AiMessage = {
    id: uid('a'),
    role: 'assistant',
    time,
    text: [],
    generating: true,
    stageIdx: 0,
    liveOpen: false,
    /* ⚠️ 思考链**在生成开始时就先落一份骨架**（题目 + 说明文字），
       `settle` 时再用真正的那条覆盖（带分支与关键结论）。
       三个理由，都是实测出来的：
         · 思考链面板在生成中要显示**真的步骤名**（"解析用户意图"…），
           而不是"第 1 步 / 生成中…"这种占位 —— 原型就是预置的；
         · 被"停止"的消息因此仍然**有**一条思考链，
           「查看思考链」那颗按钮才不会通向一个空面板；
         · 面板里那条 `steps.length` 从第一帧就是对的，不跳数。 */
    thought: AI_LIVE_STEPS.map((step) => ({ title: step.title, desc: [{ text: step.desc }] })),
  }
  return {
    sessions: patchMessages(state.sessions, session.id, (messages) => [
      ...messages,
      userMessage,
      assistantMessage,
    ]),
    draft: '',
    attachments: [],
    thoughtMessageId: null,
  }
}

export const useAiStore = create<AiState>()((set, get) => ({
  sessions: seedSessions(),
  activeId: 's1',
  draft: '',
  attachments: [],
  caret: 0,
  model: AI_MODELS[0].name,
  tools: initialFlags(AI_TOOLS),
  chips: initialFlags(AI_COMPOSER_CHIPS),
  queue: [],
  thoughtMessageId: null,
  highlightId: null,

  /* ---------- 会话 ---------- */

  createSession(userName, time) {
    const id = uid('s')
    const session: AiSession = {
      id,
      title: '新对话',
      pinned: false,
      group: '今天',
      contexts: [...DEFAULT_CONTEXTS],
      messages: [greetingMessage(userName, time)],
    }
    /* 只清"输入区与浮板"，**不清队列与生成中** ——
       切会话或新建会话时把正在进行的那一轮丢掉，是原型第二轮之前的老毛病。 */
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeId: id,
      draft: '',
      attachments: [],
      thoughtMessageId: null,
    }))
  },

  select(id) {
    set({ activeId: id, thoughtMessageId: null })
  },

  togglePin(id) {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === id ? { ...session, pinned: !session.pinned } : session,
      ),
    }))
  },

  rename(id, title) {
    const trimmed = title.trim()
    if (!trimmed) return
    set((state) => ({
      sessions: state.sessions.map((session) => (session.id === id ? { ...session, title: trimmed } : session)),
    }))
  },

  remove(id) {
    set((state) => {
      const sessions = state.sessions.filter((session) => session.id !== id)
      const activeId = state.activeId === id ? (sessions[0]?.id ?? '') : state.activeId
      return { sessions, activeId, thoughtMessageId: null }
    })
  },

  clearActive() {
    set((state) => ({
      sessions: patchMessages(state.sessions, state.activeId, () => []),
      queue: [],
      thoughtMessageId: null,
      highlightId: null,
    }))
  },

  /* ---------- 输入区 ---------- */

  setDraft(value) {
    set({ draft: value })
  },

  addAttachments(list) {
    if (!list.length) return
    set((state) => ({ attachments: [...state.attachments, ...list] }))
  },

  removeAttachment(index) {
    set((state) => ({ attachments: state.attachments.filter((_, i) => i !== index) }))
  },

  setCaret(value) {
    set({ caret: value })
  },

  /**
   * 发一句话。
   *
   * ⚠️ 第二代原型最重要的行为改动在这里：**生成中按回车不再是"什么都不发生"**，
   *    而是入队（并给出"已加入发送队列"的回执 + 顶部那条排队横幅）。
   *    第一代是 `if (state.generating) return` —— 用户敲完一句按了回车，
   *    界面毫无反馈，最容易让人以为是自己没点到。
   *
   * 快捷入口与输入框仍走同一条路（原型 `data-quick` 也是"改输入框的值再发"），
   * 所以这里同样**消费掉输入区**。
   */
  ask(text, time) {
    const state = get()
    const trimmed = text.trim()
    if (!trimmed && !state.attachments.length) return
    const session = state.sessions.find((item) => item.id === state.activeId)
    if (!session) return

    if (findGenerating(state.sessions)) {
      /* 入队：把当前输入区的内容一起带走（与原型一致） */
      set({
        queue: [...state.queue, { id: uid('q'), text: trimmed, attachments: state.attachments.map((a) => ({ ...a })) }],
        draft: '',
        attachments: [],
      })
      return
    }
    set(startRound(state, trimmed, state.attachments.map((a) => ({ ...a })), time))
  },

  send(time) {
    get().ask(get().draft, time)
  },

  /* ---------- 生成 ---------- */

  advanceStage(messageId, time) {
    const state = get()
    const found = locate(state.sessions, messageId)
    if (!found) return
    const message = found.session.messages[found.index]
    if (!message?.generating) return
    const next = (message.stageIdx ?? 0) + 1
    if (next >= AI_STAGE_DURATIONS.length) {
      get().settle(messageId, time)
      return
    }
    set({
      sessions: patchMessages(state.sessions, found.session.id, (messages) =>
        messages.map((item) => (item.id === messageId ? { ...item, stageIdx: next } : item)),
      ),
    })
  },

  settle(messageId, time) {
    const state = get()
    const found = locate(state.sessions, messageId)
    if (!found) return
    const index = found.index
    const session = found.session
    const message = session.messages[index]
    if (!message) return

    /* 拿这一轮的提问：往上找最近的一条用户消息 */
    let userText = ''
    for (let i = index - 1; i >= 0; i -= 1) {
      const previous = session.messages[i]
      if (previous && previous.role === 'user') {
        userText = messageText(previous)
        break
      }
    }
    const reply = buildReply({ text: userText || '（空提问）', attachments: [], id: message.id, time })

    set({
      sessions: patchMessages(state.sessions, session.id, (messages) =>
        messages.map((item) =>
          item.id === messageId
            ? {
                ...item,
                generating: false,
                stageIdx: undefined,
                liveOpen: undefined,
                text: reply.text,
                quote: reply.quote,
                thought: reply.thought,
                suggestions: reply.suggestions,
              }
            : item,
        ),
      ),
    })

    /* 消费队列：立刻开下一轮（原型的 200ms 延迟是为了等输入框回填，这里不需要） */
    const after = get()
    const next = after.queue[0]
    if (next && !findGenerating(after.sessions)) {
      set({ queue: after.queue.slice(1) })
      const rest = get()
      set(startRound(rest, next.text, next.attachments, time))
    }
  },

  stop(messageId) {
    const state = get()
    const found = locate(state.sessions, messageId)
    if (!found) return
    const message = found.session.messages[found.index]
    if (!message?.generating) return
    set({
      sessions: patchMessages(state.sessions, found.session.id, (messages) =>
        messages.map((item) =>
          item.id === messageId
            ? {
                ...item,
                generating: false,
                stageIdx: undefined,
                liveOpen: undefined,
                stopped: true,
                text: item.text.length ? item.text : [{ text: '（已停止，没有生成内容）' }],
                /* ⚠️ 思考链要**按真正走到的拍数裁短**。
                   开一轮时预置的是完整四拍骨架，可这一轮只跑到第 2 拍就被停了 ——
                   留着四步会让思考卡写着「思考了 4 步」，而后面两步根本没发生。
                   （原型把预置链整条留着，所以它那边停止后也显示满步数。）
                   至少留 1 步：第 0 拍也意味着"已经开始解析"，而不是"什么都没做"。 */
                thought: item.thought?.slice(0, Math.max(1, item.stageIdx ?? 0)),
              }
            : item,
        ),
      ),
      /* 停止时把排队的消息**留在队列里**（原型也留）：
         它们是"你刚敲的"，不该因为一次停止被丢掉，横幅会继续显示还有几条 */
      thoughtMessageId: state.thoughtMessageId === messageId ? null : state.thoughtMessageId,
    })
  },

  continueMessage(messageId) {
    const state = get()
    const found = locate(state.sessions, messageId)
    if (!found) return
    const message = found.session.messages[found.index]
    if (!message?.stopped) return
    set({
      sessions: patchMessages(state.sessions, found.session.id, (messages) =>
        messages.map((item) =>
          item.id === messageId
            ? { ...item, stopped: undefined, generating: true, stageIdx: 0, liveOpen: false, text: [] }
            : item,
        ),
      ),
    })
  },

  /**
   * 重新生成 —— 追加一个"讲法"版本。
   *
   * ⚠️ 版本内容来自 `buildVersion`（同源事实、换讲法），理由写在 `reply.ts` 那一节：
   *    原型的"新版本"和旧版本正文一模一样，只有耗时是随机的。
   *    版本顺序按 `versions.length % 3` 轮转：摘要 → 逐项 → 精简 → 摘要 …
   */
  regenerate(messageId, time) {
    const state = get()
    const found = locate(state.sessions, messageId)
    if (!found) return
    const { index } = found
    const message = found.session.messages[index]
    if (!message || message.role === 'user' || message.generating) return

    let userText = ''
    for (let i = index - 1; i >= 0; i -= 1) {
      const previous = found.session.messages[i]
      if (previous && previous.role === 'user') {
        userText = messageText(previous)
        break
      }
    }
    if (!userText) return

    /**
     * 版本 0 的种子。
     *
     * ⚠️ **被停止过的那条不把当前状态当版本 0。** 它此刻的 `text` 是
     *    「（已停止，没有生成内容）」、`thought` 是空数组 ——
     *    把它种成版本 0，用户点「重新生成」后看到的是
     *    `2 / 2` 里夹着一版占位文案，而且切回上一版会把思考链**清空**
     *    （实测：切回之后思考链面板从「1/4」变成「0/3」——那条消息掉出了
     *      面板的可翻列表）。处置：停止过的消息**从 0 重新起一版**，
     *    并把 `stopped` 一并清掉（它已经被真正回答过了）。
     */
    const seedable = !message.stopped && message.text.length > 0
    const existing: AiReplyVersion[] = message.versions ?? (seedable
      ? [{ variantName: AI_VARIANTS[0], variant: 0 as ReplyVariant, text: message.text, quote: message.quote, thought: message.thought }]
      : [])
    const variant = (existing.length % 3) as ReplyVariant
    const next = buildVersion({ text: userText, attachments: [], id: message.id, time }, variant, time)
    const versions = [...existing, next]
    const versionIdx = versions.length - 1
    const active = versions[versionIdx]

    set({
      sessions: patchMessages(state.sessions, found.session.id, (messages) =>
        messages.map((item) =>
          item.id === messageId
            ? {
                ...item,
                versions,
                versionIdx,
                stopped: undefined,
                text: active.text,
                quote: active.quote,
                thought: active.thought,
              }
            : item,
        ),
      ),
    })
  },

  setVersion(messageId, index) {
    const state = get()
    const found = locate(state.sessions, messageId)
    if (!found) return
    const message = found.session.messages[found.index]
    if (!message?.versions) return
    const target = message.versions[index]
    if (!target) return
    set({
      sessions: patchMessages(state.sessions, found.session.id, (messages) =>
        messages.map((item) =>
          item.id === messageId
            ? { ...item, versionIdx: index, text: target.text, quote: target.quote, thought: target.thought }
            : item,
        ),
      ),
    })
  },

  /* ---------- 偏好与浮板 ---------- */

  setModel(name) {
    set({ model: name })
  },

  toggleTool(key) {
    set((state) => ({ tools: { ...state.tools, [key]: !state.tools[key] } }))
  },

  toggleChip(key) {
    set((state) => ({ chips: { ...state.chips, [key]: !state.chips[key] } }))
  },

  /**
   * 展开/收起思考卡。
   *
   * ⚠️ 状态存进**消息数据**而不是组件的 `useState`：原型第二轮专门修过这一点
   *    （「#2 记住偏好」）。放组件里的话，切一次会话再回来就折回去了 ——
   *    而用户展开它恰恰是因为"这一条我要细看"。
   */
  toggleThoughtOpen(messageId) {
    set((state) => {
      const found = locate(state.sessions, messageId)
      if (!found) return {}
      return {
        sessions: patchMessages(state.sessions, found.session.id, (messages) =>
          messages.map((item) => (item.id === messageId ? { ...item, thoughtOpen: !item.thoughtOpen } : item)),
        ),
      }
    })
  },

  toggleLiveOpen(messageId) {
    set((state) => {
      const found = locate(state.sessions, messageId)
      if (!found) return {}
      return {
        sessions: patchMessages(state.sessions, found.session.id, (messages) =>
          messages.map((item) => (item.id === messageId ? { ...item, liveOpen: !item.liveOpen } : item)),
        ),
      }
    })
  },

  openThought(messageId) {
    set({ thoughtMessageId: messageId })
  },

  closeThought() {
    set({ thoughtMessageId: null })
  },

  /**
   * 面板翻页。
   *
   * ⚠️ 页码不是独立的游标，而是"**在当前会话那些有思考链的消息里**的序号"——
   *    与原型一致（`getThoughtMessageIndexes()` 每次现算）。
   *    存游标的写法在"中间删了一条消息"之后会指错，现算不会。
   *    范围也包含**正在生成**的那条（面板要能显示"生成中"）。
   */
  stepThought(delta) {
    set((state) => {
      const session = state.sessions.find((item) => item.id === state.activeId)
      if (!session) return {}
      /* 只收"有思考链"的助手消息：停下来的那条也可能带着一个空思考链，
         收进去会让面板翻到一页空白的时间轴（原型按 `m.thought || m.generating` 过滤）。 */
      const list = session.messages
        .filter((message) => message.role === 'assistant' && (message.generating || message.thought?.length))
        .map((message) => message.id)
      const current = state.thoughtMessageId ? list.indexOf(state.thoughtMessageId) : -1
      const base = current < 0 ? 0 : current
      const next = Math.min(Math.max(base + delta, 0), list.length - 1)
      return { thoughtMessageId: list[next] ?? null }
    })
  },

  /* ---------- 上下文 ---------- */

  setContexts(ids) {
    set((state) => ({
      sessions: state.sessions.map((session) => (session.id === state.activeId ? { ...session, contexts: ids } : session)),
    }))
  },

  removeContext(id) {
    set((state) => ({
      sessions: state.sessions.map((session) =>
        session.id === state.activeId
          ? { ...session, contexts: session.contexts.filter((item) => item !== id) }
          : session,
      ),
    }))
  },

  jumpTo(messageId) {
    set({ highlightId: messageId })
  },
}))

/** 把附件信息按原型口径格式化：`1.2 MB` / `840.0 KB` / `512 B` */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** `HH:MM`，zh-CN，与原型 `toLocaleTimeString('zh-CN', {hour,minute})` 同口径 */
export function nowTime(): string {
  return new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

/** 某条消息的纯文本片段（思考链面板的"回复「…」"要用） */
export function runsToPlain(runs: TextRun[]): string {
  return runs.map((run) => run.text).join('')
}
