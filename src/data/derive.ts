import {
  ACTIVITY_TIMES,
  BUG_VERSIONS,
  DEPLOY_TIMES,
  DOC_KIND_LABEL,
  DOC_SOURCES,
  LOG_LINES,
  LOG_SOURCES,
  LOG_GROUP_OF_KIND,
  POOL,
  type AccountSeed,
  type DocLinkSeed,
  type FsSeed,
  type InfoField,
  type LogGroupKey,
  type LogKind,
  type LogSourceSeed,
  type PathSeed,
  type ReclaimSeed,
} from './content-pool'
import type {
  ActivityItem,
  DocLink,
  DocumentItem,
  Milestone,
  MilestoneState,
  Project,
  Task,
  TaskStatus,
} from '../types'
import { PRIORITY_META } from './meta'

/** 稳定哈希（与原型一致，用于从内容池确定性取值） */
export function hash(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0
  }
  return h
}

/** 从内容池按种子稳定取 count 项（池子不够时循环复用） */
function pick<T>(pool: readonly T[], seed: string, count: number): T[] {
  const h = hash(seed)
  const out: T[] = []
  for (let i = 0; i < count; i += 1) {
    out.push(pool[(h + i * 3) % pool.length] as T)
  }
  return out
}

/* ============================================================
   头像
   ------------------------------------------------------------
   列表页按「索引」着色（原型 projects.html 的 owners()），
   详情页按「名字哈希」着色（原型 project-detail.html 的 avatar()）。
   两者取色逻辑不同，为保持视觉一致这里都按原型原样复刻。
   ============================================================ */

const LIST_OWNER_HUES = [265, 215, 158]
const DETAIL_AVATAR_HUES = [265, 215, 158, 25, 340]

/* 两个头像底色函数原来是 `linear-gradient(135deg, hsl(h,72%,64%), hsl(h-30,68%,52%))`，
   2026-09-25 纯色化时改成单色：取两个端点的中点（色相也取中点）——
   即 `hsl(h-15, 70%, 58%)`。
   为什么取中点而不是"取能承白字的那一端"：这一支的判据不是对比度，是观感连续性。
   头像里是白字首字母，白字在这套色上的实测对比度本来就在 3.1~4.5:1 之间
   （取决于色相 —— 绿系最差），与全站已经存在的域色头像（`bg-life` #0f9d76 压白字 3.1:1）
   同一水平。这是本轮之前就有的状态，纯色化不改它：
   要修就得把 5 个色相一起往深色调，那是"改配色"而不是"去渐变"，属于另一件事。
   ⇒ 取中点 = 让这次改动只换材质、不动明度，是对比度不被牵连的唯一取法。 */

/** 列表卡片 / 表格 / 看板里的负责人头像底色 */
export function ownerAvatarStyle(index: number): string {
  const hue = LIST_OWNER_HUES[index % LIST_OWNER_HUES.length] as number
  return `hsl(${hue - 15}, 70%, 58%)`
}

/** 详情页里的头像底色 */
export function memberAvatarStyle(name: string): string {
  const hue = DETAIL_AVATAR_HUES[hash(name) % DETAIL_AVATAR_HUES.length] as number
  return `hsl(${hue - 15}, 70%, 58%)`
}

const OWNER_NAMES: Record<string, string> = { LY: '刘阳' }

export function ownerDisplayName(code: string): string {
  return OWNER_NAMES[code] ?? code
}

/* ============================================================
   派生数据
   ============================================================ */

/** 任务：前 done 个已完成，随后 1-2 个进行中/阻塞，其余待办；未完成排在前面 */
export function buildTasks(project: Project): Task[] {
  const names = pick(POOL[project.scope].tasks, `${project.id}task`, project.tasksTotal)
  const list: Task[] = []

  for (let i = 0; i < project.tasksTotal; i += 1) {
    const status: TaskStatus =
      i < project.tasksDone
        ? 'done'
        : i < project.tasksDone + 2
          ? project.status === 'risk'
            ? 'blocked'
            : 'doing'
          : 'todo'

    const due =
      project.status === 'done'
        ? '已完成'
        : i % 5 === 0 && project.status === 'risk'
          ? '已逾期 2 天'
          : `${(i % 4) + 1} 天后`

    list.push({
      id: `${project.id}-t${i + 1}`,
      name: names[i] as string,
      status,
      priority: i % 4 === 0 ? 'high' : i % 3 === 0 ? 'mid' : 'low',
      owner: project.owners[i % project.owners.length] as string,
      due,
      late: due.includes('逾期'),
    })
  }

  // 未完成的任务排前面（Array.prototype.sort 稳定，组内保持原顺序）
  return list.sort((a, b) => (a.status === 'done' ? 1 : 0) - (b.status === 'done' ? 1 : 0))
}

/** 里程碑：按整体进度决定已完成个数，下一个为进行中 */
export function buildMilestones(project: Project): Milestone[] {
  const names = POOL[project.scope].milestones
  const doneCount = Math.min(names.length, Math.max(0, Math.round((project.progress / 100) * names.length)))

  return names.map((name, i) => {
    const state: MilestoneState = i < doneCount ? 'done' : i === doneCount ? 'now' : 'todo'
    return {
      id: `${project.id}-m${i + 1}`,
      name,
      state,
      date: state === 'done' ? '已完成' : state === 'now' ? '进行中' : '待启动',
      detail: state === 'done' ? '已于计划内完成' : state === 'now' ? '当前所处阶段' : '等待前序阶段',
    }
  })
}

/**
 * 「多久没更新」→ 文案。
 *
 * 池子里存的是小时数（`DocSeed.updatedHours`），文案在这里算 —— 与
 *    `leftText(daysLeft)` 是同一条纪律：能算出来就不写死一句会过期的话。
 *    分档只有三档（< 24 小时 / 昨天 / N 天前），因为文档索引不需要更细的刻度。
 */
export function docUpdatedText(hours: number): string {
  if (hours <= 0) return '刚刚'
  if (hours < 24) return `${hours} 小时前`
  const days = Math.round(hours / 24)
  return days <= 1 ? '昨天' : `${days} 天前`
}

/**
 * 文档索引：仅存索引与链接，正文留在原工具。
 *
 * 条数 = 池子长度（不再固定 4 份）：`POOL[scope].documents` 每一条就是一篇。
 * 这与 `buildServers` / `buildAccounts` 同形 —— 之前写成
 * `pick(pool, seed, 4)` 时，"4" 是个与池子无关的常数（池子变长也还是 4 份）。
 *
 * 字段的来源各不相同，别把它们当成同类：
 *    · `kind` / `module` / `func` / `links` —— 池子里声明的（这篇是什么、属于哪一功能点）
 *    · `source` —— 按项目哈希轮转（存在哪儿；应用里没有"某篇文档存在语雀"这种事实）
 *    · `updatedAt` —— 由池子声明的 `updatedHours` 算
 *    · `author`  —— 项目负责人轮转（与 `buildActivity` / `buildMeetings` 同一条口径）
 *       `OWNER_NAMES` 只登记了 `LY`，所以 `p3` 这类多负责人的项目会显示成 `ZQ` / `HM`。
 *          这里是照实渲染（那份名单本来就不全），不是显示 bug。
 *    · `back`    —— 算出来的（见函数末尾），池子里没有这一份
 */
