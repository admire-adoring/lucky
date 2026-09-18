import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from '../icons/Icon'
import type { IconName } from '../../types'

interface CardProps {
  icon?: IconName
  title?: string
  hint?: string
  action?: ReactNode
  /** 列表类内容去掉内边距 */
  flush?: boolean
  className?: string
  children: ReactNode
}

/** 详情页通用卡片（原型 .card / .card__head / .card__body）
 *  玻璃拟态：材质来自 glass-panel（模糊 + 上沿高光），底色来自 bg-surface（半透明白）。
 *  两者分工不同、不抢属性，所以可以并存。 */
export function Card({ icon, title, hint, action, flush = false, className, children }: CardProps) {
  return (
    <div className={cn('glass-panel overflow-hidden rounded-xl border border-line bg-surface shadow-sm', className)}>
      {title ? (
        <div className="flex items-center gap-2 border-b border-line px-5 py-4">
          {icon ? <Icon name={icon} className="h-4 w-4 text-ink-400" /> : null}
          <h3 className="text-14 font-bold">{title}</h3>
          <span className="flex-1" />
          {hint ? <span className="text-12 font-medium text-ink-400">{hint}</span> : null}
          {action}
        </div>
      ) : null}
      <div className={flush ? 'p-0' : 'p-5'}>{children}</div>
    </div>
  )
}
