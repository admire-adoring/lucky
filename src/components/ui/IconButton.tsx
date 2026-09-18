import type { ButtonHTMLAttributes } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from '../icons/Icon'
import type { IconName } from '../../types'

/**
 * 三种形态对应原型的三个位置：
 * - ghost   顶栏通知（34×34 透明底）
 * - muted   卡片右上「更多操作」（26×26 更浅）
 * - framed  详情页 Hero「更多」（34×34 带描边）
 * - outline ≤860px 的汉堡按钮（默认隐藏，断点内 inline-flex）
 */
type Variant = 'ghost' | 'muted' | 'framed' | 'outline'

const VARIANTS: Record<Variant, string> = {
  ghost: 'inline-flex h-[34px] w-[34px] rounded-sm border-transparent bg-transparent text-ink-500 hover:bg-ink-50 hover:text-ink-900',
  muted: 'inline-flex h-[26px] w-[26px] rounded-sm border-transparent bg-transparent text-ink-300 hover:bg-ink-50 hover:text-ink-700',
  /* framed / outline 是"看得见的一小块玻璃"：给它们材质，悬浮时才像被点亮 */
  framed:
    'glass-soft inline-flex h-[34px] w-[34px] rounded-sm border-line-strong bg-surface text-ink-500 hover:bg-surface-raised hover:text-ink-900',
  outline:
    'glass-soft hidden h-[34px] w-[34px] rounded-sm border-line bg-surface text-ink-600 max-[860px]:inline-flex hover:bg-surface-raised hover:text-ink-900',
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  /** 无障碍名称，图标按钮必填 */
  label: string
  variant?: Variant
  /** 未读小圆点 */
  dot?: boolean
}

export function IconButton({ icon, label, variant = 'ghost', dot = false, className, ...rest }: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        'relative shrink-0 items-center justify-center border transition-all duration-150 ease-out',
        VARIANTS[variant],
        className,
      )}
      {...rest}
    >
      <Icon name={icon} className="h-[17.5px] w-[17.5px]" />
      {dot ? (
        // 未读点的描边用来"隔开"图标笔画，必须接近不透明（半透明会漏出底下的线条）
        <span className="absolute right-1.5 top-1.5 h-[7px] w-[7px] rounded-full border-[1.5px] border-white/90 bg-danger" />
      ) : null}
    </button>
  )
}