export function buildDocuments(project: Project): DocumentItem[] {
  const seed = hash(project.id)
  const owners = project.owners
  const seeds = POOL[project.scope].documents
  /* 关联的目标要从这一批真数据里解析（池子里写的是名字，见 `DocLinkSeed`）：
     任务 / 问题 / 会议都取派生结果，不按名字另编一条出来。 */
  const tasks = buildTasks(project)
  const bugs = buildBugs(project)
  const meetings = buildMeetings(project)
  const docByName = new Map(seeds.map((doc, i) => [doc.name, { id: `${project.id}-d${i + 1}`, doc }]))

  /** 一条种子边 → `DocLink`。目标不在这批里（会议只取 2 场、问题只取 2~3 条）就丢掉这条边。 */
  function resolveDocLink(link: DocLinkSeed): DocLink | null {
    if (link.family === 'doc') {
      const hit = docByName.get(link.name)
      if (!hit) return null
      return {
        kind: link.kind, family: 'doc', id: hit.id,
        label: hit.doc.name, meta: DOC_KIND_LABEL[hit.doc.kind],
      }
    }
    if (link.family === 'task') {
      const t = tasks.find((x) => x.name === link.name)
      if (!t) return null
      /* 与任务那一格同源的读法：完成的不再说"剩几天"，逾期那两个字不能省 */
      return {
        kind: link.kind, family: 'task', id: t.id, label: t.name,
        meta: t.status === 'done' ? '已完成' : t.late ? '已逾期' : t.due,
      }
    }
    if (link.family === 'bug') {
      const b = bugs.find((x) => x.title === link.name)
      if (!b) return null
      return { kind: link.kind, family: 'bug', id: b.id, label: b.title, meta: BUG_STATUS_LABEL[b.status] }
    }
    const m = meetings.find((x) => x.title === link.name)
    if (!m) return null
    return { kind: link.kind, family: 'meeting', id: m.id, label: m.title, meta: `${m.month} ${m.day}` }
  }

  const list: DocumentItem[] = seeds.map((doc, i) => ({
    id: `${project.id}-d${i + 1}`,
    name: doc.name,
    kind: doc.kind,
    module: doc.module,
    func: doc.func,
    source: DOC_SOURCES[(seed + i) % DOC_SOURCES.length] as string,
    summary: '索引与外部链接，正文由原工具维护',
    updatedAt: docUpdatedText(doc.updatedHours),
    updatedHours: doc.updatedHours,
    author: ownerDisplayName(owners[i % owners.length] as string),
    links: (doc.links ?? []).map(resolveDocLink).filter((x): x is DocLink => x !== null),
    back: [],
  }))

  /* 反链扫出来，不手挂第二份（挂两份迟早对不上）：
     只有文档之间才有反链 —— 任务 / 问题 / 会议不会"指向"一篇文档。
     必须等 `list` 建完再扫：一条边可能指向排在后面的那一篇。 */
  list.forEach((doc) => doc.links.forEach((link) => {
    if (link.family !== 'doc') return
    const target = list.find((d) => d.id === link.id)
    if (!target) return
    target.back.push({
      kind: link.kind, family: 'doc', id: doc.id, label: doc.name, meta: DOC_KIND_LABEL[doc.kind],
    })
  }))

  return list
}

/** 项目动态 */
export function buildActivity(project: Project): ActivityItem[] {
  return POOL[project.scope].activity.map((action, i) => ({
    id: `${project.id}-a${i + 1}`,
    who: project.owners[i % project.owners.length] as string,
    action,
    time: ACTIVITY_TIMES[i % ACTIVITY_TIMES.length] as string,
  }))
}

/* ============================================================
   列表页派生统计
   ============================================================ */

export interface ProjectStats {
  total: number
  active: number
  risk: number
  done: number
  averageProgress: number
  scopeSegments: { scope: Project['scope']; label: string; percent: number }[]
  scopeCounts: Record<Project['scope'], number>
}

export function computeStats(projects: Project[]): ProjectStats {
  const total = projects.length
  const scopeCounts = { life: 0, work: 0, learn: 0 }
  let progressSum = 0

  for (const project of projects) {
    scopeCounts[project.scope] += 1
    progressSum += project.progress
  }

  const pct = (n: number) => (total === 0 ? 0 : (n / total) * 100)

  return {
    total,
    active: projects.filter((p) => p.status === 'active').length,
    risk: projects.filter((p) => p.status === 'risk').length,
    done: projects.filter((p) => p.status === 'done').length,
    averageProgress: total === 0 ? 0 : Math.round(progressSum / total),
    scopeSegments: [
      { scope: 'life', label: '生活', percent: pct(scopeCounts.life) },
      { scope: 'work', label: '工作', percent: pct(scopeCounts.work) },
      { scope: 'learn', label: '学习', percent: pct(scopeCounts.learn) },
    ],
    scopeCounts,
  }
}

/**
 * 已收口的项目：不再占"未完成"的名额，也不再算"剩几天"。
 *
 * 已完成 / 已归档两种都算 —— 归档不是删除，它只是从台面上收走。
 *    这是"收口"这件事的唯一判据（原型 `isClosed`），
 *    `isDueSoon` / `isCardDueWarn` / 侧栏「要看紧的」/ 顶栏徽标都读它 ——
 *    别处再写 `status !== 'done'` 就会漏掉归档（那一项是这个版本新加的）。
 */
export const isClosed = (project: Project): boolean =>
  project.status === 'done' || project.status === 'archived'

/** 截止日期临近（≤14 天且未收口）时高亮 */
export function isDueSoon(project: Project): boolean {
  return !isClosed(project) && project.daysLeft >= 0 && project.daysLeft <= 14
}

/** 卡片上“逾期/临近”的警示样式只对非风险中项目生效（原型 card 的判断） */
export function isCardDueWarn(project: Project): boolean {
  return !isClosed(project) && project.status !== 'risk' && project.daysLeft >= 0 && project.daysLeft <= 14
}

export function priorityRank(project: Project): number {
  return PRIORITY_META[project.priority].rank
}

/* ============================================================
   项目详情页的四个新区（`work_product-detail.html`，2026-09-25）
   ------------------------------------------------------------
   `Project` 上没有 bug / server / deploy / meeting / account 这五个字段，
      所以这五组与 `buildDocuments` 同一类：由项目确定性派生，不是真实读数。
      放在这里的理由与那四组一样 —— 一处事实源，8 个项目打开是 8 份不同内容。
   条数：能挂到真字段的就挂（`buildTasks` 用 `project.tasksTotal`），
      挂不上的用固定档并在注释里写明（`buildMilestones` 固定 5 条、
      `buildDocuments` 固定 4 份是同样的取舍）—— 不编造一个假的"条数"字段。
   ============================================================ */

export interface BugItem {
  id: string
  title: string
  /** 致命 / 严重 / 一般 */
  level: 'critical' | 'major' | 'minor'
  status: 'open' | 'fixing' | 'fixed'
  version: string
  when: string
  /** 负责人的显示名（取自 `owners`，同 `buildActivity` 的取法） */
  who: string
}

export const BUG_LEVEL_LABEL: Record<BugItem['level'], string> = {
  critical: '致命',
  major: '严重',
  minor: '一般',
}
export const BUG_STATUS_LABEL: Record<BugItem['status'], string> = {
  open: '待修复',
  fixing: '修复中',
  fixed: '已修复',
}
/** 级别 → 卡片主色。与全站状态色一致（危险 / 警示 / 中性） */
export const BUG_LEVEL_COLOR: Record<BugItem['level'], string> = {
  critical: '#EF4444',
  major: '#F59E0B',
  minor: '#64748B',
}

