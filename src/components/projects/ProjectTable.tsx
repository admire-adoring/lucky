import { isDueSoon } from '../../data/derive'
import { SCOPE_META } from '../../data/meta'
import { cn } from '../../lib/cn'
import type { Project } from '../../types'
import { Avatar, OwnerAvatars } from '../ui/Avatar'
import { PriorityTag, ProjectStatusChip, ScopeBadge } from '../ui/Badge'
import { ProgressBar } from '../ui/ProgressBar'

const HEAD_CELL =
  'whitespace-nowrap border-b border-line bg-ink-50 px-4 py-3 text-left text-11-5 font-bold uppercase tracking-[.06em] text-ink-400'

interface ProjectTableProps {
  projects: Project[]
  onOpen: (id: string) => void
}

export function ProjectTable({ projects, onOpen }: ProjectTableProps) {
  return (
    <div className="glass-panel overflow-hidden rounded-xl border border-line bg-surface shadow-sm max-[600px]:overflow-x-auto">
      <table className="w-full border-collapse text-13-5 max-[600px]:min-w-[720px]">
        <thead>
          <tr>
            <th className={HEAD_CELL}>项目名称</th>
            <th className={HEAD_CELL}>范围</th>
            <th className={HEAD_CELL}>状态</th>
            <th className={HEAD_CELL}>进度</th>
            <th className={HEAD_CELL}>截止日期</th>
            <th className={HEAD_CELL}>任务</th>
            <th className={HEAD_CELL}>优先级</th>
            <th className={HEAD_CELL}>负责人</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => (
            <tr
              key={project.id}
              onClick={() => onOpen(project.id)}
              className="cursor-pointer border-b border-line transition-colors duration-150 ease-out last:border-b-0 hover:bg-surface-raised"
            >
              <td className="px-4 py-[13px] align-middle">
                <div className="flex min-w-[210px] items-center gap-2.5">
                  <Avatar
                    name={SCOPE_META[project.scope].label.slice(0, 1)}
                    size="sm"
                    style={{ background: SCOPE_META[project.scope].hex }}
                  />
                  <span>
                    {/* 行的主操作做成真实 button：键盘可达，且自带可访问名。
                        行本身不设 tabIndex —— 可聚焦却没有名字的行对读屏器是负担。 */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        onOpen(project.id)
                      }}
                      className="border-0 bg-transparent p-0 text-left"
                    >
                      <b className="text-13-5 font-semibold leading-[1.4]">{project.name}</b>
                    </button>
                    <small className="block text-11-5 font-medium text-ink-400">{project.milestone}</small>
                  </span>
                </div>
              </td>
              <td className="px-4 py-[13px] align-middle">
                <ScopeBadge scope={project.scope} />
              </td>
              <td className="px-4 py-[13px] align-middle">
                <ProjectStatusChip status={project.status} />
              </td>
              <td className="px-4 py-[13px] align-middle">
                <div className="flex min-w-[130px] items-center">
                  <ProgressBar
                    value={project.progress}
                    fill={SCOPE_META[project.scope].fill}
                    barClassName="min-w-[64px]"
                  />
                </div>
              </td>
              <td
                className={cn(
                  'px-4 py-[13px] align-middle tabular-nums',
                  isDueSoon(project) ? 'font-semibold text-danger' : 'text-ink-600',
                )}
              >
                {project.dueShort}
              </td>
              <td className="px-4 py-[13px] align-middle font-medium tabular-nums text-ink-600">
                {project.tasksDone} / {project.tasksTotal}
              </td>
              <td className="px-4 py-[13px] align-middle">
                <PriorityTag priority={project.priority} />
              </td>
              <td className="px-4 py-[13px] align-middle">
                <OwnerAvatars owners={project.owners} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
