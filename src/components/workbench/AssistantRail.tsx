import { useState, type FormEvent } from 'react'
import { Icon } from '../icons/Icon'
import { toast } from '../../stores/toast-store'
import { cn } from '../../lib/cn'
import type { ChatMessage, TextRun } from '../../types/workbench'

/** 富文本片段。原型里是 `<b>`，这里渲染成 <strong> —— 不拼 HTML */
function Runs({ runs }: { runs: TextRun[] }) {
  return (
    <>
      {runs.map((r, i) =>
        r.em ? (
          <strong key={i} className="font-semibold text-ink-900">
            {r.text}
          </strong>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  )
}

function AiBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex gap-2.5">
      <span className="rail-avatar rail-avatar--sm" aria-hidden="true">
        <Icon name="i-spark" className="h-[11px] w-[11px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-12-5 leading-[1.65] text-ink-700">
          <Runs runs={message.content} />
        </p>
        <div className="mt-1 text-11 font-medium tabular-nums text-ink-400">{message.time}</div>
      </div>
    </div>
  )
}

function UserBubble({ message }: { message: ChatMessage }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[88%]">
        <p className="rounded-[13px] rounded-tr-[5px] bg-brand-50 px-3 py-2 text-12-5 leading-[1.65] text-ink-800">
          <Runs runs={message.content} />
        </p>
        <div className="mt-1 text-right text-11 font-medium tabular-nums text-ink-400">{message.time}</div>
      </div>
    </div>
  )
}

/**
 * 对话起点分隔线。一条线同时收三件事：
 *   ① 消息区是**底部对齐**的，栏顶留白原本"浮着半截内容"—— 有了它，留白读作"对话从这儿往上长"；
 *   ② 时间戳只写到分钟，整屏没有日期出处 —— 这里补上；
 *   ③ 聊天界面的惯例（Slack / 微信的「今天」）。
 *
 * ⚠️ 它必须是面板的**第一个**子元素：外层的 `flex-col-reverse` 只把"整块"推到容器底部，
 *    推不动块内顺序（块内仍是正常 column）—— 写到别处它就会掉到对话末尾。
 */
function DayDivider() {
  return (
    <div className="flex items-center gap-2 pt-1 text-11 font-medium text-ink-400">
      <span className="h-px flex-1 bg-line" />
      今天
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

interface AssistantRailProps {
  messages: ChatMessage[]
  collapsed: boolean
  onToggle: () => void
  /** 顶栏状态行："已接入 8 个项目 · 164 条任务" */
  statusLine: string
}

/**
 * 助手栏 —— **AppShell 级右栏**，不是页面栅格的一格。
 *
 * 收起的三处纪律（都在 workbench-hero.css 里，这里只负责给 `data-collapsed`）：
 *   · 只动宽度，且**先淡出再收窄**（过渡带 0.12s 延迟）—— 顺序反了会看到文字逐帧重排；
 *   · 淡出用 `visibility: hidden` 而不是只压 `opacity`，否则收起的按钮还能 Tab 进去；
 *   · 状态**不持久化**（刷新回到展开态）：它是"临时看一眼"的动作。
 */
export function AssistantRail({ messages, collapsed, onToggle, statusLine }: AssistantRailProps) {
  const [draft, setDraft] = useState('')

  /* 发送：工作台还没有助手后端，所以**不假装发出去** —— 清空输入并如实说明。
     判据：与其在列表里插一条不会有人回答的消息，不如当场说清"这里还没接"，
     否则用户会以为是自己的问题（等不到回复）。 */
  function submit(event: FormEvent) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return
    setDraft('')
    toast(`原型演示：助手问答未接入，已记录问题「${text.slice(0, 12)}${text.length > 12 ? '…' : ''}」`)
  }

  return (
    <aside
      className="rail shell g g4 flex w-[340px] shrink-0 flex-col overflow-hidden border-l border-line max-[1180px]:w-full max-[1180px]:border-l-0 max-[1180px]:border-t"
      data-collapsed={collapsed ? '' : undefined}
      aria-label="助手"
    >
      <div className="rail-head flex shrink-0 items-center gap-3 border-b border-line px-4 py-3">
        <button
          type="button"
          className="rail-avatar"
          onClick={onToggle}
          aria-label={collapsed ? '展开助手栏' : '收起助手栏'}
          aria-expanded={!collapsed}
        >
          <Icon name="i-spark" className="h-[19px] w-[19px]" />
        </button>
        <div className="rail__fade min-w-0 flex-1">
          <h3 className="text-13 font-bold leading-tight">助手</h3>
          <div className="mt-[4px] flex items-center gap-1.5">
            <span className="text-11 font-medium text-ink-500">在线</span>
            <span className="rail-wave" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <i key={i} />
              ))}
            </span>
          </div>
          <span className="mt-[3px] block truncate text-11 font-medium text-ink-400">{statusLine}</span>
        </div>
        <div className="rail__fade flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="rail-round rail-round--tile"
            aria-label="新建对话"
            onClick={() => toast('原型演示：新建对话未包含')}
          >
            <Icon name="i-plus" className="h-[16px] w-[16px]" />
          </button>
          <button
            type="button"
            className="rail-round"
            aria-label="历史记录"
            onClick={() => toast('原型演示：历史记录未包含')}
          >
            <Icon name="i-clock" className="h-[14px] w-[14px]" />
          </button>
        </div>
      </div>

      {/* 消息区：底部对齐（flex-col-reverse），所以对话贴着输入框长 */}
      <div className="rail__fade flex flex-1 flex-col-reverse overflow-y-auto p-4">
        <div className="flex flex-col gap-4">
          <DayDivider />
          {messages.map((message, i) =>
            message.role === 'ai' ? <AiBubble key={i} message={message} /> : <UserBubble key={i} message={message} />,
          )}
        </div>
      </div>

      <form onSubmit={submit} className="rail__fade shrink-0 border-t border-line p-3">
        <div className="flex items-center gap-1 rounded-full border border-line g g1 py-[5px] pl-[5px] pr-[5px]">
          <button
            type="button"
            className="rail-round rail-round--soft"
            aria-label="更多输入方式"
            onClick={() => toast('原型演示：语音与附件未包含')}
          >
            <Icon name="i-plus" className="h-[15px] w-[15px]" />
          </button>
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="向助手提问…"
            aria-label="向助手提问"
            className="min-w-0 flex-1 bg-transparent px-1.5 text-12-5 text-ink-900 outline-none placeholder:text-ink-500"
          />
          <button
            type="submit"
            className={cn('rail-round rail-round--send', !draft.trim() && 'opacity-60')}
            aria-label="发送"
            disabled={!draft.trim()}
          >
            <Icon name="i-arrow-right" className="h-[15px] w-[15px]" />
          </button>
        </div>
      </form>
    </aside>
  )
}
