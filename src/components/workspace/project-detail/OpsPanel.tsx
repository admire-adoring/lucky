import { Fragment, useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  buildServerMetrics,
  loadLevel,
  type DeployDocItem,
  type DeployItem,
  type ServerItem,
} from '../../../data/derive'
import { cn } from '../../../lib/cn'
import { AddServerForm } from './AddServerForm'

/* ============================================================================
   运维 —— 项目详情「运维」分区
   （原型 `design/work/工作-项目-项目详情-运维-index.html`，2026-09-25 落地）
   ----------------------------------------------------------------------------
   它替掉的是上一版那个"三张卡 + 几行"的简陋版。原型这一页有五件东西是上一版没有的：

     ① **KPI 指标条**（服务器 / 发布记录 / 部署文档 / **环境健康**）——
        最后那格是这一页唯一会变红的数：任一负载 ≥ 90% 就计一项告警；
     ② **服务器行带负载表**（CPU/MEM/DISK 三条 meter）+ 展开后的**五个子分区**：
        信息 / 监控 / 日志 / 部署 / 文件分布；
     ③ **监控**：三条迷你折线（12 点）+ 6 个关键指标；
     ④ **文件分布**：目录占用 + 总计；
     ⑤ **发布记录**：按结果筛选（全部/成功/回滚）+ 每条可展开的详情。

   ============================================================================
   六处与原型**有意不同**（"静态页 → 应用"必然要改的，不是审美）
   ============================================================================
   ① **`.ops-page` 这一层包装是必须的**。概览卡片与运维分区**共用** `.server-row` /
      `.deploy-row` 等一批类名，而两边要的版式完全不同（概览那张是 300px 宽的小卡）。
      于是把从原型搬来的规则统一挂在 `.ops-page` 下：特异性高一级 ⇒ 只在这一分区生效，
      概览那张卡**一像素都不动**。（不这么做就得去改概览的标记，那是另一件事。）
   ② **"最后检查 / 刷新"这一行搬进了分区内部**。原型把它放在页头（`.hero-mini`），
      而这一页的页头是**可折叠 Hero**（另一个原型定的，两处共用）—— 往别人的头里塞
      一行状态，两处的头会越来越像两套。
   ③ **「日志」与「部署」是动作，不是面板**。原型里它们是两条独立页
      （`…-日志-index.html` / `…-部署-index.html`），都从这一页开出去；应用里对应
      **两个整窗页面**（`/logs/:id`、`/deploy/:id`，各自套 `MacWindow`）。
      所以这两格在这一排按钮里渲染成 `<Link class="sd-tab ext">` + `↗`：一眼看出
      "点它会离开这一页"，而不是切到下面某个面板。⚠️ 因此它们**不进** `ServerTab` 联合类型。
      · 「部署」原先是一个面板（该节点发布历史 + 当前版本 + 回滚），**已删**：
        那三块内容在页面级的「发布记录」卡（含展开详情、构建日志、回滚）与「信息」面板的
        当前版本里各有一份，留着就是同一个东西两处入口。**格子本身保留**，改成直接跳转。
   ④ **停机的那台不显示负载**。`test-cache-01` 是停机的：meter 宽度 0、数值显示「—」。
      给它编一组"停着但内存 62%"的读数，是这一页最容易看起来对、实际错的地方。
   ⑤ **`环境健康` 的判据只有一条**：任一负载 ≥ 90%。原型把告警写死在标记里
      （"prod-db-01 磁盘使用率 95%"），这里由数据算出来 —— 池子里把那台 db 的 disk
      改小，这一格就该自己归零。
   ⑥ **破坏性操作仍然要有二次确认**（重启 / 回滚 / 清理磁盘），但确认之后**只给回执**：
      没有重启接口、没有回滚接口、没有清理接口。⚠️ 原型在确认之后弹的是
      `已下发重启指令`——那是个假成功，与项目详情 `⋯` 菜单、文档列表是同一条纪律。

   ============================================================================
   数据来源（哪些是真的、哪些是池子声明、哪些是算出来的）
   ============================================================================
   · 规格与负载 —— `POOL[scope].servers` 的 `ServerSeed`（核数/内存/磁盘 + 三格负载）；
     页面上的 `4C8G`、`3.2G / 8G`、`32G / 80G`、`0.44 / 4.0` **全部由这 6 个数算**。
   · 当前版本 —— `latestVersion(project)`，与发布记录第一条**同一个函数**（不能各写一份）。
   · 提交号 / 折线 / 进程数 / P99 —— 确定性派生（`shortSha`、`sparkSeries`…），
     因为应用里没有监控系统，这几个量本来就无处可取；系数表在 `derive.ts` 里声明着。
   · 停机那台没有负载（见 ④）。
   ============================================================================ */

