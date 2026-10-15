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
                                    [--hash /life] [--dump]
   --probe 会在页面里注入一段脚本（读计算值用），它**不参与**业务逻辑。
   --dump 不写图片，而是把渲染后的 DOM 打到 stdout。

   --dump 模式不写图片，而是把渲染后的 DOM 打到 stdout —— 它验的是**内容与结构**
   （某段文案在不在、渲染了几个节点），验不了观感。

   ⚠️ 已更正一条旧结论：**本机的 `--screenshot` 一直是好用的。**
      上一轮记的"静默不落盘"是这个脚本自己的毛病 —— `--out` 不给扩展名时，
      Chrome 的 `--screenshot=<路径>` **既不写文件也不报错**。
      默认值 `/tmp/app-shot.png` 带扩展名，所以默认路径从没暴露过这个问题；
      而当时每一次调用都写成 `--out /tmp/ai-1440`（无扩展名）⇒ 全部"落不了盘"，
      于是绕道去做了 PDF 通道。现在 OUT 会**自动补扩展名**，
      `--print` 只作为"想一次拿整页长图"的备选，不再是唯一退路。 */
import fs from 'node:fs'
import os from 'node:os'
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

/** 出图路径。**必须带图片扩展名**：Chrome 的 `--screenshot=<路径>` 不认没有
 *  扩展名的路径 —— 它既不写文件、也不报错（退出码 0，只有 CVDisplayLink 警告）。
 *  实测：`--out /tmp/ai-1440` 什么都没有，`--out /tmp/ai-1440.png` 正常。
 *  这里统一补上，免得下一个调用者把"路径写错"误判成"环境不支持截图"。 */
const OUT = (() => {
  const raw = arg('out', '/tmp/app-shot.png')
  return /\.[a-zA-Z0-9]+$/.test(raw) ? raw : `${raw}.png`
})()
/** 出图路径去掉扩展名的那一截（PDF 通道、`-p1.png` 提示都从它派生） */
const OUT_BASE = OUT.replace(/\.[a-zA-Z0-9]+$/, '')
const THEME = arg('theme', 'light')
const GLASS = arg('glass', 'strong')
const SERIES = arg('series', '')
const SIZE = arg('size', '1440x900')
const PROBE = arg('probe', '')
/* `--hash` 用来直接落到某个路由（`--hash /life`）。
   模块工作区的 8 个页面都是独立路由，而 HashRouter 读的就是地址栏的 hash ——
   所以最省事、也最"走页面自己的入口"的做法是把 hash 拼进 target，
   而不是在页面里改 DOM 或 store。 */
const HASH = arg('hash', '')
/** `--dump`：只把渲染后的 DOM 打出来，不写图片（受限环境里截图会静默失败） */
const DUMP = process.argv.includes('--dump')
/** `--print`：把渲染结果打成 PDF。**不是**"截图不能用"的退路（那条旧结论已更正），
 *  它现在的用途是"一次拿整页长图"与"打印版式"。
 *  ⚠️ 但有一条实测约束：**打印时媒体查询视口 ≠ 版面宽度** ——
 *      版面按 `--size` 的宽铺，而媒体查询按打印视口算（量到的是 ≤768 那一档）。
 *      ⇒ 这个通道**只能用来核对窄屏**；宽屏的观感要用 `--screenshot` 看。 */
const PRINT = process.argv.includes('--print')

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

