import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEMO_ACCOUNT } from '../api/projects'
import { BrandMark } from '../components/ui/BrandMark'
import { Icon } from '../components/icons/Icon'
import { WindowControls } from '../components/layout/WindowControls'
import { useDocumentTitle } from '../hooks/use-document-title'
import { DRAG_REGION, PLATFORM } from '../lib/desktop-window'
import { cn } from '../lib/cn'
import { useAuthStore } from '../stores/auth-store'
import { toast } from '../stores/toast-store'

/** 品牌面板底部的三条卖点（「本地优先存储」用的是三层叠层图标，与导航里的 i-layers 不同形） */
const BRAND_FOOT = [
  { icon: 'i-layers-3', label: '本地优先存储' },
  { icon: 'i-git', label: 'Git 跨设备同步' },
  { icon: 'i-lock', label: '端到端加密' },
] as const

/** 六个顶层模块（与 docs/模块设计.md 一致） */
const DOMAINS = [
  { key: '生活', tone: '#34d3a6', ring: 'rgba(52,211,166,.18)' },
  { key: '工作', tone: '#6f9dff', ring: 'rgba(111,157,255,.18)' },
  { key: '学习', tone: '#b18cff', ring: 'rgba(177,140,255,.18)' },
  { key: '项目', tone: '#b18cff', ring: 'rgba(177,140,255,.18)' },
  { key: '知识库', tone: '#b18cff', ring: 'rgba(177,140,255,.18)' },
  { key: '设置', tone: '#34d3a6', ring: 'rgba(52,211,166,.18)' },
]

