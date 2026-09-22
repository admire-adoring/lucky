import { create } from 'zustand'
import { AI_COMPOSER_CHIPS, AI_MODELS, AI_TOOLS, greetingMessage, seedSessions } from '../data/ai/conversations'
import { buildReply } from '../data/ai/reply'
import type { AiAttachment, AiMessage, AiSession } from '../data/ai/types'

/**
 * AI 助手的会话状态。
 *
 * ============================================================================
 * 三条纪律
 * ============================================================================
 *
 * ① **不做持久化。** 会话列表、模型档位、能力开关都不写 localStorage。
 *    理由不是"省事"：一个**持久化了但背后没有服务**的偏好（模型档位）
 *    会在下次打开时显示一个"我已经选过了"的状态，而那个状态什么也不影响 ——
 *    这属于"界面显示了一个系统里不存在的状态"。会话同样是内存态：
 *    应用里没有消息存储通道，写进 localStorage 会让"下次打开还在"变成一句假承诺。
 *    （对照：`auth-store` 持久化是对的 —— 它背后真的有登录态。）
 *
 * ② **计时器不进 store。** `ask()` 只负责"追加用户消息 + 进入生成中"，
 *    `settle()` 负责"算出回复 + 追加"。中间那段阶段动画由页面用自己的
 *    `setTimeout` 驱动（见 `AiAssistantPage`）。这样 store 里没有悬挂的定时器，
 *    组件卸载/路由切换时不会留下"半条消息"，测起来也不用假时钟。
 *
 * ③ **`settle()` 必须在 store 里算**（而不是页面算好再塞进来）：
 *    它要读的是**当前**会话，而"当前会话"是 store 的状态。页面若自己拿一份
 *    会话引用去算，用户中途切了会话就会把回复写进错的那个。
 */

let seq = 0
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(seq += 1)}`

/** 生成中的那一轮 */
interface Generating {
  /** 用户那句话（组装思考链时要用它分类意图） */
  userText: string
  attachments: AiAttachment[]
  /** 已经排好的回复 id —— 先分配好，避免"同一个 id 被算两次" */
  replyId: string
}

interface AiState {
  sessions: AiSession[]
  activeId: string
  draft: string
  attachments: AiAttachment[]
  model: string
  tools: Record<string, boolean>
  chips: Record<string, boolean>
  generating: Generating | null
  /** 思考链浮板当前展示的消息（null = 收起） */
  thoughtMessage: AiMessage | null

  activeSession: () => AiSession | undefined

  createSession: (userName: string, time: string) => void
  select: (id: string) => void
  togglePin: (id: string) => void
  rename: (id: string, title: string) => void
  remove: (id: string) => void

  setDraft: (value: string) => void
  addAttachments: (list: AiAttachment[]) => void
  removeAttachment: (index: number) => void
  /** 快捷入口 / 建议项：不走输入框，直接发 */
  ask: (text: string, time: string) => void
  /** 从输入框发送（内容取自 draft + attachments） */
  send: (time: string) => void
  /** 生成结束：算回复并追加 */
  settle: (time: string) => void
  /** 停止生成 */
  cancel: () => void

  setModel: (name: string) => void
  toggleTool: (key: string) => void
  toggleChip: (key: string) => void
  openThought: (message: AiMessage) => void
  closeThought: () => void
}

/** 开关初值：`on` 字段是原型给的初始态 */
const initialFlags = (rows: ReadonlyArray<{ key: string; on: boolean }>): Record<string, boolean> =>
  Object.fromEntries(rows.map((row) => [row.key, row.on]))

/** 把一条消息追加到当前会话；会话不存在时原样返回（不抛） */
function appendTo(sessions: AiSession[], id: string, message: AiMessage): AiSession[] {
  return sessions.map((session) =>
    session.id === id ? { ...session, messages: [...session.messages, message] } : session,
  )
}

export const useAiStore = create<AiState>()((set, get) => ({
  sessions: seedSessions(),
  activeId: 's1',
  draft: '',
  attachments: [],
  model: AI_MODELS[0].name,
  tools: initialFlags(AI_TOOLS),
  chips: initialFlags(AI_COMPOSER_CHIPS),
  generating: null,
  thoughtMessage: null,

  activeSession() {
    const { sessions, activeId } = get()
    return sessions.find((session) => session.id === activeId)
  },

  /* ---------- 会话 ---------- */

  createSession(userName, time) {
    const id = uid('s')
    /* 开场白用真名（登录态给），不用写死的称呼 */
    const session: AiSession = {
      id,
      title: '新对话',
      pinned: false,
      group: '今天',
      messages: [greetingMessage(userName, time)],
    }
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeId: id,
      draft: '',
      attachments: [],
      generating: null,
      thoughtMessage: null,
    }))
  },

  select(id) {
    /* 切会话时把生成中与浮板一起收掉 —— 否则阶段指示器会挂在**新的**会话里，
       而那轮回复其实属于旧的（原型 `switchSession` 也是这么做的）。 */
    set({ activeId: id, generating: null, thoughtMessage: null })
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
      /* 删掉的是当前会话时，落到第一条（可能一条都不剩 —— 那时主区渲染空态）。
         这里**不自动新建**：原型会留下空列表，而自动新建会让"删除"看起来没生效。 */
      const activeId = state.activeId === id ? (sessions[0]?.id ?? '') : state.activeId
      return { sessions, activeId, generating: null, thoughtMessage: null }
    })
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

  /**
   * 发一句话。**快捷入口与输入框走同一条路**。
   *
   * 为什么合并：原型的 `data-quick` 处理是「把输入框的值**改成**这句话，再调 send()」——
   * 也就是说点快捷入口会把用户已经敲的字顶掉，并且把附件一并带出去。
   * 照它的行为做，两个入口就不会有"一个清输入框、一个不清"这种说不出理由的差别。
   */
  ask(text, time) {
    const { activeId, sessions, generating, attachments } = get()
    const trimmed = text.trim()
    /* 生成中不接受新问题（原型的 `if (isGenerating) return`）；
       会话列表为空时不发（消息无处可去）。 */
    if (!trimmed || generating || !sessions.some((session) => session.id === activeId)) return
    const message: AiMessage = {
      id: uid('u'),
      role: 'user',
      time,
      text: [{ text: trimmed }],
      ...(attachments.length ? { attachments } : {}),
    }
    set({
      sessions: appendTo(sessions, activeId, message),
      draft: '',
      attachments: [],
      generating: { userText: trimmed, attachments, replyId: uid('a') },
      thoughtMessage: null,
    })
  },

  send(time) {
    get().ask(get().draft, time)
  },

  settle(time) {
    const { generating, activeId, sessions } = get()
    if (!generating) return
    const reply = buildReply({
      text: generating.userText,
      attachments: generating.attachments,
      id: generating.replyId,
      time,
    })
    set({
      sessions: appendTo(sessions, activeId, reply),
      generating: null,
    })
  },

  cancel() {
    set({ generating: null })
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

  openThought(message) {
    set({ thoughtMessage: message })
  },

  closeThought() {
    set({ thoughtMessage: null })
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
