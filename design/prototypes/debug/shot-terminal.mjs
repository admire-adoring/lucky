#!/usr/bin/env node
/* 终端页的真后端没办法在无头浏览器里连（`invoke` 只存在于 Tauri 窗口），
   所以这里给页面一个"假的后端、真的前端"：注入 `window.__TAURI_INTERNALS__.invoke`
   返回一份固定数据，再让页面自己走完连接 → 敲命令 → 采负载 → 跟日志这条链。
   ----------------------------------------------------------------------------
   验的是：新接的这几块（真实输出行、退出码、htop 真数据、日志、错误修复条、
   monitor 视图）在我们自己的样式里长什么样、会不会挤坏。
   验不了：SSH 本身。那一层由 `cargo test --lib term::` 与 live 测试负责。

   用法：node design/prototypes/debug/shot-terminal.mjs --out /tmp/term.png [--dump]
*/
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const DIST = path.resolve(HERE, '../../..', 'dist')
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = Number(process.env.SHOT_PORT || 8793)

function arg(name, fallback) {
  const index = process.argv.indexOf(`--${name}`)
  return index === -1 ? fallback : process.argv[index + 1]
}

const OUT = (() => {
  const raw = arg('out', '/tmp/term-shot.png')
  return /\.[a-zA-Z0-9]+$/.test(raw) ? raw : `${raw}.png`
})()
const THEME = arg('theme', 'dark')
const SIZE = arg('size', '1440x900')
const HASH = arg('hash', '/terminal/pj-1?host=CSCM%E5%86%85%E7%BD%91')
const DUMP = process.argv.includes('--dump')
const COMMAND = arg('command', 'ls -la /srv/app && df -h')
const FAIL = arg('fail', '')
const ESC = arg('esc', 'none')
const SCROLL = process.argv.includes('--scroll')
const VIEW = arg('view', 'dev')

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('✗ 先跑 vite build')
  process.exit(1)
}

