import { useState } from 'react'
import { cn } from '../../../lib/cn'
import { OpsIcon } from '../project-detail/ops-icon'
import {
  CAL_MAX_PER_DAY,
  CAL_WEEK_HEADS,
  QUAD_TITLES,
  WORK_TASK_VIEWS,
  calCells,
  doneRows,
  openRows,
  projectBars,
  stateBars,
  weekBars,
  type WorkTaskRow,
  type WorkTaskViewKey,
} from '../../../data/workspace/work-tasks'

/* ============================================================================
   任务四档视图（`design/work/work_task.html`，2026-10-14 版）

   「工作模块 · 任务」那一页与项目详情的「任务」分区**共用这一个组件** ——
   原型那一页本来就是"同一份池、同一套四档"，两处各写一份必然会分叉
   （同一个数在两处表达，改一处忘一处，而且不报错）。
   数据形状由 `data/workspace/work-tasks.ts` 给，这一层不碰数据来源。

   四档的结构完全不同（行 / 三列 / 2×2 / 7 列网格）⇒ 各自独立渲染，不做"隐藏 + 复用"。
   原型是靠"重渲 + 事件委托"才保住了勾选，React 里状态在外层（宿主的覆盖表），
   重渲本来就不丢东西。

   两处与原型有意不同（都是"原型是静态演示、应用里没有那个东西"）：
     · 日历胶囊点一下 = 勾选。原型的胶囊点了不做事（那一页没有任务详情屏），
       而它自己给了 pointer 光标与悬停描边 —— 一个看着能点的东西必须真的做点什么，
       这里唯一真实存在的动作就是勾选（与同一行左侧那枚勾选框同一个出口）。
     · 新建（视图条那颗 + 号 / 快捷添加 / 日历点某天）走 `notice` 的诚实回执，
       原型那边是 `alert('原型演示：…')`。
   ============================================================================ */

export interface WorkTaskBoardProps {
  rows: WorkTaskRow[]
  /** 页面级回执。原型没有写接口的动作一律只说一句真话，不假装存下来了 */
  notice: (text: string) => void
  /** 勾选。宿主把状态记在自己的覆盖表里（不重建派生数据的一份副本） */
  onToggle: (row: WorkTaskRow) => void
  /** 侧轨（分布 + 近 7 天节奏）。整页要它；窄卡放不下 */
  rail?: boolean
  /** 列表档那条快捷添加 */
  quickAdd?: boolean
  /** 数据未到：正文换成一行字，不渲染"0 项"的空壳（空与还没读到是两回事） */
  loading?: boolean
}

