import { Fragment } from 'react'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { AI_LIVE_STEPS, AI_STAGES } from '../../data/ai/conversations'
import { pressable } from './pressable'

/**
 * 生成中那条消息的**视图**：横向四拍阶段指示器 + 可展开的纵向实时步骤。
 *
 * ⚠️ 这里**不再持有计时器**（第一版它自己跑 interval 并在结束时回调）。
 *    第二轮原型把"生成中"搬进了消息数据之后，计时必须由**页面**统一驱动 ——
 *    否则同一条消息在"切走再切回来"时会重新起一个 interval，而旧的还在跑
 *    （症状是阶段跳着涨）。现在它只读 `stageIdx`，推进由 `advanceStage` 负责。
 */

interface AiLiveThinkingProps {
  /** 当前拍到第几（0..3；等于步数时表示四拍跑完、正在等结果落盘） */
  stageIdx: number
  /** 实时步骤条是否展开（状态也在消息数据里，见 store 的 `toggleLiveOpen`） */
  open: boolean
  onToggle: () => void
}

export function AiLiveThinking({ stageIdx, open, onToggle }: AiLiveThinkingProps) {
  return (
    <div className={cn('thinking-live', open && 'open')}>
      <div className="stage-indicator" {...pressable(onToggle)}>
        {AI_STAGES.map((item, i) => (
          /* ⚠️ 用 Fragment 而不是再包一层 span：`.stage-indicator` 是 flex 容器，
             多一层元素会让 `gap` 把「图标 + 箭头」从一对拆成两格。 */
          <Fragment key={item.name}>
            <span className={cn('stage-item', i < stageIdx && 'done', i === stageIdx && 'active')}>
              <span className="stage-dot">
                <Icon name={item.icon} />
              </span>
              <span>{item.name}</span>
            </span>
            {i < AI_STAGES.length - 1 ? <span className="stage-arrow">→</span> : null}
          </Fragment>
        ))}
        <span className="thinking-expand" title="展开思考详情" {...pressable(onToggle, true)}>
          <Icon name="i-chevron" />
        </span>
      </div>

      <div className="thinking-live-body">
        {AI_LIVE_STEPS.map((step, i) => {
          const state = i < stageIdx ? 'done' : i === stageIdx ? 'active' : 'pending'
          return (
            <div key={step.title} className={cn('live-step', state)}>
              <span className="live-num">{i + 1}</span>
              <div className="live-body">
                <div className="live-title">
                  {step.title}
                  <span className="live-status">
                    {state === 'done' ? '已完成' : state === 'active' ? '进行中' : '等待中'}
                  </span>
                </div>
                <div className="live-desc">{state === 'pending' ? '—' : step.desc}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
