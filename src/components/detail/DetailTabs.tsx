import { cn } from '../../lib/cn'
import type { DetailTab } from '../../types'

interface DetailTabsProps {
  active: DetailTab
  counts: { tasks: number; milestones: number; documents: number }
  onChange: (tab: DetailTab) => void
}

export function DetailTabs({ active, counts, onChange }: DetailTabsProps) {
  const tabs: { key: DetailTab; label: string; count?: number }[] = [
    { key: 'overview', label: '概览' },
    { key: 'tasks', label: '任务', count: counts.tasks },
    { key: 'milestones', label: '里程碑', count: counts.milestones },
    { key: 'docs', label: '文档', count: counts.documents },
    { key: 'timeline', label: '时间线' },
  ]

  return (
    <div className="mb-5 flex gap-0.5 overflow-x-auto border-b border-line" role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.key === active
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.key)}
            className={cn(
              // 原型 button 未设 line-height，沿用 UA 样式的 normal（高度 41px）；Tailwind 预检会让它继承 1.7
              'relative whitespace-nowrap border-0 bg-transparent px-[15px] py-[11px] text-13-5 font-semibold [line-height:normal] transition-colors duration-150 ease-out',
              isActive ? 'text-ink-900' : 'text-ink-500 hover:text-ink-900',
            )}
          >
            {tab.label}
            {tab.count !== undefined ? (
              <span className="ml-1.5 inline-block rounded-full bg-ink-100 px-1.5 text-11 font-bold leading-[18px] text-ink-500">
                {tab.count}
              </span>
            ) : null}
            {isActive ? (
              // ⚠️ 2026-09-25 纯色化：原来是 `linear-gradient(90deg,#6366f1,#7c3aed)`
              // 外加一圈 10px 的品牌色辉光（`shadow-[0_0_10px_rgba(99,102,241,.5)]`）。
              // 渐变改成一个品牌令牌；辉光删掉 —— 一条 2px 的下划线不需要发光，
              // "当前在哪一页"由它的**位置**表达，不由亮度表达。
              <span className="absolute -bottom-px left-3 right-3 h-0.5 rounded-t-[2px] bg-brand-500" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
