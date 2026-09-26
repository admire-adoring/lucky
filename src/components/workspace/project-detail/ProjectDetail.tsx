/**
 * 项目详情视图 —— `design/work/work_product-detail.html` 的落地，**挂在两个模块下**。
 *
 * ============================================================================
 * 为什么它是一个"视图"而不是一个页面（2026-09-25 · 第三轮）
 * ============================================================================
 * 用户的要求：在工作模块里点开一个项目，**不要跳到独立的项目模块**，详情要在工作模块内打开。
 * 于是同一份详情同时挂在两条路由上：
 *
 *   · `/projects/:id[/:tab]`      —— 项目模块的详情页（`ProjectsWorkspace` 负责套壳）
 *   · `/work/projects/:id[/:tab]` —— **工作模块内**打开的详情（`WorkProjectDetailPage` 负责套壳）
 *
 * 两处的差别只有壳上这两样：
 *   ① **侧栏的环**。项目模块的环**就是**这一页的 7 个分区；工作模块的环是工作模块的 7 个分区
 *      （`pages/workspace/work/panels.tsx` 的 `TABS` —— **那是工作模块的分区表**，不是本文件的
 *      `SECTION_TABS`；两者同名过一次，是这里最容易看错的地方。高亮停在「项目」），
 *      这一页的分区于是退化成**页内那条下了划线的 `.tabs` 横条**。
 *   ② **子分区的基路径**（`/projects/<id>` 与 `/work/projects/<id>`）——
 *      由调用方按 `useModuleTab` 的约定算好传进来。
 *
 * 内容 / 数据 / 交互三者一字不差，所以两处共用这一个组件而不是各写一份：复制一份的代价
 * 不是多 800 行，而是从此分区数与字段口径会各自漂移。**本文件因此不渲染任何外壳**
 * （`WorkspaceLayout` 由上面两个页面各自提供、加载与失败两态也在那边）。
 *
 * ⚠️ 连带的一条：这一整页的样式作用域是 `.mw-root[data-module] .proj-detail`，
 *    属性选择器**不带值**正是为了让它在两个模块下都命中。写成
 *    `[data-module='projects']` 时，工作模块那一份会**一条规则都不命中** ——
 *    页面照常渲染、只是全裸，且零报错。判据在 `styles/module-workspace.css` 的项目详情段首。
 *
 * ============================================================================
 * 这一版换掉了什么（2026-09-25）
 * ============================================================================
 * 上一版按 `design/project/project_index.html` 落地：概览 + **9 个分区**
 * （概览/任务/里程碑/文档/笔记/知识图谱/时间线/复盘/设置）+ 常驻右栏 + 页面级头部卡。
 * 这一版按原型换成：**可折叠 Hero 卡 + 下划线 Tab 栏 + 7 个分区**
 * （总览/任务/Bug/文档/运维/会议/账户），右栏取消。
 *
 * ⚠️ 那 6 个被去掉的分区（里程碑/笔记/知识图谱/时间线/复盘/设置）**是用户明确要移除的**，
 *    连同它们的组件与演示数据一起删了 —— 不是漏迁，别照着旧原型补回来。
 *    文件头这一条是给下一个读到 `design/project/project_index.html` 的人的。
 *
 * ============================================================================
 * 三处不是"原型怎么写就怎么抄"的地方
 * ============================================================================
 * ① **分区可见性由数据决定，不由 scope 白名单决定**。`servers` / `accounts` /
 *    `deployDocs` 这三组池子**只有 work 域有内容**（"生产服务器"与"平台账号"是软件
 *    项目才有的东西），派生出 0 条就隐藏那个分区。所以 work 项目是 7 个分区，
 *    生活/学习项目是 4~5 个 —— 判据在 `POOL`，不在这里写死一张表。
 *
 * ② **文档书脊上的标签用 `doc.source`**（腾讯文档 / 语雀 / Git 仓库 / 本地 Markdown），
 *    原型那里写的是「方案 / 规范 / 设计」—— 那是文档**种类**，而 `DocumentItem`
 *    没有这个字段。按种类编一张映射表就是造假字段，用已有的 `source` 是同一格的真值。
 *
 * ③ **⋯ 菜单只有「复制链接」是真动作**（写剪贴板）。归档/暂停/删除、编辑、调整进度
 *    都**没有写接口**（`api/projects.ts` 只有读），所以它们诚实地回一句"还没接"，
 *    而不是点一下把界面改掉、背后什么都没发生 —— 那与 v1 的「状态徽标循环」是同一类谎言，
 *    那个已经被明确撤掉过（见 `components/workspace/project/api.ts` 的注释）。
 *
 * 数据口径：任务与文档 = **真实派生**（`fetchProjectDetail`）；
 * Bug / 服务器 / 发布记录 / 会议 / 账户 = 池子 + 确定性派生（`data/derive.ts`），
 * 与 `buildDocuments` / `buildMilestones` 同一类，应用没有这五张表。
 */

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '../../icons/Icon'
import { DocLibrary } from './DocLibrary'
import { OpsPanel } from './OpsPanel'
import { useModuleTab } from '../../../hooks/use-module-tab'
import { useProjectDetail } from '../../../hooks/use-projects'
import { cn } from '../../../lib/cn'
import { toast } from '../../../stores/toast-store'
import {
  ACCOUNT_ENV_LABEL,
  BUG_LEVEL_COLOR,
  BUG_LEVEL_LABEL,
  BUG_STATUS_LABEL,
  buildAccounts,
  buildBugs,
  buildDeployDocs,
  buildDeploys,
  buildMeetings,
  buildServers,
  ownerDisplayName,
} from '../../../data/derive'
import { adaptDocs, adaptTasks, type WsDoc, type WsTask, type WsTaskStatus } from '../../../data/workspace/project'
import { DOC_KIND_LABEL } from '../../../data/content-pool'
import type { ModuleTab } from '../../../data/workspace/types'
import type { Project, ProjectStatus } from '../../../types'

