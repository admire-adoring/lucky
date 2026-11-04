import { useEffect, useId, useRef, type ReactNode } from 'react'
import { Icon } from '../icons/Icon'
import type { IconName } from '../../types'

/**
 * 破坏性二次确认弹窗。
 *
 * 不复用 `WorkspaceModal`：那一套的盒子、动作条、危险按钮在 CSS 里是按模块各写一份的
 * （`[data-module='work']` 有盒子没动作条、`projects` 有动作条没别的），
 * 同一个弹窗挂在两个模块下就长成两个样子。这里自带全部皮肤，跨模块只有一种长相。
 */
export function ConfirmDialog({
  title,
  target,
  description,
  icon = 'i-alert',
  confirmLabel = '删除',
  cancelLabel = '取消',
  pending = false,
  pendingLabel = '删除中…',
  onConfirm,
  onClose,
}: {
  title: string
  /** 被操作对象的名称，展示在标题下方。 */
  target?: string
  description: ReactNode
  icon?: IconName
  confirmLabel?: string
  cancelLabel?: string
  pending?: boolean
  pendingLabel?: string
  onConfirm: () => void
  onClose: () => void
}) {
  const titleId = useId()
  const descId = useId()
  const cancelRef = useRef<HTMLButtonElement>(null)

  /* 焦点落在「取消」上：破坏性动作不该一回车就执行 */
  useEffect(() => {
    cancelRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose, pending])

  return (
    <div
      className="cfm-mask"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pending) onClose()
      }}
    >
      <div className="cfm" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descId}>
        <div className="cfm-head">
          <span className="cfm-badge" aria-hidden="true">
            <Icon name={icon} />
          </span>
          <div className="cfm-heading">
            <h2 className="cfm-title" id={titleId}>
              {title}
            </h2>
            {target ? <div className="cfm-target">「{target}」</div> : null}
          </div>
          <button type="button" className="cfm-close" aria-label="关闭" disabled={pending} onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="cfm-body" id={descId}>
          {description}
        </div>

        <div className="cfm-foot">
          <button ref={cancelRef} type="button" className="cfm-btn" disabled={pending} onClick={onClose}>
            {cancelLabel}
          </button>
          <button type="button" className="cfm-btn is-danger" disabled={pending} onClick={onConfirm}>
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
