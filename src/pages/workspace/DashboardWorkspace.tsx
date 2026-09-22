import { useNavigate } from 'react-router-dom'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { AssistantRail } from '../../components/workbench/AssistantRail'
import { FocusPanel } from '../../components/workbench/FocusPanel'
import { Tile } from '../../components/workbench/Tile'
import { ActivityFeed } from '../../components/detail/ActivityFeed'
import { buildActivity, computeStats } from '../../data/derive'
import { getModule, WORKBENCH_AGG } from '../../data/workbench'
import { useProjects } from '../../hooks/use-projects'
import { useModuleTab } from '../../hooks/use-module-tab'
import { useWorkbenchStore } from '../../stores/workbench-store'
import type { ActivityItem } from '../../types'
import type { ModuleTab } from '../../data/workspace/types'
import { MODULE_BASE_PATH } from '../../data/workspace/nav'

/**
 * 工作台（`/home`）—— **与其余八域同一套外壳**。
 *
 * ============================================================================
 * 它以前不是这样：那一版是"自成一体的全屏页"，不走 AppShell
 * ============================================================================
 *
 * 旧版（`pages/WorkbenchPage.tsx`，仍在仓库里但已无路由指向）是：
 * 旧玻璃横带顶栏 + 九模块**径向大环** + 今日焦点 + 45 磁贴 + 助手栏，
 * 九域由那个环表达。统一到原型那套之后：
 *
 *   · 九域由**顶栏**表达（`ShellTopbar`，与其余八页同一个组件、同一份 `WORKSPACE_NAV`）；
 *   · 侧栏的环装的是**工作台自己的三个分区**（原型 `primaryConfig.dashboard.items` 就是这三项）；
 *   · 主区是分区面板，助手栏走 `rail`（与项目域同一套三栏）。
 *
 * ⚠️ **径向大环下线了**。理由不是它不好，而是**同一屏里九域只能有一个载体**：
 *    顶栏一挂上去，那个环与它就变成同一件事的两种表达 —— 这正是项目自己立过的判据
 *    （`workbench-hero.css` 撤"指针射线"时写的：同一件事被三处表达时，最弱的那个就是噪音）。
 *    环本身没删：侧栏那个 `RingNav` 复用的就是它的罗盘与类名，它仍是共享资产。
 *
 * ⚠️ **代价（明写）**：旧版那个环还兼职"不离开首页预览另外八个模块的磁贴"。
 *    统一之后这条路径没了 —— 现在看别的模块走顶栏，落到各自的页面。
 *    那 45 块磁贴没有被删（`data/workbench-content.ts` + `Tile` + 指纹守卫都还在），
 *    只是本页只渲染工作台自己那一档（`home`，5 块）。
 *
 * ============================================================================
 * 三个分区，逐条说清数据从哪来
 * ============================================================================
 *
 * | 分区 | 来源 | 说明 |
 * | --- | --- | --- |
 * | 今日概览 | `computeStats(PROJECTS)` + `WORKBENCH_AGG` + `getModule('home')` | 全真实 |
 * | 最近活动 | `buildActivity(project)` × 8 个项目 | 全真实（与项目详情页同一套派生） |
 * | AI 简报 | —— | **没有后端**，明写占位 |
 *
 * ⚠️ **只用内核里"按 `.mw-root` 作用域"的那批类名**（`.card` / `.card-title` / `.stat` /
 *    `.stat-desc` / `.grid-3` / `.btn` …）。像 `.ov-kpi` / `.doc-meta` / `.detail-text`
 *    这些看起来也很通用，但它们全都被收在**某一个模块**下（`[data-module='projects']` 之类）——
 *    在 `data-module='dashboard'` 上一条都不匹配。
 *    实测过一次：`grep` 出来的 `.doc-meta` 只出现在 life/work/learning/projects 里。
 *    判据：**复用类名之前先确认那条规则的作用域**，别按名字像不像选。
 */
const DASHBOARD_TABS: ModuleTab[] = [
  { key: 'overview', label: '今日概览' },
  { key: 'recent', label: '最近活动' },
  { key: 'briefing', label: 'AI 简报' },
]

/** 助手栏状态行的口径：与工作台摘要同源，不另算一套 */
const RAIL_STATUS = `已接入 ${WORKBENCH_AGG.TASKS.total} 条任务`

