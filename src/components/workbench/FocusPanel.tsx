import { cn } from '../../lib/cn'
import type { FocusItem, FocusTone } from '../../types/workbench'

/**
 * 焦点项的语气 → 类串。只影响颜色，不影响语义。
 * ⚠️ `tag` 那一档承载文字，所以 danger/warn 用的是 `-bg` + `-strong` 组合，
 *    而不是主色阶压在薄染上（那个组合在 11px 下只有 2.8:1）。
 */
const FOCUS_TONE: Record<FocusTone, { dot: string; tag: string }> = {
  danger: { dot: 'bg-danger', tag: 'bg-danger-bg text-danger-strong' },
  warn: { dot: 'bg-warning', tag: 'bg-warning-bg text-ink-700' },
  ink: { dot: 'bg-ink-300', tag: 'text-ink-500' },
}

interface FocusPanelProps {
  items: FocusItem[]
  /** 没有数据源时的说明（设置模块就是这种） */
  emptyHint: string
}

/**
 * 「今日焦点」：从项目数据里挑出来的**具体是哪几件**。
 *
 * 判据：Hero 补的是磁贴没说的那部分 —— 下方磁贴给的全是**统计**
 * （完成率 / 分布 / 到期压力都是聚合值），缺"具体是哪几件"。
 * 所以这里只引用 `projects.ts` 已有的字段，**不造新数字**。
 */
export function FocusPanel({ items, emptyHint }: FocusPanelProps) {
  return (
    <ul className="grid gap-2">
      {items.length === 0 ? (
        <li className="rounded-xl border border-dashed border-line px-3 py-6 text-center text-11-5 font-medium text-ink-400">
          {emptyHint}
        </li>
      ) : (
        items.map((item) => {
          const tone = FOCUS_TONE[item.tone]
          return (
            <li
              key={`${item.name}-${item.tag}`}
              className="flex items-start gap-2.5 rounded-xl border border-line g g3 g--refr px-3 py-2.5"
            >
              <i className={cn('mt-[6px] h-[6px] w-[6px] shrink-0 rounded-full', tone.dot)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2">
                  <b className="min-w-0 truncate text-12-5 font-semibold text-ink-900">{item.name}</b>
                  <span
                    className={cn(
                      'ml-auto shrink-0 rounded-full px-1.5 py-px text-11 font-bold tabular-nums',
                      tone.tag,
                    )}
                  >
                    {item.tag}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-11-5 font-medium text-ink-500">{item.meta}</div>
              </div>
            </li>
          )
        })
      )}
    </ul>
  )
}
