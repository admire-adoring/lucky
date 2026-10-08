import { useMemo, useState, type ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import {
  boardColumns,
  distribution,
  doneGroups,
  estText,
  hoursText,
  INBOX_SUGGESTIONS,
  kindTagClass,
  KIND_LABEL,
  listRows,
  matchesSubFilter,
  matrixBoxes,
  poolGroups,
  scopeTagClass,
  SCOPE_LABEL,
  SUB_FILTERS,
  taskStats,
  TASK_SECTIONS,
  TASK_VIEWS,
  timeline,
  weekRhythm,
  type TaskRow,
  type TaskSectionKey,
} from '../../../data/workspace/tasks'
import type { ModuleTab } from '../../../data/workspace/types'
import { useTaskApi } from './task-state'
import { TaskTimeline } from './TaskTimeline'
import {
  BoardView,
  CalendarView,
  FilterBar,
  ListView,
  MatrixView,
  TaskCheckButton,
  ViewBar,
} from './TaskViews'

/**
 * 「任务」的四个分区面板 —— 每个分区 = 一批范围，不是一种排列。
 *
 * 三条跨分区的口径：
 *  1. KPI 只统计列表视图的行。看板卡 / 矩阵项 / 日历 chip 也参与二级筛选，
 *     但它们不能进统计 —— 否则同一个任务被数四遍（"全部任务 8"会变成二十几）。
 *  2. 二级筛选是真的在过滤（`matchesSubFilter`），而且有一个"正在看什么、
 *     怎么退回去"的可见出口（`FilterBar` 里的 `.filter-chip`）。
 *     筛空的组会自己消失（React 里"没渲染"就是没渲染，不需要原型那套隐藏逻辑）。
 *  3. 读数一律现算：勾掉一行之后 KPI、区块计数、侧栏副标题、时间轴负荷一起变。
 */

/** 分区清单 —— 与 `TASK_SECTIONS` 同源（外壳的环与顶栏菜单都读它） */
export const TABS: ModuleTab[] = TASK_SECTIONS.map((section) => ({
  key: section.key,
  label: section.label,
}))

/* ============================================================
 * 读数条
 * ============================================================ */

interface KpiItem {
  label: string
  value: ReactNode
  desc: ReactNode
}

function KpiRow({ items }: { items: KpiItem[] }) {
  return (
    <div className="card-grid">
      {items.map((item) => (
        <div className="card" key={item.label}>
          <div className="card-label">{item.label}</div>
          <div className="card-value">{item.value}</div>
          <div className="card-desc">{item.desc}</div>
        </div>
      ))}
    </div>
  )
}

/* ============================================================
 * 二级筛选：把"这一批行里哪些还留着"算出来
 * ============================================================ */

/**
 * 一个分区的筛选状态 + 命中数 + 过滤器。
 *
 * 计数口径与过滤口径不是同一个，这是原型的原样：
 *    · 计数（"已逾期 1 / 高优先级 1 / 其余 2"）算的是导航提示，
 *      口径是"这一批待办怎么分"（今日的 4 项待办 ⇒ 1 / 1 / 2）；
 *    · 过滤是按行筛（选中"已逾期"之后，池里两条逾期项都留下）。
 *    两者都照原型，别顺手统一 —— 统一了计数就和原型对不上。
 */
function useSubFilter(section: TaskSectionKey) {
  const api = useTaskApi()
  const active = api.filter[section] ?? null
  const items = SUB_FILTERS[section]

  const countingScope = useMemo(() => {
    if (section === 'today') return api.tasks.filter((row) => row.inToday && row.state !== 'done')
    if (section === 'inbox') return api.tasks.filter((row) => !!row.kind)
    const { open, done } = listRows(api.tasks)
    return [...open, ...done]
  }, [api.tasks, section])

  const counts = useMemo(() => {
    const out: Record<string, number> = {}
    for (const item of items ?? []) {
      out[item.key] = countingScope.filter((row) => matchesSubFilter(row, section, item.key)).length
    }
    return out
  }, [countingScope, items, section])

  const pass = useMemo(
    () => (row: TaskRow) => !active || matchesSubFilter(row, section, active),
    [active, section],
  )

  return { active, items: items ?? [], counts, pass }
}

/** 只有筛选条的那一行（今日 / 收件箱） */
function FilterRow({ section }: { section: TaskSectionKey }) {
  const sub = useSubFilter(section)
  const api = useTaskApi()
  if (!sub.items.length) return null
  return (
    <div className="view-bar-wrap">
      <FilterBar
        items={sub.items}
        active={sub.active}
        counts={sub.counts}
        onSelect={(key) => api.setFilter(section, key)}
        onClear={() => api.setFilter(section, null)}
      />
    </div>
  )
}

/** 计数文案：过滤中显示"这几项 / 共几项"，否则显示总数 */
function countText(visible: number, total: number, unit: string): string {
  return visible === total ? `${total} ${unit}` : `${visible} / ${total} ${unit}`
}

/* ============================================================
 * 分区：今日（时间轴）
 * ============================================================ */

export function TodayPanel() {
  const api = useTaskApi()
  const sub = useSubFilter('today')
  const stats = taskStats(api.tasks)

  const blocks = timeline(api.tasks).blocks.filter((block) => sub.pass(block.row))
  const loadMin = blocks.reduce((sum, block) => sum + (block.row.estMin ?? 0), 0)
  const pool = poolGroups(api.tasks)
  const poolToday = pool.today.filter(sub.pass)
  const poolWeek = pool.week.filter(sub.pass)

  return (
    <div className="tk-page">
      <KpiRow
        items={[
          { label: '今日待办', value: stats.todayOpen, desc: stats.todayOpenDesc },
          { label: '今日完成', value: stats.todayDone, desc: '最早 08:00 · 最晚 10:30' },
          { label: '今日负荷', value: hoursText(loadMin / 60), desc: stats.todayLoadDesc },
          { label: '下一件事', value: stats.todayNext, desc: stats.todayNextDesc },
        ]}
      />

      <FilterRow section="today" />

      <div className="main-body">
        <div className="main-col">
          {/* 已完成的任务留在时间轴上（它们就是过去那几个块），所以侧轨不再列"今日已完成" */}
          <TaskTimeline tasks={api.tasks} pass={sub.pass} />
        </div>

        <aside className="main-rail">
          <div className="section">
            <div className="section-title">
              <span>待排池</span>
              <span className="section-count">
                {countText(poolToday.length + poolWeek.length, pool.today.length + pool.week.length, '项')}
              </span>
            </div>

            <div className="sub-title">今天 · {poolToday.length} 项</div>
            <div className="pool-list">
              {poolToday.map((row) => (
                <PoolRow key={row.id} row={row} />
              ))}
            </div>

            <div className="sub-title">本周 · {poolWeek.length} 项</div>
            <div className="pool-list">
              {poolWeek.map((row) => (
                <PoolRow key={row.id} row={row} />
              ))}
            </div>

            <div className="week-note">
              点「排进去」会先问一个时长，再真的落进时间轴的空档：空档变短、负荷跟着变大；排不下时直接说排不下，不会插到半个格子上。逾期超过 3 天的任务不再进今日，只留在「全部任务 → 已逾期」里。
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}

function PoolRow({ row }: { row: TaskRow }) {
  const api = useTaskApi()
  const placed = !!row.scheduledStart
  return (
    <div className={cn('list-item', row.overdueDays > 0 && 'is-overdue', placed && 'is-placed')}>
      <span className="list-text">{row.title}</span>
      <span className="list-tag">{estText(row)}</span>
      {placed ? (
        <button type="button" className="btn-mini" disabled>
          已排 {row.scheduledStart}
        </button>
      ) : (
        <button type="button" className="btn-mini" onClick={() => api.openSchedule(row.id)}>
          排进去
        </button>
      )}
    </div>
  )
}

/* ============================================================
 * 分区：全部任务（四种排列）
 * ============================================================ */

export function AllPanel() {
  const api = useTaskApi()
  const sub = useSubFilter('all')
  const stats = taskStats(api.tasks)
  const { open, done } = listRows(api.tasks)
  const columns = boardColumns(api.tasks)
  const boxes = matrixBoxes(api.tasks)
  const dist = distribution(api.tasks)
  const rhythm = weekRhythm(api.tasks)
  const view = TASK_VIEWS.find((item) => item.key === api.view) ?? TASK_VIEWS[0]

  return (
    <div className="tk-page">
      {/* KPI 属于「全部」这个范围，不属于某个排列 ⇒ 放在视图条之上，切视图时不闪 */}
      <KpiRow
        items={[
          { label: '全部任务', value: stats.total, desc: stats.totalDesc },
          { label: '今日到期', value: stats.todayDue, desc: stats.todayDueDesc },
          { label: '已逾期', value: stats.overdue, desc: stats.overdueDesc },
          { label: '本周完成', value: stats.week, desc: stats.weekDesc },
        ]}
      />

      {/* 视图条与筛选条同一行：它们都是"怎么看这一批"，紧贴它们控制的东西 */}
      <div className="view-bar-wrap">
        <ViewBar views={TASK_VIEWS} active={api.view} onSelect={api.setView} hint={view.desc} />
        <FilterBar
          items={sub.items}
          active={sub.active}
          counts={sub.counts}
          onSelect={(key) => api.setFilter('all', key)}
          onClear={() => api.setFilter('all', null)}
        />
      </div>

      {api.view === 'list' ? (
        <div className="main-body">
          <div className="main-col">
            <ListView open={open.filter(sub.pass)} done={done.filter(sub.pass)} />
          </div>
          <aside className="main-rail">
            {/* 两张分布合成一张卡：它们回答的是同一个问题（这批任务长什么样） */}
            <div className="section">
              <div className="section-title">
                <span>分布</span>
                <span className="section-count">{dist.total} 项</span>
              </div>
              <div className="sub-title">按领域</div>
              {dist.byScope.map((item) => (
                <BarRow
                  key={item.key}
                  label={item.label}
                  count={item.count}
                  total={dist.total}
                  color={`var(--tk-scope-${item.key})`}
                />
              ))}
              <div className="sub-title">按优先级</div>
              {dist.byPrio.map((item) => (
                <BarRow
                  key={item.key}
                  label={item.label}
                  count={item.count}
                  total={dist.total}
                  color={`var(--tk-prio-${item.key})`}
                />
              ))}
            </div>

            <div className="section">
              <div className="section-title">
                <span>本周完成节奏</span>
                <span className="section-count">{rhythm.total} 项</span>
              </div>
              <div className="week-bars">
                {rhythm.days.map((day, index) => {
                  const count = rhythm.counts[index]
                  const isToday = index === 6 /* 演示基准日 2026-09-20 是周日 */
                  return (
                    <div className={cn('wb', isToday && 'today')} key={day}>
                      <span className="wb-track">
                        <span
                          className={cn('wb-fill', count === 0 && 'zero')}
                          style={
                            count === 0 ? undefined : { height: `${(count / rhythm.peak) * 60}px` }
                          }
                        />
                      </span>
                      <span className="wb-day">{day}</span>
                    </div>
                  )
                })}
              </div>
              <div className="week-note">{rhythmNote(rhythm)}</div>
            </div>
          </aside>
        </div>
      ) : null}

      {api.view === 'board' ? (
        <BoardView
          columns={{
            todo: columns.todo.filter(sub.pass),
            doing: columns.doing.filter(sub.pass),
            done: columns.done.filter(sub.pass),
          }}
        />
      ) : null}

      {api.view === 'matrix' ? (
        <MatrixView
          boxes={{
            1: boxes[1].filter(sub.pass),
            2: boxes[2].filter(sub.pass),
            3: boxes[3].filter(sub.pass),
            4: boxes[4].filter(sub.pass),
          }}
        />
      ) : null}

      {api.view === 'calendar' ? <CalendarView pass={sub.pass} /> : null}
    </div>
  )
}

/** 节奏注脚：峰值、今天、昨天、以及"哪几天没有产出"全部由数据说，不写死 */
function rhythmNote(rhythm: ReturnType<typeof weekRhythm>): string {
  const runs: string[] = []
  let run: number[] = []
  rhythm.counts.forEach((count, index) => {
    if (count === 0) {
      run.push(index)
      return
    }
    if (run.length) runs.push(runLabel(rhythm.days, run))
    run = []
  })
  if (run.length) runs.push(runLabel(rhythm.days, run))
  const zero = runs.length ? `${runs.join('、')}没有产出` : '每天都有产出'
  return `柱高 = 当天完成数（峰值 ${rhythm.peak} 项）；今天 ${rhythm.counts[6]} 项、昨天 ${
    rhythm.counts[5]
  } 项，${zero}。`
}

function runLabel(days: string[], run: number[]): string {
  if (run.length === 1) return `周${days[run[0]]}`
  return `周${days[run[0]]}到周${days[run[run.length - 1]]}`
}

function BarRow({
  label,
  count,
  total,
  color,
}: {
  label: string
  count: number
  total: number
  color: string
}) {
  return (
    <div className="bar-row">
      <span className="bar-name">{label}</span>
      <span className="bar-track">
        <span
          className="bar-fill"
          style={{ width: `${total ? (count / total) * 100 : 0}%`, background: color }}
        />
      </span>
      <span className="bar-num">{count}</span>
    </div>
  )
}

/* ============================================================
 * 分区：收件箱
 * ============================================================ */

export function InboxPanel() {
  const api = useTaskApi()
  const sub = useSubFilter('inbox')
  const rows = api.tasks.filter((row) => row.kind)
  const visible = rows.filter(sub.pass)

  return (
    <div className="tk-page">
      <div className="main-body">
        <div className="main-col">
          <InboxQuickAdd />

          <div className="section">
            <div className="section-title">
              <span>待整理</span>
              <span className="section-side">
                <span className="section-count">{countText(visible.length, rows.length, '条')}</span>
              </span>
            </div>
            {visible.map((row) => (
              <InboxRow key={row.id} row={row} />
            ))}
          </div>
        </div>

        <aside className="main-rail">
          <div className="section">
            <div className="section-title">
              <span>整理建议</span>
              <span className="section-count">{INBOX_SUGGESTIONS.length} 条</span>
            </div>
            {INBOX_SUGGESTIONS.map((item) => {
              const adopted = api.adopted.includes(item.id)
              return (
                <div className="list-item" key={item.id}>
                  <span className="list-text">{item.text}</span>
                  <button
                    type="button"
                    className="btn-mini"
                    disabled={adopted}
                    onClick={() => api.adopt(item.id)}
                  >
                    {adopted ? '已采纳' : item.action}
                  </button>
                </div>
              )
            })}
          </div>
        </aside>
      </div>
    </div>
  )
}

function InboxQuickAdd() {
  const api = useTaskApi()
  const [draft, setDraft] = useState('')
  const submit = () => {
    const title = draft.trim()
    if (!title) return
    api.capture(title)
    setDraft('')
  }
  return (
    <div className="quick-add">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
        <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
        <path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
      </svg>
      <input
        className="quick-input"
        placeholder="随手记一条…"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') submit()
        }}
      />
      <button type="button" className="btn btn-primary" onClick={submit}>
        收集
      </button>
    </div>
  )
}

