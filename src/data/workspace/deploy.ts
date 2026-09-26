/**
 * 部署窗口（运维 → 部署）的**常量与纯函数**。
 *
 * 来源：`design/work/工作-项目-项目详情-运维-部署-index.html` 的 `<script>`
 *      （第 1941–4529 行，约 2583 行 JS）。原型的「内容 + 计算」全挤在这一段里，
 *      与 DOM 操作混在一起，所以这里只把**与 DOM 无关的那部分**搬出来，让页面组件
 *      只关心渲染与状态机。
 *
 * 为什么单独成模块：
 *   · 这些是**数据与判定规则**，不是某个组件的内部实现 —— 比如「这条命令会不会停下来
 *     问人」的规则（detectAsk / autoInfo / needsHuman），页面、配置表单的提示行、
 *     摘要徽标三处都要用同一套口径，散在组件里迟早会分叉。
 *   · 纯函数可以脱离浏览器直接跑，改规则时能立刻验证，不用起页面。
 *
 * ⚠️ 刻意**留在页面组件里**的东西（不属于本模块）：
 *   · 一切 `document.*` / `el()` 建元素 / 事件绑定 / 定时器 / `requestAnimationFrame`；
 *   · `renderXxx` 系列渲染函数（renderCfgList / renderConfig / renderFiles / renderSteps /
 *     renderPicker / …）、`showToast`、`openConfirm` / `closeModal`、目录选择器视图、
 *     主题、剪贴板、拖拽。
 *   · 那些函数里**读状态**的写法（如 `files()`、`currentId`）保留在页面 —— 本模块
 *     只把「给定输入怎么算」搬出来，状态的归属仍是页面。
 *
 * ⚠️ 一处刻意的改造：原型里 `sessionUser` 是个模块级可变变量（从 URL `?user=` 读），
 *    `autoInfo` 直接读它来判断「root 身份下 su/sudo 不问密码」。模块级可变状态会让这些
 *    函数不再纯，所以这里把连接身份改成**显式入参**下传（`autoInfo(run, sessionUser)` 等），
 *    行为与原型一致：判定仍只看 `sessionUser === 'root'`。
 *    另有两处因 TS 类型收紧而重写、行为不变：`groupName`（原型用 `({}).name` 兜底，
 *    TS 不允许在 `{}` 上取属性）、`parseCmds` 的 JSON 分支（原样返回 JSON.parse 结果）。
 */

/* ------------------------------------------------------------------ *
 * 类型
 * ------------------------------------------------------------------ */

/** 文件来源：① 本机选择 / 拖入　② 绑定本机路径。两者二选一。 */
export type FileSrc = 'pick' | 'local'

/** 一条启动命令：操作名称 + 命令本体；`ask` = 执行到这里要停下来等人工输入。 */
export interface CmdItem {
  op: string
  run: string
  ask?: boolean
}

/** 从表单/JSON 里读到的、字段还没归一化的命令条目（`op`/`run` 可能缺失）。 */
export interface RawCmdItem {
  op?: string
  run?: string
  ask?: boolean
}

/** 命令来源：结构化数组，或表单隐藏 input 上的 JSON / 纯文本（旧的「每行一条」）。 */
export type CmdInput = string | RawCmdItem[] | null | undefined

/** 演示失败链用的失败点（对应 `buildSteps` 里那几个步骤的 key）。 */
export type FailPoint = 'check' | 'upload' | 'backup' | 'start' | 'health'

/** 一条部署配置：传到服务器哪个位置（path）+ 传完执行什么（cmd）。 */
export interface DeployConfig {
  id: string
  name: string
  /** 分组标签。没有标签的老数据退回按 path 推断（见 groupFor）。 */
  group?: string
  path: string
  cmd: CmdItem[]
  /** 仅用于把「失败链」演示出来（健康检查不通过 → 自动回滚）。 */
  failAt?: FailPoint
}

/** 步骤 key，与 `FAIL_MSG` / `cfg().failAt` / 终端行 `data-step` 共用一套。 */
export type DeployStepKey = 'check' | 'upload' | 'backup' | 'start' | 'health' | 'done'

