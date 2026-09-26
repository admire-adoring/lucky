import { cn } from '../../lib/cn'
import { DRAG_REGION } from '../../lib/desktop-window'
import { Icon } from '../icons/Icon'
import { RingNav, type RingNavItem } from './RingNav'
import { SHELL_SLOTS, SlotPanel } from './SlotPanel'

/**
 * 侧栏 —— 当前模块的**分区环** + 工具槽 + 收起。
 *
 * ============================================================================
 * 它读应用已有的令牌，不引入第二套配色
 * ============================================================================
 *
 * 模块强调色走 `--mw-m-main`（由 `.mw-root[data-module]` 提供），
 * 中性面走 `--mw-bg-sidebar` / `--mw-text-*` / `--mw-border-*`，
 * 状态色走 `--c-error`。
 *
 * ============================================================================
 * 两个类名约定（改了要连 CSS 一起改，都在 sidebar-shell.css 里）
 * ============================================================================
 *
 * · `.sb-sidebar.collapsed`  —— 收起态。收起的**不是宽度而是内容**：
 *   环、槽、文字一起消失，只剩 64px 的圆角柱（宽度由 `.sb-app` 的栅格给）；
 *   腾出来的竖条交给 `.sb-rail`（见下）。
 * · `.sidebar-wrap.is-open`  —— ≤768px 抽屉打开态。抽屉那段是**手写**的，
 *   在 `styles/workspace-shell.css` 里（原型是独立页，直接 `display:none` 掉侧栏，
 *   到了应用就是"窄屏没有任何导航入口"）。
 * · `.sidebar-head` 的副标题显示**当前分区名**，不是模块的广告语。
 *   原因：主区那排 `.tabs` 已经取消（分区搬到环上了），
 *   "我在哪个分区"需要一处**文字**回执 —— 环上那一格是图形，中心门是入口，
 *   而面包屑已经不在顶栏了。这里放分区名，是本次改动里唯一的"新增信息位"。
 *
 * ============================================================================
 * 收起态是一列图标，不是一根空柱子
 * ============================================================================
 *
 * 展开态用**圆盘**表达"这一域有几个分区、走到第几格"；收起态那 64px 放不下圆盘，
 * 于是换一种排列：`v5` 的 `.rail` —— 同一份数据（`items`），竖着一列图标，
 * 当前项在侧栏内沿有一条 3px 指示条，悬停出名称气泡。
 *
 * ⚠️ **这里的类名带 `sb-` 前缀，不是原型里的 `.rail` / `.rail__item`。**
 *    `.rail` 已经被工作台的助手栏占了（`components/workbench/AssistantRail.tsx`
 *    → `workbench-hero.css` 的 `.rail` / `.rail-head` / `.rail__fade` /
 *    `.rail-avatar`），而且那几条**没有收在任何作用域下**（顶层选择器）。
 *    直接叫 `.rail` 会让两套规则落在同一个类名上 —— 这正是仓库里
 *    「只撞一个 `.rail` 就足以否决整条路」那句话的由来（见 `WorkbenchPage.tsx`
 *    里为命令面板单独包一层 `.sb-root` 的注释）。加前缀是这道改名规矩的延续，
 *    与 `.app → .sb-app` / `.quick-btn → .sb-quick-btn` 同一条。
 *
 * ⚠️ **提示气泡必须能浮到侧栏之外**（它在 `left: calc(100% + 6px)`）。靠三件事：
 *    `.sb-sidebar.collapsed { overflow: visible }`、
 *    `.sidebar-wrap` 收起时也放开裁剪、以及 `.sidebar-wrap` 抬一层 `z-index`
 *    —— 少了第三件事，DOM 在后的主内容卡会把气泡盖住（它是不透明的实底卡）。
 */
