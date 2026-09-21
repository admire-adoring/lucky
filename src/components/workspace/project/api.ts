import type { Project } from '../../../types'
import type { WsDoc, WsEdge, WsMilestone, WsNote, WsReview, WsTask, WsActivity } from '../../../data/workspace/project'

/**
 * 项目工作区里所有子组件共用的契约。
 *
 * 为什么收成一个对象而不是逐个传 props：这个工作区的**数据与动作是交叉消费的** ——
 * 右栏要读任务和笔记、概览要读任务与里程碑、图谱要读文档和笔记、
 * 笔记详情要读任务（关联任务）。逐个传会得到每个组件 8~12 个 props，
 * 而且加一个动作就要改一圈签名。一个对象进、一个对象出，组件之间也不互相 import 数据。
 *
 * 与生成物那边的做法一致（`<模块>Handlers`），所以两种页面读起来是同一种结构。
 */
export interface ProjectApi {
  /* ---- 数据 ---- */
  project: Project
  tasks: WsTask[]
  milestones: WsMilestone[]
  docs: WsDoc[]
  activity: WsActivity[]
  notes: WsNote[]
  edges: WsEdge[]
  review: WsReview
  /** 非 null 表示复盘正在编辑；编辑期读它、只读期读 `review` */
  reviewDraft: WsReview | null

  /* ---- 动作 ----
     ⚠️ 原型里还有三个"点一下就变"的头部交互（状态徽标循环、优先级徽标循环、
     点进度条设进度）。**这三个没有移植**，因为它们在这里会变成谎言：
     原型是演示稿，循环出来的假状态无所谓；而这个页面显示的是真实项目数据，
     点一下把「进行中」改成「验收」而背后什么都没变，就是在骗人。
     头部因此是只读的 —— 要改状态就走真正的编辑入口（尚未实现）。 */
  toggleTask: (id: string) => void
  captureNote: (text: string) => void
  toggleStar: (id: string) => void
  startReviewEdit: () => void
  cancelReviewEdit: () => void
  saveReview: () => void
  updateDraft: (next: WsReview) => void
  /** 打开文档 / 笔记（会同时把 Tab 切过去） */
  openDoc: (id: string) => void
  openNote: (id: string) => void
  /** 跨 Tab 跳转：概览里那些「→」 */
  gotoTab: (tab: string) => void
  gotoTabView: (tab: string, view: string) => void
  /** 原型里的占位动作。接到应用的 toast，不用 alert（会阻塞渲染线程） */
  notice: (text: string) => void

  /* ---- 图谱的节点三件套 ----
     节点 = 文档 + 笔记派生，边 = `edges` 派生（图是渲染结果，不是第二份数据）。
     这三个函数由页面从 docs / notes / edges 现算，组件只调用 ——
     否则每个用到"反向链接"的地方都要自己再查一遍表，迟早出现两处口径。 */
  nodeKind: (id: string) => 'doc' | 'note'
  nodeLabel: (id: string) => string
  neighbors: (id: string) => string[]

  /* ---- 图谱的选中态 ----
     图上的点、清单里的行、详情卡里的「关系」是**同一个动作**（选中），
     三处都要读同一个值，所以放在 api 里由页面持有。 */
  selectedNode: string | null
  selectNode: (id: string | null) => void
}
