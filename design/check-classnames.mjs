#!/usr/bin/env node
/* ============================================================================
   类名存在性门禁：**手写组件里用到的类名，必须在最终 CSS 里真的存在**。
   ----------------------------------------------------------------------------
   为什么需要它（这是真事，不是假设）：
     `src/components/workspace/project/graph-view.tsx` 里节点画的是
     `<circle className="shape">`，而生成出来的 CSS 里那一支叫 `.gnode .ring` ——
     **类名对不上**。症状是图谱里每个节点都渲染成纯黑实心块（SVG 默认 fill=black），
     而页面不报错、控制台干净、DOM 里类名也在，只有**看图**才看得出来。
     当时只验了 DOM（"10 个节点 / 1 条连线 / 8 个未连线"全对），于是漏掉。

   这条门禁补的正是那个缺口：它比对的是**"用到的"与"存在的"两个集合**，
   不需要人去看图，也不依赖任何主观判断。

   判据：类名来自**最终产物**（`dist/assets/*.css`）——
   它已经把 Tailwind 工具类 + Prism 令牌 + module-workspace 三份合成一体，
   所以"产物里有"就等于"浏览器能给它上样式"。用中间产物（如 gen 出来的某个文件）
   会漏掉另两份，反而制造假警报。

   用法：
     node design/check-classnames.mjs            # 校验（有缺失则退出码 1）
     node design/check-classnames.mjs --list     # 顺带打印全部命中的类名
   ========================================================================= */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

/* ------------------------------------------------------------------ *
 * 1) 「存在的」：从最终 CSS 里取所有类名
 * ------------------------------------------------------------------ */

const CSS_DIR = path.join(ROOT, 'dist/assets')
if (!fs.existsSync(CSS_DIR)) {
  console.error('✗ 找不到 dist/assets —— 先跑 `vite build`（本门禁以最终产物为准）')
  process.exit(1)
}
const cssFiles = fs.readdirSync(CSS_DIR).filter((f) => f.endsWith('.css'))
if (!cssFiles.length) {
  console.error('✗ dist/assets 里没有 CSS —— 先跑 `vite build`')
  process.exit(1)
}

/**
 * 从 CSS 里抽出所有类名。
 *
 * ⚠️ 只扫**选择器**、不扫声明块：`content: ".foo"` 这类字符串里的名字不是类名，
 *    混进来会让门禁把真缺失判成"存在"（假阴性，比假阳性危险）。
 *    判据是"这段文本后面跟着 `{`" —— 声明后面跟的是 `;`（或 `}`），
 *    所以按 `{` 取选择器、按 `;` 丢弃声明。
 * ⚠️ **必须按任意嵌套深度扫**：Tailwind v4 的产物整个包在 `@layer` / `@media` 里，
 *    只扫最外层会一个工具类都收不到 —— 实测会报出 530 个假缺失（`absolute`、
 *    `bg-brand-500` 这种），门禁当场变成噪声源。第一版就是这么错的。
 * ⚠️ 必须**去转义**：Tailwind 的任意值类写成 `.max-\[1180px\]\:flex-col`，
 *    而 JSX 里写的是 `max-[1180px]:flex-col` —— 不去转义一个都对不上。
 */
function classesInCss(css) {
  const out = new Set()
  let buf = ''
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    if (ch === '{') {
      const sel = buf.replace(/\/\*[\s\S]*?\*\//g, '')
      for (const m of sel.matchAll(/\.((?:\\.|[-\w\u00a0-\uffff])+)/g)) {
        out.add(m[1].replace(/\\(.)/g, '$1'))
      }
      buf = ''
      continue
    }
    if (ch === '}' || ch === ';') {
      buf = ''
      continue
    }
    buf += ch
  }
  return out
}

const defined = new Set()
for (const f of cssFiles) {
  for (const c of classesInCss(fs.readFileSync(path.join(CSS_DIR, f), 'utf8'))) defined.add(c)
}

/* ------------------------------------------------------------------ *
 * 2) 「用到的」：从 JSX 里取 className / cn(...) 的字面量
 * ------------------------------------------------------------------ */

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.name.endsWith('.tsx')) out.push(p)
  }
  return out
}

/** 归一化：把模板串里的插值挖掉，只留静态部分（动态那半本来就查不了） */
const stripInterp = (s) => s.replace(/\$\{[^}]*\}/g, ' ')

