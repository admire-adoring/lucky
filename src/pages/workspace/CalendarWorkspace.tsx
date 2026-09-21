import type { ComponentType } from 'react'
import { useModuleModals } from '../../components/workspace/use-module-modals'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { WorkspaceModal } from '../../components/workspace/WorkspaceModal'
import { useModuleTab } from '../../hooks/use-module-tab'
import { toast } from '../../stores/toast-store'
import {
  AgendaPanel,
  AiAddModal,
  DayPanel,
  MODAL_SPECS,
  MonthPanel,
  NewEventBtnModal,
  OpenEventModal,
  SettingsPanel,
  SubscribePanel,
  TABS,
  TopbarActions,
  WeekPanel,
  type Handlers,
  type ModalKey,
} from './calendar/panels'

const BASE = '/calendar'

const PANELS: Record<string, ComponentType<{ handlers: Handlers }>> = {
  month: MonthPanel,
  week: WeekPanel,
  day: DayPanel,
  agenda: AgendaPanel,
  subscribe: SubscribePanel,
  settings: SettingsPanel,
}

/**
 * 日程（原型目录名是 `candle` —— 烛，指"计时"那层意象；代码里统一用路由口径 `calendar`）。
 *
 * `openEvent(title)` 是**带参数**的弹窗：点哪一条日程，弹的就是那一条。
 * 参数存在 `useModuleModals` 里与弹窗 key 同一个状态，避免"参数换了但弹窗没换"。
 */
export function CalendarWorkspace() {
  const { active, select } = useModuleTab(BASE, TABS)
  const modals = useModuleModals<ModalKey>()

  const handlers: Handlers = {
    notice: (text) => toast(text),
    closeModal: modals.close,
    aiAddOpen: () => modals.open('aiAdd'),
    newEventBtnOpen: () => modals.open('newEventBtn'),
    openEvent: (title) => modals.open('openEvent', title),
  }

  const Panel = PANELS[active] ?? MonthPanel
  const spec = modals.key ? MODAL_SPECS[modals.key] : null

  return (
    <WorkspaceLayout
      module="calendar"
      tabs={TABS}
      active={active}
      onSelectTab={select}
      topbarActions={<TopbarActions handlers={handlers} />}
    >
      <Panel handlers={handlers} />

      {modals.key === 'newEventBtn' && spec ? (
        <WorkspaceModal title={spec.title ?? ''} onClose={modals.close}>
          <NewEventBtnModal handlers={handlers} />
        </WorkspaceModal>
      ) : null}

      {modals.key === 'aiAdd' && spec ? (
        <WorkspaceModal title={spec.title ?? ''} onClose={modals.close}>
          <AiAddModal handlers={handlers} />
        </WorkspaceModal>
      ) : null}

      {modals.key === 'openEvent' ? (
        <WorkspaceModal title={modals.arg} onClose={modals.close}>
          <OpenEventModal handlers={handlers} title={modals.arg} />
        </WorkspaceModal>
      ) : null}
    </WorkspaceLayout>
  )
}