/** 一个执行步骤 —— 决定右侧「执行任务」那一列。 */
export interface DeployStep {
  key: DeployStepKey
  name: string
  /** 步骤下方的说明行，空串表示不显示。 */
  line: string
  /** 演示用的基线耗时（ms）。0 表示终态步（只做标记，不再走秒）。 */
  ms: number
  /** 是否带进度条（只有上传那一步）。 */
  bar?: boolean
}

/** 左栏分组：id + 显示名 + 按路径推断的谓词。 */
export interface DeployGroup {
  id: string
  name: string
  match: (p: string) => boolean
}

/** 交互命令的种类 —— 会被 `detectAsk` 识别的几类。 */
export type AskKind = 'su' | 'sudo' | 'ssh' | 'mysql' | 'psql' | 'read'

export interface AskDetection {
  kind: AskKind
  /** 命令行里会打出来的提示语。 */
  prompt: string
  /** true = 一定会停下来（如无 -c 的 su）；false = 取决于免密配置。 */
  sure: boolean
  why: string
}

/** 自动化就绪度。`to` / `sudoLine` 只在有值的那几档出现。 */
export type AutoLevel = 'ready' | 'rewritable' | 'needsCommand' | 'external' | 'manual'

export interface AutoInfo {
  level: AutoLevel
  why: string
  /** 建议的非交互写法（只提示、不代改）。 */
  to?: string
  /** 免密授权行（sudoers），供用户照抄。 */
  sudoLine?: string
  /** true = 当前是 root 身份，提权命令天然不问密码。 */
  rootFree?: boolean
}

export interface AutoSummary {
  total: number
  askN: number
  rew: number
  ext: number
  ready: number
  full: boolean
}

/** 清单里的一条文件。pick 来源只有 name/size；local 来源带 path/time/found。 */
export interface StagedFile {
  src: FileSrc
  name: string
  size: number
  /** 仅 local */
  path?: string
  /** 仅 local */
  time?: string
  /** 仅 local：`false` 会挡住「开始部署」。 */
  found?: boolean
}

/** 本机假表里一条记录（真表里来自本地 agent 的探测结果）。 */
export interface LocalFileMeta {
  size: number
  time: string
}

/** 服务器目录树的目录节点。 */
export interface FsDir {
  type: 'd'
  children: Record<string, FsNode>
}

/** 服务器目录树的文件节点（这个选择器只列目录，但文件节点保留）。 */
export interface FsFile {
  type: 'f'
  size: string
  time: string
}

export type FsNode = FsDir | FsFile

/* ------------------------------------------------------------------ *
 * 常量数据
 * ------------------------------------------------------------------ */

/** 左栏分组。`other` 的谓词恒真，天然兜住"没标签也没匹配路径"的老数据。 */
export const DEPLOY_GROUPS: readonly DeployGroup[] = [
  { id: 'app', name: '应用服务', match: (p) => /^\/opt\/app(\/|$)/.test(p) },
  { id: 'web', name: '前端资源', match: (p) => /^\/var\/www(\/|$)/.test(p) },
  { id: 'db', name: '数据库', match: (p) => /^\/opt\/db(\/|$)/.test(p) },
  { id: 'other', name: '其它', match: () => true },
]

/**
 * 演示用的 5 条配置。页面会把它拷进自己的状态再增删改，所以这里是**种子数据**。
 *
 * c3 的 `failAt: 'health'` 用来演示失败链；c4 第 2 条命令带 `ask: true`，
 * 演示「需要人工输入」（su 会停下来等密码）；c5 是同一件事的免密写法（全自动）。
 */