/**
 * 取出一段 JSX 属性值 / cn(...) 实参里的**所有引号字符串**。
 *
 * 为什么要顺着括号走而不是找第一个 `}`：`cn('a', x && 'b')` 里有嵌套，
 * 正则非贪婪会在第一个 `}` 截断，漏掉后半截 —— 而那正是最常出错的边角。
 *
 * ⚠️ 这里必须**跳过两类"看起来像类名、其实是代码"的字符串**，否则门禁会满屏假警报
 *    （实测不跳的话 14 条命中里 10 条是假的）：
 *      ① **带插值的模板串**：`` `is-${key}` `` 挖掉插值只剩 `is-` 这种碎片，
 *         拿它去查永远查不到 —— 它本来也不是一个类名。带插值就整条跳过。
 *      ② **比较的右操作数**：`tone === 'danger'`、`=== 'up'`、`=== 'doc'`
 *         里的字符串是**数据值**，不是类名。判据是它紧跟在 `=` / `!` 之后
 *         （三元里的 `? 'a' : 'b'` 紧跟的是 `?` / `:`，那两个是真类名，不能跳过）。
 */
function literalsIn(src, from) {
  const lits = []
  let depth = 0
  for (let i = from; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{' || ch === '(' || ch === '[') depth++
    else if (ch === '}' || ch === ')' || ch === ']') {
      depth--
      if (depth <= 0) break
    } else if (ch === "'" || ch === '"' || ch === '`') {
      const end = src.indexOf(ch, i + 1)
      if (end < 0) break
      const raw = src.slice(i + 1, end)
      const before = src.slice(Math.max(0, i - 6), i).trimEnd()
      const isCompareOperand = /[=!]$/.test(before)
      if (!raw.includes('${') && !isCompareOperand) lits.push(raw)
      i = end
    }
  }
  return lits
}

const used = new Map() // 类名 → 出处（文件名:行）
const ATTR = /className\s*=\s*/g
const CN = /\bcn\s*\(/g

for (const file of walk(path.join(ROOT, 'src'))) {
  const src = fs.readFileSync(file, 'utf8')
  const rel = path.relative(ROOT, file)
  const lineOf = (idx) => src.slice(0, idx).split('\n').length

  const collect = (lits, at) => {
    for (const lit of lits) {
      for (const token of lit.split(/\s+/)) {
        if (!token || !/^[a-zA-Z]/.test(token)) continue
        if (!used.has(token)) used.set(token, `${rel}:${lineOf(at)}`)
      }
    }
  }

  for (const m of src.matchAll(ATTR)) {
    let i = m.index + m[0].length
    const ch = src[i]
    if (ch === '"' || ch === "'" || ch === '`') {
      const end = src.indexOf(ch, i + 1)
      if (end > 0) collect([stripInterp(src.slice(i + 1, end))], m.index)
    } else if (ch === '{') {
      collect(literalsIn(src, i), m.index)
    }
  }
  // `cn(...)` 出现在 className 之外时（拼好赋给变量）也要收
  for (const m of src.matchAll(CN)) collect(literalsIn(src, m.index + m[0].length - 1), m.index)
}

/* ------------------------------------------------------------------ *
 * 3) 比对
 * ------------------------------------------------------------------ */

/**
 * 白名单：**只有在"这个名字确实不需要 CSS"时才加**，且必须写清理由。
 * 每个条目都要能解释给下一个人听 —— 它变成杂物筐的那一天，这条门禁就失效了。
 */
const ALLOW = new Map([
  [
    'priority-low',
    '原型 design/task 自己在标记里写了它、却从没定义过规则（实测 2 次出现 / 0 次规则）。' +
      '生成物只是忠实照搬 —— 要修也修原型，不该在应用侧凭空补一条原型没有的样式。',
  ],
  [
    'is-corner',
    '同上，原型 design/project 的 `.matrix-axis.is-corner` 也是只写不定义。' +
      '四象限左上角那格本来就不承载内容，属于原型留下的占位类名。',
  ],
])

const missing = []
for (const [token, where] of used) {
  if (defined.has(token) || ALLOW.has(token)) continue
  missing.push([token, where])
}

if (process.argv.includes('--list')) {
  console.log(`\n存在的类名 ${defined.size} 个 · 用到的类名 ${used.size} 个\n`)
}

if (missing.length) {
  console.error(`\n✗ 有 ${missing.length} 个类名「用了但 CSS 里不存在」—— 浏览器不会给它任何样式：\n`)
  for (const [token, where] of missing.sort()) console.error(`   ${token.padEnd(28)} ${where}`)
  console.error(
    '\n这类缺陷**不报错、DOM 里也在**，只是没样式（SVG 里表现为默认黑色填充）。\n' +
      '修法二选一：改成 CSS 里真正定义的那个名字，或在样式表里补上它。\n',
  )
  process.exit(1)
}
console.log(`✓ 类名全部存在（用到的 ${used.size} 个都在最终 CSS 里）`)
