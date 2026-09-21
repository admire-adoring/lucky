import { useEffect, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { navLabel } from '../../data/workspace/nav'
import type { ModuleTab, WorkspacePageKey } from '../../data/workspace/types'
import { useDocumentTitle } from '../../hooks/use-document-title'
import { useUiStore } from '../../stores/ui-store'
import { AuroraBackdrop } from './AuroraBackdrop'
import { WorkspaceSidebar } from './WorkspaceSidebar'
import { WorkspaceTopbar } from './WorkspaceTopbar'

interface WorkspaceLayoutProps {
  /** 当前模块 —— 它同时决定 `data-module`（整页强调色）与侧栏高亮项 */
  module: WorkspacePageKey
  tabs: ModuleTab[]
  /** 当前 Tab 的 key */
  active: string
  onSelectTab: (key: string) => void
  /** 模块自己的顶栏动作（由页面传入） */
  topbarActions?: ReactNode
  /**
   * 覆盖面包屑的尾部。
   *
   * 默认是当前 Tab 的标签（八个模块页都这样）。项目工作区是个例外：
   * 它的原型面包屑写的是**项目名** —— 因为那一页最要紧的"我在哪"是"我在哪个项目里"，
   * 而"在哪个 Tab"已经由下面那排 Tab 自己说了。所以给它一个覆盖口。
   */
  topbarTitle?: string
  /**
   * Tab 之前的正文（只项目工作区用）。
   *
   * 原型的项目页顺序是「项目标题卡 → Tab → 面板」，而其余八个模块是「Tab → 面板」。
   * 标题卡不能塞进 `panel` 里（那样它会跟着 Tab 一起换、并且排在 Tab 下面），
   * 所以要一个明确的插槽，而不是把顺序交给页面去猜。
   */
  beforeTabs?: ReactNode
  /**
   * 常驻右栏（只项目工作区用）。
   *
   * ⚠️ 它必须是 `.app` 的**直接子元素** —— 三栏是 `.app` 的网格，
   * 右栏靠 `grid-area: aside` 落位（在项目模块的 CSS 里）。放进 `main` 里会变成
   * 主区内部的一列，滚动态与栅格都跟着变。
   */
  rail?: ReactNode
  children: ReactNode
}

/**
 * 模块工作区的应用外壳：`.mw-root > [极光底衬] + .app > [侧栏 | 顶栏 | 主区]`。
 *
 * **类名一个都没有改**（`app` / `sidebar` / `topbar` / `main` / `tabs` / `tab` / `panel`）。
 * 理由是这套 CSS 有 703 条模块增量规则在引用这些类名（`.card.ov-kpi-card`、
 * `.tabs .tab.active` 这类组合选择器到处都是），改一个名字就要连带改一批规则 ——
 * 而 CSS 是生成物，改了会在下次生成时被覆盖。**类名是这一层设计系统的接口**。
 *
 * `data-module` 写在 `.mw-root` 上而不是 `<html>` 上：这一层的作用域就是 `.mw-root`，
 * 而工作台（`/`）不套这层壳，属性写 `<html>` 会漏到工作台去 —— 那样工作台会
 * 平白吃到一套 `--mw-*` 强调色。
 *
 * 主区里只渲染**当前 Tab 那一份面板**（`.panel.active`）。原型是 9～12 份面板
 * 全部 `display:none` 藏起来、靠切类名显示；React 里条件渲染更省、也更好查。
 * 注意仍要带 `panel active` 两个类 —— `.panel` 是 `display:none`，
 * 只写 `panel` 会得到一块**永远看不见**的面板（而且不报错）。
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
  const tabLabel = topbarTitle ?? tabs.find((tab) => tab.key === active)?.label ?? ''
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const closeSidebar = useUiStore((state) => state.closeSidebar)

  useDocumentTitle(`${tabLabel} · ${moduleLabel} · Lucky-Y`)

  // 切换模块/Tab 时把主区滚回顶部 —— 否则从长页面切到短页面会停在半空
  useEffect(() => {
    document.querySelector('.mw-root .main')?.scrollTo({ top: 0 })
  }, [module, active])

  return (
    <div className="mw-root" data-module={module}>
      <AuroraBackdrop />

      {/* 抽屉遮罩（只在 ≤768px 有意义，见 styles/workspace-shell.css） */}
      <div
        className={cn('workspace-scrim', sidebarOpen && 'is-open')}
        onClick={closeSidebar}
        aria-hidden="true"
      />

      <div className="app">
        <WorkspaceSidebar />
        <WorkspaceTopbar moduleLabel={moduleLabel} tabLabel={tabLabel} actions={topbarActions} />

        <main className="main">
          {beforeTabs}

          {/* Tab 栏可以为空 —— 项目列表页是「项目」这一域的根，它下面没有 Tab
              （Tab 属于单个项目的工作区）。空的时候整条导航不渲染，
              而不是渲染一条空的 `.tabs`：那会吃掉 20px 的视觉间距。 */}
          {tabs.length ? (
            <nav className="tabs" role="tablist" aria-label={`${moduleLabel}分区`}>
              {tabs.map((tab) => {
                const isActive = tab.key === active
                return (
                  <button
                    key={tab.key}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={cn('tab', isActive && 'active')}
                    onClick={() => onSelectTab(tab.key)}
                  >
                    {tab.label}
                  </button>
                )
              })}
            </nav>
          ) : null}

          {/* 只挂当前那一份；`panel active` 两个类都要（见上文注释） */}
          <div className="panel active" data-panel={active}>
            {children}
          </div>
        </main>

        {rail}
      </div>
    </div>
  )
}
