import { KANBAN_ORDER, SCOPE_META, STATUS_META } from '../../data/meta'
import type { Project } from '../../types'
import { Icon } from '../icons/Icon'
import { OwnerAvatars } from '../ui/Avatar'
import { PriorityTag, ScopeBadge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'

interface ProjectKanbanProps {
  projects: Project[]
  onOpen: (id: string) => void
}

export function ProjectKanban({ projects, onOpen }: ProjectKanbanProps) {
  return (
    <div className="grid grid-cols-[repeat(4,minmax(240px,1fr))] items-start gap-4 max-[1240px]:grid-cols-[repeat(2,minmax(240px,1fr))] max-[860px]:grid-cols-1">
      {KANBAN_ORDER.map((status) => {
        const items = projects.filter((project) => project.status === status)

        return (
          <div
            key={status}
            className="glass-soft min-h-[180px] rounded-lg border border-line bg-surface-sunken p-3"
          >
            <div className="flex items-center gap-2 px-1.5 pb-3 pt-1">
              <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: STATUS_META[status].hex }} />
              <b className="text-12-5 font-bold text-ink-700">{STATUS_META[status].label}</b>
              <span className="glass-soft ml-auto rounded-full border border-line bg-surface px-[7px] text-11-5 font-bold leading-[19px] text-ink-400">
                {items.length}
              </span>
            </div>

            {items.length === 0 ? (
              <div className="px-2.5 py-[22px] text-center text-12-5 text-ink-400">暂无项目</div>
            ) : (
              items.map((project, index) => (
                <div
                  key={project.id}
                  role="button"
                  tabIndex={0}
                  aria-label={project.name}
                  style={{ animationDelay: `${index * 45}ms` }}
                  onClick={() => onOpen(project.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') onOpen(project.id)
                  }}
                  className="glass-panel mb-2 animate-fade-up cursor-pointer rounded-lg border border-line bg-surface p-4 shadow-xs transition-all duration-[220ms] ease-out hover:-translate-y-0.5 hover:border-line-strong hover:bg-surface-raised hover:shadow-md"
                >
                  <div className="mb-[9px] flex items-center gap-[7px]">
                    <ScopeBadge scope={project.scope} />
                    <PriorityTag priority={project.priority} />
                  </div>

                  <div className="mb-[11px] text-13-5 font-[650] leading-[1.5]">{project.name}</div>

                  <div className="mb-2.5">
                    <ProgressBar value={project.progress} fill={SCOPE_META[project.scope].fill} />
                  </div>

                  <div className="flex items-center gap-2.5 text-11-5 font-medium text-ink-400">
                    <span className="inline-flex items-center gap-1">
                      <Icon name="i-calendar" className="h-[12.5px] w-[12.5px]" />
                      {project.dueShort}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Icon name="i-check" className="h-[12.5px] w-[12.5px]" />
                      {project.tasksDone}/{project.tasksTotal}
                    </span>
                    <OwnerAvatars owners={project.owners} className="ml-auto" />
                  </div>
                </div>
              ))
            )}
          </div>
        )
      })}
    </div>
  )
}
