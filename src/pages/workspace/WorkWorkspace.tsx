import type { ComponentType } from 'react'
import { PendingDetail } from '../../components/workspace/PendingDetail'
import { useModuleModals } from '../../components/workspace/use-module-modals'
import { ClientsContacts } from '../../components/workspace/work/ClientsContacts'
import { ProjectDrawers, ProjectTopbarActions } from '../../components/workspace/work/ProjectDrawers'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { WorkspaceModal } from '../../components/workspace/WorkspaceModal'
import { useModuleTab } from '../../hooks/use-module-tab'
import { toast } from '../../stores/toast-store'
import {
  DashboardPanel,
  DocsPanel,
  ReviewPanel,
  ServersPanel,
  TABS,
  TasksPanel,
  TopbarActions,
  type Handlers,
} from './work/panels'

const BASE = '/work'

/**
 * 分区 → 面板。**七个分区，一一对应 `TABS` 的七项**（键必须同名，否则那一项
 * 会静默落到 `DashboardPanel` 兜底 —— 见下面那行 `??`）。
 *
 * ⚠️ `projects` 与 `contacts` 用的是**手写组件**，不在 `./work/panels` 里 ——
 *    抽屉按数据渲染、客户要一个角色筛选（状态），静态标记两样都表达不了。
 *    理由与取舍分别写在两份组件的文件头。
 *
 * ⚠️ 这里**只剩 7 个键是正常的**，不是漏迁：2026-09-25 把 12 个分区收敛成 7 个，
 *    `deploy` / `calendar` / `clients` / `okr` / `timesheet` 的**内容**都被
 *    并进了下面某一项，逐条对照表在 `./work/panels` 的文件头。
 */
const PANELS: Record<string, ComponentType<{ handlers: Handlers }>> = {
  dashboard: DashboardPanel,
  tasks: TasksPanel,
  projects: ProjectDrawers,
  servers: ServersPanel,
  docs: DocsPanel,
  contacts: ClientsContacts,
  review: ReviewPanel,
}

/** 工作模块工作区。`openClient` 是数据驱动的客户详情，尚未迁移（见 PendingDetail）。 */
export function WorkWorkspace() {
  const { active, select } = useModuleTab(BASE, TABS)
  const modals = useModuleModals<never>()

  const handlers: Handlers = {
    notice: (text) => toast(text),
    openClient: (name) => modals.openPending(name),
  }

  const Panel = PANELS[active] ?? DashboardPanel

  /**
   * 顶栏动作**按分区换**。
   *
   * ⚠️ 为什么这里要分叉：`topbarActions` 是**整模块**一个槽（由 `WorkspaceLayout`
   *    渲染在顶栏右侧），而"项目"这一页的动作和别人不一样 —— 它的原型
   *    （`design/work/work_project_v2.html`）把「排序 / 新建项目」放在 `.topbar-actions` 里，
   *    而不是页头。其余分区沿用 `panels.tsx` 那份「+ 快速记录」。
   *    分叉留在**这一处**，好过让每个面板自己去挂顶栏。
   */
  const topbarActions =
    active === 'projects' ? <ProjectTopbarActions handlers={handlers} /> : <TopbarActions handlers={handlers} />

  return (
    <WorkspaceLayout
      module="work"
      tabs={TABS}
      active={active}
      onSelectTab={select}
      topbarActions={topbarActions}
    >
      <Panel handlers={handlers} />

      {modals.pending ? (
        <WorkspaceModal title={modals.pending} onClose={modals.closePending}>
          <PendingDetail source="design/work/work_index.html 的 openClient" />
        </WorkspaceModal>
      ) : null}
    </WorkspaceLayout>
  )
}
