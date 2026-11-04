import { useMemo, useState } from 'react'
import { buildWorkTaskRows, applyOverride, toggleOverride, type TaskOverride, type WorkTaskRow } from '../../../data/workspace/work-tasks'
import { useProjects } from '../../../hooks/use-projects'
import { useRawTasks, useTaskMutations } from '../../../hooks/use-tasks'
import { toTask } from '../../../api/tasks'
import { errorText } from '../../../api/error'
import { toast } from '../../../stores/toast-store'
import { WorkTaskBoard } from './WorkTaskBoard'

/* ============================================================================
   工作模块 · 「任务」分区（`/work/tasks`）
   原型：`design/work/work_task.html`（2026-10-14）
   ----------------------------------------------------------------------------
   上一版这一格是一份 6 条的**静态清单**（自己的 markup、没有数据源、勾选只切外观），
   与工作台那张卡上的同一批任务各说各话。这一版两者共用同一份池、同一套四档视图：
   卡传「今天 ∪ 逾期 ∪ 今天完成」、这一页传**全量**（原型 `TASK_HOST` 那张表里
   `tasksPanel.scope` 就是"不过滤"）。

   数据：`useProjects()` 里 `scope === 'work'` 的项目 → `buildTasks` 拉平 →
   `buildWorkTaskRows`。原型那 15 条与 4 个样本项目不是数据源（`ProjectDrawers`
   文件头同一条），所以条数与项目名跟原型不同，这是有意的。

   与工作台那张卡的分工：那张卡是"今天那一刀"的预览，这一页是全量与四档里的日历档。
   日历档只在这一页有位置 —— 卡的宽度放不下 7 列网格。
   ============================================================================ */

export function WorkTasksPage() {
  const { data: allProjects = [], isLoading } = useProjects()

  const projects = useMemo(() => allProjects.filter((project) => project.scope === 'work'), [allProjects])

  /* 任务走真实库：`useScopeTasks('work')` → 按 projectId 分给各项目再拼行。
     派生（`buildTasks`）只剩兜底路径 —— 见 `buildWorkTaskRows` 的签名注释。 */
  const rawTasks = useRawTasks('work').map(toTask)
  const mutations = useTaskMutations()
  const base = useMemo(() => buildWorkTaskRows(projects, rawTasks), [projects, rawTasks])

  const [override, setOverride] = useState<Record<string, TaskOverride>>({})
  const rows = useMemo(() => applyOverride(base, override), [base, override])

  const toggle = (row: WorkTaskRow) => {
    /* 回执写在事件里，不写进 setState 的更新函数 —— StrictMode 下更新函数会跑两遍 */
    const done = (override[row.id]?.state ?? row.state) === 'done'
    setOverride((prev) => toggleOverride(row, prev))
    /* 乐观覆盖在前，落库在后；失败时缓存刷新会把行拉回去 */
    mutations.setState.mutate(
      { id: row.id, state: done ? 'todo' : 'done' },
      {
        onSuccess: () => toast(done ? `已重置「${row.title}」` : `已完成「${row.title}」`),
        onError: (error) => toast(`改状态失败：${errorText(error)}`),
      },
    )
  }

  return <WorkTaskBoard rows={rows} notice={toast} onToggle={toggle} loading={isLoading} />
}
