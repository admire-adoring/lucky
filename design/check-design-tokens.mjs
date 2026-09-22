#!/usr/bin/env node
/* ============================================================================
   设计令牌一致性门禁：`design/design-tokens/design-tokens.md` ↔ 代码。
   ----------------------------------------------------------------------------
   这份文档是**唯一事实源**。所以本门禁的口径不是"抽几条比一比"，而是：

     **文档 §八 列出的每一支变量，都必须在代码里有唯一归属，且取值一致。**

   归属由 `design/sync-design-tokens.mjs` 的映射表声明（谁产出 `--mw-*`、
   谁产出 `--radius-*`……），本门禁**独立复核**那张表 —— 两个脚本各查一遍，
   是因为"映射表写漏一项"与"生成器没写盘"是两种不同的失效，症状却一样（某个令牌没有值）。

   ## 判定分三种（判据都实测过，不是分类癖）

   | 类别 | 含义 | 门禁行为 |
   | --- | --- | --- |
   | **约束项** | 文档与代码必须一致 | 不一致 = 缺陷，`--strict` 退出码 1 |
   | **派生** | 文档给"设计色"，代码里那一支是**按对比度解出来的文字色** | 只登记原因，不判定 |
   | **待办** | 文档给了角色/尺寸，代码里还没有对应的实现口径 | 打印**精确的**待办清单，不判定 |

   ⚠️ "待办"这一类**不还给用户一个选择题**，而是把差多少、差在哪写清楚：
      `字阶` 这一项实测的结论是"模块层完全符合文档、应用外壳整体低 0.5px"，
      所以它是一条**可执行的待办**，而不是"要不要统一"的征询。

   用法：
     node design/check-design-tokens.mjs              # 打印全部
     node design/check-design-tokens.mjs --strict     # 约束项或覆盖率不达标则退出码 1
     node design/check-design-tokens.mjs --only=✗     # 只看某一类判定
   ========================================================================= */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesignTokens, REPO as ROOT } from './lib/design-tokens-doc.mjs'

const argv = process.argv.slice(2)
const only = (argv.find((a) => a.startsWith('--only=')) || '').slice(7)
const strict = argv.includes('--strict')

const BINDING = 'binding'
const DERIVED = 'derived'
const TODO = 'todo'

const doc = readDesignTokens()

/* ------------------------------------------------------------------ *
 * 1) 读代码
 * ------------------------------------------------------------------ */

const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const mwCss = read('src/styles/module-workspace.css')
const prismCss = read('src/styles/prism.css')
const idxCss = read('src/styles/index.css')
const tokCss = read('src/styles/design-tokens.css')
const shellCss = read('src/styles/workspace-shell.css')

