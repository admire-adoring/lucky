import { useState } from 'react'
import { cn } from '../../../lib/cn'
import {
  boardColumns,
  calendarCells,
  calendarSummary,
  MATRIX_TITLES,
  matrixBoxes,
  prioTagClass,
  scopeTagClass,
  SCOPE_LABEL,
  type CalCell,
  type TaskRow,
  type TaskViewKey,
} from '../../../data/workspace/tasks'
import { useTaskApi } from './task-state'

/**
 * 「全部任务」的四种排列（列表 / 看板 / 四象限 / 日历）。
 *
 * 四种排列的结构不同（行 / 三列 / 2×2 / 7 列网格），所以这里是四段独立的渲染，
 * 不是同一个组件的四个变体 —— 原型那句"切视图不重渲"说的正是这件事：
 * 每个排列自己的展开、勾选、筛选状态都留着。
 *
 * 四条跨视图的统一口径（漏一条就会出现"同一件事在两个视图里长得不一样"）：
 *  1. 一件任务被"划掉"的样子必须一致：划线 + 降级，不换位置；
 *  2. 每张卡上的一键动作都由同一组动作实现（勾选 / 推进 / 划掉），见 `task-state`；
 *  3. 行/卡上的时间 chip 是同一个 `dueLabel`；
 *  4. 点行/卡 = 打开详情，点 chip 上的按钮 = 那个按钮自己的动作（按钮要 stopPropagation）。
 */

/* ============================================================
 * 原子：勾选块与标签
 * ============================================================ */

/**
 * 勾选块。
 *
 * 名字带 `Button` 是为了与 `components/workspace/toggles.tsx` 里那个同名的
 *    `TaskCheck` 区分开：那一个是给 life / work 的旧式任务行用的（`div` +
 *    `.done` 修饰类），这一个按新原型用真正的 `<button aria-pressed>`。
 *    两者类名相同（`.task-check` 是那份 CSS 的接口），但语义与消费方完全不同。
 */
export function TaskCheckButton({
  done,
  onToggle,
  label,
}: {
  done: boolean
  onToggle: () => void
  label?: string
}) {
  return (
    <button
      type="button"
      className="task-check"
      aria-pressed={done}
      aria-label={label ?? (done ? '取消完成' : '标记完成')}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    </button>
  )
}

export function ScopeTag({ row }: { row: TaskRow }) {
  return <span className={cn('list-tag', scopeTagClass(row.scope))}>{SCOPE_LABEL[row.scope]}</span>
}

export function PrioTag({ row }: { row: TaskRow }) {
  return <span className={cn('list-tag', prioTagClass(row.prio))}>{PRIO_TEXT[row.prio]}</span>
}

const PRIO_TEXT: Record<TaskRow['prio'], string> = { high: '高', mid: '中', low: '低' }

/** 行上那枚时间 chip（`今天 14:00` / `逾期 2 天` / `10:30`） */
export function MetaChip({ row, tone }: { row: TaskRow; tone?: 'warn' | 'ok' }) {
  return <span className={cn('list-meta', tone)}>{row.dueLabel}</span>
}

function metaTone(row: TaskRow): 'warn' | 'ok' | undefined {
  if (row.state === 'done') return 'ok'
  if (row.overdueDays > 0) return 'warn'
  return undefined
}

/* ============================================================
 * 列表（「全部任务」的默认排列）
 * ============================================================ */

export function ListView({ open, done }: { open: TaskRow[]; done: TaskRow[] }) {
  const api = useTaskApi()
  const [draft, setDraft] = useState('')

  const submit = () => {
    const title = draft.trim()
    if (!title) return
    /* 就地添加：new 一条 state=todo、其余取默认值（spec §4 最后一行） */
    api.addTask({ title, scope: 'work', prio: 'mid', due: '2026-09-20' })
    setDraft('')
  }

  return (
    <>
      <div className="quick-add">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <input
          className="quick-input"
          placeholder="添加任务…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') submit()
          }}
        />
        <span className="quick-hint">回车即添加，领域与优先级稍后可改</span>
        <button type="button" className="btn btn-primary" onClick={submit}>
          添加
        </button>
      </div>

      {/* 未完成在前、且按「逾期 → 今天 → 之后」排 —— 这一层顺序就是这一页要回答的问题：「现在先做哪个」 */}
      <div className="section" data-group="open">
        <div className="section-title">
          <span>任务列表</span>
          <span className="section-side">
            <span className="section-count">{open.length} 项</span>
          </span>
        </div>
        {open.map((row) => (
          <ListRow key={row.id} row={row} />
        ))}
      </div>

      {/* 已完成单独成组、且排在后面：它不该与"还要做什么"抢同一列的注意力 */}
      <div className="section" data-group="done">
        <div className="section-title">
          <span>已完成 · 今天</span>
          <span className="section-count">{done.length} 项</span>
        </div>
        {done.map((row) => (
          <ListRow key={row.id} row={row} />
        ))}
      </div>
    </>
  )
}

