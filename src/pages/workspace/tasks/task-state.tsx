import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  findSlot,
  poolGroups,
  rowToClock,
  TASK_VIEWS,
  type TaskPrio,
  type TaskRow,
  type TaskScope,
  type TaskSectionKey,
  type TaskState,
  type TaskViewKey,
} from '../../../data/workspace/tasks'
import { toTaskRow } from '../../../api/tasks'
import { useRawTasks, useTaskMutations } from '../../../hooks/use-tasks'
import { errorText } from '../../../api/error'
import { toast } from '../../../stores/toast-store'

/**
 * 「任务」页的状态与全部动作 —— 一个 Provider 管整页。
 *
 * ============================================================================
 * 为什么动作集中在这里
 * ============================================================================
 *
 * 原型里同一件事由好几条 `document.addEventListener('click')` 分头处理
 * （勾选 / 排期 / 看板推进 / 四象限划掉 / 采纳建议 / 点天新建），
 * 每条自己去 DOM 上找目标、自己改类名。落成 React 之后如果照搬，
 * 就会出现"同一份状态被两处写"——所以这里收口成一份 `tasks` 数组 +
 * 一组具名动作，谁要改数据都走它们。
 *
 * 动作不会伪造系统里不存在的东西（项目口径）：
 *    · 勾选 / 推进 / 划掉 → 改的是这份演示数据里的 `state` 与 `completedAt`，
 *      界面上的读数（KPI、区块计数、侧栏副标题、时间轴负荷）全部跟着重算，
 *      所以点完之后页面是自洽的；
 *    · 排进去 → 真的写 `scheduledStart`（= spec §4 那张表里的"写 scheduled_start"），
 *      空档跟着变短；放不下就直接说放不下，不插到半个格子上；
 *    · 「AI 拆解」没有接模型，所以按钮点下去只会说明"没有可用通道"，
 *      而不是假装拆完了（原型那个 `alert('原型演示：AI 拆解')` 是演示后门）。
 *
 * 看板不做循环推进（spec §4-1）：原型里"已完成 → 再推一次回到待办"
 *    只是为了方便反复演示。这里最后一列换成「重新打开」这个独立动作 ——
 *    它表达的才是真事：这条任务被重新打开了。
 */

export interface NewTaskInput {
  title: string
  scope: TaskScope
  prio: TaskPrio
  /** `YYYY-MM-DD` */
  due: string
  project?: string
  note?: string
}

export interface TaskApi {
  tasks: TaskRow[]
  view: TaskViewKey
  setView: (key: TaskViewKey) => void
  /** 每个分区各自的二级筛选（`null` = 没筛） */
  filter: Partial<Record<TaskSectionKey, string | null>>
  setFilter: (section: TaskSectionKey, key: string | null) => void
  /** 详情弹窗里那条任务的 id（`null` = 没开） */
  detailId: string | null
  openDetail: (id: string) => void
  closeDetail: () => void
  /** 排期弹窗里那条任务的 id */
  scheduleId: string | null
  openSchedule: (id: string) => void
  closeSchedule: () => void
  /** 新建任务弹窗：`null` = 没开；`''` = 今天；有值 = 那一天 */
  newTaskDate: string | null
  openNewTask: (date?: string) => void
  closeNewTask: () => void
  aiOpen: boolean
  openAi: () => void
  closeAi: () => void
  /** 勾选 / 取消完成（列表行、时间轴块、详情里的主按钮都走它） */
  toggleDone: (id: string) => void
  /** 看板卡「→」：状态前进一档（最后一列不给这个动作，见文件头） */
  advance: (id: string) => void
  /** 看板最后一列「重新打开」 */
  reopen: (id: string) => void
  /** 排进去：先补齐时长，再落进最后一个够长的空档 */
  schedule: (id: string, minutes: number) => void
  /** 新建任务（弹窗里的「创建」、就地添加、点日历某一天都走它） */
  addTask: (input: NewTaskInput) => void
  /** 收件箱「整理建议」采纳态（只有界面反馈，没有写入 —— 原型的 `.btn-mini` 也就是这个） */
  adopted: string[]
  adopt: (id: string) => void
  /** 收件箱就地收集 */
  capture: (title: string) => void
}

const TaskContext = createContext<TaskApi | null>(null)

export function useTaskApi(): TaskApi {
  const api = useContext(TaskContext)
  if (!api) throw new Error('useTaskApi 必须在 <TaskProvider> 里使用')
  return api
}

