import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { DRAG_REGION, PLATFORM } from '../../lib/desktop-window'
import { AccountMenu } from '../layout/AccountMenu'
import { ThemeToggle } from '../layout/ThemeToggle'
import { WindowControls } from '../layout/WindowControls'
import { useUiStore } from '../../stores/ui-store'

/**
 * 模块工作区顶栏 —— 面包屑 + 快速记录 + 窗口控制。
 *
 * 与原型的三处差异：
 *
 *  1. **窗口控制**。原型是浏览器里的静态页，没有这一栏。原生标题栏关掉之后
 *     （`decorations: false`）这是窗口唯一的关闭方式，必须补：macOS 圆点在左上角
 *     （面包屑之前），Windows/Linux 在右上角、贴齐窗口边。
 *  2. **主题开关换成应用的那一份**（`ThemeToggle` + `theme-store`，切 `<html data-theme>`）。
 *     原型各自持有 `.dark` 类 + localStorage `'theme'`，9 份互不相干；
 *     换外壳后主题必须是全站一个状态，否则"设置页切了暗色、工作台还是亮的"。
 *     ⚠️ 外观仍用原型的 `.theme-toggle` 类（传 `className` 进去），不吃应用程序里那套玻璃。
 *  3. **≤768px 补一个抽屉开关**。原型的媒体查询把侧栏整个 `display:none` 掉，
 *     窄屏上没有任何导航入口 —— 这不是"响应式取舍"，是功能缺失。
 *
 * 拖拽区写在 `<header>` 上（`deep` 档）：空白、文字、图标都能拖；
 * 按钮与输入框因为是可点元素，由 Tauri 主动阻断。
 * 双击标题栏的缩放由 Tauri 内置脚本接管，这里不重复实现（自己挂会变成"又最大化又全屏"）。
 */
export function WorkspaceTopbar({
  moduleLabel,
  tabLabel,
  actions,
}: {
  moduleLabel: string
  tabLabel: string
  /** 模块自己的顶栏动作（`+ 新建任务` / `✨ AI 拆解` / `+ 快速记录`…）。
   *  由页面传入 —— 外壳不认识各模块的业务动作，只负责把它们摆在对的位置。 */
  actions?: ReactNode
}) {
  const isMac = PLATFORM === 'macos'
  const openSidebar = useUiStore((state) => state.openSidebar)

  return (
    <header
      {...DRAG_REGION}
      className={cn('topbar', 'shell-frame-top-right shell-frame-top-left')}
    >
      {/* 左侧一组（窗口控制 + 抽屉开关 + 面包屑）必须**包一层**。
          原型的 `.topbar` 是 `justify-content: space-between` 且只有两个子元素
          （面包屑 / 动作区），所以面包屑贴在左边。这里多挂两个元素之后，
          space-between 会把四件东西均匀撒开 —— 面包屑跑到顶栏正中间去。
          包成两组，space-between 才恢复成"左右各一组"。 */}
      <div className="topbar-left">
        {isMac ? <WindowControls className="shrink-0" /> : null}

        {/* ≤768px 的抽屉开关。仅在侧栏被隐藏的断点下出现。 */}
        <button
          type="button"
          className="btn btn-ghost workspace-drawer-toggle"
          aria-label="打开导航"
          onClick={openSidebar}
        >
          ☰
        </button>

        <div className="breadcrumb">
          {moduleLabel} / <strong>{tabLabel}</strong>
        </div>
      </div>

      <div className="topbar-actions">
        {actions}
        <ThemeToggle className="theme-toggle" />
        {/* 账户入口只有一份实现（含退出登录），见 AccountMenu 的注释 */}
        <AccountMenu />
        {isMac ? null : <WindowControls className="shrink-0" />}
      </div>
    </header>
  )
}
