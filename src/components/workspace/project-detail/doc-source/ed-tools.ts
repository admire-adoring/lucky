/* 文档原文 · 源码面的文本工具（原型 ed* 那一族的纯函数版）。

   进 (文本, 选区) 出新的 (文本, 选区)。两个镜头跑同一套语义：可视面把 DOM Range
   翻译成 md 里的 [s, e) 再调这里。
   返回 null = 拒绝执行，调用方要给一句人话说明原因（见 ED_TOOL_REJECT）。
   只改给定的那几个字符，不重排全文；例外是 toggleOl（取消中间项要拆成前后两段并续号）。 */

import { ED_NOTE_DEFAULT, RD_NOTE, rdParaStyleStr, rdSpanStyle } from './rd-render'
import { rdParaStyle } from './md'

export interface EdText {
  v: string
  /* 选区起（新文本里的下标） */
  s: number
  /* 选区止；与 `s` 相同 = 光标 */
  e: number
}

/* 拒绝的四种说法。只有这四种（多了就说明有的动作在"看情况"，那不如不做）。 */
export const ED_TOOL_REJECT: Record<string, string> = {
  sel: '先选中要改的那几个字',
  indent: '缩进只对列表项有效 —— 正文前面加空格 markdown 不认',
  para: '段落样式只作用于正文段落 —— 标题 / 列表 / 引用不在这里改',
  nomark: '这一行没有什么可复制的格式',
}

/* 行首标记（标题 / 待办 / 无序 / 有序 / 引用）。摘掉旧的再套新的 ——
   换来换去不会越积越多（`> > > 引用` 那种）。待办必须排在无序前面（它也以 `- ` 开头）。 */
