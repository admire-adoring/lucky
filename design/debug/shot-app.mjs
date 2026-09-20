#!/usr/bin/env node
/* 给**构建产物**（dist/）出截图 —— 用于验收工作台页面。
   ----------------------------------------------------------------------------
   为什么不直接打开 dist/index.html：
     · 应用要登录态（`/` 是 RequireAuth），没有 `lucky-y/auth` 会被弹去登录页，
       截出来的永远是登录界面。所以要先往 localStorage 里种一份会话。
     · 而 localStorage 在 `file://` 下是按文件隔离的，种进去也读不到 ——
       必须走 http。所以这里连一个静态服务一起起。
   ⚠️ **产物必须写在 dist 根目录下、不能放子目录**：
     打包后的资源引用是**相对路径**（`./assets/index-xxx.js`），
     放到 `dist/__shot/page.html` 会去找 `/__shot/assets/...` → 404 → **白屏且零报错**
      （资源加载失败不会冒泡到 window.onerror，只有 `capture` 才收得到）。
     这是实测踩到的一次：先手动改过一次路径，重建产物时忘了同步，
     于是同一份脚本一会儿能截、一会儿白屏。

   用法：
     node design/debug/shot-app.mjs --out /tmp/a.png [--theme dark] [--glass quiet]
                                    [--series tasks] [--size 1440x900] [--probe file.js]
   --probe 会在页面里注入一段脚本（读计算值用），它**不参与**业务逻辑。
*/
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PROJECT = path.resolve(HERE, '../..')
const DIST = path.join(PROJECT, 'dist')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.env.SHOT_PORT || 8791)

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const OUT = arg('out', '/tmp/app-shot.png')
const THEME = arg('theme', 'light')
const GLASS = arg('glass', 'strong')
const SERIES = arg('series', '')
const SIZE = arg('size', '1440x900')
const PROBE = arg('probe', '')

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('✗ 找不到 dist/index.html —— 先跑 vite build')
  process.exit(1)
}

/* 1) 种子：登录态 + 主题。主题也在这里种（`lucky-y/theme`），
      于是截图不必依赖 `data-theme` 的注入顺序 —— 它就是应用自己的读法。 */
const seed = `<script>try{
  localStorage.setItem('lucky-y/auth', ${JSON.stringify(
    JSON.stringify({ state: { user: { name: '刘 阳', email: 'me@lucky-y.app', initials: 'LY' } }, version: 0 }),
  )});
  localStorage.setItem('lucky-y/theme', ${JSON.stringify(THEME)});
}catch(e){}</script>`

let html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8').replace('</head>', seed + '\n</head>')

/* 2) 玻璃档位：字符串档位（strong/standard/quiet）不写属性 —— strong 就是缺省 */
if (GLASS !== 'strong') {
  html = html.replace('</head>', `<script>document.documentElement.dataset.glass=${JSON.stringify(GLASS)}</script></head>`)
}

/* 3) 可选的读值探针 */
if (PROBE) {
  html = html.replace('</body>', `<script>${fs.readFileSync(PROBE, 'utf8')}\n</script>\n</body>`)
}

/* 4) 产物路径。**先别写盘** —— 后面还有两处注入（玻璃档位已在上面、切模块在下面），
      写早了它们就落不到文件里。实测踩过一次：`--series` 的点击脚本加在写盘之后，
      于是"切模块"这个参数**完全没生效**，而截图看起来很正常（就是首页），
      只能靠"三张不同模块的图字节数一模一样"这种旁证发现。
      ⚠️ 产物落在 dist **根目录**：打包资源是相对路径（`./assets/…`），
      放子目录会去找 `/__shot/assets/…` → 404 → **白屏且零报错**。 */
const page = path.join(DIST, '__shot.html')

/* 5) 静态服务：已经在跑就复用，避免端口占用报错刷屏。
   ⚠️ 探测 `/index.html` 而**不是** `/__shot.html` —— 后者要等本脚本写出来才有，
      用它探测会"第一次永远探不到"，于是每次都试图再起一个服务、撞端口。
      探一个**一定存在**的文件，才是"这个端口上有没有服务"的正确判据。 */
function serving() {
  const r = spawnSync('curl', ['-s', '-o', '/dev/null', '-w', '%{http_code}', `http://127.0.0.1:${PORT}/index.html`], { encoding: 'utf8' })
  return (r.stdout || '').trim() === '200'
}
if (!serving()) {
  spawnSync('sh', ['-c', `cd ${JSON.stringify(DIST)} && nohup python3 -m http.server ${PORT} --bind 127.0.0.1 >/tmp/app-shot-server.log 2>&1 &`])
  const started = Date.now()
  while (!serving() && Date.now() - started < 5000) spawnSync('sleep', ['0.2'])
  if (!serving()) {
    console.error(`✗ 静态服务起不来（端口 ${PORT}）—— 看 /tmp/app-shot-server.log`)
    process.exit(1)
  }
}

/* 6) 切换模块：**点环上那一格**，而不是改 DOM 属性。
      应用当前模块的唯一所有者在 React store 里，直接改 `data-series` 只会改掉
      CSS 的取色、页面内容不会跟着换 —— 截出来的是"背景变了、面板没变"的假状态。
      这条是本项目踩过的老坑：外部工具驱动状态必须走页面的状态入口。
      ⚠️ 点击要排在 React 挂载**并完成首次提交之后**，所以延后 1200ms。
         实测 700ms 太早：点击确实派发出去了，但 React 的状态更新还没落到 DOM，
         截出来仍是切换前的画面 —— 而它看起来完全正常，最容易误判成"点击没生效"。
         （判据：探针在 t=1200 读到 data-series 仍是 home、t=3000 才是 tasks。） */
if (SERIES) {
  html = html.replace(
    '</body>',
    `<script>setTimeout(function(){
      var el=document.querySelector('[data-module=' + ${JSON.stringify(JSON.stringify(SERIES))} + ']');
      if(el){ el.click(); } else { document.title='SHOT-FAIL 找不到模块 '+${JSON.stringify(SERIES)}; }
    },1200)</script>\n</body>`,
  )
}
fs.writeFileSync(page, html)

const [w, h] = SIZE.split('x')
const target = `http://127.0.0.1:${PORT}/__shot.html`
/* ⚠️ `--virtual-time-budget` **只能出现一次**：给两个时 Chrome 取先出现的那个，
   于是"切模块"多要的那段时间根本没生效 —— 截出来仍是切换前的画面，
   而画面看起来完全正常（就是个首页），最容易误判成"点击没生效"。 */
const budget = SERIES ? 7000 : 4000
const r = spawnSync(CHROME, [
  '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
  '--force-device-scale-factor=1', '--allow-file-access-from-files',
  `--virtual-time-budget=${budget}`, `--window-size=${w},${h}`,
  `--screenshot=${OUT}`, target,
], { encoding: 'utf8' })
if (!fs.existsSync(OUT)) {
  console.error('✗ 截图失败：' + (r.stderr || '').slice(0, 300))
  process.exit(1)
}
const size = fs.statSync(OUT).size
console.log(`✓ ${OUT}（${(size / 1024).toFixed(0)} KB · ${SIZE} · ${THEME}/${GLASS}${SERIES ? ' · ' + SERIES : ''}）`)
if (size < 20000) console.log('  ⚠️ 产物小于 20KB：页面很可能是白屏，去看是不是资源 404')
