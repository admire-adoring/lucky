import type { ReactNode } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { DRAG_REGION, PLATFORM } from '../../lib/desktop-window'
import { Icon } from '../icons/Icon'
import { AccountMenu } from '../layout/AccountMenu'
import { ThemeToggle } from '../layout/ThemeToggle'
import { WindowControls } from '../layout/WindowControls'
import { computeStats } from '../../data/derive'
import { useProjects } from '../../hooks/use-projects'
import { useUiStore } from '../../stores/ui-store'
import { SHELL_PRIMARY, type ShellPrimaryItem } from '../../data/workspace/shell-nav'
import type { WorkspaceModuleKey } from '../../data/workspace/types'

/**
 * 应用外壳顶栏 —— 九模块主导航 + 全局动作。
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
 * 三处与原型不同，都是"静态页变成应用"才成立的问题
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
 *   ⚠️ 它**没有**"当前页"高亮态：`.sb-icon-btn.ai` 天生就是渐变实底，
 *      再叠一个高亮也读不出来。这一页的身份由会话头（`.chat-head-title`）
 *      与文档标题「AI 助手 · Lucky-Y」承担。
 *
 * ⚠️ `.sb-narrow-keep`（作用在主题开关与账户入口上）不是随便起的类名：
 *    `sidebar-shell.css` 的 ≤768px 那条规则会把顶栏里 `.sb-icon-btn` **除 `.ai`
 *    与它之外**的全部隐藏，为的是窄屏别把标题挤没。凡是「窄屏也必须能点到」的
 *    东西都要挂上它 —— 漏挂的症状是"手机上没法切主题/退出登录"，零报错。
 */
interface ShellTopbarProps {
  /** 模块自己的顶栏动作（`+ 新建任务` 这类），由页面传入 */
  actions?: ReactNode
  onOpenCommand: () => void
}

export function ShellTopbar({ actions, onOpenCommand }: ShellTopbarProps) {
  const isMac = PLATFORM === 'macos'
  const navigate = useNavigate()
  const openSidebar = useUiStore((state) => state.openSidebar)
  const { data: projects } = useProjects()
  const stats = projects ? computeStats(projects) : null

  /** 徽标：只在有真实来源、且数量 > 0 时挂 */
  const badgeOf = (key: WorkspaceModuleKey): { count: number; warn?: boolean } | null => {
    if (!stats) return null
    if (key === 'projects' && stats.active > 0) return { count: stats.active }
    if (key === 'work' && stats.risk > 0) return { count: stats.risk, warn: true }
    return null
  }

  return (
    <div className="topbar-wrap">
      <header {...DRAG_REGION} className="sb-topbar">
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
            return (
              <NavLink
                key={item.key}
                to={item.path}
                end={item.path === '/'}
                data-module={item.key}
                className={({ isActive }) => cn('nav-p-item', isActive && 'active')}
                title={item.label}
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

          {/* AI 助手入口。
              原型这一颗点了弹 `alert('原型演示：AI 助手')`；上一轮它指向工作台
              （应用里唯一有对话的地方是那里右栏的助手栏）。现在 `/ai` 有了自己的页面，
              所以指向它 —— 工作台右栏仍在，两处读的是同一批事实源
              （`data/ai/facts.ts` 与 `WORKBENCH_AGG` 都从 `projects.ts` 派生）。

              ⚠️ 它的外观不需要额外状态：`.sb-icon-btn.ai` 本身就是 indigo→purple 渐变，
                也就是说**它一直是"亮着"的** —— 这也是它不能当"当前页高亮"用的原因。 */}
          <button
            type="button"
            className="sb-icon-btn ai"
            onClick={() => navigate('/ai')}
            title="AI 助手"
            aria-label="打开 AI 助手"
          >
            <Icon name="i-spark" />
          </button>

          <ThemeToggle className="sb-icon-btn sb-narrow-keep" />

          {/* 账户入口只有一份实现（含退出登录），见 AccountMenu 的注释 */}
          <AccountMenu variant="topbar" className="sb-narrow-keep" />

          {isMac ? null : <WindowControls className="shrink-0" />}
        </div>
      </header>
    </div>
  )
}
