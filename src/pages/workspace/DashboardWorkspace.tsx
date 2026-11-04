import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { AssistantRail } from '../../components/workbench/AssistantRail'
import { computeStats } from '../../data/derive'
import { SCOPE_META } from '../../data/meta'
import { getModule } from '../../data/workbench'
import { updateAiFacts } from '../../data/ai/facts'
import { useProjects, useRecentActivity } from '../../hooks/use-projects'
import { useModuleTab } from '../../hooks/use-module-tab'
import { useWorkbenchStore } from '../../stores/workbench-store'
import { MODULE_BASE_PATH } from '../../data/workspace/nav'
import { DASHBOARD_TABS } from '../../data/workspace/tabs'
import { STATUS_LABEL } from '../../components/projects/project-meta'

/**
 * 工作台（`/home`）—— 与其余八域同一套外壳。
 *
 * ============================================================================
 * 它以前不是这样：那一版是"自成一体的全屏页"，不走 AppShell
 * ============================================================================
 *
 * 旧版（`pages/WorkbenchPage.tsx`，已删除）是：
 * 旧玻璃横带顶栏 + 九模块径向大环 + 今日焦点 + 45 磁贴 + 助手栏，
 * 九域由那个环表达。统一到原型那套之后：
 *
 *   · 九域由顶栏表达（`ShellTopbar`，与其余八页同一个组件、同一份 `WORKSPACE_NAV`）；
 *   · 侧栏的环装的是工作台自己的三个分区（原型 `primaryConfig.dashboard.items` 就是这三项）；
 *   · 主区是分区面板，助手栏走 `rail`（与项目域同一套三栏）。
 *
 * 径向大环下线了。理由不是它不好，而是同一屏里九域只能有一个载体：
 *    顶栏一挂上去，那个环与它就变成同一件事的两种表达 —— 这正是项目自己立过的判据
 *    （`workbench-hero.css` 撤"指针射线"时写的：同一件事被三处表达时，最弱的那个就是噪音）。
 *    环本身没删：侧栏那个 `RingNav` 复用的就是它的罗盘与类名，它仍是共享资产。
 *
 * 代价（明写）：旧版那个环还兼职"不离开首页预览另外八个模块的磁贴"。
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
 * | 今日概览 | `computeStats(projects)` + `useProjects()` | 全真实 |
 * | 最近活动 | `useRecentActivity()` → `project_recent_activity` | 全真实（跨项目动态流） |
 * | 今日简报 | `useProjects()` 规则生成 | 全真实（基于项目/任务/风险数据） |
 *
 * 只用内核里"按 `.mw-root` 作用域"的那批类名（`.card` / `.card-title` / `.stat` /
 *    `.stat-desc` / `.grid-3` / `.btn` …）。像 `.ov-kpi` / `.doc-meta` / `.detail-text`
 *    这些看起来也很通用，但它们全都被收在某一个模块下（`[data-module='projects']` 之类）——
 *    在 `data-module='dashboard'` 上一条都不匹配。
 *    实测过一次：`grep` 出来的 `.doc-meta` 只出现在 life/work/learning/projects 里。
 *    判据：复用类名之前先确认那条规则的作用域，别按名字像不像选。
 */
/* 这三个分区的定义已搬到 `data/workspace/tabs.ts`（`DASHBOARD_TABS`）——
   顶栏超级菜单要列"任意模块"的二级，需要一张全局的 Tab 注册表（其余七域各有
   `panels.tsx` 里的 `TABS`，工作台这一份原本只活在本文件里）。
   留在这里会让注册表反向 import 本页面，形成
   `ShellTopbar → tabs.ts → DashboardWorkspace → WorkspaceLayout → ShellTopbar` 的环。
   改分区请改那边，别在这里补一份。 */

/** 助手栏状态行：任务总量从真实项目数据算 */
function DashboardRail() {
  const collapsed = useWorkbenchStore((state) => state.railCollapsed)
  const toggle = useWorkbenchStore((state) => state.toggleRail)
  const { data: projects = [] } = useProjects()
  useEffect(() => {
    updateAiFacts(projects)
  }, [projects])
  const taskTotal = projects.reduce((sum, p) => sum + p.tasksTotal, 0)
  return (
    <AssistantRail
      messages={getModule('home').chat}
      collapsed={collapsed}
      onToggle={toggle}
      statusLine={`已接入 ${taskTotal} 条任务 · ${projects.length} 个项目`}
    />
  )
}

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

/* ---------- 今日概览 ---------- */

