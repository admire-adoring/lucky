import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { PLATFORM, isDesktopShell } from './lib/desktop-window'
import { bootstrapTheme } from './lib/theme'
import './styles/index.css'

/**
 * 把宿主信息写到 <html> 上，供 CSS 选择器使用。
 *
 * 为什么放在渲染之前、用 data-* 而不是 React 状态：
 * 这两件事影响的是**整个页面**（窗口圆角、透明底衬、平台专属尺寸），
 * 而且必须首帧就位 —— 走 React 会先渲染一帧方角窗口再跳到圆角，肉眼可见地闪一下。
 * 挂在 documentElement 上还有个好处：`html[data-shell='desktop']` 的优先级
 * 稳定高于任何工具类，不必和 Tailwind 的同属性工具类抢"谁生效"。
 *
 *  - `data-platform`：macOS / Windows / Linux 三套分支的开关（窗口控制的形状、窗口圆角）
 *  - `data-shell`：desktop（Tauri）/ browser（vite dev 与 dist 预览）
 *    只有 desktop 才把页面做成透明 + 自绘圆角；浏览器里保持不透明方角，
 *    否则预览与审计截图的四角会是空洞，反而看不出真问题。
 *
 * 主题（`data-theme` / `data-glass`）走同一个入口、同一个理由：首帧必须就位。
 * 区别是它**允许**被 React 事后改（顶栏有切换按钮），见 stores/theme-store.ts。
 */
document.documentElement.dataset.platform = PLATFORM
document.documentElement.dataset.shell = isDesktopShell() ? 'desktop' : 'browser'
bootstrapTheme()

const container = document.getElementById('root')

if (!container) {
  throw new Error('未找到 #root 挂载点')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
