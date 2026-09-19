import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useAuthStore } from '../../stores/auth-store'
import { toast } from '../../stores/toast-store'
import type { IconName } from '../../types'
import { Icon } from '../icons/Icon'
import { Avatar } from '../ui/Avatar'

/**
 * 账户菜单 —— 顶栏胶囊与侧栏底部账户行共用。
 *
 * 为什么做成一个组件而不是两处各写一份：
 * 退出登录是**改变会话状态**的操作，只能有一个实现。两份实现迟早会漂移
 * （一处清了 store 但忘了跳转，另一处跳转了但没清 store），而这类 bug
 * 只在"未登录却还停在工作台"时才暴露，很难被测到。
 *
 * 弹层方向按入口分：侧栏那一行贴在窗口底部，只能**向上**弹；
 * 顶栏那一颗在窗口顶部，只能**向下**弹。这是位置决定的，不是风格选择。
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

/** 侧栏入口：整行可点，展示姓名与邮箱 */
const TRIGGER_SIDEBAR =
  'flex w-full items-center gap-2.5 rounded-md p-2 text-left transition-colors duration-150 hover:bg-ink-50'

/** 顶栏入口：胶囊，只有头像与箭头 */
const TRIGGER_TOPBAR =
  'glass-soft inline-flex items-center gap-1.5 rounded-full border border-line bg-surface py-[3px] pl-[3px] pr-2 transition-all duration-150 ease-out hover:bg-surface-raised'

export function AccountMenu({ variant = 'topbar', className }: AccountMenuProps) {
  const navigate = useNavigate()
  const user = useAuthStore((state) => state.user)
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

  const actions: MenuAction[] = [
    { key: 'profile', label: '个人资料', icon: 'i-user', run: () => { close(); toast('原型演示：个人资料页未包含') } },
    { key: 'settings', label: '偏好设置', icon: 'i-settings', run: () => { close(); toast('原型演示：偏好设置页未包含') } },
  ]

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
        className={isSidebar ? TRIGGER_SIDEBAR : TRIGGER_TOPBAR}
      >
        {/* 头像用登录用户的 initials，姓名与邮箱也取自会话 —— 不再写死，
            否则换个账号登录后菜单里还是上一个身份 */}
        <Avatar name={user?.initials ?? '—'} size={isSidebar ? 'md' : 'sm'} />
        {isSidebar ? (
          <span className="min-w-0 flex-1">
            <b className="block text-13 font-semibold leading-[1.35]">{user?.name ?? '未登录'}</b>
            {/* 邮箱用 ink-500 而非 ink-400：它是这条侧栏里唯一"承载信息"的小字 */}
            <span className="block truncate text-11-5 leading-[1.35] text-ink-500">{user?.email ?? ''}</span>
          </span>
        ) : null}
        <Icon
          name="i-chevron"
          className={cn(
            'shrink-0 transition-transform duration-150 ease-out',
            isSidebar ? 'h-[15px] w-[15px] text-ink-300' : 'h-[13px] w-[13px] text-ink-400',
            // 两个入口的箭头都朝下，展开时翻转 180° —— "箭头指向弹层出现的方向"
            open ? 'rotate-180' : 'rotate-0',
          )}
        />
      </button>

      {open ? (
        <div
          ref={menuRef}
          role="menu"
          aria-label="账户"
          aria-orientation="vertical"
          className={cn(
            // 用 glass-bar（最大模糊档）：它下面会盖住卡片与正文，
            // 糊不干净就会出现"能辨认出底下文字"的鬼影，反而不像玻璃。
            'glass-bar absolute z-50 animate-fade-up rounded-lg border border-line bg-surface-raised p-1.5 shadow-xl',
            // 侧栏贴窗口底部 → 只能向上弹；顶栏贴顶部 → 只能向下弹
            isSidebar ? 'bottom-full left-0 right-0 mb-2' : 'right-0 top-full mt-2 w-[248px]',
          )}
        >
          {/* 抬头：身份信息只读展示 */}
          <div className="mb-1 flex items-center gap-2.5 border-b border-line px-2 pb-2.5 pt-1.5">
            <Avatar name={user?.initials ?? '—'} size="sm" />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-12-5 font-semibold leading-[1.4]">{user?.name ?? '未登录'}</b>
              <span className="block truncate text-11-5 leading-[1.4] text-ink-500">{user?.email ?? ''}</span>
            </span>
          </div>

          {actions.map((action) => (
            <button
              key={action.key}
              type="button"
              role="menuitem"
              onClick={action.run}
              className="flex w-full items-center gap-2.5 rounded-sm px-2 py-[7px] text-left text-13 font-medium text-ink-700 outline-none transition-colors duration-150 hover:bg-ink-50 focus-visible:bg-ink-50"
            >
              <Icon name={action.icon} className="h-[15px] w-[15px] shrink-0 text-ink-400" />
              {action.label}
            </button>
          ))}

          <div className="my-1.5 h-px bg-line" />

          {/* 唯一会改变会话状态的项：色阶用 -strong 而不是主色阶 ——
              主色阶压在半透明底上只有 3.8:1 左右，-strong 能到 5:1 以上。
              （判据与 scope 徽标、侧栏激活态一致：承载文字的色阶必须比色条更深一档。） */}
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            className="flex w-full items-center gap-2.5 rounded-sm px-2 py-[7px] text-left text-13 font-semibold text-danger-strong outline-none transition-colors duration-150 hover:bg-danger-bg focus-visible:bg-danger-bg"
          >
            <Icon name="i-logout" className="h-[15px] w-[15px] shrink-0" />
            退出登录
          </button>
        </div>
      ) : null}
    </div>
  )
}
