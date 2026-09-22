import { Fragment, useEffect, useRef, useState } from 'react'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { AI_LIVE_STEPS, AI_STAGES } from '../../data/ai/conversations'
import { pressable } from './pressable'

/**
 * 生成中的那条消息：横向四拍阶段指示器 + 可展开的纵向实时步骤。
 *
 * ============================================================================
 * 计时归本组件，不归 store、也不归页面
 * ============================================================================
 * 原型用的是两个全局 `setInterval`（`stageTimer` / `generatingTimer`）。
 * 这里改成"每次 stage 变化挂一个 `setTimeout`、清理时取消" —— 理由有三条：
 *   · 全局 interval 在"停止生成 / 切换会话 / 路由离开"三条路径上都要记得 clear，
 *     漏一条就是"停不下来的定时器"（本项目在 `ChannelBar` 那次踩过，记在技能里）；
 *   · `useEffect` 的清理函数天然覆盖这三条路径；
 *   · 停止生成时组件直接被卸载，定时器随清理一起消失，不需要外部通知。
 *
 * ⚠️ `onFinish` 用 ref 存一份：它是父组件的闭包，每次渲染身份都会变，
 *    直接进依赖数组会让计时**每次渲染都重置** —— 症状是阶段永远停在第一拍。
 */

/** 原型：每拍 450ms，四拍跑完再等 350ms 出结果 */
const STAGE_MS = 450
const SETTLE_MS = 350

export function AiLiveThinking({ onFinish }: { onFinish: () => void }) {
  const [stage, setStage] = useState(0)
  const [open, setOpen] = useState(false)
  const bodyRef = useRef<HTMLDivElement>(null)
  const finishRef = useRef(onFinish)
  finishRef.current = onFinish

  useEffect(() => {
    if (stage >= AI_STAGES.length) {
      const timer = setTimeout(() => finishRef.current(), SETTLE_MS)
      return () => clearTimeout(timer)
    }
    const timer = setTimeout(() => setStage((value) => value + 1), STAGE_MS)
    return () => clearTimeout(timer)
  }, [stage])

  /* 自动滚到当前活跃步骤（原型的 `activeStep.scrollIntoView`）。
     容器收起时 body 的 max-height 是 0，滚了也看不见 —— 无副作用。 */
  useEffect(() => {
    bodyRef.current?.querySelector('.live-step.active')?.scrollIntoView({ block: 'nearest' })
  }, [stage, open])

  return (
    <div className={cn('msg', 'assistant')} aria-live="polite">
      <div className="msg-avatar">
        <Icon name="i-spark" />
      </div>
      <div className="msg-content">
        <div className={cn('thinking-live', open && 'open')}>
          <div className="stage-indicator" {...pressable(() => setOpen((value) => !value))}>
            {AI_STAGES.map((item, i) => (
              /* ⚠️ 用 Fragment 而不是再包一层 span：`.stage-indicator` 是 flex 容器，
                 多一层元素会让 `gap` 把「图标 + 箭头」从一对拆成两格。
                 包的如果是 `display: contents` 的 span 也能凑合，但那多了一个
                 只为绕开 flex 而存在的元素 —— 下一个人会以为它有语义。 */
              <Fragment key={item.name}>
                <span className={cn('stage-item', i < stage && 'done', i === stage && 'active')}>
                  <span className="stage-dot">
                    <Icon name={item.icon} />
                  </span>
                  <span>{item.name}</span>
                </span>
                {i < AI_STAGES.length - 1 ? <span className="stage-arrow">→</span> : null}
              </Fragment>
            ))}
            <span className="thinking-expand" title="展开思考详情" {...pressable(() => setOpen((v) => !v), true)}>
              <Icon name="i-chevron" />
            </span>
          </div>

          <div className="thinking-live-body" ref={bodyRef}>
            {AI_LIVE_STEPS.map((step, i) => {
              const state = i < stage ? 'done' : i === stage ? 'active' : 'pending'
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
      </div>
    </div>
  )
}
