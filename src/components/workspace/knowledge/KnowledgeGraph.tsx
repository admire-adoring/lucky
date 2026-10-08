import { useMemo, useState } from 'react'
import { cn } from '../../../lib/cn'
import {
  NOTE_BY_ID,
  NOTE_IN,
  NOTE_LINKS,
  NOTE_MENTIONS,
  NOTE_OUT,
  NOTE_STAGE_TEXT,
  NOTES,
  isNoteBlackhole,
  isNoteOrphan,
  noteGroupOf,
  noteStageOf,
} from '../../../data/workspace/know-notes'
import { GraphCanvas, type NodeVisualFn } from '../../graph/GraphCanvas'
import {
  buildAdjacency,
  forceLayout,
  nodeRadiusInlink,
  ringsLayout,
  type GraphEdge,
  type GraphLayout,
  type GraphModel,
} from '../../graph/graph-core'

/* ============================================================================
   知识库 · 双链图谱（`design/know/知识图谱.html`）
   ----------------------------------------------------------------------------
   这一页读的是笔记（有正文、有双链），不是一个"只存索引"的文档库，所以它与文档图谱
   共用 `components/graph/*` 那套内核（几何 / 布局 / 画布），差别只在三处策略：

     · 半径按并入链数（`nodeRadiusInlink`）：被引用越多越大；
     · 外观按成熟度实心 / 空心 + 枢纽外环 + 圆心写被引用次数（`nodeVisual`）；
     · 边有方向（箭头 = 双链方向）。

   本轮的取舍（原型里还有几块，留到下一步）：全库统计 / 孤立·黑洞两类巡检 / 画布缩放平移、
   导入与命令面板 / 搜索框（压暗的谓词已经就位，缺的只是那个输入框与它绑的词）。
   「透镜」与图例已按原型给全，因为它们是图谱本身的一部分（不是另一个视图）。

   成熟度不是分区：同一条笔记会跨层，做成三个分区就违反"互斥"。判据是"有入链 ⇒ 生产层，
      没有 ⇒ 加工层"（`noteStageOf`），与原型同一句注释。
   `stage: 'record'`（还在收件箱那 5 条）不进图谱 —— 原型就是这么划的。
   ============================================================================ */

/** 模型在模块级建一次：数据是常量，重建没有意义（也免得每次渲染换引用让布局重算）。 */
const MODEL: GraphModel = (() => {
  const nodes: GraphModel['nodes'] = {}
  NOTES.forEach((n) => {
    const touching = new Set([...NOTE_OUT[n.id], ...NOTE_IN[n.id]])
    nodes[n.id] = {
      key: n.id,
      family: 'note',
      name: n.title,
      sub: `${n.topic} · ${NOTE_STAGE_TEXT[noteStageOf(n.id)]}层 · ${n.date}`,
      deg: touching.size,
    }
  })
  const edges: GraphEdge[] = NOTE_LINKS.map(([a, b]) => ({ a, b }))
  const { adj } = buildAdjacency(edges)
  const maxDeg = Math.max(1, ...Object.keys(nodes).map((k) => nodes[k].deg))
  return { nodes, edges, adj, maxDeg }
})()

/** 默认中心（原型 `CENTER0`）：个人系统 —— 它是这张网的枢纽，打开就看到结构。 */
const CENTER0 = 'n01'

type Lens = 'all' | 'orphan' | 'blackhole'
type LayoutMode = 'ring' | 'force'

