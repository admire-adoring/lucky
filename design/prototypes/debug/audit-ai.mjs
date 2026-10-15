/* 一次性审计：AI 助手原型 ↔ 现有工程
   ----------------------------------------------------------------------------
   回答四个问题，全部用集合运算，不凭印象：

   1. 原型的 :root / .dark 令牌有哪些、与内核 --mw-* 的对应关系（同名义/同值义）
   2. 原型用到的**类名集合** ∩ 现有 CSS / TSX 里出现过的类名集合 —— 逐条打印来源文件
   3. 媒体查询清单（断点改道要用）
   4. 内联 onclick 的函数名集合（交互面有多大）

   用法：node design/debug/audit-ai.mjs
*/
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(DIR, '..', '..')
const SRC = path.join(ROOT, 'design/ai-assistant/ai-assistant_index.html')

const html = fs.readFileSync(SRC, 'utf8')
const style = html.match(/<style>([\s\S]*?)<\/style>/)[1]
const body = html.slice(html.indexOf('<body>'), html.indexOf('<script>'))

/* ---------- 1. 令牌 ---------- */
function tokenBlock(css, selector) {
  const i = css.indexOf(selector)
  if (i === -1) return {}
  const open = css.indexOf('{', i)
  const close = css.indexOf('}', open)
  const out = {}
  for (const m of css.slice(open + 1, close).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[m[1]] = m[2].trim()
  }
  return out
}
const rootTok = tokenBlock(style, ':root')
const darkTok = tokenBlock(style, '.dark')

/* 内核已有的令牌 */
const kernel = new Map()
const stylesDir = path.join(ROOT, 'src/styles')
for (const f of fs.readdirSync(stylesDir).filter((x) => x.endsWith('.css'))) {
  const text = fs.readFileSync(path.join(stylesDir, f), 'utf8')
  for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    if (!kernel.has(m[1])) kernel.set(m[1], { value: m[2].trim(), file: f })
  }
}

console.log('\n================ 1. 令牌对照（原型 :root / .dark → 内核）================')
console.log('原型名'.padEnd(22) + '亮色值'.padEnd(46) + '暗色值'.padEnd(30) + '内核同名')
for (const [name, val] of Object.entries(rootTok)) {
  const k = kernel.get(name)
  console.log(
    name.padEnd(22) + String(val).slice(0, 44).padEnd(46) + String(darkTok[name] ?? '—').slice(0, 28).padEnd(30) + (k ? k.file : '——'),
  )
}
console.log(`\n共 ${Object.keys(rootTok).length} 支亮色令牌 / ${Object.keys(darkTok).length} 支暗色令牌`)

/* ---------- 2. 类名集合运算 ---------- */
function classesIn(text) {
  const out = new Set()
  for (const m of text.matchAll(/\.(-?[a-zA-Z_][a-zA-Z0-9_-]*)/g)) out.add(m[1])
  return out
}

/* 原型 CSS 选择器里出现的类名（只取 `{` 之前那一截） */
const protoSelectors = []
for (const m of style.matchAll(/([^{}]+)\{/g)) {
  const sel = m[1].replace(/\/\*[\s\S]*?\*\//g, '').trim()
  if (!sel || sel.startsWith('@') || sel.includes(':') && sel.startsWith(':')) continue
  protoSelectors.push(sel)
}
const protoClasses = classesIn(protoSelectors.join('\n'))

/* 原型标记里用到的类名（含 body 与脚本模板串） */
const script = html.slice(html.indexOf('<script>'))
const protoMarkupClasses = classesIn(body.replace(/<script[\s\S]*?<\/script>/g, '') + script)

/* 现有工程出现的类名 → 来源文件 */
const existing = new Map()
const walk = (dir) => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'target') continue
      walk(p)
      continue
    }
    if (!/\.(css|tsx|ts)$/.test(e.name)) continue
    if (p.includes('styles/')) {
      // 只收选择器里的类名
      const text = fs.readFileSync(p, 'utf8')
      for (const c of classesIn(text.split('{').join('\n'))) {
        if (!existing.has(c)) existing.set(c, new Set())
        existing.get(c).add(path.relative(ROOT, p))
      }
      continue
    }
    const text = fs.readFileSync(p, 'utf8')
    for (const m of text.matchAll(/className=["'{`]([^"'`}]*)["'`}]/g)) {
      for (const c of m[1].split(/\s+/).filter(Boolean)) {
        if (/[^a-zA-Z0-9_-]/.test(c)) continue
        if (!existing.has(c)) existing.set(c, new Set())
        existing.get(c).add(path.relative(ROOT, p))
      }
    }
  }
}
walk(path.join(ROOT, 'src'))

const allProto = new Set([...protoClasses, ...protoMarkupClasses])
const collisions = [...allProto].filter((c) => existing.has(c)).sort()

console.log('\n================ 2. 类名撞车（原型用到 ∩ 工程已有）================')
console.log(`原型类名 ${allProto.size} 个（CSS 选择器 ${protoClasses.size} / 标记 ${protoMarkupClasses.size}）`)
console.log(`工程已有类名 ${existing.size} 个 · 相交 ${collisions.length} 个\n`)
for (const c of collisions) {
  const srcs = [...existing.get(c)]
  const css = srcs.filter((s) => s.endsWith('.css'))
  console.log(`${c.padEnd(24)} ${css.length ? 'CSS' : '   '} ${srcs.slice(0, 4).join(', ')}${srcs.length > 4 ? ` …(+${srcs.length - 4})` : ''}`)
}

/* ---------- 3. 媒体查询 ---------- */
console.log('\n================ 3. 媒体查询 ================')
for (const m of style.matchAll(/@media[^{]+\{/g)) console.log('  ' + m[0].replace('{', '').trim())

/* ---------- 4. 内联事件函数 ---------- */
console.log('\n================ 4. 标记里的内联事件 ================')
const fns = new Set()
for (const m of body.matchAll(/on(?:click|change|input|keydown)="([^"]+)"/g)) {
  for (const f of m[1].matchAll(/([a-zA-Z_$][\w$]*)\s*\(/g)) fns.add(f[1])
}
console.log('  ' + [...fns].sort().join(', '))

console.log('\n================ 5. 脚本里的 DOM 挂载点（id）================')
const ids = new Set()
for (const m of script.matchAll(/getElementById\(['"]([\w-]+)['"]\)/g)) ids.add(m[1])
for (const m of style.matchAll(/#([a-zA-Z][\w-]*)/g)) ids.add('(css) ' + m[1])
console.log('  ' + [...ids].sort().join(', '))

console.log('\n================ 6. 关键帧 ================')
const kf = [...style.matchAll(/@keyframes\s+([\w-]+)/g)].map((m) => m[1])
const kernelKf = []
for (const f of fs.readdirSync(stylesDir).filter((x) => x.endsWith('.css'))) {
  const text = fs.readFileSync(path.join(stylesDir, f), 'utf8')
  for (const m of text.matchAll(/@keyframes\s+([\w-]+)/g)) kernelKf.push(`${m[1]} (${f})`)
}
console.log('原型：' + kf.join(', '))
console.log('内核：' + [...new Set(kernelKf)].join(', '))
