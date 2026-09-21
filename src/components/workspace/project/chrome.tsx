import { cn } from '../../../lib/cn'
import type { Priority, ProjectStatus, Scope } from '../../../types'
import { NoteCapture, NoteRow } from './content-views'
import { TaskCheck } from './task-views'
import type { ProjectApi } from './api'

/**
 * 项目工作区的"外壳"两件：头部与常驻右栏。
 *
 * 右栏的三条约定（原型明确写下的，不是随手排的）：
 *   · **跨 Tab 常驻，所以只放"无论在哪个 Tab 都想看见"的东西**；
 *   · 顺序按**看的频次**排，不按分类排 —— 所以"当前任务 / 笔记"在最上面，
 *     "项目信息 / 快捷操作"往下沉（这一栏会滚，滚不到的才算沉底）；
 *   · **捕获类入口用"就在那儿的输入框"**，不写成按钮 —— 捕获路径上不许多一个动作。
 */

/* ------------------------------------------------------------------ *
 * 徽标的三个映射表
 * ------------------------------------------------------------------ */

const SCOPE_LABEL: Record<Scope, string> = { life: '生活', work: '工作', learn: '学习' }

/**
 * 应用的项目状态是四档（与后端枚举对齐），原型的徽标样式有五档。
 * 映射按**语义**取，不按顺序取 —— `planning` 是"还没开始"，对应 neutral，
 * 而不是把它硬塞进"验收"那一档的样式里。
 *
 * ⚠️ 文案要与 `src/data/meta.ts` 的 `STATUS_META` 一致（那里写的是「风险阻塞」）。
 * 两处各写一套的话，同一条数据在列表页叫「风险阻塞」、在工作区叫「阻塞」——
 * 而它们只差两个字，评审时最容易被当成"设计如此"滑过去。
 */
const STATUS_CLASS: Record<ProjectStatus, string> = {
  planning: 'badge-neutral',
  active: 'badge-doing',
  risk: 'badge-danger',
  done: 'badge-ok',
}

const STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: '规划中',
  active: '进行中',
  risk: '风险阻塞',
  done: '已完成',
}

/** 与任务行同一套映射（high→P0 / mid→P1 / low→P2），不另起一套。 */
const PRIO_CLASS: Record<Priority, string> = { high: 'prio-P0', mid: 'prio-P1', low: 'prio-P2' }
const PRIO_LABEL: Record<Priority, string> = { high: 'P0', mid: 'P1', low: 'P2' }

/* ------------------------------------------------------------------ *
 * 头部
 * ------------------------------------------------------------------ */

/**
 * 头部是**只读**的。
 *
 * 原型里状态徽标点一下就循环、进度条点一下就改 —— 那是演示稿为了让人看见
 * "这个徽标长什么样"而给的后门。在这个页面上，那些数字是真实项目的数据：
 * 点一下把「进行中」改成「验收」而背后什么都没变，就是在骗人。
 * 所以三个都改成纯展示；要改状态得走真正的编辑入口（尚未实现）。
 */
export function ProjectHeader({ api }: { api: ProjectApi }) {
  const { project } = api
  return (
    <section className="card project-header">
      <div className="project-title-row">
        <div className="project-title">{project.name}</div>
        <span className="badge badge-scope">{SCOPE_LABEL[project.scope]}</span>
        <span className={cn('badge', STATUS_CLASS[project.status])}>{STATUS_LABEL[project.status]}</span>
        <span className={cn('badge prio', PRIO_CLASS[project.priority])}>{PRIO_LABEL[project.priority]}</span>
      </div>

      <div className="project-meta">
        <span>
          开始：<strong>{project.startDate}</strong>
        </span>
        <span>
          截止：<strong>{project.dueLong}</strong>
        </span>
        <span>
          标签：<strong>{project.tags.join(' / ')}</strong>
        </span>
      </div>

      <div className="project-progress">
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${project.progress}%` }} />
        </div>
        <div className="progress-text">{project.progress}%</div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * 右栏
 * ------------------------------------------------------------------ */

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="info-row">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  )
}

export function ProjectAside({ api }: { api: ProjectApi }) {
  const doing = api.tasks.filter((t) => t.status === 'doing')
  const { project } = api

  return (
    <aside className="aside">
      <div className="aside-card">
        <div className="aside-title">当前任务</div>
        {doing.length ? (
          doing.map((task) => (
            <div key={task.id} className="rail-task">
              <TaskCheck task={task} onToggle={() => api.toggleTask(task.id)} />
              <span className="rail-task-title" title={task.title}>
                {task.title}
              </span>
              <span className={cn('rail-task-due', task.late && 'is-late')}>{task.due}</span>
            </div>
          ))
        ) : (
          <div className="q-empty">没有进行中的任务</div>
        )}
      </div>

      <div className="aside-card">
        <div className="aside-title">笔记</div>
        <NoteCapture api={api} />
        {/* 右栏只放最近三条：它是"刚记下的那几笔"的位置，不是笔记的索引 */}
        {api.notes.slice(0, 3).map((note) => (
          <NoteRow key={note.id} api={api} note={note} />
        ))}
        <button type="button" className="quick-btn" style={{ marginTop: 10 }} onClick={() => api.gotoTab('notes')}>
          全部笔记 →
        </button>
      </div>

      {/* 只放**真实存在**的字段。原型这里有一行「日程」——应用里没有日程数据，
          留着它就得编一个数字出来，所以这一行直接去掉。 */}
      <div className="aside-card">
        <div className="aside-title">项目信息</div>
        <InfoRow label="Scope" value={SCOPE_LABEL[project.scope]} />
        <InfoRow label="状态" value={STATUS_LABEL[project.status]} />
        <InfoRow label="优先级" value={PRIO_LABEL[project.priority]} />
        <InfoRow label="进度" value={`${project.progress}%`} />
        <div className="aside-divider" />
        <InfoRow label="预算" value={project.budget} />
        <InfoRow label="可见性" value={project.visibility} />
        <InfoRow label="仓库" value={project.repoUrl} />
        <InfoRow label="文档" value={project.docsUrl} />
        <InfoRow label="笔记" value={`${api.notes.length} 条`} />
      </div>

      <div className="aside-card">
        <div className="aside-title">快捷操作</div>
        <button type="button" className="quick-btn" onClick={() => api.notice('原型演示：+ 新建任务')}>
          + 新建任务
        </button>
        <button type="button" className="quick-btn" onClick={() => api.notice('原型演示：+ 新建里程碑')}>
          + 新建里程碑
        </button>
        <button type="button" className="quick-btn" onClick={() => api.notice('原型演示：+ 关联笔记')}>
          + 关联笔记
        </button>
        <button type="button" className="quick-btn" onClick={() => api.notice('原型演示：+ 记录投入')}>
          + 记录投入
        </button>
      </div>
    </aside>
  )
}
