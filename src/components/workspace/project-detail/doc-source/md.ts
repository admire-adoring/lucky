/* 文档原文 · 块与 markdown 的双向转换（原型 md* 一族）。

   源码框写 markdown，存进数据的是块，可视面渲染的也是块，三者只有这一条通道。
   一个值只写一遍：段落样式、列表编号样式、提示档位、fence 信息串都是读写共表。
   往返必须稳定：mdOfBlocks(mdOfSource(x)) 与 x 逐字相同，默认值一律省略。
   块内的换行一律压成空格。 */

import type { RdBlock } from '../../../../data/workspace/doc-bodies'
import {
  ED_NOTE_DEFAULT, RD_ALIGN, RD_LH, RD_NOTE, rdParaStyleStr, rdSpanStyle,
} from './rd-render'

/* ---------------------------------------------------------------- 派生的三张表
   一律从 `RD_NOTE` 现拼，不把五个中文名再抄一遍 —— 抄一遍的后果是加了新档位之后
      `> [!重要]` 被读成一条普通引用（存得进去、读不回来）。 */
const MD_NOTE_KEY: Record<string, string> = {}
Object.keys(RD_NOTE).forEach((k) => { MD_NOTE_KEY[RD_NOTE[k] as string] = k })
const MD_NOTE_RE = new RegExp('^>\\s*\\[!(' + Object.keys(MD_NOTE_KEY).join('|') + ')\\]\\s*([\\s\\S]*)$')
const NOTE_CLS_RE = new RegExp('is-(' + Object.keys(RD_NOTE).join('|') + ')')

/* `style` 串 → 段落样式。与 `rdParaStyleStr` 是同一张白名单的两端。 */
export function rdParaStyle(style: unknown): { al?: string; lh?: string } {
  const out: { al?: string; lh?: string } = {}
  String(style).split(';').forEach((kv) => {
    const i = kv.indexOf(':')
    if (i < 0) return
    const k = kv.slice(0, i).trim().toLowerCase()
    const v = kv.slice(i + 1).trim()
    if (k === 'text-align' && RD_ALIGN[v]) out.al = v
    if (k === 'line-height' && RD_LH[v]) out.lh = v
  })
  return out
}

/* ------------------------------------------------------------------ 代码块信息串 */

export function edFenceParse(str: unknown): { lang: string; title: string; style: string } {
  const out = { lang: '', title: '', style: '' }
  String(str || '').trim().split(/\s+/).forEach((w) => {
    if (!w) return
    const m = /^([A-Za-z]+)="([^"]*)"$/.exec(w)
    if (m) {
      const k = m[1].toLowerCase()
      if (k === 'title') out.title = m[2]
      else if (k === 'style') out.style = m[2]
      return
    }
    if (!out.lang) out.lang = w
  })
  return out
}