/* ------------------------------------------------------------------ *
 * 分区
 * ------------------------------------------------------------------ */

type TabKey = 'overview' | 'tasks' | 'bugs' | 'docs' | 'ops' | 'meetings' | 'accounts'

export const SECTION_TABS: (ModuleTab & { key: TabKey })[] = [
  { key: 'overview', label: '总览' },
  { key: 'tasks', label: '任务' },
  { key: 'bugs', label: 'Bug' },
  { key: 'docs', label: '文档' },
  { key: 'ops', label: '运维' },
  { key: 'meetings', label: '会议' },
  { key: 'accounts', label: '账户' },
]

/** 状态 → 页面主色（与工作模块的项目抽屉同一张表，见 `ProjectDrawers.tsx`） */
const STATUS_CLASS: Record<ProjectStatus, string> = {
  active: 'p-active',
  risk: 'p-risk',
  planning: 'p-planning',
  done: 'p-done',
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: '进行中',
  risk: '有风险',
  planning: '规划中',
  done: '已归档',
}

/** 团队优先级 → 那一格的中文（原型是三档徽标） */
const TASK_PRIO: Record<WsTask['prio'], { label: string; cls: string }> = {
  P0: { label: '高', cls: 'high' },
  P1: { label: '中', cls: 'mid' },
  P2: { label: '低', cls: 'low' },
}

/** 键盘 1..7 切分区时要跳过的输入控件 */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

/* ------------------------------------------------------------------ *
 * 页头：可折叠 Hero（收起时就是一行）
 * ------------------------------------------------------------------ */

interface HeroProps {
  project: Project
  open: boolean
  onToggle: () => void
  notice: (text: string) => void
}

