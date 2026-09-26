import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { ServerItem } from '../../../data/derive'
import { cn } from '../../../lib/cn'

/* ============================================================================
   运维 · 添加服务器 —— 项目详情「运维」分区里的整页表单
   原型 `design/work/工作-项目-项目详情-运维-添加服务器.html`（2026-09-26）
   ----------------------------------------------------------------------------
   这一页是**运维分区内部的一个视图**，不是一条路由、也不是弹窗：

     · 原型自己写着「**整页表单，不是弹窗**」—— 字段跨「标识 / 地址 / 登录 / 规格 / 标签」
       五组，弹窗（660px、94vh）放不下第五组；页面形态还能给右侧留出「连接检查」。
       落到应用里，"整页"= 占满运维分区（`OpsPanel` 的那一块），由它的 local state 切换。

     · 原型那张页的**侧栏 / 顶栏 / 面包屑 / 页头 / Tab 行**不搬 —— 那是应用壳 + 项目详情的
       Hero + 分区 Tab，宿主已经提供了；重复搬会得到第二个侧栏。
       样式段（`module-workspace.css` 的「添加服务器」段）也只移植表单那几节，
       作用域 `.as-root`。

   ============================================================================
   与原型**有意不同**的地方（"静态页 → 应用"必然要改的，不是审美）
   ============================================================================
   ① **没有页头那对「返回 / 未保存 / 取消 / 添加服务器」**：它们挂在原型自己的 `.hero-mini`
      上，而应用里那一层是**共享的** Hero（每个分区都在用，还有折叠态）。
      出口统一走底部那条 **sticky 动作行**（原型本来也有它，长表单里动作不能只在顶部）。
   ② **错误文案按触发原因给**：原型那几块 `.field-err` 是**静态示例串**
      （"名称已存在，本项目中已有 prod-web-01"、"本机找不到这个文件"），
      而它真实触发的地方是"必填没填"。这里只有**真的重名**时才用原型那句，
      空值/格式错给对应文案。
   ③ **提交只给"填好了"的回执，不说"已添加"** —— 应用里没有保存接口，
      与运维页其它动作（重启 / 回滚 / 清理）同一条纪律：**没有接口就别说成功**。
      「添加并继续」仍然保留"清空表单继续填下一台"的语义。
   ④ **编辑模式由 `mode` 决定**，不是原型那个 `?host=` 查询参数（应用里入口是服务器行的「编辑」）。
      原型自己写着"同一张表承担添加与编辑，只有标题/按钮/预览标题返回落点/网段提示五处换词"，
      这里就是那五处。
   ⑤ **机器自己会报的事实**（云厂商 / 规格 / 系统 / "私钥已在本机找到"）在网络与文件系统
      都不可知 —— 原型注释本身就说它们"机器自己会报、不进表单"，这里与它一样是**演示值**。

   ============================================================================
   三条容易写错、且错了不会报错的判据
   ============================================================================
   ① **`hidden` 属性别用**：原型靠一条全局 `[hidden]{display:none !important}` 藏
      `.field-err` / `#authPwd` / `#fEscUser` / `.esc-state .ico` / `.check-dot .ico` 等十来处，
      而那条全局规则移植时按惯例丢掉了。⇒ 一律**条件渲染**；
      唯一例外是 `.esc-state .ico` / `.check-dot .ico` 那种"同一个图标按状态显隐"——
      它是**属性/类驱动**的（`.check-item.ok .check-dot .ico-svg { display:block }`），
      所以那两处必须**始终渲染**图标、由 CSS 决定显不显。
   ② **提权区是"三档状态机"而不是三个开关**：`escTarget`（none/root/custom）×
      `escFree()`（登录用户是不是 root）共同决定「密码行显不显」「徽标说什么」
      「检查行说什么」。三处各判一次必然分叉 ⇒ 这里的 `escFree / escNeedPwd / escWillPause`
      是**唯一判据**，连「连接检查」那一行也读它。
   ③ **预览只有一个刷新点**：名称/地址/端口/用户/环境/标签/提权全都会影响「添加后」那张卡，
      所以它们都走同一份派生值，不要在各自的 onChange 里顺手改一处 DOM 式的局部状态。
   ============================================================================ */

/* ------------------------------------------------------------------ *
 * 图标：原型自带一套 **24 网格**的路径（`ICON` 表），这里原样搬过来。
 *
 * ⚠️ 不复用 `IconSprite`（应用公共资产，24 网格但符号集不同）：这一页要的
 *    back / shield / globe / terminal / eyeOff 等在里面找不到对应形状；
 *    也不与日志页那套 16 网格混用 —— 两页各自的网格是各自的。
 * ------------------------------------------------------------------ */
const AS_ICON: Record<string, ReactNode> = {
  back: (
    <>
      <path d="M19 12H5" />
      <path d="m12 19-7-7 7-7" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3l7 3v5.5c0 4.2-2.9 7.6-7 9.5-4.1-1.9-7-5.3-7-9.5V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4l16 16" />
      <path d="M9.9 5.9A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3.1 4M6.4 8.1A16.9 16.9 0 0 0 2.5 12S6 18.5 12 18.5c1.1 0 2.1-.2 3-.6" />
    </>
  ),
  terminal: (
    <>
      <path d="m5 8 4 4-4 4" />
      <path d="M12 16h7" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 8-8" />
      <path d="m16 7 3 3" />
    </>
  ),
  folder: <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  check: <path d="m4 12.5 5 5L20 6.5" />,
  alert: (
    <>
      <path d="M12 4.5 21 20H3z" />
      <path d="M12 10v4M12 17h.01" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v4h-4" />
    </>
  ),
}

