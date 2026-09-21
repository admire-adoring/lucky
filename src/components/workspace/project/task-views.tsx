import { cn } from '../../../lib/cn'
import { QUADS, TASK_STATUS, type QuadKey, type WsMilestone, type WsTask } from '../../../data/workspace/project'
import type { ProjectApi } from './api'

/**
 * 任务三视图（列表 / 看板 / 四象限）+ 里程碑导轨。
 *
 * 三个视图**同一份数据、同一套状态规则**，只是排布不同 —— 原型里就是这么组织的，
 * 所以"看板说有 4 条、列表只列出 2 条"这类漂移在这里不可能发生。
 *
 * ⚠️ 勾选框是**受控的**：原型靠 `classList.toggle('done')` 顺手改兄弟元素的类名，
 * React 里那套会被重渲染抹掉（勾了又弹回去）。这里由 `api.toggleTask` 改状态，
 * 类名每次都由 props 重算。类名与原型一致 —— 它们是那份生成的 CSS 在消费的接口。
 */

/**
 * 勾选块。`small` 是四象限行内那一档（原型 `.task-check.is-small`）。
 *
 * ⚠️ 点击直接挂在这一层，**不要再包一层 div** —— `.task-row` / `.q-task` 都是
 * flex 容器，多一层包裹会改变 flex 子元素：`.task-check` 的 `flex-shrink:0`
 * 就不再作用于那个位置，勾选框会被文字挤扁。原型也是把监听挂在勾选框本身。
 */
export function TaskCheck({ task, small, onToggle }: { task: WsTask; small?: boolean; onToggle: () => void }) {
  const done = task.status === 'done'
  return (
    <div
      className={cn('task-check', small && 'is-small', done && 'done')}
      role="checkbox"
      aria-checked={done}
      tabIndex={0}
      aria-label="切换完成状态"
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          onToggle()
        }
      }}
    >
      {done ? '✓' : ''}
    </div>
  )
}

/** 任务行右侧的截止日期：逾期单独标色，文案沿用原型（日期 + "逾期"）。 */
function DueText({ task }: { task: WsTask }) {
  return <span className={cn('task-due', task.late && 'is-late')}>{task.late ? `${task.due} 逾期` : task.due}</span>
}

function TaskRow({ task, api }: { task: WsTask; api: ProjectApi }) {
  const done = task.status === 'done'
  return (
    <div className={cn('task-row', done && 'is-done')}>
      <TaskCheck task={task} onToggle={() => api.toggleTask(task.id)} />
      <div className="task-row-main">
        <div className="task-row-title">{task.title}</div>
        <div className="task-row-sub">
          <span className="tag">{task.owner}</span>
        </div>
      </div>
      <div className="task-row-right">
        <DueText task={task} />
        <span className="task-quad-tag">{QUADS[task.quad].name}</span>
        <span className={cn('prio', `prio-${task.prio}`)}>{task.prio}</span>
        <span className={cn('pill', TASK_STATUS[task.status].pill)}>{TASK_STATUS[task.status].label}</span>
      </div>
    </div>
  )
}

