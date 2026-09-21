import type { ComponentType } from 'react'
import { PendingDetail } from '../../components/workspace/PendingDetail'
import { useModuleModals } from '../../components/workspace/use-module-modals'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { WorkspaceModal } from '../../components/workspace/WorkspaceModal'
import { useModuleTab } from '../../hooks/use-module-tab'
import { toast } from '../../stores/toast-store'
import {
  ArchivePanel,
  FavoritesPanel,
  GraphPanel,
  MODAL_SPECS,
  NotesPanel,
  OpenTopicModal,
  TABS,
  TagsPanel,
  TopbarActions,
  TopicsPanel,
  type Handlers,
  type ModalKey,
} from './knowledge/panels'

const BASE = '/knowledge'

const PANELS: Record<string, ComponentType<{ handlers: Handlers }>> = {
  notes: NotesPanel,
  topics: TopicsPanel,
  tags: TagsPanel,
  graph: GraphPanel,
  favorites: FavoritesPanel,
  archive: ArchivePanel,
}

/** 知识库工作区。`openNote` 是数据驱动的笔记详情，尚未迁移（见 PendingDetail）。 */
export function KnowledgeWorkspace() {
  const { active, select } = useModuleTab(BASE, TABS)
  const modals = useModuleModals<ModalKey>()

  const handlers: Handlers = {
    notice: (text) => toast(text),
    closeModal: modals.close,
    openTopic: (name) => modals.open('openTopic', name),
    openNote: (title) => modals.openPending(title),
  }

  const Panel = PANELS[active] ?? NotesPanel
  const spec = modals.key ? MODAL_SPECS[modals.key] : null

  return (
    <WorkspaceLayout
      module="knowledge"
      tabs={TABS}
      active={active}
      onSelectTab={select}
      topbarActions={<TopbarActions handlers={handlers} />}
    >
      <Panel handlers={handlers} />

      {modals.key === 'openTopic' && spec ? (
        <WorkspaceModal title={modals.arg} onClose={modals.close}>
          <OpenTopicModal handlers={handlers} name={modals.arg} />
        </WorkspaceModal>
      ) : null}

      {modals.pending ? (
        <WorkspaceModal title={modals.pending} onClose={modals.closePending}>
          <PendingDetail source="design/know/ knowledge_index.html 的 openNote" />
        </WorkspaceModal>
      ) : null}
    </WorkspaceLayout>
  )
}