function ListRow({ row }: { row: TaskRow }) {
  const api = useTaskApi()
  const done = row.state === 'done'
  return (
    <div
      className={cn('list-item', done && 'is-done', !done && row.overdueDays > 0 && 'is-overdue')}
      onClick={() => api.openDetail(row.id)}
    >
      <TaskCheckButton done={done} onToggle={() => api.toggleDone(row.id)} />
      <span className="list-text">{row.title}</span>
      <ScopeTag row={row} />
      <PrioTag row={row} />
      <MetaChip row={row} tone={metaTone(row)} />
    </div>
  )
}

/* ============================================================
 * 看板（按状态三列）
 * ============================================================ */

export function BoardView({ columns }: { columns: ReturnType<typeof boardColumns> }) {
  return (
    <div className="section">
      <div className="section-title">
        <span>按状态排布 · 列内按「逾期 → 高 → 中 → 低」</span>
        <span className="section-count">
          {columns.todo.length + columns.doing.length + columns.done.length} 项
        </span>
      </div>
      <div className="kanban">
        <BoardColumn title="待办" rows={columns.todo} />
        <BoardColumn title="进行中" rows={columns.doing} />
        <BoardColumn title="已完成 · 今天" rows={columns.done} />
      </div>
    </div>
  )
}

function BoardColumn({ title, rows }: { title: string; rows: TaskRow[] }) {
  return (
    <div className="kanban-col">
      <div className="kanban-title">
        <span>{title}</span>
        <span>{rows.length}</span>
      </div>
      {rows.map((row) => (
        <BoardCard key={row.id} row={row} />
      ))}
    </div>
  )
}