/* 3b) `--print`：本环境下唯一**能看到画面**的通道（见文件头）。
     两处注入缺一不可，都是"PDF 通道与截图通道的差别"：

     ① `@page { size: WxH; margin: 0 }` —— 打印时的布局宽度取**纸张**，
        不是 `--window-size`。不写这一条会按 Letter（8.5in ≈ 816px）排版，
        于是"1440 的图"其实是一张 **≤768 的窄屏图**：侧栏变抽屉（滑在屏幕外）、
        右栏被 ≤1200 收掉、顶栏文字全收成图标 —— 看起来像"三栏全没了"。

     ② `animation: none` —— 消息与思考卡挂着 `animation: ai-msg-in .3s ease backwards`，
        而 **backwards 的语义是"动画开始前用 from 那一帧"**（opacity: 0）。
        打印通道不做合成帧 ⇒ 动画永远停在开始前 ⇒ **整片消息区是空的**。
        `animation: none` 不是"把动画关掉看静态版"，而是让 fill-mode 不再生效，
        元素回到它自己的正常外观。`transition: none` 同理（抽屉/浮层的终态要立刻读到）。
     ⚠️ 这一条与 `read-probe.mjs` 里"不要读动画驱动的 opacity"是同一件事的两面：
        那边是"别信它"，这边是"绕开它"。

     ③ **但这条通道有个已实测的怪癖：它出的是「窄屏版」。**
        实测方式：注入一个 `html::after` 徽标，按 1200 / 768 两个断点改文案，
        再以 `@page size:1440px 900px` 出 PDF —— 徽标读到的是 **W<=768**，
        而**版面本身是按 1440 铺的**（顶栏胶囊占满整宽、面板通栏）。
        也就是说打印时"布局宽度"与"媒体查询求值用的视口"是两个数。
        后果：侧栏走 ≤768 的抽屉分支（`translateX(-100%)`，看不见）、
        右栏被收掉、顶栏文字收成图标、汉堡出现 —— 看起来像"三栏全没了"，
        实际是这一档**本来就应该长这样**。
        ⇒ 要用它看**宽屏三栏**是做不到的；要看宽屏请用 `--dump --probe`（读计算值）。
          但要人眼过一遍**窄屏布局**，它是本环境里唯一的通道。 */