/** 24 网格、1.6 描边、`stroke=currentColor`。尺寸走行内属性（原型是 `data-ico-size`）。 */
function AsIcon({ name, size = 16 }: { name: keyof typeof AS_ICON; size?: number }) {
  return (
    <svg
      className="ico-svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {AS_ICON[name]}
    </svg>
  )
}

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

const ENVS = [
  { key: 'prod', name: '生产' },
  { key: 'stage', name: '预发' },
  { key: 'test', name: '测试' },
  { key: 'local', name: '本机' },
] as const
type EnvKey = (typeof ENVS)[number]['key']

/** 标签的初始选项。「＋」新建的会追加在后面（插在「＋」之前 —— 新建入口永远是最后一个）。 */
const BASE_TAGS = ['Web', 'API', '数据库', '缓存', '网关', '监控']

const CHECK_ROWS = [
  { key: 'dns', name: '地址解析' },
  { key: 'port', name: '端口连通' },
  { key: 'auth', name: '认证通过' },
  { key: 'esc', name: '提权通过' },
  { key: 'os', name: '系统识别' },
] as const
type CheckKey = (typeof CHECK_ROWS)[number]['key']
/** 空串 = 没结论（圆点是空的），与 `busy`/`ok`/`fail` 是三件事 */
type CheckMark = '' | 'busy' | 'ok' | 'fail'
type Checks = Record<CheckKey, { mark: CheckMark; value: string }>

type EscTarget = 'none' | 'root' | 'custom'
type AuthMode = 'key' | 'pwd'
type EscMethod = 'su' | 'sudo'

/** 机器自己会报的事实：不进表单，只在「连接检查」与「添加后」预览里现身（见文件头 ⑤） */
export interface ServerHwFacts {
  vendor: string
  spec: string
  os: string
}

interface ToastItem {
  id: number
  msg: string
  warn: boolean
}

/* ------------------------------------------------------------------ *
 * 小件
 * ------------------------------------------------------------------ */

/**
 * 字段标题右侧那枚「?」。气泡挂在**本页根**下的 `.tip-layer`（`position: fixed`）——
 * 贴在卡片里会被祖先的 `overflow` 裁掉（本工作区踩过一次）。
 */
function FieldHelp({
  text,
  onShow,
  onHide,
}: {
  text: string
  onShow: (rect: DOMRect, text: string) => void
  onHide: () => void
}) {
  const show = (el: HTMLElement) => onShow(el.getBoundingClientRect(), text)
  return (
    <button
      type="button"
      className="field-help"
      aria-label={text}
      aria-describedby="asTipLayer"
      onMouseEnter={(event) => show(event.currentTarget)}
      onFocus={(event) => show(event.currentTarget)}
      onMouseLeave={onHide}
      onBlur={onHide}
    >
      ?
    </button>
  )
}

/** 一排单选胶囊（环境 / 提权到）。`role=radiogroup` 的可访问名由外层的 `aria-label` 给。 */
function ChipRadio({
  on,
  onPick,
  children,
  dataEnv,
  dataEsc,
}: {
  on: boolean
  onPick: () => void
  children: ReactNode
  /** ⚠️ `data-env` 不是装饰：`.as-chip.on[data-env="prod"]` 那条样式靠它把生产那一档染成运维绿 */
  dataEnv?: string
  dataEsc?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      data-env={dataEnv}
      data-esc={dataEsc}
      className={cn('as-chip', on && 'on')}
      onClick={onPick}
    >
      <span className="dot" />
      {children}
    </button>
  )
}

/* ------------------------------------------------------------------ *
 * 页面
 * ------------------------------------------------------------------ */

