import type { ReactNode } from 'react'
import type { ProjectStats } from '../../data/derive'
import { SCOPE_META } from '../../data/meta'
import { Icon } from '../icons/Icon'
import type { IconName } from '../../types'

/** 原型里这四处是写死的演示文案（非派生数据），保持一致 */
const NEW_THIS_WEEK = 2
const WEEK_OVER_WEEK = '6%'
const CLOSED_TASKS = 11

function StatCard({
  icon,
  label,
  value,
  unit,
  foot,
  children,
}: {
  icon: IconName
  label: string
  value: number | string
  unit?: string
  foot: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="glass-panel relative overflow-hidden rounded-xl border border-line bg-surface p-5 shadow-sm transition-all duration-[220ms] ease-out hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-raised hover:shadow-md">
      {/* ⚠️ 2026-09-25 纯色化：这里原本是一颗**角部内光源** ——
          一个 112px 的圆，`bg-[radial-gradient(circle,rgba(99,102,241,.24)_0%,
          rgba(99,102,241,0)_70%)]`，原注释写明它的用途是"暗示这片材质是透光的"。
          它的**存在理由就是玻璃**，所以随玻璃一并删除 ——
          纯色底上它不是"透光"，只是"卡片右上角有一块洗不掉的淡蓝"。 */}
      <div className="relative flex items-center gap-[7px] text-12-5 font-semibold text-ink-500">
        <Icon name={icon} className="h-[15px] w-[15px] text-ink-400" />
        {label}
      </div>
      <div className="relative mt-2.5 flex items-baseline gap-[7px] text-29 font-bold leading-[1.1] tracking-[-0.02em] tabular-nums">
        {value}
        {unit ? <small className="text-13 font-semibold tracking-normal text-ink-400">{unit}</small> : null}
      </div>
      {children}
      <div className="relative mt-[7px] flex items-center gap-1.5 text-12 text-ink-400">{foot}</div>
    </div>
  )
}

function Delta({ direction, children }: { direction: 'up' | 'down'; children: React.ReactNode }) {
  return (
    <span
      className={
        direction === 'up'
          ? 'inline-flex items-center gap-[3px] rounded-full bg-success-bg px-1.5 py-px text-11-5 font-bold text-success'
          : 'inline-flex items-center gap-[3px] rounded-full bg-danger-bg px-1.5 py-px text-11-5 font-bold text-danger'
      }
    >
      <Icon name={direction === 'up' ? 'i-trend' : 'i-alert'} className="h-[11px] w-[11px]" />
      {children}
    </span>
  )
}

export function ProjectStatsPanel({ stats }: { stats: ProjectStats }) {
  return (
    <section className="mb-6 grid grid-cols-4 gap-4 max-[1240px]:grid-cols-2 max-[600px]:grid-cols-1" aria-label="项目概览">
      <StatCard
        icon="i-layer"
        label="全部项目"
        value={stats.total}
        unit="个"
        foot={
          <>
            <Delta direction="up">{NEW_THIS_WEEK}</Delta>
            本周新增
          </>
        }
      >
        <div className="mt-[11px] flex h-[5px] gap-[3px] overflow-hidden rounded-full" aria-hidden="true">
          {stats.scopeSegments.map((segment) => (
            <span
              key={segment.scope}
              className="block h-full rounded-full"
              style={{ width: `${segment.percent}%`, background: SCOPE_META[segment.scope].hex }}
            />
          ))}
        </div>
      </StatCard>

      <StatCard
        icon="i-play"
        label="进行中"
        value={stats.active}
        unit="项"
        foot={
          <>
            <Delta direction="down">{stats.risk}</Delta>
            含 {stats.risk} 项风险阻塞
          </>
        }
      />

      <StatCard
        icon="i-trend"
        label="平均进度"
        value={stats.averageProgress}
        unit="%"
        foot={
          <>
            <Delta direction="up">{WEEK_OVER_WEEK}</Delta>
            较上周
          </>
        }
      />

      <StatCard
        icon="i-check-circle"
        label="本月完成"
        value={stats.done}
        unit="项"
        foot={<>已关闭 {CLOSED_TASKS} 条任务</>}
      />
    </section>
  )
}
