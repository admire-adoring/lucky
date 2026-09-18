import { cn } from '../../lib/cn'

interface EmptyStateProps {
  title: string
  description: string
  className?: string
}

/** 空态（原型 .empty）：筛选无结果时展示 */
export function EmptyState({ title, description, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-6 py-16 text-center', className)}>
      <div className="glass-soft mb-4 flex h-14 w-14 items-center justify-center rounded-xl border border-line bg-ink-50 text-ink-400">
        <svg className="h-[26px] w-[26px]" aria-hidden="true">
          <use href="#i-empty" />
        </svg>
      </div>
      <h3 className="mb-1.5 text-15">{title}</h3>
      <p className="m-0 text-13 text-ink-500">{description}</p>
    </div>
  )
}

/** 数据加载占位：原型是静态数据没有加载态，接真实后端后由这里兜住 */
export function LoadingBlock({ label = '加载中…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2.5 py-16 text-13 text-ink-400">
      <span className="h-[15px] w-[15px] animate-spin-fast rounded-full border-2 border-ink-200 border-t-ink-400" />
      {label}
    </div>
  )
}
