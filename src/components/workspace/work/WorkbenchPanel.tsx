import { useLayoutEffect, useMemo, useReducer, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { DOC_KIND_LABEL } from '../../../data/content-pool'
import { buildTasks, docUpdatedText, ownerDisplayName } from '../../../data/derive'
import { WORK_DOC_INDEX } from '../../../data/workspace/work-docs'
import { useProjects } from '../../../hooks/use-projects'
import { cn } from '../../../lib/cn'
import { toast } from '../../../stores/toast-store'
import { useRecentsStore } from '../../../stores/recents-store'
import { WorkspaceModal } from '../WorkspaceModal'
import { DocBook, type DocBookDoc } from '../project-detail/DocBook'
import { useSourceOverlay } from '../project-detail/doc-source/use-source-overlay'
import { OpsIcon } from '../project-detail/ops-icon'
import type { DocumentItem, Priority, Project, ProjectStatus } from '../../../types'

/* ============================================================================
   工作模块 · 工作台（`/work` 的第一个分区）
   原型：`design/work/work_index.html` 的 `[data-panel="dashboard"]`（2026-09-28 14:50 版）
   ----------------------------------------------------------------------------
   用户口径（写在原型那一段注释里）：「分上下两个卡片；下面的卡片显示今日任务；
   上面的卡片分为左右两个卡片，项目和文档，可以横向滚动选择，加一个放大按钮，
   当前卡片弹一层，表格展示项目和文档」。

   · 上：`.duo-track` 里两张卡（项目 / 文档），栏窄放不下时整条轨道横向滚，
     「当前卡片」= 离轨道左沿最近的那张（只在真的溢出时才画那圈描边 —— `is-narrow`）；
     每张卡各有一个「放大」，按当前视图摊成一张表弹出来（卡片要一眼看完，表格要看得全）。
   · 下：「今日任务」一张卡，三档视图（列表 / 看版 / 四象限）看的是同一份任务。

   ============================================================================
   数据从哪来（这一页不编数字，与「项目」分区那条纪律同源）
   ============================================================================
   原型里那 3 个项目、3 份文档、9 条任务都是设计样本。应用里三者都有真来源：

   | 块 | 来源 | 与原型样本的关系 |
   | --- | --- | --- |
   | 项目 | `useProjects()` 过滤 `scope === 'work'`（2 个） | 原型那 3 个样本不是数据源（`ProjectDrawers` 文件头写着同一条） |
   | 文档 | `WORK_DOC_INDEX` 按 `updatedHours` 取最近三本 | 恰好就是原型那三本（同一批 id 的移植），只是顺序按真实时间 |
   | 任务 | 上面那几个项目的 `buildTasks()` 拉平 | 名称 / 到期 / 优先级都是派生出来的真字段 |

   ============================================================================
   与原型有意不同的六处（"静态页 → 应用"必然要改的，不是审美）
   ============================================================================
   ① `.wi-page` 这一层作用域是必须的。`.seg` / `.seg-btn` / `.icon-btn` / `.card-title`
      这些名字在同一个模块的「文档索引」页（`DocLibrary` 的工具栏）也在用 ——
      不套这一层，工作台的 `.seg` 会以更高的特异性盖掉那一页的分段控件（零报错）。
   ② 不会「点空白把卡滚到位」：那条（`scrollIntoView`）在鼠标下才有意义，
      而 `block:'nearest'` 挡不住"顺手把 `.main` 也滚一下"的意外；卡头已经有放大按钮，
      横向滚动交给轨道本身的滚动手势。
   ③ 切视图是"重渲染"，不是 `item.hidden` 取反。原型那样做是为了不丢元素上的监听器
      （收藏星标直接绑在按钮上）；React 里星标是状态、`key` 稳定 ⇒ 筛完不重建，
      同一个目的用更短的写法达到。
   ④ 「收藏」是真的能改的（原型里文档的收藏只有状态、没有开关）：星记在会话级集合里
      （与运维页的连接状态同一条纪律：切走再回来还在、刷新回初值），
      开关在放大层那张表的「收藏」列上 —— 96px 的封面上再放一颗星会挤掉书名。
   ⑤ 项目卡的「最近」= 最近访问过的在前，其余按截止最近排。项目上没有"更新时间"这个字段
      （原型样本的 `2 小时前` 是编的），而应用真的记录了用户走过的路（`recents-store`）。
   ⑥ 四象限的"紧急"这一维：原型样本直接给了 `q: 1..4`，并注明"接真实数据时读优先级位"。
      应用里可用的是两个真信号 —— 重要 = 优先级 `high|mid`，紧急 = 逾期或在做（`doing`）。
   ============================================================================ */

/** 会话级收藏（与运维页的连接状态同一条纪律：切走再回来还在、刷新回初值） */
const STARRED = new Set<string>()
const starKey = (kind: 'p' | 'd', id: string) => `${kind}:${id}`

/**
 * 项目卡的 tone —— 与项目详情页的 `STATUS_CLASS` 同一套四色（rose / amber / purple / slate）。
 * 一页里同一个状态两个颜色，读起来就是两种状态。
 */
const TONE: Record<ProjectStatus, string> = {
  active: '#E11D48',
  risk: '#F59E0B',
  planning: '#8B5CF6',
  done: '#64748B',
  archived: '#64748B',
}

type DuoKey = 'projects' | 'docs'
type DuoView = 'recent' | 'star'
type TaskView = 'list' | 'board' | 'quad'

/** 工作台的一条任务 —— 从 `Task` 派生，只留这一页要用的几个字段 */
interface DashTask {
  key: string
  name: string
  /** 第二行：`项目名 · 负责人`（两样都是真字段） */
  meta: string
  /** 行尾那一列：任务的到期文案（`3 天后` / `已逾期 2 天` / `已完成`…） */
  when: string
  overdue: boolean
  done: boolean
  /** 四象限：重要（优先级 high|mid）× 紧急（逾期 / 在做） */
  urgent: boolean
  important: boolean
}

function toDashTask(project: Project, task: { id: string; name: string; status: string; priority: Priority; owner: string; due: string; late: boolean }): DashTask {
  return {
    key: task.id,
    name: task.name,
    meta: `${project.name} · ${ownerDisplayName(task.owner)}`,
    when: task.due,
    overdue: task.late,
    done: task.status === 'done',
    urgent: task.late || task.status === 'doing',
    important: task.priority !== 'low',
  }
}

export function WorkbenchPanel() {
  const navigate = useNavigate()
  const { data: allProjects = [], isLoading } = useProjects()
  const recents = useRecentsStore((state) => state.entries)
  /* 就地改会话级状态（收藏 / 勾选）之后要重算这一页 ⇒ 一个自增的重渲开关 */
  const [, forceRender] = useReducer((n: number) => n + 1, 0)

  const [projectView, setProjectView] = useState<DuoView>('recent')
  const [docView, setDocView] = useState<DuoView>('recent')
  const [taskView, setTaskView] = useState<TaskView>('list')
  const [doneOpen, setDoneOpen] = useState(false)
  const [zoom, setZoom] = useState<DuoKey | null>(null)
  /** 勾选记在覆盖表里（与项目详情页的任务同一口径）：不重建派生数据的一份副本 */
  const [doneOverride, setDoneOverride] = useState<Record<string, boolean>>({})
  /**
   * 上卡那条轨道的两个几何量：真的溢出（`is-narrow`）与当前卡片（`is-current`）。
   *
   * 只在溢出时才画那圈"当前"描边 —— 宽屏两卡都在眼前，"当前"没有意义，
   *    多一圈高亮只会让人问"为什么高亮它"（原型段头那条判据）。
   * 量距离用 `getBoundingClientRect()` 而不是 `offsetLeft`：`.mw-root` 是
   *    `position: relative` ⇒ 卡的 `offsetParent` 不是轨道，两者不在同一个坐标系里
   *    （差一个轨道自身的左沿），减出来的"距离"是错的。
   */
  const trackRef = useRef<HTMLDivElement>(null)
  const [duoNarrow, setDuoNarrow] = useState(false)
  const [duoCurrent, setDuoCurrent] = useState(0)

  /* 原文页：这一页的书直接开它（原来点了跳文档索引页，多一层才读得到正文）。
     页头那条细栏写的是"项目 › 文档"，而这一页是跨项目的 ⇒ 给模块名。 */
  const { openSource, sourceNode } = useSourceOverlay('工作', toast)

  /* ---------------- 项目 ---------------- */

  const projects = useMemo(() => {
    const rank = new Map<string, number>()
    /* 「最近」= 最近访问过的在前。路由记的是 `/work/projects/<id>/<分区>` ⇒ 取末段之前那一段 */
    recents.forEach((entry, i) => {
      const id = entry.path.split('/')[3]
      if (entry.path.startsWith('/work/projects/') && id && !rank.has(id)) rank.set(id, i)
    })
    return allProjects
      .filter((project) => project.scope === 'work')
      .slice()
      .sort((a, b) => {
        const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER
        const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER
        /* 都没访问过时按「截止最近」—— 与应用既有的 `due` 排序同一个口径 */
        return ra !== rb ? ra - rb : a.daysLeft - b.daysLeft
      })
  }, [allProjects, recents])

  const lateCountOf = (project: Project) => buildTasks(project).filter((task) => task.late && task.status !== 'done').length

  const shownProjects = projectView === 'star' ? projects.filter((p) => STARRED.has(starKey('p', p.id))) : projects

  /* ---------------- 文档 ---------------- */

  const docs = useMemo(
    () => WORK_DOC_INDEX.slice().sort((a, b) => a.updatedHours - b.updatedHours),
    [],
  )
  /* 卡里只摆最近三本（原型那一格就是一行三本 96px 的书）；要看全部走卡头的「放大」 */
  const shownDocs = (docView === 'star' ? docs.filter((doc) => STARRED.has(starKey('d', doc.id))) : docs).slice(0, 3)

  const docOf = (doc: DocumentItem): DocBookDoc => ({
    name: doc.name,
    kind: doc.kind,
    /* 副题：存在哪儿。原型那一格写的是版本号，而应用的文档没有版本字段 ——
       `DocBook` 的副题口径本来就是"它存在哪儿"（部署手册那一档才是版本号）。 */
    source: doc.source,
    author: doc.author,
    updatedHours: doc.updatedHours,
    updatedAt: doc.updatedAt,
  })

  /* ---------------- 今日任务 ---------------- */

  const tasks = useMemo<DashTask[]>(
    () => projects.flatMap((project) => buildTasks(project).map((task) => toDashTask(project, task))),
    [projects],
  )
  const isDone = (task: DashTask) => doneOverride[task.key] ?? task.done
  const open = tasks.filter((task) => !isDone(task))
  const finished = tasks.filter((task) => isDone(task))

  const toggleTask = (task: DashTask) => {
    const next = !isDone(task)
    setDoneOverride((prev) => ({ ...prev, [task.key]: next }))
    toast(next ? `已完成「${task.name}」` : `已重置「${task.name}」`)
  }

  const toggleStar = (kind: 'p' | 'd', id: string) => {
    const key = starKey(kind, id)
    if (STARRED.has(key)) STARRED.delete(key)
    else STARRED.add(key)
    forceRender()
  }

  const starOf = (kind: 'p' | 'd', id: string) => STARRED.has(starKey(kind, id))

  /* ---------------- 三种任务视图 ---------------- */

  const whenOf = (task: DashTask) =>
    task.when ? <span className={cn('dash-when', task.overdue && 'is-overdue')}>{task.when}</span> : null

  const taskRow = (task: DashTask) => (
    <div key={task.key} className="dash-row">
      <button
        type="button"
        className={cn('task-check', isDone(task) && 'done')}
        aria-pressed={isDone(task)}
        aria-label={isDone(task) ? `把「${task.name}」标记为未完成` : `把「${task.name}」标记为已完成`}
        onClick={() => toggleTask(task)}
      >
        {isDone(task) ? '✓' : ''}
      </button>
      <div className={cn('task-text', isDone(task) && 'done')}>
        <div className="dash-row-name">{task.name}</div>
        <div className="dash-row-meta">{task.meta}</div>
      </div>
      {whenOf(task)}
    </div>
  )

  const taskGroup = (name: string, list: DashTask[], overdue = false) => (
    <div className="dash-group">
      <div className="dash-group-head">
        <span className={cn('dash-group-name', overdue && 'is-overdue')}>{name}</span>
        <span className="dash-group-count">{list.length}</span>
      </div>
      {list.map(taskRow)}
    </div>
  )

  const listView = (
    <>
      {taskGroup('逾期', open.filter((task) => task.overdue), true)}
      {taskGroup('今天', open.filter((task) => !task.overdue))}
      {/* 已完成折叠在里面，不另立一块（原型用原生 `<details>`；开合状态由状态记住，
          重渲染之后不会被重置回去） */}
      <details className="dash-done" open={doneOpen} onToggle={(event) => setDoneOpen(event.currentTarget.open)}>
        <summary>
          <OpsIcon name="chevR" size={13} />
          今天已完成 {finished.length} 条
        </summary>
        <div className="dash-done-body">
          {finished.map((task) => (
            <div key={task.key} className="task-item">
              <button type="button" className="task-check done" aria-label={`把「${task.name}」标记为未完成`} onClick={() => toggleTask(task)}>
                ✓
              </button>
              <div className="task-text done">{task.name}</div>
            </div>
          ))}
        </div>
      </details>
    </>
  )

  const boardView = (
    <div className="board">
      {[
        { name: '逾期', list: open.filter((task) => task.overdue), overdue: true },
        { name: '今天', list: open.filter((task) => !task.overdue), overdue: false },
        { name: '已完成', list: finished, overdue: false },
      ].map((col) => (
        <div key={col.name} className="board-col">
          <div className="board-head">
            <span className={cn('dash-group-name', col.overdue && 'is-overdue')}>{col.name}</span>
            <span className="board-count">{col.list.length}</span>
          </div>
          <div className="board-cards">
            {col.list.length ? (
              col.list.map((task) => (
                <article key={task.key} className={cn('board-card', isDone(task) && 'is-done')}>
                  <div className="board-card-name">{task.name}</div>
                  <div className="board-card-meta">{task.meta}</div>
                  <div className="board-card-foot">
                    <button
                      type="button"
                      className={cn('task-check', isDone(task) && 'done')}
                      aria-pressed={isDone(task)}
                      aria-label={isDone(task) ? `把「${task.name}」标记为未完成` : `把「${task.name}」标记为已完成`}
                      onClick={() => toggleTask(task)}
                    >
                      {isDone(task) ? '✓' : ''}
                    </button>
                    {whenOf(task)}
                  </div>
                </article>
              ))
            ) : (
              <div className="board-empty">暂无</div>
            )}
          </div>
        </div>
      ))}
    </div>
  )

  const quads: Array<{ name: string; important: boolean; urgent: boolean }> = [
    { name: '重要且紧急', important: true, urgent: true },
    { name: '重要不紧急', important: true, urgent: false },
    { name: '不重要紧急', important: false, urgent: true },
    { name: '不重要不紧急', important: false, urgent: false },
  ]

  const quadView = (
    <>
      <div className="quad">
        {quads.map((quad) => {
          const list = open.filter((task) => task.important === quad.important && task.urgent === quad.urgent)
          return (
            <div key={quad.name} className="quad-cell">
              <div className="quad-head">
                <span className="dash-group-name">{quad.name}</span>
                <span className="quad-count">{list.length}</span>
              </div>
              <div className="quad-list">
                {list.length ? (
                  list.map((task) => (
                    <div key={task.key} className="quad-item">
                      <button type="button" className="task-check" aria-label={`把「${task.name}」标记为已完成`} onClick={() => toggleTask(task)} />
                      <span className="quad-item-name">{task.name}</span>
                      {whenOf(task)}
                    </div>
                  ))
                ) : (
                  <div className="quad-empty">没有落在这一格的事</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      {/* 四象限只看还没做的 ⇒ 已完成那几条必须有交代，不能凭空消失 */}
      <div className="quad-note">已完成 {finished.length} 条不计入象限（四象限只看还没做的）</div>
    </>
  )

  /* 轨道几何：挂载后量一次，滚动（rAF 节流）与窗口尺寸变化时重量 */
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    let ticking = false
    const measure = () => {
      setDuoNarrow(track.scrollWidth > track.clientWidth + 1)
      const panels = Array.from(track.querySelectorAll<HTMLElement>('.duo-panel'))
      const left = track.getBoundingClientRect().left
      let best = 0
      let bestDist = Number.POSITIVE_INFINITY
      panels.forEach((panel, i) => {
        const dist = Math.abs(panel.getBoundingClientRect().left - left)
        if (dist < bestDist) {
          bestDist = dist
          best = i
        }
      })
      setDuoCurrent(best)
    }
    measure()
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        measure()
      })
    }
    track.addEventListener('scroll', onScroll)
    window.addEventListener('resize', measure)
    return () => {
      track.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', measure)
    }
  }, [projects.length])

  /* ---------------- 放大层（表格） ---------------- */

  const zoomRows = zoom === 'projects' ? shownProjects : shownDocs
  const zoomTitle = zoom
    ? `${zoom === 'projects' ? '项目' : '文档'} · ${(zoom === 'projects' ? projectView : docView) === 'star' ? '收藏' : '最近'} ${zoomRows.length} ${zoom === 'projects' ? '个' : '本'}`
    : ''

  return (
    <div className="wi-page">
      {/* 上部两卡：项目 / 文档。横向滚动 + 当前卡片描边由下面的 effect 之外的手势自然产生 */}
      <div ref={trackRef} className={cn('duo-track', duoNarrow && 'is-narrow')}>
        <section className={cn('card duo-panel', duoCurrent === 0 && 'is-current')}>
          <div className="duo-head">
            <div className="card-title">项目</div>
            <div className="seg" role="group" aria-label="项目视图">
              {(['recent', 'star'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn('seg-btn', projectView === value && 'is-on')}
                  aria-pressed={projectView === value}
                  title={value === 'recent' ? '最近访问过的在前，其余按截止最近' : '只看收藏的项目'}
                  onClick={() => setProjectView(value)}
                >
                  {value === 'recent' ? '最近' : '收藏'}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="icon-btn duo-zoom"
              title="放大：表格查看当前视图"
              aria-label="放大：表格查看当前视图"
              onClick={() => setZoom('projects')}
            >
              <OpsIcon name="expand" size={15} />
            </button>
          </div>
          <div className="duo-body">
            {isLoading ? (
              <div className="duo-empty">正在读取项目…</div>
            ) : shownProjects.length ? (
              <div className="tile-grid">
                {shownProjects.map((project) => (
                  <div
                    key={project.id}
                    className="tile"
                    style={{ '--tone': TONE[project.status] } as CSSProperties}
                    role="button"
                    tabIndex={0}
                    onClick={() => navigate(`/work/projects/${project.id}`)}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter' && event.key !== ' ') return
                      event.preventDefault()
                      navigate(`/work/projects/${project.id}`)
                    }}
                  >
                    <span className="tile-top is-drawer" aria-hidden="true" />
                    <span className="tile-head">
                      <span className="tile-name">{project.name}</span>
                      <button
                        type="button"
                        className={cn('dash-star', starOf('p', project.id) && 'on')}
                        aria-pressed={starOf('p', project.id)}
                        title={starOf('p', project.id) ? '取消收藏' : '收藏'}
                        aria-label={`${starOf('p', project.id) ? '取消收藏' : '收藏'}「${project.name}」`}
                        onClick={(event) => {
                          event.stopPropagation()
                          toggleStar('p', project.id)
                        }}
                      >
                        <OpsIcon name="star" size={15} />
                      </button>
                    </span>
                    <span className="tile-meta">
                      {project.progress}% · {project.dueShort}
                      {lateCountOf(project) > 0 ? <span className="dash-alert">{lateCountOf(project)} 项逾期</span> : null}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="duo-empty">{projectView === 'star' ? '还没有收藏的项目 —— 点卡片右上那枚星' : '还没有工作项目'}</div>
            )}
          </div>
        </section>

        <section className={cn('card duo-panel', duoCurrent === 1 && 'is-current')}>
          <div className="duo-head">
            <div className="card-title">文档</div>
            <div className="seg" role="group" aria-label="文档视图">
              {(['recent', 'star'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={cn('seg-btn', docView === value && 'is-on')}
                  aria-pressed={docView === value}
                  onClick={() => setDocView(value)}
                >
                  {value === 'recent' ? '最近' : '收藏'}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="icon-btn duo-zoom"
              title="放大：表格查看当前视图"
              aria-label="放大：表格查看当前视图"
              onClick={() => setZoom('docs')}
            >
              <OpsIcon name="expand" size={15} />
            </button>
          </div>
          <div className="duo-body">
            {/* 金缎带在这一页表已收藏（不是「今天动过」）—— 见 `DocBook` 的 `marked` 口子 */}
            {shownDocs.length ? (
              <div className="doc-books">
                {shownDocs.map((doc) => (
                  <DocBook key={doc.id} doc={docOf(doc)} marked={starOf('d', doc.id)} onOpen={() => openSource(doc)} />
                ))}
              </div>
            ) : (
              <div className="duo-empty">{docView === 'star' ? '还没有收藏的文档 —— 在卡头的「放大」里点那一列' : '还没有文档索引'}</div>
            )}
          </div>
        </section>
      </div>

      {/* 下部：今日任务（一份数据，三张视图） */}
      <section className="card dash-card">
        <div className="dash-head">
          <div className="card-title">今日任务</div>
          <div className="seg" role="group" aria-label="任务视图">
            {([['list', '列表'], ['board', '看版'], ['quad', '四象限']] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                className={cn('seg-btn', taskView === value && 'is-on')}
                aria-pressed={taskView === value}
                onClick={() => setTaskView(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="icon-btn" title="新建任务" aria-label="新建任务" onClick={() => toast('新建任务：还没有写接口')}>
            <OpsIcon name="plus" size={15} />
          </button>
        </div>

        {tasks.length ? (taskView === 'list' ? listView : taskView === 'board' ? boardView : quadView) : <div className="duo-empty">这两个项目名下还没有任务</div>}
      </section>

      {/* 放大层：把当前卡片按当前视图摊成一张表 */}
      {zoom ? (
        <WorkspaceModal title={zoomTitle} wide onClose={() => setZoom(null)}>
          {zoom === 'projects' ? (
            <table className="duo-table">
              <thead>
                <tr>
                  <th>项目</th>
                  <th>负责人</th>
                  <th>进度</th>
                  <th>截止</th>
                  <th>状态</th>
                  <th>收藏</th>
                </tr>
              </thead>
              <tbody>
                {shownProjects.map((project) => {
                  const late = lateCountOf(project)
                  return (
                    <tr key={project.id}>
                      <td>
                        <b>{project.name}</b>
                      </td>
                      <td>{project.owners.map((owner) => ownerDisplayName(owner)).join(' · ')}</td>
                      <td>
                        <span className="duo-prog">
                          <span className="duo-prog-track">
                            <i style={{ '--p': `${project.progress}%` } as CSSProperties} />
                          </span>
                          <b>{project.progress}%</b>
                        </span>
                      </td>
                      <td className="col-num">{project.dueShort}</td>
                      <td>{late > 0 ? <span className="dash-alert">{late} 项逾期</span> : <span className="col-dim">正常</span>}</td>
                      <td>
                        <button
                          type="button"
                          className={cn('dash-star', starOf('p', project.id) && 'on')}
                          aria-pressed={starOf('p', project.id)}
                          aria-label={`${starOf('p', project.id) ? '取消收藏' : '收藏'}「${project.name}」`}
                          onClick={() => toggleStar('p', project.id)}
                        >
                          <OpsIcon name="star" size={15} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          ) : (
            <table className="duo-table">
              <thead>
                <tr>
                  <th>文档</th>
                  <th>分类</th>
                  <th>来源</th>
                  <th>最近更新</th>
                  <th>收藏</th>
                </tr>
              </thead>
              <tbody>
                {shownDocs.map((doc) => (
                  <tr key={doc.id}>
                    <td>
                      <b>{doc.name}</b>
                    </td>
                    <td>{DOC_KIND_LABEL[doc.kind]}</td>
                    <td>{doc.source}</td>
                    <td>{docUpdatedText(doc.updatedHours)}</td>
                    <td>
                      <button
                        type="button"
                        className={cn('dash-star', starOf('d', doc.id) && 'on')}
                        aria-pressed={starOf('d', doc.id)}
                        aria-label={`${starOf('d', doc.id) ? '取消收藏' : '收藏'}「${doc.name}」`}
                        onClick={() => toggleStar('d', doc.id)}
                      >
                        <OpsIcon name="star" size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </WorkspaceModal>
      ) : null}

      {sourceNode}
    </div>
  )
}
