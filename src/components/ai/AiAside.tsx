import { useNavigate } from 'react-router-dom'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { toast } from '../../stores/toast-store'
import { AI_FACTS } from '../../data/ai/facts'
import { AI_TOOLS } from '../../data/ai/conversations'
import { useAiStore } from '../../stores/ai-store'

/**
 * 说明文字的版式。
 *
 * ⚠️ 用**内联 style** 而不是新起一个类名，理由是原型自己就是这么写的：
 *    它的「隐私」卡正文是一个带内联样式的裸 `<div>`（没有类名）。
 *    新起 `.ai-aside-note` 会让「类名存在性门禁」当场报红（用了但 CSS 里没有），
 *    而往生成物里补一条原型没有的规则又会让产物与原型出现无出处的差异。
 *    两个方向都比内联 style 贵。
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
 * 三处**必须有**的改动，都是"原件在说一件没发生的事"
 * ============================================================================
 *
 * ① **「本月用量」整卡换掉**。原型写的是「Token 128k / 200k · 对话 42 次 ·
 *    最常用 总结/拆任务」，还配一条进度条 —— 应用里**没有用量表**，
 *    这些数没有来源。按铁律「不允许编数字」，改成有来源的「数据概览」：
 *    任务完成率（进度条就是它，一个真比例）、进行中、风险。
 *    ⚠️ 进度条的语义也跟着变了：从"预算消耗"变成"任务完成率"，所以标题一起改 ——
 *       留着"本月用量"配一条完成率条，比不写更糟。
 *
 * ② **「隐私」卡换成「边界」卡**。原型那三句（工作机密默认不进上下文 /
 *    每次调用记入审计日志 / 可开启本次对话不记录）**描述的是一套不存在的系统**：
 *    本页没有任何模型调用、没有网络请求、没有审计日志。这已经不是"没接后端"，
 *    而是**说了一件假话**。改成把真实情况写清楚（回答在本地现算、不发任何内容）。
 *
 * ③ **「上下文」列表换成真实来源**。原型的三个条目（支付系统重构 / React 19 笔记 /
 *    本周日程）是演示内容；换成实际被读取的事实源与项目名。
 *    ⚠️ 每一项**不带 ×**：原型 hover 时出现移除按钮，应用里没有"助手读取范围"
 *       这个可写状态 —— 摆一个点了不起作用的 × 比不摆更差。
 */
export function AiAside() {
  const navigate = useNavigate()
  const tools = useAiStore((state) => state.tools)
  const toggleTool = useAiStore((state) => state.toggleTool)

  const { tasks, stats, dueTop2, projectCount } = AI_FACTS
  /** 进度条：任务完成率。分母是 0 时给 0，避免 NaN 宽度 */
  const rate = tasks.total ? Math.round((tasks.done / tasks.total) * 100) : 0

  return (
    <aside className="ai-aside" aria-label="上下文与工具">
      <div className="ai-aside-card">
        <div className="ai-aside-title">
          <span>读取范围</span>
          <span
            className="more"
            role="button"
            tabIndex={0}
            onClick={() => navigate('/projects')}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault()
                navigate('/projects')
              }
            }}
          >
            全部
          </span>
        </div>
        {dueTop2.map((project) => (
          <div key={project.id} className="context-item">
            <span className="c-icon">
              <Icon name="i-project" />
            </span>
            <span className="c-text">{project.name}</span>
          </div>
        ))}
        <div className="context-item">
          <span className="c-icon">
            <Icon name="i-list" />
          </span>
          <span className="c-text">全部任务 · {tasks.total} 条</span>
        </div>
        <div className="context-item">
          <span className="c-icon">
            <Icon name="i-grid" />
          </span>
          <span className="c-text">全部项目 · {projectCount} 个</span>
        </div>
        <button type="button" className="context-add" onClick={() => navigate('/projects')}>
          <Icon name="i-plus" />
          打开项目页
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
          这些开关目前还没有消费者 —— 应用里没有模型网关，打开与否都不影响回答。
          留着它们是因为它们迟早要接上，而不是因为它们现在生效。
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
    </aside>
  )
}
