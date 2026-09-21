#!/usr/bin/env node
/* ============================================================================
   由 9 个原型的设计原值反解「派生色」（原值表本身是生成物，见 sync-module-colors.mjs）
   ----------------------------------------------------------------------------
   只认两样原值：① 强调色 --s-<模块> ② 亮色色团 --a-<模块>-1/2/3 —— 都取自 9 个原型。
   其余六支必须**反解**，不能手估：

     --brand-a / --brand-b   填充色（承白字）：同色相，相对亮度 Y 固定为 0.180 / 0.170
     --brand-ink / --brand-line  文字色与边界色：亮暗各一支，按「实测底衬」反解
     --m-a1..3 / --m-b1..3   弥散 α：色团色度差十倍，统一 α 会造成 2.2 倍浓度差
     --m-lt-1..3            亮色色团的 RGB 三元组（公式要用 rgb(var(--m-lt-1) / α)）

   为什么 Y 能直接定死：
     白字对比度 = 1.05 / (Y + 0.05) ≥ 4.5  →  Y ≤ 0.1833   （上界，固定）
     填充 vs 底衬 = (Y + 0.05) / (Y底 + 0.05) ≥ 3  →  Y ≥ 3(Y底 + 0.05) − 0.05
     所以 a/b 取 0.180 / 0.170 正好卡在这条上界之下，且仍在两种底衬的下界之上。

   用法：
     node design/prism-derive-colors.mjs                      # 打印反解结果
     node design/prism-derive-colors.mjs --write              # 把派生区写回 src/styles/prism.css
     node design/prism-derive-colors.mjs --json               # 输出明细
     node design/prism-derive-colors.mjs --write \
          --substrate=light=0.73,dark=0.045 --target=light=30,dark=26
        ↑ 底衬亮度是**实测**出来的（玻璃上的对比度无法从令牌推算），浓度是可调旋钮。
   ========================================================================= */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))


/* ---------- sRGB ↔ 线性 / OKLab ---------- */
const srgbToLin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const linToSrgb = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055)
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)

/** WCAG 相对亮度（就是规范里的 "L"） */
function relLum([r, g, b]) {
  const [R, G, B] = [r, g, b].map((v) => srgbToLin(v / 255))
  return 0.2126 * R + 0.7152 * G + 0.0722 * B
}
function contrast(a, b) {
  const [hi, lo] = relLum(a) > relLum(b) ? [relLum(a), relLum(b)] : [relLum(b), relLum(a)]
  return (hi + 0.05) / (lo + 0.05)
}
const hex = ([r, g, b]) =>
  '#' + [r, g, b].map((v) => Math.round(clamp01(v / 255) * 255).toString(16).padStart(2, '0')).join('')
const rgbTriplet = ([r, g, b]) => [r, g, b].map((v) => Math.round(v)).join(' ')

/** sRGB → OKLCH（OKLab 的 L/C/h）。用它来做"定色相、定亮度、最大化彩度"的搜索。 */
function toOklch([r, g, b]) {
  const [R, G, B] = [r, g, b].map((v) => srgbToLin(v / 255))
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B)
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B)
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B)
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s
  return { L, C: Math.hypot(a, bb), h: Math.atan2(bb, a) }
}
function fromOklch({ L, C, h }) {
  const a = C * Math.cos(h)
  const bb = C * Math.sin(h)
  const l = (L + 0.3963377774 * a + 0.2158037573 * bb) ** 3
  const m = (L - 0.1055613458 * a - 0.0638541728 * bb) ** 3
  const s = (L - 0.0894841775 * a - 1.291485548 * bb) ** 3
  return [
    linToSrgb(+4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) * 255,
    linToSrgb(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) * 255,
    linToSrgb(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s) * 255,
  ]
}
const inGamut = (rgb) => rgb.every((v) => v >= -0.5 && v <= 255.5)