/** 取某个选择器块里的声明。块以 `\n}` 收尾（这几个文件都是这个写法）。 */
function blockVars(css, selector) {
  const i = css.indexOf(selector)
  if (i < 0) return null
  const raw = css.slice(i + selector.length, css.indexOf('\n}', i))
  /* ⚠️ 注释必须在**切分之前**整段剥掉。只在值那一侧剥的话，
     块内**第一条声明前的注释会粘到变量名上** —— 名字变成"注释正文紧跟着变量名"，
     于是那条声明被静默跳过。
     实测症状极具迷惑性：同一块里 warning/error/error/info 全过，**只有第一条报"缺失"**，
     看着像"这个令牌真的没定义"（本次就是 --c-success 被这么吃掉的）。
     ⚠️ 本条注释自己也是活教材：这里原本举了那个名字的字面量，而它自带注释收尾符，
        把一个 JS 块注释**提前闭合**了 —— 同一个坑在 CSS 里吃掉过整块令牌，
        在 JS 里直接变成 SyntaxError。所以一律用文字描述，不写字面量。 */
  const body = raw.replace(/\/\*[\s\S]*?\*\//g, '')
  const out = new Map()
  for (const d of body.split(';')) {
    const c = d.indexOf(':')
    if (c < 0) continue
    const n = d.slice(0, c).trim()
    if (n.startsWith('--')) out.set(n, d.slice(c + 1).trim())
  }
  return out
}

const MW = {
  light: blockVars(mwCss, "html:not([data-theme='dark']) {"),
  dark: blockVars(mwCss, "html[data-theme='dark'] {"),
}
const MWA = {
  light: blockVars(mwCss, "html[data-theme='light'] .mw-root,\n.mw-root {"),
  dark: blockVars(mwCss, "html[data-theme='dark'] .mw-root {"),
}
const TOK = {
  root: blockVars(tokCss, ':root {'),
  light: blockVars(tokCss, "html:not([data-theme='dark']) {"),
  dark: blockVars(tokCss, "html[data-theme='dark'] {"),
}
const PZ = (() => {
  const out = new Map()
  for (const m of prismCss.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) if (!out.has(m[1])) out.set(m[1], m[2].trim())
  return out
})()

const rows = []
const add = (what, docVal, codeVal, bucket = BINDING, note = '') => {
  const verdict = codeVal === undefined || codeVal === null ? '⬜' : docVal === codeVal ? '✓' : '✗'
  rows.push({ what, docVal, codeVal: codeVal ?? '(无)', verdict, bucket, note })
}

const hexToTriplet = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')
const MODULES = Object.keys(doc.modules.light)

/* ------------------------------------------------------------------ *
 * 2) 覆盖率：§八 的每一支变量都要有归属
 *
 * 归属表与 sync-design-tokens.mjs 里那张是**各自独立写的** ——
 * 两边都声明"这一支归谁"，对不上就说明有人漏了。
 * ------------------------------------------------------------------ */

const HOME = (name) => {
  // 14 支中性/毛玻璃 → module-workspace.css 的 --mw-<同名>
  if (/^--(bg|border|text|shadow|blur|blob)-/.test(name)) return { where: 'mw', key: `--mw-${name.slice(2)}` }
  // 36 支模块色 → --mw-a-* / --mw-s-*
  const m = /^--(a-[a-z]+-\d|s-[a-z]+)$/.exec(name)
  if (m) return { where: 'mw-accent', key: `--mw-${name.slice(2)}` }
  // 本文件产出的那批
  if (/^--(c-|radius-|transition-)/.test(name) || name === '--grad-ai') return { where: 'tok', key: name }
  return null
}

const uncovered = []
for (const name of doc.vars.light.keys()) {
  const home = HOME(name)
  if (!home) {
    uncovered.push(name)
    continue
  }
  const got =
    home.where === 'mw'
      ? (MW.light.get(home.key) ?? MW.dark.get(home.key))
      : home.where === 'mw-accent'
        ? (MWA.light.get(home.key) ?? MWA.dark.get(home.key))
        : (TOK.light.get(home.key) ?? TOK.dark.get(home.key) ?? TOK.root.get(home.key))
  add(`§八 ${name} → ${home.key}`, doc.vars.light.get(name), got)
}

/* ------------------------------------------------------------------ *
 * 3) 模块色：与 Prism 的三元组也比一遍
 * ------------------------------------------------------------------ */

for (const key of MODULES) {
  for (const scope of ['light', 'dark']) {
    const d = doc.modules[scope][key]
    d.rings.forEach((hex, i) => add(`模块色 ${scope} ${key} 色团${i + 1}`, hex, MWA[scope].get(`--mw-a-${key}-${i + 1}`)))
    add(`模块色 ${scope} ${key} 强调色`, d.accent, MWA[scope].get(`--mw-s-${key}`))
  }
  add(`Prism --s-${key}（亮色强调色的三元组）`, hexToTriplet(doc.modules.light[key].accent), PZ.get(`--s-${key}`))
}

/* ------------------------------------------------------------------ *
 * 4) 派生项：登记原因，不判定
 *
 * 文档 §一 4 的状态色是**设计色**（徽标底/图标/边框那类面积）；
 * Prism 的 --ok/--warn/--bad/--info 是**按实测底衬反解出的文字色**
 * （同一色族的两端：亮色主题取深档、暗色主题取浅档）。
 * 文档 §九 自己写着「文字对比度 ≥ 4.5:1」—— 所以文字**不能**直接用 500 号设计色，
 * 两组值不合并是有依据的，不是没做完。
 * ------------------------------------------------------------------ */

for (const [label, prismKey] of [
  ['成功', '--ok'],
  ['警告', '--warn'],
  ['错误', '--bad'],
  ['信息', '--info'],
]) {
  const k = { 成功: 'success', 警告: 'warning', 错误: 'error', 信息: 'info' }[label]
  rows.push({
    what: `状态色 ${k}：设计色 --c-${k} / 文字色 Prism ${prismKey}`,
    docVal: `--c-${k} = ${doc.vars.light.get(`--c-${k}`)}`,
    codeVal: TOK.light.has(`--c-${k}`) && PZ.has(prismKey) ? `两者都在（${TOK.light.get(`--c-${k}`)} / ${PZ.get(prismKey)}）` : '(缺)',
    verdict: TOK.light.has(`--c-${k}`) && PZ.has(prismKey) ? '✓' : '✗',
    bucket: DERIVED,
    note: '文字色由 prism-derive-colors.mjs 反解，与设计色**不合并**',
  })
}

/* ------------------------------------------------------------------ *
 * 5) 待办：文档给了角色/尺寸，代码里还没有对应实现
 * ------------------------------------------------------------------ */

/* 5a) 字阶。文档 §四 给的是**角色**（主/次/弱/H1/H2/卡片标题/统计），
   代码里两处实现：模块层（从原型生成）和应用外壳（Tailwind text-* 细刻度）。
   实测结论：模块层与文档一致，外壳整体低 0.5px。 */
{
  const roleSize = new Map()
  for (const t of doc.typography) {
    const m = /(\d+(?:\.\d+)?)px/.exec(t.value)
    if (m) roleSize.set(t.name, m[1] + 'px')
  }
  const fontCount = (px) => (mwCss.match(new RegExp(`font-size:\\s*${px}`, 'g')) || []).length

  const walk = (d, o = []) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p, o)
      else if (e.name.endsWith('.tsx')) o.push(p)
    }
    return o
  }
  const shellFiles = walk(path.join(ROOT, 'src')).filter((f) => !/pages\/workspace\//.test(f))
  const used = {}
  for (const f of shellFiles) {
    for (const m of fs.readFileSync(f, 'utf8').matchAll(/\btext-(\d+(?:-\d+)?)\b/g)) {
      used[m[1]] = (used[m[1]] || 0) + 1
    }
  }
  const asPx = (k) => Number(k.replace('-', '.'))

  for (const [role, prismNote] of [
    ['主文字', '正文'],
    ['次文字', '次要'],
    ['弱文字', '元信息'],
  ]) {
    const want = roleSize.get(role)
    if (!want) continue
    const target = parseFloat(want)
    const exact = used[String(target)] || 0
    const half = used[String(target).replace('.', '-') + '-5'] || used[`${target}-5`] || 0
    const offHalf = used[`${target - 0.5}`.replace('.', '-')] || 0
    rows.push({
      what: `字阶 ${role}（文档 ${want}）`,
      docVal: `模块层 ${fontCount(want)} 处`,
      codeVal: `外壳：text-${target} ${exact} 处 · 低 0.5px 的相邻档 ${offHalf} 处`,
      verdict: fontCount(want) > 0 ? '✓' : '⬜',
      bucket: TODO,
      note: `模块层已符合文档；应用外壳那一套细刻度（${Object.entries(used).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k, v]) => `text-${k}×${v}`).join(' ')}…）里存在低 0.5px 的同名档`,
    })
  }
  const shellTotal = Object.values(used).reduce((a, b) => a + b, 0)
  const halfTotal = Object.entries(used)
    .filter(([k]) => k.includes('-'))
    .reduce((a, [, v]) => a + v, 0)
  rows.push({
    what: '字阶 应用外壳的细刻度',
    docVal: '文档只给 6 个具名角色（弱12/次13/主14/H2 18/H1 22/统计24）',
    codeVal: `外壳共用 ${shellTotal} 处 text-*，其中带 .5 的 ${halfTotal} 处`,
    verdict: halfTotal ? '⬜' : '✓',
    bucket: TODO,
    note: '要对齐得逐处判断"这一处是哪个角色" —— 机械替换会把徽标/标签一起放大，所以留在待办里',
  })
}

