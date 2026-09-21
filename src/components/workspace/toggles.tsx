import { createContext, useContext, useState, type ReactNode } from 'react'
import { cn } from '../../lib/cn'
import { useThemeStore } from '../../stores/theme-store'

/**
 * 三类「标记里带着状态」的受控替代品。
 *
 * 为什么必须替换而不能照搬：
 *   原型是静态页，状态写在**类名**上，由脚本命令式地改
 *   （`check.classList.toggle('done')`、`el.classList.toggle('on')`）。
 *   React 里类名每次渲染都由 props 重新算 —— 一旦重渲染（比如打开一个弹窗），
 *   命令式加上的类会被**原样覆盖掉**：勾选自己弹回去、开关自己关掉。
 *   这不是"不够 React"，而是**看得见的功能损坏**，所以必须换成受控。
 *
 * 反过来，类名一个都没改：`.task-check.done` / `.switch.on` 这些
 * 是生成的那份 CSS 在消费的接口，改了要连带改 CSS（而 CSS 是生成物）。
 */

/* ------------------------------------------------------------------ *
 * 任务行：`.task-item` / `.done-item`
 * ------------------------------------------------------------------ */

interface RowState {
  done: boolean
  toggle: () => void
}

/**
 * 用 Context 而不是把 done 传给每个子元素：
 *   原型里勾选会同时改**三处** —— `.task-check` 自己、兄弟 `.task-text`、
 *   以及已完成列表里的 `.done-text`。而这三处在标记里的嵌套深度不一
 *   （`.task-text` 在 `.task-body` 里，和 `.task-check` 是叔侄关系）。
 *   逐层传 props 要把 `.task-body` 也变成受控组件，等于为了一个状态
 *   改掉整棵子树的结构；Context 只让真正读它的那三个元素订阅。
 */
const RowContext = createContext<RowState | null>(null)

export function ToggleRow({
  defaultDone = false,
  children,
  className,
}: {
  defaultDone?: boolean
  children: ReactNode
  className?: string
}) {
  const [done, setDone] = useState(defaultDone)
  return (
    <RowContext.Provider value={{ done, toggle: () => setDone((v) => !v) }}>
      <div className={className}>{children}</div>
    </RowContext.Provider>
  )
}

/** 勾选块。点它切换整行 —— 与原型一致（原型只把监听挂在 `.task-check` 上）。 */
export function TaskCheck() {
  const state = useContext(RowContext)
  if (!state) return <div className="task-check" />
  return (
    <div
      className={cn('task-check', state.done && 'done')}
      role="checkbox"
      aria-checked={state.done}
      tabIndex={0}
      onClick={(event) => {
        // 原型里写了 stopPropagation：行本身可能也有点击（打开详情），别被冒泡吃掉
        event.stopPropagation()
        state.toggle()
      }}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          state.toggle()
        }
      }}
    >
      {state.done ? '✓' : ''}
    </div>
  )
}

export function TaskText({ children }: { children: ReactNode }) {
  const state = useContext(RowContext)
  return <div className={cn('task-text', state?.done && 'done')}>{children}</div>
}

export function DoneText({ children }: { children: ReactNode }) {
  const state = useContext(RowContext)
  return <div className={cn('done-text', state?.done && 'done')}>{children}</div>
}

/* ------------------------------------------------------------------ *
 * 开关
 * ------------------------------------------------------------------ */

/**
 * 设置页的开关。原型的初始态**写在标记里**（`class="switch on"`），
 * 所以这里用 `defaultOn` 而不是 `on` —— 迁移时不需要再判断一次，
 * 初始态仍然只有一个事实源（原型的标记）。
 */
export function Switch({ defaultOn = false }: { defaultOn?: boolean }) {
  const [on, setOn] = useState(defaultOn)
  return (
    <div
      className={cn('switch', on && 'on')}
      role="switch"
      aria-checked={on}
      tabIndex={0}
      onClick={() => setOn((v) => !v)}
      onKeyDown={(event) => {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault()
          setOn((v) => !v)
        }
      }}
    />
  )
}

/* ------------------------------------------------------------------ *
 * 主题色板
 * ------------------------------------------------------------------ */

type Swatch = 'light' | 'dark' | 'auto'

/**
 * 主题色板（亮 / 暗 / 跟随系统）。
 *
 * ⚠️ 与原型不同的一处：原型自己写 `localStorage.setItem('theme', …)` 并切 `.dark` 类，
 * 是全站第 N 份主题实现。这里接到应用的 `theme-store`（它写 `<html data-theme>`），
 * 顶栏那个主题开关因此与它会**互相同步** —— 否则会出现"设置页选了暗色、
 * 顶栏图标还显示月亮"这种两个真相源打架的情况。
 *
 * 「跟随系统」不在 store 的表达范围内（store 只有 light/dark），
 * 所以它在这里解析成当前系统偏好后再写进 store，并把 `auto` 记在本地。
 * 选中态记在本地是够的：**同时只会渲染一个面板**，全站不会有第二块色板。
 */
export function ThemeSwatches() {
  const theme = useThemeStore((state) => state.theme)
  const setTheme = useThemeStore((state) => state.setTheme)
  const [selected, setSelected] = useState<Swatch>(theme)

  const pick = (next: Swatch) => {
    setSelected(next)
    if (next === 'auto') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setTheme(prefersDark ? 'dark' : 'light')
      return
    }
    setTheme(next)
  }

  return (
    <div className="theme-preview">
      {(['light', 'dark', 'auto'] as Swatch[]).map((key) => (
        <div
          key={key}
          className={cn('theme-swatch', key, selected === key && 'active')}
          role="radio"
          aria-checked={selected === key}
          tabIndex={0}
          onClick={() => pick(key)}
          onKeyDown={(event) => {
            if (event.key === ' ' || event.key === 'Enter') {
              event.preventDefault()
              pick(key)
            }
          }}
        />
      ))}
    </div>
  )
}
