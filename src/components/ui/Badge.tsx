import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { PRIORITY_META, SCOPE_META, STATUS_META, TASK_STATUS_META } from '../../data/meta'
import type { Priority, ProjectStatus, Scope, TaskStatus } from '../../types'

/**
 * 胶囊基元。原型的列表页用 .status（gap 6px + 1px 透明描边），
 * 详情页用 .pill（gap 5px、无描边），尺寸差了 2px，因此这里显式区分两套度量。
 */
const PILL_METRICS = {
  status: 'gap-1.5 border border-transparent',
  pill: 'gap-[5px]',
} as const

function Pill({
  label,
  tone,
  dot,
  metrics = 'status',
}: {
  label: string
  /** chip 底色与文字色 */
  tone: string
  /** 圆点颜色 */
  dot: string
  metrics?: keyof typeof PILL_METRICS
}) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center rounded-full px-[9px] text-11-5 font-semibold whitespace-nowrap',
        PILL_METRICS[metrics],
        tone,
      )}
    >
      <i className={cn('h-[5.5px] w-[5.5px] shrink-0 rounded-full', dot)} />
      {label}
    </span>
  )
}

/** scope 徽标 —— 三域归属的唯一信号 */
export function ScopeBadge({ scope }: { scope: Scope }) {
  const meta = SCOPE_META[scope]
  return (
    <span
      className={cn(
        'inline-flex h-[22px] items-center gap-[5px] rounded-full px-[9px] text-11-5 font-bold tracking-[.01em] whitespace-nowrap',
        meta.badge,
      )}
    >
      <i className="h-[5.5px] w-[5.5px] shrink-0 rounded-full bg-current" />
      {meta.label}
    </span>
  )
}

export function ProjectStatusChip({
  status,
  metrics = 'status',
}: {
  status: ProjectStatus
  /** 详情页与列表页的状态 chip 度量不同（原型 .pill / .status） */
  metrics?: 'status' | 'pill'
}) {
  const meta = STATUS_META[status]
  return <Pill label={meta.label} tone={meta.chip} dot={meta.dot} metrics={metrics} />
}

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  const meta = TASK_STATUS_META[status]
  return <Pill label={meta.label} tone={meta.pill} dot={meta.dot} metrics="pill" />
}

export function PriorityTag({ priority }: { priority: Priority }) {
  const meta = PRIORITY_META[priority]
  return (
    <span title={`优先级：${meta.label}`} className="inline-flex items-center gap-[5px] text-11-5 font-semibold text-ink-400">
      <b className={cn('h-[7px] w-[7px] shrink-0 rounded-[2px]', meta.dot)} />
      {meta.label}
    </span>
  )
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="glass-soft inline-flex items-center rounded-xs border border-line bg-surface-sunken px-2 py-[2px] text-11-5 font-medium text-ink-500">
      {children}
    </span>
  )
}
