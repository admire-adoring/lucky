#!/usr/bin/env node
/* 出「多状态截图」：同一份 workbench.html，逐个模块 + 两套主题，各截一张。
   ----------------------------------------------------------------------------
   ⚠️ 坑（本轮实测，白白量了一整轮）：
   **不能只改 <html> 上的初始属性就截图。**
   原型脚本在初始化时会自己 `setAttribute('data-series', 当前模块)` ——
   而"当前模块"来自环上第一枚瓦片（工作台）。于是无论我把初始值改成什么，
   脚本一跑就全都回到 home：18 张"不同模块"的截图其实是**同一屏**，
   量出来的九组数值一模一样（连小数位都不差），还差点被当成"色表没接上"去改 CSS。
   判据：**外部工具要驱动状态，必须走这个页面的状态入口（点一下），
   而不是去改它的内部属性** —— 脚本是状态的唯一所有者，改属性只是改了它会覆盖的初值。

   主题不受影响（脚本不碰 data-theme），所以那两个值可以直接写在初值上。
   但为了让"驱动方式"只有一种，主题也一并说明清楚：**只有 data-theme 是初值**。

   用法：node design/prism-shots.mjs [outDir]
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(DIR, 'workbench.html')
const OUT = process.argv[2] || '/tmp/prism-shot'
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const KEYS = ['home', 'tasks', 'schedule', 'life', 'work', 'learn', 'knowledge', 'project', 'settings']

const src = fs.readFileSync(SRC, 'utf8')
/* ⚠️ 锚点必须与 workbench.html 上 <html> 的属性**逐字符一致**（含 data-glass）。
   少一个属性 / 多一个空格都会匹配不上，而匹配不上只是"替换没发生"——
   截图照旧出，只是九张图其实是同一屏（本轮踩过，见下面的注释）。 */
const ANCHOR = 'data-theme="light" data-glass="strong" data-series="home"'
if (!src.includes(ANCHOR)) throw new Error(`找不到 <html> 上的初值锚点：${ANCHOR}`)

/** 注入的驱动器：点第 idx 枚环上瓦片 —— 走页面自己的入口，状态才真的切过去。 */
const driver = (idx) => `
    <script>
      (function () {
        var items = document.querySelectorAll('#module-ring .radial__item')
        if (!items.length) throw new Error('环上找不到瓦片')
        // 第 0 枚本来就是当前项（点击会被忽略），其余各点一下即可
        if (${idx} !== 0) items[${idx}].click()
        document.documentElement.setAttribute('data-shot-ready', '1')
      })()
    </script>`

fs.mkdirSync(OUT, { recursive: true })
const shots = []
for (const theme of ['light', 'dark']) {
  KEYS.forEach((key, idx) => {
    const html = src
      .replace(ANCHOR, `data-theme="${theme}" data-series="${key}"`)
      .replace('</body>', driver(idx) + '\n  </body>')
    const file = path.join(OUT, `${theme}-${key}.html`)
    fs.writeFileSync(file, html)
    shots.push({ theme, key, file, png: path.join(OUT, `${theme}-${key}.png`) })
  })
}

for (const s of shots) {
  const r = spawnSync(CHROME, [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--force-device-scale-factor=1', '--allow-file-access-from-files',
    '--virtual-time-budget=2600', '--window-size=1440,900',
    `--screenshot=${s.png}`, `file://${s.file}`,
  ], { encoding: 'utf8' })
  if (!fs.existsSync(s.png)) {
    console.error(`✗ ${s.theme}-${s.key} 截图失败`)
    console.error((r.stderr || '').slice(0, 400))
    process.exit(1)
  }
}
console.log(`✓ ${shots.length} 张 → ${OUT}`)