export function LoginPage() {
  useDocumentTitle('登录 · Lucky-Y')

  // 窗口控制的位置按平台分侧：macOS 圆点靠左，Windows / Linux 靠右
  const isMac = PLATFORM === 'macos'

  const navigate = useNavigate()
  const signIn = useAuthStore((state) => state.signIn)
  const signInWithGithub = useAuthStore((state) => state.signInWithGithub)
  const pending = useAuthStore((state) => state.pending)

  const [email, setEmail] = useState(DEMO_ACCOUNT.email)
  const [password, setPassword] = useState(DEMO_ACCOUNT.password)
  const [remember, setRemember] = useState(true)
  const [passwordVisible, setPasswordVisible] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    await signIn({ email, password, remember })
    navigate('/projects', { replace: true })
  }

  const handleGithub = async () => {
    if (pending) return
    toast('正在跳转项目管理…')
    await signInWithGithub()
    navigate('/projects', { replace: true })
  }

  return (
    <div className="relative grid h-full grid-cols-[minmax(0,1.06fr)_minmax(0,1fr)] overflow-y-auto max-[1080px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] max-[880px]:grid-cols-1">
      {/* ==================== 桌面端：登录页没有顶栏，窗口控制与拖拽区要单独铺 ====================
          原生标题栏已关（tauri.conf.json 的 decorations:false），而本页不渲染 AppShell/Topbar，
          所以这里是"关不掉、也推不动"的唯一漏洞位置。
          做法：一条透明的顶部覆盖层承载拖拽 + 窗口控制，位置按平台对齐 ——
          macOS 圆点靠左（原生在窗口左上角），Windows / Linux 靠右并贴齐窗口边。
          它只占 60px 高，右侧的表单卡从 y≈100 才开始，左侧品牌面板在该带内没有可交互元素，
          因此不会挡住任何点击。 */}
      <div
        {...DRAG_REGION}
        className={cn(
          'absolute inset-x-0 top-0 z-30 flex h-[60px] items-center',
          isMac ? 'justify-start pl-4' : 'justify-end pr-0',
        )}
      >
        <WindowControls />
      </div>

      {/* ==================== 左：品牌面板 ====================
          整块也是拖拽区：登录页的左半幅没有可交互元素（六域标签是纯装饰的 div），
          所以用户可以像拖启动画面一样直接拖这里。 */}
      <aside
        {...DRAG_REGION}
        className="brand-panel brand-panel__grid shell-frame-left relative flex flex-col justify-between overflow-hidden px-12 pb-[92px] pt-12 text-white max-[1080px]:p-8 max-[880px]:hidden"
      >
        <div className="relative z-[1] flex items-center gap-3">
          <BrandMark className="h-[38px] w-[38px] rounded-[11px]" />
          <div>
            <div className="text-19 font-bold leading-[1.2] tracking-[.01em]">Lucky-Y</div>
            <div className="mt-0.5 text-12 font-medium uppercase leading-[1.2] tracking-[.14em] text-white/50">
              Personal OS
            </div>
          </div>
        </div>

        <div className="relative z-[1] my-auto max-w-[520px] py-10">
          <h2 className="mb-5 bg-[linear-gradient(120deg,#fff_30%,rgba(255,255,255,.68)_100%)] bg-clip-text text-[clamp(28px,2.7vw,40px)] font-bold leading-[1.32] tracking-[-0.01em] text-transparent [-webkit-background-clip:text] [-webkit-text-fill-color:transparent]">
            把生活、工作、学习
            <br />
            装进同一个系统
          </h2>
          <p className="m-0 max-w-[440px] text-15 leading-[1.85] text-white/[.62]">
            三域独立、执行统一。项目是唯一的执行层，用 scope 隔离归属；Markdown 为源、SQLite 为索引、Git
            为同步 —— 数据永远在你自己手里。
          </p>

          <div className="mt-10 grid max-w-[480px] grid-cols-3 gap-3 max-[1080px]:grid-cols-2">
            {DOMAINS.map((domain) => (
              <div
                key={domain.key}
                className="flex items-center gap-2 rounded-md border border-white/[.09] bg-white/[.055] px-3 py-[11px] text-13 font-medium text-white/[.86] backdrop-blur-[6px]"
              >
                <span
                  className="h-[7px] w-[7px] shrink-0 rounded-full"
                  style={{ background: domain.tone, boxShadow: `0 0 0 3px ${domain.ring}` }}
                />
                {domain.key}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-[1] flex flex-wrap items-center gap-4 border-t border-white/[.09] pt-5 text-12-5 text-white/[.55]">
          {BRAND_FOOT.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1.5">
              <Icon name={item.icon} className="h-[13px] w-[13px] opacity-70" />
              {item.label}
            </span>
          ))}
        </div>
      </aside>

      {/* ==================== 右：登录表单 ====================
          玻璃拟态下这里不再铺一块白色实底 —— 让极光从表单背后透过来，
          表单本身装在一片大玻璃里，与左侧深色玻璃面板形成一深一浅的对位。 */}
      <main className="shell-frame-right shell-frame-left-sm relative flex items-center justify-center px-8 py-12 max-[880px]:items-start max-[880px]:px-5 max-[880px]:py-8">
        <div className="glass-panel w-full max-w-[452px] rounded-2xl border border-line bg-surface p-8 shadow-xl max-[880px]:rounded-xl max-[880px]:p-6">
          <div className="w-full">
          {/* 移动端才显示的紧凑品牌头 */}
          <div className="mb-8 hidden animate-fade-up-lg items-center gap-2.5 [animation-delay:.02s] max-[880px]:flex">
            <BrandMark className="h-8 w-8 rounded-[9px]" />
            <b className="text-16 font-bold">Lucky-Y</b>
          </div>

          <div className="mb-8 animate-fade-up-lg [animation-delay:.07s]">
            <h1 className="mb-2 text-26 font-bold leading-[1.35] tracking-[-0.01em] text-ink-900">欢迎回来</h1>
            <p className="m-0 text-14 leading-[1.7] text-ink-500">
              登录后进入项目管理，统一查看生活、工作、学习三个域的执行进度。
            </p>
          </div>

          <button
            type="button"
            onClick={handleGithub}
            disabled={pending}
            className="glass-soft flex h-[46px] w-full animate-fade-up-lg items-center justify-center gap-3 rounded-md border border-line-strong bg-surface text-14-5 font-semibold text-ink-800 transition-all duration-150 ease-out [animation-delay:.12s] hover:bg-surface-raised active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Icon name="i-github" className="h-[18px] w-[18px]" />
            使用 GitHub 登录
          </button>

          <div className="my-6 flex animate-fade-up-lg items-center gap-4 text-12-5 text-ink-400 [animation-delay:.17s]">
            <span className="h-px flex-1 bg-line" />
            或使用邮箱登录
            <span className="h-px flex-1 bg-line" />
          </div>

          <form noValidate onSubmit={handleSubmit} className="animate-fade-up-lg [animation-delay:.22s]">
            <div className="mb-4">
              <div className="mb-[7px] flex items-center justify-between">
                <label htmlFor="email" className="text-13-5 font-semibold text-ink-700">
                  邮箱地址
                </label>
              </div>
              <div className="group relative flex items-center">
                <Icon
                  name="i-mail"
                  className="pointer-events-none absolute left-[13px] h-[17px] w-[17px] text-ink-400 transition-colors duration-150 group-focus-within:text-brand-500"
                />
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="glass-soft h-[46px] w-full rounded-md border border-line-strong bg-ink-50 pl-10 pr-3.5 text-14-5 text-ink-900 outline-none transition-all duration-150 ease-out placeholder:text-ink-500 hover:bg-surface-sunken focus:border-brand-500 focus:bg-surface focus:shadow-[0_0_0_3.5px_rgba(79,70,229,.13)]"
                />
              </div>
            </div>

            <div className="mb-4">
              <div className="mb-[7px] flex items-center justify-between">
                <label htmlFor="password" className="text-13-5 font-semibold text-ink-700">
                  密码
                </label>
                <button
                  type="button"
                  className="text-13 font-medium text-brand-600 hover:text-brand-700 hover:underline hover:underline-offset-[3px]"
                  onClick={() => toast('原型演示：忘记密码流程未包含')}
                >
                  忘记密码？
                </button>
              </div>
              <div className="group relative flex items-center">
                <Icon
                  name="i-lock"
                  className="pointer-events-none absolute left-[13px] h-[17px] w-[17px] text-ink-400 transition-colors duration-150 group-focus-within:text-brand-500"
                />
                <input
                  id="password"
                  name="password"
                  type={passwordVisible ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="输入密码"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="glass-soft h-[46px] w-full rounded-md border border-line-strong bg-ink-50 pl-10 pr-[46px] text-14-5 text-ink-900 outline-none transition-all duration-150 ease-out placeholder:text-ink-500 hover:bg-surface-sunken focus:border-brand-500 focus:bg-surface focus:shadow-[0_0_0_3.5px_rgba(79,70,229,.13)]"
                />
                <button
                  type="button"
                  aria-label={passwordVisible ? '隐藏密码' : '显示密码'}
                  onClick={() => setPasswordVisible((visible) => !visible)}
                  className={cn(
                    'absolute right-2 inline-flex h-8 w-8 items-center justify-center rounded-sm border-0 bg-transparent transition-colors duration-150 hover:bg-ink-50 hover:text-ink-600',
                    passwordVisible ? 'text-brand-500' : 'text-ink-400',
                  )}
                >
                  <Icon name="i-eye" className="h-[17px] w-[17px]" />
                </button>
              </div>
            </div>

            <div className="mb-6 mt-5 flex items-center justify-between gap-4">
              <label className="inline-flex cursor-pointer select-none items-center gap-[9px] text-13-5 text-ink-600">
                <input type="checkbox" className="peer sr-only" checked={remember} onChange={(event) => setRemember(event.target.checked)} />
                <span
                  className={cn(
                    'flex h-[17px] w-[17px] shrink-0 items-center justify-center rounded-[5px] border-[1.5px] transition-all duration-150 ease-out peer-focus-visible:shadow-[0_0_0_3.5px_rgba(79,70,229,.16)]',
                    remember ? 'border-brand-500 bg-brand-500' : 'border-line-strong bg-surface-raised',
                  )}
                >
                  <Icon
                    name="i-check-xs"
                    className={cn(
                      'h-[11px] w-[11px] text-white transition-all duration-150 ease-spring',
                      remember ? 'scale-100 opacity-100' : 'scale-[.6] opacity-0',
                    )}
                  />
                </span>
                记住这台设备
              </label>
            </div>

            <button
              type="submit"
              disabled={pending}
              className={cn(
                'group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-md border-0 bg-[linear-gradient(180deg,rgba(32,36,48,.95)_0%,rgba(12,14,20,.97)_100%)] text-15 font-semibold tracking-[.01em] shadow-[0_10px_26px_rgba(16,18,24,.24),inset_0_1px_0_rgba(255,255,255,.18)] transition-all duration-150 ease-out hover:bg-[linear-gradient(180deg,rgba(44,49,64,.96)_0%,rgba(16,18,24,.98)_100%)] hover:shadow-[0_18px_38px_rgba(16,18,24,.3),inset_0_1px_0_rgba(255,255,255,.22)] active:scale-[.988]',
                pending ? 'pointer-events-none text-transparent' : 'text-white',
              )}
            >
              {!pending ? (
                <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(120deg,transparent_20%,rgba(255,255,255,.14)_50%,transparent_80%)] transition-transform duration-[400ms] ease-out group-hover:translate-x-full" />
              ) : null}
              <span className="relative z-[1]">登录</span>
              <Icon name="i-arrow-right" className="relative z-[1] h-[17px] w-[17px]" />
              {pending ? (
                <span className="absolute left-1/2 top-1/2 -ml-[8.5px] -mt-[8.5px] h-[17px] w-[17px] animate-spin-fast rounded-full border-2 border-white/30 border-t-white" />
              ) : null}
            </button>
          </form>

          {/* 原型未重置 p 默认外边距：.form-foot 保留 1em 下边距，.legal 保留 1em 下边距 */}
          <p className="mb-[13.5px] mt-6 animate-fade-up-lg text-center text-13-5 text-ink-500 [animation-delay:.27s]">
            还没有账户？
            <button
              type="button"
              className="font-semibold text-brand-600 hover:underline hover:underline-offset-[3px]"
              onClick={() => toast('原型演示：注册流程未包含')}
            >
              创建一个
            </button>
          </p>

          {/* 原型未重置 p 的默认外边距，这里补回 1em 的下边距。
              它是 .auth-panel__inner 的第 7 个子元素，原型对全部子元素统一加了入场动画，故这里也要有 */}
          <p className="mb-3 mt-10 animate-fade-up-lg border-t border-line pt-5 text-center text-12 leading-[1.75] text-ink-400">
            登录即表示同意{' '}
            <a href="#" onClick={(event) => event.preventDefault()} className="text-ink-500 underline underline-offset-[2px]">
              服务条款
            </a>{' '}
            与{' '}
            <a href="#" onClick={(event) => event.preventDefault()} className="text-ink-500 underline underline-offset-[2px]">
              隐私政策
            </a>
            。
            <br />
            工作机密数据不会同步至个人空间。
          </p>
          </div>
        </div>
      </main>

      {/* 原型提示 */}
      <div className="glass-bar fixed bottom-6 left-6 z-20 inline-flex animate-fade-up-lg items-center gap-[7px] rounded-full border border-white/14 bg-[rgba(16,18,24,.82)] px-[13px] py-[7px] text-12 font-medium text-white/90 shadow-lg max-[880px]:bottom-4 max-[880px]:left-1/2 max-[880px]:-translate-x-1/2">
        <i className="h-1.5 w-1.5 rounded-full bg-[#34d3a6] animate-badge-pulse" />
        原型演示 · v1.0 · 点击登录进入项目管理
      </div>
    </div>
  )
}
