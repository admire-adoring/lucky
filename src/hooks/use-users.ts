import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  appKeys,
  deleteUser,
  fetchAppInfo,
  listUsers,
  saveUser,
  userKeys,
  type UserInput,
} from '../api/user'
import type { User } from '../api/user'

/** 成员名单。真实库还是演示名单由 `api/user.ts` 按宿主分派。 */
export function useUsers(): User[] {
  const { data } = useQuery({ queryKey: userKeys.list(), queryFn: listUsers, staleTime: 5 * 60 * 1000 })
  return data ?? []
}

/** 本机数据（库路径 / 文档根 / 计数）。 */
export function useAppInfo() {
  return useQuery({ queryKey: appKeys.info(), queryFn: fetchAppInfo, staleTime: 60 * 1000 })
}

/**
 * 新建 / 改名 / 删除。改完同时失效成员名单与本机数据（「内容」卡里有成员数）——
 * 项目那边的负责人下拉也会跟着刷新（它们读同一份 `app_user`）。
 */
export function useUserMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: userKeys.all })
    queryClient.invalidateQueries({ queryKey: appKeys.all })
  }

  return {
    save: useMutation({ mutationFn: (input: UserInput) => saveUser(input), onSuccess: invalidate }),
    remove: useMutation({ mutationFn: (id: string) => deleteUser(id), onSuccess: invalidate }),
  }
}
