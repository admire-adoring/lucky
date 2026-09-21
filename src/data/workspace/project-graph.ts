/**
 * 知识图谱的中心辐射布局。
 *
 * 从 `design/project/project_index.html` 原样移植 —— 它是**确定性**的：
 * 同样的节点与边永远算出同样的坐标，没有力学迭代、没有随机数。
 * 所以它可以被当纯函数测、也不会"每次刷新图不一样"。
 *
 * ⚠️ 原注释里的取舍全部保留，那是试错留下的结论，不是解释：
 *   · 标签沿径向往外放，但正上 / 正下的节点要退回居中 —— 那里"外"的方向是竖直的，
 *     横排标签会互相压住。
 *   · 下方那排里，**互相有连线的节点必须彼此相邻**，否则那条边会横穿中间那个节点；
 *     成对的还要留够横向距离，不然两条居中标签叠字。
 *   · 反复试过"力导向 + 调向心力系数"想消掉空洞：那是结构性空洞，
 *     调参只会把它挪到别处，不会消失。
 */

/* 取景框是**固定**的，不是裁出来的 —— "四周均匀的留白"本身就是对称感的一部分；
   裁到内容反而会把形状裁歪。（散点布局相反：那边必须裁到包围盒，否则图会浮在一片空白里。）
   宽度固定，高度按有没有"下方那排"再定 —— 见 return 里的 box。 */
const G_W = 660
const G_CX = 330
const G_CY = 200
const G_R1 = 140
const G_R2 = 236

export interface GraphPoint {
  x: number
  y: number
  /** 极角（弧度）。只对内环 / 外环的节点有值 —— 下方那排没有 */
  ang?: number
}

export interface GraphLayout {
  P: Record<string, GraphPoint>
  hub: string
  adj: Record<string, string[]>
  guide: { cx: number; cy: number; r: number }
  box: { w: number; h: number }
}

export function layoutGraph(ids: string[], links: Array<[string, string]>): GraphLayout {
  const adj: Record<string, string[]> = {}
  ids.forEach((id) => {
    adj[id] = []
  })
  links.forEach(([a, b]) => {
    adj[a]?.push(b)
    adj[b]?.push(a)
  })

  /* 圆心取连接数最高；并列时取顺序在前的 —— 结果必须确定 */
  let hub = ids[0] as string
  ids.forEach((id) => {
    if ((adj[id]?.length ?? 0) > (adj[hub]?.length ?? 0)) hub = id
  })

  const layer: Record<string, number> = { [hub]: 0 }
  const queue = [hub]
  while (queue.length) {
    const cur = queue.shift() as string
    for (const nb of adj[cur] ?? []) {
      if (layer[nb] !== undefined) continue
      layer[nb] = (layer[cur] as number) + 1
      queue.push(nb)
    }
  }

  const ring1 = ids.filter((id) => layer[id] === 1)
  const ring2 = ids.filter((id) => layer[id] === 2 || (layer[id] !== undefined && layer[id] > 1))
  const rest = ids.filter((id) => layer[id] === undefined)

  const P: Record<string, GraphPoint> = { [hub]: { x: G_CX, y: G_CY } }
  ring1.forEach((id, i) => {
    const ang = ((-90 + (360 / ring1.length) * i) * Math.PI) / 180
    P[id] = { x: G_CX + Math.cos(ang) * G_R1, y: G_CY + Math.sin(ang) * G_R1, ang }
  })
  ring2.forEach((id, i) => {
    /* 外环错开半格，免得正好躲在内环节点背后 */
    const ang = ((-90 + (360 / ring2.length) * (i + 0.5)) * Math.PI) / 180
    P[id] = { x: G_CX + Math.cos(ang) * G_R2, y: G_CY + Math.sin(ang) * G_R2, ang }
  })

  const linkedRest = new Set<string>()
  links.forEach(([a, b]) => {
    if (rest.includes(a) && rest.includes(b)) {
      linkedRest.add(a)
      linkedRest.add(b)
    }
  })
  /* 有连线的排在前面 —— 它们要相邻，边才不会横穿中间的节点 */
  const orderedRest = rest.filter((id) => linkedRest.has(id)).concat(rest.filter((id) => !linkedRest.has(id)))
  const restY = G_CY + G_R1 + 58
  let restX = 112
  orderedRest.forEach((id, i) => {
    P[id] = { x: restX, y: restY }
    const near = linkedRest.has(id) && linkedRest.has(orderedRest[i + 1] as string)
    restX += near ? 190 : 200
  })

  return {
    P,
    hub,
    adj,
    guide: { cx: G_CX, cy: G_CY, r: G_R1 },
    box: { w: G_W, h: rest.length ? restY + 66 : G_CY + G_R1 + 100 },
  }
}

/** 无向邻居：出链入链都算 —— 图谱回答的是"谁和谁有关系"，不是"谁指向谁"。 */
export function neighborsOf(id: string, links: Array<[string, string]>): string[] {
  const out: string[] = []
  links.forEach(([a, b]) => {
    if (a === id) out.push(b)
    else if (b === id) out.push(a)
  })
  return out
}

/**
 * 节点半径：圆心那一枚最大，其余按连接数微增（上限 4 个邻居就封顶）。
 * 放在这里而不是组件里 —— 它与布局是一套几何，分开放会各自漂。
 */
export function nodeRadius(isHub: boolean, degree: number): number {
  return isHub ? 30 : 13 + Math.min(degree, 4) * 1.6
}

/**
 * 标签位置与对齐：沿径向往外，正上 / 正下（|cos| ≤ 0.35）退回居中。
 * 判据与布局同源，所以一并放这里。
 */
export function labelPlacement(isHub: boolean, ang: number | undefined, r: number) {
  if (isHub) return { lx: 0, ly: r + 26, anchor: 'middle' as const }
  if (ang === undefined) return { lx: 0, ly: r + 18, anchor: 'middle' as const }
  const c = Math.cos(ang)
  if (c > 0.35) return { lx: r + 10, ly: 4.5, anchor: 'start' as const }
  if (c < -0.35) return { lx: -(r + 10), ly: 4.5, anchor: 'end' as const }
  if (Math.sin(ang) < 0) return { lx: 0, ly: -(r + 12), anchor: 'middle' as const }
  return { lx: 0, ly: r + 18, anchor: 'middle' as const }
}
