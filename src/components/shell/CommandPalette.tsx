import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../lib/cn'
import { Icon } from '../icons/Icon'
import type { IconName } from '../../types'
import type { ModuleTab } from '../../data/workspace/types'
import { SHELL_PRIMARY, type ShellPrimaryItem } from '../../data/workspace/shell-nav'
/**
 * 命令面板（⌘K）。
 *
 * ============================================================================
 * 它与原型的两处差异
 * ============================================================================
 *
 * ① **真的能跳**。原型的 `.cmd-item` 是纯 div，点了什么都不发生（静态页）。
 *    到了应用里这就是"看着有、点了没反应"——比不渲染更难查。
 *    这里的每一项都是 `navigate(path)`。
 *
 * ② **分组 + 过滤**。原型是固定的 8 行 + 写死的 `G D` 这类快捷键提示
 *    （那套 `G` 前缀组合键应用里没有实现，写上去就是在教一个不存在的功能）。
 *    换成"输入即过滤"：模块九项 + 当前模块的 Tab —— 后者是从
 *    `WorkspaceLayout` 传进来的**真实 Tab**，所以从面板里能直接跳到任意分区，
 *    不必先回到环上。
 *
 * ============================================================================
 * 键盘与焦点
 * ============================================================================
 *
 * · ⌘K / Ctrl+K 开关，Esc 关闭 —— 监听写在 `window` 上，因为面板关闭时
 *   焦点在页面任意处，挂在面板自己身上就永远收不到"打开"的那一次按键。
 * · ↑↓ 移动、Enter 选中。**选中项由下标维护，不是 `document.activeElement`** ——
 *   后者在重新渲染（过滤后列表变短）时会指到一个已经不存在的节点上。
 * · 打开后 `input.focus()` 要**延迟一帧**：面板这一帧还在 `display:none`（`.cmd-mask`
 *   默认隐藏），对隐藏元素调 focus 是静默失败的。
 */
export interface CommandTarget {
  key: string
  label: string
  /** 分组。**只参与过滤、不单独占一列** —— 右侧那一列（`.cmd-kbd`）留给了路径提示，
   *  它是原型里就有的位置，多插一列会把长标签挤到省略号。 */
  group: string
  icon: IconName
  path: string
  /** 右侧提示：模块给路径，分区给「当前」 */
  hint: string
}

/** 模块九项（面板与顶栏共用同一份，避免两处各列一遍模块） */
export function moduleTargets(primary: ShellPrimaryItem[] = SHELL_PRIMARY): CommandTarget[] {
  return primary.map((m) => ({
    key: `m:${m.key}`,
    label: m.label,
    group: '模块',
    icon: m.icon,
    path: m.path,
    hint: m.path === '/' ? '首页' : m.path,
  }))
}

/** 当前模块的分区 —— 从 `WorkspaceLayout` 传进来的**真实 Tab** 构造，
 *  所以面板里能直接跳到任意分区，不必先回到环上 */
export function tabTargets(
  moduleLabel: string,
  tabs: ModuleTab[],
  pathOf: (key: string, index: number) => string,
  activeKey: string,
  icons: (key: string) => IconName,
): CommandTarget[] {
  return tabs.map((tab, i) => ({
    key: `t:${tab.key}`,
    label: tab.label,
    group: moduleLabel,
    icon: icons(tab.key),
    path: pathOf(tab.key, i),
    hint: tab.key === activeKey ? '当前' : '',
  }))
}

export function CommandPalette({
  open,
  onClose,
  targets,
}: {
  open: boolean
  onClose: () => void
  targets: CommandTarget[]
}) {
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return targets
    return targets.filter((t) => `${t.label}${t.group}${t.hint}`.toLowerCase().includes(q))
  }, [query, targets])

  // 每次打开都从干净状态开始：上次的搜索词不该带过来（否则会以为"没结果"）
  useEffect(() => {
    if (!open) return
    setQuery('')
    setCursor(0)
    const id = window.setTimeout(() => inputRef.current?.focus(), 0)
    return () => window.clearTimeout(id)
  }, [open])

  // 过滤之后列表变短，选中下标要收进范围内 —— 否则 Enter 会落到 undefined 上
  useEffect(() => {
    setCursor((c) => (c < results.length ? c : Math.max(0, results.length - 1)))
  }, [results.length])

  // 选中项要滚进视野。用 scrollIntoView 而不是手算 top：列表有分组标题，手算会算漏
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-cursor="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [cursor, results.length])

  if (!open) return null

  const go = (target: CommandTarget | undefined) => {
    if (!target) return
    navigate(target.path)
    onClose()
  }

  return (
    <div
      className="cmd-mask open"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="cmd-panel" role="dialog" aria-modal="true" aria-label="跳转">
        <input
          ref={inputRef}
          className="cmd-input"
          value={query}
          placeholder="跳到模块或分区…"
          aria-label="搜索"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setCursor((c) => (results.length ? (c + 1) % results.length : 0))
            } else if (event.key === 'ArrowUp') {
              event.preventDefault()
              setCursor((c) => (results.length ? (c - 1 + results.length) % results.length : 0))
            } else if (event.key === 'Enter') {
              event.preventDefault()
              go(results[cursor])
            } else if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }
          }}
        />

        <div className="cmd-list" ref={listRef}>
          {results.length ? (
            results.map((target, i) => (
              <button
                key={target.key}
                type="button"
                className={cn('cmd-item', i === cursor && 'active')}
                data-cursor={i === cursor}
                onMouseEnter={() => setCursor(i)}
                onClick={() => go(target)}
              >
                <span className="cmd-item-icon">
                  <Icon name={target.icon} />
                </span>
                <span className="cmd-item-text">{target.label}</span>
                <span className="cmd-kbd">{target.hint}</span>
              </button>
            ))
          ) : (
            <div className="cmd-item">
              <span className="cmd-item-text">没有匹配的模块或分区</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * 全局快捷键。
 *
 * ⚠️ 只在**没有输入框持有焦点**时响应 —— 否则在搜索框里打 `k` 会被吃掉。
 *    `<input>` / `<textarea>` / `contenteditable` 三种都要排掉：
 *    各模块面板里都有表单（`panels.tsx` 的弹窗），漏一类就会在真实使用中冒出来。
 */
export function useCommandHotkey(onToggle: () => void) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const el = event.target as HTMLElement | null
      const typing =
        !!el &&
        (el.tagName === 'INPUT' ||
          el.tagName === 'TEXTAREA' ||
          el.tagName === 'SELECT' ||
          el.isContentEditable)
      if (typing && !(event.metaKey || event.ctrlKey)) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        onToggle()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onToggle])
}
