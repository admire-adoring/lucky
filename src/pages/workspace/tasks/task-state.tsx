import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import {
  DEMO_NOW,
  DEMO_TODAY,
  findSlot,
  initialTasks,
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

/** 下一个可用的 id：演示数据不落库，序号够用（真实现当然由数据库给） */
function nextId(tasks: TaskRow[]): string {
  let index = tasks.length + 1
  while (tasks.some((row) => row.id === `n-${index}`)) index += 1
  return `n-${index}`
}

export function TaskProvider({ children }: { children: ReactNode }) {
  const [tasks, setTasks] = useState<TaskRow[]>(() => initialTasks())
  const [view, setView] = useState<TaskViewKey>(TASK_VIEWS[0].key)
  const [filter, setFilterState] = useState<TaskApi['filter']>({})
  const [detailId, setDetailId] = useState<string | null>(null)
  const [scheduleId, setScheduleId] = useState<string | null>(null)
  const [newTaskDate, setNewTaskDate] = useState<string | null>(null)
  const [aiOpen, setAiOpen] = useState(false)
  const [adopted, setAdopted] = useState<string[]>([])

  const api = useMemo<TaskApi>(() => {
    /** 改一条任务。`patch` 拿到的是当前那条，返回新的字段。 */
    const patch = (id: string, update: Partial<TaskRow> | ((row: TaskRow) => Partial<TaskRow>)) =>
      setTasks((current) =>
        current.map((row) =>
          row.id === id ? { ...row, ...(typeof update === 'function' ? update(row) : update) } : row,
        ),
      )

    const toggleDone = (id: string) => {
      patch(id, (row) => {
        if (row.state === 'done') {
          /* 取消完成要回到原状态（原型把它记在 `data-prev-state` 上）——
             一条"进行中"的任务被勾掉再取消，不该变成"待办"。 */
          return { state: row.prevState ?? 'todo', completedAt: undefined, prevState: undefined }
        }
        return { prevState: row.state, state: 'done', completedAt: DEMO_NOW }
      })
    }

    const advance = (id: string) => {
      const chain: TaskState[] = ['todo', 'doing', 'done']
      patch(id, (row) => {
        const next = chain[Math.min(chain.indexOf(row.state) + 1, chain.length - 1)]
        return {
          state: next,
          completedAt: next === 'done' ? DEMO_NOW : undefined,
          prevState: next === 'done' ? row.state : undefined,
        }
      })
    }

    const reopen = (id: string) => patch(id, { state: 'todo', completedAt: undefined, prevState: undefined })

    const schedule = (id: string, minutes: number) => {
      /* 先算空档、再改数据、最后弹提示 —— 副作用不能写进 `setTasks` 的 updater
         （React 在 StrictMode 下会把 updater 调两次，就会看到两条一样的 toast）。 */
      const slot = findSlot(tasks, minutes)
      if (!slot) {
        toast('今天的空档放不下了')
        setScheduleId(null)
        return
      }
      const at = rowToClock(slot.startRow)
      setTasks((current) =>
        current.map((item) =>
          item.id === id ? { ...item, estMin: minutes, scheduledStart: at } : item,
        ),
      )
      setScheduleId(null)
      toast(`已排进 ${at}`)
    }

    const addTask = (input: NewTaskInput) => {
      setTasks((current) => [
        ...current,
        {
          id: nextId(current),
          title: input.title,
          scope: input.scope,
          prio: input.prio,
          state: 'todo',
          /* 新建的项按截止日进"今天"：due 是今天就算今天的事 */
          inToday: input.due === DEMO_TODAY,
          overdueDays: 0,
          estMin: undefined,
          dueAt: `${input.due}T18:00`,
          project: input.project,
          createdAt: DEMO_TODAY,
          updatedAt: DEMO_TODAY,
          dueLabel: input.due === DEMO_TODAY ? '今天' : input.due.slice(5).replace('-', '/'),
        },
      ])
      toast('已创建')
      setNewTaskDate(null)
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
      openNewTask: (date = DEMO_TODAY) => setNewTaskDate(date),
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
      capture: (title) =>
        setTasks((current) => [
          ...current,
          {
            id: nextId(current),
            title,
            scope: 'learn',
            prio: 'low',
            state: 'todo',
            kind: 'idea',
            inToday: false,
            overdueDays: 0,
            dueAt: '2026-09-27T18:00',
            inboxAt: DEMO_NOW,
            createdAt: DEMO_TODAY,
            updatedAt: DEMO_TODAY,
            dueLabel: '今天',
          },
        ]),
    }
  }, [tasks, view, filter, detailId, scheduleId, newTaskDate, aiOpen, adopted])

  return <TaskContext.Provider value={api}>{children}</TaskContext.Provider>
}

/** 池的读数（"待排 N 项"）—— 放在这里是因为页面与侧栏副标题都要它 */
export function poolCount(tasks: TaskRow[]): number {
  const groups = poolGroups(tasks)
  return groups.today.length + groups.week.length
}