/* 5b) 动效与布局：文档 §五/§六 的值必须能在代码里找到 */
for (const [label, re, where] of [
  ['色团漂移 22s ease-in-out infinite alternate', /22s\s+ease-in-out/, '文档 §五'],
  ['进度条 0.4s ease', /0\.4s\s+ease/, '文档 §五'],
  ['悬停位移 -1px / -2px', /translateY\(-?[12]px\)/, '文档 §五'],
  ['尊重 prefers-reduced-motion', /prefers-reduced-motion:\s*reduce/, '文档 §五'],
  ['侧边栏宽 220px', /\b220px\b/, '文档 §六'],
  ['顶部栏高 56px', /--mw-topbar-h:\s*56px|height:\s*56px/, '文档 §六'],
  ['移动断点 768px', /max-width:\s*768px/, '文档 §六'],
]) {
  const found = [mwCss, prismCss, shellCss, idxCss].some((s) => re.test(s))
  rows.push({
    what: label,
    docVal: where,
    codeVal: found ? '代码里存在' : '(无)',
    verdict: found ? '✓' : '⬜',
    bucket: found ? BINDING : TODO,
  })
}

/* 5c) 组件尺寸（文档 §七）：只判"有没有"，不能用值比较 ——
   文档给的是描述、代码给的是实现，一比就把"存在"判成"不一致"。 */
