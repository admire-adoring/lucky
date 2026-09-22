#!/usr/bin/env node
/* ============================================================================
   模块色表：**唯一事实源 = `design/design-tokens/design-tokens.md`**，
   由本脚本同步进两份代码侧落点。
   ----------------------------------------------------------------------------
   **为什么要这一步**：应用里同一个模块名曾经有**两套完全不同的颜色** ——
     工作台（Prism）任务清单是粉 `250 59 138`，模块页（原型）任务清单是琥珀 `#F59E0B`。
   于是「在环上点任务清单 → 整页变粉 → 进去是琥珀」，中间断了一刀。

   现在文档是唯一上游。从文档取四样原值（其余六支由 prism-derive-colors.mjs 反解）：
     ① 亮色强调色  --s-<模块>          ← §一/§八  `.light.accent`
     ② 亮色色团    --a-<模块>-1/2/3    ← §一/§八  `.light.rings`
     ③ 暗色色团    --a-<模块>-1/2/3    ← §二/§八  `.dark.rings`
     ④ 暗色强调色  --s-<模块>          ← §二/§八  `.dark.accent`（只用于漂移核对）

   ⚠️ 为什么不再读 9 个原型（本脚本上一版就是这么做的）：
      文档与原型是同一个色表的两次誊写，读哪个都能出对结果，但**只能有一个上游**。
      原型是"文档的一种渲染"，不该反过来当事实源 —— 否则文档改了、原型没改，
      代码就跟着旧的原型走，而文档变成一张没人执行的纸。
      本脚本另出一份「原型 vs 文档」的漂移报告，把这件事摆到明面上。

   ⚠️ 为什么不把 9 行数字手抄进 prism-derive-colors.mjs：
      那正是这套机制要修的病 —— 同一份原值存在两处、各自演化。
      抄一次就一定会漂，而漂掉之后的症状是"某一页颜色不对"这种最难定位的观感问题。

   用法：
     node design/sync-module-colors.mjs            # 打印抽取结果 + 原型漂移报告
     node design/sync-module-colors.mjs --write    # 写回两份落点
     node design/sync-module-colors.mjs --check    # 校验两份落点与文档一致（门禁）
   ========================================================================= */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesignTokens, MODULE_ORDER, DOC_PATH } from './lib/design-tokens-doc.mjs'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.resolve(DIR, '..')

/* ------------------------------------------------------------------ *
 * 1) 原型清单 —— 只用于「原型是否跟得上文档」的漂移报告，**不再是事实源**
 * ------------------------------------------------------------------ */

/** 键 → 原型文件。dashboard 是工作台原型自己（环的中心那一格）。 */
const PROTOTYPES = {
  dashboard: 'workbench/workbench_index.html',
  tasks: 'task/task_index.html',
  calendar: 'candle/candle_index.html',
  life: 'life/life_index.html',
  work: 'work/work_index.html',
  learning: 'study/study_index.html',
  projects: 'project/project_index.html',
  knowledge: 'know/knowledge_index.html',
  settings: 'setting/setting_index.html',
}

/**
 * 色系名（写进 prism.css 的注释与规范文档的表）。
 *
 * ⚠️ 这是**编辑性**字段，不可推导，所以必须在这里显式列出 —— 少一个键就直接报错，
 *    而不是悄悄回落到"未命名"。名字换了是因为色表换了：原来的「薄荷蜜语」描述的
 *    是旧的粉绿那套，现在这一套按色相自称，读文档的人不会认错。
 */
const NAMES = {
  dashboard: '靛蓝',
  tasks: '琥珀',
  calendar: '天青',
  life: '翡翠',
  work: '玫瑰',
  learning: '洋红',
  projects: '橘橙',
  knowledge: '青碧',
  settings: '石板',
}

/* ------------------------------------------------------------------ *
 * 2) 从**文档**取原值（唯一上游）
 *
 * ⚠️ 辅助函数必须排在 `harvest()` 调用之前：`hexToRgb` 是 `const` 箭头函数，
 *    不提升。放在后面会踩 TDZ（`Cannot access 'hexToRgb' before initialization`），
 *    而报错信息指向 toTriplet，看着像"值解析坏了"。
 * ------------------------------------------------------------------ */

const hexToRgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
const rgbToHex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')

/** 一支值既可能是 hex 也可能是 RGB 三元组 —— 统一成三元组，省得下游各解各的。 */
function toTriplet(value, where, name) {
  const v = value.trim()
  if (v.startsWith('#')) {
    if (!/^#[0-9a-fA-F]{6}$/.test(v)) throw new Error(`${where} 的 ${name} 不是 6 位 hex：${v}`)
    return { hex: v, rgb: hexToRgb(v) }
  }
  const parts = v.split(/\s+/).map(Number)
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n) || n < 0 || n > 255)) {
    throw new Error(`${where} 的 ${name} 既不是 hex 也不是 RGB 三元组：${v}`)
  }
  return { hex: rgbToHex(parts), rgb: parts }
}

