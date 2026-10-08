import { useId, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { cn } from '../../lib/cn'
import { edgePath, r1, type GraphLayout, type GraphModel, type GraphNode } from './graph-core'

/* ============================================================================
   图谱画布（文档图谱与知识图谱共用一份）—— 边层 + 节点层 + 选中/压暗 + 可拖
   ----------------------------------------------------------------------------
   与 `graph-core.ts` 的分工：那边只算几何（谁在哪、有多大），这边只画与收手势。

   类名是接口（两份图谱的 CSS 都在读它）：
      `gnode` / `gdot` / `ghalo` / `g-edge` / `edge-doc` / `edge-task` /
      `node-deg` / `node-label` / `is-center` / `is-dim` / `is-incident` / `is-hub` / `is-orphan`。
      改名前先 grep 两份 CSS —— 文档侧那一段已经写了 `.doc-graph .ghalo` 那一族。
   坐标一律相对 (0,0)、定位交给外层 `<g transform>`（原型 `docGraphNodeInner` /
      `docGraphNodeSvg` 就是这么拆的）：坐标写死在 circle / text 上的话，每帧都在动的那张图
      得每帧重算内部每一个点。
   箭头 marker 的 id 必须每个画布唯一（`useId`）：同一页出现两张图时，同 id 会让
      后一张的 marker 覆盖前一张（而且 SVG 里 id 是全局的，不报错、只是箭头不对）。
   ============================================================================ */

/** 一个节点的外观策略 —— 由宿主给。内核不解释语义：两份图谱的"该实心还是空心"
    完全不同（文档图谱按节点族上色；知识图谱按成熟度实心/空心 + 枢纽外环 + 被引用次数），
    所以颜色与形状必须由调用方决定，内核只负责画。 */
export interface NodeVisual {
  shape?: 'circle' | 'diamond' | 'square'
  fill: string
  stroke: string
  strokeWidth?: number
  /** 虚线描边（知识图谱的"孤点"） */
  dash?: boolean
  /** 外环：给了才画（知识图谱用它标"被引用 ≥3"与黑洞） */
  halo?: { stroke: string; dash?: boolean }
  /** 圆心里的小字（知识图谱读"被引用次数"；文档图谱不写） */
  badge?: string
  /** 那行小字的颜色：实心底与空心底要两种（实心上用卡面色，空心用正文色） */
  badgeInk?: string
}

export type NodeVisualFn = (node: GraphNode, core: boolean, r: number) => NodeVisual

export interface GraphCanvasProps {
  model: GraphModel
  layout: GraphLayout
  /** 选中的那一篇 / 那一个（中心）：加光环、邻居亮、其余压暗 */
  selected: string | null
  /** 压暗判据（宿主给：搜索词 / 透镜）。不给就不压暗任何节点 */
  dimmed?: (key: string) => boolean
  /** 半径策略（两份公式见 `graph-core`） */
  radius: (node: GraphNode, core: boolean) => number
  /** 外观策略（见 `NodeVisual`） */
  nodeVisual: NodeVisualFn
  /** 有向边画箭头（知识图谱有；文档图谱无向） */
  arrows?: boolean
  showLabels?: boolean
  onActivate: (key: string) => void
  /** 点空白处（文档图谱 = 返回总览）。不给则空白不响应 */
  onBlank?: () => void
  /** 给了才可拖。拖动结束回调，宿主决定把偏移存哪儿（原型存 localStorage） */
  onDragEnd?: (key: string, offset: { dx: number; dy: number }) => void
  /** 手工偏移（宿主持有的那份），渲染时叠加在算出来的位置上 */
  offsets?: Record<string, { dx: number; dy: number }>
  ariaLabel: string
}

/** "拖"与"点一下"共用一个手势 ⇒ 靠位移阈值分开（原型同值）。 */
const DRAG_PX = 3

export function GraphCanvas({
  model,
  layout,
  selected,
  dimmed,
  radius,
  nodeVisual,
  arrows = false,
  showLabels = true,
  onActivate,
  onBlank,
  onDragEnd,
  offsets,
  ariaLabel,
}: GraphCanvasProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const svgRef = useRef<SVGSVGElement | null>(null)
  const dragRef = useRef<{ key: string; from: { x: number; y: number }; moved: boolean } | null>(null)
  const [dragOff, setDragOff] = useState<{ dx: number; dy: number } | null>(null)
  const [dragging, setDragging] = useState<string | null>(null)

  const at = (key: string) => {
    const base = layout.pos[key]
    if (!base) return null
    const off = key === dragging && dragOff ? dragOff : offsets?.[key]
    return { x: r1(base.x + (off?.dx ?? 0)), y: r1(base.y + (off?.dy ?? 0)), ring: base.ring }
  }

  /** 屏幕坐标 → SVG 用户坐标（viewBox 有缩放，`createSVGPoint` 是唯一可靠的做法） */
  const toLocal = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return { x: 0, y: 0 }
    const point = svg.createSVGPoint()
    point.x = clientX
    point.y = clientY
    const local = point.matrixTransform(matrix.inverse())
    return { x: local.x, y: local.y }
  }

  const onPointerDown = (key: string) => (event: ReactPointerEvent<SVGGElement>) => {
    if (!onDragEnd) return
    const at0 = toLocal(event.clientX, event.clientY)
    dragRef.current = { key, from: at0, moved: false }
    setDragging(key)
    setDragOff(offsets?.[key] ? { ...offsets[key] } : { dx: 0, dy: 0 })
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    if (!drag) return
    /* 判"拖没拖"要比起点与当前点的距离，不能看单帧增量（一帧只动 1px 很常见） */
    const next = toLocal(event.clientX, event.clientY)
    const dx = next.x - drag.from.x
    const dy = next.y - drag.from.y
    if (Math.abs(dx) + Math.abs(dy) > DRAG_PX) drag.moved = true
    setDragOff({ dx: r1((offsets?.[drag.key]?.dx ?? 0) + dx), dy: r1((offsets?.[drag.key]?.dy ?? 0) + dy) })
  }

  const onPointerUp = () => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.moved && dragOff && onDragEnd) onDragEnd(drag.key, dragOff)
    dragRef.current = null
    setDragging(null)
    setDragOff(null)
  }

  const marker = arrows ? `url(#${uid}-arrow)` : undefined

  return (
    <svg
      ref={svgRef}
      className="doc-graph"
      viewBox={`0 0 ${Math.round(layout.W)} ${Math.round(layout.H)}`}
      role="img"
      aria-label={ariaLabel}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      {arrows ? (
        <defs>
          <marker id={`${uid}-arrow`} viewBox="0 0 8 8" refX={7} refY={4} markerWidth={6} markerHeight={6} orient="auto-start-reverse">
            <path className={cn('arrow-head', selected ? 'accent' : undefined)} d="M0,0 L8,4 L0,8 Z" />
          </marker>
        </defs>
      ) : null}

      {/* 边先画（节点压在上面，端点自然被圆点盖住） */}
      {model.edges.map((edge) => {
        const p1 = at(edge.a)
        const p2 = at(edge.b)
        if (!p1 || !p2) return null
        const incident = selected != null && (edge.a === selected || edge.b === selected)
        return (
          <path
            key={`${edge.a}-${edge.b}`}
            className={cn(
              'g-edge edge',
              edge.dashed ? 'edge-task' : 'edge-doc',
              incident && 'is-incident',
              (dimmed?.(edge.a) || dimmed?.(edge.b)) && 'is-dim',
            )}
            d={edgePath(p1, p2, layout)}
            markerEnd={marker}
          />
        )
      })}

      {/* 点空白处（文档图谱 = 返回总览） */}
      {onBlank ? (
        <rect x={0} y={0} width={layout.W} height={layout.H} fill="transparent" onClick={onBlank} />
      ) : null}

      {Object.keys(layout.pos).map((key) => {
        const node = model.nodes[key]
        const p = at(key)
        if (!node || !p) return null
        const core = key === selected
        const r = radius(node, core)
        const vis = nodeVisual(node, core, r)
        const isDoc = node.family === 'doc'
        const label = node.name.length > 9 ? `${node.name.slice(0, 9)}…` : node.name
        return (
          <g
            key={key}
            className={cn(
              'gnode',
              isDoc && node.family === 'doc' && 'is-doc',
              core && 'is-center',
              dimmed?.(key) && 'is-dim',
              selected != null && !core && Object.prototype.hasOwnProperty.call(model.adj[selected] ?? {}, key) && 'is-incident',
            )}
            transform={`translate(${p.x},${p.y})`}
            role="button"
            tabIndex={0}
            aria-label={node.name}
            onClick={() => {
              /* 刚拖过：松手后浏览器还会补一次 click，必须吃掉它 */
              if (dragRef.current?.moved) return
              onActivate(key)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onActivate(key)
            }}
            onPointerDown={onPointerDown(key)}
          >
            <title>{node.sub ? `${node.name} · ${node.sub}` : node.name}</title>
            {vis.halo ? (
              <circle
                className="ghalo"
                cx={0}
                cy={0}
                r={r1(r + 5)}
                style={{ stroke: vis.halo.stroke, strokeDasharray: vis.halo.dash ? '3 3' : undefined }}
              />
            ) : null}
            {vis.shape === 'diamond' ? (
              <path
                className="gdot"
                d={`M 0 ${-r1(r * 1.2)} L ${r1(r * 1.2)} 0 L 0 ${r1(r * 1.2)} L ${-r1(r * 1.2)} 0 Z`}
                style={{ fill: vis.fill, stroke: vis.stroke, strokeWidth: vis.strokeWidth ?? 1.5, strokeDasharray: vis.dash ? '4 3' : undefined }}
              />
            ) : vis.shape === 'square' ? (
              <rect
                className="gdot"
                x={-r1(r * 0.98)}
                y={-r1(r * 0.98)}
                width={r1(r * 1.96)}
                height={r1(r * 1.96)}
                rx={3}
                style={{ fill: vis.fill, stroke: vis.stroke, strokeWidth: vis.strokeWidth ?? 1.5, strokeDasharray: vis.dash ? '4 3' : undefined }}
              />
            ) : (
              <circle
                className="gdot"
                cx={0}
                cy={0}
                r={r}
                style={{ fill: vis.fill, stroke: vis.stroke, strokeWidth: vis.strokeWidth ?? 1.5, strokeDasharray: vis.dash ? '4 3' : undefined }}
              />
            )}
            {vis.badge ? (
              <text
                className="node-deg"
                x={0}
                y={4}
                textAnchor="middle"
                fontSize={11}
                fontWeight={700}
                style={{ fill: vis.badgeInk ?? 'var(--mw-text-secondary)', pointerEvents: 'none' }}
              >
                {vis.badge}
              </text>
            ) : null}
            {showLabels ? (
              <text
                className="node-label"
                x={0}
                y={r1(r + 15)}
                textAnchor="middle"
                fontSize={11.5}
                fontWeight={500}
                style={{ fill: 'var(--mw-text-primary)', pointerEvents: 'none' }}
              >
                {label}
              </text>
            ) : null}
          </g>
        )
      })}
    </svg>
  )
}
