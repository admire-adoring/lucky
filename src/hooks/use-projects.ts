import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createMilestone,
  createProject,
  deleteMilestone,
  deleteProject,
  fetchMilestones,
  fetchProjectActivity,
  fetchProjectDetail,
  fetchProjects,
  fetchRecentActivity,
  projectKeys,
  setMilestoneState,
  setProjectStatus,
  updateMilestone,
  updateProject,
  type MilestonePatch,
  type ProjectPatch,
} from '../api/projects'
import type { MilestoneState, ProjectStatus } from '../types'

export function useProjects() {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: fetchProjects,
    staleTime: 5 * 60 * 1000,
  })
}

export function useProjectDetail(id: string | undefined) {
  return useQuery({
    queryKey: projectKeys.detail(id ?? ''),
    queryFn: () => fetchProjectDetail(id),
    enabled: Boolean(id),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * 项目的写操作 —— 新建 / 编辑 / 改状态（归档·恢复·撤销归档）/ 删除。
 *
 * 五个动作收在一处失效上：改完让 `['projects']` 那一族全失效。
 *    只失效列表是不够的 —— 详情页读的是 `['projects','detail',id]`，
 *    归档之后点进那个项目，Hero 上的徽标还写着「进行中」。
 *
 * 写的是哪一份由 `api/projects.ts` 分派：Tauri 里落真实库，浏览器里落演示种子。
 *    删除不可恢复（撤销入口随换源撤掉了）。
 */
export function useProjectActions() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: projectKeys.all })

  return {
    create: useMutation({ mutationFn: createProject, onSuccess: invalidate }),
    save: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: ProjectPatch }) => updateProject(id, patch),
      onSuccess: invalidate,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: ProjectStatus }) => setProjectStatus(id, status),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: deleteProject, onSuccess: invalidate }),
  }
}

/* —— 里程碑 —— */

export function useMilestones(projectId: string | undefined) {
  return useQuery({
    queryKey: projectId ? ['projects', 'milestones', projectId] : ['projects', 'milestones'],
    queryFn: () => fetchMilestones(projectId!),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  })
}

export function useMilestoneActions() {
  const queryClient = useQueryClient()
  // 详情页也读里程碑，一并失效
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['projects', 'milestones'] })
    queryClient.invalidateQueries({ queryKey: projectKeys.all })
  }

  return {
    create: useMutation({
      mutationFn: ({ projectId, patch }: { projectId: string; patch: MilestonePatch }) => createMilestone(projectId, patch),
      onSuccess: () => invalidateAll(),
    }),
    save: useMutation({
      mutationFn: ({ id, patch }: { id: string; patch: MilestonePatch }) => updateMilestone(id, patch),
      onSuccess: () => invalidateAll(),
    }),
    setState: useMutation({
      mutationFn: ({ id, state }: { id: string; state: MilestoneState }) => setMilestoneState(id, state),
      onSuccess: () => invalidateAll(),
    }),
    remove: useMutation({ mutationFn: deleteMilestone, onSuccess: () => invalidateAll() }),
  }
}

/* —— 动态流 —— */

export function useProjectActivity(projectId: string | undefined, limit?: number) {
  return useQuery({
    queryKey: projectId ? ['projects', 'activity', projectId] : ['projects', 'activity'],
    queryFn: () => fetchProjectActivity(projectId!, limit),
    enabled: Boolean(projectId),
    staleTime: 30 * 1000,
  })
}

/** 跨项目最近动态（工作台首页用） */
export function useRecentActivity(limit: number = 12) {
  return useQuery({
    queryKey: ['projects', 'recent-activity', limit],
    queryFn: () => fetchRecentActivity(limit),
    staleTime: 30 * 1000,
  })
}
