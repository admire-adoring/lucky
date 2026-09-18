import { PRIORITY_META } from '../data/meta'
import type { Project, ScopeFilter, SortMode } from '../types'

export interface ProjectFilter {
  scope: ScopeFilter
  query: string
  sort: SortMode
}

/**
 * 列表过滤 + 排序 —— 与原型 visibleProjects() 完全一致：
 * 搜索命中项目名 / 描述 / 标签 / 里程碑，排序不影响默认顺序。
 */
export function filterProjects(projects: Project[], filter: ProjectFilter): Project[] {
  const keyword = filter.query.trim().toLowerCase()

  const list = projects.filter((project) => {
    if (filter.scope !== 'all' && project.scope !== filter.scope) return false
    if (!keyword) return true

    const haystack = [project.name, project.description, project.tags.join(' '), project.milestone]
      .join(' ')
      .toLowerCase()

    return haystack.includes(keyword)
  })

  switch (filter.sort) {
    case 'due':
      return list.sort((a, b) => a.daysLeft - b.daysLeft)
    case 'progress':
      return list.sort((a, b) => b.progress - a.progress)
    case 'priority':
      return list.sort((a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank)
    default:
      return list
  }
}
