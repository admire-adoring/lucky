import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createProject,
  deleteProject,
  fetchProjectDetail,
  fetchProjects,
  insertProject,
  projectKeys,
  setProjectStatus,
  updateProject,
  type ProjectPatch,
} from '../api/projects'
import type { ProjectStatus } from '../types'

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
 * 项目的写操作 —— 新建 / 编辑 / 改状态（归档·恢复·撤销归档）/ 删除 / 撤销删除。
 *
 * 六个动作都收在一处失效上：改完让 `['projects']` 那一族全失效。
 *    只失效列表是不够的 —— 详情页读的是 `['projects','detail',id]`，
 *    归档之后点进那个项目，Hero 上的徽标还写着「进行中」。
 *
 * 这些 mutation 当前写的是内存里的假后端（见 `api/projects.ts` 那一段），
 *    刷新即回到种子数据。语义与原型逐条一致。
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
    unremove: useMutation({ mutationFn: insertProject, onSuccess: invalidate }),
  }
}
