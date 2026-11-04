/**
 * calendar 模块的面板与弹窗。
 *
 * 数据全部走真实后端：useEventsByRange / useAgenda / useEventActions。
 * 日期计算用原生 Date，ISO 格式 YYYY-MM-DD。
 */
import { useMemo, useState } from 'react'

import { Switch } from '../../../components/workspace/toggles'
import type { ModuleTab } from '../../../data/workspace/types'
import type { CalendarEvent, CalendarEventInput } from '../../../api/calendar'
import { useAgenda, useEventActions, useEventsByRange } from '../../../hooks/use-calendar'

/** Tab 定义。 */
export const TABS: ModuleTab[] = [
  { key: 'month', label: '月视图' },
  { key: 'week', label: '周视图' },
  { key: 'day', label: '日视图' },
  { key: 'agenda', label: '议程' },
  { key: 'subscribe', label: '日历订阅' },
  { key: 'settings', label: '日程设置' },
]

/** 本模块所有交互回调。 */
export interface Handlers {
  aiAddOpen: () => void
  closeModal: () => void
  newEventBtnOpen: () => void
  notice: (arg0: string) => void
  openEvent: (arg0: string) => void
}

export const MODAL_SPECS = {
  newEventBtn: { title: '新建日程' },
  aiAdd: { title: '✨ AI 找空闲' },
  openEvent: { title: null, arg: true },
} as const

export type ModalKey = keyof typeof MODAL_SPECS

// ---- date utils ----

function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0)
}

function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const r = new Date(d)
  r.setDate(d.getDate() + diff)
  r.setHours(0, 0, 0, 0)
  return r
}

function endOfWeek(d: Date): Date {
  const s = startOfWeek(d)
  const e = new Date(s)
  e.setDate(s.getDate() + 6)
  e.setHours(23, 59, 59, 999)
  return e
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

function addWeeks(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(d.getDate() + n * 7)
  return r
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(d.getDate() + n)
  return r
}

function startOfDay(d: Date): Date {
  const r = new Date(d)
  r.setHours(0, 0, 0, 0)
  return r
}

// ---- event helpers ----

function eventDateKey(e: CalendarEvent): string {
  return e.startAt.slice(0, 10)
}

function eventHour(e: CalendarEvent): number {
  const h = e.startAt.slice(11, 13)
  return h ? parseInt(h, 10) : 0
}

function eventTimeLabel(e: CalendarEvent): string {
  if (e.allDay) return '全天'
  const start = e.startAt.slice(11, 16)
  const end = e.endAt.slice(11, 16)
  return `${start} - ${end}`
}

function scopeClassName(e: CalendarEvent): string {
  switch (e.scope) {
    case 'work': return 'work'
    case 'life': return 'life'
    case 'learn': return 'learning'
    default: return 'global'
  }
}

function scopeLabel(e: CalendarEvent): string {
  switch (e.scope) {
    case 'work': return '工作'
    case 'life': return '生活'
    case 'learn': return '学习'
    default: return '全局'
  }
}

const WEEKDAY_LABELS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六']
const WEEK_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18]
const SCOPE_OPTIONS = [
  { value: 'life', label: '生活' },
  { value: 'work', label: '工作' },
  { value: 'learn', label: '学习' },
  { value: 'global', label: '全局' },
]
const COLOR_OPTIONS = [
  { value: 'blue', label: '蓝' },
  { value: 'green', label: '绿' },
  { value: 'amber', label: '黄' },
  { value: 'rose', label: '红' },
  { value: 'violet', label: '紫' },
  { value: 'teal', label: '青' },
]

// ---- panels ----

