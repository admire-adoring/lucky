import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { toast } from '../../stores/toast-store'
import { useAiStore, nowTime } from '../../stores/ai-store'
import type { AiAttachment, AiMessage, AiQuickPrompt } from '../../data/ai/types'
import { Paragraphs, QuoteBlock, Runs } from './ai-runs'
import { AiLiveThinking } from './AiLiveThinking'
import {
  GlyphChevronLeft,
  GlyphChevronRight,
  GlyphCopy,
  GlyphOpenInNew,
  GlyphRefresh,
  GlyphStop,
} from './ai-glyphs'
import { pressable } from './pressable'

/* ============================================================
   附件 chip
   ============================================================ */

function AttachmentChips({ attachments }: { attachments: AiAttachment[] }) {
  return (
    <>
      {attachments.map((file, i) => (
        <div key={`${file.name}-${i}`} className="attachment-chip">
          <span className="file-icon">{file.type}</span>
          <span className="file-name" title={file.name}>
            {file.name}
          </span>
          <span className="file-size">{file.size}</span>
        </div>
      ))}
    </>
  )
}

/* ============================================================
   思考卡（气泡上方那条可展开的"思考了 N 步"）
   ============================================================ */

function ThoughtCard({ message, onOpenPanel }: { message: AiMessage; onOpenPanel: () => void }) {
  const toggle = useAiStore((state) => state.toggleThoughtOpen)
  const steps = message.thought ?? []
  const open = Boolean(message.thoughtOpen)

  return (
    <div className={cn('thought-card', open && 'open')}>
      <div
        className="thought-card-head"
        {...pressable(() => toggle(message.id))}
        aria-expanded={open}
      >
        <span className="tc-chev">
          <GlyphChevronRight />
        </span>
        <span className="tc-icon">
          <Icon name="i-spark" />
        </span>
        <span className="tc-summary">思考了 {steps.length} 步</span>
        {/* ⚠️ 原型这里还有一个 `.tc-time`（"1.2s"）。本页**不填** ——
            应用里这条链路是本地同步计算，没有可测的分步耗时，填一个就是编数字。 */}
        <span className="tc-open-panel" title="打开时间轴视图" {...pressable(onOpenPanel, true)}>
          <GlyphOpenInNew />
        </span>
      </div>
      <div className="thought-card-body">
        {steps.map((step, i) => (
          <div key={i} className="tc-step">
            <span className="tc-num">{i + 1}</span>
            <span className="tc-text">
              <Runs runs={step.desc} />
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ============================================================
   开场快捷入口 / 「可以继续问」
   ============================================================ */

function QuickPrompts({ prompts, onAsk }: { prompts: AiQuickPrompt[]; onAsk: (text: string) => void }) {
  return (
    <div className="quick-prompts">
      {prompts.map((prompt) => (
        <button key={prompt.ask} type="button" className="quick-prompt" onClick={() => onAsk(prompt.ask)}>
          <Icon name={prompt.icon} />
          <span>
            <strong>{prompt.label}</strong>
            {prompt.hint}
          </span>
        </button>
      ))}
    </div>
  )
}

function Suggestions({ items, onAsk }: { items: string[]; onAsk: (text: string) => void }) {
  return (
    <div className="ai-suggestion">
      <div className="ai-suggestion-title">
        <Icon name="i-spark" />
        可以继续问
      </div>
      {items.map((item) => (
        <div key={item} className="ai-suggestion-item" {...pressable(() => onAsk(item))}>
          <Icon name="i-arrow-right" />
          {item}
        </div>
      ))}
    </div>
  )
}

/* ============================================================
   版本切换（原型第二轮新增）
   ============================================================ */

function VersionSwitch({ message }: { message: AiMessage }) {
  const setVersion = useAiStore((state) => state.setVersion)
  const versions = message.versions ?? []
  if (versions.length < 2) return null
  const index = message.versionIdx ?? 0
  const current = versions[index]

  return (
    <div className="msg-version-switch">
      <button
        type="button"
        title="上一版"
        disabled={index <= 0}
        onClick={() => setVersion(message.id, index - 1)}
      >
        <GlyphChevronLeft />
      </button>
      {/* 原型只写「1 / 3」。这里补一个讲法名（`title`），
          因为本页的版本差别是"讲法"而不是"重跑了一次"（见 reply.ts）。 */}
      <span title={current ? `讲法：${current.variantName}` : undefined}>
        {index + 1} / {versions.length}
        {current ? ` · ${current.variantName}` : ''}
      </span>
      <button
        type="button"
        title="下一版"
        disabled={index >= versions.length - 1}
        onClick={() => setVersion(message.id, index + 1)}
      >
        <GlyphChevronRight />
      </button>
    </div>
  )
}

/* ============================================================
   一条消息
   ============================================================ */

interface AiMessageRowProps {
  message: AiMessage
  /** 用户头像上的字（登录态的 initials） */
  userInitials: string
  /** 点击建议项 / 快捷入口 —— 直接发出去 */
  onAsk: (text: string) => void
  onOpenThoughtPanel: (messageId: string) => void
}

/** 把一条消息压成纯文本，用于「复制」 */
function messageToText(message: AiMessage): string {
  const quote = message.quote?.lines.map((line) => line.map((run) => run.text).join('')).join('\n') ?? ''
  return `${message.text.map((run) => run.text).join('')}${quote ? `\n${quote}` : ''}`
}

export function AiMessageRow({ message, userInitials, onAsk, onOpenThoughtPanel }: AiMessageRowProps) {
  const isUser = message.role === 'user'
  const regenerate = useAiStore((state) => state.regenerate)
  const continueMessage = useAiStore((state) => state.continueMessage)
  const toggleLiveOpen = useAiStore((state) => state.toggleLiveOpen)
  const steps = message.thought ?? []

  async function copy() {
    const text = messageToText(message)
    try {
      await navigator.clipboard.writeText(text)
      toast('已复制到剪贴板')
    } catch {
      toast('复制失败：当前环境不允许访问剪贴板')
    }
  }

  return (
    <div className={cn('msg', isUser ? 'user' : 'assistant')} data-message-id={message.id}>
      {isUser ? (
        <div className="msg-avatar">{userInitials}</div>
      ) : (
        <div className="msg-avatar">
          <Icon name="i-spark" />
        </div>
      )}

      <div className="msg-content">
        {/* 生成中：阶段指示器 + 实时思考流（**就地**渲染在这一条消息里）。
            原型的第二轮把它从"临时 DOM"改成了消息自己的一个分支 —— 也正是
            这一步让「停止后继续生成」与「切会话不丢」成立。 */}
        {message.generating ? (
          <AiLiveThinking
            stageIdx={message.stageIdx ?? 0}
            open={Boolean(message.liveOpen)}
            onToggle={() => toggleLiveOpen(message.id)}
          />
        ) : null}

        {!isUser && !message.generating && steps.length ? (
          <ThoughtCard message={message} onOpenPanel={() => onOpenThoughtPanel(message.id)} />
        ) : null}

        {message.attachments?.length ? (
          <div
            className="attachment-preview"
            style={{ marginBottom: 6, ...(isUser ? { justifyContent: 'flex-end' } : null) }}
          >
            <AttachmentChips attachments={message.attachments} />
          </div>
        ) : null}

        <div className="msg-bubble">
          <Paragraphs runs={message.text} />
          {message.quote ? <QuoteBlock quote={message.quote} /> : null}
        </div>

        {/* 停止之后再生成的那颗按钮（原型 `.continue-btn`） */}
        {message.stopped ? (
          <button type="button" className="continue-btn" onClick={() => continueMessage(message.id)}>
            <Icon name="i-play" />
            继续生成
          </button>
        ) : null}

        <VersionSwitch message={message} />

        {message.quickPrompts?.length ? <QuickPrompts prompts={message.quickPrompts} onAsk={onAsk} /> : null}
        {!isUser && message.suggestions?.length ? <Suggestions items={message.suggestions} onAsk={onAsk} /> : null}

        {!isUser && !message.generating ? (
          <div className="msg-actions">
            <button type="button" className="msg-action" title="复制" onClick={copy}>
              <GlyphCopy />
            </button>
            {/* 「重新生成」在本页是**真**的：它换一种讲法生成新版本（见 reply.ts）。
                第一版这里只弹一句"重跑结果完全相同"——那时确实没有版本这回事。 */}
            <button
              type="button"
              className="msg-action"
              title="重新生成（换一种讲法）"
              onClick={() => regenerate(message.id, nowTime())}
            >
              <GlyphRefresh />
            </button>
            <button
              type="button"
              className="msg-action"
              title="查看思考链"
              onClick={() => onOpenThoughtPanel(message.id)}
            >
              <Icon name="i-spark" />
            </button>
          </div>
        ) : null}

        <div className="msg-meta">
          {message.time}
          {message.stopped ? (
            <span className="msg-stopped-badge">
              <GlyphStop />
              已停止
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}
