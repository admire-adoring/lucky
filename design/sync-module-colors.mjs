#!/usr/bin/env node
/* ============================================================================
   把「9 个原型」里的模块色表抽出来，同步进 Prism 的两份落点。
   ----------------------------------------------------------------------------
   **为什么要这一步**：应用里同一个模块名有**两套完全不同的颜色** ——
     工作台（Prism）任务清单是粉 `250 59 138`，模块页（原型）任务清单是琥珀 `#F59E0B`。
   于是「在环上点任务清单 → 整页变粉 → 进去是琥珀」，中间断了一刀。
   事实源应该是**原型**（模块页已经按它落地了），所以改 Prism 去对齐它，不是反过来。

   两样原值就够了，其余六支由 prism-derive-colors.mjs 反解（它自己的头注释写着这条）：
     ① 强调色  --s-<模块>          ← 原型 :root 的 --s-<模块>
     ② 亮色色团 --a-<模块>-1/2/3    ← 原型 :root 的 --a-<模块>-1/2/3
   另外取原型 `.dark` 里的 --a-<模块>-1/2/3 当**暗色色团**：
   原型的暗色弥散就是拿它们铺的（`--m1/2/3` 指向它们，`--blob-opacity` 0.26）。

   ⚠️ 为什么不把 9 行数字手抄进 prism-derive-colors.mjs：
      这正是本次要修的病 —— 同一份"设计原值"存在两处、各自演化。
      抄一次就一定会漂，而漂掉之后的症状是"某一页颜色不对"这种最难定位的观感问题。
      所以原值表由本脚本**每次覆盖**地写，并且有 --check 门禁。

   用法：
     node design/sync-module-colors.mjs            # 打印抽取结果
     node design/sync-module-colors.mjs --write    # 写回两份落点
     node design/sync-module-colors.mjs --check    # 校验两份落点与原型一致（门禁）
   ========================================================================= */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.resolve(DIR, '..')

/* ------------------------------------------------------------------ *
 * 1) 原型清单：键名 = Prism 的模块键（也是 data-series / data-module 的值）
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
 * 2) 从原型里取原值
 * ------------------------------------------------------------------ */

/** 取出 <style> 正文（原型都是单文件自包含）。 */
function styleOf(html) {
  const m = /<style[^>]*>([\s\S]*?)<\/style>/.exec(html)
  if (!m) throw new Error('原型里没有 <style> 块')
  return m[1]
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
  const out = []
  const problems = []
  for (const [key, file] of Object.entries(PROTOTYPES)) {
    const full = path.join(DIR, file)
    if (!fs.existsSync(full)) {
      problems.push(`${key}: 找不到原型 ${file}`)
      continue
    }
    const css = styleOf(fs.readFileSync(full, 'utf8'))
    const light = declsIn(css, ':root')
    const dark = declsIn(css, '.dark')
    if (!dark.size) problems.push(`${key}: 原型里没有 .dark 块（暗色色团取不到）`)

    const need = (map, name, scope) => {
      const v = map.get(name)
      if (v === undefined) problems.push(`${key}: ${scope} 里没有 ${name}`)
      return v
    }
    const sLight = need(light, `--s-${key}`, ':root')
    const aLight = [1, 2, 3].map((i) => need(light, `--a-${key}-${i}`, ':root'))
    const aDark = [1, 2, 3].map((i) => need(dark, `--a-${key}-${i}`, '.dark'))
    if ([sLight, ...aLight, ...aDark].some((v) => v === undefined)) continue

    out.push({
      key,
      name: NAMES[key],
      file,
      s: toTriplet(sLight, `${key} :root`, `--s-${key}`),
      ring: aLight.map((v, i) => toTriplet(v, `${key} :root`, `--a-${key}-${i + 1}`)),
      dk: aDark.map((v, i) => toTriplet(v, `${key} .dark`, `--a-${key}-${i + 1}`)),
    })
  }
  for (const k of Object.keys(NAMES)) {
    if (!out.some((m) => m.key === k)) problems.push(`${k}: 没有抽到（色系名有、原型没有？）`)
    else if (!NAMES[k]) problems.push(`${k}: NAMES 里没有色系名 —— 加模块时要显式取一个名字，不要回落成"未命名"`)
  }
  if (problems.length) {
    console.error('✗ 抽取原型色表失败：')
    for (const p of problems) console.error('   ' + p)
    process.exit(1)
  }
  return out
}

