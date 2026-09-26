import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { toast } from '../../stores/toast-store'
import { findGenerating, nowTime, useAiStore } from '../../stores/ai-store'
import { useAuthStore } from '../../stores/auth-store'
import { useUiStore } from '../../stores/ui-store'
import { AI_QUICK_PROMPTS, greetingMessage } from '../../data/ai/conversations'
import { GlyphChevronRight, GlyphOpenInNew, GlyphStop, GlyphTrash } from '../ai/ai-glyphs'
import { AiDrawerMessage } from './AiDrawerMessage'

/** 输入框自适应的上限（原型是 120，完整页是 140 —— 各按各的原型，不强行统一） */
const MAX_INPUT_HEIGHT = 120

/** 打开后把焦点放进输入框的延迟。0.4s 的进场过渡走完再聚焦，否则浏览器会把面板滚一下 */
const FOCUS_DELAY = 320

/**
 * AI 助手**全局抽屉**（原型 `design/ai-assistant/ai-assistant-sidebar.html`）。
 *
 * ============================================================================
 * 它在应用里的位置
 * ============================================================================
 * 这是**路由之外**的一层：`App.tsx` 在登录后挂一次 `<AiDrawerHost/>`，于是
 * 每一个页面（工作台 / 九个工作区 / 项目列表 / `/ai` 自己）都能弹出它。
 *
 * 入口是**顶栏那颗 AI 按钮**（`ShellTopbar`）—— 原型自带一颗右下角浮球
 * （`.launcher`），那一族在生成 CSS 时整族丢弃了，理由写在
 * `design/build-ai-css.mjs` 的 AID_DROP 里：用户要的入口是右上角那颗按钮，
 * 两颗入口会同时存在、其中一颗还带个假的"未读小红点"。
 *
 * ============================================================================
 * 与 `/ai` 完整页的关系：**同一份会话，两个视图**
 * ============================================================================
 * 它们共用 `stores/ai-store`，所以：
 *   · 在抽屉里问的问题，展开到 `/ai` 之后还在（同一个 `activeId`）；
 *   · 草稿也只存一份（在哪儿打的字，切过去都还在，不会出现"两处各写一个字"）；
 *   · 计时**只有一处** —— `AiStageTicker`，由本组件的宿主渲染（见那个文件的说明）。
 *
 * ⚠️ 抽屉**不是**第十个域、也不是路由：它没有 URL，也不改 `activeId`。
 *    展开按钮才是有 URL 的那一步（`/ai`）。
 */
