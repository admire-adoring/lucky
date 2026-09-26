import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from '../icons/Icon'
import type { IconName } from '../../types'

type Variant = 'primary' | 'ghost'
type Size = 'md' | 'sm'

const BASE =
  'inline-flex items-center justify-center gap-[7px] rounded-md border border-transparent font-semibold whitespace-nowrap transition-all duration-150 ease-out active:scale-[.98]'

const VARIANTS: Record<Variant, string> = {
  /** 主操作用近黑，避免蓝按钮的通用感。
   *  玻璃拟态下改为「深色玻璃」：上沿一道 1px 亮线 + 更远的落影，
   *  让它像一片压在界面上的深色镜面，而不是一坨实心墨块。 */
  primary:
    // ⚠️ 2026-09-25 纯色化：原来是 `linear-gradient(180deg, rgba(32,36,48,.95), rgba(12,14,20,.97))`
    // 外加 `inset 0 1px 0 rgba(255,255,255,.18)` 的贴顶高光。渐变换成 `--ink-solid`
    // （其值就是那两个端点的中点，见 design-tokens.css），高光删掉 ——
    // 实底上那条 1px 白线读作"按钮上面粘了根亮线"，不再读作"玻璃有厚度"。
    'bg-[color:var(--ink-solid)] text-white shadow-[0_6px_18px_rgba(16,18,24,.22)] hover:-translate-y-px hover:bg-[color:var(--ink-solid-hover)] hover:shadow-[0_14px_30px_rgba(16,18,24,.3)]',
  /** 次操作是「真正的浅色玻璃」：半透明底 + backdrop-filter + 上沿高光 */
  ghost:
    'glass-soft border-line-strong bg-surface text-ink-700 shadow-xs hover:-translate-y-px hover:border-line-strong hover:bg-surface-raised hover:text-ink-900 hover:shadow-sm',
}

const SIZES: Record<Size, string> = {
  md: 'h-9 px-3.5 text-13-5',
  sm: 'h-8 px-[11px] text-13',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  children?: ReactNode
}

export function Button({ variant = 'ghost', size = 'md', icon, className, children, ...rest }: ButtonProps) {
  return (
    <button type="button" className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...rest}>
      {icon ? <Icon name={icon} className="h-4 w-4" /> : null}
      {children}
    </button>
  )
}