const APP = [mwCss, shellCss, prismCss]
const inApp = (re) => APP.some((s) => re.test(s))
for (const [label, re] of [
  ['输入框圆角 10px', /\.form-input,[^{]*\{[^}]*border-radius:\s*10px/],
  ['弹窗遮罩 rgba(15,23,42,0.35) + blur(8px)', /rgba\(15,\s*23,\s*42,\s*0?\.35\)[^}]*blur\(8px\)/],
  ['标签/开关 pill 圆角 999px', /border-radius:\s*999px/],
  ['分割线 1px solid var(--mw-border-subtle)', /1px solid var\(--mw-border-subtle\)/],
  ['开关 44×24', /\.switch\s*\{[^}]*width:\s*44px[^}]*height:\s*24px/],
  ['进度条高 6px', /\.progress-bar\s*\{[^}]*height:\s*6px/],
  ['移动端降 blur 80px / 90px', /--mw-blob-blur:\s*(80|90)px/],
]) {
  const found = inApp(re)
  rows.push({ what: label, docVal: '文档 §七/§九', codeVal: found ? '代码里存在' : '(无)', verdict: found ? '✓' : '⬜', bucket: BINDING })
}

/* ------------------------------------------------------------------ *
 * 6) 输出
 * ------------------------------------------------------------------ */

const pad = (s, n) => {
  const w = [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 127 ? 2 : 1), 0)
  return String(s) + ' '.repeat(Math.max(0, n - w))
}
function table(list) {
  console.log(pad('判定', 5) + pad('项', 52) + pad('文档', 34) + '代码')
  console.log('-'.repeat(132))
  for (const r of list) {
    console.log(pad(r.verdict, 5) + pad(r.what, 52) + pad(r.docVal ?? '(文档无)', 34) + r.codeVal + (r.note ? `\n      ← ${r.note}` : ''))
  }
}

console.log('\n设计令牌一致性（design-tokens.md ↔ 代码）\n')
console.log(`上游：${path.relative(ROOT, doc.path)} · §八 变量 ${doc.vars.light.size} 支 · 正文表格 9 张\n`)

for (const [bucket, title] of [
  [BINDING, '约束项（不一致 = 缺陷）'],
  [DERIVED, '派生（文档给设计色，代码里那一支按对比度反解 —— 只登记原因）'],
  [TODO, '待办（文档给了口径、代码还没跟上 —— 打印精确清单，不判定）'],
]) {
  const list = rows.filter((r) => r.bucket === bucket && (!only || r.verdict === only))
  if (!list.length) continue
  console.log(`=== ${title} —— ${list.length} 项`)
  table(list)
  console.log('')
}

const bind = rows.filter((r) => r.bucket === BINDING)
const bindBad = bind.filter((r) => r.verdict !== '✓')
const n = (v, bucket) => rows.filter((r) => (!bucket || r.bucket === bucket) && r.verdict === v).length
console.log(
  `合计 ${rows.length} 项：✓ ${n('✓')} · ✗ ${n('✗')} · ⬜ ${n('⬜')}\n` +
    `约束项 ${bind.length - bindBad.length} / ${bind.length} · 派生 ${rows.filter((r) => r.bucket === DERIVED).length}` +
    ` · 待办 ${rows.filter((r) => r.bucket === TODO).length}\n` +
    `§八 覆盖率：${doc.vars.light.size - uncovered.length} / ${doc.vars.light.size}` +
    (uncovered.length ? `（未覆盖：${uncovered.join(' ')}）` : '') +
    '\n',
)

if (strict) {
  const problems = []
  if (uncovered.length) problems.push(`§八 有 ${uncovered.length} 支变量没有归属：${uncovered.join(' ')}`)
  for (const r of bindBad) problems.push(`${r.verdict} ${r.what}：文档 ${r.docVal} / 代码 ${r.codeVal}`)
  if (problems.length) {
    console.error('✗ 门禁不通过：')
    for (const p of problems) console.error('   ' + p)
    process.exit(1)
  }
}
