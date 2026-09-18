import { isDueSoon } from '../../data/derive'
import type { Project, ProjectRisk } from '../../types'
import { Avatar } from '../ui/Avatar'
import { Tag } from '../ui/Badge'
import { Icon } from '../icons/Icon'

const ROW = 'flex items-start gap-4'
const KEY = 'w-[76px] shrink-0 pt-px text-12-5 font-semibold text-ink-400'
const VALUE = 'flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-13 font-medium text-ink-800'
const LINK = 'inline-flex items-center gap-[5px] font-semibold text-brand-600 hover:underline hover:underline-offset-[3px]'

/** 风险提示（只在有风险的项目上出现）—— 半透明红玻璃，与整体材质语言一致 */
export function RiskCallout({ risk }: { risk: ProjectRisk }) {
  return (
    <div className="glass-soft flex gap-[11px] rounded-md border border-danger-line bg-danger-bg p-4">
      <Icon name="i-alert" className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
      <div>
        <b className="mb-0.5 block text-13 font-bold">{risk.title}</b>
        <p className="m-0 text-12-5 leading-[1.65] text-ink-600">{risk.description}</p>
      </div>
    </div>
  )
}

export function ProjectInfoList({ project }: { project: Project }) {
  return (
    <div className="flex flex-col gap-4">
      <div className={ROW}>
        <span className={KEY}>负责人</span>
        <span className={VALUE}>
          {project.owners.map((owner) => (
            <Avatar key={owner} name={owner} size="xs" />
          ))}
          <span className="text-12-5 text-ink-500">{project.owners.length} 人</span>
        </span>
      </div>

      <div className={ROW}>
        <span className={KEY}>开始日期</span>
        <span className={VALUE}>{project.startDate}</span>
      </div>

      <div className={ROW}>
        <span className={KEY}>截止日期</span>
        <span className={VALUE}>
          <span className={isDueSoon(project) ? 'text-danger' : undefined}>{project.dueLong}</span>
        </span>
      </div>

      <div className={ROW}>
        <span className={KEY}>预算</span>
        <span className={VALUE}>{project.budget}</span>
      </div>

      <div className={ROW}>
        <span className={KEY}>可见性</span>
        <span className={VALUE}>
          <Icon name="i-lock" className="h-[14px] w-[14px] text-ink-400" />
          {project.visibility}
        </span>
      </div>

      <div className={ROW}>
        <span className={KEY}>标签</span>
        <span className={VALUE}>
          {project.tags.map((tag) => (
            <Tag key={tag}>#{tag}</Tag>
          ))}
        </span>
      </div>
    </div>
  )
}

export function ProjectLinks({ project, onAction }: { project: Project; onAction: (message: string) => void }) {
  return (
    <div className="flex flex-col gap-4">
      <div className={ROW}>
        <span className={KEY}>代码仓库</span>
        <span className={VALUE}>
          {project.repoUrl === '—' ? (
            <span className="text-ink-400">未关联</span>
          ) : (
            <button type="button" className={LINK} onClick={() => onAction('原型演示：外部跳转未实现')}>
              <Icon name="i-git" className="h-[14px] w-[14px]" />
              {project.repoUrl}
            </button>
          )}
        </span>
      </div>

      <div className={ROW}>
        <span className={KEY}>关联文档</span>
        <span className={VALUE}>
          <button type="button" className={LINK} onClick={() => onAction('原型演示：外部跳转未实现')}>
            <Icon name="i-link" className="h-[14px] w-[14px]" />
            {project.docsUrl}
          </button>
        </span>
      </div>

      <div className={ROW}>
        <span className={KEY}>同步方式</span>
        <span className={VALUE}>
          <Icon name="i-git" className="h-[14px] w-[14px] text-ink-400" />
          Git 异步推送
        </span>
      </div>
    </div>
  )
}
