/* 文档原文 · 渲染层（原型 rd* 那一族）。

   只做一件事：块与行内标记 → HTML 字符串。阅读态灌进 .rd-body，编辑态的可视面
   用同一支渲染。
   返回字符串而不是 JSX，是因为可视面要把 DOM 再序列化回 markdown。
   数据都过 esc()，行内样式走白名单。 */

/* 段落块级样式的白名单（与行内那套是两张表，别混：一套管"这一段字的样子"，
    另一套管"这一整段的排版"）。值只在工具条那张表里，这里只判形状。 */
import type { RdBlock } from '../../../../data/workspace/doc-bodies'
import { CODE_LANGS, hlCode } from './hl'
import { CODE_STYLES, codePrefs } from './code-block'

export const RD_ALIGN: Record<string, 1> = { left: 1, center: 1, right: 1 }
export const RD_LH: Record<string, 1> = { '1': 1, '1.15': 1, '1.5': 1, '2': 1, '2.5': 1, '3': 1 }
/* 有序列表的编号样式（值就是写进 `<ol type>` 的那三个词，读写两头读同一处） */
export const RD_NUM: Record<string, 1> = { a: 1, cn: 1, multi: 1 }

/* 提示块的档位：中文名 只有这一份（`> [!重要]` 的存法也读它，两处各写一遍迟早漏一处）。 */
export const RD_NOTE: Record<string, string> = {
  info: '提醒', tip: '建议', imp: '重要', danger: '警告', warn: '注意',
}
/* 每一档配哪枚图标。与 `RD_NOTE` 各写一行是有意的：一个是"叫什么"，一个是"画什么"；
    五个 key 必须一一对应，漏一个就回落成空格子（不报错、只是难看）。 */
export const RD_NOTE_ICO: Record<string, string> = {
  info: 'info', tip: 'bulb', imp: 'squareAlert', danger: 'alert', warn: 'alertCircle',
}
/* 认不出档位时的兜底 = 声明顺序的第一档 */
export const ED_NOTE_DEFAULT = Object.keys(RD_NOTE)[0] as string

/* 24 网格的图形（照原型 `icons` 表取这一页用到的几枚）。
   这里是字符串版：块渲染返回 HTML 串，拼不进 React 组件。 */
const RD_ICONS: Record<string, string> = {
  info: '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>',
  bulb: '<path d="M12 2.8a6.2 6.2 0 0 0-3.6 11.2v1.6h7.2v-1.6A6.2 6.2 0 0 0 12 2.8Z"></path><line x1="9.4" y1="18.4" x2="14.6" y2="18.4"></line><line x1="10.6" y1="20.6" x2="13.4" y2="20.6"></line>',
  squareAlert: '<rect x="3.4" y="3.4" width="17.2" height="17.2" rx="4.6"></rect><line x1="12" y1="7.8" x2="12" y2="13"></line><line x1="12" y1="16.4" x2="12.01" y2="16.4"></line>',
  alert: '<path d="M10.3 3.9 1.9 18a2 2 0 0 0 1.7 3h16.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"></path><path d="M12 9v4M12 17h.01"></path>',
  alertCircle: '<circle cx="12" cy="12" r="9.2"></circle><line x1="12" y1="7.2" x2="12" y2="13"></line><line x1="12" y1="16.6" x2="12.01" y2="16.6"></line>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline>',
  video: '<polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2"></rect>',
  chevronDown: '<polyline points="6 9 12 15 18 9"></polyline>',
  more: '<circle cx="5" cy="12" r="1.7"></circle><circle cx="12" cy="12" r="1.7"></circle><circle cx="19" cy="12" r="1.7"></circle>',
}

export function rdIcon(name: string): string {
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round">'
    + (RD_ICONS[name] || RD_ICONS.info) + '</svg>'
}

export function esc(s: unknown): string {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' } as Record<string, string>
  )[c] as string)
}

/* 行内样式的白名单。`font-family` 不许出现引号 —— 它是拼进 `style="…"` 的，
    带了就会把属性闭合掉（与"属性值只要不是字面量就必须 esc"是同一个坑，这里从源头禁掉）。 */
