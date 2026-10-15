#!/usr/bin/env node
/* 极光层参数扫描：混比（色团色 ↔ 强调色）× 强度。
   ----------------------------------------------------------------------------
   为什么要有"混比"这个旋钮：
     色团（--m-lt-*）是**淡彩**，铺得再足也到不了参照版的饱和区间；
     强调色（--s）是饱和的，但只有一支色相，全用它就丢掉页内色相变化。
     所以色块颜色 = 两者的混色，混比是旋钮。
   判据（v2 参照版实测）：格间标准差 R 17.4 / G 17.0 / B 4.2 · 彩度极差 0.253 · 亮度极差 66.2
   用法：node design/debug/sweep-aurora.mjs [outDir]
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(DIR, 'workbench.html')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = process.argv[2] || '/tmp/sweep-aurora'
fs.mkdirSync(OUT, { recursive: true })

/* w = 色团的占比（%）；其余部分给强调色。scale 乘在弥散 α 上。 */
const mix = (sw, alpha, w) =>
  `color-mix(in srgb, rgb(var(${sw}) / ${alpha}) ${w}%, rgb(var(--s) / ${alpha}))`

const build = (dark, scale, w) => {
  const P = dark ? '--m-dk' : '--m-lt'
  const A = dark ? '--m-b' : '--m-a'
  const a = (n) => `calc(var(${A}${n}) * ${scale})`
  return `
    linear-gradient(180deg, rgb(var(--s) / calc(var(--m-tint) * 0.60)) 0%, rgb(var(--s) / 0) 7.2%),
    radial-gradient(30% 11% at 6% 0%, ${mix(`${P}-1`, a(1), w)} 0%, transparent 76%),
    linear-gradient(96deg,
      rgb(var(--s) / calc(var(--m-tint) * 0.95)) 0%,
      rgb(var(--s) / calc(var(--m-tint) * 0.50)) 13%,
      rgb(var(--s) / 0) 21%),
    radial-gradient(40% 25% at 101% -2%, ${mix(`${P}-2`, a(2), w)} 0%, transparent 74%),
    radial-gradient(19% 41% at 7% 104%, ${mix(`${P}-3`, a(3), w)} 0%, transparent 74%),
    radial-gradient(27% 33% at 100% 100%, ${mix(`${P}-2`, a(2), w)} 0%, transparent 72%),
    radial-gradient(31% 35% at 54% 102%, ${mix(`${P}-1`, a(1), w)} 0%, transparent 76%),
    radial-gradient(72% 62% at 50% 42%, rgb(var(--s) / calc(var(--m-tint) * 0.26)) 0%, transparent 72%)`
}

const css = (scale, w) => `
.ambient__aurora{background-image:${build(false, scale, w)}}
:root:not([data-theme='light']) .ambient__aurora{background-image:${build(true, scale, w)}}`

const GRID = []
for (const w of [55, 75, 100]) for (const scale of [0.5, 0.75]) GRID.push({ w, scale })

const src = fs.readFileSync(SRC, 'utf8')
const ANCHOR_L = 'data-theme="light" data-glass="strong" data-series="home"'
const ANCHOR_D = 'data-theme="dark" data-glass="strong" data-series="home"'
if (!src.includes(ANCHOR_L)) throw new Error('找不到锚点')

for (const { w, scale } of GRID) {
  const name = `m${String(w).padStart(3, '0')}-s${String(Math.round(scale * 100)).padStart(3, '0')}`
  const html = src.replace('</head>', `<style>${css(scale, w)}</style></head>`)
  for (const theme of ['light', 'dark']) {
    const h = theme === 'light' ? html : html.replace(ANCHOR_L, ANCHOR_D)
    const hf = path.join(OUT, `${name}-${theme}.html`)
    fs.writeFileSync(hf, h)
    spawnSync(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--force-device-scale-factor=1', '--allow-file-access-from-files',
      '--virtual-time-budget=2400', '--window-size=1440,900',
      `--screenshot=${path.join(OUT, `${name}-${theme}.png`)}`, `file://${hf}`,
    ], { encoding: 'utf8' })
  }
  console.log(`✓ ${name}`)
}
console.log(`\n产物：${OUT}`)