/* 对象 → 信息串。输出即规范写法（默认值一律省略）⇒ 往返逐字稳定。 */
export function edFenceStr(o: { lang?: string; title?: string; style?: string }): string {
  const lang = o.lang || 'text'
  const title = o.title || ''
  const style = o.style || 'light'
  const parts = [lang]
  if (title) parts.push('title="' + String(title).replace(/"/g, '') + '"')
  if (style !== 'light') parts.push('style="' + String(style).replace(/"/g, '') + '"')
  return parts.join(' ')
}

/* ---------------------------------------------------------------- 块 → markdown */

/* 列表项前面那段空白 = 层级（两个空格一层）。与本文件的反向函数同一条口径。 */
export function rdIndentOf(li: unknown): number {
  const m = /^( *)/.exec(String(li))
  return Math.min(Math.floor((m ? m[1].length : 0) / 2), 3)
}

/* 有序列表的下一个编号：按层级各算各的（退回上层时把下面几层清零）。
    不能拿数组下标当编号 —— 那样"一级第 2 项"会被写成 4.（markdown 里每层都从 1 起）。 */
export function nextOlNum(cnt: number[], lv: number): number {
  for (let d = lv + 1; d < cnt.length; d += 1) cnt[d] = 0
  cnt[lv] += 1
  return cnt[lv]
}

export function mdOfBlocks(blocks: RdBlock[]): string {
  const out: string[] = []
  const indOf = (li: unknown) => (/^( *)/.exec(String(li)) || ['', ''])[1].slice(0, 6)
  blocks.forEach((b) => {
    if (/^h[1-6]$/.test(b.t)) out.push('#'.repeat(+b.t[1]) + ' ' + String(b.x ?? ''))
    else if (b.t === 'p') {
      const ps = rdParaStyleStr(b.al, b.lh)
      out.push(ps ? '<div style="' + ps + '">' + String(b.x ?? '') + '</div>' : String(b.x ?? ''))
    } else if (b.t === 'ul') {
      out.push(((b.x as string[]) || []).map((li) => indOf(li) + '- ' + String(li).trim()).join('\n'))
    } else if (b.t === 'ol') {
      const from = b.start && b.start > 1 ? b.start : 1
      const cnt = [from - 1, 0, 0, 0]
      const rows = ((b.x as string[]) || []).map((li) => indOf(li) + nextOlNum(cnt, rdIndentOf(li)) + '. ' + String(li).trim()).join('\n')
      /* 选了编号样式、或要续号 ⇒ 用配对行包起来（与 `mdOfSource` 那条一一对应）。
         两个都不用时不包 —— 默认就是 markdown 本来的样子，包一层等于平白加壳。 */
      const head = (b.num || from > 1)
        ? '<ol' + (b.num ? ' type="' + b.num + '"' : '') + (from > 1 ? ' start="' + from + '"' : '') + '>\n'
        : ''
      out.push(head ? head + rows + '\n</ol>' : rows)
    } else if (b.t === 'task') {
      out.push(((b.x as string[]) || []).map((li) => {
        const m = /^( *)- \[([ xX])\]\s*([\s\S]*)$/.exec(String(li))
        if (!m) return '- [ ] ' + String(li).trim()
        return m[1] + '- [' + (m[2] === ' ' ? ' ' : 'x') + '] ' + m[3].trim()
      }).join('\n'))
    } else if (b.t === 'quote') out.push('> ' + String(b.x ?? ''))
    else if (b.t === 'hr') out.push('---')
    else if (b.t === 'img') out.push('![' + (b.alt || '') + '](' + b.url + ')')
    else if (b.t === 'video') out.push('@[video](' + b.url + ')')
    else if (b.t === 'code') out.push('```' + edFenceStr(b) + '\n' + String(b.x ?? '') + '\n```')
    /* 表格必须一次 push 整段。按行分开 push 的话，join 会在行间插空行，
       再解析回来每行会变成一张独立的小表。 */
    else if (b.t === 'table') {
      const head = (b.head as string[]) || []
      const rows = (b.rows as string[][]) || []
      out.push('| ' + head.join(' | ') + ' |\n'
        + '| ' + head.map(() => '---').join(' | ') + ' |\n'
        + rows.map((r) => '| ' + r.join(' | ') + ' |').join('\n'))
    } else if (b.t === 'note') out.push('> [!' + RD_NOTE[b.kind || ED_NOTE_DEFAULT] + '] ' + String(b.x ?? ''))
    else out.push(String(b.x ?? ''))
  })
  return out.join('\n\n') + '\n'
}

/* ---------------------------------------------------------------- markdown → 块 */

export interface MdParsed {
  blocks: RdBlock[]
  /* 每块在 md 里占的行区间 `[起, 止]`（含）。可视面的块级动作靠它把
      "光标在第 i 块"翻译成"改 md 的第几行"—— 同一支解析器顺手记下来的，
      另写一份"块下标 → 行号"的推算必然与解析器漂移。 */
  ranges: [number, number][]
}

/* markdown 源码 → 块。只认 mdOfBlocks 产出的写法，认不出的落到正文，不报错也不丢内容。
   待办排在无序列表之前（"- [ ] x" 也以 "- " 开头），<ol> 外壳排在 OL.test 之前。 */
export function parseMd(text: string): MdParsed {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n')
  const blocks: RdBlock[] = []
  const ranges: [number, number][] = []
  const cut = (s: string) => s.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim())
  const isRow = (s: string) => s.trim().charAt(0) === '|'
  const TASK = /^(\s*)- \[([ xX])\]\s*([\s\S]*)$/
  const OL = /^(\s*)\d+\.\s+([\s\S]*)$/
  let i = 0
  const emit = (b: RdBlock, from: number, to: number) => {
    blocks.push(b)
    ranges.push([from, Math.max(from, to)])
  }
  while (i < lines.length) {
    const start = i
    const bare = lines[i].trim()
    if (!bare) { i += 1; continue }
    if (bare.indexOf('```') === 0) {
      const info = edFenceParse(bare.slice(3))
      const buf: string[] = []
      i += 1
      while (i < lines.length && lines[i].trim().indexOf('```') !== 0) { buf.push(lines[i]); i += 1 }
      i += 1
      emit({ t: 'code', x: buf.join('\n'), lang: info.lang, title: info.title, style: info.style }, start, i - 1)
      continue
    }
    if (isRow(bare)) {
      const head = cut(bare)
      i += 1
      if (i < lines.length && isRow(lines[i]) && !lines[i].trim().replace(/[\s|:-]/g, '')) i += 1
      const rows: string[][] = []
      while (i < lines.length && isRow(lines[i])) { rows.push(cut(lines[i])); i += 1 }
      emit({ t: 'table', head, rows: rows.length ? rows : [head.map(() => '')] }, start, i - 1)
      continue
    }
    if (bare === '---') { i += 1; emit({ t: 'hr' }, start, i - 1); continue }
    /* 段落样式（`mdOfBlocks` 产的就是它）：整行一个 `<div style="…">` 包着。
       一律过 `rdParaStyle` 那支白名单 —— 这是"用户写的样式能落进 DOM"的入口之一。 */
    const pdiv = /^<div style="([^"]*)">([\s\S]*)<\/div>$/.exec(bare)
    if (pdiv) {
      const st = rdParaStyle(pdiv[1])
      i += 1
      emit({ t: 'p', x: pdiv[2].trim(), al: st.al, lh: st.lh }, start, i - 1)
      continue
    }
    const img = /^!\[([^\]]*)\]\(([^)\s]+)\)$/.exec(bare)
    if (img) { i += 1; emit({ t: 'img', alt: img[1], url: img[2] }, start, i - 1); continue }
    const vid = /^@\[video\]\(([^)\s]+)\)$/.exec(bare)
    if (vid) { i += 1; emit({ t: 'video', url: vid[1] }, start, i - 1); continue }
    const note = MD_NOTE_RE.exec(bare)
    if (note) { i += 1; emit({ t: 'note', kind: MD_NOTE_KEY[note[1]], x: note[2] }, start, i - 1); continue }
    if (bare.charAt(0) === '>') { i += 1; emit({ t: 'quote', x: bare.replace(/^>\s?/, '') }, start, i - 1); continue }
    /* 有序列表的编号样式：`<ol type="…">` 与 `</ol>` 各占一行把列表包起来。 */
    const olw = /^<ol(?:\s+type="(a|cn|multi)")?(?:\s+start="(\d+)")?>$/.exec(bare)
    if (olw) {
      const items: string[] = []
      i += 1
      while (i < lines.length && lines[i].trim() !== '</ol>') {
        const one = lines[i]
        if (OL.test(one.trim())) items.push(one.replace(/\s+$/, '').replace(/^(\s*)\d+\.\s+/, '$1'))
        i += 1
      }
      i += 1
      emit({ t: 'ol', x: items, num: olw[1], start: +olw[2] || 0 }, start, i - 1)
      continue
    }
    if (TASK.test(bare)) {
      const items: string[] = []
      /* 判据用 `trim()` 之后的，存的时候保留行首缩进 —— 缩进是层级，trim 掉就没了。 */
      while (i < lines.length && TASK.test(lines[i].trim())) { items.push(lines[i].replace(/\s+$/, '')); i += 1 }
      emit({ t: 'task', x: items }, start, i - 1)
      continue
    }
    if (OL.test(bare)) {
      const items: string[] = []
      while (i < lines.length && OL.test(lines[i].trim())) {
        items.push(lines[i].replace(/\s+$/, '').replace(/^(\s*)\d+\.\s+/, '$1'))
        i += 1
      }
      emit({ t: 'ol', x: items }, start, i - 1)
      continue
    }
    if (bare.indexOf('- ') === 0) {
      const items: string[] = []
      while (i < lines.length && lines[i].trim().indexOf('- ') === 0) {
        items.push(lines[i].replace(/\s+$/, '').replace(/^(\s*)- /, '$1'))
        i += 1
      }
      emit({ t: 'ul', x: items }, start, i - 1)
      continue
    }
    /* `#` 的个数就是级别（1~6 一一对应）—— 三级以上压成 h3 的话，六级标题存不住。 */
    const h = /^(#{1,6})\s+(.*)$/.exec(bare)
    if (h) { i += 1; emit({ t: 'h' + h[1].length, x: h[2] }, start, i - 1); continue }
    i += 1
    emit({ t: 'p', x: bare }, start, i - 1)
  }
  return { blocks, ranges }
}