/* ------------------------------------------------------------------ *
 * 3) 两份落点的写法
 * ------------------------------------------------------------------ */

const MODULES = harvest()

/* ---- 3a) prism-derive-colors.mjs 的原值表 ---- */
const D_START = '/* @from-prototypes:start */'
const D_END = '/* @from-prototypes:end */'

function emitDeriveBlock() {
  const L = []
  L.push(D_START)
  L.push('/* ---------- 设计原值（**生成物**，不要手改）----------')
  L.push('   由 design/sync-module-colors.mjs 从 9 个原型抽取：')
  L.push('     s      ← 原型 :root 的 --s-<模块>')
  L.push('     ring   ← 原型 :root 的 --a-<模块>-1/2/3（亮色色团）')
  L.push('     dk     ← 原型 .dark 的 --a-<模块>-1/2/3（暗色色团，原型的暗色弥散就用它们铺）')
  L.push('   改色只改原型，然后 `node design/sync-module-colors.mjs --write`。')
  L.push('   --check 会拦住"改了原型忘了同步"和"两边各自演化"这两种漂移。 */')
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

/* ---- 3b) DESIGN_TOKENS.md §2.7 的两张表 ---- */
const M_START = '<!-- @from-prototypes:start -->'
const M_END = '<!-- @from-prototypes:end -->'

/** 表格里 hex 一律大写，与规范文档其余部分一致 */
const up = (h) => h.toUpperCase()

function emitDocTables() {
  const L = []
  L.push(M_START)
  L.push('')
  L.push('两样原值：亮色色团 `--a-<模块>-1/2/3`（hex）与强调色 `--s-<模块>` —— 其余六支由 `prism-derive-colors.mjs` 反解：')
  L.push('')
  L.push('| 色系 | 键 | 色团1 | 色团2 | 色团3 | 强调色 `--s-*` | 原型 |')
  L.push('|---|---|---|---|---|---|---|')
  for (const m of MODULES) {
    L.push(
      `| ${m.name} | \`${m.key}\` | \`${up(m.ring[0].hex)}\` | \`${up(m.ring[1].hex)}\` | ` +
        `\`${up(m.ring[2].hex)}\` | \`${m.s.rgb.join(' ')}\` | \`design/${m.file}\` |`,
    )
  }
  L.push('')
  L.push('暗色色团（`--m-dk-1/2/3`，RGB 三元组）—— 取原型 `.dark` 的色团，原型的暗色弥散就用它们铺：')
  L.push('')
  L.push('| 模块 | 色团1 | 色团2 | 色团3 |')
  L.push('|---|---|---|---|')
  for (const m of MODULES) {
    L.push(`| \`${m.key}\` | \`${m.dk[0].rgb.join(' ')}\` | \`${m.dk[1].rgb.join(' ')}\` | \`${m.dk[2].rgb.join(' ')}\` |`)
  }
  L.push('')
  L.push(M_END)
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
  {
    file: path.join(DIR, 'DESIGN_TOKENS.md'),
    start: M_START,
    end: M_END,
    build: emitDocTables,
    label: 'DESIGN_TOKENS.md',
  },
]

const mode = process.argv[2] ?? '--report'

if (mode === '--check' || mode === '--write') {
  let bad = 0
  for (const t of TARGETS) {
    const src = fs.readFileSync(t.file, 'utf8')
    const next = replaceRegion(src, t.start, t.end, t.build(), t.label)
    if (next === src) {
      console.log(`✓ ${t.label} 与原型一致`)
      continue
    }
    if (mode === '--check') {
      console.error(`✗ ${t.label} 与原型不一致 —— 重跑：node design/sync-module-colors.mjs --write`)
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
  console.log('\n模块色表 · 从原型抽取\n')
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
  console.log(`\n共 ${MODULES.length} 套 · 原型清单见 PROTOTYPES · 加 --write 写回两份落点\n`)
}
