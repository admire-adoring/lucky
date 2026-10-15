/* 探测：把 <html> 的 data-series 换成三个不同的模块，读**计算值**，验证色槽真的跟着走。
   为什么要读计算值而不是读 CSS 源：本轮已经栽过两次"源码看着对、渲染全废"
   （--accent 当颜色用、注释里的星斜提前闭合），两次都只有读计算值才能定位。
   用法：node design/debug/probe-series.mjs
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(DIR, '../workbench.html')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const ANCHOR = 'data-theme="light" data-series="home"'
const VARS = ['--s', '--brand-a', '--brand-ink', '--m-lt-1', '--m-a1', '--m-dk-1', '--m-b1']

const src = fs.readFileSync(SRC, 'utf8')
if (!src.includes(ANCHOR)) throw new Error(`找不到 <html> 上的初值锚点：${ANCHOR}`)

const probe = `<script>
(function () {
  var r = document.documentElement, cs = getComputedStyle(r)
  var o = ['series=' + r.getAttribute('data-series')]
  ${JSON.stringify(VARS)}.forEach(function (v) { o.push(v + '=' + cs.getPropertyValue(v).trim()) })
  var s = document.querySelector('[data-accent]')
  o.push('accent=' + getComputedStyle(s).getPropertyValue('--accent').trim())
  var aur = getComputedStyle(document.querySelector('.ambient__aurora')).backgroundImage
  o.push('aurora=' + (aur || 'none').slice(0, 80))
  var t = document.createElement('title')
  t.id = 'probe-out'
  t.textContent = 'PROBE ' + o.join(' | ')
  document.head.appendChild(t)
  document.title = 'PROBE ' + o.join(' | ')
})()
</script>`

for (const key of ['home', 'tasks', 'work', 'knowledge']) {
  const html = src.replace(ANCHOR, `data-theme="light" data-series="${key}"`).replace('</body>', probe + '\n</body>')
  if (!html.includes(`data-series="${key}"`)) throw new Error(`${key}: <html> 上的替换没命中`)
  const file = path.join('/tmp', `probe-series-${key}.html`)
  fs.writeFileSync(file, html)
  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files', '--virtual-time-budget=2200', '--dump-dom', `file://${file}`], { encoding: 'utf8', maxBuffer: 1 << 28 })
  const out = r.stdout || ''
  // ⚠️ 不能直接 match /PROBE([^<]*)/ —— 内联脚本**源码本身**里就写着 "PROBE "，
  //    它会先被匹配到，于是每次读到的都是探针脚本的原文（本轮实测）。
  //    必须锚在那个由脚本创建的 title 元素上。
  const m = out.match(/<title id="probe-out">PROBE([^<]*)/)
  console.log(`\n[${key}]` + (m ? m[1].split(' | ').map((s) => '\n   ' + s).join('') : `  ✗ 拿不到探针（stdout ${out.length} 字节）`))
}
