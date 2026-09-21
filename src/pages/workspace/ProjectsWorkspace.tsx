import { useMemo, useState, type CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { PendingDetail } from '../../components/workspace/PendingDetail'
import { useModuleTab } from '../../hooks/use-module-tab'
import { useProjectDetail } from '../../hooks/use-projects'
import { cn } from '../../lib/cn'
import { toast } from '../../stores/toast-store'
import {
  adaptActivity,
  adaptDocs,
  adaptMilestones,
  adaptTasks,
  cloneReview,
  DEMO_EDGES,
  DEMO_NOTES,
  DEMO_REVIEW,
  QUADS,
  type QuadKey,
  type WsNote,
  type WsReview,
  type WsTask,
  type WsTaskStatus,
} from '../../data/workspace/project'

/**
 * 项目工作区 —— `design/project/project_index.html` 的落地。
 *
 * 与另外八个模块页不同，这一页**不是生成物**：原型的这些面板由脚本按数据渲染
 * （三个任务视图、两个阅读器、一张图谱），转换器只搬静态标记。所以这一页是手写的，
 * `gen-workspace-pages.mjs` 的模块表里也没有它。
 *
 * 数据口径（这条决定了它和原型最大的差别）：
 *   · 任务 / 里程碑 / 文档 / 动态 = **真实派生**（`fetchProjectDetail` 按项目算），
 *     所以 8 个项目打开是 8 份不同内容，不是同一个模板；
 *   · 笔记 / 笔记连线 / 复盘 = 演示数据（应用没有这三张表），集中在
 *     `data/workspace/project.ts` 并显式标注。
 *
 * 状态由这一页独占：右栏、概览、三个任务视图、图谱详情读的都是同一份 ——
 * 交给子组件各自持一份必然会出现"勾了列表、右栏没少一条"。
 */
import { GraphPanel } from '../../components/workspace/project/graph-view'
import { ProjectAside, ProjectHeader } from '../../components/workspace/project/chrome'
import {
  DocDetailPanel,
  DocIndexPanel,
  NoteDetailPanel,
  NoteIndexPanel,
  NoteRow,
} from '../../components/workspace/project/content-views'
import { ReviewPanel } from '../../components/workspace/project/review-view'
import { MilestoneRail, TaskBoardPanel, TaskListPanel, TaskMatrixPanel } from '../../components/workspace/project/task-views'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import type { ModuleTab } from '../../data/workspace/types'
import type { ProjectApi } from '../../components/workspace/project/api'

const TABS: ModuleTab[] = [
  { key: 'overview', label: '概览' },
  { key: 'tasks', label: '任务' },
  { key: 'milestones', label: '里程碑' },
  { key: 'docs', label: '文档' },
  { key: 'notes', label: '笔记' },
  { key: 'graph', label: '知识图谱' },
  { key: 'timeline', label: '时间线' },
  { key: 'review', label: '复盘' },
  { key: 'settings', label: '设置' },
]

type TaskView = 'list' | 'board' | 'matrix'

/** 勾选框（概览的「接下来」用）。点它切换整条任务。 */
function Check({ api, task }: { api: ProjectApi; task: WsTask }) {
  const done = task.status === 'done'
  return (
    <div
      className={cn('task-check', done && 'done')}
      role="checkbox"
      aria-checked={done}
      tabIndex={0}
      onClick={() => api.toggleTask(task.id)}
      onKeyDown={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        api.toggleTask(task.id)
      }}
    >
      {done ? '✓' : ''}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 概览
 * ------------------------------------------------------------------ */

function OverviewPanel({ api, quadCount }: { api: ProjectApi; quadCount: Record<QuadKey, number> }) {
  const doing = api.tasks.filter((t) => t.status === 'doing').length
  const todo = api.tasks.filter((t) => t.status === 'todo').length
  const done = api.tasks.filter((t) => t.status === 'done').length
  const late = api.tasks.filter((t) => t.late)
  const doneM = api.milestones.filter((m) => m.state === 'done').length
  const next = api.milestones.find((m) => m.state === 'now')
  const starred = api.notes.filter((n) => n.star)
  /* 「接下来」= 还没开始的；右栏「当前任务」只列进行中的 —— 两块**按状态互斥**，
     天然不重叠，而不是靠"这里记得别重复那里"去手写排除（那是维护不了的规则） */
  const upcoming = api.tasks.filter((t) => t.status === 'todo').slice(0, 4)
  const total = api.tasks.length || 1

  return (
    <>
      <section className="ov-kpi">
        <div className="card ov-kpi-card" style={{ '--mw-kc': 'var(--mw-m-main)' } as CSSProperties}>
          <div className="ov-kpi-label">任务</div>
          <div className="ov-kpi-value">{api.tasks.length}</div>
          <div className="ov-kpi-sub">
            {doing} 进行中 · {todo} 待办 · {done} 完成
          </div>
        </div>
        {/* 里程碑这一格给的是"位置"不是"个数" —— 个数说明不了走到哪了 */}
        <div className="card ov-kpi-card" style={{ '--mw-kc': 'var(--mw-info)' } as CSSProperties}>
          <div className="ov-kpi-label">里程碑</div>
          <div className="ov-kpi-value">
            {doneM}/{api.milestones.length}
          </div>
          <div className="ov-kpi-sub">{next ? `下一关 ${next.name}` : '全部关卡已过'}</div>
        </div>
        {/* 原型这一格是「投入（工时）」；应用里没有工时数据，但**有预算** ——
            换成真实存在的字段，而不是编一个 86h 出来 */}
        <div className="card ov-kpi-card" style={{ '--mw-kc': 'var(--mw-q4)' } as CSSProperties}>
          <div className="ov-kpi-label">预算</div>
          <div className="ov-kpi-value">{api.project.budget}</div>
          <div className="ov-kpi-sub">{api.project.visibility}</div>
        </div>
        <div className="card ov-kpi-card" style={{ '--mw-kc': 'var(--mw-danger)' } as CSSProperties}>
          <div className="ov-kpi-label">逾期</div>
          <div className="ov-kpi-value">{late.length}</div>
          <div className="ov-kpi-sub">{late.length ? `最早一笔 ${late[0]?.due}` : '没有逾期任务'}</div>
        </div>
      </section>

      <section className="ov-grid">
        <div className="ov-col">
          <div className="card">
            <div className="ov-card-head">
              <div className="card-title">接下来</div>
              <div className="ov-pos">{todo} 条待办</div>
              <button className="ov-link" onClick={() => api.gotoTab('tasks')}>
                全部任务 →
              </button>
            </div>
            <div>
              {upcoming.length ? (
                upcoming.map((task) => (
                  <div key={task.id} className="task-item">
                    <Check api={api} task={task} />
                    <div className={cn('task-text', task.status === 'done' && 'done')}>{task.title}</div>
                    <span className={cn('task-due-inline', task.late && 'is-late')}>{task.due}</span>
                  </div>
                ))
              ) : (
                <div className="q-empty">没有待办任务</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="ov-card-head">
              <div className="card-title">最近活动</div>
              <button className="ov-link" onClick={() => api.gotoTab('timeline')}>
                时间线 →
              </button>
            </div>
            <div className="ov-timeline">
              {api.activity.slice(0, 3).map((item) => (
                <div key={item.id} className="activity">
                  <div className="activity-dot" />
                  <div className="activity-content">{item.text}</div>
                  <div className="activity-time">{item.time}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="ov-col">
          <div className="card">
            <div className="ov-card-head">
              <div className="card-title">收藏笔记</div>
              <div className="ov-pos">{starred.length} 条</div>
              <button className="ov-link" onClick={() => api.gotoTab('notes')}>
                全部笔记 →
              </button>
            </div>
            <div>
              {starred.length ? (
                starred.map((note) => <NoteRow key={note.id} api={api} note={note} />)
              ) : (
                <div className="q-empty">还没有收藏 —— 打开一条笔记，点「☆ 收藏」</div>
              )}
            </div>
          </div>

          <div className="card">
            <div className="ov-card-head">
              <div className="card-title">里程碑</div>
              <div className="ov-pos">
                已过 {doneM}/{api.milestones.length}
              </div>
              <button className="ov-link" onClick={() => api.gotoTab('milestones')}>
                全部 →
              </button>
            </div>
            {/* 概览只列"还没过完的"：已完成的收进上面那个计数，把版面留给"接下来" */}
            <MilestoneRail milestones={api.milestones} compact />
          </div>

          <div className="card">
            <div className="ov-card-head">
              <div className="card-title">任务分布</div>
              <button className="ov-link" onClick={() => api.gotoTabView('tasks', 'matrix')}>
                四象限 →
              </button>
            </div>
            <div>
              {(Object.keys(QUADS) as QuadKey[]).map((key) => {
                const n = quadCount[key]
                const pct = Math.round((n / total) * 100)
                /* ⚠️ 自定义属性要断言到 CSSProperties：那个类型里没有 `--x` 这样的键。
                   另外变量名必须是 `--mw-qc` / `var(--mw-q1)` —— 生成器已经给
                   原型的内联 style 加过前缀，这里手写也要跟上，否则取不到值。 */
                return (
                  <div key={key} className="dist-row" style={{ '--mw-qc': `var(--mw-${key})` } as CSSProperties}>
                    <span className="dist-name">{QUADS[key].name}</span>
                    <span className="dist-bar">
                      <i style={{ width: `${pct}%` }} />
                    </span>
                    <span className="dist-num">{n}</span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * 页面
 * ------------------------------------------------------------------ */

export function ProjectsWorkspace() {
  const { id } = useParams<{ id: string }>()
  const { data, isLoading, isError } = useProjectDetail(id)
  const basePath = `/projects/${id ?? ''}`
  const { active, select } = useModuleTab(basePath, TABS)

  /* ---- 页面独占的状态 ---- */
  const [statusOverride, setStatusOverride] = useState<Record<string, WsTaskStatus>>({})
  const [notes, setNotes] = useState<WsNote[]>(DEMO_NOTES)
  const [review, setReview] = useState<WsReview>(DEMO_REVIEW)
  const [reviewDraft, setReviewDraft] = useState<WsReview | null>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [taskView, setTaskView] = useState<TaskView>('list')
  const [openDocId, setOpenDocId] = useState<string | null>(null)
  const [openNoteId, setOpenNoteId] = useState<string | null>(null)

  /**
   * 勾选状态记在一张**覆盖表**里，而不是拿到数据后 `setState` 一份副本。
   *
   * 后者要在 effect 里同步（数据到达 → 写 state），于是首帧渲染的是空列表，
   * 而且"数据刷新把用户刚勾的状态冲掉"这类竞态要靠额外判断兜。
   * 覆盖表把"服务端来的"与"用户改的"分开：渲染时合并，数据怎么刷都不丢用户的改动。
   */
  const baseTasks = useMemo(() => (data ? adaptTasks(data.tasks) : []), [data])
  const tasks: WsTask[] = useMemo(
    () =>
      baseTasks.map((task) => {
        const next = statusOverride[task.id]
        return next && next !== task.status
          ? { ...task, status: next, late: next === 'done' ? false : task.late }
          : task
      }),
    [baseTasks, statusOverride],
  )

  const milestones = useMemo(() => (data ? adaptMilestones(data.milestones) : []), [data])
  const docs = useMemo(() => (data ? adaptDocs(data.documents) : []), [data])
  const activity = useMemo(() => (data ? adaptActivity(data.activity) : []), [data])

  const nodeKind = (nodeId: string): 'doc' | 'note' => (docs.some((d) => d.id === nodeId) ? 'doc' : 'note')
  const nodeLabel = (nodeId: string): string =>
    docs.find((d) => d.id === nodeId)?.name ?? notes.find((n) => n.id === nodeId)?.title ?? nodeId
  const neighbors = (nodeId: string): string[] =>
    DEMO_EDGES.filter((e) => e.a === nodeId || e.b === nodeId).map((e) => (e.a === nodeId ? e.b : e.a))

  const toggleTask = (taskId: string) => {
    setStatusOverride((prev) => {
      const current = prev[taskId] ?? baseTasks.find((t) => t.id === taskId)?.status
      const next: WsTaskStatus = current === 'done' ? 'todo' : 'done'
      const title = baseTasks.find((t) => t.id === taskId)?.title ?? ''
      toast(next === 'done' ? `已完成「${title}」` : `已重置「${title}」`)
      return { ...prev, [taskId]: next }
    })
  }

  const api: ProjectApi = {
    project: data?.project as ProjectApi['project'],
    tasks,
    milestones,
    docs,
    activity,
    notes,
    edges: DEMO_EDGES,
    review,
    reviewDraft,
    toggleTask,
    captureNote: (text) => {
      setNotes((prev) => [
        { id: `n${Date.now()}`, title: text, time: '刚刚', tag: '随手记', star: false, body: [], taskIndexes: [] },
        ...prev,
      ])
      toast(`已记下：${text}`)
    },
    toggleStar: (noteId) => setNotes((prev) => prev.map((n) => (n.id === noteId ? { ...n, star: !n.star } : n))),
    startReviewEdit: () => setReviewDraft(cloneReview(review)),
    cancelReviewEdit: () => {
      setReviewDraft(null)
      toast('已放弃改动')
    },
    saveReview: () => {
      if (!reviewDraft) return
      setReview({
        verdict: reviewDraft.verdict,
        score: reviewDraft.score,
        good: reviewDraft.good.map((x) => x.trim()).filter(Boolean),
        improve: reviewDraft.improve.map((x) => x.trim()).filter(Boolean),
        lesson: reviewDraft.lesson.map((x) => x.trim()).filter(Boolean),
      })
      setReviewDraft(null)
      toast('复盘已保存')
    },
    updateDraft: setReviewDraft,
    openDoc: (docId) => {
      setOpenDocId(docId)
      select('docs')
    },
    openNote: (noteId) => {
      setOpenNoteId(noteId)
      select('notes')
    },
    gotoTab: (tab) => select(tab),
    gotoTabView: (tab, view) => {
      if (view === 'list' || view === 'board' || view === 'matrix') setTaskView(view)
      select(tab)
    },
    notice: (text) => toast(text),
    nodeKind,
    nodeLabel,
    neighbors,
    selectedNode,
    selectNode: setSelectedNode,
  }

  if (isLoading || !data) {
    return (
      <WorkspaceLayout module="projects" tabs={TABS} active={active} onSelectTab={select}>
        <div className="card">
          <div className="q-empty">{isError ? '项目加载失败' : '正在读取项目…'}</div>
        </div>
      </WorkspaceLayout>
    )
  }

  const doc = openDocId ? docs.find((d) => d.id === openDocId) : undefined
  const note = openNoteId ? notes.find((n) => n.id === openNoteId) : undefined

  const quadCount = (Object.keys(QUADS) as QuadKey[]).reduce(
    (acc, key) => ({ ...acc, [key]: tasks.filter((t) => t.quad === key).length }),
    {} as Record<QuadKey, number>,
  )

  /* 返回条：文档与笔记共用一套主从约定（长内容不发明第二套承载方式） */
  const backBar = (label: string, onClick: () => void) => (
    <div
      className="crumb-back"
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        onClick()
      }}
    >
      <span aria-hidden="true">←</span>
      <span>{label}</span>
    </div>
  )

  return (
    <WorkspaceLayout
      module="projects"
      tabs={TABS}
      active={active}
      onSelectTab={select}
      topbarTitle={data.project.name}
      topbarActions={
        <>
          <button className="btn btn-ghost" onClick={() => api.notice('原型演示：归档项目')}>
            归档
          </button>
          <button className="btn btn-primary" onClick={() => api.notice('原型演示：新建任务')}>
            + 新建任务
          </button>
        </>
      }
      beforeTabs={<ProjectHeader api={api} />}
      rail={<ProjectAside api={api} />}
    >
      {active === 'overview' ? <OverviewPanel api={api} quadCount={quadCount} /> : null}

      {active === 'tasks' ? (
        <>
          <section className="card toolbar">
            <div className="seg">
              {(
                [
                  ['list', '列表'],
                  ['board', '看板'],
                  ['matrix', '四象限'],
                ] as Array<[TaskView, string]>
              ).map(([key, label]) => (
                <div key={key} className={cn('seg-btn', taskView === key && 'active')} onClick={() => setTaskView(key)}>
                  {label}
                </div>
              ))}
            </div>
            <div className="toolbar-summary">
              {tasks.length} 项 · {tasks.filter((t) => t.status === 'done').length} 已完成
              {tasks.filter((t) => t.late).length ? (
                <span className="text-danger"> · {tasks.filter((t) => t.late).length} 项逾期</span>
              ) : null}
            </div>
          </section>
          {/* 三个视图只挂当前那一个。原型的 `.view` 是 display:none 切换；
              同一份数据、同一套状态规则，排布不同而已 */}
          {taskView === 'list' ? <TaskListPanel api={api} /> : null}
          {taskView === 'board' ? <TaskBoardPanel api={api} /> : null}
          {taskView === 'matrix' ? <TaskMatrixPanel api={api} /> : null}
        </>
      ) : null}

      {active === 'milestones' ? (
        <section className="card">
          <div className="ov-card-head">
            <div className="card-title">里程碑</div>
            <div className="toolbar-summary">
              {milestones.length} 个 · {milestones.filter((m) => m.state === 'done').length} 已完成
            </div>
          </div>
          <MilestoneRail milestones={milestones} />
        </section>
      ) : null}

      {active === 'docs'
        ? doc
          ? (
              <>
                {backBar('返回文档索引', () => setOpenDocId(null))}
                <DocDetailPanel api={api} doc={doc} />
              </>
            )
          : <DocIndexPanel api={api} />
        : null}

      {active === 'notes'
        ? note
          ? (
              <>
                {backBar('返回笔记列表', () => setOpenNoteId(null))}
                <NoteDetailPanel api={api} note={note} />
              </>
            )
          : <NoteIndexPanel api={api} />
        : null}

      {active === 'graph' ? <GraphPanel api={api} /> : null}

      {active === 'timeline' ? (
        <section className="card">
          <div className="card-title">时间线</div>
          {activity.map((item) => (
            <div key={item.id} className="activity">
              <div className="activity-dot" />
              <div className="activity-content">{item.text}</div>
              <div className="activity-time">{item.time}</div>
            </div>
          ))}
        </section>
      ) : null}

      {active === 'review' ? <ReviewPanel api={api} /> : null}

      {active === 'settings' ? (
        <section className="card">
          <div className="card-title">项目设置</div>
          <div className="setting-row">
            <span>名称</span>
            <span>{data.project.name}</span>
          </div>
          <div className="setting-row">
            <span>截止</span>
            <span>{data.project.dueLong}</span>
          </div>
          <div className="setting-row">
            <span>预算</span>
            <span>{data.project.budget}</span>
          </div>
          <div className="setting-row">
            <span>仓库</span>
            <span>{data.project.repoUrl}</span>
          </div>
          {/* 原型的「归档 / 删除」两行是演示占位。删除是危险操作，
              在真实写操作实现之前不给一个"点了只会弹提示"的假入口 */}
          <PendingDetail source="原型 settings 面板的归档 / 删除（需要真实写操作，尚未实现）" />
        </section>
      ) : null}
    </WorkspaceLayout>
  )
}
