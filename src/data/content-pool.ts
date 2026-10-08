import type { DocKind, DocLinkFamily, DocLinkKind, Scope } from '../types'

/**
 * 文档池的一条 —— 名字 + 种类 + 距上次更新多少小时。
 *
 * 2026-09-25 从「字符串数组」改成对象数组，是为了文档列表页
 *    （`design/work/work_project_detail_document.html`，已落地）：
 *    那一页的子类栏是这个页面的主轴（方案/设计/接口/…），而种类在应用里
 *    没有别的来源。两种做法里选的是声明在池子里：
 *      · 声明式（现在这样）：分类是这条内容自己的属性，「技术方案」判成"方案"是读得出来的；
 *      · 按哈希轮转（`DOC_SOURCES` 那种）：同一篇文档换个项目就换个分类，名字与分类会互相打架。
 *    `updatedHours` 同理：它派生「3 小时前 / 昨天 / N 天前」与「是不是新文档」两件事，
 *    写成数字之后，文案由 `docUpdatedText()` 算，不散在各处硬编。
 *
 *    这两样是新加的字段（应用原本只有 name/source/summary/updatedAt）：
 *       分类与时间刻度都是"这一页要用的最小信息"，不是给每个项目手写一份内容。
 */
/**
 * 服务器档 —— 运维分区要每台机器的规格与负载，而 `Project` 上只有"这是个什么项目"。
 *
 * 9 个字段里有 6 个是这台机器自己的事实（角色/环境/系统/核数/内存/磁盘），
 *    3 个是负载读数。两者分开写在这里，因为它们是同一件事的两面：
 *    规格决定"这台机器能装多少"（`spec`、目录占用都从 `cores/memGb/diskGb` 算），
 *    负载决定"现在用了多少"（KPI 条的"环境健康"直接数 ≥90 的那几项）。
 *    写死在派生器里更糟 —— 那会把"db 一定 95%"变成藏在 if 里的业务规则。
 */
export interface ServerSeed {
  /** 角色后缀：web / db / cache */
  role: string
  env: 'prod' | 'test'
  /**
   * 地址。写全（原型的 `47.100.23.11`）—— 行上的小字与信息面板两处都读它，
   * 而"这台机器是哪个地址"是这一页最常被复制走的一个值。
   */
  ip: string
  os: string
  /**
   * 登录身份：登录用户 / 认证方式 / 登录后提权。
   *
   * 与「添加服务器」那张表存的是同一组字段（词表也照它：`su -` / `sudo -u root -n`）。
   * 判据一句话："这个值，没连上的时候存在吗？" —— 登录方式与提权方式是配置，
   * 不用连就知道 ⇒ 可以进服务器详情页的字段区；而负载 / 版本 / 运行时长要连上才读得到
   * ⇒ 它们永不进字段区（见 `ServerDetail` 的文件头）。
   */
  user: string
  auth: 'key' | 'pwd'
  esc: 'none' | 'su' | 'sudo'
  /**
   * 信息面板里"不用连也能知道"的那几项（地址 / 系统之外的）。
   * `inMeta` 的那几项同时出现在行上的小字里 —— 一份声明、两处引用，不各写一份。
   * 规格 / 运行时长 / 版本 / 健康检查 / 资源使用都要连上才读得到，不在这里（监控分区已撤）。
   */
  info: InfoField[]
  /** 核数 —— 平均负载 = `cpu%` × 核数，内存/磁盘的"用了多少 G"也从这三个数算 */
  cores: number
  memGb: number
  diskGb: number
  /** 负载百分比。任意一项 ≥ 90 即算告警 */
  cpu: number
  mem: number
  disk: number
  /**
   * 「哪些文件可以清」那一段（读作提示行 + 清理按钮）。缺省 = 这台机器上没有可回收的东西，
   * 那一整段不渲染。
   *
   * 它说的是"哪些文件可以清"，不是"磁盘告警"：本页管的是部署文件 / 查看日志，
   *    磁盘使用率不是它要回答的问题（真出问题由云监控去吼）。
   */
  reclaim?: ReclaimSeed
  /**
   * 项目文件位置的分组。数组顺序就是显示顺序。
   * 空数组 = 这台机器不登记文件位置（`paths` 也必须为空）。
   */
  pathGroups: string[]
  /**
   * 这个项目在这台机器上的文件在哪（配置 / 产物 / 日志目录…），不是整机目录占用 ——
   * 管这台机器时真正要问的是"我要改、要传的那个文件在哪儿"，所以每条给「用途 / 路径 / 备注」。
   * 这是可增删改的清单（页面里就地改这一份，见 `OpsPanel`），所以它是数组、不是查表。
   */
  paths: PathSeed[]
  /**
   * 路径浏览器里那些"这台机器上确实有、只是还没登记"的同级项。
   * 树不是手写的第二份清单：主体由 `paths` 自己长出来，这里只补它没覆盖到的兄弟节点
   *    （手写一棵树 + 一份清单必然走岔 —— 清单里换了路径，树里还留着旧的）。
   */
  fsExtra: FsSeed[]
  /** 路径为空时浏览器的落点（这台机器最常去的那一层），从 `/` 往下逐级写 */
  fsHome: string[]
}

/** 信息面板里的一条「标签 / 值」。`inMeta` 的会同时进行上那行小字 */
export interface InfoField {
  label: string
  value: string
  inMeta?: boolean
}

/** 「哪些文件可以清」：提示行 + 二次确认的两段文案（原型逐字） */
export interface ReclaimSeed {
  note: string
  desc: string
  warn: string
}

/** 一条"项目文件位置"。`note` 里的 `{v}` 由派生器换成当前版本号（见 `buildServerPaths`） */
export interface PathSeed {
  /** 必须是 `pathGroups` 里的一项 —— 归类给"选"不给"填"（自由输入会立刻长出「配置/配置文件/conf」三个组） */
  group: string
  use: string
  path: string
  note: string
  /**
   * 打开这个文件会看到什么。原型没有后端，这里就是"看一眼内容"的事实源：
   * 文本给真实可读的片段、目录给 `ls` 的形态、二进制给一句说明。
   * 缺省 = 抽屉里写"这个文件在本原型里没有示例内容"。
   */
  preview?: string
}

/** 路径浏览器里补的那些同级项。`dir` 省略即文件（文件要带 `size` / `time`） */
export interface FsSeed {
  path: string
  dir?: boolean
  size?: string
  time?: string
}

/** 部署文档档。原来是纯字符串数组，`kind`/`version` 由下标硬编 —— 三样都改成声明 */
export interface DeployDocSeed {
  name: string
  /** 手册 / 流程 / 脚本 */
  kind: string
  version: string
  updatedHours: number
}

/**
 * 账户档（项目详情「账户」页，`工作-项目-项目详情-账户-index.html`，2026-09-27 重做）。
 *
 * 一条件 = 一条凭据 —— 这一区回答的是"这个项目要用的那些账号，在哪儿、还能不能用"。
 * 与「运维」的分工是一句话：运维管机器（连上去、传文件、发版），账户管身份。
 *
 * 时间存的是「距今几天」（`rotatedDays` / `dueDays`），绝对日期到页面上才按今天推出来。
 *    存绝对日期的话，「3 天后」和那个日期迟早互相打脸（原型文件头那条判据）。
 *    ⇒ 因此 `dueDays` 与 `cycle - rotatedDays` 必须自洽，改一个要连着改另一个。
 * 这一份是可增删改的清单（添加 / 编辑 / 停用 / 删除 / 轮换都就地改它），
 *    与 `ServerSeed.paths` 同一条口径 —— 池子是演示数据的唯一来源，没有接口。
 */