export function DashboardWorkspace() {
  const { active, select } = useModuleTab(MODULE_BASE_PATH.dashboard, DASHBOARD_TABS)

  return (
    <WorkspaceLayout
      module="dashboard"
      tabs={DASHBOARD_TABS}
      active={active}
      onSelectTab={select}
      rail={<DashboardRail />}
    >
      {active === 'overview' ? <OverviewPanel /> : null}
      {active === 'recent' ? <RecentPanel /> : null}
      {active === 'briefing' ? <BriefingPanel /> : null}
    </WorkspaceLayout>
  )
}

/** 助手栏 —— 走外壳的 `rail` 槽（右栏），与项目域同一套三栏栅格 */
function DashboardRail() {
  const collapsed = useWorkbenchStore((state) => state.railCollapsed)
  const toggle = useWorkbenchStore((state) => state.toggleRail)
  return (
    <AssistantRail
      messages={getModule('home').chat}
      collapsed={collapsed}
      onToggle={toggle}
      statusLine={RAIL_STATUS}
    />
  )
}

/* ---------- 今日概览 ---------- */

/**
 * 今日概览 —— 原型的 `dashboard` 主区形状：一句副标题 + 一排 KPI 卡 + 一条列表。
 *
 * ⚠️ 原型那四张卡写的是「今日任务 3/8 · 今日日程 3 · 进行项目 4 · 本周学习 8.5h」。
 *    其中「今日日程」「本周学习」在应用里**没有口径**（没有全局日程表、也没有学习时长表），
 *    所以这里换成三张有来源的（进行中 / 风险 / 任务完成）+ 平均进度。
 *    **不编数字**是项目铁律：宁可四张卡里三张同族，也不去凑原型那几个字。
 *    判据：`stats` 全部由 `projects.ts` 的 8 个项目派生，项目增删它们就跟着动。
 */
function OverviewPanel() {
  const navigate = useNavigate()
  const { data: projects = [], isLoading } = useProjects()
  const stats = computeStats(projects)
  const home = getModule('home')

  const kpis: Array<{ label: string; value: string; sub: string; color: string; to: string }> = [
    {
      label: '进行中项目',
      value: String(stats.active),
      sub: `共 ${stats.total} 个 · 生活 ${stats.scopeCounts.life} / 工作 ${stats.scopeCounts.work} / 学习 ${stats.scopeCounts.learn}`,
      color: 'var(--mw-m-main)',
      to: '/projects',
    },
    {
      label: '风险阻塞',
      value: String(stats.risk),
      sub: stats.risk ? '需要先看这几个' : '没有阻塞中的项目',
      color: 'var(--c-error)',
      to: '/projects',
    },
    {
      label: '任务完成',
      value: `${WORKBENCH_AGG.TASKS.done} / ${WORKBENCH_AGG.TASKS.total}`,
      sub: `完成率 ${WORKBENCH_AGG.TASKS.rate}% · 待办 ${WORKBENCH_AGG.TASKS.todo}`,
      color: 'var(--c-success)',
      to: '/tasks',
    },
    {
      label: '平均进度',
      value: `${stats.averageProgress}%`,
      sub: `已完成 ${stats.done} 个`,
      color: 'var(--c-info)',
      to: '/projects',
    },
  ]

  return (
    <>
      {/* 原型的 `.page-subtitle`：一句话说清"这一屏在讲什么"。
          数字来自 `home.summary`（生成物，与工作台摘要同源），不是现编的。 */}
      <div className="stat-desc">{home.summary}</div>

      {/* ⚠️ 刻意**不用**内核的 `.grid-3`：它是 `auto-fill minmax(200px, 1fr)`，
          而工作台主区的可用宽度（1440 − 侧栏 300 − 助手栏 340 − 间距）只有 ~700px ——
          四张卡会排成 3 + 1，右下留一块空洞。四张卡就写四列关系，别交给容器自动填。 */}
      <div className="grid grid-cols-2 gap-4 max-[640px]:grid-cols-1" role="list" aria-label="关键指标">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="card"
            role="listitem"
            tabIndex={0}
            onClick={() => navigate(kpi.to)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') navigate(kpi.to)
            }}
            style={{ cursor: 'pointer' }}
          >
            <div className="card-title">{kpi.label}</div>
            <div className="stat" style={{ color: kpi.color }}>
              {isLoading ? '—' : kpi.value}
            </div>
            <div className="stat-desc">{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* 今日焦点 —— 原型 `.section` 那一块的等价物。
          ⚠️ 用 `home` 这一档的 focus：它是生成物里唯一"全域"的那一档
             （其余八档是各模块自己的）。 */}
      <section className="card" aria-label="今日焦点">
        <div className="card-title">今日焦点</div>
        <FocusPanel items={home.focus} emptyHint="没有需要优先处理的项目" />
      </section>

      {/* 模块面板：只渲染 `home` 那一档的 5 块磁贴。
          其余八档（共 45 块）仍在 `data/workbench-content.ts` 里，只是本页不再切档 —— 见文件头。 */}
      <section aria-label="全域概览">
        <div className="grid grid-cols-2 gap-4 max-[1000px]:grid-cols-1">
          <div className="col-span-2 grid grid-cols-3 gap-4 max-[1000px]:col-span-full max-[860px]:grid-cols-2 max-[600px]:grid-cols-1">
            {home.tiles.slice(0, 3).map((tile, i) => (
              <Tile key={`${home.key}-${i}`} tile={tile} />
            ))}
          </div>
          {home.tiles.slice(3).map((tile, i) => (
            <Tile key={`${home.key}-l${i}`} tile={tile} />
          ))}
        </div>
      </section>
    </>
  )
}

