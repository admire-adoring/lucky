import type { ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useUiStore } from '../../stores/ui-store'
import { IconButton } from '../ui/IconButton'

/** 顶栏：hamburger（≤860px）+ 搜索 + 右侧操作区。
 *  玻璃拟态：内容会从它下面滚过，所以用最大的 blur 档（glass-bar）——
 *  挡住滚动内容靠的是 blur，厚度只是配角。厚度档与侧栏保持一致（都是 bg-surface），
 *  否则两块相邻的"外壳玻璃"会在交界处出现一道可辨的深浅差。 */
export function Topbar({ search, actions }: { search?: ReactNode; actions: ReactNode }) {
  const openSidebar = useUiStore((state) => state.openSidebar)

  return (
    <header
      className={cn(
        'glass-bar z-20 flex h-[60px] shrink-0 items-center gap-4 border-b border-line px-6 max-[1024px]:px-4',
        'bg-surface',
        'bg-[linear-gradient(180deg,rgba(255,255,255,.24)_0%,rgba(255,255,255,0)_100%)]',
      )}
    >
      <IconButton icon="i-hamburger" label="打开导航" variant="outline" onClick={openSidebar} />
      {search}
      <div className="flex-1" />
      {actions}
    </header>
  )
}