export interface AccountSeed {
  /** 内部键（展开面板 / 复制都按它找）。不用中文平台名，免得把非 ASCII 带进 id */
  id: string
  /**
   * 平台。是自己输入的自由文本，不是枚举 —— 分组维度就是它
   * ⇒ 比"同名账号"时要 `trim + toLowerCase`，别让大小写凭空多出一个组。
   */
  platform: string
  /** 登录账号名 */
  user: string
  /**
   * 凭据类型。两类只差一条：能不能回显明文。
   * （原来那套"密码 / AccessKey / 访问令牌"三分法被合并，就是因为后两类在界面上行为
   *   完全一样 —— 都不能回显、都只能随机生成 —— 只差一个前缀，而前缀说的是"哪个平台的"，
   *   平台早就独占一格了。）
   */
  type: 'password' | 'key'
  env: 'prod' | 'test' | 'dev'
  /** 备注（选填）：换绑手机 / 只在发版流水线里用 / 对账出问题时才登 … */
  note?: string
  /** 轮换周期（天）。生产 90 / 测试与开发 180 —— 抽屉里换环境时按这档带出默认值 */
  cycle: number
  /** 上次轮换 = 距今几天（0 = 今天） */
  rotatedDays: number
  /** 上次是谁换的 */
  rotatedBy: string
  /** 下次到期 = 距今几天，负数 = 已逾期。整张清单唯一的颜色语义就是它 */
  dueDays: number
  /** 明文。密码可回显；密钥只在生成那一次出现（演示数据里仍留一份，供「复制」用） */
  secret: string
  /** 停用。停用 ≠ 删除：它留在清单里、不再计入轮换计划，也不再吃告警色 */
  disabled?: boolean
}

/* ------------------------------------------------------------------ *
 * 日志（项目详情「运维 · 日志」页，2026-09-25）
 * ------------------------------------------------------------------ */

/**
 * 日志种类 —— 它决定"这份日志的行长什么样"（下面 `LOG_LINES` 的 key）。
 * 与"这份日志叫什么名"无关：`web` 机器上的 `Nginx 访问日志` 与任何机器上的访问日志
 * 用的是同一套行模板。
 */
export type LogKind = 'access' | 'error' | 'app' | 'syslog' | 'postgres' | 'wal' | 'backup'

/** 日志行模板。`level` 决定这行的颜色（左侧色条），不决定要不要渲染级别徽标 */
export interface LogLineSeed {
  level: 'info' | 'warn' | 'error'
  /** 行正文。`⟦…⟧` 圈起来的那段会被渲染成 `<code>`（原型里的等宽片段） */
  text: string
}

/** 日志源档（按服务器角色分）。空数组 = 这台机器没有配日志路径 */
export interface LogSourceSeed {
  kind: LogKind
  name: string
  path: string
  sizeMb: number
  /** 距今多少分钟没更新（0 = 刚刚） */
  updatedMins: number
  /**
   * 这份格式里有没有级别字段。
   * 判据是"日志本身的格式"，不是我们的偏好：Nginx access / syslog / WAL 归档
   *    里就没有 INFO/WARN 这种字段，给它们加一个级别筛选器只会得到"点了永远 0 条"。
   */
  leveled: boolean
}

/**
 * 日志分类 —— 左栏分组的词表。这个数组的顺序就是分组的显示顺序。
 *
 * 分类与 `LogKind` 是两件事，不是一件事的两种写法：
 *    `kind` 决定"这份日志的行长什么样"（去 `LOG_LINES` 取行模板），
 *    `group` 决定"它在左栏归到哪一组"。两者目前多对一（access/error 同属"服务日志"），
 *    但将来完全可能拆开 —— 所以不合并成一个字段。
 */
export const LOG_GROUP_ORDER = ['service', 'app', 'database', 'backup', 'system', 'custom'] as const

export type LogGroupKey = (typeof LOG_GROUP_ORDER)[number]

export const LOG_GROUP_LABEL: Record<LogGroupKey, string> = {
  service: '服务日志',
  app: '应用',
  database: '数据库',
  backup: '备份',
  system: '系统',
  custom: '自定义',
}

/**
 * `kind` → 分类。
 *
 * 类型写成 `Record<LogKind, …>`（而不是 `Partial<…>`）是有意的：新增一种日志格式
 *    却忘了给它归类，是编译错误。写成可选的话，漏掉的那条日志会从左栏静默消失
 *    —— 没有报错、没有空态，只是少了一条，而且只有"知道本该有几条"的人才看得出来。
 */
export const LOG_GROUP_OF_KIND: Record<LogKind, LogGroupKey> = {
  access: 'service',
  error: 'service',
  app: 'app',
  postgres: 'database',
  wal: 'database',
  backup: 'backup',
  syslog: 'system',
}

/**
 * 日志源清单。只有 `web` / `db` 两个角色有 —— 停机的 `cache`（测试机）没有日志可看，
 * 于是它连服务器分段都不会出现（判据在页面侧：`LOG_SOURCES[role]` 为空就不列）。
 *
 * `name` 用组内不重复的短名（"访问日志""主日志"），与原型左栏一致，不是"全名"：
 *    加了分组之后每一条都已经在组内，再写"PostgreSQL 主日志"就是同一件事说两遍
 *    （组头已经写着"数据库"）。`kind` 仍是完整的种类，取行模板不看 `name`。
 */
export const LOG_SOURCES: Record<string, LogSourceSeed[]> = {
  web: [
    { kind: 'access', name: '访问日志', path: '/var/log/nginx/access.log', sizeMb: 186, updatedMins: 2, leveled: false },
    { kind: 'error', name: '错误日志', path: '/var/log/nginx/error.log', sizeMb: 4.2, updatedMins: 34, leveled: true },
    { kind: 'app', name: '运行日志', path: '/opt/app/logs/app.log', sizeMb: 62, updatedMins: 2, leveled: true },
    { kind: 'syslog', name: '系统日志', path: '/var/log/syslog', sizeMb: 12, updatedMins: 1, leveled: false },
  ],
  db: [
    { kind: 'postgres', name: '主日志', path: '/var/log/postgresql/postgresql-15-main.log', sizeMb: 88, updatedMins: 1, leveled: true },
    { kind: 'wal', name: 'WAL 归档', path: '/var/lib/postgresql/15/main/log/wal-archive.log', sizeMb: 3.4, updatedMins: 20, leveled: false },
    { kind: 'backup', name: '备份', path: '/var/log/pgbackrest/backup.log', sizeMb: 1.6, updatedMins: 145, leveled: true },
    { kind: 'syslog', name: '系统日志', path: '/var/log/syslog', sizeMb: 12, updatedMins: 1, leveled: false },
  ],
}

/**
 * 日志行池。行文照抄原型 `design/work/工作-项目-项目详情-运维-日志-index.html`
 *    里那 8 个 `.log-pane`（顺序＝原型顺序，即"新的在上"）。因此它带项目业务词
 *    （"支付回调""对账批次"）—— 与"通用运维口径"相反，这是照抄的结果，不是漏改。
 *    要区分的是机器：同一个 kind 的行由 web / db 两组池子共用，同一台机器上的
 *    所有项目读同一份行，不按项目换词。
 * `level` 只表达"这行值不值得看一眼"：`access` / `syslog` / `wal` 这类日志本身没有
 *    级别字段，它们的 `level` 是从原型行类名（`is-warn` / `is-error`）推的，靠左侧色条
 *    表达（页面按 `leveled` 决定渲染不渲染级别徽标），但行本身仍然要带颜色。
 * 行数＝这个数组的长度（`buildLogLines` 不另读"条数"）。`wal` / `backup` 在原型里
 *    没有 ERROR 档，这里就照实没有 —— 不为了凑齐三档编一条出来。
 */