/** 某 L 下、该色相在 sRGB 内的最大彩度 */
function maxChromaAt(hueRad, L, maxC = 0.37) {
  let cLo = 0
  let cHi = maxC
  for (let i = 0; i < 50; i++) {
    const mid = (cLo + cHi) / 2
    if (inGamut(fromOklch({ L, C: mid, h: hueRad }))) cLo = mid
    else cHi = mid
  }
  return Math.min(cLo, maxC)
}

/** 反解填充色：**保色相、保彩度**，只解 L 让 WCAG 相对亮度落在 targetY。
 *
 *  ⚠️ 两个坑（第一版两个都踩了，数值差了 10%）：
 *  ① 亮度是 (L, C) 的二元函数 —— 先在 C=0 时解出 L、再把彩度加上去，
 *     加进去的彩度本身会抬亮度（实测 0.180 变成 0.197，白字对比度 4.83 → 4.25，跌破 4.5）。
 *     所以必须"带着彩度解 L"，且改 C 之后要重新解 L。
 *  ② 某些 L 下原彩度会越出 sRGB —— 那就先把 C 收到边界，再重解 L。
 *     两者交替收敛（不动点：C 正好落在边界上）。 */
function solveAtY(hueRad, targetY, chroma, { maxC = 0.37 } = {}) {
  let C = Math.min(chroma, maxC)
  let L = 0.5
  for (let iter = 0; iter < 40; iter++) {
    // ① 固定 C，二分 L
    let lo = 0
    let hi = 1
    for (let i = 0; i < 55; i++) {
      const mid = (lo + hi) / 2
      if (relLum(fromOklch({ L: mid, C, h: hueRad })) < targetY) lo = mid
      else hi = mid
    }
    L = (lo + hi) / 2
    // ② 该 L 下把 C 收到边界
    const cMax = maxChromaAt(hueRad, L, maxC)
    if (C <= cMax) break
    C = cMax
  }
  return { rgb: fromOklch({ L, C, h: hueRad }), L, C }
}

/* @from-prototypes:start */
/* ---------- 设计原值（**生成物**，不要手改）----------
   由 design/sync-module-colors.mjs 从 9 个原型抽取：
     s      ← 原型 :root 的 --s-<模块>
     ring   ← 原型 :root 的 --a-<模块>-1/2/3（亮色色团）
     dk     ← 原型 .dark 的 --a-<模块>-1/2/3（暗色色团，原型的暗色弥散就用它们铺）
   改色只改原型，然后 `node design/sync-module-colors.mjs --write`。
   --check 会拦住"改了原型忘了同步"和"两边各自演化"这两种漂移。 */
const MODULES = [
  { key: 'dashboard', name: '靛蓝', s: [99, 102, 241], ring: ['#A5B4FC', '#C4B5FD', '#BAE6FD'], dk: [[79, 70, 229], [124, 58, 237], [14, 165, 233]] },
  { key: 'tasks', name: '琥珀', s: [245, 158, 11], ring: ['#FDE68A', '#FED7AA', '#FEF3C7'], dk: [[180, 83, 9], [194, 65, 12], [146, 64, 14]] },
  { key: 'calendar', name: '天青', s: [14, 165, 233], ring: ['#7DD3FC', '#A5F3FC', '#BAE6FD'], dk: [[2, 132, 199], [14, 116, 144], [7, 89, 133]] },
  { key: 'life', name: '翡翠', s: [16, 185, 129], ring: ['#86EFAC', '#A7F3D0', '#BBF7D0'], dk: [[5, 150, 105], [4, 120, 87], [6, 95, 70]] },
  { key: 'work', name: '玫瑰', s: [225, 29, 72], ring: ['#FDA4AF', '#FECDD3', '#FBCFE8'], dk: [[190, 18, 60], [159, 18, 57], [136, 19, 55]] },
  { key: 'learning', name: '洋红', s: [217, 70, 239], ring: ['#F0ABFC', '#E9D5FF', '#FBCFE8'], dk: [[162, 28, 175], [134, 25, 143], [112, 26, 117]] },
  { key: 'projects', name: '橘橙', s: [249, 115, 22], ring: ['#FDBA74', '#FED7AA', '#FDE68A'], dk: [[234, 88, 12], [194, 65, 12], [154, 52, 18]] },
  { key: 'knowledge', name: '青碧', s: [20, 184, 166], ring: ['#99F6E4', '#A7F3D0', '#CCFBF1'], dk: [[20, 184, 166], [15, 118, 110], [17, 94, 89]] },
  { key: 'settings', name: '石板', s: [71, 85, 105], ring: ['#B8C4D9', '#C9D5E5', '#DCE4F0'], dk: [[90, 107, 130], [68, 84, 107], [46, 59, 82]] },
]
/* @from-prototypes:end */