/** 卡片折叠状态。三个 key 与原型的三张卡一一对应 */
type CardKey = 'server' | 'doc' | 'deploy'

/** 服务器详情里的分区。`log` / `deploy` 不在其中 —— 它们是动作，不是面板（见文件头 ③） */
type ServerTab = 'info' | 'metric' | 'disk'

/**
 * 详情里的那一排按钮。`log` 夹在「监控」之后（原型的位置），`deploy` 在最后（原型的顺序），
 * 两者都**不是面板** —— 点一下就离开这一页（见文件头 ③），所以用 `jump` 标出来、
 * 也不进 `ServerTab` 联合类型。
 * ⚠️ 用 `jump` 这个标记而不是 `key === 'log' || key === 'deploy'` 判断：
 *    后者在 `else` 分支里 TS 收不窄 `key`（会报 `'log' | 'deploy' | ServerTab` 不能赋给 `ServerTab`），
 *    `in` 收窄对判别联合是可靠的。
 */
type ServerTabEntry = { key: ServerTab; label: string } | { key: 'log' | 'deploy'; label: string; jump: true }

const SERVER_TABS: ServerTabEntry[] = [
  { key: 'info', label: '信息' },
  { key: 'metric', label: '监控' },
  { key: 'log', label: '日志', jump: true },
  { key: 'deploy', label: '部署', jump: true },
  { key: 'disk', label: '文件分布' },
]

/* ------------------------------------------------------------------ *
 * 小件
 * ------------------------------------------------------------------ */

/**
 * 这一台**最吃紧的那一项**。KPI 条的告警描述与行内那颗黄徽标都读它 ——
 * ⚠️ 两处各写一份就会出现"KPI 说磁盘、行上写 CPU"这种自相矛盾的画面。
 * 判据只有一条：取百分比最大的那一项（阈值判定仍在 `loadLevel`）。
 */
function worstLoad(server: ServerItem): { label: string; pct: number } {
  const loads = [
    { label: '磁盘', pct: server.disk },
    { label: '内存', pct: server.mem },
    { label: 'CPU', pct: server.cpu },
  ]
  return loads.reduce(
    (worst, item) => (item.pct > worst.pct ? item : worst),
    loads[0] ?? { label: '负载', pct: 0 },
  )
}

/** 负载条。`on === false`（停机）时宽度 0、数值「—」 —— 见文件头 ④ */
function Meter({ label, pct, on }: { label: string; pct: number; on: boolean }) {
  const level = loadLevel(pct)
  const tone = level === 'ok' ? null : level
  return (
    <div className="meter" title={`${label} ${on ? `${pct}%` : '（已停止）'}`}>
      <span className="meter-label">{label}</span>
      <span className="meter-track">
        <span className={cn('meter-fill', tone)} style={{ width: on ? `${pct}%` : '0%' }} />
      </span>
      <span className={cn('meter-val', tone)}>{on ? `${pct}%` : '—'}</span>
    </div>
  )
}

/**
 * 迷你折线（126×32 的 viewBox，与原型同尺寸）。
 *
 * ⚠️ 数据点由 `derive.ts` 的 `sparkSeries` 给（12 个 0..100 的数），这里只做**映射**：
 *    x 从左到右均分、y 由负载反推（100% 贴顶、0% 落在基线 30）。不在这里编数据。
 */
function Spark({ points, level }: { points: number[]; level: 'ok' | 'warn' | 'danger' }) {
  const xs = points.map((_, i) => 2 + (i * 115) / (points.length - 1))
  const ys = points.map((v) => 30 - (v / 100) * 28)
  const line = xs.map((x, i) => `${x.toFixed(1)},${(ys[i] ?? 30).toFixed(1)}`).join(' ')
  const area = `M${line.split(' ').join(' L')} L${(xs[xs.length - 1] ?? 117).toFixed(1)},30 L${(xs[0] ?? 2).toFixed(1)},30 Z`
  return (
    <svg
      className={cn('spark', level !== 'ok' && level)}
      viewBox="0 0 126 32"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path className="spark-area" d={area} />
      <polyline className="spark-line" vectorEffect="non-scaling-stroke" points={line} />
      <line className="spark-axis" x1="0" y1="30.5" x2="126" y2="30.5" />
    </svg>
  )
}