export function rdSpanStyle(style: unknown): string {
  const ok: string[] = []
  String(style).split(';').forEach((kv) => {
    const i = kv.indexOf(':')
    if (i < 0) return
    const k = kv.slice(0, i).trim().toLowerCase()
    const v = kv.slice(i + 1).trim()
    if (k === 'color' || k === 'background') {
      if (/^#[0-9A-Fa-f]{6}$/.test(v)) ok.push(k + ':' + v.toUpperCase())
      return
    }
    if (k === 'text-decoration') {
      if (v === 'underline' || v === 'line-through') ok.push(k + ':' + v)
      return
    }
    if (k === 'font-size') {
      const m = /^(\d{1,2}(?:\.\d)?)px$/.exec(v)
      if (m && +m[1] >= 10 && +m[1] <= 40) ok.push(k + ':' + v)
      return
    }
    if (k === 'font-family') {
      if (/^[\w\s,'-]{1,60}$/.test(v)) ok.push(k + ':' + v)
    }
  })
  return ok.join(';')
}

export function rdParaStyleStr(al?: string, lh?: string): string {
  const s: string[] = []
  if (al && RD_ALIGN[al]) s.push('text-align:' + al)
  if (lh && RD_LH[lh]) s.push('line-height:' + lh)
  return s.join(';')
}

/* 叶子标记（已在 `esc()` 之后解析）。递归进去处理嵌套（`粗 *斜* 粗`）。 */
function rdMarks(s: string, hold: (html: string) => string): string {
  const self = (t: string) => rdMarks(t, hold)
  s = s.replace(/!\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)/g, (_m, a, u) => hold(rdMediaHtml('img', a, u)))
  s = s.replace(/\[([^\]\n]*)\]\((https?:\/\/[^\s)]+)\)/g, (_m, t, u) => hold(
    `<a class="rd-link" href="${esc(u)}" target="_blank" rel="noopener noreferrer">${self(t)}</a>`))
  s = s.replace(/\*\*([^\n]+?)\*\*/g, (_m, t) => hold(`<strong>${self(t)}</strong>`))
  s = s.replace(/~~([^\n]+?)~~/g, (_m, t) => hold(`<del>${self(t)}</del>`))
  s = s.replace(/==([^\n]+?)==/g, (_m, t) => hold(`<mark>${self(t)}</mark>`))
  s = s.replace(/\*([^*\n]+?)\*/g, (_m, t) => hold(`<em>${self(t)}</em>`))
  return s
}

/* rdInline 的正身。
   keep 是整棵递归树共用的一份，每层各持一份的话，展开时会写出字面的 undefined。
   抽取顺序是定的：外层容器先（span → code → br → sup/sub），叶子标记后。 */
