import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useToastStore } from '../../stores/toast-store'
import type { Toast } from '../../types'

/* 不带动作的提示 2.1s 足够（它只是"收到了"）；带动作的必须更久 ——
   「撤销」是"要看清楚再点"的动作，破坏性操作得留够后悔的时间（原型 2200 / 6000 同此）。 */
const VISIBLE_MS = 2100
const ACTION_VISIBLE_MS = 6000
const EXIT_MS = 260

function ToastItem({ item, interactive }: { item: Toast; interactive: boolean }) {
  const dismiss = useToastStore((state) => state.dismiss)
  const [visible, setVisible] = useState(false)
  const visibleMs = item.action ? ACTION_VISIBLE_MS : VISIBLE_MS

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    const hide = setTimeout(() => setVisible(false), visibleMs)
    const remove = setTimeout(() => dismiss(item.id), visibleMs + EXIT_MS)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(hide)
      clearTimeout(remove)
    }
  }, [dismiss, item.id, visibleMs])

  return (
    <div
      role="status"
      className={cn(
        // 深色玻璃：半透明底 + 大 blur，让提示条是"浮在界面之上的一片深色镜面"
        'glass-bar flex items-center gap-1 rounded-xl border border-white/14 bg-[rgba(16,18,24,.82)] px-[18px] py-[11px] text-13-5 font-medium text-white shadow-[0_18px_40px_rgba(16,18,24,.26)] transition-all duration-[240ms] ease-out',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
        interactive && 'pointer-events-auto',
      )}
    >
      {item.message}
      {/* 动作按钮：先关掉这条提示，再执行 —— 留着它会让"已经做过了"看起来还能再做一次 */}
      {item.action ? (
        <button
          type="button"
          className="ml-1 rounded-md px-2 py-0.5 font-semibold text-white transition-colors hover:bg-white/16"
          onClick={() => {
            dismiss(item.id)
            item.action?.onClick()
          }}
        >
          {item.action.label}
        </button>
      ) : null}
    </div>
  )
}

/**
 * 顶部居中的轻量提示宿主。原型两处规格不同，这里按路由还原：
 * - 登录页  #toastHost{top:24px; z-index:60}，宿主 pointer-events:none 但单条提示是 auto
 * - 应用内  #toastHost{top:22px; z-index:80}，整层 pointer-events:none（不遮挡底下的点击）
 *
 * 带动作的提示在应用内也要能点：宿主仍是 `pointer-events-none`，
 *    但那一条自己放开（见 `interactive`）—— 否则"撤销"两个字点不动。
 */
export function ToastHost() {
  const toasts = useToastStore((state) => state.toasts)
  const { pathname } = useLocation()
  const onLogin = pathname === '/login'

  return (
    <div
      className={cn(
        'pointer-events-none fixed left-1/2 flex -translate-x-1/2 flex-col items-center gap-2',
        onLogin ? 'top-6 z-[60]' : 'top-[22px] z-[80]',
      )}
    >
      {toasts.map((item) => (
        <ToastItem key={item.id} item={item} interactive={onLogin || Boolean(item.action)} />
      ))}
    </div>
  )
}
