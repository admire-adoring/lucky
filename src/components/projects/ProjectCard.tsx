import { isCardDueWarn } from '../../data/derive'
import { SCOPE_META } from '../../data/meta'
import { cn } from '../../lib/cn'
import type { Project } from '../../types'
import { Icon } from '../icons/Icon'
import { IconButton } from '../ui/IconButton'
import { OwnerAvatars } from '../ui/Avatar'
import { ProgressBar } from '../ui/ProgressBar'
import { ProjectStatusChip, ScopeBadge, Tag } from '../ui/Badge'

interface ProjectCardProps {
  project: Project
  index: number
  onOpen: (id: string) => void
}

export function ProjectCard({ project, index, onOpen }: ProjectCardProps) {
  const scope = SCOPE_META[project.scope]
  const dueWarn = isCardDueWarn(project)

  return (
    <article
      role="button"
      tabIndex={0}
      aria-label={project.name}
      style={{ animationDelay: `${index * 45}ms` }}
      onClick={() => onOpen(project.id)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') onOpen(project.id)
      }}
      className="glass-panel group relative flex animate-fade-up cursor-pointer flex-col rounded-xl border border-line bg-surface p-5 shadow-sm transition-all duration-[220ms] ease-out hover:-translate-y-[3px] hover:border-line-strong hover:bg-surface-raised hover:shadow-lg"
    >
      {/* 左侧 scope 色条：hover 淡入。加一层同色外发光，让它像"玻璃边缘的折射线" */}
      <span
        className={cn(
          'absolute bottom-[22px] left-0 top-[22px] w-[3px] rounded-r-[3px] opacity-0 transition-opacity duration-[220ms] ease-out group-hover:opacity-100',
          scope.bar,
        )}
        style={{ boxShadow: `0 0 14px 1px ${scope.hex}66` }}
      />

      <div className="mb-3 flex items-center gap-2">
        <ScopeBadge scope={project.scope} />
        <ProjectStatusChip status={project.status} />
        <IconButton
          icon="i-more"
          label="更多操作"
          variant="muted"
          className="ml-auto"
          onClick={(event) => event.stopPropagation()}
        />
      </div>

      <h3 className="mb-1.5 text-15-5 font-bold leading-[1.45]">{project.name}</h3>
      {/* 原型未重置 p 的默认外边距，描述上方的 13px 来自浏览器默认的 margin-top: 1em */}
      <p className="mb-4 mt-[13px] line-clamp-2 min-h-[42px] text-13 leading-[1.65] text-ink-500">
        {project.description}
      </p>

      <div className="mb-4">
        <ProgressBar value={project.progress} fill={scope.fill} />
      </div>

      <div className="mt-auto flex flex-wrap items-center gap-4 border-t border-line pt-3 text-12 font-medium text-ink-500">
        <span className={cn('inline-flex items-center gap-[5px]', dueWarn && 'font-semibold text-danger')}>
          <Icon name="i-calendar" className={cn('h-[13.5px] w-[13.5px]', dueWarn ? 'text-danger' : 'text-ink-400')} />
          {project.dueShort}
        </span>
        <span className="inline-flex items-center gap-[5px]">
          <Icon name="i-check" className="h-[13.5px] w-[13.5px] text-ink-400" />
          {project.tasksDone}/{project.tasksTotal} 任务
        </span>
        <OwnerAvatars owners={project.owners} className="ml-auto" />
      </div>

      <div className="mt-3 flex flex-wrap gap-[5px]">
        {project.tags.map((tag) => (
          <Tag key={tag}>#{tag}</Tag>
        ))}
      </div>
    </article>
  )
}
