import type { DocKind, Scope } from '../types'

/**
 * 文档池的一条 —— 名字 + **种类** + 距上次更新多少小时。
 *
 * ⚠️ 2026-09-25 从「字符串数组」改成对象数组，是为了文档列表页
 *    （`design/work/work_project_detail_document.html`，已落地）：
 *    那一页的**子类栏**是这个页面的主轴（方案/设计/接口/…），而种类在应用里
 *    没有别的来源。两种做法里选的是**声明在池子里**：
 *      · 声明式（现在这样）：分类是这条内容自己的属性，「技术方案」判成"方案"是读得出来的；
 *      · 按哈希轮转（`DOC_SOURCES` 那种）：同一篇文档换个项目就换个分类，名字与分类会互相打架。
 *    `updatedHours` 同理：它派生「3 小时前 / 昨天 / N 天前」与「是不是新文档」两件事，
 *    写成数字之后，文案由 `docUpdatedText()` 算，不散在各处硬编。
 *
 *    ⚠️ 这两样**是新加的字段**（应用原本只有 name/source/summary/updatedAt）：
 *       分类与时间刻度都是"这一页要用的最小信息"，不是给每个项目手写一份内容。
 */
/**
 * 服务器档 —— 运维分区要每台机器的规格与负载，而 `Project` 上只有"这是个什么项目"。
 *
 * ⚠️ 9 个字段里有 6 个是**这台机器自己的事实**（角色/环境/系统/核数/内存/磁盘），
 *    3 个是**负载读数**。两者分开写在这里，因为它们是同一件事的两面：
 *    规格决定"这台机器能装多少"（`spec`、目录占用都从 `cores/memGb/diskGb` 算），
 *    负载决定"现在用了多少"（KPI 条的"环境健康"直接数 ≥90 的那几项）。
 *    写死在派生器里更糟 —— 那会把"db 一定 95%"变成藏在 if 里的业务规则。
 */
export interface ServerSeed {
  /** 角色后缀：web / db / cache */
  role: string
  env: 'prod' | 'test'
  os: string
  /** 核数 —— 平均负载 = `cpu%` × 核数，内存/磁盘的"用了多少 G"也从这三个数算 */
  cores: number
  memGb: number
  diskGb: number
  /** 负载百分比。任意一项 ≥ 90 即算告警 */
  cpu: number
  mem: number
  disk: number
}

/** 部署文档档。原来是纯字符串数组，`kind`/`version` 由下标硬编 —— 三样都改成声明 */
export interface DeployDocSeed {
  name: string
  /** 手册 / 流程 / 脚本 */
  kind: string
  version: string
  updatedHours: number
}

/* ------------------------------------------------------------------ *
 * 日志（项目详情「运维 · 日志」页，2026-09-25）
 * ------------------------------------------------------------------ */

/**
 * 日志**种类** —— 它决定"这份日志的行长什么样"（下面 `LOG_LINES` 的 key）。
 * 与"这份日志叫什么名"无关：`web` 机器上的 `Nginx 访问日志` 与任何机器上的访问日志
 * 用的是同一套行模板。
 */
export type LogKind = 'access' | 'error' | 'app' | 'syslog' | 'postgres' | 'wal' | 'backup'

/** 日志行模板。`level` 决定这行的颜色（左侧色条），**不决定要不要渲染级别徽标** */
export interface LogLineSeed {
  level: 'info' | 'warn' | 'error'
  /** 行正文。`⟦…⟧` 圈起来的那段会被渲染成 `<code>`（原型里的等宽片段） */
  text: string
}

/** 日志源档（按服务器**角色**分）。空数组 = 这台机器没有配日志路径 */
export interface LogSourceSeed {
  kind: LogKind
  name: string
  path: string
  sizeMb: number
  /** 距今多少分钟没更新（0 = 刚刚） */
  updatedMins: number
  /**
   * 这份格式里**有没有级别字段**。
   * ⚠️ 判据是"日志本身的格式"，不是我们的偏好：Nginx access / syslog / WAL 归档
   *    里就没有 INFO/WARN 这种字段，给它们加一个级别筛选器只会得到"点了永远 0 条"。
   */
  leveled: boolean
}

/**
 * 日志**分类** —— 左栏分组的词表。**这个数组的顺序就是分组的显示顺序。**
 *
 * ⚠️ 分类与 `LogKind` 是**两件事**，不是一件事的两种写法：
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
 * ⚠️ 类型写成 `Record<LogKind, …>`（而不是 `Partial<…>`）是有意的：**新增一种日志格式
 *    却忘了给它归类，是编译错误**。写成可选的话，漏掉的那条日志会从左栏**静默消失**
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
 * 日志源清单。⚠️ 只有 `web` / `db` 两个角色有 —— 停机的 `cache`（测试机）没有日志可看，
 * 于是它连服务器分段都不会出现（判据在页面侧：`LOG_SOURCES[role]` 为空就不列）。
 *
 * ⚠️ `name` 用**组内不重复的短名**（"访问日志""主日志"），与原型左栏一致，不是"全名"：
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
 * 日志行池。⚠️ 行文**照抄原型** `design/work/工作-项目-项目详情-运维-日志-index.html`
 *    里那 8 个 `.log-pane`（顺序＝原型顺序，即"新的在上"）。因此它**带项目业务词**
 *    （"支付回调""对账批次"）—— 与"通用运维口径"相反，这是照抄的结果，不是漏改。
 *    要区分的是**机器**：同一个 kind 的行由 web / db 两组池子共用，同一台机器上的
 *    所有项目读同一份行，不按项目换词。
 * ⚠️ `level` 只表达"这行值不值得看一眼"：`access` / `syslog` / `wal` 这类日志本身**没有**
 *    级别字段，它们的 `level` 是从原型行类名（`is-warn` / `is-error`）推的，靠**左侧色条**
 *    表达（页面按 `leveled` 决定渲染不渲染级别徽标），但行本身仍然要带颜色。
 * ⚠️ 行数＝这个数组的长度（`buildLogLines` 不另读"条数"）。`wal` / `backup` 在原型里
 *    没有 ERROR 档，这里就**照实没有** —— 不为了凑齐三档编一条出来。
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

export interface DocSeed {
  name: string
  kind: DocKind
  /** 距上次更新多少小时；< 24 的算「新」（书墙上的黄点、列表里的 NEW） */
  updatedHours: number
}

