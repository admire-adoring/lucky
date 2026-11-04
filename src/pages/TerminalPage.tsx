import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import { useSearchParams, useParams, useLocation, useNavigate, Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useDocumentTitle } from '../hooks/use-document-title'
import { useProjectDetail } from '../hooks/use-projects'
import { useServer } from '../hooks/use-servers'
import { useTermHistory } from '../hooks/use-terminal'
import { WindowControls } from '../components/layout/WindowControls'
import { DRAG_REGION } from '../lib/desktop-window'
import { cn } from '../lib/cn'
import { ApiError, errorText } from '../api/error'
import { setServerSecret, serverKeys } from '../api/servers'
import {
  closeTerminal,
  openTerminal,
  readTerminalStats,
  runTerminalCommand,
  tailTerminalLog,
  termKeys,
  type TermOpen,
  type TermStats,
  type TermTail,
} from '../api/terminal'

/* ============================================================================
   终端 —— 真连 SSH 的那一版
   ----------------------------------------------------------------------------
   原型 `design/prototypes/work/终端.html` 是一张"终端长什么样"的静态图：
   进程表写死 8 条、CPU 与内存是 `Math.random()` 抖出来的、日志是六条模板轮播、
   敲什么命令都从一张 `FALLBACK_CMDS` 表回话、"连接"只是等 1.5 秒然后宣布
   「后端未启动 → 使用内置模拟回显」。
   现在这几处全部换成真的：

   · 连接：`term_open` 用台账里的账户与凭据发一次真 SSH（ControlMaster 复用），
     密码走 askpass、私钥走 `-i`，与「检查连接」「测试连接」同一套实现。
   · 命令：`term_exec` 把命令嵌进脚本从 stdin 送给远端 `sh`，输出用长度前缀成帧
     （stdout / stderr / 退出码 / 结束时所在目录分开回），`cd` 会留在会话上。
   · 负载：`term_stats` 每 3 秒真读一次 `/proc`（两次采样算 CPU 差值）+ `ps`。
   · 日志：`term_tail` 真 `tail` 一个日志文件，挑不到就退回 `journalctl`。
   · 记录：会话与每条命令都落 `srv_term_session` / `srv_term_command`，
     方向键翻的是这台机器上真敲过的历史，重启还在。

   原来那三档主题、窗控、拖拽区、整页铺满的口径一条没动（见
   `module-workspace.css` 终端段首）；换掉的只是数据来源。

   界面上仍然"看起来像 tmux"，但两处是老实交代而不是演的：
   1. 不是伪终端 —— 全屏程序（`top` / `vim`）会报 "not a terminal"，
      `export` 也只在那一条命令里有效。这是命令式终端的边界，不假装支持。
   2. `dev` / `monitor` 两个标签是真的视图切换：`monitor` 把主终端收起、
      把 htop 与日志铺满，而不是装饰。
   ============================================================================ */

const THEMES = [
  { key: 'green', cls: 'tm-g', title: '绿色' },
  { key: 'amber', cls: 'tm-a', title: '琥珀' },
  { key: 'blue', cls: 'tm-b', title: '蓝色' },
] as const
type ThemeKey = (typeof THEMES)[number]['key']

type ConnState = 'idle' | 'connecting' | 'live' | 'error'

type LineKind = 'cmd' | 'out' | 'err' | 'note'

interface TermLine {
  id: number
  kind: LineKind
  text: string
}

const LINE_CLASS: Record<LineKind, string> = {
  cmd: 'tm-line-cmd',
  out: 'tm-line-out',
  err: 'tm-line-err',
  note: 'tm-line-note',
}

/** 主终端最多留多少行 —— 一条 `cat` 就能刷出几千行，DOM 撑不住 */
const MAX_LINES = 600

const ICON_PLUG = (
  <>
    <path d="M8 2v4M16 2v4" />
    <path d="M5 6h14v4a7 7 0 0 1-7 7 7 7 0 0 1-7-7z" />
    <path d="M12 17v5" />
  </>
)

