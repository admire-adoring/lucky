import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'

/** 挂载后再写入目标宽度，让 CSS transition 产生“进度条长出来”的动效 */
function useAnimatedWidth(value: number, enabled: boolean): number {
  const [width, setWidth] = useState(enabled ? 0 : value)

  useEffect(() => {
    if (!enabled) {
      setWidth(value)
      return
    }
    const frame = requestAnimationFrame(() => setWidth(value))
    return () => cancelAnimationFrame(frame)
  }, [value, enabled])

  return width
}

interface ProgressBarProps {
  value: number
  /** 填充色：按 scope 的三档渐变 */
  fill: string
  /** 列表用 6px，详情页的里程碑条用 8px */
  height?: 6 | 8
  showValue?: boolean
  animateOnMount?: boolean
  className?: string
  /** 轨道附加样式（表格里的进度条有 min-width 约束） */
  barClassName?: string
}

export function ProgressBar({
  value,
  fill,
  height = 6,
  showValue = true,
  animateOnMount = false,
  className,
  barClassName,
}: ProgressBarProps) {
  const width = useAnimatedWidth(value, animateOnMount)

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div
        className={cn(
          'flex-1 overflow-hidden rounded-full bg-ink-100',
          height === 8 ? 'h-2' : 'h-1.5',
          barClassName,
        )}
      >
        <span
          className={cn('block h-full rounded-full transition-[width] duration-[400ms] ease-out', fill)}
          style={{ width: `${width}%` }}
        />
      </div>
      {showValue ? (
        <span className="min-w-[34px] text-right text-12 font-bold tabular-nums text-ink-600">{value}%</span>
      ) : null}
    </div>
  )
}
