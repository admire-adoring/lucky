import { getCurrentWindow } from '@tauri-apps/api/window'

/**
 * 桌面窗口能力适配层。
 *
 * 为什么单独一层：这套界面同时跑在两个宿主里 —— 桌面壳（Tauri）和浏览器（vite dev / dist 预览）。
 * `getCurrentWindow()` 会去读 `window.__TAURI_INTERNALS__`，在浏览器里直接抛错。
 * 所以组件永远只调用本文件的函数，由这里决定"在桌面壳里真调、在浏览器里静默 no-op"。
 * 判据只有一条：`__TAURI_INTERNALS__` 是否存在 —— 这是 Tauri v2 注入的全局，
 * 比嗅探 userAgent 或端口号都可靠。
 *
 * 与 `src/api/` 同一套思路：宿主差异收在一层里，组件和 hooks 不感知。
 */

type DesktopWindow = ReturnType<typeof getCurrentWindow>

/**
 * 宿主平台。窗口控制要**长得像那个系统的原生控制**，所以必须先知道自己在哪。
 *
 * 判据优先级：`navigator.userAgentData.platform`（Chromium 系，值形如 "macOS" / "Windows"）
 * → 回落 `navigator.userAgent`。
 * 注意这里判的是**宿主操作系统**，浏览器预览跑在 macOS 上也会得到 'macos' ——
 * 这正是我们想要的：预览里看到的就是该平台的分支，不必等打包到真机才发现不对。
 */
export type DesktopPlatform = 'macos' | 'windows' | 'linux'

function detectPlatform(): DesktopPlatform {
  if (typeof navigator === 'undefined') return 'linux'
  const hinted = (navigator as Navigator & { userAgentData?: { platform?: string } }).userAgentData?.platform
  const probe = `${hinted ?? ''} ${navigator.userAgent}`
  // 先判 Windows：它的 UA 里不会出现 Mac 字样，但顺序写反不影响，这里显式排开更易读
  if (/Windows/i.test(probe)) return 'windows'
  if (/Macintosh|Mac OS X|macOS/i.test(probe)) return 'macos'
  return 'linux'
}

/** 平台在模块加载时定一次：操作系统不会在运行中变，组件里反复算没意义 */
export const PLATFORM: DesktopPlatform = detectPlatform()

/** 当前是否跑在 Tauri 桌面壳里（浏览器里为 false） */
export function isDesktopShell(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function current(): DesktopWindow | null {
  if (!isDesktopShell()) return null
  try {
    return getCurrentWindow()
  } catch {
    return null
  }
}

export async function minimizeWindow(): Promise<void> {
  await current()?.minimize()
}

export async function closeWindow(): Promise<void> {
  await current()?.close()
}

/**
 * 切换全屏（macOS 那第三个绿点）。
 * 用户点名的是「全屏」而不是「最大化」—— 原生绿点就是全屏，所以 macOS 走这条。
 */
export async function toggleFullscreenWindow(): Promise<void> {
  const win = current()
  if (!win) return
  await win.setFullscreen(!(await win.isFullscreen()))
}

/**
 * 切换最大化（Windows / Linux 中间那个键）。
 * 和 macOS 的全屏是两件事：最大化只是铺满可用工作区，不隐藏系统 UI、不进 macOS 的
 * 独立 Space，所以两个平台的中间键给了不同的命令 —— "和系统一样"要求的就是这个差别。
 */
export async function toggleMaximizeWindow(): Promise<void> {
  await current()?.toggleMaximize()
}

/** 自绘控制需要知道的三件窗口状态，一次订阅全部拿到 */
export interface WindowState {
  fullscreen: boolean
  maximized: boolean
  /** 窗口是否处于焦点。macOS 的三个圆点在失焦时会一起变灰，这是原生行为里最容易被漏掉的一条 */
  focused: boolean
}

/**
 * 订阅窗口状态。返回退订函数，组件卸载必须调用。
 *
 * Tauri v2 没有 `onFullscreenChanged` / `onMaximizedChanged`，
 * 但进出全屏、最大化都必然伴随一次窗口尺寸变化，所以用 `onResized` 触发、再回查；
 * 焦点则用 `onFocusChanged`。比轮询可靠，也比自己在各处维护状态稳。
 */
export async function subscribeWindowState(onChange: (state: WindowState) => void): Promise<() => void> {
  const win = current()
  if (!win) return () => {}

  let disposed = false
  const read = async (): Promise<void> => {
    try {
      const [fullscreen, maximized, focused] = await Promise.all([
        win.isFullscreen(),
        win.isMaximized(),
        win.isFocused(),
      ])
      if (!disposed) onChange({ fullscreen, maximized, focused })
    } catch {
      /* 命令被 ACL 拒绝或窗口正在销毁：保持上一次状态，不把异常抛到渲染层 */
    }
  }

  const offResized = await win.onResized(() => void read())
  const offFocus = await win.onFocusChanged(() => void read())
  void read()

  return () => {
    disposed = true
    offResized()
    offFocus()
  }
}

/**
 * 拖拽区标记（Tauri 的 `data-tauri-drag-region`）。
 *
 * 取值有三档（来自 tauri 的 `src/window/scripts/drag.js`，不是猜的）：
 *   - 裸属性 / "" / "true" → **只认自身**：只有直接按在这个元素上才拖
 *   - "deep"               → 认整棵子树：子树里任意一处按下都拖（可点元素除外）
 *   - "false"              → 在该元素处禁用拖拽
 * 判定方式是沿 `event.composedPath()` 从事件目标往上走，遇到
 * 「可点元素（button/a/input/select/textarea/label/summary、带 tabindex、交互 role）
 *  且自身没有这个属性」就**直接返回 false** 阻断。
 *
 * 所以外壳用 `deep` 一档就够了：写在顶栏与侧栏品牌行的**容器**上，
 * 空白处、文字、图标都能拖；搜索框与各种按钮因为是可点元素，自动不触发拖拽，
 * 不需要额外加 stopPropagation，也不需要把属性逐层铺到每个子元素上。
 *
 * ⚠️ 双击标题栏**不要自己实现**。同一个脚本里 Tauri 已经接管了：
 * mousedown 双击 → `internal_toggle_maximize`（Windows/Linux 即时触发；
 * macOS 改在 mouseup 触发，且鼠标移动过就取消，以对齐系统行为）。
 * 我们再挂一个 onDoubleClick 去 setFullscreen，就会变成"既最大化又全屏"。
 */
export const DRAG_REGION = { 'data-tauri-drag-region': 'deep' } as const
