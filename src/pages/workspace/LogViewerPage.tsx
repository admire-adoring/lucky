import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { MacWindow } from '../../components/shell/MacWindow'
import { LOG_GROUP_LABEL, LOG_GROUP_ORDER, LOG_LINES, LOG_SOURCES, type LogGroupKey } from '../../data/content-pool'
import {
  buildLogSources,
  buildServers,
  splitLogText,
  type LogLevel,
  type LogLine,
  type LogSource,
  type ServerItem,
} from '../../data/derive'
import { useDocumentTitle } from '../../hooks/use-document-title'
import { useProjectDetail } from '../../hooks/use-projects'
import { cn } from '../../lib/cn'
import { useThemeStore } from '../../stores/theme-store'

/* ============================================================================
   日志查看器 —— 项目详情「运维 · 日志」
   原型 `design/work/工作-项目-项目详情-运维-日志-index.html`（2026-09-25 19:54 版）
   ----------------------------------------------------------------------------
   这一版是**照着原型补齐**的：上一版只落了核心（服务器分段 / 左栏列表 / 搜索 /
   级别筛选 / 实时跟随 / 增删改弹窗），原型在落地之后又长出一整套，这里一并补上：

     · 顶栏身份块（`.viewer-id`）与那条分隔（`.bar-sep`）
     · 左栏：面板头的条数（`.log-side-num`）、**分组可折叠**（`.log-group-chev`
       + `.log-group-items`）、组头的色条与错误数（`.log-group-mark` / `-n` / `-err`）、
       条目行内动作（`.log-src-actions` → 编辑 / 移除）
     · 右栏标题行的动作区（`.log-main-actions`：实时徽标 + 统计 + 跟随/重命名/下载/复制路径）
     · 工具条：**取数范围**（`.read-range`）、**时间范围**（`.time-range` + `.time-bar`）、
       搜索框的图标与 ⌘F 提示（`.search-ico` / `.search-kbd`）、
       这台机器的底细 chips（`.log-host-meta`）、**查找条**（`.find-bar`：
       计数 + 上/下一处 + 定位/只看匹配）
     · 正文：**加载更早的行**（`.load-more`）、一条路径都没有时的空态（`.log-empty`）
     · 弹窗：字段级动作（`.field-head` / `.field-act`）、**目录选择器**（`.pick-*`）、
       编辑路径 / 移除确认 + 「撤销」
     · 提示条换成**页面局部**那一套（`.toast` + `.toast-ico` + `.toast-act`）——
       只有它支持图标与动作按钮，应用的全局 ToastHost 不支持

   ============================================================================
   三种查看方式 = 两个正交控件 + 一个搜索模式（原型 2026-09-25 定，别改成三个 tab）
   ============================================================================
   · **取数范围** → 工具条最左的下拉（`tail -n N`）。列表**新的在上**，所以
     「最近 N 行」是 DOM 里的**前 N 行**，被挡在范围外的是**末尾**那些。
     写反了会变成"只给你看最旧的一批"，而行数对得上、时间列也在走，看着还挺正常。
   · **往回翻** → 正文末尾的「加载更早的 N 行」（`less` 的 `b`）。Web 里滚动条
     本身就是分页器，`less` 真正的对应物是**往回取更早的行**。
   · **搜索** → 默认「定位」（`less` 的 `/` 与 `n`）：保留全文、`<mark>` 标出、
     Enter/↓ 与 `n` 跳下一个、Shift+Enter/`N` 跳上一个。切到「只看匹配」才是 grep 式过滤。
   ⚠️ **范围之外的行不参与命中**（它压根没被取回来）。

   ⚠️ **时间范围是取数条件，不是又一层筛选**，所以它与「最近 N 行」是两个独立控件。
      计算顺序不能反：`先按时间圈 → 再取最近 N 行 → 再按级别/关键词筛`。反了的话
      「加载更早」会把时间范围外的行也算进计数。于是行有三种"不可见"，各走各的通道：
      时间范围外 → `hidden`（改回时间立刻可见）；这一段里没取回来 → `is-unloaded`；
      被级别/关键词筛掉 → `hidden`。
      相对范围的基准取**本份日志最新一行的时刻**，不是系统当前时间 ——
      日志流说的"最后 5 分钟"就是"从最新一条往前 5 分钟"，用 `Date.now()` 会得到空集。
   ⚠️ 实时跟随与固定时间窗是**互斥的意图**，所以开跟随会自动切回「全部时间」并说明。

   ⚠️ **0 命中的查找条必须说清"它没搜哪里"**：只搜当前这一份日志、只搜已载入的行、
      匹配整行文本。不写这句，用户会把"没搜到"读成"日志里没有"。

   ============================================================================
   与原型**有意不同**的四处（"静态页变成应用"必然要改的，不是审美）
   ============================================================================
   ① **整窗页面**（路由 `/logs/:id`），套 `MacWindow`。原型是 `window.open` 出来的
      独立窗口；落在应用里如果不给窗框，它就只是一张长得像日志的页面。
   ② **主题开关用应用的那份实现**（`theme-store`，切 `<html data-theme>`），但**外观**
      仍走原型的 `.theme-toggle`（所以它长得和原型一样）。原型自己持有 `.dark` 类 +
      自己的 localStorage，照搬会出现"设置页切成暗色、这一页还是亮的"。
   ③ **不读系统时钟**：行的时刻由 `buildLogLines` 从声明基准往前数。唯一用真实时刻的
      是「最后更新 HH:MM」与**实时跟随新插的行** —— 那两处本来就是"此刻发生的事"。
   ④ **实时跟随是本地模拟**：每 2.4 秒从该格式的行模板池取一行插到最前，上限 200 行。
      原型的那几句 toast 里没有这句，这里保留 —— 这一次点击是用户形成
      "它连上了服务器"这个印象的唯一时刻，不能说成真的连上了。

   ⚠️ 目录选择器是**按这台服务器声明过的日志路径**现搭的树，不是原型内置的那棵假目录树
      （`LOG_FS`）。选择器的语义没变：逐级下钻、目录在前、文件显示大小与时间、
      已经加过的打「已添加」且点了只用提示条告诉你不重复加。
   ============================================================================ */

/* ------------------------------------------------------------------ *
 * 图标：原型自带一套 16×16 的路径（`ICON` 表），这里原样搬过来。
 *
 * ⚠️ **不复用 `IconSprite`**：那是应用 24 网格的公共资产，这 18 枚里有 10 枚
 *    （refresh / copy / rows / close / info / warn / chevronRight / arrowUp / arrowDown …）
 *    精灵里没有 —— 为一张页面往公共精灵里加十枚图标，收益与代价不成比例。
 *    画法照抄原型（`viewBox="0 0 16 16"` + `.ico-svg`），所以尺寸与线宽与原型一致。
 * ------------------------------------------------------------------ */
const LG_ICON: Record<string, ReactNode> = {
  play: <path d="M5.6 3.9 12.2 8l-6.6 4.1z" />,
  pencil: (
    <>
      <path d="M3.2 12.8l.8-2.8 6.4-6.4a1.5 1.5 0 0 1 2.1 2.1l-6.4 6.4z" />
      <path d="M9.4 4.6l2 2" />
    </>
  ),
  download: (
    <>
      <path d="M8 2.9v7.3" />
      <path d="M4.9 7.3 8 10.4l3.1-3.1" />
      <path d="M2.9 13.1h10.2" />
    </>
  ),
  copy: (
    <>
      <rect x="5.8" y="5.8" width="7.3" height="7.3" rx="1.6" />
      <path d="M10.2 3.1H4.4a1.5 1.5 0 0 0-1.5 1.5v5.8" />
    </>
  ),
  search: (
    <>
      <circle cx="7.2" cy="7.2" r="4.2" />
      <path d="M10.4 10.4 13.6 13.6" />
    </>
  ),
  close: <path d="M4.4 4.4l7.2 7.2M11.6 4.4l-7.2 7.2" />,
  refresh: (
    <>
      <path d="M13.2 8a5.2 5.2 0 1 1-1.9-4" />
      <path d="M13.7 2.3v3.9h-3.9" />
    </>
  ),
  moon: <path d="M12.6 9.8A5.2 5.2 0 0 1 6.2 3.4a5.2 5.2 0 1 0 6.4 6.4z" />,
  sun: (
    <>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.7v1.7M8 12.6v1.7M1.7 8h1.7M12.6 8h1.7M3.5 3.5l1.2 1.2M11.3 11.3l1.2 1.2M12.5 3.5l-1.2 1.2M4.7 11.3l-1.2 1.2" />
    </>
  ),
  check: <path d="M3.2 8.4l3.2 3.2 6.4-7.2" />,
  info: (
    <>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8 7.5v3.4" />
      <path d="M8 5.1h.01" />
    </>
  ),
  warn: (
    <>
      <path d="M8 2.5 14.1 13H1.9z" />
      <path d="M8 6.5v3.1" />
      <path d="M8 11.5h.01" />
    </>
  ),
  chevron: <path d="M4.4 6.5 8 10.1l3.6-3.6" />,
  chevronRight: <path d="M6.5 4.4 10.1 8l-3.6 3.6" />,
  rows: (
    <>
      <path d="M2.6 4.2h10.8" />
      <path d="M2.6 8h10.8" />
      <path d="M2.6 11.8h6.6" />
    </>
  ),
  clock: (
    <>
      <circle cx="8" cy="8" r="5.6" />
      <path d="M8 4.8V8l2.3 1.4" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M8 12.8V3.4" />
      <path d="M4.4 7 8 3.4 11.6 7" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M8 3.2v9.4" />
      <path d="M4.4 9 8 12.6 11.6 9" />
    </>
  ),
  /* 顶栏身份方块的图标（日志 = 一份按行排的文件）。
     ⚠️ 原来是 📋 emoji：它自带颜色、**不参与 `color`**，`.viewer-ico` 那层染底与文字色对它完全无效。 */
  doc: (
    <>
      <path d="M3.8 2.6h5.6l3 3v7.8H3.8z" />
      <path d="M9.4 2.6v3.2h3" />
      <path d="M6.1 8.4h4.2M6.1 10.8h2.8" />
    </>
  ),
  plus: <path d="M8 3.6v8.8M3.6 8h8.8" />,
}

