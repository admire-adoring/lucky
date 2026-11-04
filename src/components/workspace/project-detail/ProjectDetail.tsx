/**
 * 项目详情视图 —— `design/work/work_product-detail.html` 的落地，挂在两个模块下。
 *
 * ============================================================================
 * 为什么它是一个"视图"而不是一个页面（2026-09-25 · 第三轮）
 * ============================================================================
 * 用户的要求：在工作模块里点开一个项目，不要跳到独立的项目模块，详情要在工作模块内打开。
 * 于是同一份详情同时挂在两条路由上：
 *
 *   · `/projects/:id[/:tab]`      —— 项目模块的详情页（`ProjectsWorkspace` 负责套壳）
 *   · `/work/projects/:id[/:tab]` —— 工作模块内打开的详情（`WorkProjectDetailPage` 负责套壳）
 *
 * 两处的差别只有壳上这两样：
 *   ① 侧栏的环。项目模块的环就是这一页的 7 个分区；工作模块的环是工作模块的 7 个分区
 *      （`pages/workspace/work/panels.tsx` 的 `TABS` —— 那是工作模块的分区表，不是本文件的
 *      `SECTION_TABS`；两者同名过一次，是这里最容易看错的地方。高亮停在「项目」），
 *      这一页的分区于是退化成页内那条下了划线的 `.tabs` 横条。
 *   ② 子分区的基路径（`/projects/<id>` 与 `/work/projects/<id>`）——
 *      由调用方按 `useModuleTab` 的约定算好传进来。
 *
 * 内容 / 数据 / 交互三者一字不差，所以两处共用这一个组件而不是各写一份：复制一份的代价
 * 不是多 800 行，而是从此分区数与字段口径会各自漂移。本文件因此不渲染任何外壳
 * （`WorkspaceLayout` 由上面两个页面各自提供、加载与失败两态也在那边）。
 *
 * 连带的一条：这一整页的样式作用域是 `.mw-root[data-module] .proj-detail`，
 *    属性选择器不带值正是为了让它在两个模块下都命中。写成
 *    `[data-module='projects']` 时，工作模块那一份会一条规则都不命中 ——
 *    页面照常渲染、只是全裸，且零报错。判据在 `styles/module-workspace.css` 的项目详情段首。
 *
 * ============================================================================
 * 这一版换掉了什么（2026-09-25）
 * ============================================================================
 * 上一版按 `design/project/project_index.html` 落地：概览 + 9 个分区
 * （概览/任务/里程碑/文档/笔记/知识图谱/时间线/复盘/设置）+ 常驻右栏 + 页面级头部卡。
 * 这一版按原型换成：可折叠 Hero 卡 + 下划线 Tab 栏 + 7 个分区
 * （总览/任务/Bug/文档/运维/会议/账户），右栏取消。
 *
 * 那 6 个被去掉的分区（里程碑/笔记/知识图谱/时间线/复盘/设置）是用户明确要移除的，
 *    连同它们的组件与演示数据一起删了 —— 不是漏迁，别照着旧原型补回来。
 *    文件头这一条是给下一个读到 `design/project/project_index.html` 的人的。
 *
 * ============================================================================
 * 三处不是"原型怎么写就怎么抄"的地方
 * ============================================================================
 * ① 分区可见性由数据决定，不由 scope 白名单决定。`servers` / `accounts` /
 *    `deployDocs` 这三组池子只有 work 域有内容（"生产服务器"与"平台账号"是软件
 *    项目才有的东西），派生出 0 条就隐藏那个分区。所以 work 项目是 7 个分区，
 *    生活/学习项目是 4~5 个 —— 判据在 `POOL`，不在这里写死一张表。
 *
 * ② 文档书脊上的标签用 `doc.source`（腾讯文档 / 语雀 / Git 仓库 / 本地 Markdown），
 *    原型那里写的是「方案 / 规范 / 设计」—— 那是文档种类，而 `DocumentItem`
 *    没有这个字段。按种类编一张映射表就是造假字段，用已有的 `source` 是同一格的真值。
 *
 * ③ ⋯ 菜单只有「复制链接」是真动作（写剪贴板）。归档/暂停/删除、编辑、调整进度
 *    都没有写接口（`api/projects.ts` 只有读），所以它们诚实地回一句"还没接"，
 *    而不是点一下把界面改掉、背后什么都没发生 —— 那与 v1 的「状态徽标循环」是同一类谎言，
 *    那个已经被明确撤掉过（见 `components/workspace/project/api.ts` 的注释）。
 *
 * 数据口径：任务与文档 = 真实派生（`fetchProjectDetail`）；
 * Bug / 服务器 / 发布记录 / 会议 / 账户 = 池子 + 确定性派生（`data/derive.ts`），
 * 与 `buildDocuments` 同一类，应用没有这五张表。
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Icon } from '../../icons/Icon'
import { MilestoneTimeline } from '../../detail/MilestoneTimeline'
import { ActivityFeed } from '../../detail/ActivityFeed'
import { DocLibrary } from './DocLibrary'
import { useSourceOverlay } from './doc-source/use-source-overlay'
import { DocBook } from './DocBook'
import { AccountPanel } from './AccountPanel'
import { OpsPanel } from './OpsPanel'
import { MilestoneFormModal } from './MilestoneFormModal'
import { OpsIcon, type OpsIconName } from './ops-icon'
import { useModuleTab } from '../../../hooks/use-module-tab'
import { useMilestoneActions, useProjectActions, useProjectDetail } from '../../../hooks/use-projects'
import { patchOf } from '../../projects/project-form'
import { ProjectDeleteModal, ProjectFormModal } from '../../projects/ProjectModal'
import { useProjectHtml } from '../../../hooks/use-project-html'
import { useProjectAccounts } from '../../../hooks/use-project-accounts'
import { useProjectBugs } from '../../../hooks/use-project-bugs'
import { useProjectMeetings } from '../../../hooks/use-meetings'
import { useProjectTasks, useTaskMutations } from '../../../hooks/use-tasks'
import { openProjectHtml } from '../../../api/project-html'
import { errorText } from '../../../api/error'
import { WorkspaceModal } from '../WorkspaceModal'
import { cn } from '../../../lib/cn'
import { toast } from '../../../stores/toast-store'
import {
  ACCOUNT_ENV_LABEL,
  ACCOUNT_TYPES,
  accountBadge,
  BUG_LEVEL_COLOR,
  BUG_LEVEL_LABEL,
  BUG_STATUS_LABEL,
  buildAccounts,
  buildBugs,
  buildMeetings,
  ownerDisplayName,
  type DeployItem,
  type ServerItem,
} from '../../../data/derive'
import { toDeployDocItem, toDeployItem } from '../../../lib/server-view'
import { useProjectServers, useReleases } from '../../../hooks/use-servers'
import { useDeployDocs, useDocs } from '../../../hooks/use-docs'
import { adaptDocs, adaptTasks, type WsDoc, type WsTask } from '../../../data/workspace/project'
import {
  applyOverride,
  projectTone,
  toggleOverride,
  workTaskRows,
  type TaskOverride,
} from '../../../data/workspace/work-tasks'
import { WorkTaskBoard } from '../work/WorkTaskBoard'
import type { ModuleTab } from '../../../data/workspace/types'
import type { ActivityItem, Milestone, MilestoneState, Project, ProjectStatus, Toast } from '../../../types'

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

/**
 * 分区 → Tab 上的那枚 15px 图标（原型 `data-ico-size="15"`）。
 * 与运维分区同一张 24 网格表（`ops-icon.tsx`）：原型那一页从头到尾只有一套图标，
 *    所以这里不留第二张表、也不用 `IconSprite`（那是应用公共资产、符号集不同）。
 * 与 `SECTION_TABS` 分开写：那份表同时喂给 `WorkspaceLayout` 的环，
 *    而环有自己的图标体系 —— 把 `icon` 塞进 `ModuleTab` 就等于让两个体系共用一个字段。
 */
