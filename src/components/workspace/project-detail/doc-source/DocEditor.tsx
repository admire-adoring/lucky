/* 文档原文 · 编辑面（原型 edToolbarHtml + docSourceEditHtml）。

   结构：贴边的工具条 + 左栏目录 + 居中窄栏纸，工具条在纸外。
   源码面是 textarea，可视面是 contenteditable，同一支 rdBlockHtml 渲染。
   行级动作两边都落到 markdown 上，可视面把 DOM 选区翻成"第 i 块 → md 的哪几行"。
   只有行内标记在可视面直接改 DOM，那是唯一能保住光标的路子。
   可视面打字时不重画，重画只发生在撤销重做、块级动作、切镜头。 */

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../../../lib/cn'
import { RD_NOTE, rdBlockHtml } from './rd-render'
import {
  ED_MARKS_SPEC, ED_TOOL_REJECT, ED_TPL, clearFormat, indentLines, insertNote, insertTpl,
  lineMarks, prefixLines, setHeading, setListNum, setPara, setSpan, toggleOl, wrapSel,
  type EdText,
} from './ed-tools'
import { hlCode } from './hl'
import { applyCodePrefs, codeBoxOf, codeClick, codeMenuClose, codePaint } from './code-block'
import { lineCharRange, mdOfDom, mdOfSource, mdTocItems, parseMd } from './md'
import type { EdMode } from './use-ed-work'

/* 24 网格图形，编辑态工具条用。与 rd-render 里那张是两份，只重叠三枚。 */
const ED_ICONS: Record<string, string> = {
  undo: '<polyline points="1 4 1 10 7 10"></polyline><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>',
  redo: '<polyline points="23 4 23 10 17 10"></polyline><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>',
  painter: '<path d="M4 2h13a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Z"></path><path d="M7 10v4a1 1 0 0 0 1 1h4v3"></path><rect x="10" y="17" width="4" height="5" rx="1"></rect>',
  clearformat: '<path d="M5 5h9"></path><path d="M9.5 5v9"></path><line x1="4" y1="20" x2="20" y2="4"></line>',
  moreText: '<line x1="8" y1="5" x2="16" y2="5"></line><line x1="12" y1="5" x2="12" y2="13.5"></line>',
  list: '<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>',
  ol: '<line x1="10" y1="6" x2="21" y2="6"></line><line x1="10" y1="12" x2="21" y2="12"></line><line x1="10" y1="18" x2="21" y2="18"></line><path d="M4 6h1v4"></path><path d="M4 10h2"></path><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"></path>',
  outdent: '<polyline points="10 8 6 12 10 16"></polyline><line x1="14" y1="6" x2="21" y2="6"></line><line x1="14" y1="12" x2="21" y2="12"></line><line x1="14" y1="18" x2="21" y2="18"></line>',
  indent: '<polyline points="6 8 10 12 6 16"></polyline><line x1="14" y1="6" x2="21" y2="6"></line><line x1="14" y1="12" x2="21" y2="12"></line><line x1="14" y1="18" x2="21" y2="18"></line>',
  lh: '<path d="M5 5.5v13"></path><polyline points="3 7.5 5 5.5 7 7.5"></polyline><polyline points="3 16.5 5 18.5 7 16.5"></polyline>',
  task: '<polyline points="9 11 12 14 20 6"></polyline><path d="M21 12v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h11"></path>',
  link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>',
  video: '<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2"></rect>',
  minus: '<line x1="4" y1="12" x2="20" y2="12"></line>',
  quote: '<path d="M7 7h3v6a3 3 0 0 1-3 3"></path><path d="M15 7h3v6a3 3 0 0 1-3 3"></path>',
  code: '<polyline points="16 18 22 12 16 6"></polyline><polyline points="8 6 2 12 8 18"></polyline>',
  table: '<rect x="3" y="4" width="18" height="16" rx="2"></rect><line x1="3" y1="10" x2="21" y2="10"></line><line x1="9" y1="10" x2="9" y2="20"></line><line x1="15" y1="10" x2="15" y2="20"></line>',
  alert: '<path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4M12 17h.01"></path>',
  ban: '<circle cx="12" cy="12" r="9"></circle><line x1="6.5" y1="17.5" x2="17.5" y2="6.5"></line>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline>',
  pen: '<path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path>',
  clock: '<circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline>',
  plus: '<line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line>',
  chevronLeft: '<polyline points="15 18 9 12 15 6"></polyline>',
}

export function EdIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: ED_ICONS[name] || '' }}
    />
  )
}

/* 色板 / 高亮 / 字号 / 字体 / 行高 / 标题 —— 都是取值型控件（选一个值施加上去）。 */
const ED_COLORS = [
  { key: 'default', name: '默认', value: '' },
  { key: 'red', name: '红', value: '#C0392B' },
  { key: 'orange', name: '橙', value: '#C97A16' },
  { key: 'green', name: '绿', value: '#2F855A' },
  { key: 'blue', name: '蓝', value: '#2B6CB0' },
  { key: 'purple', name: '紫', value: '#6B46C1' },
  { key: 'gray', name: '灰', value: '#718096' },
]
const ED_MARKS = [
  { key: 'none', name: '无', value: '' },
  { key: 'yellow', name: '黄', value: '#FBF0A8' },
  { key: 'green', name: '绿', value: '#C8E6C9' },
  { key: 'blue', name: '蓝', value: '#CFE0F5' },
  { key: 'pink', name: '粉', value: '#F7D6DE' },
]
const ED_SIZE_OPTS = [['', '默认'], ['13px', '13px'], ['15px', '15px'], ['18px', '18px'], ['24px', '24px']]
const ED_FONT_OPTS = [
  ['', '默认'],
  ['Georgia, serif', '衬线'],
  ['KaiTi, STKaiti, serif', '楷体'],
  ['ui-monospace, Menlo, monospace', '等宽'],
]
const ED_LH_OPTS = [['', '默认'], ['1', '1'], ['1.15', '1.15'], ['1.5', '1.5'], ['2', '2'], ['2.5', '2.5'], ['3', '3']]
/* 有序列表的三档编号（照原型卡片：值 / 说明 / 三行示例）。 */
const ED_OL_CARDS: [string, string, [string, number][]][] = [
  ['a', '1. / a. / i.', [['1.', 0], ['a.', 1], ['b.', 1], ['i.', 2], ['2.', 0]]],
  ['cn', '一、/ (一) / 1.', [['一、', 0], ['(一)', 1], ['(二)', 1], ['1.', 2], ['二、', 0]]],
  ['multi', '1. / 1.1. / 1.2.1.', [['1.', 0], ['1.1.', 1], ['1.2.', 1], ['1.2.1.', 2], ['2.', 0]]],
]
/* 「更多文本样式」那三项（粗/斜/删/下划线留在主排 —— 判据是按得勤不勤）。 */
const ED_MORE = [
  { kind: 'sup', glyph: 'X\u00B2', name: '上标' },
  { kind: 'sub', glyph: 'X\u2082', name: '下标' },
  { kind: 'code', glyph: '</>', name: '行内代码' },
]
/* 提示的五档：顺序与 key 清单都不另抄一份 —— 直接读 `RD_NOTE`（加档位只改一处）。 */
const NOTE_KEYS = RD_NOTE
const ED_HEADINGS = [['p', '正文'], ['h1', '标题 1'], ['h2', '标题 2'], ['h3', '标题 3'], ['h4', '标题 4'], ['h5', '标题 5'], ['h6', '标题 6']]

/* 行内标记的 `md[0]` → DOM 元素规格（格式刷逐层外包时要用）。 */
const MARK_TAG: Record<string, { tag: string; style?: string }> = {}
Object.values(ED_MARKS_SPEC).forEach((s) => {
  const m = /^<span style="([^"]*)">$/.exec(s.md[0])
  MARK_TAG[s.md[0]] = m ? { tag: 'span', style: m[1] } : { tag: s.tag }
})

/* 可视面渲染的空文档：不能给提示文字 —— 它是可编辑的，一打字就把"还没有内容"存进正文了。 */
function previewInner(md: string, wys: boolean): string {
  const blocks = mdOfSource(md)
  if (!blocks.length) {
    return wys ? '<p><br></p>' : '<p class="rd-empty-text">还没有内容 —— 切回「源码」，写第一行试试。</p>'
  }
  return blocks.map((b, i) => rdBlockHtml(b, i, wys)).join('')
}

