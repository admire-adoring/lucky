#!/usr/bin/env node
/**
 * 把令牌层编译/内联进 workbench.html。**两块，来源不同，别混**：
 *
 *   style#lucky-y-tw      ← src/styles/index.css 经 Tailwind v4 编译
 *                           布局与几何的工具类（flex / grid / 间距 / 字阶 / 圆角 / 动效）
 *   style#lucky-y-prism   ← src/styles/prism.css 原样内联
 *                           材质 / 颜色 / 边界 / 阴影 / 主题 / 九组模块色系
 *                           （DESIGN_TOKENS.md 的实现，纯 CSS，不经 Tailwind）
 *
 * 为什么要跑脚本而不是手写一份 CSS：
 *   设计令牌唯一的事实源是 src/ 下的那两个文件。手抄一份出去，
 *   等于把令牌复制了第二份 —— 它一定会漂移（DESIGN_SYSTEM.md §6.4 就是这个教训，
 *   meta.ts 的 hex 字段至今还留着两个旧值）。所以这里直接调用项目自身装的
 *   Tailwind v4 编译器，让原型的令牌与 src 严格同源。
 *
 * 为什么 prism.css 不过 Tailwind：
 *   它的三层结构（刻度 → 槽位 → 档位）与"材质不放进 @layer"这两条，都不是工具类能表达的；
 *   过一遍编译器只会多一层 `@layer` 与产出顺序的不确定性。原样内联 = 读到什么就是什么。
 *
 * 用法：
 *   node design/build-css.mjs            # 编译并内联进 design/workbench.html
 *   node design/build-css.mjs --check    # 只校验产物是否最新，不写盘（CI 用）
 *
 * 实现细节：
 *   · compile / Scanner 走 .pnpm 里的真身路径 —— pnpm 的严格 node_modules 下，
 *     @tailwindcss/node 与 oxide 不是本包的直接依赖，裸 import 会 ERR_MODULE_NOT_FOUND。
 *     因此按「目录 + 版本无关通配」解析，避免把版本号写死在这里。
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.resolve(HERE, '..')
const TARGET_NAME = 'workbench.html'
const TARGET = path.join(HERE, TARGET_NAME)
const TOKENS = path.join(PROJECT, 'src/styles/index.css')
const PRISM = path.join(PROJECT, 'src/styles/prism.css')
const STYLE_ID = 'lucky-y-tw'
const PRISM_STYLE_ID = 'lucky-y-prism'

/** 从 pnpm 的虚拟store 里按包名解析真身入口（版本号不写死） */
function resolveFromPnpm(pkg, entry) {
  const scope = pkg.startsWith('@') ? pkg.split('/')[0] : null
  const name = pkg.startsWith('@') ? pkg.split('/')[1] : pkg
  const dirName = `${name}@`
  const roots = readdirSync(path.join(PROJECT, 'node_modules/.pnpm')).filter(
    (d) => d.startsWith(dirName) || (scope && d.startsWith(pkg.replace('/', '+') + '@')),
  )
  if (roots.length === 0) throw new Error(`pnpm store 里找不到 ${pkg}，先在 client/lucky 跑一次安装`)
  // 同名多版本时取排序最大的一个
  const root = roots.sort().at(-1)
  const file = path.join(PROJECT, 'node_modules/.pnpm', root, 'node_modules', pkg, entry)
  if (!existsSync(file)) throw new Error(`缺少入口文件：${file}`)
  return pathToFileURL(file).href
}

const { compile } = await import(resolveFromPnpm('@tailwindcss/node', 'dist/index.mjs'))
const { Scanner } = await import(resolveFromPnpm('@tailwindcss/oxide', 'index.js'))

const rawTokens = await readFile(TOKENS, 'utf8')

