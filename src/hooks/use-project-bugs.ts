import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  bugKeys,
  createProjectBug,
  deleteProjectBug,
  listProjectBugs,
  setProjectBugStatus,
  toBugItem,
  updateProjectBug,
  type ProjectBugInput,
} from '../api/project-bugs'
import type { BugItem } from '../data/derive'

/** 一个项目的问题清单（详情页 Bug 分区与概览卡）。 */
export function useProjectBugs(projectId: string | undefined): BugItem[] {
  const { data } = useQuery({
    queryKey: bugKeys.byProject(projectId ?? ''),
    queryFn: () => listProjectBugs(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  })
  return (data ?? []).map(toBugItem)
}

export function useBugMutations(projectId: string) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: bugKeys.all })

  return {
    create: useMutation({
      mutationFn: (input: ProjectBugInput) => createProjectBug(projectId, input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ProjectBugInput }) => updateProjectBug(id, input),
      onSuccess: invalidate,
    }),
    setStatus: useMutation({
      mutationFn: ({ id, status }: { id: string; status: string }) => setProjectBugStatus(id, status),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteProjectBug(id), onSuccess: invalidate }),
  }
}
