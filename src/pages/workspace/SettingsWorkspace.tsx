import type { ComponentType } from 'react'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { useModuleTab } from '../../hooks/use-module-tab'
import { toast } from '../../stores/toast-store'
import {
  AboutPanel,
  AccountPanel,
  AiPanel,
  AppearancePanel,
  DataPanel,
  IntegrationsPanel,
  ModulesPanel,
  NotificationsPanel,
  PrivacyPanel,
  ShortcutsPanel,
  TABS,
  TopbarActions,
  type Handlers,
} from './settings/panels'

const BASE = '/settings'

const PANELS: Record<string, ComponentType<{ handlers: Handlers }>> = {
  account: AccountPanel,
  modules: ModulesPanel,
  appearance: AppearancePanel,
  notifications: NotificationsPanel,
  data: DataPanel,
  integrations: IntegrationsPanel,
  ai: AiPanel,
  privacy: PrivacyPanel,
  shortcuts: ShortcutsPanel,
  about: AboutPanel,
}

/**
 * 设置工作区。
 *
 * 没有弹窗也没有顶栏动作 —— 原型的 `.topbar-actions` 里只有主题开关，
 * 而主题开关归外壳（全站只能有一个）。开关与主题色板都是受控组件，
 * 在生成物里已经换成 `<Switch>` / `<ThemeSwatches>`，不需要这里的 handler。
 */
export function SettingsWorkspace() {
  const { active, select } = useModuleTab(BASE, TABS)

  const handlers: Handlers = {
    notice: (text) => toast(text),
  }

  const Panel = PANELS[active] ?? AccountPanel

  return (
    <WorkspaceLayout
      module="settings"
      tabs={TABS}
      active={active}
      onSelectTab={select}
      topbarActions={<TopbarActions handlers={handlers} />}
    >
      <Panel handlers={handlers} />
    </WorkspaceLayout>
  )
}
