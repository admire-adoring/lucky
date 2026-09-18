import { SCOPE_META } from '../../data/meta'
import { cn } from '../../lib/cn'
import type { IconName, Project } from '../../types'
import { Icon } from '../icons/Icon'
import { Button } from '../ui/Button'
import { IconButton } from '../ui/IconButton'
import { ProjectStatusChip, ScopeBadge, Tag } from '../ui/Badge'
import { ProgressRing } from './ProgressRing'

interface MetaItem {
  icon: IconName
  label: string
  value: string
  warn?: boolean
}

export function ProjectHero({
  project,
  onAction,
}: {
  project: Project
  onAction: (message: string) => void
}) {
  const scope = SCOPE_META[project.scope]
  const dueSoon = project.status !== 'done' && project.daysLeft <= 14

  const metaItems: MetaItem[] = [
    { icon: 'i-users', label: '负责人', value: `${project.owners.length} 人` },
    { icon: 'i-calendar', label: '截止日期', value: project.dueLong, warn: dueSoon },
    { icon: 'i-clock', label: '剩余时间', value: project.daysLeft >= 0 ? `${project.daysLeft} 天` : '已结束', warn: dueSoon },
    { icon: 'i-lock', label: '可见性', value: project.visibility },
    { icon: 'i-flag', label: '当前里程碑', value: project.milestone },
  ]

  return (
    <section
      className="glass-panel relative mb-5 grid grid-cols-[minmax(0,1fr)_288px] gap-6 overflow-hidden rounded-2xl border border-line bg-surface p-6 shadow-md max-[1180px]:grid-cols-1 max-[860px]:p-4"
      aria-label="项目概览"
    >
      {/* 左侧 scope 色条：整块玻璃的"归属色折射线"，带同色辉光 */}
      <span className={cn('absolute bottom-0 left-0 top-0 w-1', scope.bar)} style={{ boxShadow: `0 0 22px 2px ${scope.hex}55` }} />

      <div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <ScopeBadge scope={project.scope} />
          <ProjectStatusChip status={project.status} metrics="pill" />
          <Tag>优先级 {project.priority === 'high' ? '高' : project.priority === 'mid' ? '中' : '低'}</Tag>
        </div>

        <h1 className="mb-2 text-26 leading-[1.3] max-[860px]:text-21">{project.name}</h1>
        <p className="m-0 mb-5 max-w-[660px] text-14 leading-[1.8] text-ink-500">{project.description}</p>

        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon="i-edit" onClick={() => onAction('原型演示：任务编辑面板未包含')}>
            编辑项目
          </Button>
          <Button icon="i-share" onClick={() => onAction('原型演示：分享功能未包含')}>
            分享
          </Button>
          <IconButton icon="i-more" label="更多" variant="framed" onClick={() => onAction('原型演示：更多操作未包含')} />
        </div>

        <div className="mt-5 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3 border-t border-dashed border-line pt-5">
          {metaItems.map((item) => (
            <div key={item.label} className="flex flex-col gap-[3px]">
              <span className="flex items-center gap-[5px] text-11-5 font-semibold text-ink-400">
                <Icon name={item.icon} className="h-[12.5px] w-[12.5px]" />
                {item.label}
              </span>
              <span className={cn('text-13-5 font-semibold', item.warn ? 'text-danger' : 'text-ink-800')}>
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <ProgressRing
        progress={project.progress}
        tasksDone={project.tasksDone}
        tasksTotal={project.tasksTotal}
        daysLeft={project.daysLeft}
      />
    </section>
  )
}