/* ⚠️ 编译给**原型**的那份入口要先把这几行 `@import` 摘掉。
   ----------------------------------------------------------------------------
   `src/styles/index.css` 现在是**应用**的样式入口，它除了 Tailwind 之外还拉进
   `prism.css` / `workbench-hero.css` / `module-workspace.css` / `workspace-shell.css`
   （应用需要它们）。
   而这个脚本把 index.css 编译成 `style#lucky-y-tw` 内联进原型 ——
   原型**已经**分别内联了这些（`style#lucky-y-prism` 与它自带的 `lucky-y-tw-hero` 块，
   9 个模块页各自内联了自己那份 CSS）。
   不摘的话，同一份令牌与同一套 hero 几何会在页面里出现**两遍**：
   体积翻倍之外，`@property` 与同特异性规则**重复注册**还会让过渡行为变得不可预期。

   判据：这里要的是"**应用的布局工具类**"，不是"应用完整的样式入口"。
   ⚠️ 每一行都必须真的在 —— 找不到就报错，别让"哪天改了导入写法、摘不掉了"
      变成静默地把 CSS 内联两遍。

   ⚠️ `./design-tokens.css` **刻意不在这张表里**。判据是"这个文件在原型里有没有第二份副本"：
      上面四个都有（原型各自内联了 prism / hero / 模块页 CSS），
      而 design-tokens.css 没有 —— 摘掉它，原型就丢了 `--radius-*` / `--c-*` / `--grad-ai`，
      而 `rounded-sm`(75) / `rounded-xl`(73) 会**静默**回落到 Tailwind 默认值（4px / 12px）。
      留着让编译器内联进来，正好排在 prism 之前，`var(--r-ctl)` 这类引用也能解析。 */
const STRIP = [
  "@import './prism.css';",
  "@import './workbench-hero.css';",
  "@import './module-workspace.css';",
  "@import './workspace-shell.css';",
]
for (const line of STRIP) {
  if (!rawTokens.includes(line)) {
    throw new Error(`src/styles/index.css 里找不到 ${line} —— 导入写法变了，build-css 的摘除逻辑要跟着改`)
  }
}
const css = rawTokens.split('\n').filter((l) => !STRIP.includes(l.trim())).join('\n')
const prism = await readFile(PRISM, 'utf8')
const html0 = await readFile(TARGET, 'utf8')

/* ---- lint：CSS 注释里不许出现「紧贴文字的注释收尾符」 ----
   （⚠️ 本条注释自己就是活教材：这里原本写的是那两个字符本身，
   结果把一个 JS 块注释**提前闭合**了 —— 同一个坑，在 CSS 里吃掉了整块令牌，
   在 JS 里直接变成 SyntaxError。所以下面提到它时一律用文字描述，不写字面量。）
   一条**只花两行、却拦住了一整块令牌静默失效**的检查。
   实测：prism.css 的注释里写了「--m-a 星斜 --m-b 星」，那个星斜把注释提前闭合，
   其后半句变成裸 CSS 记号，浏览器的错误恢复一路吃到下一个 `{`，
   于是紧跟其后的 `:root { --s-* / --a-* / --brand-a-* }` **整块被丢弃** ——
   九个模块的强调色全部取不到值，Hero 退回 @property 的兜底靛蓝。

   这类失效有三个特点，正是最该用机械守卫钉住的那种：
     · 报错为零（CSS 的容错性把语法错误吃掉了）；
     · 编辑器语法高亮一切正常（它按同样规则解析，高的就是"后半句不是注释"）；
     · 页面照常渲染，只是"九个模块一个颜色"，只有把两张截图并排看才发现。
   判据：注释的收尾符前面应当只有空白或星号；紧贴普通字符的一定是误伤。 */
