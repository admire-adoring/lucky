import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { cn } from '../../../lib/cn'
import { buildLedgerGroups, buildServerLedger, fileKindOf, lastDeployAcross, type LedgerServer } from '../../../data/derive'
import type { PathSeed } from '../../../data/content-pool'
import { useProjects } from '../../../hooks/use-projects'
import { isConnected, markConnected } from '../../../lib/server-conn'
import { toast } from '../../../stores/toast-store'
import { AddServerForm } from '../project-detail/AddServerForm'
import { OpsIcon } from '../project-detail/ops-icon'
import { PanelModal } from '../project-detail/panel-shell'

/* ============================================================================
   工作 · 服务器台账 —— `/work` 的「服务器」分区
   事实源：`design/work/工作-服务器-index.html`（2026-09-29 版）
   ----------------------------------------------------------------------------
   这是跨项目的机器台账：一个项目最多两三台机器，但一个人手上往往同时有三四个项目
   ⇒ 这一页回答「我手上有哪些机器、各属于谁、现在能不能连上、要动手该去哪一页」。
   与运维分区（管一个项目的机器：部署文件 / 看日志 / 发版 / 回滚 —— 动手页）是一对：
   本页负责"找到它"，运维页负责"进去动手"。所以本页不重复发布记录与部署文档 ——
   那是"进了项目之后"的事；每台机器的浮层里给两条去日志 / 部署的门。

   一页的块（自上而下）：页头（标题 + 视角分段 + 最后更新 + 重新检查 + 新增服务器）
   → 页面级仪表三格 → 筛选栏 → 卡片墙（项目视角 / 服务器视角）→ 两个空态。
   浮层：命令/文件抽屉/二次确认三样，外加「添加服务器」那张整页表单。

   ============================================================================
   有意偏离原型的地方（"静态页 → 应用"必然要改的，不是审美）
   ============================================================================
   ① 导航壳整块不搬：原型自带顶栏胶囊 / 超级菜单 / 圆盘 / 侧栏槽 / 命令面板 ——
      那是它对应用壳的模拟，应用里由 `WorkspaceLayout` + 侧栏 + `CommandPalette` 提供。
      连带两处原型能力不搬（它们属于壳）：圆盘"当前项随滚动同步"、侧栏「最近」点机器。
   ② 筛选与视角切换是"渲染时筛"，不是改已渲染 DOM 的 `hidden`。原型把两个视角的
      标记都留在 DOM 里、靠 `el.hidden` 切（为了"展开着的行不合上、滚动不跳"）。
      React 里 key 稳定，切视角就是换一份渲染，目的相同、写法短一半。
      代价一处：被筛掉的卡片会卸载 ⇒ 它的浮层也一起没了。原型的做法是把
      被筛掉的卡片上的浮层主动合上 —— 这里等价（筛选变化时把浮层也收掉，见 `applyFilter`）。
   ③ `hidden` 属性一个都没用 ⇒ 一律条件渲染（两个空态、外链计数徽标、浮层的两个 pane）。
   ④ 移除服务器只给回执：应用里机器是派生的（`buildServerLedger` 从项目池子现算），
      点一下把那台从界面上抹掉、刷新就回来 —— 那才是真的假成功。与运维页
      （「清理磁盘 / 移除服务器」）同一条纪律：没有接口就别说成功。
      连带：原型删掉一台再「撤销」那一整套（`snap` + 原位放回）也不需要 ——
      不存在"删了但数字还对不上"的漂移，因为没有任何一处数字是另存的。
   ⑤ 新增 / 编辑服务器 = 分区内的整页表单（原型是另一个 `.html`，点「编辑」就离开这一页）。
      应用里那张表是 `AddServerForm`（运维分区在用），这里复用同一个组件、
      以"占满本页"的形态渲染 —— 不另写第二份表单（同一张表两处实现必然分叉），
      也不做弹窗（原型自己写着"字段跨四组，弹窗装不下"）。
      那张表的 `projectName` 只用在预览卡的一行小字上：编辑用这台机器的主项目，
         新增用「所有项目」（本页的新增是页面级动作，不专属于任何项目 —— 原型也是这么写的）。
   ⑥ 外链不带 `?host=`：原型的日志 / 部署链接带它，而应用的 `/logs/:id` 与 `/deploy/:id`
      是项目级的（各自页内有机器选择器 / 由项目派生目标主机），没人读那个参数。
      落点取这台机器服务的第一个项目（一台机器挂多个项目时总得挑一个 —— 与浮层里
      「服务项目」那排的顺序同一个规则：取第一个）。
   ⑦ 仪表第三格「最近发布」跨了项目（原型是一条常量）：取各项目发布记录里
      `DEPLOY_TIMES` 下标最小的那一条，同档里回滚优先 —— 见 `lastDeployAcross` 的注释。
   ⑧ 卡的点击分两处（2026-09-29 用户口径，原型是"整卡展开"）：
      · 卡主体（名字 / 读数 / 空白处）= 进服务器详情页（`/work/servers/:host`）；
      · 卡脚那排（项目胶囊 / 展开箭头）= 拉开浮层。
      判据是"两件事各自最常被要的那一次"：看到一台机器，下一步九成是"进去看它"；
      而浮层回答的是"它属于谁 / 放了些什么"—— 那是扫一眼的动作，挂在卡脚不占主体。
      ⇒ 卡容器是 `role="link"`（不是 `button`：它现在会离开本页），
        卡脚那排项目胶囊因此必须真的是 `<button>`（原来是 `<span>` 排）；
        连带 `.sv-projs` 要把 `button` 自带的边框 / 内边距 / 背景 / 字体一次性抹平（见样式段）。

   ============================================================================
   两条"错了也不会报错"的判据
   ============================================================================
   ① 作用域`.sv-page` 是必须的：`.seg` / `.seg-btn` / `.chip` / `.card-icon` /
      `.empty-state` 这几族在同一个模块里还有别的消费者（工作台、文档索引），
      `[data-module='work']` 挡不住同模块的兄弟页 —— 而样式段在文件里更靠后。
      判据写在 `styles/module-workspace.css` 本段段首。
   ② `.sv-card` 里嵌着真按钮（`.conn` 连接开关、`.sv-projs` 卡脚展开区、
      `.sv-expand` 展开箭头），所以那三处必须 `stopPropagation`，
      否则点开关 / 点项目胶囊会连带把卡主体的"进详情页"也走一遍（见偏离 ⑧）。
      浮层挂在 `.sv-card-wrap` 而不是 `.sv-card` 里 —— 卡片有 `overflow: hidden`，
      挂进去会被圆角一起裁掉（而且看不出错）。
   ============================================================================ */

