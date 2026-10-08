import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { DOC_KINDS, DOC_KIND_LABEL } from '../../../data/content-pool'
import { cn } from '../../../lib/cn'
import { Icon } from '../../icons/Icon'
import { DocBook } from './DocBook'
import { useSourceOverlay } from './doc-source/use-source-overlay'
import { copyAgoText, copyOf, useDocCopies } from '../../../data/workspace/doc-copies'
import type { DocKind, DocLink, DocumentItem } from '../../../types'

/* ============================================================================
   文档 · 项目详情「文档」分区（v2：筛选栏 + 工具栏 + 三视图 + 主从详情）
   事实源：`design/project/项目-文档主页-index.html`（2026-09-27 换版，同日静态化）
   ----------------------------------------------------------------------------
   它替掉的是上一版（2026-09-25，落地自 `design/work/work_project_detail_document.html`）
   的「一条子类栏 + 书墙/列表两视图 + 详情弹窗」。换版的四件事：

     ① 两级目录：左栏是「模块 → 功能」—— 模块那层永远可见（数量可控），
        功能那层只在所属模块被选中时展开。判据：一维"会长"时，先问它上面有没有
        一个天然的分组 —— 折叠只把长列表压短，"先选模块再看功能"是把长列表切开。
     ② 三个视图：书墙（一眼看见几本、各什么颜色）／列表（要读来源 / 作者 / 时间的密排）／
        图谱（"谁连着谁"是前两者都没有的一种读法）。时间线不做 —— 它与列表同数据同顺序。
     ③ 主从详情屏（不是弹窗）：原型的宿主本来就是"主页 ⇄ 详情"两屏；落地到应用里
        也照这一套（弹窗装不下"关联 / 被引用 / 同一功能下其他篇"那几张卡）。
       ④ 关联（边）成为一等数据：`DocumentItem.links`（出边）+ `DocumentItem.back`（反链，算出来的）。
        图谱与详情屏读的都是它；不做"真双链"（那要从正文解析 `[[ ]]`，而本仓只存索引）。

   五处与原型有意不同（都是"静态页 → 应用"必然要改的，不是审美）：

   ① 状态在组件里，不在全局。原型的 `docQuery / docModuleFilter / …` 是页面级变量；
      这里用 `useState`。刻意没有存进 `ui-store`：那是"用户偏好"的住处（排序方式这种
      跨页面要保持的东西），而"我现在筛的是哪个模块"是一次浏览的位置，离开就该重置。
   ② 模块 / 功能失效时按 `'all'` 算，不写回 state：文档的 `module` / `func` 是内容数据，
      换个项目可能一个都不剩（类型 / 来源是固定枚举，没这个问题）。原型是在渲染开头
      `docModuleFilter = 'all'` 硬复位 —— 在 React 里那等于"渲染期改 state"（会二次渲染），
      所以改成派生时归一化：`normModule / normFunc`。
   ③ 图谱用 JSX 画（原型是拼 SVG 字符串）：`<circle>` / `<path>` / `<text>` 各归其位，
      不需要在字符串里逃 `<>`，坐标也仍然是算出来的（见 `layoutOverview` / `layoutRadial`）。
   ④ `<select>` 与搜索框是受控的（原型是"静态 DOM + 手动回写 value"）——
      那是为"每敲一个字重建 innerHTML 会掉光标"打的补丁，React 里这问题不存在。
   ⑤ 新建文档保留（原型那一版是 `data-demo` 假按钮）：上一版就有一个真表单弹窗，
      换版不该把它弄丢。表单本身不落任何地方 —— 没有写接口，给"保存成功"的假回执
      比不给按钮更糟（见「动作的诚实性」）。

   ============================================================================
   详情屏换版（2026-09-28，原型 `design/project/项目-文档详情-index.html` v3.4）
  ============================================================================
   上一版详情屏是「文档头（prose + callout）+ 连出去 / 连进来两张并排卡 +
   同一功能下的其他篇」三张平铺白卡。两处说不通：黄金位置给了免责声明
   （"正文留在原工具里"讲了两遍），而文档真正的信息（它在项目里的坐标）只挤在一行
   meta 里。新版把这一屏定义成一本书 + 它的坐标 + 它的边 + 它的同类：

     · 块一 `.dd-hero`：左边把那本书摆出来（复用 `DocBook`、放大一档、不可点 ——
       它是当前对象、不是一扇门），右边标题 + 一行陈述 + 横排四项坐标；
       「位置」里的模块 / 功能可点（点了回主页并筛上它），落的是与侧栏 facet 同两个变量；
     · 块二 `.dd-rel`：关联换成以这一篇为中心的图 + 右边读数栏（与主页那张同一套）；
     · 块三「同一功能下还有」：横向小书，点了直接换一篇。

   四处与原型的有意偏离（都是落地才出现的，不是审美）：

   ① 力导向不引 d3。原型 v3.4 按用户点名用了 d3（CDN，`defer` 引，另有零依赖降级路
      `docForceLayout`）。应用里走自带的那条：本仓至今零额外运行时依赖、且桌面端离线，
      为一张图引一个包不划算（本轮试装也被环境策略拦下了）。用户点名要的三件事都保留：
      随机初值（中心钉在正中、其余按随机角度 + 随机半径撒开）、自由迭代
      （rAF 逐帧推进，力参数照原型：斥力 / 弹簧 / 向心 / 阻尼 + 碰撞）、可拖
      （按下-移动-松开，与"点一下 = 换到那一篇"靠位移阈值 3px 分开）。只有 d3 的
      现成 `drag` 换成了原生 pointer 事件。
   ② 图谱的半径公式换回原型的归一式：`7 + deg / maxDeg * 8 + (core ? 2 : 0)`。
      此前这里是 `7 + Math.min(deg, 8) + (core ? 2 : 0)`（截断式），与原型对不上 ——
      而原型两条路（力导向 / 静态）共用同一个函数，正是为了让同一批节点不因走哪条路
      长得不一样。主页那张图也一并用它（两处一个函数）。
   ③ 详情图不常驻动画：收敛（alpha < 0.02）即停，且 `openId` 一变 / 组件卸载就
      `cancelAnimationFrame`。桌面端不该有一张永远在动的图。
   ④ 「同一功能下还有」那颗 `.card-more` 是 `<span role="button">`（不是 `<button>`）：
      与 `ProjectDetail.tsx` 里那一颗同款 —— 这条样式族是给 span 的，换标签会带出原生外观。

   传参约定：详情屏只认 `DocumentItem`（`module` / `func` / `links` / `back` 四个字段
   早在文档主页那一版就加上了）。

  书（`.doc-book`）统一成精装封面（2026-09-27，用户给了封面截图）：
      概览 / 书墙 / 紧凑档 / 运维四处共用 `./DocBook.tsx` 那一个组件，
      尺寸只由各自的 CSS 档覆盖四个值（`--bk-*`）。此前"概览与书墙用简版三行"那条
      有意不同作废 —— 同一批数据在两处长得不一样才是错的。

   ============================================================================
   动作的诚实性（沿用上一版那一条，逐条保留）
   ============================================================================
    删除 / 复制链接 / 下载都没有写接口，`DocumentItem` 上也没有 `url` —— 所以它们
    各自回一句说得清"为什么不行"的话（"地址留在来源工具里，索引没有存"），
    而不是弹一个"已删除 / 已下载"的假成功。「打开原文」不在此列：它进应用内的原文页。

   样式在 `styles/module-workspace.css` 的「项目详情 · 文档」段，作用域是
      `.mw-root[data-module] .proj-detail …`（不带模块值）—— 这一页同时挂在项目模块
      与工作模块下，写成具体模块名会有一份全裸且零报错。
      而且必须落在 `.proj-detail` 下：`.doc-item` / `.doc-name` / `.doc-meta` / `.doc-info`
         这几个类在模块级（`[data-module='work']` 那三段）另有一套"带边框的文件行"版式，
         服务的是工作 / 学习 / 项目三个模块的「文件清单」（`ClientsContacts.tsx` 那类）。
         两条并存、互不覆盖，靠作用域分家。
   ============================================================================ */

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

/** 只有两种排法（原型同）：理由在结果里 —— 「按类型」与书墙的分架重复，已经有一处分组了。 */
type SortKey = 'updated' | 'name'

/** 三个视图。判据见文件头 ②。 */
type ViewKey = 'shelf' | 'list' | 'graph'

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'updated', label: '最近更新' },
  { value: 'name', label: '按名称' },
]

const VIEW_OPTIONS: { value: ViewKey; label: string }[] = [
  { value: 'shelf', label: '书墙' },
  { value: 'list', label: '列表' },
  { value: 'graph', label: '图谱' },
]

/**
 * 7 类的顺序写死（不按"哪类多"排）：它是目录，位置稳定才找得到。
 */
const DOC_KIND_ORDER: DocKind[] = ['plan', 'design', 'api', 'test', 'spec', 'research', 'ref']

/** 关联的类型（边上那个词）。与 `DocLinkKind` 一一对应，不在别处再写一份。 */
const DOC_LINK_LABEL: Record<DocLink['kind'], string> = {
  out: '产出',
  risk: '风险',
  meet: '会议',
  bind: '约定',
  ref: '参考',
}