interface ShellSidebarProps {
  /** 模块中文名，例如「生活」 */
  moduleLabel: string
  /** 当前分区名，例如「习惯」 */
  activeTabLabel: string
  items: RingNavItem[]
  activeKey: string
  onSelect: (key: string) => void
  onEnter: () => void
  collapsed: boolean
  onToggleCollapse: () => void
  /** ≤768px 抽屉是否打开 */
  open: boolean
}

export function ShellSidebar({
  moduleLabel,
  activeTabLabel,
  items,
  activeKey,
  onSelect,
  onEnter,
  collapsed,
  onToggleCollapse,
  open,
}: ShellSidebarProps) {
  return (
    <div className={cn('sidebar-wrap', open && 'is-open')}>
      <aside
        {...DRAG_REGION}
        className={cn('sb-sidebar', collapsed && 'collapsed')}
        aria-label="模块分区导航"
      >
        <div className="sidebar-head">
          <div className="sb-head-title">
            <span className="dot" aria-hidden="true" />
            <span className="name">{moduleLabel}</span>
          </div>
          {/* 收起时这块整体 `opacity: 0`（见 sidebar-shell.css 里 `.sb-sidebar.collapsed` 那一族）。
              ⚠️ 只压 opacity 不摘布局：摘了侧栏会在收起动画里跳一下高度。 */}
          <div className="sidebar-subtitle" aria-live="polite">
            {activeTabLabel}
          </div>
        </div>

        {/* ⚠️ 没有分区时不渲染环。
            「项目」这一域的**根**（`/projects` 列表页）没有 Tab —— 分组的落点在页面自己的
            工具栏里（全部 / 生活 / 工作 / 学习 是**页内筛选**，不是路由），所以环上没有东西可指。
            不渲染空环是刻意的：一个 12 点的空圆盘 + 一扇写着空字符串的门，
            读起来像"坏了"，而不是"这里没有下一层"。
            同一条判据也用在顶栏：`projects` 的超级菜单是空的（见 `data/workspace/tabs.ts`）。 */}
        {items.length ? (
          <div className="radial-stage">
            <RingNav
              items={items}
              activeKey={activeKey}
              onSelect={onSelect}
              onEnter={onEnter}
              ariaLabel={`${moduleLabel}分区`}
            />
          </div>
        ) : null}

        {/* 收起态的平铺图标列。与圆盘**同一份数据**，两种形态互斥显示
            （CSS 里 `.sb-rail` 默认 `display: none`，只有 `.collapsed` 才 `flex`）。

            ⚠️ 这里**不写 `title`**：原生 tooltip 会和 `.sb-rail__tip` 的气泡同时出现
               （两个框、同一句话、位置还不一样）。可访问名改由 `aria-label` 给 ——
               视觉提示归气泡，语义名归 ARIA，两件事分开。

            ⚠️ 分区分不清时不给"收起"这个选项是没用的：收起本身要能继续换分区，
               否则收起态就成了一个"必须展开才能用"的死胡同。 */}
        {items.length ? (
          <nav className="sb-rail" aria-label={`${moduleLabel}分区快捷导航`}>
            {items.map((item) => {
              const current = item.key === activeKey
              return (
                <button
                  key={item.key}
                  type="button"
                  className={cn('sb-rail__item', current && 'active')}
                  aria-current={current ? 'true' : undefined}
                  aria-label={item.label}
                  onClick={() => onSelect(item.key)}
                >
                  <span className="sb-rail__btn">
                    <Icon name={item.icon} />
                  </span>
                  <span className="sb-rail__tip" aria-hidden="true">
                    {item.label}
                  </span>
                </button>
              )
            })}
          </nav>
        ) : null}

        <SlotPanel slots={SHELL_SLOTS} />

        <div className="sidebar-foot">
          <button
            type="button"
            className="collapse-btn"
            onClick={onToggleCollapse}
            aria-expanded={!collapsed}
            title={collapsed ? '展开侧栏' : '收起侧栏'}
          >
            <Icon name="i-chevron" />
            <span className="collapse-text">{collapsed ? '展开' : '收起'}</span>
          </button>
        </div>
      </aside>
    </div>
  )
}
