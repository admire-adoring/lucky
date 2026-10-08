/* 文档原文 · 代码块的语法高亮（原型 edHl* 一族）。

   零依赖的词法着色，不做语法分析，只按注释 / 字符串 / 数字 / 关键字 / 类型 /
   字面量 / 函数名 / 属性名切词。认不出的语言（含 text）原样输出。
   产出剥掉标签后必须逐字等于原文，否则高亮层会与底下的纯文本整体错位。
   只产出字符串，每个片段都过 esc()。
   与 rd-render.ts 互相 import，两边都只在函数体内用对方。 */

import { esc } from './rd-render'

interface HlSpec {
  /* 关键字 */
  kw?: string
  /* 类型与内置 */
  type?: string
  /* 字面量 —— 优先级最高（所以 `true` 同时写进 kw 也不会被抢） */
  lit?: string
  /* 行注释前缀 */
  com?: string
  /* 块注释一对 */
  blk?: [string, string]
  /* 字符串引号集合 */
  q?: string
  /* 三引号（Python） */
  q3?: 1
  /* 后跟 `(` 的算函数名 */
  fn?: 1
  /* 后跟 `:` 的算键名（带引号的也算 —— JSON 的 `"a":` 靠它；`(?!:)` 排除作用域符） */
  prop?: 1
  /* 大小写不敏感（SQL）—— 词表必须全写小写，比较时把词也折成小写 */
  ci?: 1
  /* 修饰符前缀（`@Override`） */
  dec?: string
  /* 变量前缀（Shell 的 `$VAR`） */
  varCh?: string
  /* 另开一支渲染（其余走通用扫描） */
  kind?: 'markup' | 'css' | 'md'
  _kw?: Record<string, 1>
  _ty?: Record<string, 1>
  _lit?: Record<string, 1>
}

const SPECS: Record<string, HlSpec> = {
  js: {
    kw: 'as async await break case catch class const continue debugger default delete do else export extends finally for from function get if import in instanceof interface let new of package private protected public return set static super switch this throw try typeof var void while with yield',
    type: 'Array Boolean Date Error JSON Map Math Number Object Promise Proxy Reflect RegExp Set String Symbol WeakMap console document window globalThis',
    lit: 'true false null undefined NaN Infinity',
    com: '//', blk: ['/*', '*/'], q: '\'"\u0060', fn: 1, prop: 1, dec: '@',
  },
  java: {
    kw: 'abstract assert break case catch class const continue default do else enum extends final finally for goto if implements import instanceof interface native new package private protected public return static strictfp super switch synchronized this throw throws transient try var void volatile while record sealed permits yield',
    type: 'boolean byte char double float int long short void String Integer Long Double Boolean Character List Map Set ArrayList HashMap Optional Objects Stream Builder',
    lit: 'true false null', com: '//', blk: ['/*', '*/'], q: '\'"', fn: 1, dec: '@',
  },
  py: {
    kw: 'and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case',
    type: 'self cls None True False int str float bool list dict set tuple bytes bytearray print len range enumerate zip open isinstance type super object',
    lit: 'None True False', com: '#', q: '\'"', q3: 1, fn: 1, prop: 1, dec: '@',
  },
  go: {
    kw: 'break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var',
    type: 'bool byte complex64 complex128 error float32 float64 int int8 int16 int32 int64 rune string uint uint8 uint16 uint32 uint64 uintptr any append cap close copy delete len make new panic print println recover',
    lit: 'true false nil iota', com: '//', blk: ['/*', '*/'], q: '\'"\u0060', fn: 1,
  },
  rs: {
    kw: 'as async await break const continue crate dyn else enum extern fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait type unsafe use where while',
    type: 'bool char f32 f64 i8 i16 i32 i64 i128 isize str u8 u16 u32 u64 u128 usize String Vec Option Result Box Some None Ok Err println format vec',
    lit: 'true false', com: '//', blk: ['/*', '*/'], q: '"', fn: 1,
  },
  sql: {
    kw: 'select from where group by order having join inner left right full outer cross on as insert into values update set delete create alter drop truncate table view index unique primary key foreign references default not null and or in like between exists case when then else end asc desc limit offset union all distinct count sum avg min max coalesce cast with',
    lit: 'true false null', com: '--', blk: ['/*', '*/'], q: '\'"', ci: 1, fn: 1,
  },
  sh: {
    kw: 'if then else elif fi for while until do done case esac in function return exit local export readonly declare set unset source eval exec trap shift echo printf cd read test',
    lit: 'true false', com: '#', q: '\'"\u0060', fn: 1, varCh: '$',
  },
  json: { lit: 'true false null', q: '"', prop: 1, com: '//' },
  yaml: { lit: 'true false null yes no on off', com: '#', q: '\'"\u0060', prop: 1 },
  html: { kind: 'markup' },
  css: { kind: 'css' },
  md: { kind: 'md' },
}

