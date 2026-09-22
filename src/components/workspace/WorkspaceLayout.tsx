import { useEffect, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { navLabel } from '../../data/workspace/nav'
import type { ModuleTab, WorkspaceModuleKey } from '../../data/workspace/types'
import { tabIcon, tabPath } from '../../data/workspace/shell-nav'
import { useDocumentTitle } from '../../hooks/use-document-title'
import { useUiStore } from '../../stores/ui-store'
import { useRecentsStore } from '../../stores/recents-store'
import { AuroraBackdrop } from './AuroraBackdrop'
import { ShellSidebar } from '../shell/ShellSidebar'
import { ShellTopbar } from '../shell/ShellTopbar'
import { CommandPalette, moduleTargets, tabTargets, useCommandHotkey } from '../shell/CommandPalette'

interface WorkspaceLayoutProps {
  /**
   * 当前模块 —— 它同时决定 `data-module`（整页强调色）与环上的高亮。
   *
   * ⚠️ 类型是 `WorkspaceModuleKey`（**九个**）而不是 `WorkspacePageKey`（八个）：
   * 2026-09-22 之后工作台（`dashboard`）也走这套外壳，它有自己的基路径 `/home`
   * 与三个分区。区别只剩"它的强调色指针要手写一条"（内核只给到八域，见
   * `styles/workspace-shell.css` 第 5 段）。
   */
  module: WorkspaceModuleKey
  tabs: ModuleTab[]
  /** 当前 Tab 的 key */
  active: string
  onSelectTab: (key: string) => void
  /** 模块自己的顶栏动作（由页面传入） */
  topbarActions?: ReactNode
  /** 面包屑的覆盖（右栏标题、文档 title 用） */
  topbarTitle?: string
  /** Tab 之前的正文（只项目工作区用：项目标题卡） */
  beforeTabs?: ReactNode
  /** 常驻右栏（只项目工作区用）。必须是 `.sb-app` 的直接子元素（靠栅格区域落位） */
  rail?: ReactNode
  children: ReactNode
}

/**
 * 模块工作区的应用外壳 —— `sidebar` 版。
 *
 * ============================================================================
 * 这一版换掉了什么（`design/sidebar/sidebar_index.html`）
 * ============================================================================
 *
 * 1. **顶栏 `"sidebar topbar"` → `"topbar topbar"`**。旧壳是侧栏通高、顶栏只盖主区；
 *    新壳是顶栏通栏、下面左右分栏。差一行 `grid-template-areas`，但它决定了
 *    "九域导航放哪儿" —— 顶栏通栏之后，九域才搬得上去。
 *
 * 2. **九域导航从侧栏搬到顶栏，侧栏改成当前模块的分区环**。
 *    于是主区那排 `.tabs` 被取消了：分区在环上，两处并列就是同一件事说两遍。
 *    ⚠️ 这是本次改动里**唯一会让人找不到东西**的一处，所以补了一条文字回执 ——
 *    侧栏头部显示当前分区名（见 `ShellSidebar` 的注释）。
 *
 * 3. **根节点多一个 `sb-root`**。新壳的样式全部收在这个作用域里（生成物
 *    `styles/sidebar-shell.css`），撞车的类名已改名（`.app`→`.sb-app` 等），
 *    所以它与内核**零冲突**，不再依赖"谁在后面导入"这条隐含前提。
 *
 * ============================================================================
 * 三件**没有**改、也不能改的事
 * ============================================================================
 *
 * · **根上仍是 `.mw-root`**。整页强调色（`--mw-m-main` / `--mw-m1~m3`）、
 *   卡片/按钮/表单/弹窗那一整套内核样式、`AuroraBackdrop` 的色团，都挂在它下面。
 *   换成 `sb-root` 会当场丢掉全部模块色。
 *
 * · **主区仍是 `<main class="main">`**（内核的）。它的 `padding / overflow-y: auto /
 *   display:flex` 是各模块面板排版的前提，`.sb-app` 给的栅格区域名也叫 `main`；
 *   上面这句 scroll-to-top 找的也是 `.mw-root .main`。改类名要同步改三处。
 *
 * · **每个模块两条路由**（裸路径 + `/:tab`）与 `useModuleTab` 的"首个 Tab 用裸路径"
 *   约定都在。环上的地址由 `tabPath(module, key, i === 0)` 生成，
 *   与 `select()` 算出来的是同一个 —— 两处算法不一致会出现
 *   "地址变了、高亮还停在别处"这种只在点第一个分区时才发作的 bug。
 */
export function WorkspaceLayout({
  module,
  tabs,
  active,
  onSelectTab,
  topbarActions,
  topbarTitle,
  beforeTabs,
  rail,
  children,
}: WorkspaceLayoutProps) {
  const moduleLabel = navLabel(module)
  const activeTab = tabs.find((tab) => tab.key === active)
  const tabLabel = topbarTitle ?? activeTab?.label ?? ''
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const closeSidebar = useUiStore((state) => state.closeSidebar)
  const record = useRecentsStore((state) => state.record)
  const location = useLocation()

  /** 收起：**不持久化**。它是"我这一刻想让侧栏让开"的临时视图，
   *  刷新回到展开态是符合预期的（与助手栏同一条纪律）。 */
  const [collapsed, setCollapsed] = useState(false)
  const [commandOpen, setCommandOpen] = useState(false)

  useDocumentTitle(`${tabLabel} · ${moduleLabel} · Lucky-Y`)
  useCommandHotkey(() => setCommandOpen((open) => !open))

  // 切换模块/Tab 时把主区滚回顶部 —— 否则从长页面切到短页面会停在半空
  useEffect(() => {
    document.querySelector('.mw-root .main')?.scrollTo({ top: 0 })
  }, [module, active])

  // 「最近」槽的事实源：每次落到某个分区就记一条。
  // ⚠️ 记的是**地址栏里的真实路径**（`location.pathname`），不是拼出来的字符串 ——
  //    拼出来的在项目工作区（`/projects/p1/...`）会与真实地址不一致。
  useEffect(() => {
    record(location.pathname, `${moduleLabel} · ${tabLabel}`)
  }, [location.pathname, moduleLabel, tabLabel, record])

  const ringItems = tabs.map((tab) => ({
    key: tab.key,
    label: tab.label,
    icon: tabIcon(module, tab.key),
  }))

  const targets = [
    ...moduleTargets(),
    ...tabTargets(
      moduleLabel,
      tabs,
      (key, i) => tabPath(module, key, i === 0),
      active,
      (key) => tabIcon(module, key),
    ),
  ]

  return (
    <div className={cn('mw-root', 'sb-root')} data-module={module}>
      <AuroraBackdrop />

      {/* 抽屉遮罩（只在 ≤768px 有意义，见 styles/workspace-shell.css） */}
      <div
        className={cn('workspace-scrim', sidebarOpen && 'is-open')}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <div className={cn('sb-app', collapsed && 'sidebar-collapsed')}>
        <ShellTopbar actions={topbarActions} onOpenCommand={() => setCommandOpen(true)} />

        <ShellSidebar
          moduleLabel={moduleLabel}
          activeTabLabel={tabLabel}
          items={ringItems}
          activeKey={active}
          onSelect={(key) => {
            onSelectTab(key)
            closeSidebar()
          }}
          onEnter={() => setCommandOpen(true)}
          collapsed={collapsed}
          onToggleCollapse={() => setCollapsed((value) => !value)}
          open={sidebarOpen}
        />

        <main className="main">
          {beforeTabs}

          {/* 只挂当前那一份；`panel active` 两个类都要 ——
              `.panel` 是 `display:none`，只写 `panel` 会得到一块**永远看不见**的面板（且不报错）。 */}
          <div className="panel active" data-panel={active}>
            {children}
          </div>
        </main>

        {rail}
      </div>

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        targets={targets}
      />
    </div>
  )
}
