import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { useToastStore } from '../../stores/toast-store'
import type { Toast } from '../../types'

const VISIBLE_MS = 2100
const EXIT_MS = 260

function ToastItem({ item, interactive }: { item: Toast; interactive: boolean }) {
  const dismiss = useToastStore((state) => state.dismiss)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true))
    const hide = setTimeout(() => setVisible(false), VISIBLE_MS)
    const remove = setTimeout(() => dismiss(item.id), VISIBLE_MS + EXIT_MS)

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(hide)
      clearTimeout(remove)
    }
  }, [dismiss, item.id])

  return (
    <div
      role="status"
      className={cn(
        // 深色玻璃：半透明底 + 大 blur，让提示条是"浮在界面之上的一片深色镜面"
        'glass-bar rounded-xl border border-white/14 bg-[rgba(16,18,24,.82)] px-[18px] py-[11px] text-13-5 font-medium text-white shadow-[0_18px_40px_rgba(16,18,24,.26)] transition-all duration-[240ms] ease-out',
        visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0',
        interactive && 'pointer-events-auto',
      )}
    >
      {item.message}
    </div>
  )
}

/**
 * 顶部居中的轻量提示宿主。原型两处规格不同，这里按路由还原：
 * - 登录页  #toastHost{top:24px; z-index:60}，宿主 pointer-events:none 但单条提示是 auto
 * - 应用内  #toastHost{top:22px; z-index:80}，整层 pointer-events:none（不遮挡底下的点击）
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
        <ToastItem key={item.id} item={item} interactive={onLogin} />
      ))}
    </div>
  )
}
