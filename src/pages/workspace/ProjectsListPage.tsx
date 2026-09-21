import { useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { computeStats, isDueSoon } from '../../data/derive'
import { useProjects } from '../../hooks/use-projects'
import { cn } from '../../lib/cn'
import { filterProjects } from '../../lib/filter-projects'
import type { Priority, Project, ProjectStatus, Scope, ScopeFilter, SortMode, ViewMode } from '../../types'

/**
 * 项目列表（「项目」这一域的入口）。
 *
 * ⚠️ **原型里没有这一页** —— `design/project/project_index.html` 是单项目工作区。
 * 所以这一页是"参考原型的设计"而不是"照搬原型"：
 *   · 视觉语言全部**复用生成的那套类名**（`.ov-kpi` / `.toolbar` / `.seg` /
 *     `.card` / `.task-row` / `.kanban` / `.badge` / `.progress-bar`），
 *     一个都没新造 —— 于是它与工作区天然同源，不需要再对齐一次；
 *   · 功能沿用 v1.0 列表页那三套视图（卡片 / 表格 / 看板）与筛选排序，
 *     不因为换壳就把已有能力丢掉。
 *
 * 唯一需要新写样式的是搜索框与下拉 —— projects 模块的 CSS 里没有 `.form-input`
 * （它的原型没有表单弹窗）。那两条落在 `styles/workspace-shell.css`，属应用级补充。
 */

const SCOPE_LABEL: Record<Scope, string> = { life: '生活', work: '工作', learn: '学习' }
const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: '规划中',
  active: '进行中',
  risk: '风险阻塞',
  done: '已完成',
}
const STATUS_CLASS: Record<ProjectStatus, string> = {
  planning: 'badge-neutral',
  active: 'badge-doing',
  risk: 'badge-danger',
  done: 'badge-ok',
}
const PRIO_CLASS: Record<Priority, string> = { high: 'prio-P0', mid: 'prio-P1', low: 'prio-P2' }
const PRIO_LABEL: Record<Priority, string> = { high: 'P0', mid: 'P1', low: 'P2' }

const SCOPE_OPTIONS: Array<{ value: ScopeFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'life', label: '生活' },
  { value: 'work', label: '工作' },
  { value: 'learn', label: '学习' },
]

const SORT_OPTIONS: Array<{ value: SortMode; label: string }> = [
  { value: 'default', label: '默认排序' },
  { value: 'due', label: '截止最近' },
  { value: 'progress', label: '进度最高' },
  { value: 'priority', label: '优先级最高' },
]

const VIEW_OPTIONS: Array<{ value: ViewMode; label: string }> = [
  { value: 'cards', label: '卡片' },
  { value: 'table', label: '表格' },
  { value: 'kanban', label: '看板' },
]