export function TaskListPanel({ api }: { api: ProjectApi }) {
  const groups: Array<[WsTask['status'], string]> = [
    ['doing', '进行中'],
    ['todo', '待办'],
    ['done', '已完成'],
  ]
  return (
    <section className="view active">
      <div className="card">
        <div>
          {groups.map(([key, label]) => {
            const items = api.tasks.filter((t) => t.status === key)
            if (!items.length) return null
            return (
              <div key={key}>
                <div className={cn('task-group', `is-${key}`)}>
                  <span className="task-group-dot" />
                  <span>
                    {label} · {items.length}
                  </span>
                </div>
                {items.map((task) => (
                  <TaskRow key={task.id} task={task} api={api} />
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export function TaskBoardPanel({ api }: { api: ProjectApi }) {
  const cols: Array<[WsTask['status'], string]> = [
    ['todo', '待办'],
    ['doing', '进行中'],
    ['done', '已完成'],
  ]
  return (
    <section className="view active">
      <div className="card">
        <div className="card-title">任务看板</div>
        <div className="kanban">
          {cols.map(([key, label]) => {
            const items = api.tasks.filter((t) => t.status === key)
            return (
              <div key={key} className="kanban-col">
                <div className="kanban-title">
                  <span>{label}</span>
                  <span>{items.length}</span>
                </div>
                {items.map((task) => (
                  <div
                    key={task.id}
                    className={cn('kanban-card', key === 'done' && 'is-done')}
                    onClick={() => api.notice(`打开任务「${task.title}」`)}
                  >
                    {task.title}
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/**
 * 四象限。
 *
 * ⚠️ `.matrix` 是 CSS Grid，**轴与格子的 DOM 顺序不能动** —— 原型里它们是按
 * "角标 → 两个列轴 → 行轴+两格 → 行轴+两格"的顺序排的，格子靠自动流占位。
 * 重排（比如把 quad 收进一个数组再渲染）会让四个格子错位到别的单元格。
 */
export function TaskMatrixPanel({ api }: { api: ProjectApi }) {
  const order: QuadKey[] = ['q1', 'q2', 'q3', 'q4']
  const cell = (key: QuadKey) => {
    const items = api.tasks.filter((t) => t.quad === key)
    return (
      <div key={key} className={cn('quad', key)}>
        <div className="quad-head">
          <span className="quad-name">{QUADS[key].name}</span>
          <span className="quad-hint">{QUADS[key].hint}</span>
          <span className="quad-count">{items.length}</span>
        </div>
        {items.length ? (
          items.map((task) => (
            <div key={task.id} className={cn('q-task', task.status === 'done' && 'is-done')}>
              <TaskCheck task={task} small onToggle={() => api.toggleTask(task.id)} />
              <span className="q-task-title">{task.title}</span>
              <span className="q-task-due">{task.due}</span>
            </div>
          ))
        ) : (
          <div className="q-empty">这一格是空的 —— 好事</div>
        )}
      </div>
    )
  }

  return (
    <section className="view active">
      <div className="card">
        <div className="card-title">四象限 · 重要 × 紧急</div>
        <div className="matrix">
          <div className="matrix-axis is-corner" />
          <div className="matrix-axis">紧急</div>
          <div className="matrix-axis">不紧急</div>

          <div className="matrix-axis is-y">重要</div>
          {cell(order[0])}
          {cell(order[1])}

          <div className="matrix-axis is-y">不重要</div>
          {cell(order[2])}
          {cell(order[3])}
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * 里程碑
 * ------------------------------------------------------------------ */

/**
 * 状态文案：直接读数据里的 `detail`。
 *
 * ⚠️ 与原型**少了一段**：原型每条里程碑写着 `2026-08-15 · 还有 3 天`，
 * 而应用里程碑模型里没有日期（`date` 字段本身就是「已完成 / 进行中 / 待启动」
 * 这句状态词，不是日期）。所以"还有 N 天""延期 N 天"这类**推导不出来了**，
 * 也就不写在界面上 —— 而不是拿别的字段凑一个日期出来。
 */
function milestoneState(m: WsMilestone): 'done' | 'now' | 'todo' {
  return m.state
}

export function MilestoneRail({ milestones, compact }: { milestones: WsMilestone[]; compact?: boolean }) {
  const next = milestones.find((m) => milestoneState(m) === 'now')
  const rows = compact ? milestones.filter((m) => m.state !== 'done') : milestones
  return (
    <div className="rail">
      {rows.map((m) => {
        const state = milestoneState(m)
        const isNext = m === next
        return (
          <div key={m.id} className={cn('rail-row', isNext && 'is-next')}>
            <span className={cn('rail-dot', state === 'now' ? 'next' : state)} />
            <span className="rail-main">
              <span className="rail-name">{m.name}</span>
              <span className="rail-meta">{m.detail}</span>
            </span>
            {isNext ? <span className="rail-flag">下一关</span> : null}
          </div>
        )
      })}
      {rows.length === 0 ? <div className="q-empty">没有待过的关卡</div> : null}
    </div>
  )
}
