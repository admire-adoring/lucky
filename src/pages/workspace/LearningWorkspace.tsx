import type { ComponentType } from 'react'
import { useModuleModals } from '../../components/workspace/use-module-modals'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { WorkspaceModal } from '../../components/workspace/WorkspaceModal'
import { useModuleTab } from '../../hooks/use-module-tab'
import { toast } from '../../stores/toast-store'
import {
  DashboardPanel,
  GoalsPanel,
  MODAL_SPECS,
  NotesPanel,
  OpenNoteModal,
  OpenOutputModal,
  OpenPracticeModal,
  OpenResourceModal,
  OpenReviewModal,
  OutputPanel,
  PracticePanel,
  ResourcesPanel,
  ReviewPanel,
  SkillsPanel,
  TABS,
  TopbarActions,
  type Handlers,
  type ModalKey,
} from './learning/panels'

const BASE = '/learning'

const PANELS: Record<string, ComponentType<{ handlers: Handlers }>> = {
  dashboard: DashboardPanel,
  goals: GoalsPanel,
  skills: SkillsPanel,
  resources: ResourcesPanel,
  notes: NotesPanel,
  review: ReviewPanel,
  practice: PracticePanel,
  output: OutputPanel,
}

/**
 * 学习模块工作区。
 *
 * 5 个弹窗全部**带参数**（点哪条资源/笔记就弹哪条），参数名在原型里各不相同
 * （`title` / `question`），所以这里逐个显式渲染 —— 用一张表统一传 `arg` 反而
 * 会把参数名抹平，丢掉的正是"复习弹的是问题、资源弹的是标题"这层语义。
 */
export function LearningWorkspace() {
  const { active, select } = useModuleTab(BASE, TABS)
  const modals = useModuleModals<ModalKey>()

  const handlers: Handlers = {
    notice: (text) => toast(text),
    closeModal: modals.close,
    openResource: (title) => modals.open('openResource', title),
    openNote: (title) => modals.open('openNote', title),
    openReview: (question) => modals.open('openReview', question),
    openPractice: (title) => modals.open('openPractice', title),
    openOutput: (title) => modals.open('openOutput', title),
  }

  const Panel = PANELS[active] ?? DashboardPanel
  const spec = modals.key ? MODAL_SPECS[modals.key] : null

  return (
    <WorkspaceLayout
      module="learning"
      tabs={TABS}
      active={active}
      onSelectTab={select}
      topbarActions={<TopbarActions handlers={handlers} />}
    >
      <Panel handlers={handlers} />

      {modals.key === 'openResource' ? (
        <WorkspaceModal title={modals.arg} onClose={modals.close}>
          <OpenResourceModal handlers={handlers} title={modals.arg} />
        </WorkspaceModal>
      ) : null}

      {modals.key === 'openNote' ? (
        <WorkspaceModal title={modals.arg} onClose={modals.close}>
          <OpenNoteModal handlers={handlers} title={modals.arg} />
        </WorkspaceModal>
      ) : null}

      {modals.key === 'openReview' && spec ? (
        <WorkspaceModal title={spec.title ?? ''} onClose={modals.close}>
          <OpenReviewModal handlers={handlers} question={modals.arg} />
        </WorkspaceModal>
      ) : null}

      {modals.key === 'openPractice' ? (
        <WorkspaceModal title={modals.arg} onClose={modals.close}>
          <OpenPracticeModal handlers={handlers} title={modals.arg} />
        </WorkspaceModal>
      ) : null}

      {modals.key === 'openOutput' ? (
        <WorkspaceModal title={modals.arg} onClose={modals.close}>
          <OpenOutputModal handlers={handlers} title={modals.arg} />
        </WorkspaceModal>
      ) : null}
    </WorkspaceLayout>
  )
}
