/* ============================================================================
   图谱内核（文档图谱与知识图谱共用一份）—— 模型 / 邻接 / 三种布局 / 半径
   ----------------------------------------------------------------------------
   事实源两份，算法同源，所以这里只写一份：
     · `design/project/项目-文档主页-index.html` + `项目-文档详情-index.html`（文档图谱：
       文档 + 任务 / 风险 / 会议四族节点，边靠线型分两族）；
     · `design/know/知识图谱.html`（笔记图谱：单族节点、有向边带箭头、深度 1/2/3）。
   两份的差别落在调用方：节点族与半径策略由宿主给，内核只当几何与拓扑。

   两处半径公式不同，所以它不是常量而是一支函数（`nodeRadiusDeg` 给文档那支，
      知识图谱那支是 `13 + min(deg, 6) * 1.8`，即"入链多的大一点"——两者都写在这里，
      免得下一个人以为哪个是错的）。
   布局一律算出来的（不是力导向漂移）：同一份数据永远得到同一张图 —— 空间记忆
      才立得住。力导向那支也只在"给定确定初值"的前提下跑固定步数（见 `forceLayout`）。
   ============================================================================ */

export const r1 = (v: number) => Math.round(v * 10) / 10

/** 节点族：决定形状。内核只认这几种几何，语义由宿主解释。 */
export type GraphFamily = 'doc' | 'note' | 'task' | 'bug' | 'meeting'

export interface GraphNode {
  key: string
  family: GraphFamily
  name: string
  /** 读数栏 / tooltip 用的一行副标题（各宿主自己给，内核不解释） */
  sub: string
  /** 度数（连了几条边）—— 半径与"谁是枢纽"读它 */
  deg: number
}

export interface GraphEdge {
  a: string
  b: string
  /** 虚线 = 弱边那一族（文档图谱用它分"任务 / 风险 / 会议"） */
  dashed?: boolean
}

export interface GraphModel {
  nodes: Record<string, GraphNode>
  edges: GraphEdge[]
  adj: Record<string, Record<string, true>>
  maxDeg: number
}

export interface GraphPos {
  x: number
  y: number
  /** 圈号：0 = 中心。`null` = 不参与分圈（总览那两列） */
  ring?: number | null
}

export interface GraphLayout {
  pos: Record<string, GraphPos>
  W: number
  H: number
  cx: number
  cy: number
}

/* 一份几何（两份原型同值，所以不再各写一份）。
   `ringGap` / `ringMin` / `arc` 是分圈那支的：外圈半径 = max(内圈 + gap, 该圈节点总弧长 / 2π, min)。 */
export const GRAPH_GEO = {
  padX: 60,
  padY: 44,
  rowH: 56,
  colW: 150,
  colGap: 190,
  ringGap: 96,
  ringMin: 92,
  /** 一个节点横向要占的弧长（按"名字 + 半径"估的，不是随便给的） */
  arc: 78,
  /** 第 1 圈从正上开始 */
  start: -90,
}

/** 由边表建邻接表（无向：两个方向都记）。度数也一并算好。 */
export function buildAdjacency(edges: GraphEdge[]): {
  adj: Record<string, Record<string, true>>
  deg: Record<string, number>
} {
  const adj: Record<string, Record<string, true>> = {}
  const deg: Record<string, number> = {}
  const touch = (k: string) => {
    if (!adj[k]) adj[k] = {}
    if (deg[k] == null) deg[k] = 0
  }
  edges.forEach((e) => {
    touch(e.a); touch(e.b)
    adj[e.a][e.b] = true
    adj[e.b][e.a] = true
  })
  Object.keys(adj).forEach((k) => { deg[k] = Object.keys(adj[k]).length })
  return { adj, deg }
}

/** 节点的"归一化半径"（文档图谱那支）：按度数给 —— 谁是枢纽由点的大小说，不写行尾数字。
    另抽一支是因为三处都要它：画点、碰撞半径、以及"这一圈"的归一。 */
export function nodeRadiusDeg(deg: number, maxDeg: number, core: boolean) {
  return r1(7 + (deg / Math.max(1, maxDeg)) * 8 + (core ? 2 : 0))
}

/** 笔记节点那支：按入链数给（原型 `13 + min(IN, 6) * 1.8`）—— 上限 6 是"再大就不像点了"。 */
export function nodeRadiusInlink(inlink: number, core: boolean) {
  return r1(13 + Math.min(inlink, 6) * 1.8 + (core ? 2 : 0))
}

/** 分圈（BFS，最多 `depth` 跳）。返回按圈分组的 id 表，缺圈的 `undefined`。 */
export function ringsOf(model: GraphModel, centerKey: string, depth: number): (string[] | undefined)[] {
  const dist = new Map<string, number>([[centerKey, 0]])
  let frontier = [centerKey]
  for (let k = 1; k <= depth; k += 1) {
    const next: string[] = []
    frontier.forEach((id) => {
      Object.keys(model.adj[id] ?? {}).forEach((nb) => {
        if (dist.has(nb)) return
        dist.set(nb, k)
        next.push(nb)
      })
    })
    frontier = next
    if (!next.length) break
  }
  const rings: (string[] | undefined)[] = []
  dist.forEach((k, id) => {
    if (!rings[k]) rings[k] = []
    rings[k]!.push(id)
  })
  return rings
}

