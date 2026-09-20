#!/usr/bin/env node
/* 对照实验：把"卡片为什么不再像玻璃"的候选原因逐个隔离出来。
   ----------------------------------------------------------------------------
   用**注入 <style> 覆盖令牌**的方式做，不改源码 —— 一次跑完拿到 N 个候选的截图，
   再挑出真正起作用的那一个。这是"把观感问题变成可比较的样本"最快的方式：

     候选 ① 面板色太灰（比背景还暗）      → 覆盖 --g-panel-rgb 为近白
     候选 ② 背景色彩太弱                  → 覆盖 --m-a* / --m-b* 调高
     候选 ③ 边缘折射的暖灰铺太宽          → 收窄折射渐变的停点
     候选 ④ 三者同时

   用法：node design/debug/experiment-material.mjs [outDir]
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(DIR, '../workbench.html')
const OUT = process.argv[2] || '/tmp/exp'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const VARIANTS = {
  '01-现状': '',
  '02-面板近白': `html[data-theme='light'] { --g-panel-rgb: 248 250 253; }`,
  '03-背景更浓': `:root { --m-a1: .9; --m-a2: .75; --m-a3: .8; }`,
  '04-折射收窄': `html[data-theme='light'] { --g-refr-a: .10; --g-refr-b: .08; --g-refr-b-rgb: 255 255 255; }
    .g--refr::before { background: linear-gradient(150deg,
      rgb(255 255 255 / .22) 0%, rgb(255 255 255 / .06) 14%, transparent 34%); }`,
  '05-②③④同时': `html[data-theme='light'] { --g-panel-rgb: 248 250 253; --g-refr-a: .10; --g-refr-b: .08; --g-refr-b-rgb: 255 255 255; }
    :root { --m-a1: .9; --m-a2: .75; --m-a3: .8; }
    .g--refr::before { background: linear-gradient(150deg,
      rgb(255 255 255 / .22) 0%, rgb(255 255 255 / .06) 14%, transparent 34%); }`,
  '06-唯面板近白+软唇': `html[data-theme='light'] { --g-panel-rgb: 248 250 253; }
    .g:not(.shell) { box-shadow: var(--g-shadow), inset 0 1px 0 rgb(255 255 255 / .55); }`,
}

const src = fs.readFileSync(SRC, 'utf8')
fs.mkdirSync(OUT, { recursive: true })

for (const [name, css] of Object.entries(VARIANTS)) {
  const html = css
    ? src.replace('</head>', `<style id="exp-override">${css}</style>\n  </head>`)
    : src
  const file = path.join(OUT, `${name}.html`)
  fs.writeFileSync(file, html)
  const png = path.join(OUT, `${name}.png`)
  const r = spawnSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-device-scale-factor=2', '--allow-file-access-from-files',
    '--virtual-time-budget=2400', '--window-size=1000,560',
    `--screenshot=${png}`, `file://${file}`,
  ], { encoding: 'utf8' })
  console.log(fs.existsSync(png) ? `✓ ${name}` : `✗ ${name} ${(r.stderr || '').slice(0, 160)}`)
}
console.log(`→ ${OUT}（2× 缩放，只看左上 Hero + 首行卡片区）`)
