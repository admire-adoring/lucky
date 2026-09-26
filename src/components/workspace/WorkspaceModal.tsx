import { useEffect, type ReactNode, type Ref } from 'react'

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
 *
 * ============================================================================
 * `phase` / `boxRef` / `label` 是给**项目书架**加的（飞入·飞出动画）
 * ============================================================================
 *
 * 三个都是可选的、默认不启用 —— 其余调用方一行都不用改。
 *
 * 为什么阶段要由调用方掌握：动画的时序是"谁做动画谁排"（克隆体飞 480ms、
 * 弹窗在 260ms 时出现），组件只把阶段翻成类名。这里唯一需要解释的是 `measuring`：
 * 克隆体要飞向弹窗的**最终矩形**，而矩形只有把弹窗渲染出来才量得到。所以那一段
 * 是"遮罩已开、弹窗还看不见"。用 `visibility: hidden` 而不是 `display: none` ——
 * 后者量出来是 0×0，克隆体会飞向左上角（`getBoundingClientRect` 对 display:none 给全零）。
 */
export function WorkspaceModal({
  title,
  label,
  phase,
  boxRef,
  onClose,
  children,
}: {
  /** 标题。可以是节点 —— 项目书架要在标题前放一颗项目色点。 */
  title: ReactNode
  /** `aria-label` 用的纯文本。`title` 不是字符串时必须给（否则读屏只会念"对话框"）。 */
  label?: string
  /** 进出场阶段。不给 = 无动画（其余调用方都是这样）。 */
  phase?: 'measuring' | 'entering' | 'leaving'
  /** 弹窗**盒子**（不含遮罩）的 ref —— 「先量后飞」要用它。 */
  boxRef?: Ref<HTMLDivElement>
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

  const ariaLabel = label ?? (typeof title === 'string' ? title : undefined)

  return (
    <div
      className="modal-mask open"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        ref={boxRef}
        className={phase === undefined ? 'modal' : `modal ${phase}`}
        style={phase === 'measuring' ? { visibility: 'hidden' } : undefined}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
      >
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
