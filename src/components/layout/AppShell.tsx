import { createContext, useContext, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { cn } from '../../lib/cn'
import { useUiStore } from '../../stores/ui-store'
import { Sidebar } from './Sidebar'

const ScrollAreaContext = createContext<RefObject<HTMLDivElement | null> | null>(null)

/** 详情页切换标签时需要把滚动容器滚回顶部 */
export function useScrollArea() {
  return useContext(ScrollAreaContext)
}

interface AppShellProps {
  topbar: ReactNode
  children: ReactNode
  /** 内容区内边距：列表页与详情页略有差异 */
  scrollPadding?: 'list' | 'detail'
}

export function AppShell({ topbar, children, scrollPadding = 'list' }: AppShellProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const sidebarOpen = useUiStore((state) => state.sidebarOpen)
  const closeSidebar = useUiStore((state) => state.closeSidebar)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeSidebar()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [closeSidebar])

  return (
    <ScrollAreaContext.Provider value={scrollRef}>
      <div className="flex h-screen overflow-hidden">
        <Sidebar />

        {/* 抽屉遮罩：玻璃拟态下用"霜化"代替压黑 —— 背后仍是可辨认的界面，只是被糊掉 */}
        <div
          onClick={closeSidebar}
          className={cn(
            'fixed inset-0 z-[29] bg-[rgba(16,18,24,.26)] backdrop-blur-[8px] backdrop-saturate-[140%]',
            sidebarOpen ? 'block' : 'hidden',
          )}
        />

        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {topbar}
          <div
            ref={scrollRef}
            className={cn(
              'flex-1 overflow-y-auto overflow-x-hidden',
              scrollPadding === 'list'
                ? 'px-6 pb-16 pt-6 max-[1024px]:px-4 max-[1024px]:pb-12 max-[1024px]:pt-5'
                : 'px-6 pb-16 pt-5 max-[1024px]:px-4 max-[1024px]:pb-12 max-[1024px]:pt-4',
            )}
          >
            {children}
          </div>
        </div>
      </div>
    </ScrollAreaContext.Provider>
  )
}
