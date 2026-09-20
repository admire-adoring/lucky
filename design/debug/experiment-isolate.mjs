#!/usr/bin/env node
/* 隔离实验：逐个关掉环境层，看**哪一层真正在画底衬**。
   ----------------------------------------------------------------------------
   动机：改了极光层的半径与 α，渲染出来几乎没变化 —— 那就说明"它本来就没在起作用"，
   而继续调它只是在调一个不存在的旋钮。
   判据：关掉某层后画面**变化越大**，说明它承担的越多。
   用法：node design/debug/experiment-isolate.mjs [outDir]
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(DIR, 'workbench.html')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = process.argv[2] || '/tmp/iso'
fs.mkdirSync(OUT, { recursive: true })

const VARIANTS = {
  '0-全开': '',
  '1-关极光': '.ambient__aurora{display:none!important}',
  '2-关颗粒': '.ambient__noise{display:none!important}',
  '3-只留底基色': '.ambient__aurora{display:none!important}.ambient__noise{display:none!important}',
  '4-极光拉到最透': '.ambient__aurora{-webkit-mask-image:none;mix-blend-mode:normal}',
}

/* 顺带把 .ambient 的几何也读出来 —— 它是否真的铺满视口、是否在内容之下 */
const probe =
  '<scr' + 'ipt>' +
  '(function(){var o=[];' +
  'function g(sel){var el=document.querySelector(sel);if(!el){o.push(sel+"=缺失");return;}' +
  'var cs=getComputedStyle(el),r=el.getBoundingClientRect();' +
  'o.push(sel+"{pos="+cs.position+";inset="+cs.top+"/"+cs.right+"/"+cs.bottom+"/"+cs.left+";z="+cs.zIndex+";rect="+Math.round(r.width)+"x"+Math.round(r.height)+"@"+Math.round(r.left)+","+Math.round(r.top)+";blend="+cs.mixBlendMode+";mask="+(cs.webkitMaskImage||cs.maskImage||"none").slice(0,24)+"}");}' +
  'g(".ambient");g(".ambient__aurora");g(".ambient__noise");g("#root");' +
  'var t=document.createElement("title");t.textContent="ISO "+o.join(" ;; ");document.head.appendChild(t);})()' +
  '</scr' + 'ipt>'

const src = fs.readFileSync(SRC, 'utf8')
for (const [name, css] of Object.entries(VARIANTS)) {
  let html = css ? src.replace('</head>', `<style>${css}</style></head>`) : src
  if (name === '0-全开') html = src.replace('</body>', probe + '\n</body>')
  const f = path.join(OUT, `${name}.html`)
  fs.writeFileSync(f, html)
  const png = path.join(OUT, `${name}.png`)
  spawnSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--allow-file-access-from-files',
    '--virtual-time-budget=2400', '--window-size=1440,900',
    `--screenshot=${png}`, `file://${f}`,
  ], { encoding: 'utf8' })
  console.log(fs.existsSync(png) ? `✓ ${name}` : `✗ ${name}`)
}

const r = spawnSync(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--allow-file-access-from-files', '--virtual-time-budget=2400',
  '--dump-dom', `file://${path.join(OUT, '0-全开.html')}`,
], { encoding: 'utf8', maxBuffer: 1 << 28 })
const m = (r.stdout || '').match(/ISO([^<]*)/)
console.log('\n=== 环境层几何 ===')
if (m) for (const l of m[1].split(' ;; ')) console.log('  ' + l.trim())
else console.log('  ✗ 探针未执行')
