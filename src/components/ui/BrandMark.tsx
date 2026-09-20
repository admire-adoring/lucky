import { useId } from 'react'
import { cn } from '../../lib/cn'

/**
 * 品牌标记（原型三个页面共用同一枚 32×32 渐变徽标）。
 *
 * ⚠️ **尺寸由调用方给**：这里只有 `shrink-0`，没有 `h-*` / `w-*`。
 *    不传尺寸时，SVG 在一个 flex 容器里会撑满可用空间 ——
 *    实测过 1392×1392（整块 Hero 被一个巨大的渐变圆盖住），而且**不报错**。
 *    刻意**不**在这里补一个默认尺寸：`cn()` 只做字符串拼接、不做冲突消解，
 *    默认值与调用方传的值会同时出现在 class 上，谁赢取决于 CSS 里的产出顺序 ——
 *    那是个比"忘传尺寸"更难查的问题。所有调用点都显式给尺寸：
 *      `className="h-7 w-7"` / `"h-[38px] w-[38px] rounded-[11px]"` …
 */
export function BrandMark({ className }: { className?: string }) {
  const gradientId = `brand-${useId().replace(/[^a-zA-Z0-9]/g, '')}`

  return (
    <svg viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden="true">
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1" />
          <stop offset="1" stopColor="#7c3aed" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${gradientId})`} />
      <path d="M16 7.5A8.5 8.5 0 0 1 23.36 20.25" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M23.36 20.25A8.5 8.5 0 0 1 8.64 20.25" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".6" />
      <path d="M8.64 20.25A8.5 8.5 0 0 1 16 7.5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" opacity=".32" />
      <circle cx="16" cy="16" r="2.3" fill="#fff" />
    </svg>
  )
}
