import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { ShellTopbar } from '../components/shell/ShellTopbar'
import { CommandPalette, moduleTargets, useCommandHotkey } from '../components/shell/CommandPalette'
import { AiAside } from '../components/ai/AiAside'
import { AiComposer } from '../components/ai/AiComposer'
import { AiMessageRow } from '../components/ai/AiMessageRow'
import { AiModelPicker } from '../components/ai/AiModelPicker'
import { AiSearchBox } from '../components/ai/AiSearchBox'
import { AiSessionSidebar } from '../components/ai/AiSessionSidebar'
import { AiThoughtPanel, AiVoiceOverlay } from '../components/ai/AiOverlays'
import { useExportSession } from '../components/ai/use-export-session'
import { Icon } from '../components/icons/Icon'
import { greetingMessage } from '../data/ai/conversations'
import { AI_SCOPE_LINE } from '../data/ai/facts'
import { useDocumentTitle } from '../hooks/use-document-title'
import { useAuthStore } from '../stores/auth-store'
import { useRecentsStore } from '../stores/recents-store'
import { useUiStore } from '../stores/ui-store'
import { findGenerating, nowTime, useAiStore } from '../stores/ai-store'

/**
 * AI 助手（`/ai`）。
 *
 * ============================================================================
 * 这一页在应用外壳里的位置：**第十个页面，不是第十个域**
 * ============================================================================
 * 应用有九个域（`WorkspaceModuleKey`），顶栏那九项就是它们。AI 助手**不进去**：
 *   · 它是**跨域**的（读的是全部项目/任务），不属于某一层；
 *   · 加第十项要同时动 `WorkspaceNav` 的分组、Prism 的九组色槽、
 *     `WORKBENCH_SERIES_KEY` 那张名字桥、以及侧栏环的项数（弦长会变）。
 * 入口走顶栏右侧那颗 AI 按钮（原本指向工作台，现在指向这里）。
 *
 * ============================================================================
 * 第二轮原型加进来的交互，都在这一层落地
 * ============================================================================
 * · **阶段推进**：`advanceStage` 只做状态转移，计时由 `AiStageTicker` 统一驱动（挂在路由之外）。
 *   这样"停止/继续/切会话/切路由"四条路径都由 effect 的清理函数覆盖，
 *   不需要在 store 里维护一堆悬挂的定时器（第一版就是组件自己持 interval，
 *   同一条消息被重新挂载时会起第二个 —— 阶段跳着涨）。
 * · **搜索**：入口在顶栏 `actions` 槽（`AiSearchBox`），
 *   它只负责"选中哪条"，滚动与高亮由下面的 jump effect 统一做。
 * · **排队**：`queue` 在 store 里，消费发生在 `settle` —— 页面不需要知道。
 */
