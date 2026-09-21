import { useEffect, type ReactNode } from 'react'

/**
 * 弹窗 —— 原型的 `.modal-mask > .modal`。
 *
 * 三处与原型不同，都是"静态页 → 应用"必然要改的：
 *
 *  1. **可见性用条件渲染**，不是 `classList.add('open')`。原型靠 `.modal-mask.open`
 *     切 `display`，React 里"渲染了就是开着"更直接，也不会留下一个空的遮罩在 DOM 里
 *     继续吃点击（`.modal-mask` 是 `position:fixed; inset:0`，即使 `display:none`
 *     在切换的中间态也会挡一下）。
 *  2. **ESC 关闭挂在组件上**，不是 `document.addEventListener`。原型那份监听在页面里
 *     注册一次、永不卸载；组件化之后每个弹窗自己管自己的键盘生命周期，
 *     关掉就一起撤掉。
 *  3. **点遮罩关闭用 `e.target === e.currentTarget` 判定**（与原型一致）——
 *     不能用 `onClick` 直接写在遮罩上：那样点弹窗内部也会冒泡上来把它关掉。
 */
export function WorkspaceModal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="modal-mask open"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}
