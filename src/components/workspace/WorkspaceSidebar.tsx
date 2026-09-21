import { Fragment } from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { DRAG_REGION } from '../../lib/desktop-window'
import { WORKSPACE_NAV } from '../../data/workspace/nav'
import { useUiStore } from '../../stores/ui-store'

/**
 * 模块工作区侧栏 —— 5 分组、9 项。
 *
 * 三处与原型不同，都是"原型没解决"的问题，不是审美改动：
 *
 *  1. **每项带 `data-module`**，色点由 `§5` 按各自模块上色。原型里只有工作台那一份
 *     给 9 项配了色（`.menu-item.life .menu-dot`），另外 8 份的圆点全是"当前模块色"——
 *     9 个圆点长一个样，等于没有信息。侧栏本来就该是"九域的地图"。
 *  2. **可点击**。原型的 `.menu-item` 是纯 div、没有 `onclick`，9 个原型之间**互相跳不过去**。
 *     换成一个应用后这条必须补上，否则新外壳就是一间没有门的走廊。
 *  3. **≤768px 是抽屉而非消失**。原型那条媒体查询直接把侧栏 `display: none` ——
 *     窄屏上整页没有任何导航入口。见 `styles/workspace-shell.css`。
 *
 * 拖拽区写在 `<aside>` 上（`deep` 档）：空白处、文字都能拖窗口，
 * 而每个菜单项是 `<a>`（可点元素），Tauri 会主动阻断，不必逐个排除。
 */
export function WorkspaceSidebar() {
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const closeSidebar = useUiStore((state) => state.closeSidebar)

  return (
    <aside
      {...DRAG_REGION}
      className={cn('sidebar', 'shell-frame-left', sidebarOpen && 'is-open')}
      aria-label="模块导航"
    >
      {/* 用 Fragment 而不是包一层 div：`.sidebar` 是 flex 列、靠 `gap` 排版，
          多一层包裹会让分组标题与菜单项之间的间距由包裹层决定 —— 而 `.sidebar-title`
          自己带 `padding: 14px 12px 6px`，两者叠加就变成了双倍间距。 */}
      {WORKSPACE_NAV.map((group) => (
        <Fragment key={group.label}>
          <div className="sidebar-title">{group.label}</div>
          {group.items.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.path === '/'}
              data-module={item.key}
              onClick={closeSidebar}
              className={({ isActive }) => cn('menu-item', isActive && 'active')}
            >
              <span className="menu-dot" />
              {item.label}
            </NavLink>
          ))}
        </Fragment>
      ))}
    </aside>
  )
}
