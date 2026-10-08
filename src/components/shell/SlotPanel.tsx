import { useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Icon } from '../icons/Icon'
import { buildBugs, buildServers, computeStats, isClosed } from '../../data/derive'
import { useProjectDetail, useProjects } from '../../hooks/use-projects'
import {
  averageProgress,
  filterProjects,
  STATUS_MATCH,
  watchProjects,
  type ProjectFilter,
} from '../../lib/filter-projects'
import { useRecentsStore } from '../../stores/recents-store'
import { useUiStore } from '../../stores/ui-store'
import type { Project } from '../../types'

/**
 * 侧栏的可切换槽 —— 原型是「最近 / 快捷 / KPI / AI」四格，本应用落两格：最近 / 概览。
 *
 * ============================================================================
 * 为什么只落这两格
 * ============================================================================
 *
 * 这个槽的内容必须是真实数据。原型那四格是演示稿：最近四条是写死的，
 * 快捷六枚按钮点了 `alert('原型演示：…')`，AI 那两段是预置对话。项目有两条明令：
 *   · 「数字由 `projects.ts` 派生，不允许编数字」
 *   · 「原型里"点一下就变"的演示后门不要搬；判据是这个交互会不会让界面
 *      显示一个系统里不存在的状态」
 *
 * 逐格看：
 *
 *  | 槽 | 有没有真实来源 | 结论 |
 *  | --- | --- | --- |
 *  | 最近 | 有 —— 每次落到某个分区都是一条真实记录（`stores/recents-store`） | ✅ 落 |
 *  | 概览 | 有 —— 列表态 `filterProjects` / 详情态 `useProjectDetail`，全是派生 | ✅ 落 |
 *  | 快捷 | 没有。那六枚按钮（新建任务/日程/笔记…）属于各模块自己的顶栏动作 | ❌ 不落 |
 *  | AI   | 入口已归顶栏那颗 `.sb-icon-btn.ai`（点它开抽屉），侧栏再放一份就是两套入口做同一件事 | ❌ 不落 |
 *
 * 不落的那两格不渲染，而不是渲染一个"点了没反应"的空壳 ——
 * 用户分不清"没做"与"卡住"，那是最贵的一种缺陷。
 *
 * ============================================================================
 * 「概览」槽的三态（2026-09-27）
 * ============================================================================
 *
 * 原型把它叫 KPI，里面只装四行读数；现在装的是"读数 + 要看紧的"，KPI 这个词只说对了一半，
 * 所以改名。三态的判据都是当前地址 —— 这一栏说不出自己在哪个页面，只能问地址：
 *
 * · 列表态（`/projects`）：说"当前这一批项目"。三行读数取筛选后的那一批
 *   （`filterProjects`），下面接「要看紧的」（`watchProjects`，判据写在那个函数上）。
 *   读数为什么会跑到侧栏来：主区那四张读数卡整块去掉了（见 `ProjectsListPage`）。
 *     主区两组 chip 上的计数回答的是"点下去会剩几条"，回答不了"现在是多少" ——
 *     这一个数就归它。同一屏只留一处说某个数是多少。
 * · 详情态（`/projects/:id` 与 `/work/projects/:id`）：说"这一个项目的欠账"。
 * · 其余页面（另外八个模块）：沿用域级读数（"这个域里项目整体怎么样"）。
 *   原型没有这一支 —— 它整份文件只有项目这一个域；而应用的侧栏挂在九个模块下，
 *   没有项目可说的那一页总得说点什么。这一支是应用侧新增的，不是原型的。
 *
 * 数据没回来时显示 `—`，不显示 0 —— 0 是一个看起来很像真的的数字，
 * 而"还没加载"和"真的是零"在有项目之后会长得一模一样的两位数。
 */

/* ------------------------------------------------------------------ *
 * 槽的定义
 * ------------------------------------------------------------------ */

export interface ShellSlot {
  key: string
  label: string
  /** 空槽不占位（原型的「最近」空则不渲染）。不给就是"永远可见" */
  visible?: boolean
  render: () => ReactNode
}

/* ---------- 最近 ---------- */