/* 同类语言的别名（不重抄一份词表 —— 抄两份迟早只改一处）。 */
const ALIAS: Record<string, string> = { ts: 'js', jsx: 'js', xml: 'html' }

/* 空格分隔的词串 → 查表对象。 */
function words(str?: string): Record<string, 1> {
  const out: Record<string, 1> = {}
  String(str || '').split(/\s+/).forEach((w) => { if (w) out[w] = 1 })
  return out
}

/* 取规格，顺带惰性切词表（一进来就切十几份没必要）。 */
function specOf(lang: string): HlSpec | null {
  const spec = SPECS[ALIAS[lang] || lang]
  if (!spec) return null
  if (!spec._kw) {
    spec._kw = words(spec.kw)
    spec._ty = words(spec.type)
    spec._lit = words(spec.lit)
  }
  return spec
}

/* -------------------------------------------------------------- 通用扫描一支 */

const isIdent = (c: string) => /[A-Za-z_$]/.test(c)

/* C 系 / Python / Go / Rust / SQL / Shell / JSON / YAML 都走这一支。 */
function plain(code: string, spec: HlSpec): string {
  let out = ''
  let buf = ''
  let i = 0
  const n = code.length
  const flush = () => { if (buf) { out += esc(buf); buf = '' } }
  const put = (cls: string, text: string) => { flush(); out += '<span class="tk-' + cls + '">' + esc(text) + '</span>' }

  while (i < n) {
    const c = code.charAt(i)
    if (spec.com && code.startsWith(spec.com, i)) {
      let j = code.indexOf('\n', i)
      if (j < 0) j = n
      put('com', code.slice(i, j))
      i = j
      continue
    }
    /* 块注释：到文末仍未闭合就吃到结尾 —— 不抛错、也不吞掉后面的内容 */
    if (spec.blk && code.startsWith(spec.blk[0], i)) {
      let j = code.indexOf(spec.blk[1], i + spec.blk[0].length)
      j = j < 0 ? n : j + spec.blk[1].length
      put('com', code.slice(i, j))
      i = j
      continue
    }
    /* 字符串（含 Python 的三引号）。`\` 转义要跳两格，否则引号串会被提前收尾 */
    if (spec.q && spec.q.indexOf(c) >= 0) {
      const q3 = spec.q3 && code.startsWith(c + c + c, i)
      const mark = q3 ? c + c + c : c
      let j = i + mark.length
      while (j < n) {
        const ch = code.charAt(j)
        if (ch === '\\') { j += 2; continue }
        if (code.startsWith(mark, j)) { j += mark.length; break }
        if (!q3 && ch === '\n') break
        j += 1
      }
      if (j > n) j = n
      /* 后面紧跟 `:` ⇒ 它是键（JSON 的 `"a":`、对象字面量、Python 的 dict）⇒ 给属性色。
         不给的话 JSON 的键与它自己的值同色，整块看着就是"一片绿"。 */
      put(spec.prop && /^[ \t]*:(?!:)/.test(code.slice(j)) ? 'prop' : 'str', code.slice(i, j))
      i = j
      continue
    }
    /* 修饰符（`@Override` / `@Bean`）整个着色 */
    if (spec.dec && c === spec.dec) {
      const m = /^[A-Za-z_$][\w$]*/.exec(code.slice(i + 1))
      if (m) { put('dec', c + m[0]); i += 1 + m[0].length; continue }
    }
    /* 数字：前面紧挨着标识符的不算（`a1` 里的 1、`v2` 里的 2） */
    if (c >= '0' && c <= '9' && !/[A-Za-z0-9_$]/.test(code.charAt(i - 1) || '')) {
      const m = /^(0[xXbBoO][0-9a-fA-F_]+|\d[\d_]*(?:\.[\d_]*)?(?:[eE][+\-]?\d+)?)/.exec(code.slice(i))
      const w = m ? m[0] : c
      put('num', w)
      i += w.length
      continue
    }
    if (spec.varCh && c === spec.varCh) {
      const m = /^[A-Za-z_][\w]*/.exec(code.slice(i + 1))
      if (m) { put('var', c + m[0]); i += 1 + m[0].length; continue }
    }
    /* 标识符：查表顺序即优先级（字面量 → 关键字 → 类型 → 函数名 → 属性名） */
    if (isIdent(c)) {
      const m = /^[A-Za-z_$][\w$]*/.exec(code.slice(i))
      const w = (m as RegExpExecArray)[0]
      const rest = code.slice(i + w.length)
      const key = spec.ci ? w.toLowerCase() : w
      let cls = ''
      if (spec._lit && spec._lit[key]) cls = 'lit'
      else if (spec._kw && spec._kw[key]) cls = 'kw'
      else if (spec._ty && spec._ty[key]) cls = 'type'
      else if (spec.fn && /^[ \t]*\(/.test(rest)) cls = 'fn'
      else if (spec.prop && /^[ \t]*:(?!:)/.test(rest)) cls = 'prop'
      if (cls) put(cls, w)
      else buf += w
      i += w.length
      continue
    }
    buf += c
    i += 1
  }
  flush()
  return out
}

/* ------------------------------------------------------------- HTML / XML 一支 */

/* 一个标签（`<a href="x">`）拆成记号色。 */
function markupTag(tag: string): string {
  const m = /^(<\/?)([A-Za-z][\w:.\-]*)([\s\S]*?)(\/?>)$/.exec(tag)
  if (!m) return esc(tag)
  let body = ''
  const attrs = m[3]
  const re = /([A-Za-z_:][\w:.\-]*)(\s*=\s*)("[^"]*"|'[^']*')?/g
  let last = 0
  let mm = re.exec(attrs)
  while (mm) {
    body += esc(attrs.slice(last, mm.index))
    body += '<span class="tk-prop">' + esc(mm[1]) + '</span>' + esc(mm[2])
    if (mm[3]) body += '<span class="tk-str">' + esc(mm[3]) + '</span>'
    last = mm.index + mm[0].length
    mm = re.exec(attrs)
  }
  body += esc(attrs.slice(last))
  return '<span class="tk-dec">' + esc(m[1]) + '</span>'
    + '<span class="tk-kw">' + esc(m[2]) + '</span>' + body
    + '<span class="tk-dec">' + esc(m[4]) + '</span>'
}

/* 原型把注释记号拼出来（`'<!' + '--'`）而不是写成字面：它内联在 HTML 的 `<script>`
   里，出现字面的开记号会让 HTML 解析器进入 "script data escaped" 状态，整段脚本静默失效。
   这里是独立的 `.ts` 模块，没有那个坑 —— 但保留拼法也没坏处（万一将来又内联回去）。 */
const CMT_O = '<!' + '--'
const CMT_C = '--' + '>'

/* HTML / XML：标签与属性着色，标签之间的文本不着色（正文就该是正文色）。 */
function markup(code: string): string {
  let out = ''
  let i = 0
  const n = code.length
  while (i < n) {
    const lt = code.indexOf('<', i)
    if (lt < 0) { out += esc(code.slice(i)); break }
    if (lt > i) out += esc(code.slice(i, lt))
    if (code.startsWith(CMT_O, lt)) {
      let j = code.indexOf(CMT_C, lt + CMT_O.length)
      j = j < 0 ? n : j + CMT_C.length
      out += '<span class="tk-com">' + esc(code.slice(lt, j)) + '</span>'
      i = j
      continue
    }
    if (code.startsWith('<!', lt)) {          /* `<!DOCTYPE …>` */
      let j = code.indexOf('>', lt)
      j = j < 0 ? n : j + 1
      out += '<span class="tk-com">' + esc(code.slice(lt, j)) + '</span>'
      i = j
      continue
    }
    const gt = code.indexOf('>', lt)
    if (gt < 0) { out += esc(code.slice(lt)); break }
    out += markupTag(code.slice(lt, gt + 1))
    i = gt + 1
  }
  return out
}

/* ------------------------------------------------------------------ CSS 一支 */

/* 注释 / 字符串 / `@rule` / 色值与数字 / 选择器（块外）/ 属性名（块内、后跟 `:`）。 */
function css(code: string): string {
  let out = ''
  let buf = ''
  let i = 0
  const n = code.length
  let depth = 0
  const flush = () => { if (buf) { out += esc(buf); buf = '' } }
  const put = (cls: string, text: string) => { flush(); out += '<span class="tk-' + cls + '">' + esc(text) + '</span>' }

  while (i < n) {
    const c = code.charAt(i)
    if (code.startsWith('/*', i)) {
      let j = code.indexOf('*/', i + 2)
      j = j < 0 ? n : j + 2
      put('com', code.slice(i, j))
      i = j
      continue
    }
    if (c === '"' || c === "'") {
      let j = i + 1
      while (j < n && code.charAt(j) !== c) { if (code.charAt(j) === '\\') j += 1; j += 1 }
      j += 1
      if (j > n) j = n
      put('str', code.slice(i, j))
      i = j
      continue
    }
    if (c === '{') { depth += 1; buf += c; i += 1; continue }
    if (c === '}') { depth = Math.max(0, depth - 1); buf += c; i += 1; continue }
    if (c === '@') {
      const m = /^@[\w\-]+/.exec(code.slice(i))
      if (m) { put('kw', m[0]); i += m[0].length; continue }
    }
    if (c === '#' && /[0-9a-fA-F]/.test(code.charAt(i + 1))) {
      const m = /^#[0-9a-fA-F]{3,8}/.exec(code.slice(i))
      put('num', (m as RegExpExecArray)[0])
      i += (m as RegExpExecArray)[0].length
      continue
    }
    if (c >= '0' && c <= '9' && !/[A-Za-z0-9_\-.#]/.test(code.charAt(i - 1) || '')) {
      const m = /^\d[\d.]*(?:[a-zA-Z%]+)?/.exec(code.slice(i))
      put('num', (m as RegExpExecArray)[0])
      i += (m as RegExpExecArray)[0].length
      continue
    }
    if (/[A-Za-z_\u4e00-\u9fa5]/.test(c)) {
      const m = /^[A-Za-z_\u4e00-\u9fa5][\w\-\u4e00-\u9fa5]*/.exec(code.slice(i))
      const w = (m as RegExpExecArray)[0]
      const rest = code.slice(i + w.length)
      if (depth > 0) {
        if (/^[ \t]*:(?!:)/.test(rest)) put('prop', w)
        else buf += w
      } else {
        put('sel', w)      /* 块外：整段当选择器（不细分 `.a > .b` —— 够看就行） */
      }
      i += w.length
      continue
    }
    buf += c
    i += 1
  }
  flush()
  return out
}

/* ------------------------------------------------------------ Markdown 一支 */

/* 行首标记 + 行内的反引号 / 粗体 / 链接。 */
function md(code: string): string {
  return String(code).split('\n').map((line) => {
    let out = ''
    let rest = line
    const head = /^(\s*)(#{1,6}|>|[-*+]|\d+\.|\u0060\u0060\u0060|---)(\s|$)/.exec(line)
    if (head) {
      out += esc(head[1]) + '<span class="tk-kw">' + esc(head[2]) + '</span>' + esc(head[3])
      rest = line.slice(head[0].length)
    }
    let buf = ''
    let i = 0
    const n = rest.length
    const flush = () => { if (buf) { out += esc(buf); buf = '' } }
    const put = (cls: string, text: string) => { flush(); out += '<span class="tk-' + cls + '">' + esc(text) + '</span>' }
    const BT = String.fromCharCode(96)
    while (i < n) {
      const c = rest.charAt(i)
      if (c === BT) {
        const j = rest.indexOf(BT, i + 1)
        if (j > i) { put('str', rest.slice(i, j + 1)); i = j + 1; continue }
      }
      if (c === '*' || c === '_') {
        const m = /^(\*\*|__)([^*_]+)(\*\*|__)/.exec(rest.slice(i))
        if (m) { put('fn', m[0]); i += m[0].length; continue }
      }
      if (c === '[') {
        const m = /^\[([^\]\n]*)\]\(([^)\n]*)\)/.exec(rest.slice(i))
        /* 方括号必须跟着一起输出：只 put 捕获组会把 `[` `]` 吃掉 ——
           那就不是"改颜色"而是改内容了（原型实跑剥标签逐字比才逮到）。
           ⇒ 这条不变式对每一支着色器都成立：产出剥掉标签后必须逐字等于原文。 */
        if (m) { put('fn', '[' + m[1] + ']'); put('num', '(' + m[2] + ')'); i += m[0].length; continue }
      }
      buf += c
      i += 1
    }
    flush()
    return out
  }).join('\n')
}

/* 代码 → 高亮 HTML。认不出的语言（含 `text`）原样输出。 */
export function hlCode(code: string, lang: string): string {
  const spec = specOf(String(lang || ''))
  if (!spec) return esc(code)
  if (spec.kind === 'markup') return markup(code)
  if (spec.kind === 'css') return css(code)
  if (spec.kind === 'md') return md(code)
  return plain(code, spec)
}

/* 语言下拉那一列（原型 `ED_CODE_LANGS`）。值就是 `data-lang` 写进 markdown 的那个词。 */
export const CODE_LANGS: [string, string][] = [
  ['text', '纯文本'], ['js', 'JavaScript'], ['java', 'Java'], ['py', 'Python'], ['go', 'Go'],
  ['rs', 'Rust'], ['sql', 'SQL'], ['sh', 'Shell'], ['json', 'JSON'], ['yaml', 'YAML'],
  ['html', 'HTML'], ['css', 'CSS'], ['md', 'Markdown'],
]