/**
 * 圈层布局：第 0 圈 = 中心，第 k 圈 = 距中心 k 跳。
 * 外圈半径 = `max(内圈 + ringGap, 该圈节点总弧长 / 2π, ringMin)`；
 * 同圈按数据定序（默认按名字，宿主可给 `sort` —— 知识图谱用"入链多在前"），
 * 偶数圈错开半格（不错开的话会有节点正好落在正下方，与下一圈的节点连成一条竖线）。
 */
export function ringsLayout(
  model: GraphModel,
  centerKey: string,
  depth: number,
  opts?: { sort?: (a: string, b: string) => number },
): GraphLayout {
  const G = GRAPH_GEO
  const rings = ringsOf(model, centerKey, depth)
  const pos: Record<string, GraphPos> = {}
  let prevR = 0
  rings.forEach((ids, k) => {
    if (!ids || !ids.length) return
    if (k === 0) {
      pos[ids[0]] = { x: 0, y: 0, ring: 0 }
      return
    }
    const sorted = opts?.sort ? ids.slice().sort(opts.sort) : ids
    rings[k] = sorted
    const need = (sorted.length * G.arc) / (2 * Math.PI)
    const R = Math.max(prevR + G.ringGap, need, G.ringMin)
    prevR = R
    const step = 360 / sorted.length
    const off = k % 2 === 0 ? step / 2 : 0
    sorted.forEach((id, i) => {
      const a = ((G.start + off + step * i) * Math.PI) / 180
      pos[id] = { x: r1(Math.cos(a) * R), y: r1(Math.sin(a) * R), ring: k }
    })
  })

  /* 取景框按实际坐标定，再把整张图平移到正区间（负坐标会被 viewBox 裁掉） */
  const keys = Object.keys(pos)
  const minX = Math.min(...keys.map((k) => pos[k].x), 0)
  const maxX = Math.max(...keys.map((k) => pos[k].x), 0)
  const minY = Math.min(...keys.map((k) => pos[k].y), 0)
  const maxY = Math.max(...keys.map((k) => pos[k].y), 0)
  const shiftX = -minX + G.padX
  const shiftY = -minY + G.padY
  keys.forEach((k) => {
    pos[k] = { x: r1(pos[k].x + shiftX), y: r1(pos[k].y + shiftY), ring: pos[k].ring }
  })
  return {
    pos,
    W: r1(maxX - minX + G.padX * 2),
    H: r1(maxY - minY + G.padY * 2),
    cx: r1(shiftX),
    cy: r1(shiftY),
  }
}

/** 总览：两列（关联实体 —— 文档），各列在自己的行数里居中。没选中时用它。 */
export function overviewLayout(model: GraphModel): GraphLayout {
  const G = GRAPH_GEO
  const rels = Object.keys(model.nodes).filter((k) => model.nodes[k].family !== 'doc')
  const docs = Object.keys(model.nodes).filter((k) => model.nodes[k].family === 'doc')
  const rows = Math.max(rels.length, docs.length, 1)
  const xRel = G.padX + G.colW / 2
  const xDoc = xRel + G.colW + G.colGap
  const W = xDoc + G.colW / 2 + G.padX
  const H = G.padY * 2 + rows * G.rowH
  const yAt = (i: number, n: number) => G.padY + G.rowH * ((rows - n) / 2 + i + 0.5)
  const pos: Record<string, GraphPos> = {}
  rels.forEach((k, i) => { pos[k] = { x: r1(xRel), y: r1(yAt(i, rels.length)), ring: null } })
  docs.forEach((k, i) => { pos[k] = { x: r1(xDoc), y: r1(yAt(i, docs.length)), ring: null } })
  return { pos, W, H, cx: W / 2, cy: H / 2 }
}

/**
 * 力导向松弛（零依赖、算完即定格）—— 与 d3 那类实现是同一套力（两两斥力 + 有边的相吸 +
 * 向心收拢），三处刻意的不同：
 *   ① 不引 d3：桌面端离线、本仓零额外运行时依赖（原型引 CDN 是"双击即开的单文件"的约束）；
 *   ② 起点确定：先用 `ringsLayout` 分好圈再松弛。力导向常被诟病"每次刷新一张新图"，
 *      根因是随机初值 + 自由迭代，不是力本身 —— 初值定了、步数定了，同一份数据永远同一张图；
 *   ③ 不跑常驻动画、不接拖拽（要"动起来的那一版"由宿主自己叠，见详情屏那支）。
 */
