/**
 * work 模块的分区标记（原来由 `design/gen-workspace-pages.mjs` 从
 * `design/work/work_index.html` 生成，那份生成链已退役 —— 这一份现在是
 * 手写维护的：改它不必再跑脚本，但也没有门禁替你比对原型了）。
 *
 * 这里只有标记，没有行为：每个 onclick 都被翻译成 `handlers.xxx(...)`，
 * 实现写在手写的 <WorkWorkspace />（同目录）。
 *
 * ============================================================================
 * 2026-09-25 · 分区 12 → 7（用户定的口径）
 * ============================================================================
 *
 * 工作模块的侧栏不是普通列表，是分区环（`WorkspaceLayout` → `ShellSidebar`
 * → `RingNav`），环上的项数 = 本文件 `TABS` 的长度。所以这次收敛直接受益的是几何：
 * 相邻标签的中心距是 `2 · rl · sin(π/n)`（rl = 118px，见 RingNav 文件头），
 * n = 12 时只有 61px，标签被迫压到 `max-width: 58px` 才不叠字；
 * n = 7 时是 102px，标签能完整读出。环的刻度不用动。
 *
 * 并入关系（原 12 项 → 现 7 项，一个新分区都没造，全是合并）：
 *
 * | 现分区 | 标签 | 收了谁 |
 * | --- | --- | --- |
 * | `dashboard` | 工作台 | 原样（它本来就有「今日任务 / 今日会议」两块摘要）＋原 `calendar` 的「本周会议」 |
 * | `tasks` | 任务 | 原样 |
 * | `projects` | 项目 | 原样（手写组件 `ProjectShelf`） |
 * | `servers` | 服务器 | ＋原 `deploy` 的「部署记录」「部署文档」 |
 * | `docs` | 文档索引 | ＋「部署手册类」5 条（原 `deploy` 的文档列表） |
 * | `contacts` | 客户与联系人 | 原 `clients` ＋原 `contacts` |
 * | `review` | 复盘 | 原 `review` ＋原 `timesheet` ＋原 `okr` |
 *
 * 撤掉的 5 个 key（`deploy` / `calendar` / `clients` / `okr` / `timesheet`）
 * 没有留重定向，这是有意的：`useModuleTab` 对未知 Tab 的纪律是
 * 「静默回落到首个 Tab」（见它的文件头 ②），于是老地址 `/work/deploy` 会稳稳
 * 落在工作台上、高亮也在工作台上 —— 不会白屏、也不会两边不一致。
 * 要留 301 得动 `useModuleTab`，而那是九个模块共用的，为一个模块的口径改它不划算。
 *
 * 以下分区不在这里 —— 它们要状态或要按数据渲染，是手写组件：
 *      projects → src/components/workspace/work/ProjectShelf.tsx
 *      contacts → src/components/workspace/work/ClientsContacts.tsx（角色筛选）
 */

import { ToggleRow, TaskCheck, TaskText } from '../../../components/workspace/toggles'
import { DocLibrary } from '../../../components/workspace/project-detail/DocLibrary'
import { WORK_DOC_INDEX } from '../../../data/workspace/work-docs'
import { toast } from '../../../stores/toast-store'
import { WorkbenchPanel } from '../../../components/workspace/work/WorkbenchPanel'
import { ServersLedger } from '../../../components/workspace/work/ServersLedger'

import type { ModuleTab } from '../../../data/workspace/types'

/**
 * Tab 定义（键 + 标签）。标签同时是顶栏面包屑的尾段与环上那七个标签。
 *
 * 只有第一个 Tab 用裸路径（`/work`）—— 这是 `useModuleTab` 的约定，
 * `tabPath` 按 `i === 0` 生成环上的地址，两处必须同一个算法。
 */
export const TABS: ModuleTab[] = [
  { key: 'dashboard', label: '工作台' },
  { key: 'tasks', label: '任务' },
  { key: 'projects', label: '项目' },
  { key: 'servers', label: '服务器' },
  { key: 'docs', label: '文档索引' },
  { key: 'contacts', label: '客户与联系人' },
  { key: 'review', label: '复盘' },
]

