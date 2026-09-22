import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AuroraBackdrop } from '../components/workspace/AuroraBackdrop'
import { ShellTopbar } from '../components/shell/ShellTopbar'
import { CommandPalette, moduleTargets, useCommandHotkey } from '../components/shell/CommandPalette'
import { AiAside } from '../components/ai/AiAside'
import { AiComposer } from '../components/ai/AiComposer'
import { AiLiveThinking } from '../components/ai/AiLiveThinking'
import { AiMessageRow } from '../components/ai/AiMessageRow'
import { AiModelPicker } from '../components/ai/AiModelPicker'
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
import { nowTime, useAiStore } from '../stores/ai-store'

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
 *     那是"改口径"，而这一页只是"多一页"。
 * 入口走顶栏右侧那颗 AI 按钮（原本指向工作台，现在指向这里）。
 *
 * ============================================================================
 * 与原型的三处结构差异（都是"静态页变成应用"才成立的问题）
 * ============================================================================
 *
 * ① **顶栏换成外壳的 `ShellTopbar`**。原型画了一条自己的细顶栏（logo + "AI 助手 Beta"
 *    + 模型 chip）。照搬会让这一页**没有九域导航、没有窗口控制**（`decorations:false`
 *    之后那是唯一的关窗方式），等于走进一个出不去的房间。
 *    原型顶栏里唯一这一页专属的东西（模型 chip）走 `actions` 槽进来。
 *    ⚠️ 连带后果：那一行的高度从 56px 变成 68px，由生成器的 AI_TOKENS 段覆盖
 *    （选择器抬到 0,3,0，否则 ≤768 那条会赢 —— 症状是窄屏顶栏溢出）。
 *
 * ② **极光复用 `AuroraBackdrop`**。原型的 `.aurora-bg` + 三团 `.blob` 与其余九页
 *    逐字一致，只有颜色不同 —— 而颜色读的是 `--mw-m1/2/3`，由本页的色指针给
 *    （见生成器的 AI_TOKENS：借 dashboard 那一组，因为原型的三团色值与它逐字相同）。
 *
 * ③ **抽屉复用外壳的 `ui-store`**。≤768px 时会话侧栏变抽屉，
 *    开合状态与其余九页共用同一个 `sidebarOpen`，开关就是顶栏那颗汉堡
 *    （`ShellTopbar` 里已有，`workspace-scrim` 的遮罩也在同一处）。
 *    不新起一份状态的理由：它是"我这一刻想让侧栏让开"的同一个意图。
 */
export function AiAssistantPage() {
  const userName = useAuthStore((state) => state.user?.name ?? '你')
  const initials = useAuthStore((state) => state.user?.initials ?? 'LY')

  const sessions = useAiStore((state) => state.sessions)
  const activeId = useAiStore((state) => state.activeId)
  const generating = useAiStore((state) => state.generating)
  const settle = useAiStore((state) => state.settle)
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

  const session = sessions.find((item) => item.id === activeId)

  /* 未开始的会话：把欢迎语**渲染**出来（不落进会话数据）。
     这样"点开一个还没说过话的会话"看到的不是一块空白，而是能直接上手的四个入口。 */
  const greeting = useMemo(
    () => (session && session.messages.length === 0 ? greetingMessage(userName, nowTime()) : null),
    [session?.id, session?.messages.length, userName],
  )

  /* 生成结束 → 落回复。`settle` 用的是 store 里的当前会话，
     所以中途切会话也不会把回复写进错的那一个（见 store 文件头 ③）。 */
  const handleFinish = useCallback(() => settle(nowTime()), [settle])
  const handleRecording = useCallback((value: boolean) => setRecording(value), [])

  /* 新消息与生成中的那条都要滚到底 —— 依赖里放"消息条数 + 是否生成中"，
     不放数组本身（每次 `settle` 都会换一个新数组，那样每个渲染都滚一次）。 */
  const bodyRef = useRef<HTMLDivElement>(null)
  const messageCount = session?.messages.length ?? 0
  useEffect(() => {
    const el = bodyRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messageCount, generating, activeId])

  return (
    <div className="mw-root sb-root ai-root">
      <AuroraBackdrop />

      {/* 抽屉遮罩：样式在 `workspace-shell.css`（≤768px 且 `.is-open` 才显示），
          与其余九页共用同一套 —— 所以这里只挂类名，不重写规则。 */}
      <div
        className={sidebarOpen ? 'workspace-scrim is-open' : 'workspace-scrim'}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <div className="ai-app">
        <ShellTopbar actions={<AiModelPicker />} onOpenCommand={() => setCommandOpen(true)} />

        <AiSessionSidebar userName={userName} drawerOpen={sidebarOpen} />

        <main className="ai-main">
          <div className="chat-head">
            <div className="chat-head-icon">
              <Icon name="i-spark" />
            </div>
            <div className="chat-head-info">
              <div className="chat-head-title">{session?.title ?? '没有会话'}</div>
              <div className="chat-head-sub">{AI_SCOPE_LINE}</div>
            </div>
            <div className="chat-head-actions">
              {/* 原型这里还有一颗「更多」—— 它**没有任何处理函数**（静态页里点了没反应），
                  所以不搬：摆一颗永远没反应的按钮比不摆更差。
                  「导出」保留，但落到真的会发生的事上（复制 Markdown，见 use-export-session）。 */}
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
                onAsk={(text) => ask(text, nowTime())}
                onOpenThoughtPanel={openThought}
              />
            ) : null}

            {session?.messages.map((message) => (
              <AiMessageRow
                key={message.id}
                message={message}
                userInitials={initials}
                onAsk={(text) => ask(text, nowTime())}
                onOpenThoughtPanel={openThought}
              />
            ))}

            {generating ? <AiLiveThinking onFinish={handleFinish} /> : null}
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
