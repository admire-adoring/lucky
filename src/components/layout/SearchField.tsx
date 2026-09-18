import { useRef, type ChangeEvent } from 'react'
import { useEffect } from 'react'
import { Icon } from '../icons/Icon'

interface SearchFieldProps {
  value?: string
  onChange?: (value: string) => void
  /** 原型里详情页的搜索框未接逻辑 */
  readOnlyValue?: string
}

/** 顶栏搜索：⌘K / Ctrl+K 聚焦、Esc 失焦（与原型一致） */
export function SearchField({ value, onChange }: SearchFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        inputRef.current?.focus()
      }
      if (event.key === 'Escape') {
        inputRef.current?.blur()
      }
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
        className="glass-soft h-9 w-full rounded-md border border-transparent bg-ink-50 pl-[35px] pr-[62px] text-13-5 text-ink-900 outline-none transition-all duration-150 ease-out placeholder:text-ink-400 focus:border-brand-500 focus:bg-surface focus:shadow-[0_0_0_3.5px_rgba(79,70,229,.12)] max-[860px]:pr-3"
      />
      <kbd className="glass-soft absolute right-[9px] rounded-[5px] border border-line bg-surface-raised px-1.5 py-0.5 font-mono text-10-5 leading-[1.5] text-ink-400 max-[860px]:hidden">
        ⌘K
      </kbd>
    </label>
  )
}
