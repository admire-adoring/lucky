import type { ComponentType } from 'react'
import { useModuleModals } from '../../components/workspace/use-module-modals'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { WorkspaceModal } from '../../components/workspace/WorkspaceModal'
import { useModuleTab } from '../../hooks/use-module-tab'
import { toast } from '../../stores/toast-store'
import {
  AiAddModal,
  AllPanel,
  BoardPanel,
  CalendarPanel,
  DonePanel,
  InboxPanel,
  MatrixPanel,
  MODAL_SPECS,
  NewTaskBtnModal,
  TABS,
  TodayPanel,
  TopbarActions,
  type Handlers,
  type ModalKey,
} from './tasks/panels'

const BASE = '/tasks'

const PANELS: Record<string, ComponentType<{ handlers: Handlers }>> = {
  all: AllPanel,
  today: TodayPanel,
  inbox: InboxPanel,
  board: BoardPanel,
  matrix: MatrixPanel,
  calendar: CalendarPanel,
  done: DonePanel,
}

/** 弹窗 key → 渲染体。标题来自生成物（原型的 `openModal('…')` 第一参数），不手抄。 */
const MODAL_BODIES: Partial<Record<ModalKey, ComponentType<{ handlers: Handlers }>>> = {
  newTaskBtn: NewTaskBtnModal,
  aiAdd: AiAddModal,
}

/** 任务清单工作区。Tab、面板与弹窗标记见 `./tasks/panels.tsx`（生成物）。 */
export function TasksWorkspace() {
  const { active, select } = useModuleTab(BASE, TABS)
  const modals = useModuleModals<ModalKey>()

  /**
   * 面板要的回调。原型的 `alert('原型演示：…')` 统一接到应用的 toast ——
   * 浏览器的 alert 会阻塞渲染线程，也会把桌面壳的原生观感一起破坏掉。
   */
  const handlers: Handlers = {
    notice: (text) => toast(text),
    closeModal: modals.close,
    aiAddOpen: () => modals.open('aiAdd'),
    newTaskBtnOpen: () => modals.open('newTaskBtn'),
  }

  const Panel = PANELS[active] ?? AllPanel
  const spec = modals.key ? MODAL_SPECS[modals.key] : null
  const Body = modals.key ? MODAL_BODIES[modals.key] : undefined

  return (
    <WorkspaceLayout
      module="tasks"
      tabs={TABS}
      active={active}
      onSelectTab={select}
      topbarActions={<TopbarActions handlers={handlers} />}
    >
      <Panel handlers={handlers} />

      {modals.key && spec && Body ? (
        <WorkspaceModal title={spec.title ?? ''} onClose={modals.close}>
          <Body handlers={handlers} />
        </WorkspaceModal>
      ) : null}
    </WorkspaceLayout>
  )
}