/**
 * 今日概览（2026-10-18 改版）—— 三张窄指标卡 + 项目明细 + 关键节点。
 *
 * 上一版是四张大 KPI 卡 + 今日焦点 + 5 块磁贴：一屏只装得下四个数，主区大半是空白。
 * 这一版把"看总量"压成三张 150px 的卡（域完成度 / 任务总量 / 风险与到期），
 * 腾出的高度给两张真要读的表：
 *   · 项目明细 —— 八个项目按进度降序，一行看全"名字 / 状态 / 截止 / 任务 / 进度"；
 *   · 关键节点 —— 风险（红点）与各项目当前里程碑（绿点），今日焦点那几条并入这里。
 *
 * 数据口径一条没变：`computeStats` / `WORKBENCH_AGG` / `useProjects` / `buildMilestones`。
 * 磁贴与今日焦点不再渲染（组件与数据都还在，只是首页不摆 —— 见文件头"代价"那段）。
 */
function OverviewPanel() {
  const navigate = useNavigate()
  const { data: projects = [], isLoading } = useProjects()
  const stats = computeStats(projects)
  const home = getModule('home')

  /* 真实项目数据到达时更新 AI 事实层 —— 助手栏与 AI 页共用 */
  useEffect(() => {
    updateAiFacts(projects)
  }, [projects])

  /* 任务总量从真实项目数据算 —— 不再读静态聚合 */
  const taskTotal = projects.reduce((sum, p) => sum + p.tasksTotal, 0)
  const taskDone = projects.reduce((sum, p) => sum + p.tasksDone, 0)
  const taskTodo = taskTotal - taskDone
  const taskRate = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0
  const tasks = { total: taskTotal, done: taskDone, todo: taskTodo, rate: taskRate }

  /** 三个业务域的平均进度 —— 柱高就是它；域里没项目时给 0（柱仍然占位） */
  const scopeBars = useMemo(
    () =>
      (['life', 'work', 'learn'] as const).map((scope) => {
        const list = projects.filter((project) => project.scope === scope)
        const avg = list.length
          ? Math.round(list.reduce((sum, project) => sum + project.progress, 0) / list.length)
          : 0
        return { scope, label: SCOPE_META[scope].label, avg, count: list.length }
      }),
    [projects],
  )

  /** 到期按月：从本月起四个月。有风险项目（或已延期）的月份标红 */
  const monthBars = useMemo(() => {
    const now = new Date()
    return Array.from({ length: 4 }, (_, i) => {
      const at = new Date(now.getFullYear(), now.getMonth() + i, 1)
      const key = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`
      const list = projects.filter((project) => project.dueDate.startsWith(key))
      return {
        label: `${at.getMonth() + 1}月`,
        count: list.length,
        risky: list.some((project) => project.status === 'risk' || project.daysLeft < 0),
      }
    })
  }, [projects])
  const maxMonth = Math.max(1, ...monthBars.map((bar) => bar.count))

  /** 项目明细：进度高的在前（与参考版式一致，完成度一眼从高到低） */
  const rows = useMemo(() => [...projects].sort((a, b) => b.progress - a.progress), [projects])

  /** 关键节点：风险在前、里程碑在后；里程碑用项目自身的当前里程碑字段 */
  const nodes = useMemo(() => {
    const risk = projects
      .filter((project) => project.status === 'risk' || project.daysLeft < 0)
      .map((project) => ({
        id: `${project.id}-risk`,
        danger: true,
        title:
          project.daysLeft < 0
            ? `「${project.name}」已延期 ${Math.abs(project.daysLeft)} 天`
            : `「${project.name}」进度落后`,
        sub: `${SCOPE_META[project.scope].label} · 截止 ${project.dueShort}`,
      }))
    const milestone = projects
      .filter((project) => project.milestone && project.milestone !== '待定')
      .map((project) => ({
        id: `${project.id}-m`,
        danger: false,
        title: project.milestone,
        sub: `${project.name} · 截止 ${project.dueShort}`,
      }))
    return [...risk, ...milestone].slice(0, 7)
  }, [projects])

  const value = (text: string) => (isLoading ? '—' : text)

  return (
    <>
      <div className="stat-desc">{home.summary}</div>

      {/* 三张窄卡：域完成度 / 任务总量 / 风险与到期 */}
      <div className="dash-metrics" role="list" aria-label="关键指标">
        <div className="dash-metric" role="listitem">
          <div className="dash-metric-head">域完成度</div>
          <div className="dash-metric-sub">3 个业务域 · 柱高 = 域平均进度</div>
          <div className="dash-metric-value">
            {value(`${stats.averageProgress}%`)}
            <small>平均</small>
          </div>
          <div className="dash-bars">
            {scopeBars.map((bar) => (
              <div className="dash-bar-col" key={bar.scope}>
                <div className="dash-bar-track">
                  <div
                    className="dash-bar-fill"
                    style={{ height: `${Math.max(bar.avg, 3)}%`, opacity: bar.count ? 1 : 0.35 }}
                  />
                </div>
                <div className="dash-bar-label">{bar.label}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="dash-metric" role="listitem">
          <div className="dash-metric-head">任务总量</div>
          <div className="dash-metric-sub">已完成 / 全部 · 待办 {tasks.todo} 条</div>
          <div className="dash-metric-value">
            {value(`${tasks.done}`)}
            <small>/ {tasks.total} · {tasks.rate}%</small>
          </div>
          <div className="dash-split-bar" aria-hidden>
            <i style={{ width: `${tasks.rate}%`, background: 'var(--mw-ok)' }} />
            <i style={{ width: `${100 - tasks.rate}%`, background: 'var(--mw-border-subtle)' }} />
          </div>
          <div className="dash-bars">
            <div className="dash-bar-col">
              <div className="dash-bar-label">已完成</div>
            </div>
            <div className="dash-bar-col">
              <div className="dash-bar-label">待办</div>
            </div>
          </div>
        </div>

        <div className="dash-metric" role="listitem">
          <div className="dash-metric-head">风险与到期</div>
          <div className="dash-metric-sub">
            {stats.risk} 项风险 · {monthBars.reduce((sum, bar) => sum + bar.count, 0)} 项待到期
          </div>
          <div className="dash-metric-value">
            {value(`${stats.risk}`)}
            <small>项</small>
          </div>
          <div className="dash-bars">
            {monthBars.map((bar) => (
              <div className="dash-bar-col" key={bar.label}>
                <div className="dash-bar-track">
                  <div
                    className={`dash-bar-fill${bar.risky ? ' is-risk' : ''}`}
                    style={{ height: `${Math.max((bar.count / maxMonth) * 100, 3)}%` }}
                  />
                </div>
                <div className="dash-bar-label">{bar.label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 两栏：项目明细 + 关键节点 */}
      <div className="dash-split">
        <section className="card" aria-label="项目明细">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            项目明细
            <span className="stat-desc">全部 · {stats.total} 个项目</span>
          </div>
          {rows.length === 0 ? (
            <div className="stat-desc" style={{ padding: '10px 0 14px' }}>
              还没有项目 —— 去「项目」建第一个
            </div>
          ) : (
            rows.map((project) => (
              <div
                className="proj-row"
                key={project.id}
                role="button"
                tabIndex={0}
                style={{ cursor: 'pointer' }}
                onClick={() => navigate(`/projects/${project.id}`)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') navigate(`/projects/${project.id}`)
                }}
              >
                <span className="proj-tick" style={{ background: SCOPE_META[project.scope].hex }} />
                <div className="proj-main">
                  <div className="proj-name" title={project.name}>
                    {project.name}
                  </div>
                  <div className="proj-meta">
                    <span className="proj-pill">{STATUS_LABEL[project.status]}</span>
                    <span>截止 {project.dueShort}</span>
                    <span>
                      {project.tasksDone}/{project.tasksTotal} 任务
                    </span>
                  </div>
                </div>
                <div className="proj-progress">
                  <span className="proj-track">
                    <span
                      className={`proj-fill${
                        project.status === 'risk' ? ' is-risk' : project.progress >= 100 ? '' : ' is-warn'
                      }`}
                      style={{ width: `${Math.min(project.progress, 100)}%` }}
                    />
                  </span>
                  <span className="proj-pct">{project.progress}%</span>
                </div>
              </div>
            ))
          )}
        </section>

        <section className="card" aria-label="关键节点">
          <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
            关键节点
            <span className="stat-desc">风险与里程碑</span>
          </div>
          {nodes.length === 0 ? (
            <div className="stat-desc" style={{ padding: '10px 0 14px' }}>
              暂时没有风险与节点
            </div>
          ) : (
            nodes.map((node) => (
              <div className="node-row" key={node.id}>
                <span className={`node-dot${node.danger ? ' is-risk' : ''}`} />
                <div className="node-main">
                  <div className="node-title">{node.title}</div>
                  <div className="node-sub">{node.sub}</div>
                </div>
              </div>
            ))
          )}
        </section>
      </div>
    </>
  )
}

/* ---------- 最近活动 ---------- */

/**
 * 最近活动 —— 跨项目的动态流，来自后端 `project_recent_activity` 命令。
 * 项目内的增删改操作会自动写 project_activity 表，这里按时间倒序取最近 12 条。
 */
function RecentPanel() {
  const navigate = useNavigate()
  const { data: feed = [], isLoading } = useRecentActivity(12)

  if (isLoading) {
    return (
      <div className="card">
        <div className="stat-desc">正在读取动态…</div>
      </div>
    )
  }

  if (!feed.length) {
    return (
      <section className="card" aria-label="最近活动">
        <div className="card-title">最近活动</div>
        <div className="stat-desc" style={{ padding: '10px 0 14px' }}>
          还没有动态 —— 项目里产生变更（创建 / 更新 / 归档等）之后这里会跟着长。
        </div>
      </section>
    )
  }

  return (
    <section className="card" aria-label="最近活动">
      <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between' }}>
        最近活动
        <span className="stat-desc">共 {feed.length} 条</span>
      </div>
      {feed.map((item) => (
        <div
          className="proj-row"
          key={item.id}
          role="button"
          tabIndex={0}
          style={{ cursor: 'pointer' }}
          onClick={() => navigate(`/projects/${item.projectId}`)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') navigate(`/projects/${item.projectId}`)
          }}
        >
          <div className="proj-main">
            <div className="proj-name">{item.action}</div>
            <div className="proj-meta">
              <span>{item.projectName}</span>
              <span>{item.who}</span>
              <span>{formatTime(item.time)}</span>
            </div>
          </div>
        </div>
      ))}
    </section>
  )
}

/** ISO 时间转"几分钟前 / 几小时前 / 月日" */
function formatTime(iso: string): string {
  const at = new Date(iso).getTime()
  if (Number.isNaN(at)) return iso
  const diff = Date.now() - at
  if (diff < 60_000) return '刚刚'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} 分钟前`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} 小时前`
  const d = new Date(at)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

/* ---------- AI 简报 ---------- */

/**
 * 简报 —— 基于真实项目数据生成的规则简报。
 *
 * 没有 LLM 后端，但项目/任务/风险数据都是真实的。这里把关键信号汇总成一段可读的文字：
 * 哪些项目有风险、哪些快到期、任务完成率如何。数据全来自 useProjects()。
 */
function BriefingPanel() {
  const { data: projects = [], isLoading } = useProjects()
  const stats = computeStats(projects)

  if (isLoading) {
    return (
      <section className="card" aria-label="简报">
        <div className="card-title">今日简报</div>
        <div className="stat-desc">正在汇总…</div>
      </section>
    )
  }

  if (!projects.length) {
    return (
      <section className="card" aria-label="简报">
        <div className="card-title">今日简报</div>
        <div className="stat-desc" style={{ padding: '10px 0 14px' }}>
          还没有项目 —— 去「项目」建第一个，简报会自动从这里长出来。
        </div>
      </section>
    )
  }

  const risky = projects.filter((p) => p.status === 'risk')
  const overdue = projects.filter((p) => p.daysLeft < 0)
  const dueSoon = projects.filter((p) => p.daysLeft >= 0 && p.daysLeft <= 7)
  const done = projects.filter((p) => p.status === 'done')
  const taskTotal = projects.reduce((s, p) => s + p.tasksTotal, 0)
  const taskDone = projects.reduce((s, p) => s + p.tasksDone, 0)
  const rate = taskTotal ? Math.round((taskDone / taskTotal) * 100) : 0

  const lines: string[] = []

  lines.push(`共 ${projects.length} 个项目，平均进度 ${stats.averageProgress}%，任务完成率 ${rate}%（${taskDone}/${taskTotal}）。`)

  if (risky.length) {
    lines.push(`⚠ ${risky.length} 个项目处于风险状态：${risky.map((p) => p.name).join('、')}。`)
  }
  if (overdue.length) {
    lines.push(`已延期 ${overdue.length} 个：${overdue.map((p) => `${p.name}（${Math.abs(p.daysLeft)}天）`).join('、')}。`)
  }
  if (dueSoon.length) {
    lines.push(`本周到期 ${dueSoon.length} 个：${dueSoon.map((p) => p.name).join('、')}。`)
  }
  if (done.length) {
    lines.push(`已完成 ${done.length} 个：${done.map((p) => p.name).join('、')}。`)
  }
  if (!risky.length && !overdue.length && !dueSoon.length) {
    lines.push('没有风险与到期项，节奏正常。')
  }

  return (
    <section className="card" aria-label="今日简报">
      <div className="card-title">今日简报</div>
      <div className="stat-desc" style={{ lineHeight: 1.8, padding: '10px 0' }}>
        {lines.map((line, i) => (
          <p key={i} style={{ marginBottom: i < lines.length - 1 ? 8 : 0 }}>{line}</p>
        ))}
      </div>
    </section>
  )
}