const pct = (n) => (n * 100).toFixed(1) + '%'
const out = {}
for (const m of MODULES) {
  const okl = toOklch(m.s)
  const a = solveAtY(okl.h, 0.18, okl.C)
  const b = solveAtY(okl.h, 0.17, okl.C)
  out[m.key] = {
    name: m.name,
    accent: m.s,
    accentHex: hex(m.s),
    hueDeg: ((okl.h * 180) / Math.PI + 360) % 360,
    chroma: okl.C,
    fillA: hex(a.rgb),
    fillB: hex(b.rgb),
    ringHex: m.ring,
    ringRgb: m.ring.map((h) => rgbTriplet([1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))),
    darkRgb: m.dk,
  }
}

/* ============================================================================
   派生区：写进 src/styles/prism.css 的 @derived:modules 区间
   ----------------------------------------------------------------------------
   为什么由脚本写、不手抄：这六支里的每一支都是**反解**出来的（窗口只有 0.0143 宽），
   手抄一次就一定会在某次"顺手调一下"里漂掉，而漂掉的后果是白字对比度跌破 4.5:1 ——
   肉眼看不出、只有门禁能发现。所以每次运行都整体重写（"每次覆盖"，不是"命中才替换"）。
   ========================================================================= */
const A = (n) => Number(n.toFixed(4))

/** 色团的 OKLCH 彩度 —— 弥散 α 要按它反解（色团色度差十倍，统一 α 会造成 2.2 倍浓度差） */
const chromaOf = (rgb) => toOklch(rgb).C

/** 给定底衬亮度与目标对比度，反解一支"线 / 文字"色的目标亮度。
 *  方向由主题定：亮色底衬 → 线要比底衬**暗**；暗色底衬 → 线要比底衬**亮**。
 *  这里统一写成"解出的 Y 与底衬 Y 的距离"，方向交给 solveAtY 的单调性自然落位。 */
const lineYFor = (subY, ratio, darker) =>
  darker ? (subY + 0.05) / ratio - 0.05 : ratio * (subY + 0.05) - 0.05

