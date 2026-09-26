import type { IconName } from '../../types'
import { WORKBENCH_MODULES } from '../workbench-content'
import { MODULE_BASE_PATH, WORKSPACE_NAV_FLAT } from './nav'
import type { WorkspaceModuleKey } from './types'

/**
 * 应用外壳（顶栏九模块主导航 + 侧栏环形导航）的**呈现层**映射。
 *
 * ============================================================================
 * 这个文件不引入任何新的事实源，只做两件事
 * ============================================================================
 *
 * ① **模块图标**：应用的九域导航（`data/workspace/nav.ts` 的 `WORKSPACE_NAV`）
 *    只有 key / label / path，**没有**图标字段。
 *    而图标是有的 —— 工作台的九模块环（`data/workbench-content.ts` 的 `WORKBENCH_MODULES`）
 *    每个模块都带 `icon`。所以这里是**取用**，不是另写一份图标表。
 *
 *    ⚠️ 两边的 key 不同名：工作台内容层用"系列名"（`home / schedule / learn / project`），
 *       路由层用"路由名"（`dashboard / calendar / learning / projects`）。
 *       这两个名字体系本来就并存于本仓库（`design/debug/shot-app.mjs --series` 用的是前者），
 *       所以 `WORKBENCH_SERIES_KEY` 是一张**名字桥**：它只翻译 key，不改任何行为。
 *       类型写成 `Record<WorkspaceModuleKey, string>`，漏一项编译期就报。
 *
 * ② **Tab 图标**：`ModuleTab` 同样只有 key / label。
 *    原型环上每一项都带专属图标，这里**没有新增图标资产**，而是按语义就近取已有的
 *    （精灵里 53 个够覆盖这批 Tab）。这是**降级**，判据：
 *      新增 ~25 个图标符号要同时动 `IconSprite.tsx` 与 `IconName` 联合类型两处，
 *      而它们都不属于"换壳"这件事；就近取名的损失远小于维护一整套新资产。
 *    要改也很清楚 —— 下面那张表是唯一的落点。
 */

/** 路由层 key ↔ 工作台内容层（系列）key 的名字桥 */
export const WORKBENCH_SERIES_KEY: Record<WorkspaceModuleKey, string> = {
  dashboard: 'home',
  tasks: 'tasks',
  calendar: 'schedule',
  life: 'life',
  work: 'work',
  learning: 'learn',
  projects: 'project',
  knowledge: 'knowledge',
  settings: 'settings',
}

/** 系列名 → 图标。整份从工作台内容层取，所以图标只有一处事实源 */
const ICON_BY_SERIES = new Map(WORKBENCH_MODULES.map((m) => [m.key, m.icon]))

/**
 * 取模块图标。
 *
 * 回落链：名字桥命中 → 用它；没命中 → 九宫格。
 * 「没命中」是可发生的（`WORKBENCH_MODULES` 是生成物，模块增删都会变），
 * 而顶栏九项**必须照常渲染** —— 所以这里回落而不是抛错：抛错的话，
 * 一次内容层重生成会让整个外壳白屏。
 */
export function moduleIcon(key: WorkspaceModuleKey): IconName {
  return ICON_BY_SERIES.get(WORKBENCH_SERIES_KEY[key]) ?? 'i-grid'
}

/** 顶栏主导航的一项 */
export interface ShellPrimaryItem {
  key: WorkspaceModuleKey
  label: string
  /** 路由前缀。工作台是 `/` */
  path: string
  icon: IconName
}

/**
 * 顶栏的九项 —— 标签与顺序取自应用的九域导航，图标取自工作台内容层。
 *
 * 顺序沿用 `WORKSPACE_NAV`（全局层 → 领域层 → 执行层 → 沉淀层 → 支撑层），
 * 与原型顶栏那一条（工作台/任务/日程/生活/工作/学习/项目/知识库/设置）一致。
 */
export const SHELL_PRIMARY: ShellPrimaryItem[] = WORKSPACE_NAV_FLAT.map((item) => ({
  key: item.key,
  label: item.label,
  path: item.path,
  icon: moduleIcon(item.key),
}))

/* ---------- Tab → 图标（降级：就近取，见文件头 ②） ---------- */