export const CONFIGS: DeployConfig[] = [
  {
    id: 'c1',
    name: '应用包 · 全量启动',
    group: 'app',
    path: '/opt/app/releases',
    cmd: [
      { op: '同步文件', run: 'rsync -a --delete /opt/app/releases/ /opt/app/current/' },
      { op: '重启服务', run: 'su - deploy -c "systemctl restart pay-api"' },
      { op: '健康检查', run: 'curl -sf http://127.0.0.1:8080/healthz' },
    ],
  },
  {
    id: 'c2',
    name: '前端静态资源',
    group: 'web',
    path: '/var/www/pay-web/dist',
    cmd: [
      { op: '校验配置', run: 'nginx -t' },
      { op: '重载 Nginx', run: 'nginx -s reload' },
    ],
  },
  {
    id: 'c3',
    name: '数据库迁移脚本',
    group: 'db',
    path: '/opt/db/migrations',
    cmd: [
      { op: '备份当前库', run: 'pg_dump -Fc -f /opt/db/pre-migration.dump paydb' },
      { op: '执行迁移', run: 'psql -f /opt/db/migrations/latest.sql paydb' },
    ],
    failAt: 'health',
  },
  {
    id: 'c4',
    name: '切用户重启 · 需输入',
    group: 'app',
    path: '/opt/app/releases',
    cmd: [
      { op: '同步文件', run: 'rsync -a --delete /opt/app/releases/ /opt/app/current/' },
      { op: '切到 deploy', run: 'su - deploy', ask: true },
      { op: '重启服务', run: 'systemctl restart pay-api' },
    ],
  },
  {
    id: 'c5',
    name: '切用户重启 · 免密自动',
    group: 'app',
    path: '/opt/app/releases',
    cmd: [
      { op: '同步文件', run: 'rsync -a --delete /opt/app/releases/ /opt/app/current/' },
      { op: '免密重启', run: 'sudo -u deploy -n systemctl restart pay-api' },
      { op: '健康检查', run: 'curl -sf http://127.0.0.1:8080/healthz' },
    ],
  },
]

/** 表单里的「常用模板」：点一下整段替换启动命令。 */
export const CMD_PRESETS: readonly (readonly CmdItem[])[] = [
  [{ op: '重启服务', run: 'systemctl restart pay-api' }],
  [
    { op: '校验配置', run: 'nginx -t' },
    { op: '重载 Nginx', run: 'nginx -s reload' },
  ],
  [{ op: '切换用户重启', run: 'su - deploy -c "systemctl restart pay-api"' }],
  [
    { op: '切到 deploy', run: 'su - deploy', ask: true },
    { op: '重启服务', run: 'systemctl restart pay-api' },
  ],
  // 免密写法：执行时全程不需要人介入
  [{ op: '重启服务', run: 'sudo -u deploy -n systemctl restart pay-api' }],
]

/** 表单里的「常用路径」。 */
export const PATH_PRESETS: readonly string[] = [
  '/opt/app/releases',
  '/var/www/pay-web/dist',
  '/opt/db/migrations',
]

/**
 * 「绑定本机文件」的常用项。第三条**本机没有**（见 LOCAL_FS）——
 * 刻意留着，绑定之后立刻能看到「未找到」长什么样。
 */
export const LOCAL_PRESETS: readonly string[] = [
  '/Users/yangliu/build/pay-api.jar',
  '/Users/yangliu/build/pay-web-dist.tar.gz',
  '/Users/yangliu/build/pay-api-2.3.1.jar',
]

/**
 * 本机文件假表 —— 真实产品里这一步来自本地 agent：
 * 请求一个绝对路径 → 返回 存在 / 大小 / 修改时间。没列进来的一律算「本机没有」。
 */
export const LOCAL_FS: Record<string, LocalFileMeta> = {
  '/Users/yangliu/build/pay-api.jar': { size: 134873088, time: '今天 09:41' },
  '/Users/yangliu/build/pay-web-dist.tar.gz': { size: 18874368, time: '今天 10:02' },
  '/Users/yangliu/build/legacy/app-old.jar': { size: 96468992, time: '9月18日' },
}

/** 目录 / 文件节点的构造器（原型的 `fsDir` / `fsFile`），树是嵌套字面量，读起来才像一棵树。 */
export function fsDir(children: Record<string, FsNode>): FsDir {
  return { type: 'd', children: children }
}

export function fsFile(size: string, time: string): FsFile {
  return { type: 'f', size: size, time: time }
}

/**
 * 服务器目录**假树** —— 点「浏览服务器目录」时展开的就是它。
 * 真实产品里这一段来自服务端（打开 → 请求当前目录 → 点目录 → 再请求下一级）。
 *
 * 层级刻意与三条常用路径对齐，所以「选出来的目录」和「手输的目录」落在同一套位置上；
 * `/opt/app/releases` 给到 10 个历史版本目录 —— 真实机器的发布目录就长这样，
 * 筛选框也才有存在的理由。树里保留文件节点（那是机器上的事实），但选择器只列目录。
 */
