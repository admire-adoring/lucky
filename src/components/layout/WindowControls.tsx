import { useEffect, useState } from 'react'
import { cn } from '../../lib/cn'
import {
  PLATFORM,
  closeWindow,
  isDesktopShell,
  minimizeWindow,
  subscribeWindowState,
  toggleFullscreenWindow,
  toggleMaximizeWindow,
  type WindowState,
} from '../../lib/desktop-window'
import { Icon } from '../icons/Icon'
import type { IconName } from '../../types'

/**
 * 自绘窗口控制 —— **按操作系统给三套，形状与行为都对各自平台原生**。
 *
 * 原生标题栏已由 `src-tauri/tauri.conf.json` 的 `decorations: false` 关闭，
 * 所以这组按钮是窗口唯一的关闭方式。设计口径是"替代品要长得像原物"，
 * 而不是"让它融入我们的配色"——这是两套不同的正确性标准，这里按前者：
 *
 * | | 位置 | 形状 | 第三个键 |
 * | --- | --- | --- | --- |
 * | macOS | 左上角 | 12px 圆点、间距 8px、红/黄/绿 | **全屏** |
 * | Windows | 右上角、贴齐窗口边 | 46×32 方形扁平按钮 + 1px 细字形 | **最大化** |
 * | Linux | 右上角 | 24px 圆形按钮 | **最大化** |
 *
 * 三个容易漏掉的原生细节，这里都做了：
 *  1. **顺序随平台反向**：macOS 自左向右是「关闭→最小化→全屏」；
 *     Windows/Linux 自左向右是「最小化→最大化→关闭」。共用一份数组必然有一边是反的。
 *  2. **失焦变灰**：macOS 三个圆点在窗口失焦时一起变灰、且不浮字形（原生行为），
 *     靠 `onFocusChanged` 取状态。
 *  3. **字形整组一起浮出**（macOS）：hover 判定挂在容器上（`group/mac`），不是逐个圆点。
 *
 * macOS 圆点视觉直径 12px，按钮盒做成 20px：内边距 4px 让**视觉间距**正好是原生的 8px，
 * 同时把命中区从 12px 抬到 20px（12px 的点击目标对鼠标也偏小）。
 *
 * ⚠️ 只要某个页面没有顶栏（登录页），或某个断点下侧栏被收成抽屉（≤860px 的 macOS），
 * 就必须另外挂一份 —— 漏掉的症状是"窗口关不掉"，这是最容易忽略的一类缺口。
 */

const MAC_DOTS = {
  close: 'bg-[#ff5f57]',
  minimize: 'bg-[#febc2e]',
  fullscreen: 'bg-[#28c840]',
} as const

interface WindowControlsProps {
  /** 由宿主控制显隐与定位（例如 macOS 在窄断点要把整组挪到顶栏） */
  className?: string
}

export function WindowControls({ className }: WindowControlsProps) {
  const desktop = isDesktopShell()
  const isMac = PLATFORM === 'macos'
  const [state, setState] = useState<WindowState>({ fullscreen: false, maximized: false, focused: true })

  useEffect(() => {
    if (!desktop) return
    let disposed = false
    let off: (() => void) | undefined
    void subscribeWindowState((next) => {
      if (!disposed) setState(next)
    }).then((fn) => {
      // 订阅是异步建立的：若组件已卸载就立刻退订，避免泄漏与 setState 到已卸载组件
      if (disposed) fn()
      else off = fn
    })
    return () => {
      disposed = true
      off?.()
    }
  }, [desktop])

  // 浏览器里保留同一套按钮（版式与桌面端一致），只把"做不到"写进无障碍名。
  // 不藏、也不做成禁用态：藏起来两处版式不一致，禁用态会被误读成"功能坏了"。
  const hint = desktop ? '' : '（仅桌面端生效）'

  if (isMac) {
    const dots = [
      { key: 'close', color: MAC_DOTS.close, glyph: 'i-mac-close', label: '关闭窗口', run: closeWindow },
      { key: 'minimize', color: MAC_DOTS.minimize, glyph: 'i-mac-min', label: '最小化窗口', run: minimizeWindow },
      {
        key: 'fullscreen',
        color: MAC_DOTS.fullscreen,
        glyph: 'i-mac-full',
        label: state.fullscreen ? '退出全屏' : '进入全屏',
        run: toggleFullscreenWindow,
      },
    ] as { key: string; color: string; glyph: IconName; label: string; run: () => Promise<void> }[]

    return (
      <div className={cn('group/mac flex shrink-0 items-center', className)} role="group" aria-label="窗口控制">
        {dots.map((dot) => (
          <button
            key={dot.key}
            type="button"
            aria-label={`${dot.label}${hint}`}
            title={`${dot.label}${hint}`}
            onClick={() => void dot.run()}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
          >
            <span
              className={cn(
                'flex h-3 w-3 items-center justify-center rounded-full border-[.5px] border-black/[.12] transition-colors duration-150',
                // 失焦整组变灰 —— macOS 上最容易被漏掉的原生行为
                state.focused ? dot.color : 'bg-[#d6d3d2]',
              )}
            >
              <Icon
                name={dot.glyph}
                className={cn(
                  'h-[7px] w-[7px] text-black/[.55] transition-opacity duration-100',
                  state.focused ? 'opacity-0 group-hover/mac:opacity-100' : 'opacity-0',
                )}
              />
            </span>
          </button>
        ))}
      </div>
    )
  }

  const isWindows = PLATFORM === 'windows'
  const box = isWindows
    ? 'flex h-8 w-[46px] items-center justify-center rounded-none border-0 bg-transparent transition-colors duration-100'
    : 'flex h-6 w-6 items-center justify-center rounded-full border-0 bg-transparent transition-colors duration-100'
  const neutral = cn(box, 'text-ink-800 hover:bg-ink-100')
  // 关闭键 hover 取各自平台的原生红：Win11 = #c42b1c，GNOME(Adwaita) = #e01b24
  const danger = cn(
    box,
    isWindows ? 'text-ink-800 hover:bg-[#c42b1c] hover:text-white' : 'text-ink-700 hover:bg-[#e01b24] hover:text-white',
  )

  const items: { key: string; icon: IconName; label: string; run: () => Promise<void>; className: string }[] = [
    { key: 'min', icon: 'i-win-min', label: '最小化窗口', run: minimizeWindow, className: neutral },
    {
      // 最大化/还原用两组字形切换，与原生一致
      key: 'max',
      icon: state.maximized ? 'i-win-restore' : 'i-win-max',
      label: state.maximized ? '向下还原' : '最大化窗口',
      run: toggleMaximizeWindow,
      className: neutral,
    },
    { key: 'close', icon: 'i-win-close', label: '关闭窗口', run: closeWindow, className: danger },
  ]

  return (
    <div className={cn('ml-2 flex shrink-0 items-center gap-0', className)} role="group" aria-label="窗口控制">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          aria-label={`${item.label}${hint}`}
          title={`${item.label}${hint}`}
          onClick={() => void item.run()}
          className={item.className}
        >
          <Icon name={item.icon} className="h-2.5 w-2.5" />
        </button>
      ))}
    </div>
  )
}