/** 相对时间：只做到"天"。列表里最旧的也在 8 条以内，写"昨天/3天"足够了 */
function relativeTime(at: number): string {
  const minutes = Math.floor((Date.now() - at) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}天`
}

function RecentsSlot() {
  const entries = useRecentsStore((s) => s.entries)

  /* 这里没有空态分支：空的时候整个 tab 都不渲染（见 `useShellSlots`），
     走到这里一定有条目。留一个"装空话"的壳，等于让"空"看起来像"坏"。 */
  return (
    <>
      {entries.slice(0, 4).map((entry) => (
        <Link key={entry.path} to={entry.path} className="recent-item">
          <span className="recent-icon">
            <Icon name="i-clock" />
          </span>
          <span className="recent-text">{entry.label}</span>
          <span className="recent-time">{relativeTime(entry.at)}</span>
        </Link>
      ))}
    </>
  )
}

/* ---------- 概览 ---------- */

/** 读数一行：[标签, 值, 是否用强调色]。三态共用同一个模板 */
type KpiRow = [label: string, value: string, accent: boolean]

function KpiList({ rows }: { rows: KpiRow[] }) {
  return (
    <div className="kpi-list">
      {rows.map(([label, value, accent]) => (
        <div className="kpi-item" key={label}>
          <span className="kpi-label">{label}</span>
          <span className={cn('kpi-value', accent && 'accent')}>{value}</span>
        </div>
      ))}
    </div>
  )
}

/**
 * 从地址里取项目 id —— 两种壳各一条：`/projects/:id`（项目模块）
 * 与 `/work/projects/:id`（工作模块内打开，见 `ProjectDetail` 的文件头）。
 *
 * 用切段而不是正则：`/projects` 本身没有 id（第二段是 undefined），
 *    `/work/projects` 落的是工作模块的分区页 —— 两个都要落空。
 */
function projectIdFromPath(pathname: string): string | null {
  const [, first, second, third] = pathname.split('/')
  if (first === 'projects' && second) return second
  if (first === 'work' && second === 'projects' && third) return third
  return null
}

/** 「要看紧的」—— 读数下面那几条。空态也要说实话：是"筛掉了"还是"本来就没有" */
function WatchList({ projects, filter }: { projects: Project[]; filter: ProjectFilter }) {
  const items = watchProjects(projects, filter)

  return (
    <>
      <div className="watch-head">要看紧的</div>
      {items.length ? (
        items.map((project) => {
          const danger = project.status === 'risk' || project.daysLeft < 0
          /* 「风险阻塞」是状态，其余走"剩 N 天 / 逾期 N 天" —— 都是现成的口径 */
          const why =
            project.status === 'risk'
              ? '风险阻塞'
              : project.daysLeft >= 0
                ? `剩 ${project.daysLeft} 天`
                : `逾期 ${-project.daysLeft} 天`
          return (
            <Link key={project.id} to={`/projects/${project.id}`} className="watch-item">
              <span className="watch-name">{project.name}</span>
              <span className={cn('watch-why', danger ? 'is-danger' : 'is-warn')}>{why}</span>
            </Link>
          )
        })
      ) : (
        <div className="q-empty">
          {projects.some((project) => !isClosed(project))
            ? '当前筛选下没有未收口的项目'
            : '所有项目都已收口'}
        </div>
      )}
    </>
  )
}

function OverviewSlot() {
  const { pathname } = useLocation()
  const { data: projects, isPending } = useProjects()
  const status = useUiStore((state) => state.status)
  const scope = useUiStore((state) => state.scope)
  const query = useUiStore((state) => state.query)
  const sort = useUiStore((state) => state.sort)

  /* 两个取数 hook 都要无条件调用（钩子规则 1）：不在详情路由上时传 undefined，
     那个 query 自己就不取数（`enabled: Boolean(id)`）。挪到 return 之后会当场破钩子序。 */
  const projectId = projectIdFromPath(pathname)
  const { data: detail } = useProjectDetail(projectId ?? undefined)

  /* ---------- 列表态：说"当前这一批项目" ---------- */
  if (pathname === '/projects') {
    const filter: ProjectFilter = { status, scope, query, sort }
    const list = filterProjects(projects ?? [], filter)

    return (
      <>
        <KpiList
          rows={[
            /* 「当前可见」那一行去掉了：它与主区的「显示 N / 8」是同一个数。
               同一屏只留一处说 —— 这是本文件从头用到尾的判据。
               「进行中」走 `STATUS_MATCH.active` 而不是 `status === 'active'`：
                  那一组把「规划中」也算进来（筛选栏那个 chip 是同一份口径），
                  这里自己写相等的话，侧栏与 chip 立刻会说两个数。 */
            [
              '进行中',
              isPending ? '—' : String(list.filter((project) => STATUS_MATCH.active(project)).length),
              false,
            ],
            ['风险', isPending ? '—' : String(list.filter((project) => project.status === 'risk').length), true],
            ['平均进度', isPending ? '—' : `${averageProgress(list)}%`, false],
          ]}
        />
        {/* 加载中不放「要看紧的」：那三条挑没挑出来，与数据到没到是两件事 ——
            此刻放空态会先说一句假话（"当前筛选下没有未完成的项目"） */}
        {isPending ? null : <WatchList projects={projects ?? []} filter={filter} />}
      </>
    )
  }

  /* ---------- 详情态：说"这一个项目的欠账" ---------- */
  if (projectId) {
    const project = detail?.project
    const bugs = project ? buildBugs(project) : null
    const servers = project ? buildServers(project) : null

    return (
      <KpiList
        rows={[
          ['未完成', detail ? String(detail.tasks.filter((task) => task.status !== 'done').length) : '—', true],
          ['逾期', detail ? String(detail.tasks.filter((task) => task.late).length) : '—', false],
          ['Bug 待处理', bugs ? String(bugs.filter((bug) => bug.status !== 'fixed').length) : '—', true],
          ['文档', detail ? String(detail.documents.length) : '—', false],
          ['服务器', servers ? String(servers.length) : '—', false],
        ]}
      />
    )
  }

  /* ---------- 其余页面：域级读数（原型没有这一支，理由见文件头） ---------- */
  const stats = projects ? computeStats(projects) : null
  const show = (value: number | undefined) => (isPending || value === undefined ? '—' : String(value))

  return (
    <KpiList
      rows={[
        ['进行中项目', show(stats?.active), true],
        ['风险项目', show(stats?.risk), false],
        ['已完成项目', show(stats?.done), false],
        ['平均进度', stats ? `${stats.averageProgress}%` : '—', true],
      ]}
    />
  )
}

/**
 * 侧栏要挂哪几格 —— 可见性得在这里算，不能写进一张静态表：
 * 「最近」空不空是 store 里的事实，只有 hook 订阅得上。
 *
 * 「最近」空则整个 tab 不渲染（原型 `recentTab.hidden = true`）：
 *    没走过任何页面时它只是一个装着空话的 tab —— 空槽不该占位，更不该当默认。
 */
export function useShellSlots(): ShellSlot[] {
  const hasRecents = useRecentsStore((state) => state.entries.length > 0)

  return [
    { key: 'recent', label: '最近', visible: hasRecents, render: () => <RecentsSlot /> },
    { key: 'overview', label: '概览', render: () => <OverviewSlot /> },
  ]
}

/* ---------- 槽条 ---------- */

export function SlotPanel({ slots }: { slots: ShellSlot[] }) {
  const { pathname } = useLocation()
  /** 用户自己点过的那一格。点过之后不再替他改默认（原型 `slotTouched`） */
  const [picked, setPicked] = useState<string | null>(null)

  const visible = slots.filter((slot) => slot.visible !== false)

  /**
   * 默认给哪一格：列表态给「概览」，其余给「最近」。
   *
   * 列表态的默认不能是「最近」：刚进这一页它是空的（于是被收掉），
   *    而读数已经从主区搬到这一栏了 —— 默认落在别处等于进页面看不见任何数字。
   *
   * 用"推导"而不是 `useEffect` 去纠偏：用户点过的那一格若被收掉（比如「最近」变成空的），
   *    这里会自己回落到默认，不需要在渲染之后再触发一次 setState
   *    （那会多渲染一帧，而"选中的 tab 不在屏幕上"那一帧是真实存在过的）。
   */
  const fallback = visible[0]?.key ?? ''
  const preferred = pathname === '/projects' ? 'overview' : 'recent'
  const active = (() => {
    if (picked && visible.some((slot) => slot.key === picked)) return picked
    return visible.some((slot) => slot.key === preferred) ? preferred : fallback
  })()

  if (!visible.length) return null

  const current = visible.find((slot) => slot.key === active) ?? visible[0]

  return (
    <div className="sidebar-slot">
      {/* 只剩一个可见槽时整条 tab 行也收掉 —— 一个高亮胶囊独自杵在栏顶是句废话
          （点它没别处可去），而内容自己会说它是谁（读数表 / 要看紧的）。 */}
      {visible.length >= 2 ? (
        <div className="slot-tabs" role="tablist" aria-label="侧栏快捷面板">
          {visible.map((slot) => (
            <button
              key={slot.key}
              type="button"
              role="tab"
              aria-selected={slot.key === current.key}
              className={cn('slot-tab', slot.key === current.key && 'active')}
              onClick={() => setPicked(slot.key)}
            >
              {slot.label}
            </button>
          ))}
        </div>
      ) : null}

      <div className="slot-body">
        {/* 只挂当前那一格（原型的做法是全部渲染 + display:none，React 里条件渲染更省） */}
        <div className="slot-panel active" role="tabpanel">
          {current.render()}
        </div>
      </div>
    </div>
  )
}