/** 今天（`YYYY-MM-DD`）：新建任务与"点某天"的默认落点。 */
function todayYmd(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

export function TaskProvider({ children }: { children: ReactNode }) {
  /* ── 数据：库里那份（`task` 表），映射成这一页用的 `TaskRow` ──
     `useRawTasks(null)` = 全部归属域。派生字段（inToday / quad / dueLabel…）在
     `toTaskRow` 里由 `dueAt` + `state` + 今天算出，不进库。 */
  const raw = useRawTasks(null)
  const tasks = useMemo(() => raw.map(toTaskRow), [raw])
  const mutations = useTaskMutations()

  const [view, setView] = useState<TaskViewKey>(TASK_VIEWS[0].key)
  const [filter, setFilterState] = useState<TaskApi['filter']>({})
  const [detailId, setDetailId] = useState<string | null>(null)
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [newTaskDate, setNewTaskDate] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [adopted, setAdopted] = useState<string[]>([])

  const api = useMemo<TaskApi>(() => {
    /** 找到当前那条（动作要拿它的标题 / 原状态拼提示与入参）。 */
    const find = (id: string) => tasks.find((row) => row.id === id)

    const fail = (error: unknown) => toast(`操作失败：${errorText(error)}`)

    const toggleDone = (id: string) => {
      const row = find(id)
      if (!row) return
      const done = row.state === 'done'
      mutations.setState.mutate(
        { id, state: done ? 'todo' : 'done' },
        {
          onSuccess: () => toast(done ? `已重置「${row.title}」` : `已完成「${row.title}」`),
          onError: fail,
        },
      )
    }

    const advance = (id: string) => {
      const row = find(id)
      if (!row) return
      const chain: TaskState[] = ['todo', 'doing', 'done']
      const next = chain[Math.min(chain.indexOf(row.state) + 1, chain.length - 1)]
      mutations.setState.mutate({ id, state: next }, { onError: fail })
    }

    const reopen = (id: string) => mutations.setState.mutate({ id, state: 'todo' }, { onError: fail })

    const schedule = (id: string, minutes: number) => {
      const row = find(id)
      if (!row) return
      /* 空档先算、再写库 —— 放不下就直说，不插到半个格子上 */
      const slot = findSlot(tasks, minutes)
      if (!slot) {
        toast('今天的空档放不下了')
        setScheduleId(null)
        return
      }
      const at = rowToClock(slot.startRow)
      mutations.update.mutate(
        {
          id,
          input: {
            scope: row.scope,
            projectId: null,
            title: row.title,
            state: row.state,
            priority: row.prio,
            dueAt: row.dueAt,
            scheduledStart: at,
            estimateMin: minutes,
          },
        },
        {
          onSuccess: () => {
            toast(`已排进 ${at}`)
            setScheduleId(null)
          },
          onError: fail,
        },
      )
    }

    const addTask = (input: NewTaskInput) => {
      mutations.create.mutate(
        {
          scope: input.scope,
          projectId: null,
          title: input.title,
          state: 'todo',
          priority: input.prio,
          dueAt: `${input.due}T18:00`,
        },
        {
          onSuccess: () => {
            toast('已创建')
            setNewTaskDate(null)
          },
          onError: fail,
        },
      )
    }

    return {
      tasks,
      view,
      setView,
      filter,
      setFilter: (section, key) => setFilterState((current) => ({ ...current, [section]: key })),
      detailId,
      openDetail: setDetailId,
      closeDetail: () => setDetailId(null),
      scheduleId,
      openSchedule: setScheduleId,
      closeSchedule: () => setScheduleId(null),
      newTaskDate,
      openNewTask: (date = todayYmd()) => setNewTaskDate(date),
      closeNewTask: () => setNewTaskDate(null),
      aiOpen,
      openAi: () => setAiOpen(true),
      closeAi: () => setAiOpen(false),
      toggleDone,
      advance,
      reopen,
      schedule,
      addTask,
      adopted,
      adopt: (id) => setAdopted((current) => (current.includes(id) ? current : [...current, id])),
      /* 收件箱就地收集：落成一条"想法"（`source_kind='idea'`），没有截止日期 */
      capture: (title: string) =>
        mutations.create.mutate(
          { scope: 'learn', projectId: null, title, state: 'todo', priority: 'low', sourceKind: 'idea' },
          { onError: fail },
        ),
    }
  }, [tasks, view, filter, detailId, scheduleId, newTaskDate, aiOpen, adopted, mutations])

  return <TaskContext.Provider value={api}>{children}</TaskContext.Provider>
}

/** 池的读数（"待排 N 项"）—— 放在这里是因为页面与侧栏副标题都要它 */
export function poolCount(tasks: TaskRow[]): number {
  const groups = poolGroups(tasks)
  return groups.today.length + groups.week.length
}