const TAB_ICON: Record<TabKey, OpsIconName> = {
  overview: 'dashboard',
  tasks: 'task',
  bugs: 'bug',
  docs: 'doc',
  ops: 'rocket',
  meetings: 'calendar',
  accounts: 'key',
}

/** 状态 → 页面主色（与工作模块的项目抽屉同一张表，见 `ProjectDrawers.tsx`）
 *  归档复用「已完成」那一支灰：两者都是"已经收口"，给它另配一支颜色会与状态本身抢读
 *      （详情页那一圈 `--c` 是整页的强调色，多一个语义就少一分区分度）。 */
const STATUS_CLASS: Record<ProjectStatus, string> = {
  active: 'p-active',
  risk: 'p-risk',
  planning: 'p-planning',
  done: 'p-done',
  archived: 'p-done',
}

/**
 * `done` 原来写着「已归档」—— 那是归档状态还不存在时的叫法。
 *    现在 `archived` 才是已归档，两者同名会让 Hero 上那枚徽标读不出
 *    "这件事做完了"与"这件事被收走了"的区别，所以 `done` 改回「已完成」。
 */
const STATUS_LABEL: Record<ProjectStatus, string> = {
  active: '进行中',
  risk: '有风险',
  planning: '规划中',
  done: '已完成',
  archived: '已归档',
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
  /** 打开「图形文件」列表 —— 项目目录里的 html（流程图 / 架构图） */
  onFigures: () => void
  /** 编辑项目（`ProjectFormModal`，与列表页同一套表单） */
  onEdit: () => void
  /** 归档（`status='archived'`）—— 不删数据，从「进行中」里拿掉 */
  onArchive: () => void
  /** 删除（`ProjectDeleteModal` 二次确认，连带正文文件与卫星表） */
  onDelete: () => void
}