function Hero({ project, open, onToggle, notice }: HeroProps) {
  const [moreOpen, setMoreOpen] = useState(false)

  const copyLink = () => {
    setMoreOpen(false)
    const url = window.location.href
    /* 剪贴板在 Tauri webview 里可能没有权限 —— 失败要说出来，不能假装成功 */
    navigator.clipboard?.writeText(url).then(
      () => toast('已复制项目链接'),
      () => notice('复制失败：这个环境没有剪贴板权限'),
    )
  }

  return (
    <div className={cn('hero-card', open && 'open')}>
      {/* ⚠️ 这一条**不给 role="button"**：它里面还有一排真控件（进度、编辑、⋯、折叠），
          在一个 role=button 里嵌按钮是无效 ARIA，读屏会把它们吃掉。
          键盘入口由右下那枚 `.fold-toggle`（真 button）承担，鼠标仍可点整条。 */}
      <div className="hero-bar" onClick={onToggle}>
        <div className="hero-bar-left">
          <span className="hero-tag">{project.priority === 'high' ? 'P0' : project.priority === 'mid' ? 'P1' : 'P2'}</span>
          <h1 className="hero-name">{project.name}</h1>
          <span className="hero-status">
            <span className="dot" />
            {STATUS_LABEL[project.status]}
          </span>
        </div>

        {/* 右侧自成一块：里面每个控件都有自己的动作，点它们不该顺手把 Hero 收起来 */}
        <div className="hero-bar-right" onClick={(event) => event.stopPropagation()}>
          <div
            className="hero-progress"
            role="button"
            tabIndex={0}
            title="调整进度"
            onClick={() => notice('调整进度：还没有写接口')}
            onKeyDown={(event) => {
              if (event.key !== ' ' && event.key !== 'Enter') return
              event.preventDefault()
              notice('调整进度：还没有写接口')
            }}
          >
            <span className="hp-pct">{project.progress}%</span>
            <div className="hp-track">
              <div className="hp-fill" style={{ width: `${project.progress}%` }} />
            </div>
          </div>

          <div className="hero-deadline">
            <span className="hd-label">截止</span>
            <span className="hd-value">{project.dueShort}</span>
            <span className="hd-urgent">
              {project.daysLeft >= 0 ? `剩 ${project.daysLeft} 天` : `逾期 ${-project.daysLeft} 天`}
            </span>
          </div>

          <button type="button" className="btn btn-ghost btn-sm" onClick={() => notice('编辑项目：还没有写接口')}>
            编辑
          </button>

          <div className="more-menu">
            <button type="button" className="more-btn" aria-haspopup="menu" aria-expanded={moreOpen} onClick={() => setMoreOpen((v) => !v)}>
              ⋯
            </button>
            <div className={cn('more-dropdown', moreOpen && 'open')} role="menu">
              <div className="more-item" role="menuitem" tabIndex={0} onClick={copyLink}>🔗 复制链接</div>
              <div className="more-item" role="menuitem" tabIndex={0} onClick={() => { setMoreOpen(false); notice('归档项目：还没有写接口') }}>📦 归档项目</div>
              <div className="more-item" role="menuitem" tabIndex={0} onClick={() => { setMoreOpen(false); notice('暂停项目：还没有写接口') }}>⏸ 暂停项目</div>
              <div className="more-item danger" role="menuitem" tabIndex={0} onClick={() => { setMoreOpen(false); notice('删除项目：还没有写接口') }}>🗑 删除项目</div>
            </div>
          </div>

          <button type="button" className="fold-toggle" title={open ? '收起' : '展开'} aria-label={open ? '收起' : '展开'} onClick={onToggle}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      </div>

      <div className="hero-body">
        <div className="hero-body-inner">
          <div className="body-label">项目说明</div>
          <p className="body-text">{project.description}</p>
          <div className="body-meta">
            <span>创建 {project.startDate}</span>
            <span className="sep">·</span>
            <span>负责人 {project.owners.map(ownerDisplayName).join(' · ')}</span>
            <span className="sep">·</span>
            <span>可见性 {project.visibility}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 各分区的公共零件
 * ------------------------------------------------------------------ */

function CardHead({
  icon,
  title,
  count,
  more,
  action,
}: {
  icon: string
  title: string
  count?: string
  more?: { label: string; onClick: () => void }
  action?: ReactNode
}) {
  return (
    <div className="card-head">
      <div className="card-head-left">
        <div className="card-icon">{icon}</div>
        <div className="card-title">{title}</div>
        {count ? <span className="card-count">{count}</span> : null}
      </div>
      {more ? (
        <span className="card-more" role="button" tabIndex={0} onClick={more.onClick}
          onKeyDown={(event) => {
            if (event.key !== ' ' && event.key !== 'Enter') return
            event.preventDefault()
            more.onClick()
          }}
        >
          {more.label} →
        </span>
      ) : null}
      {action}
    </div>
  )
}

/** 任务行。`onToggle` 为空时是只读展示（总览里的那三行就是这样）。 */
function TaskRow({ task, onToggle }: { task: WsTask; onToggle?: (id: string) => void }) {
  const prio = TASK_PRIO[task.prio]
  return (
    <div className={cn('task-row', task.status === 'done' && 'done', task.status === 'doing' && 'doing')}>
      <div
        className="task-check"
        role={onToggle ? 'checkbox' : undefined}
        aria-checked={onToggle ? task.status === 'done' : undefined}
        tabIndex={onToggle ? 0 : undefined}
        onClick={onToggle ? () => onToggle(task.id) : undefined}
        onKeyDown={
          onToggle
            ? (event) => {
                if (event.key !== ' ' && event.key !== 'Enter') return
                event.preventDefault()
                onToggle(task.id)
              }
            : undefined
        }
      >
        {task.status === 'done' ? '✓' : task.status === 'doing' ? '•' : ''}
      </div>
      <div className="task-text">{task.title}</div>
      {/* 已完成那组**不报截止**（原型的 `.task-row.done` 就只有优先级徽标）：
          一条已经做完的事，"还剩几天"是个没有意义的数字。 */}
      {task.status !== 'done' && task.due ? (
        <span className={cn('task-due', task.late && 'urgent')}>{task.late ? '已逾期' : task.due}</span>
      ) : null}
      <span className={cn('task-pri', prio.cls)}>{prio.label}</span>
    </div>
  )
}

function BugCard({ bug }: { bug: ReturnType<typeof buildBugs>[number] }) {
  return (
    <div className="bug-card" style={{ ['--bc' as string]: BUG_LEVEL_COLOR[bug.level] }}>
      <div className="bug-head">
        <span className="bug-level">{BUG_LEVEL_LABEL[bug.level]}</span>
        <span className="bug-status">{BUG_STATUS_LABEL[bug.status]}</span>
      </div>
      <div className="bug-title">{bug.title}</div>
      <div className="bug-meta">
        <span>{bug.version}</span>
        <span>·</span>
        <span>{bug.when}</span>
        <span className="bug-assignee">{bug.who.slice(0, 1)}</span>
      </div>
    </div>
  )
}

/**
 * 文档书脊。`script` 那支是原型给部署脚本用的深灰封面（`.doc-book.script`）。
 *
 * ⚠️ 两个都跟文档列表那一版对齐了（2026-09-25）：
 *    · `dk-<kind>` 让书脊按**种类**上色（没有这个类就落回卡片色，见 CSS 的 `--book`）；
 *    · 标签是**种类**而不是来源 —— 来源在列表行与弹窗里显示。判据见 `DocLibrary` 文件头 ②。
 */
function DocBook({ doc, script = false }: { doc: WsDoc; script?: boolean }) {
  return (
    <div className={cn('doc-book', `dk-${doc.kind}`, script && 'script')}>
      <span className="db-tag">{DOC_KIND_LABEL[doc.kind]}</span>
      <div className="db-title">{doc.name}</div>
      <div className="db-meta">{doc.updatedAt}</div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 总览
 * ------------------------------------------------------------------ */

function OverviewPanel({
  tasks,
  bugs,
  docs,
  servers,
  deploys,
  meetings,
  accounts,
  gotoTab,
  openTab,
  onToggleTask,
}: {
  tasks: WsTask[]
  bugs: ReturnType<typeof buildBugs>
  docs: WsDoc[]
  servers: ReturnType<typeof buildServers>
  deploys: ReturnType<typeof buildDeploys>
  meetings: ReturnType<typeof buildMeetings>
  accounts: ReturnType<typeof buildAccounts>
  gotoTab: (key: TabKey) => void
  openTab: TabKey[]
  onToggleTask: (id: string) => void
}) {
  const done = tasks.filter((t) => t.status === 'done').length
  const has = (key: TabKey) => openTab.includes(key)

  return (
    <div className="overview-grid">
      <div className="card rc-task">
        <CardHead icon="✅" title="任务" count={`${done} / ${tasks.length}`} more={has('tasks') ? { label: '查看全部', onClick: () => gotoTab('tasks') } : undefined} />
        <div className="task-list">
          {tasks.filter((t) => t.status !== 'done').slice(0, 3).map((task) => (
            <TaskRow key={task.id} task={task} onToggle={onToggleTask} />
          ))}
          {tasks.filter((t) => t.status !== 'done').length === 0 ? <div className="q-empty">没有未完成任务</div> : null}
        </div>
      </div>

      <div className="card rc-bug">
        <CardHead icon="🐛" title="Bug" count={`${bugs.length} 条`} more={has('bugs') ? { label: '查看全部', onClick: () => gotoTab('bugs') } : undefined} />
        <div className="bug-grid" style={{ gridTemplateColumns: '1fr' }}>
          {bugs.slice(0, 2).map((bug) => (
            <BugCard key={bug.id} bug={bug} />
          ))}
        </div>
      </div>

      <div className="card rc-doc">
        <CardHead icon="📄" title="文档" count={`${docs.length}`} more={has('docs') ? { label: '查看全部', onClick: () => gotoTab('docs') } : undefined} />
        <div className="doc-books">
          {docs.slice(0, 3).map((doc) => (
            <DocBook key={doc.id} doc={doc} />
          ))}
        </div>
      </div>

      {has('ops') ? (
        <div className="card rc-ops">
          <CardHead
            icon="🚀"
            title="运维"
            count={`${servers.length} 服务器 · 3 文档 · ${deploys.length} 记录`}
            more={{ label: '查看全部', onClick: () => gotoTab('ops') }}
          />
          <div className="server-list" style={{ marginBottom: 10 }}>
            {servers.slice(0, 1).map((server) => (
              <div key={server.id} className="server-row">
                <div className={cn('server-rack', server.env)} />
                <div className="server-info">
                  <div className="server-name">{server.name}</div>
                  <div className="server-meta">{server.on ? '运行中' : '已停止'}</div>
                </div>
              </div>
            ))}
          </div>
          <div className="deploy-timeline">
            {deploys.slice(0, 2).map((item) => (
              <div key={item.id} className="deploy-row">
                <div className="deploy-dot" style={{ ['--dc' as string]: item.result === 'success' ? '#10B981' : '#F59E0B' }} />
                <div className="deploy-info">
                  <div className="deploy-ver">
                    {item.version}{' '}
                    <span className={cn('deploy-badge', item.result === 'success' ? 'success' : 'rollback')}>
                      {item.result === 'success' ? '成功' : '回滚'}
                    </span>
                  </div>
                  <div className="deploy-meta">{item.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      <div className="card rc-meeting">
        <CardHead icon="📅" title="会议" count={`${meetings.length}`} more={has('meetings') ? { label: '查看全部', onClick: () => gotoTab('meetings') } : undefined} />
        <div className="meeting-grid" style={{ gridTemplateColumns: '1fr' }}>
          {meetings.slice(0, 1).map((m) => (
            <div key={m.id} className="meeting-card">
              <div className="meeting-date">
                <div className="meeting-month">{m.month}</div>
                <div className="meeting-day">{m.day}</div>
                <div className="meeting-time">{m.time}</div>
              </div>
              <div className="meeting-info">
                <div className="meeting-title">{m.title}</div>
                <div className="meeting-meta">{m.meta}</div>
                <div className="meeting-attendees">
                  {m.attendees.map((a) => (
                    <span key={a} className="avatar">{a.slice(0, 1)}</span>
                  ))}
                  {m.more > 0 ? <span className="more">+{m.more}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {has('accounts') ? (
        <div className="card rc-account">
          <CardHead
            icon="🔑"
            title="账户"
            count={`${accounts.length} · ${new Set(accounts.map((a) => a.platform)).size} 平台`}
            more={{ label: '查看全部', onClick: () => gotoTab('accounts') }}
          />
          <div className="account-grid" style={{ gridTemplateColumns: '1fr' }}>
            {accounts.slice(0, 1).map((acc) => (
              <div key={acc.id} className="account-card">
                <div className="account-key">🔑</div>
                <div className="account-info">
                  <div className="account-platform">
                    {acc.platform}
                    <span className={cn('account-env', acc.env)}>{ACCOUNT_ENV_LABEL[acc.env]}</span>
                  </div>
                  <div className="account-user">{acc.user}</div>
                  <div className="account-pwd">🔒 密码已加密</div>
                </div>
                {acc.expire ? <span className={cn('account-expire', acc.warn && 'warn')}>{acc.expire}</span> : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 视图状态
 * ------------------------------------------------------------------ */

/**
 * 这一页的全部状态与派生数据。**与壳无关**，所以整块抽在这里。
 *
 * `basePath` 是**子分区**的基路径（`/projects/<id>` 或 `/work/projects/<id>`），
 * 交给 `useModuleTab` 生成地址 —— 两个壳的唯一差别就是它。
 *
 * ⚠️ 两个调用方都**只调一次**，把返回值同时用于套壳与正文（环要用 `sections`，
 *    正文要用别的）—— 调两次会得到两份独立的状态（勾选、Hero 折叠各一份），
 *    那种错很奇怪：壳里的计数会跟着更新，而正文不跟。
 */
export function useProjectDetailView(id: string | undefined, basePath: string) {
  const { data, isLoading, isError } = useProjectDetail(id)

  /* 勾选状态记在**覆盖表**里，而不是拿到数据后 setState 一份副本 —— 理由见旧版注释：
     副本要在 effect 里同步，会让"数据刷新冲掉用户刚勾的状态"变成要额外兜的竞态。 */
  const [override, setOverride] = useState<Record<string, WsTaskStatus>>({})
  const [heroOpen, setHeroOpen] = useState(false)

  const baseTasks = useMemo(() => (data ? adaptTasks(data.tasks) : []), [data])
  const tasks: WsTask[] = useMemo(
    () =>
      baseTasks.map((task) => {
        const next = override[task.id]
        return next && next !== task.status
          ? { ...task, status: next, late: next === 'done' ? false : task.late }
          : task
      }),
    [baseTasks, override],
  )

  const docs = useMemo(() => (data ? adaptDocs(data.documents) : []), [data])
  const bugs = useMemo(() => (data ? buildBugs(data.project) : []), [data])
  const servers = useMemo(() => (data ? buildServers(data.project) : []), [data])
  const deploys = useMemo(() => (data ? buildDeploys(data.project) : []), [data])
  const deployDocs = useMemo(() => (data ? buildDeployDocs(data.project) : []), [data])
  const meetings = useMemo(() => (data ? buildMeetings(data.project) : []), [data])
  const accounts = useMemo(() => (data ? buildAccounts(data.project) : []), [data])

  /* 可见分区：见文件头 ①。数据没到之前按全集渲染，免得环上先少几格再补回来。
     ⚠️ 运维的判据只看 `servers`：它是"这一整块"的主语（发布记录与部署文档的派生器
        自己也按同一个池子早退，所以三者的空/非空是同步的）。 */
  const sections = useMemo<ModuleTab[]>(() => {
    if (!data) return SECTION_TABS
    return SECTION_TABS.filter((tab) => {
      if (tab.key === 'ops') return servers.length > 0
      if (tab.key === 'accounts') return accounts.length > 0
      return true
    })
  }, [data, servers.length, accounts.length])

  const { active, select } = useModuleTab(basePath, sections)
  const openTab = sections.map((t) => t.key as TabKey)

  const notice = (text: string) => toast(text)

  const toggleTask = (taskId: string) => {
    setOverride((prev) => {
      const current = prev[taskId] ?? baseTasks.find((t) => t.id === taskId)?.status
      const next: WsTaskStatus = current === 'done' ? 'todo' : 'done'
      const title = baseTasks.find((t) => t.id === taskId)?.title ?? ''
      toast(next === 'done' ? `已完成「${title}」` : `已重置「${title}」`)
      return { ...prev, [taskId]: next }
    })
  }

  /* 数字键 1..7 切分区（原型有这一条）。两个前提：没有修饰键、焦点不在输入控件里 ——
     否则在搜索框里打「1」会跳分区。 */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTyping(event.target)) return
      const n = Number.parseInt(event.key, 10)
      if (!(n >= 1 && n <= openTab.length)) return
      select(openTab[n - 1] as string)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [openTab, select])
  /* 派生：数据没到之前一律空集 —— 不编占位内容（与"先渲染空壳再补"是两条路）。 */
  const project = data?.project
  const doing = tasks.filter((t) => t.status !== 'done')

  const counts: Partial<Record<TabKey, string>> = !data
    ? {}
    : {
        tasks: `${tasks.filter((t) => t.status === 'done').length}/${tasks.length}`,
        bugs: String(bugs.length),
        docs: String(docs.length),
        ops: [servers.length, deployDocs.length, deploys.length].filter(Boolean).join('·'),
        meetings: String(meetings.length),
        accounts: String(accounts.length),
      }

  /* 「更新点」= 这一格里今天有未处理的东西。规则只有一条：**该分区有未完成的项**
     （不在 Bug 上就是待修复、不在任务上就是未完成）。原型把它写死在标记里，
     这里用同一份数据算 —— 两个分区共用一格计数不会有第二口径。 */
  const updating = new Set<TabKey>()
  if (doing.length) updating.add('tasks')
  if (bugs.some((b) => b.status !== 'fixed')) updating.add('bugs')

  return {
    data,
    isLoading,
    isError,
    /** 可见分区（由数据裁过），两个壳都要用：项目模块拿它当环，工作模块拿它当页内横条 */
    sections,
    active,
    select,
    openTab,
    project,
    tasks,
    doing,
    docs,
    bugs,
    servers,
    deploys,
    deployDocs,
    meetings,
    accounts,
    /** 分区 → 那一格右上角的计数（原型写死在标记里） */
    counts,
    /** 哪些分区有未处理项（原型是一个写死的圆点） */
    updating,
    toggleTask,
    notice,
    heroOpen,
    setHeroOpen,
  }
}

/** `useProjectDetailView` 的返回类型。`project` 可能为 `undefined`（数据未到） */
export type ProjectDetailView = ReturnType<typeof useProjectDetailView>

/* ------------------------------------------------------------------ *
 * 正文（不含外壳）
 * ------------------------------------------------------------------ */

interface BackLink {
  /** 链接文字，如「项目」 */
  label: string
  /** 目标地址，如 `/work/projects` */
  path: string
}

/**
 * 详情正文。
 *
 * `backTo` **只有"从工作模块进来"那一份会传**：在工作模块里这一页是一次**下钻**，
 * 需要一条看得见的回头路；而项目模块的详情本身就是那个模块的根页面，没有上一层。
 */
export function ProjectDetail({ view, backTo }: { view: ProjectDetailView; backTo?: BackLink }) {
  const {
    project,
    tasks,
    doing,
    docs,
    bugs,
    servers,
    deploys,
    deployDocs,
    meetings,
    accounts,
    sections,
    active,
    select,
    counts,
    updating,
    openTab,
    toggleTask,
    notice,
    heroOpen,
    setHeroOpen,
  } = view

  /* 数据没到 → 不渲染正文。加载/失败两态由调用方**连同外壳**一起给：
     那时连页面根都不存在，而这两态必须出现在壳里面（否则整页是白的）。 */
  if (!project) return null

  return (
    <div className={cn('proj-detail', STATUS_CLASS[project.status])}>
      {backTo ? (
        <Link className="proj-back" to={backTo.path}>
          <Icon name="i-arrow-right" className="proj-back-arrow" />
          返回{backTo.label}
        </Link>
      ) : null}

      <Hero project={project} open={heroOpen} onToggle={() => setHeroOpen((v) => !v)} notice={notice} />

      <div className="tabs-wrap">
        <div className="tabs" role="tablist" aria-label="项目分区">
          {sections.map((tab) => {
            const key = tab.key as TabKey
            const isActive = active === tab.key
            return (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={isActive}
                className={cn('tab', isActive && 'active', updating.has(key) && 'has-update')}
                onClick={() => select(tab.key)}
              >
                {tab.label}
                {counts[key] ? <span className="tab-count">{counts[key]}</span> : null}
                <span className="tab-dot" />
              </button>
            )
          })}
        </div>
      </div>

      <div className="panel active">
        {active === 'overview' ? (
          <OverviewPanel
            tasks={tasks}
            bugs={bugs}
            docs={docs}
            servers={servers}
            deploys={deploys}
            meetings={meetings}
            accounts={accounts}
            gotoTab={(key) => select(key)}
            openTab={openTab}
            onToggleTask={toggleTask}
          />
        ) : null}

        {active === 'tasks' ? (
          <div className="card rc-task">
            <CardHead
              icon="✅"
              title="全部任务"
              count={`${tasks.filter((t) => t.status === 'done').length} / ${tasks.length} 完成`}
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => notice('新建任务：还没有写接口')}>
                  + 新建任务
                </button>
              }
            />
            <div className="task-group-title">
              进行中
              <span className="tg-count">{doing.length}</span>
            </div>
            <div className="task-list">
              {doing.map((task) => (
                <TaskRow key={task.id} task={task} onToggle={toggleTask} />
              ))}
              {doing.length === 0 ? <div className="q-empty">没有进行中的任务</div> : null}
            </div>
            <div className="task-group-title" style={{ marginTop: 10 }}>
              已完成
              <span className="tg-count">{tasks.filter((t) => t.status === 'done').length}</span>
            </div>
            <div className="task-list">
              {tasks.filter((t) => t.status === 'done').map((task) => (
                <TaskRow key={task.id} task={task} onToggle={toggleTask} />
              ))}
            </div>
          </div>
        ) : null}

        {active === 'bugs' ? (
          <div className="card rc-bug">
            <CardHead
              icon="🐛"
              title="全部 Bug"
              count={`${bugs.filter((b) => b.status !== 'fixed').length} 个待处理`}
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => notice('提交 Bug：还没有写接口')}>
                  + 提交 Bug
                </button>
              }
            />
            <div className="bug-grid">
              {bugs.map((bug) => (
                <BugCard key={bug.id} bug={bug} />
              ))}
            </div>
          </div>
        ) : null}

        {active === 'docs' ? (
          /* 文档列表（原型 `work_project_detail_document.html`）。
             ⚠️ 这里**不再包一层 `.card rc-doc`**：那一版的"一张卡片 + 标题 + 新建按钮"
                与下面这一版的结构不兼容（这一版自带子类栏、工具栏与结果条，
                标题行与"共 N 篇"是重复的两处计数）。理由写在 `DocLibrary` 文件头。 */
          <DocLibrary docs={docs} projectName={project.name} notice={notice} />
        ) : null}

        {active === 'ops' ? (
          /* 运维（原型 `工作-项目-项目详情-运维-index.html`）。
             ⚠️ 这一整块由 `OpsPanel` 负责，它自带一层 `.ops-page` 作用域 ——
                概览卡片与这里共用 `.server-row` / `.deploy-row` 这批类名，而两边版式不同，
                靠这一层把原型的规则关在分区内（见 `OpsPanel` 文件头 ①）。 */
          <OpsPanel
            projectId={project.id}
            projectName={project.name}
            servers={servers}
            deploys={deploys}
            deployDocs={deployDocs}
            notice={notice}
          />
        ) : null}

        {active === 'meetings' ? (
          <div className="card rc-meeting">
            <CardHead icon="📅" title="全部会议" count={`${meetings.length} 场`} />
            <div className="meeting-grid">
              {meetings.map((m) => (
                <div key={m.id} className="meeting-card">
                  <div className="meeting-date">
                    <div className="meeting-month">{m.month}</div>
                    <div className="meeting-day">{m.day}</div>
                    <div className="meeting-time">{m.time}</div>
                  </div>
                  <div className="meeting-info">
                    <div className="meeting-title">{m.title}</div>
                    <div className="meeting-meta">{m.meta}</div>
                    <div className="meeting-attendees">
                      {m.attendees.map((a) => (
                        <span key={a} className="avatar">{a.slice(0, 1)}</span>
                      ))}
                      {m.more > 0 ? <span className="more">+{m.more}</span> : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {active === 'accounts' ? (
          <div className="card rc-account">
            <CardHead
              icon="🔑"
              title="账户管理"
              count={`${accounts.length} 个 · ${new Set(accounts.map((a) => a.platform)).size} 平台`}
              action={
                <button type="button" className="btn btn-primary btn-sm" onClick={() => notice('添加账户：还没有写接口')}>
                  + 添加账户
                </button>
              }
            />
            <div className="account-grid">
              {accounts.map((acc) => (
                <div key={acc.id} className="account-card">
                  <div className="account-key">🔑</div>
                  <div className="account-info">
                    <div className="account-platform">
                      {acc.platform}
                      <span className={cn('account-env', acc.env)}>{ACCOUNT_ENV_LABEL[acc.env]}</span>
                    </div>
                    <div className="account-user">{acc.user}</div>
                    <div className="account-pwd">🔒 密码已加密</div>
                  </div>
                  <button
                    type="button"
                    className="account-copy"
                    title="复制账号"
                    onClick={(event) => {
                      event.stopPropagation()
                      notice('复制账号：只复制用户名，密码不在这里')
                    }}
                  >
                    📋
                  </button>
                  {acc.expire ? <span className={cn('account-expire', acc.warn && 'warn')}>{acc.expire}</span> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
