import { NavLink, useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { DRAG_REGION, PLATFORM } from '../../lib/desktop-window'
import { AccountMenu } from './AccountMenu'
import { WindowControls } from './WindowControls'
import { NAV_GROUPS } from '../../data/meta'
import { useProjects } from '../../hooks/use-projects'
import { useUiStore } from '../../stores/ui-store'
import { toast } from '../../stores/toast-store'
import { BrandMark } from '../ui/BrandMark'
import { Icon } from '../icons/Icon'

const NAV_ITEM_BASE =
  'relative mb-0.5 flex w-full items-center gap-[11px] rounded-sm px-3 py-[9px] text-14 transition-colors duration-150 ease-out'

/**
 * 激活/非激活两套完整色板：避免同属性工具类互相覆盖（Tailwind 不按类名顺序裁决）。
 * 激活态从原来的近黑实心改为品牌渐变玻璃 —— 近黑实心块与玻璃拟态是相冲的语汇。
 * 渐变的两个端点取的是 600/700 级（#4f46e5 → #6d28d9）而不是 400 级：
 * 实测 400 级渐变最亮处白字只有 4.17:1，600 级之后稳定在 6:1 以上。
 */
const NAV_ITEM_IDLE = 'font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900'
const NAV_ITEM_ACTIVE =
  'bg-[linear-gradient(135deg,rgba(79,70,229,.96)_0%,rgba(109,40,217,.94)_100%)] font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,.26)] hover:bg-[linear-gradient(135deg,rgba(79,70,229,.96)_0%,rgba(109,40,217,.94)_100%)] hover:text-white'

export function Sidebar() {
  const location = useLocation()
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const closeSidebar = useUiStore((state) => state.closeSidebar)
  const { data: projects } = useProjects()
  const isMac = PLATFORM === 'macos'

  // 「项目」在列表页与详情页都保持高亮；
  // 但数量角标只在列表页出现 —— 原型 project-detail.html 的「项目」项没有 nav__count
  const onProjects = location.pathname.startsWith('/projects')
  const onProjectList = location.pathname === '/projects'

  return (
    <aside
      className={cn(
        // 玻璃厚度取"常规"档（bg-surface α.70）而不是 raised 档：
        // raised 的 α.84 会把背后极光几乎全部盖掉，实测侧栏中心落到 245,248,250 ≈ 中性灰，
        // 侧栏就退化成一块白板。薄一档之后背后那条全高色带才透得上来
        // （实测侧栏中心 236,236,250，B 通道比 R 高 14，是一层看得见的靛蓝）。
        'glass-bar z-30 flex w-[248px] shrink-0 flex-col border-r border-line bg-surface max-[1024px]:w-[236px]',
        // 窗口左上 / 左下两个角由它承担（自己声明，不靠外层裁剪"借"来）
        'shell-frame-left',
        // 顶部镜面反光：玻璃拟态里用来交代"这片材质有厚度"，纯装饰
        'bg-[linear-gradient(180deg,rgba(255,255,255,.2)_0%,rgba(255,255,255,0)_32%)]',
        'max-[860px]:fixed max-[860px]:inset-y-0 max-[860px]:left-0 max-[860px]:h-full max-[860px]:shadow-xl',
        'max-[860px]:transition-transform max-[860px]:duration-[220ms] max-[860px]:ease-out',
        sidebarOpen ? 'max-[860px]:translate-x-0' : 'max-[860px]:-translate-x-full',
      )}
    >
      {/* 品牌 —— 同时也是桌面端的第二条拖拽热区。
          原生标题栏关掉后，用户会本能地试着从"最上方的空白"拖窗口；
          侧栏这一行横跨整列，是顶栏拖拽区之外最自然的落点。
          属性用 `deep` 档写在容器上即可覆盖 logo 与两行文字（子元素不必逐个铺）。

          macOS 的窗口圆点放在这里，而不是顶栏右端：窗口的左上角就是这里，
          原生那三个圆点也在左上角 —— "替代品要长得像原物"要求位置也一致。
          为此这一行在 macOS 上收窄左内边距、并把间距放大到 gap-3。 */}
      <div
        {...DRAG_REGION}
        className={cn(
          'flex h-[60px] shrink-0 items-center border-b border-line',
          isMac ? 'gap-3 pl-4 pr-5' : 'gap-2.5 px-5',
        )}
      >
        {isMac ? <WindowControls /> : null}
        <BrandMark className="h-7 w-7" />
        <div>
          <b className="text-15-5 font-bold tracking-[-0.01em]">Lucky-Y</b>
          <small className="mt-px block text-10 font-semibold uppercase leading-none tracking-[.13em] text-ink-400">
            Personal OS
          </small>
        </div>
      </div>

      {/* 导航 */}
      <nav className="flex-1 overflow-y-auto px-3 pb-2 pt-4">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-3 pb-1.5 pt-3 text-11 font-bold uppercase tracking-[.1em] text-ink-400">
              {group.label}
            </div>

            {group.items.map((item) =>
              item.key === 'project' ? (
                <NavLink
                  key={item.key}
                  to="/projects"
                  className={cn(NAV_ITEM_BASE, onProjects ? NAV_ITEM_ACTIVE : NAV_ITEM_IDLE)}
                >
                  {onProjects ? (
                    <span className="absolute left-[-11px] top-1/2 h-[18px] w-[3px] -translate-y-1/2 rounded-r-[3px] bg-brand-500" />
                  ) : null}
                  <Icon
                    name={item.icon}
                    className={cn('h-[17.5px] w-[17.5px] transition-colors', onProjects ? 'text-white' : 'text-ink-400')}
                  />
                  {item.label}
                  {onProjectList ? (
                    <span className="ml-auto text-11-5 font-semibold tabular-nums text-white/75">{projects?.length ?? 0}</span>
                  ) : null}
                </NavLink>
              ) : (
                <button
                  key={item.key}
                  type="button"
                  className={cn(NAV_ITEM_BASE, 'w-full text-left')}
                  onClick={() => {
                    toast(`原型演示：${item.label} 模块未包含在 v1.0`)
                    closeSidebar()
                  }}
                >
                  <Icon name={item.icon} className="h-[17.5px] w-[17.5px] text-ink-400" />
                  {item.label}
                </button>
              ),
            )}
          </div>
        ))}
      </nav>

      {/* 底部：同步状态 + 账户 */}
      <div className="shrink-0 border-t border-line p-3">
        <div className="glass-soft mb-3 flex items-center gap-2 rounded-sm border border-line bg-surface-sunken px-[11px] py-[9px] text-11-5 font-medium text-ink-500">
          <i className="h-1.5 w-1.5 shrink-0 animate-dot-pulse rounded-full bg-online shadow-[0_0_0_3px_rgba(34,197,94,.16)]" />
          Git 已同步 · 3 分钟前
        </div>

        {/* 账户入口。菜单由 AccountMenu 统一实现（含退出登录）——
            这里不再自己写按钮与 toast：退出登录只能有一份实现。 */}
        <AccountMenu variant="sidebar" />
      </div>
    </aside>
  )
}
