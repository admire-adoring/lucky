#!/usr/bin/env node
/* ============================================================================
   设计令牌文档的解析器：`design/design-tokens/design-tokens.md` → 结构化模型。

   为什么单独成一个 lib：这份文档是**唯一事实源**，而下游有三个消费者
     · `sync-module-colors.mjs`  —— 取九组模块色（原本读的是 9 个原型）
     · `sync-design-tokens.mjs`  —— 取「代码里还没有」的那 13 个令牌
     · `check-design-tokens.mjs` —— 反向核对代码是否跟得上
   三个脚本各写一遍解析 = 三处对"文档长什么样"的假设，改一处漏两处。
   所以解析只有这一份。

   ## 解析什么

   文档有两类结构，都要取：
     ① §八 的 ```css 汇总块 —— **机器可读的权威值**（`:root` 亮 / `.dark` 暗）
     ② §一~§九 的正文表格 —— 同一批值的**人类可读表述**（含汇总块没有的项，
        如字阶、间距、动效、布局、组件尺寸）

   ② 不是①的重复：§八 只收"能写成一支变量的东西"，字阶/间距/布局只在表里。
   但两者**有重叠**，而重叠部分必须一致 —— 这一步会断言（见 `assertSelfConsistent`）。
   文档自己前后打架的话，任何下游都无从对齐，所以宁可在这里就炸掉。

   ## 归一化

   比较前一律归一：去反引号、压空白、颜色转大写。
   ⚠️ 不做"近似相等"：`0.1` vs `0.10` 这种也用字符串比，因为文档里同一支
      变量出现两次时写法本来就一致；不一致就说明真的改了。
   ========================================================================= */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REPO = path.resolve(HERE, '../..')
export const DOC_PATH = path.join(REPO, 'design/design-tokens/design-tokens.md')

/** 文档里的九个模块，**顺序即文档里两张表的行序**。 */
export const MODULE_ORDER = [
  'dashboard',
  'tasks',
  'calendar',
  'life',
  'work',
  'learning',
  'projects',
  'knowledge',
  'settings',
]

/** 文档用的中文模块名 → 键。用于把 §八 的注释与 §一 的表头对上。 */
export const MODULE_LABEL = {
  dashboard: '工作台',
  tasks: '任务清单',
  calendar: '日程',
  life: '生活',
  work: '工作',
  learning: '学习',
  projects: '项目',
  knowledge: '知识库',
  settings: '设置',
}

