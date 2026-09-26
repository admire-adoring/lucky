import {
  ACTIVITY_TIMES,
  BUG_VERSIONS,
  DEPLOY_TIMES,
  DOC_SOURCES,
  LOG_LINES,
  LOG_SOURCES,
  LOG_GROUP_OF_KIND,
  POOL,
  type LogGroupKey,
  type LogKind,
  type LogSourceSeed,
} from './content-pool'
import type { ActivityItem, DocumentItem, Milestone, MilestoneState, Project, Task, TaskStatus } from '../types'
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

/* ⚠️ 两个头像底色函数**原来是 `linear-gradient(135deg, hsl(h,72%,64%), hsl(h-30,68%,52%))`**，
   2026-09-25 纯色化时改成**单色**：取两个端点的中点（色相也取中点）——
   即 `hsl(h-15, 70%, 58%)`。
   ⚠️ 为什么取中点而不是"取能承白字的那一端"：这一支的判据不是对比度，是**观感连续性**。
   头像里是白字首字母，白字在这套色上的实测对比度本来就在 **3.1~4.5:1** 之间
   （取决于色相 —— 绿系最差），与全站已经存在的域色头像（`bg-life` #0f9d76 压白字 3.1:1）
   同一水平。**这是本轮之前就有的状态，纯色化不改它**：
   要修就得把 5 个色相一起往深色调，那是"改配色"而不是"去渐变"，属于另一件事。
   ⇒ 取中点 = 让这次改动**只换材质、不动明度**，是对比度不被牵连的唯一取法。 */

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
 * ⚠️ 池子里存的是**小时数**（`DocSeed.updatedHours`），文案在这里算 —— 与
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
 * 条数 = **池子长度**（不再固定 4 份）：`POOL[scope].documents` 每一条就是一篇。
 * 这与 `buildServers` / `buildAccounts` 同形 —— 之前写成
 * `pick(pool, seed, 4)` 时，"4" 是个与池子无关的常数（池子变长也还是 4 份）。
 *
 * ⚠️ 四个字段的来源各不相同，别把它们当成同类：
 *    · `kind`   —— 池子里**声明**的（这篇是什么）
 *    · `source` —— 按项目哈希**轮转**（存在哪儿；应用里没有"某篇文档存在语雀"这种事实）
 *    · `updatedAt` —— 由池子声明的 `updatedHours` 算
 *    · `author`  —— 项目负责人**轮转**（与 `buildActivity` / `buildMeetings` 同一条口径）
 *       ⚠️ `OWNER_NAMES` 只登记了 `LY`，所以 `p3` 这类多负责人的项目会显示成 `ZQ` / `HM`。
 *          这里是**照实渲染**（那份名单本来就不全），不是显示 bug。
 */