/** 关联目标那一族的名字（图谱节点与读数栏的"族 · 读数"用它） */
const DOC_REL_FAMILY: Record<DocLink['family'], string> = {
  task: '任务',
  bug: '风险',
  meeting: '会议',
  doc: '文档',
}

/* ------------------------------------------------------------------ *
 * 搜索命中高亮
 * ------------------------------------------------------------------ */

/**
 * 把一段文本按关键词切成「普通 / 命中 / 普通…」，命中那段套 `<mark>`。
 *
 * 不用 `dangerouslySetInnerHTML`：原型的 `highlight()` 是拼字符串再 `innerHTML`，
 *    照搬就等于把用户输入（搜索框）当 HTML 注入。这里返回的是 React 节点数组，
 *    转义由 React 负责 —— 关键词里带 `<` 也只是普通文本。
 */
function highlight(text: string, keyword: string): ReactNode {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return text

  const haystack = text.toLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  let at = haystack.indexOf(needle, from)
  while (at >= 0) {
    if (at > from) parts.push(text.slice(from, at))
    parts.push(
      <mark key={parts.length} className="hl">
        {text.slice(at, at + needle.length)}
      </mark>,
    )
    from = at + needle.length
    at = haystack.indexOf(needle, from)
  }
  if (!parts.length) return text
  if (from < text.length) parts.push(text.slice(from))
  return parts
}

/* ------------------------------------------------------------------ *
 * 图谱 · 模型与布局
 * ------------------------------------------------------------------ *
 * 两种布局，同一个问题问了两次：
 *   · 没选 = 「这一批长什么样」→ 两列总览（关联实体 —— 文档）
 *   · 选了 = 「这一篇连着谁」  → 以它为中心，按跳数分圈（0 圈中心 / 1 圈直接邻居 / 2 圈更远）
 * 两种都是算出来的：同列均分行距、同圈均分角度、圈半径 = max(上一圈 + 圈距,
 * 这一圈节点数 × 弧长预算 ÷ 2π)。⇒ 同一份数据永远得到同一张图，不会有"中间空、四周贴边"。
 * 代价是选中会重排 —— 但重排可预测（同圈按数据顺序），不是漂移。
 *
 * 属性（类型 / 来源）不进图：它们在封面小签与左栏 facet 里已经各说过一次，
 *    而且属性不是关系 —— 那是把字段画成线。图只画它唯一能说的事：谁连着谁。
 * 两件事各用一条通道：线型分边的两族（实线 = 文档之间、虚线 = 挂到任务/风险/会议）、
 *    实心/空心 + 形状分节点种类（实心圆 = 文档、空心圆/菱形/方 = 任务/风险/会议）——
 *    颜色因此只剩"文档的类型"一件事（与书脊共用同一张色表）。
 * 不做拖动、不做缩放：位置既然由语义定，拖动只会把可读的圈层拖乱。
 */

const GRAPH_GEO = {
  padX: 96,
  padY: 74,
  colW: 150,
  colGap: 64,
  rowH: 54,
  minR: 116,
  gapR: 122,
  spacing: 158,
}

/** 边。一对节点只留一条（`bind` 是双向写的，两条重合的线 = 一份数据说两遍）。 */
interface GraphEdge {
  a: string
  b: string
  dashed: boolean
}

interface GraphNode {
  key: string
  /** 文档节点带 `doc`，关联实体节点带 `link` */
  doc?: DocumentItem
  link?: DocLink
  family: DocLink['family']
  name: string
  sub: string
  deg: number
}

interface GraphModel {
  nodes: Record<string, GraphNode>
  adj: Record<string, Record<string, 1>>
  edges: GraphEdge[]
  maxDeg: number
}

interface GraphPos {
  x: number
  y: number
  ring: number | null
}

interface GraphLayout {
  pos: Record<string, GraphPos>
  W: number
  H: number
  cx: number
  cy: number
}

const docKeyOf = (doc: DocumentItem) => `doc:${doc.id}`

/** 一条边的目标节点 key（文档带 `doc:` 前缀，其余带族前缀，避免两族 id 撞车）。 */
const linkKeyOf = (link: DocLink) => `${link.family === 'doc' ? 'doc' : link.family}:${link.id}`

/**
 * 图的模型：这一批文档 + 它们挂到的关联实体 + 邻接表。
 * 没有单独的边表 —— 关系本身就是字段（`links`），另写一份迟早与字段漂移。
 */
function buildGraphModel(list: DocumentItem[]): GraphModel {
  const nodes: Record<string, GraphNode> = {}
  const adj: Record<string, Record<string, 1>> = {}
  const edges: GraphEdge[] = []

  list.forEach((doc) => {
    nodes[docKeyOf(doc)] = {
      key: docKeyOf(doc),
      doc,
      family: 'doc',
      name: doc.name,
      sub: DOC_KIND_LABEL[doc.kind],
      deg: 0,
    }
  })

  /* 关联实体：除"另一篇文档"以外的三族（它们自己不带类型色，一律空心） */
  list.forEach((doc) => doc.links.forEach((link) => {
    if (link.family === 'doc') return
    const key = linkKeyOf(link)
    if (nodes[key]) return
    nodes[key] = {
      key,
      link,
      family: link.family,
      name: link.label,
      sub: link.meta,
      deg: 0,
    }
  }))

  list.forEach((doc) => doc.links.forEach((link) => {
    const a = docKeyOf(doc)
    const b = linkKeyOf(link)
    if (!nodes[b] || b === a) return
    if (edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) return
    edges.push({ a, b, dashed: link.family !== 'doc' })
  }))

  edges.forEach((e) => {
    adj[e.a] = adj[e.a] ?? {}
    adj[e.b] = adj[e.b] ?? {}
    adj[e.a][e.b] = 1
    adj[e.b][e.a] = 1
  })
  Object.keys(nodes).forEach((k) => { nodes[k].deg = Object.keys(adj[k] ?? {}).length })

  return { nodes, adj, edges, maxDeg: Math.max(1, ...Object.keys(nodes).map((k) => nodes[k].deg)) }
}

/** 坐标取到 1 位小数：拼进 `d` / `cx` 的是一串完整浮点，白占体积也难读。 */
const r1 = (v: number) => Math.round(v * 10) / 10