export function MonthPanel({ handlers }: { handlers: Handlers }) {
  const today = new Date()
  const [cursor, setCursor] = useState(() => startOfMonth(today))

  const gridStart = startOfWeek(startOfMonth(cursor))
  const gridEnd = endOfWeek(endOfMonth(cursor))
  const { data: events = [] } = useEventsByRange(toISO(gridStart), toISO(gridEnd))

  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const k = eventDateKey(e)
      const arr = m.get(k) ?? []
      arr.push(e)
      m.set(k, arr)
    }
    return m
  }, [events])

  const days = useMemo(() => {
    const arr: Date[] = []
    const monthEnd = endOfMonth(cursor)
    let d = new Date(gridStart)
    while (true) {
      arr.push(new Date(d))
      if (d >= monthEnd && arr.length % 7 === 0) break
      d = addDays(d, 1)
      if (arr.length > 42) break
    }
    return arr
  }, [gridStart, cursor])

  const todayISO = toISO(today)
  const todayEvents = eventsByDay.get(todayISO) ?? []
  const nextEvent = useMemo(() =>
    events
      .filter(e => e.startAt > today.toISOString())
      .sort((a, b) => a.startAt.localeCompare(b.startAt))[0],
    [events, today],
  )

  return (
    <>
      <section className="card hero">
        <h1>日程 📅</h1>
        <p>统一时间轴，聚合生活、工作、学习、项目。</p>
        <div className="hero-meta">
          <span>今日：<strong>{todayEvents.length} 个事件</strong></span>
          <span>本月：<strong>{events.length} 个事件</strong></span>
          <span>下一场：<strong>{nextEvent ? `${eventTimeLabel(nextEvent)} ${nextEvent.title}` : '暂无'}</strong></span>
        </div>
      </section>
      <section className="card">
        <div className="cal-control" style={{ marginBottom: "16px" }}>
          <div className="cal-nav">
            <div className="cal-nav-btn" onClick={() => setCursor(c => addMonths(c, -1))}>‹</div>
            <div className="cal-nav-btn" onClick={() => setCursor(c => addMonths(c, 1))}>›</div>
          </div>
          <div className="cal-title">{cursor.getFullYear()} 年 {cursor.getMonth() + 1} 月</div>
          <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setCursor(startOfMonth(new Date()))}>今天</button>
        </div>
        <div className="month-grid">
          <div className="month-head">一</div>
          <div className="month-head">二</div>
          <div className="month-head">三</div>
          <div className="month-head">四</div>
          <div className="month-head">五</div>
          <div className="month-head">六</div>
          <div className="month-head">日</div>
          {days.map(d => {
            const iso = toISO(d)
            const dayEvents = eventsByDay.get(iso) ?? []
            const muted = d.getMonth() !== cursor.getMonth()
            const isToday = iso === todayISO
            const cls = ['month-day']
            if (muted) cls.push('muted')
            if (isToday) cls.push('today')
            return (
              <div key={iso} className={cls.join(' ')}>
                <div className="month-day-num">{d.getDate()}</div>
                {dayEvents.slice(0, 3).map(e => (
                  <div key={e.id} className={`month-event ${scopeClassName(e)}`} onClick={() => handlers.openEvent(e.id)}>{e.title}</div>
                ))}
              </div>
            )
          })}
        </div>
      </section>
    </>
  )
}

export function WeekPanel({ handlers }: { handlers: Handlers }) {
  const today = new Date()
  const [cursor, setCursor] = useState(() => startOfWeek(today))

  const weekStart = cursor
  const { data: events = [] } = useEventsByRange(toISO(weekStart), toISO(addDays(weekStart, 6)))

  const days = useMemo(() => {
    const arr: Date[] = []
    for (let i = 0; i < 7; i++) arr.push(addDays(weekStart, i))
    return arr
  }, [weekStart])

  const eventsByCell = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      if (e.allDay) continue
      const k = `${eventDateKey(e)}-${eventHour(e)}`
      const arr = m.get(k) ?? []
      arr.push(e)
      m.set(k, arr)
    }
    return m
  }, [events])

  const todayISO = toISO(today)
  const startISO = toISO(weekStart)
  const endISO = toISO(addDays(weekStart, 6))

  return (
    <section className="card">
      <div className="cal-control" style={{ marginBottom: "16px" }}>
        <div className="cal-nav">
          <div className="cal-nav-btn" onClick={() => setCursor(c => addWeeks(c, -1))}>‹</div>
          <div className="cal-nav-btn" onClick={() => setCursor(c => addWeeks(c, 1))}>›</div>
        </div>
        <div className="cal-title">{startISO} ~ {endISO}</div>
        <button className="btn btn-ghost" style={{ marginLeft: "auto" }} onClick={() => setCursor(startOfWeek(new Date()))}>今天</button>
      </div>
      <div className="week-grid">
        <div className="week-head"></div>
        {days.map((d, i) => {
          const isToday = toISO(d) === todayISO
          return (
            <div key={i} className={`week-head${isToday ? ' today' : ''}`}>{WEEKDAY_LABELS[i]}</div>
          )
        })}
        {WEEK_HOURS.flatMap(h => [
          <div key={`t-${h}`} className="week-time">{String(h).padStart(2, '0')}:00</div>,
          ...days.map(d => {
            const dayKey = toISO(d)
            const cellEvents = eventsByCell.get(`${dayKey}-${h}`) ?? []
            return (
              <div key={`${h}-${dayKey}`} className="week-cell">
                {cellEvents.map(e => (
                  <div key={e.id} className={`week-event ${scopeClassName(e)}`} onClick={() => handlers.openEvent(e.id)}>{e.title}</div>
                ))}
              </div>
            )
          }),
        ])}
      </div>
    </section>
  )
}

