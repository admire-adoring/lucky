import { cn } from '../../../lib/cn'
import {
  clockToMin,
  DEMO_NOW,
  estText,
  hoursText,
  rangeLabel,
  rowToClock,
  timeline,
  TL_ROWS,
  TL_TICKS,
  TL_WINDOW,
  type TaskRow,
} from '../../../data/workspace/tasks'
import { useTaskApi } from './task-state'

/**
 * 「今日」的时间轴 —— 这一版唯一回答「今天排不排得下」的地方。
 *
 * ============================================================================
 * 三件事决定了它长这样
 * ============================================================================
 *
 * ① 半小时间一行（`--tl-row`），块用 `grid-row: <start> / span <n>` 定位。
 *    为什么不用绝对定位 + px：行网格天然对齐刻度，改窗口只改行数；
 *    px 定位则每块都要算 top/height 两次数，四舍五入后块与刻度线会错半像素。
 *    行号 → 时刻的换算只有一处（`rowToClock`），别再就地写一遍。
 *
 * ② 窗口是配置项（`TL_WINDOW`，默认 08:00–22:00）。行数由它算出来，
 *    CSS 通过 `--tl-rows` 消费 —— 所以"改了窗口忘改 CSS"这件事不可能发生
 *    （原型为此专门写了一条自检断言，这里靠单一来源解决）。
 *
 * ③ 空档是算出来的、不是写死的（`timeline()`）：排进去一项，它自己变短。
 *    块与空档不重叠、不超出窗口同样由那个函数保证。
 *
 * ============================================================================
 * 三个状态修饰的分工（不能共用一个信号）
 * ============================================================================
 *
 * · `is-doing` —— 此刻正在占用时段（实底薄染，视觉权重最高）
 * · `is-done`  —— 已完成（绿薄染 + 划线）
 * · `is-past`  —— 时段已过但没做：虚线，不是红色。"已经晚了"和"逾期"
 *   是两个概念，红色只留给真正的逾期（列表行上的 `is-overdue`）。
 */
export function TaskTimeline({
  tasks,
  pass,
}: {
  tasks: TaskRow[]
  /** 二级筛选：块与池都参与过滤（原型的 `.tl-block` 上也挂着 `data-filter`） */
  pass: (row: TaskRow) => boolean
}) {
  const api = useTaskApi()
  const all = timeline(tasks)
  const blocks = all.blocks.filter((block) => pass(block.row))
  const gaps = all.gaps
  const nowMin = clockToMin(DEMO_NOW.slice(11, 16))
  const rowPx = 20 /* 与 `.tl` 的 `--tl-row` 同步；现在线的像素位置按它换算 */
  const nowTop = ((nowMin - TL_WINDOW.startMin) / TL_WINDOW.rowMin) * rowPx
  const loadMin = blocks.reduce((sum, block) => sum + (block.row.estMin ?? 0), 0)

  return (
    <div className="section">
      <div className="section-title">
        <span>今天 · 时间轴</span>
        <span className="section-side">
          <span className="section-count">已排 {hoursText(loadMin / 60)}</span>
        </span>
      </div>

      <div className="tl" style={{ ['--tl-rows' as string]: String(TL_ROWS) }}>
        <div className="tl-gutter">
          {TL_TICKS.map((row) => (
            <span key={row} style={{ gridRow: row }}>
              {rowToClock(row)}
            </span>
          ))}
        </div>

        <div className="tl-lane">
          {/* 现在线：位置由 --tl-row 与窗口起点算出，只用来回答"我走到哪了" */}
          <i
            className="tl-now"
            data-label={`现在 ${DEMO_NOW.slice(11, 16)}`}
            style={{ top: `${nowTop}px` }}
          />

          {blocks.map((block) => {
            const { row } = block
            const done = row.state === 'done'
            const startMin = clockToMin(row.scheduledStart!)
            const past = !done && startMin + (row.estMin ?? 0) < nowMin
            return (
              <div
                key={row.id}
                className={cn(
                  'tl-block',
                  done && 'is-done',
                  !done && row.state === 'doing' && 'is-doing',
                  past && 'is-past',
                )}
                style={{ gridRow: `${block.startRow} / span ${block.span}` }}
                title={rangeLabel(row.scheduledStart!, row.estMin ?? TL_WINDOW.rowMin)}
                onClick={() => api.openDetail(row.id)}
              >
                <span className="list-text">{row.title}</span>
                <span className="tl-est">{estText(row)}</span>
              </div>
            )
          })}

          {gaps.map((gap, index) => (
            <div
              key={gap.startRow}
              /* 「下一个空档」的高亮永远指给最后一个空档 —— 因为「排进去」吃的就是它 */
              className={cn('tl-gap', index === gaps.length - 1 && 'is-next')}
              style={{ gridRow: `${gap.startRow} / span ${gap.span}` }}
            >
              空档 {hoursText(gap.minutes / 60)}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