type LgIconName = keyof typeof LG_ICON

function LgIcon({ name }: { name: LgIconName }) {
  return (
    <svg className="ico-svg" viewBox="0 0 16 16" aria-hidden="true">
      {LG_ICON[name]}
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * 分组（左栏那个分组 + 弹窗里的「分组」字段）
 *
 * ⚠️ 这一版原型的**分组是"名字"**，不是枚举：左栏的组由数据里出现的名字现算
 *    （顺序 = 内置组的顺序 → 会话里新出现的名字 → 「自定义」永远最后），
 *    弹窗里的胶囊就是这台服务器**当前看得见的那些组名**。
 *    与部署页把新组插在「其它」之前是同一条规矩 —— 兜底组必须永远在最后。
 * ------------------------------------------------------------------ */

/** 内置六组的**显示名**（`LOG_GROUP_LABEL`）→ 组 key。用来把名字落回 `LogSource.group`。 */
const GROUP_KEY_OF_LABEL: Record<string, LogGroupKey> = Object.fromEntries(
  LOG_GROUP_ORDER.map((k) => [LOG_GROUP_LABEL[k], k]),
) as Record<string, LogGroupKey>

/** 内置组的显示名，按 `LOG_GROUP_ORDER` 排（去掉兜底的「自定义」）。 */
const BUILTIN_GROUP_LABELS = LOG_GROUP_ORDER.filter((k) => k !== 'custom').map((k) => LOG_GROUP_LABEL[k])

/**
 * 从路径猜一个分组 —— 只在"用户自己还没选过"时用，而且**必须命中已有分组**才采用。
 * 猜错的代价比猜不中高得多：猜错会把它悄悄塞进一个错误的组，而用户不会去逐个复查。
 * （点「浏览服务器目录」挑到 /var/log/nginx/… 时，分组自动落成「服务日志」——
 *   路径和分组本来就是同一件事的两面。）
 *
 * ⚠️ 名字用的是本项目的 `LOG_GROUP_LABEL`（原型那份写的是「Nginx」，本项目叫「服务日志」）。
 */
const GROUP_HINTS: [RegExp, string][] = [
  [/(nginx|apache|httpd)/i, '服务日志'],
  [/(postgres|mysql|redis|mongo|\/var\/lib\/)/i, '数据库'],
  [/(pgbackrest|backrest|backup|\.dump)/i, '备份'],
  [/(\/opt\/app|app\.log|app-error)/i, '应用'],
  [/(syslog|auth\.log|kern\.log|cron\.log|daemon\.log|mail\.log|dmesg)/i, '系统'],
]

function guessGroup(path: string, names: readonly string[]): string {
  if (!path) return ''
  for (const [re, label] of GROUP_HINTS) if (re.test(path) && names.includes(label)) return label
  return ''
}

/** 组名 → `data-group` / 锚点 id 用的稳定标识（原型同款）。中文保留，其余非字母数字压成 `-`。 */
function slug(text: string): string {
  return String(text).toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-+|-+$/g, '') || 'grp'
}

/* ------------------------------------------------------------------ *
 * 取数范围 / 时间范围
 * ------------------------------------------------------------------ */

/** 读取范围的可选档。0 = 全取。原型把档位调小，是为了让"范围"与"加载更早"真的能被看见 */
const RANGE_OPTS = [20, 100, 0] as const
const RANGE_LABEL: Record<number, string> = { 20: '最近 20 行', 100: '最近 100 行', 0: '全部行' }

type TimeRange =
  | { mode: 'all' }
  | { mode: 'rel'; mins: number }
  | { mode: 'abs'; from: string; to: string }

type LevelFilter = 'all' | LogLevel

/**
 * 每台服务器各自记一份"看着哪一条、取多少、搜什么、筛哪一级、看哪一段时间"。
 * ⚠️ 切服务器不该把状态带过去（原型同样按 server 分开存）。
 */
interface ScopeState {
  activeId: string
  kw: string
  range: number
  /** false = less 式「定位」（保留全文、高亮、可跳）；true = grep 式「只看匹配」 */
  onlyMatch: boolean
  /** 当前停在第几处匹配 */
  hit: number
  time: TimeRange
  level: LevelFilter
}

const DEFAULT_SCOPE: ScopeState = {
  activeId: '',
  kw: '',
  range: 20,
  onlyMatch: false,
  hit: 0,
  time: { mode: 'all' },
  level: 'all',
}

const LEVEL_TEXT: Record<LogLevel, string> = { info: 'INFO', warn: 'WARN', error: 'ERROR' }

const pad2 = (n: number) => String(n).padStart(2, '0')

/** 分钟数 → `HH:MM`；负数（解析不出时刻）给空串 */
const hmText = (mins: number) => (mins < 0 ? '' : `${pad2(Math.floor(mins / 60))}:${pad2(mins % 60)}`)

function parseHM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}

/**
 * 行的时刻 → 当天第几分钟。
 * ⚠️ 解析不出时刻的行（如「昨天 22:41」）给 -1：跨天要完整日期才能比较，把它们排在
 *    今天任何时刻之前，于是它们只在「全部时间」下出现。
 */