/** 一个控制组：标签 + 分段按钮（用应用既有的 `.seg` / `.seg-btn`，原型那边是自己一套 chip）。 */
function Seg<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="kg-group">
      <span className="kg-label">{label}</span>
      <div className="seg">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            className={cn('seg-btn', value === o.value && 'active')}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export function KnowledgeGraph({ notice }: { notice: (text: string) => void }) {
  const [center, setCenter] = useState(CENTER0)
  const [depth, setDepth] = useState(2)
  const [mode, setMode] = useState<LayoutMode>('ring')
  const [labels, setLabels] = useState(true)
  const [lens, setLens] = useState<Lens>('all')
  /** 手工摆放（拖动只记偏移，不改变"按跳数算出来的位置"）。原型把这份存 localStorage。 */
  const [offsets, setOffsets] = useState<Record<string, { dx: number; dy: number }>>({})

  const layout: GraphLayout = useMemo(() => {
    if (mode === 'force') return forceLayout(MODEL, center, depth)
    /* 同圈顺序按数据定（入链多在前、同数按标题）—— 不按渲染顺序、不按哈希 */
    return ringsLayout(MODEL, center, depth, {
      sort: (a, b) => NOTE_IN[b].length - NOTE_IN[a].length || (NOTE_BY_ID[a].title < NOTE_BY_ID[b].title ? -1 : 1),
    })
  }, [center, depth, mode])

  /** 透镜：只影响显示（压暗不相干的），不改布局 —— 位置一动，记忆就废了。 */
  const dimmed = (key: string) => {
    if (lens === 'all') return false
    return !(lens === 'orphan' ? isNoteOrphan(key) : isNoteBlackhole(key))
  }

  const radius = (node: { key: string }, core: boolean) => nodeRadiusInlink(NOTE_IN[node.key].length, core)

  const nodeVisual: NodeVisualFn = (node, core) => {
    const inlink = NOTE_IN[node.key].length
    const produce = noteStageOf(node.key) === 'produce'
    const hole = isNoteBlackhole(node.key)
    return {
      /* 实心 = 生产层（已被引用）、空心 = 加工层（0 入链）—— 与图例逐条对应 */
      fill: produce ? 'var(--mw-m-main)' : 'var(--mw-bg-card)',
      stroke: produce ? '#fff' : 'var(--mw-text-muted)',
      strokeWidth: core ? 3 : 1.5,
      /* 孤点用虚线描边说"它谁也不连" */
      dash: isNoteOrphan(node.key),
      /* 外环 = 被引用 ≥3（枢纽）；黑洞那条换成暖色虚线环 */
      halo: hole
        ? { stroke: 'var(--kg-warn)', dash: true }
        : inlink >= 3
          ? { stroke: 'var(--mw-m-main)' }
          : undefined,
      badge: inlink ? String(inlink) : undefined,
      badgeInk: produce ? 'var(--mw-bg-card)' : 'var(--mw-text-secondary)',
    }
  }

  const note = NOTE_BY_ID[center]
  const out = NOTE_OUT[center] ?? []
  const back = NOTE_IN[center] ?? []
  const mentions = NOTE_MENTIONS[center] ?? []

  return (
    <section className="card kg-page">
      <div className="card-head">
        <div className="card-head-left">
          <div className="card-title">双链图谱</div>
          <span className="card-count">{Object.keys(MODEL.nodes).length} 篇</span>
        </div>
        <span className="kg-state">
          {noteGroupOf(center) ? `${NOTE_BY_ID[center].topic} · ${NOTE_STAGE_TEXT[noteStageOf(center)]}层` : ''}
        </span>
      </div>

      <div className="kg-toolbar">
        <Seg
          label="布局"
          value={mode}
          onChange={setMode}
          options={[{ value: 'ring', label: '圈层' }, { value: 'force', label: '力导向' }]}
        />
        <Seg
          label="深度"
          value={String(depth)}
          onChange={(v) => setDepth(Number(v))}
          options={[{ value: '1', label: '1 跳' }, { value: '2', label: '2 跳' }, { value: '3', label: '3 跳' }]}
        />
        <Seg
          label="标签"
          value={labels ? 'on' : 'off'}
          onChange={(v) => setLabels(v === 'on')}
          options={[{ value: 'on', label: '显示' }, { value: 'off', label: '隐藏' }]}
        />
        <Seg
          label="透镜"
          value={lens}
          onChange={setLens}
          options={[{ value: 'all', label: '全部' }, { value: 'orphan', label: '孤点' }, { value: 'blackhole', label: '黑洞' }]}
        />
      </div>

      <div className="doc-graph-wrap">
        <div className="doc-graph-canvas">
          {/* 画布内状态条：说清"现在看的中心是谁"，并给一个显式的出口（原型同） */}
          <div className="graph-status">
            以
            <b>{note.title}</b>
            为中心 · {depth} 跳
            {Object.keys(offsets).length ? (
              <button type="button" className="kg-mini" onClick={() => setOffsets({})}>
                复位布局
              </button>
            ) : null}
          </div>

          <GraphCanvas
            model={MODEL}
            layout={layout}
            selected={center}
            dimmed={dimmed}
            radius={radius}
            nodeVisual={nodeVisual}
            arrows
            showLabels={labels}
            offsets={offsets}
            onActivate={(key) => {
              /* 点节点 = 换中心（不是"打开这一篇"）—— 探索与跳转不共用一个手势 */
              if (key === center) return
              setCenter(key)
            }}
            onDragEnd={(key, offset) => setOffsets((prev) => ({ ...prev, [key]: offset }))}
            ariaLabel={`以「${note.title}」为中心的图谱`}
          />

          <div className="doc-graph-legend">
            <span><i className="lg-dot lg-center" />中心（当前选中）</span>
            <span><i className="lg-dot lg-produce" />生产层 · 已被引用</span>
            <span><i className="lg-dot lg-process" />加工层 · 0 入链</span>
            <span><i className="lg-dot lg-orphan" />孤点（虚线）</span>
            <span><i className="lg-dot lg-hub" />外环 = 被引用 ≥3（黑洞为暖色虚线环）</span>
            <span>圈内数字 = 被引用次数 · 箭头 = 双链方向</span>
          </div>
        </div>

        {/* 右栏：这一篇的读数（出链 / 反链 / 未链接提及）。
            与文档图谱的右栏同族类名（`.doc-relp` / `.relp-*`）—— 两处的差别只有内容。 */}
        <aside className="doc-relp kg-detail">
          <div className="relp-head">
            <div className="relp-head-main">
              <div className="relp-title">{note.title}</div>
              <div className="relp-sub">
                {note.topic} · {NOTE_STAGE_TEXT[noteStageOf(center)]}层 · {note.date}
              </div>
            </div>
          </div>

          <div className="relp-sec">
            <div className="relp-sec-title">这一篇</div>
            <div className="kg-detail-text">{note.body}</div>
          </div>

          <div className="relp-sec">
            <div className="relp-sec-title">
              链出去
              <span className="relp-count">{out.length}</span>
            </div>
            <div className="relp-list">
              {out.length ? out.map((id) => (
                <button key={id} type="button" className="relp-item" onClick={() => setCenter(id)}>
                  <span className="rel-kind">出</span>
                  <span className="relp-item-name">{NOTE_BY_ID[id].title}</span>
                  <div className="relp-item-meta">{NOTE_BY_ID[id].topic}</div>
                </button>
              )) : <div className="relp-empty">还没链出去 —— 写完一段就顺手挂一条。</div>}
            </div>
          </div>

          <div className="relp-sec">
            <div className="relp-sec-title">
              被链进来
              <span className="relp-count">{back.length}</span>
            </div>
            <div className="relp-list">
              {back.length ? back.map((id) => (
                <button key={id} type="button" className="relp-item" onClick={() => setCenter(id)}>
                  <span className="rel-kind">入</span>
                  <span className="relp-item-name">{NOTE_BY_ID[id].title}</span>
                  <div className="relp-item-meta">{NOTE_BY_ID[id].topic}</div>
                </button>
              )) : <div className="relp-empty">还没有别的笔记链到它。</div>}
            </div>
          </div>

          {mentions.length ? (
            <div className="relp-sec">
              <div className="relp-sec-title">
                提到但没建链
                <span className="relp-count">{mentions.length}</span>
              </div>
              <div className="relp-list">
                {mentions.map((m) => (
                  <div key={m.id} className="kg-mention">
                    <span className="relp-item-name">{NOTE_BY_ID[m.id]?.title ?? m.id}</span>
                    <div className="relp-item-meta">{m.context}</div>
                  </div>
                ))}
              </div>
              <div className="kg-note">
                这一条是「未链接提及」，不是双链 —— 本仓只存索引与链接，没有正文可解析，所以由数据直接给。
              </div>
            </div>
          ) : null}

          <button type="button" className="btn btn-ghost relp-open" onClick={() => notice(`打开笔记：${note.title}`)}>
            打开这一篇
          </button>
        </aside>
      </div>
    </section>
  )
}
