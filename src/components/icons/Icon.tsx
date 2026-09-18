import { cn } from '../../lib/cn'
import type { IconName } from '../../types'

/**
 * 图标统一走内联 SVG 精灵（原型做法），不引图标依赖：
 * <use href="#i-search" /> 指向 <IconSprite /> 里注册的 symbol。
 * 默认 18px 由 .icon 组件类提供，调用处传工具类即可覆盖尺寸与颜色。
 */
export function Icon({ name, className }: { name: IconName; className?: string }) {
  return (
    <svg className={cn('icon', className)} aria-hidden="true">
      <use href={`#${name}`} />
    </svg>
  )
}