function emitModules({ subLight, subDark, targetLight, targetDark }) {
  const L = []
  const P = (s) => L.push(s)

  P('/* ---- 色表：与主题无关的原值（强调色 / 色团 / 暗色色团）---- */')
  P(':root {')
  for (const m of MODULES) {
    const v = out[m.key]
    P(`  /* ${m.name} */`)
    P(`  --s-${m.key}: ${v.accent.join(' ')};`)
    P(`  --a-${m.key}-1: ${m.ring[0]};`)
    P(`  --a-${m.key}-2: ${m.ring[1]};`)
    P(`  --a-${m.key}-3: ${m.ring[2]};`)
    P(`  --m-dk-1-${m.key}: ${m.dk[0].join(' ')};`)
    P(`  --m-dk-2-${m.key}: ${m.dk[1].join(' ')};`)
    P(`  --m-dk-3-${m.key}: ${m.dk[2].join(' ')};`)
    P(`  --m-lt-1-${m.key}: ${v.ringRgb[0]};`)
    P(`  --m-lt-2-${m.key}: ${v.ringRgb[1]};`)
    P(`  --m-lt-3-${m.key}: ${v.ringRgb[2]};`)
    P(`  --brand-a-${m.key}: ${v.fillA};`)
    P(`  --brand-b-${m.key}: ${v.fillB};`)
  }
  P('}')
  P('')

  /* 弥散 α：把"色团色度差十倍"这件事补平，让各套的**观感浓度**接近。
     ⚠️ 方向是 α ∝ 彩度（彩度越高、铺得越足），**不是** α ∝ 1/彩度 —— 第一版写反了。
     想清楚"合成色有多浓"是怎么来的就不会写错：
       合成 = (1-α)·底衬 + α·色团  ⇒  偏离底衬的程度 ∝ α · |色团 − 底衬|
     色团1 那几支几乎是白（#DEFAF3 的彩度 ~0.03），**它们与底衬的差是"更白"**：
     铺得越足，画面越白、越没颜色。所以淡色团要少铺、饱和色团才多铺。
     写反的后果不是"不够浓"，而是**越调越白**（实测就是那样：彩度一直在 0.8~2.8 上不去）。
     ⚠️ 上界夹在 0.85：再高就变成"把色团原色直接盖上去"，那是刷漆不是弥散。
     ⚠️ dashboard（微光夜语）按设计"夜色要有颜色"，有意高于其他套 —— 单独一个倍数。 */
  const NORM = 0.8
  const LO = 0.12
  const HI = 0.92
  const alphaOf = (c, med, k) => Math.min(HI, Math.max(LO, (NORM * k * c) / med))
  const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)]

  const chromaOfHex = (h) => chromaOf([1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))
  const lightC = MODULES.flatMap((m) => m.ring.map(chromaOfHex))
  const darkC = MODULES.flatMap((m) => m.dk.map((t) => chromaOf(t)))
  const medL = median(lightC)
  const medD = median(darkC)

  P('/* ---- 弥散 α（可调旋钮）：按色团彩度归一，逐套独立 ---- */')
  P(`/* 色团彩度中位数：亮 ${A(medL)} / 暗 ${A(medD)}；α = ${NORM} × 本色团彩度 / 中位数（夹到 ${LO}~${HI}） */`)
  P(':root {')
  for (const m of MODULES) {
    const k = m.key === 'dashboard' ? 1.55 : 1
    const a1 = alphaOf(chromaOfHex(m.ring[0]), medL, k)
    const a2 = alphaOf(chromaOfHex(m.ring[1]), medL, k)
    const a3 = alphaOf(chromaOfHex(m.ring[2]), medL, k)
    const b1 = alphaOf(chromaOf(m.dk[0]), medD, k)
    const b2 = alphaOf(chromaOf(m.dk[1]), medD, k)
    const b3 = alphaOf(chromaOf(m.dk[2]), medD, k)
    P(`  --m-a1-${m.key}: ${A(a1)}; --m-a2-${m.key}: ${A(a2)}; --m-a3-${m.key}: ${A(a3)};  /* 亮 ${m.name} */`)
    P(`  --m-b1-${m.key}: ${A(b1)}; --m-b2-${m.key}: ${A(b2)}; --m-b3-${m.key}: ${A(b3)};`)
  }
  P('}')
  P('')

  /* 文字色与边界色：亮暗各一支，按**实测底衬**反解（玻璃上的对比度无法从令牌推算） */
  P('/* ---- 文字 / 边界：按实测底衬反解（亮暗各一支）---- */')
  const inkOf = (m, subY, ratio, darker) => {
    const okl = toOklch(m.s)
    return hex(solveAtY(okl.h, lineYFor(subY, ratio, darker), okl.C).rgb)
  }
  const THEMES = [
    { sel: ':root', subY: subDark, darker: false, tag: '暗色（:root 默认）' },
    { sel: 'html[data-theme=\'light\']', subY: subLight, darker: true, tag: '亮色' },
  ]
  for (const t of THEMES) {
    P(`/* ${t.tag} · 底衬亮度 Y=${A(t.subY)} */`)
    P(`${t.sel} {`)
    for (const m of MODULES) {
      P(`  --brand-ink-${m.key}: ${inkOf(m, t.subY, 5.3, t.darker)};`)
      P(`  --brand-line-${m.key}: ${inkOf(m, t.subY, 3.2, t.darker)};`)
    }
    P('}')
    P('')
  }

  /* 语义色的 -bg / -line（-line 需 ≥3:1，规范 §2.6） */
  P('/* ---- 语义色的填充与边界（--ok/warn/bad/info 本身是硬约束，在 §1 手写）---- */')
  const SEM = { ok: [110, 231, 183], warn: [251, 191, 36], bad: [255, 192, 202], info: [147, 197, 253] }
  const SEM_L = { ok: [4, 84, 61], warn: [122, 74, 2], bad: [150, 16, 47], info: [29, 79, 184] }
  const TRIP = Object.fromEntries(MODULES.map((m) => [m.key, m.s]))
  for (const t of THEMES) {
    P(`/* ${t.tag} */`)
    P(`${t.sel} {`)
    for (const [name, darkTri] of Object.entries(SEM)) {
      const base = t.darker ? SEM_L[name] : darkTri
      const okl = toOklch(base)
      const line = hex(solveAtY(okl.h, lineYFor(t.subY, 3.2, t.darker), okl.C).rgb)
      P(`  --${name}-bg: rgb(${base.join(' ')} / 0.13);`)
      P(`  --${name}-line: ${line};`)
    }
    P('}')
    P('')
  }
  void TRIP

  /* 别名块：data-series（当前模块 → 整页氛围）与 data-module（每个入口 → 它自己的色）
     共用同一张色表。新增一个模块只需要在 MODULES 里加一行，两个属性空间同时生效。 */
  P('/* ---- 选择器：两个属性空间共用一个套件 ---- */')
  const ALIAS = {
    dashboard: ['dashboard', 'home'],
    tasks: ['tasks'],
    calendar: ['calendar', 'schedule'],
    life: ['life'],
    work: ['work'],
    learning: ['learning', 'learn'],
    projects: ['projects', 'project'],
    knowledge: ['knowledge'],
    settings: ['settings'],
  }
  for (const m of MODULES) {
    const k = m.key
    const names = ALIAS[k] ?? [k]
    const sels = names.flatMap((n) => [`[data-series="${n}"]`, `[data-module="${n}"]`])
    P(sels.join(', ') + ' {')
    P(`  --s: var(--s-${k});`)
    P(`  --brand-a: var(--brand-a-${k});`)
    P(`  --brand-b: var(--brand-b-${k});`)
    P(`  --brand-ink: var(--brand-ink-${k});`)
    P(`  --brand-line: var(--brand-line-${k});`)
    P(`  --m-lt-1: var(--m-lt-1-${k}); --m-lt-2: var(--m-lt-2-${k}); --m-lt-3: var(--m-lt-3-${k});`)
    P(`  --m-dk-1: var(--m-dk-1-${k}); --m-dk-2: var(--m-dk-2-${k}); --m-dk-3: var(--m-dk-3-${k});`)
    P(`  --m-a1: var(--m-a1-${k}); --m-a2: var(--m-a2-${k}); --m-a3: var(--m-a3-${k});`)
    P(`  --m-b1: var(--m-b1-${k}); --m-b2: var(--m-b2-${k}); --m-b3: var(--m-b3-${k});`)
    P('}')
  }
  return L.join('\n')
}

