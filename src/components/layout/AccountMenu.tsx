import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useMe } from '../../hooks/use-me'
import { useAuthStore } from '../../stores/auth-store'
import { toast } from '../../stores/toast-store'
import type { IconName } from '../../types'
import { Icon } from '../icons/Icon'
import { Avatar } from '../ui/Avatar'

/**
 * 账户菜单 —— 顶栏胶囊与侧栏底部账户行共用。
 *
 * 为什么做成一个组件而不是两处各写一份：
 * 退出登录是改变会话状态的操作，只能有一个实现。两份实现迟早会漂移
 * （一处清了 store 但忘了跳转，另一处跳转了但没清 store），而这类 bug
 * 只在"未登录却还停在工作台"时才暴露，很难被测到。
 *
 * 弹层方向按入口分：侧栏那一行贴在窗口底部，只能向上弹；
 * 顶栏那一颗在窗口顶部，只能向下弹。这是位置决定的，不是风格选择。
 */

type Variant = 'sidebar' | 'topbar'

interface AccountMenuProps {
  variant?: Variant
  className?: string
}

interface MenuAction {
  key: string
  label: string
  icon: IconName
  run: () => void
}

/**
 * 两个入口的盒模型都在 `sidebar-shell.css` 的「账户菜单」段里（`.acct-trigger` / `.acct-row`）。
 * 这里只留 `cn` 那点尾巴：类名在别处定义，改这里等于改结构。
 */
const TRIGGER_SIDEBAR = 'acct-row'
const TRIGGER_TOPBAR = 'acct-trigger'

export function AccountMenu({ variant = 'topbar', className }: AccountMenuProps) {
  const navigate = useNavigate()
  const me = useMe()
  const signOut = useAuthStore((state) => state.signOut)
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const isSidebar = variant === 'sidebar'

  /**
   * 关闭 + 退回焦点到触发器。
   * 焦点必须还回去：菜单是用键盘打开的（回车／空格），关掉之后焦点若留在
   * 已卸载的节点上，浏览器会把焦点丢回 <body>，键盘用户就得从头 Tab 一遍。
   */
  const close = (refocus = false) => {
    setOpen(false)
    if (refocus) rootRef.current?.querySelector<HTMLElement>('[data-account-trigger]')?.focus()
  }

  // 关闭时机一：点到菜单与触发器之外
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  // 关闭时机二：Esc。监听挂在 document 上，焦点在菜单内任意处都能收起
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation()
        close(true)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open])

  // 打开后把焦点送进菜单，键盘可以直接上下走
  useEffect(() => {
    if (!open) return
    menuRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [open])

  /**
   * 退出登录：清会话 → 回登录页。
   *
   * 顺序上先 signOut 再 navigate。反过来的话，navigate 会先触发 RequireAuth 的重定向，
   * 出现一次"两次跳转"的目录闪烁；而 `replace: true` 是为了让后退键不回到工作台
   * —— 会话已经结束，后退到工作台只会被重定向回登录页，白白制造一次闪烁。
   * 提示语放在两者之间：ToastHost 挂在 Routes 之外，跳转到登录页后仍然可见。
   */
  const handleSignOut = () => {
    close()
    signOut()
    toast('已退出登录')
    navigate('/login', { replace: true })
  }

  /**
   * 两个入口落到设置模块的真实分区上 —— 不是弹个提示。
   *
   * `个人资料` → `/settings/account`：读写 `app_user`（改名、成员名单、本机库路径与计数）。
   * `偏好设置` → `/settings/appearance`：颜色模式，以及 `app_setting` 里
   *    `category='appearance'` 的那几个开关。
   *
   * 先 close 再 navigate：菜单挂在顶栏里，不关的话它会在新页面上继续悬着，
   * 而那时候用户已经在看设置了。
   */
  const openSettings = (path: string) => {
    close()
    navigate(path)
  }

  const actions: MenuAction[] = [
    { key: 'profile', label: '个人资料', icon: 'i-user', run: () => openSettings('/settings/account') },
    { key: 'settings', label: '偏好设置', icon: 'i-settings', run: () => openSettings('/settings/appearance') },
  ]

  /* 显示用的一份。名字取自库，改完名立刻跟着变；空串给占位。 */
  const displayName = me.name || '未登录'
  const initials = me.initials || '—'
  const note = me.note || '未登录'

  return (
    <div
      ref={rootRef}
      // 弹层要显式关掉窗口拖拽：顶栏整条是 `deep` 拖拽区，
      // 菜单里的分隔线、头像、姓名都不是"可点元素"，不关的话按住它们会拖动窗口
      // （drag.js 里 `false` 一档正是为此存在，且对整棵子树生效）。
      data-tauri-drag-region="false"
      className={cn('relative', isSidebar ? 'w-full' : 'shrink-0', className)}
    >
      <button
        type="button"
        data-account-trigger
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={isSidebar ? undefined : '账户菜单'}
        onClick={() => (open ? close() : setOpen(true))}
        className={cn(isSidebar ? TRIGGER_SIDEBAR : TRIGGER_TOPBAR, open && 'is-open')}
      >
        {/* 头像与姓名取自库里的 `app_user`（`is_me` 那一行），不是登录页那份占位会话 */}
        <Avatar name={initials} size={isSidebar ? 'md' : 'sm'} />
        {isSidebar ? (
          <span className="acct-id">
            <b className="acct-name">{displayName}</b>
            {/* 这行小字比姓名浅一档：它是这一条里唯一"承载信息"的副标题 */}
            <span className="acct-mail">{note}</span>
          </span>
        ) : null}
        <Icon name="i-chevron" className="shrink-0" />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="账户"
          aria-orientation="vertical"
          /* 定位 / 内边距 / 投影全在 `sidebar-shell.css` 的「账户菜单」段里。
             这里不写 `absolute` 之类的工具类：那条复位规则会把间距清零，
             而 `glass-*` 会带来一条同属性的 `position: relative`。 */
          className={cn('acct-menu', isSidebar ? 'up' : 'down')}
        >
          {/* 抬头：身份信息只读展示。用一块沉槽底把它和下面的操作分开 ——
              分隔线只能说明"这是两段"，一层浅底才说明"上面这段不是按钮"。 */}
          <div className="acct-head">
            <Avatar name={initials} size="md" />
            <span className="acct-id">
              <b className="acct-name">{displayName}</b>
              <span className="acct-mail">{note}</span>
            </span>
          </div>

          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              onClick={action.run}
              className="acct-item"
            >
              <Icon name={action.icon} />
              {action.label}
            </button>
          ))}

          <div className="acct-sep" />

          {/* 唯一会改变会话状态的项：整行红字 + 红底悬停。 */}
          <button type="button" role="menuitem" onClick={handleSignOut} className="acct-item danger">
            <Icon name="i-logout" />
            退出登录
          </button>
        </div>
      ) : null}
    </div>
  )
}