if (PRINT) {
  html = html.replace(
    '</head>',
    `<style>@page{size:${SIZE.replace('x', 'px ')}px;margin:0}` +
      `*,*::before,*::after{animation:none !important;transition:none !important}</style></head>`,
  )
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
  /* `--noproxy '*'`：本机 `HTTP_PROXY` 指着 127.0.0.1 上的一个代理，
     它会把 `127.0.0.1:PORT` 也接管掉并回 502 "upstream connect failed" ——
     于是这里永远读不到 200、脚本每跑一次都去重起服务、撞端口。 */
  const r = spawnSync(
    'curl',
    ['-s', '--noproxy', '*', '-o', '/dev/null', '-w', '%{http_code}', `http://127.0.0.1:${PORT}/index.html`],
    { encoding: 'utf8' },
  )
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
const target = `http://127.0.0.1:${PORT}/__shot.html` + (HASH ? `#${HASH}` : '')

/* ⚠️ `--virtual-time-budget` **只能出现一次**：给两个时 Chrome 取先出现的那个，
   于是"切模块"多要的那段时间根本没生效 —— 截出来仍是切换前的画面，
   而画面看起来完全正常（就是个首页），最容易误判成"点击没生效"。 */
const budget = SERIES ? 7000 : 4000

/* ============================================================================
   调 Chrome 一律走这里。四件事都是"看起来像脚本坏了、其实是环境"，
   2026-09-24 一次性踩齐，记在这里免得下次再查一遍。
   ============================================================================
   1. **必须有自己的 `--user-data-dir`**。本机同时开着 GUI Chrome（很常见）时，
      无头实例会去共用同一个 profile：页面渲染完了、DOM 也产出了，**进程却不退出**。
      `spawnSync` 只能等 ⇒ 整个脚本卡住、一行输出都没有（连错误都没有）。
   2. **要 `timeout` 兜住**。第 1 条没法从 JS 侧解决（spawnSync 不给"先读再杀"的钩子），
      所以交给 `timeout`：产物该落的已经落了，杀掉进程不影响结果。
      因此**返回码 124 是正常的**，判据是"产物有没有内容"，不是退出码。
   3. **产物走文件、不走管道**。被 timeout 杀掉时管道里可能还有没被读走的字节，
      而文件是 Chrome 自己写下去的，杀它不影响已写入的内容。
   4. **`--no-proxy-server`**。本机 `HTTP_PROXY` 指着 `127.0.0.1:52350`（一个本地代理），
      `127.0.0.1:8791` 会被它接管并返回 502 "upstream connect failed" ——
      症状是页面永远白屏，而 curl 明明能取到 200。同理 `serving()` 里的 curl
      要加 `--noproxy '*'`，否则它会误判"服务没起"，再起一个、撞端口、退出。
   ============================================================================ */
const CHROME_PROFILE = path.join(os.tmpdir(), 'lucky-y-chrome-profile')
const CHROME_TIMEOUT_S = Math.ceil(budget / 1000) + 25
function runChrome(args, stdoutFile) {
  const cmd = [
    'timeout',
    String(CHROME_TIMEOUT_S),
    JSON.stringify(CHROME),
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--hide-scrollbars',
    '--no-proxy-server',
    /* 这两条别丢：dsf 决定截图的像素尺寸（丢了在 Retina 上会出 2× 的图），
       file-access 是早期调试 file:// 留下的，去掉它不影响 http 通道但也没必要动。 */
    '--force-device-scale-factor=1',
    '--allow-file-access-from-files',
    `--user-data-dir=${JSON.stringify(CHROME_PROFILE)}`,
    ...args.map((a) => JSON.stringify(a)),
    JSON.stringify(target),
    stdoutFile ? `> ${JSON.stringify(stdoutFile)}` : '',
    '2>/dev/null',
  ]
    .filter(Boolean)
    .join(' ')
  return spawnSync('sh', ['-c', cmd], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
}

/* --dump：不截图，把渲染后的 DOM 打到 stdout（见文件头的说明） */
if (DUMP) {
  const tmp = path.join(os.tmpdir(), 'lucky-y-dump.html')
  if (fs.existsSync(tmp)) fs.unlinkSync(tmp)
  runChrome(['--virtual-time-budget=' + budget, `--window-size=${w},${h}`, '--dump-dom'], tmp)
  const dom = fs.existsSync(tmp) ? fs.readFileSync(tmp, 'utf8') : ''
  if (!dom) {
    console.error('✗ DOM 取不到（Chrome 连第一段都没写出来）—— 看上面的说明第 1/4 条')
    process.exit(1)
  }
  process.stdout.write(dom)
  process.exit(0)
}

const CHROME_ARGS = [`--virtual-time-budget=${budget}`, `--window-size=${w},${h}`]

if (PRINT) {
  /* PDF 通道。`--no-pdf-header-footer` 去掉页眉页脚（否则会多出 URL 与日期两条）。 */
  const out = `${OUT_BASE}.pdf`
  runChrome([...CHROME_ARGS, '--no-pdf-header-footer', `--print-to-pdf=${out}`])
  if (!fs.existsSync(out)) {
    console.error('✗ 出 PDF 失败')
    process.exit(1)
  }
  const size = fs.statSync(out).size
  console.log(`✓ ${out}（${(size / 1024 / 1024).toFixed(1)} MB · ${SIZE} · ${THEME}/${GLASS}${SERIES ? ' · ' + SERIES : ''}）`)
  console.log(`  看图：sips -s format png --resampleWidth ${w} ${out} --out ${OUT_BASE}-p1.png`)
  process.exit(0)
}

runChrome([...CHROME_ARGS, `--screenshot=${OUT}`])
if (!fs.existsSync(OUT)) {
  console.error('✗ 截图失败')
  process.exit(1)
}
const size = fs.statSync(OUT).size
console.log(`✓ ${OUT}（${(size / 1024).toFixed(0)} KB · ${SIZE} · ${THEME}/${GLASS}${SERIES ? ' · ' + SERIES : ''}）`)
if (size < 20000) console.log('  ⚠️ 产物小于 20KB：页面很可能是白屏，去看是不是资源 404')