/** 问题清单。条数：2 条，风险项目 +1（"有风险"与"问题更多"是同一件事的两面）。 */
export function buildBugs(project: Project): BugItem[] {
  const count = project.risk ? 3 : 2
  const levels: BugItem['level'][] = ['critical', 'major', 'minor']
  return pick(POOL[project.scope].bugs, `${project.id}bug`, count).map((title, i) => ({
    id: `${project.id}-b${i + 1}`,
    title,
    level: levels[i % levels.length] as BugItem['level'],
    /* 第一条待修复、第二条修复中、之后已修复 —— 与原型那两张卡的状态分布一致 */
    status: i === 0 ? 'open' : i === 1 ? 'fixing' : 'fixed',
    version: BUG_VERSIONS[(hash(project.id) + i) % BUG_VERSIONS.length] as string,
    when: ACTIVITY_TIMES[(hash(`${project.id}${i}`) + i) % ACTIVITY_TIMES.length] as string,
    who: ownerDisplayName(project.owners[i % project.owners.length] as string),
  }))
}

/** 负载档：≥90 告警、≥75 注意。KPI 条的"环境健康"与每一格的染色都用这一条判据 */
export const loadLevel = (pct: number): 'ok' | 'warn' | 'danger' =>
  pct >= 90 ? 'danger' : pct >= 75 ? 'warn' : 'ok'

/**
 * 目录占用份额（%）。
 * `ldd` 之外这几条是 Linux 机器上的固定目录，份额是一张声明的表：
 *    每台机器的"用了多少 G"由 `diskGb × disk%` 再乘份额得到，不另外编数字。
 *    「其他」取剩余 —— 免得表里改了数、总量对不上。
 */
const DISK_SHARES: [string, number][] = [
  ['/var/log', 20],
  ['/opt/app', 16],
  ['/var/lib/docker', 15],
  ['/usr', 10],
  ['/home', 6],
]

/** 一个"端口 + 它是干什么的"。一台机器上跑着几个服务就有几条 —— 所以它不是一串数字 */
export interface PortChip {
  port: string
  svc: string
}

/**
 * 角色 → 端口。这几条是技术事实（web 8080/8443、pg 5432、redis 6379），不是编的。
 * 每条都带服务名：`8080 / 8443` 这种只报数字的写法，看的人得自己去猜哪个是 HTTP、
 *    哪个是管理口 —— 而"这台机器上有几个口、分别给谁"正是打开这个面板要问的事。
 */
const PORTS_BY_ROLE: Record<string, PortChip[]> = {
  web: [
    { port: '8080', svc: 'HTTP' },
    { port: '8443', svc: 'HTTPS' },
    { port: '9000', svc: '管理' },
    { port: '9100', svc: '指标' },
    { port: '9229', svc: '调试' },
  ],
  db: [
    { port: '5432', svc: 'PostgreSQL' },
    { port: '6432', svc: '连接池' },
    { port: '9187', svc: '指标' },
  ],
  cache: [{ port: '6379', svc: 'Redis' }],
}

/**
 * 路径备注里的 `{v}` 换成当前版本号。
 *
 * 池子里那几条 `{v} · 2.4 MB` 是声明，但版本号只有一个来源
 *    （`latestVersion`，与发布记录第一条同一个函数）—— 把 `v2.3.1` 直接写进池子，
 *    就会出现"文件位置写着 v2.3.1、页面顶部仪表写着 v2.3.4"。
 */
export function pathNote(note: string, version: string): string {
  return note.replace(/\{v\}/g, version)
}

/** 文件 / 目录 / 二进制：只看路径就能定，不必维护第二份清单 */
export function fileKindOf(path: string): 'dir' | 'file' | 'binary' {
  const last = path.split('/').filter(Boolean).pop() ?? ''
  if (!last.includes('.')) return 'dir'
  if (/\.(jar|zip|gz|tgz|war|png|jpg)$/i.test(last)) return 'binary'
  return 'file'
}

/** 路径浏览器里的一棵树。目录带 `children`、文件带 `size` / `time` */
export interface FsNode {
  type: 'd' | 'f'
  children?: Record<string, FsNode>
  size?: string
  time?: string
}

/**
 * 由「项目文件位置」清单 + 那些还没登记的同级项长出一棵目录树。
 *
 * 树不是手写的第二份清单：手写一棵树 + 一份清单必然走岔（清单里换了路径，
 *    树里还留着旧的，于是浏览里永远看不到刚登记的那条）。
 * 文件只能是叶子：已经是目录的节点不被降级成文件，反之亦然 ——
 *    否则先登记的 `/var/backups/pg/` 会被后来的 `/var/backups/pg/x.dump` 覆写成文件，
 *    那个目录下面登记的其它项就再也点不到了。
 */
export function buildFsTree(paths: PathSeed[], extra: FsSeed[], version: string): FsNode {
  const root: FsNode = { type: 'd', children: {} }

  const insert = (parts: string[], leaf: { type: 'd' | 'f'; size?: string; time?: string }) => {
    let node = root
    for (let i = 0; i < parts.length; i += 1) {
      const seg = parts[i] as string
      const last = i === parts.length - 1
      if (last && leaf.type === 'f') {
        if (!node.children?.[seg]) {
          node.children![seg] = { type: 'f', size: leaf.size ?? '', time: leaf.time ?? '' }
        }
        return
      }
      const cur = node.children?.[seg]
      if (!cur || cur.type !== 'd') node.children![seg] = { type: 'd', children: {} }
      node = node.children![seg] as FsNode
    }
  }

  paths.forEach((item) => {
    const isDir = fileKindOf(item.path) === 'dir'
    insert(
      item.path.split('/').filter(Boolean),
      isDir ? { type: 'd' } : { type: 'f', size: pathNote(item.note, version) },
    )
  })
  extra.forEach((entry) => {
    insert(
      entry.path.split('/').filter(Boolean),
      entry.dir ? { type: 'd' } : { type: 'f', size: entry.size, time: entry.time },
    )
  })

  return root
}

/** 树里取一层。取不到（历史路径早没了）返回 null —— 调用方负责退到最长的存在前缀 */
export function fsNodeAt(root: FsNode, parts: string[]): FsNode | null {
  let node: FsNode | null = root
  for (let i = 0; i < parts.length && node; i += 1) {
    if (node.type !== 'd') return null
    node = node.children?.[parts[i] as string] ?? null
  }
  return node
}

/**
 * 打开浏览器时落在哪一层。已填的路径可能指向目录、指向文件、或早就没了
 * （清单是手登记的历史），三种都要落到一个能用的位置上：
 *   目录本身 → 它所在的那一级 → 最长的存在前缀 → 家目录
 */
export function fsDirFor(root: FsNode, parts: string[], home: string[]): string[] {
  const cut = [...parts]
  while (cut.length) {
    const node = fsNodeAt(root, cut)
    if (node) return node.type === 'd' ? cut : cut.slice(0, -1)
    cut.pop()
  }
  return home
}

/**
 * 关键指标的换算系数 —— 把三格负载换成"网络出 / 活跃连接 / 磁盘 IOPS"。
 * 这是声明的系数，不是真实读数：应用里没有监控系统，这几个量本来就无处可取。
 *    放在这里而不是散在组件里，是因为它们与"负载"是同一份数据的两面。
 */
export const METRIC_COEF = { net: 0.06, conn: 3.2, iops: 1.05 }

/** 12 个采样点：围绕基准负载做 ±9 的确定性抖动（同一次渲染里结果稳定） */
function sparkSeries(base: number, seed: string): number[] {
  return Array.from({ length: 12 }, (_, i) => {
    const wobble = (hash(`${seed}#${i}`) % 19) - 9
    return Math.max(2, Math.min(99, Math.round(base + wobble)))
  })
}

/** 短提交号。派生出来的 7 位十六进制，够像一次提交、也够说明它是编的 */
export function shortSha(seed: string): string {
  return hash(seed).toString(16).padStart(8, '0').slice(0, 7)
}