function lintComments(s, label) {
  const hits = []
  for (const m of s.matchAll(/[^\s*]\*\//g)) {
    const at = m.index
    const line = s.slice(0, at).split('\n').length
    hits.push(`第 ${line} 行：…${s.slice(Math.max(0, at - 46), at + 3).split('\n').pop()}`)
  }
  if (hits.length) {
    throw new Error(`${label} 的注释里有「紧贴文字星号的注释收尾符」，会提前闭合注释、静默吃掉后面的规则：\n    ` + hits.join('\n    '))
  }
}
lintComments(prism, 'src/styles/prism.css')

/* ---- lint：极光色块的**边界必须落在视口内** ----
   这条拦的缺陷**零报错、零语法高亮、页面照常渲染**，只有把两张截图并排看才发现：
     半径远大于视口时（实测 148% 124%），色块本体落在屏幕外，画面上只剩"渐变的整体偏移"，
     **找不到任何可辨认的色块边界**。而玻璃要显示给用户看的恰恰是色块边界 →
     「透过玻璃」与「什么都没透过」在观感上不可区分，面板再透也没用。
     实测：格间标准差 R 17.4/G 17.0 → 11.7/9.7。

   ⚠️ 判据不是"半径要小" —— 那样会把第 ⑧ 层（中央色雾）一起拦掉。真正成立的那条是：
       **半径 × 淡出止点 ≤ 100%**，即"渐变在视口内就淡干净了"。
       148%×86% = 127%（坏）· 30%×76% = 23%（好）· 72%×72% = 52%（色雾，好）。
       钉的是缺陷不是位置 —— 色块挪到哪儿都合法，只要它的边界还在屏幕里。

   ⚠️ 切函数要用**括号配平**，因为 color-mix(...) 里还有一层括号，正则切不动。 */
function radialBlobs(body) {
  const out = []
  const re = /radial-gradient\(/g
  let m
  while ((m = re.exec(body))) {
    let i = m.index + m[0].length
    const from = i
    let depth = 1
    while (i < body.length && depth > 0) {
      if (body[i] === '(') depth++
      else if (body[i] === ')') depth--
      i++
    }
    const args = body.slice(from, i - 1)
    const sizes = args.match(/^\s*([\d.]+)%\s+([\d.]+)%/)
    if (!sizes) continue
    const pcts = [...args.matchAll(/([\d.]+)%/g)].map((x) => parseFloat(x[1]))
    out.push({ rx: parseFloat(sizes[1]), ry: parseFloat(sizes[2]), stop: pcts[pcts.length - 1] })
  }
  return out
}
function lintAurora(s, label) {
  const code = s.replace(/\/\*[\s\S]*?\*\//g, '') // ⚠️ 必须先剥注释：注释里就写着 148%/124% 这个反例
  /* ⚠️ 只收**声明了 background-image 的**极光规则。文件里还有一条
     `prefers-reduced-motion` 下的 `.ambient__aurora { animation: none !important }` ——
     它也带这个类名，但一个色块都没有；按类名收就会误报（第一次写就报了"第 3 条只有 0 个色块"）。 */
  const rules = [...code.matchAll(/([^{}]*ambient__aurora[^{}]*)\{([^}]*)\}/g)]
    .filter(([, , body]) => body.includes('background-image'))
  if (rules.length < 2) {
    throw new Error(`${label} 的极光层只找到 ${rules.length} 条带 background-image 的规则 —— 亮/暗两套主题各要一条`)
  }
  const bad = []
  rules.forEach(([, , body], i) => {
    const blobs = radialBlobs(body)
    if (blobs.length < 6) {
      throw new Error(`${label} 第 ${i + 1} 条极光规则只有 ${blobs.length} 个色块（<6）—— 层数少 → 页内色相单一`)
    }
    for (const b of blobs) {
      if (b.rx * b.stop > 10000 || b.ry * b.stop > 10000) {
        bad.push(`第 ${i + 1} 条规则：${b.rx}% × ${b.stop}% = ${Math.round(b.rx * b.stop / 100)}%（边界在视口外）`)
      }
    }
  })
  if (bad.length) {
    throw new Error(`${label} 的极光色块淡不完（边界落到视口外）—— "透过玻璃"看不见东西：\n    ` + bad.join('\n    '))
  }
  /* ⚠️ 这两支没声明 → `color-mix(… var(--m-mix) …)` 变成非法值 → 整条 background-image
     被丢弃（回落成 none）。同样是"零报错"的那一类。 */
  for (const tok of ['--m-mix', '--m-heat']) {
    if (!new RegExp(`^\\s*${tok}\\s*:`, 'm').test(code)) {
      throw new Error(`${label} 缺 ${tok} 的声明 —— 极光层的 color-mix 会整条失效（背景变纯色，不报错）`)
    }
  }
}
lintAurora(prism, 'src/styles/prism.css')

/* 同样的检查只对原型里那块**手写**的 hero 样式跑一次。
   ⚠️ 不要顺手把内联的 prism 块也查了 —— html0 是**上一轮**的产物，
   它里面正是刚被发现的那个坏注释；查它等于让脚本第一次永远跑不过去。
   事实源 prism.css 已经查过了，产物是它的副本，不必重复查。 */
for (const m of html0.matchAll(/<style id="(lucky-y-tw-hero)">([\s\S]*?)<\/style>/g)) {
  lintComments(m[2], `workbench.html 的 style#${m[1]}`)
}

// 1) 用 Tailwind 自己的扫描器取候选类名（任意值、变体、修饰符都由它解析，不自己写正则）
const candidates = new Scanner({
  sources: [{ base: HERE, pattern: TARGET_NAME, negated: false }],
}).scan()

// 2) 以 src/styles/index.css 为入口编译（base 指向它所在目录，便于解析 node_modules）
//    ⚠️ onDependency 必须显式传：@tailwindcss/node 的默认加载器会无条件回调它，
//    缺省传 undefined 会在 loadStylesheet 里抛 "t is not a function"（不传就报错的坑）。
//    它的用途是「返回本次编译依赖到的文件清单」，这里只需要跑通，给个空实现。
const compiler = await compile(css, { base: path.dirname(TOKENS), onDependency: () => {} })
const built = compiler.build(candidates)

/* 3) 内联：只替换指定 style 块的内容，其余标记一律不动。
 *    ⚠️ 必须按「整行」锚定，不能用裸的 indexOf —— 踩过一次：head 的说明注释里
 *    写了「产物内联在下方 <style id="lucky-y-tw">」这句正文，indexOf 命中的是
 *    注释里那次提及，于是替换区间从注释内部一路吃到真正的 </style>，
 *    结果注释没了收尾、把整段 CSS 吞进注释里，浏览器连 style 元素都没建（styleSheets=0）。
 *    ⚠️ 同一类坑的第二形态：CSS 正文里出现 `</style>` 也会提前收尾。
 *    prism.css 的注释里因此刻意**不写**标签字面量（要提就用「」包住）。 */
function inlineStyle(html, id, body, banner) {
  const openRe = new RegExp(`^[\\t ]*<style id="${id}">[\\t ]*$`, 'm')
  const openMatch = openRe.exec(html)
  if (!openMatch) throw new Error(`找不到独占一行的 <style id="${id}">，原型文件被改过？`)
  const bodyStart = openMatch.index + openMatch[0].length
  const end = html.indexOf('</style>', bodyStart)
  if (end === -1) throw new Error(`style#${id} 标签没有闭合`)
  if (body.includes('</style>')) throw new Error(`style#${id} 的 CSS 正文里出现了 </style>，会提前收尾`)
  return html.slice(0, bodyStart) + banner + body + '\n    ' + html.slice(end)
}

const twBanner = [
  '',
  '      /* ==========================================================================',
  '         由 design/build-css.mjs 生成 —— 请勿手改。',
  '         入口：src/styles/index.css（布局与几何的工具类）',
  `         候选：${candidates.length} 个类名 · 产出：${(built.length / 1024).toFixed(1)} KB`,
  '         改完 workbench.html 的类名后重跑：node design/build-css.mjs',
  '         ========================================================================== */',
  '',
].join('\n')

const prismBanner = [
  '',
  '      /* ==========================================================================',
  '         由 design/build-css.mjs 内联自 src/styles/prism.css —— 请勿手改。',
  '         材质 / 颜色 / 边界 / 阴影 / 主题 / 九组模块色系（DESIGN_TOKENS.md 的实现）。',
  `         产出：${(prism.length / 1024).toFixed(1)} KB`,
  '         派生色（--brand-* / --m-a* / --m-b*）由 design/prism-derive-colors.mjs --write 反解。',
  '         ========================================================================== */',
  '',
].join('\n')

// 顺序有意义：prism 必须排在 tw 之后（未分层的材质规则要压过工具类层）
let next = inlineStyle(html0, STYLE_ID, built, twBanner)
next = inlineStyle(next, PRISM_STYLE_ID, prism, prismBanner)
const a = next.indexOf(`<style id="${PRISM_STYLE_ID}">`)
const b = next.indexOf(`<style id="${STYLE_ID}">`)
if (a < b) {
  console.error(`✗ style#${PRISM_STYLE_ID} 排在了 style#${STYLE_ID} 之前 —— 材质会被工具类层压住`)
  process.exit(1)
}

if (process.argv.includes('--check')) {
  if (next !== html0) {
    console.error('✗ workbench.html 的内联 CSS 已过期，请重跑：node design/build-css.mjs')
    process.exit(1)
  }
  console.log('✓ 两块内联 CSS 都已是最新')
} else {
  await writeFile(TARGET, next)
  console.log(`✓ 已写入 ${path.relative(PROJECT, TARGET)}`)
  console.log(`  候选类名 ${candidates.length} 个 · 工具类 CSS ${(built.length / 1024).toFixed(1)} KB · Prism 令牌 ${(prism.length / 1024).toFixed(1)} KB`)
}
