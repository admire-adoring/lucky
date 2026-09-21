#!/usr/bin/env node
/* ============================================================================
   设计令牌一致性门禁：`design/design-tokens/design-tokens.md` ↔ 代码里的实际取值。
   ----------------------------------------------------------------------------
   为什么需要它：这份文档是**新外壳的令牌规范**，而代码里同时存在三套东西 ——
     ① `--mw-*`（模块工作区层，从 8 个原型生成）
     ② Prism（`--s-*` / `--r-*` / `--t-*` / `--dur-*` / `--g-*`，工作台那条链路）
     ③ Tailwind `@theme`（`index.css`）
   "文档写 14px、代码是 13.5px" 这种漂移**不报错**，只会让两页"差一点点"。
   所以逐项比出来，不靠人记。

   ## 判定分三类（判据都实测过，不是分类癖）

   | 类别 | 含义 | 现在有哪些 |
   | --- | --- | --- |
   | **约束项** | 文档与代码必须一致；不一致就是缺陷 | 模块色（9×2×4）、中性/毛玻璃（14×2）、Prism 的 `--s-*`、组件尺寸 |
   | **遗留刻度** | 文档规范的是新外壳，Prism 那套刻度与它**不是同一个东西** | `--t-*`（全仓库零引用，只有定义）、`--r-*`/`--dur-*`（只有 prism.css 内部用，命名也是另一套）、状态色（Prism 按实测底衬反解，是硬约束） |
   | **未实现** | 文档有、代码里确实没有 | AI 令牌（工作台原型的 `.ai-*` 块尚未移植） |

   ⚠️ "遗留刻度"只报告、不判定：要改是一次**口径选择**（谁是谁的事实源），
      不该由门禁替人决定。它的价值是把差多少条摆出来。

   用法：
     node design/check-design-tokens.mjs              # 打印全部
     node design/check-design-tokens.mjs --strict     # 有约束项不一致则退出码 1（门禁用）
     node design/check-design-tokens.mjs --only=✗     # 只看某一类判定
   ========================================================================= */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const DOC = path.join(ROOT, 'design/design-tokens/design-tokens.md')

const argv = process.argv.slice(2)
const only = (argv.find((a) => a.startsWith('--only=')) || '').slice(7)
const strict = argv.includes('--strict')

const BINDING = 'binding'
const LEGACY = 'legacy'
const GAP = 'gap'

/* ------------------------------------------------------------------ *
 * 1) 读文档
 * ------------------------------------------------------------------ */

const doc = fs.readFileSync(DOC, 'utf8')

