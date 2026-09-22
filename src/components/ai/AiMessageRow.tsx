import { useState } from 'react'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { toast } from '../../stores/toast-store'
import type { AiAttachment, AiMessage, AiQuickPrompt } from '../../data/ai/types'
import { Paragraphs, QuoteBlock, Runs } from './ai-runs'
import { GlyphChevronRight, GlyphCopy, GlyphOpenInNew, GlyphRefresh } from './ai-glyphs'
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

interface ThoughtCardProps {
  message: AiMessage
  onOpenPanel: () => void
}

/**
 * 思考卡。
 *
 * ⚠️ 展开态是**组件自己的 state**（原型是给 `.thought-card` 加 `.open` 类）。
 *    不能沿用"命令式改类名"的做法：React 每次重渲染都会重算 `className`，
 *    命令式加的类会被覆盖掉 —— 症状是"点开又自己合上"。
 *
 * ⚠️ 头部的"打开时间轴"那一颗必须 `stopPropagation`：它与展开是**两个动作**，
 *    而它在展开按钮的内部（原型也是这么处理的）。
 */
function ThoughtCard({ message, onOpenPanel }: ThoughtCardProps) {
  const [open, setOpen] = useState(false)
  const steps = message.thought ?? []

  return (
    <div className={cn('thought-card', open && 'open')}>
      <div
        className="thought-card-head"
        {...pressable(() => setOpen((value) => !value))}
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
            应用里这条链路是本地同步计算，没有可测的分步耗时，填一个就是编数字。
            槽位在生成物里还在（`.tc-time`），只是没有元素去用它。 */}
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
   一条消息
   ============================================================ */

interface AiMessageRowProps {
  message: AiMessage
  /** 用户头像上的字（登录态的 initials） */
  userInitials: string
  /** 点击建议项 / 快捷入口 —— 直接发出去 */
  onAsk: (text: string) => void
  onOpenThoughtPanel: (message: AiMessage) => void
}

/** 把一条消息压成纯文本，用于「复制」 */
function messageToText(message: AiMessage): string {
  const quote = message.quote?.lines.map((line) => line.map((run) => run.text).join('')).join('\n') ?? ''
  return `${message.text.map((run) => run.text).join('')}${quote ? `\n${quote}` : ''}`
}

export function AiMessageRow({ message, userInitials, onAsk, onOpenThoughtPanel }: AiMessageRowProps) {
  const isUser = message.role === 'user'

  /* 「重新生成」在原型里只弹一个 toast（`toast('原型演示：重新生成中…')`）。
     应用里**重生成是有意义的**：这条链路是确定性规则引擎，重跑一次结果完全一样 ——
     所以不能做成"点了没反应"，也不能假装在重跑。如实说明这一条。
     判据：这个动作会不会让界面显示一个系统里不存在的状态 —— "重新生成中…"会。 */
  function regenerate() {
    toast('这条回答由本地规则引擎生成，重跑结果完全相同')
  }

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
    <div className={cn('msg', isUser ? 'user' : 'assistant')}>
      {isUser ? (
        <div className="msg-avatar">{userInitials}</div>
      ) : (
        <div className="msg-avatar">
          <Icon name="i-spark" />
        </div>
      )}

      <div className="msg-content">
        {!isUser && message.thought?.length ? (
          <ThoughtCard message={message} onOpenPanel={() => onOpenThoughtPanel(message)} />
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

        {message.quickPrompts?.length ? <QuickPrompts prompts={message.quickPrompts} onAsk={onAsk} /> : null}
        {!isUser && message.suggestions?.length ? <Suggestions items={message.suggestions} onAsk={onAsk} /> : null}

        {!isUser ? (
          <div className="msg-actions">
            <button type="button" className="msg-action" title="复制" onClick={copy}>
              <GlyphCopy />
            </button>
            <button type="button" className="msg-action" title="重新生成" onClick={regenerate}>
              <GlyphRefresh />
            </button>
          </div>
        ) : null}

        <div className="msg-meta">{message.time}</div>
      </div>
    </div>
  )
}
