#!/usr/bin/env node
/* 重建极光层：把"3 个大而淡的渐晕"换成"8 个小而饱和的色块"。
   ----------------------------------------------------------------------------
   依据（用户已认可的旧版实测，逐层拆出来过）：
     旧版 = 8 层，半径 18%~40%，颜色**饱和**（强调色/品牌色原值），α 0.16~0.52
     现状 = 4 层，半径 128%~148%，颜色**淡**（色团原值），外加一层近全屏色罩 α≈1
   半径大于视口 → 只表现为"渐变的偏移"，没有可辨认的**色块边缘**；
   玻璃要显示的正是色块边缘。所以这一步是把半径收回来、把颜色推饱和。

   色相仍按模块走（"每个菜单域一种颜色"）：色块 = 色团色 与 **本模块强调色** 混色，
   混比是旋钮；这样九套色相互不相同，但都在同一族的饱和区间里。

   用法：node design/debug/experiment-aurora.mjs [outDir]
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(DIR, 'workbench.html')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = process.argv[2] || '/tmp/exp-aurora'
fs.mkdirSync(OUT, { recursive: true })

/* 色块颜色 = 色团 × 强调色的混色；α = 该色团的弥散 α × scale。
   ⚠️ color-mix 的两个入色**带同一个 α** 时，结果的 α 就是它（按 α 预乘插值）。 */
const mix = (swatch, alpha, w) =>
  `color-mix(in srgb, rgb(var(${swatch}) / ${alpha}) ${w}%, rgb(var(--s) / ${alpha}))`

/* 8 层结构照着旧版逐层对应（位置、半径、停点都沿用），只把颜色换成模块色。 */
const aurora = (s) => `
    linear-gradient(180deg, rgb(var(--s) / calc(var(--m-tint) * 0.55)) 0%, rgb(var(--s) / 0) 7.2%),
    radial-gradient(30% 11% at 6% 0%, ${mix('--m-lt-1', `calc(var(--m-a1) * ${s})`, 58)} 0%, transparent 76%),
    linear-gradient(96deg,
      rgb(var(--s) / calc(var(--m-tint) * 0.80)) 0%,
      rgb(var(--s) / calc(var(--m-tint) * 0.42)) 13%,
      rgb(var(--s) / 0) 21%),
    radial-gradient(40% 25% at 101% -2%, ${mix('--m-lt-2', `calc(var(--m-a2) * ${s})`, 58)} 0%, transparent 74%),
    radial-gradient(19% 41% at 7% 104%, ${mix('--m-lt-3', `calc(var(--m-a3) * ${s})`, 50)} 0%, transparent 74%),
    radial-gradient(27% 33% at 100% 100%, ${mix('--m-lt-2', `calc(var(--m-a2) * ${s})`, 62)} 0%, transparent 72%),
    radial-gradient(31% 35% at 54% 102%, ${mix('--m-lt-1', `calc(var(--m-a1) * ${s})`, 58)} 0%, transparent 76%),
    radial-gradient(72% 62% at 50% 42%, rgb(var(--s) / calc(var(--m-tint) * 0.22)) 0%, transparent 72%)`

const dark = (s) => `
    linear-gradient(180deg, rgb(var(--s) / calc(var(--m-tint) * 0.55)) 0%, rgb(var(--s) / 0) 7.2%),
    radial-gradient(30% 11% at 6% 0%, ${mix('--m-dk-1', `calc(var(--m-b1) * ${s})`, 58)} 0%, transparent 76%),
    linear-gradient(96deg,
      rgb(var(--s) / calc(var(--m-tint) * 0.80)) 0%,
      rgb(var(--s) / calc(var(--m-tint) * 0.42)) 13%,
      rgb(var(--s) / 0) 21%),
    radial-gradient(40% 25% at 101% -2%, ${mix('--m-dk-2', `calc(var(--m-b2) * ${s})`, 58)} 0%, transparent 74%),
    radial-gradient(19% 41% at 7% 104%, ${mix('--m-dk-3', `calc(var(--m-b3) * ${s})`, 50)} 0%, transparent 74%),
    radial-gradient(27% 33% at 100% 100%, ${mix('--m-dk-2', `calc(var(--m-b2) * ${s})`, 62)} 0%, transparent 72%),
    radial-gradient(31% 35% at 54% 102%, ${mix('--m-dk-1', `calc(var(--m-b1) * ${s})`, 58)} 0%, transparent 76%),
    radial-gradient(72% 62% at 50% 42%, rgb(var(--s) / calc(var(--m-tint) * 0.22)) 0%, transparent 72%)`

const VARIANTS = {
  'P0-现状': '',
  'P1-s30': `.ambient__aurora{background-image:${aurora(0.30)}}\n:root:not([data-theme='light']) .ambient__aurora{background-image:${dark(0.30)}}`,
  'P2-s45': `.ambient__aurora{background-image:${aurora(0.45)}}\n:root:not([data-theme='light']) .ambient__aurora{background-image:${dark(0.45)}}`,
  'P3-s60': `.ambient__aurora{background-image:${aurora(0.60)}}\n:root:not([data-theme='light']) .ambient__aurora{background-image:${dark(0.60)}}`,
  'P4-s80': `.ambient__aurora{background-image:${aurora(0.80)}}\n:root:not([data-theme='light']) .ambient__aurora{background-image:${dark(0.80)}}`,
}

const src = fs.readFileSync(SRC, 'utf8')
const ANCHOR = 'data-theme="light" data-glass="strong" data-series="home"'
if (!src.includes(ANCHOR)) throw new Error('找不到锚点')

for (const [name, css] of Object.entries(VARIANTS)) {
  const html = css ? src.replace('</head>', `<style>${css}</style></head>`) : src
  const f = path.join(OUT, `${name}.html`)
  fs.writeFileSync(f, html)
  for (const theme of ['light', 'dark']) {
    const h = theme === 'light' ? html : html.replace(ANCHOR, 'data-theme="dark" data-glass="strong" data-series="home"')
    const hf = path.join(OUT, `${name}-${theme}.html`)
    fs.writeFileSync(hf, h)
    const png = path.join(OUT, `${name}-${theme}.png`)
    const r = spawnSync(CHROME, [
      '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
      '--force-device-scale-factor=1', '--allow-file-access-from-files',
      '--virtual-time-budget=2400', '--window-size=1440,900',
      `--screenshot=${png}`, `file://${hf}`,
    ], { encoding: 'utf8' })
    if (!fs.existsSync(png)) console.error(`✗ ${name}-${theme}: ` + (r.stderr || '').slice(0, 160))
  }
  console.log(`✓ ${name}`)
}
console.log(`\n产物：${OUT}`)
