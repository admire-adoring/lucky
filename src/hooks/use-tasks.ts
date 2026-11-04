import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTask,
  deleteTask,
  listProjectTasks,
  listRawTasks,
  setTaskState,
  taskKeys,
  updateTask,
  type TaskInput,
} from '../api/tasks'
import type { RawTask } from '../api/tasks'
import type { Task } from '../types'

/** 一个项目的任务（项目详情「任务」分区）。 */
export function useProjectTasks(projectId: string | undefined): Task[] {
  const { data } = useQuery({
    queryKey: taskKeys.byProject(projectId ?? ''),
    queryFn: () => listProjectTasks(projectId as string),
    enabled: Boolean(projectId),
    staleTime: 30 * 1000,
  })
  return data ?? []
}

/** 某归属域的任务**原始行**（`/tasks` 的 provider 用它再映射成 `TaskRow`）。`null` = 全部。 */
export function useRawTasks(scope?: string | null): RawTask[] {
  const { data } = useQuery({
    queryKey: taskKeys.byScope(scope ?? 'all'),
    queryFn: () => listRawTasks(scope),
    staleTime: 30 * 1000,
  })
  return data ?? []
}

/**
 * 增 / 改 / 勾选 / 删 —— 一处失效。
 *
 * 失效的是 `taskKeys.all`：项目的任务、某域的任务、以及工作台/概览上那些
 * "任务完成 100/164" 的读法都挂在同一个前缀下面。
 */
export function useTaskMutations() {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: taskKeys.all })

  return {
    create: useMutation({ mutationFn: (input: TaskInput) => createTask(input), onSuccess: invalidate }),
    update: useMutation({
      mutationFn: ({ id, input }: { id: string; input: TaskInput }) => updateTask(id, input),
      onSuccess: invalidate,
    }),
    setState: useMutation({
      mutationFn: ({ id, state }: { id: string; state: string }) => setTaskState(id, state),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteTask(id), onSuccess: invalidate }),
  }
}