const ICON_PROMPT = (
  <>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </>
)

/** `help` 是这一页自己的说明，不走远端 —— 它讲的是这个界面怎么用 */
const HELP_LINES = [
  '可用：任何远端 sh 能跑的命令；cd 会留在会话上（下一条命令接着在那个目录）',
  'clear 清屏 · help 这段说明 · history 这台机器上敲过的命令',
  'exit / logout 关闭会话（回到未连接状态）',
  '全屏程序（top / vim）需要伪终端，这里跑不了 —— 用 ps / tail 这类一次性的命令',
  '单条命令最多等 120 秒；再长的（整包构建）建议拆开跑',
]

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/* 连接没建立时先分清是哪一类：三类的动作完全不同，笼统说一句"连不上"
   等于让人自己去猜 —— 尤其提权失败那类，SSH 其实是进去了的。 */
type Failure = 'cred' | 'escalate' | 'net' | 'other'

const FAILURE_COPY: Record<Failure, { label: string; text: string; link: string }> = {
  cred: {
    label: '凭据没过',
    text: 'SSH 认不过去 —— 台账里那份密码或私钥不对，或这台机器不允许该账户这样登录。可以在下面重填（加密存进本机库），也可以去台账改连接参数。',
    link: '去台账改连接参数',
  },
  escalate: {
    label: '提权没过',
    text: 'SSH 已经进去了，卡在提权这一步。登录账户本来就够权限的话，把台账里的提权方式改成 none；一定要 sudo，就在那台机器上给这个账户 NOPASSWD（/etc/sudoers.d/）。',
    link: '去台账改提权方式',
  },
  net: {
    label: '到不了',
    text: '到不了这台机器 —— 看 IP、端口、防火墙，或者机器是不是关着。',
    link: '去台账核对地址',
  },
  other: {
    label: '没连上',
    text: '连接没建立，原始报错在上面那行。改完连接参数再点重试。',
    link: '去台账改连接参数',
  },
}

/** 报错文案分档。提权那条里也带 "password"，所以先判提权 */
function classifyFailure(message: string): Failure {
  if (!message) return 'other'
  if (/sudo|提权|授权|no tty present|su: /.test(message)) return 'escalate'
  if (/密码|私钥|凭据|被拒绝|Permission denied|denied/i.test(message)) return 'cred'
  if (/连不上|timed out|Connection refused|unreachable|No route|broken pipe/i.test(message)) return 'net'
  return 'other'
}

/** `~` 缩写的当前目录 —— 提示符里那一段 */
function displayPath(cwd: string, home: string): string {
  if (!cwd) return '~'
  if (home && (cwd === home || cwd.startsWith(`${home}/`))) {
    return `~${cwd.slice(home.length)}` || '~'
  }
  return cwd
}

function meterClass(value: number): string {
  return value > 70 ? 'tm-crit' : value > 45 ? 'tm-warn' : ''
}

