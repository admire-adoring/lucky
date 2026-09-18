import { SORT_OPTIONS, SCOPE_META } from '../../data/meta'
import { useUiStore } from '../../stores/ui-store'
import type { Scope, ScopeFilter, SortMode, ViewMode } from '../../types'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import type { IconName } from '../../types'

const VIEW_BUTTONS: { view: ViewMode; icon: IconName; label: string }[] = [
  { view: 'cards', icon: 'i-grid', label: '卡片视图' },
  { view: 'table', icon: 'i-list', label: '表格视图' },
  { view: 'kanban', icon: 'i-kanban', label: '看板视图' },
]

interface ToolbarProps {
  counts: Record<ScopeFilter, number>
}

/** 工具栏：scope 标签页 + 排序 + 视图切换 */
export function ProjectToolbar({ counts }: ToolbarProps) {
  const scope = useUiStore((state) => state.scope)
  const view = useUiStore((state) => state.view)
  const sort = useUiStore((state) => state.sort)
  const setScope = useUiStore((state) => state.setScope)
  const setView = useUiStore((state) => state.setView)
  const setSort = useUiStore((state) => state.setSort)

  const tabs: { key: ScopeFilter; label: string; scope?: Scope }[] = [
    { key: 'all', label: '全部' },
    { key: 'life', label: '生活', scope: 'life' },
    { key: 'work', label: '工作', scope: 'work' },
    { key: 'learn', label: '学习', scope: 'learn' },
  ]

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 border-b border-line pb-5">
      {/* 分段控件 = 一块沉槽玻璃 + 里面一枚抬升玻璃滑块 */}
      <div
        className="glass-soft flex gap-[3px] rounded-md border border-line bg-surface-sunken p-[3px]"
        role="tablist"
        aria-label="scope 筛选"
      >
        {tabs.map((tab) => {
          const active = scope === tab.key
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setScope(tab.key)}
              className={cn(
                'inline-flex h-[30px] items-center gap-[7px] rounded-[8px] border-0 px-[13px] text-13 font-semibold transition-all duration-150 ease-out',
                active
                  ? 'bg-surface-raised text-ink-900 shadow-sm'
                  : 'bg-transparent text-ink-500 hover:bg-ink-50 hover:text-ink-900',
              )}
            >
              {tab.scope ? (
                <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SCOPE_META[tab.scope].hex }} />
              ) : null}
              {tab.label}
              <span className={cn('text-11-5 font-bold tabular-nums', active ? 'text-ink-500' : 'text-ink-400')}>
                {counts[tab.key]}
              </span>
            </button>
          )
        })}
      </div>

      <div className="min-w-2 flex-1" />

      <div className="relative inline-flex items-center">
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortMode)}
          aria-label="排序方式"
          className="glass-soft h-9 cursor-pointer appearance-none rounded-md border border-line-strong bg-surface pl-3 pr-8 text-13 font-semibold text-ink-700 outline-none transition-all duration-150 ease-out hover:bg-surface-raised focus:border-brand-500 focus:shadow-[0_0_0_3.5px_rgba(79,70,229,.12)]"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon name="i-chevron" className="pointer-events-none absolute right-2.5 h-[14px] w-[14px] text-ink-400" />
      </div>

      <div
        className="glass-soft inline-flex gap-0.5 rounded-md border border-line bg-surface-sunken p-[3px]"
        role="tablist"
        aria-label="视图切换"
      >
        {VIEW_BUTTONS.map((item) => {
          const active = view === item.view
          return (
            <button
              key={item.view}
              type="button"
              role="tab"
              aria-selected={active}
              title={item.label}
              aria-label={item.label}
              onClick={() => setView(item.view)}
              className={cn(
                'inline-flex h-[30px] w-8 items-center justify-center rounded-[8px] border-0 transition-all duration-150 ease-out',
                active
                  ? 'bg-surface-raised text-ink-900 shadow-sm'
                  : 'bg-transparent text-ink-400 hover:bg-ink-50 hover:text-ink-700',
              )}
            >
              <Icon name={item.icon} className="h-4 w-4" />
            </button>
          )
        })}
      </div>
    </div>
  )
}
