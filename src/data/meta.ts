import type { IconName, Priority, ProjectStatus, Scope, TaskStatus } from '../types'

/**
 * 三域语义色 —— 贯穿 badge / 进度条填充 / 卡片左侧指示条 / 看板列头，
 * 是全局唯一的“归属”信号；品牌色只用于可交互状态（焦点环、链接、激活指示）。
 *
 * ⚠️ badge 用 -strong 色阶而不是主色阶：badge 是"承载文字"的表面，
 * 主色阶（#0f9d76 等）压在 13% 半透明同色底上实测只有 2.8:1；
 * -strong 把它拉到 5.3:1。色条 / 填充 / 圆点仍用主色阶，因为不承载文字。
 */
export const SCOPE_META: Record<
  Scope,
  { label: string; badge: string; fill: string; bar: string; avatar: string; icon: IconName; hex: string }
> = {
  life: {
    label: '生活',
    badge: 'bg-life-bg text-life-strong',
    fill: 'bg-[linear-gradient(90deg,#34d3a6,#0f9d76)]',
    bar: 'bg-life',
    avatar: 'bg-life',
    icon: 'i-life',
    hex: '#0f9d76',
  },
  work: {
    label: '工作',
    badge: 'bg-work-bg text-work-strong',
    fill: 'bg-[linear-gradient(90deg,#6f9dff,#2f6fed)]',
    bar: 'bg-work',
    avatar: 'bg-work',
    icon: 'i-work',
    hex: '#2f6fed',
  },
  learn: {
    label: '学习',
    badge: 'bg-learn-bg text-learn-strong',
    fill: 'bg-[linear-gradient(90deg,#a78bfa,#7c3aed)]',
    bar: 'bg-learn',
    avatar: 'bg-learn',
    icon: 'i-learn',
    hex: '#7c3aed',
  },
}

/** 状态 chip：待启动（灰）/ 进行中（绿）/ 风险阻塞（红）/ 已完成（紫） */
export const STATUS_META: Record<
  ProjectStatus,
  { label: string; chip: string; dot: string; hex: string; rank: number }
> = {
  planning: { label: '待启动', chip: 'bg-ink-100 text-ink-600', dot: 'bg-ink-400', hex: '#8b93a1', rank: 0 },
  active: {
    label: '进行中',
    chip: 'bg-success-bg text-success-strong',
    dot: 'bg-success',
    hex: '#0f9d76',
    rank: 1,
  },
  risk: { label: '风险阻塞', chip: 'bg-danger-bg text-danger-strong', dot: 'bg-danger', hex: '#dc2626', rank: 2 },
  done: { label: '已完成', chip: 'bg-brand-50 text-brand-600', dot: 'bg-brand-500', hex: '#4f46e5', rank: 3 },
}

export const PRIORITY_META: Record<Priority, { label: string; dot: string; rank: number }> = {
  high: { label: '高', dot: 'bg-prio-high', rank: 3 },
  mid: { label: '中', dot: 'bg-prio-mid', rank: 2 },
  low: { label: '低', dot: 'bg-ink-300', rank: 1 },
}

export const TASK_STATUS_META: Record<TaskStatus, { label: string; pill: string; dot: string }> = {
  todo: { label: '待办', pill: 'bg-ink-100 text-ink-600', dot: 'bg-ink-400' },
  doing: { label: '进行中', pill: 'bg-success-bg text-success-strong', dot: 'bg-success' },
  blocked: { label: '阻塞', pill: 'bg-danger-bg text-danger-strong', dot: 'bg-danger' },
  done: { label: '已完成', pill: 'bg-brand-50 text-brand-600', dot: 'bg-brand-500' },
}

/** 项目列表工具栏的排序项 */
export const SORT_OPTIONS: { value: string; label: string }[] = [
  { value: 'default', label: '默认排序' },
  { value: 'due', label: '截止日期最近' },
  { value: 'progress', label: '进度最高' },
  { value: 'priority', label: '优先级最高' },
]

/** 看板列顺序 */
export const KANBAN_ORDER: ProjectStatus[] = ['planning', 'active', 'risk', 'done']

/** 侧边栏导航（生活/工作/学习/知识库/设置为 v1.0 范围外的占位项） */
export const NAV_GROUPS: { label: string; items: { key: string; label: string; icon: IconName }[] }[] = [
  {
    label: '业务域',
    items: [
      { key: '生活', label: '生活', icon: 'i-life' },
      { key: '工作', label: '工作', icon: 'i-work' },
      { key: '学习', label: '学习', icon: 'i-learn' },
    ],
  },
  {
    label: '统一层',
    items: [
      { key: 'project', label: '项目', icon: 'i-project' },
      { key: '知识库', label: '知识库', icon: 'i-knowledge' },
    ],
  },
  {
    label: '系统',
    items: [{ key: '设置', label: '设置', icon: 'i-settings' }],
  },
]
