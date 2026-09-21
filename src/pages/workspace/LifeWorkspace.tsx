import type { ComponentType } from 'react'
import { PendingDetail } from '../../components/workspace/PendingDetail'
import { useModuleModals } from '../../components/workspace/use-module-modals'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { WorkspaceModal } from '../../components/workspace/WorkspaceModal'
import { useModuleTab } from '../../hooks/use-module-tab'
import { toast } from '../../stores/toast-store'
import {
  CalendarPanel,
  FinancePanel,
  FitnessPanel,
  GoalsPanel,
  HabitsPanel,
  HealthPanel,
  JournalPanel,
  MODAL_SPECS,
  OpenWorkoutFormModal,
  OverviewPanel,
  PetsPanel,
  RecipesPanel,
  TABS,
  TasksPanel,
  TopbarActions,
  type Handlers,
  type ModalKey,
} from './life/panels'

const BASE = '/life'

const PANELS: Record<string, ComponentType<{ handlers: Handlers }>> = {
  overview: OverviewPanel,
  habits: HabitsPanel,
  tasks: TasksPanel,
  calendar: CalendarPanel,
  finance: FinancePanel,
  health: HealthPanel,
  fitness: FitnessPanel,
  recipes: RecipesPanel,
  pets: PetsPanel,
  journal: JournalPanel,
  goals: GoalsPanel,
}

/**
 * 生活工作区。
 *
 * `openRecipe` / `openPet` 在原型的脚本里是**数据驱动**的详情弹窗
 * （一张按名字索引的数据表 + 一段模板），尚未迁移 —— 它们落到 `PendingDetail`，
 * 而不是做成点了没反应的按钮。详见 PendingDetail 的注释。
 */
export function LifeWorkspace() {
  const { active, select } = useModuleTab(BASE, TABS)
  const modals = useModuleModals<ModalKey>()

  const handlers: Handlers = {
    notice: (text) => toast(text),
    closeModal: modals.close,
    openWorkoutForm: () => modals.open('openWorkoutForm'),
    openRecipe: (name) => modals.openPending(name),
    openPet: (name) => modals.openPending(name),
  }

  const Panel = PANELS[active] ?? OverviewPanel
  const spec = modals.key ? MODAL_SPECS[modals.key] : null

  return (
    <WorkspaceLayout
      module="life"
      tabs={TABS}
      active={active}
      onSelectTab={select}
      topbarActions={<TopbarActions handlers={handlers} />}
    >
      <Panel handlers={handlers} />

      {modals.key === 'openWorkoutForm' && spec ? (
        <WorkspaceModal title={spec.title ?? ''} onClose={modals.close}>
          <OpenWorkoutFormModal handlers={handlers} />
        </WorkspaceModal>
      ) : null}

      {modals.pending ? (
        <WorkspaceModal title={modals.pending} onClose={modals.closePending}>
          <PendingDetail source="design/life/life_index.html 的 openRecipe / openPet" />
        </WorkspaceModal>
      ) : null}
    </WorkspaceLayout>
  )
}