export const HOST_FS: FsDir = fsDir({
  bin: fsDir({}),
  etc: fsDir({
    nginx: fsDir({ 'nginx.conf': fsFile('2.4 KB', '9月10日'), 'mime.types': fsFile('3.1 KB', '9月10日') }),
    systemd: fsDir({ system: fsDir({ 'pay-api.service': fsFile('680 B', '9月18日') }) }),
    hosts: fsFile('220 B', '9月12日'),
  }),
  home: fsDir({
    deploy: fsDir({ '.bash_history': fsFile('18 KB', '今天 09:41'), 'release.sh': fsFile('1.2 KB', '9月20日') }),
  }),
  opt: fsDir({
    app: fsDir({
      releases: fsDir({
        '20260925-1812': fsDir({}),
        '20260924-0930': fsDir({}),
        '20260923-1714': fsDir({}),
        '20260922-1026': fsDir({}),
        '20260921-1902': fsDir({}),
        '20260920-1138': fsDir({}),
        '20260919-1645': fsDir({}),
        '20260918-0921': fsDir({}),
        '20260917-1533': fsDir({}),
        '20260916-1047': fsDir({}),
      }),
      current: fsDir({
        config: fsDir({ 'application.yml': fsFile('4.6 KB', '今天 09:20') }),
        static: fsDir({}),
        VERSION: fsFile('12 B', '今天 09:20'),
      }),
      shared: fsDir({
        config: fsDir({}),
        logs: fsDir({ 'pay-api.log': fsFile('62 MB', '今天 10:14') }),
        uploads: fsDir({}),
      }),
      backup: fsDir({ 'pre-20260925.dump': fsFile('420 MB', '今天 09:18') }),
    }),
    db: fsDir({
      migrations: fsDir({
        'V1__init.sql': fsFile('8.2 KB', '9月02日'),
        'V2__add_order_index.sql': fsFile('1.4 KB', '9月14日'),
        'latest.sql': fsFile('12 KB', '今天 08:40'),
      }),
      backups: fsDir({}),
    }),
  }),
  srv: fsDir({}),
  tmp: fsDir({}),
  usr: fsDir({ local: fsDir({}), share: fsDir({}) }),
  var: fsDir({
    www: fsDir({
      'pay-web': fsDir({
        dist: fsDir({
          'index.html': fsFile('4.1 KB', '今天 09:22'),
          assets: fsDir({}),
          'favicon.ico': fsFile('15 KB', '9月12日'),
        }),
        static: fsDir({}),
        conf: fsDir({ 'nginx.include': fsFile('820 B', '9月14日') }),
      }),
      html: fsDir({ 'index.html': fsFile('4.1 KB', '9月12日') }),
    }),
    log: fsDir({
      nginx: fsDir({ 'access.log': fsFile('186 MB', '2 分钟前'), 'error.log': fsFile('4.2 MB', '今天 10:12') }),
      syslog: fsFile('12 MB', '今天 10:15'),
    }),
    lib: fsDir({ docker: fsDir({ containers: fsDir({}) }) }),
  }),
})

/**
 * 路径为空时目录选择器落在哪：`/opt/app` 是发布包最常待的地方 ——
 * 让人每次都从根目录点三层才到，是把「目录结构」的教育成本转嫁给日常操作。
 */
export const FS_HOME: readonly string[] = ['opt', 'app']

/** 失败原因文案，按步骤 key 索引。 */
export const FAIL_MSG: Record<FailPoint, string> = {
  check: '本地文件不可读或校验值不匹配',
  upload: '目标目录写入失败（磁盘空间不足）',
  backup: '回滚点创建失败',
  start: '启动命令返回非 0 退出码',
  health: '健康检查连续 3 次未通过（/healthz 返回 502）',
}

/** 来源的中文名，用在提示与日志里。 */
export const SRC_LABEL: Record<FileSrc, string> = {
  pick: '本机选择',
  local: '绑定本机',
}

/** Toast 图标。`type` 可能是空串（成功默认档），所以用 `|| TOAST_ICON.ok` 兜底。 */
export const TOAST_ICON: Record<string, string> = {
  ok: '✓',
  info: 'ℹ',
  warn: '⚠',
  danger: '✕',
}

