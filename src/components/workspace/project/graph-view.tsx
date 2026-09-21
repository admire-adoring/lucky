import { cn } from '../../../lib/cn'
import { layoutGraph, labelPlacement, neighborsOf, nodeRadius } from '../../../data/workspace/project-graph'
import type { ProjectApi } from './api'
import { NeighborList } from './content-views'

/**
 * 知识图谱。
 *
 * 三块内容各解决一个问题，缺一块这个视图就不成立：
 *   · **图**看清形状（谁是中心、谁离得远）；
 *   · **节点清单**看清"谁没连上"—— 图恰恰看不出这件事，它只会画出一堆散点；
 *   · **节点详情**回答"这一个到底连了谁"，并给"打开"的入口。
 *
 * ⚠️ 布局是**纯函数**（`layoutGraph`），所以每次渲染坐标都一样 ——
 * "每次刷新图不一样"这类问题在这里从根上不存在，不需要缓存也不能缓存错。
 */

export function GraphPanel({ api }: { api: ProjectApi }) {
  const ids = api.docs.map((d) => d.id).concat(api.notes.map((n) => n.id))
  const links: Array<[string, string]> = api.edges
    .filter((e) => ids.includes(e.a) && ids.includes(e.b))
    .map((e) => [e.a, e.b])

  const { P, hub, box, guide } = layoutGraph(ids, links)
  const selected = api.selectedNode
  const near = selected ? new Set([selected, ...neighborsOf(selected, links)]) : null
  const orphans = ids.filter((id) => neighborsOf(id, links).length === 0)

  const edges = links.map(([a, b]) => {
    const A = P[a]
    const B = P[b]
    if (!A || !B) return null
    const act = selected !== null && (a === selected || b === selected)
    const dim = selected !== null && !act
    return (
      <path
        key={`${a}-${b}`}
        className={cn('edge', act && 'is-active', dim && 'is-dim')}
        d={`M ${A.x.toFixed(1)} ${A.y.toFixed(1)} L ${B.x.toFixed(1)} ${B.y.toFixed(1)}`}
      />
    )
  })

  const nodes = ids.map((id) => {
    const point = P[id]
    if (!point) return null
    const isHub = id === hub
    const isDoc = api.nodeKind(id) === 'doc'
    const degree = neighborsOf(id, links).length
    const full = api.nodeLabel(id)
    const short = full.length > 12 ? `${full.slice(0, 11)}…` : full
    const r = nodeRadius(isHub, degree)
    const { lx, ly, anchor } = labelPlacement(isHub, point.ang, r)

    return (
      <g
        key={id}
        className={cn(
          'gnode',
          isDoc && 'is-doc',
          isHub && 'is-hub',
          selected === id && 'is-sel',
          selected !== null && near && !near.has(id) && 'is-dim',
          degree === 0 && 'is-orphan',
        )}
        transform={`translate(${point.x.toFixed(1)},${point.y.toFixed(1)})`}
        tabIndex={0}
        role="button"
        aria-label={full}
        onClick={() => api.selectNode(id)}
        onKeyDown={(event) => {
          if (event.key !== ' ' && event.key !== 'Enter') return
          event.preventDefault()
          api.selectNode(id)
        }}
      >
        {isDoc ? (
          <rect className="shape" x={-r} y={-r} width={r * 2} height={r * 2} rx={r * 0.4} />
        ) : (
          <circle className="shape" r={r} />
        )}
        <text className="gnode-deg" x={0} y={r * 0.19} textAnchor="middle">
          {degree}
        </text>
        <text className="gnode-label" x={lx} y={ly} textAnchor={anchor}>
          {short}
        </text>
      </g>
    )
  })

  /* 清单按连接数降序：图示形，清单示量 —— 两头都要有，才既看得出形状又数得清 */
  const rows = ids
    .slice()
    .sort((a, b) => neighborsOf(b, links).length - neighborsOf(a, links).length)
    .map((id) => {
      const degree = neighborsOf(id, links).length
      const isDoc = api.nodeKind(id) === 'doc'
      return (
        <div
          key={id}
          className={cn('gnode-row', isDoc && 'is-doc', degree === 0 && 'is-orphan', selected === id && 'is-sel')}
          role="button"
          tabIndex={0}
          onClick={() => api.selectNode(id)}
          onKeyDown={(event) => {
            if (event.key !== ' ' && event.key !== 'Enter') return
            event.preventDefault()
            api.selectNode(id)
          }}
        >
          <span className="gnode-row-dot" />
          <span className="gnode-row-name">{api.nodeLabel(id)}</span>
          {degree === 0 ? <span className="graph-orphan-tag">未连线</span> : null}
          <span className="gnode-row-kind">{isDoc ? '文档' : '笔记'}</span>
          <span className="gnode-row-deg">{degree}</span>
        </div>
      )
    })

  return (
    <>
      <section className="card">
        <div className="ov-card-head">
          <div className="card-title">知识图谱</div>
          <div className="ov-pos">
            {ids.length} 个节点 · {links.length} 条连线 · {orphans.length} 个未连线
          </div>
          <div className="graph-legend">
            <span className="lg-item">
              <i className="lg-dot lg-doc" />
              文档
            </span>
            <span className="lg-item">
              <i className="lg-dot lg-note" />
              笔记
            </span>
            <span className="lg-item">
              <i className="lg-dot lg-orphan" />
              未连线
            </span>
          </div>
        </div>
        <svg className="graph-svg" viewBox={`0 0 ${box.w} ${box.h}`} role="img" aria-label="知识图谱">
          {/* 内环参考圈：让"第 1 层在哪"这件事有个可见的底 */}
          <circle className="guide" cx={guide.cx} cy={guide.cy} r={guide.r} />
          {edges}
          {nodes}
        </svg>
      </section>

      <section className="doc-body-grid">
        <div className="card">
          <div className="ov-card-head">
            <div className="card-title">节点清单</div>
            <div className="ov-pos">按连接数排 · 孤立节点一眼可见</div>
          </div>
          {rows}
        </div>

        <div className="card">
          <div className="card-title">节点详情</div>
          {selected === null ? (
            <div className="q-empty">点一个节点或一行清单，看它连了哪些东西</div>
          ) : (
            <>
              <div className="gsel-head">
                <span className={cn('pill', api.nodeKind(selected) === 'doc' ? 'pill-doing' : 'pill-todo')}>
                  {api.nodeKind(selected) === 'doc' ? '文档' : '笔记'}
                </span>
                <span className="ov-pos">{api.neighbors(selected).length} 条连线</span>
              </div>
              <div className="gsel-title">{api.nodeLabel(selected)}</div>
              <button
                className="btn btn-ghost"
                style={{ marginTop: 12 }}
                onClick={() =>
                  api.nodeKind(selected) === 'doc' ? api.openDoc(selected) : api.openNote(selected)
                }
              >
                打开
              </button>
              <div className="aside-divider" />
              <div className="card-title">关系</div>
              <NeighborList api={api} id={selected} mode="select" />
            </>
          )}
        </div>
      </section>
    </>
  )
}
