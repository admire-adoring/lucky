import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
import { getCurrentWebview } from '@tauri-apps/api/webview'
import { useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { MacWindow } from '../../components/shell/MacWindow'
import type { ServerItem } from '../../data/derive'
import { useProjectServers } from '../../hooks/use-servers'
import { createRelease, releaseKeys } from '../../api/servers'
import {
  CONFIGS,
  CMD_PRESETS,
  DEPLOY_GROUPS,
  PATH_PRESETS,
  SRC_LABEL,
  TOAST_ICON,
  autoInfo,
  autoSummary,
  baseName,
  buildSteps,
  checkStepName,
  cmdList,
  detectAsk,
  extOf,
  fmtSize,
  groupFor,
  groupFromPath,
  hhmmss,
  mtimeText,
  needsHuman,
  totalSize,
  type CmdItem,
  type DeployConfig,
  type DeployStep,
  type FileSrc,
  type StagedFile,
} from '../../data/workspace/deploy'
import { errorText } from '../../api/error'
import { dirForLocal, localFsKeys, statLocal } from '../../api/local-fs'
import { dirForRemote, remoteFsKeys, runRemote, statRemote, uploadRemote } from '../../api/srv-remote'
import { useLocalDir, useLocalHome, useLocalProbe, probeLocalFile } from '../../hooks/use-local-fs'
import { useRemoteDir } from '../../hooks/use-srv-remote'
import { useDocumentTitle } from '../../hooks/use-document-title'
import { useProjectDetail } from '../../hooks/use-projects'
import { cn } from '../../lib/cn'
import { useThemeStore } from '../../stores/theme-store'

/* ============================================================================
   部署查看器 —— 项目详情「运维 · 部署」
   原型 `design/work/工作-项目-项目详情-运维-部署-index.html`
   ----------------------------------------------------------------------------
   原型是 `window.open` 出来的独立窗口（运维页 →「📦 打开部署面板」）。落在应用里
   它是一条两段路由 `/deploy/:id`，套 `MacWindow` —— 理由与 `/logs/:id` 完全一样
   （见 `App.tsx` 里那两条注释与 `LogViewerPage.tsx` 文件头 ①）。

   三件事在别处，别在这里找：
     · 常量与纯函数 → `data/workspace/deploy.ts`（配置 / 分组 / 命令识别 / 步骤 /
       目录树查找 / 大小与路径小工具）。这一页只管渲染与状态机。
     · 样式 → `styles/module-workspace.css` 的「部署查看器」段（作用域 `.dp-root`）。
     · 图标 → 页面自带的 `DP_ICON`（16 网格，原样搬原型那几条 path）。
       不复用 `IconSprite`（24 网格的公共资产，这一页要的箭头/方盒/刷新都在里面
          找不到对应形状）；也不复用 `deploy.ts` 里的 `ICO` / `PICK_CHEV` ——
          那是字符串版的内联 SVG，React 里用它得走 `dangerouslySetInnerHTML`。
          为一个播放/加载按钮与一个箭头开这个口子不值得，这里用等价的 JSX。

   ============================================================================
   与原型有意不同的地方（"静态页变成应用"必然要改的，不是审美）
   ============================================================================
   ① 整窗页面（`/deploy/:id`）+ `MacWindow`。原型那条 `#win` / `window.close()` /
      "回跳运维页" 的分支全部删掉 —— 关窗交给窗框红钮，`onClose` 回项目详情的运维分区。
   ② 目标主机与环境由项目派生，不再读 URL 的 `?host=`：真实台账里"服务本项目"的
      机器（优先生产环境）。原型固定 `prod-web-01`，是因为它的假数据只有 web。
      「这次连接身份」仍然是页面状态（`deploy` / `root` / `appuser`），默认 `deploy`。
   ③ 主题开关用应用的那份实现（`theme-store`，切 `<html data-theme>`），但外观
      仍走原型的 `.theme-toggle` —— 与日志页同一条口径，照搬原型的 `.dark` + 自己的
      localStorage 会出现"设置页切成暗色、这一页还是亮的"。
   ④ `更新于` 初值不写死 11:20：静态页没有"最后一次同步"这件事可读，所以初值是
      `更新于 —`，点「刷新」才写真实时刻。这与日志页 ③ 是同一条口径（只有"此刻发生的
      事"才读系统时钟）。控制台每行的时间戳同理 —— 它就是"这行什么时候打出来的"。
   ⑤ 目录选择器是弹窗正文的第二种视图（`dialog.kind === 'pick'`），不是第五种浮层。
      从表单里进去时摘的是表单状态（`form` 那一份 state），返回原样还在 ——
      原型是把表单 DOM 摘下来暂存，React 里对应的就是"状态不在 dialog 里"。
   ⑥ 实时跟随是本地状态：控制台自动滚到底 / 手动往上翻就退出跟随，`↓ 回到底部`
      恢复。"跟随"这件事在两端都是纯视图行为，与数据无关。
   ⑦ 文件与执行都是真的，没有一张写死的表：
      · 本机 → `fs_stat` / `fs_list`（`localfs.rs`），`useLocalProbe` / `useLocalDir`；
      · 服务器 → `srv_fs_stat` / `srv_fs_list`（`srv/remote.rs`，走 SSH），`useRemoteDir`；
      · 上传 → `srv_upload`（`ssh 'cat > 路径'`，落地后核对字节数）；
      · 启动命令与健康检查 → `srv_run`，成功与否只看远端退出码。
      原型里 `LOCAL_FS` / `HOST_FS` 是两张假表，照搬的结果是"本机明明有这个包、
      界面说没有""服务器目录全是编的"。两侧的行都收敛成 `PickRow`。
      文件身份是绝对路径：拖拽走 Tauri 的 `onDragDropEvent`、选择走本机选择器，
      不再用 `<input type=file>` —— 那个拿不到路径，上传时只传得出一个名字。

   ============================================================================
   四条容易写错、且错了不会报错的判据
   ============================================================================
   ① `hidden` 属性一律不许用。原型靠 `[hidden]{display:none}` 这个全局规则藏
      `.src-panel` / `.file-list` / `.btn-abort` / `.run-hint` / `.jump-btn` /
      `.state-pill` / `.task-count.done` / `.dp-spec-more` / `.src-opt .n` / `.field-err`。
      移植时那条全局规则按惯例丢掉了（`module-workspace.css` 里没有全仓的
      `[hidden]`），于是所有该藏的东西会同时显出来。⇒ 这里一律条件渲染。
      例外是 `.dp-group-head[aria-expanded]` 那一套折叠：它靠属性选择器收 `max-height`，
      所以 `aria-expanded` 必须真的写上（写错 = 折叠按钮点了没反应）。
   ② `position: fixed` 在这页的包含块是「窗口」不是「视口」（`MacWindow` 带
      `transform`）。所以弹窗 `max-height` 走 `100%` 而不是原型的 `88vh`（见 CSS 段里
      那条 ④），字段说明气泡的定位也要夹在遮罩矩形里 —— 用 `window.innerWidth`
      算出来的坐标会跑到窗口外面去。
   ③ 步骤的三种"进行中"是三个类：`step-run` / `step-wait`（等输入）/ `step-err`
      （失败但可重试）。状态存在 `stepState[i].status`，类名由它推 —— 千万不要在别处
      再判定一次"这步是不是在跑"，两处一定会分叉。
   ④ `step-ok` 的折叠是"不显示"而不是"删掉"（`.dp-tasks.folded .step-ok:not(.focused)`），
      所以折叠后点某一步定位时，那一步要能透出来 ⇒ 给它 `.focused`。
   ============================================================================ */

/* ------------------------------------------------------------------ *
 * 图标
 * ------------------------------------------------------------------ */
const DP_ICON: Record<string, ReactNode> = {
  /* 顶栏身份块：方盒（原型 `.viewer-ico` 那条 path） */
  box: (
    <>
      <path d="M8 1.9 13.9 4.7v6.6L8 14.1 2.1 11.3V4.7z" />
      <path d="M2.1 4.7 8 7.5l5.9-2.8M8 7.5v6.6" />
    </>
  ),
  refresh: (
    <>
      <path d="M13.6 8a5.6 5.6 0 1 1-1.7-4" />
      <path d="M13.9 1.9v3.5h-3.5" />
    </>
  ),
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  /* 拖拽区：一个向上的箭头落进托盘 */
  upload: (
    <>
      <path d="M8 10.4V2.6" />
      <path d="M4.7 5.7 8 2.5l3.3 3.2" />
      <path d="M2.6 9.8v2.4a1.2 1.2 0 0 0 1.2 1.2h8.4a1.2 1.2 0 0 0 1.2-1.2V9.8" />
    </>
  ),
  /* 中止钮里的方块 */
  stop: <rect x="4.6" y="4.6" width="6.8" height="6.8" rx="1.6" fill="currentColor" />,
  moon: <path d="M13.4 9.7A5.7 5.7 0 0 1 6.3 2.6a5.7 5.7 0 1 0 7.1 7.1z" />,
  sun: (
    <>
      <circle cx="8" cy="8" r="3.1" />
      <path d="M8 1.5v1.9M8 12.6v1.9M1.5 8h1.9M12.6 8h1.9M3.5 3.5l1.3 1.3M11.2 11.2l1.3 1.3M12.5 3.5l-1.3 1.3M4.8 11.2l-1.3 1.3" />
    </>
  ),
  /* 新建分组那一枚「＋」 */
  plus: <path d="M8 3.6v8.8M3.6 8h8.8" />,
  /* 主按钮的两个图标：文字与图标必须同步翻转，所以只在 runIcon 一处取 */
  run: (
    <>
      <circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.38" />
      <path d="M6.3 5.1 10.7 8l-4.4 2.9z" fill="currentColor" />
    </>
  ),
  busy: (
    /* 270° 的弧，配合 CSS 的 spin 转起来就是标准的加载态 */
    <path d="M8 2.8a5.2 5.2 0 1 0 5.2 5.2" />
  ),
  chev: <path d="M6.5 4.4 10.1 8l-3.6 3.6" />,
  file: (
    <>
      <path d="M9.3 1.9H4.6a1.3 1.3 0 0 0-1.3 1.3v9.6a1.3 1.3 0 0 0 1.3 1.3h6.8a1.3 1.3 0 0 0 1.3-1.3V5.3z" />
      <path d="M9.3 1.9v3.4h3.4" />
    </>
  ),
}

/**
 * 16 网格的内联 SVG。
 *
 * 默认不带 class：原型里这些图标的尺寸全由父选择器给
 * （`.viewer-ico svg` / `.log-tool svg` / `.dz-ico svg` / `.btn-run .ic svg` …），
 * 给一个公共类名反而会让 CSS 段里凭空多出十几条没人用的规则。
 * 只有目录选择器那两枚要带 `pick-chev` / `pick-file` —— 它们由自己的类吃样式（含描边），
 * 所以那两处要 `outline={false}`，否则行内属性会与 CSS 打架。
 *
 * `outline={false}` 用于 `run` / `stop` 这两枚自带填充的（行内 `stroke` 会给填充形状
 * 额外描一道边，看起来比原型粗一圈）。
 */
function DpIcon({
  name,
  cls,
  outline = true,
  strokeWidth = 1.6,
}: {
  name: keyof typeof DP_ICON
  cls?: string
  outline?: boolean
  strokeWidth?: number
}) {
  return (
    <svg
      className={cls}
      viewBox="0 0 16 16"
      fill={outline ? 'none' : undefined}
      stroke={outline ? 'currentColor' : undefined}
      strokeWidth={outline ? strokeWidth : undefined}
      strokeLinecap={outline ? 'round' : undefined}
      strokeLinejoin={outline ? 'round' : undefined}
      aria-hidden="true"
    >
      {DP_ICON[name]}
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * 目录选择器的两条数据源
 *
 * 两侧都是真读：本机走 `fs_list`（磁盘），服务器走 `srv_fs_list`（SSH）。
 * 返回的形状一样，所以视图只有一个、行都收敛成 `PickRow`。
 * 这里曾经有一棵用假表算出来的树 —— 它列的文件哪台机器上都没有，
 * 照着它挑出来的路径全都用不了。
 * ------------------------------------------------------------------ */

/** 选择器里的一行。目录是"继续往下走"，文件是"到这儿为止"。 */
interface PickRow {
  name: string
  dir: boolean
  /** 右侧那串小字：文件是 `大小 · 时间`，目录留空 */
  meta: string
}

/* 备选连接身份。URL 可能带来预设之外的身份（`?user=ci-runner`）也要能显示，
   否则 select 设成不存在的值会被浏览器回退成空字符串 —— 见 `userOptions`。 */
const EXEC_USERS = ['deploy', 'root', 'appuser'] as const

/** 分组里那个"什么都不匹配"的兜底组。它认 id，不认位置（见 `deploy.ts` 的注释）。 */
const OTHER_GROUP = 'other'

/**
 * 会删改机器上数据的那几类命令。只用来在真跑之前要一次确认 ——
 * 种子配置里的路径与命令是示例，对着一台真机器一键执行没有回头路。
 */
const RISKY_CMD =
  /\brm\s+-[a-zA-Z]*[rf]|\brsync\b[^\n]*--delete\b|\bmkfs\b|\bdd\s+if=|\bshutdown\b|\breboot\b|\btruncate\b|\bdrop\s+(table|database)\b/i

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

/** 步骤的六种状态。CSS 的类名（`step-idle` …）由它推出来，别在别处再判一次。 */
type StepStatus = 'idle' | 'run' | 'wait' | 'ok' | 'err' | 'skip'

interface StepState {
  status: StepStatus
  /** 圆点里那一个字符：序号 / ✓ / ✕ / — / ● / >_ / ■ */
  badge: string
  /** 冻结的耗时文案（`待执行` / `0.0s` / `跳过` / `已中止`）。进行中时按 `clock` 现算。 */
  time: string
  /** 上传那一步的进度条宽度（%） */
  barPct?: number
  /** 单步重试次数（>0 时圆点上加一圈标记） */
  retry?: number
}

/** 控制台里的一行。 */
interface ConsoleLine {
  id: number
  t: string
  text?: string
  /** 空态那一行（`等待开始部署…`）。有别的行进来时它先被摘掉 */
  empty?: boolean
  kind?: '' | 'ok' | 'warn' | 'err' | 'sub'
  /** 步骤头那一行（`── 上传到 … ──`） */
  header?: boolean
  /** 点某一步要定位到的锚（步骤 key，`logAt` 的第三个参数） */
  stepKey?: string
}

/** 一条配置在弹窗里的编辑态。它的生命周期比 `dialog` 长 —— 进目录选择器时它必须留着。 */
interface FormState {
  baseId: string | null
  name: string
  path: string
  cmds: CmdItem[]
  groupVal: string
  /** 还在跟着路径自动预选吗（点过任一枚 chip 之后就是 false） */
  groupAuto: boolean
  /** 标签行尾的「＋」是否已切到输入态 */
  addingGroup: boolean
  newGroupName: string
  errors: { name?: string; path?: string; cmd?: string }
}

type PickSrc = 'host' | 'local'
type PickMode = 'dir' | 'file'

type Dialog =
  | { kind: 'form' }
  | { kind: 'delete'; id: string }
  | {
      kind: 'pick'
      /** 从表单里进去时是 null 之外的东西（返回键回到表单）；从「绑定…浏览」进去时是 null（返回 = 关窗） */
      standalone: boolean
      src: PickSrc
      mode: PickMode
      parts: string[]
      filter: string
      /** 选中之后交出什么 */
      take: (value: string) => void
    }

interface ToastState {
  id: number
  msg: string
  type: string
}

interface TipState {
  text: string
  /** 锚点矩形（视口坐标）。定位时要把它夹进遮罩矩形里，见文件头 ② */
  rect: { left: number; right: number; top: number; bottom: number }
}

/** 左栏的分组。用户在表单里新建的分组也进这张表（原型直接改 `DEPLOY_GROUPS` 那一个数组）。 */
interface GroupItem {
  id: string
  name: string
}

const STEP_CLASS: Record<StepStatus, string> = {
  idle: 'step-idle',
  run: 'step-run',
  wait: 'step-wait',
  ok: 'step-ok',
  err: 'step-err',
  skip: 'step-skip',
}

/* ------------------------------------------------------------------ *
 * 小组件：字段说明气泡
 *
 * 气泡挂在页面根下（`.tip-layer`）而不是字段里：弹窗正文是 `overflow-y:auto`，
 * 挂在字段里的绝对定位气泡贴到底部会被裁掉一半。
 * 定位的边界取遮罩矩形而不是 `window.innerWidth/innerHeight` ——
 *    这一页在 `MacWindow` 里，`position: fixed` 的包含块是窗口（见文件头 ②）。
 * ------------------------------------------------------------------ */
function FieldHelp({ text, onShow, onHide }: { text: string; onShow: (rect: TipState['rect'], text: string) => void; onHide: () => void }) {
  const show = (node: HTMLElement) => {
    const r = node.getBoundingClientRect()
    onShow({ left: r.left, right: r.right, top: r.top, bottom: r.bottom }, text)
  }
  return (
    <button
      type="button"
      className="field-help"
      aria-label={`字段说明：${text}`}
      onMouseEnter={(event) => show(event.currentTarget)}
      onFocus={(event) => show(event.currentTarget)}
      onMouseLeave={onHide}
      onBlur={onHide}
      /* 触屏没有 hover：点一下也能看 */
      onClick={(event) => {
        event.preventDefault()
        show(event.currentTarget)
      }}
    >
      ?
    </button>
  )
}

export function DeployViewerPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError } = useProjectDetail(id)
  const location = useLocation()
  const navigate = useNavigate()
  const theme = useThemeStore((state) => state.theme)
  const toggleTheme = useThemeStore((state) => state.toggleTheme)
  const queryClient = useQueryClient()

  useDocumentTitle(`部署 · ${data?.project.name ?? ''} · Lucky-Y`)

  /* ---- 目标主机：走真实库（见文件头 ②）。没有登记服务器时留空 —— 编一个名字只会连到别人的机器 ---- */
  const servers = useProjectServers(id)
  const target: ServerItem | null = servers.find((s) => s.env === 'prod') ?? servers[0] ?? null
  const host = target?.name ?? ''
  const envLabel = target && target.env === 'test' ? '测试环境' : '生产环境'
  const version = target?.version ?? '—'

  /* ================================================================== *
   * 状态
   * ================================================================== */

  /* ---- 配置与分组（会话内的增删改，都不落盘） ---- */
  const [configs, setConfigs] = useState<DeployConfig[]>(() =>
    CONFIGS.map((c) => ({ ...c, cmd: c.cmd.map((x) => ({ ...x })) })),
  )
  const [groups, setGroups] = useState<GroupItem[]>(() => DEPLOY_GROUPS.map((g) => ({ id: g.id, name: g.name })))
  const [currentId, setCurrentId] = useState<string | null>(CONFIGS[0]?.id ?? null)
  const [foldedGroups, setFoldedGroups] = useState<Record<string, boolean>>({})
  const groupSeq = useRef(0)

  /* ---- 文件：两种来源二选一，两份各存一份（切换不清空） ---- */
  const [fileSrc, setFileSrc] = useState<FileSrc>('pick')
  const [staged, setStaged] = useState<Record<FileSrc, StagedFile[]>>({ pick: [], local: [] })
  const [bindPath, setBindPath] = useState('')
  const [bindInvalid, setBindInvalid] = useState(false)
  const [bindState, setBindState] = useState<{ kind: '' | 'ok' | 'bad'; text: string; detail: string }>({
    kind: '',
    text: '',
    detail: '',
  })
  const [dragOver, setDragOver] = useState(false)
  const bindTimer = useRef<number | null>(null)
  /** 边打边查的轮次戳：慢的那次回来时路径早换了，结论不能落到新路径上 */
  const bindSeq = useRef(0)
  const [bindBusy, setBindBusy] = useState(false)
  /** 绑定成功过的路径（本次会话），接替原来那张写死的"常用项" */
  const [recentBinds, setRecentBinds] = useState<string[]>([])

  /* ---- 会话与顶栏 ---- */
  const [sessionUser, setSessionUser] = useState<string>('deploy')
  const [lastSync, setLastSync] = useState('更新于 —')
  const [refreshing, setRefreshing] = useState(false)
  const [toastState, setToastState] = useState<ToastState | null>(null)
  const toastSeq = useRef(0)
  const toastTimer = useRef<number | null>(null)

  /* ---- 弹窗与提示气泡 ---- */
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [form, setForm] = useState<FormState | null>(null)
  const [tip, setTip] = useState<TipState | null>(null)
  const maskRef = useRef<HTMLDivElement | null>(null)
  const lastFocused = useRef<HTMLElement | null>(null)

  /* ---- 执行 ---- */
  const [steps, setSteps] = useState<DeployStep[]>([])
  const [stepState, setStepState] = useState<StepState[]>([])
  const [lines, setLines] = useState<ConsoleLine[]>([])
  const [running, setRunning] = useState(false)
  const [runLabel, setRunLabel] = useState('开始部署')
  const [hint, setHint] = useState<{ text: string; warn: boolean; busy: boolean } | null>(null)
  const [runMeta, setRunMeta] = useState<{ text: string; kind: string }>({ text: '等待开始', kind: '' })
  const [metaJump, setMetaJump] = useState<string | null>(null)
  const [taskTotal, setTaskTotal] = useState<string | null>(null)
  const [taskCountOverride, setTaskCountOverride] = useState<string | null>(null)
  const [taskFolded, setTaskFolded] = useState(false)
  const [focusIdx, setFocusIdx] = useState<number | null>(null)
  const [flashKey, setFlashKey] = useState<string | null>(null)
  const [showJump, setShowJump] = useState(false)
  const [followTail, setFollowTail] = useState(true)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)
  /**
   * 执行到「需输入」的命令时弹的那个框。
   * `resolve(null)` = 用户取消（或中途按了中止）—— 那条命令就不跑了。
   */
  const [askInput, setAskInput] = useState<{
    op: string
    run: string
    resolve: (value: string | null) => void
  } | null>(null)
  const [askDraft, setAskDraft] = useState('')

  /* ---- 命令式流程用的 ref（定时器里读不到最新 state，所以镜像一份） ---- */
  const runRef = useRef(false)
  const stepsRef = useRef<DeployStep[]>([])
  const cfgRef = useRef<DeployConfig | null>(null)
  const linesRef = useRef<ConsoleLine[]>([])
  const lineSeq = useRef(0)
  const timers = useRef<number[]>([])
  const deployStart = useRef(0)
  /** 进行中那一格：徽标按它现算「X.Xs」 */
  const tickRef = useRef<{ idx: number; t0: number; waitT0: number; mode: 'run' | 'wait' } | null>(null)
  const [clock, setClock] = useState(0)
  const stepListRef = useRef<HTMLDivElement | null>(null)
  const consoleRef = useRef<HTMLDivElement | null>(null)
  const nameRef = useRef<HTMLInputElement | null>(null)

  const from = (location.state as { from?: string } | null)?.from
  const goBack = useCallback(() => navigate(from ?? `/work/projects/${id ?? ''}`), [from, id, navigate])

  /* ================================================================== *
   * 本机文件：路径在不在、目录里有什么，一律现读磁盘
   * ------------------------------------------------------------------
   * 表格里那几条路径曾经是写死的假清单，于是"本机明明有这个包、界面说未找到"。
   * 现在的口径：`fs_stat` 探存在性，`fs_list` 读一层目录，前端不再持有任何清单。
   * ================================================================== */

  /** 真实家目录。只用于输入框占位与选择器起点，不参与"找没找到"的判定。 */
  const localHome = useLocalHome()
  /** 已绑定路径 → 探测结果的批量查询（key 就是这批路径） */
  /* 两侧的文件都在本机上：拖进来的也要跟着磁盘走，不能只探绑定那一侧 */
  const localPaths = useMemo(
    () => staged.local.concat(staged.pick).map((f) => f.path ?? ''),
    [staged.local, staged.pick],
  )
  const localProbeQuery = useLocalProbe(localPaths)
  /** 选择器只在该模式下才去读盘；另一侧不查（`enabled` 靠 null 关掉） */
  const pickLocalPath = dialog && dialog.kind === 'pick' && dialog.src === 'local' ? `/${dialog.parts.join('/')}` : null
  const pickLocalDir = useLocalDir(pickLocalPath)
  /** 服务器那侧走 SSH：这台机器上的这一层目录 */
  const pickRemotePath = dialog && dialog.kind === 'pick' && dialog.src === 'host' ? `/${dialog.parts.join('/')}` : null
  const pickRemoteDir = useRemoteDir(host, pickRemotePath)

  /* ================================================================== *
   * 派生值
   * ================================================================== */

  const cfg = useMemo(() => configs.find((c) => c.id === currentId) ?? null, [configs, currentId])
  useEffect(() => {
    cfgRef.current = cfg
  }, [cfg])

  const files = staged[fileSrc]
  const totalBytes = totalSize(files)
  const missing = files.filter((f) => f.found === false)

  const userOptions = useMemo(
    () => (EXEC_USERS.includes(sessionUser as (typeof EXEC_USERS)[number]) ? [...EXEC_USERS] : [...EXEC_USERS, sessionUser]),
    [sessionUser],
  )

  const envOf = envLabel
  const summary = autoSummary(cfg, sessionUser)
  const specCmdArr = cfg ? cmdList(cfg.cmd) : []
  const specBits: string[] = []
  if (specCmdArr.length > 1) specBits.push(`共 ${specCmdArr.length} 条`)
  let specBadge = ''
  let specClass = ''
  let specTitle = ''
  if (summary.full) {
    specClass = 'auto'
    specBadge = '全自动'
    specTitle = '配置里没有会等输入的命令（自研脚本的交互识别不出来，要它自己用 >_ 标记）'
  } else if (summary.askN) {
    specClass = 'need'
    specBadge = `${summary.askN} 处要输入`
    specTitle = `有 ${summary.askN} 处命令会停下来等输入 —— 执行到那一条会弹框现填（内容不存库）`
  } else if (summary.rew) {
    specClass = 'fix'
    specBadge = `可免密 ${summary.rew} 处`
    specTitle = `有 ${summary.rew} 处命令还在用会要密码的写法，改成非交互写法（sudo -n / BatchMode）才不用人盯着`
  } else if (summary.ext) {
    specClass = 'fix'
    specBadge = `凭据文件 ${summary.ext} 处`
    specTitle = '这几条要靠服务器上的凭据文件（~/.pgpass 等）才免交互'
  }
  const specMoreText = specBadge && !specBits.length ? specBadge : specBits.concat(specBadge || []).join(' · ')
  const specMoreShown = specBits.length > 0 || Boolean(specBadge)

  /* 左栏：空组不渲染（一条都没有的分类标签只是噪音） */
  const grouped = groups
    .map((g) => ({ ...g, items: configs.filter((c) => groupFor(c) === g.id) }))
    .filter((g) => g.items.length > 0)

  /* 当前步骤的进行中耗时 —— 由 `clock` 每 100ms 推一次重算（原型是每步一个 interval）。
     只在真的有"进行中/等待中"那一格时才推：无条件每 100ms setState 会让整棵
        组件树在空转时也一秒重渲十次（原型只在那两种情况挂着 interval）。 */
  useEffect(() => {
    const timer = window.setInterval(() => {
      if (tickRef.current) setClock((n) => n + 1)
    }, 100)
    return () => window.clearInterval(timer)
  }, [])
  const liveTime = (i: number): string | null => {
    const tk = tickRef.current
    if (!tk || tk.idx !== i) return null
    if (tk.mode === 'wait') return `等待 ${((Date.now() - tk.waitT0) / 1000).toFixed(1)}s`
    return `${((Date.now() - tk.t0) / 1000).toFixed(1)}s`
  }
  /* clock 是刻意的依赖：它每一拍都要重算这几句文案 */
  void clock

  const doneCount = stepState.filter((s) => s.status === 'ok').length
  const finishedCount = stepState.filter((s) => s.status === 'ok' || s.status === 'err' || s.status === 'skip').length
  const activeStepIdx = stepState.findIndex((s) => s.status === 'run' || s.status === 'wait' || s.status === 'err')
  const taskCountText = taskCountOverride ?? (taskFolded && doneCount ? `${doneCount} 步已完成` : `${steps.length} 步`)

  /* ================================================================== *
   * 提示条与复制
   * ================================================================== */

  const showToast = useCallback((msg: string, type: string = 'ok') => {
    toastSeq.current += 1
    setToastState({ id: toastSeq.current, msg, type })
    if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToastState(null), 2400)
  }, [])
  useEffect(
    () => () => {
      if (toastTimer.current !== null) window.clearTimeout(toastTimer.current)
      if (bindTimer.current !== null) window.clearTimeout(bindTimer.current)
    },
    [],
  )

  const flashCopied = useCallback((key: string) => {
    setCopiedKey(key)
    window.setTimeout(() => setCopiedKey((cur) => (cur === key ? null : cur)), 1400)
  }, [])

  /* `file://` 下 navigator.clipboard 常常不可用，所以保留 execCommand 兜底 */
  const copyText = useCallback(
    (text: string, key: string, okMsg: string) => {
      const done = () => {
        flashCopied(key)
        if (okMsg) showToast(okMsg)
      }
      const fallback = () => {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        try {
          document.execCommand('copy')
          done()
        } catch {
          /* 复制不了就什么都不做 —— 静默失败好过弹一个用户看不懂的错 */
        }
        ta.remove()
      }
      if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, fallback)
      else fallback()
    },
    [flashCopied, showToast],
  )

  /* ================================================================== *
   * 控制台
   * ================================================================== */

  const putLines = useCallback((next: ConsoleLine[]) => {
    linesRef.current = next
    setLines(next)
  }, [])

  const EMPTY_LINE = (): ConsoleLine => ({ id: (lineSeq.current += 1), t: '--:--:--', text: '等待开始部署…', empty: true })

  const clearConsole = useCallback(() => {
    lineSeq.current = 0
    putLines([EMPTY_LINE()])
    setFollowTail(true)
  }, [putLines])

  /**
   * 打一行。有 `stepKey` 的行是"点某一步能定位过去"的锚。
   * 空态那一行先被摘掉 —— 否则第一行会永远停在「等待开始部署…」下面。
   */
  const logAt = useCallback(
    (text: string, kind: ConsoleLine['kind'] = '', stepKey?: string) => {
      const kept = linesRef.current.filter((l) => !l.empty)
      putLines([...kept, { id: (lineSeq.current += 1), t: hhmmss(), text, kind, stepKey }])
    },
    [putLines],
  )

  const logStepHeader = useCallback(
    (st: DeployStep) => {
      const kept = linesRef.current.filter((l) => !l.empty)
      putLines([...kept, { id: (lineSeq.current += 1), t: '', text: `── ${st.name} ──`, header: true, stepKey: st.key }])
    },
    [putLines],
  )

  /* 自动跟随：新行进来就滚到底。手动往上翻会退出跟随（见下面的 scroll 处理） */
  useEffect(() => {
    const box = consoleRef.current
    if (box && followTail) box.scrollTop = box.scrollHeight
  }, [lines, followTail])

  const onConsoleScroll = () => {
    const box = consoleRef.current
    if (!box) return
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 8
    if (followTail && !atBottom) setFollowTail(false)
    else if (!followTail && atBottom) setFollowTail(true)
  }

  const copyConsole = () => {
    const rows = linesRef.current.filter((l) => !l.empty)
    if (!rows.length) return
    const text = rows.map((l) => `${l.t}  ${l.text ?? ''}`.trim()).join('\n')
    copyText(text, 'console', '已复制全部日志')
  }

  /* ================================================================== *
   * 执行：一步接一步地跑，带进度与终端输出
   *
   * 这里是命令式流程（定时器 + 回调链），与 React 的声明式渲染混在一起。
   *    两条规矩让它可以推理：
   *      · 会被定时器读到的值一律走 ref（`stepsRef` / `cfgRef` / `linesRef` / `runRef`）；
   *      · 只影响渲染的一律走函数式 `setState(prev => …)`，不要从闭包里读旧 state。
   *    违反任一条的症状都是"偶发"：某一步的时间不走了 / 中止之后还在往下推 / 控制台少一行。
   * ================================================================== */

  const putSteps = useCallback((next: DeployStep[]) => {
    stepsRef.current = next
    setSteps(next)
  }, [])

  const later = useCallback((fn: () => void, ms: number) => {
    const t = window.setTimeout(fn, ms)
    timers.current.push(t)
    return t
  }, [])

  const clearTimers = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }, [])

  const markStep = useCallback((i: number, status: StepStatus, badge: string, time: string) => {
    setStepState((prev) => {
      const next = prev.slice()
      const cur = next[i] ?? { status: 'idle' as StepStatus, badge: String(i + 1), time: '待执行' }
      next[i] = { ...cur, status, badge, time }
      return next
    })
  }, [])

  const setBarPct = useCallback((i: number, pct: number) => {
    setStepState((prev) => {
      const next = prev.slice()
      if (next[i]) next[i] = { ...next[i], barPct: pct }
      return next
    })
  }, [])

  /** `fillUp = true` 走成功路径（补满）；失败/中止时停在当前进度 —— 补满等于假报成功 */
  const stopBar = useCallback((fillUp: boolean) => {
    if (fillUp) setStepState((prev) => prev.map((s) => (s.barPct === undefined ? s : { ...s, barPct: 100 })))
  }, [])

  const setHintText = useCallback((text: string, warn = false, busy = false) => {
    setHint(text ? { text, warn, busy } : null)
  }, [])

  const setMeta = useCallback((text: string, kind = '') => {
    setRunMeta({ text, kind })
    setMetaJump(null)
  }, [])

  /**
   * 步骤行切到「跳过」。`idle` 要去掉再加 `skip` —— 留着两个状态类，
   * 后面任何按类名判断状态的地方都会读到自相矛盾的行。
   */
  const markRemainingSkipped = useCallback((fromIdx: number) => {
    setStepState((prev) =>
      prev.map((s, i) => (i > fromIdx && s.status === 'idle' ? { ...s, status: 'skip' as StepStatus, badge: '—', time: '跳过' } : s)),
    )
  }, [])

  /* ---- 步骤推进 ---- */

  /**
   * 部署成功之后落一条发布记录 —— 运维页的「最近发布」与机器的发布条数读的就是它。
   * 写失败不改判部署结果：机器上已经成功了，不能因为一条记录回退成失败。
   */
  const recordRelease = useCallback(
    async (files: number, path: string) => {
      if (!id || !host) return
      try {
        await createRelease({
          projectId: id,
          serverHost: host,
          version: `deploy-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`,
          resultCode: 'success',
          durationSec: Math.max(1, Math.round((Date.now() - deployStart.current) / 1000)),
          changes: `${files} 个文件 → ${path}`,
        })
        void queryClient.invalidateQueries({ queryKey: releaseKeys.all })
      } catch (error) {
        showToast(`发布记录没写上：${errorText(error)}`, 'warn')
      }
    },
    [host, id, queryClient, showToast],
  )

  const finish = useCallback(
    (ok: boolean) => {
      clearTimers()
      runRef.current = false
      setRunning(false)
      tickRef.current = null
      setRunLabel(ok ? '再次部署' : '重试部署')
      const total = `${((Date.now() - deployStart.current) / 1000).toFixed(1)}s`
      setTaskTotal(total)
      setTaskCountOverride(null)
      if (ok) {
        setHintText(`部署完成 · ${hhmmss()}`, false, false)
        setMeta(`部署完成 · ${hhmmss()}`, 'ok')
        showToast('部署完成')
        const done = factsRef.current?.()
        if (done?.cfg) void recordRelease(done.files.length, done.cfg.path)
      } else {
        setHintText('部署失败 —— 后续步骤已停止，服务停在失败前的状态', true, false)
        setMeta('部署失败', 'err')
        showToast('部署失败', 'danger')
      }
      setFollowTail(true)
    },
    [clearTimers, recordRelease, setHintText, setMeta, showToast],
  )
  /* 定时器里要调 finish，但它自己在 `later` 的回调里被引用 —— 用 ref 打断这个环 */
  const finishRef = useRef<((ok: boolean) => void) | null>(null)
  useEffect(() => {
    finishRef.current = finish
  }, [finish])

  /* ---- 每一步真干什么 ----
   * 全部走 SSH：`srv_run` 跑命令、`srv_upload` 收文件。
   * 成功与否只看远端退出码与连接结果 —— 没有"演示失败链"，也没有假耗时。
   * ------------------------------------------------------------------ */

  /** 一次执行用到的事实。异步回调里读 state 只会读到旧值，统一走 ref。 */
  const factsRef = useRef<(() => { files: StagedFile[]; cfg: DeployConfig | null; host: string }) | null>(null)
  useEffect(() => {
    factsRef.current = () => ({ files: staged[fileSrc], cfg, host })
  }, [staged, fileSrc, cfg, host])

  /**
   * 命令输出按行打进控制台。一次构建可能刷几百行，留前 200 行就够定位。
   *
   * 整批一次写进去：逐行 `logAt` 会让一个 200 行的构建触发 200 次渲染，
   * 每步都卡一下（而且是白卡 —— 用户看不到中间态）。
   */
  const logOutput = useCallback(
    (text: string, key: string, kind: '' | 'warn') => {
      const lines = text.replace(/\r\n/g, '\n').split('\n').filter((line) => line.trim())
      if (!lines.length) return
      const LIMIT = 200
      const kept = linesRef.current.filter((l) => !l.empty)
      const added: ConsoleLine[] = lines.slice(0, LIMIT).map((line) => ({
        id: (lineSeq.current += 1),
        t: hhmmss(),
        text: line,
        kind,
        stepKey: key,
      }))
      if (lines.length > LIMIT) {
        added.push({
          id: (lineSeq.current += 1),
          t: hhmmss(),
          text: `… 还有 ${lines.length - LIMIT} 行未显示`,
          kind: 'sub',
          stepKey: key,
        })
      }
      putLines([...kept, ...added])
    },
    [putLines],
  )

  /**
   * 第一步：本机文件都还在，远端目标位置可用。
   *
   * 远端也在这里先探一次：连不上 / 认证不对，现在就该知道 —— 等到传完几百兆
   * 才报"连接失败"是同一件事晚了一步。目标目录不存在不算错（上传会建），
   * 但目标是个文件要立刻停：上传会把它盖掉。
   */
  const stepCheck = useCallback(async () => {
    const f = factsRef.current?.()
    if (!f) return
    if (!f.files.length) throw new Error('没有要部署的文件')
    const missing: string[] = []
    for (const file of f.files) {
      if (!file.path) {
        missing.push(`${file.name}（这条没有本机路径）`)
        continue
      }
      try {
        const meta = await statLocal(file.path)
        if (!meta || meta.dir) missing.push(`${file.name} → ${file.path}`)
        else logAt(`✓ ${file.name} · ${fmtSize(meta.size)} · ${mtimeText(meta.mtime)}`, 'sub', 'check')
      } catch (error) {
        missing.push(`${file.name} → ${errorText(error)}`)
      }
    }
    if (missing.length) throw new Error(`本机缺文件：${missing.join('；')}`)

    const dir = f.cfg?.path.replace(/\/+$/, '')
    if (!dir) return
    if (!f.host) throw new Error('这个项目没有可用的服务器')
    const meta = await statRemote(f.host, dir)
    if (!meta) logAt(`目标目录 ${dir} 还不存在 —— 上传时创建`, 'sub', 'check')
    else if (!meta.dir) throw new Error(`目标路径 ${dir} 是一个文件，不是目录`)
    else logAt(`✓ 目标目录 ${dir} 存在`, 'sub', 'check')
  }, [logAt])

  /**
   * 第二步：真上传到 `<path>/<文件名>`，多个文件并排传。
   *
   * 并发的根据：同一台机器的一次性调用共用一根 SSH 主连接（ControlMaster
   * 本来就是多路复用的），串行的等待全耗在往返上而不是带宽上。
   * 字节数由后端核对，断点续传也在后端（远端 `.part` 就是进度）。
   */
  const stepUpload = useCallback(
    async (i: number) => {
      const f = factsRef.current?.()
      if (!f?.cfg) return
      const host = f.host
      if (!host) throw new Error('这个项目没有可用的服务器，传不了')
      const dir = f.cfg.path.replace(/\/+$/, '')
      const files = f.files
      let done = 0
      let failed = false
      const queue = [...files]

      const worker = async () => {
        for (;;) {
          if (failed || !runRef.current) return
          const file = queue.shift()
          if (!file) return
          if (!file.path) throw new Error(`${file.name} 没有本机路径，传不了`)
          const to = `${dir}/${file.name}`
          logAt(`↑ ${file.name} · ${fmtSize(file.size)}`, '', 'upload')
          let out
          try {
            out = await uploadRemote(host, file.path, to)
          } catch (error) {
            failed = true
            throw error
          }
          done += 1
          setBarPct(i, Math.round((done / files.length) * 100))
          const from = out.resumedFrom > 0 ? ` · 从 ${fmtSize(out.resumedFrom)} 续传` : ''
          logAt(
            `✓ ${to} · ${fmtSize(out.remoteSize)} · ${(out.durationMs / 1000).toFixed(1)}s${from}`,
            'ok',
            'upload',
          )
        }
      }

      /* 三条并排：再多对单根连接的收益就很小了，远端磁盘反而开始抢 */
      const width = Math.min(3, files.length)
      await Promise.all(Array.from({ length: width }, worker))
    },
    [logAt, setBarPct],
  )

  /** 第三步：把即将被覆盖的同名文件复制到 `<path>/.deploy-backup/`。
   *  第一次往空目录里传时没有旧文件 —— 这是"没有可备份的"，不是失败。 */
  const stepBackup = useCallback(async () => {
    const f = factsRef.current?.()
    if (!f?.cfg || !f.files.length) return
    if (!f.host) throw new Error('这个项目没有可用的服务器')
    const dir = f.cfg.path.replace(/\/+$/, '')
    const names = f.files.map((x) => `'${x.name.replace(/'/g, "'\\''")}'`).join(' ')
    const script = [
      'ts=$(date +%Y%m%d-%H%M%S)',
      'made=0',
      `for n in ${names}; do`,
      `  if [ -f "${dir}/$n" ]; then`,
      `    mkdir -p "${dir}/.deploy-backup" && cp -a "${dir}/$n" "${dir}/.deploy-backup/$n.$ts" || exit 1`,
      '    made=1',
      '  fi',
      'done',
      'if [ "$made" = 1 ]; then echo BAKED; else echo NONE; fi',
    ].join('\n')
    const out = await runRemote(f.host, '', script)
    if (out.code !== 0) throw new Error(out.stderr.trim() || `备份脚本退出码 ${out.code}`)
    if (out.stdout.includes('BAKED')) logAt(`✓ 回滚点 ${dir}/.deploy-backup`, 'ok', 'backup')
    else logAt('目标目录里没有同名旧文件（首次部署），这一步没有可备份的', 'warn', 'backup')
  }, [logAt])

  /**
   * 弹框要一段输入，等用户填完再继续。
   *
   * 输入不落库、也不进日志：它多半是密码，进了配置 JSON 就等于明文存了一份，
   * 进了日志就会被复制/截图带出去。后端还会把 pty 回显的那几行抹成 `***`。
   */
  const askForInput = useCallback((op: string, run: string) => {
    return new Promise<string | null>((resolve) => {
      setAskDraft('')
      setAskInput({ op, run, resolve })
    })
  }, [])

  const answerAsk = useCallback(
    (value: string | null) => {
      if (!askInput) return
      askInput.resolve(value)
      setAskInput(null)
      setAskDraft('')
    },
    [askInput],
  )

  /** 跑一组命令。退出码非 0 即这一步失败 —— 后面的命令不再执行。 */
  const runCommands = useCallback(
    async (items: CmdItem[], key: string) => {
      const f = factsRef.current?.()
      if (!f?.cfg) return
      if (!f.host) throw new Error('这个项目没有可用的服务器')
      for (const it of items) {
        if (!runRef.current) return
        if (it.op) logAt(`· ${it.op}`, 'sub', key)
        logAt(`$ ${it.run}`, '', key)

        let feed: string | undefined
        if (needsHuman(it, sessionUser)) {
          logAt('这条命令要输入 —— 等你在弹窗里填（内容不进日志）', 'sub', key)
          const answer = await askForInput(it.op || it.run, it.run)
          if (!runRef.current) return
          if (answer === null) throw new Error('你取消了这条命令的输入，部署停在这里')
          feed = answer
        }

        const out = await runRemote(f.host, f.cfg.path, it.run, feed)
        if (out.stdout.trim()) logOutput(out.stdout, key, '')
        /* 带输入时远端开了 pty，stderr 并进 stdout（上面已经打过了） */
        if (!out.fed && out.stderr.trim()) logOutput(out.stderr, key, 'warn')
        if (out.code !== 0) {
          const tail = out.stderr.trim().split('\n').filter(Boolean).pop() ?? ''
          throw new Error(`「${it.op || it.run}」退出码 ${out.code}${tail ? `：${tail}` : ''}`)
        }
        logAt(`✓ 退出码 0 · ${(out.durationMs / 1000).toFixed(1)}s`, 'ok', key)
      }
    },
    [askForInput, logAt, logOutput, sessionUser],
  )

  const runStep = useCallback(
    async (i: number) => {
      if (!runRef.current) return
      const list = stepsRef.current
      if (i >= list.length) {
        finishRef.current?.(true)
        return
      }
      const st = list[i]

      /* 终态步：只做标记 */
      if (st.key === 'done') {
        markStep(i, 'ok', '✓', '—')
        logAt('部署流程结束', 'ok', st.key)
        finishRef.current?.(true)
        return
      }

      const t0 = Date.now()
      markStep(i, 'run', '●', '0.0s')
      logStepHeader(st)
      tickRef.current = { idx: i, t0, waitT0: 0, mode: 'run' }
      setHintText(`第 ${i + 1} / ${list.length} 步 · ${st.name}`, false, true)
      if (st.bar) setBarPct(i, 0)

      const cur = cfgRef.current
      const all = cur ? cmdList(cur.cmd) : []
      const isCurl = (x: CmdItem) => /^curl\b/i.test(x.run)
      const startCmds = all.filter((x) => !isCurl(x))
      const healthCmds = all.filter(isCurl)

      try {
        if (st.key === 'check') await stepCheck()
        else if (st.key === 'upload') await stepUpload(i)
        else if (st.key === 'backup') await stepBackup()
        else if (st.key === 'start') await runCommands(startCmds, 'start')
        else if (st.key === 'health') {
          if (!healthCmds.length) {
            /* 没有 curl 命令 = 这条配置没配健康检查，跳过而不是假装通过 */
            tickRef.current = null
            markStep(i, 'skip', '—', '跳过')
            logAt('配置里没有健康检查命令（curl），这一步跳过', 'warn', 'health')
            runStepRef.current?.(i + 1)
            return
          }
          await runCommands(healthCmds, 'health')
        }
        if (!runRef.current) return
        tickRef.current = null
        if (st.bar) stopBar(true)
        markStep(i, 'ok', '✓', `${((Date.now() - t0) / 1000).toFixed(1)}s`)
        runStepRef.current?.(i + 1)
      } catch (error) {
        /* 中止打断的那条请求也会落到这里，别把它报成失败 */
        if (!runRef.current) return
        tickRef.current = null
        if (st.bar) stopBar(false)
        markStep(i, 'err', '✕', `${((Date.now() - t0) / 1000).toFixed(1)}s`)
        logAt(`✕ ${st.name} 失败：${errorText(error)}`, 'err', st.key)
        markRemainingSkipped(i)
        later(() => finishRef.current?.(false), 600)
      }
    },
    [logAt, logStepHeader, markRemainingSkipped, markStep, runCommands, setBarPct, setHintText, stepBackup, stepCheck, stepUpload, stopBar, later],
  )

  const runStepRef = useRef<((i: number) => void) | null>(null)
  useEffect(() => {
    runStepRef.current = runStep
  }, [runStep])

  /* ---- 步骤列表的重建与复位 ---- */

  const idleStates = (list: DeployStep[]): StepState[] =>
    list.map((_, i) => ({ status: 'idle' as StepStatus, badge: String(i + 1), time: '待执行' }))

  /** 第一步的名字跟着「用哪种来源、备了几个文件」走 */
  const refreshFirstStep = useCallback(() => {
    if (runRef.current) return
    const next = stepsRef.current.map((st, i) =>
      i === 0 ? { ...st, name: checkStepName(staged[fileSrc].length, fileSrc) } : st,
    )
    putSteps(next)
  }, [fileSrc, putSteps, staged])

  /** 换配置 / 改配置 / 换身份 / 刷新都要走它：步骤、控制台、进度、状态行一起回到默认态。 */
  const resetRun = useCallback(
    (forCfg: DeployConfig | null) => {
      clearTimers()
      runRef.current = false
      setRunning(false)
      tickRef.current = null
      setRunLabel('开始部署')
      setHintText('')
      setMeta('等待开始')
      setTaskTotal(null)
      setTaskCountOverride(null)
      setTaskFolded(false)
      setFocusIdx(null)
      clearConsole()
      if (forCfg) {
        const list = buildSteps(forCfg, sessionUser)
        list[0].name = checkStepName(staged[fileSrc].length, fileSrc)
        putSteps(list)
        setStepState(idleStates(list))
      } else {
        putSteps([])
        setStepState([])
      }
    },
    [clearConsole, clearTimers, fileSrc, putSteps, sessionUser, setHintText, setMeta, staged],
  )

  /* 配置一变就重建步骤列，并把执行区复位（原型在每个改动它的入口里显式调 `resetRun`，
     React 里挂在"配置身份变了"这一件事上更可靠）。
     跑着的时候绝不能重建 —— 那会把正在推进的那一列换掉。
     与 `refreshFirstStep` 那个 effect 分工要清楚：加/减文件不重建整列、也不清控制台
        （那是"备料"，不是"改配置"），所以那两个动作不在这个 effect 的依赖里。 */
  useEffect(() => {
    if (runRef.current) return
    const list = cfg ? buildSteps(cfg, sessionUser) : []
    if (list[0]) list[0].name = checkStepName(staged[fileSrc].length, fileSrc)
    putSteps(list)
    setStepState(idleStates(list))
    clearConsole()
    setRunLabel('开始部署')
    setHintText('')
    setMeta('等待开始')
    setTaskTotal(null)
    setTaskCountOverride(null)
    setTaskFolded(false)
    setFocusIdx(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfg, sessionUser])

  /* 文件增减只影响第一步的名字，不重建整列（否则控制台会被清掉） */
  useEffect(() => {
    refreshFirstStep()
  }, [refreshFirstStep])

  /* ---- 主流程 ---- */

  const startDeploy = useCallback(() => {
    if (runRef.current) return
    const cur = cfgRef.current
    if (!cur) {
      showToast('请先在左栏选择一个部署配置', 'warn')
      return
    }
    if (!host) {
      showToast('这个项目还没有登记服务器，没法部署', 'warn')
      setHintText('这个项目还没有登记服务器 —— 先到台账里连一台，再回来部署', true, false)
      return
    }
    const list = staged[fileSrc]
    if (!list.length) {
      showToast(`请先在「${SRC_LABEL[fileSrc]}」这一边备好文件`, 'warn')
      if (fileSrc === 'pick') {
        setDragOver(true)
        window.setTimeout(() => setDragOver(false), 700)
      }
      return
    }
    /* 路径在本机找不到就别让它跑到上传那一步才失败 —— 这里挡住，并指出是哪一条 */
    const miss = list.filter((f) => f.found === false)
    if (miss.length) {
      showToast(`有 ${miss.length} 个文件在本机找不到：${miss.map((f) => f.name).join('、')}`, 'warn')
      setHintText(`本机找不到这段路径：${miss[0].path} —— 改对路径或先移除，再开始部署`, true, false)
      return
    }

    /* 真跑之前给一次确认：这些命令会改动机器上的东西，而配置里的路径可能是示例。
       只对"会删/会覆盖"的命令要确认 —— 每条都弹一次等于训练用户闭眼点确定。 */
    const allCmds = cmdList(cur.cmd)
    const risky = allCmds.filter((x) => RISKY_CMD.test(x.run))
    if (risky.length) {
      const ok = window.confirm(
        `要对 ${host} 执行 ${allCmds.length} 条命令，其中 ${risky.length} 条会删改数据：\n\n` +
          risky.map((x) => `· ${x.run}`).join('\n') +
          `\n\n目标目录：${cur.path}\n\n确认执行吗？`,
      )
      if (!ok) return
    }

    runRef.current = true
    setRunning(true)
    deployStart.current = Date.now()
    setRunLabel('部署中…')
    setHintText('正在执行…', false, true)
    setTaskTotal(null)
    setTaskCountOverride(null)
    setTaskFolded(false)
    setFocusIdx(null)
    setMeta('执行中…', 'run')

    const built = buildSteps(cur, sessionUser)
    built[0].name = checkStepName(list.length, fileSrc)
    putSteps(built)
    setStepState(idleStates(built))
    clearConsole()

    logAt(`开始部署「${cur.name}」→ ${host}（连接身份 ${sessionUser}）`, '')
    logAt(`目标路径 ${cur.path} · 来源「${SRC_LABEL[fileSrc]}」${list.length} 个文件 / ${fmtSize(totalSize(list))}`, '')
    /* 每个文件都会真上传：先说清"从哪个本机路径传到哪个远端路径"，出问题时日志才追得下去 */
    list.forEach((f) => logAt(`· ${f.path ?? '（无本机路径）'} → ${cur.path.replace(/\/+$/, '')}/${f.name}`, 'sub'))
    /* 提权那一刻本来最容易停下来问人 —— 这里先说明这条配置不会问。
       root 身份下不存在"授权不足"，那句话就不该出现 */
    if (
      sessionUser !== 'root' &&
      cmdList(cur.cmd).some((x) => /^sudo\b/.test(x.run) && /(^|\s)-n(\s|$)/.test(x.run))
    ) {
      logAt('提权命令用非交互写法（sudo -n）：服务器上没配授权会立刻失败，不会停下来等密码', 'sub')
    }
    runStepRef.current?.(0)
  }, [clearConsole, fileSrc, host, logAt, putSteps, sessionUser, setHintText, setMeta, showToast, staged])

  const abortDeploy = useCallback(() => {
    if (!runRef.current) return
    /* 正等着输入时中止：那个输入框要先收掉，否则会留在终端里点得动 */
    setAskInput((cur) => {
      cur?.resolve(null)
      return null
    })
    clearTimers()
    runRef.current = false
    setRunning(false)
    tickRef.current = null

    const idx = activeStepIdx
    if (idx >= 0) {
      /* 进度条保持当前宽度 —— 中止时上传并没有传完，补满等于假报成功 */
      markStep(idx, 'idle', '■', '已中止')
      /* 从 idx 之后开始跳过：传 idx-1 会把刚标好的「已中止」再盖成「跳过」 */
      markRemainingSkipped(idx)
    }
    logAt('用户中止了本次部署', 'warn')
    setRunLabel('重新部署')
    setHintText('已中止 · 后续步骤不再执行（正在跑的那条命令停不下来）', true, false)
    setMeta('已中止', 'err')
    setTaskCountOverride('已中止')
    showToast('已中止部署', 'warn')
  }, [activeStepIdx, clearTimers, logAt, markRemainingSkipped, markStep, setHintText, setMeta, showToast])

  /** 单步重试：该步及其之后全部复位，从这一格重新往下跑。 */
  const retryStep = useCallback(
    (i: number) => {
      if (runRef.current) return
      const cur = cfgRef.current
      if (!cur) return
      setStepState((prev) => {
        const next = prev.slice()
        next[i] = { ...(next[i] ?? { status: 'idle', badge: String(i + 1), time: '待执行' }), retry: (next[i]?.retry ?? 0) + 1 }
        for (let k = i; k < next.length; k += 1) {
          const keepRetry = k === i ? next[k].retry : undefined
          next[k] = {
            status: 'idle',
            badge: String(k + 1),
            time: '待执行',
            retry: keepRetry,
            /* 进度条也要归零 —— 原型是 `bar.style.width = '0%'`。
               留着上一轮的宽度会让"重新开始"看起来像"已经传了一半" */
            barPct: k === i ? 0 : undefined,
          }
        }
        return next
      })
      runRef.current = true
      setRunning(true)
      setRunLabel('部署中…')
      setHintText(`从「${stepsRef.current[i]?.name ?? ''}」重试中…`, false, true)
      setMeta('重试中…', 'run')
      logAt(`↻ 从「${stepsRef.current[i]?.name ?? ''}」重试（第 ${(stepState[i]?.retry ?? 0) + 1} 次）`, 'warn')
      runStepRef.current?.(i)
    },
    [logAt, setHintText, setMeta, stepState],
  )

  /* ---- 顶栏与左栏的动作 ---- */

  const refresh = async () => {
    if (runRef.current) {
      showToast('部署执行中，完成后再刷新', 'warn')
      return
    }
    if (refreshing) return
    setRefreshing(true)
    setLastSync('正在重读…')
    try {
      /* 两侧都是磁盘的事实：本机刚打过包、服务器上刚被人动过目录，都要重读一遍才算"刷新" */
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: localFsKeys.all }),
        queryClient.invalidateQueries({ queryKey: remoteFsKeys.all }),
      ])
      resetRun(cfgRef.current)
      setLastSync(`更新于 ${hhmmss().slice(0, 5)}`)
      showToast('已刷新部署配置')
    } finally {
      setRefreshing(false)
    }
  }

  const selectConfig = (nextId: string) => {
    if (runRef.current) {
      showToast('部署执行中，暂不能切换配置', 'warn')
      return
    }
    if (nextId === currentId) return
    setCurrentId(nextId)
    setDialog(null)
  }

  const changeSessionUser = (next: string) => {
    if (runRef.current) {
      showToast('部署执行中，暂不能切换连接身份', 'warn')
      return
    }
    setSessionUser(next)
    resetRun(cfgRef.current)
    showToast(`连接身份已切到 ${next}`)
  }

  const addGroup = (name: string): GroupItem | null => {
    const n = name.trim()
    if (!n) return null
    const same = groups.find((g) => g.name === n)
    if (same) return same
    groupSeq.current += 1
    const made: GroupItem = { id: `g${groupSeq.current}`, name: n }
    /* 插在「其它」之前：兜底组认 id 不认位置，但让它待在最后读起来才顺 */
    const idx = groups.findIndex((g) => g.id === OTHER_GROUP)
    setGroups(idx < 0 ? [...groups, made] : [...groups.slice(0, idx), made, ...groups.slice(idx)])
    return made
  }

  /* ================================================================== *
   * 上传：① 选文件 / 拖入　② 绑定本机路径
   * ================================================================== */

  /**
   * 探测结果回来就写回清单 —— "自动查找"不能只在绑定的那一刻发生一次。
   * 只在新结论与旧值不同时才换对象，否则每次重画都会造一份新清单，把下面的
   * `staged` 依赖全带起来。
   */
  useEffect(() => {
    const hit = localProbeQuery.data
    if (!hit) return
    setStaged((prev) => {
      let dirty = false
      const refresh = (arr: StagedFile[]) =>
        arr.map((f) => {
          const meta = hit[f.path ?? '']
          const found = Boolean(meta) && !meta?.dir
          const size = meta && found ? meta.size : 0
          const time = meta && found ? mtimeText(meta.mtime) : ''
          if (f.found === found && f.size === size && f.time === time) return f
          dirty = true
          return { ...f, found, size, time }
        })
      const local = refresh(prev.local)
      const pick = refresh(prev.pick)
      return dirty ? { ...prev, local, pick } : prev
    })
  }, [localProbeQuery.data])

  /**
   * 加一批本机文件。拖拽与「选择文件」都走这里 —— 两条路拿到的都是绝对路径。
   *
   * 上传要的就是路径：浏览器里的 `File` 对象出不了这个进程，拿不到路径就只能传个名字。
   * 所以这一侧不再有 `<input type=file>`，改成原生拖拽 + 本机目录选择器。
   */
  const addLocalPaths = useCallback(
    async (paths: string[]) => {
      if (!paths.length) return
      if (runRef.current) {
        showToast('部署执行中，请先中止或等待完成', 'warn')
        return
      }
      const rows: StagedFile[] = []
      const bad: string[] = []
      for (const path of paths) {
        try {
          const meta = await statLocal(path)
          if (!meta) {
            bad.push(`${baseName(path)}（本机没有）`)
            continue
          }
          if (meta.dir) {
            bad.push(`${meta.name}（是目录）`)
            continue
          }
          rows.push({ src: 'pick', name: meta.name, size: meta.size, path, time: mtimeText(meta.mtime), found: true })
        } catch (error) {
          bad.push(`${baseName(path)}（${errorText(error)}）`)
        }
      }
      if (!rows.length) {
        showToast(bad.length ? `没能加入：${bad.join('、')}` : '没有可加入的文件', 'warn')
        return
      }
      setFileSrc('pick')
      setStaged((prev) => {
        const arr = prev.pick.slice()
        rows.forEach((it) => {
          const i = arr.findIndex((x) => x.path === it.path || x.name === it.name)
          if (i > -1) arr[i] = it // 同名或同路径覆盖，避免列出两个一样的
          else arr.push(it)
        })
        return { ...prev, pick: arr }
      })
      showToast(`已添加 ${rows.length} 个文件${bad.length ? ` · ${bad.length} 个跳过` : ''}`)
    },
    [showToast],
  )

  /** 拖放区上是否真的悬着东西：Tauri 的拖拽事件是窗口级的，要自己判位置 */
  const dzRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let stop: (() => void) | null = null
    let disposed = false
    try {
      void getCurrentWebview()
        .onDragDropEvent((event) => {
          const p = event.payload
          if (p.type === 'leave') {
            setDragOver(false)
            return
          }
          const rect = dzRef.current?.getBoundingClientRect()
          const dpr = window.devicePixelRatio || 1
          const inside =
            Boolean(rect) &&
            fileSrc === 'pick' &&
            p.position.x / dpr >= rect!.left &&
            p.position.x / dpr <= rect!.right &&
            p.position.y / dpr >= rect!.top &&
            p.position.y / dpr <= rect!.bottom
          if (p.type === 'enter' || p.type === 'over') {
            setDragOver(inside)
            return
          }
          setDragOver(false)
          if (inside) void addLocalPaths(p.paths)
        })
        .then((fn) => {
          if (disposed) fn()
          else stop = fn
        })
    } catch {
      /* 浏览器里没有 Tauri 环境（`vite dev`）：拖拽不上传，页面其余部分照常 */
    }
    return () => {
      disposed = true
      stop?.()
    }
  }, [addLocalPaths, fileSrc])

  const pickFiles = () => {
    if (runRef.current) {
      showToast('部署执行中，请先中止或等待完成', 'warn')
      return
    }
    /* 复用本机目录选择器（它读的是真磁盘），选中的文件直接进清单 */
    openPicker({
      src: 'local',
      mode: 'file',
      currentPath: '',
      standalone: true,
      take: (value) => void addLocalPaths([value]),
    })
  }

  /**
   * 绑定一条本机路径。
   *
   * 探测要读磁盘，所以是异步的：先挡明显不合法的输入，再等 `fs_stat` 回来落结论。
   * 结论只有三种 —— 找到了（带大小与修改时间）/ 本机没有 / 读不到（权限）。
   * 第三种以前混在"没有这个文件"里，用户照着一句"没有"去查路径，白找一遍。
   */
  const submitBind = (raw: string) => {
    void bindPathNow(raw)
  }

  const bindPathNow = async (raw: string) => {
    if (runRef.current) {
      showToast('部署执行中，暂不能改文件列表', 'warn')
      return
    }
    /* 点「绑定」会先触发失焦：把在途的那次探测作废，别让它的结论盖掉这一次的 */
    bindSeq.current += 1
    const path = raw.trim()
    if (!path) {
      setBindState({ kind: 'bad', text: '先填一个本机文件的绝对路径', detail: '' })
      return
    }
    if (path[0] !== '/') {
      setBindState({ kind: 'bad', text: '要绝对路径（从 / 开始）', detail: '' })
      return
    }
    const name = baseName(path)
    if (!name) {
      setBindState({ kind: 'bad', text: '这个路径指向的是一个目录', detail: '' })
      return
    }

    setBindBusy(true)
    let meta: Awaited<ReturnType<typeof probeLocalFile>> = null
    let failure = ''
    try {
      meta = await probeLocalFile(path)
    } catch (error) {
      failure = errorText(error)
    }
    setBindBusy(false)

    if (failure) {
      setBindState({ kind: 'bad', text: failure, detail: path })
      setBindInvalid(true)
      return
    }
    if (meta && meta.dir) {
      setBindState({ kind: 'bad', text: '这个路径指向的是一个目录，要的是文件', detail: path })
      setBindInvalid(true)
      return
    }

    const found = Boolean(meta)
    const it: StagedFile = {
      src: 'local',
      path,
      name,
      size: meta ? meta.size : 0,
      time: meta ? mtimeText(meta.mtime) : '',
      found,
    }
    /* 能填路径绑定，就说明这次要用"绑定本地文件" —— 顺手把来源切过去（面板本来就该是它） */
    setFileSrc('local')
    setStaged((prev) => {
      const arr = prev.local.slice()
      const i = arr.findIndex((x) => x.name === name)
      if (i > -1) arr[i] = it
      else arr.push(it)
      return { ...prev, local: arr }
    })
    /* 加进去就该清空 —— 它是个"新增"入口，不是待提交的表单字段 */
    setBindPath('')
    setBindInvalid(false)
    if (found) setRecentBinds((prev) => [path, ...prev.filter((p) => p !== path)].slice(0, 4))
    setBindState(
      found && meta
        ? { kind: 'ok', text: `本机已找到 ${name} · 已加入清单`, detail: `${fmtSize(meta.size)} · ${mtimeText(meta.mtime)}` }
        : { kind: 'bad', text: '本机没有这个文件 · 已标记「未找到」', detail: path },
    )
    showToast(
      found ? `已绑定 ${name}（本机已找到，直接用这份）` : `已绑定 ${name}，但本机没找到 —— 部署会被它挡住`,
      found ? 'ok' : 'warn',
    )
  }

  /**
   * 边打边查：只要命中就立刻绿字。
   * 查不到先不说（打字打一半被红字打断很烦），留给失焦 / 绑定 / 按回车那一刻。
   * 读盘是异步的，所以每次查询带一个轮次戳：慢的那次回来时路径早换了，结论不能落上去。
   */
  const onBindTyping = (value: string) => {
    setBindPath(value)
    setBindInvalid(false)
    if (bindTimer.current !== null) window.clearTimeout(bindTimer.current)
    const path = value.trim()
    if (!path) {
      setBindState({ kind: '', text: '', detail: '' })
      return
    }
    bindTimer.current = window.setTimeout(() => {
      const seq = ++bindSeq.current
      void probeLocalFile(path)
        .then((meta) => {
          if (seq !== bindSeq.current) return
          if (!meta || meta.dir) {
            setBindState({ kind: '', text: '', detail: '' })
            return
          }
          setBindState({ kind: 'ok', text: '本机已找到', detail: `${fmtSize(meta.size)} · ${mtimeText(meta.mtime)}` })
        })
        .catch(() => {
          /* 打字途中的权限错误不弹红字，交给失焦那一刻说清楚 */
          if (seq === bindSeq.current) setBindState({ kind: '', text: '', detail: '' })
        })
    }, 220)
  }

  const onBindBlur = () => {
    if (bindTimer.current !== null) window.clearTimeout(bindTimer.current)
    const path = bindPath.trim()
    if (!path) {
      setBindState({ kind: '', text: '', detail: '' })
      setBindInvalid(false)
      return
    }
    const seq = ++bindSeq.current
    void probeLocalFile(path)
      .then((meta) => {
        if (seq !== bindSeq.current) return
        if (meta && !meta.dir) {
          setBindState({ kind: 'ok', text: '本机已找到', detail: `${fmtSize(meta.size)} · ${mtimeText(meta.mtime)}` })
          setBindInvalid(false)
          return
        }
        setBindState(
          meta
            ? { kind: 'bad', text: '这个路径指向的是一个目录，要的是文件', detail: path }
            : { kind: 'bad', text: '本机没有这个文件', detail: path },
        )
        setBindInvalid(true)
      })
      .catch((error) => {
        if (seq !== bindSeq.current) return
        setBindState({ kind: 'bad', text: errorText(error), detail: path })
        setBindInvalid(true)
      })
  }

  const removeFile = (name: string) => {
    if (runRef.current) {
      showToast('部署执行中，暂不能改文件列表', 'warn')
      return
    }
    setStaged((prev) => ({ ...prev, [fileSrc]: prev[fileSrc].filter((f) => f.name !== name) }))
  }

  /**
   * 换来源：只换"当前用哪一种"，两边的清单各自留着（清空是破坏性的，而"切过去看一眼
   * 再切回来"是常见动作）。面板显隐、计数、清单、总计统一由渲染推 —— 状态只有一个来源。
   */
  const switchFileSrc = (src: FileSrc) => {
    if (runRef.current) {
      showToast('部署执行中，暂不能换文件来源', 'warn')
      return
    }
    setFileSrc(src)
  }

  /* ================================================================== *
   * 任务列：折叠 / 跳到当前步 / 键盘
   * ================================================================== */

  const toggleFold = () => {
    setTaskFolded((v) => !v)
    setTaskCountOverride(null)
  }

  /** 当前那一格是否被滚出可视区 —— 出来了才给「↓ 当前步」 */
  const recomputeJump = useCallback(() => {
    const box = stepListRef.current
    if (!box || activeStepIdx < 0) {
      setShowJump(false)
      return
    }
    const row = box.querySelector<HTMLElement>(`[data-i="${activeStepIdx}"]`)
    if (!row) {
      setShowJump(false)
      return
    }
    const b = box.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    setShowJump(!(r.top >= b.top && r.bottom <= b.bottom))
  }, [activeStepIdx])

  useEffect(() => {
    recomputeJump()
  }, [recomputeJump, stepState, taskFolded, steps])

  const jumpToCurrent = () => {
    const box = stepListRef.current
    if (!box || activeStepIdx < 0) return
    box.querySelector<HTMLElement>(`[data-i="${activeStepIdx}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }

  /** 点某一步 → 在终端里定位到它那几行 */
  const focusStep = (i: number) => {
    setFocusIdx(i)
    const key = stepsRef.current[i]?.key
    if (!key) return
    const line = consoleRef.current?.querySelector<HTMLElement>(`[data-step="${key}"]`)
    if (line) {
      line.scrollIntoView({ block: 'center', behavior: 'smooth' })
      setFlashKey(key)
      window.setTimeout(() => setFlashKey((cur) => (cur === key ? null : cur)), 1200)
    }
    /* 执行面板头部闪一下，说明「在找哪一步」 */
    setMetaJump(stepsRef.current[i]?.name ?? null)
    window.setTimeout(() => setMetaJump(null), 1600)
  }

  const onStepKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>, i: number) => {
    const box = stepListRef.current
    if (!box) return
    const rows = Array.from(box.querySelectorAll<HTMLElement>('.step'))
    const cur = rows.indexOf(event.currentTarget)
    if (event.key === 'ArrowDown' && cur > -1 && cur < rows.length - 1) {
      event.preventDefault()
      rows[cur + 1].focus()
    } else if (event.key === 'ArrowUp' && cur > 0) {
      event.preventDefault()
      rows[cur - 1].focus()
    } else if (event.key === 'Home') {
      event.preventDefault()
      rows[0]?.focus()
    } else if (event.key === 'End') {
      event.preventDefault()
      rows[rows.length - 1]?.focus()
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      focusStep(i)
    }
  }

  /* ================================================================== *
   * 弹窗：新增 / 编辑 / 删除配置，以及正文里的目录选择器
   * ================================================================== */

  const closeDialog = useCallback(() => {
    setDialog(null)
    setForm(null)
    setTip(null)
    lastFocused.current?.focus?.()
  }, [])

  const openForm = (base: DeployConfig | null) => {
    if (runRef.current) {
      showToast('部署执行中，暂不能改配置', 'warn')
      return
    }
    /* 配置还没落库（这一页的增删改是会话内的），上限 6 条只是把左栏维持在能看全的规模 */
    if (!base && configs.length >= 6) {
      showToast('最多 6 条部署配置 —— 先删掉一条再新增', 'warn')
      return
    }
    lastFocused.current = document.activeElement as HTMLElement | null
    setForm({
      baseId: base ? base.id : null,
      name: base ? base.name : '',
      path: base ? base.path : '',
      cmds: base ? cmdList(base.cmd).map((x) => ({ ...x })) : [{ op: '', run: '', ask: false }],
      groupVal: base ? groupFor(base) : OTHER_GROUP,
      /* 新建时跟着路径自动预选；编辑时以配置自身的标签为准 */
      groupAuto: !base,
      addingGroup: false,
      newGroupName: '',
      errors: {},
    })
    setDialog({ kind: 'form' })
  }

  const askDeleteConfig = (idOrNull: string | null) => {
    if (runRef.current) {
      showToast('部署执行中，暂不能删除配置', 'warn')
      return
    }
    const c = idOrNull ? configs.find((x) => x.id === idOrNull) ?? null : cfg
    if (!c) {
      showToast('请先选择一个部署配置', 'warn')
      return
    }
    lastFocused.current = document.activeElement as HTMLElement | null
    setDialog({ kind: 'delete', id: c.id })
  }

  const askEditConfig = (idOrNull: string | null) => {
    const c = idOrNull ? configs.find((x) => x.id === idOrNull) ?? null : cfg
    if (!c) {
      showToast('请先选择一个部署配置', 'warn')
      return
    }
    openForm(c)
  }

  const configById = (did: string) => configs.find((c) => c.id === did) ?? null

  /** 目录选择器：两个入口共用（表单里的「浏览服务器目录」/ 绑定行的「浏览…」），差异只有数据源与选中语义 */
  /**
   * 目录选择器：两个入口共用（表单里的「浏览服务器目录」/ 绑定行的「浏览…」），
   * 差异只有数据源与选中语义。
   *
   * 本机这一侧先问一次磁盘"该从哪一层开始"：已填的可能是文件、目录，也可能
   * 早就删了。`fs_dir_for` 在 Rust 那边一次算完，省得前端拿着一条不存在的路径
   * 开一个空选择器。
   */
  const openPicker = (opts: { src: PickSrc; mode: PickMode; currentPath: string; standalone: boolean; take: (v: string) => void }) => {
    const open = (parts: string[], src: PickSrc) => {
      setDialog({ kind: 'pick', standalone: opts.standalone, src, mode: opts.mode, parts, filter: '', take: opts.take })
    }
    /* 两侧都要先问一句"该从哪一层开始"：已填的可能是文件、目录，也可能早删了 */
    const start = opts.src === 'local' ? dirForLocal(opts.currentPath.trim()) : dirForRemote(host, opts.currentPath.trim() || '/')
    const fallback = opts.src === 'local' ? localHome : '/'
    void start.catch(() => fallback).then((dir) => open(dir.split('/').filter(Boolean), opts.src))
  }

  const pickTitle = (d: Extract<Dialog, { kind: 'pick' }>) => {
    if (d.src === 'local') return d.mode === 'file' ? '选择本机文件' : '选择本机目录'
    return d.mode === 'file' ? `选择服务器文件 · ${host}` : `选择服务器目录 · ${host}`
  }

  /** 从表单里进去的选择器，「返回」回到表单；独立模式没有正文要还原，「返回」就等于关窗 */
  const closePicker = useCallback(() => {
    if (!dialog || dialog.kind !== 'pick') return
    setDialog(dialog.standalone ? null : { kind: 'form' })
  }, [dialog])

  /**
   * `take` 是副作用（写表单字段 / 直接绑定），所以只能在事件处理里调用，
   *    绝不能放进 `setDialog(prev => …)` 的更新函数里 —— StrictMode 会跑两遍更新函数，
   *    那样一次选择会把文件绑两次。
   */
  const takeFromPicker = (value: string) => {
    if (!dialog || dialog.kind !== 'pick') return
    dialog.take(value)
    setDialog(dialog.standalone ? null : { kind: 'form' })
  }

  /* ---- 表单校验与提交（每个字段独立判断：一次把问题全指出来，而不是修好一个又冒一个） ---- */

  const submitForm = () => {
    if (!form) return
    const cmds = cmdList(form.cmds)
    const errors: FormState['errors'] = {}
    if (!form.name.trim()) errors.name = '请填写配置名称'
    if (!form.path.trim()) errors.path = '请填写上传路径'
    else if (form.path.trim().charAt(0) !== '/') errors.path = '路径要以 / 开头，例如 /opt/app/releases'
    if (!cmds.length) errors.cmd = '请至少填写一条启动命令'
    else if (cmds.some((x) => !x.op)) errors.cmd = '每条命令都要有操作名称'

    if (Object.keys(errors).length) {
      setForm({ ...form, errors })
      showToast(`${Object.keys(errors).length} 项还没填好`, 'warn')
      return
    }

    const payload = {
      name: form.name.trim(),
      /* 分组标签：左栏就是按它归组的（没有标签的老数据才退回按路径推断） */
      group: form.groupVal,
      path: form.path.trim(),
      /* 存结构化数组，与初始数据同型：存 JSON 文本会让下游到处多一层「可能是字符串」的分支 */
      cmd: cmds,
    }
    const baseId = form.baseId
    if (baseId) {
      setConfigs((prev) => prev.map((c) => (c.id === baseId ? { ...c, ...payload } : c)))
      showToast(`已保存「${payload.name}」· ${groups.find((g) => g.id === form.groupVal)?.name ?? ''}`)
    } else {
      const newId = `c${Date.now()}`
      setConfigs((prev) => [...prev, { id: newId, ...payload }])
      setCurrentId(newId)
      showToast(`已创建「${payload.name}」· ${groups.find((g) => g.id === form.groupVal)?.name ?? ''}`)
    }
    closeDialog()
  }

  const confirmDelete = () => {
    if (!dialog || dialog.kind !== 'delete') return
    const c = configById(dialog.id)
    if (!c) {
      closeDialog()
      return
    }
    const rest = configs.filter((x) => x.id !== c.id)
    setConfigs(rest)
    /* 只有当被删的正是当前这条时才需要另选一条 ——
       从左栏删掉"别的"配置时，用户当前在看的那条不该跟着变 */
    if (c.id === currentId) setCurrentId(rest.length ? rest[0].id : null)
    closeDialog()
    showToast(`已删除「${c.name}」`)
  }

  /* ---- 字段说明气泡的定位（夹在遮罩矩形里，见文件头 ②） ---- */
  const tipPosition = (() => {
    if (!tip) return null
    const box = maskRef.current?.getBoundingClientRect() ?? { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight }
    const modal = maskRef.current?.querySelector<HTMLElement>('.modal')?.getBoundingClientRect() ?? null
    const w = 272
    const h = 64
    if (modal && modal.right + 12 + w <= box.right - 12) {
      /* 首选弹窗右侧外侧：气泡从字段右边弹出会压住正在填的输入框 */
      return { left: modal.right + 12, top: Math.max(box.top + 12, Math.min(tip.rect.top - 6, box.bottom - h - 12)) }
    }
    /* 窄视口退回锚点下方，下方放不下再翻到上方 */
    let top = tip.rect.bottom + 8
    if (top + h > box.bottom - 12) top = Math.max(box.top + 12, tip.rect.top - h - 8)
    return { left: Math.max(box.left + 12, Math.min(tip.rect.left, box.right - w - 12)), top }
  })()

  /* ---- 全局键盘：Escape 与 ⌘/Ctrl + Enter ---- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (form?.addingGroup) return // 新建分组那一格自己有 Escape（它 stopPropagation，这里是兜底）
        if (!dialog) return
        /* 在目录选择器里按 Escape = 退回表单，而不是把整张表单一起关掉 */
        if (dialog.kind === 'pick') closePicker()
        else closeDialog()
        return
      }
      /* ⌘/Ctrl + Enter 直接开始部署 */
      if ((event.metaKey || event.ctrlKey) && event.key === 'Enter' && !runRef.current && !dialog) {
        event.preventDefault()
        startDeploy()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [closeDialog, closePicker, dialog, form, startDeploy])

  /* ================================================================== *
   * 弹窗正文：表单 / 删除确认 / 目录选择器
   * ================================================================== */

  /**
   * 新建分组。先收起输入态、再落分组，并且这一整段刻意不放进 `setForm(cur => …)`
   * 的更新函数里 —— `addGroup` 会 `setGroups`，更新函数里调它会在 StrictMode 下建两组。
   */
  const commitGroup = () => {
    if (!form || !form.addingGroup) return // 收输入态走的也是这个函数，别二次提交
    const name = form.newGroupName
    const base = { ...form, addingGroup: false, newGroupName: '' }
    setForm(base)
    const made = addGroup(name)
    if (!made) return // 空名 = 取消
    /* 撞名时不再补一枚 chip，直接把它选中 —— 两个同名分组会让人以为"没生效" */
    setForm({ ...base, groupVal: made.id, groupAuto: false })
  }

  /** 目录选择器（弹窗正文的第二种视图，不是第五种浮层 —— 见文件头 ⑤） */
  function renderPicker(d: Extract<Dialog, { kind: 'pick' }>) {
    const withFiles = d.mode === 'file'
    const kw = d.filter.toLowerCase()
    const isLocal = d.src === 'local'

    /* 两种数据源收敛成同一种行：本机从磁盘读，服务器从 SSH 读；返回的形状一样 */
    const query = isLocal ? pickLocalDir : pickRemoteDir
    let rows: PickRow[] = []
    let listed = 0
    let notice: ReactNode = null
    if (!isLocal && !host) {
      /* 没有机器可读 —— 这里必须说清楚，不然会一直停在"正在读取" */
      notice = <div className="pick-empty">这个项目还没有登记服务器，先到台账里连一台</div>
    } else if (query.isPending) {
      notice = <div className="pick-empty">{isLocal ? '正在读取本机目录…' : `正在读取 ${host} 上的目录…`}</div>
    } else if (query.error) {
      notice = <div className="pick-empty">{errorText(query.error)}</div>
    } else {
      const all = (query.data?.entries ?? []).filter((e) => withFiles || e.dir) // 选目录的视图里，文件只会分散注意力
      listed = all.length
      rows = all
        .filter((e) => !kw || e.name.toLowerCase().includes(kw))
        /* 目录在前、文件在后：目录是"继续往下走"，文件是"到这儿为止" */
        .sort((a, b) => (a.dir === b.dir ? a.name.localeCompare(b.name) : a.dir ? -1 : 1))
        .map((e) => ({ name: e.name, dir: e.dir, meta: e.dir ? '' : `${fmtSize(e.size)} · ${mtimeText(e.mtime)}` }))
      /* 读不到的项（权限）要点出来：少了几行却不说，用户只会以为文件没了 */
      if (query.data?.note) notice = <div className="pick-empty">{query.data.note}</div>
    }

    const rootLabel = d.src === 'local' ? '本机' : host
    const crumbs = [{ label: rootLabel, parts: [] as string[] }].concat(
      d.parts.map((seg, i) => ({ label: seg, parts: d.parts.slice(0, i + 1) })),
    )
    const emptyText = kw
      ? `这个目录里没有匹配「${kw}」的${withFiles ? '文件' : '子目录'}`
      : withFiles
        ? '这个目录是空的'
        : '这个目录里没有子目录'

    return (
      <>
        <div className="pick-crumbs">
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 ? (
                <span className="pick-sep" aria-hidden="true">
                  ›
                </span>
              ) : null}
              <button
                type="button"
                className={cn('pick-crumb', i === crumbs.length - 1 && 'current')}
                onClick={() => i < crumbs.length - 1 && setDialog({ ...d, parts: c.parts, filter: '' })}
              >
                {c.label}
              </button>
            </span>
          ))}
        </div>

        {/* 当前目录。选目录时这里要给一个明确的落点（点行只能往里走）；
            选文件时没有落点可给 —— 目录不是这次要的答案，这条只负责"现在在哪" */}
        <div className="pick-bar">
          <code>{`/${d.parts.join('/')}`}</code>
          {withFiles ? null : (
            <button type="button" className="pick-use" onClick={() => takeFromPicker(`/${d.parts.join('/')}`)}>
              用这个目录
            </button>
          )}
        </div>

        {/* 条目多时才给筛选框：三级目录里放个搜索框是给不存在的需求配控件 */}
        {listed >= 10 ? (
          <input
            id="pickFilter"
            className="modal-input"
            type="search"
            placeholder="筛选当前目录"
            autoComplete="off"
            value={d.filter}
            onChange={(event) => setDialog({ ...d, filter: event.target.value })}
          />
        ) : null}

        <div className="pick-list" id="pickList" tabIndex={-1}>
          {notice ?? (rows.length === 0 ? <div className="pick-empty">{emptyText}</div> : null)}
          {rows.map((row) => (
            <button
              key={row.name}
              type="button"
              className={cn('pick-row', !row.dir && 'is-file')}
              title={row.dir ? undefined : `/${d.parts.concat(row.name).join('/')}`}
              onClick={() => {
                if (!row.dir) takeFromPicker(`/${d.parts.concat(row.name).join('/')}`)
                /* 点目录就是往里走 —— 选择器里没有"确认"那一步 */
                else setDialog({ ...d, parts: d.parts.concat(row.name), filter: '' })
              }}
            >
              <span className="pick-ico" aria-hidden="true">
                <DpIcon name={row.dir ? 'chev' : 'file'} cls={row.dir ? 'pick-chev' : 'pick-file'} outline={false} />
              </span>
              <span className="pick-name">{row.name}</span>
              <span className="pick-meta">{row.meta}</span>
            </button>
          ))}
        </div>
      </>
    )
  }

  /** 一条命令下面的提示行。只在"本来就说得上话"的时候出现 —— `nginx -t` 这种不该被多说一句。 */
  const cmdNote = (it: CmdItem, i: number): ReactNode => {
    const det = detectAsk(it.run)
    const info = autoInfo(it.run, sessionUser)
    const notable = Boolean(it.ask || det || (info && (info.level !== 'ready' || info.sudoLine || info.why)))
    if (!notable) return null

    let head = ''
    let text = ''
    let extra: ReactNode = null

    if (it.ask) {
      head = '>_'
      /* 标了人工、但当前身份让这条其实不会问密码 —— 说清楚，别让人白等 */
      text =
        info && info.level === 'ready' && info.why
          ? `已标记「需人工输入」，但${info.why} —— 这次不会提示`
          : `执行到这里会暂停，等你在终端里输入${det && det.prompt ? `（会提示 ${det.prompt}）` : ''}`
    } else if (info && (info.level === 'rewritable' || info.level === 'needsCommand')) {
      /* ⚠ = 一定会停下来要密码，ℹ = 可能（取决于免密配置）—— 这个区别由 detectAsk 判定 */
      head = det && det.sure ? '⚠' : 'ℹ'
      text = info.why
      /* 只给建议、不代改：把针对这条命令的具体写法摆出来，用户能直接照抄 */
      if (info.to) extra = <code title={info.to}>{info.to}</code>
    } else if (info && info.level === 'external') {
      head = 'ℹ'
      text = info.why
    } else if (info && info.level === 'ready') {
      head = '✓'
      text = info.why || '已是非交互写法'
      if (info.sudoLine) {
        const line = info.sudoLine
        const key = `sudo-${i}`
        text = '已是非交互写法 · 服务器上要有这一行授权：'
        extra = (
          <>
            <code title={line}>{line}</code>
            <button
              type="button"
              className="act"
              aria-label="复制这一行授权"
              onClick={(event) => {
                event.preventDefault()
                copyText(line, key, '已复制授权行')
              }}
            >
              {copiedKey === key ? '✓ 已复制' : '复制'}
            </button>
          </>
        )
      }
    } else if (det) {
      head = det.sure ? '⚠' : 'ℹ'
      text = det.why
    }

    return (
      <div className={cn('cmd-note', it.ask ? 'on' : info?.level === 'ready' ? 'done' : null)}>
        <span className="ic" aria-hidden="true">
          {head}
        </span>
        <span className="note-t">{text}</span>
        {extra}
      </div>
    )
  }

  const patchCmd = (i: number, patch: Partial<CmdItem>) => {
    setForm((cur) =>
      cur
        ? { ...cur, cmds: cur.cmds.map((c, k) => (k === i ? { ...c, ...patch } : c)), errors: { ...cur.errors, cmd: undefined } }
        : cur,
    )
  }

  const formView = form ? (
    <div className="form-body">
      {/* ---------------- ① 名称与分组 ---------------- */}
      <div className="form-group">
        <div className="form-group-head">
          <span className="form-group-no">1</span>
          <label className="form-group-title" htmlFor="cfgName">
            名称与分组
          </label>
          <span className="field-req">必填</span>
          <FieldHelp text="显示在左侧配置列表里，建议写清用途。" onShow={(rect, text) => setTip({ rect, text })} onHide={() => setTip(null)} />
        </div>
        <div className={cn('modal-field', form.errors.name && 'has-error')}>
          <input
            id="cfgName"
            ref={nameRef}
            className={cn('modal-input plain', form.errors.name && 'is-invalid')}
            type="text"
            autoComplete="off"
            maxLength={20}
            placeholder="例如：应用包 · 全量启动"
            aria-invalid={form.errors.name ? true : undefined}
            aria-describedby={form.errors.name ? 'cfgName-err' : undefined}
            value={form.name}
            onChange={(event) => setForm({ ...form, name: event.target.value, errors: { ...form.errors, name: undefined } })}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
                event.preventDefault()
                submitForm()
              }
            }}
          />
          {form.errors.name ? (
            <div className="field-err" id="cfgName-err">
              {form.errors.name}
            </div>
          ) : null}
        </div>

        <div className="form-sub">
          <span className="form-sub-k">分组</span>
          <div className="group-pick" role="radiogroup" aria-label="分组标签">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                role="radio"
                aria-checked={form.groupVal === g.id}
                className={cn('group-chip', form.groupVal === g.id && 'on')}
                onClick={() => setForm({ ...form, groupVal: g.id, groupAuto: false })}
              >
                {g.name}
              </button>
            ))}
            {form.addingGroup ? (
              <input
                className="group-add-input"
                type="text"
                maxLength={8}
                placeholder="新分组名"
                aria-label="新分组名称"
                autoFocus
                value={form.newGroupName}
                onChange={(event) => setForm({ ...form, newGroupName: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    commitGroup()
                  } else if (event.key === 'Escape') {
                    /* Esc 只该收起这一格 —— 不挡住冒泡的话，文档级那个监听顺手把整张表单关了 */
                    event.preventDefault()
                    event.stopPropagation()
                    setForm({ ...form, addingGroup: false, newGroupName: '' })
                  }
                }}
                onBlur={commitGroup}
              />
            ) : (
              <button
                type="button"
                className="group-add"
                title="新建分组"
                aria-label="新建分组"
                onClick={() => setForm({ ...form, addingGroup: true, newGroupName: '' })}
              >
                <DpIcon name="plus" strokeWidth={1.6} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ---------------- ② 服务器路径 ---------------- */}
      <div className="form-group">
        <div className="form-group-head">
          <span className="form-group-no">2</span>
          <label className="form-group-title" htmlFor="cfgPath">
            服务器路径
          </label>
          <span className="field-req">必填</span>
          <FieldHelp
            text="上传的文件会放到这个目录；目录不存在会自动创建，同名文件将被覆盖。"
            onShow={(rect, text) => setTip({ rect, text })}
            onHide={() => setTip(null)}
          />
          {/* 字段级动作挂标题行里，不占输入框宽度 */}
          <button
            type="button"
            className="field-act"
            onClick={() =>
              openPicker({
                src: 'host',
                mode: 'dir',
                currentPath: form.path,
                standalone: false,
                take: (picked) => setForm((cur) => (cur ? { ...cur, path: picked, errors: { ...cur.errors, path: undefined } } : cur)),
              })
            }
          >
            浏览服务器目录
          </button>
        </div>
        <div className={cn('modal-field', form.errors.path && 'has-error')}>
          <input
            id="cfgPath"
            className={cn('modal-input', form.errors.path && 'is-invalid')}
            type="text"
            autoComplete="off"
            maxLength={80}
            placeholder="/opt/app/releases"
            aria-invalid={form.errors.path ? true : undefined}
            aria-describedby={form.errors.path ? 'cfgPath-err' : undefined}
            value={form.path}
            onChange={(event) => {
              const v = event.target.value
              setForm((cur) => {
                if (!cur) return cur
                /* 路径 → 分组的预选：只在"还没手动选过"时发生 */
                const groupVal = cur.groupAuto ? groupFromPath(v.trim()) : cur.groupVal
                return { ...cur, path: v, groupVal, errors: { ...cur.errors, path: undefined } }
              })
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
                event.preventDefault()
                submitForm()
              }
            }}
          />
          {form.errors.path ? (
            <div className="field-err" id="cfgPath-err">
              {form.errors.path}
            </div>
          ) : null}
        </div>
        <div className="chips-row">
          <span className="chips-label">常用路径</span>
          {PATH_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className="modal-chip"
              title={p}
              onClick={() => setForm((cur) => (cur ? { ...cur, path: p, errors: { ...cur.errors, path: undefined } } : cur))}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* ---------------- ③ 启动命令 ---------------- */}
      <div className="form-group">
        <div className="form-group-head">
          <span className="form-group-no">3</span>
          <label className="form-group-title">启动命令</label>
          <span className="field-req">必填</span>
          <FieldHelp
            text="传完之后按顺序执行。su / sudo / ssh 这类会停下来要密码的命令，提示里会给出建议的非交互写法（sudo -n：没授权会立刻失败，不会挂着）；确实要人输入的（自研交互脚本）点行尾的 >_ 标记。"
            onShow={(rect, text) => setTip({ rect, text })}
            onHide={() => setTip(null)}
          />
          {/* 值载体：`.cmds` 就是唯一的真相源，计数与提交都读它 —— 不再走一层隐藏 input */}
          <span className="field-count">{cmdList(form.cmds).length ? `${cmdList(form.cmds).length} 条` : ''}</span>
        </div>

        <div className="cmd-edit">
          <div className="cmd-rows">
            {/* 列名常驻在滚动区里（sticky）：命令多到要滚时两列各填什么仍一眼可见 */}
            <div className="cmd-head">
              <span className="cmd-head-op">操作名称</span>
              <span className="cmd-head-cmd">
                <span>命令</span>
                <i>· 从上到下依次执行</i>
              </span>
            </div>
            {form.cmds.map((it, i) => (
              <div className="cmd-row" key={i}>
                <input
                  className="modal-input cmd-op"
                  type="text"
                  autoComplete="off"
                  maxLength={16}
                  placeholder="重启服务"
                  aria-label={`第 ${i + 1} 条的操作名称`}
                  value={it.op}
                  onChange={(event) => patchCmd(i, { op: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
                      event.preventDefault()
                      submitForm()
                    }
                  }}
                />
                <input
                  className="modal-input cmd-run"
                  type="text"
                  autoComplete="off"
                  spellCheck={false}
                  maxLength={200}
                  placeholder="systemctl restart pay-api"
                  title={it.run}
                  aria-label={`第 ${i + 1} 条的命令`}
                  value={it.run}
                  onChange={(event) => patchCmd(i, { run: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.metaKey && !event.ctrlKey) {
                      event.preventDefault()
                      submitForm()
                    }
                  }}
                />
                {/* >_ 开关常驻（不依赖识别）—— 识别不出来的自研脚本也得能标 */}
                <button
                  type="button"
                  className={cn('cmd-ask', it.ask && 'on')}
                  aria-pressed={Boolean(it.ask)}
                  title={
                    it.ask
                      ? needsHuman(it, sessionUser)
                        ? '已标记：执行到这里会暂停等你输入'
                        : '已标记，但当前连接身份下这条不会问密码'
                      : '标记为「需人工输入」'
                  }
                  aria-label={`第 ${i + 1} 条，${it.ask ? '已标记需人工输入' : '标记为需人工输入'}`}
                  onClick={() => patchCmd(i, { ask: !it.ask })}
                >
                  <span aria-hidden="true">&gt;_</span>
                </button>                <button
                  type="button"
                  className="cmd-del"
                  disabled={form.cmds.length < 2}
                  title={form.cmds.length < 2 ? '至少保留一条' : '删除这一条'}
                  aria-label={`删除第 ${i + 1} 条`}
                  onClick={() =>
                    setForm((cur) => (cur ? { ...cur, cmds: cur.cmds.filter((_, k) => k !== i), errors: { ...cur.errors, cmd: undefined } } : cur))
                  }
                >
                  ✕
                </button>
                {cmdNote(it, i)}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="cmd-add"
            onClick={() => setForm((cur) => (cur ? { ...cur, cmds: [...cur.cmds, { op: '', run: '', ask: false }] } : cur))}
          >
            ＋ 添加一条
          </button>
        </div>

        {form.errors.cmd ? (
          <div className="field-err" id="cfgCmd-err">
            {form.errors.cmd}
          </div>
        ) : null}

        <div className="chips-row">
          <span className="chips-label">常用模板</span>
          {CMD_PRESETS.map((preset, i) => (
            <button
              key={i}
              type="button"
              className="modal-chip"
              title={JSON.stringify(preset)}
              /* 点一下整段替换 —— 只改值不重建列表，列表上还是旧内容 */
              onClick={() => setForm((cur) => (cur ? { ...cur, cmds: preset.map((x) => ({ ...x })), errors: { ...cur.errors, cmd: undefined } } : cur))}
            >
              {preset.map((x) => x.op || x.run).join(' ; ')}
            </button>
          ))}
        </div>
      </div>
    </div>
  ) : null

  const pickView = dialog && dialog.kind === 'pick' ? renderPicker(dialog) : null

  const deleteTarget = dialog && dialog.kind === 'delete' ? configById(dialog.id) : null
  const deleteView = deleteTarget ? (
    <>
      <p>{`将删除「${deleteTarget.name}」（上传到 ${deleteTarget.path}）。`}</p>
      <div className="modal-warn info" role="note">
        <strong>说明：</strong>
        <span>只移除这条配置，不会影响服务器上已经部署的内容。</span>
      </div>
    </>
  ) : null

  /* 表单打开时落在名称上；编辑态预填内容直接全选，省一次三击 */
  useEffect(() => {
    if (dialog?.kind !== 'form') return
    const node = nameRef.current
    if (!node) return
    node.focus()
    if (form?.baseId) node.select()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialog?.kind])

  /* ================================================================== *
   * 渲染
   * ================================================================== */

  const modalTitle =
    dialog?.kind === 'form'
      ? form?.baseId
        ? '编辑部署配置'
        : '新增部署配置'
      : dialog?.kind === 'delete'
        ? '删除部署配置'
        : dialog?.kind === 'pick'
          ? pickTitle(dialog)
          : ''

  const modalCls = cn(
    'modal',
    dialog?.kind === 'pick'
      ? dialog.standalone
        ? 'modal-picker'
        : 'modal-form'
      : dialog?.kind === 'form'
        ? 'modal-form'
        : null,
  )

  const overlay = (
    <>
      {/* 执行到「需输入」的命令时挡在最前面。它不是配置表单的一部分 ——
          这一格里的内容只活到这次执行，不写库、不进日志。 */}
      {askInput ? (
        <div
          className="modal-mask open"
          onClick={(event) => {
            if (event.target === event.currentTarget) answerAsk(null)
          }}
        >
          <div className="modal modal-form" role="dialog" aria-modal="true" aria-labelledby="dpAskTitle">
            <div className="modal-head">
              <div className="modal-title" id="dpAskTitle">
                {`命令在等输入 · ${askInput.op}`}
              </div>
              <button type="button" className="modal-close" aria-label="取消" onClick={() => answerAsk(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <div className="dp-ask-cmd">{askInput.run}</div>
              <div className="modal-field">
                <input
                  className="modal-input"
                  type="password"
                  autoComplete="off"
                  autoFocus
                  aria-label="喂给这条命令的内容"
                  placeholder="多数时候是密码 · 只用于这一次，不存库也不进日志"
                  value={askDraft}
                  onChange={(event) => setAskDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && askDraft.trim()) {
                      event.preventDefault()
                      answerAsk(askDraft)
                    }
                  }}
                />
              </div>
              <div className="dp-ask-note">
                这条命令会拿到一个远端伪终端，所以它的 stderr 会并进 stdout；回显的输入已抹成 ***。
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => answerAsk(null)}>
                跳过这条
              </button>
              <button
                type="button"
                className="btn btn-primary"
                disabled={!askDraft.trim()}
                onClick={() => answerAsk(askDraft)}
              >
                继续
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {dialog ? (
        <div
          className="modal-mask open"
          ref={maskRef}
          /* 点遮罩关闭：原型的遮罩没有这个处理（只有 Esc / 取消 / ✕）。这里补上是因为
             同一应用的日志页就是这么做的 —— 一个点外面关不掉的弹窗是真麻烦。
             判据是 `target === currentTarget`，所以点正文里任何地方都不会误关。 */
          onClick={(event) => {
            if (event.target === event.currentTarget) closeDialog()
          }}
        >
          <div className={modalCls} role="dialog" aria-modal="true" aria-labelledby="dpModalTitle">
            <div className="modal-head">
              <div className="modal-title" id="dpModalTitle">
                {modalTitle}
              </div>
              <button type="button" className="modal-close" aria-label="关闭" onClick={closeDialog}>
                ✕
              </button>
            </div>
            <div className="modal-body" onScroll={() => setTip(null)}>
              {dialog.kind === 'form' ? formView : dialog.kind === 'pick' ? pickView : deleteView}
            </div>
            <div className="modal-actions">
              {dialog.kind === 'pick' ? (
                dialog.standalone ? (
                  <button type="button" className="btn btn-ghost" onClick={closeDialog}>
                    取消
                  </button>
                ) : (
                  /* 选择器里没有"确认"这一步 —— 底部只留「返回」 */
                  <button type="button" className="btn btn-ghost" onClick={closePicker}>
                    返回
                  </button>
                )
              ) : (
                <>
                  <button type="button" className="btn btn-ghost" onClick={closeDialog}>
                    取消
                  </button>
                  <button
                    type="button"
                    className={cn('btn', dialog.kind === 'delete' ? 'btn-danger' : 'btn-primary')}
                    onClick={dialog.kind === 'delete' ? confirmDelete : submitForm}
                  >
                    {dialog.kind === 'delete' ? '删除' : form?.baseId ? '保存' : '创建配置'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {tip && tipPosition ? (
        <div className="tip-layer" role="tooltip" style={{ left: tipPosition.left, top: tipPosition.top }}>
          {tip.text}
        </div>
      ) : null}

      {/* 提示条：位置固定在窗口底部（原型同款）。它必须是窗框的后代 —— 否则会浮到窗口之外 */}
      <div className={cn('toast', toastState && 'show')} data-type={toastState?.type ?? 'ok'} role="status" aria-live="polite">
        {toastState ? (
          <>
            <span className="toast-ico" aria-hidden="true">
              {TOAST_ICON[toastState.type] || TOAST_ICON.ok}
            </span>
            <span>{toastState.msg}</span>
          </>
        ) : null}
      </div>
    </>
  )

  if (isLoading || (!data && !isError)) {
    return (
      <div className="mw-root dp-root" data-module="work">
        <MacWindow title="部署" onClose={goBack} icon="📦">
          <div className="viewer">
            <main className="viewer-main">
              <div className="dp-scope">
                <aside className="dp-side">
                  <div className="dp-empty">
                    <div className="ico">📦</div>
                    <div className="t">正在读取项目…</div>
                  </div>
                </aside>
              </div>
            </main>
          </div>
        </MacWindow>
      </div>
    )
  }

  const projectName = data?.project.name ?? '项目'

  return (
    <div className="mw-root dp-root" data-module="work">
      <MacWindow
        title={`${projectName} · 部署`}
        subtitle={host}
        icon="📦"
        onClose={goBack}
        overlay={overlay}
      >
        <div className="viewer">
          <header className="viewer-bar">
            {/* ① 身份：项目名 + 本页分区名（分区名做成标签，不再拼进标题占宽度） */}
            <div className="viewer-id">
              <span className="viewer-ico" aria-hidden="true">
                <DpIcon name="box" />
              </span>
              <span className="viewer-name" title={`${projectName} · 部署`}>
                {projectName}
              </span>
              <span className="viewer-scope">部署</span>
            </div>

            {/* ② 上下文：这次往哪部署（环境 / 目标主机 / 配置数） */}
            <div className="meta-bar">
              <span className="meta-item meta-env">
                <span className="dot" />
                <span>{envOf}</span>
              </span>
              <span className="meta-item">
                <span>目标主机</span>
                <b>{host}</b>
              </span>
              <span className="meta-item meta-weak">
                <span>{configs.length} 个配置</span>
              </span>
            </div>

            {/* ③ 状态与操作：现在怎么样 → 能做什么 */}
            <div className="viewer-actions">
              <span className="state-pill">
                <span className="dot" />
                <span className="ver">{version}</span>
                <span>运行中</span>
              </span>
              <span className="last-sync">{lastSync}</span>
              <button type="button" className="log-tool" title="刷新部署配置" onClick={refresh}>
                <DpIcon name="refresh" />
                刷新
              </button>
              {/* 外观照原型（`.theme-toggle` + 月亮/太阳），实现用应用的主题 store —— 见文件头 ③ */}
              <button
                type="button"
                className="theme-toggle"
                aria-label={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
                aria-pressed={theme === 'dark'}
                title={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}
                onClick={toggleTheme}
              >
                <DpIcon name={theme === 'light' ? 'moon' : 'sun'} />
              </button>
              <button
                type="button"
                className="icon-btn danger"
                title="关闭这个部署窗口"
                aria-label="关闭这个部署窗口"
                onClick={goBack}
              >
                <DpIcon name="close" />
              </button>
            </div>
          </header>

          <main className="viewer-main">
            <div className="dp-scope">
              {/* ========== 左栏：部署配置 ========== */}
              <aside className="dp-side">
                <div className="dp-side-head">
                  <span>部署配置</span>
                  <button type="button" className="dp-side-add" title="新增部署配置" aria-label="新增部署配置" onClick={() => openForm(null)}>
                    ＋
                  </button>
                </div>

                <div className="dp-cfg-list" role="tablist" aria-label="部署配置列表">
                  {configs.length === 0 ? (
                    <div className="dp-empty">
                      <div className="ico">📦</div>
                      <div className="t">还没有部署配置</div>
                      <div className="d">点下方「新增部署配置」填上传路径和启动命令</div>
                    </div>
                  ) : (
                    grouped.map((g) => (
                      /* role=presentation：让 tab 透传上浮，tablist 的直接子元素就不会是组容器 */
                      <div className="dp-group" key={g.id} role="presentation">
                        <button
                          type="button"
                          className="dp-group-head"
                          aria-expanded={!foldedGroups[g.id]}
                          aria-controls={`dpg-${g.id}`}
                          onClick={() => setFoldedGroups((prev) => ({ ...prev, [g.id]: !prev[g.id] }))}
                        >
                          <span className="dp-group-mark" aria-hidden="true" />
                          <span className="dp-group-name">{g.name}</span>
                          <span className="dp-group-n">{g.items.length} 条</span>
                          <span className="dp-group-chev" aria-hidden="true">
                            ⌄
                          </span>
                        </button>
                        <div className="dp-group-items" id={`dpg-${g.id}`} role="presentation">
                          {g.items.map((c) => (
                            <div className="dp-item" key={c.id}>
                              <button
                                type="button"
                                role="tab"
                                aria-selected={c.id === currentId}
                                /* 分组后每项窄了一截，名称和路径都可能被截断 —— 用 title 兜底给全文 */
                                title={`${c.name}\n${c.path}`}
                                className={cn('dp-cfg', c.id === currentId && 'active')}
                                onClick={() => selectConfig(c.id)}
                              >
                                <span className="dp-cfg-name">{c.name}</span>
                                <span className="dp-cfg-cmd">{c.path}</span>
                              </button>
                              <div className="dp-cfg-actions">
                                <button
                                  type="button"
                                  className="dp-cfg-act"
                                  title={`编辑「${c.name}」`}
                                  aria-label={`编辑「${c.name}」`}
                                  onClick={() => askEditConfig(c.id)}
                                >
                                  ✎
                                </button>
                                <button
                                  type="button"
                                  className="dp-cfg-act danger"
                                  title={`删除「${c.name}」`}
                                  aria-label={`删除「${c.name}」`}
                                  onClick={() => askDeleteConfig(c.id)}
                                >
                                  ✕
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <button type="button" className="dp-side-foot" onClick={() => openForm(null)}>
                  ＋ 新增部署配置
                </button>
              </aside>

              {/* ========== 右栏：当前配置 → 上传 → 执行 → 输出 ========== */}
              <section className="dp-main">
                <div className="dp-head">
                  <div className="dp-head-top">
                    <div className="dp-title">{cfg ? cfg.name : '—'}</div>
                  </div>

                  <div className="dp-spec">
                    <div className="dp-spec-item">
                      <span className="dp-spec-k">上传到</span>
                      {/* 值一律单行省略（行高不随内容跳），所以两个字段都要给 title 兜底 */}
                      <span className="dp-spec-v" title={cfg?.path ?? ''}>
                        {cfg?.path ?? '—'}
                      </span>
                    </div>
                    <div className="dp-spec-item">
                      <span className="dp-spec-k">启动命令</span>
                      <span className="dp-spec-line">
                        <span
                          className="dp-spec-v"
                          title={specCmdArr
                            .map((x) => `${x.op ? `[${x.op}] ` : ''}${x.run}${needsHuman(x, sessionUser) ? '（需要终端输入，会失败）' : ''}`)
                            .join('\n')}
                        >
                          {specCmdArr.length ? specCmdArr[0].run : '—'}
                        </span>
                        {/* 摘要先回答「这条配置要不要人盯着」：全自动 → 绿标；有要输入的 → 琥珀；
                            能改但还没改 → 靛蓝提示。不用 `hidden`，见文件头 ① */}
                        {specMoreShown ? (
                          <span className={cn('dp-spec-more', specClass)} title={`${specTitle}（当前连接身份 ${sessionUser}）`}>
                            {specMoreText}
                          </span>
                        ) : null}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 上传文件：两种来源二选一（一次部署只会用一种） */}
                <div className="dp-upload">
                  <div className="dp-label">
                    <span>要上传的文件</span>
                    <span className="aside">
                      {files.length
                        ? `${files.length} 个文件 · 共 ${fmtSize(totalBytes)}${missing.length ? ` · ${missing.length} 个未找到` : ''}`
                        : ''}
                    </span>
                  </div>

                  <div className="src-pick" role="radiogroup" aria-label="文件来源">
                    {(['pick', 'local'] as FileSrc[]).map((src) => (
                      <button
                        key={src}
                        type="button"
                        role="radio"
                        aria-checked={fileSrc === src}
                        className={cn('src-opt', fileSrc === src && 'on')}
                        onClick={() => switchFileSrc(src)}
                      >
                        <span className="dot" aria-hidden="true" />
                        <span className="src-opt-t">{src === 'pick' ? '从本机选择' : '绑定本地文件'}</span>
                        {/* 切走的那一边还有几条：写在标签上，别让它变成看不见的状态 */}
                        {staged[src].length ? <span className="n">{staged[src].length}</span> : null}
                      </button>
                    ))}
                  </div>

                  {/* ① 从本机选择 */}
                  {fileSrc === 'pick' ? (
                    <div className="src-panel">
                      {/* 拖拽由 Tauri 的窗口事件接管（WebView 会拦掉 HTML5 的 drop），
                          所以这里只有点击与键盘 —— 见 `onDragDropEvent` 那个 effect */}
                      <div
                        ref={dzRef}
                        className={cn('dropzone', dragOver && 'over')}
                        role="button"
                        tabIndex={0}
                        aria-label="选择或拖入要部署的文件"
                        onClick={pickFiles}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            pickFiles()
                          }
                        }}
                      >
                        <span className="dz-ico" aria-hidden="true">
                          <DpIcon name="upload" />
                        </span>
                        <span className="dz-t">拖文件到这里，或点击选择</span>
                        <span className="dz-d">jar / zip / tar.gz / sql / 静态资源</span>
                      </div>
                    </div>
                  ) : (
                    /* ② 绑定本地文件：填本机路径，自动查有没有，有就直接用 */
                    <div className="src-panel">
                      <div className="bind-row">
                        <input
                          className={cn('bind-input', bindInvalid && 'bad')}
                          type="text"
                          spellCheck={false}
                          autoComplete="off"
                          aria-label="本机文件的绝对路径"
                          placeholder={`${localHome}/Downloads/app.jar`}
                          value={bindPath}
                          onChange={(event) => onBindTyping(event.target.value)}
                          onBlur={onBindBlur}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              submitBind(bindPath)
                            }
                          }}
                        />
                        {/* 同一个选择器，换成从本机树里挑文件。挑完直接绑定 ——
                            文件的选中语义就是"用它"，再让人点一次「绑定」等于把一步拆成两步 */}
                        <button
                          type="button"
                          className="bind-browse"
                          title="在本机目录里挑一个文件"
                          onClick={() =>
                            openPicker({
                              src: 'local',
                              mode: 'file',
                              currentPath: bindPath.trim(),
                              standalone: true,
                              take: (picked) => submitBind(picked),
                            })
                          }
                        >
                          浏览…
                        </button>
                        <button type="button" className="bind-go" onClick={() => submitBind(bindPath)}>
                          绑定
                        </button>
                      </div>
                      {/* 结果行：只在"有话要说"时写字，平时留一条同高的空行（打字时整块不跳） */}
                      <div className={cn('bind-state', bindState.kind)} role="status">
                        {bindBusy ? (
                          <span>正在查本机…</span>
                        ) : bindState.text ? (
                          <>
                            <span>{bindState.text}</span>
                            {bindState.detail ? (
                              <>
                                <span className="sep">·</span>
                                <span className="k" title={bindState.detail}>
                                  {bindState.detail}
                                </span>
                              </>
                            ) : null}
                          </>
                        ) : null}
                      </div>
                      {/* 最近绑定成功的路径。这里曾经是一组写死的"常用项"—— 那几条
                          路径在本机根本不存在，点一下只会得到"未找到"。现在只列真的
                          绑定成功过的，一条都没有就整行不渲染。 */}
                      {recentBinds.length ? (
                        <div className="bind-presets">
                          {recentBinds.map((p) => (
                            <button
                              key={p}
                              type="button"
                              className="bind-chip"
                              title={p}
                              onClick={() => {
                                setBindPath(p)
                                submitBind(p)
                              }}
                            >
                              {baseName(p)}
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}

                  {files.length ? (
                    <div className="file-list">
                      {files.map((f) => (
                        <div
                          key={f.name}
                          className={cn('file-item', f.found === false && 'missing')}
                          /* 绑定文件把完整路径挂在行上（清单里只看得到文件名） */
                          title={f.src === 'local' ? `${f.path}${f.time ? ` · ${f.time}` : ''}` : undefined}
                        >
                          <span className="file-ico">{extOf(f.name)}</span>
                          <span className="file-name">{f.name}</span>
                          <span className={cn('file-size', f.found === false && 'bad')}>
                            {f.found === false ? '未找到' : fmtSize(f.size)}
                          </span>
                          <button
                            type="button"
                            className="file-del"
                            title={f.src === 'local' ? `解绑 ${f.path}` : `移除 ${f.name}`}
                            aria-label={f.src === 'local' ? `解绑 ${f.path}` : `移除 ${f.name}`}
                            onClick={() => removeFile(f.name)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </div>

                {/* 执行。状态行只在有事要说时出现（好状态不必配一句注解） */}
                <div className="dp-run">
                  <button type="button" className="btn-run" onClick={startDeploy} disabled={running}>
                    <span className="ic" aria-hidden="true">
                      <DpIcon name={running ? 'busy' : 'run'} outline={!running} strokeWidth={1.7} />
                    </span>
                    <span>{runLabel}</span>
                  </button>
                  {running ? (
                    <button type="button" className="btn-abort" onClick={abortDeploy}>
                      <span className="ic" aria-hidden="true">
                        <DpIcon name="stop" outline={false} />
                      </span>
                      中止
                    </button>
                  ) : null}
                  {hint ? (
                    <span className={cn('run-hint', hint.warn && 'warn')}>
                      {/* 忙的时候带一个转圈：按钮之外也有"在动"的落点 */}
                      {hint.busy ? <span className="spin" aria-hidden="true" /> : null}
                      <span>{hint.text}</span>
                    </span>
                  ) : null}
                </div>

                {/* 执行输出 */}
                <div className="dp-output">
                  <aside className={cn('dp-tasks', taskFolded && 'folded')}>
                    <div className="dp-tasks-head">
                      <span className="dp-tasks-title">执行任务</span>
                      <span className="dp-tasks-stats">
                        <span className="task-count">{taskCountText}</span>
                        {/* 不用 `hidden`（见文件头 ①） */}
                        {taskTotal ? <span className="task-count done">{taskTotal}</span> : null}
                        <button
                          type="button"
                          className={cn('task-fold-btn', taskFolded && 'active')}
                          title={taskFolded ? '展开已完成的步骤' : '折叠已完成的步骤'}
                          aria-pressed={taskFolded}
                          onClick={toggleFold}
                        >
                          ⌄
                        </button>
                      </span>
                    </div>
                    <div className="dp-tasks-progress" aria-hidden="true">
                      <span style={{ width: `${steps.length ? (finishedCount / steps.length) * 100 : 0}%` }} />
                    </div>

                    <div
                      className="steps"
                      role="listbox"
                      aria-label="部署步骤"
                      ref={stepListRef}
                      onScroll={recomputeJump}
                    >
                      {steps.map((st, i) => {
                        const s = stepState[i]
                        const status = s?.status ?? 'idle'
                        /* 进行中时按实时耗时显示（`clock` 每 100ms 推一次），其余读冻结值 */
                        const time = liveTime(i) ?? s?.time ?? '待执行'
                        return (
                          <div
                            key={`${st.key}-${i}`}
                            data-i={i}
                            role="option"
                            tabIndex={0}
                            aria-selected={focusIdx === i}
                            aria-label={`步骤 ${i + 1}：${st.name}`}
                            className={cn('step', STEP_CLASS[status], Boolean(s?.retry) && status !== 'idle' && 'step-retry', focusIdx === i && 'focused')}
                            onClick={() => focusStep(i)}
                            onKeyDown={(event) => onStepKeyDown(event, i)}
                          >
                            {/* 数字单独一层：圆点带 2px 边框，合在一起量会把边框采成文字底衬 */}
                            <span className="step-dot">
                              <span className="step-dot-n">{s?.badge ?? String(i + 1)}</span>
                            </span>
                            <StepName text={st.name} />
                            <span className="step-time">
                              {time}
                            </span>
                            <button
                              type="button"
                              className="step-retry-btn"
                              title="从这个步骤重试"
                              aria-label={`重试 ${st.name}`}
                              onClick={(event) => {
                                event.stopPropagation()
                                retryStep(i)
                              }}
                            >
                              ↻
                            </button>
                            {st.line ? <div className="step-line">{st.line}</div> : null}
                            {st.bar ? (
                              <span className="step-bar">
                                <span style={{ width: `${s?.barPct ?? 0}%` }} />
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>

                    {showJump ? (
                      <button type="button" className="jump-btn" onClick={jumpToCurrent}>
                        ↓ 当前步
                      </button>
                    ) : null}
                  </aside>

                  <section className="dp-exec">
                    <div className="dp-exec-head">
                      <div className="dp-exec-left">
                        <span className="dp-exec-title">执行输出</span>
                        <span className={cn('exec-meta', metaJump ? 'jump' : runMeta.kind)}>
                          <span className="exec-dot" />
                          <span className="exec-text">{metaJump ? `→ ${metaJump}` : runMeta.text}</span>
                        </span>
                      </div>
                      <div className="dp-exec-right">
                        <span className="exec-host">{`本机 → ${host}`}</span>
                        <label
                          className="exec-user-wrap"
                          title="这次连接用的是哪个身份。root 身份下 su / sudo 都不会要密码，同一条配置就不会停下来问人"
                        >
                          <span className="exec-user-k">身份</span>
                          <select
                            className="exec-user"
                            aria-label="连接身份"
                            value={sessionUser}
                            onChange={(event) => changeSessionUser(event.target.value)}
                          >
                            {/* URL 可能带来预设之外的身份，要能显示出来 */}
                            {userOptions.map((u) => (
                              <option key={u} value={u}>
                                {u}
                              </option>
                            ))}
                          </select>
                        </label>
                        <button
                          type="button"
                          className={cn('exec-btn', followTail ? 'on' : 'alert')}
                          title="新日志自动滚到底部"
                          onClick={() => setFollowTail((v) => !v)}
                        >
                          {followTail ? '↓ 跟随' : '↓ 回到底部'}
                        </button>
                        <button type="button" className="exec-btn" title="复制全部日志" onClick={copyConsole}>
                          {copiedKey === 'console' ? '✓ 已复制' : '⧉ 复制'}
                        </button>
                      </div>
                    </div>

                    <div className="console" ref={consoleRef} onScroll={onConsoleScroll}>
                      {lines.map((l) => (
                        <div
                          key={l.id}
                          data-step={l.stepKey ?? ''}
                          className={cn(
                            'console-line',
                            l.header && 'step-header',
                            l.kind,
                            flashKey && l.stepKey === flashKey && 'flash',
                          )}
                        >
                          <span className="console-t">{l.t}</span>
                          <span className={cn('console-x', l.empty && 'console-empty')}>{l.text}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>
              </section>
            </div>
          </main>
        </div>
      </MacWindow>
    </div>
  )
}

/**
 * 步骤名：长到被截断时才挂 `.truncated`（它用 `::after` 把 `data-full` 放出来）。
 * 无条件挂会让没截断的行也冒出一个重复的浮层。
 */
function StepName({ text }: { text: string }) {
  const ref = useRef<HTMLSpanElement | null>(null)
  const [truncated, setTruncated] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    setTruncated(node.scrollWidth > node.clientWidth + 1)
  }, [text])
  return (
    <span ref={ref} className={cn('step-name', truncated && 'truncated')} data-full={truncated ? text : undefined}>
      {text}
    </span>
  )
}
