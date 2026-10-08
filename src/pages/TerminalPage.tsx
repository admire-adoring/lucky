import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react'
import { useSearchParams, useParams, useLocation, useNavigate } from 'react-router-dom'
import { useDocumentTitle } from '../hooks/use-document-title'
import { useProjectDetail } from '../hooks/use-projects'
import { WindowControls } from '../components/layout/WindowControls'
import { DRAG_REGION } from '../lib/desktop-window'
import { cn } from '../lib/cn'

/* ============================================================================
   终端 —— 运维页每台服务器行上那颗「⌨」打开的 SSH 终端窗口
   原型 `design/work/终端.html`（2026-09-26 10:43 版，1218 行：CSS 472 / 标记 162 / JS 576）
   ----------------------------------------------------------------------------
   这是一条独立的整窗页面（`/terminal/:id?host=<机器名>`），和 `/logs/:id`、`/deploy/:id`
   同族：不套模块外壳、不借 `WorkspaceLayout`，入口在运维页的服务器行上。

   ============================================================================
   与原型有意不同的四处（"静态页 → 应用"必然要改的，不是审美）
   ============================================================================
   ① 不套 `MacWindow`（与日志/部署两页相反）。原型自己就是一整扇终端窗口：
      `.terminal` 里有它自己的标题栏（红黄绿三颗 + 标题 + 连接/主题按钮）＋ 标签页 ＋ 状态栏。
      再套一层 `MacWindow` 会得到两排红黄绿。所以这一页保留原型自己的窗框。
      （这条原本还带一句"页内 `vh` 合法"—— 那条判据已被 ⑤ 的"整页铺满"作废：
          `.tm-terminal` 现在是 `height: 100%`，不再是 `min(760px, 92vh)`。）
   ② 不做主题持久化、也不写 `localStorage`：原型把三档主题写到
      `document.documentElement.dataset.theme`（和应用的 `<html data-theme="light|dark">`
      同一根属性，直接照搬会把应用主题打乱），并且把连接状态写进
      `localStorage['ops-term:<机器>']` 让运维页用 `storage` 事件同步。
      应用里前者改成页面根上的 `data-theme`（`.tm-root[data-theme='amber']`），
      后者整条去掉 —— 运维页那个「运行中」是数据派生的（`server.on`），
      一个 localStorage 标记改不动它，留着就是两套说法。
   ③ 不连 WebSocket：原型会去连 `ws://localhost:8080`，失败后降级到内置回显。
      应用里没有这个后端，所以「连接」直接走降级那条路（正文与降级提示照抄原型），
      不产生一条必然失败的网络请求。
   ④ 三处时刻沿用原型的演示值：tmux 状态栏右侧那个日期（`2026-04-07`）、
      `htop` 的进程表与负载、状态栏的 CPU/MEM —— 原型里它们分别是写死的、`Math.random()`
      抖动的、模拟行走的。这里照抄（这一页本来就是"终端长什么样"的演示）。
   ⑤ 不保留原型那层「深色桌面」底衬，并且整页铺满不留四周的黑边（用户指令）：
      顶部绿晕 / 右下淡蓝 / 40px 网格 / 噪点一律去掉，连窗自己那圈
      `0 0 80px -20px var(--green-glow)` 外发光也去掉（在应用里这一圈只会被读成"这页出错了"）；
      `.tm-root` 的 20px 内边距与 `.tm-terminal` 的 `min(1200px,100%)/min(760px,92vh)`、
      `border-radius:12px`、`1px 描边`、投影也一起去掉 —— 整页就是这扇窗，从标题栏开始。
      ⇒ 因此这一页不再出现 `vh`（原来那条「页内 `vh` 合法」的判据随铺满一起作废），
      也不再套 `MacWindow`（见 ①）。
      改动全在样式段里（`module-workspace.css` 的终端段，段首【①】【②】有完整口径），
      组件这边不用管。
   ⑥ 标题栏那三颗圆点是这一页唯一的窗口控制（不是装饰）。原型里它们只是三个 `<span>`：
      原型自己就是那扇窗，所以不需要功能；应用里这一页既不套模块外壳、也不套 `MacWindow`，
      整个应用窗口上再没有第二处窗控 ⇒ 照抄过来就是"窗口关不掉、也拖不动"。
      · 三颗点换成应用既有的 `WindowControls`（`components/layout/WindowControls.tsx`）：
        平台形状与行为（macOS 圆点+全屏；Windows/Linux 方形+最大化）、失焦整组变灰、
        macOS hover 浮字形、浏览器里把「仅桌面端生效」写进无障碍名 —— 全在它里面，
        这一页不需要自己维护一份。视觉与原型几乎逐项相同（12px 圆点、`#ff5f57`/`#febc2e`/`#28c840`、
        视觉间距 8px；差别只是 hover 由"整颗提亮"换成"浮出字形"，后者才是 macOS 原生行为）。
      · `.tm-titlebar` 挂 `DRAG_REGION`（`deep` 档）：这一页整页都是终端，没有别处可拖。
        可点元素（连接钮 / 主题钮）由 Tauri 的 hit-test 自动排除，不需要 `stopPropagation`。
      · 红点只管"关掉这个终端"，不关应用（用户指令）：用 `WindowControls` 的 `onClose`
        把那颗交回本页，走 `goBack()` 回运维页（`from` 由入口用 `state` 带来，与日志/部署同款）。
        真去 `closeWindow()` 的话，点一下整个应用就退了 —— 那是"这是应用窗口"的语义，
        而这里要的是"这是应用里的一个子窗口"。黄点/绿点不接管：最小化与全屏就是真实的
        窗口操作，没有"页面内的最小化"这回事，也别因为要返回就把整组窗控删掉。
      两个后果，知道就行：① `.tm-dots` / `.tm-dot*` 那几条样式从此没有消费者了 ——
        按本仓口径（零消费者规则不删）它们留在样式段里，不要按"死代码"清掉；
        ② 非 macOS 上这一组会在标题栏左侧显示 Windows/Linux 形状的按钮（原型把点放左边），
        形状与位置跟应用别处的右上角不一致，但行为是对的。要改成"非 macOS 也靠右"说一声。

   ============================================================================
   三条容易写错、且错了不会报错的判据
   ============================================================================
   ① 每一个类名都加了 `tm-` 前缀（不是只加作用域）。原型的类名一半是通用词
      （`.dot` / `.tabs` / `.tab` / `.badge` / `.active` / `.on` / `.ok` / `.warn` / `.name` / `.val` …），
      实测 83 个类里 22 个和本仓已有 CSS 撞名，其中几条在别的页面作用域下特异性更高
      （如 `.mw-root[data-module] .proj-detail .ops-page .badge`），只加 `.tm-root ` 前缀照样会被盖掉。
      本项目刚因此出过一次事故（新页的 `.panel` 撞上 `.mw-root .panel{display:none}`，整张表单一格不显）。
      ⇒ 样式段与这里一一对应地加了前缀，别把哪一半改回原型名。
   ② 终端输出是 HTML 串，用 `dangerouslySetInnerHTML` 渲染 —— 原型就是这么写的
      （`termWrite(html)` 里塞 `<span class="ok">`）。内容是本文件里的常量，
      唯一的用户输入（命令行本身）走 `escapeHtml()` 后才拼进去，与原型同一条口径。
      换成 ReactNode 数组会把那一百多行输出文案全部重写一遍，收益与风险不成比例。
   ③ 连接状态只有一个收口（`setConnState`）：顶栏胶囊、状态栏、pane 的 meta、按钮文案
      四处都从它推。散着写很快就会出现"胶囊说已连接、按钮还写着连接"。
   ============================================================================ */