/** 本模块所有交互回调 —— 实现写在 <WorkWorkspace /> 里。 */
export interface Handlers {
  notice: (arg0: string) => void
  openClient: (arg0: string) => void
}

export const MODAL_SPECS = {
} as const

export type ModalKey = keyof typeof MODAL_SPECS

/**
 * 工作台（`/work`）—— 2026-09-28 按原型 `work_index.html` 的 `[data-panel="dashboard"]` 换版：
 * 上两卡（项目 / 文档）+ 下卡（今日任务）。用户口径与六处有意不同写在
 * `components/workspace/work/WorkbenchPanel.tsx` 的文件头。
 *
 * 上一版那几张卡（打招呼、今日/本周会议、进行中项目、最近文档）随原型一起下线：
 *    原型这一版把工作台收成"常用的三块"（项目 / 文档 / 今日任务），
 *    会议那两张卡在原型里属于 `calendar` 分区 —— 而应用的工作模块已经把 calendar 收敛掉了
 *    （见本文件头那张对照表），所以这一段内容在本页就地结束，不是漏迁。
 * 这一页要状态（三组视图 / 收藏 / 放大层）⇒ 与 `ClientsContacts` / `ProjectDrawers`
 *    同一条判据：要状态就搬去独立组件，本文件只留一行套壳。
 */
export function DashboardPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return <WorkbenchPanel />
}

export function TasksPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="card">
      <div className="card-title">工作任务</div>
      <ToggleRow className="task-item">
      <div className="task-check done">✓</div>
      <TaskText>修复登录页样式</TaskText>
      <span className="task-tag">已完成</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <div className="task-check done">✓</div>
      <TaskText>代码评审</TaskText>
      <span className="task-tag">已完成</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <TaskCheck />
      <TaskText>准备项目评审</TaskText>
      <span className="task-tag">进行中</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <TaskCheck />
      <TaskText>更新接口文档</TaskText>
      <span className="task-tag">待办</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <TaskCheck />
      <TaskText>优化首页加载速度</TaskText>
      <span className="task-tag">待办</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <TaskCheck />
      <TaskText>排查线上告警</TaskText>
      <span className="task-tag">待办</span>
      </ToggleRow>
      </section>
    </>
  )
}

/**
 * 服务器（`/work/servers`）—— 2026-09-29 按原型 `工作-服务器-index.html` 换版：
 * 跨项目的机器台账（页头 + 三格仪表 + 筛选栏 + 卡片墙，两个视角）。
 *
 * 上一版那一整页静态标记（8 台机器的假清单 + 部署记录 + 部署文档 + 安全与边界）
 *    随原型一起下线：原型把这一页重新定义成"跨项目的机器台账"，
 *    部署记录与部署文档在原型里属于项目的运维分区（那是"进了项目之后"的事），
 *    而应用的运维分区早就有它们了。所以那两块不是漏迁 —— 是本页不该再重复一遍。
 *
 * 这一页要状态（视角 / 两组筛选 / 浮层 / 文件抽屉 / 二次确认 / 整页表单）
 *    ⇒ 与 `ClientsContacts` / `ProjectDrawers` / `WorkbenchPanel` 同一条判据：
 *    要状态就搬去独立组件，本文件只留一行套壳。
 */
export function ServersPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return <ServersLedger />
}