export const LOG_LINES: Record<LogKind, LogLineSeed[]> = {
  access: [
    { level: 'info', text: '10.20.3.41 - - "POST /api/pay/callback HTTP/1.1" ⟦200⟧ 512 "-" "PaymentGateway/2.4"' },
    { level: 'info', text: '10.20.3.41 - - "POST /api/order/create HTTP/1.1" ⟦200⟧ 1843 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"' },
    { level: 'info', text: '10.20.7.8 - - "GET /api/order/list?page=2&size=20 HTTP/1.1" ⟦200⟧ 9021 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"' },
    { level: 'info', text: '10.20.7.8 - - "GET /login HTTP/1.1" ⟦302⟧ 0 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"' },
    { level: 'info', text: '10.20.11.6 - - "GET /static/js/app.4f2a1c.js HTTP/1.1" ⟦200⟧ 486213 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"' },
    { level: 'warn', text: '10.20.3.41 - - "POST /api/pay/notify HTTP/1.1" ⟦499⟧ 0 "-" "PaymentGateway/2.4"' },
    { level: 'error', text: '10.20.3.41 - - "POST /api/pay/notify HTTP/1.1" ⟦502⟧ 150 "-" "PaymentGateway/2.4"' },
    { level: 'error', text: '10.20.3.41 - - "POST /api/pay/notify HTTP/1.1" ⟦502⟧ 150 "-" "PaymentGateway/2.4"' },
    { level: 'info', text: '10.20.5.19 - - "GET /api/product/detail?id=88231 HTTP/1.1" ⟦200⟧ 3218 "-" "Mozilla/5.0 (Linux; Android 14)"' },
    { level: 'info', text: '10.20.9.2 - - "GET /healthz HTTP/1.1" ⟦200⟧ 2 "-" "kube-probe/1.29"' },
    { level: 'info', text: '10.20.3.41 - - "GET /api/user/profile HTTP/1.1" ⟦200⟧ 764 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"' },
    { level: 'info', text: '10.20.7.8 - - "POST /api/cart/add HTTP/1.1" ⟦200⟧ 128 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"' },
    { level: 'warn', text: '203.0.113.77 - - "GET /admin HTTP/1.1" ⟦404⟧ 153 "-" "curl/8.5.0"' },
    { level: 'info', text: '10.20.9.2 - - "GET /healthz HTTP/1.1" ⟦200⟧ 2 "-" "kube-probe/1.29"' },
    { level: 'info', text: '10.20.3.41 - - "POST /api/pay/callback HTTP/1.1" ⟦200⟧ 498 "-" "PaymentGateway/2.4"' },
    { level: 'info', text: '10.20.11.6 - - "GET /api/order/detail/2026092588213 HTTP/1.1" ⟦200⟧ 2156 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"' },
    { level: 'info', text: '10.20.5.19 - - "PUT /api/user/settings HTTP/1.1" ⟦200⟧ 96 "-" "Mozilla/5.0 (Linux; Android 14)"' },
    { level: 'error', text: '10.20.3.41 - - "POST /api/order/pay HTTP/1.1" ⟦500⟧ 87 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"' },
    { level: 'info', text: '10.20.9.2 - - "GET /healthz HTTP/1.1" ⟦200⟧ 2 "-" "kube-probe/1.29"' },
    { level: 'info', text: '10.20.7.8 - - "GET /favicon.ico HTTP/1.1" ⟦200⟧ 15406 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"' },
    { level: 'info', text: '10.20.7.8 - - "GET /api/product/list?page=1&size=20 HTTP/1.1" ⟦200⟧ 4213 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"' },
    { level: 'info', text: '10.20.3.41 - - "POST /api/cart/add HTTP/1.1" ⟦200⟧ 318 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"' },
    { level: 'info', text: '10.20.4.19 - - "GET /static/js/app.4f2c1a.js HTTP/1.1" ⟦200⟧ 486213 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"' },
    { level: 'info', text: '10.20.4.19 - - "GET /api/user/profile HTTP/1.1" ⟦401⟧ 58 "-" "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"' },
    { level: 'info', text: '10.20.3.41 - - "POST /api/order/create HTTP/1.1" ⟦200⟧ 1902 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"' },
    { level: 'info', text: '10.20.7.8 - - "GET /api/order/list?page=1&size=20 HTTP/1.1" ⟦200⟧ 7745 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"' },
    { level: 'info', text: '10.20.9.2 - - "GET /health HTTP/1.1" ⟦200⟧ 15 "-" "kube-probe/1.29"' },
    { level: 'info', text: '10.20.5.77 - - "POST /api/pay/callback HTTP/1.1" ⟦499⟧ 0 "-" "PaymentGateway/2.4"' },
    { level: 'info', text: '10.20.3.41 - - "GET /api/product/detail?id=8821 HTTP/1.1" ⟦200⟧ 3341 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"' },
    { level: 'info', text: '10.20.6.30 - - "GET /login HTTP/1.1" ⟦302⟧ 0 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"' },
    { level: 'info', text: '10.20.6.30 - - "POST /api/user/login HTTP/1.1" ⟦200⟧ 246 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"' },
    { level: 'info', text: '10.20.3.41 - - "GET /api/cart/list HTTP/1.1" ⟦200⟧ 512 "-" "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)"' },
    { level: 'info', text: '10.20.8.14 - - "GET /favicon.ico HTTP/1.1" ⟦404⟧ 153 "-" "Mozilla/5.0 (X11; Linux x86_64)"' },
    { level: 'info', text: '10.20.7.8 - - "GET /api/product/list?page=2&size=20 HTTP/1.1" ⟦200⟧ 3998 "-" "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"' },
  ],
  error: [
    { level: 'error', text: 'upstream payment-gateway: ⟦connect() failed (111: Connection refused)⟧ while connecting to upstream' },
    { level: 'error', text: 'upstream payment-gateway: ⟦connect() failed (111: Connection refused)⟧ while connecting to upstream' },
    { level: 'warn', text: 'upstream timed out (110: Connection timed out) while reading response header, client: 10.20.5.19' },
    { level: 'info', text: 'worker process 21488 exited with code 0（部署 v2.3.1 后的平滑重载）' },
    { level: 'warn', text: 'client 203.0.113.77 intended to send too large body: 8.4M' },
    { level: 'warn', text: 'upstream timed out (110: Connection timed out) while reading response header, client: 10.20.3.41' },
    { level: 'info', text: 'signal process started' },
    { level: 'warn', text: 'SSL_do_handshake() failed (SSL: error:0A000126:unexpected eof) while SSL handshaking' },
    { level: 'error', text: 'upstream payment-gateway: ⟦no live upstreams⟧ while connecting to upstream' },
    { level: 'info', text: 'signal process started（部署 v2.3.1 后平滑重载）' },
    { level: 'warn', text: 'open() "/var/www/static/vendor.js" failed (2: No such file or directory)' },
    { level: 'info', text: 'worker process 20114 exited with code 0' },
  ],
  app: [
    { level: 'info', text: '健康检查通过 ⟦GET /healthz⟧ 返回 200，耗时 12ms' },
    { level: 'error', text: '支付回调上游不可达，重试 1/3：⟦ConnectException: Connection refused⟧' },
    { level: 'error', text: '支付回调上游不可达，重试 2/3' },
    { level: 'error', text: '支付回调重试 3 次后仍失败，已转入死信队列 ⟦dlq.pay.notify⟧' },
    { level: 'info', text: '对账批次 ⟦#20260925-03⟧ 处理完成，1,301 笔匹配' },
    { level: 'warn', text: '数据库连接池使用率 82%，接近 85% 预警线' },
    { level: 'warn', text: '慢事务告警：order-service#payOrder 耗时 3.4s' },
    { level: 'info', text: '定时任务：对账批次 ⟦#20260925-01⟧ 处理完成，1,284 笔匹配' },
    { level: 'info', text: '定时任务：日志清理完成，释放 240 MB' },
    { level: 'info', text: '缓存预热完成：1,204 个热点商品已加载' },
    { level: 'info', text: '应用启动完成，耗时 6.2s（profile: prod）' },
    { level: 'info', text: '部署 v2.3.1 完成，服务已平滑重载' },
    { level: 'info', text: '收到 SIGTERM，开始优雅停机（等待 32 个在途请求）' },
    { level: 'info', text: '数据库连接池重建完成（max=32, min=8）' },
  ],
  syslog: [
    { level: 'info', text: 'CRON[31284]: (root) CMD (/usr/local/bin/log-rotate.sh)' },
    { level: 'warn', text: 'kernel: [ 9412.882041] nf_conntrack: table full, dropping packet' },
    { level: 'info', text: 'logrotate[31302]: rotating pattern: /var/log/nginx/*.log  after 1 days (14 rotations)' },
    { level: 'info', text: 'systemd[1]: Reloading nginx.service...' },
    { level: 'info', text: 'systemd[1]: Reloaded nginx.service.' },
    { level: 'warn', text: 'kernel: [ 8821.403112] Possible SYN flooding on port 8080. Sending cookies.' },
    { level: 'info', text: 'sshd[29811]: Accepted publickey for deploy from 10.0.3.24 port 51422 ssh2' },
    { level: 'info', text: 'systemd[1]: Starting Daily apt upgrade and clean activities...' },
    { level: 'info', text: 'systemd[1]: Finished Daily apt upgrade and clean activities.' },
    { level: 'info', text: 'CRON[29011]: (root) CMD (certbot renew --quiet)' },
    { level: 'info', text: 'systemd[1]: Started Session 4821 of user deploy.' },
    { level: 'info', text: 'kernel: [ 2104.117233] EXT4-fs (vda1): mounted filesystem with ordered data mode' },
    { level: 'warn', text: 'kernel: [41092.771004] EXT4-fs warning (device vda1): ext4_dx_add_entry: Directory index full!' },
    { level: 'error', text: 'systemd[1]: postgresql@15-main.service: Main process exited, code=exited, status=1/FAILURE' },
    { level: 'info', text: 'systemd[1]: postgresql@15-main.service: Succeeded.' },
    { level: 'info', text: 'sshd[30112]: Accepted publickey for deploy from 10.0.3.24 port 51230 ssh2' },
    { level: 'info', text: 'CRON[8821]: (postgres) CMD (/usr/local/bin/db-vacuum.sh)' },
    { level: 'info', text: 'systemd[1]: Starting Daily man-db regeneration...' },
    { level: 'warn', text: 'kernel: [22118.009112] vda1: WRITE SAME failed. Manually zeroing.' },
    { level: 'info', text: 'CRON[8710]: (root) CMD (/usr/local/bin/wal-archive-check.sh)' },
    { level: 'info', text: 'systemd[1]: Starting pgbackrest backup...' },
    { level: 'info', text: 'systemd[1]: Started Session 1204 of user postgres.' },
  ],
  postgres: [
    { level: 'error', text: '磁盘写入失败 ⟦disk_usage 95%⟧，已触发只读保护' },
    { level: 'error', text: 'could not write to file ⟦pg_wal/xlogtemp.8821⟧: No space left on device' },
    { level: 'info', text: 'checkpoint complete: wrote 1,240 buffers (7.6%)' },
    { level: 'info', text: 'connection received: host=10.20.3.41 port=51880' },
    { level: 'error', text: 'could not write to file ⟦pg_wal/xlogtemp.8821⟧: No space left on device' },
    { level: 'warn', text: '慢查询 3.4s：⟦SELECT ... FROM orders WHERE status=\'paid\'⟧' },
    { level: 'warn', text: 'autovacuum 已跳过 ⟦orders⟧ 表：磁盘空间不足' },
    { level: 'info', text: 'connection received: host=10.20.7.8 port=49213' },
    { level: 'info', text: '每日全量备份完成（03:00 启动，耗时 42m，大小 41 GB）' },
    { level: 'info', text: 'checkpoint starting: time' },
    { level: 'info', text: 'autovacuum 已完成 ⟦orders⟧ 表分析' },
    { level: 'warn', text: 'temporary file: path "base/pgsql_tmp/pgsql_tmp8821.1", size 268435456' },
    { level: 'info', text: 'database system was interrupted; last known up at 2026-09-25 06:28:00' },
    { level: 'info', text: 'checkpoint complete: wrote 2,001 buffers (12.2%)' },
  ],
  wal: [
    { level: 'warn', text: '000000010000000000000091 archived (16 MB, 14.2 s) — archive_command 耗时超 10 s' },
    { level: 'info', text: '000000010000000000000090 archived (16 MB, 8.4 s)' },
    { level: 'info', text: '00000001000000000000008F archived (16 MB, 1.9 s)' },
    { level: 'info', text: '00000001000000000000008E archived (16 MB, 1.8 s)' },
    { level: 'info', text: '00000001000000000000008D archived (16 MB, 1.7 s)' },
    { level: 'info', text: '00000001000000000000008C archived (16 MB, 1.6 s)' },
    { level: 'info', text: '00000001000000000000008B archived (16 MB, 2.1 s)' },
    { level: 'info', text: '00000001000000000000008A archived (16 MB, 1.5 s)' },
    { level: 'info', text: '000000010000000000000089 archived (16 MB, 1.6 s)' },
    { level: 'info', text: '000000010000000000000088 archived (16 MB, 1.4 s)' },
  ],
  backup: [
    { level: 'info', text: '全量备份完成 · 41 GB · 耗时 42m 07s' },
    { level: 'info', text: '校验通过：⟦pgbackrest verify ok⟧' },
    { level: 'warn', text: 'repo1 归档存储已用 82%，接近 85% 预警线' },
    { level: 'info', text: '备份进度 80%（32.8 GB / 41 GB）' },
    { level: 'info', text: '备份进度 40%（16.4 GB / 41 GB）' },
    { level: 'info', text: '备份开始（full，repo1）' },
    { level: 'info', text: '增量备份完成 · 2.1 GB' },
    { level: 'info', text: '备份开始（incr，repo1）' },
    { level: 'info', text: '保留策略：清理 2 个过期全量备份，释放 78 GB' },
    { level: 'info', text: '增量备份完成 · 1.8 GB' },
  ],
}

