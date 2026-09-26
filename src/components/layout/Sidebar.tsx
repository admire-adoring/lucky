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
 * 激活态的底：**品牌实底 + 白字**。
 * ⚠️ 原来这里是一道 135° 的品牌渐变（#4f46e5 → #6d28d9；再早是近黑实心），
 * 2026-09-25 纯色化时落成一个实色 `--brand-solid`（#6264EF，见 design-tokens.css）。
 *
 * ⚠️ 为什么不取"白字对比度更高"的那一端（#4f46e5 是 6.3:1，比 #6264EF 的 4.58:1 更宽）：
 * 因为这一支同时要满足**两个**方向上的约束，而它们夹出了一个窗口 ——
 *   · 对白字：Y ≤ 0.1833（4.5:1）→ 这是**上界**，越深越好；
 *   · 对暗色主题下的卡面（#171f32，Y=0.0144）：实底自身要能与卡面断开 ≥3:1 ⇒ Y ≥ 0.169
 *     → 这是**下界**，越深越糟（Y=0.1170 的 #4f46e5 只有 2.59:1，实底会糊进卡面）。
 * 可行窗口只有 0.169~0.1833 这么窄 —— 这正是 Prism 那套 `--brand-a` 被"反解"出来的
 * 全部原因（见 prism.css §3），#6264EF（Y=0.1793）落在窗口里。
 * ⇒ 侧面那个"深一点更好"的直觉只对了一半：它守白字、砸边界。
 * 附带的好处是四处（侧栏 logo / 顶栏头像 / "AI"按钮 / 这条激活项）用同一个蓝。
 */
const NAV_ITEM_IDLE = 'font-medium text-ink-600 hover:bg-ink-50 hover:text-ink-900'
const NAV_ITEM_ACTIVE =
  'bg-[color:var(--brand-solid)] font-semibold text-white shadow-[0_10px_24px_rgba(79,70,229,.26)] hover:bg-[color:var(--brand-solid)] hover:text-white'

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
        // ⚠️ 这里原来写着"玻璃厚度取常规档（α.70）而不是 raised 档（α.84）"——
        // 那是在调**半透明度**。2026-09-25 纯色化后 `bg-surface` 是实色（#FFFFFF / #111827），
        // α 这个话题整个消失，侧栏就是"一块实色的柱子 + 右侧一条分隔线"。
        'glass-bar z-30 flex w-[248px] shrink-0 flex-col border-r border-line bg-surface max-[1024px]:w-[236px]',
        // 窗口左上 / 左下两个角由它承担（自己声明，不靠外层裁剪"借"来）
        'shell-frame-left',
        // ⚠️ 这里原本还挂着一条"顶部镜面反光"的白色渐变
        // （`bg-[linear-gradient(180deg,rgba(255,255,255,.2),transparent_32%)]`），
        // 用途是"交代这片材质有厚度"。实底上它只会把侧栏上半截洗淡一点点 ——
        // 一个没有对象的视觉效果，删。
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