/* 固定数据。刻意混入对齐用空格、中文、错误流与退出码 3，检查行内排版与配色 */
const MOCK = `
(function () {
  var opened = {
    sessionId: 'ts-mock', host: 'CSCM内网', ip: '192.168.0.75',
    user: 'root', effectiveUser: 'root',
    os: 'Linux 5.10.0-26-amd64', shell: '/bin/bash',
    home: '/root', cwd: '/srv/app',
    connectedAt: '2026-11-04T08:12:44Z', sessionNo: 7, connectMs: 186, escNote: ''
  }
  var stats = {
    available: true, note: '', cpu: 23.4, cores: 4,
    cpuBars: [31.2, 12.4, 27.8, 22.3],
    mem: 41.7, memUsedMb: 2668, memTotalMb: 6400,
    load: [0.62, 0.48, 0.39], tasks: 142, threads: 214, running: 2,
    processes: [
      { pid: 1204, user: 'root', cpu: 18.4, mem: 6.2, command: 'node server.js --port 3000' },
      { pid: 892, user: 'postgres', cpu: 4.1, mem: 9.8, command: 'postgres -D /var/lib/postgres' },
      { pid: 934, user: 'redis', cpu: 1.2, mem: 2.1, command: 'redis-server *:6379' },
      { pid: 2210, user: 'root', cpu: 0.8, mem: 1.4, command: 'nginx: worker process' },
      { pid: 3341, user: 'www-data', cpu: 0.6, mem: 3.3, command: 'php-fpm: pool www' },
      { pid: 3451, user: 'root', cpu: 0.4, mem: 0.9, command: '/usr/bin/docker-proxy' },
      { pid: 88, user: 'root', cpu: 0.2, mem: 0.3, command: '/sbin/init' },
      { pid: 4521, user: 'root', cpu: 0.1, mem: 0.2, command: '-bash' }
    ]
  }
  var tail = {
    source: '/var/log/nginx/access.log', lineCount: 12,
    text: [
      '10.20.3.41 - - [04/Nov/2026:16:01:12 +0800] "GET /api/health HTTP/1.1" 200 15 "-" "kube-probe/1.27"',
      '10.20.3.88 - - [04/Nov/2026:16:01:15 +0800] "POST /api/auth/login HTTP/1.1" 200 412 "-" "okhttp/4.9"',
      '10.20.3.90 - - [04/Nov/2026:16:01:18 +0800] "GET /api/orders?page=2 HTTP/1.1" 200 8934 "-" "Mozilla/5.0"',
      '10.20.3.41 - - [04/Nov/2026:16:01:20 +0800] "GET /api/health HTTP/1.1" 200 15 "-" "kube-probe/1.27"',
      '10.20.3.12 - - [04/Nov/2026:16:01:23 +0800] "POST /api/orders HTTP/1.1" 201 233 "-" "okhttp/4.9"',
      '10.20.3.71 - - [04/Nov/2026:16:01:24 +0800] "GET /static/app.css HTTP/1.1" 304 0 "-" "Mozilla/5.0"',
      '10.20.3.41 - - [04/Nov/2026:16:01:25 +0800] "GET /api/health HTTP/1.1" 200 15 "-" "kube-probe/1.27"',
      '10.20.3.90 - - [04/Nov/2026:16:01:28 +0800] "PATCH /api/orders/8842 HTTP/1.1" 500 87 "-" "Mozilla/5.0"'
    ].join('\\n')
  }
  var runOut = [
    'total 48',
    'drwxr-xr-x  6 root root 4096 Nov  3 09:12 .',
    'drwxr-xr-x 18 root root 4096 Nov  2 22:10 ..',
    'drwxr-xr-x  8 root root 4096 Nov  4 15:52 node_modules',
    'drwxr-xr-x  3 root root 4096 Nov  4 15:52 src',
    '-rw-r--r--  1 root root  512 Nov  3 09:23 README.md',
    '-rw-r--r--  1 root root 1024 Nov  2 22:22 index.html',
    '-rw-r--r--  1 root root 2048 Nov  2 22:22 package.json',
    '-rw-r--r--  1 root root 1890 Nov  2 22:22 server.js',
    '',
    'Filesystem      Size  Used Avail Use% Mounted on',
    '/dev/vda1        40G   21G   17G  56% /',
    'tmpfs           3.2G     0  3.2G   0% /dev/shm'
  ].join('\\n')

  var handlers = {
    term_open: function () {
      var fail = ${JSON.stringify(FAIL)}
      if (fail === 'auth') {
        return Promise.reject({ code: 'invalid', message: '密码被拒绝 —— 密码不对，或这台机器不允许该账户用密码登录（sshd 的 PasswordAuthentication / PermitRootLogin）' })
      }
      if (fail === 'net') {
        return Promise.reject({ code: 'invalid', message: '连不上 192.168.0.75:22 —— 机器关着、端口没开，或者 IP 不对' })
      }
      if (fail === 'sudo') {
        return Promise.reject({ code: 'invalid', message: 'sudo 提权不可用：sudo: a password is required（这台机器要免密 sudo，或改用 none）' })
      }
      if (fail === 'su') {
        return Promise.reject({ code: 'invalid', message: 'su 提权要一个真终端（tty），命令式终端给不了 —— 把提权方式改成 sudo 或 none' })
      }
      return opened
    },
    term_stats: function () { return stats },
    term_tail: function () { return tail },
    term_exec: function (args) {
      var command = (args && args.command) || ''
      if (command.indexOf('seq') === 0) {
        var bulk = []
        for (var i = 1; i <= 120; i++) bulk.push(String(i))
        return { stdout: bulk.join('\\n'), stderr: '', code: 0, durationMs: 42, cwd: opened.cwd, truncated: false, closed: false, hint: '' }
      }
      if (command.indexOf('cat') === 0) {
        return { stdout: '', stderr: 'cat: /root/missing.txt: No such file or directory', code: 1, durationMs: 61, cwd: opened.cwd, truncated: false, closed: false, hint: '' }
      }
      if (command.indexOf('su') === 0) {
        return { stdout: '', stderr: 'Password: su: Authentication failure', code: 1, durationMs: 1131, cwd: opened.cwd, truncated: false, closed: false, hint: 'su 要一个真终端才能问密码 —— 这里的命令走 stdin、没有 tty，它读到空密码就退出了，不是密码错。要 root 权限：把台账的提权方式设成 sudo（开会话时已用登录密码预热），之后命令本来就以 root 跑；或者换一个能直接登录的 root 账户。' }
      }
      return { stdout: runOut, stderr: '', code: 0, durationMs: 128, cwd: opened.cwd, truncated: false, closed: false, hint: '' }
    },
    term_history: function () {
      return [
        { id: 'tc-1', command: 'docker ps', exitCode: 0, durationMs: 96, cwd: '/srv/app', ranAt: '2026-11-04T08:02:00Z' },
        { id: 'tc-2', command: 'tail -n 200 /var/log/nginx/error.log', exitCode: 0, durationMs: 74, cwd: '/srv/app', ranAt: '2026-11-04T08:04:00Z' },
        { id: 'tc-3', command: 'systemctl status nebula-api', exitCode: 3, durationMs: 122, cwd: '/srv/app', ranAt: '2026-11-04T08:09:00Z' }
      ]
    },
    term_sessions: function () { return [] },
    srv_get: function () {
      return {
        id: 's1', host: 'CSCM内网', ip: '192.168.0.75', sshPort: 22, os: 'Linux 5.10',
        cores: 4, memGb: 6, diskGb: 40, roleCode: 'web', envCode: 'prod',
        loginUser: 'root', authCode: 'pwd', escMode: ${JSON.stringify(ESC)}, escUser: '',
        credRef: null, hasSecret: true, note: '', sortOrder: 0, removedAt: null,
        createdAt: '', updatedAt: '', projects: [], ports: [], tags: [], pathGroups: [], paths: []
      }
    }
  }

  window.__TAURI_INTERNALS__ = {
    invoke: function (cmd, args) {
      var handler = handlers[cmd]
      var value = handler ? handler(args) : (/_list$/.test(cmd) ? [] : null)
      return Promise.resolve(value)
    },
    transformCallback: function (callback) { return callback },
    convertFileSrc: function (value) { return value }
  }
})()
`

