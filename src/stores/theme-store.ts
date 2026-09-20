import { create } from 'zustand'
import { persistTheme, readStoredTheme, type Theme } from '../lib/theme'

interface ThemeState {
  /** 当前主题。初值在首帧前已由 main.tsx 落到 <html>，这里只是把它读进来做响应式。 */
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

/**
 * 主题状态。
 *
 * ⚠️ 这里**不用** zustand 的 `persist` 中间件，尽管 auth-store 用了它。
 * 原因是时序：`persist` 的回填发生在 store 创建之后，而主题必须在**首帧前**生效，
 * 否则会先渲染一帧亮色。所以持久化拆在 lib/theme.ts 里由 main.tsx 提前执行，
 * store 只负责"当前值 + 切换"，两件事各归各位。
 */
export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: readStoredTheme(),

  setTheme: (theme) => {
    persistTheme(theme)
    set({ theme })
  },

  toggleTheme: () => {
    get().setTheme(get().theme === 'light' ? 'dark' : 'light')
  },
}))