/** 可折叠的卡片。`grid-template-rows: 1fr/0fr` 那套在 CSS 里（`pd-` 前缀的关键帧同段） */
function OpsCard({
  icon,
  title,
  badge,
  collapsed,
  onToggle,
  action,
  children,
}: {
  icon: string
  title: string
  badge?: string
  collapsed: boolean
  onToggle: () => void
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className={cn('ops-card', collapsed && 'collapsed')}>
      <h2 className="ops-card-head">
        {/* 整条标题是按钮的角色（原型是 `role="button"` 的 h2）；里面那颗"+ 添加"是**真的按钮**，
            所以它 onClick 要 stopPropagation —— 否则点"添加"会顺带折叠卡片。 */}
        <button
          type="button"
          className="ops-card-toggle"
          aria-expanded={!collapsed}
          onClick={onToggle}
        >
          <span className="ops-card-head-left">
            <span className="card-icon" aria-hidden="true">
              {icon}
            </span>
            <span className="ops-card-title">{title}</span>
            {badge ? <span className="ops-card-badge">{badge}</span> : null}
          </span>
          <span className="ops-fold-icon" aria-hidden="true">
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </button>
        {action ? <span className="ops-card-head-action">{action}</span> : null}
      </h2>
      <div className="ops-card-body">
        <div className="ops-card-body-inner">{children}</div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * 二次确认弹窗
 * ------------------------------------------------------------------ */

interface ConfirmSpec {
  title: string
  desc: string
  warn: string
  confirmText: string
  onConfirm: () => void
}

function ConfirmModal({ spec, onClose }: { spec: ConfirmSpec; onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="modal-mask open"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label={spec.title}>
        <div className="modal-head">
          <div className="modal-title">{spec.title}</div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">
          <p>{spec.desc}</p>
          <div className="modal-warn" role="note">
            <strong>影响：</strong>
            <span>{spec.warn}</span>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              onClose()
              spec.onConfirm()
            }}
          >
            {spec.confirmText}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 页面
 * ------------------------------------------------------------------ */

export function OpsPanel({
  projectId,
  projectName,
  servers,
  deploys,
  deployDocs,
  notice,
}: {
  /** 日志页要用它拼链接（`/logs/<id>`）；这一层只拿得到派生数据，拿不到 `Project` */
  projectId: string
  /** 「添加服务器」那张表单的预览里要显示它归到哪个项目 */
  projectName: string
  servers: ServerItem[]
  deploys: DeployItem[]
  deployDocs: DeployDocItem[]
  notice: (text: string) => void
}) {
  const location = useLocation()
  /**
   * 日志页的地址 + 回来的路。
   *
   * ⚠️ `state.from` 是必须的：这一页同时挂在**项目模块**与**工作模块**下，
   *    硬编一个返回目标会把从另一个模块进来的人扔到别处。
   */
  const logTo = { pathname: `/logs/${projectId}`, state: { from: location.pathname } }
  /**
   * 部署面板的地址（`/deploy/<id>`，整窗页面）。
   *
   * ⚠️ 与 `logTo` 同一形态、同一理由：原型那里也是 `window.open` 出来的独立窗口
   *    （「📦 打开部署面板」）。它**不按服务器分** —— 原型用的是模块级的
   *    `openDeployWindow()`，URL 里不带 `?host=`，目标主机由部署页自己从项目派生。
   *    所以这里也只在 `OpsPanel` 上算一次，再传给每台节点的详情面板。
   */
  const deployTo = { pathname: `/deploy/${projectId}`, state: { from: location.pathname } }

  const [collapsed, setCollapsed] = useState<Record<CardKey, boolean>>({
    server: false,
    doc: false,
    deploy: false,
  })
  const [openServer, setOpenServer] = useState<string | null>(null)
  const [serverTab, setServerTab] = useState<ServerTab>('info')
  const [openDeploy, setOpenDeploy] = useState<string | null>(null)
  /** 「添加 / 编辑服务器」= 分区内的一个整页表单（见 `AddServerForm` 文件头）。null = 不看它 */
  const [serverForm, setServerForm] = useState<{ mode: 'add' } | { mode: 'edit'; server: ServerItem } | null>(null)
  const [filter, setFilter] = useState<'all' | 'success' | 'rollback'>('all')
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  /* ⚠️ 起始文案不写死"12 秒前" —— 那句在页面上放十分钟就是假的。刷新后换成真时刻。 */
  const [lastCheck, setLastCheck] = useState('最后检查：刚刚')

  const toggleCard = (key: CardKey) =>
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] }
      /* 折叠时把展开态收掉（原型 `closeDetails(card)`）：再展开时不会停在一个"半开"的旧状态 */
      if (next[key]) {
        if (key === 'server') setOpenServer(null)
        if (key === 'deploy') setOpenDeploy(null)
      }
      return next
    })

  /** 展开一台服务器：**互斥**（开一台就收起另一台），并把子分区复位到「信息」 */
  const toggleServer = (id: string) => {
    const willOpen = openServer !== id
    setOpenServer(willOpen ? id : null)
    setServerTab('info')
  }

  const toggleDeployRow = (id: string) => setOpenDeploy((prev) => (prev === id ? null : id))

  const refresh = () => {
    if (refreshing) return
    setRefreshing(true)
    setLastCheck('正在同步…')
    /* 静态页：这里没有真接口可打。900ms 后回到真实时刻 —— 与原型同一节奏。 */
    window.setTimeout(() => {
      setRefreshing(false)
      const now = new Date()
      setLastCheck(`最后更新 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
      notice('监控数据已刷新')
    }, 900)
  }

  const alerted = servers.filter((server) => server.alert)
  const prodCount = servers.filter((server) => server.env === 'prod').length
  const manuals = deployDocs.filter((doc) => doc.kind === '手册').length
  const scripts = deployDocs.filter((doc) => doc.kind === '脚本').length
  const rollbackCount = deploys.filter((item) => item.result === 'rollback').length
  const shownDeploys = deploys.filter((item) => filter === 'all' || item.result === filter)
  const latest = deploys[0]

  /** 破坏性操作的确认文案。⚠️ 确认之后只有回执 —— 没有接口可打（见文件头 ⑥） */
  const askRestart = (server: ServerItem) =>
    setConfirm({
      title: `重启 ${server.name}？`,
      desc: '重启会中断该服务器上正在处理的请求，通常在 20–40 秒内恢复。',
      warn: '若该节点正在承接线上流量，用户会看到短暂 502。建议先确认另一节点健康、或等业务低峰期执行。',
      confirmText: '确认重启',
      onConfirm: () => notice(`重启 ${server.name}：还没有写接口`),
    })

  const askRollback = (version: string) =>
    setConfirm({
      title: `回滚到 ${version}？`,
      desc: `将 ${servers[0]?.name ?? '当前节点'} 上的应用版本切回 ${version}，回滚过程自动执行，无需重新构建。`,
      warn: '回滚后，当前版本的数据写入与接口变更不会自动撤销。若涉及数据库结构变更，需人工处理。',
      confirmText: '确认回滚',
      onConfirm: () => notice(`回滚到 ${version}：还没有写接口`),
    })

  const askCleanup = (server: ServerItem) =>
    setConfirm({
      title: `清理 ${server.name} 的磁盘？`,
      desc: '将清理 WAL 归档与 14 天前的历史日志。',
      warn: '清理后的 WAL 归档无法用于时间点恢复。若仍需要该时间区间的恢复能力，请先完成一次全量备份。',
      confirmText: '确认清理',
      onConfirm: () => notice('清理磁盘：还没有写接口'),
    })

  /* 添加 / 编辑服务器：**整页表单**，占满这个分区 —— 所以在这里提前 return，
     不套 KPI 条与那几张卡（原型那一页也只有表单 + 侧轨）。
     ⚠️ `siblings` 在编辑模式下必须排除「自己」，否则「同网段已有」会把自己列进去、
        地址重复那句也会报成"和自己撞了"。 */
  if (serverForm) {
    const target = serverForm.mode === 'edit' ? serverForm.server : null
    return (
      <div className="ops-page rc-ops">
        <AddServerForm
          mode={serverForm.mode}
          projectName={projectName}
          server={target}
          siblings={servers
            .filter((item) => item.name !== target?.name)
            .map((item) => ({ name: item.name, ip: item.ip }))}
          onCancel={() => setServerForm(null)}
        />
      </div>
    )
  }

  return (
    <div className="ops-page rc-ops">
      {/* 状态行（见文件头 ②）。原型把它放在页头，这一页的页头是共用的可折叠 Hero */}
      <div className="ops-head">
        <span className="last-sync">{lastCheck}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={refresh}>
          ⟳ 刷新
        </button>
      </div>

      {/* ---------------- KPI 指标条 ---------------- */}
      <div className="kpi-bar">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              🖥
            </span>
            <span className="kpi-label">服务器</span>
          </div>
          <div className="kpi-val">
            {servers.length}
            <span className="kpi-unit">台</span>
          </div>
          <div className="kpi-sub">
            {prodCount} 台生产
            {servers.length > prodCount ? ` · ${servers.length - prodCount} 台测试` : ''}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              🚀
            </span>
            <span className="kpi-label">发布记录</span>
          </div>
          <div className="kpi-val">
            {deploys.length}
            <span className="kpi-unit">次</span>
          </div>
          <div className="kpi-sub">
            {latest ? `最近：${latest.when} · ${latest.version}` : '还没有记录'}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              📘
            </span>
            <span className="kpi-label">部署文档</span>
          </div>
          <div className="kpi-val">
            {deployDocs.length}
            <span className="kpi-unit">篇</span>
          </div>
          <div className="kpi-sub">
            {manuals} 手册 · {scripts} 脚本
          </div>
        </div>

        <div className={cn('kpi', alerted.length > 0 && 'warn')}>
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              {alerted.length > 0 ? '⚠️' : '✅'}
            </span>
            <span className="kpi-label">环境健康</span>
          </div>
          <div className="kpi-val">
            {alerted.length}
            <span className="kpi-unit">项告警</span>
          </div>
          <div className={cn('kpi-sub', alerted.length > 0 && 'warn-text')}>
            {alerted.length > 0
              ? alerted
                  .map((server) => {
                    const worst = worstLoad(server)
                    return `${server.name} ${worst.label}使用率 ${worst.pct}%`
                  })
                  .join(' · ')
              : '各节点负载均在阈值内'}
          </div>
        </div>
      </div>

      {/* ---------------- 服务器 ---------------- */}
      <OpsCard
        icon="🖥"
        title="服务器"
        badge={`${servers.length} 台${alerted.length > 0 ? ` · ${alerted.length} 项告警` : ''}`}
        collapsed={collapsed.server}
        onToggle={() => toggleCard('server')}
        action={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setServerForm({ mode: 'add' })}
          >
            + 添加
          </button>
        }
      >
        {refreshing ? (
          /* 骨架屏：只在刷新那一瞬间出现，形状与真行一致 */
          <div className="skeleton-list">
            {[0, 1].map((i) => (
              <div key={i} className="sk-row">
                <div className="sk sk-box" />
                <div className="sk-lines">
                  <div className="sk sk-line" />
                  <div className="sk sk-line short" />
                </div>
                <div className="sk sk-meter" />
              </div>
            ))}
          </div>
        ) : (
          <div className="server-list">
            {servers.map((server) => {
              const open = openServer === server.id
              const warn = worstLoad(server)
              return (
                /* ⚠️ Fragment 而不是包裹 div：`.server-row` 与它的详情面板在原型里是
                   **同级**（详情面板靠 `grid-template-rows: 0fr/1fr` 自己塌陷）。
                   多包一层会让"行与面板之间"少一个层级 —— 今天没有样式依赖它，
                   但只要哪天给 `.server-list` 加上 `gap`，两种结构就会不一样。 */
                <Fragment key={server.id}>
                  <div
                    className={cn('server-row', server.alert && 'alert', open && 'active')}
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => toggleServer(server.id)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      toggleServer(server.id)
                    }}
                  >
                    <span className={cn('server-rack', server.env)} aria-hidden="true" />
                    <div className="server-info">
                      <div className="server-name">
                        {server.name}
                        <span className={cn('badge', server.on ? 'ok' : 'idle')}>
                          {server.on ? '运行中' : '已停止'}
                        </span>
                        {server.alert ? <span className="badge warn">{warn.label}告警</span> : null}
                        <span className="env-tag">{server.env === 'prod' ? '生产' : '测试'}</span>
                      </div>
                      <div className="server-meta">{server.meta}</div>
                    </div>
                    <div className="server-meters">
                      <Meter label="CPU" pct={server.cpu} on={server.on} />
                      <Meter label="MEM" pct={server.mem} on={server.on} />
                      <Meter label="DISK" pct={server.disk} on={server.on} />
                    </div>
                    {/* 动作按钮是**真的按钮**，所以整块的 onClick 要在这一层停住 */}
                    <div className="server-actions" onClick={(event) => event.stopPropagation()}>
                      <button
                        type="button"
                        className="server-action-btn"
                        title="SSH 连接"
                        onClick={() => notice('SSH 终端：还没有写接口')}
                      >
                        ⌨
                      </button>
                      <button
                        type="button"
                        className="server-action-btn danger"
                        title="重启服务"
                        onClick={() => askRestart(server)}
                      >
                        ⟳
                      </button>
                      <button
                        type="button"
                        className="server-action-btn"
                        title="更多操作"
                        onClick={() => notice('更多操作：还没有写接口')}
                      >
                        ⋯
                      </button>
                    </div>
                  </div>

                  <ServerDetail
                    server={server}
                    open={open}
                    tab={serverTab}
                    onTab={setServerTab}
                    deploys={deploys}
                    notice={notice}
                    onCleanup={() => askCleanup(server)}
                    onEdit={() => setServerForm({ mode: 'edit', server })}
                    logTo={logTo}
                    deployTo={deployTo}
                  />
                </Fragment>
              )
            })}
          </div>
        )}
      </OpsCard>

      {/* ---------------- 部署文档 ---------------- */}
      <OpsCard
        icon="📘"
        title="部署文档"
        badge={`${deployDocs.length} 篇`}
        collapsed={collapsed.doc}
        onToggle={() => toggleCard('doc')}
        action={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => notice('新建部署文档：还没有写接口')}
          >
            + 新建
          </button>
        }
      >
        <div className="doc-books compact">
          {deployDocs.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className={cn('doc-book', doc.kind === '脚本' && 'script')}
              onClick={() => notice(`打开文档：${doc.name}`)}
            >
              {/* 书脊右上那两颗动作（下载 / 更多）—— 悬停才出现，`stopPropagation` 见上 */}
              <span className="book-actions" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="book-action-btn"
                  title={`下载${doc.name}`}
                  onClick={() => notice('下载文档：还没有写接口')}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="book-action-btn"
                  title="更多操作"
                  onClick={() => notice('更多操作：还没有写接口')}
                >
                  ⋯
                </button>
              </span>
              <span className="db-tag">{doc.kind}</span>
              <span className="db-title">{doc.name}</span>
              <span className="db-meta">
                {doc.version} · {doc.updatedAt}
              </span>
            </button>
          ))}
          <button type="button" className="doc-book add" onClick={() => notice('新建部署文档：还没有写接口')}>
            <span aria-hidden="true" style={{ fontSize: 16 }}>
              ＋
            </span>
            <span>新建文档</span>
          </button>
        </div>
      </OpsCard>

      {/* ---------------- 发布记录 ---------------- */}
      <OpsCard
        icon="🚀"
        title="发布记录"
        badge={`${deploys.length} 次${rollbackCount > 0 ? ` · ${rollbackCount} 次回滚` : ''}`}
        collapsed={collapsed.deploy}
        onToggle={() => toggleCard('deploy')}
        action={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => notice('记录发布：还没有写接口')}
          >
            + 记录
          </button>
        }
      >
        <div className="deploy-toolbar">
          <div className="chip-group" role="group" aria-label="按结果筛选发布记录">
            {([
              ['all', '全部', deploys.length],
              ['success', '成功', deploys.length - rollbackCount],
              ['rollback', '回滚', rollbackCount],
            ] as const).map(([key, label, count]) => (
              <button
                key={key}
                type="button"
                className={cn('chip', filter === key && 'active')}
                aria-pressed={filter === key}
                onClick={() => {
                  setFilter(key)
                  setOpenDeploy(null)
                }}
              >
                {label} <span className="chip-count">{count}</span>
              </button>
            ))}
          </div>
          <span className="deploy-filter-info">{shownDeploys.length} 条</span>
        </div>

        {shownDeploys.length ? (
          <div className="deploy-timeline">
            {shownDeploys.map((item, i) => {
              const open = openDeploy === item.id
              return (
                <div key={item.id} className="deploy-entry">
                  <div
                    className={cn('deploy-row', i === 0 && filter === 'all' && 'highlight', open && 'expanded')}
                    role="button"
                    tabIndex={0}
                    aria-expanded={open}
                    onClick={() => toggleDeployRow(item.id)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      toggleDeployRow(item.id)
                    }}
                  >
                    <span
                      className="deploy-dot"
                      style={{ ['--dc' as string]: item.result === 'success' ? 'var(--mw-ok)' : 'var(--mw-warn)' }}
                      aria-hidden="true"
                    />
                    <div className="deploy-info">
                      <div className="deploy-ver">
                        {item.version}
                        <span className={cn('badge', item.result === 'success' ? 'ok' : 'warn')}>
                          {item.result === 'success' ? '成功' : '回滚'}
                        </span>
                        {i === 0 && filter === 'all' ? <span className="badge idle">最新</span> : null}
                        <span className="deploy-expand-icon" aria-hidden="true">
                          ▼
                        </span>
                      </div>
                      <div className="deploy-meta">
                        <span>{item.when}</span>
                        <span className="sep" aria-hidden="true">
                          ·
                        </span>
                        <span>{item.server}</span>
                        <span className="sep" aria-hidden="true">
                          ·
                        </span>
                        <span>{item.who}</span>
                        {item.duration ? <span className="deploy-duration">耗时 {item.duration}</span> : null}
                      </div>
                    </div>
                  </div>

                  <div className={cn('deploy-detail-panel', open && 'open')}>
                    <div className="deploy-detail-inner">
                      <div className="deploy-detail-grid">
                        {item.result === 'success' ? (
                          <>
                            <div className="deploy-detail-item">
                              <span className="label">提交</span>
                              <span className="value">{item.commit}</span>
                            </div>
                            <div className="deploy-detail-item">
                              <span className="label">部署人</span>
                              <span className="value">{item.who}</span>
                            </div>
                            <div className="deploy-detail-item">
                              <span className="label">服务器</span>
                              <span className="value">{item.server}</span>
                            </div>
                            <div className="deploy-detail-item">
                              <span className="label">耗时</span>
                              <span className="value">{item.duration}</span>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* 回滚那条的四个格子是另一套（没有提交/耗时，多了回滚目标与原因） */}
                            <div className="deploy-detail-item">
                              <span className="label">回滚至</span>
                              <span className="value">{item.rollbackTo}</span>
                            </div>
                            <div className="deploy-detail-item">
                              <span className="label">操作人</span>
                              <span className="value">{item.who}</span>
                            </div>
                            <div className="deploy-detail-item">
                              <span className="label">服务器</span>
                              <span className="value">{item.server}</span>
                            </div>
                          </>
                        )}
                        <div className="deploy-detail-item span-2">
                          <span className="label">{item.result === 'success' ? '变更说明' : '原因'}</span>
                          <span className="value small">{item.changes}</span>
                        </div>
                      </div>
                      <div className="deploy-detail-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={(event) => {
                            event.stopPropagation()
                            notice('构建日志：还没有写接口')
                          }}
                        >
                          📋 {item.result === 'success' ? '构建日志' : '回滚日志'}
                        </button>
                        {item.result === 'success' ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={(event) => {
                              event.stopPropagation()
                              askRollback(item.version)
                            }}
                          >
                            ⏪ 回滚到此版本
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              🗂️
            </div>
            <div className="empty-title">该筛选下没有发布记录</div>
            <div className="empty-desc">换一个结果类型，或清空筛选查看全部</div>
          </div>
        )}
      </OpsCard>

      {confirm ? <ConfirmModal spec={confirm} onClose={() => setConfirm(null)} /> : null}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 服务器详情（五个分区，一次只开一台）
 * ------------------------------------------------------------------ */

function ServerDetail({
  server,
  open,
  tab,
  onTab,
  deploys,
  notice,
  onCleanup,
  onEdit,
  logTo,
  deployTo,
}: {
  server: ServerItem
  open: boolean
  tab: ServerTab
  onTab: (tab: ServerTab) => void
  deploys: DeployItem[]
  notice: (text: string) => void
  onCleanup: () => void
  /** 打开「编辑服务器」那张整页表单（见 `AddServerForm`） */
  onEdit: () => void
  /** 日志页的地址（见 `OpsPanel` 里那段注释） */
  logTo: { pathname: string; state: { from: string } }
  /** 部署面板的地址（同上） */
  deployTo: { pathname: string; state: { from: string } }
}) {
  const metrics = buildServerMetrics(server)
  /** 这台节点自己的发布历史（前 3 次）。⚠️ 不过滤就变成"每台都发过那三次"，是假的 */
  const mine = deploys.filter((item) => item.server === server.name)
  const latest = mine[0]

  const copyIp = () => {
    navigator.clipboard?.writeText(server.ip).then(
      () => notice(`已复制 IP ${server.ip}`),
      () => notice('复制失败：这个环境没有剪贴板权限'),
    )
  }

  return (
    <div className={cn('server-detail-panel', open && 'open')}>
      <div className="server-detail-inner">
        <div className="sd-tabs" role="tablist" aria-label={`${server.name} 详情分区`}>
          {SERVER_TABS.map((item) => {
            /* 「日志」与「部署」各是一个整窗页面（见文件头 ③）—— 原型这两处都是 `<a>`，
               所以用 `<Link>`。`↗` 表示"会离开当前这一页"，与它左边的面板按钮不是一类。 */
            if ('jump' in item) {
              const to = item.key === 'log' ? logTo : deployTo
              return (
                <Link key={item.key} className="sd-tab ext" to={to.pathname} state={to.state}>
                  {item.label}
                  {/* 这台节点发过几次 —— 跳走之后就看不到这个数了，所以留在入口上 */}
                  {item.key === 'deploy' && mine.length > 0 ? (
                    <span className="sd-tab-count">{mine.length}</span>
                  ) : null}
                  <span aria-hidden="true">↗</span>
                </Link>
              )
            }
            return (
              <button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={tab === item.key}
                className={cn('sd-tab', tab === item.key && 'active')}
                onClick={() => onTab(item.key)}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        {/* ---------- 信息 ---------- */}
        <div className={cn('sd-pane', tab === 'info' && 'active')}>
          <div className="server-detail-grid">
            <div className="detail-item">
              <span className="detail-label">IP 地址</span>
              <span className="detail-value">{server.ip}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">规格</span>
              <span className="detail-value">
                {server.cores} vCPU · {server.memGb} GiB
              </span>
            </div>
            <div className="detail-item">
              <span className="detail-label">操作系统</span>
              <span className="detail-value">{server.os}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">运行时长</span>
              <span className="detail-value">{server.on ? `${server.uptimeDays} 天` : '已停止'}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">当前版本</span>
              <span className="detail-value">{latest?.version ?? server.version}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">应用端口</span>
              <span className="detail-value">{server.ports}</span>
            </div>
          </div>

          <div className="sd-section">
            <div className="sd-section-head">
              资源使用 <span className="hint">最近 24 小时</span>
            </div>
            <div className="usage-grid">
              {(
                [
                  ['CPU 负载', server.cpu, `${((server.cpu / 100) * server.cores).toFixed(2)} / ${server.cores}.0`],
                  ['内存', server.mem, `${((server.mem / 100) * server.memGb).toFixed(1)}G / ${server.memGb}G`],
                  ['磁盘', server.disk, `${((server.disk / 100) * server.diskTotalGb).toFixed(1)}G / ${server.diskTotalGb}G`],
                ] as const
              ).map(([name, pct, text]) => (
                <div key={name} className="usage-item">
                  <div className="usage-top">
                    <span className="name">{name}</span>
                    <span className={cn('val', server.on && loadLevel(pct) !== 'ok' && loadLevel(pct))}>
                      {server.on ? `${text} · ${pct}%` : '—'}
                    </span>
                  </div>
                  <span className="meter-track">
                    <span
                      className={cn('meter-fill', server.on && loadLevel(pct) !== 'ok' && loadLevel(pct))}
                      style={{ width: server.on ? `${pct}%` : '0%' }}
                    />
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="sd-actions">
            <button type="button" className="btn btn-ghost btn-sm" onClick={copyIp}>
              ⧉ 复制 IP
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={onEdit}
            >
              ✏️ 编辑
            </button>
          </div>
        </div>

        {/* ---------- 监控 ---------- */}
        <div className={cn('sd-pane', tab === 'metric' && 'active')}>
          <div className="metric-grid">
            {(
              [
                ['CPU 使用率', server.cpu, server.series.cpu],
                ['内存使用率', server.mem, server.series.mem],
                ['磁盘使用率', server.disk, server.series.disk],
              ] as const
            ).map(([name, now, points]) => {
              const level2 = loadLevel(now)
              const avg = Math.round(points.reduce((sum, v) => sum + v, 0) / points.length)
              const peak = Math.max(...points)
              return (
                <div key={name} className="metric-card">
                  <div className="metric-head">
                    <span className="metric-name">{name}</span>
                    <span className={cn('metric-now', level2 !== 'ok' && level2)}>
                      {server.on ? `${now}%` : '—'}
                    </span>
                  </div>
                  <Spark points={points} level={level2} />
                  <div className="spark-foot">
                    <span>24h 平均 {avg}%</span>
                    <span>峰值 {peak}%</span>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="sd-section">
            <div className="sd-section-head">
              关键指标 <span className="hint">最近 1 小时</span>
            </div>
            <div className="kv-grid">
              {metrics.map((metric) => (
                <div key={metric.k} className="kv">
                  <span className="kv-k">{metric.k}</span>
                  <span className="kv-v">
                    {server.on ? metric.v : '—'}
                    {server.on && metric.unit ? <small> {metric.unit}</small> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="sd-section">
            <div className={cn('note', server.alert ? 'danger' : 'ok')}>
              <span className="note-ico" aria-hidden="true">
                {server.alert ? '!' : '✓'}
              </span>
              <span>
                {server.alert
                  ? `有 ${[server.cpu, server.mem, server.disk].filter((p) => loadLevel(p) === 'danger').length} 项负载越过 90% 阈值，建议尽快处理。`
                  : '各项指标均在阈值内，无活跃告警。'}
              </span>
            </div>
          </div>

          <div className="sd-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => notice('打开监控面板：还没有写接口')}
            >
              📊 打开监控面板
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => notice('订阅告警：还没有写接口')}
            >
              🔔 订阅告警
            </button>
          </div>
        </div>

        {/* ---------- 文件分布 ---------- */}
        <div className={cn('sd-pane', tab === 'disk' && 'active')}>
          <div className="sd-section-head compact-head">
            目录占用{' '}
            <span className="hint">
              已用 {server.diskUsedGb} G / {server.diskTotalGb} G
            </span>
          </div>
          <div className="disk-list">
            {server.diskUsage.map((row) => (
              <div key={row.path} className="disk-item">
                <span className="disk-path">{row.path}</span>
                <span className="disk-size">{row.size}</span>
                <span className="disk-bar">
                  <span
                    className={cn(loadLevel(row.pct) !== 'ok' && loadLevel(row.pct))}
                    style={{ width: `${row.pct}%` }}
                  />
                </span>
                <span className="disk-pct">{row.pct}%</span>
              </div>
            ))}
          </div>
          <div className="disk-total">
            <span>总占用</span>
            <span>
              <strong>{server.diskUsedGb.toFixed(1)} G</strong> / {server.diskTotalGb} G · 剩余{' '}
              {(server.diskTotalGb - server.diskUsedGb).toFixed(1)} G
            </span>
          </div>
          <div className="sd-section">
            <div className={cn('note', server.alert ? 'danger' : 'ok')}>
              <span className="note-ico" aria-hidden="true">
                {server.alert ? '!' : '✓'}
              </span>
              <span>
                {server.alert
                  ? '磁盘使用率已越过 90%，建议清理后再观察一个周期。'
                  : '容量充足，按当前增长速率还有较大余量。'}
              </span>
            </div>
          </div>
          <div className="sd-actions">
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => notice('浏览文件：还没有写接口')}
            >
              🗂 浏览文件
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onCleanup}>
              🧹 清理临时文件
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