export interface DiskUsageItem {
  path: string
  size: string
  pct: number
}

export interface ServerItem {
  id: string
  name: string
  /** 角色后缀：web / db / cache。日志源按它取（见 `LOG_SOURCES`） */
  role: string
  env: 'prod' | 'test'
  on: boolean
  /** 地址。写全（行上的小字与信息面板都读它，也是这一页最常被复制走的值） */
  ip: string
  /** `4C8G` 这种，由下面两个数拼出来 */
  spec: string
  /** 核数 / 内存 GB —— 「平均负载 0.44 / 4.0」「内存 3.2G / 8G」都要用到它们 */
  cores: number
  memGb: number
  os: string
  /** 登录身份（与「添加服务器」那张表同一组字段）—— 服务器详情页的字段区读它 */
  user: string
  auth: 'key' | 'pwd'
  esc: 'none' | 'su' | 'sudo'
  /** 信息面板里"不用连也能知道"的那几项（地址与系统之外） */
  info: InfoField[]
  /** 「哪些文件可以清」。缺省 = 那一段不渲染 */
  reclaim?: ReclaimSeed
  /** 这个角色配了几份日志 —— 「日志」跳转项上那颗计数（跳走之后就看不到这个数了） */
  logCount: number
  cpu: number
  mem: number
  disk: number
  /** 任意一项 ≥ 90 */
  alert: boolean
  uptimeDays: number
  /** 当前版本 —— 与发布记录第一条必须是同一个（见 `latestVersion`） */
  version: string
  /** 应用端口（带服务名）。一台机器上跑几个服务就有几条 */
  ports: PortChip[]
  /**
   * 项目文件位置清单（可增删改，见 `OpsPanel` 里那份模块级清单）。
   * 它的分组顺序就是显示顺序；`note` 里的 `{v}` 由 `pathNote` 换掉。
   */
  pathGroups: string[]
  paths: PathSeed[]
  /** 路径浏览器里补的那些"确实有、只是还没登记"的同级项 */
  fsExtra: FsSeed[]
  /** 路径为空时浏览器的落点 */
  fsHome: string[]

  /* —— 下面这几项当前没有消费方（2026-09-27 撤「监控 / 目录占用 / 磁盘告警」那一整组时
     一并下线的）：原型与本页都只剩"部署文件 / 查看日志"两件事要管。
     留着是因为它们仍是从池子那三个数算得出来的派生物，删掉等于把算法也一起丢了；
     别拿它们去新写一个监控面板 —— 那要走一轮"这一页要不要再养一套告警语义"的决定。 */
  /** 三条迷你折线（12 点） */
  series: Record<'cpu' | 'mem' | 'disk', number[]>
  /** 目录占用（含「其他」） */
  diskUsage: DiskUsageItem[]
  diskUsedGb: number
  diskTotalGb: number
}

/** 一台服务器要展示的 6 个关键指标。`unit` 空串表示没有单位 */
export interface ServerMetric {
  k: string
  v: string
  unit: string
}

/**
 * 服务器清单。条数 = 池子长度（work 域 2 台；其余域池子为空 ⇒ 返回空数组）。
 *
 * 停机那台的负载与 `on` 仍然算得出（池子里已经没有 `env === 'test'` 的种子了，
 *    但这条规矩留着）：给它编一组"停着但 CPU 62%"的读数，
 *    是这一页最容易看起来对、实际上错的地方。
 */
export function buildServers(project: Project): ServerItem[] {
  const seeds = POOL[project.scope].servers
  return seeds.map((seed, i) => {
    const on = seed.env === 'prod'
    const name = `${seed.env === 'prod' ? 'prod' : 'test'}-${seed.role}-01`
    const diskUsedGb = Math.round(seed.diskGb * seed.disk) / 100
    return {
      id: `${project.id}-s${i + 1}`,
      name,
      role: seed.role,
      env: seed.env,
      on,
      ip: seed.ip,
      spec: `${seed.cores}C${seed.memGb}G`,
      cores: seed.cores,
      memGb: seed.memGb,
      os: seed.os,
      user: seed.user,
      auth: seed.auth,
      esc: seed.esc,
      info: seed.info,
      reclaim: seed.reclaim,
      /* 行上那行小字（`生产 · 47.100.23.11 · Ubuntu 22.04`）在这里不拼：
         它中间那个地址要单独包一层 `.meta-ip` 染色，拼成字符串就包不进去了。
         由页面按 `env / ip / os / info(inMeta)` 现拼 —— 只有一处消费者，不存在第二份。 */
      logCount: (LOG_SOURCES[seed.role] ?? []).length,
      cpu: seed.cpu,
      mem: seed.mem,
      disk: seed.disk,
      alert: loadLevel(seed.disk) === 'danger' || loadLevel(seed.cpu) === 'danger' || loadLevel(seed.mem) === 'danger',
      uptimeDays: 60 + (hash(`${project.id}${seed.role}up`) % 200),
      version: latestVersion(project),
      ports: PORTS_BY_ROLE[seed.role] ?? [],
      /* 这三份按引用交出去（`paths` 连同数组本体）：页面上的增删改就地发生在这一份上，
         所以"清单"和"路径浏览器那棵树"永远看同一份数据 —— 另存一份副本就会出现
         "刚加的这条在清单里、在浏览器里却找不到"。 */
      pathGroups: seed.pathGroups,
      paths: seed.paths,
      fsExtra: seed.fsExtra,
      fsHome: seed.fsHome,
      series: {
        cpu: sparkSeries(seed.cpu, `${project.id}${seed.role}cpu`),
        mem: sparkSeries(seed.mem, `${project.id}${seed.role}mem`),
        disk: sparkSeries(seed.disk, `${project.id}${seed.role}disk`),
      },
      diskUsage: diskUsageOf(diskUsedGb, seed.diskGb),
      diskUsedGb,
      diskTotalGb: seed.diskGb,
    }
  })
}

/** 目录占用：份额表 × 已用量。最后补一条「其他」把剩下的吃掉 */
function diskUsageOf(usedGb: number, totalGb: number): DiskUsageItem[] {
  const rows = DISK_SHARES.map(([path, share]) => ({
    path,
    size: `${Math.round(usedGb * share) / 100} G`,
    pct: Math.round((usedGb * share) / totalGb),
  }))
  const restShare = 100 - DISK_SHARES.reduce((sum, [, share]) => sum + share, 0)
  rows.push({
    path: '其他',
    size: `${Math.round(usedGb * restShare) / 100} G`,
    pct: Math.round((usedGb * restShare) / totalGb),
  })
  return rows
}

/** 6 个关键指标。`平均负载` 是算出来的，另外三个走 `METRIC_COEF`，两个与硬件同尺度的走哈希 */
export function buildServerMetrics(server: ServerItem): ServerMetric[] {
  const load = (server.cpu / 100) * server.cores
  return [
    { k: '平均负载', v: load.toFixed(2), unit: `/ ${server.cores}.0` },
    { k: '网络出', v: (server.mem * METRIC_COEF.net).toFixed(1), unit: 'MB/s' },
    { k: '活跃连接', v: String(Math.round(server.mem * METRIC_COEF.conn)), unit: '' },
    { k: '磁盘 IOPS', v: String(Math.round(server.disk * METRIC_COEF.iops)), unit: '' },
    { k: '进程数', v: String(18 + (hash(`${server.id}proc`) % 12)), unit: '' },
    { k: 'P99 响应', v: String(60 + (hash(`${server.id}p99`) % 40)), unit: 'ms' },
  ]
}

