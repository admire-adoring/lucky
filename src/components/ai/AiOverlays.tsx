import { useEffect, useRef, useState } from 'react'
import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { toast } from '../../stores/toast-store'
import { useAiStore } from '../../stores/ai-store'
import { GlyphBranch, GlyphClose } from './ai-glyphs'
import { Runs } from './ai-runs'

/* ============================================================
   思考链浮板（原型 `.thought-panel`，时间轴视图）
   ============================================================ */

/**
 * 思考链的时间轴视图。
 *
 * ⚠️ 两处**不填**，与消息里的思考卡同一条判据（见 `data/ai/conversations.ts` 文件头）：
 *    · `.tl-time`（每一步的耗时）
 *    · `.tp-total-time`（"总计 1.2s"）
 *    应用里这条链路是本地同步计算，没有可测的分步耗时。槽位在生成物里都还在，
 *    只是没有元素去用它 —— 而不是填一组好看的数。
 */
export function AiThoughtPanel() {
  const message = useAiStore((state) => state.thoughtMessage)
  const close = useAiStore((state) => state.closeThought)
  const panelRef = useRef<HTMLDivElement>(null)
  const open = message !== null

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      /* 点开它的那颗按钮本身也要排除 —— 否则"开→立刻被自己关掉"。
         判据与原型一致：`.tc-open-panel` 是唯一的开面板入口。 */
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

  return (
    <div ref={panelRef} className={cn('thought-panel', open && 'show')} role="dialog" aria-label="思考链">
      <div className="thought-panel-head">
        <div className="thought-panel-title">
          <Icon name="i-spark" />
          思考链
          <span className="tp-badge">{message?.thought?.length ? '已完成' : '无'}</span>
        </div>
        <button type="button" className="thought-panel-close" onClick={close} aria-label="关闭">
          <GlyphClose />
        </button>
      </div>

      <div className="thought-panel-meta">
        <span className="tp-meta-icon">
          <Icon name="i-spark" />
        </span>
        <span className="tp-meta-text">
          {message?.thought?.length ? `回复「${preview}${preview.length >= 30 ? '…' : ''}」` : ''}
        </span>
      </div>

      <div className="thought-panel-body">
        {message?.thought?.length ? (
          <div className="timeline">
            {message.thought.map((step, i) => (
              <div key={i} className="tl-node done">
                <span className="tl-dot" />
                <div className="tl-head">
                  <span className="tl-title">{step.title}</span>
                </div>
                <div className="tl-desc">
                  <Runs runs={step.desc} />
                </div>
                {step.branches?.length ? (
                  <div className="tl-branch">
                    <div className="tl-branch-title">
                      <GlyphBranch />
                      分支
                    </div>
                    {step.branches.map((branch, j) => (
                      <div key={j} className={cn('tl-branch-item', branch.status)}>
                        <span className="bi-mark">
                          {branch.status === 'done' ? '✓' : branch.status === 'skip' ? '✕' : '●'}
                        </span>
                        <span>{branch.text}</span>
                      </div>
                    ))}
                  </div>
                ) : null}
                {step.key ? (
                  <div className="tl-key">
                    <Icon name="i-spark" />
                    <span>
                      <strong>关键结论：</strong>
                      <Runs runs={step.key} />
                    </span>
                  </div>
                ) : null}
              </div>
            ))}
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
 * 后者在 `onresult` 上多写十行，换来的是"读代码时知道调了什么"。
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
 * 原型的 `stopVoice()` 是这样"识别"的：
 *
 *     const phrases = ['今天有什么安排', '帮我看看工作域…', …];
 *     lastVoiceResult = phrases[Math.floor(Math.random() * phrases.length)];
 *
 * 也就是说：它从五个写死的句子里**随机挑一句**，然后当成"你说的话"显示出来。
 * 这不是"演示用的简化"，而是**凭空产生用户从未说过的内容** ——
 * 而语音输入的下游是"填入输入框并发送"，等于替用户发了一句他没说过的话。
 * 这一类必须换实现，不能照搬。
 *
 * 处置：接**真的** `SpeechRecognition`（Chrome / Edge / Safari 有），
 * 环境没有这个 API 时（典型的例子是 Tauri 的 WKWebView）**明说没有**，
 * 而不是回落到随机句子。三条出口：
 *   · 有 API 且识别到内容 → 显示识别结果，确认后填入输入框；
 *   · 有 API 但没识别到 / 出错 → 显示原因；
 *   · 没有 API → 显示"这个运行环境没有语音识别"，并禁用"停止录音"。
 */
export function AiVoiceOverlay({ open, onClose, onRecordingChange }: AiVoiceOverlayProps) {
  const [phase, setPhase] = useState<VoicePhase>('listening')
  const [detail, setDetail] = useState('')
  const [transcript, setTranscript] = useState('')
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  /** 把识别到的文字填进输入框并关掉浮层 —— 这一步是**真的**（草稿就在 store 里） */
  const setDraft = useAiStore((state) => state.setDraft)

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

  function confirm() {
    if (!transcript.trim()) {
      toast('没有识别到内容')
      return
    }
    setDraft(transcript)
    onClose()
    toast('已填入输入框，确认后发送')
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
              ? '请说话，识别完成后可确认填入输入框'
              : detail}
        </div>

        {!listening ? (
          <div className={cn('voice-result', transcript.trim() && 'show')}>
            <div className="voice-result-label">
              <Icon name="i-check" />
              识别结果
            </div>
            <div>{transcript}</div>
            <div className="voice-result-actions">
              <button type="button" className="voice-result-btn" onClick={cancel}>
                关闭
              </button>
              <button type="button" className="voice-result-btn primary" onClick={confirm}>
                填入输入框
              </button>
            </div>
          </div>
        ) : null}

        {/* ⚠️ 与原型一致：出结果之后**收起**那一排（原型的 `voiceActions.style.display='none'`）。
            不收的话会同时出现"停止录音"和"填入输入框"，而此刻已经没有在录音了。 */}
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
