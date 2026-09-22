import { useEffect, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { toast } from '../../stores/toast-store'
import { AI_MODELS } from '../../data/ai/conversations'
import { useAiStore } from '../../stores/ai-store'
import { pressable } from './pressable'

/**
 * 模型选择（原型 `.model-chip` + `.model-dropdown`）—— 落在**外壳顶栏的动作槽**里。
 *
 * ============================================================================
 * 为什么它在顶栏、而不是这一页自己的顶栏
 * ============================================================================
 * 原型画了一条自己的顶栏（logo + "AI 助手 Beta" + 模型 chip + 几个图标按钮）。
 * 落到应用里那条顶栏被**换成外壳的 `ShellTopbar`** —— 九域导航、窗口控制、
 * 命令面板、主题、账户入口都在那儿，这一页不能没有它们。
 * 于是原型顶栏里**唯一这一页专属**的东西（模型 chip）走 `actions` 槽进来。
 *
 * ⚠️ 模型档位换了**不会**真的换模型（应用里没有模型网关）。
 *    所以切换只落成偏好，并且 toast 里写明这件事 —— 否则就是一个
 *    "看起来换成功了、实际什么都没发生"的开关。
 */
export function AiModelPicker() {
  const model = useAiStore((state) => state.model)
  const setModel = useAiStore((state) => state.setModel)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const current = AI_MODELS.find((item) => item.name === model) ?? AI_MODELS[0]

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        className="model-chip"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="dot" />
        <span>{current.name}</span>
        <svg
          className="chev"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      <div className={cn('model-dropdown', open && 'show')} role="menu">
        {AI_MODELS.map((item) => (
          <div
            key={item.name}
            className={cn('model-option', item.name === model && 'active')}
            {...pressable(() => {
              setModel(item.name)
              setOpen(false)
              toast(`${item.name} 已记录为偏好 —— 还没有模型网关，它不会真的换模型`)
            })}
          >
            <span className="mo-icon" style={{ background: item.grad }}>
              {item.short}
            </span>
            <span className="mo-info">
              {item.name}
              <span className="mo-sub">{item.sub}</span>
            </span>
            <svg
              className="mo-check"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.6}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        ))}
      </div>
    </div>
  )
}