/** 文件抽屉里那枚类型徽标的文案（原型 `KIND_TXT`） */
const KIND_TXT = { dir: '目录', binary: '二进制', file: '文件' } as const

/** 平铺视角那一格（原型 `ALL_SEC`）：它没有项目可挂，用一条固定的组头描述它 */
const ALL_GROUP_LABEL = '全部服务器'

type Perspective = 'project' | 'server'
type PopTab = 'info' | 'paths'

interface FileState {
  title: string
  path: string
  kind: 'dir' | 'file' | 'binary'
  /** 打开时的内容 —— 判断"有没有未保存的修改"要跟它比 */
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

/** 「添加 / 编辑服务器」= 本页内的一个整页视图（见文件头 ⑤）。null = 看台账 */
type FormState = { mode: 'add' } | { mode: 'edit'; server: LedgerServer } | null

/* ------------------------------------------------------------------ *
 * 小件
 * ------------------------------------------------------------------ */

/** 一台机器的卡片 + 它的浮层。两者是 `.sv-card-wrap` 下的兄弟（见文件头判据 ②）。 */
function ServerCard({
  server,
  open,
  tab,
  onOpenDetail,
  onToggle,
  onTab,
  onConnect,
  onEdit,
  onRemove,
  onOpenFile,
  logTo,
  deployTo,
  terminalTo,
  from,
}: {
  server: LedgerServer
  open: boolean
  tab: PopTab
  /** 卡主体（见文件头偏离 ⑧）：进这台机器的详情页 */
  onOpenDetail: () => void
  /** 卡脚（项目胶囊 / 展开箭头）：拉开浮层 */
  onToggle: () => void
  onTab: (tab: PopTab) => void
  onConnect: () => void
  onEdit: () => void
  onRemove: () => void
  onOpenFile: (item: PathSeed) => void
  logTo: string
  deployTo: string
  terminalTo: string
  from: { from: string }
}) {
  const isProd = server.env === 'prod'
  const connected = isConnected(server.host)
  /* 文件分布那几个分组：顺序照 `pathGroups`（它在池子里就是显示顺序），
     空组不渲染 —— 原型那边每一组都是"这台机器上现成的那些组"，不另造一套归类词。 */
  const pathGroups = server.pathGroups
    .map((group) => ({ group, items: server.paths.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0)

  return (
    <div className="sv-card-wrap">
      <div
        className={cn('sv-card', !isProd && 'is-test')}
        /* `link` 而不是 `button`：卡主体现在离开本页（进详情页，见偏离 ⑧）。
           `aria-expanded` 也随之下线 —— 它描述的是"我这里展开了没"，
           而展开挂到了卡脚那颗 `<button className="sv-projs">` 上。 */
        role="link"
        tabIndex={0}
        title={`打开 ${server.host} 的详情页`}
        aria-label={`打开 ${server.host} 的详情页`}
        onClick={onOpenDetail}
        onKeyDown={(event) => {
          /* 先挡"回车落在卡内那几颗真按钮上"的情况：键盘事件会从 `.conn` /
             `.sv-projs` / `.sv-expand` 冒泡上来，而这里会 `preventDefault()`
             —— 那一下会取消按钮自己的回车/空格激活 ⇒ 键盘用户在连接开关上按回车
             会变成"进详情页"而不是"连上"。
             判据：事件的 target 不是我这张卡本身 ⇒ 交给里面那颗按钮。
             只认 `Enter`：`Space` 是按钮的激活键，链接不接管它（按了就该滚页）。 */
          if (event.target !== event.currentTarget) return
          if (event.key !== 'Enter') return
          event.preventDefault()
          onOpenDetail()
        }}
      >
        {/* 竖脊：灯排 + 螺丝。全是形状、不承载数字 —— 四颗灯说的是"这台设备通着电"
            这一件事（数量不是"4 个什么东西"）。2026-09-29 起它们常亮呼吸、不跟连接状态：
            "连上没连上"由右上角那枚 `.conn` 徽标说，一件事一处表达。 */}
        <div className="sv-spine" aria-hidden="true">
          <span className="sv-led" />
          <span className="sv-led" />
          <span className="sv-led" />
          <span className="sv-led" />
          <span className="sv-screw" />
        </div>
        <div className="sv-body">
          <div className="sv-head">
            <div className="sv-name-row">
              <span className="sv-name">{server.host}</span>
              {/* 角色是形状（一枚 15px 图标）：文字进 title / aria-label，
                  并在浮层「信息」里留一格 —— 卡面上不让它占一行（见样式段）。 */}
              <span className="sv-role" title={server.roleLabel} aria-label={server.roleLabel}>
                <OpsIcon name={server.role === 'db' ? 'database' : 'server'} size={15} />
              </span>
              <span className={cn('sv-tag', !isProd && 'is-test')}>{server.envLabel}</span>
            </div>
            <button
              type="button"
              className={cn('conn', connected && 'on')}
              aria-pressed={connected}
              title={`${connected ? '断开' : '连接'} ${server.host}`}
              onClick={(event) => {
                event.stopPropagation()
                onConnect()
              }}
            >
              {connected ? '已连接' : '未连接'}
            </button>
          </div>

          {/* 读数两行：地址有底（它是最常被复制的那一条）、系统无底。
              分层靠"有底 / 无底 + 字重"，不靠颜色 —— 颜色已经给了环境与连接状态两件事。
              不放端口：卡面上端口属于"动手前不必看见"的那一类，它在浮层「信息」里。 */}
          <div className="sv-reads">
            <div className="sv-read">
              <span className="k">地址</span>
              <span className="v" title={server.ip}>
                {server.ip}
              </span>
            </div>
            <div className="sv-read">
              <span className="k">系统</span>
              <span className="v is-plain" title={server.os}>
                {server.os}
              </span>
            </div>
          </div>

          {/* 卡脚：这台服务器上的全部项目 + 展开入口。整条是展开区（见偏离 ⑧）。
             项目在卡脚、不在副标题：一台机器能服务多个项目（一个 nginx 挂两个站点、
                 一个 PG 实例两个库、测试机被两个项目共用）—— 副标题只有一个位置，
                 写进去必然"只显示了一个"，读者会以为这台机器只归那一个。
             这排胶囊是一个 `<button>`（不是"每颗胶囊一个按钮"）：浮层展示的是
                 这台机器的信息与文件分布，按项目再分一层没有对应的数据
                 （文件位置在池子里按域存，不按项目）—— 分开做会让每颗胶囊都指向同一份内容。 */}
          <div className="sv-foot">
            <button
              type="button"
              className="sv-projs"
              aria-expanded={open}
              title={`展开 ${server.host} 的项目与文件分布`}
              onClick={(event) => {
                event.stopPropagation()
                onToggle()
              }}
            >
              {server.projects.map((project) => (
                <span className="sv-proj" key={project.id}>
                  {project.name}
                </span>
              ))}
            </button>
            <button
              type="button"
              className={cn('sv-expand', open && 'is-open')}
              aria-expanded={open}
              title={`展开 ${server.host} 的详情`}
              aria-label={`展开 ${server.host} 的详情`}
              onClick={(event) => {
                event.stopPropagation()
                onToggle()
              }}
            >
              <OpsIcon name="chevD" size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* 浮层。分区条里混着两种东西，别一律当 tab：
          · 真分区（信息 / 文件分布）⇒ 切 pane，只改类；
          · 外链（日志 / 部署）⇒ 点了离开本页，所以它们没有 pane（`role="tab"` 也不加）。 */}
      <div className={cn('sv-pop', open && 'is-open')} role="dialog" aria-label={`${server.host} 的详情`}>
        <div className="sv-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'info'}
            className={cn('sv-tab', tab === 'info' && 'is-active')}
            onClick={() => onTab('info')}
          >
            <OpsIcon name="info" size={13} />
            信息
          </button>
          {[
            { key: 'logs', label: '日志', icon: 'file' as const, to: logTo, n: server.logCount },
            { key: 'deploys', label: '部署', icon: 'rocket' as const, to: deployTo, n: server.deployCount },
          ].map((item) => (
            <Link
              key={item.key}
              className="sv-tab is-ext"
              to={item.to}
              state={from}
              title={`在新窗口打开「${item.label}」`}
              onClick={(event) => event.stopPropagation()}
            >
              <OpsIcon name={item.icon} size={13} />
              {item.label}
              {item.n > 0 ? <span className="sv-tab-n">{item.n}</span> : null}
              <span className="sv-ext" aria-hidden="true">
                <OpsIcon name="external" size={11} />
              </span>
            </Link>
          ))}
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'paths'}
            className={cn('sv-tab', tab === 'paths' && 'is-active')}
            onClick={() => onTab('paths')}
          >
            <OpsIcon name="folder" size={13} />
            文件分布
            <span className="sv-tab-n">{server.paths.length}</span>
          </button>
        </div>

        <div className={cn('sv-pane', tab === 'info' && 'is-active')}>
          {/* 「服务项目」放第一位：开一台机器的详情，最该先知道的是"动它会波及哪些项目" */}
          <div className="sv-field is-wide">
            <span className="k">服务项目</span>
            <span className="sv-projs">
              {server.projects.map((project) => (
                <span className="sv-proj" key={project.id}>
                  {project.name}
                </span>
              ))}
            </span>
          </div>
          <div className="sv-fields">
            <div className="sv-field">
              <span className="k">IP 地址</span>
              <span className="v">{server.ip}</span>
            </div>
            <div className="sv-field">
              <span className="k">操作系统</span>
              <span className="v">{server.os}</span>
            </div>
            {/* 角色与环境在这里给文字（卡面上角色只剩一枚图标，文字得有第二个家） */}
            <div className="sv-field">
              <span className="k">角色</span>
              <span className="v">{server.roleLabel}</span>
            </div>
            <div className="sv-field">
              <span className="k">环境</span>
              <span className="v">{server.envLabel}</span>
            </div>
          </div>
          <div className="sv-field is-wide">
            <span className="k">应用端口</span>
            <span className="sv-ports">
              {server.ports.map((port) => (
                <span className="sv-port" key={port.port}>
                  {port.port}
                  <span className="svc">{port.svc}</span>
                </span>
              ))}
            </span>
          </div>
          <div className="sv-sep" />
          <button
            type="button"
            className="sv-copy"
            onClick={() => {
              navigator.clipboard?.writeText(server.ip).catch(() => {})
              toast(`已复制 ${server.ip}`)
            }}
          >
            <OpsIcon name="copy" size={13} />
            复制 IP
          </button>
        </div>

        <div className={cn('sv-pane', tab === 'paths' && 'is-active')}>
          <div className="sv-pop-list">
            {pathGroups.map((entry) => (
              <div key={entry.group}>
                <div className="sv-pop-group">{entry.group}</div>
                <div className="sv-pop-tags">
                  {entry.items.map((item) => (
                    <button
                      key={item.path}
                      type="button"
                      className="sv-pop-tag"
                      title={item.path}
                      onClick={() => onOpenFile(item)}
                    >
                      {item.use}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 四个动作放在浮层底部：卡面要保持那个干净形态（见样式段段首）。
            「详情」排在最前、而且是 `<a>` 形态（原型 2026-09-29 14:46 补的）：
               它是本页的一个出口（浮层只给一眼，全量在那一页），而
               `<Link>` 让新窗口 / 中键 / 键盘都天然可用 —— 与另外三个「按钮」不同。 */}
        <div className="sv-pop-acts">
          <span className="sv-acts">
            <Link
              className="server-action-btn"
              to={`/work/servers/${encodeURIComponent(server.host)}`}
              title={`打开 ${server.host} 的详情页`}
              aria-label={`打开 ${server.host} 的详情页`}
              onClick={(event) => event.stopPropagation()}
            >
              <OpsIcon name="info" size={15} />
            </Link>
            <Link
              className="server-action-btn"
              to={terminalTo}
              state={from}
              title="打开终端窗口"
              aria-label={`打开 ${server.host} 的终端`}
              onClick={(event) => event.stopPropagation()}
            >
              <OpsIcon name="window" size={15} />
            </Link>
            <button
              type="button"
              className="server-action-btn"
              title="编辑服务器"
              aria-label={`编辑 ${server.host}`}
              onClick={(event) => {
                event.stopPropagation()
                onEdit()
              }}
            >
              <OpsIcon name="edit" size={15} />
            </button>
            <button
              type="button"
              className="server-action-btn danger"
              title="移除服务器"
              aria-label={`移除 ${server.host}`}
              onClick={(event) => {
                event.stopPropagation()
                onRemove()
              }}
            >
              <OpsIcon name="trash" size={15} />
            </button>
          </span>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 页面
 * ------------------------------------------------------------------ */

export function ServersLedger() {
  const { data, isLoading } = useProjects()
  /** 本页只服务工作域 —— 机器池只有 work 域有内容（life / learn 是空数组） */
  const projects = useMemo(() => (data ?? []).filter((project) => project.scope === 'work'), [data])
  const ledger = useMemo(() => buildServerLedger(projects), [projects])
  const groups = useMemo(() => buildLedgerGroups(projects, ledger), [projects, ledger])

  /* 台账是就地读池子那份数组的（`paths` 按引用交出去），要一个计数器把重渲叫起来 */
  const [, forceRender] = useReducer((n: number) => n + 1, 0)

  const [perspective, setPerspective] = useState<Perspective>('project')
  /** 两个正交维度：筛的永远是另一个维度（见下面筛选栏那两条判据） */
  const [filterProject, setFilterProject] = useState('all')
  const [filterServer, setFilterServer] = useState('all')
  /** 一次只开一层浮层（原型先全关、再开要开的那一个） */
  const [openHost, setOpenHost] = useState<string | null>(null)
  const [popTabs, setPopTabs] = useState<Record<string, PopTab>>({})
  const [file, setFile] = useState<FileState | null>(null)
  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null)
  const [form, setForm] = useState<FormState>(null)
  const [refreshing, setRefreshing] = useState(false)
  /** 重播卡片墙的进场动画 = "这一屏重读过了"（换视角时也会播，同一个 keyframes） */
  const [wallKey, setWallKey] = useState(0)
  const [lastSync, setLastSync] = useState(() => {
    const now = new Date()
    return `最后更新 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  })

  const location = useLocation()
  const navigate = useNavigate()
  const codeRef = useRef<HTMLTextAreaElement>(null)

  /**
   * Escape 的优先级：文件抽屉 → 二次确认 → 整页表单 → 卡片浮层。
   * 抽屉排第一是因为它盖在最上面（`z-index: 210`）；表单排在浮层之前是"整页视图比浮层大"。
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (file) {
        setFile(null)
        return
      }
      if (confirm) {
        setConfirm(null)
        return
      }
      if (form) {
        setForm(null)
        return
      }
      if (openHost) setOpenHost(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [file, confirm, form, openHost])

  /* 焦点：可编辑的文件落进正文（只读预览不抢焦点） */
  useEffect(() => {
    if (file?.kind === 'file') codeRef.current?.focus()
  }, [file?.path, file?.kind])

  /* ---------------- 筛选 ---------------- */

  const hit = (server: LedgerServer) =>
    (filterProject === 'all' || server.projects.some((project) => project.id === filterProject)) &&
    (filterServer === 'all' || filterServer === server.host)

  const total = ledger.length
  const shown = ledger.filter(hit).length
  const filtering = filterProject !== 'all' || filterServer !== 'all'

  /**
   * 筛选一变就把浮层收掉。
   * 原型是在已渲染的 DOM 上把被筛掉那几张卡的浮层合上（`el.hidden = true` 之前先
   *    `classList.remove('open')`）；这里卡片会直接卸载 ⇒ 不收的话，清空筛选之后
   *    那层浮层会凭空回来（状态还在），比原型的"合上"多一次意外的复现。
   */
  const prunePop = () => setOpenHost(null)

  const pickProject = (key: string) => {
    setFilterProject(key)
    /* 换了项目 ⇒ 已选的那台机器可能不在这个项目里了，退回"全部"（不留一个筛不出东西的死组合）。
       判据走 `projects.some(...)`：共享机器在两个项目里都算"在"。 */
    if (filterServer !== 'all') {
      const target = ledger.find((server) => server.host === filterServer)
      if (!target || (key !== 'all' && !target.projects.some((project) => project.id === key))) {
        setFilterServer('all')
      }
    }
    prunePop()
  }

  const pickServer = (host: string) => {
    setFilterServer(host)
    prunePop()
  }

  const resetFilter = () => {
    setFilterProject('all')
    setFilterServer('all')
    prunePop()
  }

  const setPerspectiveAndReset = (next: Perspective) => {
    if (next === perspective) return
    setPerspective(next)
    /* 切视角 ⇒ 另一个维度的筛选归零：它已经不在筛选栏上了，留着就是看不见的筛选 */
    if (next === 'project') setFilterProject('all')
    else setFilterServer('all')
    /* 浮层与视角无关（同一台机器、同一份状态），但原型的定位落点在项目视角 ⇒ 一并收掉最省事 */
    prunePop()
  }

  /* ---------------- 渲染用的几份派生 ---------------- */

  /** 项目视角：每个项目一组，组内只留命中的机器；空组整块消失（徽标回答"这一组里有多少"） */
  const projectRows = groups
    .map((group) => ({ key: group.key, label: group.label, servers: group.servers.filter(hit) }))
    .filter((group) => group.servers.length > 0)
  /** 平铺视角：只有一组，管全部 */
  const flatRow = { key: 'all', label: ALL_GROUP_LABEL, servers: ledger.filter(hit) }

  const projectChips = [{ key: 'all', label: '全部' }, ...groups.map((group) => ({ key: group.key, label: group.label }))]
  /* 「服务器」那一排只列当前项目下的机器：否则会出现"选了 A 项目的机器 + B 项目"
     这种筛不出任何东西的组合 —— 两个互相打架的控件不叫筛选。
     "当前项目下的机器"含共享机器（它确实服务这个项目）。 */
  const serverChips = [
    { key: 'all', label: '全部' },
    ...(filterProject === 'all'
      ? ledger
      : ledger.filter((server) => server.projects.some((project) => project.id === filterProject))
    ).map((server) => ({ key: server.host, label: server.host })),
  ]

  /* ---------------- 页面级仪表（三格） ---------------- */

  const offHosts = ledger.filter((server) => !isConnected(server.host)).map((server) => server.host)
  const connSub = !total
    ? '还没有机器'
    : !offHosts.length
      ? '全部已连接'
      : offHosts.length === total
        ? '发版前先连上目标机器'
        : `${offHosts.join('、')} 未连接`
  const prodCount = ledger.filter((server) => server.env === 'prod').length
  const testCount = total - prodCount
  const prodSub = !total
    ? '还没有机器'
    : testCount
      ? `涉及线上数据 · 另有 ${testCount} 台测试环境`
      : '全部是生产环境，动手前确认机器名'
  const lastDeploy = useMemo(() => lastDeployAcross(projects), [projects])

  /* ---------------- 动作 ---------------- */

  /* 重渲是必须的：连接状态存在模块级集合里，改完不会自己通知 React。
     与运维分区同一处置（那边也持一个 `forceRender`）。 */
  const toggleConn = (host: string) => {
    const on = !isConnected(host)
    markConnected(host, on)
    forceRender()
    toast(on ? `已连接 ${host}` : `已断开 ${host}`)
  }

  const refresh = () => {
    if (refreshing) return
    setRefreshing(true)
    setLastSync('正在同步…')
    /* 重播进场动画 = "这一屏重读过了"的反馈 —— 换 `key` 让那两格网格重挂载 */
    setWallKey((n) => n + 1)
    window.setTimeout(() => {
      const now = new Date()
      setLastSync(`最后更新 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
      setRefreshing(false)
      toast('数据已刷新')
    }, 900)
  }

  const openFile = (item: PathSeed) => {
    const kind = fileKindOf(item.path)
    const body = item.preview ?? '（这个文件在本原型里没有示例内容）'
    setFile({ title: item.use, path: item.path, kind, saved: body, body })
  }

  const askRemove = (server: LedgerServer) => {
    setConfirm({
      title: `移除 ${server.host}？`,
      desc: '移除后，这台机器不再出现在这份台账里，也不再从它采集日志。',
      warn: '服务器本身不会被停用，上面的应用与数据都不受影响，日后重新添加即可接回。',
      confirmText: '移除服务器',
      onConfirm: () => toast(`${server.host}：还没有写移除接口`),
    })
  }

  /* `from` 是那三条跳转（日志 / 部署 / 终端）返回时的落点。
     必须带：本页挂在工作模块下，硬编一个返回目标会把从别处进来的人扔到别的地方。 */
  const from = { from: location.pathname }

  /* ---------------- 「添加 / 编辑服务器」：占满本页的整页表单（见文件头 ⑤） ---------------- */

  if (form) {
    const target = form.mode === 'edit' ? form.server : null
    return (
      <div className="sv-page">
        <AddServerForm
          mode={form.mode}
          projectName={target ? (target.projects[0]?.name ?? '') : '所有项目'}
          server={target ? { name: target.host, ip: target.ip, cores: target.cores, memGb: target.memGb, os: target.os } : null}
          siblings={ledger
            .filter((server) => server.host !== target?.host)
            .map((server) => ({ name: server.host, ip: server.ip }))}
          onCancel={() => setForm(null)}
        />
      </div>
    )
  }

  return (
    <div className="sv-page">
      {/* ---------------- 页头 ----------------
          本页横跨所有项目 ⇒ 没有单一实体可以挂那块可折叠 Hero。标题回答"这是什么"，
          副标题只回答"这一页管什么"（不写计数 —— 那些数字在仪表条与卡片徽标里各有其位）。 */}
      <header className="page-head">
        <div>
          <h1 className="ph-title">服务器</h1>
          <p className="ph-sub">所有项目下的机器、连接状态与文件位置 —— 动手前先确认连的是哪一台。</p>
        </div>
        <div className="ph-actions">
          {/* 视角：看谁的清单。「项目」= 按项目分组；「服务器」= 不分项目、全部机器平铺。
              2026-09-29 用户口径「只保留卡片风格展示」⇒ 右侧那个"视图"分段
                 （列表 / 表格 / 卡片）整个删了，条目形态只有卡片一种。 */}
          <div className="seg" role="group" aria-label="切换视角">
            <button
              type="button"
              className={cn('seg-btn', perspective === 'project' && 'active')}
              aria-pressed={perspective === 'project'}
              onClick={() => setPerspectiveAndReset('project')}
            >
              项目
            </button>
            <button
              type="button"
              className={cn('seg-btn', perspective === 'server' && 'active')}
              aria-pressed={perspective === 'server'}
              onClick={() => setPerspectiveAndReset('server')}
            >
              服务器
            </button>
          </div>
          <span className="last-sync">{lastSync}</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={refresh}>
            <OpsIcon name="refresh" size={14} /> 重新检查
          </button>
          {/* 新增服务器：页面级动作（本页横跨所有项目，它不专属于任何一张卡）。
              只此一处 —— 组头不再放"往这个项目加"（同一动作两个入口是本仓不允许的），
                  而服务器视角压根没有组头 ⇒ 它只能落在页头：两种视角下都得看得见。 */}
          <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ mode: 'add' })}>
            <OpsIcon name="plus" size={14} /> 新增服务器
          </button>
        </div>
      </header>

      {/* 读数据期间不要进正文：`ledger` 是从项目现算的，`data` 还没到时它是空数组 ——
          照渲染会让仪表显示「0 / 0 台」、还会把"还没有登记任何服务器"那条空态闪一下
          （数据一到又自己消失）。与工作台同一处置：加载态单独一格，不进真实布局。 */}
      {isLoading ? (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">
            <OpsIcon name="server" size={22} />
          </div>
          <div className="empty-title">正在读取机器台账…</div>
          <div className="empty-desc">机器由各项目的内容池现算，读完才知道一共有几台</div>
        </div>
      ) : (
      <>
      {/* ---------------- 页面级仪表 ----------------
          三格各自回答一件"动手前要确认的事"：能不能动手 / 别连错机器 / 有没有正在烧的火。
          不含「机器总数」：那个数字已经在每张卡所在那一组的组头徽标里 ——
          徽标回答"这一组里有多少"，仪表回答"我下一步要动手前得知道什么"。 */}
      <div className="kpi-bar">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              <OpsIcon name="plug" size={15} />
            </span>
            <span className="kpi-label">已连接</span>
          </div>
          <div className="kpi-val">
            {total - offHosts.length}
            <span className="kpi-unit">/ {total} 台</span>
          </div>
          <div className="kpi-sub">{connSub}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              <OpsIcon name="shield" size={15} />
            </span>
            <span className="kpi-label">生产环境</span>
          </div>
          <div className="kpi-val">
            {prodCount}
            <span className="kpi-unit">台</span>
          </div>
          <div className="kpi-sub">{prodSub}</div>
        </div>
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              <OpsIcon name="rocket" size={15} />
            </span>
            <span className="kpi-label">最近发布</span>
          </div>
          <div className={cn('kpi-val', lastDeploy?.result === 'success' && 'ok')}>
            {lastDeploy ? (lastDeploy.result === 'success' ? '成功' : '回滚') : '—'}
          </div>
          <div className="kpi-sub">
            {lastDeploy
              ? `${lastDeploy.version} · ${lastDeploy.projectName} · ${lastDeploy.when}`
              : '还没有发布记录'}
          </div>
        </div>
      </div>

      {/* ---------------- 筛选：只给"另一个维度" ----------------
          筛的永远是另一个维度：按项目分组时分组已经在做"分项目"这件事 ⇒ 只给「服务器」；
          平铺时没有分组可依、需要一条收窄到某个项目的路 ⇒ 只给「项目」。
          切视角时另一个维度归零（见 `setPerspectiveAndReset`）。 */}
      <div className="filter-bar">
        {/* 初始视角是「项目」（已分组）⇒ 屏上只该有「服务器」那一排。
            两排都只渲染当前该看见的那一排 —— 条件渲染，不用 `hidden`。 */}
        {perspective === 'server' ? (
          <div className="filter-row">
            <span className="filter-label">项目</span>
            <div className="chip-group" role="group" aria-label="按项目筛选">
              {projectChips.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={cn('chip', filterProject === item.key && 'active')}
                  aria-pressed={filterProject === item.key}
                  onClick={() => pickProject(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="filter-row is-server">
            <span className="filter-label">服务器</span>
            <div className="chip-group" role="group" aria-label="按服务器筛选">
              {serverChips.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className={cn('chip', filterServer === item.key && 'active')}
                  aria-pressed={filterServer === item.key}
                  onClick={() => pickServer(item.key)}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="filter-foot">
          {/* 分母是唯一机器数，不是"各组之和" —— 共享机器在分组里会被数两次，
              用它当分母会算出"筛出 4/9 台机器"这种假数。 */}
          <span>{filtering ? `筛出 ${shown} / ${total} 台机器` : '显示全部机器'}</span>
          {filtering ? (
            <button type="button" className="filter-reset" onClick={resetFilter}>
              清空筛选
            </button>
          ) : null}
        </div>
      </div>

      {/* ---------------- 卡片墙 = 视角 × 卡片 ----------------
          同一份机器数据，两种"看谁的清单"。两份标记不都留在 DOM 里：React 里
          切视角就是换一份渲染（见文件头 ②）。`key={wallKey}` 让「重新检查」能重播进场动画。 */}
      {perspective === 'project' ? (
        <div key={`project-${wallKey}`}>
          {projectRows.map((group) => (
            <section className="sv-group" key={group.key}>
              <div className="sv-group-head">
                <span className="card-icon" aria-hidden="true">
                  <OpsIcon name="project" size={15} />
                </span>
                {group.label}
                <span className="count">{group.servers.length} 台</span>
              </div>
              <div className="sv-grid">
                {group.servers.map((server) => (
                  <ServerCard
                    key={server.host}
                    server={server}
                    open={openHost === server.host}
                    tab={popTabs[server.host] ?? 'info'}
                    onOpenDetail={() => navigate(`/work/servers/${encodeURIComponent(server.host)}`)}
                    onToggle={() => setOpenHost((current) => (current === server.host ? null : server.host))}
                    onTab={(tab) => setPopTabs((current) => ({ ...current, [server.host]: tab }))}
                    onConnect={() => toggleConn(server.host)}
                    onEdit={() => setForm({ mode: 'edit', server })}
                    onRemove={() => askRemove(server)}
                    onOpenFile={openFile}
                    logTo={`/logs/${server.projects[0]?.id ?? ''}`}
                    deployTo={`/deploy/${server.projects[0]?.id ?? ''}`}
                    terminalTo={`/terminal/${server.projects[0]?.id ?? ''}?host=${encodeURIComponent(server.host)}`}
                    from={from}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : flatRow.servers.length > 0 ? (
        /* 平铺：没有组头，所以卡脚那排项目胶囊就是"这台属于哪些项目"的唯一出处。
           容器只做一个网格，不带白底/描边 —— 卡片自己是白的，套一层白底会把卡的边界吃掉。 */
        <section className="sv-group" key={`server-${wallKey}`}>
          <div className="sv-grid">
            {flatRow.servers.map((server) => (
              <ServerCard
                key={server.host}
                server={server}
                open={openHost === server.host}
                tab={popTabs[server.host] ?? 'info'}
                onOpenDetail={() => navigate(`/work/servers/${encodeURIComponent(server.host)}`)}
                onToggle={() => setOpenHost((current) => (current === server.host ? null : server.host))}
                onTab={(tab) => setPopTabs((current) => ({ ...current, [server.host]: tab }))}
                onConnect={() => toggleConn(server.host)}
                onEdit={() => setForm({ mode: 'edit', server })}
                onRemove={() => askRemove(server)}
                onOpenFile={openFile}
                logTo={`/logs/${server.projects[0]?.id ?? ''}`}
                deployTo={`/deploy/${server.projects[0]?.id ?? ''}`}
                terminalTo={`/terminal/${server.projects[0]?.id ?? ''}?host=${encodeURIComponent(server.host)}`}
                from={from}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* ---------------- 两种"空"必须分开 ----------------
          · 筛掉了（池子里有机器、但一台都没命中）⇒ 退路是"清空筛选"；
          · 池子本来就是空的 ⇒ 退路是"新增服务器"。
          混成一条时，"一台都没有"会显示"没有匹配的机器 + 清空筛选"，
          而那会儿筛选栏本来就是"全部" —— 那个按钮按了什么也不会发生。 */}
      {total > 0 && shown === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">
            <OpsIcon name="server" size={22} />
          </div>
          <div className="empty-title">没有匹配的机器</div>
          <div className="empty-desc">换个项目或机器看看 —— 也可以清空筛选</div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilter}>
            清空筛选
          </button>
        </div>
      ) : null}
      {total === 0 ? (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">
            <OpsIcon name="server" size={22} />
          </div>
          <div className="empty-title">还没有登记任何服务器</div>
          <div className="empty-desc">登记第一台之后，它所在的项目会自动出现在左侧圆盘上</div>
          <button type="button" className="btn btn-primary" onClick={() => setForm({ mode: 'add' })}>
            <OpsIcon name="plus" size={14} /> 新增服务器
          </button>
        </div>
      ) : null}
      </>
      )}

      {/* ---------------- 文件抽屉 ----------------
          点「文件分布」里一枚胶囊打开它。独立窗口留给日志 / 部署那种"要一直盯着的流"，
          看一眼文件不必开窗口 —— 抽屉也不打断"我在看这台机器"的上下文。 */}
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
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  navigator.clipboard?.writeText(file.path).catch(() => {})
                  toast(`已复制 ${file.path}`)
                }}
              >
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
          外壳用共用的那一个（`PanelModal`，运维 / 账户两个分区也在用）—— 不另写一份，
          否则会各自长出一套关闭逻辑与 Escape 优先级。 */}
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
    </div>
  )
}
