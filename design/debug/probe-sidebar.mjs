/* 探测：`design/sidebar/sidebar_index.html` —— 侧边栏设计台。
   ----------------------------------------------------------------------------
   验的是本原型唯一的主张：**九个菜单项各用各的模块色**，而且那个色是"承载色"档
   （亮色 700 级），不是"面积色"档（亮色 500 级）。

   为什么必须读**计算值**：本页的颜色全部由脚本注入的自定义属性驱动
   （`injectTokens()` → `--sb-area-*` / `--sb-ink-*` + `[data-module]` 接线）。
   看源码只能证明"我写了规则"，证明不了"规则接上了" —— 本项目栽过这类跟头
   （`.dark X` 那一族样式表里看得见、检查器里也显示，就是不匹配）。

   用法：node design/debug/probe-sidebar.mjs
   ----------------------------------------------------------------------------
   ⚠️ 读法上的老坑（probe-series.mjs 里记过）：不能用 /PROBE([^<]*)/ 直接 match
      stdout —— 内联脚本**源码本身**里就写着 PROBE，会被先匹配到。
      必须锚在由脚本创建的那个带 id 的元素上。
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(DIR, '../sidebar/sidebar_index.html')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

if (!fs.existsSync(SRC)) throw new Error(`找不到原型：${SRC}`)
const src = fs.readFileSync(SRC, 'utf8')

/* 给 data-module 与主题都是"页面自己的入口"：初始模块由脚本在启动时写进
   `.bench-root[data-module]`，所以探针只读、不改 —— 改内部属性量出来的东西
   不能代表用户看到的页面。下面按 [主题, 模块] 组合生成几个只改启动初值的副本。 */
const CASES = [
  ['light', 'life'],
  ['dark', 'life'],
  ['light', 'tasks'],
  ['light', 'knowledge'],
]

const probe = `<script>
(function () {
  var out = { cases: [], fails: [] }
  function cs(el) { return getComputedStyle(el) }
  function q(sel) { return document.querySelector(sel) }
  function all(sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)) }

  // ---- 结构：样张到底渲染出来了没有 ----
  out.counts = {
    sidebar: all('.sidebar').length,
    title: all('.sidebar-title').length,
    item: all('.menu-item').length,
    crop: all('.spec-stage.crop').length,
    stage: all('.spec-stage').length,
    switch: all('.switch').length,
    tableRow: all('#contrastTable tbody tr').length,
  }
  if (out.counts.sidebar === 0) out.fails.push('一个 .sidebar 都没渲染 → 脚本大概抛错了')
  if (out.counts.tableRow !== 9) out.fails.push('对比度表应有 9 行，实为 ' + out.counts.tableRow)

  // ---- 核心主张：九项的承载色互不相同，且等于该模块 700 级那一支 ----
  var root = q('.bench-root')
  var seen = {}
  out.perItem = all('.sidebar .menu-item[data-module]').slice(0, 9).map(function (el) {
    var k = el.getAttribute('data-module')
    var ink = cs(el).getPropertyValue('--sb-ink').trim()
    var area = cs(el).getPropertyValue('--sb-area').trim()
    var dot = cs(el.querySelector('.menu-dot')).backgroundColor
    seen[ink] = (seen[ink] || 0) + 1
    return { key: k, ink: ink, area: area, dot: dot,
             text: cs(el).color, border: cs(el).borderLeftColor,
             active: el.classList.contains('active'),
             aria: el.getAttribute('aria-current') }
  })

  // ---- #1 号样张（亮色全量侧栏）里，激活项的三处承载色必须一致 ----
  var s0 = q('.spec-stage .sidebar')
  var act = s0 && s0.querySelector('.menu-item.active')
  out.active = act ? { label: act.textContent.trim(),
                       ink: cs(act).getPropertyValue('--sb-ink').trim(),
                       text: cs(act).color, border: cs(act).borderLeftColor,
                       dot: cs(act.querySelector('.menu-dot')).backgroundColor,
                       weight: cs(act).fontWeight } : null

  // ---- 极光是否跟着模块走 ----
  var rs = cs(document.documentElement)
  out.aura = { module: root.getAttribute('data-module'),
               m1: rs.getPropertyValue('--m1').trim(),
               m3: rs.getPropertyValue('--m3').trim(),
               benchM1: cs(root).getPropertyValue('--m1').trim() }

  // ---- 承载色是否真的落在"深档"，而不是 500 级面积色 ----
  var light = !document.documentElement.classList.contains('dark')
  if (light) {
    var same = out.perItem.filter(function (i) {
      return i.ink.toLowerCase() === i.area.toLowerCase()
    })
    if (same.length) out.fails.push('亮色下这些项的承载色 == 面积色（应当分两档）：' + same.map(function (i) { return i.key }).join(','))
  }
  if (out.perItem.length && Object.keys(seen).length < out.perItem.length) {
    out.fails.push('有两项共用同一支承载色：' + JSON.stringify(seen))
  }
  if (act) {
    if (act.border.toLowerCase() !== act.ink.toLowerCase()) out.fails.push('激活项色带 ≠ 承载色')
    if (act.text.toLowerCase() !== act.ink.toLowerCase()) out.fails.push('激活项文字 ≠ 承载色')
    if (act.dot.toLowerCase() !== act.ink.toLowerCase()) out.fails.push('激活项色点 ≠ 承载色')
    if (act.aria !== 'page') out.fails.push('激活项缺 aria-current="page"')
  } else {
    out.fails.push('第 1 号样张里找不到激活项')
  }

  // ---- 版面几何：§01 的舞台要够高，别把最后一项裁掉 ----
  var bar = q('.bench-bar').getBoundingClientRect()
  var st = s0.getBoundingClientRect()
  out.geom = { pageH: document.documentElement.scrollHeight,
               stage: { x: Math.round(st.x), y: Math.round(st.y), w: Math.round(st.width), h: Math.round(st.height) },
               barH: Math.round(bar.height),
               sidebarScrollable: s0.scrollHeight > s0.clientHeight + 1 }
  if (out.geom.sidebarScrollable) out.fails.push('侧栏样张出现内部滚动 → 舞台高度不够，最后一项被裁')

  var pre = document.createElement('pre')
  pre.id = 'probe-out'
  pre.textContent = JSON.stringify(out)
  document.body.appendChild(pre)
})()
</script>`

