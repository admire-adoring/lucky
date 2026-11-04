import { WORKBENCH_MODULES } from './workbench-content'
import type { WorkbenchModule } from '../types/workbench'

/**
 * 工作台的数据入口。
 *
 * 只保留模块配置（`WORKBENCH_MODULES`）—— 那是 UI 结构配置（每个模块的标题/磁贴/对话），
 * 不是用户数据。聚合数与项目行由组件从 `useProjects()` 现算。
 */

export const WORKBENCH_MODULES_LIST: WorkbenchModule[] = WORKBENCH_MODULES

/** 工作台自身那一档（它不是"某个模块"，而是首页） */
export const WORKBENCH_HOME_KEY = 'home'

const BY_KEY = new Map(WORKBENCH_MODULES.map((m) => [m.key, m]))

/** 环上九个入口的顺序 = 模块顺序 */
export const WORKBENCH_KEYS: string[] = WORKBENCH_MODULES.map((m) => m.key)

/** 取一个模块。未知 key 回落到工作台 */
export function getModule(key: string | undefined): WorkbenchModule {
  return BY_KEY.get(key ?? '') ?? WORKBENCH_MODULES[0]
}

export function isKnownModule(key: string | undefined): boolean {
  return BY_KEY.has(key ?? '')
}
