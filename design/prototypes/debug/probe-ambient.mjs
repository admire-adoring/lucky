#!/usr/bin/env node
/* 读环境层（底衬 + 颗粒 + 极光）的**计算值**，回答一个问题：
   「玻璃背后到底有没有可供显示的结构？」
   ----------------------------------------------------------------------------
   为什么要专门探这个：玻璃 = 模糊 + 透过率 × **底下有东西可看**。
   三层缺任何一层，观感都会退化成"染了色的板"，而三者都不会报错。
   实测过的两个坑都在这里：
     · 颗粒 SVG 里 rect 的 opacity 与所在层的 opacity **相乘** → 静默衰减两次
     · 极光层被 `--g-frost` 之类的令牌连带压暗
   用法：node design/debug/probe-ambient.mjs
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = path.join(DIR, 'workbench.html')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const OUT = '/tmp/probe-ambient'

const src = fs.readFileSync(SRC, 'utf8')
fs.mkdirSync(OUT, { recursive: true })

/* ⚠️ 探针里不许出现「上一行以 ] 结尾、下一行以 [ 开头」——
   JS 的 ASI 会把它解析成下标访问（本轮真踩到，静默不执行）。 */
const probe =
  '<scr' + 'ipt>' +
  '(function(){' +
  'var o=[];' +
  'function g(sel,keys){' +
  '  var el=document.querySelector(sel);' +
  '  if(!el){ o.push(sel+"=缺失"); return; }' +
  '  var cs=getComputedStyle(el);' +
  '  var parts=[sel+"{opacity="+cs.opacity+";z="+cs.zIndex+";display="+cs.display+"}"];' +
  '  for(var i=0;i<keys.length;i++){ parts.push(keys[i]+"="+cs.getPropertyValue(keys[i]).trim()); }' +
  '  var bg=cs.backgroundImage; parts.push("bgImg="+(bg==="none"?"none":bg.slice(0,70)));' +
  '  var bgr=cs.backgroundColor; parts.push("bgColor="+bgr);' +
  '  o.push(parts.join(" | "));' +
  '}' +
  'var root=document.documentElement;' +
  'o.push("data-glass="+(root.getAttribute("data-glass")||"缺省")+" data-theme="+root.getAttribute("data-theme"));' +
  'g(".ambient",["--g-base","--m-tint","--g-noise-op","--g-frost"]);' +
  'g(".ambient__noise",[]);' +
  'g(".ambient__aurora",["--m-tint"]);' +
  'var rect=document.querySelector(".ambient__noise rect");' +
  'if(rect){ o.push("noise>rect{fill="+rect.getAttribute("fill")+"|op="+rect.getAttribute("opacity")+"|filter="+rect.getAttribute("filter")+"}"); }' +
  'else { o.push("noise>rect=缺失"); }' +
  'var card=document.querySelector(".g.g3")||document.querySelector(".card");' +
  'if(card){ var cs=getComputedStyle(card); o.push("card{pa="+cs.getPropertyValue("--g-pa-4")+";bgA="+cs.backgroundColor+"}"); }' +
  'var t=document.createElement("title"); t.textContent="AMB "+o.join(" ;; "); document.head.appendChild(t);' +
  '})()' +
  '</scr' + 'ipt>'

const ANCHOR = 'data-theme="light" data-glass="strong" data-series="home"'
const html = src.replace('</body>', probe + '\n</body>')
if (!html.includes(ANCHOR)) throw new Error(`找不到锚点：${ANCHOR}`)
const file = path.join(OUT, 'probe.html')
fs.writeFileSync(file, html)

const r = spawnSync(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox',
  '--allow-file-access-from-files', '--virtual-time-budget=2500', '--dump-dom', `file://${file}`,
], { encoding: 'utf8', maxBuffer: 1 << 28 })

const out = r.stdout || ''
const m = out.match(/AMB([^<]*)/)
if (!m) {
  console.error('✗ 拿不到探针（stdout ' + out.length + ' 字节）')
  console.error((r.stderr || '').slice(0, 400))
  process.exit(1)
}
for (const line of m[1].split(' ;; ')) console.log('  ' + line.trim())