/** 三档主题。`green` 是默认档 —— 原型里它是"移除 data-theme"，不是写一个值 */
const THEMES = [
  { key: 'green', cls: 'tm-g', title: '绿色' },
  { key: 'amber', cls: 'tm-a', title: '琥珀' },
  { key: 'blue', cls: 'tm-b', title: '蓝色' },
] as const
type ThemeKey = (typeof THEMES)[number]['key']

/** 连接四态。收口在一处 —— 顶栏胶囊 / 状态栏 / pane meta / 按钮文案都从它推（见文件头 ③） */
type ConnState = 'idle' | 'connecting' | 'live' | 'fallback'

/** 顶栏那枚「连接」按钮的图标（原型的 titlebar svg 之一） */
const ICON_PLUG: ReactNode = (
  <>
    <path d="M8 2v4M16 2v4" />
    <path d="M5 6h14v4a7 7 0 0 1-7 7 7 7 0 0 1-7-7z" />
    <path d="M12 17v5" />
  </>
)

/** 标题栏左侧那枚 `>_` */
const ICON_PROMPT: ReactNode = (
  <>
    <polyline points="4 17 10 11 4 5" />
    <line x1="12" y1="19" x2="20" y2="19" />
  </>
)

/** 终端左上角那行「开屏语」。连上之后原型会把后半句提示删掉，所以它拆成两半 */
const BOOT_LINE = '$ <span class="tm-info">nebula shell v2.6</span>'
const BOOT_HINT = ' <span class="tm-mute">// 未连接 — 点右上角「连接」发起 SSH</span>'