function Hero({ project, open, onToggle, notice, onFigures, onEdit, onArchive, onDelete }: HeroProps) {
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
      {/* 这一条不给 role="button"：它里面还有一排真控件（进度、编辑、⋯、折叠），
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
            {/* 逾期那一档换色（`.hd-urgent.is-over` → danger）：原型是写完文案再换 class，
                应用里两个都是推导出来的，所以在一处判 —— 少一处就会出现"写着逾期、还是橙的"。 */}
            <span className={cn('hd-urgent', project.daysLeft < 0 && 'is-over')}>
              {project.daysLeft >= 0 ? `剩 ${project.daysLeft} 天` : `逾期 ${-project.daysLeft} 天`}
            </span>
          </div>

          <button type="button" className="btn btn-ghost btn-sm" onClick={onEdit}>
            编辑
          </button>

          <div className="more-menu">
            <button
              type="button"
              className="more-btn"
              aria-haspopup="menu"
              aria-expanded={moreOpen}
              aria-label="更多项目操作"
              onClick={() => setMoreOpen((v) => !v)}
            >
              <OpsIcon name="more" size={14} />
            </button>
            <div className={cn('more-dropdown', moreOpen && 'open')} role="menu">
              {/* 这一排原来是 emoji（🔗/📦/⏸/🗑）—— 原型 09-27 那条「页面里不再出现 emoji 图标」
                  说的就是它们：emoji 自带颜色、不参与 `color`，`.more-item.danger` 那个红字对它无效。
                  现在全走同一张 24 网格表（`ops-icon.tsx`）。 */}
              <div className="more-item" role="menuitem" tabIndex={0} onClick={copyLink}>
                <OpsIcon name="copy" size={14} /> 复制链接
              </div>
              {/* 流程图 / 架构图在项目目录里，用独立窗口打开（`file://`，见 lib.rs 的 `project_html_open`） */}
              <div
                className="more-item"
                role="menuitem"
                tabIndex={0}
                onClick={() => {
                  setMoreOpen(false)
                  onFigures()
                }}
              >
                <OpsIcon name="expand" size={14} /> 图形文件
              </div>
              <div
                className="more-item"
                role="menuitem"
                tabIndex={0}
                onClick={() => {
                  setMoreOpen(false)
                  onArchive()
                }}
              >
                <OpsIcon name="archive" size={14} /> 归档项目
              </div>
              {/* 分隔线把"对项目做什么"与"离开 / 收走这个项目"分开（原型在「全部项目」之前有一条） */}
              <div className="more-sep" role="separator" />
              <div
                className="more-item danger"
                role="menuitem"
                tabIndex={0}
                onClick={() => {
                  setMoreOpen(false)
                  onDelete()
                }}
              >
                <OpsIcon name="trash" size={14} /> 删除项目
              </div>
            </div>
          </div>

          <button type="button" className="fold-toggle" title={open ? '收起' : '展开'} aria-label={open ? '收起' : '展开'} onClick={onToggle}>
            <OpsIcon name="chevD" size={14} />
          </button>
        </div>
      </div>

      <div className="hero-body">
        <div className="hero-body-inner">
          <div className="body-label">项目说明</div>
          <p className="body-text">{project.description}</p>
          <div className="body-meta">
            <span>创建 {project.startDate}</span>
            {/* 负责人 / 目录都是"有才显示"的一项 —— 它们现在可以在弹窗里清空
                （负责人能全取消、目录能留空）。清空之后留一个"负责人 "的空壳，
                比不显示更糟：看着像渲染坏了。 */}
            {project.owners.length ? (
              <>
                <span className="sep">·</span>
                <span>负责人 {project.owners.map(ownerDisplayName).join(' · ')}</span>
              </>
            ) : null}
            <span className="sep">·</span>
            <span>可见性 {project.visibility}</span>
            {project.path ? (
              <>
                <span className="sep">·</span>
                <span>目录 {project.path}</span>
              </>
            ) : null}
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
      {/* 已完成那组不报截止（原型的 `.task-row.done` 就只有优先级徽标）：
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

/* 文档书脊 —— 落到 `DocBook.tsx` 了（2026-09-27 统一：概览 / 书墙 / 紧凑档 / 运维
   四处共用同一个精装封面组件；此前这里那份是"简版三行"，与运维的四行版是两套）。 */

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
  milestones,
  activity,
  gotoTab,
  openTab,
  onToggleTask,
  onOpenDoc,
  onEditDoc,
  onAddMilestone,
  onEditMilestone,
  onSetMilestoneState,
}: {
  tasks: WsTask[]
  bugs: ReturnType<typeof buildBugs>
  docs: WsDoc[]
  servers: ServerItem[]
  deploys: DeployItem[]
  meetings: ReturnType<typeof buildMeetings>
  accounts: ReturnType<typeof buildAccounts>
  milestones: Milestone[]
  activity: ActivityItem[]
  gotoTab: (key: TabKey) => void
  openTab: TabKey[]
  onToggleTask: (id: string) => void
  /* 点一本书 = 打开它的原文（这一格没有详情屏，读正文就是它唯一的下场） */
  onOpenDoc: (doc: WsDoc) => void
  /* 动作条上那颗「编辑」：同一篇，直接落在编辑镜头 */
  onEditDoc: (doc: WsDoc) => void
  onAddMilestone: () => void
  onEditMilestone: (m: Milestone) => void
  onSetMilestoneState: (m: Milestone, state: MilestoneState) => void
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
            <DocBook
              key={doc.id}
              doc={doc}
              onOpen={() => onOpenDoc(doc)}
              actions={{ onPreview: () => onOpenDoc(doc), onEdit: () => onEditDoc(doc) }}
            />
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
                <div className="deploy-dot" style={{ ['--dc' as string]: item.result === 'success' ? 'var(--c-success)' : 'var(--c-warning)' }} />
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
            {accounts.slice(0, 1).map((acc) => {
              /* 有效期与文案都走账户分区同一处判据（`accountBadge` / `ACCOUNT_TYPES`）——
                 两处各写一份，迟早出现"行上说逾期、概览说正常"或"密钥写着密码已加密"。 */
              const threshold = accountBadge(acc.dueDays, acc.disabled)
              return (
                <div key={acc.id} className="account-card">
                  <div className="account-key">🔑</div>
                  <div className="account-info">
                    <div className="account-platform">
                      {acc.platform}
                      <span className={cn('account-env', acc.env)}>{ACCOUNT_ENV_LABEL[acc.env]}</span>
                    </div>
                    <div className="account-user">{acc.user}</div>
                    <div className="account-pwd">{ACCOUNT_TYPES[acc.type].plain ? '🔒 密码已加密' : '🔑 密钥不回显'}</div>
                  </div>
                  {/* 「正常」那一档不占位（这张卡只有一行，胶囊只在要注意时才出现） */}
                  {threshold.kind === 'plain' ? null : (
                    <span className={cn('account-expire', (threshold.kind === 'danger' || threshold.kind === 'warn') && 'warn')}>
                      {threshold.text}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : null}

      <div className="card rc-milestone">
        <CardHead
          icon="🎯"
          title="里程碑"
          count={milestones.length ? `${milestones.length}` : undefined}
          action={
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={onAddMilestone}
              title="添加里程碑"
            >
              <OpsIcon name="plus" size={14} /> 添加
            </button>
          }
        />
        {milestones.length ? (
          <MilestoneTimeline
            milestones={milestones}
            onEdit={onEditMilestone}
            onSetState={onSetMilestoneState}
          />
        ) : (
          <div className="q-empty">还没有里程碑 —— 点「添加」记一条计划节点</div>
        )}
      </div>

      {activity.length > 0 ? (
        <div className="card rc-activity">
          <CardHead icon="📋" title="动态" count={`${activity.length}`} />
          <ActivityFeed activity={activity} />
        </div>
      ) : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 视图状态
 * ------------------------------------------------------------------ */

/**
 * 这一页的全部状态与派生数据。与壳无关，所以整块抽在这里。
 *
 * `basePath` 是子分区的基路径（`/projects/<id>` 或 `/work/projects/<id>`），
 * 交给 `useModuleTab` 生成地址 —— 两个壳的唯一差别就是它。
 *
 * 两个调用方都只调一次，把返回值同时用于套壳与正文（环要用 `sections`，
 *    正文要用别的）—— 调两次会得到两份独立的状态（勾选、Hero 折叠各一份），
 *    那种错很奇怪：壳里的计数会跟着更新，而正文不跟。
 */
export function useProjectDetailView(id: string | undefined, basePath: string) {
  const { data, isLoading, isError } = useProjectDetail(id)

  /* 勾选状态记在覆盖表里，而不是拿到数据后 setState 一份副本 —— 理由见旧版注释：
     副本要在 effect 里同步，会让"数据刷新冲掉用户刚勾的状态"变成要额外兜的竞态。 */
  const [override, setOverride] = useState<Record<string, TaskOverride>>({})
  const [heroOpen, setHeroOpen] = useState(false)
  /**
   * 账户清单的修订号。账户是就地改池子那一份数组的（添加 / 编辑 / 停用 /
   * 删除 / 轮换都走 `AccountPanel`），数组引用不变 ⇒ 这一层不会自己重渲，
   * Tab 上的计数就会停在旧值（原型专门警告过"徽标说 7 条、清单只剩 6 条"）。
   * 于是让子组件在每次改动后拨一下这个自增开关 —— 它只参与"什么时候重算"，不参与取值。
   */
  const [accountsRev, setAccountsRev] = useState(0)
  const bumpAccounts = useCallback(() => setAccountsRev((n) => n + 1), [])

  /* 任务走真实库（`task` 表）；`data.tasks` 是演示派生，只留给还没换源的地方 */
  const realTasks = useProjectTasks(id)
  const taskActions = useTaskMutations()
  const baseTasks = useMemo(() => adaptTasks(realTasks), [realTasks])
  const tasks: WsTask[] = useMemo(
    () =>
      baseTasks.map((task) => {
        const hit = override[task.id]
        return hit && hit.state !== task.status
          ? { ...task, status: hit.state, late: hit.state === 'done' ? false : task.late }
          : task
      }),
    [baseTasks, override],
  )

  /* 「任务」分区那一格的四档视图（`WorkTaskBoard`）读的是行，不是 `WsTask` ——
     四象限、日历、分布那几档要的是"第几天"与格位，那些只有 `Task` 上才有。 */
  const taskRows = useMemo(
    () => (data ? applyOverride(workTaskRows(data.project, realTasks, projectTone(0)), override) : []),
    [data, realTasks, override],
  )

  /* 文档索引走自己的查询（库里的索引 + 本地正文那一半都归它）——
     与 `useProjectServers` 同形：真实库还是演示池由 api 层按宿主分派。 */
  const docItems = useDocs(data?.project.id)
  const docs = useMemo(() => adaptDocs(docItems), [docItems])
  /* 问题清单走真实库（`project_bug`）—— 原先 `buildBugs` 的条数是按"有没有风险"编的 */
  const bugs = useProjectBugs(data?.project.id)
  /* 运维三样走真实库：机器按"服务本项目"过滤，发布记录与部署文档按项目查 */
  const servers = useProjectServers(data?.project.id)
  const { data: releases } = useReleases(data?.project.id)
  const { data: rawDeployDocs } = useDeployDocs(data?.project.id)
  const deploys = useMemo(() => (releases ?? []).map(toDeployItem), [releases])
  const deployDocs = useMemo(() => (rawDeployDocs ?? []).map(toDeployDocItem), [rawDeployDocs])
  /* 会议走真实库（`work_meeting`，0007 给它加了可空的 `project_id`） */
  const meetings = useProjectMeetings(data?.project.id)
  /* 凭据清单：真数据。演示池那份按 scope 共享，改一个项目会连带别的项目 —— 已经不用了 */
  const accounts = useProjectAccounts(data?.project.id)

  /* 分区**全部常显**（见文件头 ①）。
     以前运维按"有机器"、账户按"有凭据"隐藏，结果两格都成了"从 0 到 1"的死锁：
     用户看不到入口、也建不出第一条，只会问"我的运维呢"。
     现在空态各自说清去哪加（运维指向「服务器」页、账户就在本格添加）。 */
  const sections = SECTION_TABS

  const { active, select } = useModuleTab(basePath, sections)
  const openTab = sections.map((t) => t.key as TabKey)

  /**
   * 页面级回执。
   * 第二个参数是给破坏性操作留的后悔入口（运维页移除一条文件位置后的「撤销」）——
   *    应用原来的 `notice` 只收一句话，而撤销这件事在 `Toast` 里本来就有位置。
   */
  const notice = (text: string, action?: Toast['action']) => toast(text, action)

  /**
   * 勾一条任务。取消完成回到**原来那一档**（`toggleOverride` 里那条）——
   *    覆盖表存的是 `{ state, prev }`，所以这个函数不再自己推 next。
   * 回执写在事件里，不写进 `setOverride` 的更新函数：StrictMode 下更新函数会跑两遍。
   */
  /** 快捷添加：只给标题就够了 —— 项目、归属域由这一页定，优先级默认中，状态待办 */
  const createTask = (title: string) => {
    if (!data) return
    taskActions.create.mutate(
      { scope: data.project.scope, projectId: data.project.id, title, state: 'todo', priority: 'mid' },
      {
        onSuccess: () => toast(`已创建「${title}」`),
        onError: (error) => toast(`创建失败：${errorText(error)}`),
      },
    )
  }

  const toggleTask = (taskId: string) => {
    const task = baseTasks.find((item) => item.id === taskId)
    if (!task) return
    const done = (override[taskId]?.state ?? task.status) === 'done'
    setOverride((prev) => toggleOverride({ id: task.id, state: task.status }, prev))
    taskActions.setState.mutate(
      { id: task.id, state: done ? 'todo' : 'done' },
      {
        onSuccess: () => toast(done ? `已重置「${task.title}」` : `已完成「${task.title}」`),
        onError: (error) => toast(`改状态失败：${errorText(error)}`),
      },
    )
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

  const counts = useMemo<Partial<Record<TabKey, string>>>(
    () =>
      !data
        ? {}
        : {
            tasks: `${tasks.filter((t) => t.status === 'done').length}/${tasks.length}`,
            bugs: String(bugs.length),
            docs: String(docs.length),
            ops: [servers.length, deployDocs.length, deploys.length].filter(Boolean).join('·'),
            meetings: String(meetings.length),
            accounts: String(accounts.length),
          },
    /* 两个依赖都要：`accounts.length` 是取值，`accountsRev` 是"它可能已经变了"的信号
       （数组引用不变，只有这一层自己知道要不要重算，见 `accountsRev` 的注释）。 */
    [data, tasks, bugs, docs, servers, deployDocs, deploys, meetings, accounts.length, accountsRev],
  )

  /* 「更新点」（分区上的红点）已随原型撤掉：原型的 Tab 行上不再有那颗点，
     所以这里连推导一起删 —— 留一个没有消费者的 `updating` 只会让下一个人以为
     它还在某处画着。计数（`counts`）才是 Tab 行上唯一的数。 */

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
    taskRows,
    docs,
    bugs,
    servers,
    deploys,
    deployDocs,
    meetings,
    accounts,
    milestones: data?.milestones ?? [],
    activity: data?.activity ?? [],
    /** 分区 → 那一格右上角的计数（原型写死在标记里） */
    counts,
    toggleTask,
    createTask,
    notice,
    heroOpen,
    setHeroOpen,
    bumpAccounts,
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
 * `backTo` 只有"从工作模块进来"那一份会传：在工作模块里这一页是一次下钻，
 * 需要一条看得见的回头路；而项目模块的详情本身就是那个模块的根页面，没有上一层。
 */
export function ProjectDetail({ view, backTo }: { view: ProjectDetailView; backTo?: BackLink }) {
  /* 「图形文件」弹窗：只在打开时才扫项目目录（没填目录的项目会直接在弹窗里说清） */
  const [figuresOpen, setFiguresOpen] = useState(false)
  const [editingOpen, setEditingOpen] = useState(false)
  const [deletingOpen, setDeletingOpen] = useState(false)
  /* 里程碑编辑/新增弹窗。null = 关；{ mode: 'add' } = 新增；{ mode: 'edit', target } = 编辑 */
  const [milestoneModal, setMilestoneModal] = useState<
    | { mode: 'add' }
    | { mode: 'edit'; target: Milestone }
    | null
  >(null)
  const projectActions = useProjectActions()
  const milestoneActions = useMilestoneActions()
  const navigate = useNavigate()
  const {
    project,
    tasks,
    taskRows,
    docs,
    bugs,
    servers,
    deploys,
    deployDocs,
    meetings,
    milestones,
    activity,
    sections,
    active,
    select,
    counts,
    openTab,
    toggleTask,
    createTask,
    notice,
    heroOpen,
    setHeroOpen,
    bumpAccounts,
  } = view


  /* 原文页：概览格那几本书点开就是它（详情那一屏是文档索引页的本事，概览格没有）。
     挂在这里而不是 `OverviewPanel` 里：那一格只是这一页的一块，覆盖层归页面管。 */
  const { openSource, sourceNode } = useSourceOverlay(project?.name ?? '', notice)

  /* 图形文件（项目目录里的 html）。放在条件 return 之前 —— hook 不能写在它后面；
     `project?.id` 未定时 `enabled` 为 false，不会打命令。 */
  const figures = useProjectHtml(project?.id, figuresOpen)

  /* 凭据清单：真数据（`project_account`）。形态仍是 `AccountItem`，`AccountPanel` 的渲染不变。
     演示池那份（`view.accounts`）不再用 —— 它按 scope 共享，改一个项目会连带别的项目。 */
  const accounts = useProjectAccounts(project?.id)
  /* Tab 上的「账户 N」跟着真数据走（`view.counts` 是按演示池算的） */
  const liveCounts = { ...counts, accounts: accounts.length }

  /* 数据没到 → 不渲染正文。加载/失败两态由调用方连同外壳一起给：
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

      <Hero
        project={project}
        open={heroOpen}
        onToggle={() => setHeroOpen((v) => !v)}
        notice={notice}
        onFigures={() => setFiguresOpen(true)}
        onEdit={() => setEditingOpen(true)}
        onArchive={() =>
          projectActions.setStatus.mutate(
            { id: project.id, status: 'archived' },
            {
              onSuccess: () => notice(`已归档「${project.name}」`),
              onError: (error) => notice(`归档失败：${errorText(error)}`),
            },
          )
        }
        onDelete={() => setDeletingOpen(true)}
      />

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
                className={cn('tab', isActive && 'active')}
                onClick={() => select(tab.key)}
              >
                <OpsIcon name={TAB_ICON[key]} size={15} />
                {tab.label}
                {liveCounts[key] ? <span className="tab-count">{liveCounts[key]}</span> : null}
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
            milestones={milestones}
            activity={activity}
            gotoTab={(key) => select(key)}
            openTab={openTab}
            onToggleTask={toggleTask}
            onOpenDoc={openSource}
            onEditDoc={(doc) => openSource(doc, 'edit')}
            onAddMilestone={() => setMilestoneModal({ mode: 'add' })}
            onEditMilestone={(m) => setMilestoneModal({ mode: 'edit', target: m })}
            onSetMilestoneState={(m, state) =>
              milestoneActions.setState.mutate(
                { id: m.id, state },
                {
                  onSuccess: () => notice(`已切到「${state === 'done' ? '已完成' : state === 'now' ? '进行中' : '待启动'}」`),
                  onError: (error) => notice(`改状态失败：${errorText(error)}`),
                },
              )
            }
          />
        ) : null}

        {active === 'tasks' ? (
          /* 任务（原型 `design/work/work_task.html`，2026-10-14）。
             上一版是"两段分组列表"（进行中 / 已完成）—— 与工作模块「任务」那一页
             是两套实现。现在两处共用同一个组件与同一套四档视图，
             数据这一层换成 `workTaskRows`（四象限与日历要的是 `Task` 上的日偏移）。 */
          <WorkTaskBoard
            rows={taskRows}
            notice={notice}
            onToggle={(row) => toggleTask(row.id)}
            onAdd={createTask}
          />
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
             这里不再包一层 `.card rc-doc`：那一版的"一张卡片 + 标题 + 新建按钮"
                与下面这一版的结构不兼容（这一版自带子类栏、工具栏与结果条，
                标题行与"共 N 篇"是重复的两处计数）。理由写在 `DocLibrary` 文件头。 */
          <DocLibrary
            docs={docs}
            owner={{ kind: 'project', id: project.id }}
            projectName={project.name}
            notice={notice}
          />
        ) : null}

        {active === 'ops' ? (
          /* 运维（原型 `工作-项目-项目详情-运维-index.html`）。
             零机器也**渲染完整框架**：三条 KPI（当前版本 / 最近发布 / 已连接）+ 服务器卡
             的「＋ 添加」+ 部署文档 / 发布记录的空卡 —— 原型的默认布局本来如此，
             "没有数据就只剩一句话"会把原地新增的入口也一并弄丢（2026-10-24 教训）。 */
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
          /* 账户（原型 `工作-项目-项目详情-账户-index.html`）。
             这一整块由 `AccountPanel` 负责，它自带一层 `.ac-page` 作用域，
                并与运维分区共用 `.ops-page` 那套页面骨架（卡片 / KPI 条 / 徽标）。
                账户与运维共用 `.badge` / `.env-tag` 这类通用类名，靠作用域把双方关在各自分区内。 */
          <AccountPanel accounts={accounts} notice={notice} onChanged={bumpAccounts} />
        ) : null}
      </div>

      {sourceNode}

      {/* 图形文件：项目目录里的 .html（流程图 / 架构图）。
          点一行 → 壳层开一个独立窗口加载 `file://`（不走前端路由：那些文件自带内联脚本与相对资源）。 */}
      {figuresOpen ? (
        <WorkspaceModal title="图形文件" onClose={() => setFiguresOpen(false)}>
          {figures.isLoading ? (
            <p className="stat-desc">正在扫项目目录…</p>
          ) : figures.error ? (
            <p className="stat-desc">{errorText(figures.error)}</p>
          ) : !figures.data?.length ? (
            <p className="stat-desc">
              项目目录里还没有 .html —— 把流程图 / 架构图放进去（比如 mermaid 导出的）就会出现。
            </p>
          ) : (
            <div className="figure-list">
              {figures.data.map((file) => (
                <button
                  key={file.rel}
                  type="button"
                  className="figure-row"
                  onClick={() =>
                    openProjectHtml(project.id, file.rel).catch((error) =>
                      notice(`打不开：${errorText(error)}`),
                    )
                  }
                >
                  <span className="figure-name">{file.name}</span>
                  <span className="figure-meta">
                    {file.rel} · {sizeText(file.size)} · {timeText(file.mtime)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </WorkspaceModal>
      ) : null}

      {/* 编辑 / 删除：与项目列表页、工作台项目卡同一套弹窗 —— 三处都走 `ProjectFormModal`，
          不各写一份表单（那样迟早有一处漏字段，而漏字段在界面上看不出来）。 */}
      {editingOpen ? (
        <ProjectFormModal
          mode="edit"
          initial={patchOf(project)}
          onClose={() => setEditingOpen(false)}
          onSubmit={(patch) => {
            projectActions.save.mutate(
              { id: project.id, patch },
              {
                onSuccess: () => {
                  notice(`已保存「${patch.name}」`)
                  setEditingOpen(false)
                },
                onError: (error) => notice(`保存失败：${errorText(error)}`),
              },
            )
          }}
        />
      ) : null}

      {deletingOpen ? (
        <ProjectDeleteModal
          project={project}
          onClose={() => setDeletingOpen(false)}
          onConfirm={() => {
            const name = project.name
            const back = backTo?.path ?? '/projects'
            projectActions.remove.mutate(project.id, {
              onSuccess: () => {
                notice(`已删除「${name}」`)
                setDeletingOpen(false)
                /* 删完这一页就不存在了 —— 停在原地会是一张空壳 */
                navigate(back)
              },
              onError: (error) => notice(`删除失败：${errorText(error)}`),
            })
          }}
        />
      ) : null}

      {/* 里程碑编辑/新增 —— 表与接口都在，UI 此前缺这一格。
          新增拿 project.id；编辑拿 target.id。删除在弹窗内部二次确认。 */}
      {milestoneModal ? (
        <MilestoneFormModal
          mode={milestoneModal.mode}
          projectId={project.id}
          target={milestoneModal.mode === 'edit' ? milestoneModal.target : undefined}
          onClose={() => setMilestoneModal(null)}
        />
      ) : null}
    </div>
  )
}

/** 文件大小给人看的那一档（KB / MB）。 */
function sizeText(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

/** 修改时刻：后端给的是 Unix 秒，`new Date` 才是本地时区（后端自己算会差 8 小时）。 */
function timeText(secs: number): string {
  if (!secs) return '—'
  return new Date(secs * 1000).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}