function harvest() {
  const doc = readDesignTokens()
  const out = []
  const problems = []

  for (const key of MODULE_ORDER) {
    const L = doc.modules.light[key]
    const D = doc.modules.dark[key]
    if (!L || !D) {
      problems.push(`${key}: 文档里缺亮色或暗色模块色`)
      continue
    }
    if (!NAMES[key]) {
      problems.push(`${key}: NAMES 里没有色系名 —— 加模块时要显式取一个名字，不要回落成"未命名"`)
      continue
    }
    out.push({
      key,
      name: NAMES[key],
      s: toTriplet(L.accent, `doc §一 ${key}`, `--s-${key}`),
      ring: L.rings.map((v, i) => toTriplet(v, `doc §一 ${key}`, `--a-${key}-${i + 1}`)),
      dk: D.rings.map((v, i) => toTriplet(v, `doc §二 ${key}`, `--a-${key}-${i + 1}`)),
      sDark: toTriplet(D.accent, `doc §二 ${key}`, `--s-${key}`),
    })
  }
  if (out.length !== MODULE_ORDER.length) problems.push(`只抽到 ${out.length}/${MODULE_ORDER.length} 个模块`)
  for (const k of Object.keys(NAMES)) {
    if (!MODULE_ORDER.includes(k)) problems.push(`${k}: NAMES 里有、文档 §一 里没有 —— 文档删了模块？`)
  }
  if (problems.length) {
    console.error('✗ 从文档抽取色表失败：')
    for (const p of problems) console.error('   ' + p)
    process.exit(1)
  }
  return out
}

const MODULES = harvest()

/* ------------------------------------------------------------------ *
 * 2b) 原型漂移报告：原型是不是还跟得上文档
 *
 * 判据：**原型是文档的一种渲染，不是事实源**。所以漂移不阻断代码同步，
 * 但它意味着"打开原型看到的那一页已经不是文档描述的那一页"——
 * 这种静默偏差正是当初"工作台点任务清单变粉、进去是琥珀"的成因，
 * 所以必须打出来，只是不该由门禁替人决定要不要改原型。
 * ------------------------------------------------------------------ */

/** 取出 <style> 正文（原型都是单文件自包含）。 */
function styleOf(html) {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(html)
  if (!m) throw new Error('原型里没有 <style> 块')
  return m[1]
}

function prototypeDrift() {
  const rows = []
  for (const [key, file] of Object.entries(PROTOTYPES)) {
    const full = path.join(DIR, file)
    if (!fs.existsSync(full)) {
      rows.push({ key, file, note: '找不到文件' })
      continue
    }
    let css
    try {
      css = styleOf(fs.readFileSync(full, 'utf8'))
    } catch (e) {
      rows.push({ key, file, note: e.message })
      continue
    }
    const light = declsIn(css, ':root')
    const dark = declsIn(css, '.dark')
    const want = MODULES.find((m) => m.key === key)
    if (!want) continue
    const diffs = []
    const cmp = (label, got, expect) => {
      if (got === undefined) return diffs.push(`${label} 缺`)
      const g = toTriplet(got, `${file}`, label)
      if (g.hex.toLowerCase() !== expect.hex.toLowerCase()) diffs.push(`${label} ${g.hex} ≠ ${expect.hex}`)
    }
    cmp(`--s-${key}`, light.get(`--s-${key}`), want.s)
    want.ring.forEach((r, i) => cmp(`--a-${key}-${i + 1}`, light.get(`--a-${key}-${i + 1}`), r))
    want.dk.forEach((d, i) => cmp(`--a-${key}-${i + 1}(dark)`, dark.get(`--a-${key}-${i + 1}`), d))
    if (!dark.size) diffs.push('没有 .dark 块')
    rows.push({ key, file, diffs })
  }
  return rows
}

/**
 * 收集某个选择器下所有声明（同名后者覆盖前者）。
 *
 * 逐字符扫是因为**不能**用正则偷懒：原型里 `:root` 与 `.dark` 各有多条，
 * 且块内有嵌套的花括号（`@media` 之类）。正则的非贪婪匹配会在第一个 `}` 停下，
 * 于是暗色块只能读到一半 —— 那种错会表现成"暗色少了几支色团"，不报错。
 */