/** htop 面板的进程表（原型写死的 8 条） */
const PROCESSES = [
  { pid: 1204, user: 'guest', cpu: 12.4, mem: 3.2, name: 'node server.ts', cmd: 'tsx watch src/server.ts' },
  { pid: 892, user: 'systemd', cpu: 4.1, mem: 1.8, name: 'postgres', cmd: 'postgres -D /var/lib/postgres' },
  { pid: 934, user: 'systemd', cpu: 1.2, mem: 1.1, name: 'redis-server', cmd: 'redis-server *:6379' },
  { pid: 1567, user: 'guest', cpu: 0.8, mem: 0.6, name: 'tsx watch', cmd: 'node /usr/bin/tsx' },
  { pid: 2188, user: 'guest', cpu: 2.3, mem: 2.1, name: 'vite', cmd: 'vite --host 0.0.0.0' },
  { pid: 3451, user: 'guest', cpu: 0.4, mem: 0.9, name: 'docker-proxy', cmd: '/usr/bin/docker-proxy' },
  { pid: 88, user: 'root', cpu: 0.2, mem: 0.3, name: 'systemd', cmd: '/sbin/init' },
  { pid: 4521, user: 'guest', cpu: 0.1, mem: 0.2, name: 'zsh', cmd: '-zsh' },
] as const

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 命令行里的用户输入要转义后才拼进 HTML 串（与原型同一个 `escapeHtml`） */
function escapeHtml(text: string): string {
  const map: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
  return String(text).replace(/[&<>"']/g, (c) => map[c])
}

function nowTime(): string {
  const d = new Date()
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

/** 日志面板的六条模板（原型逐条照抄；`logTime()` 是"这一刻"） */
const LOG_TEMPLATES: (() => string)[] = [
  () => `<span class="tm-mute">${nowTime()}</span> <span class="tm-info">nebula-api:</span> <span class="tm-hl">GET</span> /api/health <span class="tm-ok">200</span> <span class="tm-mute">${(1 + Math.random() * 5).toFixed(1)}ms</span>`,
  () => `<span class="tm-mute">${nowTime()}</span> <span class="tm-info">nebula-api:</span> <span class="tm-hl">POST</span> /api/auth/login <span class="tm-ok">200</span> <span class="tm-mute">${(8 + Math.random() * 20).toFixed(1)}ms</span>`,
  () => `<span class="tm-mute">${nowTime()}</span> <span class="tm-info">nebula-api:</span> <span class="tm-hl">GET</span> /api/users/me <span class="tm-ok">200</span> <span class="tm-mute">${(2 + Math.random() * 8).toFixed(1)}ms</span>`,
  () => `<span class="tm-mute">${nowTime()}</span> <span class="tm-info">nebula-api:</span> <span class="tm-warn">WARN</span> Cache miss <span class="tm-key">user:profile:${Math.floor(Math.random() * 999)}</span>`,
  () => `<span class="tm-mute">${nowTime()}</span> <span class="tm-info">nebula-api:</span> <span class="tm-hl">POST</span> /api/orders <span class="tm-ok">201</span> <span class="tm-mute">${(15 + Math.random() * 40).toFixed(1)}ms</span>`,
  () => `<span class="tm-mute">${nowTime()}</span> <span class="tm-info">postgres:</span> checkpoint complete: wrote <span class="tm-hl">${Math.floor(Math.random() * 300)}</span> buffers`,
]

/**
 * 内置模拟回显。没有后端，命令的返回就这样一份表 —— 原型逐条照抄。
 * 返回 `null` 表示"这一条不改输出"（`clear` 用它把正文清空）。
 */
const FALLBACK_CMDS: Record<string, (args: string[]) => string | null> = {
  help: () => `可用命令：
  <span class="tm-info">ls, pwd, cd, cat, echo, clear</span>
  <span class="tm-info">git status, git log, git branch</span>
  <span class="tm-info">docker ps, docker images</span>
  <span class="tm-info">npm run dev, npm test, npm build</span>
  <span class="tm-info">htop, top, ps, free, df</span>
  <span class="tm-info">neofetch, whoami, date</span>

<span class="tm-mute">// 启动后端 server.js 可切换到真实 shell</span>`,

  pwd: () => '/home/guest/projects/nebula',

  whoami: () => 'guest',

  date: () => new Date().toString(),

  echo: (args) => escapeHtml(args.join(' ')) || '',

  ls: (args) => {
    const flags = args.filter((a) => a.startsWith('-'))
    const long = flags.some((f) => f.includes('l'))
    if (long) {
      return `total 48
drwxr-xr-x  6 guest guest 4096 Apr  7 10:23 <span class="tm-info">.</span>
drwxr-xr-x 18 guest guest 4096 Apr  6 22:10 <span class="tm-info">..</span>
drwxr-xr-x  8 guest guest 4096 Apr  7 10:22 <span class="tm-info">node_modules</span>
drwxr-xr-x  3 guest guest 4096 Apr  7 10:22 <span class="tm-info">src</span>
-rw-r--r--  1 guest guest  512 Apr  7 10:23 README.md
-rw-r--r--  1 guest guest 1024 Apr  7 10:22 index.html
-rw-r--r--  1 guest guest 2048 Apr  7 10:22 package.json
-rw-r--r--  1 guest guest 1890 Apr  7 10:22 server.js`
    }
    return `<span class="tm-info">node_modules</span>  <span class="tm-info">src</span>  README.md  index.html  package.json  server.js`
  },

  neofetch: () => `<span class="tm-ok">      ███╗   ██╗███████╗██████╗ ██╗   ██╗██╗      █████╗
      ████╗  ██║██╔════╝██╔══██╗██║   ██║██║     ██╔══██╗
      ██╔██╗ ██║█████╗  ██████╔╝██║   ██║██║     ███████║
      ██║╚██╗██║██╔══╝  ██╔══██╗██║   ██║██║     ██╔══██║
      ██║ ╚████║███████╗██████╔╝╚██████╔╝███████╗██║  ██║
      ╚═╝  ╚═══╝╚══════╝╚═════╝  ╚═════╝ ╚══════╝╚═╝  ╚═╝</span>

<span class="tm-hl">guest@nebula</span>
<span class="tm-mute">─────────────</span>
<span class="tm-key">OS</span>      Nebula Linux 2.6.1
<span class="tm-key">Kernel</span>  6.9.0-nebula
<span class="tm-key">Shell</span>   zsh 5.9
<span class="tm-key">CPU</span>     AMD Ryzen 9
<span class="tm-key">Memory</span>  6.8GiB / 32GiB`,

  git: (args) => {
    const sub = args[0]
    if (sub === 'status') {
      return `On branch <span class="tm-info">main</span>
Your branch is ahead of <span class="tm-info">'origin/main'</span> by 2 commits.

Changes not staged for commit:
  <span class="tm-warn">modified:   src/server.ts</span>
  <span class="tm-warn">modified:   src/routes/auth.ts</span>

Untracked files:
  <span class="tm-err">src/routes/metrics.ts</span>

<span class="tm-mute">no changes added to commit</span>`
    }
    if (sub === 'log') {
      return `<span class="tm-warn">a1b2c3d</span> <span class="tm-hl">(HEAD -> main)</span> feat: add metrics route
<span class="tm-warn">9f8e7d6</span> fix: auth token refresh
<span class="tm-warn">3c4b5a6</span> chore: bump deps
<span class="tm-warn">7d8e9f0</span> <span class="tm-info">(origin/main)</span> refactor: split server modules
<span class="tm-warn">2a1b0c9</span> initial commit`
    }
    if (sub === 'branch') {
      return `  dev
  feature/metrics
<span class="tm-ok">* main</span>
  staging`
    }
    return `git: '<span class="tm-warn">${escapeHtml(sub || '')}</span>' is not a git command. See 'git --help'.`
  },

  docker: (args) => {
    if (args[0] === 'ps') {
      return `<span class="tm-hl">CONTAINER ID   IMAGE                STATUS                   PORTS</span>
<span class="tm-mute">b1c2d3e4f5a6   postgres:16-alpine   Up 3 hours (healthy)     0.0.0.0:5432->5432/tcp</span>
<span class="tm-mute">c2d3e4f5a6b7   redis:7-alpine       Up 3 hours (healthy)     0.0.0.0:6379->6379/tcp</span>
<span class="tm-mute">d3e4f5a6b7c8   minio/minio:latest   Up 3 hours               0.0.0.0:9000->9000/tcp</span>`
    }
    if (args[0] === 'images') {
      return `<span class="tm-hl">REPOSITORY          TAG           SIZE</span>
postgres            16-alpine     243MB
redis               7-alpine      41MB
minio/minio         latest        152MB
node                22-alpine     178MB`
    }
    return 'docker: mock 只实现了 ps / images'
  },

  npm: (args) => {
    if (args[0] === 'run' && args[1] === 'dev') {
      return `<span class="tm-mute">> nebula-api@2.6.1 dev</span>
<span class="tm-mute">> tsx watch src/server.ts</span>

<span class="tm-ok">✔</span> Server running at <span class="tm-info">http://localhost:3000</span>
<span class="tm-ok">✔</span> WebSocket listening on <span class="tm-info">ws://localhost:3001</span>
<span class="tm-mute">[tsx] watching for file changes...</span>`
    }
    if (args[0] === 'test') {
      return `<span class="tm-ok">PASS</span>  src/routes/auth.test.ts
<span class="tm-ok">PASS</span>  src/routes/users.test.ts
<span class="tm-ok">PASS</span>  src/utils/crypto.test.ts

<span class="tm-hl">Tests: 24 passed, 24 total</span>
<span class="tm-mute">Time:  1.482 s</span>`
    }
    if (args[0] === 'build') {
      return `<span class="tm-mute">vite v5.4.0 building for production...</span>
<span class="tm-ok">✓</span> 312 modules transformed.
<span class="tm-ok">✓</span> built in <span class="tm-hl">1.24s</span>`
    }
    return `Unknown npm command. Try: run dev / test / build`
  },

  ps: () => `  PID TTY          TIME CMD
 1204 pts/0    00:00:03 node
 1567 pts/0    00:00:01 tsx
 2188 pts/0    00:00:02 vite
 4521 pts/0    00:00:00 zsh`,

  free: () => `              total        used        free      shared  buff/cache
Mem:           32Gi       6.8Gi        18Gi       412Mi        7.2Gi
Swap:          8Gi        320Mi        7.7Gi`,

  df: () => `Filesystem      Size  Used Avail Use% Mounted on
/dev/nvme0n1p1  512G  187G  299G  39% /
tmpfs            16G     0   16G   0% /dev/shm`,

  htop: () => `<span class="tm-mute">// htop 已在右侧面板运行 —— 见 "htop" pane</span>`,

  top: () => `<span class="tm-mute">// top 已合并进右侧 htop 面板</span>`,
}

/** `clear` 是唯一"清屏"的命令：它把正文清空、不追加任何东西 */
FALLBACK_CMDS.clear = () => null

/** 一条命令的执行（`null` = 清屏） */
function fallbackExec(cmdline: string): string | null {
  const parts = cmdline.trim().split(/\s+/)
  const cmd = parts[0]
  const args = parts.slice(1)
  if (!cmd) return null
  const hit = FALLBACK_CMDS[cmd]
  if (hit) return hit(args)
  return `<span class="tm-err">${escapeHtml(cmd)}: command not found</span>
<span class="tm-mute">// 内置命令：help 查看列表</span>`
}

/* ------------------------------------------------------------------ *
 * htop 面板
 * ------------------------------------------------------------------ */

interface HtopData {
  cpu: number
  mem: number
  cpuBars: number[]
  memBars: number[]
}

/** 每 2 秒抖一次（原型就是 `Math.random()` 抖动，不是真读数） */
function makeHtop(): HtopData {
  return {
    cpu: 12 + Math.random() * 6 - 3,
    mem: 21 + Math.random() * 3 - 1.5,
    cpuBars: [12, 8, 24, 4].map((v) => Math.max(0, Math.min(100, v + Math.random() * 4 - 2))),
    memBars: [21, 18, 34, 12].map((v) => Math.max(0, Math.min(100, v + Math.random() * 3 - 1.5))),
  }
}

function meterClass(v: number): string {
  return v > 70 ? 'tm-crit' : v > 45 ? 'tm-warn' : ''
}

function HtopPanel({ data }: { data: HtopData }) {
  const cpuClass = (v: number) => (v > 8 ? 'tm-cpu-crit' : v > 3 ? 'tm-cpu-hi' : undefined)
  const memClass = (v: number) => (v > 2 ? 'tm-mem-hi' : undefined)

  const meters = (label: string, bars: number[]) => (
    <div className="tm-meters">
      {bars.map((v, i) => (
        <div key={i} className="tm-meter">
          <span className="tm-label">{`${label}${i}`}</span>
          <span className={cn('tm-bar-mini', meterClass(v))}>
            <i style={{ width: `${v}%` }} />
          </span>
          <span className="tm-val">{`${v.toFixed(0)}%`}</span>
        </div>
      ))}
    </div>
  )

  return (
    <>
      <div className="tm-header-line">
        <span className="tm-left">{`CPU [${data.cpuBars.map((v) => v.toFixed(0)).join(' ')}%]`}</span>
        <span>Tasks: 87, 214 thr; 1 running</span>
      </div>
      {meters('C', data.cpuBars)}
      <div className="tm-header-line">
        <span className="tm-left">{`Mem [${data.memBars.map((v) => v.toFixed(0)).join(' ')}%]`}</span>
        <span>Load avg: 0.42 0.38 0.35</span>
      </div>
      {meters('M', data.memBars)}
      <table>
        <thead>
          <tr>
            <th>PID</th>
            <th>USER</th>
            <th>CPU%</th>
            <th>MEM%</th>
            <th>COMMAND</th>
            <th className="tm-col-hide">CMD</th>
          </tr>
        </thead>
        <tbody>
          {PROCESSES.map((p) => (
            <tr key={p.pid}>
              <td className="tm-num">{p.pid}</td>
              <td className="tm-name">{p.user}</td>
              <td className={cn('tm-num', cpuClass(p.cpu))}>{p.cpu.toFixed(1)}</td>
              <td className={cn('tm-num', memClass(p.mem))}>{p.mem.toFixed(1)}</td>
              <td>{p.name}</td>
              <td className="tm-col-hide" style={{ color: 'var(--fg-mute)' }}>
                {p.cmd}
              </td>
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
  const { data } = useProjectDetail(id)
  /** 哪台机器的终端（运维页每台服务器行那颗「⌨」带过来的）。没有就是"直接打开本页" */
  const host = params.get('host') ?? ''

  /**
   * 标题栏红点的去向：回上一层页面，不是退出应用（用户指令）。
   *
   * `from` 由运维页那颗「⌨」用 `state` 带过来（与日志/部署两页同一套写法）；
   * 直接输入地址打开时没有它，就回工作模块里这个项目 —— 那里是这台服务器的所在页，
   * 比回首页更接近"从哪儿来回哪儿去"。不要在这里 `closeWindow()`：那一按整个应用就退了。
   */
  const from = (location.state as { from?: string } | null)?.from
  const goBack = () => navigate(from ?? `/work/projects/${id ?? ''}`)

  useDocumentTitle(`终端 · ${host || data?.project.name || 'Nebula'} · Lucky-Y`)

  const [theme, setTheme] = useState<ThemeKey>('green')
  const [clock, setClock] = useState(() => new Date())
  const [stats, setStats] = useState({ cpu: 12, mem: 21 })
  const [htop, setHtop] = useState<HtopData>(makeHtop)
  const [logs, setLogs] = useState<string[]>([])
  const [output, setOutput] = useState<string[]>([BOOT_LINE + BOOT_HINT])
  const [conn, setConn] = useState<ConnState>('idle')
  const [input, setInput] = useState('')
  const [activeTab, setActiveTab] = useState('dev')

  const history = useRef<string[]>([])
  const histIdx = useRef(-1)
  const outRef = useRef<HTMLDivElement | null>(null)
  const outBodyRef = useRef<HTMLDivElement | null>(null)
  const logBodyRef = useRef<HTMLDivElement | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  /** 提示符 —— 主机名那一段跟着 `?host=` 走（原型同款） */
  const ps1 = `<span class="tm-prompt"><span class="tm-user">guest</span><span class="tm-at">@</span><span class="tm-host">${escapeHtml(host || 'nebula')}</span><span class="tm-path"> ~/projects/nebula</span><span class="tm-sign">$</span></span> `

  /** 终端正文追加一行（原型的 `termWrite`） */
  const termWrite = useCallback((html: string) => {
    setOutput((prev) => [...prev, html])
  }, [])

  /* ---- 时钟 + 状态栏那两格（原型是两个 1s 定时器，同样的节拍，这里合并成一个） ---- */
  useEffect(() => {
    const timer = window.setInterval(() => {
      setClock(new Date())
      setStats((prev) => ({
        cpu: Math.max(5, Math.min(45, prev.cpu + (Math.random() - 0.5) * 4)),
        mem: Math.max(15, Math.min(40, prev.mem + (Math.random() - 0.5) * 1.5)),
      }))
    }, 1000)
    return () => window.clearInterval(timer)
  }, [])

  /* ---- htop 每 2s 抖一次 ---- */
  useEffect(() => {
    const timer = window.setInterval(() => setHtop(makeHtop()), 2000)
    return () => window.clearInterval(timer)
  }, [])

  /* ---- 日志面板：每 1.8s 推一行，最多留 60 行，永远滚到底 ---- */
  useEffect(() => {
    const push = () => {
      const tpl = LOG_TEMPLATES[Math.floor(Math.random() * LOG_TEMPLATES.length)]
      setLogs((prev) => [...prev, tpl()].slice(-60))
    }
    push()
    const timer = window.setInterval(push, 1800)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    const box = logBodyRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [logs])

  useEffect(() => {
    const box = outBodyRef.current
    if (box) box.scrollTop = box.scrollHeight
  }, [output])

  /* ---- 连接：四态收口在一处，四处展示都从它推（见文件头 ③） ---- */
  const setFallback = useCallback(() => {
    setConn('fallback')
    termWrite(`<span class="tm-warn">⚠ 后端未启动</span> <span class="tm-mute">— 使用内置模拟回显</span>
<span class="tm-mute">// 想要真实 shell，运行：</span>
<span class="tm-info">//   npm install && npm start</span>
<span class="tm-mute">// 然后点右上角「连接」重试</span>

<span class="tm-mute">输入 </span><span class="tm-hl">help</span><span class="tm-mute"> 查看可用命令</span>`)
  }, [termWrite])

  const disconnect = useCallback(() => {
    setConn('idle')
    termWrite(`<span class="tm-mute">// 已断开 ${escapeHtml(host || 'nebula')}</span>`)
  }, [host, termWrite])

  /**
   * 「连接」。原型在这里 `new WebSocket('ws://localhost:8080')`，失败后降级到内置回显；
   *    应用里没有这个后端 ⇒ 直接走降级那条路（正文与降级提示照抄原型，见文件头 ③），
   *    不产生一条必然失败的网络请求。1.5s 是原型给 WS 的超时。
   */
  const connect = useCallback(() => {
    setConn('connecting')
    setOutput([BOOT_LINE]) // 原型在连上的那一刻把「未连接」那半句提示摘掉
    termWrite(`<span class="tm-mute">// 正在连接 ${escapeHtml(host || 'nebula')} …</span>`)
    const timer = window.setTimeout(setFallback, 1500)
    return () => window.clearTimeout(timer)
  }, [host, setFallback, termWrite])

  const toggleConnect = () => {
    if (conn === 'idle') connect()
    else if (conn !== 'connecting') disconnect()
  }

  /* ---- 回车 ---- */
  const handleEnter = (line: string) => {
    const cmd = line.trim()
    termWrite(ps1 + escapeHtml(cmd))
    if (!cmd) return
    history.current.push(cmd)
    histIdx.current = history.current.length
    if (conn !== 'fallback') {
      termWrite(`<span class="tm-err">[offline]</span> 未连接 — 点右上角「连接」发起 SSH`)
      return
    }
    const out = fallbackExec(cmd)
    if (out === null) {
      setOutput([]) // `clear`：把正文清空、不追加
      return
    }
    termWrite(out)
  }

  const onKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      handleEnter(input)
      setInput('')
      histIdx.current = history.current.length
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!history.current.length) return
      histIdx.current = Math.max(0, histIdx.current - 1)
      setInput(history.current[histIdx.current] ?? '')
      return
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!history.current.length) return
      histIdx.current = Math.min(history.current.length, histIdx.current + 1)
      setInput(history.current[histIdx.current] ?? '')
      return
    }
    if (event.key === 'l' && event.ctrlKey) {
      event.preventDefault()
      setOutput([])
      return
    }
    if (event.key === 'Tab') {
      event.preventDefault()
      /* 简易补全：唯一候选直接补上，多个候选把列表打出来 */
      const candidates = Object.keys(FALLBACK_CMDS).filter((c) => c.startsWith(input))
      if (candidates.length === 1) setInput(`${candidates[0]} `)
      else if (candidates.length > 1) {
        termWrite(ps1 + escapeHtml(input))
        termWrite(`<span class="tm-mute">${candidates.join('  ')}</span>`)
      }
    }
  }

  /* ---- 四态 → 四处展示 ---- */
  const connText = conn === 'live' ? '真实 shell' : conn === 'fallback' ? '内置回显' : conn === 'connecting' ? '连接中…' : '未连接'
  const paneMeta = conn === 'live' ? 'connected' : conn === 'connecting' ? 'connecting' : 'disconnected'
  const btnText = conn === 'connecting' ? '连接中…' : conn === 'idle' ? '连接' : '断开'
  const sbConn = conn === 'live' ? 'live' : conn === 'fallback' ? 'demo' : 'idle'
  const clockText = `${pad(clock.getHours())}:${pad(clock.getMinutes())}:${pad(clock.getSeconds())}`
  const tmuxTime = `${pad(clock.getHours())}:${pad(clock.getMinutes())}`

  const tabs = useMemo(() => [{ label: 'dev', close: true }, { label: 'monitor', close: true }, { label: '+', close: false }], [])

  return (
    <div className="tm-root" data-theme={theme === 'green' ? undefined : theme}>
      <div className="tm-terminal">
        {/* ---------- 标题栏 ----------
            这一页自己的窗框（见文件头 ①）。同时它是这一页唯一的窗口控制与拖拽区
            （见文件头 ⑥）：三颗圆点是真按钮，整条标题栏是拖拽区。 */}
        <div className="tm-titlebar" {...DRAG_REGION}>
          {/* 红点只接管"关闭"那颗 —— 它回到运维页，不关应用（见 `goBack`）；
              黄点最小化、绿点全屏仍是真实的窗口操作，所以整组仍由 `WindowControls` 出。 */}
          <WindowControls onClose={goBack} closeLabel="关闭这个终端窗口（返回运维页）" />
          <div className="tm-title">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              {ICON_PROMPT}
            </svg>
            <span className="tm-path">~/projects/nebula</span>
            <span className="tm-sep">—</span>
            <span className="tm-file">tmux: 3 panes</span>
          </div>
          <div className="tm-title-actions">
            <button
              type="button"
              className={cn('tm-connect-btn', (conn === 'live' || conn === 'fallback') && 'tm-on')}
              disabled={conn === 'connecting'}
              title="发起 SSH 连接"
              onClick={toggleConnect}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {ICON_PLUG}
              </svg>
              <span>{btnText}</span>
            </button>
            <span className={cn('tm-connection-status', conn === 'live' && 'tm-live', conn === 'fallback' && 'tm-fallback')}>
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

        {/* ---------- 标签页 ---------- */}
        <div className="tm-tabs">
          {tabs.map((tab) => (
            <div
              key={tab.label}
              className={cn('tm-tab', tab.label !== '+' && activeTab === tab.label && 'tm-active')}
              onClick={() => tab.label !== '+' && setActiveTab(tab.label)}
            >
              <span className="tm-dot-ind" />
              <span>{tab.label}</span>
              {tab.close ? <span className="tm-close">×</span> : null}
            </div>
          ))}
        </div>

        {/* ---------- 主体：tmux 分屏 ---------- */}
        <div className="tm-screen">
          <div className="tm-tmux-status">
            <div className="tm-left">
              <span className="tm-tag tm-g">[nebula]</span>
              <span>0:bash*</span>
              <span className="tm-sep">·</span>
              <span>1:htop</span>
              <span className="tm-sep">·</span>
              <span>2:logs</span>
            </div>
            <div className="tm-right">
              <span>{tmuxTime}</span>
              <span className="tm-sep">·</span>
              {/* 原型的日期是写死的，照抄（见文件头 ④） */}
              <span>2026-04-07</span>
            </div>
          </div>

          <div className="tm-panes">
            {/* 左：主终端 */}
            <div className="tm-pane tm-master">
              <div className="tm-pane-header">
                <div className="tm-title">
                  <span className="tm-dot-sm" />
                  bash · ~/projects/nebula
                </div>
                <div className="tm-meta">{paneMeta}</div>
              </div>
              <div className="tm-pane-body" ref={outBodyRef} onClick={() => inputRef.current?.focus()}>
                <div className="tm-term-output" ref={outRef}>
                  {output.map((line, i) => (
                    // 终端输出的 HTML 串见文件头 ②：常量 + escapeHtml 过的用户输入
                    <div key={i} dangerouslySetInnerHTML={{ __html: line }} />
                  ))}
                </div>
                <div className="tm-term-input-line">
                  <span className="tm-prompt">
                    <span className="tm-user">guest</span>
                    <span className="tm-at">@</span>
                    <span className="tm-host">{host || 'nebula'}</span>
                    <span className="tm-path"> ~/projects/nebula</span>
                    <span className="tm-sign">$</span>
                  </span>
                  <input
                    ref={inputRef}
                    className="tm-term-input"
                    type="text"
                    value={input}
                    placeholder="输入命令 (回车执行)"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => setInput(event.target.value)}
                    onKeyDown={onKeyDown}
                  />
                </div>
              </div>
            </div>

            {/* 右：上下分 */}
            <div className="tm-pane tm-side">
              <div className="tm-pane">
                <div className="tm-pane-header">
                  <div className="tm-title">
                    <span className="tm-dot-sm" />
                    htop
                  </div>
                  <div className="tm-meta">{`cpu ${htop.cpu.toFixed(0)}% · mem ${htop.mem.toFixed(0)}%`}</div>
                </div>
                <div className="tm-pane-body">
                  <div className="tm-htop">
                    <HtopPanel data={htop} />
                  </div>
                </div>
              </div>

              <div className="tm-pane">
                <div className="tm-pane-header">
                  <div className="tm-title">
                    <span className="tm-dot-sm" />
                    logs · tail -f
                  </div>
                  <div className="tm-meta">live</div>
                </div>
                <div className="tm-pane-body" ref={logBodyRef}>
                  <div className="tm-term-output">
                    {logs.map((line, i) => (
                      <div key={i} dangerouslySetInnerHTML={{ __html: line }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ---------- 状态栏 ---------- */}
        <div className="tm-statusbar">
          <div className="tm-sb-left">
            <div className="tm-sb-item">
              <span className="tm-led" />
              <span>{sbConn}</span>
            </div>
            <span className="tm-sep-dot" />
            <div className="tm-sb-item">
              <span className="tm-badge tm-g">main</span>
              <span>clean</span>
            </div>
            <span className="tm-sep-dot" />
            <div className="tm-sb-item">
              <span className="tm-badge tm-c">node</span>
              <span>v22.11.0</span>
            </div>
          </div>
          <div className="tm-sb-right">
            <div className="tm-sb-item">
              <span>{`CPU ${stats.cpu.toFixed(0)}%`}</span>
            </div>
            <span className="tm-sep-dot" />
            <div className="tm-sb-item">
              <span>{`MEM ${stats.mem.toFixed(0)}%`}</span>
            </div>
            <span className="tm-sep-dot" />
            <div className="tm-sb-item">
              <span>{clockText}</span>
            </div>
            <span className="tm-sep-dot" />
            <div className="tm-sb-item">
              <span className="tm-badge tm-y">TS</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