const norm = (s) =>
  String(s)
    .replace(/`/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/^'(.*)'$/, '$1')

/* ------------------------------------------------------------------ *
 * 段落切分
 * ------------------------------------------------------------------ */

function sections(src) {
  const out = new Map()
  const parts = src.split(/^## /m)
  for (const part of parts.slice(1)) {
    const nl = part.indexOf('\n')
    out.set(part.slice(0, nl).trim(), part.slice(nl + 1))
  }
  return out
}

/** 把一段里的 markdown 表格全取出来（跳过分隔行）。 */
function tables(text) {
  const out = []
  let cur = null
  for (const raw of text.split('\n')) {
    const line = raw.trim()
    if (!line.startsWith('|')) {
      if (cur) out.push(cur)
      cur = null
      continue
    }
    const cells = line
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim())
    if (cells.every((c) => /^-{2,}$/.test(c))) continue // |---|---|
    if (!cur) cur = { headers: cells, rows: [] }
    else cur.rows.push(cells)
  }
  if (cur) out.push(cur)
  return out
}

/* ------------------------------------------------------------------ *
 * §八 的 CSS 汇总块
 * ------------------------------------------------------------------ */

/** 取 ```css 围栏里的内容。文档里只有一个围栏。 */
function cssFence(src) {
  const m = /```css\n([\s\S]*?)```/.exec(src)
  if (!m) throw new Error('文档里找不到 ```css 变量汇总块')
  return m[1]
}

/** 把 `sel { … }` 里的声明拆出来；支持一行多条声明。 */
function blockVars(css, selector) {
  const i = css.indexOf(selector)
  if (i < 0) throw new Error(`文档 §八 里找不到 ${selector}`)
  const open = css.indexOf('{', i)
  const close = css.indexOf('\n}', open)
  if (open < 0 || close < 0) throw new Error(`§八 的 ${selector} 块没有正确闭合`)
  const body = css.slice(open + 1, close).replace(/\/\*[\s\S]*?\*\//g, '')
  const out = new Map()
  for (const decl of body.split(';')) {
    const c = decl.indexOf(':')
    if (c < 0) continue
    const name = decl.slice(0, c).trim()
    if (!name.startsWith('--')) continue
    out.set(name, decl.slice(c + 1).trim())
  }
  return out
}

/* ------------------------------------------------------------------ *
 * 主入口
 * ------------------------------------------------------------------ */

export function readDesignTokens(docPath = DOC_PATH) {
  const src = fs.readFileSync(docPath, 'utf8')
  const S = sections(src)
  const need = (k) => {
    const s = S.get(k)
    if (!s) throw new Error(`文档缺章节：## ${k}`)
    return s
  }

  /* --- §八：两张变量表 --- */
  const css = cssFence(src)
  const vars = { light: blockVars(css, ':root {'), dark: blockVars(css, '.dark {') }

  /* --- §一 §二：模块色（人类可读表） --- */
  const colorSec = need('一、颜色令牌')
  const colorTables = tables(colorSec)
  const findTable = (list, firstHeaderCell) => {
    const t = list.find((x) => norm(x.headers[0]) === norm(firstHeaderCell))
    if (!t) throw new Error(`找不到表头为「${firstHeaderCell}」的表`)
    return t
  }
  const lightMod = findTable(colorTables, '模块')
  const darkTables = colorTables.filter((x) => norm(x.headers[0]) === norm('模块'))
  const darkMod = darkTables[1]
  if (!darkMod) throw new Error('§一 里只有一张「模块」表，期望两张（亮色 / 暗色）')

  const readModTable = (t, where) => {
    if (t.rows.length !== MODULE_ORDER.length)
      throw new Error(`${where} 的模块行数 ${t.rows.length} ≠ 9`)
    const out = {}
    t.rows.forEach((r, i) => {
      if (r.length !== 5) throw new Error(`${where} 第 ${i + 1} 行不是 5 列`)
      const hexes = r.slice(1)
      for (const h of hexes)
        if (!/^#[0-9A-Fa-f]{6}$/.test(h.replace(/`/g, '')))
          throw new Error(`${where} 第 ${i + 1} 行有非法色值：${h}`)
      out[MODULE_ORDER[i]] = {
        rings: hexes.slice(0, 3).map((h) => norm(h)),
        accent: norm(hexes[3]),
      }
    })
    return out
  }
  const modules = { light: readModTable(lightMod, '§一 亮色模块表'), dark: readModTable(darkMod, '§二 暗色模块表') }

  /* --- §一 3/4/5：中性色、状态色、AI 色 --- */
  const neutrals = findTable(colorTables, '令牌').rows
    .filter((r) => (r[0].replace(/`/g, '') || '').startsWith('--'))
    .map((r) => ({ name: r[0].replace(/`/g, ''), light: r[1], dark: r[2], use: r[3] ?? '' }))
  const statusTable = findTable(colorTables, '状态').rows.map((r) => ({
    label: r[0],
    light: r[1],
    dark: r[2],
  }))
  const aiTable = findTable(colorTables, '令牌').rows.filter((r) => /AI/.test(r[0]))
  const ai = {}
  for (const r of aiTable) ai[norm(r[0])] = r[1].replace(/`/g, '').trim()

  /* --- §二 渐变 --- */
  const gradSec = need('二、渐变令牌')
  const gradTable = tables(gradSec)[0]
  const grad = {}
  for (const r of gradTable.rows) grad[norm(r[0])] = r[1].replace(/`/g, '').trim()

  /* --- §三 毛玻璃与弥散 --- */
  const glassRows = tables(need('三、毛玻璃与弥散令牌'))[0].rows.map((r) => ({
    name: norm(r[0]),
    light: r[1],
    dark: r[2],
  }))

  /* --- §四 字体与间距 / §五 动效 / §六 布局 / §七 组件 / §九 规则 --- */
  const flat = (title) =>
    tables(need(title))[0].rows.map((r) => ({ name: norm(r[0]), value: r[1], extra: r[2] ?? '' }))
  const typography = flat('四、字体与间距令牌')
  const motion = flat('五、动效令牌')
  const layout = flat('六、布局令牌')
  const components = flat('七、组件令牌')
  const rules = flat('九、设计规则')

  const model = {
    path: docPath,
    vars,
    modules,
    neutrals,
    status: statusTable,
    ai,
    grad,
    glass: glassRows,
    typography,
    motion,
    layout,
    components,
    rules,
  }

  assertSelfConsistent(model)
  return model
}

/* ------------------------------------------------------------------ *
 * 文档内部自洽断言
 *
 * 文档有两套表述（§八 汇总块 vs 各节表格）。它们互相打架时，
 * 下游无论按哪边对齐都是错的 —— 所以在这里就拦下来，不让矛盾流到代码里。
 * ------------------------------------------------------------------ */

function assertSelfConsistent(m) {
  const bad = []
  const eq = (label, a, b) => {
    if (norm(a) !== norm(b)) bad.push(`${label}：§八 ${a} ≠ 表格 ${b}`)
  }

  /* 1) 模块色：§八 的 --a-<k>-<n> / --s-<k> 必须等于 §一/§二 的表 */
  for (const scope of ['light', 'dark']) {
    for (const key of MODULE_ORDER) {
      const t = m.modules[scope][key]
      const v = m.vars[scope]
      t.rings.forEach((hex, i) => eq(`模块色 ${scope} ${key} 色团${i + 1}`, v.get(`--a-${key}-${i + 1}`), hex))
      eq(`模块色 ${scope} ${key} 强调色`, v.get(`--s-${key}`), t.accent)
    }
  }

  /* 2) 中性色：§一 3 的 `--x` 行必须等于 §八 的同名变量 */
  for (const n of m.neutrals) {
    eq(`中性色 亮 ${n.name}`, m.vars.light.get(n.name), n.light)
    eq(`中性色 暗 ${n.name}`, m.vars.dark.get(n.name), n.dark)
  }

  /* 3) 状态色：§一 4 的「成功/警告/错误/信息」→ §八 的 --c-success/… */
  const statusName = { 成功: 'success', 警告: 'warning', 错误: 'error', 信息: 'info' }
  for (const s of m.status) {
    const key = statusName[s.label.trim()]
    if (!key) continue
    eq(`状态色 亮 ${key}`, m.vars.light.get(`--c-${key}`), s.light)
    eq(`状态色 暗 ${key}`, m.vars.dark.get(`--c-${key}`), s.dark)
  }

  /* 4) 毛玻璃：§三 的表 → §八 的同名变量 */
  for (const g of m.glass) {
    const key = g.name.replace(/\s/g, '')
    for (const [prop, name] of [
      ['--blur-card', '--blur-card'],
      ['--blob-opacity', '--blob-opacity'],
      ['--blob-blur', '--blob-blur'],
      ['--shadow-card', '--shadow-card'],
      ['--shadow-card-hover', '--shadow-card-hover'],
    ]) {
      if (key === prop) {
        eq(`毛玻璃 亮 ${name}`, m.vars.light.get(name), g.light)
        eq(`毛玻璃 暗 ${name}`, m.vars.dark.get(name), g.dark)
      }
    }
  }

  /* 5) 圆角：§四 表里的「圆角 sm」→ §八 的 --radius-sm（§四 是唯一的 prose 来源） */
  for (const r of m.typography) {
    const mm = /^圆角\s+(SM|MD|LG|XL|PILL)$/.exec(r.name)
    if (mm) eq(`圆角 ${mm[1]}`, m.vars.light.get(`--radius-${mm[1].toLowerCase()}`), r.value)
  }

  /* 6) 动效：§五 的三个过渡 → §八 的 --transition-* */
  const motionName = { 快速过渡: 'fast', 标准过渡: 'base', 慢速过渡: 'slow' }
  for (const t of m.motion) {
    const key = motionName[t.name]
    if (key) eq(`动效 ${key}`, m.vars.light.get(`--transition-${key}`), t.value)
  }

  /* 7) AI 渐变：§一 5 与 §二 与 §八 三处都要一致 */
  const gradAI = m.grad['AI']
  if (gradAI) {
    eq('AI 渐变 §二↔§八', m.vars.light.get('--grad-ai'), gradAI)
    const aiGrad = m.ai['AI 渐变']
    if (aiGrad) eq('AI 渐变 §一↔§二', gradAI, aiGrad)
  }

  if (bad.length) {
    console.error('✗ 文档自身前后不一致（下游无论按哪边对齐都是错的）：')
    for (const b of bad) console.error('   ' + b)
    process.exit(1)
  }
}

/* 直接运行本文件时打印一份摘要，方便人工核对解析结果。 */
if (import.meta.url === `file://${process.argv[1]}`) {
  const m = readDesignTokens()
  console.log('文档自身自洽 ✓')
  console.log(`§八 变量：亮 ${m.vars.light.size} / 暗 ${m.vars.dark.size}`)
  console.log(`模块色：${Object.keys(m.modules.light).length} 模块 × 2 模式 × 4 色`)
  const inVars = new Set([...m.vars.light.keys(), ...m.vars.dark.keys()])
  console.log(`§八 变量名（${inVars.size}）：${[...inVars].join(' ')}`)
  console.log(`中性 ${m.neutrals.length} · 状态 ${m.status.length} · AI ${Object.keys(m.ai).length} · 渐变 ${Object.keys(m.grad).length} · 毛玻璃 ${m.glass.length}`)
  console.log(`字阶/间距 ${m.typography.length} · 动效 ${m.motion.length} · 布局 ${m.layout.length} · 组件 ${m.components.length} · 规则 ${m.rules.length}`)
}
