import { Fragment, useEffect, useReducer, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  buildFsTree,
  fileKindOf,
  fsDirFor,
  fsNodeAt,
  pathNote,
  type DeployDocItem,
  type DeployItem,
  type FsNode,
  type ServerItem,
} from '../../../data/derive'
import type { PathSeed } from '../../../data/content-pool'
import { cn } from '../../../lib/cn'
/* 连接状态全站一份（运维分区与服务器台账共用），见那个模块的文件头 */
import { isConnected, markConnected } from '../../../lib/server-conn'
import { AddServerForm } from './AddServerForm'
import { OpsIcon, type OpsIconName } from './ops-icon'
import { PanelCard as OpsCard, PanelModal as OpsModal } from './panel-shell'
import { DeployDocBook } from './DeployDocBook'
import { deploySourceDoc } from './doc-source/source-doc'
import { useSourceOverlay } from './doc-source/use-source-overlay'

/* ============================================================================
   运维 —— 项目详情「运维」分区
   （原型 `design/work/工作-项目-项目详情-运维-index.html`，2026-09-25 落地 / 2026-09-27 重同步）
   ----------------------------------------------------------------------------
   这一版替掉的是 09-25 那版。原型当天改了三轮，三次都落在这一页的内容上：

     (一) 图标收敛成一套：原来一页里有三种（emoji、16 网格内联 SVG、24 网格内联 SVG），
          现在全走 `ops-icon.tsx` 那张 24 网格表；顺手修掉四处版面缺陷
          （sticky 条涂错底色 / 页名与数字同档 / 空态图标太小 / 连接开关没有 `.on` 态样式）。
     (二) 顶部那条从"复述徽标"改成"页面级仪表"：三格各自回答一件动手前要确认的事
          —— 当前版本 / 最近发布成没成 / 已连接几台。原来四格里三格的数字都能在卡片徽标里找到
          （同一件事两处表达）。连带撤掉「+ 记录」入口与发布记录的筛选行。
     (三) 告警整组撤掉：这一页管的是"部署文件 / 查看日志"，磁盘用率不是它要回答的问题。

   ============================================================================
   与原型有意不同的地方（"静态页 → 应用"必然要改的，不是审美）
   ============================================================================
   ① `.ops-page` 这一层包装是必须的。概览卡片与运维分区共用 `.server-row` /
      `.deploy-row` / `.doc-book` 这批类名，而两边版式完全不同（概览那张是 300px 宽的小卡）。
      于是把从原型搬来的规则统一挂在 `.ops-page` 下：特异性高一级 ⇒ 只在这一分区生效。
   ② "最后检查 / 重新检查"这一行搬进分区内部。原型把它放在页头（`.hero-sync`），
      而这一页的页头是可折叠 Hero（另一个原型定的、两处共用）—— 往别人的头里塞一行状态，
      两处的头会越来越像两套。
   ③ 「日志」与「部署」是动作，不是面板（原型就是两个整窗页面）：应用里对应
      `/logs/:id`、`/deploy/:id`，所以渲染成 `<Link class="sd-tab ext">` + `↗` —— 一眼看出
      "点它会离开这一页"。因此它们不进 `ServerTab` 联合类型。
   ④ 破坏性操作（清理磁盘 / 移除服务器）仍然"确认之后只给回执"：没有清理接口、
      没有移除接口。原型这两个动作是真的改 DOM（移除还配了撤销），而应用里服务器来自
      数据派生 —— 点一下只把那台从界面上抹掉，刷新就回来，那才是真的假成功。
      连带："台数"这类会变的值在本页是派生出来的（`servers.length`），不存在
      原型（二）里"删掉一台、徽标还说两台"那类漂移。
   ⑤ 文件位置清单是可增删改的（原型最重的一块）。应用的落点：
      · 清单本身 = 池子里那份 `paths` 数组（就地改，与 `api/projects.ts` 改种子同一条纪律）；
      · 路径浏览器那棵树由清单自己长出来（`buildFsTree`）+ 那些"还没登记的同级项"，
        不手写第二棵树 —— 手写必然走岔：清单里换了路径，树里还留着旧的；
      · 归类给选不给填：选项就是这台机器上现成的组（自由输入会立刻长出
        「配置 / 配置文件 / conf」三个组，而分组的全部价值是"同一类东西只有一个去处"）。
   ⑥ `hidden` 属性一个都没用 ⇒ 一律条件渲染。
   ⑦ 连接状态是"机器"的状态，不是某个窗口的：原型把它写进 `localStorage`，
      好让终端窗口用 `storage` 事件同步回这一页。应用里终端页的连接是它自己的页面状态，
      没有可共享的通道 ⇒ 退成模块级集合：切分区再回来还在，刷新回到「未连接」。
      为它引一条跨页协议（storage 事件 + 键名约定）代价大于收益，留到有后端那一轮。
   ============================================================================ */

/** 卡片折叠状态。三个 key 与原型的三张卡一一对应 */
type CardKey = 'server' | 'doc' | 'deploy'

/** 服务器详情里的分区。`log` / `deploy` 不在其中 —— 它们是动作，不是面板（见文件头 ③） */
type ServerTab = 'info' | 'disk'

/**
 * 详情里的那一排按钮。`log` 夹在「信息」之后、`deploy` 在「文件分布」之前（原型的顺序）。
 * 用 `jump` 这个标记而不是 `key === 'log' || key === 'deploy'` 判断：
 *    后者在 `else` 分支里 TS 收不窄 `key`（会报 `'log' | 'deploy' | ServerTab` 不能赋给 `ServerTab`），
 *    `in` 收窄对判别联合是可靠的。
 */