/** 总览：两列（关联实体 —— 文档），各列在自己的行数里居中。 */
function layoutOverview(m: GraphModel): GraphLayout {
  const G = GRAPH_GEO
  const rels = Object.keys(m.nodes).filter((k) => m.nodes[k].family !== 'doc')
  const docs = Object.keys(m.nodes).filter((k) => m.nodes[k].family === 'doc')
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

/** 分圈：第 0 圈 = 中心，第 k 圈 = 距中心 k 跳的。角度从正上方起、按数据顺序均分。 */
function layoutRadial(m: GraphModel, centerKey: string): GraphLayout {
  const G = GRAPH_GEO
  const rings: string[][] = [[centerKey]]
  const ringOf: Record<string, number> = { [centerKey]: 0 }
  let frontier = [centerKey]
  /* 上限 4 圈：这一格是"一跳一跳走"，不是把全库摊开；真溢出说明数据有问题 */
  while (frontier.length && rings.length <= 4) {
    const next: string[] = []
    frontier.forEach((k) => Object.keys(m.adj[k] ?? {}).forEach((nb) => {
      if (ringOf[nb] != null) return
      ringOf[nb] = rings.length
      next.push(nb)
    }))
    if (!next.length) break
    rings.push(next)
    frontier = next
  }

  const R = [0]
  for (let k = 1; k < rings.length; k += 1) {
    const prev = R[k - 1] as number
    R[k] = Math.max(prev + G.gapR, ((rings[k] as string[]).length * G.spacing) / (2 * Math.PI), G.minR)
  }
  const rMax = R[R.length - 1] as number
  const W = 2 * rMax + 2 * G.padX
  const H = 2 * rMax + 2 * G.padY
  const cx = W / 2
  const cy = H / 2

  const pos: Record<string, GraphPos> = {}
  rings.forEach((ring, k) => ring.forEach((key, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / ring.length
    pos[key] = {
      x: r1(cx + (R[k] as number) * Math.cos(a)),
      y: r1(cy + (R[k] as number) * Math.sin(a)),
      ring: k,
    }
  }))
  return { pos, W, H, cx, cy }
}

/** 节点半径：按度数归一（原型 `docNodeRadius` 的式子）—— 谁是枢纽由点的大小说。
    单独抽一支是因为三处都要它：画点、力导向的碰撞半径、以及"这一圈"的归一。
    不写成 `7 + min(deg, 8)`：那会让"连 3 个"与"连 8 个"长得一样大。 */
function nodeRadius(deg: number, maxDeg: number, core: boolean) {
  return r1(7 + (deg / maxDeg) * 8 + (core ? 2 : 0))
}

/** 一个节点 = 一个圆点 + 一行名称。实心 = 文档（填类型色）、空心 = 关联实体。
    坐标一律相对 (0,0)，定位交给外层 `<g>` 的 `transform`：主页那张是静态布局
       （一帧算完）、详情那张每帧都在动 —— 坐标写死在 circle / text 上的话，后者每帧
       都得重算内部每一个点。 */
function GraphNodeView({
  node,
  p,
  core,
  maxDeg,
  onActivate,
  onDragStart,
}: {
  node: GraphNode
  p: GraphPos
  core: boolean
  maxDeg: number
  onActivate: () => void
  /** 给了才可拖（详情那张图）。主页那张是静态的，不传。 */
  onDragStart?: (event: ReactPointerEvent<SVGGElement>) => void
}) {
  const radius = nodeRadius(node.deg, maxDeg, core)
  const isDoc = node.family === 'doc'
  const label = node.name.length > 9 ? `${node.name.slice(0, 9)}…` : node.name
  const cls = cn('gnode', isDoc && node.doc && `dk-${node.doc.kind}`, p.ring != null && p.ring >= 2 && 'is-far')

  const shape = (() => {
    if (isDoc || node.family === 'task') {
      return (
        <circle
          className="gdot"
          cx={0}
          cy={0}
          r={radius}
          style={{
            /* 文档的填充跟着类型走 —— 色值由 `.dk-*` 放下来的 `--kc` 给（与书脊同一张表），
               JS 里一个色值都不写 */
            fill: isDoc ? 'var(--kc, var(--mw-m-main))' : 'var(--mw-bg-card)',
            stroke: isDoc ? '#fff' : 'var(--mw-text-muted)',
            strokeWidth: 1.5,
          }}
        />
      )
    }
    if (node.family === 'bug') {
      const s = r1(radius * 1.2)
      return (
        <path
          className="gdot"
          d={`M 0 ${-s} L ${s} 0 L 0 ${s} L ${-s} 0 Z`}
          style={{ fill: 'var(--mw-bg-card)', stroke: 'var(--mw-text-muted)', strokeWidth: 1.5 }}
        />
      )
    }
    const s = r1(radius * 0.98)
    return (
      <rect
        className="gdot"
        x={-s}
        y={-s}
        width={r1(s * 2)}
        height={r1(s * 2)}
        rx={3}
        style={{ fill: 'var(--mw-bg-card)', stroke: 'var(--mw-text-muted)', strokeWidth: 1.5 }}
      />
    )
  })()

  return (
    <g
      className={cls}
      transform={`translate(${p.x},${p.y})`}
      role="button"
      tabIndex={0}
      aria-label={isDoc ? `《${node.name}》` : `${DOC_REL_FAMILY[node.family]}：${node.name}`}
      onClick={onActivate}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onActivate()
      }}
      onPointerDown={onDragStart}
    >
      <title>
        {isDoc && node.doc
          ? `《${node.name}》 · 连到 ${node.doc.links.length} 个 · 被 ${node.doc.back.length} 篇连到`
          : `${DOC_REL_FAMILY[node.family]}：${node.name} · 被 ${node.deg} 篇文档连到`}
      </title>
      {core ? <circle className="ghalo" cx={0} cy={0} r={r1(radius + 6)} /> : null}
      {shape}
      <text
        x={0}
        y={r1(radius + 14)}
        textAnchor="middle"
        fontSize={11.5}
        fontWeight={500}
        style={{ fill: 'var(--mw-text-primary)', pointerEvents: 'none' }}
      >
        {label}
      </text>
    </g>
  )
}

/* ------------------------------------------------------------------ *
 * 图谱 · 读数栏（主页与详情共用同一段）
 * ------------------------------------------------------------------ *
 * 与原型 `docRelpHtml(model, key, mode)` 一一对应：两处的差别只有"点一条做什么"——
 *   · 主页 = 换中心继续走（探索）——不共用手势的"打开这一篇"由栏头那颗按钮负责；
 *   · 详情 = 换到那一篇（跳转）；那一篇就是当前页 ⇒ 没有 ✕、也没有「打开这一篇」。
 * 关联实体（任务 / 风险 / 会议）在别的格子里 ⇒ 详情里点它只诚实回一句，不假装能跳 ——
 *    与原型 `data-demo` 那条同义。
 */
function GraphReadout({
  model,
  centerKey,
  mode,
  onOpen,
  onFocus,
  onClear,
  notice,
}: {
  model: GraphModel
  centerKey: string
  mode: 'home' | 'detail'
  onOpen: (id: string) => void
  onFocus: (key: string) => void
  onClear: () => void
  notice: (text: string) => void
}) {
  const node = model.nodes[centerKey]
  if (!node) return null
  const detail = mode === 'detail'

  /** 一条边的去向。主页 = 换中心；详情 = 换那一篇（文档）/ 诚实回一句（其余三族）。 */
  const go = (link: DocLink) => {
    if (!detail) { onFocus(linkKeyOf(link)); return }
    if (link.family === 'doc') onOpen(link.id)
    else notice(`${DOC_REL_FAMILY[link.family]}在「${DOC_REL_FAMILY[link.family]}」那一格里，这里只存了关联`)
  }

  const row = (link: DocLink, meta: string, tag: string) => (
    <button key={`${tag}-${link.kind}-${link.id}`} type="button" className="relp-item" onClick={() => go(link)}>
      <span className="rel-kind">{DOC_LINK_LABEL[link.kind]}</span>
      <span className="relp-item-name">{link.label}</span>
      <div className="relp-item-meta">{meta}</div>
    </button>
  )

  const sec = (title: string, count: number, rows: ReactNode) => (
    <div className="relp-sec">
      <div className="relp-sec-title">
        {title}
        <span className="relp-count">{count}</span>
      </div>
      <div className="relp-list">{count ? rows : <div className="relp-empty">暂无</div>}</div>
    </div>
  )

  return (
    <aside className="doc-relp">
      <div className="relp-head">
        <div className="relp-head-main">
          <div className="relp-title">{node.family === 'doc' ? `《${node.name}》` : node.name}</div>
          <div className="relp-sub">
            {node.family === 'doc' && node.doc
              ? `${DOC_KIND_LABEL[node.doc.kind]} · ${node.doc.source} · 更新 ${node.doc.updatedAt}`
              : `${DOC_REL_FAMILY[node.family]} · ${node.sub}`}
          </div>
        </div>
        {/* 详情那一篇就是当前页 ⇒ 不给"返回总览"（它没有"总览"可回，中心是钉死的） */}
        {detail ? null : (
          <button type="button" className="relp-x" aria-label="返回总览" onClick={onClear}>
            ✕
          </button>
        )}
      </div>

      {node.family === 'doc' && node.doc ? (() => {
        const center = node.doc!
        return (
          <>
            {sec('连出去', center.links.length, center.links.map((link) => row(
              link,
              link.family === 'doc' ? link.meta : `${DOC_REL_FAMILY[link.family]} · ${link.meta}`,
              'out',
            )))}
            {sec('连进来', center.back.length, center.back.map((link) => row(
              link, `${link.meta} · 挂到这一篇`, 'back',
            )))}
            {/* 详情里不摆"打开这一篇" —— 那一篇就是当前页 */}
            {detail ? null : (
              <button type="button" className="btn btn-ghost relp-open" onClick={() => onOpen(center.id)}>
                打开这一篇
              </button>
            )}
          </>
        )
      })() : (
        /* 关联实体的"入"全部来自文档：从每条边反查是哪一篇、用的是哪个意图 */
        sec('被这几篇挂到', node.deg, model.edges
          .filter((e) => e.a === centerKey || e.b === centerKey)
          .map((e) => {
            const other = e.a === centerKey ? e.b : e.a
            const row2 = model.nodes[other]
            if (!row2 || row2.family !== 'doc' || !row2.doc) return null
            const link = row2.doc.links.find((x) => linkKeyOf(x) === centerKey)
            return (
              <button
                key={other}
                type="button"
                className="relp-item"
                onClick={() => onFocus(other)}
              >
                <span className="rel-kind">{link ? DOC_LINK_LABEL[link.kind] : '参考'}</span>
                <span className="relp-item-name">{row2.name}</span>
                <div className="relp-item-meta">{DOC_KIND_LABEL[row2.doc.kind]} · 挂在这里</div>
              </button>
            )
          }))
      )}
    </aside>
  )
}

/* ------------------------------------------------------------------ *
 * 详情那张图：以当前这一篇为中心的一跳子图（力导向，自带实现）
 * ------------------------------------------------------------------ *
 * 与主页那张共用模型 / 节点画法 / 读数栏，三处不同（照原型）：
 *   ① 中心固定 = 当前这一篇（主页那张的中心是"探索到哪儿了"）；
 *   ② 只画一圈 —— 这一屏的问题是"这一篇连着谁"，再往外是主页那张图的活；
 *   ③ 点节点 = 换一篇（其它三族诚实回一句）。
 *
 * 只画一跳，不递归：邻居的邻居画进来不是"信息少"，是错的 —— 它们与中心之间
 *    没有边，读者会以为它们跟这一篇有关。
 * 力参数照着原型 `docForceLayout` 那一套给（弹簧 140 / 斥力 20000 / 向心 .012 /
 *    阻尼 .82），另加一条碰撞 —— 本仓半径随度数变、名字又长，不加会叠在一起。
 */