function rdInlineRun(s: string, keep: string[]): string {
  const hold = (html: string) => {
    keep.push(html.replace(/\u0000(\d+)\u0000/g, (_m, n) => keep[+n] as string))
    return '\u0000' + (keep.length - 1) + '\u0000'
  }
  s = s.replace(/<span style="([^"]*)">([\s\S]*?)<\/span>/g, (m, st, inner) => {
    const clean = rdSpanStyle(st)
    return clean ? hold(`<span style="${clean}">${rdInlineRun(inner, keep)}</span>`) : m
  })
  s = s.replace(/`([^`\n]+)`/g, (_m, c) => hold(`<code>${esc(c)}</code>`))
  /* `<br>` / `<sup>` / `<sub>` 必须在 `esc()` 之前抽出 —— esc 之后 `<` 变成 `&lt;`，
     再也认不出来。 */
  s = s.replace(/<br\s*\/?>/gi, () => hold('<br>'))
  s = s.replace(/<sup>([\s\S]*?)<\/sup>/g, (_m, c) => hold(`<sup>${rdInlineRun(c, keep)}</sup>`))
  s = s.replace(/<sub>([\s\S]*?)<\/sub>/g, (_m, c) => hold(`<sub>${rdInlineRun(c, keep)}</sub>`))
  return rdMarks(esc(s), hold)
}

export function rdInline(x: unknown): string {
  const keep: string[] = []
  const s = rdInlineRun(String(x ?? ''), keep)
  /* 展开只做这一趟（在最外层）—— 内层递归一律把占位符留着往上交 */
  return s.replace(/\u0000(\d+)\u0000/g, (_m, n) => keep[+n] as string)
}

/* 图片 / 视频的占位卡。原型不联网取图 —— 一律给"说明 + 地址"；
    真落地时这一层换成真的 `<img>` / 播放器嵌入（那是"取内容"，不是"画界面"）。 */
export function rdMediaHtml(kind: string, alt: string, url: string, wys = false): string {
  const isVideo = kind === 'video'
  let shown = String(url || '')
  if (!wys) {
    try { shown = new URL(url).host || shown } catch { /* 不是标准地址就原样显示 */ }
  }
  return `<figure class="rd-media is-${kind}">${rdIcon(isVideo ? 'video' : 'image')}`
    + `<span class="rd-media-text"><b>${esc(alt || (isVideo ? '视频' : '图片'))}</b>`
    + `<span class="rd-media-note">原型不取真${isVideo ? '视频' : '图'} —— 落地时这里放${isVideo ? '播放器' : '图片'}</span></span>`
    + `<span class="rd-media-url">${esc(shown)}</span></figure>`
}

/* 列表项前面那段空白 = 层级（两个空格一层）。块里存的是去掉 `- ` 之后的原文（含缩进），
    渲染时才推层级、序列化时再加回 `- ` —— 存的是同一份东西，往返不掉。 */
function rdIndentOf(li: string): number {
  const m = /^( *)/.exec(String(li))
  return Math.min(Math.floor((m ? m[1].length : 0) / 2), 3)
}

/* 代码块，两态共用（阅读态把可改的控件禁掉）。

   阅读态直接染 <code>；编辑态的 <code> 里必须是纯文本，颜色画在 .rd-code-hl 那一层，
   is-hl 让文字透明。
   高亮层与操作栏 / 行号列一律 contenteditable="false"，否则会被写进正文。
   阅读态的控件 disabled。 */
export function rdCodeHtml(b: RdBlock, _i: number, wys = false): string {
  const code = String(b.x == null ? '' : b.x)
  const lines = code.split('\n')
  const lang = b.lang || 'text'
  const title = b.title || ''
  const style = /^(light|dark|contrast)$/.test(b.style || '') ? (b.style as string) : 'light'
  const ro = wys ? '' : ' disabled'
  const hl = hlCode(code, lang)
  const opt = (v: string, txt: string, cur: string) =>
    `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(txt)}</option>`
  /* 开关必须像 `mi` 一样老老实实地拼：原型图省事写过 `sw(k,on).replace('></span>', …)` ——
     那个 `></span>` 命中的是前面那颗 `<span class="rd-code-sp">` 的结尾 ⇒ 标签就配错了，
     `innerHTML` 解析器会重排整块结构（不只这颗开关变形，同一份 HTML 里后面的块也碎掉）。 */
  const mi = (k: string, label: string, extra = '', disabled = false) =>
    `<button type="button" class="rd-code-mi" data-code-mi="${k}"${disabled ? ' disabled' : ''}>`
    + `${esc(label)}<span class="rd-code-sp"></span>${extra}</button>`
  const sw = (k: string, label: string, on: boolean) =>
    mi(k, label, `<span class="rd-code-sw${on ? ' is-on' : ''}"></span>`)
  const fsBtn = (v: string, txt: string) =>
    `<button type="button" data-code-fs="${v}"${codePrefs.fs === v ? ' class="is-on"' : ''}>${esc(txt)}</button>`
  const nums = lines.map((_, n) => '<span class="rd-code-num">'
    + `<i class="rd-code-fold" data-rd-fold="${n + 1}" title="折叠这一行之后的内容">${rdIcon('chevronDown')}</i>`
    + (n + 1) + '</span>').join('')
  return `<div class="rd-code is-st-${style}${wys ? ' is-hl' : ''}" data-lang="${esc(lang)}" data-title="${esc(title)}" data-style="${esc(style)}">`
    + '<div class="rd-code-bar" contenteditable="false">'
    + '<button type="button" class="rd-code-btn rd-code-foldall" title="折叠整个代码块" aria-label="折叠整个代码块">'
    + `<span class="rd-code-caret">${rdIcon('chevronDown')}</span></button>`
    + `<input class="rd-code-name" value="${esc(title)}" placeholder="未命名" maxlength="40" autocomplete="off"${ro} aria-label="代码块名称">`
    + '<span class="rd-code-sp"></span>'
    + `<select class="rd-code-sel rd-code-lang" title="编码语言"${ro} aria-label="编码语言">`
    + CODE_LANGS.map((L) => opt(L[0], L[1], lang)).join('')
    + '</select>'
    + `<select class="rd-code-sel rd-code-style" title="代码样式"${ro} aria-label="代码样式">`
    + CODE_STYLES.map((S) => opt(S[0], S[1], style)).join('')
    + '</select>'
    + '<button type="button" class="rd-code-btn rd-code-copy" title="复制代码" aria-label="复制代码">'
    + `${rdIcon('copy')}</button>`
    + '<button type="button" class="rd-code-btn rd-code-more" title="更多" aria-label="更多">'
    + `${rdIcon('more')}</button>`
    /* 菜单用 .is-open 类，不用 hidden 属性。
       同步到全文那两项在阅读态 disabled，自动缩进是原型的占位。 */
    + '<div class="rd-code-menu">'
    + '<div class="rd-code-mi-row"><span>字号</span>'
    + fsBtn('small', '小') + fsBtn('mid', '中') + fsBtn('large', '大')
    + '</div><div class="rd-code-sep"></div>'
    + sw('wrap', '自动换行', codePrefs.wrap)
    + sw('num', '行号', codePrefs.num)
    + '<button type="button" class="rd-code-mi" disabled>自动缩进<span class="rd-code-sp"></span>'
    + '<span class="rd-code-kbd">\u21E7\u2318F</span></button>'
    + '<div class="rd-code-sep"></div>'
    + mi('sync-style', '同步样式到全文', '', !wys)
    + mi('sync-both', '同步样式与语言到全文', '', !wys)
    + mi('nobar', '隐藏全文代码块标题栏')
    + '</div>'
    + '</div>'
    + '<div class="rd-code-body">'
    + `<div class="rd-code-nums" contenteditable="false">${nums}</div>`
    /* 编辑态：`<code>` 里是纯文本，颜色画在另一层上（`is-hl` 让文字透明） */
    + '<pre class="rd-code-pre">'
    + (wys ? `<span class="rd-code-hl" contenteditable="false" aria-hidden="true">${hl}</span>` : '')
    + `<code>${wys ? esc(code) : hl}</code></pre>`
    + '</div></div>'
}

/* 块 → HTML。`i` 是块下标，标题的锚点 id 就是它（目录与正文永远对得上）。 */
export function rdBlockHtml(b: RdBlock, i: number, wys = false): string {
  const t = b.t
  /* 标题六级共用一支。标题里的文字不走行内解析（原型如此）：标题是骨架，不是正文。 */
  if (/^h[1-6]$/.test(t)) return `<${t} id="rd-s${i}">${esc(b.x)}</${t}>`
  if (t === 'p') {
    const ps = rdParaStyleStr(b.al, b.lh)
    return `<p${ps ? ` style="${esc(ps)}"` : ''}>${rdInline(b.x)}</p>`
  }
  if (t === 'ul' || t === 'ol') {
    const list = (b.x as string[]) || []
    let attrs = ''
    if (t === 'ol') {
      if (b.num && RD_NUM[b.num]) attrs += ` data-num="${esc(b.num)}" type="${esc(b.num)}"`
      if (b.start && b.start > 1) attrs += ` start="${esc(b.start)}"`
    }
    return `<${t}${attrs}>` + list.map((li) => `<li class="rd-ind${rdIndentOf(li)}">${rdInline(String(li).trim())}</li>`).join('') + `</${t}>`
  }
  if (t === 'task') {
    const list = (b.x as string[]) || []
    return '<ul class="rd-task">' + list.map((li) => {
      const m = /^( *)- \[([ xX])\]\s*([\s\S]*)$/.exec(String(li))
      const on = !!m && m[2] !== ' '
      const ind = m ? Math.min(Math.floor(m[1].length / 2), 3) : 0
      /* 那一格是 `<span>` 不是 `<input>`：阅读态是只读副本，做成一枚能点的勾
         就是"点了会存"的假承诺。 */
      return `<li class="rd-ind${ind}"><span class="rd-task-box${on ? ' is-on' : ''}" aria-hidden="true"></span>`
        + `<span>${rdInline(String(m ? m[3] : li).trim())}</span></li>`
    }).join('') + '</ul>'
  }
  if (t === 'hr') return '<hr>'
  if (t === 'img' || t === 'video') return rdMediaHtml(t, b.alt ?? '', b.url ?? '', wys)
  if (t === 'quote') return `<blockquote>${rdInline(b.x)}</blockquote>`
  if (t === 'code') return rdCodeHtml(b, i, wys)
  if (t === 'table') {
    const head = (b.head as string[]) || []
    const rows = (b.rows as string[][]) || []
    return '<table><thead><tr>' + head.map((h) => `<th>${esc(h)}</th>`).join('')
      + '</tr></thead><tbody>' + rows.map((r) => '<tr>' + r.map((c) => `<td>${esc(c)}</td>`).join('') + '</tr>').join('')
      + '</tbody></table>'
  }
  if (t === 'note') {
    const k = b.kind && RD_NOTE[b.kind] ? b.kind : ED_NOTE_DEFAULT
    return `<div class="rd-note is-${esc(k)}">`
      + `<div class="rd-note-head">${rdIcon(RD_NOTE_ICO[k] as string)}<b>${RD_NOTE[k]}</b></div>`
      + `<div class="rd-note-body">${rdInline(b.x) || '<br>'}</div></div>`
  }
  return ''
}

/* 目录从块里推（收 h1~h3 三级）：手写一份迟早与正文漂移。
    四级以下不进目录 —— 它们是细节层，全收进来目录会比正文还长（但仍可在正文里读到）。 */
export function rdTocItems(blocks: RdBlock[]): { id: string; lv: number; name: string }[] {
  return blocks
    .map((b, i) => (/^h[1-3]$/.test(b.t) ? { id: 'rd-s' + i, lv: +b.t[1], name: String(b.x ?? '') } : null))
    .filter(Boolean) as { id: string; lv: number; name: string }[]
}

/* 字数：去掉所有空白再数（原型 `edCharsText`）。阅读态与编辑态共用这一支换算，
    不会出现"编辑 899、阅读 902"。 */
export function rdCharsText(md: string): string {
  const n = String(md).replace(/\s/g, '').length
  return n ? n + ' 字' : ''
}
