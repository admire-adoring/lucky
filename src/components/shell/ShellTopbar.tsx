import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { DRAG_REGION, PLATFORM } from '../../lib/desktop-window'
import { Icon } from '../icons/Icon'
import { AccountMenu } from '../layout/AccountMenu'
import { ThemeToggle } from '../layout/ThemeToggle'
import { WindowControls } from '../layout/WindowControls'
import { computeStats } from '../../data/derive'
import { useProjects } from '../../hooks/use-projects'
import { useUiStore } from '../../stores/ui-store'
import { MODULE_BASE_PATH, navLabel, WORKSPACE_NAV_FLAT } from '../../data/workspace/nav'
import { SHELL_PRIMARY, tabIcon, tabPath, type ShellPrimaryItem } from '../../data/workspace/shell-nav'
import { SHELL_TABS } from '../../data/workspace/tabs'
import type { ModuleTab, WorkspaceModuleKey } from '../../data/workspace/types'

/**
 * 应用外壳顶栏 —— 九模块主导航 + 二级超级菜单 + 全局动作。
 *
 * ============================================================================
 * 它同时解决了两件互相牵制的事
 * ============================================================================
 *
 * ① **九模块从侧栏搬到顶栏**。侧栏让给了当前模块的分区环（`RingNav`），
 *    于是"换模块"与"换分区"变成了两个不同手势、落在两个不同位置 ——
 *    这也是原型的主张：侧栏是**当前模块内部**的地图，九域在顶栏。
 *
 * ② **窗口控制仍然必须有家**（`decorations: false` 之后这是唯一的关窗方式）。
 *    macOS 的圆点放在最左（在 logo 之前，与原生一致），Windows/Linux 在右上、贴齐窗口边。
 *
 * ============================================================================
 * 与原型不同，都是"静态页变成应用"才成立的问题
 * ============================================================================
 *
 * · **主题开关换成应用的那一份**（`ThemeToggle` + `theme-store`，切 `<html data-theme>`）。
 *   原型自己持有 `.dark` 类 + 自己的 localStorage；照搬会出现"设置页切成暗色、顶栏还是亮的"。
 *   ⚠️ 外观仍走原型的 `.sb-icon-btn`（传 `className` 覆盖它默认那套旧玻璃）。
 *
 * · **徽标是真的**。原型写死「任务 5 / 工作 2 / 项目 4」。项目铁律是
 *   「数字由 `projects.ts` 派生，不允许编数字」，所以这里只挂**有来源**的两个：
 *   项目 = `status === 'active'` 的个数，工作 = `status === 'risk'` 的个数（用 warn 色）。
 *   「任务 5」没有来源（应用里没有"今日任务"这种全局口径），**不挂** ——
 *   挂一个编出来的数比不挂糟得多。
 *
 * · **AI 按钮指向 `/ai`**。原型那颗点了弹 `alert('原型演示：AI 助手')`。
 *   2026-09-22 这一轮 `/ai` 有了自己的页面（`pages/AiAssistantPage.tsx`），
 *   所以它导航到那里，而不是做成一个"点了没反应"的空壳。
 *   ⚠️ 它**没有**"当前页"高亮态：`.sb-icon-btn.ai` 天生就是实底，
 *      再叠一个高亮也读不出来。这一页的身份由会话头（`.chat-head-title`）
 *      与文档标题「AI 助手 · Lucky-Y」承担。
 *
 * · **原型顶栏那颗「通知」没有搬**。它带一个跳动的小红点，而应用里没有通知
 *   这件事（没有收件箱、没有未读源）—— 挂上去就只能是"点了一直没反应的铃铛"。
 *   判据与上面那条"不挂编出来的徽标"同一条：**入口必须指向一个真实存在的地方**。
 *
 * ⚠️ `.sb-narrow-keep`（作用在主题开关与账户入口上）不是随便起的类名：
 *    `sidebar-shell.css` 的 ≤768px 那条规则会把顶栏里 `.sb-icon-btn` **除 `.ai`
 *    与它之外**的全部隐藏，为的是窄屏别把标题挤没。凡是「窄屏也必须能点到」的
 *    东西都要挂上它 —— 漏挂的症状是"手机上没法切主题/退出登录"，零报错。
 *
 * ============================================================================
 * 超级菜单（`.mega`）—— 九域的二级下拉
 * ============================================================================
 *
 * · **数据源是 `SHELL_TABS`（全局注册表），不是当前模块的 `tabs`** ——
 *   悬停"生活"时列的是**生活**的分区，而当前页可能在工作模块里。
 *
 * · **面板必须挂在 `header`（`.sb-topbar`）里**，这是唯一能放的位置：
 *   `.nav-primary` 是 `overflow-x: auto` ⇒ 计算出的 `overflow-y` 也是 auto，
 *   面板会被裁掉并顶出一根竖滚动条。挂在 `.sb-topbar` 上还顺带解决了两件事：
 *   ① 顶栏是 `position: relative`，绝对定位直接可用；
 *   ② 面板成了顶栏的**后代** ⇒ 指针移进面板不会触发顶栏的 `mouseleave`，
 *      不需要原型注释里那条"4px 缝的桥"。
 *
 * · **定位靠 JS，CSS 只给 `left: 0` 兜底**：right 端的"设置"如果按自然位置居中，
 *   面板会越出顶栏右边界（原型实测过）。所以按触发项居中之后**再夹进顶栏里**，
 *   留 8px 余量。⚠️ 量宽必须发生在把内容写进 DOM 之后 —— 用 `useLayoutEffect`，
 *   它在浏览器绘制前跑，不会闪一帧错位。
 *
 * · **开/关的手势按视口分两套**（原型同一条判据，断点跟应用走 768 而不是原型的 900，
 *   因为侧栏收进抽屉也是 768 —— 两处分界必须是同一条）：
 *   · 宽屏：悬停即开（`mouseenter`），指针移出顶栏 180ms 后关（给"从胶囊挪进面板"留时间）；
 *   · 窄屏：没有 hover，改成点击开，靠 Esc / 点面板外关。
 *   ⚠️ 点击是**只开不 toggle**：关闭交给 Esc / 点外部 / 移开顶栏三处，行为更可预测。
 *      切换模块时**面板不跟着关**，而是跟着新模块重建 —— 这正是"悬停着扫过一排模块"
 *      时想要的效果。
 */