export function buildDocuments(project: Project): DocumentItem[] {
  const seed = hash(project.id)
  const owners = project.owners
  return POOL[project.scope].documents.map((doc, i) => ({
    id: `${project.id}-d${i + 1}`,
    name: doc.name,
    kind: doc.kind,
    source: DOC_SOURCES[(seed + i) % DOC_SOURCES.length] as string,
    summary: '索引与外部链接，正文由原工具维护',
    updatedAt: docUpdatedText(doc.updatedHours),
    updatedHours: doc.updatedHours,
    author: ownerDisplayName(owners[i % owners.length] as string),
  }))
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

/** 截止日期临近（≤14 天且未完成）时高亮 */
export function isDueSoon(project: Project): boolean {
  return project.status !== 'done' && project.daysLeft >= 0 && project.daysLeft <= 14
}

/** 卡片上“逾期/临近”的警示样式只对非风险中项目生效（原型 card 的判断） */
export function isCardDueWarn(project: Project): boolean {
  return project.status !== 'done' && project.status !== 'risk' && project.daysLeft >= 0 && project.daysLeft <= 14
}

export function priorityRank(project: Project): number {
  return PRIORITY_META[project.priority].rank
}

/* ============================================================
   项目详情页的四个新区（`work_product-detail.html`，2026-09-25）
   ------------------------------------------------------------
   ⚠️ `Project` 上**没有** bug / server / deploy / meeting / account 这五个字段，
      所以这五组与 `buildDocuments` 同一类：**由项目确定性派生**，不是真实读数。
      放在这里的理由与那四组一样 —— 一处事实源，8 个项目打开是 8 份不同内容。
   ⚠️ 条数：能挂到真字段的就挂（`buildTasks` 用 `project.tasksTotal`），
      挂不上的用**固定档**并在注释里写明（`buildMilestones` 固定 5 条、
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
 * ⚠️ `ldd` 之外这几条是 Linux 机器上的**固定目录**，份额是一张**声明的表**：
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

/** 角色 → 端口。这几条是技术事实（web 8080/8443、pg 5432、redis 6379），不是编的 */
const PORTS_BY_ROLE: Record<string, string> = {
  web: '8080 / 8443',
  db: '5432',
  cache: '6379',
}

/**
 * 关键指标的换算系数 —— 把三格负载换成"网络出 / 活跃连接 / 磁盘 IOPS"。
 * ⚠️ 这是**声明的系数**，不是真实读数：应用里没有监控系统，这几个量本来就无处可取。
 *    放在这里而不是散在组件里，是因为它们与"负载"是同一份数据的两面。
 */
export const METRIC_COEF = { net: 0.06, conn: 3.2, iops: 1.05 }

/** 12 个采样点：围绕基准负载做 ±9 的**确定性**抖动（同一次渲染里结果稳定） */
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
  /** 脱敏地址。⚠️ 生产 IP 不写全 —— 与应用里「服务器」那一段的既有口径一致 */
  ip: string
  /** `4C8G` 这种，由下面两个数拼出来 */
  spec: string
  /** 核数 / 内存 GB —— 「平均负载 0.44 / 4.0」「内存 3.2G / 8G」都要用到它们 */
  cores: number
  memGb: number
  os: string
  /** 列表行那一行小字（概览卡也在用它） */
  meta: string
  cpu: number
  mem: number
  disk: number
  /** 任意一项 ≥ 90 */
  alert: boolean
  uptimeDays: number
  /** 当前版本 —— 与发布记录第一条**必须是同一个**（见 `latestVersion`） */
  version: string
  ports: string
  /** 监控页的三条迷你折线（12 点） */
  series: Record<'cpu' | 'mem' | 'disk', number[]>
  /** 文件分布（含「其他」） */
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
 * 服务器清单。条数 = 池子长度（work 域 3 台；其余域池子为空 ⇒ 返回空数组）。
 *
 * ⚠️ 规格与"用了多少"都从池子里那 6 个数字**算**出来，不另写一份：
 *    平均负载 = `cpu%` × 核数（web 11% × 4 = 0.44 / 4.0），
 *    内存 3.2G = `40% × 8G`，磁盘 32G = `40% × 80G` —— 改池子里一个数，三处一起动。
 * ⚠️ 停机的那台（`env === 'test'`）不产出负载：页面按 `on` 渲染成「—」。
 *    给它编一组"停着但 CPU 62%"的读数，是这一页最容易看起来对、实际上错的地方。
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
      ip: seed.env === 'prod' ? `47.100.${10 + i}.x` : '10.0.1.x',
      spec: `${seed.cores}C${seed.memGb}G`,
      cores: seed.cores,
      memGb: seed.memGb,
      os: seed.os,
      meta:
        seed.env === 'prod'
          ? `47.100.x.x · 阿里云 · ${seed.cores}C${seed.memGb}G · ${seed.os}`
          : `10.0.1.x · 内网 · ${seed.cores}C${seed.memGb}G · ${seed.os}`,
      cpu: seed.cpu,
      mem: seed.mem,
      disk: seed.disk,
      alert: loadLevel(seed.disk) === 'danger' || loadLevel(seed.cpu) === 'danger' || loadLevel(seed.mem) === 'danger',
      uptimeDays: 60 + (hash(`${project.id}${seed.role}up`) % 200),
      version: latestVersion(project),
      ports: PORTS_BY_ROLE[seed.role] ?? '—',
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
  /** 变更说明；回滚那条是**原因**（同一个字段，两种读法 —— 见 `deployNotes`） */
  changes: string
  /** 回滚**到**哪一版；只有 `result === 'rollback'` 时有值 */
  rollbackTo: string | null
}

