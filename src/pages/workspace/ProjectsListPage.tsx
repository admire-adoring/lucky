import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { Icon } from '../../components/icons/Icon'
import { ProjectDeleteModal, ProjectFormModal, type ProjectFormValue } from '../../components/projects/ProjectModal'
import {
  BOARD_ORDER,
  PRIO_CLASS,
  PRIO_LABEL,
  SCOPE_FACETS,
  SCOPE_LABEL,
  SORT_OPTIONS,
  STATUS_BADGE,
  STATUS_FACETS,
  STATUS_LABEL,
  VIEW_OPTIONS,
  formValueOf,
} from '../../components/projects/project-meta'
import { blankProjectPatch } from '../../api/projects'
import { isClosed } from '../../data/derive'
import { useProjectActions, useProjects } from '../../hooks/use-projects'
import { cn } from '../../lib/cn'
import { STATUS_MATCH, facetCount, filterProjects, parseQuery, projectHit, type ProjectFilter } from '../../lib/filter-projects'
import { useRecentsStore } from '../../stores/recents-store'
import { toast } from '../../stores/toast-store'
import { useUiStore } from '../../stores/ui-store'
import type { Project, ProjectStatus, ScopeFilter, SortMode, ViewMode } from '../../types'

/**
 * 项目列表（「项目」这一域的根，`/projects`）。
 *
 * ============================================================================
 * 2026-09-27：按原型 `design/project/project_index.html` 的 `#viewList` 重写
 * ============================================================================
 *
 * 上一版是"参考原型的设计"（原型当时只有详情态，文件头写着"原型里没有这一页"）。
 * 现在原型补上了列表态，而且是有意偏离上一版的（原型那段注释的原话：
 * "`pages/workspace/ProjectsListPage.tsx` 里那版是「四张读数卡 + 工具栏两块」，
 * 这里有意偏离"），所以这一页整体换掉，不再是"参考"。
 *
 * 换掉了什么，以及为什么：
 *
 * ① 四张读数卡（`.ov-kpi`）整块去掉，改为「两块筛选用同一个 chip」的筛选栏。
 *    旧版把"状态"做成四张大卡、"类型"做成一行 chip —— 同一件事（用某个条件筛掉几行）
 *    两种长相，读起来像两个人做的。现在合成一个组件：一个筛选组 = 小标签 + 一排 `.facet`，
 *    组间一条竖线、两行之间一条横线（上行"筛什么"、下行"怎么看"）。
 *    代价是读数不再有大数字 —— 这是有意的：域级读数归侧栏「概览」槽，
 *    chip 上的计数回答的是"点下去会剩几条"。同一屏只留一处说某个数是多少。
 * ② 页头与详情态的 Hero 同构（一行大字 + 一行小字 + 右侧本态动作），
 *    替掉原来的 13px 面包屑 —— 同一职责两种规格，两级之间切来切去视觉重心会跳。
 * ③ 表格补了表头、看板补了一行读数（进度 + 剩几天），空态文案改成本页的筛选项。
 *
 * 三处不是"原型怎么写就怎么抄"：
 *
 * · 读数与计数一律来自真实派生（`data/projects.ts` 的 8 个项目），没有一条是编的。
 *   chip 上的计数走 `facetCount`，口径（应用另一组 + 关键词、不应用本组自己的选择）
 *   写在 `lib/filter-projects.ts` 那一段。
 * · 筛选状态住在 `ui-store`，不是页面局部 state —— 侧栏「概览」槽要读同一批数
 *   （原型把它放模块级全局，理由写在 `renderOverviewSlot` 上面那句）。
 * · 「+ 新建项目」在这里，不在顶栏（旧版挂在 `topbarActions`）。原型的页头右端
 *   与详情态 Hero 的「编辑」同位对齐。第三轮起它真的会新建（见下）。
 *
 * 原型里那两条"演示后门"没有搬：chip 点已选中项不做取消（回「全部」就是取消，
 *    所以「全部」这项不是多余的），卡片也没有"点一下循环状态"那种入口。
 *
 * ============================================================================
 * 2026-09-27 · 第二轮：卡片上的三个动作 + 「已归档」状态
 * ============================================================================
 *
 * 原型这一轮加进来的两件事，都在这一页上：
 *
 * ① 每张卡右上角三个动作（编辑 / 归档·恢复 / 删除）。这三个该在卡片上，
 *    而不是"只读账本"：项目的名称、描述、类型、优先级、截止日期只有用户自己知道 ——
 *    别处没有任何一份系统账目能回答它们。反过来卡片上不放"新增"：
 *    页头已经有「+ 新建项目」，同一件事不做两个入口。
 *    三个按钮是卡片的兄弟（定位在右上角、视觉上落在卡里），不是子节点 ——
 *       于是"点删除顺手把项目打开了"在结构上不可能发生，不需要 stopPropagation。
 * ② 状态多了「已归档」。它不是 `done` 的另一种说法：`done` 是"做完了、
 *    但仍是这一域的成果"；`archived` 是从台面上收走（软删除）——
 *    「全部」不含它、它自己有一项筛选项、也不算"未收口"。
 *    收口判据只在两处：`lib/filter-projects.ts` 的 `STATUS_MATCH` 与 `data/derive.ts` 的 `isClosed`。
 *
 * 这两件事都要改数据，而应用没有后端 —— 所以写操作落在 `api/projects.ts`
 *    里那一段内存假后端上（改的是 `data/projects.ts` 那份种子数组本体）。
 *    语义与原型逐条一致：归档 / 删除都带一条 6 秒的「撤销」，刷新回到种子。
 *    它不是"点一下把界面改掉、背后什么都没发生"：改的是这一份数据层，
 *    列表 / 详情 / 助手事实读的都是它（那条判据见 `ProjectDetail` 的 ⋯ 菜单：
 *    那里四个动作都没有接口，所以它们仍回"还没接"）。
 *
 * ============================================================================
 * 2026-09-27 · 第三轮：增删改查补齐（新建 / #标签搜索 / 空态出路 / URL 状态）
 * ============================================================================
 *
 * ① 新增接上了：页头那个按钮与空态里那个按钮走同一条路（同一个新建弹窗，
 *    见 `ProjectFormModal` 的 `mode="create"`）。同一件事不做两个入口、也不做两种弹窗。
 * ② 搜索支持 `#标签`（多个取与、前缀匹配）—— 标签有十几个，做成一排 chip 会把
 *    筛选卡撑成三行，而语法不占控件位。代价是它成了隐形条件，
 *    所以空态里必须把"正在按 #xx 筛标签"说出来。
 * ③ 空态给的不是同一件事：库里本来就没有项目 ⇒ 给「+ 新建项目」；
 *    只是被筛掉了 ⇒ 给「清空筛选」。让人自己去把两组筛选 + 关键词一项项清掉，
 *    既烦、又要他记得刚才点过哪些。
 * ④ 这一屏在看什么写进 URL（筛选 / 视图 / 排序 / 关键词）——
 *    刷新不再回到默认，也能把"这一批筛选结果"整条发出去。
 *    写入用 `replace`（不产生历史条目）：否则每敲一个字都塞一条历史，返回键就废了。
 *    读回来每一项都要校验：URL 是人可编辑的，`?status=constructor` 那种
 *       会顺着原型链拿到 `Function` 当谓词用。
 */

