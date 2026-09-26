import type { ModuleTab, WorkspaceModuleKey } from './types'
import { TABS as CALENDAR_TABS } from '../../pages/workspace/calendar/panels'
import { TABS as KNOWLEDGE_TABS } from '../../pages/workspace/knowledge/panels'
import { TABS as LEARNING_TABS } from '../../pages/workspace/learning/panels'
import { TABS as LIFE_TABS } from '../../pages/workspace/life/panels'
import { TABS as SETTINGS_TABS } from '../../pages/workspace/settings/panels'
import { TABS as TASKS_TABS } from '../../pages/workspace/tasks/panels'
import { TABS as WORK_TABS } from '../../pages/workspace/work/panels'

/**
 * 九个模块的**分区清单注册表** —— 顶栏超级菜单（`.mega`）的二级数据源。
 *
 * ============================================================================
 * 它为什么存在：超级菜单要的不是"当前模块的分区"，而是"任意模块的分区"
 * ============================================================================
 *
 * `WorkspaceLayout` 拿到的 `tabs` 只有**当前那一个模块**的，而顶栏悬停"生活"时
 * 要立刻列出生活模块的分区 —— 那份数据在任何单个页面里都拿不到，所以必须有一张
 * 全局表。九个模块的 Tab 定义各在自己的页面里（那是唯一事实源），这里只做**汇总**。
 *
 * ① **依赖方向是 `data/ → pages/`**，这是一处刻意的不对称。
 *    反过来（把九份 Tab 都抄进 data/）会得到两份事实源：`panels.tsx` 里加了分区、
 *    这里忘了跟 —— 症状是"页面上有这一格、顶栏菜单里没有"，而且两边都不报错。
 *    汇总表只有一张，漏项在编译期就会暴露（`Record<WorkspaceModuleKey, …>` 少一个 key 直接报错）。
 *
 * ② **`DASHBOARD_TABS` 从 `DashboardWorkspace.tsx` 搬到这里**，是顺手拆掉一个循环。
 *    留在页面里的话链是：`ShellTopbar → tabs.ts → DashboardWorkspace → WorkspaceLayout → ShellTopbar`。
 *    ESM 能容忍环，但环上的模块初始化顺序不确定 —— 表现为"有时菜单是空的、有时正常"，
 *    不值得赌。搬出来之后，工作台也回到"页面从 data 取 Tab"这一条正常分层上。
 *
 * ③ **`projects` 是空的，这是有意的**。它不像别处那样"还没做"，而是**没有可寻址的二级**：
 *    项目域的分区必须挂在某个项目下（`/projects/:id/:tab`，见 `ProjectDetail` 的
 *    `useProjectDetailView`），而顶栏没有"当前项目"这个上下文 —— 硬塞一份清单，
 *    每一项都会指向同一页（或者更糟：`/projects/<tab>` 被 `:id` 吃掉，
 *    落进一个"项目加载失败"）。判据与`ShellSidebar` 里那条同源：
 *    **项目域的根没有分区，所以不渲染空环** —— 这里同样不渲染空面板。
 *    注意这一域**只有详情页有顶栏**（`/projects` 列表页不走 `WorkspaceLayout`）。
 */
export const DASHBOARD_TABS: ModuleTab[] = [
  { key: 'overview', label: '今日概览' },
  { key: 'recent', label: '最近活动' },
  { key: 'briefing', label: 'AI 简报' },
]

export const SHELL_TABS: Record<WorkspaceModuleKey, ModuleTab[]> = {
  dashboard: DASHBOARD_TABS,
  tasks: TASKS_TABS,
  calendar: CALENDAR_TABS,
  life: LIFE_TABS,
  work: WORK_TABS,
  learning: LEARNING_TABS,
  /* 见文件头 ③ */
  projects: [],
  knowledge: KNOWLEDGE_TABS,
  settings: SETTINGS_TABS,
}
