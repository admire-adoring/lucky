import { invoke } from '@tauri-apps/api/core'
import { call } from './error'
import type { BugItem } from '../data/derive'

/**
 * 项目问题清单（`project_bug`）。
 *
 * 与风险的差别：风险是"可能出事"（`project_risk`），Bug 是"已经出事"——
 * 所以它有严重度、版本与修复状态。
 */
export interface ProjectBug {
  id: string
  projectId: string
  title: string
  level: 'critical' | 'major' | 'minor'
  status: 'open' | 'fixing' | 'fixed'
  version: string
  reporterId: string | null
  reporterName: string
  foundAt: string
  detail: string
  sortOrder: number
  updatedAt: string
}

export interface ProjectBugInput {
  title: string
  level: 'critical' | 'major' | 'minor'
  status: 'open' | 'fixing' | 'fixed'
  version?: string
  reporterId?: string | null
  foundAt: string
  detail?: string
}

export const bugKeys = {
  all: ['projectBugs'] as const,
  byProject: (projectId: string) => [...bugKeys.all, projectId] as const,
}

const HOUR_MS = 3_600_000

/** "多久之前"：一小时内说分钟、一天内说小时、再久说天。 */
function agoText(hours: number): string {
  if (hours < 1) return '刚刚'
  if (hours < 24) return `${hours} 小时前`
  return `${Math.round(hours / 24)} 天前`
}

export function toBugItem(raw: ProjectBug): BugItem {
  const hours = raw.foundAt
    ? Math.max(0, Math.round((Date.now() - Date.parse(raw.foundAt)) / HOUR_MS))
    : 0
  return {
    id: raw.id,
    title: raw.title,
    level: raw.level,
    status: raw.status,
    version: raw.version,
    when: agoText(hours),
    who: raw.reporterName,
  }
}

export function listProjectBugs(projectId: string): Promise<ProjectBug[]> {
  return call(() => invoke<ProjectBug[]>('bug_list', { projectId }))
}

export function createProjectBug(projectId: string, input: ProjectBugInput): Promise<ProjectBug> {
  return call(() => invoke<ProjectBug>('bug_create', { projectId, input }))
}

export function updateProjectBug(id: string, input: ProjectBugInput): Promise<ProjectBug> {
  return call(() => invoke<ProjectBug>('bug_update', { id, input }))
}

export function setProjectBugStatus(id: string, status: string): Promise<ProjectBug> {
  return call(() => invoke<ProjectBug>('bug_set_status', { id, status }))
}

export function deleteProjectBug(id: string): Promise<void> {
  return call(() => invoke('bug_delete', { id }))
}