export function AiAssistantPage() {
  const userName = useAuthStore((state) => state.user?.name ?? '你')
  const initials = useAuthStore((state) => state.user?.initials ?? 'LY')

  const sessions = useAiStore((state) => state.sessions)
  const activeId = useAiStore((state) => state.activeId)
  const queue = useAiStore((state) => state.queue)
  const highlightId = useAiStore((state) => state.highlightId)
  const generatingMessage = useAiStore((state) => findGenerating(state.sessions))
  const jumpTo = useAiStore((state) => state.jumpTo)
  const ask = useAiStore((state) => state.ask)
  const openThought = useAiStore((state) => state.openThought)
  const exportSession = useExportSession()

  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const closeSidebar = useUiStore((state) => state.closeSidebar)
  const record = useRecentsStore((state) => state.record)
  const location = useLocation()

  const [commandOpen, setCommandOpen] = useState(false)
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [recording, setRecording] = useState(false)

  useDocumentTitle('AI 助手 · Lucky-Y')
  useCommandHotkey(() => setCommandOpen((open) => !open))

  /* 「最近」槽的事实源 —— 与 `WorkspaceLayout` 同一个口径（记地址栏里的真实路径） */
  useEffect(() => {
    record(location.pathname, 'AI 助手')
  }, [location.pathname, record])

  /* ⚠️ 阶段推进器**已经不在这里了** —— 搬到了 `components/ai/AiStageTicker.tsx`，
     由 `AiDrawerHost`（挂在路由之外）渲染。
     原因：AI 助手现在有**两个视图**（这一页 + 全局抽屉），而它们共享同一份会话。
     计时留在这里的话，在抽屉里提问时这一页没挂载 ⇒ 阶段永远停在第一拍；
     两边各写一份 ⇒ 同一条消息被推进两次、阶段跳着涨。
     判据：**计时的生命周期必须比任何一个视图长，所以它只能挂在视图之外。** */

  /**
   * 搜索命中 / 面板「定位」→ 滚到那条消息并亮一下。
   *
   * ⚠️ 必须**排在会话切换的渲染之后**（`jumpTo` 是 store 里的信号，本 effect 在
   *    下一次提交之后才跑）。直接在被点的那一刻 scrollIntoView 会找不到元素 ——
   *    切会话会让消息列表整片重挂。
   */
  useEffect(() => {
    if (!highlightId) return
    const target = document.querySelector(`[data-message-id="${highlightId}"]`)
    target?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const timer = setTimeout(() => jumpTo(null), 1600)
    return () => clearTimeout(timer)
  }, [highlightId, jumpTo, activeId])

  /* 新消息与生成中的那条都要滚到底 —— 依赖里放"消息条数 + 是否生成中"，
     不放数组本身（每次 `settle` 都会换一个新数组，那样每个渲染都滚一次）。 */
  const bodyRef = useRef<HTMLDivElement>(null)
  const session = sessions.find((item) => item.id === activeId)
  const messageCount = session?.messages.length ?? 0
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messageCount, generatingMessage, activeId])

  /* 未开始的会话：把欢迎语**渲染**出来（不落进会话数据）。
     这样"点开一个还没说过话的会话"看到的不是一块空白，而是能直接上手的四个入口。 */
  const greeting = useMemo(
    () => (session && session.messages.length === 0 ? greetingMessage(userName, nowTime()) : null),
    [session?.id, session?.messages.length, userName],
  )

  const handleRecording = useCallback((value: boolean) => setRecording(value), [])
  const handleAsk = useCallback((text: string) => ask(text, nowTime()), [ask])

  return (
    <div className="mw-root sb-root ai-root">
      {/* 抽屉遮罩：样式在 `workspace-shell.css`（≤768px 且 `.is-open` 才显示），
          与其余九页共用同一套 —— 所以这里只挂类名，不重写规则。 */}
      <div
        className={sidebarOpen ? 'workspace-scrim is-open' : 'workspace-scrim'}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <div className="ai-app">
        {/* 顶栏动作槽：模型 chip + 会话搜索（原型顶栏里那两样这里专属的东西） */}
        <ShellTopbar
          actions={
            <>
              <AiSearchBox />
              <AiModelPicker />
            </>
          }
          onOpenCommand={() => setCommandOpen(true)}
        />

        <AiSessionSidebar userName={userName} drawerOpen={sidebarOpen} />

        <main className="ai-main">
          <div className="chat-head">
            <div className="chat-head-icon">
              <Icon name="i-spark" />
            </div>
            <div className="chat-head-info">
              <div className="chat-head-title">{session?.title ?? '没有会话'}</div>
              <div className="chat-head-sub">
                {AI_SCOPE_LINE}
                {queue.length ? ` · 队列 ${queue.length} 条` : ''}
              </div>
            </div>
            <div className="chat-head-actions">
              <button
                type="button"
                className="ai-icon-btn"
                title="复制为 Markdown"
                disabled={!session}
                onClick={() => session && void exportSession(session)}
              >
                <Icon name="i-download" />
              </button>
            </div>
          </div>

          <div className="chat-body" ref={bodyRef}>
            {!session ? (
              <div className="stat-desc">
                一个会话都没有了 —— 左上角的「新对话」可以开一个。会话是内存态，刷新会回到初始那几条。
              </div>
            ) : null}

            {greeting ? (
              <AiMessageRow
                message={greeting}
                userInitials={initials}
                onAsk={handleAsk}
                onOpenThoughtPanel={openThought}
              />
            ) : null}

            {session?.messages.map((message) => (
              <AiMessageRow
                key={message.id}
                message={message}
                userInitials={initials}
                onAsk={handleAsk}
                onOpenThoughtPanel={openThought}
              />
            ))}
          </div>

          <AiComposer onOpenVoice={() => setVoiceOpen(true)} recording={recording} />
        </main>

        <AiAside />
      </div>

      <AiThoughtPanel />
      <AiVoiceOverlay open={voiceOpen} onClose={() => setVoiceOpen(false)} onRecordingChange={handleRecording} />

      {/* 命令面板：顶栏那颗放大镜与 logo 都指向它。只给模块目标（本页没有 Tab），
          传空数组而不是不渲染 —— 不渲染的话那两颗按钮就是"点了没反应"。 */}
      <CommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} targets={moduleTargets()} />
    </div>
  )
}
