import { cn } from '../../lib/cn'
import type { Milestone } from '../../types'
import { Icon } from '../icons/Icon'

/** 里程碑时间线（原型 .mile）：已完成 / 当前 / 待启动 三态 */
export function MilestoneTimeline({ milestones }: { milestones: Milestone[] }) {
  return (
    <div>
      {milestones.map((milestone, index) => {
        const isLast = index === milestones.length - 1
        const done = milestone.state === 'done'
        const now = milestone.state === 'now'

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

            <div className={cn('text-13-5 font-[650] leading-[1.5]', done && 'text-ink-500')}>{milestone.name}</div>
            <div className="mt-[3px] flex items-center gap-2.5 text-12 text-ink-400">
              <Icon name="i-calendar" className="h-[12.5px] w-[12.5px]" />
              {milestone.date} · {milestone.detail}
            </div>
          </div>
        )
      })}
    </div>
  )
}
