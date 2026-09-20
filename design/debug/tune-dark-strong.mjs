#!/usr/bin/env node
/* 暗色 strong 的 ΔL 补齐：底衬变浓后，面板分离度必须重算（规范 §5 耦合清单）。
   ----------------------------------------------------------------------------
   现象：换掉极光结构后，暗色 strong 的 ΔL 从 0.0452 掉到 0.0403（"清晰"→"可辨"）。
   三个候选方向（都只动一支，便于归因）：
     D1 抬面板 α      —— 面板更实、更亮，ΔL 上去，但透过率下来
     D2 降色罩 --m-tint —— 底衬更暗，ΔL 上去，透过率不变
     D3 降色块 --m-heat —— 同上，但只压色块不压色带
   判据：ΔL ≥0.045（清晰）且 --fg-3 ≥4.5、--fg-mute ≥3。
   用法：node design/debug/tune-dark-strong.mjs [outDir]
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(DIR, 'workbench.html')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = process.argv[2] || '/tmp/dark-strong'
fs.mkdirSync(OUT, { recursive: true })

const VARIANTS = {
  'D0-现状': '',
  'D1-抬α': 'html[data-theme]{--g-pa-3:0.48;--g-pa-4:0.82}',
  'D2-降色罩': 'html[data-theme]{--m-tint:0.22}',
  'D3-降色块': 'html[data-theme]{--m-heat:0.60}',
  'D4-降色罩+色块': 'html[data-theme]{--m-tint:0.24;--m-heat:0.66}',
}

const src = fs.readFileSync(SRC, 'utf8')
const ANCHOR = 'data-theme="light" data-glass="strong" data-series="home"'
if (!src.includes(ANCHOR)) throw new Error('找不到锚点')
const dark = src.replace(ANCHOR, 'data-theme="dark" data-glass="strong" data-series="home"')

for (const [name, css] of Object.entries(VARIANTS)) {
  // ⚠️ 覆盖必须排在 prism.css **之后**，且选择器要能赢：用 :root:not([data-theme='light'])
  const html = css
    ? dark.replace('</head>', `<style>:root:not([data-theme='light']){${css.replace('html[data-theme]{', '').replace('}$', '')}}</style></head>`)
    : dark
  const f = path.join(OUT, `${name}.html`)
  fs.writeFileSync(f, html)
  const png = path.join(OUT, `${name}.png`)
  const r = spawnSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--allow-file-access-from-files',
    '--virtual-time-budget=2400', '--window-size=1440,900', `--screenshot=${png}`, `file://${f}`,
  ], { encoding: 'utf8' })
  console.log(fs.existsSync(png) ? `✓ ${name}` : `✗ ${name} ${(r.stderr || '').slice(0, 140)}`)
}
console.log(`\n产物：${OUT}`)
