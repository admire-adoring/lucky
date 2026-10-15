/* 校验玻璃档位：三档 × 两主题，把**计算值**与**实测分离度**都拿出来。
   为什么要专测档位：三档都是"改四个令牌"，而令牌的层叠很容易被写坏 ——
   写坏的典型症状是"某一档没生效"（继承到了兜底值），这既不报错也看不出来。
   用法：node design/debug/probe-presets.mjs
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(DIR, '../workbench.html')
const OUT = '/tmp/presets'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const VARS = ['--g-pa-3', '--g-pa-4', '--g-noise-op', '--m-tint', '--g-panel-a']

const src = fs.readFileSync(SRC, 'utf8')
const ANCHOR = 'data-theme="light" data-glass="strong" data-series="home"'
fs.mkdirSync(OUT, { recursive: true })

const probe = `<script>
(function () {
  // ⚠️ 全部包在 try/catch 里：探针一旦抛异常，**整段脚本静默不执行** ——
  //    页面照常渲染、dump 里也找不到任何报错，只有"探针没读到"这一句提示
  //    （第一次写就栽在这：querySelector 没命中 → getComputedStyle(null) 抛错 → 八行全是"没读到"）。
  try {
    var root = document.documentElement
    var o = ['attrs=' + root.getAttribute('data-theme') + '/' + (root.getAttribute('data-glass') || '缺省')]
    // ⚠️ 变量名先存起来再用，**不要**把数组字面量直接写在上一行语句之后：
    //    上一行以 ) 或 ] 结尾、下一行以 [ 开头时，JS 不插分号，而是把它解析成**下标访问**
    //    （o["--g-pa-3", …] → 取到 undefined → .forEach 抛错）。这个坑不报语法错，
    //    只在运行时报 "Cannot read properties of undefined (reading 'forEach')"。
    var vars = ${JSON.stringify(VARS)}
    vars.forEach(function (v) { o.push(v + '=' + getComputedStyle(root).getPropertyValue(v).trim()) })
    // 档位类把 --g-panel-a 写在**卡片**上，所以这一支要从卡片读（并防它不存在）
    var card = document.querySelector('.g.g3')
    o.push('card.panel-a=' + (card ? getComputedStyle(card).getPropertyValue('--g-panel-a').trim() : '找不到卡片'))
    var hint = 'PROBE ' + o.join(' | ')
    var t = document.createElement('title'); t.id = 'probe-out'; t.textContent = hint
    document.head.appendChild(t)
    document.title = hint
  } catch (e) {
    document.title = 'PROBE ERR ' + e.message
  }
})()
</script>`

for (const preset of ['', 'quiet', 'standard', 'strong']) {
  for (const theme of ['light', 'dark']) {
    const html = src
      .replace(ANCHOR, `data-theme="${theme}" data-glass="${preset || 'strong'}" data-series="home"`)
      .replace('</body>', probe + '\n</body>')
    const name = `${preset || '默认(strong)'}-${theme}`
    const file = path.join(OUT, `${name}.html`)
    fs.writeFileSync(file, html)
    const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files', '--virtual-time-budget=2200', '--dump-dom', `file://${file}`], { encoding: 'utf8', maxBuffer: 1 << 28 })
    const m = (r.stdout || '').match(/<title id="probe-out">PROBE([^<]*)/)
    const png = path.join(OUT, `${name}.png`)
    spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars', '--force-device-scale-factor=1', '--allow-file-access-from-files', '--virtual-time-budget=2400', '--window-size=1440,900', `--screenshot=${png}`, `file://${file}`], { encoding: 'utf8' })
    console.log(`[${name}]` + (m ? m[1].split(' | ').map((s) => '\n   ' + s).join('') : '  ✗ 探针没读到'))
  }
}