/* ---------- 参数：底衬亮度（实测值）与目标浓度 ---------- */
const argOf = (name, dflt) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`))
  return hit ? hit.slice(name.length + 3) : dflt
}
const SUB = argOf('substrate', 'light=0.73,dark=0.045')
const TGT = argOf('target', 'light=30,dark=26')
const parseKV = (s, keys) =>
  Object.fromEntries(
    s.split(',').map((kv) => {
      const [k, v] = kv.split('=')
      if (!keys.includes(k)) throw new Error(`未知的键 ${k}（应为 ${keys.join(' / ')}）`)
      return [k, Number(v)]
    }),
  )
const sub = parseKV(SUB, ['light', 'dark'])
const tgt = parseKV(TGT, ['light', 'dark'])
const derived = emitModules({ subLight: sub.light, subDark: sub.dark, targetLight: tgt.light, targetDark: tgt.dark })

if (process.argv.includes('--write')) {
  const CSS = path.join(DIR, '../src/styles/prism.css')
  const src = fs.readFileSync(CSS, 'utf8')
  const START = '/* @derived:modules:start */'
  const END = '/* @derived:modules:end */'
  const a = src.indexOf(START)
  const b = src.indexOf(END)
  if (a < 0 || b < 0) throw new Error('prism.css 里找不到 @derived:modules 区间标记')
  if (src.split(START).length - 1 !== 1) throw new Error('@derived 起点标记不唯一')
  const next = src.slice(0, a + START.length) + '\n' + derived + '\n' + src.slice(b)
  if (next === src) console.log('✓ prism.css 的派生区已是最新（逐字节一致）')
  else {
    fs.writeFileSync(CSS, next)
    console.log(`✓ 已写入 prism.css 派生区（${derived.split('\n').length} 行 · 底衬 light=${sub.light} dark=${sub.dark}）`)
  }
  process.exit(0)
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ out, substrate: sub, target: tgt }, null, 2))
  process.exit(0)
}

{
  const pad = (s, n) => String(s).padEnd(n, ' ')
  console.log('\n模块色系 · 反解结果（Y 为 WCAG 相对亮度，即规范里的 L）\n')
  console.log(pad('模块', 11) + pad('色系', 12) + pad('色相', 8) + pad('强调色', 18) + pad('填充a', 10) + pad('填充b', 10) + '白字对比/a·b')
  console.log('-'.repeat(86))
  for (const [k, v] of Object.entries(out)) {
    const wa = contrast([255, 255, 255], [1, 3, 5].map((i) => parseInt(v.fillA.slice(i, i + 2), 16)))
    const wb = contrast([255, 255, 255], [1, 3, 5].map((i) => parseInt(v.fillB.slice(i, i + 2), 16)))
    console.log(
      pad(k, 11) + pad(v.name, 12) + pad(v.hueDeg.toFixed(0) + '°', 8) +
      pad(`${v.accent.join(',')}`, 18) + pad(v.fillA, 10) + pad(v.fillB, 10) +
      `${wa.toFixed(2)} / ${wb.toFixed(2)}`,
    )
  }
  const Yof = (h) => relLum([1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)))
  const ys = Object.values(out).map((v) => [Yof(v.fillA), Yof(v.fillB)])
  console.log(`\n判据：白字 ≥4.5:1（上界 Y≤0.1833）；填充 vs 底衬 ≥3:1（亮 Y底≥0.123 / 暗 ≥0.169）`)
  console.log(`亮度自检：a 的 Y ∈ [${Math.min(...ys.map((y) => y[0])).toFixed(4)}, ${Math.max(...ys.map((y) => y[0])).toFixed(4)}] · ` +
    `b 的 Y ∈ [${Math.min(...ys.map((y) => y[1])).toFixed(4)}, ${Math.max(...ys.map((y) => y[1])).toFixed(4)}]`)
  console.log(`底衬：亮 ${sub.light} / 暗 ${sub.dark} · 目标浓度：亮 ${tgt.light} / 暗 ${tgt.dark}`)
  console.log('（加 --write 把派生区写回 src/styles/prism.css，加 --json 输出明细）\n')
}

