#!/usr/bin/env node
/* 底衬结构对照实验：把"极光层"换几版，各渲染一张，再量「大尺度结构」。
   ----------------------------------------------------------------------------
   为什么用注入覆盖而不是直接改源码：观感问题要一次拿到 N 个候选再挑，
   改源码就得改-测-改-测。注入只在 <head> 末尾追加一段覆盖，源码不动。
   判据（target）取自用户已认可的旧版实测：
     格间标准差 ≈ R 10.5 / G 12.8 / B 7.7 · 彩度极差 ≈ 0.238 · 亮度极差 ≈ 59.5
   用法：node design/debug/experiment-ambient.mjs [outDir]
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(DIR, 'workbench.html')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = process.argv[2] || '/tmp/exp-ambient'

/* 局部化色块：半径从 148% 降到 44~64%，位置铺开 ——
   半径大于视口时，色块只表现为"渐变的偏移"，看不到边界；
   半径小于视口才有可辨认的**色块边缘**，那正是玻璃要显示的东西。 */
const BLOBS_LOCAL = (scale) => `
    radial-gradient(58% 50% at 10% 4%, rgb(var(--m-lt-1) / calc(var(--m-a1) * ${scale})) 0%, transparent 72%),
    radial-gradient(50% 44% at 92% 20%, rgb(var(--m-lt-2) / calc(var(--m-a2) * ${scale})) 0%, transparent 74%),
    radial-gradient(64% 54% at 44% 98%, rgb(var(--m-lt-3) / calc(var(--m-a3) * ${scale})) 0%, transparent 76%),
    radial-gradient(46% 40% at 74% 64%, rgb(var(--m-lt-2) / calc(var(--m-a2) * ${scale} * 0.72)) 0%, transparent 74%),
    linear-gradient(135deg, rgb(var(--s) / calc(var(--m-tint) * 0.5)) 0%, transparent 70%)`

const VARIANTS = {
  'A-现状': '',
  'B-局部块': `
html[data-theme]{--amb:1}
.ambient__aurora{background-image:${BLOBS_LOCAL(1)};}`,
  'C-局部块-a60': `
.ambient__aurora{background-image:${BLOBS_LOCAL(0.6)};}`,
  'D-局部块-a60-tint30': `
html[data-theme='light']{--m-tint:.30}
.ambient__aurora{background-image:${BLOBS_LOCAL(0.6)};}`,
  'E-局部块-a40-五块': `
html[data-theme='light']{--m-tint:.30}
.ambient__aurora{background-image:
    radial-gradient(58% 50% at 8% 2%, rgb(var(--m-lt-1) / calc(var(--m-a1) * .4)) 0%, transparent 72%),
    radial-gradient(50% 44% at 94% 18%, rgb(var(--m-lt-2) / calc(var(--m-a2) * .4)) 0%, transparent 74%),
    radial-gradient(40% 34% at 62% 46%, rgb(var(--m-lt-1) / calc(var(--m-a1) * .55)) 0%, transparent 72%),
    radial-gradient(64% 54% at 40% 100%, rgb(var(--m-lt-3) / calc(var(--m-a3) * .4)) 0%, transparent 76%),
    radial-gradient(46% 40% at 78% 84%, rgb(var(--m-lt-2) / calc(var(--m-a2) * .45)) 0%, transparent 74%),
    linear-gradient(135deg, rgb(var(--s) / calc(var(--m-tint) * 0.5)) 0%, transparent 70%);}`,
}

const src = fs.readFileSync(SRC, 'utf8')
fs.mkdirSync(OUT, { recursive: true })
const ANCHOR = 'data-theme="light" data-glass="strong" data-series="home"'
if (!src.includes(ANCHOR)) throw new Error('找不到锚点')

for (const [name, css] of Object.entries(VARIANTS)) {
  const html = css ? src.replace('</head>', `<style>${css}</style></head>`) : src
  const f = path.join(OUT, `${name}.html`)
  fs.writeFileSync(f, html)
  const png = path.join(OUT, `${name}.png`)
  const r = spawnSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--allow-file-access-from-files',
    '--virtual-time-budget=2400', '--window-size=1440,900',
    `--screenshot=${png}`, `file://${f}`,
  ], { encoding: 'utf8' })
  if (!fs.existsSync(png)) {
    console.error(`✗ ${name} 渲染失败：` + (r.stderr || '').slice(0, 200))
    continue
  }
  console.log(`✓ ${name}`)
}
console.log(`\n产物：${OUT}`)
