import { useRef, type ChangeEvent } from 'react'
import { useEffect } from 'react'
import { Icon } from '../icons/Icon'

interface SearchFieldProps {
  value?: string
  onChange?: (value: string) => void
  /** 原型里详情页的搜索框未接逻辑 */
  readOnlyValue?: string
}

/**
 * 顶栏搜索框。
 *
 * ⚠️ **它不再占用 ⌘K**（2026-09-22 改）。原来这里绑了"⌘K 聚焦本输入框"，而模块工作区
 * 那套外壳把 ⌘K 绑给了**打开跳转面板** —— 于是同一个组合键在应用里有两个含义，
 * 取决于你此刻在哪个页面。原型自己的口径是统一的：顶栏那个搜索按钮的 `title` 写着
 * 「搜索 ⌘K」，点了却是 `openCmd()`，也就是**⌘K = 打开面板，而搜索是面板里的一件事**。
 * 所以这里让出这个键，`Esc` 失焦保留（那条没有歧义）。
 *
 * 三处调用点（`WorkbenchPage` / `ProjectsPage` / `ProjectDetailPage`）受影响的范围一致：
 * 都只是少了一个快捷键，输入框本身的行为不变。
 */
export function SearchField({ value, onChange }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') inputRef.current?.blur()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange?.(event.target.value)
  }

  return (
    <label className="relative flex max-w-[400px] flex-1 items-center">
      <Icon name="i-search" className="pointer-events-none absolute left-[11px] h-4 w-4 text-ink-400" />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={onChange ? handleChange : undefined}
        placeholder="搜索项目、任务、标签…"
        aria-label="搜索"
        className="glass-soft h-9 w-full rounded-md border border-transparent bg-ink-50 pl-[35px] pr-3.5 text-13-5 text-ink-900 outline-none transition-all duration-150 ease-out placeholder:text-ink-500 focus:border-brand-500 focus:bg-surface focus:shadow-[0_0_0_3.5px_rgba(79,70,229,.12)]"
      />
    </label>
  )
}
