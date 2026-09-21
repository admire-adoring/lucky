#!/usr/bin/env node
/**
 * 生成 `src/styles/module-workspace.css` —— 「模块工作区」这一层设计系统的令牌与样式。
 *
 * 为什么是生成器而不是手写：
 *   这 8 个原型（task / candle / life / work / study / project / know / setting）是
 *   **同一套壳的 8 份拷贝**。实测：壳的 27 个令牌在 8 份里逐字一致，只有「指向模块强调色」
 *   的 `--m1/--m2/--m3/--m-main` 四个间接层不同。手抄一遍等于把同一份壳复制 8 次，
 *   以后改一处要改 8 处 —— 与本仓库「CSS 不手抄」的纪律冲突。
 *
 * 这个脚本做三件事，每一件都在消掉一类「静默失效」：
 *
 *  1) **变量加 `--mw-` 前缀**。原型的 `--a-<模块>-1/2/3`、`--s-<模块>` 与 Prism 的
 *     同名变量**语义完全不同**（原型是实色强调色 hex，Prism 是柔雾色团 / RGB 三元组）。
 *     两者一旦同页加载，后加载的会静默压过前者：类名还在、页面照常渲染，颜色整套换掉。
 *     加前缀是唯一能从根上杜绝这类撞名的做法。
 *
 *  2) **所有选择器收进 `.mw-root`**。内核里有 `.card` / `.btn` / `.main` / `.app` /
 *     `.tabs` / `.panel` / `.hero` / `.stat` 这类**极通用**的类名，全局引入必然污染
 *     工作台与其它页面。按模块增量再收一层 `[data-module]`，还顺带解决了
 *     「同名类在不同模块里定义不同」的冲突（收进不同作用域 = 冲突不存在）。
 *
 *  3) **主题改用属性选择器**。原型用 `.dark` 类 + 自己的 localStorage；应用里主题的
 *     唯一开关是 `<html data-theme>`（见 src/lib/theme.ts）。这里把 `.dark` 翻译成
 *     `html[data-theme='dark'] .mw-root`，亮色也显式写成 `html[data-theme='light']`——
 *     不依赖「不写就是默认」，否则主题属性一旦缺失就会静默落到错误的取值。
 *
 * 用法：
 *   node design/build-workspace-css.mjs           # 写入 src/styles/module-workspace.css
 *   node design/build-workspace-css.mjs --check   # 只校验产物是否过期（不写）
 *   node design/build-workspace-css.mjs --report  # 打印共用内核/模块增量的划分
 */
import fs from 'node:fs'
import path from 'node:path'

const HERE = new URL('.', import.meta.url).pathname
const ROOT = path.resolve(HERE, '..')
const OUT = path.join(ROOT, 'src/styles/module-workspace.css')

/** 模块 key → 原型文件。key 与 `[data-module]`、路由、Prism 的九模块色槽口径一致。 */
const MODULES = {
  tasks: 'task/task_index.html',
  calendar: 'candle/candle_index.html',
  life: 'life/life_index.html',
  work: 'work/work_index.html',
  learning: 'study/study_index.html',
  projects: 'project/project_index.html',
  knowledge: 'know/knowledge_index.html',
  settings: 'setting/setting_index.html',
}
/** 工作台不在这次落地范围内，但侧栏第 1 项要用它的强调色，所以也读进来。 */
const EXTRA_ACCENT = { dashboard: 'workbench/workbench_index.html' }

/** 共用内核的判定阈值：一条规则的原文在 ≥ 这个数的模块里逐字一致，就只发一份。 */
const CORE_THRESHOLD = 6

const PREFIX = '--mw-'
/** 原型的类名里带模块名、但要在所有模块下都生效的那些（重命名后统一由 data-module 驱动）。 */
const KEYFRAME_RENAME = { drift: 'mw-drift' }

/* ------------------------------------------------------------------ *
 * CSS 解析
 * ------------------------------------------------------------------ */

const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '')

/**
 * 把 CSS 切成顶层块。返回 {type:'rule'|'at', selector, body, children}。
 * `@media` 会递归切内部；`@keyframes` 内部是 `from/to`，**不递归**（那些不是选择器）。
 */
