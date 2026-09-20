import type { MiniChartSpec } from '../../types/workbench'
import { cn } from '../../lib/cn'

interface MiniChartProps {
  spec: MiniChartSpec
  className?: string
}

/** 保留 1 位小数 —— 与生成器里的 `r1` 同一个口径，避免同一根柱在两处算出不同的 d */
const r1 = (v: number) => Math.round(v * 10) / 10

/**
 * 迷你柱图 —— 磁贴底部那一排细柱。
 *
 * 为什么用 `<path>` + `stroke-width` 画柱，而不是 `<rect>`：
 *   柱宽靠 stroke 给，于是**同一组同色柱可以合成一条 path**（每个 `M x baseline V top`
 *   就是一根柱），30 根柱也只有几十字节。这是原型的做法，照搬 —— 换成 rect 会让
 *   DOM 节点数翻几倍，而这里一屏要渲染 45 块磁贴。
 *
 * ⚠️ 几何（x 偏移、柱高）**在导出时就按像素算好了**，这个组件不做任何数据换算。
 *    高度换算里有个下限 2px 的约定（见生成器 `hOf`）：0% 的那根柱若真按 0 画，
 *    看上去就像"漏画了"，所以最矮也留 2px。
 *
 * ⚠️ 基线用的是 `var(--line)`（Prism 令牌），而原型里写死的是 `rgba(17,20,28,.10)`
 *    —— 那是一条**深色**线，暗色主题下几乎看不见。这里改成主题令牌，两个主题都对。
 */
export function MiniChart({ spec, className }: MiniChartProps) {
  const { groups, width, height, baseline } = spec
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn('block w-full', className)}
      style={{ aspectRatio: `${width} / ${height}` }}
      aria-hidden="true"
    >
      <line x1={0} y1={baseline} x2={width} y2={baseline} stroke="var(--line)" strokeWidth={1} />
      {groups.map((g, gi) => (
        <path
          key={gi}
          d={g.bars.map(([x, h]) => `M${x} ${baseline} V${r1(baseline - h)}`).join(' ')}
          stroke={g.color}
          strokeWidth={g.w}
          fill="none"
        />
      ))}
    </svg>
  )
}