/**
 * 关联的声明（种子）。与 `DocumentItem.links` 的差别只有"目标怎么指"：
 *
 * · 种子里写名字，不写下标 —— 下标会随池子增删漂移（加一篇文档，后面所有 `doc: n`
 *   全指错），而名字在池子里唯一、也不怕重排。
 * · 派生时按名字在那一族里找（`derive.ts` 的 `resolveDocLink`），找不到就丢掉该条边：
 *   会议只取 2 场、问题只取 2~3 条（`pick()` 出来的子集）⇒ 池子里有些名字本来就不会出现。
 *   这是示例数据的性质，不是关系本身的语义 —— `risk` / `meet` 说的是"这篇要处理的
 *   风险 / 是哪场会的产物"，这两个读法在任何项目下都成立。
 */
export interface DocLinkSeed {
  kind: DocLinkKind
  family: DocLinkFamily
  name: string
}

export interface DocSeed {
  name: string
  kind: DocKind
  /** 模块（粗的那一层）与功能点（细的那一层）—— 筛选栏的两级目录按它建立 */
  module: string
  func: string
  /** 距上次更新多少小时；< 24 的算「新」（书墙上的黄点、列表里的 NEW） */
  updatedHours: number
  /** 手挂的关联（出边）。缺省 = 这篇不与任何东西关联 */
  links?: DocLinkSeed[]
}

