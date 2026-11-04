import { invoke } from '@tauri-apps/api/core'
import { call } from './error'
import { dueText, ownerDisplayName } from '../data/derive'
import { dayDiff, type RawTask, type TaskItemRow } from '../lib/task-map'

export type { RawTask, TaskItemRow }
export { toTaskRow } from '../lib/task-map'
import type { Priority, Task, TaskStatus } from '../types'

/**
 * 任务（`task` 表）。
 *
 * 后端出参是表列形态，前端 `Task` 是展示形态（`name` / `due` 文案 / `dueDays`）。
 * 转换放在这一层 —— 与项目、文档同一条分工：组件不碰表列名，也不自己算日期差。
 */

export interface TaskInput {
  scope?: string
  projectId?: string | null
  ownerCode?: string | null
  title: string
  state: string
  priority: string
  dueAt?: string | null
  scheduledStart?: string | null
  estimateMin?: number | null
  /** 从哪来：todo / idea / ref（有值 = 收件箱项） */
  sourceKind?: string | null
}

export const taskKeys = {
  all: ['tasks'] as const,
  byProject: (projectId: string) => [...taskKeys.all, 'project', projectId] as const,
  byScope: (scope: string) => [...taskKeys.all, 'scope', scope] as const,
}

export function toTask(raw: RawTask): Task {
  const dueDays = dayDiff(raw.dueAt) ?? Number.MAX_SAFE_INTEGER
  return {
    id: raw.id,
    name: raw.title,
    projectId: raw.projectId ?? undefined,
    projectName: raw.projectName || undefined,
    status: raw.state as TaskStatus,
    priority: raw.priority as Priority,
    owner: raw.ownerCode ? ownerDisplayName(raw.ownerCode) : '',
    due: raw.dueAt ? dueText(dueDays) : '—',
    /* 已完成的条目不标逾期 —— 它已经不该再被催 */
    late: raw.dueAt !== null && dueDays < 0 && raw.state !== 'done',
    dueDays,
    doneDays: dayDiff(raw.completedAt),
  }
}

/** 一个项目的任务。浏览器预览里给空集（与项目/文档同一条降级）。 */
export function listProjectTasks(projectId: string): Promise<Task[]> {
  return invoke<RawTask[]>('task_list', { projectId }).then((rows) => rows.map(toTask))
}

/** 某归属域的任务**原始行** —— 任务页 provider 用它再映射成 `TaskRow`。 */
export function listRawTasks(scope?: string | null): Promise<RawTask[]> {
  return call(() => invoke<RawTask[]>('task_list', { scope: scope ?? null }))
}

/** 某归属域的任务（已映射成 `Task` 的那一份）。 */
export function listScopeTasks(scope?: string): Promise<Task[]> {
  return invoke<RawTask[]>('task_list', { scope: scope ?? null }).then((rows) => rows.map(toTask))
}

export function createTask(input: TaskInput): Promise<RawTask> {
  return call(() => invoke<RawTask>('task_create', { input }))
}

export function updateTask(id: string, input: TaskInput): Promise<RawTask> {
  return call(() => invoke<RawTask>('task_update', { id, input }))
}

/** 只改状态（勾选完成 / 拖回待办）。与全量 `update` 分开：勾选不该带整份表单。 */
export function setTaskState(id: string, state: string): Promise<RawTask> {
  return call(() => invoke<RawTask>('task_set_state', { id, state }))
}

export function deleteTask(id: string): Promise<void> {
  return call(() => invoke('task_delete', { id }))
}

/* ============================================================
   任务页（`/tasks`）用的形态：`TaskRow`（比 `Task` 多派生格位）
   ------------------------------------------------------------
   派生的一律不算库：`inToday` / `overdueDays` / `dueLabel` / `quad` / `calDay` / `calLabel`
   全部由 `dueAt` + `state` + 今天算出 —— 存进库第二天就会说错话。
   ============================================================ */

/* ---------- 子表：检查项 ---------- */

export function listTaskItems(taskId: string): Promise<TaskItemRow[]> {
  return call(() => invoke<TaskItemRow[]>('task_item_list', { taskId }))
}

export function createTaskItem(taskId: string, title: string): Promise<TaskItemRow> {
  return call(() => invoke<TaskItemRow>('task_item_create', { taskId, title }))
}

export function toggleTaskItem(id: string, done: boolean): Promise<TaskItemRow> {
  return call(() => invoke<TaskItemRow>('task_item_toggle', { id, done }))
}

export function deleteTaskItem(id: string): Promise<void> {
  return call(() => invoke('task_item_delete', { id }))
}