export function AiDrawer() {
  const navigate = useNavigate()
  const open = useUiStore((state) => state.aiDrawerOpen)
  const close = useUiStore((state) => state.closeAiDrawer)

  const userName = useAuthStore((state) => state.user?.name ?? '你')
  const initials = useAuthStore((state) => state.user?.initials ?? 'LY')

  const sessions = useAiStore((state) => state.sessions)
  const activeId = useAiStore((state) => state.activeId)
  const draft = useAiStore((state) => state.draft)
  const model = useAiStore((state) => state.model)
  const generatingMessage = useAiStore((state) => findGenerating(state.sessions))
  const draftText = useAiStore((state) => state.draft)
  const setDraft = useAiStore((state) => state.setDraft)
  const ask = useAiStore((state) => state.ask)
  const send = useAiStore((state) => state.send)
  const stop = useAiStore((state) => state.stop)
  const clearActive = useAiStore((state) => state.clearActive)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const bodyRef = useRef<HTMLDivElement>(null)

  const generating = Boolean(generatingMessage)
  const session = sessions.find((item) => item.id === activeId)
  const stored = session?.messages ?? []

  /* 没说过话的会话：把欢迎语**渲染**出来（不落进会话数据，与完整页同一处置）——
     这样打开抽屉看到的不是一个空盒子。 */
  const greeting = stored.length === 0 ? greetingMessage(userName, nowTime()) : null
  const messages = greeting ? [greeting, ...stored] : stored
  const hasText = draftText.trim().length > 0

  /* 打开时聚焦输入框；关掉时把焦点还回去由浏览器自己决定（不抢） */
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => textareaRef.current?.focus(), FOCUS_DELAY)
    return () => clearTimeout(timer)
  }, [open])

  /* Esc 收起 —— 与原型同一处置（原型只认 Esc 与那颗收起键，没有遮罩可点） */
  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, close])

  /* 输入框自适应高度：放在 `draft` 变化的 effect 里，不能每次渲染都设
     （那样会把用户正在输入时的高度弹回去） */
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`
  }, [draft])

  /* 新消息与生成中的那条都要滚到底。依赖放"条数 + 是否生成中"，
     不放数组本身（每次 `settle` 都会换一个新数组，那样每个渲染都滚一次）。 */
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, generating, open])

  /**
   * 发送 / 排队 / 停止 —— 与完整页**同一个三态分支**（`AiComposer.submit`）。
   *
   * ⚠️ 原型抽屉里这个按钮只有两态（生成中一律 = 停止）。这里跟页面走，理由：
   *    两个视图读的是**同一份会话**，同一个键在同一个会话里做两件不同的事
   *    （一处排队、一处停掉）比"多一点功能"更难解释。而且抽屉里本来就有
   *    显式的「停止生成」按钮（消息下方那条 `.stop-row`），停不用靠这颗键。
   */
  function submit() {
    if (generating && generatingMessage) {
      if (hasText) {
        send(nowTime())
        return
      }
      stop(generatingMessage.id)
      return
    }
    if (hasText) send(nowTime())
  }

  /** 展开到完整页面。**先收起再导航** —— 否则抽屉会跟着路由留在新页面上 */
  function expand() {
    close()
    navigate('/ai')
  }

  function clear() {
    clearActive()
    toast('已清空当前会话')
  }

  return (
    /* ⚠️ wrapper 上这三个类名都不是装饰：
         · `mw-root` —— 内核那套中性色板与模块色（作用域在 .mw-root 上）
         · `sb-root` —— 外壳那 14 支 `--sb-*`（浮层底衬 / 悬停底 / 浮动投影 /
           强调色柔底与辉光）。⚠️ 它们**不在 html 上**，只在 .sb-root 上 ——
           漏了它，抽屉里 21 条声明会被静默丢弃（面板自己的 background 与
           box-shadow 就在其中 ⇒ 面板变全透明、底下页面透上来）。
         · `ai-drawer` —— 本层样式的作用域根
       与 /ai 那一页的根类同一处置（那里是 mw-root sb-root ai-root）。
       而 `.mw-root.sb-root.ai-drawer` 在生成物里被声明成 `display: contents` ——
       wrapper 不生成盒子，所以宿主类自带的背景/高度不会盖住页面。
       详见 `src/styles/ai-sidebar.css` 顶部那一段。 */
    <div className="mw-root sb-root ai-drawer">
      <aside
        className={cn('ai-panel', open && 'open')}
        role="dialog"
        aria-label="AI 对话助手"
        /* 收起时 `pointer-events: none` + `opacity: 0`，但它仍在 DOM 里 ——
           所以对读屏要显式说是隐藏的（与外壳的抽屉同一处置） */
        aria-hidden={!open}
      >
        <div className="ai-panel-head">
          <div className="ai-panel-logo">
            <Icon name="i-spark" />
          </div>
          <div className="ai-panel-head-info">
            <div className="ai-panel-head-title">
              AI 助手
              <span className="status-dot" />
            </div>
            {/* 副标题是**真来源**：正在生成时说"正在思考…"（原型的处置），
                否则报当前选中的模型名 —— 不是原型里写死的 "Claude Sonnet" */}
            <div className="ai-panel-head-sub">{generating ? '正在思考…' : `在线 · ${model}`}</div>
          </div>
          <div className="ai-panel-head-actions">
            <button type="button" className="ai-icon-btn" title="清空对话" onClick={clear}>
              <GlyphTrash />
            </button>
            {/* 「展开」是**用户要求新增**的按钮，原型头部只有 主题/清空/收起 三颗。
                主题那颗不搬：应用的主题开关在顶栏，全站只有一处。
                一个页面只留一个换主题的地方，比两处各自记状态便宜。 */}
            <button type="button" className="ai-icon-btn" title="展开到完整页面" onClick={expand}>
              <GlyphOpenInNew />
            </button>
            <button type="button" className="ai-icon-btn" title="收起" onClick={close}>
              <GlyphChevronRight />
            </button>
          </div>
        </div>

        <div className="ai-panel-body" ref={bodyRef} aria-live="polite">
          {messages.map((message, index) => (
            <AiDrawerMessage
              key={message.id}
              message={message}
              initials={initials}
              onAsk={(text) => ask(text, nowTime())}
              /* 快捷入口只在"刚打开、还没问过"时出现 —— 与原型同判据
                 （`idx === 0 && messages.length <= 1`） */
              quickPrompts={index === 0 && messages.length <= 1 ? AI_QUICK_PROMPTS : undefined}
              transient={message.id === 'greeting'}
            />
          ))}
        </div>

        <div className="ai-panel-foot">
          <div className="input-box">
            <textarea
              ref={textareaRef}
              rows={1}
              value={draftText}
              placeholder="问点什么…"
              aria-label="向 AI 助手提问"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || event.shiftKey) return
                event.preventDefault()
                submit()
              }}
            />
            <button
              type="button"
              className={cn('send-btn', generating && 'stop')}
              /* 空输入且没在生成 → 禁用；生成中永远可点（要么排队、要么停止） */
              disabled={generating ? false : !hasText}
              title={generating ? (hasText ? '排队发送' : '停止生成') : '发送'}
              onClick={submit}
            >
              {generating && !hasText ? <GlyphStop /> : <Icon name="i-arrow-right" />}
            </button>
          </div>
          <div className="foot-hint">
            <span>回答由本地规则引擎按项目数据现算，不发送任何内容</span>
            <span>
              <kbd>Enter</kbd> 发送
            </span>
          </div>
        </div>
      </aside>
    </div>
  )
}
