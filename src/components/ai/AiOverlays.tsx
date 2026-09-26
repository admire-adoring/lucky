import { useEffect, useRef, useState } from 'react'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { toast } from '../../stores/toast-store'
import { useAiStore } from '../../stores/ai-store'
import type { AiMessage, AiThoughtStep } from '../../data/ai/types'
import { GlyphBranch, GlyphChevronLeft, GlyphChevronRight, GlyphClose } from './ai-glyphs'
import { Runs } from './ai-runs'
import { pressable } from './pressable'

/* ============================================================
   思考链浮板（原型 `.thought-panel`，时间轴视图）
   ============================================================ */

/**
 * 思考链的时间轴视图。
 *
 * ============================================================================
 * 第二轮原型给它加了三件事，都照搬
 * ============================================================================
 * ① **上一条 / 下一条 + 页码**：消息一多，"我想对比两条回答的思考链"就没法做了。
 * ② **定位**：面板是浮层，底下的消息可能已经滚远了 —— 点一下把那条滚回视野中央并高亮。
 * ③ **生成中同步**：面板正看着的那条如果还在生成，时间轴要跟着实时长出来
 *    （未到的步骤显示 `—`、当前那步一个脉冲点、徽标从「已完成」变「生成中」）。
 *    ⚠️ 这一条不需要额外的订阅：面板读的就是 store 里那条消息，`stageIdx` 一变就重渲染。
 *
 * ⚠️ 与原型一致：`.tl-time`（每步耗时）与 `.tp-total-time`（"总计 1.2s"）**都不填** ——
 *    应用里这条链路是本地同步计算，没有可测的分步耗时（见 `data/ai/conversations.ts`）。
 */