type ServerTabEntry =
  | { key: ServerTab; label: string; icon: OpsIconName }
  | { key: 'log' | 'deploy'; label: string; icon: OpsIconName; jump: true }

const SERVER_TABS: ServerTabEntry[] = [
  { key: 'info', label: '信息', icon: 'info' },
  { key: 'log', label: '日志', icon: 'clipboard', jump: true },
  { key: 'deploy', label: '部署', icon: 'rocket', jump: true },
  { key: 'disk', label: '文件分布', icon: 'folder' },
]

/* ------------------------------------------------------------------ *
 * 小件
 * ------------------------------------------------------------------ */

/* 卡片壳（`OpsCard`）在 `panel-shell.tsx` —— 账户分区也在用同一个。 */

/** 把 `…` 圈起来的那段渲染成 `<strong>`（提示行里只有一个强调段，不值得引标记语法） */
function StrongNote({ text }: { text: string }) {
  const parts = text.split('**')
  return (
    <span>
      {parts.map((part, i) => (i % 2 === 1 ? <strong key={i}>{part}</strong> : part))}
    </span>
  )
}

/* ------------------------------------------------------------------ *
 * 弹窗外壳
 * ------------------------------------------------------------------ */

/**
 * 弹窗外壳用共用的那一个（`panel-modal.tsx`，账户分区也在用）。
 * 这里只做一次改名导入 —— 下面二十来处调用点一个字都不用动。
 */
/* ------------------------------------------------------------------ *
 * 状态
 * ------------------------------------------------------------------ */

interface ConfirmSpec {
  title: string
  desc?: string
  /** 影响 / 说明那一块。`info` = 用中性色（原型 `modal-warn.info`） */
  warn?: string
  warnKind?: 'danger' | 'info'
  confirmText: string
  danger?: boolean
  onConfirm: () => void
}

/** 「添加 / 编辑一条文件位置」。`target` 为 null = 新增 */
interface PathDraft {
  host: string
  target: PathSeed | null
  group: string
  use: string
  path: string
  note: string
  errors: { use?: string; path?: string }
  /** 是否停在路径浏览器那一屏（原型是换掉弹窗正文，表单整块暂存着） */
  pick: boolean
}

/** 文件抽屉（从「文件分布」点一行打开） */
interface FileState {
  path: string
  title: string
  kind: 'dir' | 'file' | 'binary'
  /** 打开时的内容 —— 判断"有没有未保存的修改"要跟它比 */
  saved: string
  body: string
  /** 那条清单记录的备注，用于抽屉底部那行元信息 */
  note: string
}