/* 重渲之后收尾：末尾必须是一个空段落 —— 不然在最后一行回车，浏览器会造出结构奇怪的东西。 */
function afterRender(root: HTMLElement): void {
  const last = root.lastElementChild
  if (!last || String(last.tagName || '').toLowerCase() !== 'p') {
    const p = document.createElement('p')
    p.innerHTML = '<br>'
    root.appendChild(p)
  }
}

/* 把光标放到第 `i` 块的开头（重画之后用 —— 重画必然丢光标，"落到这一块"是最小代价）。 */
function focusBlockAt(root: HTMLElement | null, i: number): void {
  if (!root) return
  const el = root.children[Math.min(i, root.children.length - 1)] as HTMLElement | undefined
  if (!el) return
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(el)
  range.collapse(true)
  sel.removeAllRanges()
  sel.addRange(range)
  el.scrollIntoView({ block: 'nearest' })
}

function selectContents(el: Element): void {
  const sel = window.getSelection()
  if (!sel) return
  const range = document.createRange()
  range.selectNodeContents(el)
  sel.removeAllRanges()
  sel.addRange(range)
}

function unwrap(el: Element): void {
  const parent = el.parentNode
  if (!parent) return
  while (el.firstChild) parent.insertBefore(el.firstChild, el)
  parent.removeChild(el)
}

function closestTag(node: Node | null, root: Element, tag: string): Element | null {
  let n: Node | null = node
  while (n && n !== root) {
    if (n.nodeType === 1 && (n as Element).tagName.toLowerCase() === tag) return n as Element
    n = n.parentNode
  }
  return null
}

export interface DocEditorProps {
  md: string
  /* 文档名（纸头那一行输入框）。改它也算"脏" —— 标题是文档的一部分。 */
  name: string
  onName: (v: string) => void
  mode: EdMode
  canUndo: boolean
  canRedo: boolean
  /* 撤销 / 重做动过一次就自增 —— 可视面靠它知道"md 是被整份换掉的"，得重画 */
  histToken: number
  onMd: (next: string, immediate?: boolean) => void
  onUndo: () => void
  onRedo: () => void
  onMode: (mode: EdMode) => void
  onSave: () => void
  onNotice: (text: string) => void
  /* 工具条实高写进 `--ed-tb`（`ResizeObserver` 的量法在宿主那一层，页面里要读它） */
  onToolbar: (el: HTMLDivElement | null) => void
  /* 草稿条（纸头上那一块"上一次有一份没保存的改动"）—— 它由宿主决定有没有 */
  draftSlot?: React.ReactNode
  /* 纸头那行坐标（位置 / 类型 / 来源）—— 它读的是文档的元信息，不在编辑器手里 */
  metaSlot?: React.ReactNode
}