interface ShellTopbarProps {
  /** 模块自己的顶栏动作（`+ 新建任务` 这类），由页面传入 */
  actions?: ReactNode
  onOpenCommand: () => void
}

/** 悬停开面板的断点 —— 必须与 `workspace-shell.css` 里侧栏收进抽屉的那一条同值 */
const HOVER_MIN_WIDTH = '(min-width: 769px)'

/**
 * 当前落在哪个模块的哪个分区。
 *
 * ⚠️ 返回值要能表达"什么都不是"：`/ai`、`/login`、`/logs/:id` 都不属于任何模块，
 *    这时 `module` 是 `null` —— 那种页面上超级菜单里没有一项是"当前项"（正常）。
 *
 * ⚠️ 前缀匹配必须带上那个 `/`：`'/learning'.startsWith('/life')` 是 **true**，
 *    漏了斜杠会让学习模块的页面被认成生活模块（表现为菜单高亮错、模块色错）。
 */
function useActiveLocation(): { module: WorkspaceModuleKey | null; tab: string | null } {
  const { pathname } = useLocation()
  const hit = WORKSPACE_NAV_FLAT.find(
    (nav) => pathname === nav.path || pathname.startsWith(`${nav.path}/`),
  )
  if (!hit) return { module: null, tab: null }
  /* 第一个分区走裸路径（`/life`），所以这里可能是空串 —— 用 null 表示"没指明" */
  const segment = pathname.slice(hit.path.length + 1).split('/')[0]
  return { module: hit.key, tab: segment || null }
}