/* ----------------------------------------------------------------------------
   2026-09-25 移除的两个面板：`DeployPanel`（部署）与 `CalendarPanel`（日历会议）
   ----------------------------------------------------------------------------
   它们不是被删掉，是被搬进别的分区了，所以这里留一条指路，免得下次有人
   在原型里又看到 `data-panel="deploy"` 就把它当成"漏迁的分区"补回来：

     DeployPanel   → 部署记录 · 部署文档  → `ServersPanel`（服务器）
                     其中「部署手册类」5 条另在 `DocsPanel`（文档索引）里出现 ——
                     那是用户要的两处：一处是运维现场用的清单，一处是全站文档的可检索入口。
     CalendarPanel → 今日会议（原本就已在 `DashboardPanel` 里）＋ 本周会议 → `DashboardPanel`（工作台）

   撤掉的 key：`deploy` / `calendar` / `clients` / `okr` / `timesheet`（共 5 个，
   `TABS` 12 → 7）。老地址会静默落到工作台，判据见文件头。
   ---------------------------------------------------------------------------- */

/* ----------------------------------------------------------------------------
   文档索引（`/work/docs`）—— 整页复用项目详情「文档」那一格的布局与组件
   ----------------------------------------------------------------------------
   2026-09-27：这一页从"一张卡 + 9 条 emoji 卡片行"换成 `DocLibrary` ——
   左栏两级目录 + 工具栏（搜索 / 读数位 / 排序 / 三视图 / 新建）+ 书墙 / 列表 / 图谱
   + 主从详情屏。与 `design/project/项目-文档主页-index.html` 是同一个布局、同一个组件。

   这一页的两个维度换了语义：粗的那层是项目、细的是"这条索引属于该项目的哪一类"
      （核心方案 / 接口契约 / 部署运维 …）⇒ 左栏标题传「项目与分类」。
      槽是通用的，标题由调用方给 —— 写死"模块与功能"会让这一页说不出自己在筛什么。
   清单在 `data/workspace/work-docs.ts`（跨项目，不进 `POOL`），理由写在那个文件头。
   这一页没有写接口 ⇒ 新建文档那一颗按钮走 `toast` 的诚实回执（组件内已有口径）。
   ---------------------------------------------------------------------------- */
export function DocsPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <DocLibrary
      docs={WORK_DOC_INDEX}
      projectName="工作模块"
      groupLabel="项目与分类"
      notice={(text) => toast(text)}
    />
  )
}

/* ----------------------------------------------------------------------------
   2026-09-25 合并掉的两个面板：`ContactsPanel`（联系人）与 `ClientsPanel`（客户资料）
   ----------------------------------------------------------------------------
   合并成「客户与联系人」= `contacts`，但没有留在本文件 —— 它要一个角色筛选，
   而筛选是状态（`useState`），静态标记表达不了。按 `ProjectShelf` 的同一条判据
   （"要状态或要按数据渲染 ⇒ 手写组件"）移到：

     src/components/workspace/work/ClientsContacts.tsx

   内容一个都没丢：客户资料库 4 张卡（`handlers.openClient` 原样）、最近资料 4 条、
   客户统计 3 格、联系人 4 位 —— 全在那份手写组件里，只是排布重新组织过。
   ---------------------------------------------------------------------------- */


/**
 * 复盘 —— 工作模块的「复盘」分区（`/work/review`）。
 *
 * 2026-09-25 由三个分区合并而来：`review`（周报复盘）＋ `timesheet`（工时）＋ `okr`（OKR/KPI）。
 *
 * 排布口径：先量后述。工时与 OKR 都是可核对的数字，放前面；文字复盘是主观归纳，
 * 放最后。顺序反过来读的人会先读到一段散文，再回头找它对应的数字 —— 那一找就散了。
 *
 * 三块的内容是原样搬来的，一个数字都没改（包括「目标 40h / 本周 32h」这类
 *    对不上的地方 —— 那是原设计样本的口径，不是这次合并要解决的问题）。
 * 唯一新增的标记是「文字复盘」那行 `card-title`：原来它是页面里唯一的卡片，
 *    没有标题也不突兀；现在一页四张卡，只有它没标题就会显得是块漏了头的残留。
 */