/** 从 ```css 变量汇总块里取 :root / .dark 两张表。 */
function docVars() {
  const fence = /```css\n([\s\S]*?)```/.exec(doc)
  if (!fence) throw new Error('文档里找不到 ```css 变量汇总块')
  const css = fence[1]
  const out = { light: new Map(), dark: new Map() }
  for (const [sel, key] of [
    [':root', 'light'],
    ['.dark', 'dark'],
  ]) {
    const m = new RegExp(`\\${sel}\\s*\\{([\\s\\S]*?)\\n\\}`, 'm').exec(css)
    if (!m) throw new Error(`文档的 CSS 块里找不到 ${sel}`)
    for (const line of m[1].split('\n')) {
      const text = line.replace(/\/\*[\s\S]*?\*\//g, '')
      for (const decl of text.split(';')) {
        const i = decl.indexOf(':')
        if (i < 0) continue
        const name = decl.slice(0, i).trim()
        if (name.startsWith('--')) out[key].set(name, decl.slice(i + 1).trim())
      }
    }
  }
  return out
}

/** §1/§2 两张模块色表，按侧栏顺序映射到模块键。 */
const MODULE_ORDER = ['dashboard', 'tasks', 'calendar', 'life', 'work', 'learning', 'projects', 'knowledge', 'settings']

function docModules() {
  const rows = [
    ...doc.matchAll(
      /^\| (?!模块|---)([^|]+) \| (`#[0-9A-Fa-f]{6}`) \| (`#[0-9A-Fa-f]{6}`) \| (`#[0-9A-Fa-f]{6}`) \| (`#[0-9A-Fa-f]{6}`) \|$/gm,
    ),
  ]
  if (rows.length !== 18) throw new Error(`期望 18 行模块色（9 模块 × 2 模式），实际 ${rows.length}`)
  const clean = (s) => s.replace(/`/g, '').toUpperCase()
  const out = {}
  MODULE_ORDER.forEach((key, i) => {
    out[key] = {
      light: { rings: [rows[i][2], rows[i][3], rows[i][4]].map(clean), accent: clean(rows[i][5]) },
      dark: { rings: [rows[i + 9][2], rows[i + 9][3], rows[i + 9][4]].map(clean), accent: clean(rows[i + 9][5]) },
    }
  })
  return out
}

const DV = docVars()
const DM = docModules()

/* ------------------------------------------------------------------ *
 * 2) 读代码
 * ------------------------------------------------------------------ */

const mwCss = fs.readFileSync(path.join(ROOT, 'src/styles/module-workspace.css'), 'utf8')
const prismCss = fs.readFileSync(path.join(ROOT, 'src/styles/prism.css'), 'utf8')
const idxCss = fs.readFileSync(path.join(ROOT, 'src/styles/index.css'), 'utf8')

/** 壳令牌：作用域已提到 <html>（工作台要读同一份材质）。 */
function mwShell(scope) {
  const sel = scope === 'light' ? `html:not([data-theme='dark']) {` : `html[data-theme='dark'] {`
  const i = mwCss.indexOf(sel)
  if (i < 0) throw new Error(`module-workspace.css 里找不到壳令牌块：${sel}`)
  const body = mwCss.slice(i + sel.length, mwCss.indexOf('\n}', i))
  const out = new Map()
  for (const d of body.split(';')) {
    const c = d.indexOf(':')
    if (c < 0) continue
    const n = d.slice(0, c).trim()
    if (n.startsWith('--')) out.set(n, d.slice(c + 1).trim())
  }
  return out
}

/** 模块色槽：`--mw-s-<key>` / `--mw-a-<key>-<n>`，两个主题各一张。 */
function mwModules(scope) {
  const re =
    scope === 'light'
      ? /html\[data-theme='light'\] \.mw-root,\n\.mw-root \{([\s\S]*?)\n\}/
      : /html\[data-theme='dark'\] \.mw-root \{([\s\S]*?)\n\}/
  const m = re.exec(mwCss)
  if (!m) throw new Error(`找不到 ${scope} 的模块色块`)
  const out = new Map()
  for (const d of m[1].split(';')) {
    const c = d.indexOf(':')
    if (c < 0) continue
    const n = d.slice(0, c).trim()
    if (n.startsWith('--')) out.set(n, d.slice(c + 1).trim())
  }
  return out
}

function prismVars() {
  const out = new Map()
  for (const m of prismCss.matchAll(/^\s*(--[\w-]+)\s*:\s*([^;]+);/gm)) if (!out.has(m[1])) out.set(m[1], m[2].trim())
  return out
}

const MW = { light: mwShell('light'), dark: mwShell('dark') }
const MWA = { light: mwModules('light'), dark: mwModules('dark') }
const PZ = prismVars()

/* ------------------------------------------------------------------ *
 * 3) 比对
 * ------------------------------------------------------------------ */

const rows = []
const add = (what, docVal, codeVal, bucket = BINDING, note = '') => {
  const verdict = codeVal === undefined ? '⬜' : docVal === codeVal ? '✓' : '✗'
  rows.push({ what, docVal, codeVal: codeVal ?? '(无)', verdict, bucket, note })
}

const hexToTriplet = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(' ')

/* ---- 3a) 模块色（约束项）：与模块层 --mw，以及 Prism --s 都比一遍 ---- */
for (const key of MODULE_ORDER) {
  for (const scope of ['light', 'dark']) {
    const d = DM[key][scope]
    for (let n = 1; n <= 3; n++) add(`模块色 ${scope} ${key} 色团${n}`, d.rings[n - 1], MWA[scope].get(`--mw-a-${key}-${n}`))
    add(`模块色 ${scope} ${key} 强调色`, d.accent, MWA[scope].get(`--mw-s-${key}`))
  }
  add(`Prism --s-${key}（= 亮色强调色的三元组）`, hexToTriplet(DM[key].light.accent), PZ.get(`--s-${key}`))
}

/* ---- 3b) 中性／毛玻璃（约束项）：文档名 → --mw-<同名> ---- */
for (const name of [
  'bg-page',
  'bg-card',
  'bg-sidebar',
  'bg-topbar',
  'border-card',
  'border-subtle',
  'text-primary',
  'text-secondary',
  'text-muted',
  'shadow-card',
  'shadow-card-hover',
  'blur-card',
  'blob-opacity',
  'blob-blur',
]) {
  for (const scope of ['light', 'dark']) {
    add(`中性 ${scope} ${name}`, DV[scope].get(`--${name}`), MW[scope].get(`--mw-${name}`))
  }
}

/* ---- 3c) 状态色（遗留刻度） ---- */
for (const [docName, prismName] of Object.entries({ success: 'ok', warning: 'warn', error: 'bad', info: 'info' })) {
  add(
    `状态色 ${docName} ↔ Prism --${prismName}`,
    DV.light.get(`--c-${docName}`),
    PZ.get(`--${prismName}`),
    LEGACY,
    'Prism 的语义色按实测底衬反解，是硬约束；文档那组直接当文字会掉对比度',
  )
}

/* ---- 3d) 圆角 / 动效（遗留刻度）---- */
for (const r of ['sm', 'md', 'lg', 'xl', 'pill']) {
  add(`圆角 --radius-${r}`, DV.light.get(`--radius-${r}`), PZ.get(`--r-${r}`), LEGACY, 'Prism 是另一套命名（xs/sm/ctl/panel/card）')
}
for (const [docKey, prismKey] of [
  ['fast', '--dur-fast'],
  ['base', '--dur'],
  ['slow', '--dur-slow'],
]) {
  add(`动效 --transition-${docKey}`, DV.light.get(`--transition-${docKey}`), PZ.get(prismKey), LEGACY, '只有 prism.css 内部消费')
}

/* ---- 3e) 字阶（遗留刻度）：文档在 §四的正文表格里 ---- */
const typeScale = (() => {
  const m = /## 四、字体与间距令牌([\s\S]*?)\n## /.exec(doc)
  if (!m) throw new Error('文档里找不到 §四')
  const out = new Map()
  for (const r of m[1].matchAll(/^\| ([^|]+) \| ([^|]+) \|$/gm)) {
    const px = /(\d+(?:\.\d+)?)px/.exec(r[2])
    if (px) out.set(r[1].trim(), px[1] + 'px')
  }
  return out
})()
for (const [label, prismKey] of [
  ['主文字', '--t-base'],
  ['次文字', '--t-sm'],
  ['弱文字', '--t-meta'],
  ['标题 H1', '--t-2xl'],
  ['标题 H2', '--t-xl'],
  ['卡片标题', '--t-xs'],
  ['统计数字', '--t-2xl'],
]) {
  add(
    `字阶 ${label} ↔ Prism ${prismKey}`,
    typeScale.get(label),
    PZ.get(prismKey),
    LEGACY,
    'Prism 的 --t-* 全仓库零引用（只有定义），实际字阶走 Tailwind @theme 的细刻度',
  )
}

/* ---- 3f) AI 令牌（未实现）---- */
const appCss = mwCss + prismCss + idxCss
add('AI 图标 #8B5CF6', '#8B5CF6', appCss.toUpperCase().includes('#8B5CF6') ? '#8B5CF6' : undefined, GAP, '工作台原型的 .ai-* 块尚未移植')
add('AI 渐变 #6366F1→#8B5CF6→#A855F7', 'linear-gradient(135deg,…)', appCss.includes('#A855F7') ? 'linear-gradient(135deg,…)' : undefined, GAP, '同上')
add('AI 边框 rgba(139,92,246,0.3)', 'rgba(139,92,246,0.3)', /139\s*,\s*92\s*,\s*246/.test(appCss) ? 'rgba(139,92,246,0.3)' : undefined, GAP, '同上')

/* ---- 3g) 组件尺寸（约束项）：查应用真正在用的 CSS，不查原型 ----
   ⚠️ 这类项"文档给的是描述、代码给的是实现"，判定只有**有没有**两种，
      不能用值比较 —— 那会把"存在"判成"不一致"（第一版就是这么错的）。
   ⚠️ 别要求 `.mw-root ` 前缀：非内核的规则会被收进 `[data-module='x']`
      （`.form-input` / `.switch` / `.progress-bar` 都是），带前缀就一条都匹配不到。 */
const shellCss = fs.readFileSync(path.join(ROOT, 'src/styles/workspace-shell.css'), 'utf8')
const inApp = (re) => re.test(mwCss) || re.test(shellCss)
const present = (what, where, ok, note = '') => {
  rows.push({
    what,
    docVal: where,
    codeVal: ok ? '代码里存在' : '(无)',
    verdict: ok ? '✓' : '⬜',
    bucket: BINDING,
    note,
  })
}
present('输入框圆角 10px', '文档 §七', inApp(/\.form-input,[^{]*\{[^}]*border-radius:\s*10px/))
present('弹窗遮罩 rgba(15,23,42,0.35) + blur(8px)', '文档 §七', inApp(/rgba\(15,23,42,0\.35\)[^}]*blur\(8px\)/))
present('标签/开关 pill 圆角 999px', '文档 §七', inApp(/border-radius:\s*999px/))
present('分割线 1px solid var(--mw-border-subtle)', '文档 §七', inApp(/1px solid var\(--mw-border-subtle\)/))
present('开关 44×24', '文档 §七', inApp(/\.switch\s*\{[^}]*width:\s*44px[^}]*height:\s*24px/))
present('进度条高 6px', '文档 §七', inApp(/\.progress-bar\s*\{[^}]*height:\s*6px/))
present(
  '移动端降 blur（80px / 90px）',
  '文档 §九',
  inApp(/--mw-blob-blur:\s*(80|90)px/),
  '原型里没有这条分断点覆盖，属于应用级补充',
)

/* ------------------------------------------------------------------ *
 * 4) 输出
 * ------------------------------------------------------------------ */

const pad = (s, n) => {
  const w = [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 127 ? 2 : 1), 0)
  return String(s) + ' '.repeat(Math.max(0, n - w))
}
const table = (list) => {
  console.log(pad('判定', 6) + pad('令牌', 46) + pad('文档', 30) + '代码')
  console.log('-'.repeat(120))
  for (const r of list) {
    console.log(
      pad(r.verdict, 6) + pad(r.what, 46) + pad(r.docVal ?? '(文档无)', 30) + r.codeVal + (r.note ? `   ← ${r.note}` : ''),
    )
  }
}

console.log('\n设计令牌一致性（design-tokens.md ↔ 代码）\n')
for (const [bucket, title] of [
  [BINDING, '约束项（不一致 = 缺陷）'],
  [LEGACY, '遗留刻度（Prism 那套，只报告、不判定）'],
  [GAP, '未实现（文档有、代码没有）'],
]) {
  const list = rows.filter((r) => r.bucket === bucket && (!only || r.verdict === only))
  if (!list.length) continue
  console.log(`=== ${title} —— ${list.length} 项`)
  table(list)
  console.log('')
}

const n = (v, bucket) => rows.filter((r) => r.verdict === v && (!bucket || r.bucket === bucket)).length
const bindBad = rows.filter((r) => r.bucket === BINDING && r.verdict !== '✓')
console.log(
  `合计 ${rows.length} 项：✓ ${n('✓')} · ✗ ${n('✗')} · ⬜ ${n('⬜')}\n` +
    `其中**约束项**：✓ ${rows.filter((r) => r.bucket === BINDING).length - bindBad.length} / ${rows.filter((r) => r.bucket === BINDING).length}` +
    ` · 遗留刻度 ${rows.filter((r) => r.bucket === LEGACY).length} 项 · 未实现 ${rows.filter((r) => r.bucket === GAP).length} 项\n`,
)

if (strict && bindBad.length) {
  console.error(`✗ 约束项里有 ${bindBad.length} 项与文档不一致：`)
  for (const r of bindBad) console.error(`   ${r.verdict} ${r.what}：文档 ${r.docVal} / 代码 ${r.codeVal}`)
  process.exit(1)
}
