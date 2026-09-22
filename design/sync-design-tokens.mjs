#!/usr/bin/env node
/* ============================================================================
   设计令牌：**文档 → 代码** 的生成器。
   ----------------------------------------------------------------------------
   上游（唯一事实源）：`design/design-tokens/design-tokens.md`
   产物：`src/styles/design-tokens.css`（**生成物，不要手改**）

   ## 为什么需要它

   文档 §八 的 ```css 汇总块列了 63 支变量。其中 50 支（14 中性/毛玻璃 + 36 模块色）
   已经在代码里有归属（由 `build-workspace-css.mjs` / `sync-module-colors.mjs` 生成），
   **剩下 13 支代码里根本没有** —— 它们也是文档新增、原型里没有的那一批：
     · 状态色  --c-success / --c-warning / --c-error / --c-info（+ 中性）
     · AI      --grad-ai（亮/暗两套）、AI 图标、AI 边框
     · 圆角    --radius-sm/md/lg/xl/pill
     · 动效    --transition-fast/base/slow
   本脚本把这一批补齐，并顺手把 Prism 的**角色名**（`--r-ctl` / `--r-panel` …）
   接到文档的刻度上 —— 那一步以前是反着来的（`--radius-lg: var(--r-panel)`），
   等于让代码里的角色名当事实源、文档只是旁观者。

   ## 三条判据（都在下面有断言）

   1. **文档 §八 的每一支变量都必须有归属**，且归属唯一。
      有的一支由别的生成器负责（中性/毛玻璃 → `--mw-*`；模块色 → `--mw-a-*`/`--mw-s-*`），
      有的归本文件。这张「文档名 → 代码名」的映射表就在这里，**漏一个就报错退出**。
   2. **文档没给的档位由相邻档显式补，不留给兜底。**
      文档的圆角只有 sm/md/lg/xl/pill 五档，而 Tailwind 的 `rounded-xs` / `rounded-2xl`
      在代码里有用量 —— 不显式定义的话会静默回落到 Tailwind 默认值（2px / 16px），
      症状是"某个圆角突然变了"且没有报错。
   3. **角色名只做转发，不承载数值。**
      `--r-panel: var(--radius-lg)` 而不是 `--r-panel: 14px` —— 后者一旦写死，
      文档改刻度时这一支不会跟着动，而这正是本套机制要根治的病。

   ## 与 Prism 的 `--ok/--warn/--bad/--info` 的关系（没合并，是有意的）

   文档的 `--c-*` 是**设计状态色**（徽标底、图标、边框那一类面积）。
   Prism 的 `--ok/--warn/--bad/--info` 是**对比度反解出的文字色** ——
   同一色族的两端：亮色主题取 emerald-900 一类的深档、暗色主题取 emerald-300 一类的浅档，
   由 `prism-derive-colors.mjs` 按实测底衬解出来。
   两者不是同一个东西，所以不互相替换；文档 §九 那条「文字对比度 ≥ 4.5:1」
   恰恰要求文字**不能**直接用 `--c-*` 的 500 号色。

   用法：
     node design/sync-design-tokens.mjs            # 打印
     node design/sync-design-tokens.mjs --write    # 写盘
     node design/sync-design-tokens.mjs --check    # 门禁
   ========================================================================= */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readDesignTokens, DOC_PATH } from './lib/design-tokens-doc.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const OUT = path.join(ROOT, 'src/styles/design-tokens.css')
const DOC_REL = 'design/design-tokens/design-tokens.md'

const doc = readDesignTokens()

/* ------------------------------------------------------------------ *
 * 1) 「文档名 → 代码名」的完整映射
 *
 * 这张表是**本文件存在的理由**：它让"文档里的每一支变量都有人在用"成为可断言的事实，
 * 而不是靠人记。不在本文件负责的项，也要在这里登记由谁负责。
 * ------------------------------------------------------------------ */

/** 由别的生成器负责的：登记归属，本文件不产出，但要断言"确实有人负责"。 */
const ELSEWHERE = {
  // 14 支中性/毛玻璃 → build-workspace-css.mjs 生成成 --mw-<同名>
  '--bg-page': '--mw-bg-page',
  '--bg-card': '--mw-bg-card',
  '--bg-sidebar': '--mw-bg-sidebar',
  '--bg-topbar': '--mw-bg-topbar',
  '--border-card': '--mw-border-card',
  '--border-subtle': '--mw-border-subtle',
  '--text-primary': '--mw-text-primary',
  '--text-secondary': '--mw-text-secondary',
  '--text-muted': '--mw-text-muted',
  '--shadow-card': '--mw-shadow-card',
  '--shadow-card-hover': '--mw-shadow-card-hover',
  '--blur-card': '--mw-blur-card',
  '--blob-opacity': '--mw-blob-opacity',
  '--blob-blur': '--mw-blob-blur',
  // 36 支模块色 → build-workspace-css.mjs 生成成 --mw-a-<模块>-<n> / --mw-s-<模块>
  ...Object.fromEntries(
    [
      'dashboard',
      'tasks',
      'calendar',
      'life',
      'work',
      'learning',
      'projects',
      'knowledge',
      'settings',
    ].flatMap((k) => [
      [`--a-${k}-1`, `--mw-a-${k}-1`],
      [`--a-${k}-2`, `--mw-a-${k}-2`],
      [`--a-${k}-3`, `--mw-a-${k}-3`],
      [`--s-${k}`, `--mw-s-${k}`],
    ]),
  ),
  // 亮色强调色另有一份三元组副本给 Prism（sync-module-colors.mjs 写进 prism-derive-colors.mjs）
  '--s-dashboard+tasks+…（Prism 三元组）': null,
}

