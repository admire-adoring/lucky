import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  accountKeys,
  createProjectAccount,
  deleteProjectAccount,
  listProjectAccounts,
  toAccountItem,
  updateProjectAccount,
  type ProjectAccountInput,
} from '../api/project-accounts'
import type { AccountItem } from '../data/derive'

/**
 * 项目的凭据清单（真数据）。返回组件已经在用的 `AccountItem` 形态 ——
 * `AccountPanel` 的渲染一行不用改，变的是"从哪来"。
 */
export function useProjectAccounts(projectId: string | undefined): AccountItem[] {
  const { data } = useQuery({
    queryKey: accountKeys.list(projectId ?? ''),
    queryFn: () => listProjectAccounts(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 60 * 1000,
  })
  return (data ?? []).map(toAccountItem)
}

/** 增 / 改 / 删 —— 收在凭据清单一处失效上（KPI 与 Tab 计数都挂在它下面）。 */
export function useAccountMutations(projectId: string) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: accountKeys.all })

  return {
    create: useMutation({
      mutationFn: (input: ProjectAccountInput) => createProjectAccount(projectId, input),
      onSuccess: invalidate,
    }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: ProjectAccountInput }) => updateProjectAccount(id, input),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteProjectAccount(id), onSuccess: invalidate }),
  }
}
