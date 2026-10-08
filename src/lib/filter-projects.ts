import { isClosed } from '../data/derive'
import { PRIORITY_META } from '../data/meta'
import type { Project, ProjectStatus, ScopeFilter, SortMode } from '../types'

/**
 * 项目列表的筛选 / 排序 / 计数 —— 与原型 `project_index.html` 的
 * `projHit` / `facetSet` / `visibleProjects` / `watchItems` 逐条对应。
 *
 * 为什么在这里而不是在页面里：侧栏「概览」槽要算同一批数。
 *    原型的 `listSlotRows()` / `watchItems()` 都读 `visibleProjects()`，
 *    也就是"筛完剩下哪些" —— 抄一份到槽里，两处口径迟早会漂移
 *    （那正是原型注释里反复在防的事："同一屏出现两组打架的数字"）。
 *    所以凡是"从 8 个项目推出来的数"，都只在这里算一遍。
 */

export interface ProjectFilter {
  /**
   * 状态筛选。`''` = 本组不筛。
   *
   * 与 `scope` 的"不筛"取值不同源（那边是 `'all'`）—— 这不是笔误，是原型的样子：
   *    状态组的「全部」没有对应的 `ProjectStatus`，类型组的 `Scope` 里也没有"全部"。
   *    所以状态用空串（`STATUS_FACETS` 里就是那个 key），类型用 `'all'`。
   */
  status?: '' | ProjectStatus
  scope: ScopeFilter
  query: string
  sort: SortMode
}

/**
 * 状态筛选的匹配规则 —— 与 chip 的标签分开写。
 *
 * 三处都不是"相等"，所以不能直接在 `projectHit` 里写 `p.status === filter.status`：
 *   · `''`（全部）不含已归档 —— 归档就是从台面上收走，它自己有一项；
 *     否则"全部"报 8 而列表只画 7 条，chip 上的数就撒谎了；
 *   · `active`（进行中）把"规划中"也算进来 —— 规划中的项目还没开工，
 *     但它是"在推进的"；
 *   · 其余三组才是相等。
 *   混进一张"标签表"里时，`planning` 这种没有自己 chip 的状态会被静默漏掉 ——
 *   症状是"全部 8 条，几个 chip 加起来的计数只有 7"（数字不会自己报错）。
 *
 * 表里给全部五个状态都留了位（含 `planning`），所以 `Record` 是完备的、
 * 拿任何一个 key 查都不会取到 undefined。
 */
export const STATUS_MATCH: Record<'' | ProjectStatus, (project: Project) => boolean> = {
  '': (project) => project.status !== 'archived',
  planning: (project) => project.status === 'planning',
  active: (project) => project.status === 'active' || project.status === 'planning',
  risk: (project) => project.status === 'risk',
  done: (project) => project.status === 'done',
  archived: (project) => project.status === 'archived',
}

/**
 * 关键词里可以带 `#标签`（可以多个，取与），剩下的部分才当普通词去搜字段。
 *
 * 为什么做成搜索语法而不是再加一组筛选 chip：标签有十几个，做成一排 chip 会把
 *    筛选卡撑成三行（"类型"那一组已经占满一行了），而语法不占控件位。
 *    代价是它成了隐形条件 —— 所以空态里必须把"正在按 #xx 筛标签"说出来（见页面）。
 *
 * 标签用前缀匹配：`#客` 能筛出「客户A」。
 */
export interface ParsedQuery {
  tags: string[]
  keyword: string
}

export function parseQuery(raw: string): ParsedQuery {
  const tags: string[] = []
  const rest = raw
    .replace(/#([^\s#]+)/g, (_match, tag: string) => {
      tags.push(tag.toLowerCase())
      return ' '
    })
    .trim()

  return { tags, keyword: rest.toLowerCase() }
}

/** 一个项目是否命中当前筛选 —— 原型 `projHit(p, skip)`。
 *
 * `skip` 会摘掉某一组自己的选择，只给 facet 计数用（见下）。
 * 也能省略（工作模块的抽屉列表就不带状态筛选）。
 */