let bad = 0
for (const [theme, mod] of CASES) {
  let html = src
  /* 只改"启动初值"：把 activeKey 的初值换掉 + 预置主题。
     主题走页面自己的读法（localStorage['theme']），所以先种再跑。 */
  if (mod !== 'life') {
    const before = `let activeKey = 'life'`
    if (!html.includes(before)) throw new Error('找不到 activeKey 的初值锚点')
    html = html.replace(before, `let activeKey = '${mod}'`)
  }
  if (theme === 'dark') {
    html = html.replace('<head>', `<head><script>try{localStorage.setItem('theme','dark')}catch(e){}</script>`)
  }
  /* 探针挂在 </body> 前 —— 必须排在页面自己的脚本之后，否则它读的是"还没渲染"的 DOM */
  html = html.replace('</body>', probe + '\n</body>')
  if (!html.includes("pre.id = 'probe-out'")) throw new Error('探针没注进去')
  const file = path.join('/tmp', `probe-sidebar-${theme}-${mod}.html`)
  fs.writeFileSync(file, html)

  const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox',
    '--hide-scrollbars', '--allow-file-access-from-files', '--force-device-scale-factor=1',
    '--window-size=1280,3800', '--virtual-time-budget=2500', '--dump-dom', `file://${file}`],
    { encoding: 'utf8', maxBuffer: 1 << 28 })

  const out = r.stdout || ''
  const m = out.match(/<pre id="probe-out">([\s\S]*?)<\/pre>/)
  if (!m) {
    console.log(`\n[${theme} · ${mod}] ✗ 拿不到探针（stdout ${out.length} 字节）`)
    bad++
    continue
  }
  const d = JSON.parse(m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>'))
  const tag = d.fails.length ? '✗' : '✓'
  if (d.fails.length) bad++
  console.log(`\n[${theme} · ${mod}] ${tag}`)
  console.log(`   结构   sidebar=${d.counts.sidebar} item=${d.counts.item} crop=${d.counts.crop} ` +
              `stage=${d.counts.stage} switch=${d.counts.switch} 表行=${d.counts.tableRow}`)
  console.log(`   激活   ${d.active ? d.active.label + '  ink=' + d.active.ink + ' text=' + d.active.text +
              ' 带=' + d.active.border + ' 点=' + d.active.dot + ' 字重=' + d.active.weight : '—'}`)
  console.log('   九项   ' + d.perItem.map((i) => i.key + ':' + i.ink).join('  '))
  console.log(`   极光   root=${d.aura.module}  --m1=${d.aura.benchM1}  --m3=${d.aura.m3}`)
  console.log(`   几何   页高=${d.geom.pageH} 舞台=${d.geom.stage.w}×${d.geom.stage.h} ` +
              `y=${d.geom.stage.y} 侧栏内部滚动=${d.geom.sidebarScrollable}`)
  if (d.fails.length) d.fails.forEach((f) => console.log('   ✗ ' + f))
}

console.log(`\n${bad ? '✗ ' + bad + ' 个用例未通过' : '✓ 全部通过'}`)
process.exit(bad ? 1 : 0)
