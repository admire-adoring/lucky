import type { ComponentType } from 'react'
import { PendingDetail } from '../../components/workspace/PendingDetail'
import { useModuleModals } from '../../components/workspace/use-module-modals'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { WorkspaceModal } from '../../components/workspace/WorkspaceModal'
import { useModuleTab } from '../../hooks/use-module-tab'
import { toast } from '../../stores/toast-store'
import {
  CalendarPanel,
  ClientsPanel,
  ContactsPanel,
  DashboardPanel,
  DeployPanel,
  DocsPanel,
  OkrPanel,
  ProjectsPanel,
  ReviewPanel,
  ServersPanel,
  TABS,
  TasksPanel,
  TimesheetPanel,
  TopbarActions,
  type Handlers,
} from './work/panels'

const BASE = '/work'

const PANELS: Record<string, ComponentType<{ handlers: Handlers }>> = {
  dashboard: DashboardPanel,
  tasks: TasksPanel,
  projects: ProjectsPanel,
  servers: ServersPanel,
  deploy: DeployPanel,
  calendar: CalendarPanel,
  docs: DocsPanel,
  contacts: ContactsPanel,
  clients: ClientsPanel,
  okr: OkrPanel,
  timesheet: TimesheetPanel,
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

  return (
    <WorkspaceLayout
      module="work"
      tabs={TABS}
      active={active}
      onSelectTab={select}
      topbarActions={<TopbarActions handlers={handlers} />}
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