/**
 * 主按钮的两个图标（内联 SVG 串）。
 * 文字与图标必须同步翻转，所以页面只在 `setRunBtn` 一处用它们。
 */
export const ICO: { run: string; busy: string } = {
  run:
    '<svg viewBox="0 0 16 16" aria-hidden="true">' +
    '<circle cx="8" cy="8" r="6.3" fill="none" stroke="currentColor" stroke-width="1.5" opacity="0.38"/>' +
    '<path d="M6.3 5.1 10.7 8l-4.4 2.9z" fill="currentColor"/></svg>',
  // 270° 的弧，配合 CSS 的 spin 转起来就是标准的加载态
  busy:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7"' +
    ' stroke-linecap="round" aria-hidden="true"><path d="M8 2.8a5.2 5.2 0 1 0 5.2 5.2"/></svg>',
}

/** 目录选择器每行左侧的箭头标记。 */
export const PICK_CHEV: string =
  '<svg class="pick-chev" viewBox="0 0 16 16" aria-hidden="true">' +
  '<path d="M6.5 4.4 10.1 8l-3.6 3.6"/></svg>'

/** 等 3 分钟没人输入就判失败，而不是无限挂着。 */
export const ASK_TIMEOUT_MS = 180000

/* ------------------------------------------------------------------ *
 * 分组
 * ------------------------------------------------------------------ */

/** 按路径推断分组；没有匹配时落到最后一个（`other`，谓词恒真）。 */
export function groupFromPath(path?: string | null): string {
  const p = String(path || '')
  const g = DEPLOY_GROUPS.find((x) => x.match(p)) || DEPLOY_GROUPS[DEPLOY_GROUPS.length - 1]
  return g.id
}

export function groupName(id: string): string {
  const g = DEPLOY_GROUPS.find((x) => x.id === id)
  return g ? g.name : ''
}

/** 标签优先、路径兜底。两处都要用同一个口径（列表归组 + 表单预选），别各写一遍这个 `||`。 */
export function groupFor(c: { group?: string; path?: string } | null | undefined): string {
  return (c && c.group) || groupFromPath(c && c.path)
}

/* ------------------------------------------------------------------ *
 * 大小 / 路径 / 时间等小工具
 * ------------------------------------------------------------------ */

export function fmtSize(b: number): string {
  if (b >= 1073741824) return (b / 1073741824).toFixed(2) + ' GB'
  if (b >= 1048576) return (b / 1048576).toFixed(1) + ' MB'
  if (b >= 1024) return (b / 1024).toFixed(0) + ' KB'
  return b + ' B'
}

/** 未找到的绑定文件按 0 计 —— 它不会被真的上传，算进总量是假账。 */
export function totalSize(files: readonly StagedFile[]): number {
  return files.reduce((s, f) => s + (f.found === false ? 0 : f.size), 0)
}

/** 清单左侧那个来源徽标：文件后缀大写，最长 4 位，取不到就是 FILE。 */
export function extOf(name: string): string {
  const m = String(name).match(/\.([A-Za-z0-9]+)$/)
  return m ? m[1].toUpperCase().slice(0, 4) : 'FILE'
}

/** 取路径最后一段（去尾斜杠）。路径指向目录时返回空串，调用方据此提示。 */
export function baseName(p: string): string {
  return String(p).replace(/\/+$/, '').split('/').pop() || ''
}

/** 探测本机是否存在这个文件：命中返回 {size,time}，否则 null。 */
export function localProbe(path: string): LocalFileMeta | null {
  return LOCAL_FS[path] || null
}

export function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

/** 控制台/状态行的时间戳。原型无参读当前时间，这里允许显式传 `Date`（便于验证）。 */
export function hhmmss(d: Date = new Date()): string {
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds())
}

/**
 * 第一步（校验）的名字由「这一批文件长什么样」决定：有本机绑定就一并说清，
 * 因为绑定文件走的是「直接读本机那份」，与上传来的文件不是同一条路。
 *
 * 原型读全局 `files()` / `fileSrc`；这里改成显式入参（数量 + 来源），仍是纯函数。
 */
export function checkStepName(fileCount: number, fileSrc: FileSrc): string {
  if (!fileCount) return '校验本地文件'
  return fileSrc === 'local'
    ? '校验绑定路径（' + fileCount + ' 份）'
    : '校验本地文件（' + fileCount + ' 个）'
}

