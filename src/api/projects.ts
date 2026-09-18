import { buildActivity, buildDocuments, buildMilestones, buildTasks } from '../data/derive'
import { FALLBACK_PROJECT_ID, PROJECTS } from '../data/projects'
import type { Project, ProjectDetail } from '../types'

/**
 * 数据访问层。
 * 当前用仓库内的静态数据模拟一个异步后端；接入真实服务时只需替换本文件的实现，
 * 上层的 TanStack Query hooks 与组件无需改动。
 */
const LATENCY_MS = 260

function respond<T>(value: T, ms: number = LATENCY_MS): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(value), ms)
  })
}

export const projectKeys = {
  all: ['projects'] as const,
  list: () => [...projectKeys.all, 'list'] as const,
  detail: (id: string) => [...projectKeys.all, 'detail', id] as const,
}

export function fetchProjects(): Promise<Project[]> {
  return respond(PROJECTS)
}

export function fetchProjectDetail(id: string | undefined): Promise<ProjectDetail> {
  // 与原型保持一致：id 不匹配时回落到 p1（接后端后此处应改为抛 404）
  const project = PROJECTS.find((item) => item.id === id) ?? PROJECTS.find((item) => item.id === FALLBACK_PROJECT_ID)

  if (!project) {
    return Promise.reject(new Error('项目数据未初始化'))
  }

  return respond({
    project,
    tasks: buildTasks(project),
    milestones: buildMilestones(project),
    documents: buildDocuments(project),
    activity: buildActivity(project),
  })
}

/** 演示账号 —— 原型已预填，点击登录即可进入 */
export const DEMO_ACCOUNT = {
  email: 'me@lucky-y.app',
  password: 'lucky-y-2026',
}