function BoardCard({ row }: { row: TaskRow }) {
  const api = useTaskApi()
  const done = row.state === 'done'
  return (
    <div
      className={cn('kanban-card', done && 'is-done')}
      onClick={() => api.openDetail(row.id)}
    >
      {/*
        最后一列不给"推进到下一列"（spec §4-1）：原型那一步是"再推一次回到待办"，
           只是为了方便反复演示的循环后门。这里换成「重新打开」——它表达的才是真事。
      */}
      {done ? (
        <button
          type="button"
          className="card-act"
          title="重新打开"
          aria-label="重新打开"
          onClick={(event) => {
            event.stopPropagation()
            api.reopen(row.id)
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15A9 9 0 1 1 18.36 5.64L23 10" />
          </svg>
        </button>
      ) : (
        <button
          type="button"
          className="card-act"
          title="推进到下一列"
          aria-label="推进到下一列"
          onClick={(event) => {
            event.stopPropagation()
            api.advance(row.id)
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m13 6 6 6-6 6" />
          </svg>
        </button>
      )}
      <div className="kanban-card-title">{row.title}</div>
      <div className="kanban-card-meta">
        <ScopeTag row={row} />
        <PrioTag row={row} />
        <MetaChip row={row} tone={metaTone(row)} />
      </div>
    </div>
  )
}

/* ============================================================
 * 四象限（重要 × 紧急）
 * ============================================================ */

type MatrixBoxes = ReturnType<typeof matrixBoxes>

export function MatrixView({ boxes }: { boxes: MatrixBoxes }) {
  const total = boxes[1].length + boxes[2].length + boxes[3].length + boxes[4].length
  return (
    <div className="section">
      <div className="section-title">
        <span>重要 × 紧急</span>
        <span className="section-count">{total} 项待划分</span>
      </div>
      <div className="matrix">
        {([1, 2, 3, 4] as const).map((quad) => (
          <div className="matrix-box" key={quad}>
            <div className="matrix-title">
              <span className={cn(`q${quad}`)}>{MATRIX_TITLES[quad]}</span>
              <span className="section-count">{boxes[quad].length} 项</span>
            </div>
            {boxes[quad].map((row) => (
              <MatrixItem key={row.id} row={row} />
            ))}
            {/* 空格子说一句"这是好事" —— 比留一片空白诚实（原型同） */}
            {quad === 4 && boxes[4].length === 0 ? (
              <div className="matrix-hint">这一格空着是好事 —— 已完成的 2 项不参与象限划分。</div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}

function MatrixItem({ row }: { row: TaskRow }) {
  const api = useTaskApi()
  return (
    <div className="matrix-item" onClick={() => api.openDetail(row.id)}>
      <button
        type="button"
        className="card-act"
        title="标记完成"
        aria-label="标记完成"
        onClick={(event) => {
          event.stopPropagation()
          /* 象限只描述未完成的那一批 ⇒ 划掉它就等于完成了它（spec §4） */
          api.toggleDone(row.id)
        }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
      <span className="list-text">{row.title}</span>
      <span className={cn('list-meta', row.overdueDays > 0 && 'warn')}>
        {row.overdueDays > 0 ? '已逾期' : row.dueLabel}
      </span>
    </div>
  )
}

/* ============================================================
 * 日历（2026 年 9 月）
 * ============================================================ */

export function CalendarView({ pass }: { pass: (row: TaskRow) => boolean }) {
  const api = useTaskApi()
  const cells = calendarCells(api.tasks)
  const summary = calendarSummary(cells)
  return (
    <div className="section">
      <div className="section-title">
        <span>{summary.title}</span>
        <span className="section-count">{summary.busyDays} 天有安排</span>
      </div>
      <div className="cal-grid">
        {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
          <div className="cal-head" key={day}>
            {day}
          </div>
        ))}
        {cells.map((cell, index) => (
          <CalDay key={index} cell={cell} pass={pass} />
        ))}
      </div>
      <div className="cal-legend">
        <span>
          <i style={{ background: 'var(--tk-scope-work)' }} />
          工作
        </span>
        <span>
          <i style={{ background: 'var(--tk-scope-life)' }} />
          生活
        </span>
        <span>
          <i style={{ background: 'var(--tk-scope-learn)' }} />
          学习
        </span>
        <span className="cal-note">
          格子里只放有明确日期的任务：9/20 那格另有 3 项收在「+3」里；写着"本周"的 1 项（整理房间）没有具体日子，不落格。
        </span>
      </div>
    </div>
  )
}

function CalDay({ cell, pass }: { cell: CalCell; pass: (row: TaskRow) => boolean }) {
  const api = useTaskApi()
  /* 日历 chip 也挂 `data-filter` ⇒ 领域筛选同样作用于它（原型如此）。
     但 chip 上只有 id / 短名，所以过滤要看那条任务本身。 */
  const shown = cell.tasks.filter((task) => {
    const row = api.tasks.find((item) => item.id === task.id)
    return !row || pass(row)
  })
  const openDay = () => {
    if (cell.muted) return
    /* 点某一天 = 在那天新建任务（日历的原生动作） */
    api.openNewTask(`2026-09-${String(cell.num).padStart(2, '0')}`)
  }
  return (
    <div
      className={cn('cal-day', cell.muted && 'muted', cell.today && 'today')}
      onClick={openDay}
    >
      <div className="cal-num">{cell.num}</div>
      {shown.map((task) => (
        <div
          key={task.id}
          className={cn('cal-task', task.scope)}
          onClick={(event) => {
            event.stopPropagation()
            api.openDetail(task.id)
          }}
        >
          {task.label}
        </div>
      ))}
      {cell.overflow > 0 ? <div className="cal-task more">+{cell.overflow}</div> : null}
    </div>
  )
}

/* ============================================================
 * 视图条与二级筛选条
 * ============================================================ */

export function ViewBar({
  views,
  active,
  onSelect,
  hint,
}: {
  views: readonly { key: TaskViewKey; label: string; desc: string }[]
  active: TaskViewKey
  onSelect: (key: TaskViewKey) => void
  hint: string
}) {
  return (
    <div className="view-bar" role="tablist" aria-label="排列方式">
      {views.map((view) => (
        <button
          key={view.key}
          type="button"
          className={cn('view-bar__item', view.key === active && 'active')}
          role="tab"
          aria-selected={view.key === active}
          onClick={() => onSelect(view.key)}
        >
          {view.label}
        </button>
      ))}
      <span className="view-bar__hint">{hint}</span>
    </div>
  )
}

/**
 * 二级筛选条（原型的圆盘三级在这里落地）。
 *
 * 用的是原型的 `.view-bar` / `.view-bar__item` / `.filter-chip` 三组现成样式：
 *    它们表达的正是"一组互斥选项 + 一个可见的清除出口"，所以这里没有新增类。
 *    差别只在语义（排列 vs 筛选），而两者的控件形状本来就该一样 ——
 *    原型自己的注释也写着"两组筛选项之间必须一模一样，它们干的是同一件事"。
 */
export function FilterBar({
  items,
  active,
  counts,
  onSelect,
  onClear,
}: {
  items: { key: string; label: string }[]
  active: string | null
  counts: Record<string, number>
  onSelect: (key: string | null) => void
  onClear: () => void
}) {
  return (
    <div className="view-bar" role="group" aria-label="二级筛选">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={cn('view-bar__item', item.key === active && 'active')}
          aria-pressed={item.key === active}
          onClick={() => onSelect(item.key === active ? null : item.key)}
        >
          {item.label} {counts[item.key] ?? 0}
        </button>
      ))}
      {active ? (
        <button type="button" className="filter-chip" onClick={onClear}>
          {items.find((item) => item.key === active)?.label} <span className="x">✕</span>
        </button>
      ) : null}
    </div>
  )
}