function declsIn(css, selector) {
  const out = new Map()
  let i = 0
  while (i < css.length) {
    // 跳到下一个 '{'，同时把选择器文本收出来
    const open = css.indexOf('{', i)
    if (open < 0) break
    const close = css.indexOf('}', open)
    if (close < 0) break
    const head = css.slice(i, open).replace(/\/\*[\s\S]*?\*\//g, '').trim()
    if (head.split(',').map((s) => s.trim()).includes(selector)) {
      for (const d of css.slice(open + 1, close).split(';')) {
        const c = d.indexOf(':')
        if (c < 0) continue
        const name = d.slice(0, c).trim()
        if (name.startsWith('--')) out.set(name, d.slice(c + 1).trim())
      }
    }
    i = close + 1
  }
  return out
}

/* ------------------------------------------------------------------ *
/* ------------------------------------------------------------------ *
 * 3) 落点的写法
 * ------------------------------------------------------------------ */

/** 打印时 hex 一律大写，与文档里的写法一致（文档 §一/§二 用的是大写）。 */
const up = (h) => h.toUpperCase()

/* ---- 3a) prism-derive-colors.mjs 的原值表 ---- */
const D_START = '/* @from-design-tokens:start */'
const D_END = '/* @from-design-tokens:end */'

function emitDeriveBlock() {
  const L = []
  L.push(D_START)
  L.push('/* ---------- 设计原值（**生成物**，不要手改）----------')
  L.push('   由 design/sync-module-colors.mjs 从**唯一事实源**抽取：')
  L.push('     design/design-tokens/design-tokens.md')
  L.push('     s      ← §一/§八 的 --s-<模块>（亮色强调色）')
  L.push('     ring   ← §一/§八 的 --a-<模块>-1/2/3（亮色色团）')
  L.push('     dk     ← §二/§八 的 --a-<模块>-1/2/3（暗色色团）')
  L.push('   改色只改那份文档，然后 `node design/sync-module-colors.mjs --write`。')
  L.push('   --check 会拦住"改了文档忘了同步"这种漂移。 */')
  L.push('const MODULES = [')
  for (const m of MODULES) {
    L.push(
      `  { key: '${m.key}', name: '${m.name}', ` +
        `s: [${m.s.rgb.join(', ')}], ` +
        `ring: [${m.ring.map((r) => `'${r.hex.toUpperCase()}'`).join(', ')}], ` +
        `dk: [${m.dk.map((d) => `[${d.rgb.join(', ')}]`).join(', ')}] },`,
    )
  }
  L.push(']')
  L.push(D_END)
  return L.join('\n')
}

/** 把 anchor 区间替换成 next；anchor 必须**恰好出现一次**，否则报错（不猜）。 */
function replaceRegion(src, start, end, next, label) {
  const a = src.indexOf(start)
  const b = src.indexOf(end)
  if (a < 0 || b < 0) throw new Error(`${label}: 找不到锚点区间`)
  if (src.split(start).length - 1 !== 1) throw new Error(`${label}: 起点锚点不唯一`)
  if (a > b) throw new Error(`${label}: 锚点顺序反了`)
  return src.slice(0, a) + next + src.slice(b + end.length)
}

const TARGETS = [
  {
    file: path.join(DIR, 'prism-derive-colors.mjs'),
    start: D_START,
    end: D_END,
    build: emitDeriveBlock,
    label: 'prism-derive-colors.mjs',
  },
]

const mode = process.argv[2] ?? '--report'

if (mode === '--check' || mode === '--write') {
  let bad = 0
  for (const t of TARGETS) {
    const src = fs.readFileSync(t.file, 'utf8')
    const next = replaceRegion(src, t.start, t.end, t.build(), t.label)
    if (next === src) {
      console.log(`✓ ${t.label} 与文档一致`)
      continue
    }
    if (mode === '--check') {
      console.error(`✗ ${t.label} 与文档不一致 —— 重跑：node design/sync-module-colors.mjs --write`)
      bad++
    } else {
      fs.writeFileSync(t.file, next)
      console.log(`✓ 已写入 ${t.label}`)
    }
  }
  if (bad) process.exit(1)
  process.exit(0)
}

/* 默认：打印抽取结果 */
{
  const pad = (s, n) => String(s).padEnd(n, ' ')
  console.log('\n模块色表 · 上游：design/design-tokens/design-tokens.md\n')
  console.log(pad('键', 11) + pad('色系', 10) + pad('强调色', 18) + pad('亮色团', 34) + '暗色团')
  console.log('-'.repeat(112))
  for (const m of MODULES) {
    console.log(
      pad(m.key, 11) +
        pad(m.name, 10) +
        pad(m.s.hex.toUpperCase(), 18) +
        pad(m.ring.map((r) => up(r.hex)).join(' '), 34) +
        m.dk.map((d) => up(d.hex)).join(' '),
    )
  }
  console.log(`\n共 ${MODULES.length} 套 · 加 --write 写回落点\n`)

  const drift = prototypeDrift()
  const off = drift.filter((r) => r.note || (r.diffs && r.diffs.length))
  if (!off.length) console.log('✓ 9 个原型与文档一致（原型是文档的一种渲染）')
  else {
    console.log('⚠️ 原型与文档的漂移 —— 原型是文档的一种渲染，不是事实源，所以这**不阻断**代码：')
    for (const r of off) console.log('   ' + String(r.key).padEnd(10) + (r.note ?? r.diffs.join(' · ')))
    console.log('   （要让原型重新等于文档，改原型；代码这边已经按文档走了）')
  }
}