/* ---------- 最近活动 ---------- */

/**
 * 最近活动 —— 八个项目的动态流。
 *
 * 数据来源与项目详情页的「动态」**同一个函数**（`buildActivity`），
 * 所以这里的每一条在它所属项目里都能找到出处（不是另造一份流水）。
 *
 * ⚠️ 跨项目拼接时显式给 id 带上项目前缀：`ActivityFeed` 用 `key={item.id}`，
 *    而 `buildActivity` 的 id 是 `<projectId>-a<n>` —— 现在不会撞，
 *    但把它写成显式前缀，就不必依赖那个上游约定（改了会静默变成"少渲染几条"）。
 */
function RecentPanel() {
  const { data: projects = [], isLoading } = useProjects()

  const feed: ActivityItem[] = projects
    .flatMap((project) => buildActivity(project).slice(0, 1).map((item) => ({ ...item, id: `${project.id}/${item.id}` })))
    .slice(0, 12)

  if (isLoading) {
    return (
      <div className="card">
        <div className="stat-desc">正在读取动态…</div>
      </div>
    )
  }

  if (!feed.length) {
    return (
      <div className="card">
        <div className="stat-desc">还没有动态 —— 项目里产生变更之后这里会跟着长</div>
      </div>
    )
  }

  return (
    <section className="card" aria-label="最近活动">
      <div className="card-title">最近活动</div>
      <div className="stat-desc" style={{ marginBottom: 16 }}>
        每个项目取最近一条 · 共 {feed.length} 条
      </div>
      <ActivityFeed activity={feed} />
    </section>
  )
}

/* ---------- AI 简报 ---------- */

/**
 * AI 简报 —— **占位，不是空壳**。
 *
 * 原型这一格是预置的两段对话。应用里**没有后端**（MEMORY 的待办：助手问答没有后端），
 * 所以它不能靠"照搬那两段"来交付 —— 那是编内容。
 *
 * 但也不能做成空的：用户分不清"没做"和"卡住"，那是最贵的一种缺陷
 * （`PendingDetail.tsx` 的注释里已经把这个判据写下来了）。
 * 所以这里把**缺的是哪一步、事实源在哪**写在明面上。
 */
function BriefingPanel() {
  return (
    <section className="card" aria-label="AI 简报">
      <div className="card-title">AI 简报</div>
      <p className="stat-desc" style={{ lineHeight: 1.7 }}>
        这一格需要<b>后端</b>才能有内容，目前没有接入。
      </p>
      <p className="stat-desc" style={{ lineHeight: 1.7, marginTop: 8 }}>
        缺的不是界面，是那份"把项目、任务、日程汇总成一段话"的服务：应用里已有的派生层
        （<code>src/data/derive.ts</code>）只做到逐项目的统计与动态，没有跨域的叙事生成。
        接入之后再把这一格换成真实简报。
      </p>
      <p className="stat-desc" style={{ lineHeight: 1.7, marginTop: 8 }}>
        在那之前，助手栏（右栏）是唯一有对话的地方 —— 它那份内容同样是预置的，
        真正的问答要等同一个后端。
      </p>
    </section>
  )
}