function bytesText(mb: number): string {
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)}G` : `${Math.round(mb)}M`
}

/* ------------------------------------------------------------------ *
 * htop 面板：全部读真值，采不到就写「—」
 * ------------------------------------------------------------------ */

function HtopPanel({ stats }: { stats: TermStats | null }) {
  if (!stats) {
    return <div className="tm-htop-empty">正在读负载…</div>
  }
  if (!stats.available) {
    return <div className="tm-htop-empty">{stats.note || '这台机器读不到负载'}</div>
  }

  const cpuBars = stats.cpuBars.length ? stats.cpuBars : [stats.cpu]
  const meters = (label: string, bars: number[]) => (
    <div className="tm-meters">
      {bars.map((value, index) => (
        <div className="tm-meter" key={`${label}${index}`}>
          <span className="tm-label">{`${label}${index}`}</span>
          <span className={cn('tm-bar-mini', meterClass(value))}>
            <i style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
          </span>
          <span className="tm-val">{`${value.toFixed(0)}%`}</span>
        </div>
      ))}
    </div>
  )

  return (
    <>
      <div className="tm-header-line">
        <span className="tm-left">{`CPU [${cpuBars.map((v) => v.toFixed(0)).join(' ')}%]`}</span>
        <span>{`Tasks: ${stats.tasks}, ${stats.threads} thr; ${stats.running} running`}</span>
      </div>
      {meters('C', cpuBars.slice(0, 8))}
      <div className="tm-header-line">
        <span className="tm-left">
          {`Mem [${bytesText(stats.memUsedMb)} / ${bytesText(stats.memTotalMb)}]`}
        </span>
        <span>{`Load avg: ${stats.load.map((v) => v.toFixed(2)).join(' ') || '—'}`}</span>
      </div>
      {meters('M', [stats.mem])}
      <table>
        <thead>
          <tr>
            <th>PID</th>
            <th>USER</th>
            <th>CPU%</th>
            <th>MEM%</th>
            <th>COMMAND</th>
          </tr>
        </thead>
        <tbody>
          {stats.processes.map((proc) => (
            <tr key={`${proc.pid}-${proc.command}`}>
              <td className="tm-num">{proc.pid}</td>
              <td className="tm-name">{proc.user}</td>
              <td className={cn('tm-num', proc.cpu > 20 ? 'tm-cpu-crit' : proc.cpu > 5 ? 'tm-cpu-hi' : '')}>
                {proc.cpu.toFixed(1)}
              </td>
              <td className={cn('tm-num', proc.mem > 20 ? 'tm-mem-hi' : '')}>{proc.mem.toFixed(1)}</td>
              <td className="tm-cmd-cell">{proc.command}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * 页面
 * ------------------------------------------------------------------ */

export function TerminalPage() {
  const { id } = useParams<{ id: string }>()
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const host = params.get('host') ?? ''
  const { data: project } = useProjectDetail(id)
  const { data: server } = useServer(host || undefined)
  const { data: historyRows } = useTermHistory(host || undefined)

  const from = (location.state as { from?: string } | null)?.from
  const goBack = () => navigate(from ?? `/work/projects/${id ?? ''}`)

  useDocumentTitle(`终端 · ${host || project?.project.name || '未指定机器'} · Lucky-Y`)

  const [theme, setTheme] = useState<ThemeKey>('green')
  const [clock, setClock] = useState(() => new Date())
  const [view, setView] = useState<'dev' | 'monitor'>('dev')
  const [conn, setConn] = useState<ConnState>('idle')
  const [errorMessage, setErrorMessage] = useState('')
  const [opened, setOpened] = useState<TermOpen | null>(null)
  const [cwd, setCwd] = useState('')
  const [lines, setLines] = useState<TermLine[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [stats, setStats] = useState<TermStats | null>(null)
  const [statsError, setStatsError] = useState('')
  const [tail, setTail] = useState<TermTail | null>(null)
  const [tailError, setTailError] = useState('')
  const [secretDraft, setSecretDraft] = useState('')
  const [secretSaving, setSecretSaving] = useState(false)

  const sessionRef = useRef<string | null>(null)
  const aliveRef = useRef(true)
  const startedRef = useRef(false)
  const lineSeq = useRef(0)
  const [localCommands, setLocalCommands] = useState<string[]>([])
  const histIdx = useRef(-1)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const outBodyRef = useRef<HTMLDivElement | null>(null)

  /**
   * 方向键翻的历史：最近的在最前。
   * 本次会话敲的（倒序）+ 库里这台机器敲过的（新的在前），去重 ——
   * 库里的那份重启还在，这是它落库的唯一理由。
   */
  const history = useMemo(() => {
    const merged: string[] = []
    for (const command of localCommands.slice().reverse()) merged.push(command)
    for (const row of historyRows ?? []) {
      if (!merged.includes(row.command)) merged.push(row.command)
    }
    return merged
  }, [localCommands, historyRows])

  const pushLines = useCallback((items: Array<{ kind: LineKind; text: string }>) => {
    setLines((prev) => {
      const next = prev.slice()
      for (const item of items) {
        const text = item.text.replace(/\n+$/, '')
        if (!text) continue
        for (const row of text.split('\n')) {
          next.push({ id: ++lineSeq.current, kind: item.kind, text: row })
        }
      }
      return next.length > MAX_LINES ? next.slice(next.length - MAX_LINES) : next
    })
  }, [])

  const connect = useCallback(async () => {
    if (!host) {
      setConn('error')
      setErrorMessage('这个地址没带机器名 —— 从运维页那台服务器的「⌨」进来')
      return
    }
    setConn('connecting')
    setErrorMessage('')
    setStats(null)
    setTail(null)
    setStatsError('')
    setTailError('')
    try {
      const result = await openTerminal(host)
      if (!aliveRef.current) {
        /* 连上的过程中页面已经关了：把会话收掉，别留一条没人用的主连接 */
        void closeTerminal(result.sessionId).catch(() => {})
        return
      }
      sessionRef.current = result.sessionId
      setOpened(result)
      setCwd(result.cwd)
      setLines([])
      setConn('live')
      pushLines([
        { kind: 'note', text: `${result.user}@${result.ip} · ${result.os}` },
        {
          kind: 'note',
          text: `第 ${result.sessionNo} 次会话 · 建连 ${result.connectMs}ms · shell ${result.shell}`,
        },
        { kind: 'note', text: '输入 help 看这一页支持什么；cd 会留在会话上' },
      ])
      /* 台账里的提权配置被跳过时，这一页得说一声 —— 不然用户会以为 sudo 生效了 */
      if (result.escNote) pushLines([{ kind: 'note', text: result.escNote }])
    } catch (error) {
      if (!aliveRef.current) return
      const text = errorText(error)
      setConn('error')
      setErrorMessage(text)
      pushLines([{ kind: 'err', text }])
    }
  }, [host, pushLines])

  const disconnect = useCallback(async () => {
    const sessionId = sessionRef.current
    sessionRef.current = null
    setConn('idle')
    setBusy(false)
    setOpened(null)
    if (sessionId) {
      try {
        await closeTerminal(sessionId)
      } catch {
        /* 已经断了就没什么可收的 */
      }
    }
  }, [])

  /* ---- 进来就连；卸载时收会话（StrictMode 的第二次挂载不重复连） ---- */
  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true
    void connect()
  }, [connect])

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
      const sessionId = sessionRef.current
      sessionRef.current = null
      if (sessionId) void closeTerminal(sessionId).catch(() => {})
    }
  }, [])

  /* ---- 命令跑了多久：输入框禁用着，总得让人看见它还在动 ---- */
  useEffect(() => {
    if (!busy) {
      setElapsed(0)
      return
    }
    const started = Date.now()
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - started) / 1000)), 500)
    return () => window.clearInterval(timer)
  }, [busy])

  /* ---- 时钟 ---- */
  useEffect(() => {
    const timer = window.setInterval(() => setClock(new Date()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  /* ---- 负载：连上之后每 3 秒真采一次 ---- */
  useEffect(() => {
    const sessionId = opened?.sessionId
    if (conn !== 'live' || !sessionId) return
    let stopped = false
    const tick = async () => {
      try {
        const next = await readTerminalStats(sessionId)
        if (!stopped) {
          setStats(next)
          setStatsError('')
        }
      } catch (error) {
        if (!stopped) setStatsError(errorText(error))
      }
    }
    void tick()
    const timer = window.setInterval(tick, 3000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [conn, opened])

  /* ---- 日志：每 4 秒真 tail 一次 ---- */
  useEffect(() => {
    const sessionId = opened?.sessionId
    if (conn !== 'live' || !sessionId) return
    let stopped = false
    const tick = async () => {
      try {
        const next = await tailTerminalLog(sessionId, undefined, 40)
        if (!stopped) {
          setTail(next)
          setTailError('')
        }
      } catch (error) {
        if (!stopped) setTailError(errorText(error))
      }
    }
    void tick()
    const timer = window.setInterval(tick, 4000)
    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [conn, opened])

  /* ---- 输出滚到底 ---- */
  useEffect(() => {
    const box = outBodyRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [lines, busy])

  const promptUser = opened?.effectiveUser || server?.loginUser || 'user'
  const promptHost = opened?.host || host || 'host'
  const home = opened?.home || ''
  const promptPath = displayPath(cwd, home)

  const submit = useCallback(
    async (raw: string) => {
      const command = raw.trim()
      const prefix = `${promptUser}@${promptHost} ${promptPath}$ `
      if (!command) {
        pushLines([{ kind: 'cmd', text: prefix }])
        return
      }

      setLocalCommands((prev) => [...prev, command])
      histIdx.current = -1
      pushLines([{ kind: 'cmd', text: `${prefix}${command}` }])

      /* 三条界面自己的命令：它们说的是这个终端，不该发给远端 */
      if (command === 'clear') {
        setLines([])
        return
      }
      if (command === 'help') {
        pushLines(HELP_LINES.map((text) => ({ kind: 'note' as LineKind, text })))
        return
      }
      if (command === 'history') {
        const list = history.slice(0, 40)
        pushLines(
          (list.length ? list.map((text, index) => `${String(index + 1).padStart(3)}  ${text}`) : ['还没有记录']).map(
            (text) => ({ kind: 'note' as LineKind, text }),
          ),
        )
        return
      }

      const sessionId = sessionRef.current
      if (!sessionId) {
        pushLines([{ kind: 'err', text: '没连上 —— 点右上角「连接」' }])
        return
      }

      setBusy(true)
      try {
        const result = await runTerminalCommand(sessionId, command)
        if (!aliveRef.current) return
        if (result.stdout) pushLines([{ kind: 'out', text: result.stdout }])
        if (result.stderr) pushLines([{ kind: 'err', text: result.stderr }])
        if (result.truncated) pushLines([{ kind: 'note', text: '（输出太长，只留了最后一段）' }])
        if (result.code !== 0) {
          pushLines([{ kind: 'note', text: `退出码 ${result.code} · ${result.durationMs}ms` }])
        }
        setCwd(result.cwd)
        void queryClient.invalidateQueries({ queryKey: termKeys.history(host) })
        if (result.closed) {
          sessionRef.current = null
          setConn('idle')
          setOpened(null)
          pushLines([{ kind: 'note', text: '会话已关闭' }])
        }
      } catch (error) {
        if (!aliveRef.current) return
        const text = errorText(error)
        pushLines([{ kind: 'err', text }])
        /* 会话没了（连接断 / 后端收掉）才把状态打回错误态；
           命令本身的语法错不该被判成"断了" */
        if (error instanceof ApiError && (error.code === 'notFound' || text.includes('连接断了'))) {
          sessionRef.current = null
          setConn('error')
          setErrorMessage(text)
        }
      } finally {
        if (aliveRef.current) setBusy(false)
      }
    },
    [history, host, promptHost, promptPath, promptUser, pushLines, queryClient],
  )

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      const value = input
      setInput('')
      void submit(value)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!history.length) return
      histIdx.current = Math.min(histIdx.current + 1, history.length - 1)
      setInput(history[histIdx.current] ?? '')
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!history.length) return
      histIdx.current -= 1
      setInput(histIdx.current >= 0 ? (history[histIdx.current] ?? '') : '')
      return
    }
    if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault()
      setLines([])
    }
  }

  const saveSecret = async (event: FormEvent) => {
    event.preventDefault()
    const value = secretDraft.trim()
    if (!value || !host) return
    setSecretSaving(true)
    try {
      await setServerSecret(host, value)
      setSecretDraft('')
      setErrorMessage('')
      void queryClient.invalidateQueries({ queryKey: serverKeys.one(host) })
      void queryClient.invalidateQueries({ queryKey: serverKeys.list() })
      pushLines([{ kind: 'note', text: server?.authCode === 'pwd' ? '密码已存，正在重连…' : '私钥路径已存，正在重连…' }])
      await connect()
    } catch (error) {
      pushLines([{ kind: 'err', text: errorText(error) }])
    } finally {
      if (aliveRef.current) setSecretSaving(false)
    }
  }

  const connText = conn === 'live' ? '已连接' : conn === 'connecting' ? '连接中…' : conn === 'error' ? '连接失败' : '未连接'
  const buttonText = conn === 'connecting' ? '连接中…' : conn === 'live' ? '断开' : '连接'
  const statusText = conn === 'live' ? 'live' : conn === 'connecting' ? 'ssh…' : conn === 'error' ? 'error' : 'idle'
  const clockText = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`
  const tmuxTime = `${pad(clock.getHours())}:${pad(clock.getMinutes())}`
  const tailLines = tail?.text ? tail.text.split('\n').slice(-120) : []
  const failure = classifyFailure(errorMessage)
  const failureCopy = FAILURE_COPY[failure]
  const live = conn === 'live'
  /* 没连上就没有"当前目录"这回事：写个 ~ 是在替远端猜 */
  const promptPathText = opened || live ? promptPath : ''

  const toggleConnect = () => {
    if (conn === 'connecting') return
    if (conn === 'live') void disconnect()
    else void connect()
  }

  return (
    <div className="tm-root" data-theme={theme === 'green' ? undefined : theme}>
      <div className="tm-terminal">
        {/* 标题栏：整条是拖拽区，红点只关这个终端（见文件头） */}
        <div className="tm-titlebar" {...DRAG_REGION}>
          <WindowControls onClose={goBack} closeLabel="关闭这个终端窗口（返回运维页）" />
          <div className="tm-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {ICON_PROMPT}
            </svg>
            <span className="tm-path">{promptPath}</span>
            <span className="tm-sep">—</span>
            <span className="tm-file">{opened ? `ssh ${opened.ip}:${server?.sshPort ?? 22}` : host || '未指定机器'}</span>
          </div>
          <div className="tm-title-actions">
            <button
              type="button"
              className={cn('tm-connect-btn', conn === 'live' && 'tm-on')}
              disabled={conn === 'connecting'}
              title={conn === 'live' ? '断开这条 SSH 连接' : '用台账里的凭据发起 SSH'}
              onClick={toggleConnect}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICON_PLUG}
              </svg>
              <span>{buttonText}</span>
            </button>
            <span
              className={cn(
                'tm-connection-status',
                conn === 'live' && 'tm-live',
                conn === 'connecting' && 'tm-fallback',
                conn === 'error' && 'tm-dead',
              )}
            >
              <span className="tm-dot-c" />
              <span>{connText}</span>
            </span>
            <div className="tm-theme-switch">
              {THEMES.map((item) => (
                <div
                  key={item.key}
                  className={cn('tm-theme-btn', item.cls, theme === item.key && 'tm-active')}
                  title={item.title}
                  role="button"
                  tabIndex={0}
                  onClick={() => setTheme(item.key)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setTheme(item.key)
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* 标签：真的切视图 —— monitor 收起主终端、把负载与日志铺满 */}
        <div className="tm-tabs">
          {(['dev', 'monitor'] as const).map((key) => (
            <div
              key={key}
              className={cn('tm-tab', view === key && 'tm-active')}
              onClick={() => {
                setView(key)
                if (key === 'dev') inputRef.current?.focus()
              }}
            >
              <span className="tm-dot-ind" />
              <span>{key}</span>
            </div>
          ))}
        </div>

        <div className="tm-screen">
          <div className="tm-tmux-status">
            <div className="tm-left">
              <span className={cn('tm-tag', live ? 'tm-g' : 'tm-tag-off')}>{`[${promptHost}]`}</span>
              {live ? (
                <>
                  <span>0:bash{view === 'dev' ? '*' : ''}</span>
                  <span className="tm-sep">·</span>
                  <span>1:htop</span>
                  <span className="tm-sep">·</span>
                  <span>2:logs</span>
                </>
              ) : (
                /* 没有会话就没有窗口 —— 别摆三个假的出来 */
                <span className="tm-off-text">
                  {conn === 'connecting' ? 'connecting…' : conn === 'error' ? 'no session' : 'no session'}
                </span>
              )}
            </div>
            <div className="tm-right">
              <span>{tmuxTime}</span>
              <span className="tm-sep">·</span>
              <span>{`${clock.getFullYear()}-${pad(clock.getMonth() + 1)}-${pad(clock.getDate())}`}</span>
            </div>
          </div>

          <div className="tm-panes" data-view={view}>
            <div className="tm-pane tm-master">
              <div className="tm-pane-header">
                <div className="tm-title">
                  <span className={cn('tm-dot-sm', !live && 'tm-off')} />
                  {live ? `${opened ? opened.shell.split('/').pop() : 'sh'} · ${promptPath}` : `${promptHost} · 未连接`}
                </div>
                <div className="tm-meta">
                  {conn === 'live' ? (busy ? `running ${elapsed}s` : 'connected') : conn === 'connecting' ? 'connecting' : conn === 'error' ? 'failed' : 'disconnected'}
                </div>
              </div>
              <div className="tm-pane-body tm-term-body" onClick={() => inputRef.current?.focus()}>
                <div className="tm-term-output" ref={outBodyRef}>
                  {lines.map((line) => (
                    <div key={line.id} className={LINE_CLASS[line.kind]}>
                      {line.text || '\u00a0'}
                    </div>
                  ))}
                </div>

                {conn === 'error' ? (
                  <div className="tm-fix">
                    <div className="tm-fix-head">
                      <span className="tm-fix-label">{failureCopy.label}</span>
                      <span>{failureCopy.text}</span>
                    </div>
                    {failure === 'cred' ? (
                      <form className="tm-fix-form" onSubmit={saveSecret}>
                        <input
                          className="tm-fix-input"
                          type={server?.authCode === 'pwd' ? 'password' : 'text'}
                          value={secretDraft}
                          placeholder={
                            server?.authCode === 'pwd'
                              ? '重新输入登录密码'
                              : '私钥路径，如 ~/.ssh/id_ed25519'
                          }
                          autoComplete="off"
                          onChange={(event) => setSecretDraft(event.target.value)}
                        />
                        <button
                          type="submit"
                          className="tm-fix-btn"
                          disabled={!secretDraft.trim() || secretSaving}
                        >
                          {secretSaving ? '保存中…' : '存进台账并重连'}
                        </button>
                      </form>
                    ) : null}
                    <div className="tm-fix-actions">
                      <button type="button" className="tm-fix-btn" onClick={() => void connect()}>
                        重试
                      </button>
                      <Link className="tm-fix-link" to={`/work/servers/${encodeURIComponent(host || '')}`}>
                        {failureCopy.link}
                      </Link>
                    </div>
                  </div>
                ) : null}

                <div className="tm-term-input-line">
                  <span className="tm-prompt">
                    <span className="tm-user">{promptUser}</span>
                    <span className="tm-at">@</span>
                    <span className="tm-host">{promptHost}</span>
                    {promptPathText ? <span className="tm-path"> {promptPathText}</span> : null}
                    <span className="tm-sign">$</span>
                  </span>
                  <input
                    ref={inputRef}
                    className="tm-term-input"
                    type="text"
                    value={input}
                    placeholder={
                      conn === 'live'
                        ? busy
                          ? '正在跑，等它回来…'
                          : '输入命令 (回车执行)'
                        : conn === 'connecting'
                          ? '正在建连…'
                          : '未连接'
                    }
                    disabled={conn !== 'live' || busy}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={onKeyDown}
                  />
                </div>
              </div>
            </div>

            <div className="tm-pane tm-side">
              <div className="tm-pane">
                <div className="tm-pane-header">
                  <div className="tm-title">
                    <span className={cn('tm-dot-sm', !(live && stats?.available && !statsError) && 'tm-off')} />
                    htop
                  </div>
                  <div className="tm-meta">
                    {statsError
                      ? '读不到'
                      : stats?.available
                        ? `cpu ${stats.cpu.toFixed(0)}% · mem ${stats.mem.toFixed(0)}%`
                        : '—'}
                  </div>
                </div>
                <div className="tm-pane-body">
                  {conn !== 'live' ? (
                    <div className="tm-htop-empty">{conn === 'connecting' ? '正在建连…' : '未连接'}</div>
                  ) : statsError ? (
                    <div className="tm-htop-empty">{statsError}</div>
                  ) : (
                    <div className="tm-htop">
                      <HtopPanel stats={stats} />
                    </div>
                  )}
                </div>
              </div>

              <div className="tm-pane">
                <div className="tm-pane-header">
                  <div className="tm-title">
                    <span className={cn('tm-dot-sm', !(live && tail && !tailError) && 'tm-off')} />
                    logs · tail
                  </div>
                  <div className="tm-meta">
                    {tailError ? '读不到' : tail ? `${tail.source === 'journalctl' ? 'journalctl' : tail.source.split('/').pop()} · ${tail.lineCount} 行` : '—'}
                  </div>
                </div>
                <div className="tm-pane-body">
                  <div className="tm-term-output tm-tail">
                    {tailError ? (
                      <div className="tm-line-err">{tailError}</div>
                    ) : tailLines.length ? (
                      tailLines.map((text, index) => (
                        <div key={index} className="tm-line-out">
                          {text || '\u00a0'}
                        </div>
                      ))
                    ) : (
                      <div className="tm-htop-empty">{conn === 'live' ? '还在读日志…' : '未连接'}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="tm-statusbar">
          <div className="tm-sb-left">
            <div className="tm-sb-item">
              <span className={cn('tm-led', conn !== 'live' && 'tm-led-off')} />
              <span>{statusText}</span>
            </div>
            <span className="tm-sep-dot" />
            <div className="tm-sb-item">
              <span className="tm-badge tm-c">{promptUser}</span>
              <span>{opened ? `${opened.ip}:${server?.sshPort ?? 22}` : host || '—'}</span>
            </div>
            <span className="tm-sep-dot" />
            <div className="tm-sb-item">
              <span>{opened?.os || server?.os || '系统未知'}</span>
            </div>
            {opened ? (
              <>
                <span className="tm-sep-dot" />
                <div className="tm-sb-item">
                  <span className="tm-badge tm-g">{`S${opened.sessionNo}`}</span>
                  <span>{`${cwd ? displayPath(cwd, home) : '~'}`}</span>
                </div>
              </>
            ) : null}
          </div>
          <div className="tm-sb-right">
            <div className="tm-sb-item">
              <span>{stats?.available ? `CPU ${stats.cpu.toFixed(0)}%` : 'CPU —'}</span>
            </div>
            <span className="tm-sep-dot" />
            <div className="tm-sb-item">
              <span>{stats?.available ? `MEM ${stats.mem.toFixed(0)}%` : 'MEM —'}</span>
            </div>
            <span className="tm-sep-dot" />
            <div className="tm-sb-item">
              <span>{clockText}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