const DETAIL_GEO = {
  w: 640,
  h: 560,
  len: 140,
  rep: 20000,
  pull: 0.012,
  spring: 0.02,
  damp: 0.82,
  collide: 30,
  /* 30px 以内不再推：两个最大半径的点贴在一起就够了，再推会抖 */
  minD2: 900,
  /* 每帧的 alpha 衰减与停止线：桌面端不该有一张永远在动的图（原型 d3 靠它的内建收敛） */
  decay: 0.985,
  stop: 0.02,
  /* "拖过之后紧跟的那一次 click 不算"的保险丝；以及"拖 vs 点"的位移阈值 */
  muteMs: 320,
  dragPx: 3,
}

/** 一跳子图 + 按这一圈归一的度数（力导向与静态两处都必须用它 —— 同一批节点不能
    因为走哪条路就长得不一样，半径是按 maxDeg 归一算出来的）。 */
function oneHopView(model: GraphModel, centerKey: string) {
  const keep: Record<string, true> = { [centerKey]: true }
  Object.keys(model.adj[centerKey] ?? {}).forEach((k) => { keep[k] = true })
  const keys = Object.keys(model.nodes).filter((k) => keep[k])
  const edges = model.edges.filter((e) => keep[e.a] && keep[e.b])
  return { keys, edges, maxDeg: Math.max(1, ...keys.map((k) => model.nodes[k].deg)) }
}

interface DetailSim {
  P: Record<string, { x: number; y: number }>
  V: Record<string, { x: number; y: number }>
  /** 钉住的节点：中心（永远）+ 正被拖的那一个。给了 fx/fy 就不参与积分 */
  fixed: Record<string, { x: number; y: number } | null>
  alpha: number
  raf: number
  running: boolean
  step: () => void
}

function DocRelationGraph({
  centerKey,
  model,
  onOpen,
  notice,
}: {
  centerKey: string
  model: GraphModel
  onOpen: (id: string) => void
  notice: (text: string) => void
}) {
  const view = useMemo(() => oneHopView(model, centerKey), [model, centerKey])
  const [pos, setPos] = useState<Record<string, { x: number; y: number }>>({})
  const svgRef = useRef<SVGSVGElement | null>(null)
  const simRef = useRef<DetailSim | null>(null)
  const dragRef = useRef<{ key: string; from: { x: number; y: number }; moved: boolean } | null>(null)
  /** 刚拖完的那一次 click 不算 —— 否则拖完节点顺手就跳转了 */
  const muteRef = useRef(false)
  const centerName = model.nodes[centerKey]?.name ?? ''

  /* 依赖用签名（keys 串）而不是 `view` / `model` 的对象引用：它们由 `docs` 派生，
     而 `docs` 一旦被调用方每次渲染新建（`buildDocuments()` 那种写法就会），引用就变了
     ⇒ 仿真的 effect 会重跑、图被重置（形状每帧重来、拖到一半归位）。签名相同即内容等价。 */
  const viewSig = view.keys.join('|')

  /* `useLayoutEffect`：初值必须在绘制前算出来，否则第一帧是一张空图（会闪一下）。 */
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useLayoutEffect(() => {
    const G = DETAIL_GEO
    const sim: DetailSim = {
      P: {}, V: {}, fixed: {}, alpha: 1, raf: 0, running: false,
      step: () => {},
    }

    view.keys.forEach((key) => {
      sim.V[key] = { x: 0, y: 0 }
      if (key === centerKey) {
        /* 中心钉在正中：它是这一屏的主角，不属于"自由迭代"的部分 */
        sim.fixed[key] = { x: G.w / 2, y: G.h / 2 }
        sim.P[key] = { x: G.w / 2, y: G.h / 2 }
        return
      }
      /* 随机初值：按随机角度 + 随机半径撒开 ⇒ 同一篇文档每次打开，形状都不一样
         （这与"确定初值、永远同一张图"正好相反 —— 用户点名要的就是这个）。 */
      const angle = Math.random() * Math.PI * 2
      const rad = Math.min(G.w, G.h) * 0.32 * (0.45 + Math.random() * 0.55)
      sim.P[key] = { x: G.w / 2 + Math.cos(angle) * rad, y: G.h / 2 + Math.sin(angle) * rad }
      sim.fixed[key] = null
    })

    sim.step = () => {
      const keys = view.keys
      const P = sim.P
      const V = sim.V
      keys.forEach((k) => { V[k].x = 0; V[k].y = 0 })

      /* 两两：斥力 + 碰撞（一次遍历里算，d 已经在外层了） */
      for (let i = 0; i < keys.length; i += 1) {
        for (let j = i + 1; j < keys.length; j += 1) {
          const a = keys[i] as string
          const b = keys[j] as string
          const dx = P[a].x - P[b].x
          const dy = P[a].y - P[b].y
          const d2 = Math.max(dx * dx + dy * dy, G.minD2)
          const d = Math.sqrt(d2)
          const f = (G.rep / d2) * sim.alpha
          V[a].x += (dx / d) * f; V[a].y += (dy / d) * f
          V[b].x -= (dx / d) * f; V[b].y -= (dy / d) * f
          const need = nodeRadius(model.nodes[a].deg, view.maxDeg, a === centerKey)
            + nodeRadius(model.nodes[b].deg, view.maxDeg, b === centerKey) + G.collide
          if (d < need) {
            const push = ((need - d) / d) * 0.5 * sim.alpha
            V[a].x += dx * push; V[a].y += dy * push
            V[b].x -= dx * push; V[b].y -= dy * push
          }
        }
      }

      view.edges.forEach((e) => {
        const pa = P[e.a]
        const pb = P[e.b]
        if (!pa || !pb) return
        const dx = pb.x - pa.x
        const dy = pb.y - pa.y
        const d = Math.max(Math.sqrt(dx * dx + dy * dy), 1)
        const f = (d - G.len) * G.spring * sim.alpha
        V[e.a].x += (dx / d) * f; V[e.a].y += (dy / d) * f
        V[e.b].x -= (dx / d) * f; V[e.b].y -= (dy / d) * f
      })

      keys.forEach((k) => {
        const at = sim.fixed[k]
        if (at) { P[k].x = at.x; P[k].y = at.y; return }
        V[k].x += (G.w / 2 - P[k].x) * G.pull * sim.alpha
        V[k].y += (G.h / 2 - P[k].y) * G.pull * sim.alpha
        P[k].x += V[k].x * G.damp
        P[k].y += V[k].y * G.damp
      })

      sim.alpha *= G.decay
      setPos({ ...P })
      if (sim.alpha > G.stop) sim.raf = requestAnimationFrame(sim.step)
      else sim.running = false
    }

    simRef.current = sim
    setPos({ ...sim.P })
    sim.running = true
    sim.raf = requestAnimationFrame(sim.step)

    return () => {
      cancelAnimationFrame(sim.raf)
      sim.running = false
      simRef.current = null
    }
  }, [viewSig, centerKey])

  /** 已经停了才重新起 rAF（拖拽要能唤醒它） */
  const wake = () => {
    const sim = simRef.current
    if (!sim) return
    sim.alpha = Math.max(sim.alpha, 0.25)
    if (!sim.running) {
      sim.running = true
      sim.raf = requestAnimationFrame(sim.step)
    }
  }

  /** 屏幕坐标 → SVG 用户坐标（`createSVGPoint` 是唯一可靠的做法：viewBox 有缩放） */
  const toLocal = (clientX: number, clientY: number) => {
    const svg = svgRef.current
    const matrix = svg?.getScreenCTM()
    if (!svg || !matrix) return { x: 0, y: 0 }
    const point = svg.createSVGPoint()
    point.x = clientX
    point.y = clientY
    const local = point.matrixTransform(matrix.inverse())
    return { x: r1(local.x), y: r1(local.y) }
  }

  const onDragStart = (key: string) => (event: ReactPointerEvent<SVGGElement>) => {
    /* 中心不给拖（它是这一屏的主角），与原型同 */
    if (key === centerKey) return
    const sim = simRef.current
    if (!sim) return
    const at = toLocal(event.clientX, event.clientY)
    dragRef.current = { key, from: at, moved: false }
    sim.fixed[key] = at
    wake()
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onDragMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const drag = dragRef.current
    const sim = simRef.current
    if (!drag || !sim) return
    const at = toLocal(event.clientX, event.clientY)
    /* 判"拖没拖"要比起点与当前点的距离，不能看单帧增量（一帧只动 1px 很常见） */
    if (Math.abs(at.x - drag.from.x) + Math.abs(at.y - drag.from.y) > DETAIL_GEO.dragPx) drag.moved = true
    sim.fixed[drag.key] = at
  }

  const onDragEnd = () => {
    const drag = dragRef.current
    const sim = simRef.current
    if (!drag || !sim) return
    if (drag.moved) {
      muteRef.current = true
      window.setTimeout(() => { muteRef.current = false }, DETAIL_GEO.muteMs)
    }
    sim.fixed[drag.key] = null
    dragRef.current = null
  }

  const activate = (key: string) => {
    if (muteRef.current) return
    const node = model.nodes[key]
    if (!node) return
    if (node.family === 'doc' && node.doc) {
      if (node.doc.id === centerKey.slice(4)) return
      onOpen(node.doc.id)
      return
    }
    notice(`${DOC_REL_FAMILY[node.family]}在「${DOC_REL_FAMILY[node.family]}」那一格里，这里只存了关联`)
  }

  return (
    <>
      <div className="doc-graph-canvas">
        <svg
          ref={svgRef}
          className="doc-graph"
          viewBox={`0 0 ${DETAIL_GEO.w} ${DETAIL_GEO.h}`}
          role="img"
          aria-label={`「${centerName}」的关联图谱`}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragEnd}
        >
          {view.edges.map((edge) => {
            const a = pos[edge.a]
            const b = pos[edge.b]
            if (!a || !b) return null
            return (
              <path
                key={`${edge.a}-${edge.b}`}
                className={cn('edge', edge.dashed ? 'edge-task' : 'edge-doc')}
                d={`M ${a.x} ${a.y} L ${b.x} ${b.y}`}
              />
            )
          })}

          {view.keys.map((key) => {
            const at = pos[key]
            if (!at) return null
            return (
              <GraphNodeView
                key={key}
                node={model.nodes[key]}
                p={{ ...at, ring: key === centerKey ? 0 : 1 }}
                core={key === centerKey}
                maxDeg={view.maxDeg}
                onActivate={() => activate(key)}
                onDragStart={onDragStart(key)}
              />
            )
          })}
        </svg>

        <div className="doc-graph-legend">
          <span><i className="lg-line" />实线 · 另一篇文档（约定 / 参考）</span>
          <span><i className="lg-line is-dash" />虚线 · 任务 / 风险 / 会议（产出 / 风险 / 会议）</span>
          <span>点文档节点 = 换到那一篇，也可以拖</span>
        </div>
      </div>

      <GraphReadout
        model={model}
        centerKey={centerKey}
        mode="detail"
        onOpen={onOpen}
        /* detail 模式下这两个槽用不到（没有"总览"可回、点一条是换一篇）——
           接口恒定不按"用没用上"裁剪签名，与生成器那条纪律同。 */
        onFocus={() => {}}
        onClear={() => {}}
        notice={notice}
      />
    </>
  )
}

