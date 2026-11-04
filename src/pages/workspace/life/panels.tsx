/**
 * life 模块的面板与弹窗标记。
 *
 * 原来由 design/gen-workspace-pages.mjs 从 life_index.html 生成（@generated），
 * 生成链已退役 —— 这一份现在是手写维护的：所有数据走真实后端 hook。
 *
 * 保持的接口契约（LifeWorkspace.tsx 依赖）：
 *   - TABS / Handlers / MODAL_SPECS / ModalKey 导出不变
 *   - 每个 Panel 组件签名为 `{ handlers: Handlers }`
 *   - className 结构与 CSS 类名不变
 */

import { useState } from 'react'
import { ToggleRow, TaskCheck, TaskText } from '../../../components/workspace/toggles'
import { useFinance, useHabits, useJournal, useLifeActions, usePets, useRecipes, useWorkouts } from '../../../hooks/use-life'
import { useRawTasks } from '../../../hooks/use-tasks'
import { ymd } from '../../../lib/task-map'
import type { ModuleTab } from '../../../data/workspace/types'
import type { LifeFinance, LifeJournal, LifePet, LifeRecipe, LifeWorkout } from '../../../api/life'

/** Tab 定义（键 + 标签）。标签与原型顶栏面包屑的 titleMap 交叉校验过。 */
export const TABS: ModuleTab[] = [
  { key: 'overview', label: '概览' },
  { key: 'habits', label: '习惯' },
  { key: 'tasks', label: '任务' },
  { key: 'calendar', label: '日程' },
  { key: 'finance', label: '财务' },
  { key: 'health', label: '健康' },
  { key: 'fitness', label: '运动' },
  { key: 'recipes', label: '食谱' },
  { key: 'pets', label: '宠物' },
  { key: 'journal', label: '日记' },
  { key: 'goals', label: '目标' },
]

/** 本模块所有交互回调 —— 实现写在 <LifeWorkspace /> 里。 */
export interface Handlers {
  closeModal: () => void
  notice: (arg0: string) => void
  openPet: (arg0: string) => void
  openRecipe: (arg0: string) => void
  openWorkoutForm: () => void
}

export const MODAL_SPECS = {
  openWorkoutForm: { title: '记录运动' },
} as const

export type ModalKey = keyof typeof MODAL_SPECS

/* ============================================================
 * 日期 / 格式化辅助
 * ============================================================ */

function todayStr(): string {
  return ymd(new Date())
}

/** 判断 ISO 日期字符串是否属于本月。 */
function isThisMonth(iso: string): boolean {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  const now = new Date()
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
}

/** 判断 ISO 日期字符串是否属于本周（周一到周日）。 */
function isThisWeek(iso: string): boolean {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  if (!y || !m || !d) return false
  const date = new Date(y, m - 1, d)
  const now = new Date()
  const dayOfWeek = (now.getDay() + 6) % 7 // 0=周一, 6=周日
  const monday = new Date(now)
  monday.setDate(now.getDate() - dayOfWeek)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return date >= monday && date <= sunday
}

function formatDate(iso: string): string {
  return iso.slice(0, 10)
}

