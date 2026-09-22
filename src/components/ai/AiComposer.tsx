import { useEffect, useRef } from 'react'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { AI_COMPOSER_CHIPS } from '../../data/ai/conversations'
import { formatFileSize, nowTime, useAiStore } from '../../stores/ai-store'
import { GlyphCode, GlyphMic, GlyphPaperclip, GlyphStop } from './ai-glyphs'
import { pressable } from './pressable'

/**
 * 输入区（原型 `.chat-input`）。
 *
 * ⚠️ 自适应高度是**手写行为**，不是标记：原型靠
 *    `input.style.height = 'auto'; input.style.height = min(scrollHeight, 140) + 'px'`。
 *    React 里不能每次渲染都设一次（会把用户正在输入时的高度弹回去），
 *    所以放在 `draft` 变化的 effect 里。
 */

const MAX_INPUT_HEIGHT = 140

/** 四个能力 chip 的图标：精灵里有就用精灵的，没有的（代码）用本页字形 */
function chipIcon(key: string) {
  if (key === 'code') return <GlyphCode />
  const map: Record<string, 'i-search' | 'i-layers' | 'i-file'> = {
    search: 'i-search',
    context: 'i-layers',
    write: 'i-file',
  }
  const name = map[key]
  return name ? <Icon name={name} /> : null
}

interface AiComposerProps {
  onOpenVoice: () => void
  /** 正在录音：麦克风那颗要挂 `.recording`（脉冲动画） */
  recording: boolean
}

export function AiComposer({ onOpenVoice, recording }: AiComposerProps) {
  const draft = useAiStore((state) => state.draft)
  const attachments = useAiStore((state) => state.attachments)
  const chips = useAiStore((state) => state.chips)
  const generating = useAiStore((state) => state.generating)
  const setDraft = useAiStore((state) => state.setDraft)
  const setChips = useAiStore((state) => state.toggleChip)
  const addAttachments = useAiStore((state) => state.addAttachments)
  const removeAttachment = useAiStore((state) => state.removeAttachment)
  const send = useAiStore((state) => state.send)
  const cancel = useAiStore((state) => state.cancel)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`
  }, [draft])

  const canSend = draft.trim().length > 0 || attachments.length > 0

  return (
    <div className="chat-input">
      {attachments.length ? (
        <div className="attachment-preview">
          {attachments.map((file, index) => (
            <div key={`${file.name}-${index}`} className="attachment-chip">
              <span className="file-icon">{file.type}</span>
              <span className="file-name" title={file.name}>
                {file.name}
              </span>
              <span className="file-size">{file.size}</span>
              <button
                type="button"
                className="remove-attach"
                title={`移除 ${file.name}`}
                onClick={() => removeAttachment(index)}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="input-tools">
        {AI_COMPOSER_CHIPS.map((chip) => (
          <div
            key={chip.key}
            className={cn('tool-chip', chips[chip.key] && 'active')}
            aria-pressed={Boolean(chips[chip.key])}
            {...pressable(() => setChips(chip.key))}
          >
            {chipIcon(chip.key)}
            {chip.label}
          </div>
        ))}
      </div>

      <div className="input-box">
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="问点什么，或说「今天有哪些安排」…"
          aria-label="向助手提问"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter' || event.shiftKey) return
            event.preventDefault()
            if (generating || !canSend) return
            send(nowTime())
          }}
        />
        <div className="input-actions">
          <button
            type="button"
            className="input-btn"
            title="上传附件"
            onClick={() => fileRef.current?.click()}
          >
            <GlyphPaperclip />
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              const files = Array.from(event.target.files ?? [])
              addAttachments(
                files.map((file) => ({
                  name: file.name,
                  size: formatFileSize(file.size),
                  type: (file.name.split('.').pop() ?? 'FILE').toUpperCase().slice(0, 4),
                })),
              )
              /* 清空 file input 的值：不清的话连续选同一个文件不会触发 change */
              event.target.value = ''
            }}
          />
          <button
            type="button"
            className={cn('input-btn', recording && 'recording')}
            title="语音输入"
            onClick={onOpenVoice}
          >
            <GlyphMic />
          </button>
          <button
            type="button"
            className={cn('send-btn', generating && 'stop')}
            disabled={!generating && !canSend}
            title={generating ? '停止生成' : '发送'}
            aria-label={generating ? '停止生成' : '发送'}
            onClick={() => {
              if (generating) {
                cancel()
                return
              }
              if (canSend) send(nowTime())
            }}
          >
            {generating ? <GlyphStop /> : <Icon name="i-arrow-right" />}
          </button>
        </div>
      </div>

      <div className="input-hint">
        <span>回答由本地规则引擎按项目数据现算，不发送任何内容</span>
        <span>
          <kbd>Enter</kbd> 发送 · <kbd>Shift</kbd> + <kbd>Enter</kbd> 换行
        </span>
      </div>
    </div>
  )
}