function InboxRow({ row }: { row: TaskRow }) {
  const api = useTaskApi()
  return (
    <div className="list-item" onClick={() => api.openDetail(row.id)}>
      <TaskCheckButton done={row.state === 'done'} onToggle={() => api.toggleDone(row.id)} />
      <span className="list-text">{row.title}</span>
      <span className={cn('list-tag', kindTagClass(row.kind!))}>{KIND_LABEL[row.kind!]}</span>
      <span className="list-meta">{row.dueLabel}</span>
    </div>
  )
}

/* ============================================================
 * 分区：已完成
 * ============================================================ */

export function DonePanel() {
  const api = useTaskApi()
  const groups = doneGroups(api.tasks)
  const total = groups.reduce((sum, group) => sum + group.rows.length, 0)
  return (
    <div className="tk-page">
      <div className="section">
        <div className="section-title">
          <span>本周完成</span>
          <span className="section-count">{total} 项</span>
        </div>
        {/* 按天分组：组头承担时间轴，行里不再重复"昨天 / 2 天前"这类相对时间 */}
        {groups.map((group) =>
          group.rows.length ? (
            <div key={group.key}>
              <div className="sub-title">
                {group.label} · {group.rows.length} 项
              </div>
              {group.rows.map((row) => (
                <div className="list-item is-done" key={row.id} onClick={() => api.openDetail(row.id)}>
                  <TaskCheckButton done onToggle={() => api.toggleDone(row.id)} />
                  <span className="list-text">{row.title}</span>
                  <span className={cn('list-tag', scopeTagClass(row.scope))}>
                    {SCOPE_LABEL[row.scope]}
                  </span>
                  <span className="list-meta ok">{row.dueLabel}</span>
                </div>
              ))}
            </div>
          ) : null,
        )}
      </div>
    </div>
  )
}

/* ============================================================
 * 分发
 * ============================================================ */

export function SectionPanel({ section }: { section: TaskSectionKey }) {
  if (section === 'today') return <TodayPanel />
  if (section === 'inbox') return <InboxPanel />
  if (section === 'done') return <DonePanel />
  return <AllPanel />
}