/* ============================================================================
   跨项目的机器台账（`/work/servers`，原型 `设计/work/工作-服务器-index.html`）
   ----------------------------------------------------------------------------
   这一页要回答的问题与运维分区不是同一个：
     · 运维分区管一个项目的机器 —— 部署文件、看日志、发版、回滚（动手页）；
     · 本页管所有项目的机器 —— 在哪、属于谁、连上没有（台账页）。
   ⇒ 它需要的是 `buildServers(project)` 那一份的跨项目视图，不是重新造一份数据。

   机器 ↔ 项目是多对多（原型口径，也是应用里既成的事实）：`buildServers` 读的是
      `POOL[scope].servers`，同一个域下的项目拿到的是同一份机器清单 ⇒ 两台机器各自服务
      两个项目。所以 `projects` 是数组，去重的键是 `name`（机器名）而不是 `id`
      （`ServerItem.id` 带项目前缀，同一个 host 在不同项目里 id 不同）。
   ============================================================================ */

/** 这台机器服务的一个项目。终端 / 日志 / 部署 / 运维页都要用 `id` 拼地址。 */
export interface LedgerProjectRef {
  id: string
  name: string
}

/** 台账里的一台机器 —— 比 `ServerItem` 少了监控读数（本页不报），多了"服务哪些项目"。 */
export interface LedgerServer {
  host: string
  ip: string
  os: string
  role: string
  /** 卡面上只放图标，文字进 `title` / `aria-label` 与浮层「信息」里的那一格 */
  roleLabel: string
  env: 'prod' | 'test'
  envLabel: string
  /** 这台机器服务哪些项目。顺序即项目表顺序；第一个是"这门机器的主项目"（拼路由用它） */
  projects: LedgerProjectRef[]
  /** 核数 / 内存 GB —— 「编辑服务器」那张表单要拿它预填（`AddServerForm` 的 `server` 参数） */
  cores: number
  memGb: number
  /** 登录身份 —— 服务器详情页的「概览」字段区读它（`AUTH_LABEL` / `escText` 负责换成人话） */
  user: string
  auth: 'key' | 'pwd'
  esc: 'none' | 'su' | 'sudo'
  ports: PortChip[]
  /** 这个角色配了几份日志源（与运维分区同一个数） */
  logCount: number
  /** 发布记录里落在这台机器上的条数（同上） */
  deployCount: number
  pathGroups: string[]
  paths: PathSeed[]
}

/** 台账里的一组：`key = 'all'` 就是"全部服务器"那一格（平铺视角，没有项目可挂）。 */
export interface LedgerGroup {
  key: string
  label: string
  servers: LedgerServer[]
}

export function roleLabelOf(role: string): string {
  return role === 'db' ? '数据库' : 'Web 层'
}

/**
 * 把若干项目的机器合并成一份台账。条数 = 唯一机器数（按 `name` 去重）。
 * 分组里的计数（"这一组有几台"）会把共享机器数两次，而这里返回的是唯一机器数 ——
 *    两个分母不一样，别拿来互相验算（原型把这条写在仪表条的注释里）。
 */
export function buildServerLedger(projects: Project[]): LedgerServer[] {
  const byHost = new Map<string, LedgerServer>()
  projects.forEach((project) => {
    buildServers(project).forEach((server) => {
      const seen = byHost.get(server.name)
      if (seen) {
        if (!seen.projects.some((item) => item.id === project.id)) {
          seen.projects.push({ id: project.id, name: project.name })
        }
        return
      }
      byHost.set(server.name, {
        host: server.name,
        ip: server.ip,
        os: server.os,
        role: server.role,
        roleLabel: roleLabelOf(server.role),
        env: server.env,
        envLabel: server.env === 'prod' ? '生产' : '测试',
        projects: [{ id: project.id, name: project.name }],
        cores: server.cores,
        memGb: server.memGb,
        user: server.user,
        auth: server.auth,
        esc: server.esc,
        /* `ports` / `pathGroups` / `paths` 三份按引用接着走（池子里那一份）——
           运维分区上的增删改就地发生在它上面，这里再拷一份就会出现"两页两套说法"。 */
        ports: server.ports,
        logCount: server.logCount,
        deployCount: 0,
        pathGroups: server.pathGroups,
        paths: server.paths,
      })
    })
  })

  const ledger = [...byHost.values()]
  /* 发布次数：所有项目的发布记录里落在这台机器上的条数。
     结果会是"第一台全占、其余为 0"—— 因为 `buildDeploys` 把每条记录都挂在
        `servers[0]` 上（发布记录里只有一条"服务器"字段，而运维分区那一版就是这么派的）。
        运维分区的 `.sd-tab-count` 读的是同一个判据，所以两页的数是同一个。
        计数为 0 时页面不渲染那颗徽标（原型也是 `n ? … : ''`）。 */
  const deploys = projects.flatMap((project) => buildDeploys(project))
  ledger.forEach((server) => {
    server.deployCount = deploys.filter((item) => item.server === server.host).length
  })
  return ledger
}

/**
 * 项目视角的分组：每个项目一组，组内是"服务这个项目的全部机器"（共享机器会出现在多组里）。
 * 空组不返回 —— 某个项目的机器被清空之后，它那一格不该留在页面上。
 */
export function buildLedgerGroups(projects: Project[], ledger: LedgerServer[]): LedgerGroup[] {
  return projects
    .map((project) => ({
      key: project.id,
      label: project.name,
      servers: ledger.filter((server) => server.projects.some((item) => item.id === project.id)),
    }))
    .filter((group) => group.servers.length > 0)
}

/** 仪表第三格「最近发布」—— 跨项目的最近一条。 */
export interface LastDeploy {
  result: 'success' | 'rollback'
  version: string
  projectName: string
  host: string
  when: string
}

/**
 * 跨项目的"最近发布"。
 *
 * 判据两层，都要写清楚，否则下一个人会以为是随手取的：
 *   ① 时间档取 `DEPLOY_TIMES` 里下标最小的那一条 —— 那张表本身就是从近到远排的
 *      （`['昨天', '5 天前', '10 天前', '2 周前']`），所以"下标"就是时间序，不必解析文案；
 *   ② 同一档里多个项目都有记录时，回滚优先。这一格问的是"有没有正在烧的火"，
 *      而回滚就是那团火 —— 按项目顺序取第一条会在"p3 成功、p4 回滚（同一天）"时说"成功"，
 *      那正是这一格最不该犯的错。并列且都是成功时取项目顺序在前的那一个。
 */
export function lastDeployAcross(projects: Project[]): LastDeploy | null {
  const rows = projects.flatMap((project) =>
    buildDeploys(project).map((item, index) => ({ item, index, project })),
  )
  if (!rows.length) return null
  const nearest = Math.min(...rows.map((row) => row.index))
  const at = rows.filter((row) => row.index === nearest)
  const pick = at.find((row) => row.item.result === 'rollback') ?? (at[0] as (typeof at)[number])
  return {
    result: pick.item.result,
    version: pick.item.version,
    projectName: pick.project.name,
    host: pick.item.server,
    when: pick.item.when,
  }
}

/* ============================================================================
   服务器详情（`/work/servers/:host`，原型 `工作-服务器-详情-index.html`）
   ----------------------------------------------------------------------------
   台账页回答"我手上有哪些机器"，这一页回答"这一台是什么"：四段 ——
   概览 / 项目 / 文档 / 文件位置。动手（部署 / 看日志 / 发版 / 回滚）不在这里，
   本页只给门（Hero 上那三颗 + 项目卡右上角那颗）。
   ============================================================================ */

