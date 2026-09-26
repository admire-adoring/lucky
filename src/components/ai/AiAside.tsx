import { useState } from 'react'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { toast } from '../../stores/toast-store'
import { AI_FACTS } from '../../data/ai/facts'
import { AI_TOOLS } from '../../data/ai/conversations'
import { contextById } from '../../data/ai/contexts'
import { useAiStore } from '../../stores/ai-store'
import { AiContextPicker } from './AiContextPicker'
import { pressable } from './pressable'

/**
 * 说明文字的版式。
 *
 * ⚠️ 用**内联 style** 而不是新起一个类名，理由是原型自己就是这么写的：
 *    它的「隐私」卡正文是一个带内联样式的裸 `<div>`（没有类名）。
 *    新起类名会让「类名存在性门禁」当场报红（用了但 CSS 里没有），
 *    而往生成物里补一条原型没有的规则又会让产物与原型出现无出处的差异。
 */
const NOTE_STYLE = {
  fontSize: 11.5,
  lineHeight: 1.7,
  color: 'var(--mw-text-secondary)',
} as const

/**
 * 右栏（原型 `.aside` → `.ai-aside`）。
 *
 * ============================================================================
 * 第二轮原型在这里补上了「上下文可增删」，本页照做 —— 但数据侧换了来源
 * ============================================================================
 * 原型的 `.aside-title` 里那颗「管理」与底部「添加上下文」都打开同一个选择器，
 * 选中项存进 `session.contexts`（**按名字**）。本页存 id，目录来自
 * `data/ai/contexts.ts`（2 个事实源 + 8 个真实项目）—— 理由见那个文件的文件头。
 *
 * ⚠️ 第一版这里的三条"读取范围"是写死的（最紧的两个项目 + 全部任务 + 全部项目），
 *    且明确**不带 ×**（当时没有可写状态）。现在有了，`×` 就真的能移除。
 *
 * ============================================================================
 * 另外两处**必须有**的改动，都是"原件在说一件没发生的事"
 * ============================================================================
 * ① **「本月用量」整卡换掉**：原型的「Token 128k / 200k · 对话 42 次」没有来源。
 *    改成有来源的「数据概览」（进度条就是任务完成率）。标题一起改 ——
 *    留着"本月用量"配一条完成率条，比不写更糟。
 * ② **「隐私」卡换成「边界」卡**：原型那三句描述的是一套**不存在的系统**
 *    （没有模型调用、没有审计日志）。改成把真实情况写清楚。
 */
export function AiAside() {
  const tools = useAiStore((state) => state.tools)
  const toggleTool = useAiStore((state) => state.toggleTool)
  const session = useAiStore((state) => state.sessions.find((item) => item.id === state.activeId))
  const removeContext = useAiStore((state) => state.removeContext)
  const [pickerOpen, setPickerOpen] = useState(false)

  const { tasks, stats, projectCount } = AI_FACTS
  /** 进度条：任务完成率。分母是 0 时给 0，避免 NaN 宽度 */
  const rate = tasks.total ? Math.round((tasks.done / tasks.total) * 100) : 0
  /* ⚠️ 目录里查不到的 id 直接**不渲染**，而不是回落成"某个默认项" ——
     回落会让一条失效的上下文看起来仍然有效（对照 contexts.ts 的 `contextById`）。 */
  const contexts = (session?.contexts ?? []).map(contextById).filter((item) => item !== undefined)

  return (
    <aside className="ai-aside" aria-label="上下文与工具">
      <div className="ai-aside-card">
        <div className="ai-aside-title">
          <span>上下文</span>
          <span className="more" {...pressable(() => setPickerOpen(true))}>
            管理
          </span>
        </div>

        {contexts.length ? (
          contexts.map((item) => (
            <div key={item.id} className="context-item">
              <span className="c-icon">
                <Icon name={item.icon} />
              </span>
              <span className="c-text">{item.name}</span>
              <span
                className="c-remove"
                title={`移除 ${item.name}`}
                {...pressable(() => {
                  removeContext(item.id)
                  toast('已移除上下文')
                }, true)}
              >
                ×
              </span>
            </div>
          ))
        ) : (
          <div style={{ padding: '10px 8px', fontSize: 11.5, color: 'var(--mw-text-muted)', textAlign: 'center' }}>
            暂无上下文
          </div>
        )}

        <button type="button" className="context-add" onClick={() => setPickerOpen(true)}>
          <Icon name="i-plus" />
          添加上下文
        </button>
      </div>

      <div className="ai-aside-card">
        <div className="ai-aside-title">能力开关</div>
        {AI_TOOLS.map((tool) => (
          <div key={tool.key} className="tool-item">
            <div className="tool-item-left">
              <Icon name={tool.icon} />
              {tool.label}
            </div>
            <div
              className={cn('ai-switch', tools[tool.key] && 'on')}
              role="switch"
              tabIndex={0}
              aria-checked={Boolean(tools[tool.key])}
              aria-label={tool.label}
              onClick={() => toggleTool(tool.key)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault()
                  toggleTool(tool.key)
                }
              }}
            />
          </div>
        ))}
        <div style={NOTE_STYLE}>
          这些开关与上面的上下文目前都还没有消费者 —— 应用里没有模型网关，改了不影响回答。
          留着它们是因为它们迟早要接上，而且接口已经就位（`session.contexts` 就是那份读取范围）。
        </div>
      </div>

      <div className="ai-aside-card">
        <div className="ai-aside-title">数据概览</div>
        <div className="usage-row">
          <span>任务完成</span>
          <span>
            {tasks.done} / {tasks.total}
          </span>
        </div>
        <div className="usage-bar">
          <div className="usage-fill" style={{ width: `${rate}%` }} />
        </div>
        <div className="usage-row">
          <span>进行中项目</span>
          <span>{stats.active} 个</span>
        </div>
        <div className="usage-row">
          <span>风险项目</span>
          <span>{stats.risk} 个</span>
        </div>
        <div className="usage-row">
          <span>全域平均</span>
          <span>{AI_FACTS.globalAvg}%</span>
        </div>
        <div className="usage-row">
          <span>已接入项目</span>
          <span>{projectCount} 个</span>
        </div>
      </div>

      <div className="ai-aside-card">
        <div className="ai-aside-title">边界</div>
        <div style={NOTE_STYLE}>
          这一页不发送任何内容。所有回答都在本地由规则引擎按
          <code>src/data/projects.ts</code> 现算：没有模型网关、没有文件解析、
          没有网络请求，也就没有审计日志可言。
          <br />
          <br />
          超出这四类问题的，它会直说答不了，而不是生成一段像样的话。
        </div>
        <button
          type="button"
          className="context-add"
          onClick={() => toast('本页没有可导出的运行日志 —— 它不发请求')}
        >
          为什么没有日志
        </button>
      </div>

      <AiContextPicker open={pickerOpen} onClose={() => setPickerOpen(false)} />
    </aside>
  )
}