export function ShellTopbar({ actions, onOpenCommand }: ShellTopbarProps) {
  const isMac = PLATFORM === 'macos'
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { module: currentModule, tab: currentTab } = useActiveLocation()
  const openSidebar = useUiStore((state) => state.openSidebar)
  const aiDrawerOpen = useUiStore((state) => state.aiDrawerOpen)
  const toggleAiDrawer = useUiStore((state) => state.toggleAiDrawer)
  /**
   * 当前是不是 AI 完整页。
   *
   * ⚠️ 用 `pathname` 判，不用 `useMatch`：这里只需要"是不是这一族"，
   *    而 `/ai` 目前没有子路由；将来加了也只是同一个判断继续成立。
   *    判它的用处只有一个 —— 在那一页**不渲染**那颗按钮（见下面 AI 入口的注释）。
   */
  const onAiPage = pathname === '/ai'
  const { data: projects } = useProjects()
  const stats = projects ? computeStats(projects) : null

  /** 徽标：只在有真实来源、且数量 > 0 时挂 */
  const badgeOf = (key: WorkspaceModuleKey): { count: number; warn?: boolean } | null => {
    if (!stats) return null
    if (key === 'projects' && stats.active > 0) return { count: stats.active }
    if (key === 'work' && stats.risk > 0) return { count: stats.risk, warn: true }
    return null
  }

  /* ---------- 超级菜单 ---------- */
  const [megaKey, setMegaKey] = useState<WorkspaceModuleKey | null>(null)
  const topbarRef = useRef<HTMLElement>(null)
  const megaRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | null>(null)

  const cancelClose = () => {
    if (closeTimer.current === null) return
    window.clearTimeout(closeTimer.current)
    closeTimer.current = null
  }
  /** 延迟关：指针从胶囊挪到面板要穿过 4px 缝，立刻关会让面板"点不到" */
  const scheduleClose = () => {
    cancelClose()
    closeTimer.current = window.setTimeout(() => setMegaKey(null), 180)
  }
  /**
   * 开面板。
   *
   * ⚠️ 该模块没有二级时（`projects`，见 `data/workspace/tabs.ts` ③）是**关掉**面板，
   *    而不是"什么都不做" —— 后者会让上一个模块的面板留在原地，看着像串台。
   */
  const openMega = (key: WorkspaceModuleKey) => {
    cancelClose()
    setMegaKey(SHELL_TABS[key].length ? key : null)
  }
  const closeMega = () => {
    cancelClose()
    setMegaKey(null)
  }

  /* Escape / 点面板之外 / 视口变化，三条关闭通道。只在开着的时候挂监听。
     第四条（焦点离开顶栏）挂在 `header` 的 `onBlur` 上，见下面的 JSX。 */
  useEffect(() => {
    if (!megaKey) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMegaKey(null)
    }
    const onClick = (e: MouseEvent) => {
      if (!topbarRef.current?.contains(e.target as Node)) setMegaKey(null)
    }
    const onResize = () => setMegaKey(null)
    document.addEventListener('keydown', onKey)
    document.addEventListener('click', onClick)
    window.addEventListener('resize', onResize)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('click', onClick)
      window.removeEventListener('resize', onResize)
    }
  }, [megaKey])

  /* 卸载时清掉挂起的定时器（否则切页后它还会 setState 一次） */
  useEffect(() => cancelClose, [])

  const megaTabs: ModuleTab[] = megaKey ? SHELL_TABS[megaKey] : []

  /**
   * 面板定位：与触发项居中对齐，再夹进顶栏范围内。
   * ⚠️ 依赖里只有 `megaKey`：面板宽度由"这一模块有几项"决定，项数变了一定伴随 key 变，
   *    所以不需要监听别的。窗口尺寸变化走上面的 resize 关闭，也不会用到旧位置。
   */
  useLayoutEffect(() => {
    if (!megaKey) return
    const topbar = topbarRef.current
    const mega = megaRef.current
    if (!topbar || !mega) return
    const anchor = topbar.querySelector<HTMLElement>(`[data-module="${megaKey}"]`)
    if (!anchor) return
    const tb = topbar.getBoundingClientRect()
    const a = anchor.getBoundingClientRect()
    const w = mega.offsetWidth
    const left = a.left - tb.left + a.width / 2 - w / 2
    mega.style.left = `${Math.round(Math.max(8, Math.min(left, tb.width - w - 8)))}px`
  }, [megaKey])

  /** 二级项 → 地址。⚠️ 用 `tabPath` 而不是自己拼：第一个分区是裸路径那条约定在它手里 */
  const gotoTab = (tab: ModuleTab, index: number) => {
    if (!megaKey) return
    navigate(tabPath(megaKey, tab.key, index === 0))
    closeMega()
  }

  return (
    <div className="topbar-wrap">
      <header
        ref={topbarRef}
        {...DRAG_REGION}
        className="sb-topbar"
        onMouseLeave={() => {
          if (megaKey) scheduleClose()
        }}
        /* 键盘路径：焦点离开整块顶栏时收面板。
           ⚠️ 用 React 的 `onBlur`（它对应原生 `focusout`、**会冒泡**）：判据必须是
              "新焦点还在不在顶栏里"，否则从胶囊 Tab 到面板里的按钮时面板会被关掉。
              `relatedTarget` 为 null（焦点跑到浏览器 chrome）时按"出去了"处理。 */
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) closeMega()
        }}
      >
        {isMac ? <WindowControls className="shrink-0" /> : null}

        {/* ≤768px 的抽屉开关。
            ⚠️ 这一颗是**必须**的：新壳在窄屏下把侧栏收进抽屉（见 workspace-shell.css），
               而没有它就没有任何打开抽屉的入口 —— 整页在手机上没有任何导航。
               样式由手写层提供（宽屏 `display:none`、≤768px 才出现）。 */}
        <button
          type="button"
          className="btn btn-ghost workspace-drawer-toggle"
          aria-label="打开分区导航"
          onClick={openSidebar}
        >
          ☰
        </button>

        <button
          type="button"
          className="logo-mark"
          onClick={onOpenCommand}
          title="跳转（⌘K）"
          aria-label="打开跳转面板"
        >
          J
        </button>

        <span className="divider-v" aria-hidden="true" />

        <nav className="nav-primary" aria-label="模块导航">
          {SHELL_PRIMARY.map((item: ShellPrimaryItem) => {
            const badge = badgeOf(item.key)
            const hasTabs = SHELL_TABS[item.key].length > 0
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === '/'}
                data-module={item.key}
                className={({ isActive }) =>
                  /* `mega-on` 是"这块面板归我管"的高亮。⚠️ 它**不能**盖过 `active`：
                     CSS 里那两条同特异性，靠源码顺序定的优先级（active 在后）——
                     见 sidebar-shell.css 里 `.nav-p-item.mega-on` 那段注释。 */
                  cn('nav-p-item', isActive && 'active', megaKey === item.key && 'mega-on')
                }
                title={item.label}
                /* 键盘可达：焦点落到胶囊上就展开（写不出 hover 的键盘用户靠这条） */
                onFocus={() => openMega(item.key)}
                onMouseEnter={() => {
                  /* ⚠️ 窄屏不该靠"悬停"开面板（那里根本没有 hover，而触摸设备的
                     mouseenter 是点击的副作用）。判据与 CSS 里那条全宽面板同断点。 */
                  if (window.matchMedia?.(HOVER_MIN_WIDTH).matches ?? true) openMega(item.key)
                }}
                onClick={() => openMega(item.key)}
                aria-haspopup={hasTabs ? 'true' : undefined}
                aria-expanded={hasTabs ? megaKey === item.key : undefined}
              >
                <span className="nav-p-icon">
                  <Icon name={item.icon} />
                </span>
                {/* ⚠️ 标签**必须是个 span**，不能写成裸文本 —— 而且**不要给它加类名**。
                    生成物里 ≤768px 那条是
                      `.nav-p-item span:not(.nav-p-icon):not(.nav-p-badge){display:none}`
                    —— 原型自己的标记把标签写成裸文本（`…图标…工作台…`），
                    于是那条规则**一个元素都匹配不到**：原型在窄屏下并没有真的把文字收掉。
                    包一层 span 之后规则才生效（窄屏顶栏变成只有图标），
                    而它靠的是 `:not(...)` 排除法、不需要我们起名字 ——
                    起了名字反而会让 `check-classnames.mjs` 报"用了但 CSS 里不存在"
                    （规则里根本没出现过这个类名）。这是**照原型写的规则去修原型的标记**，
                    没有新增任何 CSS、也没有新增类名。 */}
                <span>{item.label}</span>
                {badge ? (
                  <span className={cn('nav-p-badge', badge.warn && 'warn')}>{badge.count}</span>
                ) : null}
              </NavLink>
            )
          })}
        </nav>

        {/* 超级菜单面板。**必须留在 `header` 里、且在 `.nav-primary` 之外** —— 理由见文件头。
            常驻 DOM、只切 `.is-open`：卸载会连淡入过渡一起丢掉（变成"啪"地出现）。
            `mouseenter` 取消挂起的关闭，否则指针刚离开胶囊就被关掉了。

            ⚠️ `data-tauri-drag-region="false"`：顶栏整块是 `"deep"` 的拖拽区，
               而面板的空白处（内边距、标题行、格子之间）**不是可点元素** ——
               不加这一条，在面板空白处按下去会变成拖动窗口（浮层上最不该发生的事）。
               `"false"` 是 Tauri 约定的第三档：在该元素处禁用拖拽（见 lib/desktop-window.ts）。 */}
        <div
          ref={megaRef}
          className={cn('mega', megaKey && 'is-open')}
          aria-label="二级导航"
          aria-hidden={megaKey ? undefined : true}
          data-tauri-drag-region="false"
          onMouseEnter={cancelClose}
        >
          {megaKey ? (
            <>
              <div className="mega-head">
                <span className="mh-title">
                  {navLabel(megaKey)} · 二级 {megaTabs.length} 项
                </span>
                {/* 「全部 ›」落到模块根 —— 与环上"最后一个都不选"是同一个落点 */}
                <button
                  type="button"
                  className="mh-all"
                  onClick={() => {
                    navigate(MODULE_BASE_PATH[megaKey])
                    closeMega()
                  }}
                >
                  全部 ›
                </button>
              </div>
              <div
                className="mega-grid"
                /* 3 列放得下 12 项；≤4 项时两列更紧凑。与原型同一条判据 */
                style={{ ['--cols' as string]: String(megaTabs.length <= 4 ? 2 : 3) }}
              >
                {megaTabs.map((tab, i) => {
                  /* "当前项"要同时命中模块与分区：只看分区名的话，
                     工作模块的「任务」与任务模块本身会一起亮 */
                  const current = megaKey === currentModule && tab.key === currentTab
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      className={cn('mega-item', current && 'is-current')}
                      aria-current={current ? 'true' : undefined}
                      onClick={() => gotoTab(tab, i)}
                    >
                      <span className="mi-icon">
                        <Icon name={tabIcon(megaKey, tab.key)} />
                      </span>
                      {tab.label}
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}
        </div>

        <div className="topbar-right">
          {/* 模块自己的动作排在最前 —— 它们是"这一页能做的事"，
              与后面那排"全站通用入口"不是一类东西 */}
          {actions ? <div className="topbar-actions">{actions}</div> : null}

          <button
            type="button"
            className="sb-icon-btn"
            onClick={onOpenCommand}
            title="跳转 ⌘K"
            aria-label="打开跳转面板"
          >
            <Icon name="i-search" />
          </button>

          {/* AI 助手入口 —— **开抽屉**，不是跳页。
              流程是用户定的：点右上角这一颗 → 先弹出侧边栏；侧边栏头部有「展开」
              → 才去到完整页面 `/ai`。

              ⚠️ 在 `/ai` 上**不渲染这一颗**：那一页本身就是完整页面，
                 再给一个"打开同一份对话的抽屉"是多余的，而且抽屉会盖在
                 它自己的正文上（看着像出了 bug）。判据与"登录页不摆登出键"同一条。
              ⚠️ 它的外观不需要额外状态：`.sb-icon-btn.ai` 本身就是实底品牌色，
                也就是说**它一直是"亮着"的** —— 这也是它不能当"当前页高亮"用的原因。
              ⚠️ 图标是**手写的两层四角闪光**（主星 + 副星），不是精灵里的 `i-spark`：
                精灵里那一枚是单层、且被七个 mega 项共用，改它会连带改那七处。
                这里要的是"这一颗比别处更活" —— 副星常驻呼吸（`.ai-spark-mini`），
                悬停时加快。两层的路径都是"同轴三段式控制点"画出来的
                （控制点必须落在过圆心的两条轴上，否则四臂会歪）。 */}
          {onAiPage ? null : (
            <button
              type="button"
              className="sb-icon-btn ai"
              /* 是 **toggle** 而不是 open：抽屉的上边缘让开了顶栏（见
                 ai-sidebar.css 里那条 top 覆盖），所以这颗按钮在抽屉打开时**仍然可见**
                 —— 可见的按钮点第二次必须有反应，否则就是"点了没反应"。
                 它也是除 Esc / 收起 之外的第三条关法。 */
              onClick={toggleAiDrawer}
              title={aiDrawerOpen ? '收起 AI 助手' : 'AI 助手'}
              aria-label={aiDrawerOpen ? '收起 AI 助手' : '打开 AI 助手'}
              aria-expanded={aiDrawerOpen}
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M9.5 2.5C9.5 7.3 11.7 9.5 16.5 9.5C11.7 9.5 9.5 11.7 9.5 16.5C9.5 11.7 7.3 9.5 2.5 9.5C7.3 9.5 9.5 7.3 9.5 2.5Z" />
                <path
                  className="ai-spark-mini"
                  d="M17.5 13C17.5 15.75 18.75 17 21.5 17C18.75 17 17.5 18.25 17.5 21C17.5 18.25 16.25 17 13.5 17C16.25 17 17.5 15.75 17.5 13Z"
                />
              </svg>
            </button>
          )}

          <ThemeToggle className="sb-icon-btn sb-narrow-keep" />

          {/* 账户入口只有一份实现（含退出登录），见 AccountMenu 的注释 */}
          <AccountMenu variant="topbar" className="sb-narrow-keep" />

          {isMac ? null : <WindowControls className="shrink-0" />}
        </div>
      </header>
    </div>
  )
}
