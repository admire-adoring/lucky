import { useEffect, useState } from 'react'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { toast } from '../../stores/toast-store'
import { AI_CONTEXT_CATALOG } from '../../data/ai/contexts'
import { useAiStore } from '../../stores/ai-store'
import { GlyphClose } from './ai-glyphs'
import { pressable } from './pressable'

/**
 * 「添加上下文」选择器（原型第二轮新增的 `.context-picker` 弹窗）。
 *
 * ============================================================================
 * 多选，且**记住打开时的选中态**（取消 = 不改动）
 * ============================================================================
 * 原型的行为：打开时把当前会话的 contexts 拷进一个临时 Set，点击只改这个 Set，
 * 「确定」才写回会话。照搬 —— 这样"点开看看再取消"不会把已有上下文弄丢。
 *
 * ⚠️ 与原型的两处差异，都在数据侧（见 `data/ai/contexts.ts` 的文件头）：
 *    · 目录是**真来源**（2 个事实源 + 8 个项目），不是 8 条演示数据；
 *    · 每一项的 `sub` 由项目状态/进度算出来，不是写死的"笔记 · 12 条"。
 */
interface AiContextPickerProps {
  open: boolean
  onClose: () => void
}

export function AiContextPicker({ open, onClose }: AiContextPickerProps) {
  const session = useAiStore((state) => state.sessions.find((item) => item.id === state.activeId))
  const setContexts = useAiStore((state) => state.setContexts)
  const [selected, setSelected] = useState<string[]>([])

  /* 每次打开都从会话的当前值重新起一份草稿 */
  useEffect(() => {
    if (open) setSelected(session?.contexts ?? [])
  }, [open, session?.contexts])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function toggle(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
  }

  return (
    <div className={cn('context-picker', open && 'show')} role="dialog" aria-label="添加上下文">
      <div className="context-picker-box">
        <div className="context-picker-head">
          <h3>添加上下文</h3>
          <button type="button" className="thought-panel-close" onClick={onClose} aria-label="关闭">
            <GlyphClose />
          </button>
        </div>

        <div className="context-picker-body">
          {AI_CONTEXT_CATALOG.map((option) => (
            <div
              key={option.id}
              className={cn('ctx-option', selected.includes(option.id) && 'selected')}
              aria-pressed={selected.includes(option.id)}
              {...pressable(() => toggle(option.id))}
            >
              <span className="ctx-icon">
                <Icon name={option.icon} />
              </span>
              <span className="ctx-text">
                {option.name}
                <span className="ctx-sub">{option.sub}</span>
              </span>
              <span className="ctx-check">
                <Icon name="i-check" />
              </span>
            </div>
          ))}
        </div>

        <div className="context-picker-foot">
          <button type="button" className="ctx-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="ctx-btn primary"
            onClick={() => {
              setContexts(selected)
              onClose()
              toast(`已更新上下文（${selected.length} 项）`)
            }}
          >
            确定
          </button>
        </div>
      </div>
    </div>
  )
}