/**
 * 本文件负责的项。键 = 文档里的名字（§八 的变量名，或 §一 5 的「AI …」标签），
 * 值 = 写进代码的名字。
 *
 * ⚠️ 档位补全（判据 2）在这里显式列出，并写清"文档没有这一档"。
 */
const DERIVED = []

/* ---- 1a) 圆角：五档照抄，两档显式补 ---- */
for (const key of ['sm', 'md', 'lg', 'xl', 'pill']) {
  DERIVED.push({
    docName: `--radius-${key}`,
    codeName: `--radius-${key}`,
    value: () => doc.vars.light.get(`--radius-${key}`),
    where: 'root',
    group: '圆角',
  })
}
DERIVED.push({
  docName: '（补）--radius-xs',
  codeName: '--radius-xs',
  value: () => 'var(--radius-sm)',
  where: 'root',
  group: '圆角',
  note: '文档无「比 sm 更小」这一档 → 取相邻的 sm；不显式补会静默回落到 Tailwind 默认的 2px',
})
DERIVED.push({
  docName: '（补）--radius-2xl',
  codeName: '--radius-2xl',
  value: () => 'var(--radius-xl)',
  where: 'root',
  group: '圆角',
  note: '文档无「比 xl 更大」这一档（最大档是 pill 999px，那是全圆）→ 取相邻的 xl',
})

/* ---- 1b) 动效：三档照抄 ---- */
for (const key of ['fast', 'base', 'slow']) {
  DERIVED.push({
    docName: `--transition-${key}`,
    codeName: `--transition-${key}`,
    value: () => doc.vars.light.get(`--transition-${key}`),
    where: 'root',
    group: '动效',
  })
}
/* Prism 的时长变量：只取文档的**时长**部分。
   ⚠️ 不能直接 `--dur: var(--transition-base)` —— 文档那支是完整的 transition 值
      （`0.25s ease`），当成时长用会产出 `transition-duration: 0.25s ease`（非法，整条声明作废）。 */
for (const [code, docKey] of [
  ['--dur-fast', '--transition-fast'],
  ['--dur', '--transition-base'],
  ['--dur-slow', '--transition-slow'],
]) {
  DERIVED.push({
    docName: `（时长）${docKey}`,
    codeName: code,
    value: () => {
      const full = doc.vars.light.get(docKey)
      const m = /^([\d.]+m?s)\b/.exec(full.trim())
      if (!m) throw new Error(`文档的 ${docKey} 不是以时长开头：${full}`)
      return m[1]
    },
    where: 'root',
    group: '动效',
    note: 'Prism 的角色名 → 文档的时长（缓动曲线仍用 Prism 自己的 --ease）',
  })
}

/* ---- 1c) 状态色：四档 + 中性（中性只在 §一 4 的表里） ---- */
const STATUS_KEY = { 成功: 'success', 警告: 'warning', 错误: 'error', 信息: 'info', 中性: 'neutral' }
for (const row of doc.status) {
  const key = STATUS_KEY[row.label.trim()]
  if (!key) throw new Error(`§一 4 的状态行认不出来：${row.label}`)
  DERIVED.push({
    docName: key === 'neutral' ? '（§一 4）中性' : `--c-${key}`,
    codeName: `--c-${key}`,
    value: (scope) => row[scope],
    where: scope => (scope === 'dark' ? 'dark' : 'light'),
    group: '状态色',
    note: key === 'neutral' ? '§八 没列它，但 §一 4 的表里有 —— 一并落成令牌' : '',
  })
}

