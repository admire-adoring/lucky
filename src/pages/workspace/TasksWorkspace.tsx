import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { useModuleTab } from '../../hooks/use-module-tab'
import {
  listRows,
  matchesSubFilter,
  poolGroups,
  SECTION_DESC,
  SUB_FILTERS,
  TASK_SECTIONS,
  TASK_VIEWS,
  timeline,
  type TaskRow,
  type TaskSectionKey,
} from '../../data/workspace/tasks'
import { SectionPanel, TABS } from './tasks/TaskSections'
import { TaskProvider, useTaskApi } from './tasks/task-state'
import { AiBreakdownModal, NewTaskModal, ScheduleModal, TaskDetailModal } from './tasks/TaskModals'

const BASE = '/tasks'

/**
 * 「任务」工作区（`design/task/task_index.html`）。
 *
 * ============================================================================
 * 这一页与原型的关系
 * ============================================================================
 *
 * 原型自带一整套外壳（顶栏九域胶囊 + 超级菜单 + 圆盘侧栏 + 槽面板 + 命令面板 +
 * 主题开关 + 折叠）。那些一条都不搬 —— 应用里它们由 `WorkspaceLayout`
 * （`ShellTopbar` / `ShellSidebar` / `RingNav` / `SlotPanel` / `CommandPalette`）
 * 承担，而且已经覆盖了八个模块。所以这一页只补原型内容区那部分：
 * 页头两行 + 四个分区面板 + 四种排列 + 四个弹窗。
 *
 * 三处主动不照搬（都属于"外壳已经有一份更好的"）：
 *
 * · 窄屏的横向分区条（`.section-bar`）。原型在 ≤900px 把侧栏整块藏掉，
 *   所以它需要一条替代入口。应用的做法是"侧栏变抽屉"（≤768px，`sidebar-wrap.is-open`），
 *   分区入口本来就还在 —— 再摆一条就是同一屏里两套分区入口。
 *   判据与换壳时那条一致："侧栏消失"与"替代入口出现"必须同一个断点。
 *
 * · 侧栏副标题的「8 项 · 待办 4」。应用侧栏那一行由 `ShellSidebar` 统一渲染，
 *   显示的是当前分区名（八个模块一致），它自己也是当初"分区搬到环上"时
 *   唯一的文字回执。改成任务的数量会让这一页与其余七页不一致。
 *
 * · 顶栏「任务」胶囊上的徽标。原型的徽标 = 未完成数，那是一个跨页面的量；
 *   而这一页的数据是页面级的演示数据（没有全局任务源）。外壳的口径是
 *   "只在有真实来源、且数量 > 0 时挂徽标"（见 `ShellTopbar` 的 `badgeOf`），
 *   所以这里不挂 —— 挂一个只有在这一页才对得上的数字更糟。
 *
 * ============================================================================
 * 页头与会话
 * ============================================================================
 *
 * 页头放在 `beforeTabs` 槽里（`WorkspaceLayout` 给"Tab 之前的正文"留的位置），
 * 于是它的位置与原型一致：在分区内容之上、`.main` 之内。
 *
 * 二级筛选激活时页头切成"三级"形态（标题 = 筛选项名、面包屑 = 任务 / 分区 可点返回），
 * 这一套文案与原型 `updateHeaders` 逐字对应。
 */
export function TasksWorkspace() {
  const { active, select } = useModuleTab(BASE, TABS)
  const section: TaskSectionKey = TASK_SECTIONS.some((item) => item.key === active)
    ? (active as TaskSectionKey)
    : 'today'

  return (
    <TaskProvider>
      <TaskShell section={section} onSelectTab={select} />
    </TaskProvider>
  )
}

/** 上面那一段与这一段的差别只有一处：这里能 `useTaskApi()`（它在 Provider 里） */
function TaskShell({
  section,
  onSelectTab,
}: {
  section: TaskSectionKey
  onSelectTab: (key: string) => void
}) {
  const api = useTaskApi()
  const sectionMeta = TASK_SECTIONS.find((item) => item.key === section) ?? TASK_SECTIONS[0]
  const filterKey = api.filter[section] ?? null
  const filterItem = (SUB_FILTERS[section] ?? []).find((item) => item.key === filterKey) ?? null
  const viewMeta = TASK_VIEWS.find((view) => view.key === api.view) ?? TASK_VIEWS[0]

  const title = filterItem ? filterItem.label : sectionMeta.label
  const subtitle = filterItem
    ? `${sectionMeta.label} 中筛出「${filterItem.label}」，共 ${countVisible(
        section,
        api.tasks,
        filterKey!,
      )} 项。`
    : section === 'all'
      ? viewMeta.desc
      : SECTION_DESC[section]

  const detailRow = api.detailId ? api.tasks.find((row) => row.id === api.detailId) : null
  const scheduleRow = api.scheduleId ? api.tasks.find((row) => row.id === api.scheduleId) : null

  return (
    <WorkspaceLayout
      module="tasks"
      tabs={TABS}
      active={section}
      onSelectTab={onSelectTab}
      beforeTabs={
        <div className="page-header">
          <div className="page-title-row">
            <h1 className="page-title">{title}</h1>
            <div className="page-actions">
              <button type="button" className="btn btn-ghost" onClick={api.openAi}>
                ✨ AI 拆解
              </button>
              <button type="button" className="btn btn-primary" onClick={() => api.openNewTask()}>
                + 新建任务
              </button>
            </div>
          </div>
          <div className="page-meta">
            <div className="page-path">
              {filterItem ? (
                <>
                  <span className="crumb">任务</span>
                  <span className="sep">/</span>
                  {/* 面包屑只给上级，末段交给大标题（同词说两遍就是重复而不是路径） */}
                  <span
                    className="crumb"
                    data-crumb-back="1"
                    onClick={() => api.setFilter(section, null)}
                  >
                    {sectionMeta.label}
                  </span>
                </>
              ) : (
                <span className="crumb current">任务</span>
              )}
            </div>
            <span className="meta-sep" aria-hidden="true">
              ·
            </span>
            <div className="page-subtitle">{subtitle}</div>
          </div>
        </div>
      }
    >
      <SectionPanel section={section} />

      {api.newTaskDate !== null ? <NewTaskModal date={api.newTaskDate} /> : null}
      {api.aiOpen ? <AiBreakdownModal /> : null}
      {detailRow ? <TaskDetailModal row={detailRow} section={section} /> : null}
      {scheduleRow ? <ScheduleModal row={scheduleRow} /> : null}
    </WorkspaceLayout>
  )
}

/**
 * 三级形态下"共 N 项"里的 N。
 *
 * 口径与 `useSubFilter` 的过滤范围一致（不是计数范围）：
 *    今日数的是"时间轴块 + 池"、全部数的是"列表的行"、收件箱数的是那 4 条。
 *    原型那句"共 N 项"用的也是同一套（`visibleCount`）。
 */
function countVisible(section: TaskSectionKey, tasks: TaskRow[], filterKey: string): number {
  const pass = (row: TaskRow) => matchesSubFilter(row, section, filterKey)
  if (section === 'today') {
    const pool = poolGroups(tasks)
    const rows = [...timeline(tasks).blocks.map((block) => block.row), ...pool.today, ...pool.week]
    return rows.filter(pass).length
  }
  if (section === 'inbox') return tasks.filter((row) => row.kind).filter(pass).length
  const { open, done } = listRows(tasks)
  return [...open, ...done].filter(pass).length
}