/** 认证方式 → 人话（原型 `AUTH_TXT`，与「添加服务器」那张表的词表同源） */
export const AUTH_LABEL: Record<'key' | 'pwd', string> = { key: '密钥文件', pwd: '密码' }

/** 提权方式 → 命令行那一串（原型 `escTxt`）。
 *  `none` 那一支的文案把它为什么不需要也说清楚（"登录用户是 root"）——
 *     只写"不需要"读起来像"这一项没填"。 */
export function escText(esc: 'none' | 'su' | 'sudo'): string {
  if (esc === 'none') return '不需要（登录用户是 root）'
  return esc === 'su' ? 'su - root' : 'sudo -u root -n'
}

/**
 * 项目的身份色 —— 只服务「服务器详情」的「服务项目」那一段（卡片底色）。
 *
 * 三支都取冷色（靛 245° / 紫 285° / 青 192°）：红 / 绿 / 琥珀已经被语义色占了
 *    （`--mw-danger` / `--mw-ok` / `--mw-warn`），项目色落进那三支会被读成"这个项目出问题了"。
 * `Project` 上没有配色字段（它只有状态；状态色是另一套语义，不能借来当身份色
 *    —— 那正好是上一条警告说的那个错）⇒ 按 id 哈希取一支：同一个项目在任何一台机器上
 *    都是同一支色，也不是每次渲染随机。第四支（蓝）是给"项目多起来"留的余量。
 */
const PROJECT_TINTS = ['#4F46E5', '#9333EA', '#0891B2', '#2563EB']

export function projectTint(projectId: string): string {
  return PROJECT_TINTS[hash(projectId) % PROJECT_TINTS.length] as string
}

/** 详情页「文档」那一段的一排书架：一个项目一排（文档的归属是项目，机器只是"路过"）。 */
export interface MachineDocShelf {
  projectId: string
  projectName: string
  docs: DeployDocItem[]
}

export interface ServerDetail {
  server: LedgerServer
  /** 这台机器服务的那几个项目各自有哪些部署文档（按 `projects` 现算、不另存一份清单） */
  shelves: MachineDocShelf[]
}

/**
 * 服务器详情要的那一份数据。`host` 找不到 ⇒ `null`（页面据此给出"这台不在台账里"）。
 *
 * 文档不另存一份"本机文档"清单：文档的归属是项目、机器只是"路过" ——
 *    写死一份就必然在某台机器改了服务项目之后说错话。所以按 `server.projects` 逐个
 *    `buildDeployDocs` 现算（与运维页「部署文档 N 篇」是同一个函数的同一批数据）。
 */
export function buildServerDetail(projects: Project[], host: string): ServerDetail | null {
  const server = buildServerLedger(projects).find((item) => item.host === host)
  if (!server) return null
  const byId = new Map(projects.map((project) => [project.id, project]))
  const shelves = server.projects
    .map((ref) => {
      const project = byId.get(ref.id)
      return project ? { projectId: ref.id, projectName: ref.name, docs: buildDeployDocs(project) } : null
    })
    .filter((shelf): shelf is MachineDocShelf => shelf !== null)
  return { server, shelves }
}

/* ============================================================================
   文件位置那一段的「路线图」树（原型 `railTree / routeMerge / countLeaves`）
   ----------------------------------------------------------------------------
   判据（原型段首那句）：这段数据里只有层级关系（谁在谁下面），没有方位、远近、相邻
   这类信息 ⇒ 该画的是拓扑图（地铁图：同源干线合并 + 每一段是一个站点），不是地图。
   树从数据现算：加一条路径，该合并的自动合并、该分叉的自动分叉。手写一棵就必然
      在某条路径改名之后说错话（与"路径浏览器那棵树由清单自己长出来"是同一条纪律）。
   ============================================================================ */

export interface RailNode {
  /** 站点名。合并过的会是 `uc/web/dist` 这种——它本来就是路径的一段 */
  name: string
  kids: RailNode[]
  /** 终点站：这条路径到此为止（登记值原样，尾斜杠是数据的一部分） */
  leaf: PathSeed | null
  /** 登记值以 `/` 结尾——显示时要补那个斜杠，否则"这是个目录"这层意思就没了 */
  isDir: boolean
}

/**
 * 按 `/` 逐段挂上去 —— 相同的前缀自然共用同一批节点，这就是"同源干线合并"，
 * 不是"为了摆整齐把相近的凑一起"。
 */
export function buildRailTree(paths: PathSeed[]): RailNode[] {
  const root: RailNode = { name: '', kids: [], leaf: null, isDir: true }
  paths.forEach((item) => {
    const parts = item.path.split('/').filter(Boolean)
    let node = root
    parts.forEach((seg, i) => {
      let kid = node.kids.find((item2) => item2.name === seg)
      if (!kid) {
        kid = { name: seg, kids: [], leaf: null, isDir: false }
        node.kids.push(kid)
      }
      node = kid
      if (i === parts.length - 1) {
        node.leaf = item
        node.isDir = item.path.slice(-1) === '/'
      }
    })
  })
  return mergeRail(root).kids
}

/**
 * 单链压缩（地铁图里叫"区间合并"）：一个节点若只有 1 个孩子，就把孩子并上来，
 * 一直并到"分叉点"（≥2 个孩子）或"叶子"（没有孩子）为止。
 * 判据：一个站点值得占一行的理由 = 它要么是分叉点、要么是终点。
 * 不压的代价是量出来的：一台机器 22 行里 13 行是纯路过站（`opt` / `app` / `web` /
 *    `nginx` / `conf.d` …），每行 26px、共 338px，而它们一个字的信息都没有。
 * 一个节点自己挂着信息（`leaf`）时不并 —— 前缀路径（同时登记了 `/opt/app` 与
 *    `/opt/app/web/dist`）那种情况，并掉就等于把它的读数丢了。
 */
function mergeRail(node: RailNode): RailNode {
  node.kids = node.kids.map((kid) => {
    let cur = kid
    while (!cur.leaf && cur.kids.length === 1) {
      const child = cur.kids[0] as RailNode
      cur = { name: `${cur.name}/${child.name}`, kids: child.kids, leaf: child.leaf, isDir: child.isDir }
    }
    mergeRail(cur)
    return cur
  })
  return node
}

/**
 * 这一站下面还藏着多少条登记的位置（只数叶子）—— 收起之后那一行唯一还看得见的数。
 * 中间站是"路过"的、不是"登记的位置" ⇒ 不数；节点自己挂的那条 `leaf` 也不数
 *    （它按分叉站画、本来就没露出来，数进去就成了"藏起来的数"与"露出来的行"对不上）。
 * 判据：收起把 N 行藏起来 ⇒ 必须有一处说"藏了几条"，否则"收起来"就等于"信息丢了"。
 */
export function railLeafCount(node: RailNode): number {
  return node.kids.reduce((n, kid) => {
    const self = kid.leaf && !kid.kids.length ? 1 : 0
    return n + self + railLeafCount(kid)
  }, 0)
}

/**
 * 这一站的绝对路径：终点站用登记值原样（`/var/log/pay-api/` 那个尾斜杠是数据的一部分，
 * 去掉就不是数据里那一串了）；中间站由祖先拼出来 —— 合并过的站名本来就是路径的一段，
 * 拼出来必然等于真路径。
 */
export function railFullPath(node: RailNode, parent: string): string {
  return node.leaf ? node.leaf.path : `${parent}/${node.name}`
}

/** 复制名称 = 最后一段（尾斜杠先去掉，否则复制出来是空串） */
export function railBaseName(full: string): string {
  return full.replace(/\/+$/, '').split('/').pop() ?? ''
}

