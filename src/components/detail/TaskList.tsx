import { PRIORITY_META } from '../../data/meta'
import { cn } from '../../lib/cn'
import type { Task } from '../../types'
import { Avatar } from '../ui/Avatar'
import { TaskStatusPill, Tag } from '../ui/Badge'
import { Icon } from '../icons/Icon'

interface TaskListProps {
  tasks: Task[]
  /** full：任务清单（含优先级与负责人）；preview：概览里的近期任务 */
  variant: 'full' | 'preview'
}

export function TaskList({ tasks, variant }: TaskListProps) {
  if (tasks.length === 0) {
    return <div className="px-8 py-8 text-center text-13 text-ink-400">全部任务已完成</div>
  }

  return (
    <>
      {tasks.map((task) => {
        const done = task.status === 'done'
        return (
          <div
            key={task.id}
            className="flex items-center gap-4 border-b border-line px-5 py-3 transition-colors duration-150 ease-out last:border-b-0 hover:bg-surface-raised"
          >
            <span
              className={cn(
                'flex h-[19px] w-[19px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] transition-all duration-150 ease-out',
                // 未勾选态要"看得见"，所以在玻璃上取抬升档的底 —— 空框用透明底会飘
                done ? 'border-success bg-success' : 'border-line-strong bg-surface-raised',
              )}
            >
              <Icon name="i-check-strong" className={cn('h-[11px] w-[11px] text-white', done ? 'opacity-100' : 'opacity-0')} />
            </span>

            <span
              className={cn(
                'min-w-0 flex-1 text-13-5 font-medium leading-[1.55]',
                done && 'text-ink-400 line-through decoration-ink-300',
              )}
            >
              {task.name}
            </span>

            <TaskStatusPill status={task.status} />

            {variant === 'full' ? <Tag>{PRIORITY_META[task.priority].label}</Tag> : null}

            <span
              className={cn(
                'whitespace-nowrap text-12 tabular-nums',
                task.late ? 'font-semibold text-danger' : 'text-ink-400',
              )}
            >
              {task.due}
            </span>

            {variant === 'full' ? <Avatar name={task.owner} size="xs" /> : null}
          </div>
        )
      })}
    </>
  )
}
