import { useEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../../lib/cn'
import {
  AUTH_LABEL,
  buildRailTree,
  buildServerDetail,
  buildServerLedger,
  escText,
  fileKindOf,
  projectTint,
  railBaseName,
  railFullPath,
  railLeafCount,
  type RailNode,
} from '../../../data/derive'
import type { PathSeed } from '../../../data/content-pool'
import { useProjects } from '../../../hooks/use-projects'
import { isConnected, markConnected } from '../../../lib/server-conn'
import { toast } from '../../../stores/toast-store'
import { AddServerForm } from '../project-detail/AddServerForm'
import { DeployDocBook } from '../project-detail/DeployDocBook'
import { deploySourceDoc } from '../project-detail/doc-source/source-doc'
import { useSourceOverlay } from '../project-detail/doc-source/use-source-overlay'
import { OpsIcon } from '../project-detail/ops-icon'
import { PanelModal } from '../project-detail/panel-shell'

/* ============================================================================
   工作 · 服务器 · 详情 —— `/work/servers/:host`
   事实源：`design/work/工作-服务器-详情-index.html`（2026-09-29）
   ----------------------------------------------------------------------------
   一台机器的全部：它是什么、怎么连上去、被哪些项目共用、有哪些文档、文件都在哪。
   与另外两页的分工：
     · `ServersLedger`（`/work/servers`）回答"我手上有哪些机器" —— 卡片一眼看完；
     · 本页回答"这一台是什么" —— 四段：概览 / 项目 / 文档 / 文件位置；
     · 运维分区（`/work/projects/:id/ops`）是动手的地方（部署 / 看日志 / 发版 / 回滚），
       本页只给门（Hero 上那三颗 + 项目卡右上角那颗），不造第二套入口。
   ⇒ 所以本页不重复台账页的卡片墙与筛选，也不重复运维页的动作。

   四段各用一种物（判据只有一条：这一段的数据是什么形状，它就长成什么样子）：
        · 项目 = 抽屉：一行只够说"有多少"，拉开才是"都是哪几个、都在哪"；
        · 文档 = 书（共用的 `DeployDocBook`，本页只加书架外壳）；
        · 文件位置 = 路线图（数据里只有层级关系、没有方位与距离 ⇒ 画拓扑图，不画地图）；
        · 概览 = 字段读数（它没有形状，就是一组值）。

   ============================================================================
   有意偏离原型的地方（"单文件原型 → 应用"必然要改的，不是审美）
   ============================================================================
   ① 导航壳 / 命令面板 / 侧栏「最近」整块不搬 —— 那是原型对应用壳的模拟，
      应用里由 `WorkspaceLayout` 提供。连带原型那两条"环上定位 + 滚动同步"也不搬
      （环是工作模块的 7 个分区，不是本页那四段）。
   ② 返回是一条 `<Link>`（原型是 `href="工作-服务器-index.html"`）：落到台账页
      `/work/servers`，不是浏览器后退 —— 深链进来的人也有确定的上一层。
   ③ 外链不带 `?host=`：应用的 `/logs/:id` 与 `/deploy/:id` 是项目级的
      （各自页内有机器选择器 / 由项目派生目标主机），没人读那个参数。落点取这台机器
      服务的第一个项目（与台账页同一条规则）。
   ④ `data-section` / `data-ico` 那套契约属性不发：原型靠它们做"环上定位 + 滚动同步"
      与图标灌装，两件事在应用里分别归外壳与 `OpsIcon` ⇒ 留着就是没人读的第二描述。
   ⑤ 「编辑 / 移除」两步都不真的改数据：应用的机器是派生的（`buildServerLedger`
      从项目池子现算）—— 编辑去 `AddServerForm` 那张整页表单（与运维分区同一处置），
      移除给回执（没有移除接口）。原型那一版移除之后会跳回列表页，这里不跳：
      跳走会让人以为"删掉了"，而刷新它又回来了。
   ⑤ 路径不按项目分（见下面「应用的数据模型」那一段）——
      这是本页与原型差得最明显的一处，写在文件头而不是埋在注释里。

   ============================================================================
   应用的数据模型，与原型那三处必然不同（都会看得见）
   ============================================================================
   原型的数据是逐项目手写的：每台机器带 `projects`、每条路径带 `project`、
   登录身份每个 host 一套。应用里机器与路径都在 `POOL[scope].servers` 上（按域存）⇒
     · 一台机器的 `projects` = 该域下所有项目（work 域 2 个）；
     · 文件位置不分项目：这一台机器的文件位置就是它服务的那几个项目共用的那一份
       （原型的"每个项目各有一批"在应用里没有对应字段）⇒ 每张项目卡的读数相同、
       拉开抽屉看到的是同一批。没有为此在池子里编一个假的归属。
     · 登录身份（用户 / 认证方式 / 提权）在池子里是声明，两台机器各一套。
   ============================================================================ */

/** 文件抽屉里那枚类型徽标的文案（与台账页同一份表） */
const KIND_TXT = { dir: '目录', binary: '二进制', file: '文件' } as const

interface FileState {
  title: string
  path: string
  kind: 'dir' | 'file' | 'binary'
  saved: string
  body: string
}

interface ConfirmSpec {
  title: string
  desc: string
  warn: string
  confirmText: string
  onConfirm: () => void
}

/* ------------------------------------------------------------------ *
 * 路线图里的一站（递归）
 * ------------------------------------------------------------------ */

function RouteNodeView({
  node,
  parent,
  folded,
  onToggleFold,
  onOpenFile,
}: {
  node: RailNode
  /** 祖先拼出来的绝对路径（终点站不用它 —— 用登记值原样） */
  parent: string
  folded: Record<string, boolean>
  onToggleFold: (full: string) => void
  onOpenFile: (item: PathSeed) => void
}) {
  const full = railFullPath(node, parent)
  const kids = node.kids
  /* 终点站 = "这条路径到此为止"的那个节点。有子节点的节点即使自己也挂牌（前缀路径），
     也按路过站画 —— 它下面还有东西，画成终点会读成"这条线断了"。 */
  const isLeaf = Boolean(node.leaf) && kids.length === 0
  const count = kids.length ? railLeafCount(node) : 0
  const open = !folded[full]
  const name = node.name + (isLeaf && node.isDir ? '/' : '')

  return (
    <li className={cn('route-item', isLeaf ? 'is-leaf' : 'is-branch', !open && 'is-collapsed')}>
      <div className="route-node">
        {/* 主动作两种、落的都是"点这一行"：终点 = 开文件抽屉看它写了什么；
            分叉 = 把下面那一段收起来。
            做成真 `<button>` 而不是给 div 挂 role：它右边就是两枚真按钮
               （"角色按钮里套按钮"是非法结构）。又因为那两枚在主按钮外面，
               点击只冒泡到 `.route-node`（那里没有监听）⇒ 省掉两处 stopPropagation。 */}
        <button
          type="button"
          className="route-main"
          title={full}
          aria-label={isLeaf ? `打开 ${full}` : `${name}，下面还有 ${count} 条位置`}
          {...(isLeaf ? {} : { 'aria-expanded': open })}
          onClick={() => (isLeaf && node.leaf ? onOpenFile(node.leaf) : onToggleFold(full))}
        >
          {/* 收起箭头：只有分叉站有，且 `aria-hidden` —— 状态与动作都归主按钮说，
              它只是那个 15px 槽位里的一个可见信号。 */}
          {kids.length ? (
            <span className="route-fold" aria-hidden="true" title="点一下收起或展开">
              <OpsIcon name="chevD" size={13} />
            </span>
          ) : null}
          <span className="route-stop" aria-hidden="true" />
          <span className="route-name">{name}</span>
          {/* 读序：我在哪 → 它是什么 → 它的状态。用途紧跟名字；版本与项目贴右端收口。 */}
          {isLeaf && node.leaf ? <span className="route-use">{node.leaf.use}</span> : null}
          {isLeaf && node.leaf ? (
            <span className="route-meta">
              <span className="route-note">{node.leaf.note}</span>
            </span>
          ) : kids.length ? (
            <span className="route-meta">
              <span className="route-cnt">{count} 条</span>
            </span>
          ) : null}
        </button>
        {/* 两枚复制：在主按钮外面（按钮里不能套按钮）。标签只写"路径 / 名称"两个词，
            完整值与句子在 title / aria-label 上 —— 一行十来条，写全会把线路图淹掉。 */}
        <button
          type="button"
          className="route-act"
          title={`复制完整路径：${full}`}
          aria-label={`复制路径 ${full}`}
          onClick={() => {
            navigator.clipboard?.writeText(full).catch(() => {})
            toast(`已复制 ${full}`)
          }}
        >
          <OpsIcon name="copy" size={12} />
          <span className="act-t">路径</span>
        </button>
        <button
          type="button"
          className="route-act"
          title={`复制名称：${railBaseName(full)}`}
          aria-label={`复制名称 ${railBaseName(full)}`}
          onClick={() => {
            const base = railBaseName(full)
            navigator.clipboard?.writeText(base).catch(() => {})
            toast(`已复制 ${base}`)
          }}
        >
          <OpsIcon name="copy" size={12} />
          <span className="act-t">名称</span>
        </button>
      </div>
      {kids.length && open ? (
        <ul className="route-list">
          {kids.map((kid) => (
            <RouteNodeView
              key={kid.name}
              node={kid}
              parent={full}
              folded={folded}
              onToggleFold={onToggleFold}
              onOpenFile={onOpenFile}
            />
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/* ------------------------------------------------------------------ *
 * 页面
 * ------------------------------------------------------------------ */

export function ServerDetail({ host }: { host: string }) {
  const { data, isLoading } = useProjects()
  const projects = useMemo(() => (data ?? []).filter((project) => project.scope === 'work'), [data])
  const detail = useMemo(() => buildServerDetail(projects, host), [projects, host])

  /* 连接状态与文件清单是"就地读"的（模块级集合 / 池子那份数组），要一个计数器叫重渲 */
  const [, forceRender] = useReducer((n: number) => n + 1, 0)

  const [openProject, setOpenProject] = useState<string | null>(null)
  /** 「编辑这台机器」= 本页内的一个整页视图（复用 `AddServerForm`，见文件头 ④）。null = 看详情 */
  const [form, setForm] = useState<string | null>(null)
  const [file, setFile] = useState<FileState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null)
  /** 路线图里被收起的分叉站（键 = 那一站的绝对路径）。默认全展开。 */
  const [folded, setFolded] = useState<Record<string, boolean>>({})
  const codeRef = useRef<HTMLTextAreaElement>(null)
  const location = useLocation()

  /* 原文页：书架上的书点开就是它。位置那一行用**这一排的项目名**（书是按项目分排的）。 */
  const { openSource, sourceNode, sourceOpen } = useSourceOverlay('服务器', toast)

  /**
   * Escape 的优先级：文件抽屉 → 项目抽屉 → 二次确认。
   * 顺序照 z-index 来：文件抽屉 210 > 项目抽屉 205 > 弹窗（内核 100）——
   *    "一层层拉开"的直觉就是先退最上面那一层（原型同此）。
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      /* 原文页开着时这一页不接管：那一层自己会关，一次 Esc 只该退一层 */
      if (sourceOpen) return
      if (file) {
        setFile(null)
        return
      }
      if (openProject) {
        setOpenProject(null)
        return
      }
      if (confirm) {
        setConfirm(null)
        return
      }
      if (form) setForm(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [file, openProject, confirm, form, sourceOpen])

  /* 焦点：可编辑的文件落进正文（只读预览不抢焦点）；项目抽屉落在关闭键上（原型同此） */
  useEffect(() => {
    if (file?.kind === 'file') codeRef.current?.focus()
  }, [file?.path, file?.kind])

  const server = detail?.server
  const railNodes = useMemo(() => (server ? buildRailTree(server.paths) : []), [server])
  const totalDocs = detail ? detail.shelves.reduce((n, shelf) => n + shelf.docs.length, 0) : 0
  /* 「编辑」那张表里有一格「同网段已有」—— 给它同域其余机器（自己当然要排掉） */
  const siblings = useMemo(
    () => buildServerLedger(projects).filter((item) => item.host !== host).map((item) => ({ name: item.host, ip: item.ip })),
    [projects, host],
  )

  const copy = (value: string) => {
    navigator.clipboard?.writeText(value).catch(() => {})
    toast(`已复制 ${value}`)
  }

  const toggleConn = () => {
    if (!server) return
    const on = !isConnected(server.host)
    markConnected(server.host, on)
    forceRender()
    toast(on ? `已连接 ${server.host}` : `已断开 ${server.host}`)
  }

  const openFile = (item: PathSeed) => {
    const kind = fileKindOf(item.path)
    const body = item.preview ?? '（这个文件在本原型里没有示例内容）'
    setFile({ title: item.use, path: item.path, kind, saved: body, body })
  }

  const askRemove = () => {
    if (!server) return
    setConfirm({
      title: `移除 ${server.host}？`,
      desc: '移除后，这台机器不再出现在这份台账里，也不再从它采集日志。',
      warn: '服务器本身不会被停用，上面的应用与数据都不受影响，日后重新添加即可接回。',
      confirmText: '移除服务器',
      onConfirm: () => toast(`${server.host}：还没有写移除接口`),
    })
  }

  /* ---------------- 加载 / 找不到两态 ----------------
     数据未到时不进正文：`detail` 还是 null，照渲染会让 Hero 上出现一个空机器名
        （与台账页同一处置）。 */
  if (isLoading || !detail || !server) {
    return (
      <div className="sv-page svd-page">
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">
            <OpsIcon name="server" size={22} />
          </div>
          <div className="empty-title">{isLoading ? '正在读取机器台账…' : `台账里没有 ${host} 这台机器`}</div>
          <div className="empty-desc">
            {isLoading ? '机器由各项目的内容池现算' : '它可能已经被移除 —— 回列表看看还有哪些'}
          </div>
          {isLoading ? null : (
            <Link className="btn btn-ghost btn-sm" to="/work/servers">
              返回服务器列表
            </Link>
          )}
        </div>
      </div>
    )
  }

  const logTo = `/logs/${server.projects[0]?.id ?? ''}`
  const deployTo = `/deploy/${server.projects[0]?.id ?? ''}`
  const terminalTo = `/terminal/${server.projects[0]?.id ?? ''}?host=${encodeURIComponent(server.host)}`
  const opsTo = (projectId: string) => `/work/projects/${projectId}/ops`
  /* 从本页开到别处的三处（终端 / 日志 / 部署）都带回来路 —— 与运维分区同一条纪律 */
  const from = { from: location.pathname }

  const drawerProject = detail.shelves.find((shelf) => shelf.projectId === openProject) ?? null
  /* ---------------- 「编辑这台机器」：占满本页的整页表单 ----------------
     与台账页 / 运维分区同一个组件（`AddServerForm`）：原型那张表也是三处共用的
        （"同一张表承担添加与编辑，只有五处换词"）。这里只传编辑那一档。 */
  if (form) {
    return (
      <div className="sv-page svd-page">
        <AddServerForm
          mode="edit"
          projectName={server.projects[0]?.name ?? ''}
          server={{ name: server.host, ip: server.ip, cores: server.cores, memGb: server.memGb, os: server.os }}
          siblings={siblings}
          onCancel={() => setForm(null)}
        />
      </div>
    )
  }


  return (
    <div className="sv-page svd-page">
      {/* ---------------- ② Hero：这台机器的实体头 ----------------
          形态照同模块的详情页（`.hero-card`），内容换成机器。
          不折叠（与项目详情页"默认收起"不同，这是有意的偏离）：右半是这台机器的
             全部动作，折进"展开后才看得见"的地方 = 唯一的高频动作被藏起来。 */}
      <div className="hero-card">
        <div className="hero-bar">
          <div className="hero-bar-left">
            {/* 返回：它不是"页面级动作"而是一条来路（这一页是从列表点进来的）⇒ 放最左、次要色 */}
            <Link className="hero-back" to="/work/servers">
              <OpsIcon name="chevL" size={13} />
              服务器
            </Link>
            <h1 className="hero-name">{server.host}</h1>
            <span className="hero-role" title={server.roleLabel} aria-label={server.roleLabel}>
              <OpsIcon name={server.role === 'db' ? 'database' : 'server'} size={15} />
            </span>
            <span className={cn('hero-tag', server.env !== 'prod' && 'is-test')}>{server.envLabel}</span>
            <span className="sv-projs">
              {server.projects.map((project) => (
                <span className="sv-proj" key={project.id}>
                  {project.name}
                </span>
              ))}
            </span>
          </div>
          <div className="hero-bar-right">
            <button
              type="button"
              className={cn('conn', isConnected(server.host) && 'on')}
              aria-pressed={isConnected(server.host)}
              title={`${isConnected(server.host) ? '断开' : '连接'} ${server.host}`}
              onClick={toggleConn}
            >
              {isConnected(server.host) ? '已连接' : '未连接'}
            </button>
            <span className="hero-sep" aria-hidden="true" />
            {/* 三件事三种形态，别一律做成按钮：
                终端 / 日志 / 部署 = 打开别处（应用里是整页窗口）⇒ `<Link>`； */}
            <Link className="btn btn-ghost btn-sm" to={terminalTo} state={from} title="打开终端窗口（一台机器一个会话）">
              <OpsIcon name="window" size={14} />
              终端
            </Link>
            <Link className="btn btn-ghost btn-sm" to={logTo} state={from} title="在新窗口打开这台机器的日志">
              <OpsIcon name="file" size={14} />
              日志
              <span className="sv-ext" aria-hidden="true">
                <OpsIcon name="external" size={11} />
              </span>
            </Link>
            <Link className="btn btn-ghost btn-sm" to={deployTo} state={from} title="在新窗口打开部署面板">
              <OpsIcon name="rocket" size={14} />
              部署
              <span className="sv-ext" aria-hidden="true">
                <OpsIcon name="external" size={11} />
              </span>
            </Link>
            <span className="hero-sep" aria-hidden="true" />
            {/* 编辑 = 去那张整页表单（应用里是分区内的一个视图，见 `AddServerForm` 文件头）；
                移除 = 本页确认弹窗（破坏性动作，留在最后）。 */}
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm(server.host)}>
              <OpsIcon name="edit" size={14} />
              编辑
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={askRemove}>
              <OpsIcon name="trash" size={14} />
              移除
            </button>
          </div>
        </div>
      </div>

      {/* ---------------- ③ 概览：这台机器是什么、怎么连上去 ----------------
          只放「没连上时也存在」的值（判据写在 `ServerContent` 的 `user/auth/esc` 上）：
             负载 / 版本 / 运行时长要连上才读得到 ⇒ 永不进这里。 */}
      <section className="sec">
        <div className="sec-head">
          <span className="sec-ico" aria-hidden="true">
            <OpsIcon name="info" size={15} />
          </span>
          <span className="sec-name">概览</span>
          <span className="sec-count">{6 + server.ports.length} 项</span>
          <span className="sec-note">只放「没连上时也存在」的值</span>
        </div>
        <div className="fld-grid">
          <div className="fld">
            <span className="k">IP 地址</span>
            <span className="v is-mono">{server.ip}</span>
          </div>
          <div className="fld">
            <span className="k">操作系统</span>
            <span className="v">{server.os}</span>
          </div>
          {/* 「角色」「环境」的文字在这里 —— Hero 上它们只是形状（一枚图标 / 一个标签），
              文字得有第二个家（判据：文字不许只留在 hover 里）。 */}
          <div className="fld">
            <span className="k">角色</span>
            <span className="v">{server.roleLabel}</span>
          </div>
          <div className="fld">
            <span className="k">环境</span>
            <span className="v">{server.envLabel}</span>
          </div>
          <div className="fld">
            <span className="k">登录用户</span>
            <span className="v">
              {server.user} · {AUTH_LABEL[server.auth]}
            </span>
          </div>
          <div className="fld">
            <span className="k">提权方式</span>
            <span className="v">{escText(server.esc)}</span>
          </div>
          {/* 端口数量不定 ⇒ 跨满整行 + 胶囊换行（塞进固定列网格必被撑爆） */}
          <div className="fld is-wide">
            <span className="k">应用端口</span>
            <span className="v">
              <span className="chips">
                {server.ports.map((port) => (
                  <span className="pchip" key={port.port}>
                    {port.port}
                    <span className="svc">{port.svc}</span>
                  </span>
                ))}
              </span>
            </span>
          </div>
        </div>
        <div className="sec-acts">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(server.ip)}>
            <OpsIcon name="copy" size={14} /> 复制 IP
          </button>
        </div>
      </section>

      {/* ---------------- ③ 服务项目：这台机器被谁共用 ----------------
          项目 ↔ 机器是多对多：一台机器能服务多个项目，这一节就是它的收口 ——
             卡脚那排胶囊说"服务哪些项目"，这里一张卡一个项目、整卡可点、拉开是抽屉。
          卡上不写项目描述（那句话的第二个家在抽屉头上），也不放项目图标
             （底色已经在说"这是哪个项目"，再加一枚就是同一件事两处表达）。 */}
      <section className="sec">
        <div className="sec-head">
          <span className="sec-ico" aria-hidden="true">
            <OpsIcon name="project" size={15} />
          </span>
          <span className="sec-name">服务项目</span>
          <span className="sec-count">{server.projects.length} 个</span>
          <span className="sec-note">点一张卡拉开看它放了什么</span>
        </div>
        <div className="pc-grid">
          {server.projects.map((project) => (
            /* 卡是抽屉把手：`div[role=button]`（右上角嵌着 `<a>` 去运维页，
               而按钮里不许嵌链接）。整张卡都是命中区，右上角那颗是唯一的第二动作。 */
            <div
              key={project.id}
              className="pc-card"
              style={{ '--pc': projectTint(project.id) } as CSSProperties}
              role="button"
              tabIndex={0}
              aria-controls="pdBody"
              title="拉开看它在这台机器上放了什么"
              onClick={() => setOpenProject(project.id)}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return
                if (event.key !== 'Enter' && event.key !== ' ') return
                event.preventDefault()
                setOpenProject(project.id)
              }}
            >
              {/* 缩略窗：只承载形状（一条横条 + 三点 = "一份东西的缩略图"）。
                  别往里放计数 —— 那是"形状线索不许承载数字"的老账。 */}
              <div className="pc-thumb" aria-hidden="true">
                <span className="pc-bar" />
                <span className="pc-dots">
                  <span />
                  <span />
                  <span />
                </span>
              </div>
              <div className="pc-head">
                <span className="pc-name">{project.name}</span>
                <Link
                  className="pc-go"
                  to={opsTo(project.id)}
                  title="去这个项目的运维页"
                  aria-label={`去 ${project.name} 的运维页`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <OpsIcon name="external" size={15} />
                </Link>
              </div>
              <div className="pc-meta">
                <span className="pc-dot" />
                文件位置 <b>{server.paths.length}</b> 条
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ---------------- ③ 文档：这台机器服务的项目各自的部署文档 ----------------
          归属是项目，不是"这台机器" —— 文档长在项目里（运维页那一格就是这几本），
             本页只说"它服务的那几个项目、各自有几本、都是什么"，所以按项目分排书架。
          真值在运维页 / 文档主页：本页不给下载 / 新建 / 移动（搬到这儿就是第二套
             管理入口）⇒ 这里的书只有"点开读"一个动作（`DeployDocBook` 不传 `actions`）。 */}
      <section className="sec">
        <div className="sec-head">
          <span className="sec-ico" aria-hidden="true">
            <OpsIcon name="book" size={15} />
          </span>
          <span className="sec-name">文档</span>
          <span className="sec-count">{totalDocs} 篇</span>
          <span className="sec-note">它服务的项目各自的部署文档</span>
        </div>
        {/* 多一层无类的 div（原型那个 `#dcBody`）：`.dc-shelf:first-child { margin-top: 0 }`
            要的是"第一排不顶上间距"，而直接铺在 `.sec` 里时第一排的 `:first-child` 是
            `.sec-head` ⇒ 每排都吃满 18px，书架与段头之间白出一条。 */}
        {detail.shelves.length ? (
          <div>
            {detail.shelves.map((shelf) => (
            <div className="dc-shelf" key={shelf.projectId}>
              <div className="dc-shead">
                <OpsIcon name="project" size={13} />
                {shelf.projectName}
                <span className="n">{shelf.docs.length} 篇</span>
              </div>
              <div className="doc-books">
                {shelf.docs.map((doc) => (
                  <DeployDocBook
                    key={doc.id}
                    doc={doc}
                    onOpen={() => openSource(deploySourceDoc(doc, shelf.projectName))}
                  />
                ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="fp-empty">它服务的项目都还没有部署文档</div>
        )}
      </section>

      {/* ---------------- ③ 文件位置：这台机器上登记的文件都在哪 ----------------
          形态是路线图（线路 + 站点）。两种站、两种主动作：终点站点开文件抽屉看它
          写了什么；分叉站点一下把它下面那一段收起来（`aria-expanded` 跟着换）。 */}
      <section className="sec">
        <div className="sec-head">
          <span className="sec-ico" aria-hidden="true">
            <OpsIcon name="folder" size={15} />
          </span>
          <span className="sec-name">文件位置</span>
          <span className="sec-count">{server.paths.length} 条</span>
          <span className="sec-note">分叉站可收起，每行可复制路径</span>
        </div>
        {railNodes.length ? (
          <div className="route">
            <div className="route-root">
              <span className="route-root-name">/</span>
            </div>
            <ul className="route-list">
              {railNodes.map((node) => (
                <RouteNodeView
                  key={node.name}
                  node={node}
                  parent=""
                  folded={folded}
                  onToggleFold={(full) => setFolded((current) => ({ ...current, [full]: !current[full] }))}
                  onOpenFile={openFile}
                />
              ))}
            </ul>
          </div>
        ) : (
          <div className="fp-empty">这台机器上还没有登记文件位置</div>
        )}
      </section>

      {/* ---------------- 项目抽屉：从「服务项目」那一行拉开 ----------------
          两个抽屉（项目 / 文件）同时开着时后开的在上面（z-index 205 < 210）——
             这正是"一层层拉开"的直觉；ESC 也逐层退（先文件、后项目）。 */}
      {drawerProject ? (
        <div
          className="pd-mask open"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpenProject(null)
          }}
        >
          <div className="pd-panel" role="dialog" aria-modal="true" aria-label={drawerProject.projectName}>
            <div className="pd-head">
              <span className="pd-ico" aria-hidden="true">
                <OpsIcon name="project" size={16} />
              </span>
              <div className="pd-titles">
                <div className="pd-title">{drawerProject.projectName}</div>
                <div className="pd-sub">本机文件位置 {server.paths.length} 条</div>
              </div>
              <button type="button" className="modal-close" onClick={() => setOpenProject(null)} aria-label="关闭">
                <OpsIcon name="x" size={15} />
              </button>
            </div>
            <div className="pd-body" id="pdBody">
              {server.paths.length ? (
                server.pathGroups
                  .map((group) => ({ group, rows: server.paths.filter((item) => item.group === group) }))
                  .filter((entry) => entry.rows.length > 0)
                  .map((entry) => (
                    <div className="fp-sub" key={entry.group}>
                      <div className="fp-sub-head">
                        {entry.group}
                        <span className="n">{entry.rows.length} 条</span>
                      </div>
                      {entry.rows.map((item) => (
                        <div
                          key={item.path}
                          className="fp-row"
                          role="button"
                          tabIndex={0}
                          title={item.path}
                          onClick={() => openFile(item)}
                          onKeyDown={(event) => {
                            if (event.key !== 'Enter' && event.key !== ' ') return
                            event.preventDefault()
                            openFile(item)
                          }}
                        >
                          <span className="fp-ico" aria-hidden="true">
                            <OpsIcon
                              name={
                                fileKindOf(item.path) === 'dir'
                                  ? 'folder'
                                  : fileKindOf(item.path) === 'binary'
                                    ? 'rocket'
                                    : 'file'
                              }
                              size={14}
                            />
                          </span>
                          <span className="fp-use">{item.use}</span>
                          <span className="fp-path">{item.path}</span>
                          <span className="fp-note">{item.note}</span>
                        </div>
                      ))}
                    </div>
                  ))
              ) : (
                <div className="fp-empty">这台机器上还没有登记属于它的文件位置</div>
              )}
            </div>
            <div className="pd-foot">
              <span className="pd-hint">改这些文件、看日志与发版都在运维页</span>
              <Link className="btn btn-primary btn-sm" to={opsTo(drawerProject.projectId)}>
                去运维页
                <span className="sv-ext" aria-hidden="true">
                  <OpsIcon name="chevR" size={12} />
                </span>
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------- 文件抽屉：从路线图的终点站 / 抽屉里的清单点一行打开 ---------------- */}
      {file ? (
        <div
          className="fd-mask open"
          onClick={(event) => {
            if (event.target === event.currentTarget) setFile(null)
          }}
        >
          <div className="fd-panel" role="dialog" aria-modal="true" aria-label={file.title}>
            <div className="fd-head">
              <span className="path-ico" aria-hidden="true">
                <OpsIcon name={file.kind === 'dir' ? 'folder' : file.kind === 'binary' ? 'rocket' : 'file'} size={15} />
              </span>
              <div className="fd-titles">
                <div className="fd-title">
                  {file.title}
                  <span className="fd-kind">{KIND_TXT[file.kind]}</span>
                </div>
                <div className="fd-path">{file.path}</div>
              </div>
              <button type="button" className="modal-close" onClick={() => setFile(null)} aria-label="关闭">
                <OpsIcon name="x" size={15} />
              </button>
            </div>
            <div className="fd-body">
              <textarea
                ref={codeRef}
                className="fd-code"
                spellCheck={false}
                wrap="off"
                aria-label="文件内容"
                readOnly={file.kind !== 'file'}
                value={file.body}
                onChange={(event) => setFile({ ...file, body: event.target.value })}
              />
              <div className={cn('fd-meta', file.kind === 'file' && file.body !== file.saved && 'dirty')}>
                {file.kind === 'file' && file.body !== file.saved
                  ? '● 有未保存的修改 · 保存只在本原型里生效'
                  : file.kind === 'file'
                    ? '可直接编辑'
                    : '只读预览'}
              </div>
            </div>
            <div className="fd-foot">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => copy(file.path)}>
                <OpsIcon name="copy" size={13} /> 复制路径
              </button>
              <span className="spacer" />
              {file.kind === 'file' ? (
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setFile({ ...file, saved: file.body })
                    toast(`已保存 ${file.path}`)
                  }}
                >
                  保存
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------- 二次确认（破坏性动作） ----------------
          外壳用共用的那一个（`PanelModal`）—— 不另写一份，否则会各自长出一套关闭逻辑。 */}
      {confirm ? (
        <PanelModal
          title={confirm.title}
          onCancel={() => setConfirm(null)}
          footer={
            <button
              type="button"
              className="btn btn-danger"
              onClick={() => {
                confirm.onConfirm()
                setConfirm(null)
              }}
            >
              {confirm.confirmText}
            </button>
          }
        >
          <p>{confirm.desc}</p>
          <div className="modal-warn" role="note">
            <strong>影响：</strong>
            <span>{confirm.warn}</span>
          </div>
        </PanelModal>
      ) : null}

      {/* 本页没有"重新检查"按钮：原型那个 `refreshAll()` 只挂在命令面板的
          「重新检查全部机器」那一项上，而命令面板属于应用外壳、不搬
          （Hero 右侧本来也只有终端 / 日志 / 部署 / 编辑 / 移除五颗）。 */}
      {sourceNode}
    </div>
  )
}
