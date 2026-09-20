/* 探测：卡片（.g）的材质到底有没有真的落到渲染上。
   ----------------------------------------------------------------------------
   为什么必须读计算值：材质由 6 个属性合成（background-color / background-image /
   backdrop-filter / border / box-shadow / background-clip），
   只要有一个被后写的规则顶掉，视觉上就"变成一块灰板"，而源码看起来完全正常。
   用法：node design/debug/probe-material.mjs
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(DIR, '../workbench.html')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const src = fs.readFileSync(SRC, 'utf8')
const probe = `<script>
(function () {
  var out = []
  function dump(label, el) {
    if (!el) { out.push(label + ' = 找不到'); return }
    var cs = getComputedStyle(el)
    out.push('### ' + label + ' [' + (el.className || '').slice(0, 60) + ']')
    out.push('  backdrop-filter = ' + cs.backdropFilter)
    out.push('  background-color = ' + cs.backgroundColor)
    out.push('  background-image = ' + (cs.backgroundImage === 'none' ? 'none' : cs.backgroundImage))
    out.push('  border = ' + cs.borderTopWidth + ' ' + cs.borderTopStyle + ' ' + cs.borderTopColor)
    out.push('  background-clip = ' + cs.backgroundClip)
    out.push('  box-shadow = ' + (cs.boxShadow === 'none' ? 'none' : cs.boxShadow.slice(0, 110)))
    out.push('  --g-panel-a = ' + cs.getPropertyValue('--g-panel-a').trim() +
             ' | --g-panel-rgb = ' + cs.getPropertyValue('--g-panel-rgb').trim() +
             ' | --g-blur = ' + cs.getPropertyValue('--g-blur').trim() +
             ' | --g-shadow = ' + cs.getPropertyValue('--g-shadow').trim().slice(0, 40))
  }
  dump('磁贴 (g g3 g--refr)', document.querySelector('.g.g3'))
  dump('入口瓦片 (g g1 mod-tile)', document.querySelector('.g.mod-tile'))
  dump('顶栏 (shell g g4)', document.querySelector('header.shell'))
  dump('助手栏 aside', document.querySelector('aside'))
  var s = document.createElement('title'); s.textContent = 'PROBE ' + out.join(' ~ ')
  document.head.appendChild(s)
  document.title = 'PROBE ' + out.join(' ~ ')
})()
</script>`

const html = src.replace('</body>', probe + '\n</body>')
fs.writeFileSync('/tmp/probe-material.html', html)
const r = spawnSync(CHROME, ['--headless=new', '--disable-gpu', '--no-sandbox', '--allow-file-access-from-files', '--virtual-time-budget=2200', '--dump-dom', 'file:///tmp/probe-material.html'], { encoding: 'utf8', maxBuffer: 1 << 28 })
const m = (r.stdout || '').match(/<title>PROBE([^<]*)/)
if (!m) {
  console.error('拿不到探针（stdout ' + (r.stdout || '').length + ' 字节）')
  process.exit(1)
}
console.log(m[1].split(' ~ ').map((s) => s.replace(/^### /, '\n### ')).join('\n'))