/* ---- 1d) AI：渐变分亮暗两套，图标与边框两支不随主题 ---- */
DERIVED.push({
  docName: '--grad-ai（§八）',
  docKey: '--grad-ai',
  codeName: '--grad-ai',
  value: () => doc.vars.light.get('--grad-ai'),
  where: 'light',
  group: 'AI',
  note: '',
})
DERIVED.push({
  docName: 'AI 暗色渐变（§一 5）',
  codeName: '--grad-ai',
  value: () => {
    const v = doc.ai['AI 暗色渐变']
    if (!/^linear-gradient\(135deg/.test(v)) throw new Error(`§一 5 的 AI 暗色渐变不是 linear-gradient(135deg…)：${v}`)
    return v
  },
  where: 'dark',
  group: 'AI',
  note: '同名两支、按主题切换（文档 §八 只收了亮色那支）',
})
DERIVED.push({
  docName: 'AI 图标（§一 5）',
  codeName: '--ai-icon',
  value: () => doc.ai['AI 图标'],
  where: 'root',
  group: 'AI',
  note: '§一 5 只有一列「值」→ 不随主题',
})
DERIVED.push({
  docName: 'AI 边框（§一 5）',
  codeName: '--ai-border',
  value: () => doc.ai['AI 边框'],
  where: 'root',
  group: 'AI',
  note: '同上',
})

/* ------------------------------------------------------------------ *
 * 2) 断言：文档 §八 的每一支变量都有人负责
 * ------------------------------------------------------------------ */

function assertCoverage() {
  const covered = new Map()
  for (const [docName, codeName] of Object.entries(ELSEWHERE)) {
    if (codeName) covered.set(docName, codeName)
  }
  /* ⚠️ 用 docKey 而不是 docName 去匹配：docName 是**给人看的标签**（可能带括注，
     如 `--grad-ai（§八）`），拿它当键会让覆盖率检查漏掉这一支 —— 本文件第一版就是这样漏的。 */
  const keyOf = (d) => d.docKey ?? d.docName
  for (const d of DERIVED) {
    const k = keyOf(d)
    if (k.startsWith('--')) covered.set(k, d.codeName)
  }

  const missing = []
  for (const name of doc.vars.light.keys()) {
    if (!covered.has(name)) missing.push(name)
  }
  if (missing.length) {
    console.error('✗ 文档 §八 里有变量在代码中没有归属（既不是 --mw-*，也没被本文件覆盖）：')
    for (const m of missing) console.error('   ' + m)
    process.exit(1)
  }

  /* 反向：本文件写了、文档里没有 —— 说明文档删了令牌而代码没跟上 */
  const extra = []
  for (const d of DERIVED) {
    const k = keyOf(d)
    if (!k.startsWith('--')) continue
    if (!doc.vars.light.has(k) && !doc.vars.dark.has(k)) extra.push(k)
  }
  if (extra.length) {
    console.error('✗ 以下变量由本文件产出，但文档里已经没有：')
    for (const e of extra) console.error('   ' + e)
    process.exit(1)
  }
  return { total: doc.vars.light.size, covered: covered.size, derived: DERIVED.length }
}

const coverage = assertCoverage()

/* ------------------------------------------------------------------ *
 * 3) 产物
 * ------------------------------------------------------------------ */

const GROUPS = ['圆角', '动效', '状态色', 'AI']
const pad = (s, n) => {
  const w = [...String(s)].reduce((a, c) => a + (c.charCodeAt(0) > 127 ? 2 : 1), 0)
  return String(s) + ' '.repeat(Math.max(1, n - w))
}

function emit() {
  const L = []
  L.push('/* ============================================================================')
  L.push('   **生成物，不要手改。**')
  L.push('')
  L.push(`   唯一事实源：\`${DOC_REL}\``)
  L.push('   生成：  node design/sync-design-tokens.mjs --write')
  L.push('   门禁：  node design/sync-design-tokens.mjs --check')
  L.push('')
  L.push('   #### 这里为什么只有一部分令牌')
  L.push('')
  L.push('   文档 §八 列了 ' + coverage.total + ' 支变量，其中 50 支（中性/毛玻璃 + 九组模块色）')
  L.push('   已经由 build-workspace-css.mjs 生成成 `--mw-*`（那是模块工作区层的命名空间，')
  L.push('   为的是不与 Prism 同名撞车）。**本文件只补剩下的那批** ——')
  L.push('   状态色 / AI / 圆角 / 动效，共 ' + coverage.derived + ' 条产出。')
  L.push('   「文档名 → 代码名」的完整映射在生成器里，漏一个就报错退出。')
  L.push('')
  L.push('   #### 与 Prism 的 --ok/--warn/--bad/--info 的关系')
  L.push('')
  L.push('   文档的 `--c-*` 是**设计状态色**（徽标底/图标/边框那类面积）；')
  L.push('   Prism 的 `--ok/--warn/--bad/--info` 是**对比度反解出的文字色**（同一色族的两端，')
  L.push('   亮色主题取深档、暗色主题取浅档，由 prism-derive-colors.mjs 按实测底衬解出）。')
  L.push('   两者不互相替换 —— 文档 §九「文字对比度 ≥ 4.5:1」恰恰要求文字不能直接用 500 号的设计色。')
  L.push('')
  L.push('   #### 圆角的档位补全')
  L.push('')
  L.push('   文档只给 sm/md/lg/xl/pill 五档，而代码里 `rounded-xs` / `rounded-2xl` 有用量。')
  L.push('   这里显式取相邻档补上 —— 不补会静默回落到 Tailwind 默认值（2px / 16px），')
  L.push('   症状是「某个圆角突然变了」且没有任何报错。')
  L.push('   ============================================================================ */')
  L.push('')

  const byWhere = { root: [], light: [], dark: [] }
  for (const d of DERIVED) {
    const w = typeof d.where === 'function' ? d.where('light') : d.where
    byWhere[w].push(d)
    if (typeof d.where === 'function') byWhere[d.where('dark')].push({ ...d, _dark: true })
  }

  const scopeFor = (w) =>
    w === 'root'
      ? ':root {'
      : w === 'light'
        ? "html:not([data-theme='dark']) {"
        : "html[data-theme='dark'] {"

  for (const w of ['root', 'light', 'dark']) {
    const list = byWhere[w]
    if (!list.length) continue
    L.push(
      w === 'root'
        ? '/* ---------- 主题无关（圆角 / 动效 / AI 图标与边框） ---------- */'
        : w === 'light'
          ? '/* ---------- 亮色（`html:not([data-theme=dark])`，与 Prism 的写法一致） ---------- */'
          : '/* ---------- 暗色 ---------- */',
    )
    L.push(scopeFor(w))
    let lastGroup = null
    for (const d of list) {
      if (d.group !== lastGroup) {
        L.push('')
        L.push(`  /* ${d.group} —— ${d.docName}${d._dark ? '（暗色）' : ''} */`)
        lastGroup = d.group
      }
      const value = d._dark ? d.value('dark') : d.value('light')
      L.push(`  ${d.codeName}: ${value};${d.note ? `  /* ${d.note} */` : ''}`)
    }
    L.push('}')
    L.push('')
  }

  /* 角色名转发：Prism 的角色名 → 文档刻度。只转发，不承载数值（判据 3）。 */
  L.push('/* ---------- Prism 的角色名转发到文档刻度 ----------')
  L.push('   ⚠️ 只转发、不写死数值：写成 `--r-panel: 14px` 的话，文档改刻度时这一支不会跟着动，')
  L.push('      而那正是这套机制要根治的病。方向也不能反过来（之前是 --radius-lg: var(--r-panel)，')
  L.push('      等于让代码里的角色名当事实源、文档只是旁观者）。')
  L.push('   `--r-window`（窗口圆角）不在这里：文档没有这一支，理由见 prism.css §0。 ---------- */')
  L.push(':root {')
  for (const [code, target, why] of [
    ['--r-xs', '--radius-sm', '文档无比 sm 更小的一档'],
    ['--r-sm', '--radius-md', ''],
    ['--r-ctl', '--radius-md', '文档 §七「输入框圆角 10px」'],
    ['--r-panel', '--radius-lg', ''],
    ['--r-card', '--radius-xl', '文档 §三「卡片圆角 20px」'],
  ]) {
    L.push(`  ${pad(code + ':', 14)} var(${target});${why ? `  /* ${why} */` : ''}`)
  }
  L.push('}')
  L.push('')

  return L.join('\n')
}

const output = emit()

/* ------------------------------------------------------------------ *
 * 4) 落盘 / 门禁
 * ------------------------------------------------------------------ */

const mode = process.argv[2] ?? '--report'

if (mode === '--check') {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null
  if (cur === output) {
    console.log(`✓ design-tokens.css 与文档一致（${output.length} 字节）`)
    process.exit(0)
  }
  console.error('✗ design-tokens.css 与文档不一致 —— 重跑：node design/sync-design-tokens.mjs --write')
  process.exit(1)
}

if (mode === '--write') {
  fs.writeFileSync(OUT, output)
  console.log(`✓ 已写入 src/styles/design-tokens.css（${output.length} 字节）`)
  process.exit(0)
}

console.log(`\n设计令牌 · 上游 ${DOC_REL}\n`)
console.log(`文档 §八 变量 ${coverage.total} 支：50 支由 --mw-* 承担，本文件产出 ${coverage.derived} 条\n`)
for (const g of GROUPS) {
  const list = DERIVED.filter((d) => d.group === g)
  if (!list.length) continue
  console.log(`  ${g}（${list.length}）`)
  for (const d of list) {
    const w = typeof d.where === 'function' ? '亮/暗' : d.where
    console.log(`    ${pad(d.docName, 34)}→ ${pad(d.codeName, 18)} ${pad(w, 8)} ${d.value('light')}`)
  }
  console.log('')
}
console.log('加 --write 写盘，--check 做门禁\n')
