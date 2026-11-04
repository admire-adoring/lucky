import { useState } from 'react'
import { cn } from '../../lib/cn'
import type { Milestone, MilestoneState } from '../../types'
import { Icon } from '../icons/Icon'

/**
 * 里程碑时间线（原型 .mile）：已完成 / 当前 / 待启动 三态。
 *
 * 可选 `onEdit` 与 `onSetState`：传了才渲染行尾动作 ——
 *   编辑（铅笔）打开编辑弹窗；状态胶囊点一下直接切（后端 ux_milestone_now 唯一索引由 set_state 处理）。
 *   不传时退化成只读时间线（概览卡里就是这样）。
 */
const STATE_NEXT: Record<MilestoneState, MilestoneState> = {
  todo: 'now',
  now: 'done',
  done: 'todo',
}
const STATE_LABEL: Record<MilestoneState, string> = {
  todo: '待启动',
  now: '进行中',
  done: '已完成',
}

export function MilestoneTimeline({
  milestones,
  onEdit,
  onSetState,
}: {
  milestones: Milestone[]
  onEdit?: (m: Milestone) => void
  onSetState?: (m: Milestone, state: MilestoneState) => void
}) {
  return (
    <div>
      {milestones.map((milestone, index) => {
        const isLast = index === milestones.length - 1
        const done = milestone.state === 'done'
        const now = milestone.state === 'now'
        const interactive = Boolean(onEdit || onSetState)

        return (
          <div key={milestone.id} className={cn('relative pl-[34px]', !isLast && 'pb-6')}>
            {!isLast ? <span className="absolute bottom-[-4px] left-2 top-5 w-[1.5px] bg-line" /> : null}

            <span
              className={cn(
                'absolute left-0 top-1 flex h-[17px] w-[17px] items-center justify-center rounded-full border-2',
                // 节点也吃玻璃：未达成态必须有不透明的浅底，否则会在卡片上"漏光"
                done
                  ? 'border-success bg-success'
                  : now
                    ? 'border-brand-500 bg-surface-raised shadow-[0_0_0_4px_rgba(79,70,229,.14)]'
                    : 'border-line-strong bg-surface-raised',
              )}
            >
              {done ? <Icon name="i-check-strong" className="h-[9px] w-[9px] text-white" /> : null}
              {now ? <span className="h-[7px] w-[7px] rounded-full bg-brand-500" /> : null}
            </span>

            <div className={cn('flex items-start justify-between gap-2')}>
              <div className="flex-1 min-w-0">
                <div className={cn('text-13-5 font-[650] leading-[1.5]', done && 'text-ink-500')}>{milestone.name}</div>
                <div className="mt-[3px] flex items-center gap-2.5 text-12 text-ink-400">
                  <Icon name="i-calendar" className="h-[12.5px] w-[12.5px]" />
                  {milestone.date} · {milestone.detail}
                </div>
              </div>
              {interactive ? (
                <TimelineRowActions
                  milestone={milestone}
                  onEdit={onEdit}
                  onSetState={onSetState}
                />
              ) : null}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TimelineRowActions({
  milestone,
  onEdit,
  onSetState,
}: {
  milestone: Milestone
  onEdit?: (m: Milestone) => void
  onSetState?: (m: Milestone, state: MilestoneState) => void
}) {
  const [open, setOpen] = useState(false)
  const next = STATE_NEXT[milestone.state]
  return (
    <div className="relative flex shrink-0 items-center gap-1" onClick={(event) => event.stopPropagation()}>
      {onSetState ? (
        <button
          type="button"
          className="ms-state-pill"
          title={`点击切到「${STATE_LABEL[next]}」`}
          onClick={() => onSetState(milestone, next)}
        >
          {STATE_LABEL[milestone.state]}
        </button>
      ) : null}
      {onEdit ? (
        <button
          type="button"
          className="ms-row-btn"
          aria-label="编辑里程碑"
          title="编辑"
          onClick={() => setOpen((v) => !v)}
        >
          <Icon name="i-edit" className="h-[13px] w-[13px]" />
        </button>
      ) : null}
      {open && onEdit ? (
        <div className="ms-row-menu" role="menu">
          <button
            type="button"
            className="ms-row-menu-item"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onEdit(milestone)
            }}
          >
            <Icon name="i-edit" className="h-[12.5px] w-[12.5px]" /> 编辑里程碑
          </button>
          {onSetState ? (
            <>
              <button
                type="button"
                className="ms-row-menu-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onSetState(milestone, 'todo')
                }}
                disabled={milestone.state === 'todo'}
              >
                标为待启动
              </button>
              <button
                type="button"
                className="ms-row-menu-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onSetState(milestone, 'now')
                }}
                disabled={milestone.state === 'now'}
              >
                标为进行中
              </button>
              <button
                type="button"
                className="ms-row-menu-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  onSetState(milestone, 'done')
                }}
                disabled={milestone.state === 'done'}
              >
                标为已完成
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