const KIND_TXT = { dir: '目录', binary: '二进制', file: '文件' } as const

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
  /** 日志 / 部署两个跳转页要用它拼链接（`/logs/<id>`）；这一层只拿得到派生数据，拿不到 `Project` */
  projectId: string
  /** 「添加服务器」那张表单的预览里要显示它归到哪个项目 */
  projectName: string
  servers: ServerItem[]
  deploys: DeployItem[]
  deployDocs: DeployDocItem[]
  notice: (text: string, action?: { label: string; onClick: () => void }) => void
}) {
  const location = useLocation()
  /**
   * 日志页 / 部署面板的地址 + 回来的路。
   *
   * `state.from` 是必须的：这一页同时挂在项目模块与工作模块下，
   *    硬编一个返回目标会把从另一个模块进来的人扔到别处。
   * 部署不按服务器分 —— 原型用的是模块级的 `openDeployWindow()`，URL 里不带 `?host=`，
   *    目标主机由部署页自己从项目派生；所以这里也只在 `OpsPanel` 上算一次。
   */
  const from = { from: location.pathname }
  const logTo = `/logs/${projectId}`
  const deployTo = `/deploy/${projectId}`
  const terminalTo = (name: string) => `/terminal/${projectId}?host=${encodeURIComponent(name)}`

  /* 清单是就地改池子里那份数组的，所以需要一个计数把重渲叫起来 */
  const [, forceRender] = useReducer((n: number) => n + 1, 0)

  /* 原文页：这一格的部署文档点开就是它。部署文档没有"来源工具"这一说，
     `deploySourceDoc` 只把项目名与「部署文档」摆进位置那一行。 */
  const { openSource, sourceNode, sourceOpen } = useSourceOverlay(projectName, notice)

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

  const [confirm, setConfirm] = useState<ConfirmSpec | null>(null)
  const [draft, setDraft] = useState<PathDraft | null>(null)
  const [file, setFile] = useState<FileState | null>(null)

  const [refreshing, setRefreshing] = useState(false)
  /* 起始文案不写死"12 秒前" —— 那句在页面上放十分钟就是假的。刷新后换成真时刻。 */
  const [lastCheck, setLastCheck] = useState('最后检查：刚刚')

  const fieldRef = useRef<HTMLInputElement>(null)
  const codeRef = useRef<HTMLTextAreaElement>(null)

  /**
   * Escape 的优先级：浏览器 → 表单/确认弹窗 → 文件抽屉。
   * 浏览器那一屏的 Escape 只"退回表单"，不关整个浮层 —— 把填了一半的表单一起关掉是灾难。
   */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      /* 原文页开着时这一页不接管：那一层自己会关，一次 Esc 只该退一层 */
      if (sourceOpen) return
      if (draft?.pick) {
        setDraft({ ...draft, pick: false })
        return
      }
      if (draft) {
        setDraft(null)
        return
      }
      if (confirm) {
        setConfirm(null)
        return
      }
      if (file) setFile(null)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [draft, confirm, file, sourceOpen])

  /* 焦点：表单落在第一个字段、文件抽屉落在正文（只读预览不抢焦点）。
     依赖必须是"哪一张表单开着"这个稳定标识，不能是 `draft` 本身 ——
        否则每敲一个字都会重跑一次 focus，用户点完「归类」胶囊焦点就被拽回输入框。 */
  const draftKey = draft ? `${draft.host}|${draft.target?.path ?? 'new'}` : ''
  useEffect(() => {
    if (!draft || draft.pick) return
    fieldRef.current?.focus()
  }, [draftKey])
  useEffect(() => {
    if (file?.kind === 'file') codeRef.current?.focus()
  }, [file?.path, file?.kind])

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

  /** 展开一台服务器：互斥（开一台就收起另一台），并把子分区复位到「信息」 */
  const toggleServer = (name: string) => {
    const willOpen = openServer !== name
    setOpenServer(willOpen ? name : null)
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
      notice('数据已刷新')
    }, 900)
  }

  /* ---------------- 连接 ---------------- */

  const setConnected = (name: string, on: boolean) => {
    markConnected(name, on)
    forceRender()
  }
  const toggleConn = (name: string) => {
    const on = !isConnected(name)
    setConnected(name, on)
    notice(on ? `已连接 ${name}` : `已断开 ${name}`)
  }
  const offHosts = servers.filter((server) => !isConnected(server.name)).map((server) => server.name)
  const connSub = !servers.length
    ? '还没有服务器'
    : !offHosts.length
      ? '全部已连接'
      : offHosts.length === servers.length
        ? '发版前先连上目标机器'
        : `${offHosts.join('、')} 未连接`

  /* ---------------- 文件位置清单（增 / 改 / 删） ---------------- */

  const openAddPath = (host: string) => {
    const server = servers.find((item) => item.name === host)
    if (!server) return
    setDraft({
      host,
      target: null,
      group: server.pathGroups[0] ?? '',
      use: '',
      path: '',
      note: '',
      errors: {},
      pick: false,
    })
  }

  const openEditPath = (host: string, item: PathSeed) =>
    setDraft({
      host,
      target: item,
      group: item.group,
      use: item.use,
      path: item.path,
      note: item.note,
      errors: {},
      pick: false,
    })

  const submitDraft = () => {
    if (!draft) return
    const server = servers.find((item) => item.name === draft.host)
    if (!server) return

    const use = draft.use.trim()
    const path = draft.path.trim()
    const note = draft.note.trim()
    const badPath = !path || !path.startsWith('/')
    if (!use || badPath) {
      setDraft({
        ...draft,
        errors: {
          ...(use ? {} : { use: '用途不能为空' }),
          ...(badPath ? { path: path ? '要写服务器上的绝对路径，以 / 开头' : '路径不能为空' } : {}),
        },
      })
      /* 校验没过 ⇒ 弹窗留着让人补，别把填了一半的表单关掉 */
      return
    }

    if (draft.target) {
      draft.target.use = use
      draft.target.path = path
      draft.target.note = note
      draft.target.group = draft.group
      notice(`已保存「${use}」`)
    } else {
      server.paths.push({ group: draft.group, use, path, note })
      /* 落点要写进反馈：新加的这条去了哪一组，是这次操作的关键结果 */
      notice(`已添加「${use}」到${draft.group}`)
    }
    setDraft(null)
    forceRender()
  }

  const askDeletePath = (host: string, item: PathSeed) => {
    const server = servers.find((s) => s.name === host)
    setConfirm({
      title: `从清单里移除「${item.use}」？`,
      desc: '只是把这条记录从这份清单里去掉 —— 服务器上的文件本身不会被动到。',
      confirmText: '移除这条',
      danger: true,
      onConfirm: () => {
        if (!server) return
        const index = server.paths.indexOf(item)
        if (index < 0) return
        server.paths.splice(index, 1)
        forceRender()
        notice(`已移除「${item.use}」`, {
          label: '撤销',
          onClick: () => {
            /* 按原位放回，不是追加到末尾：顺序变了同样不算还原 */
            server.paths.splice(index, 0, item)
            forceRender()
            notice(`已恢复「${item.use}」`)
          },
        })
      },
    })
  }

  const copyPath = (path: string) => {
    navigator.clipboard?.writeText(path).catch(() => {})
    notice(`已复制 ${path}`)
  }

  /* ---------------- 文件抽屉 ---------------- */

  const openFile = (server: ServerItem, item: PathSeed) => {
    const kind = fileKindOf(item.path)
    setFile({
      path: item.path,
      title: item.use,
      kind,
      saved: item.preview ?? '（这个文件在本原型里没有示例内容）',
      body: item.preview ?? '（这个文件在本原型里没有示例内容）',
      note: pathNote(item.note, server.version),
    })
  }

  const saveFile = () => {
    if (!file || file.kind !== 'file') return
    setFile({ ...file, saved: file.body })
    notice(`已保存 ${file.path}`)
  }

  /* ---------------- 破坏性操作（确认之后只给回执） ---------------- */

  const askRemoveServer = (server: ServerItem) =>
    setConfirm({
      title: `移除 ${server.name}？`,
      desc: '移除后，这台机器不再出现在服务器列表里，也不再从它采集日志。',
      warn: '服务器本身不会被停用，上面的应用与数据都不受影响，日后重新添加即可接回。',
      confirmText: '移除服务器',
      danger: true,
      onConfirm: () => notice(`移除 ${server.name}：还没有写接口`),
    })

  const askRollback = (version: string) =>
    setConfirm({
      title: `回滚到 ${version}？`,
      desc: `将 ${servers[0]?.name ?? '当前节点'} 上的应用版本切回 ${version}，回滚过程自动执行，无需重新构建。`,
      warn: '回滚后，当前版本的数据写入与接口变更不会自动撤销。若涉及数据库结构变更，需人工处理。',
      confirmText: '确认回滚',
      danger: true,
      onConfirm: () => notice(`回滚到 ${version}：还没有写接口`),
    })

  const askCleanup = (server: ServerItem) =>
    setConfirm({
      title: `清理 ${server.name} 的磁盘？`,
      desc: server.reclaim?.desc,
      warn: server.reclaim?.warn,
      confirmText: '确认清理',
      danger: true,
      onConfirm: () => notice(`清理 ${server.name} 的磁盘：还没有写接口`),
    })

  /** 路径浏览器要的那台机器。不走 `as ServerItem` —— 找不到就不渲染，别让断言变成运行期崩溃 */
  const pickerServer = draft ? servers.find((item) => item.name === draft.host) : undefined

  const latest = deploys[0]
  const rollbackCount = deploys.filter((item) => item.result === 'rollback').length

  /* 添加 / 编辑服务器：整页表单，占满这个分区 —— 提前 return，
     不套页面级仪表与那几张卡（原型那一页也只有表单 + 侧轨）。
     `siblings` 在编辑模式下必须排除「自己」，否则「同网段已有」会把自己列进去。 */
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
      {/* 状态行（见文件头 ②） */}
      <div className="ops-head">
        <span className="last-sync">{lastCheck}</span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={refresh}>
          <OpsIcon name="refresh" size={14} /> 重新检查
        </button>
      </div>

      {/* ---------------- 页面级仪表 ----------------
          三格各自回答一件动手前要确认的事：现在是什么版本 / 上次成没成 / 能不能连上。
          不是卡片徽标的复述 —— 徽标负责"这张卡里有多少"，这里负责"我下一步动手前得知道什么"。 */}
      <div className="kpi-bar">
        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              <OpsIcon name="tag" size={15} />
            </span>
            <span className="kpi-label">当前版本</span>
          </div>
          <div className="kpi-val">{servers[0]?.version ?? '—'}</div>
          <div className="kpi-sub">
            {latest ? `提交 ${latest.commit} · ${latest.when} 上线` : '还没有发布过'}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              <OpsIcon name="rocket" size={15} />
            </span>
            <span className="kpi-label">最近发布</span>
          </div>
          <div className={cn('kpi-val', latest?.result === 'success' && 'ok')}>
            {latest ? (latest.result === 'success' ? '成功' : '回滚') : '—'}
          </div>
          <div className="kpi-sub">
            {latest
              ? `${latest.server} · ${latest.who}${latest.duration ? ` · 耗时 ${latest.duration}` : ''}`
              : '发第一版之后这里会有记录'}
          </div>
        </div>

        <div className="kpi">
          <div className="kpi-top">
            <span className="kpi-ico" aria-hidden="true">
              <OpsIcon name="plug" size={15} />
            </span>
            <span className="kpi-label">已连接</span>
          </div>
          <div className="kpi-val">
            {servers.length - offHosts.length}
            <span className="kpi-unit">/ {servers.length} 台</span>
          </div>
          <div className="kpi-sub">{connSub}</div>
        </div>
      </div>

      {/* ---------------- 服务器 ---------------- */}
      <OpsCard
        icon="server"
        title="服务器"
        badge={servers.length ? `${servers.length} 台` : '暂无服务器'}
        collapsed={collapsed.server}
        onToggle={() => toggleCard('server')}
        action={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={(event) => {
              event.stopPropagation()
              setServerForm({ mode: 'add' })
            }}
          >
            <OpsIcon name="plus" size={14} /> 添加
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
              </div>
            ))}
          </div>
        ) : servers.length ? (
          servers.map((server) => {
            const open = openServer === server.name
            const connected = isConnected(server.name)
            return (
              /* `Fragment` 而不是包裹 div：`.server-row` 与它的详情面板在原型里是同级
                 （详情面板靠 `grid-template-rows: 0fr/1fr` 自己塌陷）。多包一层会让
                 "行与面板之间"少一个层级 —— 今天没有样式依赖它，但只要哪天给 `.server-list`
                 加上 `gap`，两种结构就会不一样。 */
              <Fragment key={server.name}>
                <div
                  className={cn('server-row', open && 'active')}
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  aria-controls={`detail-${server.name}`}
                  onClick={() => toggleServer(server.name)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' && event.key !== ' ') return
                    event.preventDefault()
                    toggleServer(server.name)
                  }}
                >
                  <span className="server-ico" aria-hidden="true">
                    <OpsIcon name="server" size={16} />
                  </span>
                  <div className="server-info">
                    <div className="server-name">
                      {server.name}
                      {/* 这一颗既是"连上没连上"的状态，也是那个开关本身 */}
                      <button
                        type="button"
                        className={cn('conn', connected && 'on')}
                        aria-pressed={connected}
                        title={`${connected ? '断开 ' : '连接 '}${server.name}`}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleConn(server.name)
                        }}
                      >
                        {connected ? '已连接' : '未连接'}
                      </button>
                    </div>
                    <div className="server-meta">
                      {server.env === 'prod' ? '生产' : '测试'} ·{' '}
                      {/* 地址单独染一档：这一行里它是最常被读、也最常被复制走的一段 */}
                      <span className="meta-ip">{server.ip}</span> · {server.os}
                      {server.info
                        .filter((field) => field.inMeta)
                        .map((field) => ` · ${field.value}`)
                        .join('')}
                    </div>
                  </div>
                  {/* 动作按钮都是真控件，所以整块的 onClick 要在这一层停住 */}
                  <div className="server-actions" onClick={(event) => event.stopPropagation()}>
                    <Link
                      className="server-action-btn"
                      to={terminalTo(server.name)}
                      state={from}
                      title="打开终端窗口"
                      aria-label={`打开 ${server.name} 的终端`}
                    >
                      <OpsIcon name="window" size={16} />
                    </Link>
                    <button
                      type="button"
                      className="server-action-btn"
                      title="编辑服务器"
                      aria-label={`编辑 ${server.name}`}
                      onClick={() => setServerForm({ mode: 'edit', server })}
                    >
                      <OpsIcon name="edit" size={16} />
                    </button>
                    <button
                      type="button"
                      className="server-action-btn danger"
                      title="移除服务器"
                      aria-label={`移除 ${server.name}`}
                      onClick={() => askRemoveServer(server)}
                    >
                      <OpsIcon name="trash" size={16} />
                    </button>
                  </div>
                </div>

                <div className={cn('server-detail-panel', open && 'open')} id={`detail-${server.name}`}>
                  <div className="server-detail-inner">
                    <div className="sd-tabs" role="tablist" aria-label={`${server.name} 详情分区`}>
                      {SERVER_TABS.map((item) => {
                        /* 「日志」与「部署」各是一个整窗页面（见文件头 ③）—— 原型这两处都是 `<a>`，
                           所以用 `<Link>`；`↗` 表示"会离开当前这一页"。 */
                        if ('jump' in item) {
                          const to = item.key === 'log' ? logTo : deployTo
                          const count = item.key === 'log' ? server.logCount : deploys.filter((d) => d.server === server.name).length
                          return (
                            <Link
                              key={item.key}
                              className="sd-tab ext"
                              to={to}
                              state={from}
                              title={
                                item.key === 'log'
                                  ? '在新窗口打开日志，方便边部署边看'
                                  : '在新窗口打开部署面板，部署期间可以一直盯着'
                              }
                            >
                              <OpsIcon name={item.icon} size={13} />
                              {item.label}
                              {count > 0 ? <span className="sd-tab-count">{count}</span> : null}
                              <OpsIcon name="external" size={12} />
                            </Link>
                          )
                        }
                        return (
                          <button
                            key={item.key}
                            type="button"
                            role="tab"
                            aria-selected={serverTab === item.key}
                            className={cn('sd-tab', serverTab === item.key && 'active')}
                            onClick={() => setServerTab(item.key)}
                          >
                            <OpsIcon name={item.icon} size={13} />
                            {item.label}
                          </button>
                        )
                      })}
                    </div>

                    {/* ---------- 信息 ---------- */}
                    <div className={cn('sd-pane', serverTab === 'info' && 'active')}>
                      <div className="server-detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">IP 地址</span>
                          <span className="detail-value">{server.ip}</span>
                        </div>
                        {/* 只放「不用连也能知道」的事：地址 / 系统 / 数据库 / 备份策略。
                            规格 · 运行时长 · 版本 · 健康检查 · 资源使用都要连上才读得到 ⇒ 不在这里 */}
                        {server.info.map((field) => (
                          <div key={field.label} className="detail-item">
                            <span className="detail-label">{field.label}</span>
                            <span className="detail-value">{field.value}</span>
                          </div>
                        ))}
                        {/* 一台机器上跑着几个服务就有几个端口 ⇒ 不是一个值，是一串 */}
                        <div className="detail-item wide">
                          <span className="detail-label">应用端口</span>
                          <span className="port-chips">
                            {server.ports.map((port) => (
                              <span key={port.port} className="port-chip">
                                {port.port}
                                <span className="svc">{port.svc}</span>
                              </span>
                            ))}
                          </span>
                        </div>
                      </div>
                      {/* 编辑不在这里：这一行的动作栏已经有同一个入口了 */}
                      <div className="sd-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            navigator.clipboard?.writeText(server.ip).catch(() => {})
                            notice(`已复制 IP ${server.ip}`)
                          }}
                        >
                          <OpsIcon name="copy" size={13} /> 复制 IP
                        </button>
                      </div>
                    </div>

                    {/* ---------- 文件分布 ----------
                        只列这个项目在这台机器上的文件在哪（配置 / 产物 / 日志目录…），
                        不是整机目录占用 —— 管这台机器时真正要问的是"我要改、要传的那个文件在哪儿"。 */}
                    <div className={cn('sd-pane', serverTab === 'disk' && 'active')}>
                      <div className="sd-section-head">
                        项目文件位置
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => openAddPath(server.name)}
                        >
                          <OpsIcon name="plus" size={14} /> 添加路径
                        </button>
                      </div>
                      <div className="path-groups">
                        {server.pathGroups.map((group) => {
                          const mine = server.paths.filter((item) => item.group === group)
                          return (
                            <div key={group} className="path-group">
                              <div className="path-group-head">{group}</div>
                              <div className="path-list">
                                {mine.length ? (
                                  mine.map((item) => (
                                    <div
                                      key={`${item.group}|${item.path}`}
                                      className="path-row"
                                      role="button"
                                      tabIndex={0}
                                      title={item.path}
                                      onClick={() => openFile(server, item)}
                                      onKeyDown={(event) => {
                                        if (event.key !== 'Enter' && event.key !== ' ') return
                                        event.preventDefault()
                                        openFile(server, item)
                                      }}
                                    >
                                      <span className="path-ico" aria-hidden="true">
                                        <OpsIcon name={fileKindOf(item.path) === 'dir' ? 'folder' : 'file'} size={15} />
                                      </span>
                                      <span className="path-text">
                                        <span className="path-head">
                                          <span className="path-use">{item.use}</span>
                                          <span className="path-note">{pathNote(item.note, server.version)}</span>
                                        </span>
                                        <span className="path-val">{item.path}</span>
                                      </span>
                                      {/* 复制路径降成行尾的次要动作：主交互是点开看内容 */}
                                      <span className="path-acts" onClick={(event) => event.stopPropagation()}>
                                        <button
                                          type="button"
                                          className="path-act"
                                          title="复制路径"
                                          onClick={() => copyPath(item.path)}
                                        >
                                          <OpsIcon name="copy" size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          className="path-act"
                                          title="编辑这条"
                                          onClick={() => openEditPath(server.name, item)}
                                        >
                                          <OpsIcon name="edit" size={13} />
                                        </button>
                                        <button
                                          type="button"
                                          className="path-act danger"
                                          title="从清单里移除"
                                          onClick={() => askDeletePath(server.name, item)}
                                        >
                                          <OpsIcon name="trash" size={13} />
                                        </button>
                                      </span>
                                    </div>
                                  ))
                                ) : (
                                  <div className="path-empty">这一组还没有文件位置</div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                      {server.reclaim ? (
                        <>
                          <div className="sd-section">
                            <div className="note">
                              <span className="note-ico" aria-hidden="true">
                                <OpsIcon name="info" size={14} />
                              </span>
                              <span>
                                <StrongNote text={server.reclaim.note} />
                              </span>
                            </div>
                          </div>
                          <div className="sd-actions">
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={() => askCleanup(server)}
                            >
                              <OpsIcon name="trash" size={14} /> 清理磁盘
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              </Fragment>
            )
          })
        ) : (
          /* 一台都不剩时：要说清"为什么空"和"下一步做什么"，只写"暂无数据"等于把人留在死路口 */
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              <OpsIcon name="server" size={22} />
            </div>
            <div className="empty-title">还没有服务器</div>
            <div className="empty-desc">添加一台服务器，才能在这里看它的日志与部署</div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              style={{ marginTop: 8 }}
              onClick={() => setServerForm({ mode: 'add' })}
            >
              <OpsIcon name="plus" size={14} /> 添加服务器
            </button>
          </div>
        )}
      </OpsCard>

      {/* ---------------- 部署文档 ---------------- */}
      <OpsCard
        icon="book"
        title="部署文档"
        badge={`${deployDocs.length} 篇`}
        collapsed={collapsed.doc}
        onToggle={() => toggleCard('doc')}
        action={
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={(event) => {
              event.stopPropagation()
              notice('新建部署文档：还没有写接口')
            }}
          >
            <OpsIcon name="plus" size={14} /> 新建
          </button>
        }
      >
        {/* 书架 · 精装封面（原型 2026-09-27 晚换版：整段取自 `design/project/项目-文档主页-index.html`
            的 `.doc-book`）。四行版面：`签 + 图标` ／ `题 + 发丝线 + 副题(= 版本号)` ／
            `发丝线 + 页脚(= 更新时间)`。三本等高由 `aspect-ratio` 定，所以这里不再手改高度、
            也不再挂 `compact`（原型把那一档去掉了：本页只有这一种尺寸）。 */}
        <div className="doc-books">
          {deployDocs.map((doc) => (
            <DeployDocBook
              key={doc.id}
              doc={doc}
              onOpen={() => openSource(deploySourceDoc(doc, projectName))}
              /* 这两颗是运维这一格特有的（服务器详情那一页不搬 —— 管理只有一处家）。
                 传了 `actions` ⇒ 宿主自动换成 `div[role=button]`（见组件文件头）。 */
              actions={
                <>
                  <button
                    type="button"
                    className="book-action-btn"
                    title={`下载${doc.name}`}
                    onClick={() => notice('下载文档：还没有写接口')}
                  >
                    <OpsIcon name="download" size={13} />
                  </button>
                  <button
                    type="button"
                    className="book-action-btn"
                    title="更多操作"
                    onClick={() => notice('更多操作：还没有写接口')}
                  >
                    <OpsIcon name="more" size={13} />
                  </button>
                </>
              }
            />
          ))}
          {/* 这儿原来还有一格虚线「新建文档」，与卡头那颗「+ 新建」是同一个动作两个入口；
              留着它还多一个副作用：它不是书，却站在"书架"这一排里 ⇒ 已删，新建只走卡头。 */}
        </div>
      </OpsCard>

      {/* ---------------- 发布记录 ----------------
          没有筛选行：4 条记录配 3 个 chip + 一个计数，控件比内容还重。
          要找的（回滚）行上已经有橙点与「回滚」徽标，扫一眼就够。
          也没有「+ 记录」：这张表的每一列都有自动来源（见原型头部那条注释），
          人工只需要动手发一次版本 —— 产生端在部署面板。 */}
      <OpsCard
        icon="rocket"
        title="发布记录"
        badge={`${deploys.length} 次${rollbackCount > 0 ? ` · ${rollbackCount} 次回滚` : ''}`}
        collapsed={collapsed.deploy}
        onToggle={() => toggleCard('deploy')}
      >
        {deploys.length ? (
          <div className="deploy-timeline">
            {deploys.map((item, i) => {
              const open = openDeploy === item.id
              return (
                <div key={item.id} className="deploy-entry">
                  <div
                    className={cn('deploy-row', i === 0 && 'highlight', open && 'expanded')}
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
                        {i === 0 ? <span className="badge idle">最新</span> : null}
                        <span className="deploy-expand-icon" aria-hidden="true">
                          <OpsIcon name="chevD" size={14} />
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
                            {/* 回滚那条的格子是另一套（没有提交/耗时，多了回滚目标与原因） */}
                            <div className="deploy-detail-item">
                              <span className="label">回滚自</span>
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
                            notice(item.result === 'success' ? '构建日志：还没有写接口' : '回滚日志：还没有写接口')
                          }}
                        >
                          <OpsIcon name="clipboard" size={14} />{' '}
                          {item.result === 'success' ? '构建日志' : '回滚日志'}
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
                            <OpsIcon name="undo" size={14} /> 回滚到此版本
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
          /* 空态是给「新项目还没发过版」准备的 */
          <div className="empty-state">
            <div className="empty-icon" aria-hidden="true">
              <OpsIcon name="folder" size={22} />
            </div>
            <div className="empty-title">还没有发布记录</div>
            <div className="empty-desc">从部署面板发第一版，这里会自己多一条 —— 不必手填</div>
          </div>
        )}
      </OpsCard>

      {/* ---------------- 文件抽屉 ----------------
          独立窗口留给日志 / 部署那种"要一直盯着的流"；看一眼文件不必开窗口，
          抽屉也不会打断"我在看这台机器"的上下文。 */}
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
                <OpsIcon name={file.kind === 'dir' ? 'folder' : 'file'} size={15} />
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
                  : `${file.note} · ${file.kind === 'file' ? '可直接编辑' : '只读预览'}`}
              </div>
            </div>
            <div className="fd-foot">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => copyPath(file.path)}>
                <OpsIcon name="copy" size={13} /> 复制路径
              </button>
              <span className="spacer" />
              {file.kind === 'file' ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={saveFile}>
                  保存
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {/* ---------------- 弹窗：文件位置表单 / 路径浏览器 ---------------- */}
      {draft ? (
        draft.pick && pickerServer ? (
          <PickerView server={pickerServer} draft={draft} setDraft={setDraft} />
        ) : (
          <OpsModal
            title={draft.target ? '编辑这条文件位置' : '添加文件位置'}
            cancelLabel="取消"
            onCancel={() => setDraft(null)}
            footer={
              <button type="button" className="btn btn-primary" onClick={submitDraft}>
                {draft.target ? '保存' : '添加'}
              </button>
            }
          >
            <div className="path-form">
              <div className="fld">
                <div className="fld-head">
                  <label className="fld-label" htmlFor="pfUse">
                    用途
                  </label>
                </div>
                <input
                  ref={fieldRef}
                  id="pfUse"
                  className="fld-inp"
                  type="text"
                  autoComplete="off"
                  placeholder="Nginx 配置"
                  value={draft.use}
                  aria-invalid={draft.errors.use ? 'true' : 'false'}
                  onChange={(event) => setDraft({ ...draft, use: event.target.value, errors: { ...draft.errors, use: undefined } })}
                />
                {draft.errors.use ? <span className="fld-err">{draft.errors.use}</span> : null}
              </div>

              <div className="fld">
                {/* 浏览入口挂在标签行里，不占输入框宽度 —— 路径本身就很长 */}
                <div className="fld-head">
                  <label className="fld-label" htmlFor="pfPath">
                    路径
                  </label>
                  <button
                    type="button"
                    className="fld-act"
                    onClick={() => setDraft({ ...draft, pick: true })}
                  >
                    浏览服务器路径
                  </button>
                </div>
                <input
                  id="pfPath"
                  className="fld-inp mono"
                  type="text"
                  autoComplete="off"
                  placeholder="/etc/nginx/conf.d/pay.conf"
                  value={draft.path}
                  aria-invalid={draft.errors.path ? 'true' : 'false'}
                  onChange={(event) =>
                    setDraft({ ...draft, path: event.target.value, errors: { ...draft.errors, path: undefined } })
                  }
                />
                {draft.errors.path ? <span className="fld-err">{draft.errors.path}</span> : null}
              </div>

              <div className="fld">
                <div className="fld-head">
                  <label className="fld-label" htmlFor="pfNote">
                    备注（选填）
                  </label>
                </div>
                <input
                  id="pfNote"
                  className="fld-inp"
                  type="text"
                  autoComplete="off"
                  placeholder="版本 / 大小 / 时间，例如 v2.3.1"
                  value={draft.note}
                  onChange={(event) => setDraft({ ...draft, note: event.target.value })}
                />
              </div>

              {/* 归类给"选"不给"填"：自由输入会立刻长出「配置 / 配置文件 / conf」三个组，
                  而分组的全部价值就是"同一类东西只有一个去处" —— 选项就是这台机器上现成的组 */}
              <div className="fld">
                <span className="fld-label">归类</span>
                <div className="chip-group" role="group" aria-label="选择归类">
                  {(servers.find((item) => item.name === draft.host)?.pathGroups ?? []).map((group) => (
                    <button
                      key={group}
                      type="button"
                      className={cn('chip', draft.group === group && 'active')}
                      aria-pressed={draft.group === group}
                      onClick={() => setDraft({ ...draft, group })}
                    >
                      {group}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </OpsModal>
        )
      ) : null}

      {/* ---------------- 弹窗：二次确认 ---------------- */}
      {confirm ? (
        <OpsModal
          title={confirm.title}
          cancelLabel="取消"
          onCancel={() => setConfirm(null)}
          footer={
            <button
              type="button"
              className={cn('btn', confirm.danger ? 'btn-danger' : 'btn-primary')}
              onClick={() => {
                const spec = confirm
                setConfirm(null)
                spec.onConfirm()
              }}
            >
              {confirm.confirmText}
            </button>
          }
        >
          {confirm.desc ? <p>{confirm.desc}</p> : null}
          {confirm.warn ? (
            <div className={cn('modal-warn', confirm.warnKind === 'info' && 'info')} role="note">
              <strong>{confirm.warnKind === 'info' ? '说明：' : '影响：'}</strong>
              <span>{confirm.warn}</span>
            </div>
          ) : null}
        </OpsModal>
      ) : null}

      {sourceNode}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 路径浏览器（弹窗里的第二屏）
 * ------------------------------------------------------------------ */

/**
 * 登记"项目文件位置"时让用户手输 `/etc/nginx/conf.d/pay.conf`，是把记忆负担推给他；
 * 那台机器上有什么，只有它自己知道。所以「路径」旁边给一个入口，在目录树里点出来。
 *
 * 两种都要能选到：目录（`/var/log/pay-api/`）与文件（`pay.conf`）——
 *    点目录行往里走、点文件行就选中，右边「用这个目录」是选中当前这一层。
 * 选择器里没有"确认"这一步，所以那颗主按钮不渲染（原型是把 `mConfirm` 藏起来）。
 */
function PickerView({
  server,
  draft,
  setDraft,
}: {
  server: ServerItem
  draft: PathDraft
  setDraft: (next: PathDraft) => void
}) {
  const root: FsNode = buildFsTree(server.paths, server.fsExtra, server.version)
  /* 打开时落在哪：原型是 openFsPicker 里算一次，之后由点选驱动 ⇒ 这里用 state 记住 */
  const [parts, setParts] = useState(() =>
    fsDirFor(root, draft.path.trim().split('/').filter(Boolean), server.fsHome),
  )
  const [filter, setFilter] = useState('')

  const node = fsNodeAt(root, parts) ?? ({ type: 'd', children: {} } as FsNode)
  const children = node.children ?? {}
  const keyword = filter.toLowerCase()
  const entries = Object.keys(children)
    .map((name) => ({ name, node: children[name] as FsNode }))
    .filter((entry) => !keyword || entry.name.toLowerCase().includes(keyword))
    /* 目录在前、文件在后：目录是"继续往下走"，文件是"到这儿为止" */
    .sort((a, b) => {
      if (a.node.type !== b.node.type) return a.node.type === 'd' ? -1 : 1
      return a.name.localeCompare(b.name)
    })

  /** 选中一个路径：先把选择器收掉，再把值交回表单（对应原型 `pickValue` → `closePicker`） */
  const pickValue = (path: string) => {
    setDraft({ ...draft, path, pick: false, errors: { ...draft.errors, path: undefined } })
  }

  return (
    <OpsModal
      title={`浏览 ${server.name} 的文件`}
      variant="pick"
      cancelLabel="返回"
      onCancel={() => setDraft({ ...draft, pick: false })}
    >
      {/* 面包屑：机器名 › etc › postgresql › 15 › main，逐级可点 */}
      <div className="pick-crumbs">
        <button
          type="button"
          className={cn('pick-crumb', parts.length === 0 && 'current')}
          onClick={() => parts.length && setParts([])}
        >
          {server.name}
        </button>
        {parts.map((segment, i) => (
          <Fragment key={`${segment}-${i}`}>
            <span className="pick-sep" aria-hidden="true">
              ›
            </span>
            <button
              type="button"
              className={cn('pick-crumb', i === parts.length - 1 && 'current')}
              onClick={() => i < parts.length - 1 && setParts(parts.slice(0, i + 1))}
            >
              {segment}
            </button>
          </Fragment>
        ))}
      </div>

      <div className="pick-bar">
        <code>/{parts.join('/')}</code>
        <button type="button" className="pick-use" onClick={() => pickValue(`/${parts.join('/')}`)}>
          用这个目录
        </button>
      </div>

      {/* 条目多时才给筛选框：`/opt/app/releases` 那种一屏几十个才需要，
          三级目录里放个搜索框是给不存在的需求配控件 */}
      {Object.keys(children).length >= 10 ? (
        <input
          id="pickFilter"
          className="fld-inp"
          type="search"
          placeholder="筛选这一层"
          autoComplete="off"
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      ) : null}

      <div className="pick-list" tabIndex={-1}>
        {entries.length ? (
          entries.map((entry) => {
            const isFile = entry.node.type === 'f'
            const full = `/${[...parts, entry.name].join('/')}`
            const meta = isFile
              ? [entry.node.size, entry.node.time].filter(Boolean).join(' · ')
              : `${Object.keys(entry.node.children ?? {}).length} 项`
            return (
              <button
                key={entry.name}
                type="button"
                className={cn('pick-row', isFile && 'is-file')}
                title={full}
                onClick={() => (isFile ? pickValue(full) : setParts([...parts, entry.name]))}
              >
                <span className="pick-ico" aria-hidden="true">
                  <OpsIcon name={isFile ? 'file' : 'chevR'} size={11} />
                </span>
                <span className="pick-name">{entry.name}</span>
                <span className="pick-meta">{meta}</span>
              </button>
            )
          })
        ) : (
          <div className="pick-empty">
            {keyword ? `这一层里没有匹配「${filter}」的项` : '这个目录是空的'}
          </div>
        )}
      </div>
    </OpsModal>
  )
}
