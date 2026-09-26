import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../lib/cn'
import { Icon } from '../icons/Icon'
import { messageText, useAiStore } from '../../stores/ai-store'
import type { AiSession } from '../../data/ai/types'
import { GlyphChat } from './ai-glyphs'
import { pressable } from './pressable'

/**
 * 会话搜索（原型第二轮新增：顶栏那个放大镜 + `.search-box` 浮层）。
 *
 * ============================================================================
 * 它搜的是**会话与消息**，不是页面
 * ============================================================================
 * 外壳顶栏那颗放大镜打开的是命令面板（搜九域与分区），语义是"跳转到某个页面"。
 * 这一颗搜的是"我说过什么"，落在同一条顶栏的 `actions` 槽里 ——
 * 两者不冲突，因为**入口不同、对象也不同**。
 *
 * ⚠️ 高亮用 `<mark>` 元素渲染，而不是把命中的片段包成 HTML 字符串再
 *    `dangerouslySetInnerHTML`（原型是后者）。理由与全站一致：这段文本是
 *    **用户自己敲进去的**，当代码执行等于把注入面递给它。
 */
interface SearchHit {
  key: string
  sessionId: string
  messageId?: string
  title: string
  preview: string
  isTitleHit: boolean
}

/** 把命中片段切成 [前, 命中, 后] 三段，用 `<mark>` 包中间那段 */
function Highlighted({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <>{text}</>
  const needle = query.trim()
  const lower = text.toLowerCase()
  const target = needle.toLowerCase()
  const parts: Array<{ text: string; hit: boolean }> = []
  let cursor = 0
  for (;;) {
    const at = lower.indexOf(target, cursor)
    if (at < 0) break
    if (at > cursor) parts.push({ text: text.slice(cursor, at), hit: false })
    parts.push({ text: text.slice(at, at + needle.length), hit: true })
    cursor = at + needle.length
  }
  if (!parts.length) return <>{text}</>
  if (cursor < text.length) parts.push({ text: text.slice(cursor), hit: false })
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>{part.hit ? <mark>{part.text}</mark> : part.text}</Fragment>
      ))}
    </>
  )
}

/** 在全部会话里找命中的标题与消息（原型同口径：标题优先、每条消息也扫） */
function search(sessions: AiSession[], query: string): SearchHit[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return []
  const hits: SearchHit[] = []
  for (const session of sessions) {
    if (session.title.toLowerCase().includes(needle)) {
      hits.push({
        key: `${session.id}:title`,
        sessionId: session.id,
        title: session.title,
        preview: '会话标题',
        isTitleHit: true,
      })
    }
    for (const message of session.messages) {
      const text = messageText(message)
      if (text.toLowerCase().includes(needle)) {
        hits.push({
          key: `${session.id}:${message.id}`,
          sessionId: session.id,
          messageId: message.id,
          title: session.title,
          preview: text.slice(0, 80),
          isTitleHit: false,
        })
      }
    }
  }
  return hits
}

export function AiSearchBox() {
  const sessions = useAiStore((state) => state.sessions)
  const select = useAiStore((state) => state.select)
  const jumpTo = useAiStore((state) => state.jumpTo)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hits = useMemo(() => search(sessions, query).slice(0, 20), [sessions, query])

  useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  /** 打开时把焦点给输入框。**要延后一帧**：这一帧它还在 `display:none`，
   *  对隐藏元素调 focus 是静默失败的（与命令面板同一条坑）。 */
  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => inputRef.current?.focus(), 50)
    return () => clearTimeout(timer)
  }, [open])

  function pick(hit: SearchHit) {
    select(hit.sessionId)
    setOpen(false)
    if (!hit.messageId) return
    /* ⚠️ 跳转要**排在会话切换之后**。切会话会让消息列表重新渲染，
       这一帧那条消息还不存在 —— 直接 scrollIntoView 会找不到元素。
       走 store 的 `jumpTo`，由页面在渲染完成后滚动 + 高亮。 */
    jumpTo(hit.messageId)
  }

  return (
    <div ref={boxRef} className="ai-search-anchor">
      <button
        type="button"
        className={cn('sb-icon-btn sb-narrow-keep', open && 'active')}
        title="搜索会话与消息"
        aria-label="搜索会话与消息"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="i-search" />
      </button>

      <div className={cn('search-box', open && 'show')} role="dialog" aria-label="搜索会话">
        <input
          ref={inputRef}
          type="text"
          className="ai-search-input"
          placeholder="搜索会话标题或消息内容…"
          aria-label="搜索会话标题或消息内容"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <div className="search-results">
          {!query.trim() ? (
            <div className="search-empty">输入关键词开始搜索</div>
          ) : !hits.length ? (
            <div className="search-empty">没有匹配结果</div>
          ) : (
            hits.map((hit) => (
              <div key={hit.key} className="search-result-item" {...pressable(() => pick(hit))}>
                <span className="sr-icon">
                  <GlyphChat />
                </span>
                <span className="sr-text">
                  <span style={{ fontWeight: 600, color: 'var(--mw-text-primary)', display: 'block' }}>
                    <Highlighted text={hit.title} query={query} />
                  </span>
                  <span style={{ fontSize: 11, display: 'block' }}>
                    <Highlighted text={hit.preview} query={query} />
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
