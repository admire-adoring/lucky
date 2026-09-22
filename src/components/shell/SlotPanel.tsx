import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Icon } from '../icons/Icon'
import { computeStats } from '../../data/derive'
import { useProjects } from '../../hooks/use-projects'
import { useRecentsStore } from '../../stores/recents-store'

/**
 * 侧栏的可切换槽 —— 原型是「最近 / 快捷 / KPI / AI」四格。
 *
 * ============================================================================
 * 为什么只落了**两格**
 * ============================================================================
 *
 * 这个槽的内容必须是**真实数据**。原型那四格是演示稿：最近四条是写死的，
 * 快捷六枚按钮点了 `alert('原型演示：…')`，AI 那两段是预置对话。
 * 项目有两条明令：
 *   · 「数字由 `projects.ts` 派生，**不允许编数字**」
 *   · 「原型里"点一下就变"的演示后门不要搬；判据是这个交互会不会让界面
 *      显示一个系统里不存在的状态」
 *
 * 逐格看：
 *
 *  | 槽 | 有没有真实来源 | 结论 |
 *  | --- | --- | --- |
 *  | 最近 | 有 —— 每次 Tab 切换都是一条真实记录（`stores/recents-store`） | ✅ 落 |
 *  | KPI  | 有 —— `computeStats(projects)` 是现成的派生层，8 个项目 8 份数 | ✅ 落 |
 *  | 快捷 | **没有**。那六枚按钮（新建任务/日程/笔记…）在应用里属于**各模块自己的**
 *  |      | 顶栏动作（由 `panels.tsx` 的 `TopbarActions` 提供），外壳手里没有一个全局动作总线 | ❌ 不落 |
 *  | AI   | **没有后端**（见 MEMORY 的待办：助手问答没有后端） | ❌ 不落 |
 *
 * 不落的那两格**不渲染**，而不是渲染一个"点了没反应"的空壳 ——
 * 用户分不清"没做"与"卡住"，那是最贵的一种缺陷。
 * 接口留着（`slots` 是数组），哪天有了全局动作总线，加一项就是加一行。
 *
 * ============================================================================
 * 一个受控细节
 * ============================================================================
 *
 * 槽的选中态是**组件局部 state**，不进路由、不持久化。
 * 理由与助手栏一致：它是"我此刻想看一下旁边那块"的临时视图，
 * 刷新之后回到第一格是符合预期的；而进路由会让每一次点 KPI 都压一条历史。
 */
export interface ShellSlot {
  key: string
  label: string
  render: () => ReactNode
}

/* ---------- 最近 ---------- */

/** 相对时间：只做到"天"。列表里最旧的也在 8 条以内，写"昨天/3天"足够了 */
function relativeTime(at: number): string {
  const minutes = Math.floor((Date.now() - at) / 60000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes}分`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  return `${Math.floor(hours / 24)}天`
}

function RecentsSlot() {
  const entries = useRecentsStore((s) => s.entries)

  if (!entries.length) {
    return (
      <div className="recent-item" aria-live="polite">
        <span className="recent-text">还没走过别处 —— 从环上或 ⌘K 进一个分区试试</span>
      </div>
    )
  }

  return (
    <>
      {entries.slice(0, 4).map((entry) => (
        <Link key={entry.path} to={entry.path} className="recent-item">
          <span className="recent-icon">
            <Icon name="i-clock" />
          </span>
          <span className="recent-text">{entry.label}</span>
          <span className="recent-time">{relativeTime(entry.at)}</span>
        </Link>
      ))}
    </>
  )
}

/* ---------- KPI ---------- */

/**
 * KPI 槽 —— 四条**派生**出来的值，不带单位换算、不做同比（没有历史快照）。
 *
 * ⚠️ 口径写在这里而不是"看着像就写上"：
 *     · 进行中 / 风险 = `Project.status` 的计数（不是"活跃"这种模糊说法）
 *     · 已完成 = `status === 'done'`
 *     · 平均进度 = 8 个项目的 `progress` 算术平均，四舍五入到整数
 * 数据没回来时显示 `—`，**不显示 0** —— 0 是一个看起来很像真的的数字，
 * 而"还没加载"和"真的是零"在有项目之后会长得一模一样的两位数。
 */
function KpiSlot() {
  const { data: projects, isPending } = useProjects()
  const stats = projects ? computeStats(projects) : null
  const show = (v: number | undefined) => (isPending || v === undefined ? '—' : String(v))

  const rows: Array<[string, string, boolean]> = [
    ['进行中项目', show(stats?.active), true],
    ['风险项目', show(stats?.risk), false],
    ['已完成项目', show(stats?.done), false],
    ['平均进度', stats ? `${stats.averageProgress}%` : '—', true],
  ]

  return (
    <div className="kpi-list">
      {rows.map(([label, value, accent]) => (
        <div className="kpi-item" key={label}>
          <span className="kpi-label">{label}</span>
          <span className={cn('kpi-value', accent && 'accent')}>{value}</span>
        </div>
      ))}
    </div>
  )
}

/* ---------- 槽条 ---------- */

export const SHELL_SLOTS: ShellSlot[] = [
  { key: 'recent', label: '最近', render: () => <RecentsSlot /> },
  { key: 'kpi', label: 'KPI', render: () => <KpiSlot /> },
]

export function SlotPanel({ slots }: { slots: ShellSlot[] }) {
  const [active, setActive] = useState(slots[0]?.key ?? '')
  if (!slots.length) return null

  return (
    <div className="sidebar-slot">
      {/* 槽条用 role=tablist：它是真的在切面板，不是"分类标签" */}
      <div className="slot-tabs" role="tablist" aria-label="侧栏快捷面板">
        {slots.map((slot) => (
          <button
            key={slot.key}
            type="button"
            role="tab"
            aria-selected={slot.key === active}
            className={cn('slot-tab', slot.key === active && 'active')}
            onClick={() => setActive(slot.key)}
          >
            {slot.label}
          </button>
        ))}
      </div>

      <div className="slot-body">
        {/* 只挂当前那一格（原型的做法是全部渲染 + display:none，React 里条件渲染更省） */}
        {slots
          .filter((slot) => slot.key === active)
          .map((slot) => (
            <div className="slot-panel active" key={slot.key} role="tabpanel">
              {slot.render()}
            </div>
          ))}
      </div>
    </div>
  )
}