function timeKeyOf(time: string): number {
  const m = /^(\d{1,2}):(\d{2})/.exec(time.trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : -1
}

/** 匹配的是**整行文本**（时间列、级别、正文都算）—— 原型明写了这条口径 */
function rowText(row: LogLine): string {
  return `${row.time} ${row.level} ${row.text} ${row.code ?? ''}`.toLowerCase()
}

/**
 * `<code>` 的状态档：HTTP 状态码按首位分档（2xx/3xx/4xx/5xx）。
 * 原型在标记里写死了 `class="s-2"`；应用里由数值推 —— 少一个要同步的字段。
 * 不是三位数的（`connect() failed` 这类）不给档，走 `.log-row code` 的常态。
 */
function codeClass(code: string | null): string | undefined {
  return code && /^[1-5]\d\d$/.test(code) ? `s-${code[0]}` : undefined
}

/* ------------------------------------------------------------------ *
 * 目录选择器用的树
 * ------------------------------------------------------------------ */

interface FsNode {
  type: 'd' | 'f'
  children: Map<string, FsNode>
  size: string
  time: string
}

const makeDir = (): FsNode => ({ type: 'd', children: new Map(), size: '', time: '' })

function fsInsert(root: FsNode, path: string, size: string, time: string) {
  const parts = path.split('/').filter(Boolean)
  let node = root
  parts.forEach((seg, i) => {
    const last = i === parts.length - 1
    if (last) {
      node.children.set(seg, { type: 'f', children: new Map(), size, time })
      return
    }
    const next = node.children.get(seg)
    if (next && next.type === 'd') {
      node = next
      return
    }
    const dir = makeDir()
    node.children.set(seg, dir)
    node = dir
  })
}

function fsNodeAt(root: FsNode, parts: string[]): FsNode | null {
  let node: FsNode = root
  for (const part of parts) {
    const next = node.children.get(part)
    if (!next || next.type !== 'd') return null
    node = next
  }
  return node
}

/* ------------------------------------------------------------------ *
 * 日志行
 * ------------------------------------------------------------------ */

/**
 * 一行日志。
 * ⚠️ 级别徽标**只在"这份格式里本来就有级别字段"时才渲染**（`leveled`）——
 *    无级别的日志靠行类名（`is-warn` / `is-error`）的左侧色条表达注意度。
 *    反过来做（无级别也硬塞一个 INFO）是在编数据。
 */
function LogRow({
  row,
  leveled,
  unloaded,
  outTime,
  hidden,
  hit,
  current,
}: {
  row: LogLine
  leveled: boolean
  unloaded: boolean
  outTime: boolean
  hidden: boolean
  hit: boolean
  current: boolean
}) {
  const cls = codeClass(row.code)
  return (
    <div
      /* ⚠️ `id` 是给 `gotoHit` 用的锚点（它只滚日志区自己的 scrollTop，
         不用 `scrollIntoView` —— 那会连带滚动所有祖先，整页会跟着跳） */
      id={`lgrow-${row.id}`}
      className={cn(
        'log-row',
        row.level !== 'info' && `is-${row.level}`,
        unloaded && 'is-unloaded',
        hit && 'is-hit',
        current && 'is-current',
      )}
      data-tk={timeKeyOf(row.time)}
      data-out-time={outTime ? '1' : undefined}
      hidden={hidden}
    >
      <span className="log-time">{row.time}</span>
      {leveled ? <span className={cn('log-level', row.level)}>{LEVEL_TEXT[row.level]}</span> : null}
      <span className="log-msg">
        {row.text}
        {row.code ? <code className={cls}>{row.code}</code> : null}
      </span>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 弹窗 / 提示条的视图模型
 * ------------------------------------------------------------------ */

type Dialog =
  | { kind: 'add' }
  | { kind: 'edit'; source: LogSource }
  | { kind: 'rename'; source: LogSource }
  | { kind: 'delete'; source: LogSource }

interface ToastState {
  id: number
  msg: string
  type: 'ok' | 'info' | 'warn'
  action?: { label: string; run: () => void }
}

const TOAST_ICON: Record<ToastState['type'], LgIconName> = { ok: 'check', info: 'info', warn: 'warn' }

/* ================================================================== *
 * 页面
 * ================================================================== */

export function LogViewerPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError } = useProjectDetail(id)
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)

  useDocumentTitle(`日志 · ${data?.project.name ?? ''} · Lucky-Y`)

  /** 只列**有日志源**的机器：停机的测试机没有日志可看，列进分段就是永远空白一页 */
  const servers = useMemo(
    () => (data ? buildServers(data.project).filter((s) => (LOG_SOURCES[s.role] ?? []).length > 0) : []),
    [data],
  )

  const [serverId, setServerId] = useState<string | null>(null)
  const current: ServerItem | null = servers.find((s) => s.id === serverId) ?? servers[0] ?? null

  /* ---- 会话内的改动：新增 / 移除 / 改名改路径 / 跟随进来的行。**都不落盘**（静态页） ---- */
  const [added, setAdded] = useState<Record<string, LogSource[]>>({})
  const [removed, setRemoved] = useState<Record<string, string[]>>({})
  /* 改名 / 改路径 / 改分组。⚠️ `group` 存的是**组名**（可能不是内置那六个），所以它
     不能直接 spread 回 `LogSource.group`（那是 `LogGroupKey` 联合）—— 见下面的 `sources` 与
     `labelOf`，那两处各取各的字段。 */
  const [patches, setPatches] = useState<Record<string, { name?: string; path?: string; group?: string }>>({})
  const [live, setLive] = useState<Record<string, LogLine[]>>({})
  const [liveSource, setLiveSource] = useState<string | null>(null)
  const [scopes, setScopes] = useState<Record<string, ScopeState>>({})
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({})
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [toastState, setToastState] = useState<ToastState | null>(null)
  const [lastSync, setLastSync] = useState('最后更新 —')
  const [refreshing, setRefreshing] = useState(false)
  const searchRef = useRef<HTMLInputElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const toastSeq = useRef(0)
  const toastTimer = useRef<number | null>(null)

  const scope: ScopeState = (current && scopes[current.id]) || DEFAULT_SCOPE
  const patch = useCallback(
    (next: Partial<ScopeState>) => {
      if (!current) return
      setScopes((prev) => ({ ...prev, [current.id]: { ...(prev[current.id] ?? DEFAULT_SCOPE), ...next } }))
    },
    [current],
  )

  /* ---- 提示条（页面局部那一套：支持图标与动作按钮） ---- */
  const showToast = useCallback((msg: string, type: ToastState['type'] = 'ok', action?: ToastState['action']) => {
    toastSeq.current += 1
    setToastState({ id: toastSeq.current, msg, type, action })
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    /* 给了动作就延长停留时间 —— 撤销是个"要看清再点"的动作，2.4 秒来不及反应 */
    toastTimer.current = window.setTimeout(() => setToastState(null), action ? 6000 : 2400)
  }, [])
  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    },
    [],
  )

  /* ---- 当前这一台的日志源 = 派生的 + 会话里新增的 − 移除的，再叠上改名/改路径 ---- */
  const sources = useMemo(() => {
    if (!current || !data) return []
    const base = buildLogSources(data.project, current)
    const gone = new Set(removed[current.id] ?? [])
    return [...base, ...(added[current.id] ?? [])]
      .filter((s) => !gone.has(s.id))
      /* ⚠️ 逐字段合并，**不要 `...patches[s.id]`** —— `patches.group` 是一个组名，
         摊进 `LogSource.group`（`LogGroupKey` 联合）既是类型错误、也会污染分组推导 */
      .map((s) => {
        const p = patches[s.id]
        return p ? { ...s, name: p.name ?? s.name, path: p.path ?? s.path } : s
      })
  }, [current, data, added, removed, patches])

  /** 这一条路径现在归在哪个组（组名）。会话里改过分组就以改的为准。 */
  const labelOf = useCallback(
    (s: LogSource) => patches[s.id]?.group ?? LOG_GROUP_LABEL[s.group],
    [patches],
  )

  const active = sources.find((s) => s.id === scope.activeId) ?? sources[0] ?? null
  const following = liveSource === active?.id

  /**
   * 左栏分组：**空组不渲染**（这是列表分组，不是筛选器）。
   *
   * 顺序 = 内置组（`LOG_GROUP_ORDER` 排，去掉兜底的「自定义」）→ 会话里新出现的组名
   * （按它在数据里第一次出现的顺序）→「自定义」永远最后。
   * ⚠️ 组名是**现算**的，不另存一份"分组清单"：那份清单在用户改了一条路径的分组之后
   *    立刻会和列表对不上。
   */
  const groups = useMemo(() => {
    const buckets = new Map<string, LogSource[]>()
    sources.forEach((s) => {
      const label = labelOf(s)
      const arr = buckets.get(label)
      if (arr) arr.push(s)
      else buckets.set(label, [s])
    })
    const order = [...BUILTIN_GROUP_LABELS]
    sources.forEach((s) => {
      const label = labelOf(s)
      /* ⚠️「自定义」不参与这一段：它必须**永远在最后**（与部署页把新组插在「其它」之前同一条）。
         让它按"第一次出现的位置"排的话，某台机器上它可能排到用户新建的组前面去。 */
      if (label !== LOG_GROUP_LABEL.custom && !order.includes(label)) order.push(label)
    })
    order.push(LOG_GROUP_LABEL.custom)
    return order
      .filter((label) => (buckets.get(label)?.length ?? 0) > 0)
      .map((label) => ({ key: slug(label), label, items: buckets.get(label) ?? [] }))
  }, [sources, labelOf])

  /** 弹窗里「分组」那排胶囊可选的名字：这台服务器**当前看得见的**组名 + 兜底的「自定义」 */
  const groupChoices = useMemo(() => {
    const names = groups.map((g) => g.label)
    if (!names.includes(LOG_GROUP_LABEL.custom)) names.push(LOG_GROUP_LABEL.custom)
    return names
  }, [groups])

  /* ---- 本份日志要显示的全部行：跟随进来的在前（最新在最上面），然后是数据里的 ---- */
  const liveRows = active ? (live[active.id] ?? []) : []
  const allRows = useMemo(() => (active ? [...liveRows, ...active.lines] : []), [active, liveRows])

  /**
   * 视图推导 —— 原型的 `refreshScope()` 那一段在这里变成**纯计算**。
   *
   * ⚠️ 顺序不能乱：`先按时间圈 → 再取最近 N 行 → 再按级别/关键词筛`。
   *    三个条件各走各的通道：时间外 → `hidden`；这一段里没取回 → `is-unloaded`；
   *    被筛掉 → `hidden`。混用会让"载入了多少"与"筛掉了多少"说不清。
   */
  const view = useMemo(() => {
    const kw = scope.kw.trim().toLowerCase()
    const leveled = active?.leveled ?? false

    /* ① 时间窗。基准是**本份日志最新一行的时刻**（定义见文件头） */
    let win: { lo: number; hi: number } | null = null
    if (scope.time.mode === 'abs') {
      const lo = scope.time.from ? parseHM(scope.time.from) : null
      const hi = scope.time.to ? parseHM(scope.time.to) : null
      if (lo !== null || hi !== null) {
        win = { lo: lo === null ? -Infinity : lo, hi: hi === null ? Infinity : hi }
      }
    } else if (scope.time.mode === 'rel') {
      const latest = allRows.reduce((acc, r) => Math.max(acc, timeKeyOf(r.time)), -1)
      if (latest >= 0) win = { lo: latest - scope.time.mins, hi: Infinity }
    }
    const inWindow = allRows.map((r) => {
      if (!win) return true
      const key = timeKeyOf(r.time)
      return key >= 0 && key >= win.lo && key <= win.hi
    })
    const inWs = allRows.filter((_, i) => inWindow[i])

    /* ② 取数范围。列表**新的在上**，所以「最近 N 行」是前 N 行 */
    const keep = scope.range > 0 ? Math.min(scope.range, inWs.length) : inWs.length
    const cut = inWs.length - keep
    const loaded = inWs.slice(0, keep)
    const loadedIds = new Set(loaded.map((r) => r.id))

    /* ③ 级别计数（跟关键词走，保证"数字 = 点下去能看到几条"） */
    const counts: Record<LevelFilter, number> = { all: 0, info: 0, warn: 0, error: 0 }
    allRows.forEach((row, i) => {
      if (!inWindow[i] || !loadedIds.has(row.id)) return
      if (kw && !rowText(row).includes(kw)) return
      counts.all += 1
      counts[row.level] += 1
    })

    /* ④ 命中：范围之外的行**不参与命中**（它压根没被取回来） */
    const hitsAll = loaded.filter((r) => kw && rowText(r).includes(kw))
    const hiddenIds = new Set<string>()
    let shown = 0
    loaded.forEach((row) => {
      const okLevel = !leveled || scope.level === 'all' || row.level === scope.level
      /* 默认（定位）**不隐藏任何行** —— 那正是 less 的 / 与 n。只有「只看匹配」才过滤 */
      const okKw = !kw || !scope.onlyMatch || rowText(row).includes(kw)
      if (okLevel && okKw) shown += 1
      else hiddenIds.add(row.id)
    })
    /* 可跳转的命中 = 当前**真的看得见**的那些：被级别筛选挡掉的不算，
       否则「下一个」会跳到一条看不见的线上，表现成"点了没反应" */
    const hits = hitsAll.filter((r) => !hiddenIds.has(r.id))
    const hitIndex = hits.length ? scope.hit % hits.length : 0
    const currentHitId = hits[hitIndex]?.id ?? null

    /* ⑤ 没载入的行数 / 时间范围外的行数 —— 0 命中时要说清"它没搜哪里" */
    const missLoad = inWs.length - keep
    const outTime = allRows.length - inWs.length

    const filtered = (leveled && scope.level !== 'all') || (scope.onlyMatch && !!kw)
    const stat = (() => {
      const head = cut ? `已载入 ${loaded.length} / ${inWs.length} 行` : `共 ${inWs.length} 行`
      return `${head}${filtered ? ` · 显示 ${shown} 行` : ''} · 最后更新 ${liveRows.length ? '刚刚' : (active?.updatedText ?? '—')}`
    })()

    return { kw, leveled, inWindow, loaded, loadedIds, inWs: inWs.length, cut, counts, hits, hitIndex, currentHitId, hiddenIds, shown, missLoad, outTime, stat }
  }, [active, allRows, liveRows.length, scope])

  /* 每台的告警/错误合计 —— 分段上那颗黄点要在**没选它的时候**也亮着 */
  const tallies = useMemo(() => {
    const out: Record<string, { warn: number; error: number }> = {}
    if (!data) return out
    servers.forEach((server) => {
      const gone = new Set(removed[server.id] ?? [])
      let warn = 0
      let error = 0
      ;[...buildLogSources(data.project, server), ...(added[server.id] ?? [])]
        .filter((s) => !gone.has(s.id))
        .forEach((source) => {
          ;[...(live[source.id] ?? []), ...source.lines].forEach((row) => {
            if (row.level === 'error') error += 1
            else if (row.level === 'warn') warn += 1
          })
        })
      out[server.id] = { warn, error }
    })
    return out
  }, [data, servers, added, removed, live])

  /* ---- 实时跟随：每 2.4 秒插一行，行文取自**这条日志自己的模板池** ---- */
  useEffect(() => {
    if (!liveSource) return
    const source = sources.find((s) => s.id === liveSource)
    if (!source) return
    const pool = LOG_LINES[source.kind] ?? []
    if (!pool.length) return
    let seq = 0
    const timer = window.setInterval(() => {
      const seed = pool[seq++ % pool.length]
      if (!seed) return
      const [code, text] = splitLogText(seed.text)
      const now = new Date()
      const row: LogLine = {
        id: `${source.id}-live-${seq}`,
        time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}:${pad2(now.getSeconds())}`,
        level: seed.level,
        text,
        code,
      }
      setLive((prev) => ({
        ...prev,
        /* 上限 200 行 —— 跟随开一下午不该把内存吃满（原型同款） */
        [source.id]: [row, ...(prev[source.id] ?? [])].slice(0, 200),
      }))
      contentRef.current?.scrollTo({ top: 0 })
    }, 2400)
    return () => window.clearInterval(timer)
  }, [liveSource, sources])

  /* 切服务器就把跟随停掉：否则回来时会在另一台的列表里看到上一台的行 */
  useEffect(() => {
    setLiveSource(null)
  }, [current?.id])

  /* 「最后更新」初值：真实时刻（这是页面状态，不是数据） */
  useEffect(() => {
    if (lastSync !== '最后更新 —') return
    const d = new Date()
    setLastSync(`最后更新 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`)
  }, [lastSync])

  /* ---- 键盘 ---- */
  const gotoHit = useCallback(
    (dir: number) => {
      const n = view.hits.length
      if (!n) return
      const next = (view.hitIndex + dir + n) % n
      patch({ hit: next })
      const target = document.getElementById(`lgrow-${view.hits[next]?.id ?? ''}`)
      const box = contentRef.current
      if (!target || !box) return
      /* ⚠️ 只动日志区自己的 scrollTop：`scrollIntoView` 会连带滚动所有祖先，整页会跟着跳 */
      const b = box.getBoundingClientRect()
      const r = target.getBoundingClientRect()
      box.scrollTop += r.top - b.top - box.clientHeight / 2 + r.height / 2
    },
    [patch, view.hitIndex, view.hits],
  )

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        /* ⚠️ 目录选择器里的 Escape 是"退回表单"，由 `LogDialog` 自己用**捕获阶段**
           的监听处理掉（它先于这里这条冒泡监听），所以这里只当"弹窗还开着" */
        if (dialog) {
          setDialog(null)
          return
        }
        /* 弹窗都关着时，Escape 顺手清掉搜索 —— 快捷键提示写在框里，行为就得跟上 */
        if (scope.kw) patch({ kw: '', hit: 0 })
        return
      }
      const target = event.target as HTMLElement
      const tag = (target.tagName || '').toLowerCase()
      const typing = tag === 'input' || tag === 'select' || tag === 'textarea'
      /* less 的 n / N。⚠️ 只在"搜索有值 + 焦点不在输入类控件里"时接管，
         否则在搜索框里打字母 n 会被当成跳转 */
      if (!event.metaKey && !event.ctrlKey && !event.altKey && scope.kw && !typing) {
        if (event.key === 'n') {
          event.preventDefault()
          gotoHit(1)
          return
        }
        if (event.key === 'N') {
          event.preventDefault()
          gotoHit(-1)
          return
        }
      }
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'f') {
        if (!searchRef.current) return
        event.preventDefault()
        searchRef.current.focus()
        searchRef.current.select()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [dialog, gotoHit, patch, scope.kw])

  /* ---- 动作 ---- */
  const from = (location.state as { from?: string } | null)?.from
  const goBack = () => navigate(from ?? `/work/projects/${id ?? ''}`)

  const refresh = () => {
    if (refreshing) return
    setRefreshing(true)
    setLastSync('正在同步…')
    window.setTimeout(() => {
      setRefreshing(false)
      const d = new Date()
      setLastSync(`最后更新 ${pad2(d.getHours())}:${pad2(d.getMinutes())}`)
      showToast('日志已刷新')
    }, 700)
  }

  const copyPath = () => {
    if (!active?.path) return
    navigator.clipboard?.writeText(active.path).then(
      () => showToast('已复制路径'),
      () => showToast('复制失败，请手动选择', 'warn'),
    )
  }

  const setRange = (value: number) => {
    /* 换了视野，之前记的「第几处」作废 —— 否则会指着一条已经不在视野里的行 */
    patch({ range: value, hit: 0 })
  }

  /** 「加载更早」= 提到下一档。select 始终是唯一真相源，按钮只是它的快捷方式 */
  const loadEarlier = () => {
    const cur = scope.range
    if (!cur) return
    const bigger = RANGE_OPTS.filter((v) => v !== 0 && v > cur)
    const next = bigger.length ? Math.min(...bigger) : 0
    patch({ range: next, hit: 0 })
    /* 报的是**时间范围内**的总行数 —— 时间范围就是这个视图的边界（与标题行同一个口径） */
    showToast(`已加载${RANGE_LABEL[next]}（共 ${view.inWs} 行）`, 'info')
  }

  const setFindMode = (mode: 'locate' | 'filter') => patch({ onlyMatch: mode === 'filter', hit: 0 })

  const toggleLive = () => {
    if (!active) return
    if (following) {
      setLiveSource(null)
      showToast('已停止实时跟随', 'info')
      return
    }
    /* ⚠️ 实时跟随与固定时间窗是**互斥的意图**：一边接新写入的行、一边只让旧区间可见，
       结果是"看着像没反应"。所以开启跟随就把它切回全部时间，并说明为什么。 */
    const needReset = scope.time.mode !== 'all'
    if (needReset) patch({ time: { mode: 'all' }, hit: 0 })
    setLiveSource(active.id)
    /* ⚠️「本地模拟」这句不能丢：这一次点击是用户形成"它连上了服务器"这个印象的
       **唯一时刻**。路径不写进提示里 —— 它就在正文标题旁边。 */
    showToast(`已开始实时跟随${needReset ? ' · 时间范围已切回全部' : ''}（本地模拟）`)
  }

  const removeSource = (source: LogSource) => {
    if (!current) return
    const wasActive = active?.id === source.id
    const inAdded = (added[current.id] ?? []).some((s) => s.id === source.id)
    if (inAdded) {
      setAdded((prev) => ({ ...prev, [current.id]: (prev[current.id] ?? []).filter((s) => s.id !== source.id) }))
      setLive((prev) => {
        const next = { ...prev }
        delete next[source.id]
        return next
      })
    } else {
      setRemoved((prev) => ({ ...prev, [current.id]: [...(prev[current.id] ?? []), source.id] }))
    }
    if (wasActive) {
      const next = sources.find((s) => s.id !== source.id)
      if (next) patch({ activeId: next.id, hit: 0, level: 'all' })
      else setLiveSource(null)
    }
    if (liveSource === source.id) setLiveSource(null)
    showToast(`已移除「${source.name}」`, 'ok', {
      label: '撤销',
      run: () => {
        if (inAdded) setAdded((prev) => ({ ...prev, [current.id]: [...(prev[current.id] ?? []), source] }))
        else
          setRemoved((prev) => ({
            ...prev,
            [current.id]: (prev[current.id] ?? []).filter((x) => x !== source.id),
          }))
        showToast(`已恢复「${source.name}」`)
      },
    })
  }

  const addSource = (name: string, path: string, group: string) => {
    if (!current) return
    const groupName = group.trim() || LOG_GROUP_LABEL.custom
    const source: LogSource = {
      id: `${current.id}-custom-${Date.now().toString(36)}`,
      /* 新增的路径没有专属行模板 —— 跟随的行先按「应用日志」那一套出 */
      kind: 'app',
      /* 但**分组**不能跟着 kind 走：它的格式未知，归到"应用日志"是编的。
         内置六组之一就落回 key；用户新建的组名落不回 key ⇒ 记 `custom` + 下面的 patches 覆盖。
         （左栏读的始终是**组名**，见 `labelOf`。） */
      group: GROUP_KEY_OF_LABEL[groupName] ?? 'custom',
      name: name || (path.split('/').filter(Boolean).pop() ?? path),
      path,
      /* ⚠️ 大小未知 —— 显示 `—`，不编一个"18 MB" */
      sizeText: '—',
      updatedText: '刚刚',
      /* 也不假设它的格式里有级别字段 */
      leveled: false,
      lines: [],
    }
    setAdded((prev) => ({ ...prev, [current.id]: [...(prev[current.id] ?? []), source] }))
    /* 只有组名推不回 key 时才需要覆盖 —— 能推出来的时候 `labelOf` 已经给出同一个名字了 */
    if (GROUP_KEY_OF_LABEL[groupName] !== source.group) {
      setPatches((prev) => ({ ...prev, [source.id]: { ...prev[source.id], group: groupName } }))
    }
    patch({ activeId: source.id, kw: '', level: 'all', range: 20, hit: 0, time: { mode: 'all' } })
    setLiveSource(source.id)
    showToast(`已添加「${source.name}」到「${groupName}」`)
  }

  /* ---- 目录选择器的树：按这台服务器声明过的路径 + 已加进来的路径现搭 ---- */
  const fsRoot = useMemo(() => {
    const root = makeDir()
    if (!current) return root
    const seeds = LOG_SOURCES[current.role] ?? []
    seeds.forEach((seed) => fsInsert(root, seed.path, `${seed.sizeMb} MB`, `最后写入 ${seed.updatedMins} 分钟前`))
    sources.forEach((s) => fsInsert(root, s.path, s.sizeText, `更新于 ${s.updatedText}`))
    return root
  }, [current, sources])

  /* ---- 弹窗浮层。**必须作为 overlay 交给窗框**：窗框带 transform，
      `position: fixed` 的包含块就变成了窗口 —— 于是内核那条 `.modal-mask { inset: 0 }`
      正好盖住**窗口**（macOS 的 sheet）。留在外面会连窗框一起压黑。 ---- */
  const overlay = (
    <>
      {dialog ? (
        <LogDialog
          dialog={dialog}
          server={current}
          sources={sources}
          fsRoot={fsRoot}
          groups={groupChoices}
          currentGroup={dialog.kind === 'edit' ? labelOf(dialog.source) : ''}
          onClose={() => setDialog(null)}
          onToast={showToast}
          onSubmit={(name, path, group) => {
            if (dialog.kind === 'add') addSource(name, path, group)
            else if (dialog.kind === 'edit') {
              /* 分组也能改：改了之后原组若空了，它自己就不在左栏出现了（空组不渲染） */
              setPatches((prev) => ({ ...prev, [dialog.source.id]: { name, path, group } }))
              showToast(`已更新「${name}」`)
            } else if (dialog.kind === 'rename') {
              setPatches((prev) => ({ ...prev, [dialog.source.id]: { ...prev[dialog.source.id], name } }))
              showToast(`已重命名为「${name}」`)
            } else if (dialog.kind === 'delete') removeSource(dialog.source)
            setDialog(null)
          }}
        />
      ) : null}

      {/* 提示条：位置固定在窗口底部（原型同款）。它必须是窗框的后代 —— 否则会浮到窗口之外 */}
      <div
        className={cn('toast', toastState && 'show')}
        data-type={toastState?.type ?? 'ok'}
        role="status"
        aria-live="polite"
      >
        {toastState ? (
          <>
            <span className="toast-ico" aria-hidden="true">
              <LgIcon name={TOAST_ICON[toastState.type]} />
            </span>
            <span>{toastState.msg}</span>
            {toastState.action ? (
              <button
                type="button"
                className="toast-act"
                onClick={() => {
                  const run = toastState.action?.run
                  setToastState(null)
                  run?.()
                }}
              >
                {toastState.action.label}
              </button>
            ) : null}
          </>
        ) : null}
      </div>
    </>
  )

  if (isLoading || (!data && !isError)) {
    return (
      <div className="mw-root lg-root" data-module="work">
        <MacWindow title="日志" onClose={goBack} icon="📋">
          <div className="viewer">
            <main className="viewer-main">
              <div className="log-side">
                <div className="log-waiting">
                  <span className="log-waiting-dot" aria-hidden="true" />
                  <span>正在读取项目…</span>
                </div>
              </div>
            </main>
          </div>
        </MacWindow>
      </div>
    )
  }

  const serverTally = current ? (tallies[current.id] ?? { warn: 0, error: 0 }) : { warn: 0, error: 0 }
  const isEmpty = sources.length === 0
  const timeSelValue = scope.time.mode === 'abs' ? 'custom' : scope.time.mode === 'rel' ? String(scope.time.mins) : 'all'

  return (
    <div className="mw-root lg-root" data-module="work">
      <MacWindow
        title={`${data?.project.name ?? '项目'} · 日志`}
        subtitle={current?.name}
        icon="📋"
        onClose={goBack}
        overlay={overlay}
      >
        <div className="viewer">
          <header className="viewer-bar">
            {/* 身份块：哪个项目 / 这一页是什么。窗框标题栏也有它 —— 那是"窗口叫什么"，
                这一条是"页面在说什么"，与浏览器里「标签页标题 + 页头」的关系一致。
                ⚠️ 分区名是**一枚标签**（`.viewer-scope`），不拼进标题——拼进去会占掉项目名的宽度 */}
            <div className="viewer-id">
              <span className="viewer-ico" aria-hidden="true">
                <LgIcon name="doc" />
              </span>
              <span className="viewer-name" title={`${data?.project.name ?? '项目'} · 日志`}>
                {data?.project.name ?? '项目'}
              </span>
              <span className="viewer-scope">日志</span>
            </div>

            <div className="seg" role="tablist" aria-label="选择服务器">
              {servers.map((server) => {
                const on = current?.id === server.id
                const hasError = (tallies[server.id]?.error ?? 0) > 0
                return (
                  <button
                    key={server.id}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    data-server={server.id}
                    className={cn('seg-btn', on && 'active')}
                    onClick={() => setServerId(server.id)}
                  >
                    <span className={cn('seg-dot', hasError && 'warn')} aria-hidden="true" />
                    {server.name}
                  </button>
                )
              })}
            </div>

            <div className="viewer-actions">
              <span className="last-sync">{lastSync}</span>
              <button type="button" className="log-tool" title="刷新日志" onClick={refresh}>
                <span className="log-tool-ico" aria-hidden="true">
                  <LgIcon name="refresh" />
                </span>
                刷新
              </button>
              <span className="bar-sep" aria-hidden="true" />
              {/* 外观照原型（`.theme-toggle` + 月亮/太阳），实现用应用的主题 store —— 见文件头 ② */}
              <button
                type="button"
                className="theme-toggle"
                aria-label={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
                aria-pressed={theme === 'dark'}
                title={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
                onClick={toggleTheme}
              >
                <LgIcon name={theme === 'light' ? 'moon' : 'sun'} />
              </button>
              {/* 窗口级动作：方形图标按钮。关闭是破坏性动作 ⇒ 平时中性、hover 才转 danger */}
              <button
                type="button"
                className="icon-btn danger"
                title="关闭这个日志窗口（返回运维页）"
                aria-label="关闭这个日志窗口"
                onClick={goBack}
              >
                <LgIcon name="close" />
              </button>
            </div>
          </header>

          <main className="viewer-main">
            {!data ? (
              <div className="log-waiting">
                <span aria-hidden="true">⚠︎</span>
                <span>项目加载失败 —— 检查地址里的项目 id，或返回运维页重进</span>
              </div>
            ) : !servers.length ? (
              <div className="log-waiting">
                <span aria-hidden="true">🗂</span>
                <span>这个项目没有配日志的服务器</span>
              </div>
            ) : (
              <div className="log-scope" data-server={current?.id}>
                {/* ============ 左栏：选哪份文件 ============ */}
                <aside className="log-side">
                  <div className="log-side-head">
                    <span className="log-side-title">日志文件</span>
                    <span className="log-side-num">{sources.length}</span>
                    <button
                      type="button"
                      className="log-side-add"
                      title="新增日志路径"
                      aria-label="新增日志路径"
                      onClick={() => setDialog({ kind: 'add' })}
                    >
                      ＋
                    </button>
                  </div>

                  {/* ⚠️ 分组包装层是 `role="presentation"`：`tablist` 的语义子节点应当只有 tab，
                      中间这一层不该冒出一个"无名分组"让读屏多念一遍 */}
                  <div className="log-src-list" role="tablist" aria-label="日志文件列表">
                    {groups.map((group) => {
                      const gkey = `${current?.id}:${group.key}`
                      const open = !collapsedGroups[gkey]
                      const err = group.items.reduce((acc, s) => acc + (live[s.id] ?? []).length + s.lines.filter((r) => r.level === 'error').length, 0)
                      return (
                        <div key={group.key} className="log-group" data-group={group.key} role="presentation">
                          <button
                            type="button"
                            className="log-group-head"
                            aria-expanded={open}
                            aria-controls={`grp-${gkey}`}
                            onClick={() => setCollapsedGroups((prev) => ({ ...prev, [gkey]: open }))}
                          >
                            <span className="log-group-mark" aria-hidden="true" />
                            {/* 组名是**算出来的那个名字**（可能是用户新建的组），不是 `kind` —— 左栏是给人扫的 */}
                            <span className="log-group-name">{group.label}</span>
                            <span className="log-group-n">{group.items.length} 项</span>
                            <span className="log-group-err" hidden={err === 0}>
                              {err} 错误
                            </span>
                            <span className="log-group-chev" aria-hidden="true">
                              <LgIcon name="chevron" />
                            </span>
                          </button>

                          <div className="log-group-items" id={`grp-${gkey}`} role="presentation">
                            {group.items.map((source) => {
                              const on = active?.id === source.id
                              const srcErr =
                                (live[source.id] ?? []).filter((r) => r.level === 'error').length +
                                source.lines.filter((r) => r.level === 'error').length
                              return (
                                <div key={source.id} className="log-item" role="presentation">
                                  <button
                                    type="button"
                                    role="tab"
                                    aria-selected={on}
                                    className={cn('log-src', on && 'active')}
                                    data-log={source.id}
                                    data-err={srcErr > 0 ? String(srcErr) : undefined}
                                    /* 列表里不显示路径，但悬停能看到（含这一份的 ERROR 条数） */
                                    title={srcErr > 0 ? `${source.path} · ${srcErr} 条 ERROR` : source.path}
                                    onClick={() => {
                                      setLiveSource(null)
                                      patch({ activeId: source.id, level: 'all', hit: 0 })
                                    }}
                                  >
                                    <span className="log-src-name">{source.name}</span>
                                    <span className="log-src-meta">
                                      <span className="log-src-size">{source.sizeText}</span>
                                      <span className="log-src-sep" aria-hidden="true">
                                        ·
                                      </span>
                                      <span className="log-src-time">{source.updatedText}</span>
                                    </span>
                                  </button>
                                  <div className="log-src-actions">
                                    <button
                                      type="button"
                                      className="log-src-act"
                                      title="编辑日志路径"
                                      aria-label={`编辑「${source.name}」的日志路径`}
                                      onClick={() => setDialog({ kind: 'edit', source })}
                                    >
                                      <LgIcon name="pencil" />
                                    </button>
                                    <button
                                      type="button"
                                      className="log-src-act danger"
                                      title="移除日志路径"
                                      aria-label={`移除「${source.name}」`}
                                      onClick={() => setDialog({ kind: 'delete', source })}
                                    >
                                      <LgIcon name="close" />
                                    </button>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  <button type="button" className="log-side-foot" onClick={() => setDialog({ kind: 'add' })}>
                    ＋ 新增日志路径
                  </button>
                </aside>

                {/* ============ 右栏：看哪些行 + 这台机器的底细 ============ */}
                <section className="log-main">
                  <div className="log-main-head" data-empty={isEmpty || undefined}>
                    <div className="log-main-title">
                      <span className="log-main-name">{isEmpty ? '没有日志路径' : (active?.name ?? '—')}</span>
                      {!isEmpty ? <code className="log-main-path">{active?.path ?? ''}</code> : null}
                    </div>
                    <div className="log-main-actions">
                      <span className="log-live" hidden={!following} title="新行会插到列表最前面">
                        <span className="log-live-dot" aria-hidden="true" />
                        实时
                      </span>
                      {!isEmpty ? <span className="log-main-stat">{view.stat}</span> : null}
                      <span className="bar-sep" aria-hidden="true" />
                      <button
                        type="button"
                        className={cn('log-tool', following && 'on')}
                        data-live={following || undefined}
                        aria-pressed={following}
                        title={
                          following
                            ? '点击停止跟随'
                            : '每 2.4 秒把该日志的一行插到最前面。本地模拟：行文来自该格式的行模板池，未连接服务器'
                        }
                        onClick={toggleLive}
                      >
                        <span className="log-tool-ico" aria-hidden="true">
                          <LgIcon name="play" />
                        </span>
                        {following ? '停止' : '跟随'}
                      </button>
                      <button
                        type="button"
                        className="log-tool"
                        title="重命名这条日志"
                        onClick={() => (active ? setDialog({ kind: 'rename', source: active }) : null)}
                      >
                        <span className="log-tool-ico" aria-hidden="true">
                          <LgIcon name="pencil" />
                        </span>
                        重命名
                      </button>
                      <button
                        type="button"
                        className="log-tool"
                        title="下载日志文件"
                        onClick={() => showToast('下载：日志文件在服务器上，索引里没有副本', 'info')}
                      >
                        <span className="log-tool-ico" aria-hidden="true">
                          <LgIcon name="download" />
                        </span>
                        下载
                      </button>
                      <button type="button" className="log-tool" title="复制完整路径" onClick={copyPath}>
                        <span className="log-tool-ico" aria-hidden="true">
                          <LgIcon name="copy" />
                        </span>
                        复制路径
                      </button>
                    </div>
                  </div>

                  <div className="log-toolbar" data-lvl={!isEmpty && active?.leveled ? 'full' : 'none'}>
                    {/* 取数范围（tail -n N）。⚠️ 它是**唯一真相源**，「加载更早」只是它的快捷方式 */}
                    <span className="read-range">
                      <span className="rr-ico" aria-hidden="true">
                        <LgIcon name="rows" />
                      </span>
                      <select
                        className="rr-select"
                        aria-label="读取范围"
                        value={String(scope.range)}
                        disabled={isEmpty}
                        onChange={(event) => setRange(Number(event.target.value))}
                      >
                        {RANGE_OPTS.map((value) => (
                          <option key={value} value={value}>
                            {RANGE_LABEL[value]}
                          </option>
                        ))}
                      </select>
                      <span className="rr-chev" aria-hidden="true">
                        <LgIcon name="chevron" />
                      </span>
                    </span>

                    {/* 时间范围。⚠️ 它是取数条件、不是又一层筛选，所以与上面那个是两个独立控件 */}
                    <span className="time-range">
                      <span className="rr-ico" aria-hidden="true">
                        <LgIcon name="clock" />
                      </span>
                      <select
                        className="tr-select"
                        aria-label="时间范围"
                        value={timeSelValue}
                        disabled={isEmpty}
                        onChange={(event) => {
                          const value = event.target.value
                          if (value === 'custom') {
                            /* 打开自定义行时预填**当前可见的整段跨度** —— 从"看全部"起步
                               比从空的输入框起步少想两步 */
                            const keys = allRows.map((r) => timeKeyOf(r.time)).filter((x) => x >= 0)
                            patch({
                              time: {
                                mode: 'abs',
                                from: hmText(keys.length ? Math.min(...keys) : 0),
                                to: hmText(keys.length ? Math.max(...keys) : 0),
                              },
                              hit: 0,
                            })
                          } else if (value === 'all') {
                            patch({ time: { mode: 'all' }, hit: 0 })
                          } else {
                            patch({ time: { mode: 'rel', mins: Number(value) }, hit: 0 })
                          }
                        }}
                      >
                        <option value="all">全部时间</option>
                        <option value="3">最近 3 分钟</option>
                        <option value="10">最近 10 分钟</option>
                        {/* 下拉框是唯一真相源：自定义时把这一项的文案改成**真实范围**，
                            否则控件会一直显示"自定义时间…"，而它是个动作、不是当前值 */}
                        <option value="custom">
                          {scope.time.mode === 'abs' ? `${scope.time.from} – ${scope.time.to}` : '自定义时间…'}
                        </option>
                      </select>
                      <span className="rr-chev" aria-hidden="true">
                        <LgIcon name="chevron" />
                      </span>
                    </span>

                    <div className={cn('search-wrap', scope.kw && 'has-value')}>
                      <span className="search-ico" aria-hidden="true">
                        <LgIcon name="search" />
                      </span>
                      <input
                        ref={searchRef}
                        type="text"
                        className="log-search"
                        value={scope.kw}
                        placeholder="搜索日志"
                        autoComplete="off"
                        aria-label="搜索日志内容"
                        onChange={(event) => patch({ kw: event.target.value, hit: 0 })}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter') return
                          event.preventDefault()
                          gotoHit(event.shiftKey ? -1 : 1)
                        }}
                      />
                      <kbd className="search-kbd" aria-hidden="true">
                        ⌘F
                      </kbd>
                      <button
                        type="button"
                        className="search-clear"
                        title="清空搜索（Esc）"
                        aria-label="清空搜索"
                        onClick={() => {
                          patch({ kw: '', hit: 0 })
                          searchRef.current?.focus()
                        }}
                      >
                        <LgIcon name="close" />
                      </button>
                    </div>

                    {/* 级别筛选：只在"这份格式有级别字段"时才渲染整块（见文件头） */}
                    {active?.leveled && !isEmpty ? (
                      <div className="lv-filter" role="group" aria-label="按级别筛选">
                        {(['all', 'info', 'warn', 'error'] as LevelFilter[]).map((key) => (
                          <button
                            key={key}
                            type="button"
                            className={cn('lv-btn', scope.level === key && 'active')}
                            data-lvl={key}
                            aria-pressed={scope.level === key}
                            onClick={() => patch({ level: key, hit: 0 })}
                          >
                            {key === 'all' ? '全部' : LEVEL_TEXT[key]} <span className="lv-n">{view.counts[key]}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {/* 这台机器的底细。⚠️ 标签里带「本机」—— 这两个数是**该服务器全部日志**
                        的合计，无标签会与标题行那个「共 N 行」（当前这一份）混为一谈。
                        ⚠️ 两个数字都只在 >0 时才出现（0 是噪音）。 */}
                    <div className="log-host-meta">
                      {current ? (
                        <>
                          <span className="chip" title="这台服务器的公网 IP">
                            <span>主机</span>
                            <b>{current.ip}</b>
                          </span>
                          <span className="chip" title="操作系统与机型">
                            <span>规格</span>
                            <b>{current.spec}</b>
                          </span>
                          {serverTally.warn ? (
                            <span className="chip stat warn" title="这台服务器上所有日志的告警行合计">
                              <span>本机告警</span>
                              <b>{serverTally.warn}</b>
                            </span>
                          ) : null}
                          {serverTally.error ? (
                            <span className="chip stat danger" title="这台服务器上所有日志的错误行合计">
                              <span>本机错误</span>
                              <b>{serverTally.error}</b>
                            </span>
                          ) : null}
                        </>
                      ) : null}
                    </div>

                    {/* 查找条。⚠️ 定位模式下即使 0 命中也不弹空态（正文还在，只是没高亮到），
                        那句话由这一条去说 */}
                    <div className="find-bar" hidden={!scope.kw}>
                      <span className="find-count" aria-live="polite">
                        {view.hits.length ? (
                          <>
                            <b>{view.hitIndex + 1}</b> / {view.hits.length} 处匹配
                          </>
                        ) : (
                          <>
                            没有匹配的内容
                            {/* 0 命中时最要紧的一件事：**是不是有没搜到的地方** */}
                            {view.missLoad > 0 ? ` · 还有 ${view.missLoad} 行未载入` : ''}
                            {view.outTime > 0 ? ` · 时间范围外还有 ${view.outTime} 行` : ''}
                          </>
                        )}
                      </span>
                      <span className="find-nav">
                        <button
                          type="button"
                          className="find-btn find-prev"
                          title="上一个匹配（Shift+Enter 或 N）"
                          aria-label="上一个匹配"
                          disabled={!view.hits.length}
                          onClick={() => gotoHit(-1)}
                        >
                          <LgIcon name="arrowUp" />
                        </button>
                        <button
                          type="button"
                          className="find-btn find-next"
                          title="下一个匹配（Enter 或 n）"
                          aria-label="下一个匹配"
                          disabled={!view.hits.length}
                          onClick={() => gotoHit(1)}
                        >
                          <LgIcon name="arrowDown" />
                        </button>
                      </span>
                      <span className="find-sep" aria-hidden="true" />
                      <div className="find-mode" role="group" aria-label="搜索方式">
                        <button
                          type="button"
                          className={cn('fm-btn', !scope.onlyMatch && 'active')}
                          data-mode="locate"
                          aria-pressed={!scope.onlyMatch}
                          title="保留全文，跳到匹配处"
                          onClick={() => setFindMode('locate')}
                        >
                          定位
                        </button>
                        <button
                          type="button"
                          className={cn('fm-btn', scope.onlyMatch && 'active')}
                          data-mode="filter"
                          aria-pressed={scope.onlyMatch}
                          title="只留下匹配的行"
                          onClick={() => setFindMode('filter')}
                        >
                          只看匹配
                        </button>
                      </div>
                    </div>

                    {/* 自定义时间：它占工具条的整行（`flex: 1 0 100%`） */}
                    <div className="time-bar" hidden={scope.time.mode !== 'abs'}>
                      <span className="time-bar-label">时间范围</span>
                      <input
                        type="time"
                        className="tb-input tb-from"
                        aria-label="开始时刻"
                        value={scope.time.mode === 'abs' ? scope.time.from : ''}
                        onChange={(event) =>
                          patch({
                            time: { mode: 'abs', from: event.target.value, to: scope.time.mode === 'abs' ? scope.time.to : '' },
                            hit: 0,
                          })
                        }
                      />
                      <span className="tb-dash" aria-hidden="true">
                        –
                      </span>
                      <input
                        type="time"
                        className="tb-input tb-to"
                        aria-label="结束时刻"
                        value={scope.time.mode === 'abs' ? scope.time.to : ''}
                        onChange={(event) =>
                          patch({
                            time: { mode: 'abs', from: scope.time.mode === 'abs' ? scope.time.from : '', to: event.target.value },
                            hit: 0,
                          })
                        }
                      />
                      <button type="button" className="tb-reset" onClick={() => patch({ time: { mode: 'all' }, hit: 0 })}>
                        清除
                      </button>
                    </div>
                  </div>

                  <div className={cn('log-content', refreshing && 'is-loading')} id={`logContent-${current?.id}`} ref={contentRef}>
                    {/* ⚠️ 行必须装在 `.log-pane.active` 里：原型用这一个类同时管三件事 ——
                        切 display、把行切成两列（无级别字段的日志不占级别那一格）、
                        以及把没有级别字段的正文换成等宽字体。少这一层会"看着还行但排版全错"。 */}
                    {active ? (
                      <div className="log-pane active" data-log={active.id} data-lvl={active.leveled ? 'full' : 'none'} key={active.id}>
                        {allRows.map((row, i) => {
                          const outTime = !view.inWindow[i]
                          const loaded = view.loadedIds.has(row.id)
                          const hit = !!view.kw && !outTime && loaded && rowText(row).includes(view.kw)
                          return (
                            <LogRow
                              key={row.id}
                              row={row}
                              leveled={active.leveled}
                              /* 「这一段里还没取回来」与「被筛掉」必须分开记 —— 见文件头 */
                              unloaded={!outTime && !loaded}
                              outTime={outTime}
                              hidden={
                                outTime ||
                                (!loaded ? false : view.hiddenIds.has(row.id))
                              }
                              hit={hit}
                              current={row.id === view.currentHitId}
                            />
                          )
                        })}

                        {/* 新增的路径刚接上：还没吐出第一行 */}
                        {!allRows.length ? (
                          <div className="log-waiting">
                            <span className="log-waiting-dot" aria-hidden="true" />
                            <span>已开始读取，等待第一行输出…</span>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                    {/* ⚠️ 定位模式下 0 命中不弹空态（正文还在，只是没高亮到）——
                        只有「只看匹配」才可能"正文被筛空" */}
                    {active && scope.onlyMatch && !!scope.kw && view.counts.all > 0 && view.shown === 0 ? (
                      <div className="log-noresult">
                        <div className="ico" aria-hidden="true">
                          <LgIcon name="search" />
                        </div>
                        <div className="t">没有匹配的日志行</div>
                        <div className="d">
                          {active.leveled ? '换个关键词，或把级别筛选切回「全部」' : '换个关键词试试'}
                        </div>
                      </div>
                    ) : null}

                    {isEmpty ? (
                      <div className="log-empty">
                        <div className="t">还没有可查看的日志</div>
                        <div className="d">添加一条路径后，这里会实时显示它的输出</div>
                        <button type="button" className="btn btn-primary" onClick={() => setDialog({ kind: 'add' })}>
                          ＋ 新增日志路径
                        </button>
                      </div>
                    ) : null}

                    {/* 往回翻（`less` 的 b）。⚠️ 只有"这一段里还有没取回来的行"时才出现 */}
                    <div className="load-more" hidden={!view.cut}>
                      <button type="button" className="load-more-btn" onClick={loadEarlier}>
                        <span className="lm-ico" aria-hidden="true">
                          <LgIcon name="arrowDown" />
                        </span>
                        <span className="lm-label">加载更早的 {view.cut} 行</span>
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}
          </main>
        </div>
      </MacWindow>
    </div>
  )
}

/* ================================================================== *
 * 弹窗：新增 / 编辑路径、重命名、移除确认、目录选择器
 * ================================================================== */

/**
 * 弹窗。四个形态共用**同一个**头/正文/底：新增、编辑路径、重命名、移除确认；
 * 目录选择器是**在同一个弹窗里换视图**（原型就是这样，不叠第二层浮层）——
 * 所以它是这个组件内部的一份 state，不是第五种 dialog。
 */
function LogDialog({
  dialog,
  server,
  sources,
  fsRoot,
  groups,
  currentGroup,
  onClose,
  onToast,
  onSubmit,
}: {
  dialog: Dialog
  server: ServerItem | null
  sources: LogSource[]
  fsRoot: FsNode
  /** 「分组」那排胶囊可选的名字（这台服务器当前看得见的组名 + 兜底的「自定义」） */
  groups: string[]
  /** 当前这条路径所在的分组名（新增时为空 ⇒ 由路径去猜） */
  currentGroup: string
  onClose: () => void
  onToast: (msg: string, type?: ToastState['type']) => void
  onSubmit: (name: string, path: string, group: string) => void
}) {
  const isForm = dialog.kind === 'add' || dialog.kind === 'edit'
  const initialName = dialog.kind === 'edit' || dialog.kind === 'rename' ? dialog.source.name : ''
  const initialPath = dialog.kind === 'edit' ? dialog.source.path : ''
  const [name, setName] = useState(initialName)
  const [path, setPath] = useState(initialPath)
  const [invalid, setInvalid] = useState(false)
  /* ---- 「分组」字段 ---- */
  /* 这一场弹窗里新建的组名（还没落进左栏，所以不在 `groups` 里）。新建的胶囊插在「自定义」之前 */
  const [madeGroups, setMadeGroups] = useState<string[]>([])
  const [group, setGroup] = useState(currentGroup || LOG_GROUP_LABEL.custom)
  /** 还在跟着路径自动预选吗（点过任一枚胶囊之后就是 false） */
  const [groupAuto, setGroupAuto] = useState(!currentGroup)
  const [addingGroup, setAddingGroup] = useState(false)
  const [newGroup, setNewGroup] = useState('')
  const groupNameRef = useRef<HTMLInputElement | null>(null)
  /** 胶囊顺序：`groups`（「自定义」在最后）+ 本场新建的，插在「自定义」之前 */
  const chips = useMemo(() => {
    const base = groups.slice()
    const at = base.indexOf(LOG_GROUP_LABEL.custom)
    const tail = at < 0 ? base.length : at
    return [...base.slice(0, tail), ...madeGroups, ...base.slice(tail)]
  }, [groups, madeGroups])
  /* 目录选择器的视图状态：非 null 时整个正文换成选择器（同一个弹窗，不叠第二层浮层） */
  const [picker, setPicker] = useState<{ parts: string[]; filter: string } | null>(null)
  const maskRef = useRef<HTMLDivElement | null>(null)

  /* 每次换弹窗都重置表单与视图 —— 否则"编辑 A 再编辑 B"会带着 A 的值 */
  useEffect(() => {
    setName(initialName)
    setPath(initialPath)
    setInvalid(false)
    setPicker(null)
    setMadeGroups([])
    setAddingGroup(false)
    setNewGroup('')
    /* 编辑时以这条日志自己的分组为准；新增时留空 ⇒ 由路径去猜 */
    setGroup(currentGroup || LOG_GROUP_LABEL.custom)
    setGroupAuto(!currentGroup)
  }, [initialName, initialPath, currentGroup, dialog.kind])

  /**
   * 把还开着的「新建分组」输入框落定，**并返回最终组名**。
   *
   * ⚠️ 返回值是同步算出来的：`setGroup` 不会立刻生效，`submit()` 不能指望读到新 state
   *    （原型那边也是同一个坑 —— 它的 `commit()` 是同步改 `picked` 变量）。
   * 空名 = 取消（点开又后悔是常事，不该因此建出一个空名的分组）；撞名直接复用已有那一枚。
   */
  const takeGroup = (): string => {
    if (!addingGroup) return group || LOG_GROUP_LABEL.custom
    const made = newGroup.trim()
    setAddingGroup(false)
    setNewGroup('')
    if (!made) return group || LOG_GROUP_LABEL.custom
    if (!chips.includes(made)) setMadeGroups((prev) => [...prev, made])
    setGroupAuto(false) // 手选过就不再被路径改写
    setGroup(made)
    return made
  }

  useEffect(() => {
    if (addingGroup) groupNameRef.current?.focus()
  }, [addingGroup])

  /**
   * 选择器里 Escape 是"退回上一步"：先回表单，再按一次才关弹窗。
   *
   * ⚠️ 这一条必须挂在**捕获阶段**并 `stopPropagation`：页面那条 Escape 监听挂在
   *    `document` 的冒泡阶段，而捕获阶段先跑 —— 不拦下来，第一次 Escape 就会
   *    把整个弹窗关掉，"退回表单"这一步永远走不到。
   */
  useEffect(() => {
    if (!picker) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setPicker(null)
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [picker])

  /* 焦点陷阱：Tab 在弹窗里循环（原型同款） */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return
      const mask = maskRef.current
      if (!mask) return
      const focusables = mask.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      )
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const close = onClose

  /* ---- 目录选择器：同一个弹窗里换视图 ---- */
  if (picker) {
    const { parts, filter } = picker
    const node = fsNodeAt(fsRoot, parts) ?? makeDir()
    const entries = [...node.children.entries()]
      .map(([entryName, entry]) => ({ name: entryName, node: entry }))
      .filter((e) => !filter || e.name.toLowerCase().includes(filter.toLowerCase()))
      /* 目录在前，同类按名字 —— 与原型同一套排法 */
      .sort((a, b) => (a.node.type === b.node.type ? a.name.localeCompare(b.name) : a.node.type === 'd' ? -1 : 1))
    const crumbs: { label: string; parts: string[] }[] = [{ label: server?.name ?? '服务器', parts: [] }]
    parts.forEach((seg, i) => crumbs.push({ label: seg, parts: parts.slice(0, i + 1) }))
    const alreadyAdded = (p: string) => sources.some((s) => s.path === p)

    return (
      <div className="modal-mask open" ref={maskRef} onClick={(event) => event.target === event.currentTarget && close()}>
        <div className="modal" role="dialog" aria-modal="true" aria-label={`选择日志文件 · ${server?.name ?? ''}`}>
          <div className="modal-head">
            <div className="modal-title">选择日志文件 · {server?.name ?? ''}</div>
            <button type="button" className="modal-close" onClick={close} aria-label="关闭">
              <LgIcon name="close" />
            </button>
          </div>

          <div className="modal-body">
            <div className="pick-crumbs">
              {crumbs.map((crumb, i) => {
                const last = i === crumbs.length - 1
                return (
                  <span key={`${crumb.label}-${i}`} style={{ display: 'contents' }}>
                    {i > 0 ? (
                      <span className="pick-sep" aria-hidden="true">
                        ›
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className={cn('pick-crumb', last && 'current')}
                      onClick={() => !last && setPicker({ parts: crumb.parts, filter: '' })}
                    >
                      {crumb.label}
                    </button>
                  </span>
                )
              })}
            </div>

            {/* 目录条目多时才给筛选框：三级目录里放个搜索框是给不存在的需求配控件 */}
            {node.children.size >= 10 ? (
              <input
                className="modal-input"
                type="search"
                placeholder="筛选当前目录"
                value={filter}
                autoComplete="off"
                onChange={(event) => setPicker({ parts, filter: event.target.value })}
              />
            ) : null}

            <div className="pick-list" tabIndex={-1}>
              {entries.length ? (
                entries.map((entry) => {
                  const isDir = entry.node.type === 'd'
                  const entryPath = `/${parts.concat(entry.name).join('/')}`
                  return (
                    <button
                      key={entry.name}
                      type="button"
                      className={cn('pick-row', isDir && 'dir')}
                      onClick={() => {
                        if (isDir) {
                          setPicker({ parts: parts.concat(entry.name), filter: '' })
                          return
                        }
                        if (alreadyAdded(entryPath)) {
                          /* 留在选择器里，别把用户弹回表单 */
                          onToast('这条路径已经在列表里了', 'warn')
                          return
                        }
                        /* 选中即回表单：把路径填进去，名称留空就用文件名兜底。
                           ⚠️ 不在这里提交 —— 用户还要看一眼名称对不对（原型同一条） */
                        setPath(entryPath)
                        setName((prev) => prev.trim() || entry.name)
                        setInvalid(false)
                        setPicker(null)
                      }}
                    >
                      <span className="pick-ico" aria-hidden="true">
                        {isDir ? <LgIcon name="chevronRight" /> : null}
                      </span>
                      <span className="pick-name">{entry.name}</span>
                      <span className="pick-meta">
                        {isDir ? `${entry.node.children.size} 项` : `${entry.node.size} · ${entry.node.time}`}
                        {!isDir && alreadyAdded(entryPath) ? <span className="pick-tag"> 已添加</span> : null}
                      </span>
                    </button>
                  )
                })
              ) : (
                <div className="pick-empty">
                  {filter ? `这个目录里没有匹配「${filter}」的条目` : '这个目录是空的'}
                </div>
              )}
            </div>

            {/* 一行就够：说清"数据来自哪台机器"与"怎么算选中"（底部没有确认按钮，这点要交代） */}
            <div className="pick-note">内容来自 {server?.name ?? '这台服务器'} 的日志路径清单 · 点文件名即选中</div>
          </div>

          <div className="modal-actions">
            {/* 选择器里没有"确认"这一步 —— 点文件名就是选中，所以底部只留一个「返回」 */}
            <button type="button" className="btn btn-ghost" onClick={() => setPicker(null)}>
              返回
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ---- 移除确认 ---- */
  if (dialog.kind === 'delete') {
    const total = sources.length
    return (
      <div className="modal-mask open" ref={maskRef} onClick={(event) => event.target === event.currentTarget && close()}>
        <div className="modal" role="dialog" aria-modal="true" aria-label="移除日志路径">
          <div className="modal-head">
            <div className="modal-title">移除日志路径</div>
            <button type="button" className="modal-close" onClick={close} aria-label="关闭">
              <LgIcon name="close" />
            </button>
          </div>
          <div className="modal-body">
            <p>
              把「{dialog.source.name}」从这台服务器的日志列表里移除。
              {total === 1 ? '这是这台服务器上仅剩的一条路径，移除后列表会空。' : ''}
            </p>
            <div className="modal-path-hint">{dialog.source.path}</div>
            {/* 破坏性动作要说清"影响范围"：用户最怕的是以为把服务器上的文件也删了 */}
            <p style={{ marginTop: '14px' }}>
              服务器上的日志文件不会被删除，只是不再在这里查看它。移除后可以立刻用提示条上的「撤销」找回。
            </p>
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-ghost" onClick={close}>
              取消
            </button>
            <button type="button" className="btn btn-danger" onClick={() => onSubmit('', '', '')}>
              移除
            </button>
          </div>
        </div>
      </div>
    )
  }

  /* ---- 表单：新增 / 编辑（名称 + 路径）/ 重命名（只有名称） ---- */
  const isRename = dialog.kind === 'rename'
  const canBrowse = isForm
  const valid = isRename || (path.trim().length > 0 && path.trim().startsWith('/'))

  const submit = () => {
    if (!valid) {
      setInvalid(true)
      return
    }
    /* 还开着的新建输入框先落定，并**同步**拿到最终组名（`setGroup` 还没生效） */
    const finalGroup = isForm ? takeGroup() : ''
    const finalName = name.trim() || (path.split('/').filter(Boolean).pop() ?? path)
    onSubmit(isRename ? name.trim() || (dialog.source.name ?? '') : finalName, path.trim(), finalGroup)
  }

  return (
    <div className="modal-mask open" ref={maskRef} onClick={(event) => event.target === event.currentTarget && close()}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={dialog.kind === 'add' ? '新增日志路径' : isRename ? '重命名日志' : '编辑日志路径'}
      >
        <div className="modal-head">
          <div className="modal-title">
            {dialog.kind === 'add' ? '新增日志路径' : isRename ? '重命名日志' : '编辑日志路径'}
          </div>
          <button type="button" className="modal-close" onClick={close} aria-label="关闭">
            <LgIcon name="close" />
          </button>
        </div>

        <div className="modal-body">
          {/* 说明段刻意不写：三个一眼就懂的字段不需要注解（原型把"格式要求"交给 placeholder 了）。
              ⚠️ 字段顺序 = 想事情的顺序（原型 2026-09-26 定）：先给它起个名 → 再说文件在哪 →
                 最后归到哪一组。上一版是"路径在前"，别改回去。 */}
          <div className="modal-field">
            <div className="field-head">
              <label htmlFor="logNameInput">名称</label>
            </div>
            <input
              id="logNameInput"
              className="modal-input"
              type="text"
              value={name}
              placeholder="留空则用文件名"
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
            {isRename ? <div className="modal-path-hint">{dialog.source.path}</div> : null}
          </div>

          {isForm ? (
            <div className="modal-field">
              <div className="field-head">
                <label htmlFor="logPathInput">路径</label>
                {/* 字段级动作放标题右侧，不占输入框的宽度。
                    ⚠️ 打开时定位到**当前已填路径所在的目录**（而不是根）—— 从根开始逐级下钻
                       是"重新找一遍"，而从当前值的父目录开始才是"改一下" */}
                {canBrowse ? (
                  <button
                    type="button"
                    className="field-act"
                    onClick={() => setPicker({ parts: path.split('/').filter(Boolean).slice(0, -1), filter: '' })}
                  >
                    浏览服务器目录
                  </button>
                ) : null}
              </div>
              <input
                id="logPathInput"
                className={cn('modal-input', invalid && 'is-invalid')}
                type="text"
                value={path}
                placeholder="/var/log/xxx.log"
                autoComplete="off"
                onChange={(event) => {
                  const next = event.target.value
                  setPath(next)
                  setInvalid(false)
                  /* 路径与分组是同一件事的两面：路径落到 nginx 目录，分组就默认成「服务日志」。
                     只在用户自己没动过分组时跟随 —— 手动选过的值不能被路径改写。
                     ⚠️ 猜不中时**保持原选择**，不退回「自定义」——否则用户刚选的组会被打字抹掉 */
                  if (!groupAuto) return
                  const guessed = guessGroup(next.trim(), chips)
                  if (guessed && guessed !== group) setGroup(guessed)
                }}
              />
            </div>
          ) : null}

          {isForm ? (
            /* 「分组」：一排单选胶囊 + 行尾「＋」（与部署页**同一套做法**，兄弟页口径要一致）。
               为什么不是下拉：分组通常只有 3~5 个，胶囊能一次全看见、点一下就换；
               为什么不是自由文本：自由文本会立刻长出「Nginx / nginx / NgInx」三个组。 */
            <div className="modal-field">
              <div className="field-head">
                {/* 用 `<label>` 只为与上面两个字段同一套样式（没有 for：分组是一组单选胶囊，
                    不是一个可指的表单控件，可访问名走下面 row 的 aria-label） */}
                <label>分组</label>
              </div>
              <div className="group-pick" role="radiogroup" aria-label="分组">
                {chips.map((label) => (
                  <button
                    key={label}
                    type="button"
                    role="radio"
                    aria-checked={group === label}
                    className={cn('group-chip', group === label && 'on')}
                    onClick={() => {
                      setGroupAuto(false)
                      setGroup(label)
                    }}
                  >
                    {label}
                  </button>
                ))}
                {addingGroup ? (
                  <input
                    ref={groupNameRef}
                    className="group-add-input"
                    type="text"
                    maxLength={8}
                    placeholder="新分组名"
                    aria-label="新分组名称"
                    autoComplete="off"
                    value={newGroup}
                    onChange={(event) => setNewGroup(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault()
                        takeGroup()
                      } else if (event.key === 'Escape') {
                        /* Esc 只该收起这一格 —— 不挡住冒泡的话，文档级那个监听会顺手把整张弹窗关掉 */
                        event.preventDefault()
                        event.stopPropagation()
                        setAddingGroup(false)
                        setNewGroup('')
                      }
                    }}
                    onBlur={() => takeGroup()}
                  />
                ) : (
                  <button
                    type="button"
                    className="group-add"
                    title="新建分组"
                    aria-label="新建分组"
                    onClick={() => {
                      setAddingGroup(true)
                      setNewGroup('')
                    }}
                  >
                    <LgIcon name="plus" />
                  </button>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={close}>
            取消
          </button>
          <button type="button" className="btn btn-primary" onClick={submit}>
            {dialog.kind === 'add' ? '添加并查看' : isRename ? '保存名称' : '保存'}
          </button>
        </div>
      </div>
    </div>
  )
}