export function ProjectsListPage() {
  const navigate = useNavigate()
  const { data: projects = [], isLoading } = useProjects()
  const [scope, setScope] = useState<ScopeFilter>('all')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<SortMode>('default')
  const [view, setView] = useState<ViewMode>('cards')

  const visible = filterProjects(projects, { scope, query, sort })
  const stats = computeStats(projects)
  const open = (id: string) => navigate(`/projects/${id}`)

  return (
    <WorkspaceLayout
      module="projects"
      tabs={[]}
      active=""
      onSelectTab={() => {}}
      topbarTitle="全部项目"
      topbarActions={
        <button className="btn btn-primary" onClick={() => navigate(`/projects/${projects[0]?.id ?? 'p1'}`)}>
          + 新建项目
        </button>
      }
    >
      <section className="ov-kpi">
        <div className="card ov-kpi-card" style={{ '--mw-kc': 'var(--mw-m-main)' } as CSSProperties}>
          <div className="ov-kpi-label">全部</div>
          <div className="ov-kpi-value">{stats.total}</div>
          <div className="ov-kpi-sub">
            生活 {stats.scopeCounts.life} · 工作 {stats.scopeCounts.work} · 学习 {stats.scopeCounts.learn}
          </div>
        </div>
        <div className="card ov-kpi-card" style={{ '--mw-kc': 'var(--mw-info)' } as CSSProperties}>
          <div className="ov-kpi-label">进行中</div>
          <div className="ov-kpi-value">{stats.active}</div>
          <div className="ov-kpi-sub">正在推进的项目</div>
        </div>
        <div className="card ov-kpi-card" style={{ '--mw-kc': 'var(--mw-danger)' } as CSSProperties}>
          <div className="ov-kpi-label">风险阻塞</div>
          <div className="ov-kpi-value">{stats.risk}</div>
          <div className="ov-kpi-sub">{stats.risk ? '需要先看这几个' : '没有阻塞中的项目'}</div>
        </div>
        <div className="card ov-kpi-card" style={{ '--mw-kc': 'var(--mw-q4)' } as CSSProperties}>
          <div className="ov-kpi-label">平均进度</div>
          <div className="ov-kpi-value">{stats.averageProgress}%</div>
          <div className="ov-kpi-sub">已完成 {stats.done} 个</div>
        </div>
      </section>

      <section className="card toolbar">
        <div className="seg">
          {VIEW_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={cn('seg-btn', view === option.value && 'active')}
              onClick={() => setView(option.value)}
            >
              {option.label}
            </div>
          ))}
        </div>

        <input
          className="proj-input"
          type="search"
          value={query}
          placeholder="搜索项目名 / 描述 / 标签 / 里程碑"
          onChange={(event) => setQuery(event.target.value)}
        />
        <select className="proj-input" value={scope} onChange={(event) => setScope(event.target.value as ScopeFilter)}>
          {SCOPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <select className="proj-input" value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="toolbar-summary">
          显示 {visible.length} / {stats.total}
        </div>
      </section>

      {isLoading ? (
        <div className="card">
          <div className="q-empty">正在读取项目…</div>
        </div>
      ) : null}

      {!isLoading && visible.length === 0 ? (
        <div className="card">
          <div className="q-empty">没有匹配的项目 —— 换个关键词或把领域切回「全部」</div>
        </div>
      ) : null}

      {view === 'cards' && visible.length ? (
        <section className="proj-grid">
          {visible.map((project) => (
            <div key={project.id} className="card proj-card" role="button" tabIndex={0} onClick={() => open(project.id)}>
              <div className="ov-card-head">
                <div className="card-title">{SCOPE_LABEL[project.scope]}</div>
                <span className={cn('badge', STATUS_CLASS[project.status])}>{STATUS_LABEL[project.status]}</span>
                <span className={cn('badge prio', PRIO_CLASS[project.priority])} style={{ marginLeft: 'auto' }}>
                  {PRIO_LABEL[project.priority]}
                </span>
              </div>
              <div className="task-row-title">{project.name}</div>
              <div className="doc-meta">{project.description}</div>
              <div className="task-row-sub">
                {project.tags.map((tag) => (
                  <span key={tag} className="tag">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${project.progress}%` }} />
              </div>
              <div className="ov-card-head">
                <span className="doc-meta">
                  {project.tasksDone}/{project.tasksTotal} 任务 · 截止 {project.dueShort}
                </span>
                <span
                  className={cn('doc-meta', isDueSoon(project) && 'text-danger')}
                  style={{ marginLeft: 'auto' }}
                >
                  {project.daysLeft >= 0 ? `剩 ${project.daysLeft} 天` : `逾期 ${-project.daysLeft} 天`}
                </span>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {view === 'table' && visible.length ? (
        <section className="card">
          <div className="card-title">全部项目</div>
          {visible.map((project) => (
            <div key={project.id} className="task-row" role="button" tabIndex={0} onClick={() => open(project.id)}>
              <div className="task-row-main">
                <div className="task-row-title">{project.name}</div>
                <div className="task-row-sub">
                  <span className="tag">{SCOPE_LABEL[project.scope]}</span>
                  <span className="tag">{project.milestone}</span>
                </div>
              </div>
              <div className="task-row-right">
                <span className={cn('task-due', project.daysLeft < 0 && 'is-late')}>
                  {project.dueShort}
                  {project.daysLeft < 0 ? ' 逾期' : ''}
                </span>
                <span className="task-quad-tag">{project.progress}%</span>
                <span className={cn('prio', PRIO_CLASS[project.priority])}>{PRIO_LABEL[project.priority]}</span>
                <span className={cn('pill', project.status === 'done' ? 'pill-done' : project.status === 'active' ? 'pill-doing' : 'pill-todo')}>
                  {STATUS_LABEL[project.status]}
                </span>
              </div>
            </div>
          ))}
        </section>
      ) : null}

      {view === 'kanban' && visible.length ? (
        <section className="card">
          <div className="card-title">按状态分栏</div>
          <div className="kanban">
            {(['planning', 'active', 'risk', 'done'] as ProjectStatus[]).map((status) => {
              const items = visible.filter((project) => project.status === status)
              return (
                <div key={status} className="kanban-col">
                  <div className="kanban-title">
                    <span>{STATUS_LABEL[status]}</span>
                    <span>{items.length}</span>
                  </div>
                  {items.map((project: Project) => (
                    <div
                      key={project.id}
                      className={cn('kanban-card', status === 'done' && 'is-done')}
                      role="button"
                      tabIndex={0}
                      onClick={() => open(project.id)}
                    >
                      {project.name}
                    </div>
                  ))}
                </div>
              )
            })}
          </div>
        </section>
      ) : null}
    </WorkspaceLayout>
  )
}
