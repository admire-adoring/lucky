import { PROJECTS } from './projects'
import { CONTENT_PROJECTS_FINGERPRINT, WORKBENCH_AGGREGATES, WORKBENCH_MODULES } from './workbench-content'
import type { Project } from '../types'
import type { WorkbenchAggregates, WorkbenchModule } from '../types/workbench'

/**
 * 工作台的数据入口。
 *
 * 分三层，各自职责单一（这也是它不并进 `projects.ts` 的原因）：
 *   · `projects.ts`         —— 项目本身，**唯一事实源**
 *   · `workbench-content.ts` —— 由 `design/export-workbench-content.mjs` 从设计原型导出的内容树（生成物）
 *   · 本文件                 —— 把前两者接起来，并**守住它们不许漂**
 *
 * 为什么要守：生成物里的数字是从生成器那份项目投影（`gen-modules.mjs` 的 `P`）算出来的，
 * 而 `P` 又是 `src/data/projects.ts` 的手工投影。两处 → 会漂。漂了之后页面照常渲染，
 * 只是"工作台说 164 条任务、项目页说 166 条"这种数字对不上，谁也不会主动去查。
 * 所以导出时把投影压成一个指纹带过来，这里拿 `PROJECTS` 现算一遍比对。
 */

export const WORKBENCH_MODULES_LIST: WorkbenchModule[] = WORKBENCH_MODULES
export const WORKBENCH_AGG: WorkbenchAggregates = WORKBENCH_AGGREGATES

/** 工作台自身那一档（它不是"某个模块"，而是首页） */
export const WORKBENCH_HOME_KEY = 'home'

const BY_KEY = new Map(WORKBENCH_MODULES.map((m) => [m.key, m]))

/** 环上九个入口的顺序 = 生成物里的模块顺序（角度由下标推出，所以顺序变了角度也变） */
export const WORKBENCH_KEYS: string[] = WORKBENCH_MODULES.map((m) => m.key)

/**
 * 取一个模块。未知 key 回落到工作台 —— 而不是抛错或返回 undefined：
 * 这个函数的下游是路由参数，而路由参数是**用户可控**的（改地址栏 / 老书签）。
 * 回落到首页与 `api/projects.ts` 里"id 不匹配回落 p1"是同一个口径。
 */
export function getModule(key: string | undefined): WorkbenchModule {
  return BY_KEY.get(key ?? '') ?? WORKBENCH_MODULES[0]
}

export function isKnownModule(key: string | undefined): boolean {
  return BY_KEY.has(key ?? '')
}

/* ---------- 项目行按 id 取 ---------- */

const PROJECT_BY_ID = new Map(PROJECTS.map((p) => [p.id, p]))

/** 项目行的目标是"某个项目"。取不到就返回 undefined，由渲染层决定怎么降级 */
export function projectById(id: string): Project | undefined {
  return PROJECT_BY_ID.get(id)
}

/* ---------- 口径守卫 ---------- */

/**
 * 把 `Project` 投影成生成器里那份 `P` 的等价字段并压成指纹。
 *
 * ⚠️ 字段映射必须与 `design/export-workbench-content.mjs` 的 `fpFields` **逐字对应**，
 * 包括：
 *   · `risk` 取 `risk?.title`（`Project.risk` 是对象，生成器里是字符串）
 *   · `budget` 从 `'¥32,000'` 解析成数字；`'—'` 视为无预算（生成器里是 `null`）
 * 改任何一边都要同时改另一边，否则守卫会误报 —— 而误报的守卫最终会被人删掉。
 */
function fingerprintOf(projects: Project[]): string {
  const rows = projects.map((p) => {
    const budget = p.budget === '—' ? null : Number(p.budget.replace(/[^\d]/g, ''))
    return [
      p.id,
      p.scope,
      p.name,
      p.status,
      p.priority,
      p.progress,
      p.tasksDone,
      p.tasksTotal,
      p.dueShort,
      p.daysLeft,
      p.milestone,
      p.visibility,
      p.docsUrl,
      p.risk?.title ?? '',
      budget ?? '',
    ].join('|')
  })
  const s = rows.join('\n')
  let h = 5381
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0
  return h.toString(36)
}

/**
 * 守卫的落点是"导入本模块时"而不是某个组件里 —— 这样它一定会在首屏前跑，
 * 且只有一份。开发期直接抛（打断构建/热更，让人立刻看见）；
 * 生产期只报错不抛：线上白屏的代价远大于数字对不上，且此时也没人能改。
 */
const ACTUAL_FINGERPRINT = fingerprintOf(PROJECTS)
if (ACTUAL_FINGERPRINT !== CONTENT_PROJECTS_FINGERPRINT) {
  const message =
    `工作台内容层与 src/data/projects.ts 已经对不上了（指纹 ${CONTENT_PROJECTS_FINGERPRINT} → ${ACTUAL_FINGERPRINT}）。\n` +
    `改过 projects.ts 就要重跑：node design/export-workbench-content.mjs --write`
  if (import.meta.env.DEV) throw new Error(message)
  console.error(message)
}
