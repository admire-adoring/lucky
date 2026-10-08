import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import { OpsIcon, type OpsIconName } from './ops-icon'

/* ==================================================================== *
 * 项目详情「分区页」的两个壳 —— 运维分区（`OpsPanel`）与账户分区（`AccountPanel`）共用。
 *
 * 为什么放在一个文件里：它们是同一层抽象（分区页的骨架件），而且必须一起改 ——
 * 卡头与弹窗头共用 `.ops-card-head` / `.modal-head` 的视觉，两页各抄一份会慢慢分叉。
 * ==================================================================== */

/**
 * 可折叠的卡片。整条 `h2` 是折叠区（原型 `role="button"` + `tabindex="0"`），
 * 里面那颗「+ 添加」是真按钮，所以它 onClick 要 `stopPropagation`。
 * 原型那条 `h2` 只挂了 `onclick`，键盘用户够不到 —— 这里补上 Enter / Space。
 */
export function PanelCard({
  icon,
  title,
  badge,
  bodyId,
  collapsed,
  onToggle,
  action,
  children,
}: {
  icon: OpsIconName
  title: string
  badge: string
  /** 折叠区的 `aria-controls`（原型给 `id` 的是卡身那一层） */
  bodyId?: string
  collapsed: boolean
  onToggle: () => void
  /** 卡头右侧那一颗主按钮（「+ 添加」/「+ 新建」）。没有就不渲染 */
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={cn('ops-card', collapsed && 'collapsed')}>
      <h2
        className="ops-card-head"
        role="button"
        tabIndex={0}
        aria-expanded={!collapsed}
        aria-controls={bodyId}
        onClick={onToggle}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onToggle()
        }}
      >
        <span className="ops-card-head-left">
          <span className="card-icon" aria-hidden="true">
            <OpsIcon name={icon} size={15} />
          </span>
          <span className="ops-card-title">{title}</span>
          <span className="ops-card-badge">{badge}</span>
        </span>
        <span className="ops-card-head-right">
          {action}
          <span className="ops-fold-icon" aria-hidden="true">
            <OpsIcon name="chevD" size={15} />
          </span>
        </span>
      </h2>
      <div className="ops-card-body" id={bodyId}>
        <div className="ops-card-body-inner">{children}</div>
      </div>
    </section>
  )
}

/**
 * 分区页的弹窗外壳。
 *
 * 为什么只留一个壳：这两页的弹窗在原型里都是「一个遮罩 + 换正文」
 *    （同一个 `#modalMask`，只是换 `mBody`）。拆成两套壳的代价不是多三十行，
 *    而是从此各有一套关闭逻辑、Escape 优先级和焦点处理 —— 然后慢慢分叉。
 * 只按"宽窄"分三档：`pick` = 路径浏览器那档（`.modal.modal-pick`，更窄）、
 *    `gen` = 凭据生成器那档（`.modal.modal-gen`，520px）、不给 = 标准 560px。
 *
 * 动作栏两种给法，不要混用：
 * · 默认（只给 `cancelLabel` / `footer`）= `[取消][footer]`；`footer` 不传就只有取消。
 * · `bar` = 整条替换（生成器那档是「复制 + 撑开 + 换一个 + 用它轮换」，没有取消钮）；
 *   `bar={null}` 则整条不渲染。
 */
export function PanelModal({
  title,
  variant,
  cancelLabel = '取消',
  onCancel,
  footer,
  bar,
  children,
}: {
  title: string
  /** 变体：`pick` / `gen` 对应原型的两个更窄的壳 */
  variant?: 'pick' | 'gen'
  cancelLabel?: string
  onCancel: () => void
  /** 默认动作栏右侧那颗。不传 = 只有取消 */
  footer?: ReactNode
  /** 整条动作栏的内容（给了就不再加取消按钮）；`null` = 连动作栏都不要 */
  bar?: ReactNode | null
  children: ReactNode
}) {
  return (
    <div
      className="modal-mask open"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
    >
      <div
        className={cn('modal', variant === 'pick' && 'modal-pick', variant === 'gen' && 'modal-gen')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-head">
          <div className="modal-title">{title}</div>
          <button type="button" className="modal-close" onClick={onCancel} aria-label="关闭">
            <OpsIcon name="x" size={15} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {bar !== undefined ? (
          bar === null ? null : (
            <div className="modal-actions">{bar}</div>
          )
        ) : (
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={onCancel}>
              {cancelLabel}
            </button>
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}