/**
 * 发布记录。条数固定 4（原型 4 条；`buildDocuments` 固定 4 份同一条取舍）。
 *
 * ⚠️ **运维是一整块**：服务器 / 发布记录 / 部署文档要么都有、要么都没有。
 *    判据统一取 `servers` 池是否为空（服务器是这一块的主语）——
 *    否则会出现"一趟家庭旅行有一个运维分区、里面 4 条发布记录"这种事。
 *    ⚠️ 别把这条判据只写在页面的 `visibleTabs` 里：那样三个派生器各自
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
      /* 回滚**到**哪一版：列表里更旧的那一条。已经是最后一版时退到 `.1`（最早那一版） */
      rollbackTo: result === 'rollback' ? `${base}.${Math.max(1, DEPLOY_TIMES.length - i - 1)}` : null,
    }
  })
}

/** 版本号的主次号跟着项目走（哈希那一位只区分项目，不区分记录），补丁号倒着数。 */
function versionBase(project: Project): string {
  return `v${2 + (hash(project.id) % 2)}.3`
}

/**
 * 最新一版的版本号 —— 服务器的"当前版本"与发布记录第一条**用同一个函数**。
 * ⚠️ 不能各写一份：`buildServers` 里再调 `buildDeploys` 会**互相递归**（后者要前者的名字）。
 */
export function latestVersion(project: Project): string {
  return `${versionBase(project)}.${DEPLOY_TIMES.length}`
}

/* ============================================================
   日志（项目详情「运维 · 日志」页）
   ------------------------------------------------------------
   两种数据来源，泾渭分明：
   · **日志源**（有哪些日志、路径、多大、多久没更新）—— `LOG_SOURCES` 按角色声明；
   · **日志行** —— `LOG_LINES` 按**种类**声明，这里只负责排时间戳、拆 `<code>` 片段。
   ⚠️ 不读系统时钟：行的时刻从一条**声明的**基准（10:14:02）往前数。
      读 `Date.now()` 会让同一份数据两次渲染算出不同结果（`buildMeetings` 那条注释同理）；
      这个页面唯一该用真实时刻的地方是「最后更新 12:41」那一行，那是**页面状态**、不是数据。
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
   * ⚠️ 派生时由 `kind` 推（`LOG_GROUP_OF_KIND`）；**会话里新增的路径写成 `custom`** ——
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
 * 日志行。**条数 = 该种类的池子长度**（与文档/服务器同一条口径：不编一个"条数"字段）。
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
 * ⚠️ 返回空数组是**正常情况**：停机的测试机（`cache`）在 `LOG_SOURCES` 里没有条目。
 *    页面据此**不把这台机器列进服务器分段** —— 列进去会得到一个"永远空白"的页面。
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
 * ⚠️ 日期**从 `dueDate` 往前推**，不用 `Date.now()`：
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

export interface AccountItem {
  id: string
  platform: string
  env: 'prod' | 'test' | 'dev'
  user: string
  /** 到期提醒；null = 不在近期轮换 */
  expire: string | null
  warn: boolean
}

export const ACCOUNT_ENV_LABEL: Record<AccountItem['env'], string> = {
  prod: '生产',
  test: '测试',
  dev: '开发',
}

/** 账户。条数 = 池子长度（work 域 4 个；其余域池子为空 ⇒ 返回空数组） */
export function buildAccounts(project: Project): AccountItem[] {
  const platforms = POOL[project.scope].accounts
  return platforms.map((platform, i) => {
    const env: AccountItem['env'] = i % 3 === 2 ? 'dev' : i % 2 === 0 ? 'prod' : 'test'
    const warn = i === platforms.length - 1
    return {
      id: `${project.id}-a${i + 1}`,
      platform,
      env,
      user: `${platform === '阿里云' ? 'admin' : 'dev'}@xxx.com`,
      expire: i === 0 ? '90 天后换' : warn ? '7 天后换' : null,
      warn,
    }
  })
}

export interface DeployDocItem {
  id: string
  name: string
  /** 手册 / 流程 / 脚本 */
  kind: string
  version: string
  /** 展示用的「多久没更新」，与文档列表同一条换算（`docUpdatedText`） */
  updatedAt: string
}

/**
 * 部署文档。条数 = 池子长度（同 servers/accounts，只在 work 域有；判据见 `buildDeploys`）。
 * ⚠️ 原来的 `kind` 是按下标从 `['手册','流程','脚本','配置']` 里取的、`version` 是 `v2.${len-i}` ——
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
  }))
}