export function DayPanel({ handlers }: { handlers: Handlers }) {
  const today = new Date()
  const dayStart = startOfDay(today)
  const dayEnd = addDays(dayStart, 1)
  const { data: events = [] } = useEventsByRange(toISO(dayStart), toISO(dayEnd))

  const dayEvents = useMemo(() => {
    const todayKey = toISO(today)
    return events
      .filter(e => eventDateKey(e) === todayKey)
      .sort((a, b) => a.startAt.localeCompare(b.startAt))
  }, [events, today])

  const nextEvent = useMemo(() =>
    dayEvents.find(e => e.startAt > today.toISOString()),
    [dayEvents, today],
  )

  const weekday = WEEKDAY_SHORT[today.getDay()]

  return (
    <>
      <section className="card hero">
        <h1>{toISO(today)} 星期{weekday}</h1>
        <p>今天有 {dayEvents.length} 个事件{nextEvent ? `，下一场 ${eventTimeLabel(nextEvent)} ${nextEvent.title}` : ''}。</p>
      </section>
      <section className="card">
        <div className="card-title">今日日程</div>
        <div className="day-list">
          {dayEvents.length === 0 ? (
            <div className="day-event">
              <div className="day-event-info">
                <div className="day-event-title">今天暂无日程</div>
              </div>
            </div>
          ) : dayEvents.map(e => (
            <div key={e.id} className={`day-event ${scopeClassName(e)}`} onClick={() => handlers.openEvent(e.id)}>
              <div className="day-event-time">{eventTimeLabel(e)}</div>
              <div className="day-event-info">
                <div className="day-event-title">{e.title}</div>
                <div className="day-event-meta">
                  <span className="day-event-tag">{scopeLabel(e)}</span>
                  {e.location ? <span>{e.location}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}

export function AgendaPanel({ handlers }: { handlers: Handlers }) {
  const { data: events = [] } = useAgenda(50)

  const groups = useMemo(() => {
    const today = new Date()
    const todayKey = toISO(today)
    const tomorrowKey = toISO(addDays(today, 1))
    const m = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const k = eventDateKey(e)
      const arr = m.get(k) ?? []
      arr.push(e)
      m.set(k, arr)
    }
    for (const arr of m.values()) {
      arr.sort((a, b) => a.startAt.localeCompare(b.startAt))
    }
    return Array.from(m.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([iso, evs]) => ({
        iso,
        label: iso === todayKey ? `今天 · ${iso}`
          : iso === tomorrowKey ? `明天 · ${iso}`
          : `${WEEKDAY_LABELS[new Date(iso).getDay() === 0 ? 6 : new Date(iso).getDay() - 1]} · ${iso}`,
        events: evs,
      }))
  }, [events])

  return (
    <section className="card">
      {groups.length === 0 ? (
        <div className="card-title">暂无日程</div>
      ) : groups.map(g => (
        <div key={g.iso} className="agenda-group">
          <div className="agenda-date">{g.label}</div>
          {g.events.map(e => (
            <div key={e.id} className={`day-event ${scopeClassName(e)}`} onClick={() => handlers.openEvent(e.id)}>
              <div className="day-event-time">{eventTimeLabel(e)}</div>
              <div className="day-event-info">
                <div className="day-event-title">{e.title}</div>
                <div className="day-event-meta">
                  <span className="day-event-tag">{scopeLabel(e)}</span>
                  {e.location ? <span>{e.location}</span> : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </section>
  )
}

export function SubscribePanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="card">
        <div className="card-title">订阅的日历</div>
        <div className="subscribe-item">
          <div className="subscribe-icon">📅</div>
          <div className="subscribe-info">
            <div className="subscribe-name">Google Calendar</div>
            <div className="subscribe-meta">已连接 · 同步中</div>
          </div>
          <Switch defaultOn />
        </div>
        <div className="subscribe-item">
          <div className="subscribe-icon">📅</div>
          <div className="subscribe-info">
            <div className="subscribe-name">Outlook</div>
            <div className="subscribe-meta">未连接</div>
          </div>
          <Switch />
        </div>
        <div className="subscribe-item">
          <div className="subscribe-icon">📅</div>
          <div className="subscribe-info">
            <div className="subscribe-name">iCal 订阅</div>
            <div className="subscribe-meta">未连接</div>
          </div>
          <Switch />
        </div>
      </section>
      <section className="card">
        <div className="card-title">日历分类</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">生活</div>
            <div className="setting-desc">私密</div>
          </div>
          <div className="setting-value" style={{ color: "#10B981" }}>● 翠绿</div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">工作</div>
            <div className="setting-desc">工作内部</div>
          </div>
          <div className="setting-value" style={{ color: "#E11D48" }}>● 玫红</div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">学习</div>
            <div className="setting-desc">私密</div>
          </div>
          <div className="setting-value" style={{ color: "#D946EF" }}>● 粉紫</div>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">项目里程碑</div>
            <div className="setting-desc">跟随项目</div>
          </div>
          <div className="setting-value" style={{ color: "#F97316" }}>● 橙</div>
        </div>
      </section>
    </>
  )
}

export function SettingsPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="card">
        <div className="card-title">日程设置</div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">时区</div>
            <div className="setting-desc">用于日历显示</div>
          </div>
          <select className="select">
            <option>Asia/Shanghai (UTC+8)</option>
            <option>UTC</option>
            <option>America/New_York</option>
          </select>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">默认视图</div>
            <div className="setting-desc">打开日程时默认显示</div>
          </div>
          <select className="select">
            <option>月视图</option>
            <option>周视图</option>
            <option>日视图</option>
            <option>议程</option>
          </select>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">默认提醒</div>
            <div className="setting-desc">日程开始前多久提醒</div>
          </div>
          <select className="select">
            <option>15 分钟前</option>
            <option>30 分钟前</option>
            <option>1 小时前</option>
            <option>不提醒</option>
          </select>
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">显示周数</div>
            <div className="setting-desc">在月视图显示第几周</div>
          </div>
          <Switch defaultOn />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">显示农历</div>
            <div className="setting-desc">在月视图显示农历</div>
          </div>
          <Switch />
        </div>
        <div className="setting-row">
          <div className="setting-info">
            <div className="setting-label">显示已完成日程</div>
            <div className="setting-desc">过去的日程是否显示</div>
          </div>
          <Switch defaultOn />
        </div>
      </section>
    </>
  )
}

export function TopbarActions({ handlers }: { handlers: Handlers }) {
  return (
    <>
      <button className="btn btn-ghost" id="aiAdd" onClick={() => handlers.aiAddOpen()}>✨ AI 找空闲</button>
      <button className="btn btn-primary" id="newEventBtn" onClick={() => handlers.newEventBtnOpen()}>+ 新建日程</button>
    </>
  )
}

/** 弹窗体：新建日程 */
export function NewEventBtnModal({ handlers }: { handlers: Handlers }) {
  const todayISO = toISO(new Date())
  const { create } = useEventActions()

  const [title, setTitle] = useState('')
  const [scope, setScope] = useState('life')
  const [date, setDate] = useState(todayISO)
  const [startAt, setStartAt] = useState('14:00')
  const [endAt, setEndAt] = useState('15:00')
  const [allDay, setAllDay] = useState(false)
  const [location, setLocation] = useState('')
  const [color, setColor] = useState('blue')
  const [detail, setDetail] = useState('')

  function handleSubmit() {
    if (!title.trim()) {
      handlers.notice('请填写标题')
      return
    }
    const input: CalendarEventInput = {
      title: title.trim(),
      detail: detail.trim(),
      startAt: allDay ? `${date}T00:00` : `${date}T${startAt}`,
      endAt: allDay ? `${date}T23:59` : `${date}T${endAt}`,
      allDay,
      location: location.trim(),
      color,
      scope,
      projectId: null,
      ownerId: null,
    }
    create.mutate(input, { onSuccess: () => handlers.closeModal() })
  }

  return (
    <>
      <div className="form-field">
        <label className="form-label">标题</label>
        <input className="form-input" placeholder="日程标题..." value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">日历</label>
        <select className="form-select" value={scope} onChange={e => setScope(e.target.value)}>
          {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">日期</label>
        <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">开始时间</label>
        <input className="form-input" type="time" value={startAt} onChange={e => setStartAt(e.target.value)} disabled={allDay} />
      </div>
      <div className="form-field">
        <label className="form-label">结束时间</label>
        <input className="form-input" type="time" value={endAt} onChange={e => setEndAt(e.target.value)} disabled={allDay} />
      </div>
      <div className="form-field">
        <label className="form-label">全天</label>
        <select className="form-select" value={allDay ? 'yes' : 'no'} onChange={e => setAllDay(e.target.value === 'yes')}>
          <option value="no">否</option>
          <option value="yes">是</option>
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">地点</label>
        <input className="form-input" placeholder="会议室 A / 线上" value={location} onChange={e => setLocation(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">颜色</label>
        <select className="form-select" value={color} onChange={e => setColor(e.target.value)}>
          {COLOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">备注</label>
        <textarea className="form-textarea" placeholder="补充说明..." value={detail} onChange={e => setDetail(e.target.value)}></textarea>
      </div>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={() => handlers.closeModal()}>取消</button>
        <button className="btn btn-primary" onClick={handleSubmit} disabled={create.isPending}>创建</button>
      </div>
    </>
  )
}

/** 弹窗体：AI 找空闲 */
export function AiAddModal({ handlers }: { handlers: Handlers }) {
  return (
    <>
      <div className="form-field">
        <label className="form-label">想安排什么？</label>
        <input className="form-input" placeholder="例如：找 1 小时写文档" />
      </div>
      <div className="form-field">
        <label className="form-label">时间范围</label>
        <select className="form-select">
          <option>本周</option>
          <option>下周</option>
          <option>本月</option>
        </select>
      </div>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={() => handlers.closeModal()}>取消</button>
        <button className="btn btn-primary" onClick={() => { handlers.notice('AI 推荐时段'); handlers.closeModal() }}>推荐</button>
      </div>
    </>
  )
}

/** 弹窗体：编辑/查看日程。eventId 从 handlers.openEvent(id) 传入。 */
export function OpenEventModal({ handlers, eventId }: { handlers: Handlers; eventId: string }) {
  const { data: events = [], isLoading } = useAgenda(100)
  const event = events.find(e => e.id === eventId)

  if (!event) {
    return <div className="form-field">{isLoading ? '加载中...' : '未找到日程'}</div>
  }

  return <OpenEventForm key={event.id} event={event} handlers={handlers} />
}

function OpenEventForm({ event, handlers }: { event: CalendarEvent; handlers: Handlers }) {
  const { update, remove } = useEventActions()

  const [title, setTitle] = useState(event.title)
  const [scope, setScope] = useState(event.scope)
  const [date, setDate] = useState(eventDateKey(event))
  const [startAt, setStartAt] = useState(event.allDay ? '00:00' : event.startAt.slice(11, 16))
  const [endAt, setEndAt] = useState(event.allDay ? '23:59' : event.endAt.slice(11, 16))
  const [allDay, setAllDay] = useState(event.allDay)
  const [location, setLocation] = useState(event.location)
  const [color, setColor] = useState(event.color)
  const [detail, setDetail] = useState(event.detail)

  function handleSave() {
    if (!title.trim()) {
      handlers.notice('请填写标题')
      return
    }
    const input: CalendarEventInput = {
      title: title.trim(),
      detail: detail.trim(),
      startAt: allDay ? `${date}T00:00` : `${date}T${startAt}`,
      endAt: allDay ? `${date}T23:59` : `${date}T${endAt}`,
      allDay,
      location: location.trim(),
      color,
      scope,
      projectId: event.projectId,
      ownerId: event.ownerId,
    }
    update.mutate({ id: event.id, input }, { onSuccess: () => handlers.closeModal() })
  }

  function handleDelete() {
    remove.mutate(event.id, { onSuccess: () => handlers.closeModal() })
  }

  return (
    <>
      <div className="form-field">
        <label className="form-label">标题</label>
        <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">时间</label>
        <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">开始时间</label>
        <input className="form-input" type="time" value={startAt} onChange={e => setStartAt(e.target.value)} disabled={allDay} />
      </div>
      <div className="form-field">
        <label className="form-label">结束时间</label>
        <input className="form-input" type="time" value={endAt} onChange={e => setEndAt(e.target.value)} disabled={allDay} />
      </div>
      <div className="form-field">
        <label className="form-label">全天</label>
        <select className="form-select" value={allDay ? 'yes' : 'no'} onChange={e => setAllDay(e.target.value === 'yes')}>
          <option value="no">否</option>
          <option value="yes">是</option>
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">日历</label>
        <select className="form-select" value={scope} onChange={e => setScope(e.target.value)}>
          {SCOPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">颜色</label>
        <select className="form-select" value={color} onChange={e => setColor(e.target.value)}>
          {COLOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">地点</label>
        <input className="form-input" value={location} onChange={e => setLocation(e.target.value)} />
      </div>
      <div className="form-field">
        <label className="form-label">备注</label>
        <textarea className="form-textarea" value={detail} onChange={e => setDetail(e.target.value)}></textarea>
      </div>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={handleDelete} disabled={remove.isPending}>删除</button>
        <button className="btn btn-ghost" onClick={() => handlers.closeModal()}>关闭</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={update.isPending}>保存</button>
      </div>
    </>
  )
}