/* ------------------------------------------------------------------ *
 * 文档详情（主从里的"从"）—— 不是弹窗
 * ------------------------------------------------------------------ *
 * 这一屏 = 一本书 + 它的坐标 + 它的边 + 它的同类（三块各带卡头，见文件头）。
 * 文档在本仓只存索引（正文留在来源工具里）⇒ 不假装有正文，但也不把这句话讲两遍：
 *    收成标题下面一行 `.dd-sub`。
 */
function DocDetailScreen({
  doc,
  docs,
  onBack,
  onOpen,
  onFilterFunc,
  onOpenSource,
  notice,
}: {
  doc: DocumentItem
  docs: DocumentItem[]
  onBack: () => void
  onOpen: (id: string) => void
  /** 点「位置」里的模块 / 功能：回主页并筛上它（落的是与侧栏 facet 同两个变量） */
  onFilterFunc: (module: string, func: string) => void
  /** 「打开原文」进第三屏（阅读态那单独一页） */
  onOpenSource: () => void
  notice: (text: string) => void
}) {
  /* 同一功能下的其他篇：详情页唯一能给而主页给不了的上下文。
     模型建在全量 `docs` 上（不是筛过的那一批）—— 与原型 `docGraphModel(curDocs())` 同，
     否则"从书墙点进来"与"从列表点进来"会得到两张不同的图。 */
  const model = useMemo(() => buildGraphModel(docs), [docs])
  const siblings = docs.filter((x) => x.func === doc.func && x.id !== doc.id)
  /* 订阅"应用内副本"：保存之后这一屏的名字 / 更新时间 / 说明那句话要当场跟着变
     （这三处是"保存到底成没成"最直接的证据）。 */
  const version = useDocCopies()
  const copy = useMemo(() => copyOf(doc.id), [doc.id, version])

  return (
    <div className="dd-screen">
      <button type="button" className="crumb-back" onClick={onBack}>
        <span aria-hidden="true">←</span>
        <span>返回文档主页</span>
      </button>

      <div className="dd-body">
        {/* 块一：这一篇是什么 —— 书 + 标题 + 一行陈述 + 四项坐标。
            那本书是当前对象、不是一扇门 ⇒ 不传 `onOpen`（DocBook 只在给 `onOpen`
               时才挂 role / tabIndex），CSS 那边也一并断掉指针与悬停抬起。 */}
        <section className="card dd-hero">
          <div className="dd-book" aria-hidden="true">
            <DocBook doc={doc} />
          </div>
          <div className="dd-main">
            <div className="dd-title-row">
              <div className="dd-title">{copy?.name ?? doc.name}</div>
              {/* 这一屏唯一"往前走"的动作 ⇒ 给主按钮（上一版它是全屏最弱的样式，主次正好反了） */}
              <button
                type="button"
                className="btn btn-primary"
                onClick={onOpenSource}
              >
                打开原文
              </button>
            </div>
            <div className="dd-sub">
              {DOC_KIND_LABEL[doc.kind]}
              {' · '}
              {copy
                ? `应用内副本 —— 正文已经在这里落了盘，可以读、也可以改`
                : `索引型 —— 正文在${doc.source}里维护，这里只存索引与链接`}
            </div>
            <div className="dd-facts">
              <div>
                <div className="dd-fact-k">位置</div>
                <div className="dd-fact-v">
                  <button type="button" className="dd-crumb" onClick={() => onFilterFunc(doc.module, 'all')}>
                    {doc.module}
                  </button>
                  <span className="dd-sep" aria-hidden="true">›</span>
                  <button type="button" className="dd-crumb" onClick={() => onFilterFunc(doc.module, doc.func)}>
                    {doc.func}
                  </button>
                </div>
              </div>
              <div>
                <div className="dd-fact-k">来源</div>
                <div className="dd-fact-v">{doc.source}</div>
              </div>
              <div>
                <div className="dd-fact-k">作者</div>
                <div className="dd-fact-v">{doc.author}</div>
              </div>
              <div>
                <div className="dd-fact-k">更新</div>
                <div className="dd-fact-v">{copy ? copyAgoText(copy) : doc.updatedAt}</div>
              </div>
            </div>
          </div>
        </section>

        {/* 块二：关联 = 一张卡里的图 + 读数栏（与主页那套同一套组件、同一套令牌） */}
        <section className="card dd-rel">
          <div className="card-head">
            <div className="card-head-left">
              <div className="card-icon">🔗</div>
              <div className="card-title">关联</div>
            </div>
          </div>
          <div className="doc-graph-wrap">
            <DocRelationGraph
              centerKey={docKeyOf(doc)}
              model={model}
              onOpen={onOpen}
              notice={notice}
            />
          </div>
        </section>

        {siblings.length ? (
          <section className="card">
            <div className="card-head">
              <div className="card-head-left">
                <div className="card-icon">📚</div>
                <div className="card-title">同一功能下还有</div>
                <span className="card-count">{siblings.length} 篇</span>
              </div>
              {/* 用 `<span role="button">`（不是 `<button>`）：这条样式族是给 span 的，
                  与 `ProjectDetail.tsx` 里那一颗同款 —— 换标签会带出浏览器原生外观。 */}
              <span
                className="card-more"
                role="button"
                tabIndex={0}
                onClick={() => onFilterFunc(doc.module, doc.func)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter' && event.key !== ' ') return
                  event.preventDefault()
                  onFilterFunc(doc.module, doc.func)
                }}
              >
                只看「{doc.func}」→
              </span>
            </div>
            <div className="doc-books compact">
              {siblings.map((other) => (
                <DocBook key={other.id} doc={other} onOpen={() => onOpen(other.id)} />
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 新建文档弹窗
 * ------------------------------------------------------------------ */

/**
 * 表单是受控的（标题/类型/链接/摘要各有 state），但保存不落任何地方 ——
 *    没有写接口。给"保存成功"的假回执比不给按钮更糟（见文件头「动作的诚实性」）。
 */
function DocModal({
  mode,
  doc,
  docs,
  projectName,
  defaultModule,
  defaultFunc,
  onClose,
  onDelete,
  notice,
}: {
  mode: 'create' | 'edit' | 'delete'
  /** 编辑 / 删除态要它；新建态不给 */
  doc?: DocumentItem
  /** 候选池从现有文档里现算（模块 / 功能 / 来源都不是枚举） */
  docs: DocumentItem[]
  projectName: string
  /** 新建时把当前筛选带进来：在「用户中心 › 登录鉴权」下点的新建，这四项已经填好了 */
  defaultModule?: string
  defaultFunc?: string
  onClose: () => void
  /** 编辑态那颗「删除」进阶到第三态（原型 `openDocModal(id, 'delete')` 走的就是它） */
  onDelete?: () => void
  notice: (text: string) => void
}) {
  /* 候选池：模块去重保序 + 每个模块自己的功能（功能只可能属于某一个模块）。
     不另存一份"模块清单"配置 —— 存了迟早与实际走岔。来源同理，从数据去重保序取。 */
  const options = useMemo(() => {
    const modules: string[] = []
    const funcsOf: Record<string, string[]> = {}
    docs.forEach((d) => {
      if (!modules.includes(d.module)) {
        modules.push(d.module)
        funcsOf[d.module] = []
      }
      if (!funcsOf[d.module].includes(d.func)) funcsOf[d.module].push(d.func)
    })
    const sources: string[] = []
    docs.forEach((d) => {
      if (!sources.includes(d.source)) sources.push(d.source)
    })
    return { modules, funcsOf, sources }
  }, [docs])

  const editing = mode === 'edit'
  const del = mode === 'delete'
  const heading = del ? '删除文档' : editing ? '编辑文档' : '新建文档'
  const mainLabel = del ? '删除' : editing ? '保存' : '新建'

  /* 弹窗内部新建的模块 / 功能只活在这一份草稿里（原型同）：提交时才并进数据。
     它不是"另存第二份清单"，所以放在 state 而不是并进 `docs`。 */
  const [extraModules, setExtraModules] = useState<string[]>([])
  const [extraFuncs, setExtraFuncs] = useState<string[]>([])
  const modules = [...options.modules, ...extraModules]
  const funcsOf = { ...options.funcsOf }
  if (extraFuncs.length) {
    /* 新建的功能挂到当前模块下（原型：新功能属于选中那个模块） */
    const key = doc?.module ?? defaultModule ?? modules[0] ?? ''
    funcsOf[key] = [...(funcsOf[key] ?? []), ...extraFuncs]
  }

  const [name, setName] = useState(doc?.name ?? '')
  const [module, setModule] = useState(
    doc?.module ?? (defaultModule && defaultModule !== 'all' ? defaultModule : options.modules[0] ?? ''),
  )
  const [func, setFunc] = useState(
    doc?.func ??
      (defaultFunc && defaultFunc !== 'all'
        ? defaultFunc
        : (options.funcsOf[options.modules[0]] ?? [])[0] ?? ''),
  )
  const [kind, setKind] = useState<DocKind>(doc?.kind ?? 'plan')
  const [source, setSource] = useState(doc?.source ?? options.sources[0] ?? '')
  /** 哪一维正在"新建"（原型 `fmAdding`）：一次只允许一维在编辑 */
  const [adding, setAdding] = useState<'module' | 'func' | null>(null)
  const [draftNew, setDraftNew] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  /** 一组胶囊。`canAdd` 只给"会长的那两维"（模块 / 功能）。 */
  const picks = (key: 'module' | 'func' | 'kind' | 'source', label: string, values: string[], value: string, onPick: (v: string) => void, canAdd = false) => (
    <div className="fm-field">
      <span className="fm-label">{label}</span>
      <div className="fm-picks">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            className={cn('fm-chip', key === 'kind' && `dk-${v}`, v === value && 'active')}
            aria-pressed={v === value}
            onClick={() => onPick(v)}
          >
            {key === 'kind' ? <span className="fm-dot" /> : null}
            {key === 'kind' ? DOC_KIND_LABEL[v as DocKind] : v}
          </button>
        ))}
        {canAdd && adding === key ? (
          <input
            /* `key` 让"换一维去新建"时输入框重新挂载 —— 比在 effect 里手动 focus 稳，
               也不会与"首次挂载聚焦第一个字段"那类逻辑打架 */
            key={`new-${key}`}
            className="fm-input fm-inline"
            autoFocus
            value={draftNew}
            placeholder={key === 'module' ? '新模块名，回车确认' : '新功能名，回车确认'}
            onChange={(event) => setDraftNew(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              const v = draftNew.trim()
              if (!v) return
              if (key === 'module') {
                setExtraModules((prev) => (prev.includes(v) ? prev : [...prev, v]))
                setModule(v)
                /* 换模块 ⇒ 功能列表跟着换（功能只可能属于选中的那个模块），旧的选中项不再有效 */
                setFunc('')
              } else {
                setExtraFuncs((prev) => (prev.includes(v) ? prev : [...prev, v]))
                setFunc(v)
              }
              setDraftNew('')
              setAdding(null)
            }}
            onBlur={() => {
              setDraftNew('')
              setAdding(null)
            }}
          />
        ) : null}
        {canAdd && adding !== key ? (
          <button
            type="button"
            className="fm-chip is-add"
            onClick={() => {
              setAdding(key === 'module' ? 'module' : 'func')
              setDraftNew('')
            }}
          >
            ＋ 新建
          </button>
        ) : null}
      </div>
    </div>
  )

  return (
    <div
      className="modal-mask open"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal wide" role="dialog" aria-modal="true" aria-label={heading}>
        <div className="modal-head">
          <div className="modal-titles">
            <div className="modal-title">{heading}</div>
            <div className="modal-subtitle">{projectName}</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* 删除态整块表单不渲染（原型是给那块加 hidden，这里按本仓口径用条件渲染：
              `hidden` 属性一律别用）—— 破坏性动作的确认页只该说清"删的是哪一篇、会连带什么"。 */}
          {del && doc ? (
            <p className="doc-confirm">
              删除后《{doc.name}》会从书墙上消失，它连出去的 {doc.links.length} 条关联、
              以及引用它的 {doc.back.length} 篇的记录会一起失效。
            </p>
          ) : (
            <>
              <div className="fm-field">
                <label className="fm-label" htmlFor="doc-name">
                  文档名
                </label>
                <input
                  id="doc-name"
                  className="fm-input"
                  value={name}
                  autoFocus={!del}
                  placeholder="例如：登录鉴权技术方案"
                  autoComplete="off"
                  onChange={(event) => setName(event.target.value)}
                />
              </div>

              {picks('module', '模块', modules, module, (v) => {
                setModule(v)
                /* 模块换了 ⇒ 功能列表跟着换（功能只可能属于选中的那个模块），旧的选中项不再有效 */
                setFunc((options.funcsOf[v] ?? [])[0] ?? '')
              }, true)}

              {picks('func', '功能', funcsOf[module] ?? [], func, setFunc, true)}

              {picks('kind', '类型', DOC_KINDS as unknown as string[], kind, (v) => setKind(v as DocKind))}

              {picks('source', '来源', options.sources, source, setSource)}
            </>
          )}
        </div>

        {/* 动作栏：删除态只有「取消 / 删除」；编辑态在左边多一颗「删除」（进阶到第三态）。
            删除那颗只在指向它时变红（`.doc-del-btn`），常驻红字会把视线拽走。 */}
        <div className="modal-actions">
          {editing ? (
            <button type="button" className="btn btn-ghost doc-del-btn" onClick={onDelete}>
              删除
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={cn('btn', del ? 'doc-del-btn btn-ghost' : 'btn-primary')}
            /* 名字是必填 —— 原型那颗 `#docModalCreate` 也是 `disabled` 起手 */
            disabled={!del && !name.trim()}
            onClick={() => notice(del ? '删除文档：还没有写接口' : '保存文档：还没有写接口')}
          >
            {mainLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 页面
 * ------------------------------------------------------------------ */

export function DocLibrary({
  docs,
  projectName,
  notice,
  groupLabel = '模块与功能',
}: {
  docs: DocumentItem[]
  /** 新建弹窗的副标题用它（原型那里写的就是项目名） */
  projectName: string
  notice: (text: string) => void
  /**
   * 左栏第一组的标题。
   * 那两个维度的语义随宿主变：项目详情里是「模块 → 功能」，
   *    工作模块的文档索引页里是「项目 → 分类」（`data/workspace/work-docs.ts`）。
   *    槽是通用的，标题由调用方给 —— 写死一个"模块与功能"会让那一页说不出自己在筛什么。
   */
  groupLabel?: string
}) {
  const [moduleKey, setModuleKey] = useState('all')
  const [funcKey, setFuncKey] = useState('all')
  const [kindKey, setKindKey] = useState<DocKind | 'all'>('all')
  const [sourceKey, setSourceKey] = useState<string>('all')
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState<SortKey>('updated')
  const [view, setView] = useState<ViewKey>('shelf')
  const [graphSel, setGraphSel] = useState<string | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [docModal, setDocModal] = useState<{ mode: 'create' | 'edit' | 'delete'; id?: string } | null>(null)

  /* 第三屏 · 原文。它挂在**两个** return 上：详情屏那支是早返回，只挂主页这一支的话，
     从详情屏点「打开原文」不会有任何反应（覆盖层压根没渲染）。 */
  const { openSource, sourceNode } = useSourceOverlay(projectName, notice)

  /* 模块 / 功能是内容数据（各项目自己的一小组）⇒ 换了项目可能一个都不剩。
     原型在渲染开头硬复位；这里是派生时归一化（见文件头 ②）——
     类型 / 来源是固定枚举，不用这条。 */
  const normModule = moduleKey !== 'all' && docs.some((d) => d.module === moduleKey) ? moduleKey : 'all'
  const normFunc = funcKey !== 'all' && docs.some((d) => d.func === funcKey) ? funcKey : 'all'

  const needle = keyword.trim().toLowerCase()
  /** 搜索词覆盖四样：文档名 / 来源 / 模块名 / 功能名 + 类型名。
      模块与功能名不进搜索的话，搜「登录」就捞不到登录鉴权那几篇 —— 等于把这两维藏起来了。 */
  const hay = (doc: DocumentItem) =>
    `${doc.name}${doc.source}${doc.module}${doc.func}${DOC_KIND_LABEL[doc.kind]}`.toLowerCase()

  /**
   * facet 计数的取样池：排除自己那一维的筛选（+ 搜索词照算）。
   * 这样"点下去会剩几篇"是真话；把自己那一维也排除掉的话，点过之后再点别的，
   * 每个数字都得重算一遍才知道刚才那句是假的。
   * `except` 是数组：「模块 / 功能」是上下级，两者的计数都该排除这两维
   *    （下级的选择不该改上级的"我下面有多少"），而类型 / 来源是并列维，各排各的。
   */
  const facetPool = (except: string[]) => docs.filter((doc) => {
    if (!except.includes('module') && normModule !== 'all' && doc.module !== normModule) return false
    if (!except.includes('func') && normFunc !== 'all' && doc.func !== normFunc) return false
    if (!except.includes('kind') && kindKey !== 'all' && doc.kind !== kindKey) return false
    if (!except.includes('source') && sourceKey !== 'all' && doc.source !== sourceKey) return false
    if (!needle) return true
    return hay(doc).includes(needle)
  })

  /** 筛选 + 搜索 + 排序的唯一出口：三个视图与图谱读的都是它。
      三个视图因此不可能各说各话（"书墙 4 本、列表 2 行"这一族病只在多份口径里出现）。 */
  const shown = useMemo(() => {
    const list = facetPool([])
    return [...list].sort((a, b) => (sort === 'name'
      ? a.name.localeCompare(b.name, 'zh')
      : a.updatedHours - b.updatedHours))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, normModule, normFunc, kindKey, sourceKey, needle, sort])

  const forFunc = facetPool(['func'])
  const forKind = facetPool(['kind'])
  const forSource = facetPool(['source'])
  const forModule = facetPool(['module', 'func'])

  /**
   * 「模块 → 功能」是两层目录，不是一条会长的平铺列表：
   * 一个项目可能"超级多功能"，平铺（哪怕折叠）也撑不住 —— 先给一层粗的。
   * 顺序从 `docs`（全量）去重保序取，不能从 facet 池取 —— 池子会被别的维筛掉，
   * 那样"换个类型筛一下，功能项就少一个"，位置就飘了。
   */
  const modules = useMemo(() => {
    const out: { name: string; funcs: string[] }[] = []
    docs.forEach((doc) => {
      let m = out.find((x) => x.name === doc.module)
      if (!m) {
        m = { name: doc.module, funcs: [] }
        out.push(m)
      }
      if (!m.funcs.includes(doc.func)) m.funcs.push(doc.func)
    })
    return out
  }, [docs])

  /* 展开哪一个模块：选中的那个，或"选中功能所在的那个"（永远只有一个展开态） */
  const openModule = normModule !== 'all'
    ? normModule
    : (normFunc === 'all' ? '' : (docs.find((d) => d.func === normFunc)?.module ?? ''))

  /**
   * 来源组：从数据去重保序取（与「模块与功能」同一条做法）。
   *
   * 不能照原型那样写死 `DOC_SOURCES` 那四个 —— 那份枚举是"项目内文档"的来源
   *    （由项目哈希轮转出来的，所以恒在那四个里），而工作模块的文档索引页里，
   *    来源是内容数据（公司 Wiki / 会议纪要 / 部署 · 生产 …）⇒ 写死会让真实来源
   *    一条都列不出来，左栏只剩四个恒为 0 的项（而且不报错）。
   */
  const sources = useMemo(() => {
    const out: string[] = []
    docs.forEach((doc) => { if (!out.includes(doc.source)) out.push(doc.source) })
    return out
  }, [docs])

  const kindCount = (kind: DocKind) => forKind.filter((d) => d.kind === kind).length

  const filtering = normModule !== 'all' || normFunc !== 'all' || kindKey !== 'all'
    || sourceKey !== 'all' || !!needle

  const opened = openId ? docs.find((d) => d.id === openId) ?? null : null

  /* 图谱：选中的那个可能已经被筛掉了（刚改过筛选 / 搜索）—— 那就当没选中，
     否则中心节点找不到，整张图会画不出来。 */
  const graph = useMemo(() => buildGraphModel(shown), [shown])
  const selKey = graphSel && graph.nodes[graphSel] ? graphSel : null
  const layout = useMemo(
    () => (selKey ? layoutRadial(graph, selKey) : layoutOverview(graph)),
    [graph, selKey],
  )

  /** 筛一个模块 / 功能：两者互斥（选了功能就已经定死了它所在的模块，
      两个都留着会让"现在筛的是什么"说不清）。再点同一个 = 取消。 */
  const pickModule = (name: string) => {
    setModuleKey((prev) => (prev === name ? 'all' : name))
    setFuncKey('all')
  }
  const pickFunc = (name: string) => {
    setFuncKey((prev) => (prev === name ? 'all' : name))
    setModuleKey('all')
  }

  /* 详情屏：主从的"从"。放在这里返回（而不是另开路由）—— 主页那一套筛选状态留在 state 里，
     返回时原样还在（原型那条注释：搜索词不复位，"框里写着关键词、列出来的却是全部"最糟）。 */
  if (opened) {
    return (
      <>
        <DocDetailScreen
          doc={opened}
          docs={docs}
          onBack={() => setOpenId(null)}
          onOpen={(id) => setOpenId(id)}
          onOpenSource={() => openSource(opened)}
          onFilterFunc={(module, func) => {
            setModuleKey(module)
            setFuncKey(func)
            setOpenId(null)
          }}
          notice={notice}
        />
        {sourceNode}
      </>
    )
  }

  return (
    <div className="doc-layout">
      {/* ---------------- 筛选栏（这一格内的二级栏）----------------
          三组按粗 → 细 → 工具排：模块与功能 → 类型 → 来源。
          每组的数字都是 facet 计数（在"别的维 + 搜索词"下数）。 */}
      <aside className="card doc-side">
        <div className="doc-side-group">
          <div className="doc-side-title">{groupLabel}</div>
          {/* 「全部」不是模块（没有展开语义），但要与模块行的文字左边缘对齐 ⇒ 留一个透明占位 */}
          <button
            type="button"
            className={cn('doc-side-item', normModule === 'all' && normFunc === 'all' && 'active')}
            onClick={() => { setModuleKey('all'); setFuncKey('all') }}
          >
            <span className="doc-side-caret is-blank" aria-hidden="true" />
            <span className="doc-side-label">全部</span>
            <span className="doc-side-count">{forModule.length}</span>
          </button>

          {modules.map((m) => {
            const open = m.name === openModule
            const count = forModule.filter((d) => d.module === m.name).length
            return (
              <div key={m.name}>
                {/* 三角不是第二个动作：点它和点文字是同一件事（筛这个模块并展开它）——
                    一个控件两个手势是本仓反复在防的坑。 */}
                <button
                  type="button"
                  className={cn('doc-side-item', normModule === m.name && 'active', !count && 'is-empty')}
                  aria-expanded={open}
                  onClick={() => pickModule(m.name)}
                >
                  <span className={cn('doc-side-caret', open && 'is-open')} aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 6 15 12 9 18" />
                    </svg>
                  </span>
                  <span className="doc-side-label">{m.name}</span>
                  <span className="doc-side-count">{count}</span>
                </button>

                {open ? m.funcs.map((f) => {
                  const fCount = forFunc.filter((d) => d.func === f).length
                  return (
                    <button
                      key={f}
                      type="button"
                      className={cn('doc-side-item is-child', normFunc === f && 'active', !fCount && 'is-empty')}
                      onClick={() => pickFunc(f)}
                    >
                      <span className="doc-side-label">{f}</span>
                      <span className="doc-side-count">{fCount}</span>
                    </button>
                  )
                }) : null}
              </div>
            )
          })}
        </div>

        <div className="doc-side-group">
          <div className="doc-side-title">类型</div>
          <button
            type="button"
            className={cn('doc-side-item', kindKey === 'all' && 'active')}
            onClick={() => setKindKey('all')}
          >
            <span className="doc-side-dot" />
            <span className="doc-side-label">全部类型</span>
            <span className="doc-side-count">{forKind.length}</span>
          </button>
          {/* 7 类全列：0 篇的那几类就是"还没收录" —— 同一个读数只该有一处，而这里是它唯一的落点 */}
          {DOC_KIND_ORDER.map((kind) => {
            const count = kindCount(kind)
            return (
              <button
                key={kind}
                type="button"
                className={cn('doc-side-item', `dk-${kind}`, kindKey === kind && 'active', !count && 'is-empty')}
                style={{ '--dc': 'var(--kc)' } as CSSProperties}
                onClick={() => setKindKey(kind)}
              >
                <span className="doc-side-dot" />
                <span className="doc-side-label">{DOC_KIND_LABEL[kind]}</span>
                <span className="doc-side-count">{count}</span>
              </button>
            )
          })}
        </div>

        <div className="doc-side-group">
          <div className="doc-side-title">来源</div>
          <button
            type="button"
            className={cn('doc-side-item', sourceKey === 'all' && 'active')}
            onClick={() => setSourceKey('all')}
          >
            <span className="doc-side-dot" />
            <span className="doc-side-label">全部来源</span>
            <span className="doc-side-count">{forSource.length}</span>
          </button>
          {sources.map((source) => {
            const count = forSource.filter((d) => d.source === source).length
            return (
              <button
                key={source}
                type="button"
                className={cn('doc-side-item', sourceKey === source && 'active', !count && 'is-empty')}
                onClick={() => setSourceKey(source)}
              >
                <span className="doc-side-dot" />
                <span className="doc-side-label">{source}</span>
                <span className="doc-side-count">{count}</span>
              </button>
            )
          })}
        </div>
      </aside>

      <section className="doc-main">
        {/* ---------------- 工具栏 ---------------- */}
        <section className="card toolbar doc-toolbar-card">
          <div className="search doc-search">
            <span className="search-icon" aria-hidden="true">
              <Icon name="i-search" />
            </span>
            <input
              aria-label="搜索文档"
              autoComplete="off"
              placeholder="搜索文档名 / 来源 / 模块 / 功能…"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
          </div>

          {/* 读数位：只在筛选 / 搜索生效时出现。没筛选时总数由 ③ 的胶囊说，
              缺口由左栏那几个 0 说 —— 都不需要在这里再说一遍。 */}
          {filtering ? (
            <div className="toolbar-summary">
              显示 {shown.length} 篇 / 共 {docs.length} 篇
            </div>
          ) : null}

          <div className="doc-sort-wrap">
            <select
              className="doc-sort"
              aria-label="排序"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
            <span className="doc-sort-chev" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="6 9 12 15 18 9" />
              </svg>
            </span>
          </div>

          <div className="seg">
            {VIEW_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={cn('seg-btn', view === option.value && 'active')}
                aria-pressed={view === option.value}
                onClick={() => setView(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          <button type="button" className="btn btn-primary" onClick={() => setDocModal({ mode: 'create' })}>
            + 新建文档
          </button>
        </section>

        {/* ---------------- 三个视图 ---------------- */}
        {shown.length ? (
          <section className="card doc-views">
            {view === 'shelf' ? (
              /* 书墙：按类型分架。架头的顺序取 `DOC_KIND_ORDER`（不按"哪类多"排）——
                 架头是网格里的一个跨列项，不是"每组一个网格"（后者会让只有 1~2 本的组
                 把书拉成"一行一本"的超宽开本）。架头不写计数：左栏 facet 已经在说，
                 而且它是随另一维变动的动态计数 ⇒ 同一屏两组数字。 */
              <div className="doc-shelf">
                {DOC_KIND_ORDER.map((kind) => {
                  const items = shown.filter((d) => d.kind === kind)
                  if (!items.length) return null
                  return (
                    <Fragment key={kind}>
                      <div className="doc-shelf-head">
                        <span className={cn('shelf-dot', `dk-${kind}`)} />
                        {DOC_KIND_LABEL[kind]}
                      </div>
                      {items.map((doc) => (
                        <DocBook
                          key={doc.id}
                          doc={doc}
                          onOpen={() => setOpenId(doc.id)}
                          /* 书墙上的四件事（原型 `docBookHtml(d, false, true)` 的第三参）——
                             概览 / 运维 / 详情屏那几处不传，所以抽屉只在这一面墙上出现 */
                          actions={{
                            onPreview: () => openSource(doc),
                            onEdit: () => setDocModal({ mode: 'edit', id: doc.id }),
                            onDelete: () => setDocModal({ mode: 'delete', id: doc.id }),
                          }}
                        />
                      ))}
                    </Fragment>
                  )
                })}
              </div>
            ) : null}

            {view === 'list' ? (
              /* 列表：行是这一格的可点元素（整张卡不可点）。
                 行里不写类型：左侧栏的选中项已经说过一次。 */
              <div className="doc-list">
                {shown.map((doc) => (
                  <div
                    key={doc.id}
                    className="doc-item"
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpenId(doc.id)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      setOpenId(doc.id)
                    }}
                  >
                    <div className="doc-info">
                      <div className="doc-name">{highlight(doc.name, keyword)}</div>
                      <div className="doc-meta">
                        {DOC_KIND_LABEL[doc.kind]} · {doc.source} · 更新 {doc.updatedAt} · {doc.author}
                      </div>
                    </div>
                    <div className="doc-arrow">›</div>
                  </div>
                ))}
              </div>
            ) : null}

            {view === 'graph' ? (
              <div className={cn('doc-graph-wrap', !selKey && 'is-plain')}>
                <div className="doc-graph-canvas">
                  <svg
                    className="doc-graph"
                    viewBox={`0 0 ${Math.round(layout.W)} ${Math.round(layout.H)}`}
                    role="img"
                    aria-label={selKey
                      ? `以「${graph.nodes[selKey].name}」为中心的图谱`
                      : `文档关联图谱：${Object.keys(graph.nodes).length} 个节点`}
                  >
                    {/* 边先画（节点压在上面，端点自然被圆点盖住）。
                        同圈的两点画成朝圆心内凹的弧 —— 直线会横穿圆心；跨圈的直接连。 */}
                    {graph.edges.map((edge) => {
                      const p1 = layout.pos[edge.a]
                      const p2 = layout.pos[edge.b]
                      if (!p1 || !p2) return null
                      const sameRing = p1.ring != null && p1.ring === p2.ring
                      const d = sameRing
                        ? `M ${p1.x} ${p1.y} Q ${r1(layout.cx + ((p1.x + p2.x) / 2 - layout.cx) * 0.55)} ${r1(layout.cy + ((p1.y + p2.y) / 2 - layout.cy) * 0.55)} ${p2.x} ${p2.y}`
                        : `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`
                      return (
                        <path
                          key={`${edge.a}-${edge.b}`}
                          className={cn('edge', edge.dashed ? 'edge-task' : 'edge-doc')}
                          d={d}
                        />
                      )
                    })}

                    {/* 点空白处 = 返回总览（读数栏那颗 ✕ 是同一条路的显式版） */}
                    <rect
                      x={0}
                      y={0}
                      width={layout.W}
                      height={layout.H}
                      fill="transparent"
                      onClick={() => setGraphSel(null)}
                    />

                    {Object.keys(layout.pos).map((key) => (
                      <GraphNodeView
                        key={key}
                        node={graph.nodes[key]}
                        p={layout.pos[key]}
                        core={key === selKey}
                        maxDeg={graph.maxDeg}
                        onActivate={() => setGraphSel((prev) => (prev === key ? null : key))}
                      />
                    ))}
                  </svg>

                  {/* 两族边各一句：虚线说不出自己是什么 */}
                  <div className="doc-graph-legend">
                    <span><i className="lg-line" />实线 · 连到另一篇文档（约定 / 参考）</span>
                    <span><i className="lg-line is-dash" />虚线 · 连到任务 / 风险 / 会议（产出 / 风险 / 会议）</span>
                    <span>点节点 = 以它为中心，点空白处返回</span>
                  </div>
                </div>

                {/* 读数栏：正向 / 反向链接逐条列出。点一条 = 换中心继续走（不是打开详情）——
                    探索与跳转不共用一个手势，"打开这一篇"由栏头那颗按钮负责。
                    这一段与详情屏那一张是同一段代码（`GraphReadout` 的两种 mode）——
                       原型也是"同一件事的两种宿主"，各写一份必然开始漂移。 */}
                {selKey ? (
                  <GraphReadout
                    model={graph}
                    centerKey={selKey}
                    mode="home"
                    onOpen={(id) => setOpenId(id)}
                    onFocus={(key) => setGraphSel(key)}
                    onClear={() => setGraphSel(null)}
                    notice={notice}
                  />
                ) : null}
              </div>
            ) : null}
          </section>
        ) : (
          /* 空态替代整块视图容器（不是每个视图各写一份）：
             一次搜索只可能有一个"没有匹配"，写三份就是同一句话说三遍 */
          <section className="card doc-empty">
            <div className="doc-empty-title">这一批是空的</div>
            <div className="doc-empty-meta">换个关键词，或把左侧的模块 / 功能 / 类型 / 来源清掉。</div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setKeyword('')
                setModuleKey('all')
                setFuncKey('all')
                setKindKey('all')
                setSourceKey('all')
              }}
            >
              清空搜索与筛选
            </button>
          </section>
        )}
      </section>

      {/* 第三屏 · 原文：单独一页（fixed 覆盖层，从顶栏下面开始）。
          放在这里而不是路由里：与主页 / 详情共用同一份状态（哪一篇、从哪来），换屏不用跳转。 */}
      {sourceNode}

      {docModal ? (
        <DocModal
          mode={docModal.mode}
          doc={docModal.id ? docs.find((d) => d.id === docModal.id) : undefined}
          docs={docs}
          projectName={projectName}
          /* 新建时把当前筛选带进来：在「用户中心 › 登录鉴权」下点的新建，这四项已经填好了 */
          defaultModule={moduleKey}
          defaultFunc={funcKey}
          onClose={() => setDocModal(null)}
          onDelete={() => setDocModal({ mode: 'delete', id: docModal.id })}
          notice={notice}
        />
      ) : null}
    </div>
  )
}