/** 分 → 元显示（整数不显示小数）。 */
function formatYuan(cents: number): string {
  const yuan = cents / 100
  return `¥${yuan.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

const MOOD_EMOJI: Record<string, string> = {
  happy: '😊',
  calm: '😌',
  neutral: '😐',
  sad: '😞',
  angry: '😠',
}

const WORKOUT_ICON: Record<string, string> = {
  run: '🏃',
  cycle: '🚴',
  swim: '🏊',
  strength: '💪',
  yoga: '🧘',
  other: '⚽',
}

const WORKOUT_NAME: Record<string, string> = {
  run: '跑步',
  cycle: '骑行',
  swim: '游泳',
  strength: '力量训练',
  yoga: '瑜伽',
  other: '其他',
}

/* ============================================================
 * OverviewPanel
 * ============================================================ */

export function OverviewPanel({ handlers }: { handlers: Handlers }) {
  const { data: habits = [] } = useHabits()
  const { data: workouts = [] } = useWorkouts(20)
  const { data: finance = [] } = useFinance(50)
  const { data: pets = [] } = usePets()
  const { data: journals = [] } = useJournal(3)
  const { data: recipes = [] } = useRecipes()

  const enabledHabits = habits.filter((h) => h.enabled)
  const weekWorkouts = workouts.filter((w) => isThisWeek(w.logDate))
  const weekMinutes = weekWorkouts.reduce((s, w) => s + w.durationMin, 0)
  const monthExpense = finance
    .filter((f) => f.kind === 'expense' && isThisMonth(f.logDate))
    .reduce((s, f) => s + f.amountCents, 0)
  const monthIncome = finance
    .filter((f) => f.kind === 'income' && isThisMonth(f.logDate))
    .reduce((s, f) => s + f.amountCents, 0)
  const balance = monthIncome - monthExpense

  const today = todayStr()
  const now = new Date()
  const weekdays = ['日', '一', '二', '三', '四', '五', '六']

  return (
    <>
      <section className="card hero">
        <h1>生活概览</h1>
        <p>今天是 {today} 星期{weekdays[now.getDay()]}，关注平衡与节奏。</p>
        <div className="hero-meta">
          <span>习惯：<strong>{enabledHabits.length}</strong></span>
          <span>本周运动：<strong>{weekMinutes} 分钟</strong></span>
          <span>本月支出：<strong>{formatYuan(monthExpense)}</strong></span>
          <span>本月结余：<strong>{formatYuan(balance)}</strong></span>
          {pets.length > 0 && <span>宠物：<strong>{pets.length}</strong></span>}
        </div>
      </section>
      <section className="grid-3">
        <div className="card">
          <div className="card-title">习惯打卡</div>
          <div className="stat">{enabledHabits.length}</div>
          <div className="stat-desc">在跟踪 {enabledHabits.length} 个习惯</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: enabledHabits.length ? '100%' : '0%' }}></div></div>
        </div>
        <div className="card">
          <div className="card-title">本周运动</div>
          <div className="stat">{weekMinutes} 分钟</div>
          <div className="stat-desc">{weekWorkouts.length} 次运动</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: weekMinutes ? `${Math.min(100, (weekMinutes / 150) * 100)}%` : '0%' }}></div></div>
        </div>
        <div className="card">
          <div className="card-title">本月结余</div>
          <div className="stat">{formatYuan(balance)}</div>
          <div className="stat-desc">收入 {formatYuan(monthIncome)} · 支出 {formatYuan(monthExpense)}</div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: monthIncome ? `${Math.min(100, (balance / monthIncome) * 100)}%` : '0%' }}></div></div>
        </div>
      </section>
      <section className="grid-2">
        <div className="card">
          <div className="card-title">最近日记</div>
          {journals.length > 0 ? (
            journals.map((j) => (
              <div className="journal-entry" key={j.id}>
                <div className="journal-date">{formatDate(j.logDate)} <span className="journal-mood">{MOOD_EMOJI[j.mood] ?? ''}</span></div>
                <div className="journal-text">{j.content}</div>
              </div>
            ))
          ) : (
            <div className="empty-state">还没有日记</div>
          )}
        </div>
        <div className="card">
          <div className="card-title">今日食谱</div>
          {recipes.length > 0 ? (
            recipes.slice(0, 2).map((r) => (
              <div className="recipe-card" key={r.id} onClick={() => handlers.openRecipe(r.name)}>
                <div className="recipe-name">{r.name}</div>
                <div className="recipe-meta">{r.tags || '食谱'}</div>
                <div className="recipe-tags">
                  {(r.tags || '').split(',').filter(Boolean).slice(0, 3).map((tag) => (
                    <span className="recipe-tag" key={tag}>{tag.trim()}</span>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">还没有食谱</div>
          )}
        </div>
      </section>
      <section className="grid-2">
        <div className="card">
          <div className="card-title">宠物提醒</div>
          {pets.length > 0 ? (
            pets.map((p) => (
              <div className="health-row" key={p.id}>
                <span>{p.name}</span>
                <span className="health-value">{p.reminder || '—'}</span>
              </div>
            ))
          ) : (
            <div className="empty-state">还没有添加宠物</div>
          )}
        </div>
        <div className="card">
          <div className="card-title">最近运动</div>
          {workouts.length > 0 ? (
            workouts.slice(0, 3).map((w) => (
              <div className="health-row" key={w.id}>
                <span>{WORKOUT_NAME[w.kind] ?? w.kind} · {formatDate(w.logDate)}</span>
                <span className="health-value">{w.durationMin} 分钟</span>
              </div>
            ))
          ) : (
            <div className="empty-state">还没有运动记录</div>
          )}
        </div>
      </section>
    </>
  )
}

/* ============================================================
 * HabitsPanel
 * ============================================================ */

export function HabitsPanel({ handlers: _handlers }: { handlers: Handlers }) {
  const { data: habits = [] } = useHabits()
  const actions = useLifeActions().habit

  const today = todayStr()

  return (
    <>
      <section className="card">
        <div className="card-title">习惯打卡 · 今日</div>
        {habits.length > 0 ? (
          habits.map((habit) => (
            <div className="habit-item" key={habit.id}>
              <div className="habit-name">{habit.icon || '•'} {habit.name}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--mw-text-secondary)' }}>
                  每周目标 {habit.targetPerWeek} 次
                </span>
                <button
                  className="btn btn-primary"
                  style={{ padding: '4px 12px', fontSize: '13px' }}
                  onClick={() => actions.toggleLog.mutate({ habitId: habit.id, logDate: today })}
                >
                  今日打卡
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">还没有习惯，添加一个</div>
        )}
      </section>
    </>
  )
}

/* ============================================================
 * TasksPanel —— 生活域任务复用全局任务系统
 * ============================================================ */

export function TasksPanel({ handlers: _handlers }: { handlers: Handlers }) {
  const tasks = useRawTasks('life')

  return (
    <>
      <section className="card">
        <div className="card-title">生活任务</div>
        {tasks.length > 0 ? (
          tasks.map((task) => (
            <ToggleRow className="task-item" key={task.id} defaultDone={task.state === 'done'}>
              <TaskCheck />
              <TaskText>{task.title}</TaskText>
              <span className="task-tag">{task.state === 'done' ? '已完成' : task.state === 'doing' ? '进行中' : '待办'}</span>
            </ToggleRow>
          ))
        ) : (
          <div className="empty-state">生活域任务在任务清单里管理</div>
        )}
      </section>
    </>
  )
}

/* ============================================================
 * CalendarPanel —— 生活域日程复用日历系统
 * ============================================================ */

export function CalendarPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="card">
        <div className="card-title">日程</div>
        <div className="empty-state">生活域日程在日历模块里管理</div>
      </section>
    </>
  )
}

/* ============================================================
 * FinancePanel
 * ============================================================ */

export function FinancePanel({ handlers: _handlers }: { handlers: Handlers }) {
  const { data: finance = [] } = useFinance(50)

  const monthExpense = finance
    .filter((f) => f.kind === 'expense' && isThisMonth(f.logDate))
    .reduce((s, f) => s + f.amountCents, 0)
  const monthIncome = finance
    .filter((f) => f.kind === 'income' && isThisMonth(f.logDate))
    .reduce((s, f) => s + f.amountCents, 0)
  const balance = monthIncome - monthExpense

  return (
    <>
      <section className="grid-3">
        <div className="card">
          <div className="card-title">本月收入</div>
          <div className="stat" style={{ color: 'var(--c-success)' }}>{formatYuan(monthIncome)}</div>
          <div className="stat-desc">{finance.filter((f) => f.kind === 'income' && isThisMonth(f.logDate)).length} 笔</div>
        </div>
        <div className="card">
          <div className="card-title">本月支出</div>
          <div className="stat" style={{ color: 'var(--c-error)' }}>{formatYuan(monthExpense)}</div>
          <div className="stat-desc">{finance.filter((f) => f.kind === 'expense' && isThisMonth(f.logDate)).length} 笔</div>
        </div>
        <div className="card">
          <div className="card-title">本月结余</div>
          <div className="stat">{formatYuan(balance)}</div>
          <div className="stat-desc">{monthIncome > 0 ? `结余率 ${Math.round((balance / monthIncome) * 100)}%` : '—'}</div>
        </div>
      </section>
      <section className="card">
        <div className="card-title">最近收支</div>
        {finance.length > 0 ? (
          finance.map((f: LifeFinance) => (
            <div className="finance-row" key={f.id}>
              <div className="finance-cat">
                <div className="finance-icon">{f.kind === 'income' ? '💰' : '💸'}</div>
                <div>{f.category || f.note || (f.kind === 'income' ? '收入' : '支出')}</div>
              </div>
              <div className={`finance-amount ${f.kind === 'income' ? 'income' : 'expense'}`}>
                {f.kind === 'income' ? '+' : '-'} {formatYuan(f.amountCents)}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">还没有财务记录</div>
        )}
      </section>
    </>
  )
}

/* ============================================================
 * HealthPanel —— 健康指标暂无后端表
 * ============================================================ */

export function HealthPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="card">
        <div className="card-title">健康数据</div>
        <div className="empty-state">健康数据待接入</div>
      </section>
    </>
  )
}

/* ============================================================
 * FitnessPanel
 * ============================================================ */

export function FitnessPanel({ handlers }: { handlers: Handlers }) {
  const { data: workouts = [] } = useWorkouts(20)

  const weekWorkouts = workouts.filter((w) => isThisWeek(w.logDate))
  const weekMinutes = weekWorkouts.reduce((s, w) => s + w.durationMin, 0)
  const weekCalories = weekWorkouts.reduce((s, w) => s + w.calories, 0)
  const weekDistance = weekWorkouts.reduce((s, w) => s + w.distanceKm, 0)

  return (
    <>
      <section className="grid-3">
        <div className="card">
          <div className="card-title">本周运动</div>
          <div className="stat">{weekWorkouts.length}</div>
          <div className="stat-desc">共 {weekMinutes} 分钟</div>
        </div>
        <div className="card">
          <div className="card-title">本周消耗</div>
          <div className="stat">{weekCalories.toLocaleString()}</div>
          <div className="stat-desc">千卡</div>
        </div>
        <div className="card">
          <div className="card-title">本周距离</div>
          <div className="stat">{weekDistance.toFixed(1)} km</div>
          <div className="stat-desc">{weekWorkouts.length} 次运动</div>
        </div>
      </section>
      <section className="card">
        <div className="card-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>最近运动</span>
          <button className="btn btn-primary" onClick={() => handlers.openWorkoutForm()}>+ 记录运动</button>
        </div>
        {workouts.length > 0 ? (
          workouts.map((w: LifeWorkout) => (
            <div className="workout-item" key={w.id}>
              <div className="workout-icon">{WORKOUT_ICON[w.kind] ?? '⚽'}</div>
              <div className="workout-info">
                <div className="workout-name">{WORKOUT_NAME[w.kind] ?? w.kind}</div>
                <div className="workout-meta">
                  {formatDate(w.logDate)} · {w.durationMin} 分钟
                  {w.distanceKm > 0 ? ` · ${w.distanceKm} km` : ''}
                </div>
              </div>
              <div className="workout-value">{w.calories > 0 ? `${w.calories} kcal` : '—'}</div>
            </div>
          ))
        ) : (
          <div className="empty-state">还没有运动记录，点击「记录运动」添加</div>
        )}
      </section>
    </>
  )
}

/* ============================================================
 * RecipesPanel
 * ============================================================ */

export function RecipesPanel({ handlers }: { handlers: Handlers }) {
  const { data: recipes = [] } = useRecipes()

  return (
    <>
      <section className="grid-3">
        <div className="card">
          <div className="card-title">收藏食谱</div>
          <div className="stat">{recipes.length}</div>
          <div className="stat-desc">共 {recipes.length} 个食谱</div>
        </div>
        <div className="card">
          <div className="card-title">食材</div>
          <div className="stat">—</div>
          <div className="stat-desc">从食谱详情查看</div>
        </div>
        <div className="card">
          <div className="card-title">标签</div>
          <div className="stat">—</div>
          <div className="stat-desc">从食谱详情查看</div>
        </div>
      </section>
      <section className="card">
        <div className="card-title">我的食谱</div>
        {recipes.length > 0 ? (
          recipes.map((r: LifeRecipe) => (
            <div className="recipe-card" key={r.id} onClick={() => handlers.openRecipe(r.name)}>
              <div className="recipe-name">{r.name}</div>
              <div className="recipe-meta">{r.ingredients ? `食材：${r.ingredients.slice(0, 40)}` : '点击查看详情'}</div>
              <div className="recipe-tags">
                {(r.tags || '').split(',').filter(Boolean).slice(0, 4).map((tag) => (
                  <span className="recipe-tag" key={tag}>{tag.trim()}</span>
                ))}
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">还没有食谱，添加一个</div>
        )}
      </section>
    </>
  )
}

/* ============================================================
 * PetsPanel
 * ============================================================ */

export function PetsPanel({ handlers }: { handlers: Handlers }) {
  const { data: pets = [] } = usePets()

  return (
    <>
      <section className="card">
        <div className="card-title">我的宠物</div>
        {pets.length > 0 ? (
          pets.map((p: LifePet) => (
            <div className="pet-card" key={p.id} onClick={() => handlers.openPet(p.name)}>
              <div className="pet-avatar">{p.species === 'cat' ? '🐱' : p.species === 'dog' ? '🐶' : '🐾'}</div>
              <div className="pet-info">
                <div className="pet-name">{p.name}</div>
                <div className="pet-meta">
                  {p.species === 'cat' ? '猫' : p.species === 'dog' ? '狗' : p.species}
                  {p.birthDate ? ` · ${p.birthDate}` : ''}
                </div>
                <div className="pet-tags">
                  {p.reminder && <span className="pet-tag">{p.reminder}</span>}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">还没有添加宠物</div>
        )}
      </section>
      <section className="grid-2">
        <div className="card">
          <div className="card-title">提醒</div>
          {pets.length > 0 ? (
            pets.filter((p) => p.reminder).map((p) => (
              <div className="health-row" key={p.id}>
                <span>{p.name}</span>
                <span className="health-value">{p.reminder}</span>
              </div>
            ))
          ) : (
            <div className="empty-state">暂无提醒</div>
          )}
        </div>
        <div className="card">
          <div className="card-title">信息</div>
          {pets.length > 0 ? (
            pets.map((p) => (
              <div className="health-row" key={p.id}>
                <span>{p.name}</span>
                <span className="health-value">{p.species === 'cat' ? '猫' : p.species === 'dog' ? '狗' : p.species}</span>
              </div>
            ))
          ) : (
            <div className="empty-state">暂无信息</div>
          )}
        </div>
      </section>
    </>
  )
}

/* ============================================================
 * JournalPanel
 * ============================================================ */

export function JournalPanel({ handlers: _handlers }: { handlers: Handlers }) {
  const { data: journals = [] } = useJournal(30)

  return (
    <>
      <section className="card">
        <div className="card-title">最近日记</div>
        {journals.length > 0 ? (
          journals.map((j: LifeJournal) => (
            <div className="journal-entry" key={j.id}>
              <div className="journal-date">{formatDate(j.logDate)} <span className="journal-mood">{MOOD_EMOJI[j.mood] ?? ''}</span></div>
              <div className="journal-text">{j.content}</div>
            </div>
          ))
        ) : (
          <div className="empty-state">还没有日记，写一篇吧</div>
        )}
      </section>
    </>
  )
}

/* ============================================================
 * GoalsPanel —— 目标暂无后端表
 * ============================================================ */

export function GoalsPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="card">
        <div className="card-title">目标管理</div>
        <div className="empty-state">目标管理待接入</div>
      </section>
    </>
  )
}

/* ============================================================
 * 顶栏动作区
 * ============================================================ */

export function TopbarActions({ handlers }: { handlers: Handlers }) {
  return (
    <>
      <button className="btn btn-ghost" id="quickAdd" onClick={() => handlers.notice('快速记录')}>+ 快速记录</button>
    </>
  )
}

/* ============================================================
 * 弹窗：记录运动（受控表单）
 * ============================================================ */

export function OpenWorkoutFormModal({ handlers }: { handlers: Handlers }) {
  const workoutActions = useLifeActions().workout
  const [kind, setKind] = useState('run')
  const [logDate, setLogDate] = useState(todayStr())
  const [durationMin, setDurationMin] = useState('')
  const [distanceKm, setDistanceKm] = useState('')
  const [calories, setCalories] = useState('')
  const [note, setNote] = useState('')

  const save = () => {
    workoutActions.create.mutate({
      kind,
      logDate,
      durationMin: Number(durationMin) || 0,
      distanceKm: Number(distanceKm) || 0,
      calories: Number(calories) || 0,
      note,
    })
    handlers.closeModal()
  }

  return (
    <>
      <div className="form-field">
        <label className="form-label">运动类型</label>
        <select className="form-select" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="run">跑步</option>
          <option value="cycle">骑行</option>
          <option value="swim">游泳</option>
          <option value="strength">力量训练</option>
          <option value="yoga">瑜伽</option>
          <option value="other">其他</option>
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">日期</label>
        <input className="form-input" type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">时长（分钟）</label>
        <input className="form-input" type="number" placeholder="30" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">距离（km，可选）</label>
        <input className="form-input" type="number" placeholder="4.2" step="0.1" value={distanceKm} onChange={(e) => setDistanceKm(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">消耗（千卡，可选）</label>
        <input className="form-input" type="number" placeholder="320" value={calories} onChange={(e) => setCalories(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">备注</label>
        <textarea className="form-textarea" placeholder="今天状态不错..." value={note} onChange={(e) => setNote(e.target.value)}></textarea>
      </div>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={() => handlers.closeModal()}>取消</button>
        <button className="btn btn-primary" onClick={save}>保存</button>
      </div>
    </>
  )
}