export function projectHit(project: Project, filter: ProjectFilter, skip?: 'status' | 'scope'): boolean {
  if (skip !== 'status' && !STATUS_MATCH[filter.status ?? ''](project)) return false
  if (skip !== 'scope' && filter.scope !== 'all' && project.scope !== filter.scope) return false

  const { tags, keyword } = parseQuery(filter.query)

  if (tags.length) {
    const own = project.tags.map((tag) => tag.toLowerCase())
    if (!tags.every((tag) => own.some((value) => value.startsWith(tag)))) return false
  }

  if (!keyword) return true

  /* 五个可搜字段 —— 与搜索框 placeholder 里列的词一一对应（`path` 是"能认出来但记不住"
     的那种值，正是最需要能搜的一种） */
  const haystack = [
    project.name,
    project.description,
    project.tags.join(' '),
    project.milestone,
    project.path ?? '',
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(keyword)
}

/** 列表真正显示的项目 = 状态 × 类型 × 关键词，再排序（原型 `visibleProjects()`） */
export function filterProjects(projects: Project[], filter: ProjectFilter): Project[] {
  const list = projects.filter((project) => projectHit(project, filter))

  switch (filter.sort) {
    case 'due':
      return list.sort((a, b) => a.daysLeft - b.daysLeft)
    case 'progress':
      return list.sort((a, b) => b.progress - a.progress)
    case 'priority':
      return list.sort((a, b) => PRIORITY_META[b.priority].rank - PRIORITY_META[a.priority].rank)
    default:
      return list
  }
}

/**
 * 某一项 chip 筛完会剩下几条（原型 `facetSet(group, k).length`）—— 也就是 chip 上那个计数。
 *
 * 计数的口径：应用另一组与关键词，但不应用本组自己的选择。
 *    否则数字会撒谎 —— 类型选了「学习」之后，状态那组的「进行中」还写 3，
 *    点下去却只剩 1 条。这也是它不能复用"域级读数"的原因：那一份与筛选无关。
 *    不会形成循环依赖：算状态组时只看类型组，反之亦然。
 */
export function facetCount(
  projects: Project[],
  filter: ProjectFilter,
  group: 'status' | 'scope',
  key: string,
): number {
  return projects.filter((project) => {
    if (!projectHit(project, filter, group)) return false
    return group === 'status'
      ? STATUS_MATCH[key as '' | ProjectStatus](project)
      : key === 'all' || project.scope === key
  }).length
}

/**
 * 要看紧的 = 当前这一批里最该先看的 3 个（原型 `watchItems()`）。
 *
 * 判据（原样搬，不靠手感）：
 *   ① 池 = 当前筛选后的未收口项目（已完成 / 已归档都不需要看，判据见 `isClosed`）；
 *   ② 先按紧急度分档：风险阻塞 0 < 已逾期 1 < 其他 2；
 *   ③ 同档内按剩余天数升序；
 *   ④ 取前 3 —— 侧栏是"扫一眼"的地方，列 8 条就退化成第二份列表。
 *
 * 与主区的排序（默认 / 截止 / 进度 / 优先级）互不影响 —— 这是另一条独立的挑选规则。
 */
export function watchProjects(projects: Project[], filter: ProjectFilter, limit = 3): Project[] {
  const rank = (project: Project) => (project.status === 'risk' ? 0 : project.daysLeft < 0 ? 1 : 2)

  return filterProjects(projects, filter)
    .filter((project) => !isClosed(project))
    .sort((a, b) => rank(a) - rank(b) || a.daysLeft - b.daysLeft)
    .slice(0, limit)
}

/** 平均进度（四舍五入到整数）。空集合给 0 —— 调用方自己决定要不要显示它 */
export function averageProgress(projects: Project[]): number {
  if (!projects.length) return 0
  return Math.round(projects.reduce((sum, project) => sum + project.progress, 0) / projects.length)
}

/**
 * 多值字段的候选池 —— 标签 / 负责人共用一套（从各项目实际用过的值派生）。
 *
 * 不另存一份"标签清单 / 成员名单"配置：存了它迟早和实际用着的走岔
 *    （界面上列着一个没人用过的标签，或者新建时选不到自己刚打的那个）。
 * 排序按用过几次降序（同频按名字）：常用的排前面，比按字母排更接近"人找的那个"。
 */
function poolOf(projects: Project[], pick: (project: Project) => string[]): string[] {
  const count = new Map<string, number>()
  projects.forEach((project) =>
    pick(project).forEach((value) => count.set(value, (count.get(value) ?? 0) + 1)),
  )
  return [...count.keys()].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0) || a.localeCompare(b, 'zh'))
}

export function tagPool(projects: Project[]): string[] {
  return poolOf(projects, (project) => project.tags)
}

export function ownerPool(projects: Project[]): string[] {
  return poolOf(projects, (project) => project.owners)
}