/**
 * 内容池 —— 详情页的任务 / 里程碑 / 文档 / 动态 / 问题 / 服务器 / 会议 / 账户
 * 按 scope 从这里确定性取值，不硬编码 8 份数据（与原型 POOL 一致）。
 *
 * 2026-09-25 新增的后四组，对应 `work_product-detail.html` 里那四个新区
 *    （Bug / 运维 / 会议 / 账户）。口径与前四组同一条：应用没有这四张表
 *    （`Project` 上没有对应字段），所以内容是池子 + 确定性派生，
 *    不是给每个项目手写一份。取舍与 `data/workspace/project.ts` 的 notes/review 一致。
 *
 * `servers` 与 `accounts` 只有 work 域有内容，另外两域是空数组 —— 这不是偷懒：
 *    「生产服务器」与「平台账号」是软件项目才有的东西，给一趟家庭旅行编两台 prod-web-01
 *    才是真的编数据。空数组的后果由页面承担：派生出 0 条就隐藏那个分区
 *    （判据在 `components/workspace/project-detail/ProjectDetail.tsx` 的 `useProjectDetailView`
 *    —— 那里算出来的 `sections`，不在这里写一张 scope 白名单）。
 */
export const POOL: Record<
  Scope,
  {
    tasks: string[]
    milestones: string[]
    /** 文档索引条目（条数 = 池子长度，不再固定 4 份） */
    documents: DocSeed[]
    activity: string[]
    /** 问题清单的标题（work 域读作 Bug） */
    bugs: string[]
    /** 服务器档；空数组 = 这个域没有服务器（运维整块的判据就是它） */
    servers: ServerSeed[]
    /** 会议名 */
    meetings: string[]
    /** 账户凭据档；空数组 = 这个域没有账户表（同 servers，只在 work 域有） */
    accounts: AccountSeed[]
    /** 部署文档；空数组 = 这个域没有部署手册（同 servers/accounts，只在 work 域有） */
    deployDocs: DeployDocSeed[]
    /**
     * 发布记录里每条"变更说明"（回滚那条读作"原因"）。
     * 与 `DEPLOY_TIMES` 一样按下标取，所以条数必须 ≥ 发布记录的条数（4 条）。
     */
    deployNotes: string[]
  }