export function DocEditor({
  md, name, onName, mode, canUndo, canRedo, histToken, onMd, onUndo, onRedo, onMode, onSave,
  onNotice, onToolbar, draftSlot, metaSlot,
}: DocEditorProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  /* 可视面那一格（`.ed-preview`）—— 表格把手的坐标原点，也是 mousemove 的挂载点 */
  const boxRef = useRef<HTMLDivElement | null>(null)
  const taRef = useRef<HTMLTextAreaElement | null>(null)
  const mdRef = useRef(md)
  mdRef.current = md
  const pendingSel = useRef<[number, number] | null>(null)
  const pendingBlock = useRef<number | null>(null)
  const brush = useRef<[string, string][] | null>(null)
  const wysTimer = useRef<number | undefined>(undefined)
  const [paint, setPaint] = useState(0)
  const [pop, setPop] = useState<string | null>(null)
  const [marks, setMarks] = useState<string[]>([])
  const [tocOn, setTocOn] = useState<string | null>(null)

  const toc = useMemo(() => mdTocItems(md), [md])
  const ranges = useMemo(() => parseMd(md).ranges, [md])

  /* ------------------------------------------------------------ 可视面：画 DOM
     只依赖 `paint`，不依赖 `md` —— 依赖 md 的话每敲一个字都重灌 innerHTML，
        光标就跳回开头（用户视角："打着字突然跳到上面去了"）。 */
  useLayoutEffect(() => {
    if (mode !== 'wys') return
    const root = rootRef.current
    if (!root) return
    const page = root.closest('.rd-page') as HTMLElement | null
    const top = page ? page.scrollTop : 0
    root.innerHTML = previewInner(mdRef.current, true)
    afterRender(root)
    /* 重渲会造出新的 DOM ⇒ 代码块的视图偏好（行号 / 换行 / 字号 / 标题栏）
       必须重新敷一遍，否则一改就"回到默认"（而这件事不报错，只是"设置不生效"）。
       菜单同理：新节点里没有哪一块的菜单是开着的。 */
    applyCodePrefs(root)
    codeMenuClose()
    if (page) page.scrollTop = top
    if (pendingBlock.current != null) {
      focusBlockAt(root, pendingBlock.current)
      pendingBlock.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paint, mode])

  /* 撤销 / 重做 / 切镜头：md 是被整份换掉的 ⇒ 必须重画（并把光标落到块首）。 */
  useEffect(() => {
    setPaint((p) => p + 1)
  }, [histToken, mode])

  /* ------------------------------------------------------------ 源码框：长高 + 光标 */
  const autoGrow = useCallback((ta: HTMLTextAreaElement) => {
    ta.style.height = 'auto'
    /* 要补 `offsetHeight - clientHeight`：全局 `box-sizing: border-box`，而
       `scrollHeight` 不含描边 ⇒ 直接赋它差 2px，最后一行被裁。 */
    const need = ta.scrollHeight + ta.offsetHeight - ta.clientHeight
    const min = parseFloat(getComputedStyle(ta).minHeight) || 0
    if (need <= min + 1) { ta.style.height = ''; return }
    ta.style.height = need + 'px'
  }, [])

  useEffect(() => {
    if (mode !== 'src') return
    const ta = taRef.current
    if (!ta) return
    const sel = pendingSel.current
    if (sel) {
      ta.focus()
      const a = Math.max(0, Math.min(sel[0], ta.value.length))
      const b = Math.max(a, Math.min(sel[1], ta.value.length))
      ta.setSelectionRange(a, b)
      pendingSel.current = null
    }
    autoGrow(ta)
  }, [md, mode, autoGrow])

  /* ------------------------------------------------------------------ 提交与选区 */
  const commitDom = useCallback((immediate: boolean) => {
    const root = rootRef.current
    if (!root || mode !== 'wys') return
    const next = mdOfDom(root)
    if (next === mdRef.current) return
    onMd(next, immediate)
  }, [mode, onMd])

  /* 可视面敲字：立刻把 DOM 序列化回 md。
     不 debounce 是因为防抖期间切走会丢字。需要防抖的是历史，那在 use-ed-work 里。 */
  const scheduleDom = useCallback(() => { commitDom(false) }, [commitDom])

  /* 切镜头之前把压在 debounce 里的那几次按键落下来 —— 不落就会"切过去看到 140ms 前的内容"。 */
  const flushDom = useCallback(() => {
    window.clearTimeout(wysTimer.current)
    commitDom(true)
  }, [commitDom])

  /* 卸载只清定时器。这里不能再序列化一次：切到阅读态时 park 已经把工作副本退了，
     再落一次会把刚退掉的改动顶回来。 */
  useEffect(() => () => { window.clearTimeout(wysTimer.current) }, [])

  /* 源码面的行级动作：`(v, s, e) => 新文本`。 */
  const srcRun = useCallback((fn: (v: string, s: number, e: number) => EdText | null, why: keyof typeof ED_TOOL_REJECT) => {
    const ta = taRef.current
    if (!ta) return
    const out = fn(mdRef.current, ta.selectionStart, ta.selectionEnd)
    if (!out) { onNotice(ED_TOOL_REJECT[why]); return }
    pendingSel.current = [out.s, out.e]
    onMd(out.v, true)
  }, [onMd, onNotice])

  /* 可视面的块级动作：DOM 选区 → 第 i 块 → md 的行区间 → 调同一支纯函数。
      走 md 层（而不是在 DOM 上改结构）：块的合并/拆分是 markdown 的语法，
         DOM 上做一遍等于把 `mdOfSource` 的规则再写一份。代价是重画一次、光标落到块首。 */
  const wysRun = useCallback((fn: (v: string, s: number, e: number) => EdText | null, why: keyof typeof ED_TOOL_REJECT) => {
    const root = rootRef.current
    const sel = window.getSelection()
    if (!root || !sel || !sel.rangeCount) return
    let n: Node | null = sel.getRangeAt(0).startContainer
    while (n && n.parentNode !== root) n = n.parentNode
    if (!n) return
    const i = Array.prototype.indexOf.call(root.children, n)
    if (i < 0) return
    const [ls, le] = ranges[i] ?? [0, 0]
    const { s, e } = lineCharRange(mdRef.current, ls, le)
    const out = fn(mdRef.current, s, e)
    if (!out) { onNotice(ED_TOOL_REJECT[why]); return }
    pendingBlock.current = i
    onMd(out.v, true)
    setPaint((p) => p + 1)
  }, [onMd, onNotice, ranges])

  /* 两镜头共用的一层：按模式分派到上面两支。 */
  const run = useCallback((fn: (v: string, s: number, e: number) => EdText | null, why: keyof typeof ED_TOOL_REJECT) => {
    if (mode === 'wys') wysRun(fn, why)
    else srcRun(fn, why)
  }, [mode, srcRun, wysRun])

  /* ------------------------------------------------------------ 可视面的行内标记 */
  const wysWrap = useCallback((tag: string, style?: string, offTag?: string) => {
    const root = rootRef.current
    const sel = window.getSelection()
    if (!root || !sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    if (range.collapsed) { onNotice(ED_TOOL_REJECT.sel); return }
    if (!root.contains(range.commonAncestorContainer)) return
    const inCode = (range.commonAncestorContainer as Element).parentElement?.closest('.rd-code')
    if (inCode) { onNotice('代码块里不套行内格式 —— 那是代码，不是文字'); return }
    /* 互斥的那一对先剥（只有上下标有）：同一段字不可能既在上又在下 */
    if (offTag) {
      root.querySelectorAll(offTag).forEach((el) => { if (range.intersectsNode(el)) unwrap(el) })
    }
    const exist = closestTag(range.startContainer, root, tag)
    if (exist && exist.contains(range.endContainer)) { unwrap(exist); commitDom(true); return }
    const el = document.createElement(tag)
    if (style) el.setAttribute('style', style)
    el.appendChild(range.extractContents())
    range.insertNode(el)
    selectContents(el)
    commitDom(true)
  }, [commitDom, onNotice])

  const wysSpan = useCallback((prop: string, value: string) => {
    const root = rootRef.current
    const sel = window.getSelection()
    if (!root || !sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    if (range.collapsed) { onNotice(ED_TOOL_REJECT.sel); return }
    if (!root.contains(range.commonAncestorContainer)) return
    /* 先摘掉同属性的旧壳再套新的 —— 不摘就叠出两层同色 span，越改越厚。
       摘的是"范围里碰到的"那些：跨段落时逐段各摘各的。 */
    const re = new RegExp('(^|;)\\s*' + prop + ':')
    root.querySelectorAll('span[style]').forEach((el) => {
      if (range.intersectsNode(el) && re.test(el.getAttribute('style') || '')) unwrap(el)
    })
    if (!value) { commitDom(true); return }
    const el = document.createElement('span')
    el.setAttribute('style', prop + ':' + value)
    el.appendChild(range.extractContents())
    range.insertNode(el)
    selectContents(el)
    commitDom(true)
  }, [commitDom, onNotice])

  /* 格式刷在可视面：逐层外包（每层都包住上一次的结果，最外层最后落）。 */
  const wysWrapAll = useCallback((pairs: [string, string][]) => {
    const root = rootRef.current
    const sel = window.getSelection()
    if (!root || !sel || !sel.rangeCount) return
    const range = sel.getRangeAt(0)
    if (range.collapsed) { onNotice(ED_TOOL_REJECT.sel); return }
    let frag: Node = range.extractContents()
    pairs.forEach(([open]) => {
      const spec = MARK_TAG[open]
      if (!spec) return
      const el = document.createElement(spec.tag)
      if (spec.style) el.setAttribute('style', spec.style)
      el.appendChild(frag)
      const wrap = document.createDocumentFragment()
      wrap.appendChild(el)
      frag = wrap
    })
    range.insertNode(frag)
    commitDom(true)
  }, [commitDom, onNotice])

  /* ------------------------------------------------------------------ 工具分派 */
  const painterStep = useCallback(() => {
    if (brush.current) {
      const pairs = brush.current
      brush.current = null
      setMarks((m) => m.filter((x) => x !== 'painter'))
      if (mode === 'wys') {
        wysWrapAll(pairs)
      } else {
        const ta = taRef.current
        if (!ta) return
        if (ta.selectionStart === ta.selectionEnd) { onNotice(ED_TOOL_REJECT.sel); return }
        let s = ta.selectionStart
        let e = ta.selectionEnd
        let v = mdRef.current
        const sel = v.slice(s, e)
        const open = pairs.map((p) => p[0]).join('')
        const close = pairs.slice().reverse().map((p) => p[1]).join('')
        v = v.slice(0, s) + open + sel + close + v.slice(e)
        s += open.length
        e += open.length
        pendingSel.current = [s, e]
        onMd(v, true)
      }
      return
    }
    /* 取样式：光标所在那一行的行内标记（源码是唯一事实源 ⇒"样式"就是"这一段里有哪几对标记"） */
    let lineText = ''
    if (mode === 'wys') {
      const root = rootRef.current
      const sel = window.getSelection()
      if (!root || !sel || !sel.rangeCount) return
      let n: Node | null = sel.getRangeAt(0).startContainer
      while (n && n.parentNode !== root) n = n.parentNode
      if (n) lineText = mdOfDom(root)      /* 兜底：取不到就用整篇（下面照样能挑出标记） */
      if (n) {
        const i = Array.prototype.indexOf.call(root.children, n)
        const [ls, le] = ranges[i] ?? [0, 0]
        const { s, e } = lineCharRange(mdRef.current, ls, le)
        lineText = mdRef.current.slice(s, e)
      }
    } else {
      const ta = taRef.current
      if (!ta) return
      const L = { ls: mdRef.current.lastIndexOf('\n', ta.selectionStart - 1) + 1, le: mdRef.current.indexOf('\n', ta.selectionEnd) }
      lineText = mdRef.current.slice(L.ls, L.le < 0 ? mdRef.current.length : L.le)
    }
    const found = lineMarks(lineText)
    if (!found.length) { onNotice(ED_TOOL_REJECT.nomark); return }
    brush.current = found
    setMarks((m) => [...m, 'painter'])
    onNotice('格式刷已就绪 —— 选中别处再点一下这颗')
  }, [mode, onMd, onNotice, ranges, wysWrapAll])

  const runTool = useCallback((kind: string, val = '') => {
    setPop(null)
    if (kind === 'undo') { onUndo(); return }
    if (kind === 'redo') { onRedo(); return }
    if (kind === 'painter') { painterStep(); return }
    if (kind === 'clear') { run(clearFormat, 'para'); return }
    if (kind === 'heading') { run((v, s, e) => setHeading(v, s, e, val), 'para'); return }
    if (kind === 'align') { run((v, s, e) => setPara(v, s, e, 'al', val), 'para'); return }
    if (kind === 'lh') { run((v, s, e) => setPara(v, s, e, 'lh', val), 'para'); return }
    if (kind === 'color') { mode === 'wys' ? wysSpan('color', val) : srcRun((v, s, e) => setSpan(v, s, e, 'color', val), 'sel'); return }
    if (kind === 'mark') { mode === 'wys' ? wysSpan('background', val) : srcRun((v, s, e) => setSpan(v, s, e, 'background', val), 'sel'); return }
    if (kind === 'size') { mode === 'wys' ? wysSpan('font-size', val) : srcRun((v, s, e) => setSpan(v, s, e, 'font-size', val), 'sel'); return }
    if (kind === 'font') { mode === 'wys' ? wysSpan('font-family', val) : srcRun((v, s, e) => setSpan(v, s, e, 'font-family', val), 'sel'); return }
    const spec = ED_MARKS_SPEC[kind]
    if (spec) {
      const off = spec.off ? ED_MARKS_SPEC[spec.off].tag : undefined
      if (mode === 'wys') {
        /* 下划线那一支是"span + 样式"，其余是纯标签 */
        const m = /^<span style="([^"]*)">$/.exec(spec.md[0])
        wysWrap(spec.tag, m ? m[1] : undefined, off)
      } else {
        srcRun((v, s, e) => wrapSel(v, s, e, spec.md[0], spec.md[1], off), 'sel')
      }
      return
    }
    /* 有序列表必须单独一支：它不是"给这几行加个前缀"——取消时要把列表拆成前后两段、
       后段写 `start` 续号（见 `toggleOl`）。 */
    if (kind === 'ol') { run(toggleOl, 'para'); return }
    if (kind === 'ul' || kind === 'quote' || kind === 'task') {
      run((v, s, e) => prefixLines(v, s, e, kind), 'para')
      return
    }
    if (kind === 'indent' || kind === 'outdent') { run((v, s, e) => indentLines(v, s, e, kind === 'indent' ? 1 : -1), 'indent'); return }
    if (kind === 'olnum') { run((v, s, e) => setListNum(v, s, e, val), 'para'); return }
    if (kind === 'note') { run((v, s, e) => insertNote(v, s, e, val || 'info'), 'para'); return }
    /* 插入型：插在这一块之后（可视面）/ 光标处（源码面）。 */
    if (kind === 'link' || kind === 'image' || kind === 'video' || kind === 'hr' || kind === 'fence' || kind === 'table') {
      const tplOf = (sel: string) => (kind === 'link' ? '[' + (sel || '链接文字') + '](https://)' : ED_TPL[kind])
      if (mode === 'wys') {
        const root = rootRef.current
        const sel = window.getSelection()
        if (!root || !sel || !sel.rangeCount) return
        let n: Node | null = sel.getRangeAt(0).startContainer
        while (n && n.parentNode !== root) n = n.parentNode
        if (!n) return
        const i = Array.prototype.indexOf.call(root.children, n)
        const [ls, le] = ranges[i] ?? [0, 0]
        const { e } = lineCharRange(mdRef.current, ls, le)
        const out = insertTpl(mdRef.current, e, e, tplOf(''))
        pendingBlock.current = i + 1
        onMd(out.v, true)
        setPaint((p) => p + 1)
      } else {
        const ta = taRef.current
        if (!ta) return
        const out = insertTpl(mdRef.current, ta.selectionStart, ta.selectionEnd, tplOf(mdRef.current.slice(ta.selectionStart, ta.selectionEnd)))
        pendingSel.current = [out.s, out.e]
        onMd(out.v, true)
      }
    }
  }, [mode, onMd, onRedo, onUndo, painterStep, ranges, run, srcRun, wysSpan, wysWrap])

  /* -------------------------------------------------------- 代码块的语法高亮 */
  /* 重画高亮层。编辑态的 <code> 里是纯文本，颜色画在 .rd-code-hl 上，
     所以重画不影响光标；阅读态没有那一层，直接染 <code>。 */
  const paintHl = useCallback((box: Element | null) => {
    if (!box) return
    const code = box.querySelector('.rd-code-pre code')
    if (!code) return
    const layer = box.querySelector('.rd-code-hl')
    const html = hlCode(code.textContent || '', box.getAttribute('data-lang') || 'text')
    if (layer) layer.innerHTML = html
    else code.innerHTML = html
  }, [])

  const hlTimer = useRef<number | undefined>(undefined)
  /* 打字时延后重画（每敲一个字重扫全文不值得）。 */
  const paintHlSoon = useCallback((box: Element | null) => {
    if (!box) return
    window.clearTimeout(hlTimer.current)
    hlTimer.current = window.setTimeout(() => paintHl(box), 140)
  }, [paintHl])

  /* 把某一个代码块的样式（可选连语言）同步到这一篇的所有代码块。
     改完必须 commitDom 回写 md，只改 DOM 就是"看起来同步了、保存就丢"。 */
  const syncCodeAll = (box: Element, withLang: boolean) => {
    const root = rootRef.current
    const style = box.getAttribute('data-style') || 'light'
    const lang = box.getAttribute('data-lang') || 'text'
    if (root) {
      Array.prototype.forEach.call(root.querySelectorAll('.rd-code'), (el: Element) => {
        el.setAttribute('data-style', style)
        codePaint(el)
        if (withLang) {
          el.setAttribute('data-lang', lang)
          const sel = el.querySelector('.rd-code-lang') as HTMLSelectElement | null
          if (sel) sel.value = lang
        }
        /* 语言可能刚被改过 ⇒ 高亮跟着重画 */
        paintHl(el)
      })
    }
    commitDom(true)
    onNotice(withLang ? '已把样式与语言同步到全文的代码块' : '已把样式同步到全文的代码块')
  }

  /* ------------------------------------------------------------ 表格的行列浮层 */
  /*
     表格行列浮层（原型 edTb*）：左边线加/删行，上边线加/删列，下边线外插一张新表。
     浮层挂在可编辑正文之外，否则会被序列化进正文。
     找表按几何算：缝在表格外面，closest('table') 恒为 null。
     坐标只走 px()/py() 一对出口，与 .ed-preview 同原点。
     三个区有优先级：行簇 → 列簇 → 表下那颗。收手用 mouseout，mouseleave 不冒泡。
  */
  const TB_STRIP = 30       /* 边线外多宽算"贴到边线上"（与 CSS 那个 22px 的把手一起看） */
  const TB_BTN = 22         /* 把手边长（与 `.rd-tb-btn` 一起改；位置按半个算） */
  const TB_GAP = 4          /* 同一簇里两颗之间的缝 */
  type TbKey = 'rowAdd' | 'rowDel' | 'colAdd' | 'colDel' | 'new' | 'insRow' | 'insCol'
  const tbRefs = useRef<Partial<Record<TbKey, HTMLElement | null>>>({})
  /* 现在指着的那张表 —— 点那一下要靠它（把手不在表里） */
  const tbTable = useRef<HTMLTableElement | null>(null)

  const tbHide = useCallback(() => {
    Object.values(tbRefs.current).forEach((el) => el?.classList.remove('is-on'))
  }, [])

  /* 摆一颗把手。`at` 记"指着第几行/第几列" —— 点的那一下读它。 */
  const tbPut = (el: HTMLElement | null | undefined, x: number, y: number, at: number, title: string) => {
    if (!el) return
    el.style.left = Math.round(x) + 'px'
    el.style.top = Math.round(y) + 'px'
    el.dataset.at = String(at)
    el.title = title
    el.classList.add('is-on')
  }
  /* 摆一条插入指示线：告诉"新的一行 / 一列落在哪"。
      画在表格里面（把手在表外）⇒ 两者不会互相遮住。 */
  const tbIns = (el: HTMLElement | null | undefined, x: number, y: number, w: number, h: number) => {
    if (!el) return
    el.style.left = Math.round(x) + 'px'
    el.style.top = Math.round(y) + 'px'
    el.style.width = Math.max(0, Math.round(w)) + 'px'
    el.style.height = Math.max(0, Math.round(h)) + 'px'
    el.classList.add('is-on')
  }
  /* 鼠标在第几行、第几列（表小，逐个 `rect` 比就够，不值得为它建索引）。 */
  const tbHit = (table: HTMLTableElement, x: number, y: number) => {
    const out = { row: -1, col: -1 }
    const rows = table.rows
    for (let r = 0; r < rows.length; r += 1) {
      const rr = rows[r].getBoundingClientRect()
      if (y >= rr.top && y <= rr.bottom) { out.row = r; break }
    }
    const first = rows[0]
    if (first) {
      for (let c = 0; c < first.cells.length; c += 1) {
        const cc = first.cells[c].getBoundingClientRect()
        if (x >= cc.left && x <= cc.right) { out.col = c; break }
      }
    }
    return out
  }
  /* 沿边线把整簇摆好。mid 是要对齐到哪（列传右缘、行传下缘），
     与插入指示线用同一个基准，否则会出现"线对、按钮错"。 */
  const tbAlong = (from: number, to: number, mid: number, need: number) => {
    const at = Math.max(from, Math.min(mid - need / 2, to - need))
    return { at, from0: Math.min(from, at), to0: Math.max(to, at + need) }
  }

  const tbMove = (event: React.MouseEvent) => {
    if (mode !== 'wys') return
    const box = boxRef.current
    const root = rootRef.current
    const target = event.target as HTMLElement
    /* 指着把手自己时什么都不做 —— 不然"刚想点它就没了" */
    if (!box || !root || (target.closest && target.closest('.rd-tb-btn'))) return
    const x = event.clientX
    const y = event.clientY
    const tables = root.querySelectorAll('table')
    let table: HTMLTableElement | null = null
    let rect: DOMRect | null = null
    for (let i = 0; i < tables.length; i += 1) {
      const r = tables[i].getBoundingClientRect()
      if (x >= r.left - TB_STRIP && x <= r.right + 4 && y >= r.top - TB_STRIP && y <= r.bottom + TB_STRIP) {
        table = tables[i] as HTMLTableElement
        rect = r
        break
      }
    }
    tbHide()
    if (!table || !rect) return
    tbTable.current = table
    const base = box.getBoundingClientRect()
    const half = TB_BTN / 2
    const need = TB_BTN * 2 + TB_GAP
    const hit = tbHit(table, x, y)
    const px = (v: number) => v - base.left
    const py = (v: number) => v - base.top

    /* ① 行簇：贴左边线，整簇竖排，夹在表的上下缘之间 + 一条"新行落在哪"的指示线 */
    if (hit.row >= 0 && table.rows[hit.row]) {
      const rr = table.rows[hit.row].getBoundingClientRect()
      const zone = tbAlong(rect.top, rect.bottom, rr.bottom, need)
      const inZone = x >= rect.left - TB_STRIP && x <= rect.left + half + 2
        && y >= zone.from0 - 2 && y <= zone.to0 + 2
      if (inZone) {
        const headRow = hit.row === 0 && !!table.tHead
        tbPut(tbRefs.current.rowAdd, px(rect.left) - half, py(zone.at), hit.row,
          headRow ? '在表头下面插入一行' : '在第 ' + (hit.row + 1) + ' 行下面插入一行')
        tbPut(tbRefs.current.rowDel, px(rect.left) - half, py(zone.at) + TB_BTN + TB_GAP, hit.row,
          headRow ? '表头行不能删 —— 它是这张表的列名' : '删除第 ' + (hit.row + 1) + ' 行')
        tbIns(tbRefs.current.insRow, px(rect.left), py(rr.bottom) - 1, rect.width, 2)
        return
      }
    }
    /* ② 列簇：贴上边线，整簇横排，夹在表的左右缘之间 + 一条指示线 */
    const first = table.rows[0]
    if (hit.col >= 0 && first && first.cells[hit.col]) {
      const cc = first.cells[hit.col].getBoundingClientRect()
      const zone = tbAlong(rect.left, rect.right, cc.right, need)
      const inZone = y >= rect.top - TB_STRIP && y <= rect.top + half + 2
        && x >= zone.from0 - 2 && x <= zone.to0 + 2
      if (inZone) {
        tbPut(tbRefs.current.colAdd, px(zone.at), py(rect.top) - half, hit.col,
          '在第 ' + (hit.col + 1) + ' 列右边插入一列')
        tbPut(tbRefs.current.colDel, px(zone.at) + TB_BTN + TB_GAP, py(rect.top) - half, hit.col,
          '删除第 ' + (hit.col + 1) + ' 列')
        tbIns(tbRefs.current.insCol, px(cc.right) - 1, py(rect.top), 2, rect.height)
        return
      }
    }
    /* ③ 表下边线外那颗「＋」：在这张表下面再插一张空表（横向居中，位置不用猜） */
    if (x >= rect.left && x <= rect.right && y > rect.bottom && y <= rect.bottom + TB_STRIP) {
      tbPut(tbRefs.current.new, px(rect.left) + rect.width / 2 - half, py(rect.bottom) + 4,
        table.rows.length, '在这张表下面再插一张空表')
    }
  }

  const tbOut = (event: React.MouseEvent) => {
    const target = event.target as HTMLElement
    if (target.closest && target.closest('.rd-tb-btn')) return
    const to = event.relatedTarget as HTMLElement | null
    /* 指针还在这一页里 ⇒ 交给 `tbMove` 逐次判（它自己会收）；出了这一页就没人再判了
       ⇒ 这里必须收一次，不然把手会僵在那儿。 */
    if (to && to.closest && to.closest('.ed-preview')) return
    tbHide()
  }

  /* 把光标放进某个元素（新增格子之后要"接着就能打字"）。 */
  const caretTo = (el: Element | null) => {
    if (!el) return
    const sel = window.getSelection()
    if (!sel) return
    const range = document.createRange()
    range.selectNodeContents(el)
    range.collapse(true)
    sel.removeAllRanges()
    sel.addRange(range)
  }

  /* 加一行 / 加一列。表头下面插的必须是 tbody 的 td，插 th 会变成两行表头。
      新格子给一个 <br>，空的 td 不占高度。 */
  const tbAdd = (kind: 'row' | 'col') => {
    const table = tbTable.current
    const btn = kind === 'row' ? tbRefs.current.rowAdd : tbRefs.current.colAdd
    const at = btn ? Number(btn.dataset.at) : -1
    if (!table || !table.parentNode || !(at >= 0)) { onNotice('把鼠标移回表格边线上再来一次'); return }
    const rows = table.rows
    const width = rows[0] ? rows[0].cells.length : 0
    if (kind === 'row') {
      const head = table.tHead && table.tHead.rows[0] ? table.tHead.rows[0] : null
      const tr = document.createElement('tr')
      for (let c = 0; c < width; c += 1) tr.insertCell(-1).innerHTML = '<br>'
      if (head && at === 0) {
        const body = table.tBodies[0] || table.appendChild(document.createElement('tbody'))
        body.insertBefore(tr, body.firstChild)
      } else if (rows[at]) {
        rows[at].parentNode?.insertBefore(tr, rows[at].nextSibling)
      } else return
      caretTo(tr.cells[0])
      tbHide()
      commitDom(true)
      onNotice('加了一行')
      return
    }
    let focusCell: HTMLTableCellElement | null = null
    Array.prototype.forEach.call(rows, (row: HTMLTableRowElement) => {
      const inHead = String((row.parentNode as Element | null)?.tagName || '').toUpperCase() === 'THEAD'
      const cell = document.createElement(inHead ? 'th' : 'td')
      cell.innerHTML = '<br>'
      const ref = row.cells[at]
      if (ref) row.insertBefore(cell, ref.nextSibling)
      else row.appendChild(cell)
      if (!focusCell && !inHead) focusCell = cell
    })
    if (focusCell) caretTo(focusCell)
    tbHide()
    commitDom(true)
    onNotice('加了一列')
  }

  /* 删一行 / 删一列。表头行不给删，最后一列不给删。
      删之前不弹确认，撤销能整条撤回来。 */
  const tbDel = (kind: 'row' | 'col') => {
    const table = tbTable.current
    const btn = kind === 'row' ? tbRefs.current.rowDel : tbRefs.current.colDel
    const at = btn ? Number(btn.dataset.at) : -1
    if (!table || !table.parentNode || !(at >= 0)) { onNotice('把鼠标移回表格边线上再来一次'); return }
    const rows = table.rows
    if (kind === 'row') {
      const row = rows[at]
      if (!row) return
      if (table.tHead && row.parentNode === table.tHead) { onNotice('表头行不能删 —— 它是这张表的列名'); return }
      row.parentNode?.removeChild(row)
    } else {
      if (rows[0] && rows[0].cells.length <= 1) { onNotice('至少要留一列'); return }
      Array.prototype.forEach.call(rows, (row: HTMLTableRowElement) => {
        if (row.cells[at]) row.removeChild(row.cells[at])
      })
    }
    tbHide()
    commitDom(true)
    onNotice(kind === 'row' ? '删了一行' : '删了一列')
  }

  /* 表格下边线外那颗「＋」：在它下面再插一张空表（表头两列 + 一行空）。 */
  const tbAddTable = () => {
    const table = tbTable.current
    if (!table || !table.parentNode) { onNotice('把鼠标移回表格边线上再来一次'); return }
    const node = document.createElement('table')
    node.innerHTML = '<thead><tr><th>列 1</th><th>列 2</th></tr></thead>'
      + '<tbody><tr><td><br></td><td><br></td></tr></tbody>'
    table.parentNode.insertBefore(node, table.nextSibling)
    const root = rootRef.current
    if (root) afterRender(root)
    caretTo(node.querySelector('th'))
    tbHide()
    commitDom(true)
    onNotice('下面插了一张空表 —— 表头写列名，Tab 走格子')
  }

  /* ------------------------------------------------------------------ 工具栏高亮 */
  const syncMarks = useCallback(() => {
    const sel = window.getSelection()
    if (mode === 'wys') {
      const root = rootRef.current
      if (!root || !sel || !sel.rangeCount) { setMarks([]); return }
      const range = sel.getRangeAt(0)
      const found: string[] = []
      let n: Node | null = range.startContainer
      while (n && n !== root) {
        if (n.nodeType === 1) {
          const el = n as Element
          const tag = el.tagName.toLowerCase()
          Object.entries(ED_MARKS_SPEC).forEach(([k, s]) => { if (s.tag === tag && k !== 'underline') found.push(k) })
          if (tag === 'span') {
            const st = el.getAttribute('style') || ''
            if (/text-decoration:\s*underline/.test(st)) found.push('underline')
            if (/(^|;)\s*color:/.test(st)) found.push('color')
            if (/(^|;)\s*background:/.test(st)) found.push('mark')
          }
        }
        n = n.parentNode
      }
      if (brush.current) found.push('painter')
      setMarks((prev) => (prev.slice().sort().join() === found.slice().sort().join() ? prev : found))
      return
    }
    const ta = taRef.current
    if (!ta) return
    const v = mdRef.current
    const s = ta.selectionStart
    const e = ta.selectionEnd
    const found: string[] = []
    Object.entries(ED_MARKS_SPEC).forEach(([k, spec]) => {
      const o = spec.md[0]
      if (v.slice(Math.max(0, s - o.length), s) === o && v.slice(e, e + spec.md[1].length) === spec.md[1]) found.push(k)
    })
    if (brush.current) found.push('painter')
    setMarks(found)
  }, [mode])

  useEffect(() => {
    if (mode !== 'wys') return
    const onSel = () => syncMarks()
    document.addEventListener('selectionchange', onSel)
    return () => document.removeEventListener('selectionchange', onSel)
  }, [mode, syncMarks])

  /* ------------------------------------------------------------------ 键盘 */
  const onKeyDown = (event: React.KeyboardEvent) => {
    const meta = event.metaKey || event.ctrlKey
    const k = event.key.toLowerCase()
    if (meta && k === 's') { event.preventDefault(); onSave(); return }
    if (meta && k === 'b') { event.preventDefault(); runTool('bold'); return }
    if (meta && k === 'i') { event.preventDefault(); runTool('italic'); return }
    if (meta && k === 'u') { event.preventDefault(); runTool('underline'); return }
    if (meta && k === 'z') { event.preventDefault(); if (event.shiftKey) runTool('redo'); else runTool('undo') }
  }

  /* ------------------------------------------------------------------ 目录跳转 */
  const goto = (id: string, line: number) => {
    setTocOn(id)
    if (mode === 'src') {
      const ta = taRef.current
      if (!ta) return
      const { s } = lineCharRange(md, line, line)
      ta.focus()
      ta.setSelectionRange(s, s)
      return
    }
    const idx = ranges.findIndex(([a, b]) => line >= a && line <= b)
    if (idx >= 0) focusBlockAt(rootRef.current, idx)
  }

  const popClass = (key: string) => cn('ed-pop', pop === key && 'open')

  return (
    <>
      <div className="ed-toolbar" ref={(el) => onToolbar(el)} onMouseDown={(e) => { if (e.target === e.currentTarget) setPop(null) }}>
        <button type="button" className="ed-tool" data-ed-tool="undo" title="撤销" aria-label="撤销" disabled={!canUndo} onClick={() => runTool('undo')}>
          <EdIcon name="undo" />
        </button>
        <button type="button" className="ed-tool" data-ed-tool="redo" title="重做" aria-label="重做" disabled={!canRedo} onClick={() => runTool('redo')}>
          <EdIcon name="redo" />
        </button>
        <span className="ed-tool-sep" />
        <button type="button" className={cn('ed-tool', marks.includes('painter') && 'is-on')} data-ed-tool="painter" title="格式刷：先在要取的那一行点一下，再选中别处点一下" aria-label="格式刷" onClick={() => runTool('painter')}>
          <EdIcon name="painter" />
        </button>
        <button type="button" className="ed-tool" data-ed-tool="clear" title="清除格式：把选中的行剥回纯文字" aria-label="清除格式" onClick={() => runTool('clear')}>
          <EdIcon name="clearformat" />
        </button>
        <span className="ed-tool-sep" />

        <label className="ed-tool-head">
          <select value="" title="段落样式" aria-label="段落样式" onChange={(e) => { runTool('heading', e.target.value); e.target.value = '' }}>
            {ED_HEADINGS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        </label>
        <label className="ed-tool-head">
          <select value="" title="字号（作用于选中的文字）" aria-label="字号" onChange={(e) => { runTool('size', e.target.value); e.target.value = '' }}>
            {ED_SIZE_OPTS.map(([v, t]) => <option key={v || 'd'} value={v}>{t}</option>)}
          </select>
        </label>
        <span className="ed-tool-sep" />

        <button type="button" className={cn('ed-tool', marks.includes('bold') && 'is-on')} data-ed-tool="bold" title="加粗（源码写法 **粗体**）" aria-label="加粗" onClick={() => runTool('bold')}><span className="ed-tool-glyph">B</span></button>
        <button type="button" className={cn('ed-tool', marks.includes('italic') && 'is-on')} data-ed-tool="italic" title="斜体（源码写法 *斜体*）" aria-label="斜体" onClick={() => runTool('italic')}><span className="ed-tool-glyph is-i">I</span></button>
        <button type="button" className={cn('ed-tool', marks.includes('strike') && 'is-on')} data-ed-tool="strike" title="删除线（源码写法 ~~删除~~）" aria-label="删除线" onClick={() => runTool('strike')}><span className="ed-tool-glyph is-s">S</span></button>
        <button type="button" className={cn('ed-tool', marks.includes('underline') && 'is-on')} data-ed-tool="underline" title="下划线" aria-label="下划线" onClick={() => runTool('underline')}><span className="ed-tool-glyph is-u">U</span></button>
        <div className={popClass('more')} id="edPop-more">
          <button type="button" className="ed-pop-btn is-more" title="更多文本样式" aria-label="更多文本样式" aria-expanded={pop === 'more'} onClick={() => setPop((p) => (p === 'more' ? null : 'more'))}>
            <EdIcon name="moreText" />
            <span className="ed-pop-caret" aria-hidden="true" />
          </button>
          <div className="ed-pop-menu" role="menu">
            {ED_MORE.map((m) => (
              <button key={m.kind} type="button" className={cn('ed-pop-item', marks.includes(m.kind) && 'is-on')} role="menuitem" title={m.name} onClick={() => runTool(m.kind)}>
                <span className="ed-pop-glyph">{m.glyph}</span>
                <span className="ed-pop-name">{m.name}</span>
              </button>
            ))}
          </div>
        </div>
        <span className="ed-tool-sep" />
        <label className="ed-tool-head">
          <select value="" title="字体（作用于选中的文字）" aria-label="字体" onChange={(e) => { runTool('font', e.target.value); e.target.value = '' }}>
            {ED_FONT_OPTS.map(([v, t]) => <option key={v || 'd'} value={v}>{t}</option>)}
          </select>
        </label>
        <div className={popClass('color')} id="edPop-color">
          <button type="button" className="ed-pop-btn" title="文字颜色" aria-label="文字颜色" aria-expanded={pop === 'color'} onClick={() => setPop((p) => (p === 'color' ? null : 'color'))}>
            <span className="ed-pop-sw is-color" />
          </button>
          <div className="ed-pop-menu" role="menu">
            {ED_COLORS.map((c) => (
              <button key={c.key} type="button" className="ed-pop-item" role="menuitem" onClick={() => runTool('color', c.value)}>
                <span className="ed-pop-sw" style={c.value ? { background: c.value } : undefined}>{c.value ? '' : <EdIcon name="ban" />}</span>
                <span className="ed-pop-name">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
        <div className={popClass('mark')} id="edPop-mark">
          <button type="button" className="ed-pop-btn" title="高亮" aria-label="高亮" aria-expanded={pop === 'mark'} onClick={() => setPop((p) => (p === 'mark' ? null : 'mark'))}>
            <span className="ed-pop-sw is-mark" />
          </button>
          <div className="ed-pop-menu" role="menu">
            {ED_MARKS.map((c) => (
              <button key={c.key} type="button" className="ed-pop-item" role="menuitem" onClick={() => runTool('mark', c.value)}>
                <span className="ed-pop-sw" style={c.value ? { background: c.value } : undefined}>{c.value ? '' : <EdIcon name="ban" />}</span>
                <span className="ed-pop-name">{c.name}</span>
              </button>
            ))}
          </div>
        </div>
        <span className="ed-tool-sep" />
        <label className="ed-tool-head">
          <select value="" title="对齐（只作用于正文段落）" aria-label="对齐" onChange={(e) => { runTool('align', e.target.value); e.target.value = '' }}>
            <option value="left">左对齐</option>
            <option value="center">居中</option>
            <option value="right">右对齐</option>
          </select>
        </label>
        <span className="ed-tool-sep" />

        {/* 顺序照原型：无序 → 有序▼ → 缩进▼ → 行高▼ → 待办。
            无序那颗没有箭头：它没有"编号样式"这回事，装个箭头就是假承诺。 */}
        <button type="button" className={cn('ed-tool', marks.includes('ul') && 'is-on')} data-ed-tool="ul" title="无序列表 —— 再点一次回到正文（源码：「- 」）" aria-label="无序列表" onClick={() => runTool('ul')}>
          <EdIcon name="list" />
        </button>
        <div className={cn('ed-pop ed-pop-split')} id="edPop-ol">
          <button type="button" className="ed-tool" data-ed-tool="ol" title="有序列表：点图标切换，点箭头选编号样式" aria-label="有序列表" onClick={() => runTool('ol')}>
            <EdIcon name="ol" />
          </button>
          <button type="button" className="ed-pop-btn is-caret" title="有序列表：展开选项" aria-label="有序列表选项" aria-expanded={pop === 'ol'} onClick={() => setPop((p) => (p === 'ol' ? null : 'ol'))}>
            <span className="ed-pop-caret" aria-hidden="true" />
          </button>
          <div className="ed-pop-menu" role="menu">
            {ED_OL_CARDS.map(([val, label, rows]) => (
              <button key={val} type="button" className="ed-pop-card" role="menuitem" title={label} onClick={() => runTool('olnum', val)}>
                {rows.map(([txt, lv], idx) => (
                  <span key={idx} className={cn('ed-card-row', `is-l${lv}`)}><b>{txt}</b><i /></span>
                ))}
              </button>
            ))}
          </div>
        </div>
        <div className={cn('ed-pop ed-pop-split')} id="edPop-ind">
          <button type="button" className="ed-tool" data-ed-tool="outdent" title="缩进：点图标减少一层，点箭头展开" aria-label="减少缩进" onClick={() => runTool('outdent')}>
            <EdIcon name="outdent" />
          </button>
          <button type="button" className="ed-pop-btn is-caret" title="缩进：展开选项" aria-label="缩进选项" aria-expanded={pop === 'ind'} onClick={() => setPop((p) => (p === 'ind' ? null : 'ind'))}>
            <span className="ed-pop-caret" aria-hidden="true" />
          </button>
          <div className="ed-pop-menu" role="menu">
            <button type="button" className="ed-pop-item" role="menuitem" onClick={() => runTool('indent')}><span className="ed-pop-glyph"><EdIcon name="indent" /></span><span className="ed-pop-name">增加缩进</span></button>
            <button type="button" className="ed-pop-item" role="menuitem" onClick={() => runTool('outdent')}><span className="ed-pop-glyph"><EdIcon name="outdent" /></span><span className="ed-pop-name">减少缩进</span></button>
          </div>
        </div>
        <div className={cn('ed-pop ed-pop-split')} id="edPop-lh">
          <button type="button" className="ed-tool" data-ed-tool="lh" title="行高：点图标回到默认，点箭头选档位" aria-label="行高" onClick={() => runTool('lh', '')}>
            <EdIcon name="lh" />
          </button>
          <button type="button" className="ed-pop-btn is-caret" title="行高：展开选项" aria-label="行高选项" aria-expanded={pop === 'lh'} onClick={() => setPop((p) => (p === 'lh' ? null : 'lh'))}>
            <span className="ed-pop-caret" aria-hidden="true" />
          </button>
          <div className="ed-pop-menu" role="menu">
            {ED_LH_OPTS.map(([v, t]) => (
              <button key={v || 'd'} type="button" className="ed-pop-item" role="menuitem" onClick={() => runTool('lh', v)}>
                <span className="ed-pop-tick" aria-hidden="true">✓</span>
                <span className="ed-pop-name">{t}</span>
              </button>
            ))}
          </div>
        </div>
        <button type="button" className={cn('ed-tool', marks.includes('task') && 'is-on')} data-ed-tool="task" title="待办（源码：「- [ ] 」）" aria-label="待办" onClick={() => runTool('task')}>
          <EdIcon name="task" />
        </button>
        <span className="ed-tool-sep" />
        <button type="button" className="ed-tool" data-ed-tool="link" title="链接：插入「[文字](地址)」" aria-label="链接" onClick={() => runTool('link')}><EdIcon name="link" /></button>
        <button type="button" className="ed-tool" data-ed-tool="image" title="图片：插入「![说明](地址)」" aria-label="图片" onClick={() => runTool('image')}><EdIcon name="image" /></button>
        <button type="button" className="ed-tool" data-ed-tool="video" title="视频：插入「@[video](地址)」" aria-label="视频" onClick={() => runTool('video')}><EdIcon name="video" /></button>
        <button type="button" className="ed-tool" data-ed-tool="hr" title="分割线：插入一行「---」" aria-label="分割线" onClick={() => runTool('hr')}><EdIcon name="minus" /></button>
        <button type="button" className={cn('ed-tool', marks.includes('quote') && 'is-on')} data-ed-tool="quote" title="引用 —— 再点一次回到正文（源码：「> 」）" aria-label="引用" onClick={() => runTool('quote')}><EdIcon name="quote" /></button>
        <button type="button" className="ed-tool" data-ed-tool="fence" title="代码块：插入一对三个反引号" aria-label="代码块" onClick={() => runTool('fence')}><EdIcon name="code" /></button>
        <button type="button" className="ed-tool" data-ed-tool="table" title="表格：插入一个两列表格" aria-label="表格" onClick={() => runTool('table')}><EdIcon name="table" /></button>
        <div className={cn('ed-pop ed-pop-split')} id="edPop-note">
          <button type="button" className="ed-tool" data-ed-tool="note" title="提示：点图标插入一条提醒" aria-label="提示" onClick={() => runTool('note')}>
            <EdIcon name="alert" />
          </button>
          <button type="button" className="ed-pop-btn is-caret" title="提示：展开类型" aria-label="提示类型" aria-expanded={pop === 'note'} onClick={() => setPop((p) => (p === 'note' ? null : 'note'))}>
            <span className="ed-pop-caret" aria-hidden="true" />
          </button>
          <div className="ed-pop-menu" role="menu">
            {Object.keys(NOTE_KEYS).map((k) => (
              <button key={k} type="button" className="ed-pop-item" role="menuitem" onClick={() => runTool('note', k)}>
                <span className={cn('ed-pop-dot', `is-${k}`)} aria-hidden="true" />
                <span className="ed-pop-name">{NOTE_KEYS[k]}内容</span>
              </button>
            ))}
          </div>
        </div>
        <div className="ed-tool-seg">
          <div className="seg">
            <button type="button" className={cn('seg-btn', mode === 'src' && 'active')} aria-pressed={mode === 'src'} data-ed-preview="src" title="源码：直接写 markdown（存下来的就是它）" onClick={() => { flushDom(); if (mode !== 'src') onMode('src') }}>
              <EdIcon name="file" />源码
            </button>
            <button type="button" className={cn('seg-btn', mode === 'wys' && 'active')} aria-pressed={mode === 'wys'} data-ed-preview="wys" title="可视：正文直接改，格式立刻生效 —— markdown 会自动同步回源码" onClick={() => { flushDom(); if (mode !== 'wys') onMode('wys') }}>
              <EdIcon name="pen" />可视
            </button>
          </div>
        </div>
      </div>

      <div className="ed-layout">
        <aside className="card rd-toc">
          <div className="rd-toc-title">本篇目录</div>
          <div className="rd-toc-list">
            {toc.length ? toc.map((it) => (
              <button
                key={it.id}
                type="button"
                className={cn('rd-toc-item', it.lv > 1 && `is-lv${it.lv}`, it.id === tocOn && 'is-on')}
                onClick={() => goto(it.id, it.line)}
              >
                {it.name}
              </button>
            )) : (
              <p className="rd-toc-empty">源码里写一行 「## 标题」 这里就长出来了。</p>
            )}
          </div>
        </aside>

        <div className="ed-paper">
          {draftSlot}
          <input
            className="ed-title"
            id="edTitle"
            value={name}
            placeholder="文档标题"
            maxLength={60}
            autoComplete="off"
            onChange={(event) => onName(event.target.value)}
          />
          {metaSlot}
          {mode === 'wys' ? (
            /* 表格把手挂在这一层（`.ed-preview`）而不是 `.rd-body` 里：
               进了可编辑区就等于进了正文，序列化时会被写成 markdown 内容。
               它同时是把手坐标的原点（`tbMove` 用它算 px/py）—— 这一层不能有 padding/border。 */
            <div
              className="ed-preview is-wys"
              ref={(el) => { boxRef.current = el }}
              onMouseMove={tbMove}
              onMouseOut={tbOut}
            >
              <div
                className="rd-body"
                ref={(el) => { rootRef.current = el }}
                contentEditable
                suppressContentEditableWarning
                spellCheck={false}
                onInput={(event) => {
                  const t = event.target as HTMLElement
                  /* 代码块名称：写进 `data-title`（`mdBlockOf` 正是从那儿读的）⇒ 再 debounce 回写 md。
                     必须在"可编辑根"那一支之前：名称框的 target 是它自己，
                        落到下面就把这段当成正文去跑了。 */
                  if (t.classList && t.classList.contains('rd-code-name')) {
                    const box = t.closest('.rd-code')
                    if (box) box.setAttribute('data-title', (t as HTMLInputElement).value)
                  }
                  /* 打字落在代码块里时要重画高亮 —— 高亮层是另一层，动它不影响光标。
                     必须 debounce（140ms）：每敲一个字重扫全文不值得；
                        而 `commitDom` 那一步不能 debounce（那才是会丢字的地方）。 */
                  const sel = window.getSelection()
                  const node = sel && sel.rangeCount ? sel.getRangeAt(0).startContainer : null
                  paintHlSoon(codeBoxOf(node))
                  scheduleDom()
                }}
                /* 语言下拉活在 `innerHTML` 里，但它的事件照样冒泡到这一层被 React 接到。
                   接上它才算"语言签能改"——渲染层读的就是 `data-lang`，
                   序列化（`mdBlockOf`）也是从那儿写回 fence 信息串。 */
                onChange={(event) => {
                  const t = event.target as HTMLElement
                  if (!t.classList) return
                  const box = t.closest('.rd-code')
                  if (!box) return
                  /* 这两个下拉活在 `innerHTML` 里，但它们的事件照样冒泡到这一层被 React 接到。
                     接上它们才算"语言签 / 样式签能改"——渲染层读的就是 `data-lang` / `data-style`，
                     序列化（`mdBlockOf` / `edFenceStr`）也是从那儿写回 fence 信息串。 */
                  if (t.classList.contains('rd-code-lang')) {
                    const lang = (t as HTMLSelectElement).value
                    box.setAttribute('data-lang', lang)
                    /* 换了语言 ⇒ 词表变了 ⇒ 高亮得重画（改样式只换 CSS 变量，不用重画） */
                    paintHl(box)
                    commitDom(true)
                    onNotice('代码语言：' + lang)
                    return
                  }
                  if (t.classList.contains('rd-code-style')) {
                    const st = (t as HTMLSelectElement).value
                    box.setAttribute('data-style', st)
                    codePaint(box)
                    commitDom(true)
                    onNotice('代码样式：' + st)
                  }
                }}
                onKeyDown={onKeyDown}
                onKeyUp={() => syncMarks()}
                onClick={(event) => {
                  const t = event.target as HTMLElement
                  /* 待办那一格：可视面里点它 = 勾上 / 取消（阅读态是只读副本，那一格才不给点）。 */
                  const box = t.closest('.rd-task-box')
                  if (box) {
                    box.classList.toggle('is-on')
                    commitDom(true)
                    return
                  }
                  /* 代码块：折叠 / 复制 / 更多菜单 —— 与阅读态同一支（`code-block.ts`）。
                     别在这里重写一遍：两态各写一份，"同一个按钮在两种状态下做不一样的事"
                        是最难查的一类（页面全对，只有行为不同）。 */
                  const codeBox = codeBoxOf(t)
                  if (codeBox) {
                    const act = codeClick(event.nativeEvent, codeBox, { canSync: true, notice: onNotice })
                    if (act) syncCodeAll(codeBox, act === 'sync-both')
                    return
                  }
                  /* 点到别处 ⇒ 把开着的菜单收掉（点菜单项本身走上面那一支，不在这里收） */
                  codeMenuClose()
                }}
              />
              {/* 表格把手：五颗 + 两条插入指示线。位置全在 `tbMove` 里现算，
                  这里只负责把件摆出来（`is-on` 才可见 —— CSS 那一条同时管了
                  `visibility` 与 `pointer-events`：只做透明度的话，"看不见的时候照样点得到"）。 */}
              {/* 容器上不能给 `aria-hidden` —— 它会让读屏忽略里面那五颗可点的把手
                  （每颗自己带 `aria-label`，那才是对的）。装饰性的两条指示线才该 aria-hidden。 */}
              <div className="rd-tb-acts">
                <button type="button" className="rd-tb-btn" data-tb-add="row" title="插入一行" aria-label="插入一行"
                  ref={(el) => { tbRefs.current.rowAdd = el }} onClick={() => tbAdd('row')}><EdIcon name="plus" /></button>
                <button type="button" className="rd-tb-btn" data-tb-del="row" title="删除这一行" aria-label="删除这一行"
                  ref={(el) => { tbRefs.current.rowDel = el }} onClick={() => tbDel('row')}><EdIcon name="minus" /></button>
                <button type="button" className="rd-tb-btn" data-tb-add="col" title="插入一列" aria-label="插入一列"
                  ref={(el) => { tbRefs.current.colAdd = el }} onClick={() => tbAdd('col')}><EdIcon name="plus" /></button>
                <button type="button" className="rd-tb-btn" data-tb-del="col" title="删除这一列" aria-label="删除这一列"
                  ref={(el) => { tbRefs.current.colDel = el }} onClick={() => tbDel('col')}><EdIcon name="minus" /></button>
                <button type="button" className="rd-tb-btn" data-tb-add="table" title="在这张表下面再插一张空表" aria-label="在这张表下面再插一张空表"
                  ref={(el) => { tbRefs.current.new = el }} onClick={tbAddTable}><EdIcon name="plus" /></button>
                <span className="rd-tb-ins" ref={(el) => { tbRefs.current.insRow = el }} aria-hidden="true" />
                <span className="rd-tb-ins" ref={(el) => { tbRefs.current.insCol = el }} aria-hidden="true" />
              </div>
            </div>
          ) : (
            <textarea
              className="ed-body"
              ref={(el) => { taRef.current = el }}
              value={md}
              spellCheck={false}
              placeholder={'要点、命令、表格、结论…\n行首写 ## 加空格就是标题（最多三级），左栏自动生成目录'}
              onChange={(event) => onMd(event.target.value)}
              onKeyDown={onKeyDown}
              onSelect={() => syncMarks()}
              onKeyUp={() => syncMarks()}
            />
          )}
        </div>
      </div>
    </>
  )
}
