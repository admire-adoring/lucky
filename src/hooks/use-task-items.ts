import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTaskItem,
  deleteTaskItem,
  listTaskItems,
  toggleTaskItem,
  type TaskItemRow,
} from '../api/tasks'

const itemKeys = {
  all: ['taskItems'] as const,
  byTask: (taskId: string) => [...itemKeys.all, taskId] as const,
}

/** 一条任务的检查项（子表）。弹窗关了就不查（`taskId` 传 null）。 */
export function useTaskItems(taskId: string | null): TaskItemRow[] {
  const { data } = useQuery({
    queryKey: itemKeys.byTask(taskId ?? ''),
    queryFn: () => listTaskItems(taskId as string),
    enabled: Boolean(taskId),
    staleTime: 30 * 1000,
  })
  return data ?? []
}

/**
 * 增 / 勾 / 删 —— 只失效这一条任务的子表。
 * 不失效 `taskKeys`：检查项不影响主表的状态、截止与列表读数（那些读 `state` / `due_at`）。
 */
export function useTaskItemMutations(taskId: string | null) {
  const queryClient = useQueryClient()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: itemKeys.all })

  return {
    create: useMutation({
      mutationFn: (title: string) => createTaskItem(taskId as string, title),
      onSuccess: invalidate,
    }),
    toggle: useMutation({
      mutationFn: ({ id, done }: { id: string; done: boolean }) => toggleTaskItem(id, done),
      onSuccess: invalidate,
    }),
    remove: useMutation({ mutationFn: (id: string) => deleteTaskItem(id), onSuccess: invalidate }),
  }
}