export const ED_LINE_MARK = /^[ \t]*(?:#{1,3}\s+|-\s+\[[ xX]\]\s*|-\s+|\d+\.\s+|>\s?)/
const ED_LIST_LINE = /^[ \t]*(?:[-*]\s|\d+\.\s)/
const ED_PREFIX: Record<string, string> = { ul: '- ', ol: '1. ', quote: '> ', task: '- [ ] ' }

/* 选区覆盖了哪几行（行级动作的公共起点，别各推一遍）。 */
export function lineSpan(v: string, s: number, e: number): { ls: number; le: number } {
  const ls = v.lastIndexOf('\n', s - 1) + 1
  let le = v.indexOf('\n', e)
  if (le < 0) le = v.length
  return { ls, le }
}

/* 列表 / 引用 / 待办的开关：选中的行全都已经是这个标记 ⇒ 摘掉；否则套上。
    判据：没有"去掉列表"的按钮 ⇒ 这个动作必须是开关，不然套错了只能一行行手删。 */
export function prefixLines(v: string, s: number, e: number, kind: 'ul' | 'ol' | 'quote' | 'task'): EdText {
  const L = lineSpan(v, s, e)
  const rows = v.slice(L.ls, L.le).split('\n')
  const on = (l: string) => {
    const body = l.slice((/^[ \t]*/.exec(l) || [''])[0].length)
    if (kind === 'ul') return /^- /.test(body)
    if (kind === 'ol') return /^\d+\. /.test(body)
    if (kind === 'task') return /^- \[[ xX]\] /.test(body)
    return /^> ?/.test(body)
  }
  const allOn = rows.some((l) => l.trim()) && rows.every((l) => !l.trim() || on(l))
  const t = rows.map((l, n) => {
    const ind = (/^[ \t]*/.exec(l) || [''])[0]
    const bare = l.slice(ind.length).replace(ED_LINE_MARK, '')
    if (allOn) return ind + bare
    const p = kind === 'ol' ? (n + 1) + '. ' : ED_PREFIX[kind]
    return ind + p + bare
  }).join('\n')
  return { v: v.slice(0, L.ls) + t + v.slice(L.le), s: L.ls + t.length, e: L.ls + t.length }
}

/* 缩进 = 列表项往上一层挪两格（markdown 的嵌套就是这么写的）。 */
export function indentLines(v: string, s: number, e: number, dir: 1 | -1): EdText | null {
  const L = lineSpan(v, s, e)
  const rows = v.slice(L.ls, L.le).split('\n')
  if (!rows.some((l) => ED_LIST_LINE.test(l))) return null
  const t = rows.map((l) => {
    if (!ED_LIST_LINE.test(l)) return l
    return dir > 0 ? '  ' + l : l.replace(/^[ \t]{1,2}/, '')
  }).join('\n')
  return { v: v.slice(0, L.ls) + t + v.slice(L.le), s: L.ls + t.length, e: L.ls + t.length }
}

/* 清除格式：把选中的行剥回纯文字（行首标记 + 行内标记一起去）。
    一起剥才是"清除格式"这个词的意思 —— 分层剥（先剥谁的）没人说得清，
       而"这一行只剩文字"是每个人心里的预期。 */
export function clearFormat(v: string, s: number, e: number): EdText {
  const L = lineSpan(v, s, e)
  const t = v.slice(L.ls, L.le).split('\n').map((l) => l
    .replace(ED_LINE_MARK, '')
    .replace(/<\/?(?:span|div|mark|del|em|strong|sup|sub)[^>]*>/g, '')
    .replace(/\*\*|~~|==|`/g, '')
    .replace(/[<>*]/g, '')
    .trim()).join('\n')
  return { v: v.slice(0, L.ls) + t + v.slice(L.le), s: L.ls + t.length, e: L.ls + t.length }
}

/* 行内标记的唯一一张表：源码面的包裹对。
    只有渲染层真认的那几种（见 `rdInline`）—— 表外的写法（比如 `_斜_`）摆上来
       就是"按了没反应"。 */
export const ED_MARKS_SPEC: Record<string, { md: [string, string]; tag: string; off?: string }> = {
  bold: { md: ['**', '**'], tag: 'strong' },
  italic: { md: ['*', '*'], tag: 'em' },
  strike: { md: ['~~', '~~'], tag: 'del' },
  underline: { md: ['<span style="text-decoration:underline">', '</span>'], tag: 'span' },
  code: { md: ['`', '`'], tag: 'code' },
  /* 上下标：markdown 没有这两个写法 ⇒ 包裹对直接写成行内 HTML。
     `off` = 互斥的那一个（同一段字不可能既在上又在下）⇒ 套一个必须摘掉另一个。 */
  sup: { md: ['<sup>', '</sup>'], tag: 'sup', off: 'sub' },
  sub: { md: ['<sub>', '</sub>'], tag: 'sub', off: 'sup' },
}

/* 给选区套一层行内标记。再点一次就摘掉（与 Word 那颗 B 一样是切换，不是叠加）。
    判"已经套过了"看的是选区两侧那两段字符，不是别处记的标记 ——
       源码是唯一事实源，两侧就是 `` 那就是套过了。 */
export function wrapSel(v: string, s: number, e: number, open: string, close: string, offTag?: string): EdText | null {
  if (s === e) return null
  let sel = v.slice(s, e)
  if (offTag) {
    sel = sel.replace(new RegExp('<' + offTag + '>([\\s\\S]*?)</' + offTag + '>', 'g'), '$1')
  }
  if (v.slice(Math.max(0, s - open.length), s) === open && v.slice(e, e + close.length) === close) {
    return { v: v.slice(0, s - open.length) + sel + v.slice(e + close.length), s: s - open.length, e: e - open.length }
  }
  const t = open + sel + close
  return { v: v.slice(0, s) + t + v.slice(e), s: s + open.length, e: s + open.length + sel.length }
}

/* 往选区套一个白名单行内 span（颜色 / 高亮 / 字号 / 字体共用这一支）。
    先摘掉同属性的旧壳再套新的 —— 不摘就会叠出两层同色 span，越改越厚。
    值是空 = 摘掉（色板里「默认 / 无」两颗就是干这个的）。 */
export function setSpan(v: string, s: number, e: number, prop: string, value: string): EdText | null {
  if (s === e) return null
  const re = new RegExp('<span style="' + prop + ':[^"]*">([\\s\\S]*?)</span>', 'g')
  const sel = v.slice(s, e).replace(re, '$1')
  const t = value ? '<span style="' + prop + ':' + value + '">' + sel + '</span>' : sel
  return { v: v.slice(0, s) + t + v.slice(e), s: s + t.length, e: s + t.length }
}

/* 源码面：改选中段落行的块级样式（对齐 / 行高共用这一支）。
    两项必须互相保留 —— 改行高不能顺手把对齐抹掉（用一条写死正则专门剥 `text-align:`
       的话，加行高之后就匹配不上了，"改行高"会把整个 `<div>` 连同对齐一起吃掉）。 */
export function setPara(v: string, s: number, e: number, key: 'al' | 'lh', val: string): EdText | null {
  const L = lineSpan(v, s, e)
  const rows = v.slice(L.ls, L.le).split('\n')
  if (rows.some((l) => l.trim() && ED_LINE_MARK.test(l.trim()))) return null
  const t = rows.map((l) => {
    const m = /^<div style="([^"]*)">([\s\S]*)<\/div>$/.exec(l.trim())
    const st = m ? rdParaStyle(m[1]) : {}
    const bare = m ? m[2] : l
    if (!String(bare).trim()) return l
    /* 「左对齐」= 默认 ⇒ 把这一项清掉，而不是写一个 `text-align:left`（那是废话） */
    if (key === 'al') st.al = val === 'left' ? '' : val
    else st.lh = val
    const ps = rdParaStyleStr(st.al, st.lh)
    return ps ? '<div style="' + ps + '">' + bare + '</div>' : bare
  }).join('\n')
  return { v: v.slice(0, L.ls) + t + v.slice(L.le), s: L.ls + t.length, e: L.ls + t.length }
}

/* 有序列表：编号样式与取消中间项。
   裸行夹在中间会把列表断成两张，后半段会从 1 重数，所以拆成前段 / 裸行 / 后段，
   后段写 <ol start="N"> 续号。 */

const isOlLine = (x: string) => /^\d+\.\s/.test(String(x).replace(/^[ \t]*/, ''))
const isOlOpen = (x: string) => /^<ol(?:\s+type="(?:a|cn|multi)")?(?:\s+start="\d+")?>$/.test(String(x).trim())
const isOlClose = (x: string) => String(x).trim() === '</ol>'
const isOlWrap = (x: string) => isOlOpen(x) || isOlClose(x)

export function toggleOl(v: string, s: number, e: number): EdText | null {
  const at = (i: number) => (i <= 0 ? 0 : v.lastIndexOf('\n', i - 1) + 1)
  const endOf = (i: number) => { const j = v.indexOf('\n', i); return j < 0 ? v.length : j }
  const ls = at(s)
  let le = endOf(e)
  const rows = v.slice(ls, le).split('\n')
  /* 还不是列表、或选中的行混着列表行 ⇒ 一律"加成列表"（简单可预期） */
  if (!rows.every((x) => !x.trim() || isOlLine(x))) return prefixLines(v, s, e, 'ol')
  if (!rows.some(isOlLine)) return prefixLines(v, s, e, 'ol')

  /* 取消：先把范围扩到整张表（含可能包着它的 `<ol …>` / `</ol>`） */
  let top = ls
  for (;;) {
    const p = at(top - 1)
    if (p === top) break
    const line = v.slice(p, top - 1)
    if (isOlLine(line) || isOlOpen(line)) top = p
    else break
  }
  let bot = le
  for (;;) {
    if (bot >= v.length) break
    const line = v.slice(bot + 1, endOf(bot + 1))
    if (isOlLine(line) || isOlClose(line)) bot = endOf(bot + 1)
    else break
  }
  const zone = v.slice(top, bot).split('\n')
  const type = (() => {
    const m = /^<ol(?:\s+type="(a|cn|multi)")?/.exec(String(zone[0] || '').trim())
    return m && m[1] ? m[1] : ''
  })()
  const startAt = (() => {
    const m = /start="(\d+)"/.exec(String(zone[0] || '').trim())
    return m ? +m[1] : 1
  })()
  const body = zone.filter((x) => !isOlWrap(x))
  /* 选中的行在 `body` 里排第几：不能拿"相对行号"直接用 —— `body` 已经把外壳行
     过滤掉了，前面每少一行、下标就整体前移一格（差一格就是"取消错了行"）。 */
  const topLine = v.slice(0, top).split('\n').length - 1
  const selLineStart = v.slice(0, ls).split('\n').length - 1
  const selLineEnd = v.slice(0, le).split('\n').length - 1
  let a = -1
  let b = -1
  let n = -1
  for (let k = 0; k < zone.length; k += 1) {
    if (isOlWrap(zone[k])) continue
    n += 1
    const lineNo = topLine + k
    if (lineNo >= selLineStart && lineNo <= selLineEnd) {
      if (a < 0) a = n
      b = n
    }
  }
  if (a < 0) a = 0
  if (b < a) b = a
  const head = '<ol' + (type ? ' type="' + type + '"' : '') + (startAt > 1 ? ' start="' + startAt + '"' : '') + '>'
  const mkRows = (list: string[], from: number) => list.map((x, k) =>
    ((/^[ \t]*/.exec(x) || [''])[0]) + (from + k) + '. ' + x.replace(/^[ \t]*\d+\.\s+/, '').trim())
  const out: string[] = []
  if (a > 0) {
    const pre = mkRows(body.slice(0, a), startAt)
    if (type || startAt > 1) { out.push(head); out.push(...pre); out.push('</ol>') } else out.push(...pre)
  }
  /* 被取消的行：剥掉 `N. ` 前缀、也丢掉缩进（缩进是"层级的表达"，正文没有层级）。
     少这一步就是"点了取消、看着没变"（编号还留在行首）。 */
  out.push(...body.slice(a, b + 1).map((x) => String(x).replace(/^[ \t]*\d+\.\s+/, '').trim()))
  if (b < body.length - 1) {
    const from = startAt + a
    out.push('<ol' + (type ? ' type="' + type + '"' : '') + (from > 1 ? ' start="' + from + '"' : '') + '>')
    out.push(...mkRows(body.slice(b + 1), from))
    out.push('</ol>')
  }
  const t = out.join('\n')
  return { v: v.slice(0, top) + t + v.slice(bot), s: top + t.length, e: top + t.length }
}

/* 源码面：把选中的行变成有序列表并套上编号样式（两者一步做完）。
    要先看紧邻的上下两行是不是这张表的包裹行：是就一起纳入 ⇒ 连点两次不会套两层壳。 */
export function setListNum(v: string, s: number, e: number, num: string): EdText | null {
  const spanOf = (txt: string, ss: number, ee: number) => {
    const a = txt.lastIndexOf('\n', ss - 1) + 1
    let b = txt.indexOf('\n', ee)
    if (b < 0) b = txt.length
    return { ls: a, le: b, rows: txt.slice(a, b).split('\n') }
  }
  /* 选中的还不是列表行 ⇒ 先把它变成 `1. ` 行（与可视面同一条口径：
     点这一项 = "这段按这个样式编号"，不该只回一句"只对有序列表有效"）。 */
  let cur: EdText = { v, s, e }
  if (!spanOf(cur.v, cur.s, cur.e).rows.some(isOlLine)) cur = prefixLines(cur.v, cur.s, cur.e, 'ol')
  const v0 = cur.v
  let ls = cur.s
  let le = cur.e
  let rows = v0.slice(ls, le).split('\n')
  if (!rows.some(isOlLine)) return null
  if (ls > 0) {
    const prev = v0.slice(0, ls - 1).split('\n').pop() as string
    if (isOlWrap(prev)) { ls -= prev.length + 1; rows = [prev].concat(rows) }
  }
  if (le < v0.length) {
    const next = v0.slice(le + 1).split('\n')[0]
    if (isOlWrap(next)) { le += next.length + 1; rows = rows.concat([next]) }
  }
  const body = rows.filter((x) => !isOlWrap(x))       /* 旧壳一律剥掉 */
  const out = num ? ['<ol type="' + num + '">'].concat(body).concat(['</ol>']) : body
  const t = out.join('\n')
  return { v: v0.slice(0, ls) + t + v0.slice(le), s: ls + t.length, e: ls + t.length }
}

/* 标题级别下拉：只动行首那几个 `#`（正文 = 摘掉）。 */
export function setHeading(v: string, s: number, e: number, level: string): EdText {
  const L = lineSpan(v, s, e)
  const p = /^h[1-6]$/.test(level) ? '#'.repeat(+level[1]) + ' ' : ''
  const t = v.slice(L.ls, L.le).split('\n').map((l) => p + l.replace(/^[ \t]*#{1,6}\s+/, '')).join('\n')
  return { v: v.slice(0, L.ls) + t + v.slice(L.le), s: L.ls + t.length, e: L.ls + t.length }
}

/* 格式刷：把这一行用到的行内标记记下来，套到别处。
   源码是唯一事实源，所以"样式"就是"这一段里出现了哪几对标记"。 */

/* 这一行用了哪些行内标记 —— 返回源码面的包裹对 `[开, 闭]`。 */
export function lineMarks(line: string): [string, string][] {
  const text = String(line)
  const out: [string, string][] = []
  const add = (open: string, close: string) => { if (!out.some((p) => p[0] === open)) out.push([open, close]) }
  if (/\*\*/.test(text)) add('**', '**')
  /* 斜体：把 `` 摘掉之后还剩单个 `*` 才算（不然 `粗` 会被认成"也有斜体"） */
  if (/\*/.test(text.replace(/\*\*/g, ''))) add('*', '*')
  if (/~~/.test(text)) add('~~', '~~')
  if (/==/.test(text)) add('==', '==')
  if (/`/.test(text)) add('`', '`')
  if (/<sup>/.test(text)) add('<sup>', '</sup>')
  if (/<sub>/.test(text)) add('<sub>', '</sub>')
  const span = /<span style="([^"]*)">/g
  let m = span.exec(text)
  while (m) {
    const st = rdSpanStyle(m[1])
    if (st) add('<span style="' + st + '">', '</span>')
    m = span.exec(text)
  }
  return out
}

/* --------------------------------------------------------------- 插入型模板 */

/* 一段插到光标处的模板。前面不空行就先补一个空行 —— 粘在上一段尾巴上会被当成它的续行。 */
export function insertTpl(v: string, s: number, e: number, tpl: string): EdText {
  const before = v.slice(0, s)
  const add = (before && !/\n[ \t]*$/.test(before) ? '\n\n' : '') + tpl + '\n'
  const at = add.indexOf('https://')
  /* 链接 / 图片 / 视频把光标停在 `https://` 后面：插完直接就能打地址；
     否则"插了个模板"还要用户自己去里面翻那一处，等于插了个待办。 */
  const pos = at < 0 ? (before + add).length : before.length + at + 8
  return { v: before + add + v.slice(e), s: pos, e: pos }
}

/* 插一条提示（一行 `> [!提醒] 正文`，没有配对行）。 */
export function insertNote(v: string, s: number, e: number, kind: string): EdText {
  const text = '这里写一句' + (RD_NOTE[kind] || RD_NOTE[ED_NOTE_DEFAULT]) + '的事'
  const line = '> [!' + (RD_NOTE[kind] || RD_NOTE[ED_NOTE_DEFAULT]) + '] ' + text
  const before = v.slice(0, s)
  const add = (before && !/\n[ \t]*$/.test(before) ? '\n\n' : '') + line + '\n'
  const pos = before.length + add.length
  return { v: before + add + v.slice(e), s: pos, e: pos }
}

/* 插入型模板表（原型 `edApplyTool` 里那一张）。 */
export const ED_TPL: Record<string, string> = {
  fence: '```\n在这里写代码 / 命令\n```',
  table: '| 列 1 | 列 2 |\n| --- | --- |\n|  |  |\n|  |  |',
  hr: '---',
  image: '![图片说明](https://)',
  video: '@[video](https://)',
}
