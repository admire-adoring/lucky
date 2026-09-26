import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { toast } from '../../stores/toast-store'
import { messageText, nowTime, useAiStore } from '../../stores/ai-store'
import type { AiMessage, AiQuickPrompt } from '../../data/ai/types'
import { AiLiveThinking } from '../ai/AiLiveThinking'
import { Paragraphs, Runs } from '../ai/ai-runs'
import { GlyphChevronRight, GlyphCopy, GlyphRefresh, GlyphStop } from '../ai/ai-glyphs'

/**
 * 抽屉里的一条消息。
 *
 * ============================================================================
 * 为什么它不直接复用 `components/ai/AiMessageRow.tsx`
 * ============================================================================
 * 两个原型（完整页 / 抽屉）**共用同一套消息词汇**（`.msg` / `.msg-bubble` /
 * `.thinking-live` / `.thought-card` / `.tc-step` …），但**不是同一套功能集**：
 *   · 抽屉原型的消息上只有：头像 / 气泡 / 思考卡 / 停止行 / 快捷 chip / 复制·重新生成；
 *   · 完整页那些多出来的东西（引用块 `.msg-quote`、附件 chip、版本切换器、
 *     「已停止」徽标、「继续生成」、「打开时间轴」）在**抽屉这一层里没有样式** ——
 *     `src/styles/ai-sidebar.css` 是由抽屉原型生成的，那些类名不在里面。
 *
 * 直接复用完整页那一行组件的后果是**渲染出没有样式的元素**：DOM 里什么都有、
 * 页面照常不报错，只是多出几个裸按钮（这是本项目反复记过的那一类缺陷：
 * "DOM 对了"不等于"页面对了"）。所以这里按**抽屉原型自己的标记**写一遍，
 * 只发射抽屉层真的定义过的类名。
 *
 * ⚠️ 富文本与思考链的**视图**是复用的（`ai-runs` / `AiLiveThinking`）——
 *    它们的类名在两个原型里逐字一致，属于"同一件东西"。
 */

interface AiDrawerMessageProps {
  message: AiMessage
  /** 用户头像上的字（登录态里那一支，与完整页同一口径） */
  initials: string
  /** 是否展示开场快捷入口（只有"第一条消息时"才展示，与原型同判据） */
  quickPrompts?: AiQuickPrompt[]
  onAsk: (text: string) => void
  /**
   * 是不是那条**渲染出来的欢迎语**（`id === 'greeting'`，不在会话数据里）。
   * ⚠️ 它上面的「复制 / 重新生成」会指向一条 store 里不存在的消息 ——
   *    点了没有任何反应（= "点了没反应"的缺陷），所以干脆不给它们。
   */
  transient?: boolean
}

export function AiDrawerMessage({
  message,
  initials,
  quickPrompts,
  onAsk,
  transient,
}: AiDrawerMessageProps) {
  const isUser = message.role === 'user'
  const toggleThoughtOpen = useAiStore((state) => state.toggleThoughtOpen)
  const toggleLiveOpen = useAiStore((state) => state.toggleLiveOpen)
  const stop = useAiStore((state) => state.stop)
  const regenerate = useAiStore((state) => state.regenerate)

  const steps = message.thought ?? []
  const thoughtOpen = Boolean(message.thoughtOpen)

  /** 复制：与完整页同一处置 —— 读**纯文本**（`messageText` 把 runs 拼回字符串） */
  async function copy() {
    try {
      await navigator.clipboard.writeText(messageText(message))
      toast('已复制到剪贴板')
    } catch {
      toast('复制失败：当前环境不允许访问剪贴板')
    }
  }

  return (
    <div className={cn('msg', isUser ? 'user' : 'assistant')} data-message-id={message.id}>
      <div className="msg-avatar">
        {isUser ? initials : <Icon name="i-spark" />}
      </div>
      <div className="msg-content">
        {message.generating ? (
          <AiLiveThinking
            stageIdx={message.stageIdx ?? 0}
            open={Boolean(message.liveOpen)}
            onToggle={() => toggleLiveOpen(message.id)}
          />
        ) : null}

        {!isUser && !message.generating && steps.length ? (
          <div className={cn('thought-card', thoughtOpen && 'open')}>
            <button
              type="button"
              className="thought-card-head"
              onClick={() => toggleThoughtOpen(message.id)}
              aria-expanded={thoughtOpen}
            >
              <span className="tc-chev">
                <GlyphChevronRight />
              </span>
              <span className="tc-icon">
                <Icon name="i-spark" />
              </span>
              <span className="tc-summary">思考了 {steps.length} 步</span>
              {/* ⚠️ 原型这里还有一个 `.tc-time`（"1.2s"）。**不填** —— 与完整页同一判据：
                  这条链路是本地同步计算，没有可测的分步耗时，填一个就是编数字。
                  槽位在生成物里还在（`.tc-time`），只是没有元素去用它。 */}
            </button>
            <div className="thought-card-body">
              {steps.map((step, i) => (
                <div key={i} className="tc-step">
                  <span className="tc-num">{i + 1}</span>
                  <span className="tc-text">
                    <Runs runs={step.desc} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {message.text.length ? (
          <div className="msg-bubble">
            <Paragraphs runs={message.text} />
          </div>
        ) : null}

        {message.generating ? (
          <div className="stop-row">
            <button type="button" className="stop-btn" onClick={() => stop(message.id)}>
              <GlyphStop />
              停止生成
            </button>
          </div>
        ) : null}

        {quickPrompts?.length ? (
          <div className="quick-row">
            {quickPrompts.map((prompt) => (
              /* chip 上写**短标签**、发出去的是 `ask` 那句完整的话 ——
                 原型的 chip 文案就是整句话（三个写死的句子），而应用里的
                 `AI_QUICK_PROMPTS` 本来就是「短标签 + 要问的话」两栏数据。
                 用 label 更像 chip 该有的样子，也仍然是同一份事实源。 */
              <button
                key={prompt.ask}
                type="button"
                className="quick-chip"
                onClick={() => onAsk(prompt.ask)}
                title={prompt.ask}
              >
                {prompt.label}
              </button>
            ))}
          </div>
        ) : null}

        {!isUser && !transient ? (
          <div className="msg-actions">
            <button type="button" className="msg-action" title="复制" onClick={copy}>
              <GlyphCopy />
            </button>
            <button
              type="button"
              className="msg-action"
              title="重新生成"
              onClick={() => regenerate(message.id, nowTime())}
            >
              <GlyphRefresh />
            </button>
          </div>
        ) : null}

        <div className="msg-meta">{message.time}</div>
      </div>
    </div>
  )
}
