import { useId } from 'react'
import { cn } from '../../lib/cn'

/** 品牌标记（原型三个页面共用同一枚 32×32 渐变徽标） */
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