export function AddServerForm({
  mode,
  projectName,
  server,
  siblings,
  hw,
  onCancel,
}: {
  mode: 'add' | 'edit'
  projectName: string
  /** 编辑模式的预填来源；新增时传 null */
  server?: Pick<ServerItem, 'name' | 'ip' | 'cores' | 'memGb' | 'os'> | null
  /** 「同网段已有」要列的那几台。⚠️ 编辑模式请先把"自己"排除掉 */
  siblings: Pick<ServerItem, 'name' | 'ip'>[]
  /** 机器自己会报的那三样（云厂商 / 规格 / 系统）。不给就按项目的形态推 */
  hw?: ServerHwFacts
  /** 「取消」。应用里没有保存接口（见文件头 ③），所以这里只有出口、没有提交接口 */
  onCancel: () => void
}) {
  const editing = mode === 'edit'

  /* ================================================================== *
   * 机器事实（不进表单，只在检查结果与预览里现身 —— 见文件头 ⑤）
   * ================================================================== */
  const facts: ServerHwFacts = useMemo(
    () =>
      hw ??
      (server
        ? { vendor: '阿里云', spec: `${server.cores}C${server.memGb}G`, os: server.os }
        : { vendor: '阿里云', spec: '4C8G', os: 'Ubuntu 22.04 LTS' }),
    [hw, server],
  )

  /* ================================================================== *
   * 表单状态
   *
   * 新增态的初值 = **原型的演示值**（prod-web-03 / 47.100.23.11 / …）：
   * 这一页是静态界面，原型自己就把它们写在标记里，照抄才叫"内容一致"。
   * ================================================================== */
  const [name, setName] = useState(server?.name ?? 'prod-web-03')
  const [host, setHost] = useState(server?.ip ?? '47.100.23.11')
  const [port, setPort] = useState('22')
  const [user, setUser] = useState('deploy')
  const [env, setEnv] = useState<EnvKey>('prod')
  const [note, setNote] = useState('支付网关前置，Nginx + Node 18')

  const [tagPool, setTagPool] = useState<string[]>(BASE_TAGS)
  const [tags, setTags] = useState<string[]>(['Web', 'API'])
  const [addingTag, setAddingTag] = useState(false)
  const [newTag, setNewTag] = useState('')
  /** 「新建标签」两态共用一个位置 ⇒ 提交/取消都要能被重复触发，守卫见 `commitTagAdd` */
  const addingTagRef = useRef(false)

  const [authMode, setAuthMode] = useState<AuthMode>('key')
  const [keyPath, setKeyPath] = useState('/Users/yangliu/.ssh/id_ed25519')
  const [pwd, setPwd] = useState('')
  const [showPwd, setShowPwd] = useState(false)

  const [escTarget, setEscTarget] = useState<EscTarget>('root')
  const [escCustomUser, setEscCustomUser] = useState('')
  const [escMethod, setEscMethod] = useState<EscMethod>('su')
  const [escPwd, setEscPwd] = useState('Pay@2024-root')
  const [showEscPwd, setShowEscPwd] = useState(false)

  /* 连接检查：初值就是"刚检查过一次"的样子（原型标记里五行都是 ok） */
  const [checks, setChecks] = useState<Checks>(() => ({
    dns: { mark: 'ok', value: '47.100.23.11' },
    port: { mark: 'ok', value: ':22 开放' },
    auth: { mark: 'ok', value: 'deploy · ed25519' },
    esc: { mark: 'ok', value: 'su - root · 密码已存' },
    os: { mark: 'ok', value: 'Ubuntu 22.04 LTS · 4C8G' },
  }))
  const [checking, setChecking] = useState(false)

  const [errors, setErrors] = useState<{ name?: string; host?: string; user?: string; cred?: string }>({})
  const [actionErr, setActionErr] = useState<string | null>(null)
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null)

  const toastSeq = useRef(0)
  const tipRef = useRef<HTMLDivElement | null>(null)
  const timers = useRef<number[]>([])
  const nameRef = useRef<HTMLInputElement | null>(null)

  useEffect(
    () => () => {
      timers.current.forEach((t) => window.clearTimeout(t))
    },
    [],
  )

  /* ================================================================== *
   * 提示条与「?」气泡
   * ================================================================== */

  const showToast = useCallback((msg: string, warn = false) => {
    toastSeq.current += 1
    const id = toastSeq.current
    setToasts((prev) => [...prev, { id, msg, warn }])
    const t = window.setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 2400)
    timers.current.push(t)
  }, [])

  /* 气泡的定位要在**渲染之后**量宽，否则拿不到自己的尺寸。
     `useLayoutEffect` 在绘制前跑 ⇒ 不会在 0,0 处闪一帧。 */
  useLayoutEffect(() => {
    const layer = tipRef.current
    if (!tip || !layer) return
    const r = tip.rect
    const w = layer.offsetWidth
    const h = layer.offsetHeight
    const left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12))
    let top = r.bottom + 8
    if (top + h > window.innerHeight - 12) top = r.top - h - 8
    layer.style.left = `${left}px`
    layer.style.top = `${top}px`
  }, [tip])

  /* ================================================================== *
   * 派生值 —— 预览、计数、检查行、网段提示**全读这里**
   * 状态的真相源只有表单那几支，不要在各自的 handler 里顺手改别的表现。
   * ================================================================== */

  const envName = ENVS.find((e) => e.key === env)?.name ?? '生产'
  const isProd = env === 'prod'

  /** 提权到哪个账户（`none` 之外才有名字） */
  const escUser = escTarget === 'none' ? '' : escTarget === 'custom' ? escCustomUser.trim() : 'root'
  /** 登录用户就是 root 时，`su - 任意用户` 与 `sudo` 都免认证 */
  const escFree = user.trim() === 'root'
  const escNeedPwd = escTarget !== 'none' && !escFree
  const escWillPause = escNeedPwd && !escPwd
  const escState = escTarget === 'none' ? 'idle' : escWillPause ? 'warn' : ''
  const escStateText =
    escTarget === 'none' ? '不需要' : escFree ? 'root 登录 · 免认证' : escWillPause ? '执行时会暂停等你输入' : '不会暂停'
  /** 「连接检查」那一行走**同一套判据** —— 否则会出现"徽标说不会停、检查行说过不了" */
  const escCheckText =
    escTarget === 'none'
      ? '不需要'
      : escFree
        ? 'root 登录 · 免认证'
        : `${escMethod} - ${escUser || '—'}${escWillPause ? ' · 待输入' : ' · 密码已存'}`
  const osCheckText = `${facts.os} · ${facts.spec}`
  const suggestCode = escMethod === 'su' ? `sudo -u ${escUser || '<账户>'} -n <命令>` : 'sudo -n <命令>'

  const cred = authMode === 'key' ? keyPath.trim() : pwd.trim()
  const requiredDone = (name.trim() ? 1 : 0) + (host.trim() ? 1 : 0) + (user.trim() ? 1 : 0) + (cred ? 1 : 0)
  const loginKind = authMode === 'key' ? 'ed25519' : '密码'
  const checkTarget = `${user.trim() || 'root'}@${host.trim() || '—'}:${port.trim() || '22'}`
  const checkTargetTitle =
    checkTarget + (escTarget === 'none' ? '' : ` → ${escMethod} - ${escUser || '<账户>'}`)

  const dupServer = useMemo(
    () => siblings.find((s) => s.ip && s.ip === host.trim()) ?? null,
    [siblings, host],
  )
  /** 网段从已有地址推（本项目有几台是**脱敏地址**，推不出来就不说网段） */
  const subnet = useMemo(() => {
    const first = siblings[0]?.ip ?? ''
    const m = first.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)
    return m ? `${m[1]}.${m[2]}.${m[3]}.0/24` : ''
  }, [siblings])

  /** 跑一次检查要用的五个值（初始态与「重新检查」共用同一份，不各写一遍） */
  const checkValues = useMemo<Record<CheckKey, string>>(
    () => ({
      dns: host.trim() || '—',
      port: `:${port.trim() || '22'} 开放`,
      auth: `${user.trim() || 'root'} · ${loginKind}`,
      esc: escCheckText,
      os: osCheckText,
    }),
    [host, port, user, loginKind, escCheckText, osCheckText],
  )

  const resetChecks = useCallback(() => {
    setChecks({
      dns: { mark: '', value: '—' },
      port: { mark: '', value: '—' },
      auth: { mark: '', value: '—' },
      esc: { mark: '', value: '—' },
      os: { mark: '', value: '—' },
    })
  }, [])

  /* ================================================================== *
   * 动作
   * ================================================================== */

  const runCheck = () => {
    if (checking) return
    setChecking(true)
    resetChecks()
    let i = 0
    const next = () => {
      if (i > 0) {
        const doneKey = CHECK_ROWS[i - 1].key
        setChecks((prev) => ({ ...prev, [doneKey]: { mark: 'ok', value: checkValues[doneKey] } }))
      }
      if (i >= CHECK_ROWS.length) {
        setChecking(false)
        showToast('连接检查通过 · 用时 0.8s')
        return
      }
      const key = CHECK_ROWS[i].key
      setChecks((prev) => ({ ...prev, [key]: { mark: 'busy', value: '检查中' } }))
      i += 1
      const t = window.setTimeout(next, 420)
      timers.current.push(t)
    }
    next()
  }

  /** 只给建议写法让他照抄，不代改命令 —— 命令是他亲手写的 */
  const copySuggest = () => {
    navigator.clipboard?.writeText(suggestCode).catch(() => {
      /* file:// 下没有剪贴板权限，reject 不处理会在控制台留一条 error */
    })
    showToast(`已复制：${suggestCode}`)
  }

  const clearError = (key: 'name' | 'host' | 'user' | 'cred') =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev))

  const toggleTag = (tag: string) => {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  /**
   * 新建标签：撞名就复用已有那枚并选中它 —— 自由文本不加这道闸，
   * 立刻会长出「Nginx / nginx / NGINX」三个标签。空名 = 取消。
   *
   * ⚠️ 守卫用 ref 而不是 `addingTag`：回车提交之后输入框会被卸载，
   *    浏览器/React 可能再补一次 blur —— 那个 `commitTagAdd` 读到的是**旧闭包**里的
   *    `addingTag === true`，于是同一个标签被建两遍（原型那边靠 `!tagInp.hidden` 挡）。
   */
  const commitTagAdd = () => {
    if (!addingTagRef.current) return
    addingTagRef.current = false
    const made = newTag.trim()
    setAddingTag(false)
    setNewTag('')
    if (!made) return
    if (tagPool.includes(made)) {
      if (!tags.includes(made)) setTags((prev) => [...prev, made])
      showToast(`已选中已有的「${made}」`)
      return
    }
    setTagPool((prev) => (prev.includes(made) ? prev : [...prev, made]))
    setTags((prev) => (prev.includes(made) ? prev : [...prev, made]))
    showToast(`已新增并选中「${made}」`)
  }

  const submit = (again: boolean) => {
    const next: typeof errors = {}
    const dupName = siblings.find((s) => s.name === name.trim())
    if (!name.trim()) next.name = '请填写服务器名称'
    else if (dupName) next.name = `名称已存在，本项目中已有 ${dupName.name}`
    if (!host.trim()) next.host = '请填写主机地址'
    else if (!/^[A-Za-z0-9][A-Za-z0-9.-]*(:\d+)?$/.test(host.trim()) || /^\.|\.$/.test(host.trim()))
      next.host = '地址格式不正确'
    if (!user.trim()) next.user = '请填写登录用户'
    if (authMode === 'key') {
      if (!keyPath.trim()) next.cred = '请填写私钥路径'
    } else if (!pwd.trim()) next.cred = '密码不能为空'

    const bad = Object.entries(next).filter(([, v]) => v)
    setErrors(next)
    if (bad.length) {
      setActionErr(`还有 ${bad.length} 项必填未填`)
      showToast(`还有 ${bad.length} 项必填未填`, true)
      nameRef.current?.focus()
      return
    }
    setActionErr(null)

    /* 应用里没有保存接口 ⇒ 只给"填好了"的回执（见文件头 ③） */
    const who = name.trim()
    if (again) {
      showToast(`已填好「${who}」· 继续添加下一台（还没有写保存接口）`, true)
      setName('')
      setHost('')
      setNote('')
      resetChecks()
      nameRef.current?.focus()
      return
    }
    showToast(`已填好「${who}」· ${envName}组（还没有写保存接口）`, true)
    if (editing) {
      /* 编辑是一趟有去有回的流程，改完回列表，不用手动找返回 */
      const t = window.setTimeout(onCancel, 900)
      timers.current.push(t)
    }
  }

  return (
    <div className="as-root">
      <div className="form-layout">
        {/* ============ 主列：一张表，四张卡 ============ */}
        <div className="form-col">
          <section className="as-panel" aria-labelledby="asFormTitle">
            <div className="panel-head">
              <span className="head-ico" aria-hidden="true">
                <AsIcon name="server" size={15} />
              </span>
              <h2 className="panel-title" id="asFormTitle">
                服务器信息
              </h2>
              <div className="panel-head-right">
                <span className="fgroup-count">{`必填 ${requiredDone} / 4`}</span>
              </div>
            </div>

            <div className="form-body">
              {/* ===== 卡① 标识 ===== */}
              <div className="fgroup">
                <div className="fgroup-head">
                  <span className="fgroup-no" aria-hidden="true">
                    1
                  </span>
                  <label className="fgroup-title" htmlFor="asName">
                    服务器标识
                  </label>
                  <span className="field-req">必填</span>
                  <FieldHelp
                    text="建议写成「环境-角色-序号」，例如 prod-web-03。名称在项目内唯一，会作为服务器列表里的主标签。"
                    onShow={(rect, text) => setTip({ rect, text })}
                    onHide={() => setTip(null)}
                  />
                  <span className="fgroup-count">唯一</span>
                </div>

                <div className="field-label">
                  <label htmlFor="asName">名称</label>
                </div>
                <input
                  id="asName"
                  ref={nameRef}
                  className="inp mono"
                  type="text"
                  value={name}
                  placeholder="prod-web-03"
                  autoComplete="off"
                  aria-invalid={errors.name ? 'true' : undefined}
                  aria-describedby={errors.name ? 'asErrName' : undefined}
                  onChange={(event) => {
                    setName(event.target.value)
                    clearError('name')
                  }}
                />
                {errors.name ? (
                  <div className="field-err" id="asErrName">
                    <AsIcon name="alert" size={12} />
                    {errors.name}
                  </div>
                ) : null}

                <div style={{ marginTop: 12 }}>
                  <div className="field-label">环境</div>
                  <div className="as-chip-row" role="radiogroup" aria-label="环境">
                    {ENVS.map((item) => (
                      <ChipRadio key={item.key} on={env === item.key} dataEnv={item.key} onPick={() => setEnv(item.key)}>
                        {item.name}
                      </ChipRadio>
                    ))}
                  </div>
                </div>
              </div>

              {/* ===== 卡② 地址 ===== */}
              <div className="fgroup">
                <div className="fgroup-head">
                  <span className="fgroup-no" aria-hidden="true">
                    2
                  </span>
                  <label className="fgroup-title" htmlFor="asHost">
                    连接地址
                  </label>
                  <span className="field-req">必填</span>
                  <FieldHelp
                    text="填公网 IPv4 或内网域名都可以。填写后会实时比对本项目已有服务器的网段，避免把同一台机器加两遍。"
                    onShow={(rect, text) => setTip({ rect, text })}
                    onHide={() => setTip(null)}
                  />
                </div>

                <div className="frow">
                  <div>
                    <div className="field-label">
                      <label htmlFor="asHost">主机地址</label>
                    </div>
                    <input
                      id="asHost"
                      className="inp mono"
                      type="text"
                      value={host}
                      placeholder="47.100.23.11 或 web-03.internal"
                      autoComplete="off"
                      aria-invalid={errors.host ? 'true' : undefined}
                      aria-describedby={errors.host ? 'asErrHost' : undefined}
                      onChange={(event) => {
                        setHost(event.target.value)
                        clearError('host')
                        /* 地址一变，既有检查结论就作废 —— 否则会出现"改了 IP 但五行还是绿的" */
                        resetChecks()
                      }}
                    />
                  </div>
                  <div>
                    <div className="field-label">
                      <label htmlFor="asPort">SSH 端口</label>
                    </div>
                    <input
                      id="asPort"
                      className="inp mono"
                      type="text"
                      inputMode="numeric"
                      value={port}
                      placeholder="22"
                      autoComplete="off"
                      onChange={(event) => {
                        setPort(event.target.value)
                        resetChecks()
                      }}
                    />
                  </div>
                </div>
                {errors.host ? (
                  <div className="field-err" id="asErrHost">
                    <AsIcon name="alert" size={12} />
                    {errors.host}
                  </div>
                ) : null}
              </div>

              {/* ===== 卡③ 登录 + 提权 ===== */}
              <div className="fgroup">
                <div className="fgroup-head">
                  <span className="fgroup-no" aria-hidden="true">
                    3
                  </span>
                  <span className="fgroup-title" id="asLoginTitle">
                    登录方式
                  </span>
                  <span className="field-req">必填</span>
                  <FieldHelp
                    text="凭据只保存在本机钥匙串 / 目录，不写进项目配置、不同步到其它设备。部署与日志页会用这里的身份去连。"
                    onShow={(rect, text) => setTip({ rect, text })}
                    onHide={() => setTip(null)}
                  />
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
                  <div className="as-seg" role="radiogroup" aria-labelledby="asLoginTitle">
                    <button
                      type="button"
                      role="radio"
                      aria-checked={authMode === 'key'}
                      className={cn('as-seg-item', authMode === 'key' && 'on')}
                      onClick={() => {
                        setAuthMode('key')
                        clearError('cred')
                        resetChecks()
                      }}
                    >
                      <span className="as-seg-dot" />
                      密钥文件
                    </button>
                    <button
                      type="button"
                      role="radio"
                      aria-checked={authMode === 'pwd'}
                      className={cn('as-seg-item', authMode === 'pwd' && 'on')}
                      onClick={() => {
                        setAuthMode('pwd')
                        clearError('cred')
                        resetChecks()
                      }}
                    >
                      <span className="as-seg-dot" />
                      密码
                    </button>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '1 1 190px' }}>
                    <div className="field-label" style={{ margin: 0 }}>
                      <label htmlFor="asUser">登录用户</label>
                    </div>
                    <input
                      id="asUser"
                      className="inp mono"
                      style={{ width: 120 }}
                      type="text"
                      value={user}
                      placeholder="deploy"
                      autoComplete="off"
                      aria-invalid={errors.user ? 'true' : undefined}
                      onChange={(event) => {
                        setUser(event.target.value)
                        clearError('user')
                        /* 登录用户决定"提权是否免认证" ⇒ 改它要连提权区与检查结论一起重算 */
                        resetChecks()
                      }}
                    />
                  </div>
                </div>

                {authMode === 'key' ? (
                  <div style={{ marginTop: 12 }}>
                    <div className="field-label">
                      <label htmlFor="asKeyPath">私钥路径</label>
                    </div>
                    <div className="inp-wrap">
                      <input
                        id="asKeyPath"
                        className="inp mono"
                        type="text"
                        value={keyPath}
                        placeholder="~/.ssh/id_ed25519"
                        autoComplete="off"
                        aria-invalid={errors.cred ? 'true' : undefined}
                        onChange={(event) => {
                          setKeyPath(event.target.value)
                          clearError('cred')
                        }}
                      />
                      {/* 「选择文件」要的是一个本机文件选择器 —— 应用里还没有它（见文件头 ③ 的同一口径） */}
                      <button
                        type="button"
                        className="field-act"
                        onClick={() => showToast('打开本机文件选择器：还没有写接口', true)}
                      >
                        <AsIcon name="file" size={13} />
                        选择文件
                      </button>
                    </div>
                    {/* ⚠️ 这一行说的是"本机有没有这个文件"，浏览器里**不可知** —— 与原型同一份演示值（见文件头 ⑤） */}
                    <div className="field-note">ed25519 · 已在本机找到 · 未设密码短语</div>
                    {errors.cred ? (
                      <div className="field-err">
                        <AsIcon name="alert" size={12} />
                        {errors.cred}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div style={{ marginTop: 12 }}>
                    <div className="field-label">
                      <label htmlFor="asPwd">密码</label>
                    </div>
                    <div className="inp-wrap">
                      <input
                        id="asPwd"
                        className="inp mono"
                        type={showPwd ? 'text' : 'password'}
                        value={pwd}
                        placeholder="登录密码"
                        autoComplete="new-password"
                        aria-invalid={errors.cred ? 'true' : undefined}
                        onChange={(event) => {
                          setPwd(event.target.value)
                          clearError('cred')
                        }}
                      />
                      <button type="button" className="field-act" onClick={() => setShowPwd((v) => !v)}>
                        <AsIcon name={showPwd ? 'eyeOff' : 'eye'} size={13} />
                        {showPwd ? '隐藏' : '显示'}
                      </button>
                    </div>
                    <div className="field-note">密码存在本机钥匙串，不进配置文件</div>
                    {errors.cred ? (
                      <div className="field-err">
                        <AsIcon name="alert" size={12} />
                        {errors.cred}
                      </div>
                    ) : null}
                  </div>
                )}

                {/* ---------- 登录后提权 ----------
                    su - 认证的是「目标账户」，所以要的是目标账户的密码（不是登录用户的）。
                    root 登录时 `su - 任意用户` 与 `sudo` 都免认证 —— 这条只作用于提权。 */}
                <div className="esc-block">
                  <div className="esc-head">
                    <span className="esc-title" id="asEscTitle">
                      登录后提权
                    </span>
                    <FieldHelp
                      text="su - 认证的是目标账户，所以要填下面那个账户的密码，不是上面登录用户的密码。su - 没有免密等价物，同一次执行里每碰到一次都会重新问；sudo 的凭据在同一次执行内复用 15 分钟。登录用户是 root 时，su - 与 sudo 都免认证。"
                      onShow={(rect, text) => setTip({ rect, text })}
                      onHide={() => setTip(null)}
                    />
                    {/* ⚠️ 图标**始终渲染**，由 `.esc-state.warn .ico-svg` 决定显不显（见文件头 ①） */}
                    <span className={cn('esc-state', escState)}>
                      <AsIcon name="alert" size={11} />
                      <span>{escStateText}</span>
                    </span>
                  </div>

                  <div className="esc-row">
                    <span className="esc-k">提权到</span>
                    <div className="as-chip-row" role="radiogroup" aria-labelledby="asEscTitle">
                      <ChipRadio
                        on={escTarget === 'none'}
                        dataEsc="none"
                        onPick={() => {
                          setEscTarget('none')
                          resetChecks()
                        }}
                      >
                        不需要
                      </ChipRadio>
                      <ChipRadio
                        on={escTarget === 'root'}
                        dataEsc="root"
                        onPick={() => {
                          setEscTarget('root')
                          resetChecks()
                        }}
                      >
                        root
                      </ChipRadio>
                      <ChipRadio
                        on={escTarget === 'custom'}
                        dataEsc="custom"
                        onPick={() => {
                          setEscTarget('custom')
                          resetChecks()
                        }}
                      >
                        其他账户
                      </ChipRadio>
                    </div>
                    {escTarget === 'custom' ? (
                      <input
                        className="inp mono"
                        style={{ width: 132 }}
                        type="text"
                        value={escCustomUser}
                        placeholder="账户名"
                        autoComplete="off"
                        aria-label="提权到的账户名"
                        onChange={(event) => {
                          setEscCustomUser(event.target.value)
                          resetChecks()
                        }}
                      />
                    ) : null}
                  </div>

                  {escTarget === 'none' ? null : (
                    <div className="esc-row">
                      <span className="esc-k">方式</span>
                      <div className="as-seg" role="radiogroup" aria-label="提权方式">
                        {(['su', 'sudo'] as EscMethod[]).map((m) => (
                          <button
                            key={m}
                            type="button"
                            role="radio"
                            aria-checked={escMethod === m}
                            className={cn('as-seg-item', escMethod === m && 'on')}
                            onClick={() => {
                              setEscMethod(m)
                              resetChecks()
                            }}
                          >
                            <span className="as-seg-dot" />
                            {m === 'su' ? 'su -' : 'sudo'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {escNeedPwd ? (
                    <div className="esc-row">
                      <span className="esc-k">{`${escUser || '目标账户'} 密码`}</span>
                      <div className="inp-wrap">
                        <input
                          className="inp mono"
                          type={showEscPwd ? 'text' : 'password'}
                          value={escPwd}
                          autoComplete="new-password"
                          aria-label={`${escUser || '目标账户'} 密码`}
                          onChange={(event) => {
                            setEscPwd(event.target.value)
                            /* 密码由有到无 ⇒ 徽标退回"待输入"，既有检查结论作废 */
                            if (!event.target.value.trim()) resetChecks()
                          }}
                        />
                        <button type="button" className="field-act" onClick={() => setShowEscPwd((v) => !v)}>
                          <AsIcon name={showEscPwd ? 'eyeOff' : 'eye'} size={13} />
                          {showEscPwd ? '隐藏' : '显示'}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {escTarget === 'none' ? null : (
                    <div className="esc-suggest">
                      <AsIcon name="terminal" size={12} />
                      <span>免密等价物</span>
                      <code>{suggestCode}</code>
                      <button type="button" className="field-act" onClick={copySuggest}>
                        <AsIcon name="file" size={12} />
                        复制
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* ===== 卡④ 标签与备注 ===== */}
              <div className="fgroup">
                <div className="fgroup-head">
                  <span className="fgroup-no" aria-hidden="true">
                    4
                  </span>
                  <span className="fgroup-title" id="asTagTitle">
                    标签与备注
                  </span>
                  <FieldHelp
                    text="标签会当成服务器列表里的分组名，后续按标签筛选与批量部署都靠它。可以多选。"
                    onShow={(rect, text) => setTip({ rect, text })}
                    onHide={() => setTip(null)}
                  />
                  <span className="fgroup-count">{`已选 ${tags.length}`}</span>
                </div>

                <div className="as-chip-row" role="group" aria-labelledby="asTagTitle">
                  {tagPool.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={tags.includes(tag)}
                      className={cn('as-chip', 'as-chip-check', tags.includes(tag) && 'on')}
                      onClick={() => toggleTag(tag)}
                    >
                      {/* ⚠️ 勾选框**始终渲染**，由 `.as-chip-check.on .box svg` 决定显不显 */}
                      <span className="box">
                        <AsIcon name="check" size={9} />
                      </span>
                      {tag}
                    </button>
                  ))}
                  {addingTag ? (
                    <input
                      className="group-add-input"
                      type="text"
                      maxLength={12}
                      placeholder="标签名"
                      autoComplete="off"
                      aria-label="新建标签名"
                      autoFocus
                      value={newTag}
                      onChange={(event) => setNewTag(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitTagAdd()
                        } else if (event.key === 'Escape') {
                          /* Esc 只该收起这一格 —— 不挡住冒泡的话，看到它的人会以为整页要退出 */
                          event.preventDefault()
                          event.stopPropagation()
                          addingTagRef.current = false
                          setAddingTag(false)
                          setNewTag('')
                        }
                      }}
                      onBlur={commitTagAdd}
                    />
                  ) : (
                    /* 新建入口是这一行的兜底位，永远排最后 */
                    <button
                      type="button"
                      className="group-add"
                      aria-label="新建标签"
                      title="新建标签"
                      onClick={() => {
                        addingTagRef.current = true
                        setAddingTag(true)
                        setNewTag('')
                      }}
                    >
                      <AsIcon name="plus" size={12} />
                    </button>
                  )}
                </div>

                <div style={{ marginTop: 12 }}>
                  <div className="field-label">
                    <label htmlFor="asNote">备注</label>
                  </div>
                  <textarea
                    id="asNote"
                    className="inp"
                    placeholder="这台机器是干什么的"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ===== 底部动作行（sticky：长表单里动作不能只在顶部） ===== */}
          <div className="as-form-actions">
            {actionErr ? (
              <div className="actions-err">
                <AsIcon name="alert" size={13} />
                <span>{actionErr}</span>
              </div>
            ) : null}
            <button type="button" className="btn btn-quiet btn-sm" onClick={onCancel}>
              取消
            </button>
            {editing ? null : (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => submit(true)}>
                添加并继续
              </button>
            )}
            <button type="button" className="btn btn-primary" onClick={() => submit(false)}>
              <AsIcon name="plus" size={15} />
              {editing ? '保存修改' : '添加服务器'}
            </button>
          </div>
        </div>

        {/* ============ 侧轨：连接检查 + 添加后 + 同网段已有 ============ */}
        <div className="side-col">
          <section className="as-panel" aria-labelledby="asCheckTitle">
            <div className="panel-head">
              <span className="head-ico" aria-hidden="true">
                <AsIcon name="shield" size={15} />
              </span>
              <h2 className="panel-title" id="asCheckTitle">
                连接检查
              </h2>
            </div>
            <div className="check-list">
              {CHECK_ROWS.map((row) => (
                <div key={row.key} className={cn('check-item', checks[row.key].mark)}>
                  <span className="check-dot" aria-hidden="true">
                    <AsIcon name="check" size={11} />
                  </span>
                  <span className="check-name">{row.name}</span>
                  <span className="check-val">
                    {row.key === 'esc' ? escCheckText : row.key === 'os' ? osCheckText : checks[row.key].value}
                  </span>
                </div>
              ))}
            </div>
            <div className="check-foot">
              <span className="check-target" title={checkTargetTitle}>
                <AsIcon name="terminal" size={12} />
                {checkTarget}
              </span>
              <button type="button" className="btn btn-ghost btn-sm" disabled={checking} onClick={runCheck}>
                <AsIcon name="refresh" size={13} />
                {checking ? '检查中' : '重新检查'}
              </button>
            </div>
          </section>

          <section className="as-panel" aria-labelledby="asPvTitle">
            <div className="panel-head">
              <span className="head-ico" aria-hidden="true">
                <AsIcon name="eye" size={15} />
              </span>
              <h2 className="panel-title" id="asPvTitle">
                {editing ? '保存后' : '添加后'}
              </h2>
            </div>
            <div className="preview-box">
              <div className="srv-row">
                {/* 机架色条跟着环境走：生产用运维绿，其余留中性灰 —— 颜色只说"这是哪一种" */}
                <span
                  className="srv-rack"
                  aria-hidden="true"
                  style={{ background: isProd ? 'var(--rc)' : 'var(--border-field)' }}
                />
                <div style={{ minWidth: 0 }}>
                  <div className="srv-name">
                    <span className="name-txt">{name.trim() || '（未命名）'}</span>
                    <span className="as-badge idle">待接入</span>
                    <span className="as-badge env">{envName}</span>
                  </div>
                  <div className="srv-meta">
                    <span>{host.trim() || '（未填地址）'}</span>
                    <span className="sep">·</span>
                    <span>{facts.vendor}</span>
                    <span className="sep">·</span>
                    <span>{facts.spec}</span>
                    <span className="sep">·</span>
                    <span>{facts.os}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="sub-list">
              <div className="sub-item">
                <AsIcon name="key" size={13} />
                <span className="sub-name">{user.trim() || 'root'}</span>
                <span className="sub-ip">{escTarget === 'none' ? '不提权' : `${escMethod} - ${escUser || '—'}`}</span>
              </div>
              <div className="sub-item">
                <AsIcon name="folder" size={13} />
                <span className="sub-name">{projectName}</span>
                <span className="sub-ip">{tags.length ? tags.join(' · ') : '未打标签'}</span>
              </div>
            </div>
          </section>

          <section className="as-panel" aria-labelledby="asNetTitle">
            <div className="panel-head">
              <span className="head-ico" aria-hidden="true">
                <AsIcon name="globe" size={15} />
              </span>
              <h2 className="panel-title" id="asNetTitle">
                同网段已有
              </h2>
              <div className="panel-head-right">
                <span className="fgroup-count">{`${siblings.length} 台`}</span>
              </div>
            </div>
            <div className="sub-list" style={{ paddingTop: 10 }}>
              {siblings.map((item) => (
                <div key={item.name} className="sub-item">
                  <AsIcon name="server" size={13} />
                  <span className="sub-name">{item.name}</span>
                  <span className="sub-ip">{item.ip}</span>
                </div>
              ))}
            </div>
            <div className={cn('panel-note', !dupServer && 'info')}>
              <AsIcon name="alert" size={13} />
              <span>
                {dupServer
                  ? `${host.trim()} 已是 ${dupServer.name} 的地址，继续添加会在列表里出现两台同地址的服务器。`
                  : subnet
                    ? `${subnet} 网段内已有 ${siblings.length} 台服务器，添加后可以和它一起批量部署。`
                    : `本项目内已有 ${siblings.length} 台服务器，添加后可以和它们一起批量部署。`}
              </span>
            </div>
          </section>
        </div>
      </div>

      {/* 「?」气泡：`position: fixed` 的共享层 —— 贴在卡片里会被祖先的 overflow 裁掉 */}
      <div className="tip-layer" id="asTipLayer" role="tooltip" ref={tipRef}>
        {tip?.text ?? ''}
      </div>

      <div className="as-toast-wrap">
        {toasts.map((item) => (
          <div key={item.id} className={cn('as-toast', item.warn && 'warn')}>
            <AsIcon name={item.warn ? 'alert' : 'check'} size={14} />
            <span>{item.msg}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