const TAB_ICON: Record<string, IconName> = {
  /* 工作台（dashboard）的三个分区 */
  'dashboard:overview': 'i-grid',
  'dashboard:recent': 'i-trend',
  'dashboard:briefing': 'i-spark',
  /* 任务 */
  'tasks:all': 'i-list',
  'tasks:today': 'i-sun',
  'tasks:inbox': 'i-layer',
  'tasks:board': 'i-kanban',
  'tasks:matrix': 'i-grid',
  'tasks:calendar': 'i-calendar',
  'tasks:done': 'i-check',
  /* 日程 */
  'calendar:month': 'i-calendar',
  'calendar:week': 'i-calendar',
  'calendar:day': 'i-calendar',
  'calendar:agenda': 'i-list',
  'calendar:subscribe': 'i-link',
  'calendar:settings': 'i-settings',
  /* 生活 */
  'life:overview': 'i-grid',
  'life:habits': 'i-check',
  'life:tasks': 'i-list',
  'life:calendar': 'i-calendar',
  'life:finance': 'i-trend',
  'life:health': 'i-life',
  'life:fitness': 'i-trend',
  'life:recipes': 'i-grid',
  'life:pets': 'i-life',
  'life:journal': 'i-edit',
  'life:goals': 'i-flag',
  /* 工作 —— 2026-09-25 分区 12 → 7（对照表在 `pages/workspace/work/panels.tsx` 文件头）。
     ⚠️ 撤掉的 5 个 key（deploy / calendar / clients / okr / timesheet）在这里**一并删掉**，
        不留：它们已经不可能被查到（环上只有 7 项），留着不是"保险"，
        而是让下一个读这张表的人以为工作模块还有 12 个分区。
     合并后语义有变的两个：
       · servers  —— 除了服务器清单，还装了部署记录 / 部署文档，图标仍是 `i-layers`（多层机器）
       · contacts —— 客户资料 + 联系人，`i-users` 同时罩得住两边
     其余五项（dashboard/tasks/projects/docs/review）图标沿用，一个都没换。 */
  'work:dashboard': 'i-grid',
  'work:tasks': 'i-list',
  'work:projects': 'i-project',
  'work:servers': 'i-layers',
  'work:docs': 'i-file',
  'work:contacts': 'i-users',
  'work:review': 'i-edit',
  /* 学习 */
  'learning:dashboard': 'i-grid',
  'learning:goals': 'i-flag',
  'learning:skills': 'i-grid',
  'learning:resources': 'i-file',
  'learning:notes': 'i-edit',
  'learning:review': 'i-trend',
  'learning:practice': 'i-project',
  'learning:output': 'i-share',
  /* 知识库 */
  'knowledge:notes': 'i-file',
  'knowledge:topics': 'i-grid',
  'knowledge:tags': 'i-more',
  'knowledge:graph': 'i-link',
  'knowledge:favorites': 'i-check',
  'knowledge:archive': 'i-layers',
  /* 设置 */
  'settings:account': 'i-user',
  'settings:modules': 'i-grid',
  'settings:appearance': 'i-sun',
  'settings:notifications': 'i-bell',
  'settings:data': 'i-layers',
  'settings:integrations': 'i-link',
  'settings:ai': 'i-spark',
  'settings:privacy': 'i-lock',
  'settings:shortcuts': 'i-grid',
  'settings:about': 'i-file',
}

/**
 * 取某个模块下某个 Tab 的图标。
 *
 * 回落链：表里有 → 用它；没有 → **模块图标**。
 * 回落不是"兜底一下免得报错"：`ModuleTab.key` 由各模块自己定
 * （`panels.tsx` 是生成物，加一个 Tab 就多一个 key），而这张表是手写的 ——
 * 两者不同步时页面**必须照常渲染**，只是那一个 Tab 的图标退成模块图标。
 * 所以这里不做"未登记就抛错"：那会让一次内容层重生成把整页打挂。
 */
export function tabIcon(module: WorkspaceModuleKey, tabKey: string): IconName {
  return TAB_ICON[`${module}:${tabKey}`] ?? moduleIcon(module)
}

/**
 * Tab 的地址。
 *
 * 第一个 Tab 用**裸路径**（`/life` 而不是 `/life/overview`）——
 * 这是 `useModuleTab` 定的约定，环上路由必须与它一致，否则"从环上点第一个 Tab"
 * 会推出一条 `select()` 永远算不到的地址（表现为：地址变了、高亮还停在别处）。
 */
export function tabPath(module: WorkspaceModuleKey, tabKey: string, isFirst: boolean): string {
  const base = MODULE_BASE_PATH[module]
  if (isFirst) return base
  return base === '/' ? `/${tabKey}` : `${base}/${tabKey}`
}