export interface DeployItem {
  id: string
  version: string
  result: 'success' | 'rollback'
  when: string
  server: string
  who: string
  /** 只有成功的发布才有；回滚那条是空串（页面据此不渲染那一格） */
  duration: string
  /** 短提交号（派生） */
  commit: string
  /** 变更说明；回滚那条是原因（同一个字段，两种读法 —— 见 `deployNotes`） */
  changes: string
  /** 回滚到哪一版；只有 `result === 'rollback'` 时有值 */
  rollbackTo: string | null
}

/**
 * 发布记录。条数固定 4（原型 4 条；`buildDocuments` 固定 4 份同一条取舍）。
 *
 * 运维是一整块：服务器 / 发布记录 / 部署文档要么都有、要么都没有。
 *    判据统一取 `servers` 池是否为空（服务器是这一块的主语）——
 *    否则会出现"一趟家庭旅行有一个运维分区、里面 4 条发布记录"这种事。
 *    别把这条判据只写在页面的 `visibleTabs` 里：那样三个派生器各自
 *       还会产出内容，只靠页面挡着；哪天换个入口就漏出来了。
 */
export function buildDeploys(project: Project): DeployItem[] {
  if (POOL[project.scope].servers.length === 0) return []
  const servers = buildServers(project)
  const base = versionBase(project)
  const notes = POOL[project.scope].deployNotes
  return DEPLOY_TIMES.map((when, i) => {
    /* 只有一条回滚，位置由哈希定（不是每次都第 3 条） */
    const rollbackAt = 1 + (hash(`${project.id}rb`) % 3)
    const result: DeployItem['result'] = i === rollbackAt ? 'rollback' : 'success'
    return {
      id: `${project.id}-d${i + 1}`,
      version: `${base}.${DEPLOY_TIMES.length - i}`,
      result,
      when,
      server: servers[0]?.name ?? 'prod-web-01',
      who: ownerDisplayName(project.owners[i % project.owners.length] as string),
      /* 只有成功的发布才有"部署耗时" —— 回滚没有这个概念，空串让页面不渲染那一格 */
      duration: result === 'success' ? `2m ${String(8 + ((hash(`${project.id}${i}`) % 50) + i)).padStart(2, '0')}s` : '',
      commit: shortSha(`${project.id}c${i}`),
      /* 变更说明（回滚那条读作"原因"）。池子给几条就用几条，缺的那条退成占位 */
      changes: notes[i] ?? '—',
      /* 回滚到哪一版：列表里更旧的那一条。已经是最后一版时退到 `.1`（最早那一版） */
      rollbackTo: result === 'rollback' ? `${base}.${Math.max(1, DEPLOY_TIMES.length - i - 1)}` : null,
    }
  })
}

/** 版本号的主次号跟着项目走（哈希那一位只区分项目，不区分记录），补丁号倒着数。 */
function versionBase(project: Project): string {
  return `v${2 + (hash(project.id) % 2)}.3`
}

/**
 * 最新一版的版本号 —— 服务器的"当前版本"与发布记录第一条用同一个函数。
 * 不能各写一份：`buildServers` 里再调 `buildDeploys` 会互相递归（后者要前者的名字）。
 */
export function latestVersion(project: Project): string {
  return `${versionBase(project)}.${DEPLOY_TIMES.length}`
}

/* ============================================================
   日志（项目详情「运维 · 日志」页）
   ------------------------------------------------------------
   两种数据来源，泾渭分明：
   · 日志源（有哪些日志、路径、多大、多久没更新）—— `LOG_SOURCES` 按角色声明；
   · 日志行 —— `LOG_LINES` 按种类声明，这里只负责排时间戳、拆 `<code>` 片段。
   不读系统时钟：行的时刻从一条声明的基准（10:14:02）往前数。
      读 `Date.now()` 会让同一份数据两次渲染算出不同结果（`buildMeetings` 那条注释同理）；
      这个页面唯一该用真实时刻的地方是「最后更新 12:41」那一行，那是页面状态、不是数据。
   ============================================================ */

export type LogLevel = 'info' | 'warn' | 'error'

export interface LogLine {
  id: string
  /** `HH:MM:SS` */
  time: string
  level: LogLevel
  /** 行正文（已去掉 `⟦…⟧` 标记） */
  text: string
  /** 原标记里的等宽片段；`null` = 这行没有 */
  code: string | null
}

export interface LogSource {
  id: string
  /** 行列模板池的 key —— 实时跟随按它取行（`LOG_LINES[kind]`） */
  kind: LogKind
  /**
   * 左栏的分组（`LOG_GROUP_ORDER` 里的一项）。
   * 派生时由 `kind` 推（`LOG_GROUP_OF_KIND`）；会话里新增的路径写成 `custom` ——
   *    它的格式未知，归到"应用日志"是编的，归到"自定义"是事实。
   */
  group: LogGroupKey
  name: string
  path: string
  /** `186 MB` */
  sizeText: string
  /** `2 分钟前` / `2 小时前` / `2 天前` */
  updatedText: string
  /** 这份格式里有没有级别字段 —— 页面的级别筛选器只在这时为真才渲染 */
  leveled: boolean
  lines: LogLine[]
}

/** 「多久没更新」→ 文案。三档，与 `docUpdatedText` 同一条纪律：能算就不写死 */
export function logUpdatedText(mins: number): string {
  if (mins <= 0) return '刚刚'
  if (mins < 60) return `${mins} 分钟前`
  if (mins < 60 * 24) return `${Math.round(mins / 60)} 小时前`
  return `${Math.round(mins / (60 * 24))} 天前`
}

/** 行正文里的 `⟦…⟧` 拆出来：返回 [等宽片段, 去掉标记的正文] */
export function splitLogText(text: string): [string | null, string] {
  const m = /⟦([^⟧]*)⟧/.exec(text)
  if (!m) return [null, text]
  return [m[1] ?? null, text.replace(m[0], m[1] ?? '')]
}