/* ------------------------------------------------------------------ *
 * 命令读取
 * ------------------------------------------------------------------ */

/**
 * 读到结构化的命令列表。表单里以 JSON 存在隐藏 input 上；
 * 也容忍纯文本（旧的「每行一条」）。注意它**不过滤空行**（cmdList 才过滤）。
 */
export function parseCmds(v: CmdInput): RawCmdItem[] {
  if (typeof v === 'string') {
    const t = v.trim()
    if (!t) return []
    if (t.charAt(0) === '[') {
      try {
        return JSON.parse(t) as RawCmdItem[]
      } catch (e) {
        return []
      }
    }
    return t.split('\n').map((s) => ({ op: '', run: s }))
  }
  return Array.isArray(v) ? v : []
}

/**
 * 只保留真正有命令的条目，并归一化字段。
 * `ask` 必须原样带下去 —— 它决定执行时那一条要不要停下来等输入。
 */
export function cmdList(v: CmdInput): CmdItem[] {
  return parseCmds(v)
    .filter((x) => x && String(x.run || '').trim())
    .map((x) => ({
      op: String(x.op || '').trim(),
      run: String(x.run).trim(),
      ask: !!x.ask,
    }))
}

/**
 * 步骤说明行很窄，只放第一条的操作名（没有就退回命令本身），再补一句状态后缀：
 * 有要人工输入的 → 「含 N 处需输入」；全非交互且确实有提权命令 → 「免密自动」。
 */
export function cmdBrief(v: CmdInput, sessionUser: string): string {
  const a = cmdList(v)
  if (!a.length) return '—'
  const first = a[0].op || a[0].run
  const n = a.filter((x) => needsHuman(x, sessionUser)).length
  // 全非交互、且确实有提权命令 → 简报里点出「免密自动」，与「需输入」对称
  const auto =
    !n &&
    a.some((x) => {
      const i = autoInfo(x.run, sessionUser)
      return i && i.level === 'ready' && /^(sudo|su)\b/.test(x.run)
    })
  return (a.length === 1 ? first : first + ' 等 ' + a.length + ' 条') + (n ? ' · 含 ' + n + ' 处需输入' : auto ? ' · 免密自动' : '')
}

/* ------------------------------------------------------------------ *
 * 交互命令识别（只识别 + 给建议，不代改）
 * ------------------------------------------------------------------ */

export function detectAsk(run: string): AskDetection | null {
  const s = String(run || '').trim()
  if (!s) return null
  if (/^su\b/.test(s)) {
    const hasC = /(^|\s)-c(\s|$)/.test(s)
    return {
      kind: 'su',
      prompt: 'Password:',
      sure: !hasC,
      why: hasC ? 'su 在非 root 下仍可能要求密码' : 'su 会停在这里等密码',
    }
  }
  if (/^sudo\b/.test(s) && !/(^|\s)-n(\s|$)/.test(s)) {
    return { kind: 'sudo', prompt: '[sudo] password for deploy:', sure: false, why: '没加 -n，未配置免密时会要求密码' }
  }
  if (/^(ssh|scp|sftp)\b/.test(s)) {
    return {
      kind: 'ssh',
      prompt: "deploy@10.0.3.12's password:",
      sure: false,
      why: '未配置公钥登录时会要求密码',
    }
  }
  if (/^(mysql|mariadb)\b/i.test(s)) {
    return { kind: 'mysql', prompt: 'Enter password:', sure: false, why: '命令里没带凭据时会要求密码' }
  }
  if (/^psql\b/.test(s)) {
    return { kind: 'psql', prompt: 'Password for user pay:', sure: false, why: '未配置 ~/.pgpass 时会要求密码' }
  }
  if (/(^|[|;&]\s*)(read|passwd)\b/.test(s)) {
    return { kind: 'read', prompt: '', sure: true, why: '这条命令本身就在读输入' }
  }
  return null
}