export function AiThoughtPanel() {
  const messageId = useAiStore((state) => state.thoughtMessageId)
  const session = useAiStore((state) => state.sessions.find((item) => item.id === state.activeId))
  const close = useAiStore((state) => state.closeThought)
  const step = useAiStore((state) => state.stepThought)
  const jumpTo = useAiStore((state) => state.jumpTo)
  const panelRef = useRef<HTMLDivElement>(null)
  const open = messageId !== null

  /* 面板里可翻的那一批：有思考链的助手消息 + 正在生成的（原型同口径） */
  const list: AiMessage[] = (session?.messages ?? []).filter(
    (message) => message.role === 'assistant' && (message.generating || message.thought?.length),
  )
  const page = messageId ? list.findIndex((message) => message.id === messageId) : -1
  const message = page >= 0 ? list[page] : undefined

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      /* 点开它的那颗按钮本身也要排除 —— 否则"开→立刻被自己关掉"。
         判据与原型一致：`.tc-open-panel` 与消息动作里那颗都是入口。 */
      if (target.closest('.tc-open-panel')) return
      if (!panelRef.current?.contains(target)) close()
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  /** 头部那句「回复「…」」：取回答的前 30 个字（原型同口径） */
  const preview = message ? message.text.map((run) => run.text).join('').replace(/\s+/g, ' ').slice(0, 30) : ''
  const stageIdx = message?.generating ? (message.stageIdx ?? 0) : (message?.thought?.length ?? 0)

  /**
   * 要显示的步骤。
   *
   * ⚠️ 生成中也有步骤 —— `startRound` 在开一轮时就先落了思考链骨架
   *    （题目 + 说明），`settle` 时再覆盖成真正那条。所以这里**不需要**占位分支：
   *    面板从第一帧起显示的就是真的步骤名，未到的那些只是 desc 显示 `—`。
   *    （第一版给生成中造了"第 N 步"的占位，与实时流里的步骤名对不上，看着像两套东西。）
   */
  const steps: AiThoughtStep[] = message?.thought ?? []

  return (
    <div ref={panelRef} className={cn('thought-panel', open && 'show')} role="dialog" aria-label="思考链">
      <div className="thought-panel-head">
        <div className="thought-panel-title">
          <Icon name="i-spark" />
          思考链
          <span className={cn('tp-badge', message?.generating && 'generating')}>
            {message?.generating ? '生成中' : message?.thought?.length ? '已完成' : '无'}
          </span>
        </div>
        <div className="thought-panel-head-actions">
          <div className="thought-panel-nav">
            <button type="button" title="上一条" disabled={page <= 0} onClick={() => step(-1)}>
              <GlyphChevronLeft />
            </button>
            <span className="nav-page">
              {page >= 0 ? page + 1 : 0}/{list.length}
            </span>
            <button
              type="button"
              title="下一条"
              disabled={page < 0 || page >= list.length - 1}
              onClick={() => step(1)}
            >
              <GlyphChevronRight />
            </button>
          </div>
          <button type="button" className="thought-panel-close" onClick={close} aria-label="关闭">
            <GlyphClose />
          </button>
        </div>
      </div>

      <div className="thought-panel-meta">
        <span className="tp-meta-icon">
          <Icon name="i-spark" />
        </span>
        <span className="tp-meta-text">
          {message?.thought?.length || message?.generating
            ? `回复「${preview}${preview.length >= 30 ? '…' : ''}」`
            : ''}
        </span>
        {message ? (
          <span
            className="tp-jump"
            title="滚到这条消息"
            {...pressable(() => {
              jumpTo(message.id)
              close()
            })}
          >
            定位
          </span>
        ) : null}
      </div>

      <div className="thought-panel-body">
        {message?.generating || message?.thought?.length ? (
          <div className="timeline">
            {(steps).map((stepItem, i) => {
              const state = message.generating
                ? i < stageIdx
                  ? 'done'
                  : i === stageIdx
                    ? 'generating'
                    : 'pending'
                : 'done'
              const revealed = !message.generating || i <= stageIdx
              return (
                <div key={i} className={cn('tl-node', state)}>
                  <span className="tl-dot">{state === 'done' ? '✓' : ''}</span>
                  <div className="tl-head">
                    <span className="tl-title">{stepItem.title}</span>
                  </div>
                  <div className="tl-desc">{revealed ? <Runs runs={stepItem.desc} /> : '—'}</div>
                  {stepItem.branches?.length && revealed ? (
                    <div className="tl-branch">
                      <div className="tl-branch-title">
                        <GlyphBranch />
                        分支
                      </div>
                      {stepItem.branches.map((branch, j) => (
                        <div key={j} className={cn('tl-branch-item', branch.status)}>
                          <span className="bi-mark">
                            {branch.status === 'done' ? '✓' : branch.status === 'skip' ? '✕' : '●'}
                          </span>
                          <span>{branch.text}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {stepItem.key && revealed ? (
                    <div className="tl-key">
                      <Icon name="i-spark" />
                      <span>
                        <strong>关键结论：</strong>
                        <Runs runs={stepItem.key} />
                      </span>
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ padding: 30, textAlign: 'center', fontSize: 12.5, color: 'var(--mw-text-muted)' }}>
            该消息暂无思考链
          </div>
        )}
      </div>
    </div>
  )
}

/* ============================================================
   语音浮层（原型 `.voice-overlay`）
   ============================================================ */

/**
 * 浏览器语音识别的**最小结构类型**。
 *
 * 为什么不用 `any`：`SpeechRecognition` 不在 TS 的 DOM 库里（它还不是标准），
 * 所以要么 `any`、要么这样写一个只含"我确实会用到的那几个成员"的接口。
 */
interface SpeechResultAlternative {
  transcript: string
}
interface SpeechResult {
  readonly length: number
  [index: number]: SpeechResultAlternative
}
interface SpeechResultList {
  readonly length: number
  [index: number]: SpeechResult
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: { results: SpeechResultList }) => void) | null
  onerror: ((event: { error?: string }) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

/** 拿构造器。不存在时返回 null —— 调用方据此走"这个环境不支持"的分支 */
function getRecognitionCtor(): SpeechRecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

type VoicePhase = 'listening' | 'done' | 'unsupported'

interface AiVoiceOverlayProps {
  open: boolean
  onClose: () => void
  /** 录音状态上报给输入区（麦克风那颗要挂 `.recording`） */
  onRecordingChange: (recording: boolean) => void
}

/**
 * 语音浮层。
 *
 * ============================================================================
 * 这里**没有照搬原型**，因为原型那段是假的
 * ============================================================================
 * 原型的 `stopVoice()` 从五个写死的句子里 `Math.random()` 挑一句当成"你说的话"。
 * 而语音输入的下游是"填入输入框并发送" —— 等于替用户发一句他没说过的话。
 * 处置：接**真的** `SpeechRecognition`，环境没有就**明说没有**，不回落到随机句子。
 *
 * ============================================================================
 * 第二轮新增的「插入光标处 / 替换全部」
 * ============================================================================
 * 原型的行为：输入框**非空**时才显示这两颗按钮（输入框空的就没什么可选的），
 * 「插入光标处」用 `selectionStart/End` 插在选区位置、「替换全部」整体覆盖。
 * 本页照做 —— 光标位置在**打开浮层那一刻**由输入区记进 store
 * （浮层与 textarea 不在同一棵子树，读不到它的 selection）。
 */
export function AiVoiceOverlay({ open, onClose, onRecordingChange }: AiVoiceOverlayProps) {
  const [phase, setPhase] = useState<VoicePhase>('listening')
  const [detail, setDetail] = useState('')
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const setDraft = useAiStore((state) => state.setDraft)
  const draft = useAiStore((state) => state.draft)
  const caret = useAiStore((state) => state.caret)

  useEffect(() => {
    if (!open) return
    setTranscript('')
    setDetail('')

    const Ctor = getRecognitionCtor()
    if (!Ctor) {
      setPhase('unsupported')
      onRecordingChange(false)
      return
    }

    const recognition = new Ctor()
    recognition.lang = 'zh-CN'
    recognition.continuous = false
    recognition.interimResults = true
    recognition.onresult = (event) => {
      let text = ''
      for (let i = 0; i < event.results.length; i += 1) text += event.results[i]?.[0]?.transcript ?? ''
      setTranscript(text)
    }
    recognition.onerror = (event) => {
      setPhase('done')
      setDetail(`识别中断：${event.error ?? '未知原因'}`)
      onRecordingChange(false)
    }
    recognition.onend = () => {
      /* 正常结束：有文字就是识别结果；没文字就如实说"没听到内容"。
         **不填任何兜底句子** —— 原型的毛病正是这里随机挑一句。 */
      setPhase((current) => (current === 'unsupported' ? current : 'done'))
      setDetail((current) => current || '识别结束')
      onRecordingChange(false)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
      setPhase('listening')
      onRecordingChange(true)
    } catch {
      setPhase('done')
      setDetail('麦克风不可用（权限被拒绝或没有输入设备）')
      onRecordingChange(false)
    }

    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
      recognitionRef.current = null
      onRecordingChange(false)
    }
  }, [open, onRecordingChange])

  function stop() {
    recognitionRef.current?.stop()
  }

  function cancel() {
    recognitionRef.current?.abort()
    onRecordingChange(false)
    onClose()
  }

  /** 插入光标处：把识别结果塞在打开浮层时记下的那个位置 */
  function insertAtCaret() {
    if (!transcript.trim()) {
      toast('没有识别到内容')
      return
    }
    const at = Math.min(Math.max(caret, 0), draft.length)
    setDraft(`${draft.slice(0, at)}${transcript}${draft.slice(at)}`)
    onClose()
    toast('已插入到光标处')
  }

  function replaceAll() {
    if (!transcript.trim()) {
      toast('没有识别到内容')
      return
    }
    setDraft(transcript)
    onClose()
    toast('已替换输入框内容')
  }

  const listening = phase === 'listening'

  return (
    <div className={cn('voice-overlay', open && 'show')} role="dialog" aria-label="语音输入">
      <div className="voice-modal">
        {listening ? (
          <div className="voice-wave">
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        ) : null}

        <div className="voice-status">
          {listening ? '正在聆听…' : phase === 'unsupported' ? '这个环境没有语音识别' : '识别结束'}
        </div>
        <div className="voice-hint-text">
          {phase === 'unsupported'
            ? '当前运行环境没有提供 SpeechRecognition —— 应用里也没有语音识别后端，所以这一步做不了'
            : listening
              ? '请说话，识别完成后可确认'
              : detail}
        </div>

        {!listening ? (
          <>
            <div className={cn('voice-result', 'show')}>
              <div className="voice-result-label">
                <Icon name="i-check" />
                识别结果
              </div>
              <div>{transcript}</div>
              {/* 输入框非空时才给"插入 / 替换"两个选择（原型同口径） */}
              {draft.trim() ? (
                <div className={cn('voice-insert-choice', 'show')}>
                  <button type="button" className="vic-btn" onClick={insertAtCaret}>
                    插入光标处
                  </button>
                  <button type="button" className="vic-btn primary" onClick={replaceAll}>
                    替换全部
                  </button>
                </div>
              ) : null}
            </div>
            {/* 没识别到内容时给一个明确的出口（原型的 `.voice-result-actions` 已被移除） */}
            {!draft.trim() && !transcript.trim() ? (
              <div className="voice-actions">
                <button type="button" className="voice-btn cancel" onClick={cancel}>
                  关闭
                </button>
              </div>
            ) : null}
          </>
        ) : null}

        {/* ⚠️ 与原型一致：出结果之后**收起**那一排 */}
        {listening ? (
          <div className="voice-actions">
            <button type="button" className="voice-btn cancel" onClick={cancel}>
              取消
            </button>
            <button type="button" className="voice-btn stop" onClick={stop}>
              停止录音
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}