/**
 * 内容池 —— 详情页的任务 / 里程碑 / 文档 / 动态 / 问题 / 服务器 / 会议 / 账户
 * 按 scope 从这里确定性取值，不硬编码 8 份数据（与原型 POOL 一致）。
 *
 * ⚠️ 2026-09-25 新增的后四组，对应 `work_product-detail.html` 里那四个新区
 *    （Bug / 运维 / 会议 / 账户）。口径与前四组同一条：**应用没有这四张表**
 *    （`Project` 上没有对应字段），所以内容是**池子 + 确定性派生**，
 *    不是给每个项目手写一份。取舍与 `data/workspace/project.ts` 的 notes/review 一致。
 *
 * ⚠️ `servers` 与 `accounts` **只有 work 域有内容**，另外两域是空数组 —— 这不是偷懒：
 *    「生产服务器」与「平台账号」是软件项目才有的东西，给一趟家庭旅行编两台 prod-web-01
 *    才是真的编数据。空数组的后果由页面承担：**派生出 0 条就隐藏那个分区**
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
    /** 平台名；空数组 = 这个域没有账户表 */
    accounts: string[]
    /** 部署文档；空数组 = 这个域没有部署手册（同 servers/accounts，只在 work 域有） */
    deployDocs: DeployDocSeed[]
    /**
     * 发布记录里每条"变更说明"（回滚那条读作"原因"）。
     * ⚠️ 与 `DEPLOY_TIMES` 一样按**下标**取，所以条数必须 ≥ 发布记录的条数（4 条）。
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
      { name: '行程与预算表', kind: 'plan', updatedHours: 30 },
      { name: '机票酒店确认单', kind: 'ref', updatedHours: 6 },
      { name: '签证材料清单', kind: 'spec', updatedHours: 54 },
      { name: '保险保单索引', kind: 'ref', updatedHours: 96 },
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
    documents: [
      { name: '技术方案 v3', kind: 'plan', updatedHours: 26 },
      { name: '接口契约说明', kind: 'api', updatedHours: 3 },
      { name: '灰度发布预案', kind: 'plan', updatedHours: 50 },
      { name: '数据迁移评审记录', kind: 'spec', updatedHours: 100 },
    ],
    activity: ['提交了架构方案 v3', '完成了鉴权模块评审', '更新了里程碑时间', '关闭了 3 条 P1 缺陷'],
    bugs: ['支付回调偶发超时', '对账金额精度丢失', '灰度开关偶发不生效', '导出任务偶发卡死', '鉴权 token 刷新竞态'],
    servers: [
      /* ⚠️ 这台 db 的 disk 是 95% —— KPI 条上那"1 项告警"与那一行的黄边就是它。
         别把这个数改小："环境健康"整块就没有非零值可展示了（判据见 `buildServers`）。 */
      { role: 'web', env: 'prod', os: 'Ubuntu 22.04', cores: 4, memGb: 8, diskGb: 80, cpu: 11, mem: 40, disk: 40 },
      { role: 'db', env: 'prod', os: 'PostgreSQL 15', cores: 8, memGb: 16, diskGb: 160, cpu: 23, mem: 43, disk: 95 },
      { role: 'cache', env: 'test', os: 'Redis 7', cores: 2, memGb: 4, diskGb: 40, cpu: 8, mem: 62, disk: 24 },
    ],
    meetings: ['项目评审', '技术方案评审', '周会', '上线演练'],
    accounts: ['阿里云', 'GitLab', '星辰后台', '腾讯云'],
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
      { name: '读书笔记合集', kind: 'research', updatedHours: 72 },
      { name: 'mini-runtime 源码', kind: 'ref', updatedHours: 20 },
      { name: '实践总结草稿', kind: 'plan', updatedHours: 120 },
      { name: '闪卡导出', kind: 'ref', updatedHours: 200 },
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

/** 文档索引的来源标签（**存在哪儿**，与下面的"种类"是两件事） */
export const DOC_SOURCES = ['腾讯文档', '语雀', 'Git 仓库', '本地 Markdown']

/**
 * 文档种类 —— 子类栏里的 7 项，顺序照原型 `work_project_detail_document.html` 的 `TYPE_MAP`。
 *
 * ⚠️ 颜色**不在这里**：原型把 7 支颜色写成 `--d-plan` 之类的 CSS 变量，
 *    这里保持同一条边界 —— JS 只给"哪一类"，长什么样归 `styles/module-workspace.css`
 *    的 `.d-*`（作用域在项目详情页面根下）。
 * ⚠️ 7 项的**计数**由文档派生（见 `DocLibrary`），所以某一类为 0 是正常的，
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
