/* 文档原文 · 编辑面的工作副本（原型 edWork / edHist / edDrafts）。

   工作副本 = 当前 markdown + 文档名 + 上次保存的两份 + 历史栈，只活在编辑期。
   切到阅读态时 park：脏的话留一份草稿，切回来由草稿条决定接不接。
   markdown 是唯一事实源，可视面的 DOM 是它的视图。
   镜头（源码 / 可视）活在工作副本之外，默认可视，界面上叫「可视」。 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { RdBlock } from '../../../../data/workspace/doc-bodies'
import { mdOfBlocks, mdOfSource } from './md'
import { copyOf, saveCopy } from '../../../../data/workspace/doc-copies'

export type EdMode = 'src' | 'wys'

interface Draft { md: string; name: string }

/* 草稿：模块级（原型 `edDrafts` 也是模块级）—— 它要活过"切到阅读态"这次卸载。 */
const DRAFTS = new Map<string, Draft>()

/* 镜头：模块级。见文件头 —— 它不属于任何一篇的工作副本。 */
let MODE: EdMode = 'wys'

const HIST_MAX = 60
/* 打字进历史的防抖（原型 400ms）。工具动作立即记 —— 否则按一次格式刷会攒出
    十几条"一步都不到"的历史。 */
const HIST_TYPING_MS = 400

export function edDraftOf(id: string): Draft | undefined {
  return DRAFTS.get(id)
}

