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
 * 中性/毛玻璃走 `--mw-bg-sidebar` / `--mw-text-*` / `--mw-border-*`，
 * 状态色走 `--c-error`。**映射表在 `design/build-sidebar-css.mjs` 的 TOKENS 里逐条写明**，
 * 所以"侧栏的底色和模块页的底色是同一支令牌"，不是两个恰好相近的 rgba。
 *
 * ============================================================================
 * 三个类名约定（改了要连 CSS 一起改，都在生成物里）
 * ============================================================================
 *
 * · `.sb-sidebar.collapsed`  —— 收起态。收起的**不是宽度而是内容**：
 *   环、槽、文字一起消失，只剩 64px 的圆角柱（宽度由 `.sb-app` 的栅格给）。
 * · `.sidebar-wrap.is-open`  —— ≤768px 抽屉打开态。抽屉那段是**手写**的，
 *   在 `styles/workspace-shell.css` 里（原型是独立页，直接 `display:none` 掉侧栏，
 *   到了应用就是"窄屏没有任何导航入口"）。
 * · `.sidebar-head` 的副标题显示**当前分区名**，不是模块的广告语。
 *   原因：主区那排 `.tabs` 已经取消（分区搬到环上了），
 *   "我在哪个分区"需要一处**文字**回执 —— 环上那一格是图形，中心门是入口，
 *   而面包屑已经不在顶栏了。这里放分区名，是本次改动里唯一的"新增信息位"。
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
          {/* 收起时这块整体 `opacity: 0`（见生成物里 .sb-sidebar.collapsed 那一族）。
              ⚠️ 只压 opacity 不摘布局：摘了侧栏会在收起动画里跳一下高度。 */}
          <div className="sidebar-subtitle" aria-live="polite">
            {activeTabLabel}
          </div>
        </div>

        {/* ⚠️ 没有分区时不渲染环。
            「项目」这一域的**根**（`/projects` 列表页）没有 Tab —— 分组的落点在页面自己的
            工具栏里（全部 / 生活 / 工作 / 学习 是**页内筛选**，不是路由），所以环上没有东西可指。
            不渲染空环是刻意的：一个 12 点的空圆盘 + 一扇写着空字符串的门，
            读起来像"坏了"，而不是"这里没有下一层"。 */}
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