export function mdOfSource(text: string): RdBlock[] {
  return parseMd(text).blocks
}

/* 源码里的标题行 → 目录项。id 用行号（编辑态要跳的是文本域里的那一行）；
    阅读态那条目录用的是块下标（`rd-s<i>`）—— 两套 id 只在自己那一态出现。 */
export function mdTocItems(text: string): { id: string; lv: number; name: string; line: number }[] {
  const out: { id: string; lv: number; name: string; line: number }[] = []
  String(text).split('\n').forEach((l, i) => {
    const m = /^(#{1,3})\s+(.*)$/.exec(l.trim())
    if (m) out.push({ id: 'ed-l' + i, lv: m[1].length, name: m[2] || '（未命名小节）', line: i })
  })
  return out
}

/* ---------------------------------------------------------------- DOM → markdown

   DOM → markdown，可视面回写的那一半。
   每个判断都要与 rd-render.ts 的产出对齐：那边产 <strong>，这边就认 <strong>。 */

const ED_WYS_BLOCK: Record<string, 1> = {
  p: 1, div: 1, h1: 1, h2: 1, h3: 1, h4: 1, h5: 1, h6: 1,
  ul: 1, ol: 1, li: 1, blockquote: 1, pre: 1, table: 1, hr: 1, figure: 1,
}

/* 列表项在 DOM 里的层级类（渲染那边写的是 `rd-ind{n}`）。 */
export function edWysIndentOf(el: Element): number {
  const m = /(?:^|\s)rd-ind(\d)(?:\s|$)/.exec(String(el.className || ''))
  return m ? Math.min(+m[1], 3) : 0
}

export function mdInlineOf(node: Node): string {
  let out = ''
  Array.prototype.forEach.call(node.childNodes, (child: Node) => {
    if (child.nodeType === 3) { out += child.nodeValue; return }
    if (child.nodeType !== 1) return
    const el = child as Element
    const tag = el.tagName.toLowerCase()
    /* 存成 `<br>` 本身，不是换行符 —— 表格格子里 `\n` 会被压成空格（那是语法的硬要求），
       所以 `\n` 一进格子就静默变空了。`<br>` 是能存下来的行内 HTML，渲染那边也认它。 */
    if (tag === 'br') { out += '<br>'; return }
    const inner = mdInlineOf(el)
    if (tag === 'strong' || tag === 'b') { out += inner ? '**' + inner + '**' : ''; return }
    if (tag === 'em' || tag === 'i') { out += inner ? '*' + inner + '*' : ''; return }
    if (tag === 'del' || tag === 's' || tag === 'strike') { out += inner ? '~~' + inner + '~~' : ''; return }
    if (tag === 'mark') { out += inner ? '==' + inner + '==' : ''; return }
    if (tag === 'code') { out += inner ? '`' + inner + '`' : ''; return }
    /* 上下标：源码里就是一对行内 HTML 标签 —— 与 `rdInline` 是同一条方言的两端。 */
    if (tag === 'sup' || tag === 'sub') { out += inner ? '<' + tag + '>' + inner + '</' + tag + '>' : ''; return }
    if (tag === 'a') {
      const href = el.getAttribute('href') || ''
      out += href ? '[' + inner + '](' + href + ')' : inner
      return
    }
    if (tag === 'span') {
      /* 过同一支白名单（`rdSpanStyle`）⇒ DOM 里手写的样式也进不了源码，
         而且"写出去的"与"读得回来的"天然一致。 */
      const st = rdSpanStyle(el.getAttribute('style') || '')
      if (st && inner) { out += '<span style="' + st + '">' + inner + '</span>'; return }
      out += inner
      return
    }
    if (ED_WYS_BLOCK[tag]) { out += '\n\n' + mdBlockOf(el) + '\n\n'; return }
    out += inner
  })
  return out
}

/* 表格 → markdown（首行当表头，与渲染出来的 thead 对齐）。 */
export function mdTableOf(table: HTMLTableElement): string {
  const rows = Array.prototype.map.call(table.rows, (tr: HTMLTableRowElement) =>
    Array.prototype.map.call(tr.cells, (td: HTMLTableCellElement) =>
      mdInlineOf(td).replace(/\s*\n\s*/g, ' ').replace(/\|/g, '\\|').trim()))
  if (!rows.length) return ''
  const head = rows[0] as string[]
  return ['| ' + head.join(' | ') + ' |', '| ' + head.map(() => '---').join(' | ') + ' |']
    .concat((rows.slice(1) as string[][]).map((r) => '| ' + r.join(' | ') + ' |')).join('\n')
}

export function mdBlockOf(node: Element): string {
  const tag = String(node.tagName || '').toLowerCase()
  /* 代码块是"卡片"结构（`.rd-code` 里还有操作栏与行号列）⇒ 必须在按 tag 判断
     之前认它：否则它会被当普通 `div`，把操作栏的名称与整列行号一起读成代码。 */
  if (node.classList && node.classList.contains('rd-code')) {
    const code = node.querySelector('.rd-code-pre code') || node.querySelector('pre')
    const info = edFenceStr({
      lang: node.getAttribute('data-lang') || '',
      title: node.getAttribute('data-title') || '',
      style: node.getAttribute('data-style') || '',
    })
    return '```' + info + '\n' + String(code ? code.textContent : '').replace(/\n+$/, '') + '\n```'
  }
  const flat = (n: Node | Element) => mdInlineOf(n as Node).replace(/\s*\n\s*/g, ' ').trim()
  if (tag === 'hr') return '---'
  if (/^h[1-6]$/.test(tag)) return '#'.repeat(+tag[1]) + ' ' + flat(node)
  if (tag === 'blockquote') return '> ' + flat(node)
  if (tag === 'p') {
    const text = mdInlineOf(node).replace(/^\n+/, '').replace(/\n+$/, '')
    if (!text.trim()) return ''                       /* 空段落（那根撑行高的 `<br>`）不落盘 */
    const st = rdParaStyle(node.getAttribute('style') || '')
    const ps = rdParaStyleStr(st.al, st.lh)
    return ps ? '<div style="' + ps + '">' + text + '</div>' : text
  }
  if (tag === 'ul' || tag === 'ol') {
    const task = tag === 'ul' && node.classList.contains('rd-task')
    const rows: string[] = []
    /* 编号按层级各算各的（与 `mdOfBlocks` 用同一支 `nextOlNum`），
       基数还要接上 `start`（拆开过的列表后半段从第 N 项起）—— 不接就会
       "渲染时是 3. 4.、回读出来是 1. 2."（两态不一致）。 */
    const from0 = tag === 'ol' ? (parseInt(String(node.getAttribute('start') || ''), 10) || 1) : 1
    const cnt = [Math.max(0, from0 - 1), 0, 0, 0]
    Array.prototype.forEach.call(node.children, (li: Element) => {
      if (String(li.tagName || '').toLowerCase() !== 'li') return
      const lv = edWysIndentOf(li)
      const ind = '  '.repeat(lv)
      if (task) {
        const box = li.querySelector('.rd-task-box')
        const on = !!(box && box.classList.contains('is-on'))
        rows.push(ind + '- [' + (on ? 'x' : ' ') + '] ' + flat(li))
      } else {
        rows.push(ind + (tag === 'ol' ? nextOlNum(cnt, lv) + '. ' : '- ') + flat(li))
      }
    })
    const num = tag === 'ol' ? String(node.getAttribute('data-num') || '') : ''
    const from = tag === 'ol' && from0 > 1 ? from0 : 0
    const body = rows.join('\n')
    const head = (num || from > 1)
      ? '<ol' + (num ? ' type="' + num + '"' : '') + (from > 1 ? ' start="' + from + '"' : '') + '>\n'
      : ''
    return head ? head + body + '\n</ol>' : body
  }
  if (tag === 'pre') {
    const code = node.querySelector('code') || node
    return '```\n' + String(code.textContent || '').replace(/\n+$/, '') + '\n```'
  }
  if (tag === 'table') return mdTableOf(node as HTMLTableElement)
  if (tag === 'figure') {
    /* 说明与地址都从 DOM 里读（不是从 `data-*`）：编辑面上这两格能直接改，
       读属性就会"改了地址、存下去还是老的"。 */
    const urlEl = node.querySelector('.rd-media-url')
    const altEl = node.querySelector('.rd-media-text b')
    const url = (urlEl ? urlEl.textContent || '' : '').replace(/\s+/g, '')
    const alt = (altEl ? altEl.textContent || '' : '').trim()
    if (node.classList.contains('is-video')) return '@[video](' + url + ')'
    return '![' + alt + '](' + url + ')'
  }
  if (node.classList && node.classList.contains('rd-note')) {
    const kind = (String(node.className).match(NOTE_CLS_RE) || [])[1] || ED_NOTE_DEFAULT
    /* 取正文只认 `.rd-note-body` —— 上面那行"图标 + 档名"是装饰，不能被读进来
       （老写法取 `span` 会把档名一起写进正文：每存一次，正文前面多一个"警告"）。 */
    const body = node.querySelector('.rd-note-body') || node.querySelector('span')
    return '> [!' + RD_NOTE[kind] + '] ' + flat(body || node)
  }
  /* 认不出的块：把文字原样端出来 —— 不丢内容、不报错 */
  return mdInlineOf(node).replace(/^\n+/, '').replace(/\n+$/, '')
}

export function mdOfDom(root: Element | null): string {
  if (!root) return ''
  const out: string[] = []
  Array.prototype.forEach.call(root.childNodes, (node: Node) => {
    if (node.nodeType === 3) {
      const text = String(node.nodeValue).replace(/\s+/g, ' ').trim()
      if (text) out.push(text)
      return
    }
    if (node.nodeType !== 1) return
    out.push(mdBlockOf(node as Element))
  })
  const md = out.filter((s) => String(s).trim() !== '').join('\n\n')
  return md ? md + '\n' : ''
}

/* ---------------------------------------------------------------------- 字数 */

/* 字数：去掉所有空白再数。阅读态与编辑态共用这一支换算，
    不会出现"编辑态 899、阅读态 902"这种两处不一样。 */
export function edCharsText(md: string): string {
  const n = String(md).replace(/\s/g, '').length
  return n ? n + ' 字' : ''
}

/* 草稿条上那句"上一次有一份没保存的改动（xx 字 · xx 行）"用的读数。 */
export function edCountText(md: string): string {
  const s = String(md)
  const chars = s.replace(/\s/g, '').length
  const rows = s.trim() ? s.replace(/\n+$/, '').split('\n').length : 0
  return chars + ' 字 · ' + rows + ' 行'
}


/* 块的行区间 → md 里的字符区间 `[s, e]`（可视面把"光标在第 i 块"翻成"改第几行"用）。
    末行不一定有换行符 ⇒ 一律 clamp 到 `md.length`，不然会多算一格。 */
export function lineCharRange(md: string, ls: number, le: number): { s: number; e: number } {
  const lines = md.split('\n')
  let s = 0
  for (let i = 0; i < ls && i < lines.length; i += 1) s += lines[i].length + 1
  let e = s
  for (let i = ls; i <= le && i < lines.length; i += 1) e += lines[i].length + 1
  if (e > s) e -= 1
  return { s: Math.min(s, md.length), e: Math.min(Math.max(e, s), md.length) }
}