> = {
  life: {
    tasks: [
      '确认出行日期与人数',
      '比价机票与住宿',
      '办理签证与保险材料',
      '行程逐日排期',
      '制定预算与分摊表',
      '预订接送机与当地向导',
      '整理行李清单',
      '打印证件与保险副本',
      '确认随行老人用药',
      '整理归档行程终版',
    ],
    milestones: ['需求确认', '方案定稿', '预订完成', '行前准备', '正式启动'],
    documents: [
      /* 第二篇是"新"的（updatedHours < 24）—— 与原型一样，最新的那篇不排在第一 */
      { name: '行程与预算表', kind: 'plan', module: '行程', func: '出行安排', updatedHours: 30,
        links: [
          { kind: 'out', family: 'task', name: '制定预算与分摊表' },
          { kind: 'bind', family: 'doc', name: '机票酒店确认单' },
        ] },
      { name: '机票酒店确认单', kind: 'ref', module: '行程', func: '出行安排', updatedHours: 6,
        links: [
          { kind: 'bind', family: 'doc', name: '行程与预算表' },
          { kind: 'out', family: 'task', name: '比价机票与住宿' },
          { kind: 'risk', family: 'bug', name: '酒店超订需要重新确认' },
        ] },
      { name: '签证材料清单', kind: 'spec', module: '手续', func: '签证与保险', updatedHours: 54,
        links: [
          { kind: 'out', family: 'task', name: '办理签证与保险材料' },
          { kind: 'meet', family: 'meeting', name: '行前家庭会议' },
        ] },
      { name: '保险保单索引', kind: 'ref', module: '手续', func: '签证与保险', updatedHours: 96,
        links: [
          { kind: 'ref', family: 'doc', name: '签证材料清单' },
          { kind: 'risk', family: 'bug', name: '转机时间只有 50 分钟' },
        ] },
    ],
    activity: ['更新了行程排期', '上传了酒店确认单', '调整了预算上限', '完成了「预订接送机」'],
    bugs: ['酒店超订需要重新确认', '转机时间只有 50 分钟', '保险覆盖范围与行程不符', '接送机时间与航班对不上'],
    servers: [],
    meetings: ['行前家庭会议', '与向导确认行程', '保险条款沟通'],
    accounts: [],
    deployDocs: [],
    deployNotes: [],
  },
  work: {
    tasks: [
      '梳理现有模块依赖',
      '拆分服务边界',
      '设计统一鉴权方案',
      '迁移用户中心',
      '补充集成测试',
      '编写灰度发布预案',
      '性能基线对比',
      '同步接口文档',
      '评审数据迁移方案',
      '准备上线演练',
    ],
    milestones: ['方案评审通过', '模块拆分完成', '鉴权灰度上线', '全量发布', '复盘归档'],
    /**
     * 2026-09-27：4 篇 → 11 篇（4 个模块 / 7 个功能）。
     *    这是跟着「模块 → 功能」两级目录一起改的：4 篇文档撑不出 6 个以上的功能点，
     *    那一层目录也就演示不出来（判据是"一维会长时，先给它上面加一层粗的"）。
     *    另两域仍是 4 篇 / 2 模块 / 2 功能 —— 真实场景本来就不一样，别照着工作域配平。
     *    关联（`links`）指向的是本域的另外三个池（任务 / 问题 / 会议）与本池，
     *       逐条照原型 `项目-文档主页-index.html` 的 `POOL.work.documents` 搬过来（原名逐字）。
     */
    documents: [
      { name: '技术方案 v3', kind: 'plan', module: '用户中心', func: '登录鉴权', updatedHours: 26,
        links: [
          { kind: 'out', family: 'task', name: '拆分服务边界' },
          { kind: 'out', family: 'task', name: '设计统一鉴权方案' },
          { kind: 'bind', family: 'doc', name: '接口契约说明' },
        ] },
      { name: '接口契约说明', kind: 'api', module: '用户中心', func: '登录鉴权', updatedHours: 3,
        links: [
          { kind: 'bind', family: 'doc', name: '技术方案 v3' },
          { kind: 'out', family: 'task', name: '同步接口文档' },
          { kind: 'risk', family: 'bug', name: '支付回调偶发超时' },
        ] },
      { name: '灰度发布预案', kind: 'plan', module: '发布流水线', func: '迁移与发布', updatedHours: 50,
        links: [
          { kind: 'ref', family: 'doc', name: '技术方案 v3' },
          { kind: 'risk', family: 'bug', name: '对账金额精度丢失' },
        ] },
      { name: '数据迁移评审记录', kind: 'spec', module: '发布流水线', func: '迁移与发布', updatedHours: 100,
        links: [
          { kind: 'out', family: 'task', name: '评审数据迁移方案' },
          { kind: 'ref', family: 'doc', name: '技术方案 v3' },
          { kind: 'meet', family: 'meeting', name: '技术方案评审' },
        ] },
      { name: '鉴权时序图', kind: 'design', module: '用户中心', func: '登录鉴权', updatedHours: 12,
        links: [
          { kind: 'ref', family: 'doc', name: '技术方案 v3' },
          { kind: 'out', family: 'task', name: '设计统一鉴权方案' },
          { kind: 'risk', family: 'bug', name: '鉴权 token 刷新竞态' },
        ] },
      { name: '回滚演练脚本', kind: 'test', module: '发布流水线', func: '迁移与发布', updatedHours: 64,
        links: [
          { kind: 'out', family: 'task', name: '准备上线演练' },
          { kind: 'meet', family: 'meeting', name: '上线演练' },
        ] },
      { name: '权限矩阵说明', kind: 'spec', module: '用户中心', func: '权限模型', updatedHours: 88,
        links: [
          { kind: 'ref', family: 'doc', name: '技术方案 v3' },
          { kind: 'out', family: 'task', name: '设计统一鉴权方案' },
          { kind: 'risk', family: 'bug', name: '鉴权 token 刷新竞态' },
        ] },
      { name: '性能基线对比', kind: 'ref', module: '稳定性与运维', func: '性能优化', updatedHours: 140,
        links: [
          { kind: 'out', family: 'task', name: '性能基线对比' },
          { kind: 'ref', family: 'doc', name: '技术方案 v3' },
        ] },
      { name: '告警规则说明', kind: 'spec', module: '稳定性与运维', func: '监控告警', updatedHours: 18,
        links: [
          { kind: 'risk', family: 'bug', name: '支付回调偶发超时' },
          { kind: 'out', family: 'task', name: '编写灰度发布预案' },
        ] },
      { name: '对接联调说明', kind: 'api', module: '对外对接', func: '第三方对接', updatedHours: 34,
        links: [
          { kind: 'out', family: 'task', name: '同步接口文档' },
          { kind: 'ref', family: 'doc', name: '接口契约说明' },
        ] },
      { name: '上线检查清单', kind: 'spec', module: '稳定性与运维', func: '上线运维', updatedHours: 8,
        links: [
          { kind: 'meet', family: 'meeting', name: '上线演练' },
          { kind: 'out', family: 'task', name: '准备上线演练' },
        ] },
    ],
    activity: ['提交了架构方案 v3', '完成了鉴权模块评审', '更新了里程碑时间', '关闭了 3 条 P1 缺陷'],
    bugs: ['支付回调偶发超时', '对账金额精度丢失', '灰度开关偶发不生效', '导出任务偶发卡死', '鉴权 token 刷新竞态'],
    /**
     * 2026-09-27：这一块从 3 台收敛成 2 台，与原型同构。
     *    原来第三台是 `test-cache-01`（停机的），它的存在意义只有一个：
     *    "停机的那台不显示负载"。而行内负载表整组撤掉之后，停机这件事在本页没有表达
     *    （服务器行只剩 名称 / 连接开关 / 地址那一行小字），留着一台"看不出停机的停机机器"
     *    是给页面添一个说不清楚的角落。它也不是被删掉的功能 —— 是随监控一起下线的那半块。
     *    另外两台各自带的 `paths` 就是原型 `PATHS` 那一份，逐条同值。
     */
    servers: [
      {
        role: 'web',
        env: 'prod',
        ip: '47.100.23.11',
        user: 'deploy',
        auth: 'key',
        esc: 'sudo',
        os: 'Ubuntu 22.04',
        /* 这一台"不用连也能知道"的是地址与系统 —— 数据库/备份策略是 db 那台的事。
           系统这一项写在 info 里（而不是由组件另拼一格）：db 那台的信息面板里
              没有"操作系统"这一格，两台的差别是内容的差别，不该在组件里判。 */
        info: [{ label: '操作系统', value: 'Ubuntu 22.04' }],
        cores: 4,
        memGb: 8,
        diskGb: 80,
        cpu: 11,
        mem: 40,
        disk: 40,
        pathGroups: ['应用与产物', '配置与日志'],
        fsHome: ['opt', 'app'],
        paths: [
          {
            group: '应用与产物',
            use: '前端静态文件',
            path: '/opt/app/web/dist',
            note: '{v}',
            preview: `total 1.1M
drwxr-xr-x  3 deploy deploy 4.0K 今天 14:30 assets/
-rw-r--r--  1 deploy deploy 2.1K 今天 14:30 index.html
-rw-r--r--  1 deploy deploy  15K 9月20日   favicon.ico

assets/
  app.9f2c1a.js    842K  今天 14:30
  app.4b7d0e.css    61K  今天 14:30`,
          },
          {
            group: '应用与产物',
            use: '后端 jar 包',
            path: '/opt/app/pay-api.jar',
            note: '{v} · 2.4 MB',
            preview: '二进制文件 · 2.4 MB · 无法在浏览器里预览\n\n要用它的话：在部署面板里上传替换，或先下载到本机再处理。',
          },
          {
            group: '应用与产物',
            use: '启动脚本',
            path: '/opt/app/release.sh',
            note: '9月20日',
            preview: `#!/usr/bin/env bash
set -euo pipefail

APP_HOME=/opt/app
TS=$(date +%Y%m%d-%H%M%S)

# 1) 先把当前版本留一份回滚点
mkdir -p "$APP_HOME/releases/$TS"
cp "$APP_HOME/pay-api.jar" "$APP_HOME/releases/$TS/"

# 2) 换包 + 重启（进程由 supervisor 托管，这里不用自己拉起）
install -m 644 /tmp/upload/pay-api.jar "$APP_HOME/pay-api.jar"
supervisorctl restart pay-api

# 3) 探活：20 秒内没起来就报错退出，交给人来判断
for i in $(seq 1 20); do
  curl -fs http://127.0.0.1:9000/health && exit 0
  sleep 1
done
echo "健康检查未通过，请人工确认" >&2
exit 1`,
          },
          {
            group: '配置与日志',
            use: 'Nginx 配置',
            path: '/etc/nginx/conf.d/pay.conf',
            note: '9月20日',
            preview: `server {
    listen       8080;
    server_name  pay.example.com;

    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_read_timeout 60s;
    }

    location /metrics {
        proxy_pass http://127.0.0.1:9100;
    }
}`,
          },
          {
            group: '配置与日志',
            use: 'Supervisor 配置',
            path: '/etc/supervisor/conf.d/pay-api.conf',
            note: '9月18日',
            preview: `[program:pay-api]
command=/usr/bin/java -jar /opt/app/pay-api.jar --spring.profiles.active=prod
directory=/opt/app
user=deploy
autostart=true
autorestart=true
startretries=3
stopwaitsecs=30
stdout_logfile=/var/log/pay-api/stdout.log
stderr_logfile=/var/log/pay-api/stderr.log
environment=JAVA_OPTS="-Xms1g -Xmx2g -XX:+UseG1GC"`,
          },
          {
            group: '配置与日志',
            use: '环境变量',
            path: '/opt/app/.env',
            note: '仅 root 可读',
            preview: `NODE_ENV=production
APP_PORT=8080
ADMIN_PORT=9000

DB_HOST=47.100.23.12
DB_PORT=5432
DB_NAME=pay
DB_USER=pay_app
DB_PASSWORD=******          # 由密钥管理注入，不写在这里

REDIS_URL=redis://127.0.0.1:6379/0
LOG_LEVEL=info`,
          },
          {
            group: '配置与日志',
            use: '日志目录',
            path: '/var/log/pay-api/',
            note: '7 天 · 2.1 G',
            preview: `total 2.7G
-rw-r--r-- 1 deploy deploy 412M 今天 14:32 stdout.log
-rw-r--r-- 1 deploy deploy 1.2M 今天 09:15 stderr.log
-rw-r--r-- 1 deploy deploy 1.9G 今天 14:32 access.log
-rw-r--r-- 1 deploy deploy 380M 9月25日   stdout.log.1
-rw-r--r-- 1 deploy deploy  42M 9月24日   stdout.log.2.gz`,
          },
        ],
        fsExtra: [
          { path: '/opt/app/releases/20260925-1812', dir: true },
          { path: '/opt/app/releases/20260924-0930', dir: true },
          { path: '/opt/app/releases/20260923-1714', dir: true },
          { path: '/opt/app/releases/20260922-1026', dir: true },
          { path: '/opt/app/releases/20260921-1902', dir: true },
          { path: '/opt/app/releases/20260920-1138', dir: true },
          { path: '/opt/app/releases/20260919-1645', dir: true },
          { path: '/opt/app/releases/20260918-0921', dir: true },
          { path: '/opt/app/logs', dir: true },
          { path: '/opt/app/backup/pre-20260925.dump', size: '420 MB', time: '今天 09:18' },
          { path: '/etc/nginx/nginx.conf', size: '2.4 KB', time: '9月10日' },
          { path: '/etc/nginx/conf.d/default.conf', size: '1.1 KB', time: '9月10日' },
          { path: '/etc/supervisor/supervisord.conf', size: '3.2 KB', time: '9月12日' },
          { path: '/etc/hosts', size: '220 B', time: '9月12日' },
          { path: '/home/deploy/.bashrc', size: '3.1 KB', time: '9月12日' },
          { path: '/usr/local/bin/healthcheck.sh', size: '1.4 KB', time: '9月20日' },
          { path: '/var/log/nginx/access.log', size: '186 MB', time: '2 分钟前' },
          { path: '/var/log/nginx/error.log', size: '4.2 MB', time: '今天 10:12' },
          { path: '/var/log/syslog', size: '12 MB', time: '今天 10:15' },
        ],
      },
      {
        role: 'db',
        env: 'prod',
        ip: '47.100.23.12',
        user: 'deploy',
        auth: 'key',
        esc: 'sudo',
        os: 'Ubuntu 22.04',
        info: [
          { label: '数据库', value: 'PostgreSQL 15', inMeta: true },
          { label: '备份策略', value: '每日 03:00 全量' },
        ],
        reclaim: {
          note: '可回收 **约 12 G**：WAL 归档 7.8 G + 历史日志 4.2 G。',
          desc: '将清理 WAL 归档（7.8 G）与 14 天前的历史日志（4.2 G），预计释放约 12 G。',
          warn: '清理后的 WAL 归档无法用于时间点恢复。若仍需要该时间区间的恢复能力，请先完成一次全量备份。',
        },
        cores: 8,
        memGb: 16,
        diskGb: 160,
        cpu: 23,
        mem: 43,
        disk: 95,
        pathGroups: ['数据', '配置与日志'],
        fsHome: ['etc', 'postgresql', '15', 'main'],
        paths: [
          {
            group: '数据',
            use: '数据目录',
            path: '/var/lib/postgresql/15/main',
            note: '128.4 G',
            preview: `drwx------ 19 postgres postgres 4.0K 今天 14:31 base/
drwx------  3 postgres postgres 4.0K 今天 14:31 pg_wal/
-rw-------  1 postgres postgres   78 9月12日   postgresql.auto.conf
-rw-------  1 postgres postgres    3 2026-05-12 PG_VERSION

base/ 下是本项目的库：pay（86 GB）、pay_replica（42 GB）`,
          },
          {
            group: '数据',
            use: 'WAL 归档',
            path: '/var/lib/postgresql/wal',
            note: '7.8 G',
            preview: `total 7.8G
-rw------- 1 postgres postgres 16M 今天 14:20 0000000100000000000000A1
-rw------- 1 postgres postgres 16M 今天 14:30 0000000100000000000000A2
-rw------- 1 postgres postgres 16M 今天 14:31 0000000100000000000000A3
drwx------ 2 postgres postgres 4.0K 今天 14:31 archive_status/`,
          },
          {
            group: '数据',
            use: '备份目录',
            path: '/var/backups/pg/',
            note: '每日 03:00',
            preview: `total 54G
-rw-r--r-- 1 postgres postgres 18.4G 今天 03:12 pay-20260926-0300.dump
-rw-r--r-- 1 postgres postgres 18.1G 9月25日   pay-20260925-0300.dump
-rw-r--r-- 1 postgres postgres 17.9G 9月24日   pay-20260924-0300.dump`,
          },
          {
            group: '配置与日志',
            use: '主配置',
            path: '/etc/postgresql/15/main/postgresql.conf',
            note: '9月12日',
            preview: `# —— 与本项目相关的几项，其余保持默认 ——
listen_addresses = 'localhost'
port = 5432
max_connections = 200
shared_buffers = 4GB
effective_cache_size = 12GB
wal_level = replica
archive_mode = on
archive_command = 'cp %p /var/lib/postgresql/wal/%f'
log_directory = '/var/log/postgresql'`,
          },
          {
            group: '配置与日志',
            use: '访问控制',
            path: '/etc/postgresql/15/main/pg_hba.conf',
            note: '9月12日',
            preview: `# —— 本项目新增的两条 ——
host    pay    pay_app       47.100.23.11/32    scram-sha-256
host    pay    pay_replica   47.100.23.0/24     scram-sha-256

# 其余保持默认：
local   all    postgres                      peer
host    all    all         127.0.0.1/32      scram-sha-256`,
          },
          {
            group: '配置与日志',
            use: '日志目录',
            path: '/var/log/postgresql/',
            note: '7 天 · 9.2 G',
            preview: `total 512M
-rw-r----- 1 postgres postgres 128M 今天 14:32 postgresql-2026-09-26.log
-rw-r----- 1 postgres postgres 342M 9月25日   postgresql-2026-09-25.log
-rw-r----- 1 postgres postgres  42M 9月24日   postgresql-2026-09-24.log.gz`,
          },
        ],
        fsExtra: [
          { path: '/var/lib/postgresql/15/main/base', dir: true },
          { path: '/var/lib/postgresql/15/main/pg_wal', dir: true },
          { path: '/var/lib/postgresql/15/main/PG_VERSION', size: '3 B', time: '5月12日' },
          { path: '/var/lib/postgresql/wal/archive_status', dir: true },
          { path: '/var/backups/pg/pay-20260926-0300.dump', size: '18.4 G', time: '今天 03:12' },
          { path: '/var/backups/pg/pay-20260925-0300.dump', size: '18.1 G', time: '9月25日' },
          { path: '/var/backups/pg/pay-20260924-0300.dump', size: '17.9 G', time: '9月24日' },
          { path: '/etc/postgresql/15/main/pg_ident.conf', size: '2.1 KB', time: '9月12日' },
          { path: '/etc/postgresql/15/main/start.conf', size: '480 B', time: '9月12日' },
          { path: '/etc/postgresql/15/main/conf.d', dir: true },
          { path: '/opt/pgbackrest/pgbackrest.conf', size: '2.8 KB', time: '9月12日' },
          { path: '/usr/lib/postgresql/15/bin/pg_dump', size: '1.2 MB', time: '8月02日' },
          { path: '/var/log/postgresql/postgresql-2026-09-26.log', size: '128 MB', time: '今天 14:32' },
          { path: '/var/log/postgresql/postgresql-2026-09-25.log', size: '342 MB', time: '9月25日' },
        ],
      },
    ],
    meetings: ['项目评审', '技术方案评审', '周会', '上线演练'],
    /* 8 条，与原型 `CREDS` 逐字一致（3 个平台：阿里云 3 / GitLab 2 / 星辰后台 3）。
       `dueDays` = `cycle - rotatedDays`，三条要一起自洽（见 `AccountSeed` 的注释）。
          唯一的例外是 `gl-release`：原型给的 rotatedDays 是 90（90 天周期 ⇒ 今天到期），
          而 dueDays 写的是 -3（要用它演"已逾期"）—— 两者差 3 天。这里把 rotatedDays
          改成 93 让它们自洽：到期日是主角（整张清单的颜色语义挂在它上面），
          上次轮换只是面板里的一个日期，按 93 天推出来的值才是与"已逾期 3 天"一致的那个。 */
    accounts: [
      { id: 'ali-ops', platform: '阿里云', user: 'ops@lucky.com', type: 'password', env: 'prod',
        note: '换绑手机 138****2210', cycle: 90, rotatedDays: 29, rotatedBy: '张琪', dueDays: 61,
        secret: 'Lk9#pQ2vR7tW' },
      { id: 'ali-deploy', platform: '阿里云', user: 'deploy-bot', type: 'key', env: 'prod',
        cycle: 90, rotatedDays: 87, rotatedBy: '张琪', dueDays: 3, secret: 'LTAI5tQvR7tWk2mN' },
      { id: 'ali-test', platform: '阿里云', user: 'test@lucky.com', type: 'key', env: 'test',
        cycle: 180, rotatedDays: 102, rotatedBy: '何敏', dueDays: 78, secret: 'LTAI5tB9mK4pQ7xZ' },
      { id: 'gl-dev', platform: 'GitLab', user: 'dev@lucky.com', type: 'password', env: 'dev',
        cycle: 180, rotatedDays: 60, rotatedBy: '刘阳', dueDays: 120, secret: 'Gy7!mQ4zTn' },
      { id: 'gl-release', platform: 'GitLab', user: 'release-bot', type: 'key', env: 'prod',
        note: '只在发版流水线里用，改完记得同步 CI 变量', cycle: 90, rotatedDays: 93, rotatedBy: '张琪',
        dueDays: -3, secret: 'glpat-9Kd2Xr7pLm4Q' },
      { id: 'xc-admin', platform: '星辰后台', user: 'xingchen_admin', type: 'password', env: 'prod',
        note: '对账出问题时才登', cycle: 90, rotatedDays: 49, rotatedBy: '刘阳', dueDays: 41,
        secret: 'Xc8@hR5tVb' },
      { id: 'xc-qa', platform: '星辰后台', user: 'xingchen_qa', type: 'password', env: 'test',
        cycle: 180, rotatedDays: 128, rotatedBy: '何敏', dueDays: 52, secret: 'Qa3$kN7wZp' },
      { id: 'xc-ops', platform: '星辰后台', user: 'xingchen_ops', type: 'password', env: 'prod',
        cycle: 90, rotatedDays: 57, rotatedBy: '张琪', dueDays: 33, secret: 'Op5%vB2mHs' },
    ],
    deployDocs: [
      { name: '生产环境部署手册', kind: '手册', version: 'v2.3', updatedHours: 26 },
      { name: '回滚流程', kind: '流程', version: 'v1.2', updatedHours: 72 },
      { name: 'deploy.sh', kind: '脚本', version: 'v1.4', updatedHours: 120 },
    ],
    deployNotes: [
      '修复支付回调超时，优化对账精度',
      '新增对账模块，重构支付核心链路',
      '对账精度问题，回滚至上一版',
      '支付网关超时配置调整',
    ],
  },
  learn: {
    tasks: [
      '读完第 1-3 章并写笔记',
      '实现 mini-runtime 骨架',
      '跑通第一个 async 示例',
      '整理 Executor 源码笔记',
      '完成课后练习',
      '复习闪卡 30 张',
      '输出实践总结文章',
      '对照源码验证结论',
      '整理常见坑位清单',
      '归档笔记到知识库',
    ],
    milestones: ['制定阅读计划', '基础概念打通', '实现可运行示例', '输出总结文章', '归档知识库'],
    documents: [
      { name: '读书笔记合集', kind: 'research', module: '读书', func: '读书与复习', updatedHours: 72,
        links: [
          { kind: 'bind', family: 'doc', name: 'mini-runtime 源码' },
          { kind: 'meet', family: 'meeting', name: '读书会' },
        ] },
      { name: 'mini-runtime 源码', kind: 'ref', module: '实战', func: '源码实践', updatedHours: 20,
        links: [
          { kind: 'out', family: 'task', name: '实现 mini-runtime 骨架' },
          { kind: 'ref', family: 'doc', name: '读书笔记合集' },
        ] },
      { name: '实践总结草稿', kind: 'plan', module: '实战', func: '源码实践', updatedHours: 120,
        links: [
          { kind: 'ref', family: 'doc', name: '读书笔记合集' },
          { kind: 'ref', family: 'doc', name: 'mini-runtime 源码' },
        ] },
      { name: '闪卡导出', kind: 'ref', module: '读书', func: '读书与复习', updatedHours: 200,
        links: [
          { kind: 'out', family: 'task', name: '复习闪卡 30 张' },
          { kind: 'risk', family: 'bug', name: '示例在 nightly 上编译不过' },
        ] },
    ],
    activity: ['写完了第 6 篇笔记', '跑通了 mini-runtime 示例', '更新了复习计划', '把 3 条笔记升级为永久笔记'],
    bugs: ['示例在 nightly 上编译不过', '第 4 章结论与源码不一致', '闪卡导出缺了 6 张'],
    servers: [],
    meetings: ['读书会', '结对复盘'],
    accounts: [],
    deployDocs: [],
    deployNotes: [],
  },
}