/** 秒数 → `HH:MM:SS`（跨零点按 24 小时取模，日志里本来就是这天往回数） */
function clockText(seconds: number): string {
  const s = ((seconds % 86400) + 86400) % 86400
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

/**
 * 日志行。条数 = 该种类的池子长度（与文档/服务器同一条口径：不编一个"条数"字段）。
 * 第一条离现在最近（10:14:02），每条往前 3~47 秒 —— 步长由哈希定，同一份数据结果稳定。
 */
export function buildLogLines(seed: LogSourceSeed, key: string): LogLine[] {
  const pool = LOG_LINES[seed.kind] ?? []
  let cursor = 10 * 3600 + 14 * 60 + 2
  return pool.map((line, i) => {
    if (i > 0) cursor -= 3 + (hash(`${key}#${i}`) % 45)
    const [code, text] = splitLogText(line.text)
    return { id: `${key}-l${i + 1}`, time: clockText(cursor), level: line.level, text, code }
  })
}

/**
 * 一台机器的日志源。
 *
 * 返回空数组是正常情况：停机的测试机（`cache`）在 `LOG_SOURCES` 里没有条目。
 *    页面据此不把这台机器列进服务器分段 —— 列进去会得到一个"永远空白"的页面。
 */
export function buildLogSources(project: Project, server: ServerItem): LogSource[] {
  void project
  const seeds = LOG_SOURCES[server.role] ?? []
  return seeds.map((seed, i) => ({
    id: `${server.id}-lg${i + 1}`,
    kind: seed.kind,
    group: LOG_GROUP_OF_KIND[seed.kind],
    name: seed.name,
    path: seed.path,
    sizeText: `${seed.sizeMb} MB`,
    updatedText: logUpdatedText(seed.updatedMins),
    leveled: seed.leveled,
    lines: buildLogLines(seed, `${server.id}${seed.kind}`),
  }))
}

export interface MeetingItem {
  id: string
  month: string
  day: string
  time: string
  title: string
  meta: string
  attendees: string[]
  /** 超过 4 人时多出来的数量（原型是「+3」那种） */
  more: number
}

/**
 * 会议。条数固定 2（原型 2 场）。
 *
 * 日期从 `dueDate` 往前推，不用 `Date.now()`：
 *    后者会让同一份数据在两次渲染里算出不同结果（且"今天开会"会永远成立），
 *    而 `dueDate`（`2026-11-15` 这种）是项目上真实存在的时间锚，解析是确定的。
 */
export function buildMeetings(project: Project): MeetingItem[] {
  const attendees = project.owners.map(ownerDisplayName)
  const due = new Date(`${project.dueDate}T00:00:00`)
  return pick(POOL[project.scope].meetings, `${project.id}mt`, 2).map((title, i) => {
    const date = new Date(due.getTime() - (10 + i * 6) * 86400000)
    const all = i === 1 ? [...attendees, '王产品', '赵测试'] : attendees
    return {
      id: `${project.id}-m${i + 1}`,
      month: date.toLocaleString('en-US', { month: 'short' }).toUpperCase(),
      day: String(date.getDate()),
      time: i === 0 ? '14:00' : '10:00',
      title,
      meta: i === 0 ? '60 分钟 · 会议室 A' : '60 分钟 · 线上',
      attendees: all.slice(0, 4),
      more: Math.max(0, all.length - 4),
    }
  })
}

/** 账户凭据。就是池子里那一份（见 `buildAccounts`） */
export type AccountItem = AccountSeed

export const ACCOUNT_ENV_LABEL: Record<AccountItem['env'], string> = {
  prod: '生产',
  test: '测试',
  dev: '开发',
}

/**
 * 凭据类型的两条事实：中文名与能不能回显明文。
 *
 * `plain` 不只决定展开面板里有没有明文那一格 —— 它还决定行尾那颗常驻按钮是
 *    「复制密码」还是「复制账号」（密钥复制不出东西来），以及添加表单里那句说明。
 *    一处定义、三处消费：写死三次必然有一处说反话。
 */
export const ACCOUNT_TYPES: Record<AccountItem['type'], { name: string; plain: boolean }> = {
  password: { name: '密码', plain: true },
  key: { name: '密钥', plain: false },
}

/**
 * 账户。条数 = 池子长度（work 域 8 条；其余域池子为空 ⇒ 返回空数组）。
 *
 * 这里不新建对象 —— 返回的就是池子里那一份数组。与 `buildServers` 里的 `paths`
 *    同一条口径：账户页会就地改它（添加 / 编辑 / 停用 / 删除 / 轮换），
 *    每次新建一份的话，改完只活到下一次 render。
 * 连带一条：池子是按域共享的（p3 与 p4 都是 work 域）⇒ 在 p3 上改一条，p4 也变。
 *    这是"演示池"的既成口径（`servers` / `deployDocs` 同理），不是这一轮引入的。
 */
export function buildAccounts(project: Project): AccountItem[] {
  return POOL[project.scope].accounts
}

/* ------------------------------------------------------------------ *
 * 账户：日期与有效期
 *
 * 全页的时间口径只有一条：池子里存的是"距今几天"，绝对日期到渲染时才推出来。
 * 三条换算放在这里（组件里只调不写），是因为它们同时被展开面板、轮换计划、
 * 添加表单的"到期日回显"和概览卡四处消费。
 * ------------------------------------------------------------------ */

/** 距今 `days` 天的绝对日期（`YYYY-MM-DD`）。负数 = 过去 */
export function relativeDate(days: number): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + days)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 同上，只要 `MM-DD`（轮换计划左边那一列） */
export function relativeDateShort(days: number): string {
  return relativeDate(days).slice(5)
}

/**
 * 「还有多久」。只说剩余，不重复那个日期 —— 日期就在左边一列。
 */
export function dueText(days: number): string {
  if (days < 0) return `已逾期 ${-days} 天`
  if (days === 0) return '今天到期'
  return `${days} 天后`
}

/** 有效期胶囊的档位。`idle` 是停用态，它先于"逾期"判（已停用的不该再被催） */
export type AccountBadgeKind = 'idle' | 'danger' | 'warn' | 'plain'

/**
 * 有效期胶囊 —— 整张清单唯一的颜色语义（逾期 / 7 天内 / 30 天内 / 正常）。
 *
 * 停用态先于逾期：一条已经停用的凭据不该还在拿橙带催你轮换它（原型文件头那条）。
 * 两处消费：账户页的行徽标（走全套四档）与概览卡的角标（只显前三档，正常态不占位）。
 *    判据写在这里一份，免得"行上说逾期、概览说正常"。
 */
export function accountBadge(days: number, disabled?: boolean): { kind: AccountBadgeKind; text: string } {
  if (disabled) return { kind: 'idle', text: '已停用' }
  if (days < 0) return { kind: 'danger', text: `已逾期 ${-days} 天` }
  if (days <= 7) return { kind: 'warn', text: `${days} 天后轮换` }
  return { kind: 'plain', text: `${days} 天后轮换` }
}

/** 轮换计划 = 90 天内到期的，按日期升序（逾期的负数自然排最前）。停用的不算 */
export function accountRotatePlan(list: AccountItem[]): AccountItem[] {
  return list
    .filter((c) => !c.disabled && c.dueDays <= 90)
    .slice()
    .sort((a, b) => a.dueDays - b.dueDays)
}

/** 逾期条数（停用的不算） */
export function accountOverdue(list: AccountItem[]): AccountItem[] {
  return list.filter((c) => !c.disabled && c.dueDays < 0)
}

/**
 * 清单里的平台，按第一次出现的先后（新增的平台排末尾、已有的不跳位）。
 *
 * 平台是自己输入的自由文本 ⇒ 分组维度现算，不是一张写死的表：
 *    清单里有哪几个平台，只取决于手上真有哪几个。
 */
export function accountPlatforms(list: AccountItem[]): string[] {
  const seen: string[] = []
  list.forEach((c) => {
    if (!seen.includes(c.platform)) seen.push(c.platform)
  })
  return seen
}

export interface DeployDocItem {
  id: string
  name: string
  /** 手册 / 流程 / 脚本 */
  kind: string
  version: string
  /** 展示用的「多久没更新」，与文档列表同一条换算（`docUpdatedText`） */
  updatedAt: string
  /** 原始小时数。书墙上那枚书签的判据是"今天动过"，它按这个数判，
   *  不解析 `updatedAt` 那句文案（文案是给人看的，判据读它等于两处口径） */
  updatedHours: number
}

/**
 * 部署文档。条数 = 池子长度（同 servers/accounts，只在 work 域有；判据见 `buildDeploys`）。
 * 原来的 `kind` 是按下标从 `['手册','流程','脚本','配置']` 里取的、`version` 是 `v2.${len-i}` ——
 *    两样都是"位置决定内容"，于是「deploy.sh」这种一眼是脚本的东西可能被标成「手册」。
 *    现在三样都声明在池子里（`DeployDocSeed`），这里只补 id 与时间文案。
 */
export function buildDeployDocs(project: Project): DeployDocItem[] {
  return POOL[project.scope].deployDocs.map((doc, i) => ({
    id: `${project.id}-dd${i + 1}`,
    name: doc.name,
    kind: doc.kind,
    version: doc.version,
    updatedAt: docUpdatedText(doc.updatedHours),
    updatedHours: doc.updatedHours,
  }))
}