export function ReviewPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="grid-3">
      <div className="card">
      <div className="card-title">本周工时</div>
      <div className="stat">32h</div>
      <div className="stat-desc">目标 40h</div>
      </div>
      <div className="card">
      <div className="card-title">本月工时</div>
      <div className="stat">142h</div>
      <div className="stat-desc">平均 8h / 天</div>
      </div>
      <div className="card">
      <div className="card-title">加班</div>
      <div className="stat">6h</div>
      <div className="stat-desc">本月</div>
      </div>
      </section>
      <section className="card">
      <div className="card-title">2026 Q3 OKR</div>
      <div className="okr-item">
      <div className="okr-title">O1：提升系统稳定性</div>
      <div className="okr-desc">KR1：线上故障数下降 50%</div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: "70%" }}></div></div>
      <div className="progress-label"><span>70%</span><span>目标 50% 下降</span></div>
      </div>
      <div className="okr-item">
      <div className="okr-title">O2：交付支付系统重构</div>
      <div className="okr-desc">KR1：完成核心链路重构</div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: "62%" }}></div></div>
      <div className="progress-label"><span>62%</span><span>截止 10-31</span></div>
      </div>
      <div className="okr-item">
      <div className="okr-title">O3：提升团队效率</div>
      <div className="okr-desc">KR1：CI 构建时间缩短 40%</div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: "45%" }}></div></div>
      <div className="progress-label"><span>45%</span><span>目标 40% 缩短</span></div>
      </div>
      </section>
      <section className="card">
      <div className="card-title">本周工时明细</div>
      <div className="timesheet-row">
      <span>支付系统重构</span>
      <span className="timesheet-value">14h</span>
      </div>
      <div className="timesheet-row">
      <span>用户中心改版</span>
      <span className="timesheet-value">8h</span>
      </div>
      <div className="timesheet-row">
      <span>数据看板</span>
      <span className="timesheet-value">5h</span>
      </div>
      <div className="timesheet-row">
      <span>会议</span>
      <span className="timesheet-value">3h</span>
      </div>
      <div className="timesheet-row">
      <span>代码评审</span>
      <span className="timesheet-value">2h</span>
      </div>
      </section>
      <section className="card">
      <div className="card-title">文字复盘</div>
      <div className="review-block">
      <div className="review-label">本周完成</div>
      <ul className="review-list">
      <li>完成支付系统重构方案评审</li>
      <li>修复登录页样式问题</li>
      <li>完成 3 次代码评审</li>
      <li>更新接口设计规范</li>
      </ul>
      </div>
      <div className="review-block">
      <div className="review-label">下周计划</div>
      <ul className="review-list">
      <li>支付系统核心链路重构</li>
      <li>用户中心改版接口联调</li>
      <li>数据看板验收</li>
      </ul>
      </div>
      <div className="review-block">
      <div className="review-label">问题与阻塞</div>
      <ul className="review-list">
      <li>支付系统依赖第三方接口，联调延迟</li>
      <li>用户中心改版需求有变更</li>
      </ul>
      </div>
      <div className="review-block">
      <div className="review-label">经验沉淀</div>
      <ul className="review-list">
      <li>重构前先做接口梳理，减少返工</li>
      <li>代码评审提前介入，效果更好</li>
      </ul>
      </div>
      </section>
    </>
  )
}

/**
 * 顶栏动作区 —— 原型的 `.topbar-actions` 里的按钮。
 *
 * 为什么要生成：这排按钮每个模块都不一样（任务页是「AI 拆解 / 新建任务」，
 * 生活页是「快速记录」，设置页一个都没有）。只把它们交给外壳会全丢掉 ——
 * 而且丢得没有声响：外壳照常渲染，只是那排主入口不存在了。
 * 主题开关已从这里剔掉（外壳自己提供一份，全站只能有一个主题开关）。
 */
export function TopbarActions({ handlers }: { handlers: Handlers }) {
  return (
    <>
      <button className="btn btn-ghost" id="quickAdd" onClick={() => handlers.notice('原型演示：快速记录')}>+ 快速记录</button>
    </>
  )
}