export function useEdWork(
  doc: { id: string; name: string },
  body: RdBlock[] | undefined,
  onSaved?: () => void,
) {
  /* 一律从 ref 里读"当前这一篇"的初值：重置 effect 只依赖 `doc.id`（换篇才重置），
     而 `doc.name` / `body` 在保存之后会变 —— 跟着它们重置就等于"保存一次、回到解放前"。 */
  const ctx = useRef({ name: doc.name, body })
  ctx.current = { name: doc.name, body }
  const initial = useCallback(() => (ctx.current.body ? mdOfBlocks(ctx.current.body) : ''), [])

  const [name, setName] = useState(() => ctx.current.name)
  const [baseName, setBaseName] = useState(() => ctx.current.name)
  const [base, setBase] = useState(initial)
  const [md, setMd] = useState(initial)
  const [hist, setHist] = useState<{ list: string[]; at: number }>(() => ({ list: [initial()], at: 0 }))
  const [mode, setModeState] = useState<EdMode>(() => MODE)
  const [draft, setDraft] = useState<Draft | undefined>(() => DRAFTS.get(doc.id))
  /* 「决定在这里建一份副本」：没有副本那一篇点过一次之后，就不再回到那句提示 ——
     它是这一次会话里的一个决定，不是文档的属性（文档属性还是"没有应用内副本"）。 */
  const [forced, setForced] = useState(false)
  /* 撤销 / 重做动过一次就自增：可视面靠它知道"md 是被整份换掉的"，必须重画。 */
  const [histToken, setHistToken] = useState(0)

  /* 「没有副本」= 这一篇在本仓只有索引（正文住在来源工具里）。编辑它 = 另建一份副本。 */
  const nocopy = !body && !forced

  const histLock = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const debounced = useRef<string | null>(null)

  const resetTo = useCallback((nextMd: string, nextName: string) => {
    setMd(nextMd)
    setBase(nextMd)
    setBaseName(nextName)
    setName(nextName)
    setHist({ list: [nextMd], at: 0 })
    histLock.current = false
  }, [])

  /* 换一篇 ⇒ 换一份工作副本，历史从这一份重新起头
     （不然 ⌘Z 会把上一篇文章的中间态刷到这一篇脸上）。 */
  useEffect(() => {
    const b = ctx.current.body ? mdOfBlocks(ctx.current.body) : ''
    resetTo(b, ctx.current.name)
    setDraft(DRAFTS.get(doc.id))
    setForced(false)
  }, [doc.id, resetTo])

  const dirty = !nocopy && (md !== base || name !== baseName)

  const push = useCallback((next: string) => {
    window.clearTimeout(timer.current)
    debounced.current = null
    if (histLock.current) return
    setHist((h) => {
      if (!h.list.length || h.list[h.at] === next) return h
      const list = h.list.slice(0, h.at + 1)
      list.push(next)
      if (list.length > HIST_MAX) list.shift()
      return { list, at: list.length - 1 }
    })
  }, [])

  /* 打字：先进防抖队列（每敲一个字都入栈 = 一次撤销只退一个字）。 */
  const pushSoon = useCallback((next: string) => {
    debounced.current = next
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      if (debounced.current != null) push(debounced.current)
    }, HIST_TYPING_MS)
  }, [push])

  /* 文本变化（输入 / 工具动作共用这一个出口）。`immediate` = 工具动作，立刻入栈。 */
  const change = useCallback((next: string, immediate = false) => {
    setMd(next)
    if (immediate) push(next)
    else pushSoon(next)
  }, [push, pushSoon])

  const undo = useCallback((): string | null => {
    if (hist.at <= 0) return null
    const target = hist.list[hist.at - 1]
    histLock.current = true
    window.clearTimeout(timer.current)
    setHist((h) => ({ ...h, at: Math.max(0, h.at - 1) }))
    setMd(target)
    /* 一帧之后再解锁：这一趟不许再记历史，否则"撤一步"会又攒一条新的 */
    window.setTimeout(() => { histLock.current = false }, 0)
    setHistToken((t) => t + 1)
    return target
  }, [hist])

  const redo = useCallback((): string | null => {
    if (hist.at >= hist.list.length - 1) return null
    const target = hist.list[hist.at + 1]
    histLock.current = true
    window.clearTimeout(timer.current)
    setHist((h) => ({ ...h, at: Math.min(h.list.length - 1, h.at + 1) }))
    setMd(target)
    window.setTimeout(() => { histLock.current = false }, 0)
    setHistToken((t) => t + 1)
    return target
  }, [hist])

  const setMode = useCallback((next: EdMode) => {
    MODE = next
    setModeState(next)
  }, [])

  /* 离开编辑面（原型 `edPark`）：脏就留一份草稿，然后把工作副本丢掉。
      丢掉这一步不能省：下次进来必须先是"已保存的那一版"，由草稿条问"接不接"——
         不丢的话工作副本还带着脏改动，"这里先给你已保存的那一版"那句话就是假的。 */
  const park = useCallback(() => {
    window.clearTimeout(timer.current)
    if (debounced.current != null) { push(debounced.current) }
    if (!nocopy && (md !== base || name !== baseName)) DRAFTS.set(doc.id, { md, name })
    resetTo(base, baseName)
  }, [base, baseName, doc.id, md, name, nocopy, push, resetTo])

  /* 重新读一次草稿（切回编辑面时调）：草稿是模块级 Map、不在 React 的依赖里，
      不刷新的话"切走写的、切回来看不到那条草稿"（state 还是进来时那一眼）。 */
  const refreshDraft = useCallback(() => { setDraft(DRAFTS.get(doc.id)) }, [doc.id])

  /* 保存：块回写"应用内副本"，并把源码规范化成存下来的那套写法
      ⇒ 从此两边逐字相同（不会攒出两套写法、也不会"存一次变一点"）。
      顺带清空历史：旧历史里的写法与规范化之后不是一套，留着只会让 ⌘Z 撤出半截东西。 */
  const save = useCallback(() => {
    if (nocopy) return
    const blocks = mdOfSource(md)
    const trimmed = name.trim() || doc.name
    saveCopy(doc.id, trimmed, blocks)
    const norm = mdOfBlocks(blocks)
    resetTo(norm, trimmed)
    DRAFTS.delete(doc.id)
    setDraft(undefined)
    onSaved?.()
  }, [doc.id, doc.name, md, name, nocopy, onSaved, resetTo])

  /* 放弃修改 = 回到上一次保存的版本（连带把那篇的草稿一起丢掉）。 */
  const dropChanges = useCallback(() => {
    const b = ctx.current.body ? mdOfBlocks(ctx.current.body) : ''
    DRAFTS.delete(doc.id)
    setDraft(undefined)
    resetTo(b, ctx.current.name)
  }, [doc.id, resetTo])

  const useDraft = useCallback(() => {
    if (!draft) return
    /* 接上的是另一份内容 ⇒ 历史也从头起 */
    resetTo(draft.md, draft.name)
    DRAFTS.delete(doc.id)
    setDraft(undefined)
    return draft
  }, [doc.id, draft, resetTo])

  const dropDraft = useCallback(() => {
    DRAFTS.delete(doc.id)
    setDraft(undefined)
  }, [doc.id])

  /* 建副本：从空纸起步（原型 `edStartCopy`）—— 副本是"保存那一下"才真正建出来的，
      所以起步是空纸、保存按钮也是灰的，写第一个字之后才亮。 */
  const startCopy = useCallback(() => {
    setForced(true)
    resetTo('', ctx.current.name)
  }, [resetTo])

  const saved = copyOf(doc.id)

  return {
    name, setName: (v: string) => { setName(v) },
    md, change, mode, setMode, dirty, nocopy, histToken,
    canUndo: hist.at > 0, canRedo: hist.at < hist.list.length - 1,
    undo, redo, park, save, dropChanges, draft, useDraft, dropDraft, startCopy, refreshDraft,
    savedAt: saved?.at,
  }
}
