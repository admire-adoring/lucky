import { useEffect, useId, useState } from 'react'
import { cn } from '../../lib/cn'

/** 进度环周长（r=56） */
const CIRCUMFERENCE = 351.86

interface ProgressRingProps {
  progress: number
  tasksDone: number
  tasksTotal: number
  daysLeft: number
  className?: string
}

export function ProgressRing({ progress, tasksDone, tasksTotal, daysLeft, className }: ProgressRingProps) {
  const gradientId = `ring-${useId().replace(/[^a-zA-Z0-9]/g, '')}`
  const [offset, setOffset] = useState(CIRCUMFERENCE)

  // 挂载后再写入目标值，让 0.9s 的 stroke-dashoffset 过渡产生“环长出来”的效果
  useEffect(() => {
    const frame = requestAnimationFrame(() => setOffset(CIRCUMFERENCE * (1 - progress / 100)))
    return () => cancelAnimationFrame(frame)
  }, [progress])

  return (
    <div
      className={cn(
        // 进度环是"嵌进玻璃里的一处凹槽"。注意不能用深色遮罩（bg-ink-50）做凹感：
        // 环下的「整体进度 / 任务完成」是 11.5px 的 ink-400，凹槽一深就会把它压到 2.8:1。
        // 改用"更薄的白 + 一道描边"表达内嵌，凹感来自描边而不是亮度差。
        'glass-soft flex flex-col items-center justify-center rounded-xl border border-line bg-surface-sunken p-5 text-center',
        className,
      )}
    >
      <div className="relative h-[132px] w-[132px]">
        <svg viewBox="0 0 132 132" width="132" height="132" aria-hidden="true">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#6366f1" />
              <stop offset="1" stopColor="#7c3aed" />
            </linearGradient>
          </defs>
          {/* 轨道色随底衬一起变：玻璃上不能用实色浅灰，否则环里会浮出一个灰圈 */}
          <circle cx="66" cy="66" r="56" fill="none" stroke="rgba(17,20,28,.09)" strokeWidth="10" />
          <circle
            cx="66"
            cy="66"
            r="56"
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
            transform="rotate(-90 66 66)"
            style={{ transition: 'stroke-dashoffset .9s cubic-bezier(0,0,.2,1)' }}
          />
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <b className="text-30 font-bold leading-none tracking-[-0.02em] tabular-nums">{progress}%</b>
          <span className="mt-1 text-11-5 font-semibold text-ink-400">整体进度</span>
        </div>
      </div>

      <div className="mt-4 flex w-full justify-center gap-5">
        <div className="text-center">
          <b className="block text-16 font-bold leading-[1.3] tabular-nums">
            {tasksDone}/{tasksTotal}
          </b>
          <span className="text-11-5 font-medium text-ink-400">任务完成</span>
        </div>
        <div className="text-center">
          <b className="block text-16 font-bold leading-[1.3] tabular-nums">{daysLeft >= 0 ? daysLeft : '—'}</b>
          <span className="text-11-5 font-medium text-ink-400">剩余天数</span>
        </div>
      </div>
    </div>
  )
}