function parseBlocks(css) {
  const out = []
  let i = 0
  while (i < css.length) {
    const ws = /^\s+/.exec(css.slice(i))
    if (ws) { i += ws[0].length; continue }
    let j = i
    let head = ''
    while (j < css.length && css[j] !== '{') { head += css[j]; j++ }
    if (j >= css.length) break
    let k = j
    let depth = 0
    for (; k < css.length; k++) {
      if (css[k] === '{') depth++
      else if (css[k] === '}') { depth--; if (depth === 0) break }
    }
    const selector = head.trim().replace(/\s+/g, ' ')
    const body = css.slice(j + 1, k)
    if (selector.startsWith('@keyframes')) {
      out.push({ type: 'at', selector, body })
    } else if (selector.startsWith('@')) {
      out.push({ type: 'at', selector, children: parseBlocks(body) })
    } else {
      out.push({ type: 'rule', selector, body })
    }
    i = k + 1
  }
  return out
}

const normBody = (s) => s.replace(/\s+/g, ' ').trim()

/** 收集一段声明体里**被定义**的自定义属性名。 */
function definedVars(body) {
  const out = new Set()
  for (const m of body.matchAll(/(^|;|\{)\s*(--[A-Za-z0-9_-]+)\s*:/g)) out.add(m[2])
  return out
}
/** 收集一段声明体里**被引用**的自定义属性名。 */
function referencedVars(body) {
  const out = new Set()
  for (const m of body.matchAll(/var\(\s*(--[A-Za-z0-9_-]+)/g)) out.add(m[1])
  return out
}

/** 声明体文本 → 有序的 [名, 值] 列表（丢掉空项）。 */
function splitDecls(body) {
  const out = []
  for (const d of body.split(';')) {
    const idx = d.indexOf(':')
    if (idx < 0) continue
    const name = d.slice(0, idx).trim()
    const value = d.slice(idx + 1).trim()
    if (name) out.push([name, value])
  }
  return out
}

/* ------------------------------------------------------------------ *
 * 读入 8 份原型
 * ------------------------------------------------------------------ */

function readPrototype(rel) {
  const html = fs.readFileSync(path.join(HERE, rel), 'utf8')
  const css = stripComments(/<style[^>]*>([\s\S]*?)<\/style>/.exec(html)[1])
  return { html, css, blocks: parseBlocks(css) }
}

const proto = {}
for (const [key, rel] of Object.entries({ ...MODULES, ...EXTRA_ACCENT })) proto[key] = readPrototype(rel)

/* ------------------------------------------------------------------ *
 * 1) 令牌分三类：壳（8 份一致）/ 模块色（每组各一份）/ 模块私有（只在一份里）
 * ------------------------------------------------------------------ */

/** `--a-<模块>-n` / `--s-<模块>` —— 九组调色板的成员。 */
const ACCENT_RE = /^--(a-[a-z]+-\d|s-[a-z]+)$/
/** `--m1..3` / `--m-main` —— 指向「当前模块那一组」的间接层，不参与归类。 */
const POINTER_RE = /^--m(1|2|3|-main)$/

/** 取一份原型 :root / .dark 里的全部自定义属性（有序，去指针）。 */
function harvestTokens(key) {
  const out = { light: [], dark: [] }
  for (const b of proto[key].blocks) {
    if (b.type !== 'rule') continue
    if (b.selector !== ':root' && b.selector !== '.dark') continue
    const bucket = b.selector === ':root' ? out.light : out.dark
    for (const [name, value] of splitDecls(b.body)) {
      if (!name.startsWith('--')) continue
      if (POINTER_RE.test(name)) continue
      bucket.push([name, value])
    }
  }
  return out
}

const tokens = Object.fromEntries(Object.entries(proto).map(([k]) => [k, harvestTokens(k)]))

/**
 * 壳令牌 = 在 ≥CORE_THRESHOLD 个模块里**名字与取值都逐字一致**的那些。
 *
 * ⚠️ 这里不能简单地按「名字长得像壳」来判断。实测踩到过一个反例：
 * `projects` 原型的 :root 里还带着 `--q1..--q4`（四象限）、`--ok/--info/--warn/--danger`
 * （语义色）、`--doc-deep/--note-deep`（实底配色）——名字看着也"很通用"，
 * 但它们只服务项目模块。按名字归类会把它们抬成壳令牌，等于给全部 8 个页面
 * 凭空注入一批从未被验证过的颜色。按「出现次数」归类才不会犯这个错。
 */
function computeShellTokens() {
  const problems = []
  const shell = { light: [], dark: [] }
  for (const scope of ['light', 'dark']) {
    const tally = new Map() // name -> Map(value -> Set(module))
    for (const key of Object.keys(MODULES)) {
      for (const [name, value] of tokens[key][scope]) {
        if (ACCENT_RE.test(name)) continue
        if (!tally.has(name)) tally.set(name, new Map())
        const byValue = tally.get(name)
        if (!byValue.has(value)) byValue.set(value, new Set())
        byValue.get(value).add(key)
      }
    }
    for (const [name, byValue] of tally) {
      const winners = [...byValue.entries()].filter(([, mods]) => mods.size >= CORE_THRESHOLD)
      if (winners.length === 1) {
        shell[scope].push([name, winners[0][0]])
      } else if (winners.length > 1) {
        problems.push(`${scope} · ${name} 有两组取值都达到阈值：${winners.map(([v, m]) => `${v}(${m.size}个)`).join(' / ')}`)
      }
    }
    // 壳令牌的顺序沿用 tasks 的文件顺序，产物可读且幂等
    const order = new Map(tokens.tasks[scope].map(([n], i) => [n, i]))
    shell[scope].sort((a, b) => (order.get(a[0]) ?? 9e9) - (order.get(b[0]) ?? 9e9))
  }
  if (problems.length) {
    console.error('✗ 壳令牌归类不确定 —— 「一份壳」的前提不成立：')
    for (const p of problems) console.error('   ' + p)
    process.exit(1)
  }
  return shell
}

const SHELL = computeShellTokens()

/** 模块私有令牌 = 某模块声明了、但不属于壳也不属于九组调色板的那些。 */
function modulePrivateTokens(key, scope) {
  const shellNames = new Set(SHELL[scope].map(([n]) => n))
  return tokens[key][scope].filter(([name]) => !shellNames.has(name) && !ACCENT_RE.test(name))
}

const modulePrivate = Object.fromEntries(
  Object.keys(MODULES).map((key) => [
    key,
    { light: modulePrivateTokens(key, 'light'), dark: modulePrivateTokens(key, 'dark') },
  ]),
)

/** 把 `--x` 改写成 `--mw-x`。 */
const mw = (name) => PREFIX + name.slice(2)
/** 一段声明体里的所有变量引用与定义都加前缀。 */
const prefixVars = (text) =>
  text
    .replace(/(^|[\s;(:,]|;)(--[A-Za-z0-9_-]+)/g, (all, pre, name) => pre + mw(name))
    .replace(/var\(\s*--mw-/g, 'var(--mw-')

/** 选择器改写：收进作用域，并把原型的 `.dark` 守卫翻成应用的 `html[data-theme]`。 */
function scopeSelector(selector, scope) {
  const parts = selector.split(',').map((s) => s.trim()).filter(Boolean)
  const out = []
  for (const s of parts) {
    /* ⚠️ 原型用 `.dark` 类当暗色开关（`.dark .task-tag.scope-life { … }`），
       而应用里主题的唯一开关是 `<html data-theme>`。不翻译的话，这一族规则的选择器
       **永远匹配不到** —— 全是死规则。症状很隐蔽：暗色下个别元素不换色，
       控制台一片安静，而且检查器里明明看得见那条规则（它只是不匹配）。

       翻译方式是把守卫**提到最外层**：`.dark X` → `html[data-theme='dark'] <scope> X`。
       不能简单替换成 `[data-theme='dark']` 留在原位 —— 那样它会变成 `.mw-root` 的
       后代选择器，而 `data-theme` 在 `<html>` 上，永远匹配不到。 */
    const hasDarkGuard = /(^|\s)\.dark(?=\s|$)/.test(s)
    const bare = s.replace(/(^|\s)\.dark(?=\s|$)/g, ' ').replace(/\s+/g, ' ').trim()

    let scoped
    if (bare === '' || bare === 'html' || bare === 'body' || bare === ':root') {
      scoped = scope.root
    } else if (bare === '*') {
      scoped = `${scope.root}, ${scope.root} *`
    } else {
      scoped = `${scope.current} ${bare}`
    }
    out.push(hasDarkGuard ? `html[data-theme='dark'] ${scoped}` : scoped)
  }
  return out.join(', ')
}

/** 作用域标记：内核用 `.mw-root`，模块增量再叠一层 `[data-module='<key>']`。 */
const SCOPES = {
  core: { root: '.mw-root', current: '.mw-root' },
  module: (key) => ({ root: `.mw-root[data-module='${key}']`, current: `.mw-root[data-module='${key}']` }),
}

/** 渲染一条规则（含 @media 递归）。 */
function renderRule(rule, scope, indent) {
  if (rule.type === 'at') {
    const name = rule.selector.replace(/^@keyframes\s+(\S+)/, (all, n) =>
      KEYFRAME_RENAME[n] ? `@keyframes ${KEYFRAME_RENAME[n]}` : all,
    )
    if (rule.selector.startsWith('@keyframes')) {
      return `${indent}${name} {\n${rule.body.replace(/\s+$/, '')}\n${indent}}`
    }
    const inner = (rule.children || [])
      .map((c) => renderRule(c, scope, indent + '  '))
      .filter(Boolean)
      .join('\n')
    return `${indent}${name} {\n${inner}\n${indent}}`
  }
  const body = prefixVars(rule.body)
    .split(';')
    .map((d) => d.trim())
    .filter(Boolean)
    .join('; ')
  if (!body) return ''
  // `animation: drift …` 里的关键帧名也要跟着改
  const fixed = body.replace(
    /(animation(?:-name)?\s*:\s*)([^;]*)/g,
    (all, head, val) =>
      head +
      val.replace(/\b([A-Za-z_-][\w-]*)\b/g, (n) => (KEYFRAME_RENAME[n] ? KEYFRAME_RENAME[n] : n)),
  )
  return `${indent}${scopeSelector(rule.selector, scope)} {\n${indent}  ${fixed};\n${indent}}`
}

/* ------------------------------------------------------------------ *
 * 2) 把非令牌规则分成「共用内核」与「模块增量」
 * ------------------------------------------------------------------ */

const ruleIndex = new Map() // 归一化原文 → { mods:Set, blocks:[{selector,body}] }
for (const key of Object.keys(MODULES)) {
  const seen = new Set()
  for (const b of proto[key].blocks) {
    if (b.type === 'rule' && (b.selector === ':root' || b.selector === '.dark')) continue
    const raw = b.type === 'at' ? `${b.selector}{${b.body}}` : `${b.selector}{${normBody(b.body)}}`
    if (seen.has(raw)) continue
    seen.add(raw)
    if (!ruleIndex.has(raw)) ruleIndex.set(raw, { mods: new Set(), block: b })
    ruleIndex.get(raw).mods.add(key)
  }
}

const coreRules = []
const moduleRules = Object.fromEntries(Object.keys(MODULES).map((k) => [k, []]))
for (const [raw, { mods, block }] of ruleIndex) {
  if (mods.size >= CORE_THRESHOLD) coreRules.push(block)
  else for (const k of mods) moduleRules[k].push(block)
}

/* ------------------------------------------------------------------ *
 * 3) 产出
 * ------------------------------------------------------------------ */

/**
 * 定义在**内联 style** 里的自定义属性。守卫必须知道它们的存在。
 *
 * 实测踩到的反例：`projects` 用 `style="--kc: var(--m-main)"` 给卡片喂一个"当前色"，
 * CSS 那边再 `color: var(--kc)` 消费。只看 CSS 的话，`--kc` 就是个"被引用但从未定义"
 * 的变量 —— 而它在浏览器里**完全正常**，因为定义在 DOM 上。守卫若无视这一点，
 * 就会把正确的代码判成错的（假阳性比漏报更消耗信任）。
 */
function inlineStyleVars() {
  const out = new Set()
  for (const key of Object.keys(MODULES)) {
    const { html } = proto[key]
    // style="..." 属性里
    for (const m of html.matchAll(/style="([^"]*)"/g)) {
      for (const v of definedVars(m[1])) out.add(v)
    }
    // <script> 里的模板串（弹窗等动态内容同样会挂内联 style）
    const script = /<script[^>]*>([\s\S]*?)<\/script>/.exec(html)
    if (script) for (const v of definedVars(script[1].replace(/\\`/g, '`'))) out.add(v)
  }
  return out
}

const INLINE_VARS = inlineStyleVars()

/** 变量引用的完整性守卫：引用了没定义的变量 = 静默失效，必须拦。 */
function assertVariantsResolve() {
  const allDefined = new Set()
  for (const scope of ['light', 'dark']) {
    for (const [name] of SHELL[scope]) allDefined.add(mw(name))
    for (const key of Object.keys(proto)) {
      for (const [name] of tokens[key][scope].filter(([n]) => ACCENT_RE.test(n))) allDefined.add(mw(name))
    }
  }
  for (const key of Object.keys(MODULES)) {
    for (const scope of ['light', 'dark']) {
      for (const [name] of modulePrivate[key][scope]) allDefined.add(mw(name))
    }
  }
  for (const name of INLINE_VARS) allDefined.add(mw(name))
  for (const v of ['--mw-m1', '--mw-m2', '--mw-m3', '--mw-m-main']) allDefined.add(v)

  const used = new Set()
  const walk = (blocks) => {
    for (const b of blocks) {
      if (b.type === 'at' && b.children) { walk(b.children); continue }
      for (const r of referencedVars(b.body)) used.add(mw(r))
    }
  }
  // 只校验**真正会产出**的模块。dashboard 只是被借来取一组色，它的规则不进产物，
  // 拿它的引用来要求定义是错的方向。
  for (const key of Object.keys(MODULES)) walk(proto[key].blocks)

  const missing = [...used].filter((v) => !allDefined.has(v))
  if (missing.length) {
    console.error('✗ 以下变量被引用但从未定义（会静默落回兜底 / 无颜色）：')
    for (const m of missing) console.error('   ' + m)
    process.exit(1)
  }
  return { used: used.size, defined: allDefined.size, inline: INLINE_VARS.size, missing: 0 }
}

const guard = assertVariantsResolve()

function build() {
  const L = []
  /** 有模块色组的 key（含不在落地范围内的 dashboard —— 侧栏第 1 项的色点要用它）。 */
  const accentKeys = Object.keys(proto)
  L.push(`/* ============================================================`)
  L.push(` * Lucky-Y · 模块工作区令牌与样式（"个人系统" 外壳）`)
  L.push(` * ------------------------------------------------------------`)
  L.push(` * ⚠️ 本文件是**生成物**，不要手改 —— 改动会在这里被覆盖。`)
  L.push(` *    生成器：design/build-workspace-css.mjs`)
  L.push(` *    事实源：design/{task,candle,life,work,study,project,know,setting}/*_index.html 的 <style>`)
  L.push(` *    重新生成：node design/build-workspace-css.mjs`)
  L.push(` *`)
  L.push(` * 三条与原型不同的地方，都是有意为之：`)
  L.push(` *   1. 所有自定义属性加了 ${PREFIX} 前缀。原型的 --a-<模块>-* / --s-<模块> 与 prism.css`)
  L.push(` *      的同名变量**语义相反**（原型=实色强调色，Prism=柔雾色团/RGB 三元组），`)
  L.push(` *      不加前缀会静默互相覆盖。`)
  L.push(` *   2. 所有选择器收进 .mw-root（模块增量再收一层 [data-module]）。`)
  L.push(` *      内核里的 .card/.btn/.main/.app/.tabs/.panel/.hero/.stat 太通用，不收会污染全站。`)
  L.push(` *   3. 主题改由 html[data-theme] 驱动，两个值都显式写出，不靠"不写就是默认"。`)
  L.push(` *`)
  L.push(` * 共用内核判定：同一规则的原文在 ≥${CORE_THRESHOLD} 个模块里逐字一致 → 只发一份。`)
  L.push(` * ============================================================ */`)
  L.push('')

  /* ---- §1 壳令牌（亮） ---- */
  L.push(`/* ---------- §1 壳令牌 · 亮色（${SHELL.light.length} 个） ----------`)
  L.push(`   实测：这些令牌在 8 个模块里**逐字一致**，所以只保留一份副本。`)
  L.push(`   由本脚本断言，不一致会直接报错退出 —— 不允许"看起来差不多"。`)
  L.push(`   ⚠️ 作用域是 **<html> 而不是 .mw-root**：工作台的卡片要用同一份材质（见 §5b），`)
  L.push(`      而工作台**不在** .mw-root 里 —— 把 .mw-root 套到工作台上会让内核那批通用类名`)
  L.push(`      （.rail / .card / .tabs …）开始匹配工作台的组件，其中 .rail 是真撞车：`)
  L.push(`      workbench-hero.css 里那个 .rail 是助手栏，与 modules 的里程碑轨道同名不同物。`)
  L.push(`      这些只是自定义属性、不产生任何选择器效果，放开作用域不会影响别的页面。 ---------- */`)
  L.push(`html:not([data-theme='dark']) {`)
  for (const [name, value] of SHELL.light) L.push(`  ${mw(name)}: ${value};`)
  L.push(`}`)
  L.push('')

  /* ---- §2 壳令牌（暗） ---- */
  L.push(`/* ---------- §2 壳令牌 · 暗色（${SHELL.dark.length} 个，由 html[data-theme='dark'] 驱动，不是 .dark 类） ---------- */`)
  L.push(`html[data-theme='dark'] {`)
  for (const [name, value] of SHELL.dark) L.push(`  ${mw(name)}: ${value};`)
  L.push(`}`)
  L.push('')

  /* ---- §3 九组模块色 ---- */
  L.push(`/* ---------- §3 模块色（${accentKeys.length} 组） ----------`)
  L.push(`   亮色取各原型 :root，暗色取各原型 .dark —— 原样保留，不重算。`)
  L.push(`   键名与侧栏、路由、Prism 的九模块色槽同源。 ---------- */`)
  // 亮色块一并挂到裸 `.mw-root` 上：`data-theme` 万一缺失时也要有颜色，
  // 否则 `--mw-m-main` 解析为空 → 侧栏/按钮整套失去强调色，且**不报错**。
  L.push(`html[data-theme='light'] .mw-root,`)
  L.push(`.mw-root {`)
  for (const key of accentKeys) {
    for (const [name, value] of tokens[key].light.filter(([n]) => ACCENT_RE.test(n))) {
      L.push(`  ${mw(name)}: ${value};`)
    }
  }
  L.push(`}`)
  L.push('')
  L.push(`html[data-theme='dark'] .mw-root {`)
  for (const key of accentKeys) {
    for (const [name, value] of tokens[key].dark.filter(([n]) => ACCENT_RE.test(n))) {
      L.push(`  ${mw(name)}: ${value};`)
    }
  }
  L.push(`}`)
  L.push('')

  /* ---- §3b 模块私有令牌 ---- */
  const privateKeys = Object.keys(MODULES).filter(
    (k) => modulePrivate[k].light.length || modulePrivate[k].dark.length,
  )
  L.push(`/* ---------- §3b 模块私有令牌 ----------`)
  L.push(`   只服务某一个模块、且不属于九组调色板的令牌。收在 [data-module] 下，`)
  L.push(`   别的模块页面根本看不到它们 —— 例如 projects 的四象限色 --q1..--q4。 ---------- */`)
  for (const key of privateKeys) {
    if (modulePrivate[key].light.length) {
      L.push(`html[data-theme='light'] .mw-root[data-module='${key}'] {`)
      for (const [name, value] of modulePrivate[key].light) L.push(`  ${mw(name)}: ${value};`)
      L.push(`}`)
    }
    if (modulePrivate[key].dark.length) {
      L.push(`html[data-theme='dark'] .mw-root[data-module='${key}'] {`)
      for (const [name, value] of modulePrivate[key].dark) L.push(`  ${mw(name)}: ${value};`)
      L.push(`}`)
    }
  }
  L.push('')

  /* ---- §4 强调色指针：由 [data-module] 选一组 ---- */
  L.push(`/* ---------- §4 强调色指针 ----------`)
  L.push(`   原型里 --m1/--m2/--m3/--m-main 直接写在各自的 :root 上，等于把壳复制了 8 份。`)
  L.push(`   这里改成"属性选组"：换模块 = 换 [data-module]，四个指针自动跟着走。`)
  L.push(`   ⚠️ 这四个名字不带模块名，是**唯一**不带 --mw- 语义前缀也仍然安全的四个 ——`)
  L.push(`      它们在整个文件里只在这里被赋值，不会与 Prism 撞。 ---------- */`)
  for (const key of Object.keys(MODULES)) {
    L.push(`.mw-root[data-module='${key}'] {`)
    L.push(`  --mw-m1: var(--mw-a-${key}-1);`)
    L.push(`  --mw-m2: var(--mw-a-${key}-2);`)
    L.push(`  --mw-m3: var(--mw-a-${key}-3);`)
    L.push(`  --mw-m-main: var(--mw-s-${key});`)
    L.push(`}`)
  }
  L.push('')

  /* ---- §5 侧栏九色点 ---- */
  L.push(`/* ---------- §5 侧栏九色点 ----------`)
  L.push(`   原型里只有工作台那一份给 9 个菜单项配了色（.menu-item.life .menu-dot），`)
  L.push(`   另外 8 份的圆点全是"当前模块色"。既然新外壳是全站唯一的侧栏，`)
  L.push(`   这里统一按各自模块上色 —— 侧栏因此变成"九个域的地图"，信息量比原型更高。 ---------- */`)
  for (const key of accentKeys) {
    L.push(`.mw-root .menu-item[data-module='${key}'] .menu-dot { background: var(--mw-s-${key}); }`)
  }
  L.push('')

  /* ---- §5b 卡片材质（给工作台用；与 §6 的 .card 同源） ---- */
  /* 声明**从原型 .card 那条规则反解**，不手写取值 —— 否则同一份材质又变成两处描述。
     只做一件事：把"卡片自己的排版与动效取舍"摘出去（CHROME），剩下的就是材质。
     ⚠️ 判据：材质 = 会改变**表面**的东西（背景／模糊／边框／圆角／投影）；
        padding 与 transition 不是材质 —— 工作台的列表卡要让行通铺到边，
        不能被 .card 的 20px 内边距夹住；它也有自己的 220ms 上浮过渡。
     ⚠️ 两边都需要，所以给工作台一个独立类名 .wb-card，而不是让工作台硬套 .card。 */
  const CHROME_DECL = /^(padding|transition|animation|margin)$/
  const SURFACE_DECL =
    /^(background|background-color|background-image|backdrop-filter|-webkit-backdrop-filter|border|border-color|border-width|border-style|border-radius|box-shadow)$/
  const cardRule = coreRules.find((b) => b.type === 'rule' && b.selector.trim() === '.card')
  if (!cardRule) throw new Error('§5b：共用内核里找不到 .card —— 卡片材质是从它反解的，不能"找不到就跳过"')
  const cardDecls = splitDecls(cardRule.body)
  const material = cardDecls.filter(([n]) => !CHROME_DECL.test(n))
  const chromeNames = cardDecls.filter(([n]) => CHROME_DECL.test(n)).map(([n]) => n)
  for (const [n] of material) {
    if (!SURFACE_DECL.test(n)) {
      console.error(`✗ §5b：原型 .card 的「${n}」既不是表面材质、也不在已知的 chrome 名单里`)
      console.error('   它需要人判断归属 —— 静默归到任一边都会让工作台与模块卡悄悄分叉。')
      process.exit(1)
    }
  }
  if (material.length < 4) {
    console.error(`✗ §5b：.card 只反解出 ${material.length} 条表面声明，看起来不对（期望 ≥4）`)
    process.exit(1)
  }
  L.push(`/* ---------- §5b 卡片材质（工作台的 .wb-card） ----------`)
  L.push(`   声明**从 §6 的 .card 反解**，只摘掉 ${chromeNames.join(' / ')} ——`)
  L.push(`   那是卡片自己的排版与动效取舍，不是材质（列表卡要让行通铺到边）。`)
  L.push(`   模块卡仍走 §6 的 .mw-root .card（带内边距），两者共用同一组壳令牌。 ---------- */`)
  L.push(`.wb-card {`)
  for (const [n, v] of material) L.push(`  ${n}: ${prefixVars(v)};`)
  L.push(`}`)
  /* 悬停态同样是"卡片样式"的一部分，所以也从原型反解，不手写。
     ⚠️ 原型的 .card:hover = 投影加深 + 上浮 2px。工作台原本只写了 Tailwind 的
        `hover:-translate-y-0.5`（恰好也是 2px）—— 两边都留会叠加成 4px，
        所以工作台那两支类串里的 hover 位移已删掉，位移由这里统一给。 */
  const hoverRule = coreRules.find((b) => b.type === 'rule' && b.selector.trim() === '.card:hover')
  if (!hoverRule) throw new Error('§5b：共用内核里找不到 .card:hover —— 悬停态是从它反解的')
  const hoverDecls = splitDecls(hoverRule.body)
  const HOVER_ALLOWED = /^(box-shadow|transform|translate|border-color|background|background-color|opacity)$/
  for (const [n] of hoverDecls) {
    if (!HOVER_ALLOWED.test(n)) {
      console.error(`✗ §5b：原型 .card:hover 的「${n}」不在允许名单里 —— 需要人判断它该不该带到工作台`)
      process.exit(1)
    }
  }
  L.push(`.wb-card:hover {`)
  for (const [n, v] of hoverDecls) L.push(`  ${n}: ${prefixVars(v)};`)
  L.push(`}`)
  L.push('')

  /* ---- §6 共用内核 ---- */
  L.push(`/* ============================================================`)
  L.push(` * §6 共用内核（${coreRules.length} 条规则，8 个模块共享一份）`)
  L.push(` * ============================================================ */`)
  for (const b of coreRules) L.push(renderRule(b, SCOPES.core, ''))
  L.push('')

  /* ---- §7 各模块增量 ---- */
  L.push(`/* ============================================================`)
  L.push(` * §7 各模块增量`)
  L.push(` * ------------------------------------------------------------`)
  L.push(` * 收在 [data-module='<key>'] 下有两个作用：`)
  L.push(` *   1. 同名类在不同模块里定义不同时不会互相打架（收进不同作用域 = 冲突不存在）；`)
  L.push(` *   2. 一个页面只带自己那一份增量，切模块时不会把别的模块的样式算进来。`)
  L.push(` * ============================================================ */`)
  for (const key of Object.keys(MODULES)) {
    const rules = moduleRules[key]
    L.push('')
    L.push(`/* ---------- ${key}（${rules.length} 条） ---------- */`)
    for (const b of rules) L.push(renderRule(b, SCOPES.module(key), ''))
  }
  L.push('')
  return L.join('\n')
}

const output =
  `/* @generated by design/build-workspace-css.mjs —— 请勿手改 */\n` + build()

const mode = process.argv[2]

/** 一条块的体量：`@media` 只有 children，没有 body。 */
const blockBytes = (b) =>
  b.type === 'at' && b.children ? b.children.reduce((s, c) => s + blockBytes(c), 0) : b.body.length

if (mode === '--report') {
  const coreBytes = coreRules.reduce((s, b) => s + blockBytes(b), 0)
  console.log(`共用内核: ${coreRules.length} 条规则 / ${coreBytes} 字符`)
  for (const k of Object.keys(MODULES)) {
    const rs = moduleRules[k]
    console.log(`  ${k.padEnd(10)} 增量 ${String(rs.length).padStart(3)} 条 / ${rs.reduce((s, b) => s + blockBytes(b), 0)} 字符`)
  }
  console.log(
    `令牌: 壳亮 ${SHELL.light.length} / 壳暗 ${SHELL.dark.length} / 九组色 ${Object.keys(proto).length} 组 / 内联定义 ${guard.inline} 个`,
  )
  console.log(`变量: 引用 ${guard.used} 个 / 定义 ${guard.defined} 个 / 缺失 0`)
  console.log(`产物长度: ${output.length} 字符`)
} else if (mode === '--check') {
  const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : ''
  if (prev !== output) {
    console.error('✗ src/styles/module-workspace.css 已过期，请运行：node design/build-workspace-css.mjs')
    process.exit(1)
  }
  console.log('✓ module-workspace.css 与原型一致')
} else {
  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, output)
  console.log(`✓ 已写入 ${path.relative(ROOT, OUT)}（${output.length} 字符）`)
  console.log(`  共用内核 ${coreRules.length} 条；模块增量 ${Object.values(moduleRules).reduce((s, r) => s + r.length, 0)} 条`)
  console.log(`  变量引用 ${guard.used} 个，全部有定义`)
}