/*
 * 标签表与选项表都在 `components/projects/project-meta.ts` —— 项目弹窗（编辑）也要读同一份：
 * 枚举只在一处定义，否则加了新状态（「已归档」正是这么加进来的）之后弹窗里选不到它。
 */

/** 截止临近（≤14 天且未收口）才高亮 —— 已完成 / 已归档的项目再"剩几天"没有意义
 *  （原型 `dueClass`；"收口"的判据见 `isClosed`） */
function dueClass(project: Project): string | undefined {
  return !isClosed(project) && project.daysLeft >= 0 && project.daysLeft <= 14 ? 'text-danger' : undefined
}

/** 剩几天 / 逾期几天 / 已完成 / 已归档（原型 `leftText`） */
function leftText(project: Project): string {
  if (project.status === 'archived') return '已归档'
  if (project.status === 'done') return '已完成'
  return project.daysLeft >= 0 ? `剩 ${project.daysLeft} 天` : `逾期 ${-project.daysLeft} 天`
}

export function ProjectsListPage() {
  const navigate = useNavigate()
  const { data: projects = [], isPending } = useProjects()

  /* 筛选与视图状态：全在 store 里（侧栏「概览」槽读同一批数，见文件头） */
  const status = useUiStore((state) => state.status)
  const scope = useUiStore((state) => state.scope)
  const query = useUiStore((state) => state.query)
  const sort = useUiStore((state) => state.sort)
  const view = useUiStore((state) => state.view)
  const setStatus = useUiStore((state) => state.setStatus)
  const setScope = useUiStore((state) => state.setScope)
  const setQuery = useUiStore((state) => state.setQuery)
  const setSort = useUiStore((state) => state.setSort)
  const setView = useUiStore((state) => state.setView)

  const filter: ProjectFilter = { status, scope, query, sort }
  const list = filterProjects(projects, filter)
  const open = (id: string) => navigate(`/projects/${id}`)

  /* ---------- 三个动作（编辑 / 归档·恢复 / 删除）+ 新建 ---------- */

  const actions = useProjectActions()
  const forgetRecent = useRecentsStore((state) => state.forget)
  /** 正在新建 / 正在编辑 / 正在确认删除的那一个。null = 弹窗关着 */
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState<Project | null>(null)
  const [deleting, setDeleting] = useState<Project | null>(null)

  /* ---------- 这一屏在看什么，写进 URL ----------
     两个 effect 一正一反。不会自激：正向那条先比字符串，值没变就不碰地址栏，
     于是也就不会再触发一次反向那条；而反向那条 set 的是同一个值（zustand 按 Object.is
     比 selector 结果），不会造成额外渲染。 */
  const [params, setParams] = useSearchParams()

  useEffect(() => {
    const next = new URLSearchParams()
    if (status) next.set('status', status)
    if (scope !== 'all') next.set('scope', scope)
    if (view !== 'cards') next.set('view', view)
    if (sort !== 'default') next.set('sort', sort)
    if (query.trim()) next.set('q', query.trim())

    const search = next.toString()
    if (search === params.toString()) return
    /* `replace`：否则"每敲一个字"都塞一条历史，返回键就废了 */
    setParams(next, { replace: true })
  }, [status, scope, view, sort, query, params, setParams])

  /* 反向：地址栏被改（刷新 / 前进后退 / 别人发来的链接）⇒ 按它重画。
     每一项都校验：URL 是人可编辑的，`?status=constructor` 会顺着原型链
        拿到 `Function` 当谓词用（白屏，而且报错点离这里很远）。 */
  useEffect(() => {
    const rawStatus = params.get('status')
    if (rawStatus && Object.prototype.hasOwnProperty.call(STATUS_MATCH, rawStatus)) {
      setStatus(rawStatus as '' | ProjectStatus)
    }
    const rawScope = params.get('scope')
    if (rawScope && SCOPE_FACETS.some((facet) => facet.key === rawScope)) setScope(rawScope as ScopeFilter)

    const rawView = params.get('view')
    if (rawView && VIEW_OPTIONS.some((option) => option.value === rawView)) setView(rawView as ViewMode)

    const rawSort = params.get('sort')
    if (rawSort && SORT_OPTIONS.some((option) => option.value === rawSort)) setSort(rawSort as SortMode)

    const rawQuery = params.get('q')
    if (rawQuery !== null) setQuery(rawQuery)
  }, [params, setStatus, setScope, setView, setSort, setQuery])

  /**
   * 归档 —— 换一个 status，不是另起一个布尔（理由见 `api/projects.ts`）。
   *
   * 撤销要回到归档前那个状态，所以在发请求之前先记下来（原型同此）。
   *    其余字段从活对象上现取：`fetchProjects` 回的是一批同一批对象引用，
   *    所以 `project` 一直是最新的那一份。
   */
  const archive = (project: Project) => {
    const prev = project.status
    actions.setStatus.mutate({ id: project.id, status: 'archived' })
    toast(`已归档「${project.name}」`, {
      label: '撤销',
      onClick: () => {
        actions.setStatus.mutate(
          { id: project.id, status: prev },
          { onSuccess: () => toast(`已恢复「${project.name}」原状态`) },
        )
      },
    })
  }

  /** 恢复：落回「进行中」。归档前那个状态没有历史，无从还原 ——
   *  落回"进行中"（= 回到台面上）比猜一个更具体的状态诚实（原型同此）。 */
  const restore = (project: Project) => {
    actions.setStatus.mutate(
      { id: project.id, status: 'active' },
      { onSuccess: () => toast(`已恢复「${project.name}」到进行中`) },
    )
  }

  /**
   * 删除 —— 从数据里摘掉 + 一条带「撤销」的提示。
   *
   * 撤销要把项目插回原来的位置（`deleteProject` 回的就是那个下标）：
   *    位置一变，"撤销"看起来就没生效（列表顺序跳了）。
   * 侧栏「最近」里指向它的那几条也一并摘掉：项目还在时它是一条有用的回头路，
   *    项目没了之后点它只会落到一个不存在的地址上。而这条记录是持久化的
   *    （localStorage），不摘掉会一直留在侧栏里，刷新也不会自己消失。
   */
  const remove = (project: Project) => {
    setDeleting(null)
    actions.remove.mutate(project.id, {
      onSuccess: (removed) => {
        forgetRecent(`/projects/${project.id}`)
        forgetRecent(`/work/projects/${project.id}`)
        toast(`已删除「${removed.project.name}」`, {
          label: '撤销',
          onClick: () => {
            actions.unremove.mutate(removed, {
              onSuccess: () => toast(`已恢复「${removed.project.name}」`),
            })
          },
        })
      },
    })
  }

  /**
   * 保存编辑：提交表单的值，成功后由 `useProjectActions` 统一失效重画。
   *
   * 编辑不挪筛选（与新建有意不同）：用户是站在当前这个筛选里改一条已有数据的，
   *    视图突然跳走比"它不在这批里"更突兀。代价是要说清它去哪了。
   */
  const save = (value: ProjectFormValue) => {
    if (!editing) return
    const id = editing.id
    actions.save.mutate(
      { id, patch: value },
      {
        onSuccess: (list) => {
          const latest = list.find((item) => item.id === id)
          const visible = latest ? projectHit(latest, filter) : true
          toast(`已保存「${value.name}」${visible ? '' : '· 它已不在当前筛选里'}`)
        },
      },
    )
    setEditing(null)
  }

  /**
   * 新建 —— 提交之后必须能立刻看见它，看不见就不是"创建成功"的样子。
   *
   * 四种看不见的情形在这里一次性掐掉：
   *   · 状态筛选停在「已完成 / 已归档」⇒ 新项目（规划中）一条都不显示；
   *   · 类型筛选停在「工作」而新建的是生活项目 ⇒ 同样一条都不显示；
   *   · 排序是「进度最高」⇒ 新项目进度 0，被排到最底下；
   *   · 搜索框里还留着关键词而名字对不上 ⇒ 一样是空的。
   * 所以落点是写死的：状态回默认（选成已归档则切到「已归档」那一项）、
   * 类型切到它自己那一类、排序回默认、关键词清空。
   */
  const create = (value: ProjectFormValue) => {
    setCreating(false)
    actions.create.mutate(value, {
      onSuccess: () => {
        setStatus(value.status === 'archived' ? 'archived' : '')
        setScope(value.scope)
        setSort('default')
        setQuery('')
        toast(`已创建「${value.name}」· 归到「${SCOPE_LABEL[value.scope]}」`)
      },
    })
  }

  /** 清空筛选 = 三样一起回默认：两组筛选 + 关键词 */
  const clearFilters = () => {
    setStatus('')
    setScope('all')
    setQuery('')
  }

  /** 空态里那句提示：`#标签` 是隐形条件 —— 不说一句的话，
   *  "输入框看起来是空的（只剩标签词）却没有结果"会被读成页面坏了。 */
  const activeTags = parseQuery(query).tags

  return (
    <WorkspaceLayout
      module="projects"
      /* 域根没有环：这一域没有可寻址的下级，分组落点在页内那两组 chip 上
         （`data/workspace/tabs.ts` 里 `projects: []` 是同一条判据） */
      tabs={[]}
      active=""
      onSelectTab={() => {}}
      topbarTitle="全部项目"
    >
      {/* 页头 —— 与详情态的 Hero 同构：一行大字说"我在哪"、一行小字说"这一层是干什么的"、
          右侧同一位置放这一态的动作。读数不在这里（归侧栏「概览」槽与下面两组 chip） */}
      <div className="page-header">
        <div>
          <h1 className="page-title">全部项目</h1>
          <div className="page-head-sub">生活 / 工作 / 学习三个域的项目都在这里，点一张卡进入它的工作区。</div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            + 新建项目
          </button>
        </div>
      </div>

      {/* 筛选栏 = 一块卡、两行、两组筛选用同一个 chip。
          上行"筛什么"（状态 × 类型，组内互斥、组间取与），下行"怎么看"（视图 / 搜索 / 排序 / 显示 N/M）。
          两行的控件不一样是有意的：上行是"筛选组"，下行是"视图与查询" —— 本来就不同类；
          而两组筛选项之间必须长得一模一样，它们干的是同一件事。 */}
      <section className="card filter-bar">
        <div className="filter-bar-row is-groups">
          <div className="filter-group" role="group" aria-label="状态">
            <span className="filter-group-label" aria-hidden="true">
              状态
            </span>
            {STATUS_FACETS.map((facet) => {
              const on = status === facet.key
              return (
                <button
                  key={facet.key || 'all'}
                  type="button"
                  className={cn('facet', on && 'is-on')}
                  aria-pressed={on}
                  onClick={() => setStatus(facet.key)}
                >
                  {facet.label}
                  <span className="facet-count">{facetCount(projects, filter, 'status', facet.key)}</span>
                </button>
              )
            })}
          </div>

          <div className="filter-group" role="group" aria-label="类型">
            <span className="filter-group-label" aria-hidden="true">
              类型
            </span>
            {SCOPE_FACETS.map((facet) => {
              const on = scope === facet.key
              return (
                <button
                  key={facet.key}
                  type="button"
                  className={cn('facet', on && 'is-on')}
                  aria-pressed={on}
                  onClick={() => setScope(facet.key)}
                >
                  {facet.label}
                  <span className="facet-count">{facetCount(projects, filter, 'scope', facet.key)}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="filter-bar-row">
          <div className="seg">
            {VIEW_OPTIONS.map((option) => (
              <div
                key={option.value}
                className={cn('seg-btn', view === option.value && 'active')}
                onClick={() => setView(option.value)}
              >
                {option.label}
              </div>
            ))}
          </div>

          {/* 搜索框 = 全站那一个 `.search`（与 ⌘K 面板同一个组件）。
              文案比旧版短，且第四项换成了 `#标签`：`#标签` 是这一轮加的搜索语法，
                 不写在提示里没人猜得到（语法不占控件位，代价就是要靠文案教一次）。 */}
          <div className="search proj-search">
            <span className="search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
            </span>
            <input
              type="search"
              aria-label="搜索项目"
              placeholder="搜索 名称 / 描述 / #标签"
              title="支持 #标签 筛选（可多个，如 #重构 #客户A）；也可搜名称、描述、里程碑、本地目录"
              autoComplete="off"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>

          <select
            className="proj-input"
            aria-label="排序"
            value={sort}
            onChange={(event) => setSort(event.target.value as SortMode)}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          {/* 分母固定是域里的全部项目数，不跟着筛选动 —— "显示 3 / 8" 永远读作
              "8 个里显示了 3 个"；分母若改成"本类有几个"（选了类型就变 3），
              它会随着点击一直动，读起来不如一个不动的数稳。 */}
          <div className="toolbar-summary">
            显示 {list.length} / {projects.length}
          </div>
        </div>
      </section>

      {/* 加载态。原型是静态页没有这一态，而应用是真的异步取数（`api/projects.ts` 有 260ms
          模拟延迟）—— 那期间若直接走空态，会先说一句"没有匹配的项目"，是假话。 */}
      {isPending ? (
        <div className="card">
          <div className="q-empty">正在读取项目…</div>
        </div>
      ) : null}

      {/* 卡片视图 —— 每张卡就是一个对象，所以只有这一种卡带位移（见 CSS 里 `.card:hover` 那段） */}
      {view === 'cards' && list.length ? (
        <section className="view active" data-proj-panel="cards">
          <div className="proj-grid">
            {list.map((project) => (
              /*
               * 每张卡外面包一层 `.proj-card-item`，三个动作是卡片的兄弟：
               *    它们定位在卡片右上角、视觉上落在卡里，但不在卡片的子树里 ——
               *    于是"点删除顺手把项目打开了"（从按钮往上找 `[data-open-project]`
               *    找到那张卡）在结构上不可能发生，不需要 stopPropagation。
               * 已归档的卡片整体压一层透明度（`.is-archived`）：它的身份仍然可读，
               *    但一眼能看出"这一张不在台面上"。点它照样能进详情（归档不是删除）。
               */
              <div
                key={project.id}
                className={cn('proj-card-item', project.status === 'archived' && 'is-archived')}
              >
                {/* 图标按钮没有可见文字 ⇒ `title` / `aria-label` 必须带上项目名：
                    "编辑"与"编辑「老房翻新改造」"对读屏不是同一条信息。 */}
                <div className="proj-card-acts">
                  <button
                    type="button"
                    className="proj-act"
                    title={`编辑「${project.name}」`}
                    aria-label={`编辑「${project.name}」`}
                    onClick={() => setEditing(project)}
                  >
                    <Icon name="i-edit" />
                  </button>
                  {/* 已归档的卡片第二颗换成「恢复」—— 归档是软删除，必须有一条回头路；
                      少了它，归档就只是"删得没那么干净"。 */}
                  {project.status === 'archived' ? (
                    <button
                      type="button"
                      className="proj-act"
                      title={`恢复「${project.name}」`}
                      aria-label={`恢复「${project.name}」`}
                      onClick={() => restore(project)}
                    >
                      <Icon name="i-refresh" />
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="proj-act"
                      title={`归档「${project.name}」`}
                      aria-label={`归档「${project.name}」`}
                      onClick={() => archive(project)}
                    >
                      <Icon name="i-archive" />
                    </button>
                  )}
                  <button
                    type="button"
                    className="proj-act danger"
                    title={`删除「${project.name}」`}
                    aria-label={`删除「${project.name}」`}
                    onClick={() => setDeleting(project)}
                  >
                    <Icon name="i-trash" />
                  </button>
                </div>

                <div
                  className="card proj-card"
                  role="button"
                  tabIndex={0}
                  onClick={() => open(project.id)}
                >
                  <div className="proj-card-head">
                    <span className="badge badge-neutral">{SCOPE_LABEL[project.scope]}</span>
                    <span className={cn('badge', STATUS_BADGE[project.status])}>{STATUS_LABEL[project.status]}</span>
                    <span className={cn('prio', PRIO_CLASS[project.priority])} style={{ marginLeft: 'auto' }}>
                      {PRIO_LABEL[project.priority]}
                    </span>
                  </div>
                  <div className="proj-card-name">{project.name}</div>
                  <div className="proj-card-desc">{project.description}</div>
                  {/* 标签为空时整行不渲染：一个空的标签行会把它下面的进度条往下顶 8px，
                      同一行里"有标签的卡"和"没标签的卡"进度条就不在一条线上 ——
                      而新建的项目天然没有标签（原型同此）。 */}
                  {project.tags.length ? (
                    <div className="proj-card-tags">
                      {project.tags.map((tag) => (
                        <span key={tag} className="tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {/* 进度与它的读数同一行（`margin-top: auto` 让这一行连同下面的读数贴底）。
                      条单独一行时只是一根橙线，读不出"到哪了"：0% 与 100% 在条形上会被读成
                      "没有条"和"画满了"，而这一页的主语就是进度 ——
                      三个视图因此都能读到百分数（表格是右对齐的数字列、看板是短条 + 数字、这里长条 + 数字）。 */}
                  <div className="proj-card-progress">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${project.progress}%` }} />
                    </div>
                    <span className="proj-card-pct">{project.progress}%</span>
                  </div>
                  <div className="proj-card-foot">
                    <span>
                      {/* 还没有任务的新项目：写「还没有任务」而不是「0/0 任务」——
                          两句都是真的，前者才是人话（原型同此）。 */}
                      {project.tasksTotal
                        ? `${project.tasksDone}/${project.tasksTotal} 任务`
                        : '还没有任务'}{' '}
                      · 截止 {project.dueShort}
                    </span>
                    <span className={dueClass(project)} style={{ marginLeft: 'auto' }}>
                      {leftText(project)}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {/* 表格视图 —— 它是"横着比"的形态，所以必须有表头，且末四列定宽。
          这张卡不给内距（`.card.is-flush`）：内距归每一行，首列文字才和卡片视图同轴。 */}
      {view === 'table' && list.length ? (
        <section className="view active" data-proj-panel="table">
          <div className="card is-flush">
            <div className="proj-table">
              <div className="task-row is-head" aria-hidden="true">
                <div className="task-row-main">项目</div>
                <div className="task-row-right">
                  <span className="task-due">截止</span>
                  <span className="proj-progress">进度</span>
                  <span className="prio">优先级</span>
                  <span className="pill">状态</span>
                </div>
              </div>
              {list.map((project) => (
                <div
                  key={project.id}
                  className="task-row"
                  role="button"
                  tabIndex={0}
                  onClick={() => open(project.id)}
                >
                  <div className="task-row-main">
                    <div className="task-row-title">{project.name}</div>
                    <div className="task-row-sub">
                      <span className="tag">{SCOPE_LABEL[project.scope]}</span>
                      <span className="tag">{project.milestone}</span>
                    </div>
                  </div>
                  <div className="task-row-right">
                    <span className={cn('task-due', project.daysLeft < 0 && 'is-late')}>
                      {project.dueShort}
                      {project.daysLeft < 0 ? ' 逾期' : ''}
                    </span>
                    <span className="proj-progress">{project.progress}%</span>
                    <span className={cn('prio', PRIO_CLASS[project.priority])}>{PRIO_LABEL[project.priority]}</span>
                    <span
                      className={cn(
                        'pill',
                        project.status === 'done' ? 'pill-done' : project.status === 'active' ? 'pill-doing' : 'pill-todo',
                      )}
                    >
                      {STATUS_LABEL[project.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* 看板视图 —— 按状态分四栏（`.kanban.is-4`）。卡片视图 10 项读数、表格 6 项，
          看板原来只有项目名一项：同一栏里比不出任何东西，所以补一行"进度 + 剩几天"。
          这张卡保留内距，与表格不同：看板列是沉槽底、页底与它只差 1.05:1，
             去掉这层白面列的边界就看不见了。 */}
      {view === 'kanban' && list.length ? (
        <section className="view active" data-proj-panel="kanban">
          <div className="card">
            <div className="kanban is-4">
              {BOARD_ORDER.map((state) => {
                const items = list.filter((project) => project.status === state)
                return (
                  <div key={state} className="kanban-col">
                    <div className="kanban-title">
                      <span>{STATUS_LABEL[state]}</span>
                      <span>{items.length}</span>
                    </div>
                    {items.map((project) => (
                      <div
                        key={project.id}
                        className={cn('kanban-card', state === 'done' && 'is-done')}
                        role="button"
                        tabIndex={0}
                        onClick={() => open(project.id)}
                      >
                        <div className="kanban-card-name">{project.name}</div>
                        <div className="kanban-card-meta">
                          <span className="progress-mini">
                            <i style={{ width: `${project.progress}%` }} />
                          </span>
                          <span>{project.progress}%</span>
                          <span className="sep">·</span>
                          <span className={dueClass(project)}>{leftText(project)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>
        </section>
      ) : null}

      {/* 空态。两种空态给的不是同一件事（原型 `emptyHtml()` 的判据）：
          · 库里本来就没有项目 ⇒ 给「+ 新建项目」——那才是"没有项目"的下一步；
          · 只是被筛掉了 ⇒ 给「清空筛选」。让人自己去把两组筛选 + 关键词一项项清掉，
            既烦、又要他记得刚才点过哪些。
          加载中不算"空"（上一态另有一张卡），否则先闪一句"还没有项目"再说出 8 条。 */}
      {!isPending && list.length === 0 ? (
        <div className="card proj-empty">
          {projects.length === 0 ? (
            <>
              <div className="q-empty">这个域里还没有项目 —— 建一个开始。</div>
              <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                + 新建项目
              </button>
            </>
          ) : (
            <>
              <div className="q-empty">
                没有匹配的项目
                {activeTags.length ? `（正在按 ${activeTags.map((tag) => `#${tag}`).join(' ')} 筛标签）` : ''}
                {' '}—— 关键词或筛选条件收得太紧了
              </div>
              <button type="button" className="btn btn-ghost" onClick={clearFilters}>
                清空筛选
              </button>
            </>
          )}
        </div>
      ) : null}
      {/* 弹窗 —— 三个动作共用同一个容器（`WorkspaceModal` = 应用那套 `.modal-mask > .modal`）。
          挂在页面子树里（而不是 portal 到 body）：它要读这一页的令牌
             （模块强调色、面阶），而 `.modal-mask` 自带 `position: fixed; inset: 0`，
             不受 `.sb-app` 那个栅格影响。
          `key` 取项目 id：换一个项目再打开时，表单的局部 state 靠重挂载重建，
             不需要在打开时"填一遍值"。
          新建的类型默认跟着当前在看的类型走（「全部」时落回生活）—— 原型同此：
             在「工作」这一档里点新建，十有八九建的就是工作项目。 */}
      {creating ? (
        <ProjectFormModal
          mode="create"
          initial={blankProjectPatch(scope === 'all' ? 'life' : scope)}
          onClose={() => setCreating(false)}
          onSubmit={create}
        />
      ) : null}

      {editing ? (
        <ProjectFormModal
          key={editing.id}
          mode="edit"
          initial={formValueOf(editing)}
          onClose={() => setEditing(null)}
          onSubmit={save}
        />
      ) : null}

      {deleting ? (
        <ProjectDeleteModal
          project={deleting}
          onClose={() => setDeleting(null)}
          onConfirm={() => remove(deleting)}
        />
      ) : null}
    </WorkspaceLayout>
  )
}