export function forceLayout(
  model: GraphModel,
  centerKey: string,
  depth: number,
  opts?: { len?: number; rep?: number; pull?: number; spring?: number; damp?: number; steps?: number },
): GraphLayout {
  const G = GRAPH_GEO
  const base = ringsLayout(model, centerKey, depth)
  const keys = Object.keys(base.pos)
  const c = { x: base.cx, y: base.cy }
  const P: Record<string, { x: number; y: number }> = {}
  const V: Record<string, { x: number; y: number }> = {}
  keys.forEach((k) => {
    P[k] = { x: base.pos[k].x, y: base.pos[k].y }
    V[k] = { x: 0, y: 0 }
  })

  const LEN = opts?.len ?? 140
  const REP = opts?.rep ?? 20000
  const PULL = opts?.pull ?? 0.012
  const SPRING = opts?.spring ?? 0.02
  const DAMP = opts?.damp ?? 0.82
  const STEPS = opts?.steps ?? 240

  for (let step = 0; step < STEPS; step += 1) {
    keys.forEach((k) => { V[k].x = 0; V[k].y = 0 })
    for (let i = 0; i < keys.length; i += 1) {
      for (let j = i + 1; j < keys.length; j += 1) {
        const a = keys[i] as string
        const b = keys[j] as string
        const dx = P[a].x - P[b].x
        const dy = P[a].y - P[b].y
        /* 30px 以内不再推：两个最大半径的点贴在一起就够了，再推会抖 */
        const d2 = Math.max(dx * dx + dy * dy, 900)
        const d = Math.sqrt(d2)
        const f = REP / d2
        V[a].x += (dx / d) * f; V[a].y += (dy / d) * f
        V[b].x -= (dx / d) * f; V[b].y -= (dy / d) * f
      }
    }
    model.edges.forEach((e) => {
      const pa = P[e.a]
      const pb = P[e.b]
      if (!pa || !pb) return
      const dx = pb.x - pa.x
      const dy = pb.y - pa.y
      const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
      const f = (d - LEN) * SPRING
      V[e.a].x += (dx / d) * f; V[e.a].y += (dy / d) * f
      V[e.b].x -= (dx / d) * f; V[e.b].y -= (dy / d) * f
    })
    keys.forEach((k) => {
      if (k === centerKey) return /* 中心钉死 */
      V[k].x += (c.x - P[k].x) * PULL
      V[k].y += (c.y - P[k].y) * PULL
      P[k].x += V[k].x * DAMP
      P[k].y += V[k].y * DAMP
    })
  }

  /* 松弛之后位置离开了"分圈的圆"，取景框要跟着重算 —— 否则图会被裁 */
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  keys.forEach((k) => {
    minX = Math.min(minX, P[k].x); maxX = Math.max(maxX, P[k].x)
    minY = Math.min(minY, P[k].y); maxY = Math.max(maxY, P[k].y)
  })
  const pos: Record<string, GraphPos> = {}
  keys.forEach((k) => {
    pos[k] = {
      x: r1(P[k].x - minX + G.padX),
      y: r1(P[k].y - minY + G.padY),
      /* 圈号留着：同圈的两点画成内凹的弧 */
      ring: base.pos[k].ring,
    }
  })
  return {
    pos,
    W: r1(maxX - minX + G.padX * 2),
    H: r1(maxY - minY + G.padY * 2),
    cx: r1(c.x - minX + G.padX),
    cy: r1(c.y - minY + G.padY),
  }
}

/**
 * 一条边的 `d`。同圈的两点画成朝圆心内凹的弧 —— 直线会横穿圆心；
 * 跨圈的直接连，它们本就沿半径方向。
 */
export function edgePath(p1: GraphPos, p2: GraphPos, layout: GraphLayout): string {
  const sameRing = p1.ring != null && p1.ring === p2.ring
  if (!sameRing) return `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`
  const ctrlX = r1(layout.cx + ((p1.x + p2.x) / 2 - layout.cx) * 0.55)
  const ctrlY = r1(layout.cy + ((p1.y + p2.y) / 2 - layout.cy) * 0.55)
  return `M ${p1.x} ${p1.y} Q ${ctrlX} ${ctrlY} ${p2.x} ${p2.y}`
}

/** 只保留以 `centerKey` 为中心的一跳子图（详情屏那张用它：邻居的邻居画进来不是"信息少"，
    是错的 —— 它们与中心之间没有边，读者会以为它们跟这一篇有关）。 */
export function oneHop(model: GraphModel, centerKey: string): { keys: string[]; edges: GraphEdge[]; maxDeg: number } {
  const keep: Record<string, true> = { [centerKey]: true }
  Object.keys(model.adj[centerKey] ?? {}).forEach((k) => { keep[k] = true })
  const keys = Object.keys(model.nodes).filter((k) => keep[k])
  const edges = model.edges.filter((e) => keep[e.a] && keep[e.b])
  return { keys, edges, maxDeg: Math.max(1, ...keys.map((k) => model.nodes[k].deg)) }
}