export function WorkTaskBoard({
  rows,
  notice,
  onToggle,
  rail = true,
  quickAdd = true,
  loading = false,
}: WorkTaskBoardProps) {
  const [view, setView] = useState<WorkTaskViewKey>('list')
  const hint = WORK_TASK_VIEWS.find((item) => item.key === view)?.hint ?? ''

  return (
    <div className="wt-page">
      <div className="view-row">
        <div className="card-title">全部任务</div>
        <div className="seg" role="group" aria-label="任务视图">
          {WORK_TASK_VIEWS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={cn('seg-btn', view === item.key && 'is-on')}
              aria-pressed={view === item.key}
              onClick={() => setView(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="view-hint">{hint}</span>
        <button
          type="button"
          className="icon-btn"
          title="新建任务"
          aria-label="新建任务"
          onClick={() => notice('新建任务：还没有写接口')}
        >
          <OpsIcon name="plus" size={17} />
        </button>
      </div>

      <div className="wt-body">
        {loading ? (
          <div className="task-empty">正在读取任务…</div>
        ) : view === 'list' ? (
          <ListView rows={rows} rail={rail} quickAdd={quickAdd} notice={notice} onToggle={onToggle} />
        ) : (
          /* 列表档自己出四张卡（主列两张 + 侧轨两张）⇒ 不套卡；另外三档是"一格内容" ⇒ 各带一张卡 */
          <section className="card">
            {view === 'board' ? <BoardView rows={rows} onToggle={onToggle} /> : null}
            {view === 'quad' ? <QuadView rows={rows} onToggle={onToggle} /> : null}
            {view === 'calendar' ? <CalendarView rows={rows} notice={notice} onToggle={onToggle} /> : null}
          </section>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   列表：主列（任务列表 / 已完成 · 今天）+ 侧轨（分布 / 节奏）
   ============================================================ */

function ListView({
  rows,
  rail,
  quickAdd,
  notice,
  onToggle,
}: {
  rows: WorkTaskRow[]
  rail: boolean
  quickAdd: boolean
  notice: (text: string) => void
  onToggle: (row: WorkTaskRow) => void
}) {
  const open = openRows(rows)
  const done = doneRows(rows)
  const doneCount = rows.filter((row) => row.state === 'done').length

  return (
    <div className="main-body">
      <div className="main-col">
        {quickAdd ? <QuickAdd notice={notice} /> : null}

        <section className="card">
          <CardHead title="任务列表" num={`${open.length} 项`} />
          {open.length ? (
            open.map((row) => <TaskLine key={row.id} row={row} onToggle={onToggle} />)
          ) : (
            <div className="task-empty">这一批里没有任务</div>
          )}
        </section>

        <section className="card">
          <CardHead title="已完成 · 今天" num={`${done.today.length} 项`} />
          {done.today.length ? (
            done.today.map((row) => <TaskLine key={row.id} row={row} onToggle={onToggle} />)
          ) : (
            <div className="task-empty">今天还没有完成的</div>
          )}
          {/* 更早完成的那几条不在这一刀里，也不能无声地少几条 */}
          {done.earlier ? (
            <div className="week-note">更早完成的 {done.earlier} 条不重复列在这里 —— 归档在任务区的「已完成」。</div>
          ) : null}
        </section>
      </div>

      {rail ? (
        <aside className="main-rail">
          <section className="card">
            <CardHead title="分布" num={`${rows.length} 项`} />
            <div className="sub-title">按项目</div>
            <Bars rows={projectBars(rows)} total={rows.length} />
            <div className="sub-title">按状态</div>
            <Bars rows={stateBars(rows)} total={rows.length} />
          </section>

          <section className="card">
            <CardHead title="近 7 天完成节奏" num={`${doneCount} 条`} />
            <WeekChart rows={rows} />
          </section>
        </aside>
      ) : null}
    </div>
  )
}

function CardHead({ title, num }: { title: string; num: string }) {
  return (
    <div className="card-head-row">
      <div className="card-title">{title}</div>
      <span className="card-head-num">{num}</span>
    </div>
  )
}

function TaskLine({ row, onToggle }: { row: WorkTaskRow; onToggle: (row: WorkTaskRow) => void }) {
  return (
    <div className="dash-row">
      <CheckButton row={row} onToggle={onToggle} />
      <div className={cn('task-text', row.state === 'done' && 'done')}>
        <div className="dash-row-name">{row.title}</div>
        <div className="dash-row-meta">{[row.project, row.note].filter(Boolean).join(' · ')}</div>
      </div>
      <WhenCell row={row} />
    </div>
  )
}

/** 勾选块。四档视图共用同一个出口 */
function CheckButton({ row, onToggle }: { row: WorkTaskRow; onToggle: (row: WorkTaskRow) => void }) {
  const done = row.state === 'done'
  return (
    <button
      type="button"
      className={cn('task-check', done && 'done')}
      aria-pressed={done}
      aria-label={done ? `把「${row.title}」标记为未完成` : `把「${row.title}」标记为已完成`}
      onClick={() => onToggle(row)}
    >
      {done ? '✓' : ''}
    </button>
  )
}

/** 行尾那一列：已完成的不答"什么时候到期"（它已经不是待办的事） */
function WhenCell({ row }: { row: WorkTaskRow }) {
  const done = row.state === 'done'
  return (
    <span className={cn('dash-when', !done && row.dueDays < 0 && 'is-overdue')}>
      {done ? '已完成' : row.dueText}
    </span>
  )
}

function QuickAdd({ notice }: { notice: (text: string) => void }) {
  const [draft, setDraft] = useState('')
  const submit = () => {
    const text = draft.trim()
    notice(text ? `新建任务「${text}」：还没有写接口` : '新建任务：还没有写接口')
    setDraft('')
  }
  return (
    <div className="quick-add">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
      <input
        className="quick-input"
        placeholder="添加任务…"
        autoComplete="off"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
        }}
      />
      <span className="quick-hint">回车即添加，项目与优先级稍后可改</span>
      <button type="button" className="btn btn-primary btn-sm" onClick={submit}>
        添加
      </button>
    </div>
  )
}

/* ============================================================
   侧轨：分布条 / 近 7 天节奏
   ============================================================ */

function Bars({ rows, total }: { rows: { name: string; n: number; color: string }[]; total: number }) {
  const sum = total || rows.reduce((acc, item) => acc + item.n, 0) || 1
  return (
    <>
      {rows.map((item) => (
        <div className="bar-row" key={item.name}>
          <span className="bar-name">{item.name}</span>
          <span className="bar-track">
            {/* 色条只说"哪一块更大"，精确值由右边的数字给 */}
            <span className="bar-fill" style={{ width: `${Math.round((item.n / sum) * 100)}%`, background: item.color }} />
          </span>
          <span className="bar-num">{item.n}</span>
        </div>
      ))}
    </>
  )
}

function WeekChart({ rows }: { rows: WorkTaskRow[] }) {
  const bars = weekBars(rows)
  const peak = Math.max(1, ...bars.map((bar) => bar.n))
  const inWindow = bars.reduce((acc, bar) => acc + bar.n, 0)
  const outside = rows.filter((row) => row.state === 'done').length - inWindow
  return (
    <>
      <div className="week-bars">
        {bars.map((bar) => (
          <div className={cn('wb', bar.today && 'today')} key={bar.off}>
            <span className="wb-track">
              <span
                className={cn('wb-fill', !bar.n && 'zero')}
                style={bar.n ? { height: `${Math.round((60 * bar.n) / peak)}px` } : undefined}
              />
            </span>
            <span className="wb-day">{bar.label}</span>
          </div>
        ))}
      </div>
      <div className="week-note">
        柱高 = 当天完成数（近 7 天 {inWindow} 条，峰值 {peak} 项）；今天 {bars[6]?.n ?? 0} 条、昨天{' '}
        {bars[5]?.n ?? 0} 条。{outside ? `更早完成的 ${outside} 条不在窗内。` : ''}
      </div>
    </>
  )
}

/* ============================================================
   看板：列按状态
   ============================================================ */

function BoardView({ rows, onToggle }: { rows: WorkTaskRow[]; onToggle: (row: WorkTaskRow) => void }) {
  const byDays = (a: WorkTaskRow, b: WorkTaskRow) => a.dueDays - b.dueDays
  const doneToday = rows.filter((row) => row.state === 'done' && row.doneDays === 0)
  const earlier = rows.filter((row) => row.state === 'done').length - doneToday.length
  const columns: { label: string; list: WorkTaskRow[] }[] = [
    { label: '待办', list: rows.filter((row) => row.state === 'todo').sort(byDays) },
    { label: '进行中', list: rows.filter((row) => row.state === 'doing').sort(byDays) },
    { label: '已完成 · 今天', list: doneToday },
  ]

  return (
    <>
      <div className="board">
        {/* 列恒在（三列就是"看板的形"），列内空给一句"暂无"而不是把列裁掉 —— 裁列会让形随数据变 */}
        {columns.map((column) => (
          <div className="board-col" key={column.label}>
            <div className="board-head">
              <span className="dash-group-name">{column.label}</span>
              <span className="board-count">{column.list.length}</span>
            </div>
            <div className="board-cards">
              {column.list.length ? (
                column.list.map((row) => (
                  <article className={cn('board-card', row.state === 'done' && 'is-done')} key={row.id}>
                    <div className="board-card-name">{row.title}</div>
                    <div className="board-card-meta">{[row.project, row.note].filter(Boolean).join(' · ')}</div>
                    <div className="board-card-foot">
                      <CheckButton row={row} onToggle={onToggle} />
                      <WhenCell row={row} />
                    </div>
                  </article>
                ))
              ) : (
                <div className="board-empty">暂无</div>
              )}
            </div>
          </div>
        ))}
      </div>
      {earlier ? (
        <div className="week-note">更早完成的 {earlier} 条不重复列在这里 —— 归档在任务区的「已完成」。</div>
      ) : null}
    </>
  )
}

/* ============================================================
   四象限：重要 × 紧急
   ============================================================ */

function QuadView({ rows, onToggle }: { rows: WorkTaskRow[]; onToggle: (row: WorkTaskRow) => void }) {
  const doneCount = rows.filter((row) => row.state === 'done').length
  return (
    <>
      <div className="quad">
        {([1, 2, 3, 4] as const).map((quad) => {
          const list = rows.filter((row) => row.state !== 'done' && row.q === quad)
          return (
            <div className="quad-cell" key={quad}>
              <div className="quad-head">
                <span className="dash-group-name">{QUAD_TITLES[quad]}</span>
                <span className="quad-count">{list.length}</span>
              </div>
              <div className="quad-list">
                {list.length ? (
                  list.map((row) => (
                    <div className="quad-item" key={row.id}>
                      <CheckButton row={row} onToggle={onToggle} />
                      <span className="quad-item-name">{row.title}</span>
                      <WhenCell row={row} />
                    </div>
                  ))
                ) : (
                  <div className="quad-empty">没有落在这一格的事</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {/* 象限只看还没做的 ⇒ 已完成那几条必须有交代，不能凭空消失 */}
      <div className="quad-note">已完成 {doneCount} 条不计入象限（四象限只看还没做的）</div>
    </>
  )
}

/* ============================================================
   日历：滚动 5 周的到期分布
   ============================================================ */

function CalendarView({
  rows,
  notice,
  onToggle,
}: {
  rows: WorkTaskRow[]
  notice: (text: string) => void
  onToggle: (row: WorkTaskRow) => void
}) {
  const { cells, outside } = calCells(rows)
  const doneCount = rows.filter((row) => row.state === 'done').length
  const first = cells[0]?.key ?? ''
  const last = cells[cells.length - 1]?.key ?? ''

  return (
    <>
      <div className="cal-wrap">
        <div className="cal-grid">
          {CAL_WEEK_HEADS.map((head) => (
            <div className="cal-head" key={head}>
              {head}
            </div>
          ))}
          {cells.map((cell) => (
            /* 过去那一天还有没做完的 = "债"，不是"历史"；空格子保持中性，否则整块一片红 */
            <div
              className={cn('cal-day', cell.today && 'today', cell.past && cell.rows.length > 0 && 'is-late')}
              key={cell.key}
              title={`${cell.key}${cell.rows.length + cell.overflow ? ` · ${cell.rows.length + cell.overflow} 条到期` : ''}`}
              onClick={() => notice(`新建任务（${cell.key}）：还没有写接口`)}
            >
              <div className="cal-num">
                {cell.num}
                {/* 跨月时只说日号看不出来是哪个月 */}
                {cell.monthLabel ? <span className="cal-mon">{cell.monthLabel} 月</span> : null}
              </div>
              {cell.rows.map((row) => (
                <div
                  className="cal-task"
                  key={row.id}
                  title={`${row.title} · ${row.dueText}`}
                  aria-label={row.state === 'done' ? `把「${row.title}」标记为未完成` : `把「${row.title}」标记为已完成`}
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggle(row)
                  }}
                >
                  {row.title}
                </div>
              ))}
              {cell.overflow ? (
                <div className="cal-task more" title={cell.rows.length ? `这一格还有 ${cell.overflow} 条` : ''}>
                  +{cell.overflow}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div className="cal-legend">
        <span>
          <i style={{ background: 'var(--wt-soft)', border: '1px solid var(--wt-line)' }} />
          还没到期
        </span>
        <span>
          <i style={{ background: 'var(--g-subtle)', border: '1px solid var(--wt-alert)' }} />
          已逾期
        </span>
        <span>
          <i style={{ background: 'var(--wt-soft-2)', border: '1px solid var(--wt-line)' }} />
          今天
        </span>
        <span className="cal-note">
          窗口 {first} ~ {last}（今天所在周的周一往前两周起，共 5 周）—— 到期日是按"今天 ± N 天"算的，
          所以窗口是滚动的、不是本月。已完成的 {doneCount} 条不进日历：它在数据里没有"哪一天到期"这个读法。
          一格最多摆 {CAL_MAX_PER_DAY} 枚，多的收成「+N」。点某一天可在那天新建任务。
        </span>
        {outside.length ? (
          <span className="cal-note is-warn">
            还有 {outside.length} 条到期日落在窗口之外，没有出现在上面：
            {outside.map((row) => `${row.title}（${row.dueText}）`).join('、')}
            —— 要么把窗口放宽，要么它们会被静默漏掉。
          </span>
        ) : null}
      </div>
    </>
  )
}