/** 文档索引的来源标签（存在哪儿，与下面的"种类"是两件事） */
export const DOC_SOURCES = ['腾讯文档', '语雀', 'Git 仓库', '本地 Markdown']

/**
 * 文档种类 —— 子类栏里的 7 项，顺序照原型 `work_project_detail_document.html` 的 `TYPE_MAP`。
 *
 * 颜色不在这里：原型把 7 支颜色写成 `--d-plan` 之类的 CSS 变量，
 *    这里保持同一条边界 —— JS 只给"哪一类"，长什么样归 `styles/module-workspace.css`
 *    的 `.d-*`（作用域在项目详情页面根下）。
 * 7 项的计数由文档派生（见 `DocLibrary`），所以某一类为 0 是正常的，
 *    不隐藏 —— 它是一份封闭的词表，不是"这个项目恰好有的那几个"。
 */
export const DOC_KIND_LABEL: Record<DocKind, string> = {
  plan: '方案',
  design: '设计',
  api: '接口',
  test: '测试',
  spec: '规范',
  research: '调研',
  ref: '参考',
}

/** 子类栏里的次序（原型：方案 / 设计 / 接口 / 测试 / 规范 / 调研 / 参考） */
export const DOC_KINDS: DocKind[] = ['plan', 'design', 'api', 'test', 'spec', 'research', 'ref']

/** 动态时间刻度 */
export const ACTIVITY_TIMES = ['12 分钟前', '2 小时前', '昨天 18:40', '3 天前']

/** 问题清单的版本标签（就近取，与「发布记录」的版本号同一个形状） */
export const BUG_VERSIONS = ['v2.3.1', 'v2.3.0', 'v2.2.9', 'v2.2.8', 'v2.2.7']

/** 发布记录的版本号尾数 —— 由索引倒着数，不编一个会撞车的流水号 */
export const DEPLOY_TIMES = ['昨天', '5 天前', '10 天前', '2 周前']
