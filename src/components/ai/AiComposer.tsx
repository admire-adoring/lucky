import { useEffect, useRef } from 'react'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { AI_COMPOSER_CHIPS } from '../../data/ai/conversations'
import { findGenerating, formatFileSize, nowTime, useAiStore } from '../../stores/ai-store'
import { GlyphCode, GlyphMic, GlyphPaperclip, GlyphStop } from './ai-glyphs'
import { pressable } from './pressable'

/**
 * 输入区（原型 `.chat-input`）。
 *
 * ============================================================================
 * 第二轮原型在这里改了三件事，都照搬
 * ============================================================================
 * ① **发送键有三态**：空闲（箭头）/ 生成中且输入区有内容（`排队发送` + 时钟）/
 *    生成中且输入区为空（`停止` + 方块）。第一代只有两态，而"生成中按回车"
 *    在它那里是**什么都不发生** —— 用户敲完一句按了回车，界面毫无反馈。
 * ② **排队横幅**：队列非空时在输入框上方显示「已排队 N 条消息…」。
 * ③ **麦克风那一次点击顺带记下光标位置**：语音浮层的「插入光标处」需要它。
 *    （原型直接读 `input.selectionStart`；浮层与输入框是两个组件，
 *      所以这里在打开浮层的那一刻把位置存进 store。）
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
  const queue = useAiStore((state) => state.queue)
  const generatingMessage = useAiStore((state) => findGenerating(state.sessions))
  const setDraft = useAiStore((state) => state.setDraft)
  const toggleChip = useAiStore((state) => state.toggleChip)
  const addAttachments = useAiStore((state) => state.addAttachments)
  const removeAttachment = useAiStore((state) => state.removeAttachment)
  const setCaret = useAiStore((state) => state.setCaret)
  const send = useAiStore((state) => state.send)
  const stop = useAiStore((state) => state.stop)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_INPUT_HEIGHT)}px`
  }, [draft])

  const hasContent = draft.trim().length > 0 || attachments.length > 0
  const generating = Boolean(generatingMessage)

  /**
   * 发送键与回车的**同一个**入口。
   *
   * 三态的分支顺序就是原型 `handleSend` 的顺序：
   * 生成中 + 有内容 → 入队；生成中 + 空 → 停止；空闲 → 发送。
   */
  function submit() {
    if (generating && generatingMessage) {
      if (hasContent) {
        send(nowTime())
        return
      }
      stop(generatingMessage.id)
      return
    }
    if (hasContent) send(nowTime())
  }

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

      {/* 排队横幅：文案与原型逐字一致 */}
      <div className={cn('queue-banner', queue.length > 0 && 'show')}>
        <Icon name="i-clock" />
        <span>
          已排队 <span className="q-count">{queue.length}</span> 条消息，当前生成完成后自动发送
        </span>
      </div>

      <div className="input-tools">
        {AI_COMPOSER_CHIPS.map((chip) => (
          <div
            key={chip.key}
            className={cn('tool-chip', chips[chip.key] && 'active')}
            aria-pressed={Boolean(chips[chip.key])}
            {...pressable(() => toggleChip(chip.key))}
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
            submit()
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
            onClick={() => {
              /* 记下光标位置给「插入光标处」用（浮层里读不到这个 textarea） */
              setCaret(textareaRef.current?.selectionStart ?? draft.length)
              onOpenVoice()
            }}
          >
            <GlyphMic />
          </button>

          {/* 三态发送键：文本与图标都与原型一致 */}
          {generating && hasContent ? (
            <button type="button" className="send-btn queue" onClick={submit} title="排队发送">
              <Icon name="i-clock" />
              排队发送
            </button>
          ) : generating ? (
            <button type="button" className="send-btn stop" onClick={submit} title="停止生成">
              <GlyphStop />
              停止
            </button>
          ) : (
            <button
              type="button"
              className="send-btn"
              disabled={!hasContent}
              onClick={submit}
              title="发送"
              aria-label="发送"
            >
              <Icon name="i-arrow-right" />
            </button>
          )}
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