const seed = `<script>try{
  localStorage.setItem('lucky-y/auth', ${JSON.stringify(
    JSON.stringify({ state: { user: { name: '刘 阳', email: 'me@lucky-y.app', initials: 'LY' } }, version: 0 }),
  )});
  localStorage.setItem('lucky-y/theme', ${JSON.stringify(THEME)});
}catch(e){}</script>`

/* 真敲一条命令：用原生 setter 写 value 再派发 input/Enter，走的是页面自己的提交路径 */
const afterLoad = `<script>setTimeout(function(){
  var view = ${JSON.stringify(VIEW)};
  if (view === 'monitor') {
    var tabs = document.querySelectorAll('.tm-tab');
    if (tabs[1]) tabs[1].click();
  }
}, 900)
/* headless 的虚拟时钟跑不完 CSS transition —— 截图会停在宽度过半的样子。
   这一步只是把过渡去掉让布局落到终态，页面本身不动。 */
setTimeout(function(){
  var s = document.createElement('style');
  s.textContent = '*{transition:none !important}';
  document.head.appendChild(s);
}, 2600)</script>`

const typeCommand = `<script>setTimeout(function(){
  var el = document.querySelector('.tm-term-input');
  if (!el) { document.title = 'SHOT-FAIL 没有输入框'; return }
  var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(el, ${JSON.stringify(COMMAND)});
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
}, 1500)</script>`

/* 先刷满一屏，再把输出滚回顶部，然后敲第二条 —— 用来验"有新输出"的跳转 */
const scrollScript = `<script>
function tmRun(text) {
  var el = document.querySelector('.tm-term-input')
  var setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
  setter.call(el, text)
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
}
setTimeout(function () { tmRun('seq 1 120') }, 1400)
setTimeout(function () {
  var box = document.querySelector('.tm-term-output')
  if (box) { box.scrollTop = 0; box.dispatchEvent(new Event('scroll', { bubbles: true })) }
}, 2400)
setTimeout(function () { tmRun('df -h') }, 2800)
</script>`

let html = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8').replace('</head>', `${seed}\n<script>${MOCK}</script>\n</head>`)
html = html.replace('</body>', `${afterLoad}\n${FAIL ? '' : SCROLL ? scrollScript : typeCommand}\n</body>`)
const page = path.join(DIST, '__term-shot.html')
fs.writeFileSync(page, html)

function serving() {
  const result = spawnSync(
    'curl',
    ['-s', '--noproxy', '*', '-o', '/dev/null', '-w', '%{http_code}', `http://127.0.0.1:${PORT}/index.html`],
    { encoding: 'utf8' },
  )
  return (result.stdout || '').trim() === '200'
}
if (!serving()) {
  spawnSync('sh', [
    '-c',
    `cd ${JSON.stringify(DIST)} && nohup python3 -m http.server ${PORT} --bind 127.0.0.1 >/tmp/term-shot-server.log 2>&1 &`,
  ])
  const started = Date.now()
  while (!serving() && Date.now() - started < 6000) spawnSync('sleep', ['0.2'])
  if (!serving()) {
    console.error(`✗ 静态服务起不来（端口 ${PORT}）`)
    process.exit(1)
  }
}

const [width, height] = SIZE.split('x')
const target = `http://127.0.0.1:${PORT}/__term-shot.html#${HASH}`
const budget = 6000
const profile = path.join(os.tmpdir(), 'lucky-y-chrome-profile-term')
const args = [
  'timeout',
  String(Math.ceil(budget / 1000) + 25),
  JSON.stringify(CHROME),
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--no-proxy-server',
  '--force-device-scale-factor=1',
  `--user-data-dir=${JSON.stringify(profile)}`,
  `--virtual-time-budget=${budget}`,
  `--window-size=${width},${height}`,
]
const run = DUMP
  ? [...args, '--dump-dom', JSON.stringify(target), '>/tmp/term-shot-dom.html', '2>/dev/null']
  : [...args, `--screenshot=${JSON.stringify(OUT)}`, JSON.stringify(target), '2>/dev/null']
spawnSync('sh', ['-c', run.join(' ')], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })

if (DUMP) {
  const dom = fs.existsSync('/tmp/term-shot-dom.html') ? fs.readFileSync('/tmp/term-shot-dom.html', 'utf8') : ''
  if (!dom) {
    console.error('✗ DOM 取不到')
    process.exit(1)
  }
  process.stdout.write(dom)
  process.exit(0)
}

if (!fs.existsSync(OUT)) {
  console.error('✗ 截图失败')
  process.exit(1)
}
console.log(`✓ ${OUT}`)