/** 从 sudo 的参数里剥出真正要执行的命令。 */
export function stripSudoFlags(s: string): string {
  return String(s || '')
    .replace(/(^|\s)-u\s+\S+/g, ' ')
    .replace(/(^|\s)-n(\s|$)/g, ' ')
    .replace(/(^|\s)-(i|H|E|S|A)(\s|$)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 免密授权行：跑部署的用户 → 以 targetUser 身份 → 免密执行这一条命令。 */
export function sudoersLine(run: string): string {
  const asUser = (String(run).match(/(?:^|\s)-u\s+([\w.@-]+)/) || [])[1]
  const cmd = stripSudoFlags(String(run).replace(/^sudo\s+/, ''))
  if (!cmd) return ''
  return '<跑部署的用户> ALL=(' + (asUser || 'root') + ') NOPASSWD: ' + cmd
}

/**
 * 自动化就绪度：**只识别 + 给建议，不代改**。
 * 同一条命令基本都有非交互写法，这里算出「建议写法」（`to`）摆在提示行里让用户照抄。
 * 「一键改写」已按用户要求移除 —— 命令是用户亲手写的，工具代它改比「告诉它建议怎么写」更容易出错。
 */
export function autoInfo(run: string, sessionUser: string): AutoInfo | null {
  const s = String(run || '').trim()
  if (!s) return null
  // root 身份下 su / sudo 都不问密码（sudo 对 root 免认证，su 从 root 切任何用户也免认证）。
  // 这条规则只作用于提权命令 —— ssh / psql 不因为「我在本机是 root」就免掉对端认证。
  const asRoot = sessionUser === 'root'
  let m = s.match(/^su\s+(?:-\s+)?([\w.@-]+)\s+-c\s+(["'])([\s\S]+)\2\s*$/)
  if (m) {
    if (asRoot) return { level: 'ready', rootFree: true, why: '当前连接身份是 root，切到 ' + m[1] + ' 不需要密码' }
    return {
      level: 'rewritable',
      to: 'sudo -u ' + m[1] + ' -n ' + m[3],
      // 别写成「一定会停」：su -c 在 root 下不问密码，图标那档是 ℹ，文案得跟着
      why: 'su -c 在非 root 下仍会要密码；换 sudo -u … -n 就免密（没授权立刻失败，不挂着）',
    }
  }
  m = s.match(/^su\s+(?:-\s+)?([\w.@-]+)\s*$/)
  if (m) {
    if (asRoot) return { level: 'ready', rootFree: true, why: '当前连接身份是 root，切到 ' + m[1] + ' 不需要密码' }
    return { level: 'needsCommand', why: 'su 一定会停下来要密码；补上要执行的命令就能免密' }
  }
  if (/^sudo\b/.test(s)) {
    const hasN = /(^|\s)-n(\s|$)/.test(s)
    if (!stripSudoFlags(s.replace(/^sudo\s+/, ''))) {
      return { level: 'needsCommand', why: '补上要执行的命令就能免密' }
    }
    if (asRoot) return { level: 'ready', rootFree: true, why: '当前连接身份是 root，sudo 不会要密码' }
    if (hasN) return { level: 'ready', why: '已是非交互写法（-n）', sudoLine: sudoersLine(s) }
    return {
      level: 'rewritable',
      to: s.replace(/^sudo\s+/, 'sudo -n '),
      why: '加 -n：没配免密授权就立刻失败，不会挂在那儿等密码',
      sudoLine: sudoersLine(s),
    }
  }
  if (/^ssh\b/.test(s) && !/-o\s*BatchMode/.test(s)) {
    return {
      level: 'rewritable',
      to: s.replace(/^ssh\b/, 'ssh -o BatchMode=yes'),
      why: '配好公钥登录 + BatchMode：要密码时立刻失败，不挂着',
    }
  }
  if (/^(scp|sftp)\b/.test(s) && !/-o\s*BatchMode/.test(s)) {
    return {
      level: 'rewritable',
      to: s.replace(/^(scp|sftp)\b/, '$1 -o BatchMode=yes'),
      why: '配好公钥登录 + BatchMode：要密码时立刻失败，不挂着',
    }
  }
  if (/^(mysql|mariadb)\b/i.test(s)) {
    return { level: 'external', why: '免交互要配 ~/.my.cnf（或 --defaults-extra-file=…），页面改不了' }
  }
  if (/^psql\b/.test(s)) {
    return { level: 'external', why: '免交互要配 ~/.pgpass，页面改不了' }
  }
  const det = detectAsk(s)
  if (det) return { level: 'manual', why: det.why }
  return { level: 'ready', why: '' }
}

/**
 * 这条命令这次到底要不要人。
 *
 * `ask` 是「用户说这条要人」，但连接身份已经让提权不问密码时，这条声明就是多余的（甚至过期）——
 * 执行侧按事实走，否则会出现「提示说不会提示 / 徽标说需输入 / 真跑起来停住」三方打架。
 */
export function needsHuman(x: CmdItem, sessionUser: string): boolean {
  if (!x || !x.ask) return false
  const i = autoInfo(x.run, sessionUser)
  return !(i && i.rootFree)
}

/**
 * 一条配置整体的自动化程度。
 *
 * 「全自动」= 没有任何人工标记，**且**没有「可能还要密码」的命令 ——
 * su -c / sudo（无 -n）都不算，别把「大概能跑」说成「全自动」。
 */
export function autoSummary(c: DeployConfig | null | undefined, sessionUser: string): AutoSummary {
  const arr = c ? cmdList(c.cmd) : []
  let askN = 0
  let rew = 0
  let ext = 0
  let ready = 0
  arr.forEach((x) => {
    const i = autoInfo(x.run, sessionUser)
    if (needsHuman(x, sessionUser)) {
      askN++
      return
    }
    if (!i) return
    if (i.level === 'ready') ready++
    else if (i.level === 'rewritable' || i.level === 'needsCommand') rew++
    else if (i.level === 'external') ext++
    else askN++ // manual：识别不出改写法的交互命令，按「要人」算
  })
  return {
    total: arr.length,
    askN: askN,
    rew: rew,
    ext: ext,
    ready: ready,
    full: arr.length > 0 && askN === 0 && rew === 0 && ext === 0,
  }
}

/* ------------------------------------------------------------------ *
 * 步骤
 * ------------------------------------------------------------------ */

/**
 * 从一条配置推出步骤数组 —— 决定右侧「执行任务」那一列。
 * 步骤数固定 6 条；差异只在 `upload.name`（含目标路径）与 `start.line`（命令简报）。
 *
 * `sessionUser` 只影响 `start.line` 的后缀（root 身份下某些命令不再算「需输入」）。
 */
export function buildSteps(c: DeployConfig, sessionUser: string): DeployStep[] {
  return [
    { key: 'check', name: '校验本地文件', line: '检查可读性与校验值', ms: 700 },
    { key: 'upload', name: '上传到 ' + c.path, line: '', ms: 1900, bar: true },
    { key: 'backup', name: '备份当前版本', line: '生成回滚点', ms: 900 },
    { key: 'start', name: '执行启动命令', line: cmdBrief(c.cmd, sessionUser), ms: 1300 },
    { key: 'health', name: '健康检查', line: 'GET /healthz', ms: 950 },
    { key: 'done', name: '部署完成', line: '', ms: 0 },
  ]
}

/* ------------------------------------------------------------------ *
 * 目录树查找（目录选择器用）
 * ------------------------------------------------------------------ */

/** 从根开始按段走。中途撞到文件或走丢都返回 null。 */
export function fsNodeAt(parts: readonly string[]): FsNode | null {
  let node: FsNode | undefined = HOST_FS
  for (let i = 0; i < parts.length && node; i++) {
    if (node.type !== 'd') return null
    node = node.children[parts[i]]
  }
  return node || null
}

/**
 * 已填的路径可能指向目录、指向文件、或早就没了（配置是历史留下的）。
 * 三种都要落到一个能用的位置上：目录本身 → 它所在的那一级 → 最长的存在前缀 → 默认。
 */
export function fsDirFor(parts: readonly string[]): string[] {
  const cut = parts.slice()
  while (cut.length) {
    const node = fsNodeAt(cut)
    if (node) return node.type === 'd' ? cut : cut.slice(0, -1)
    cut.pop()
  }
  return FS_HOME.slice()
}

/**
 * 只数**子目录**：这个视图只列目录，拿 children 总数会把看不见的文件算进去，
 * 出现「显示 3 项却只有 2 行」这种对不上的账。
 */
export function dirCount(node: FsDir): number {
  return Object.keys(node.children).filter((k) => node.children[k].type === 'd').length
}
