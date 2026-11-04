/* 学习模块面板。
 * 数据源：真实后端 hook（learning 域 6 张表）。
 * NotesPanel 仍复用 DocLibrary（走 useOwnerDocs）。
 */
import { useState } from 'react'
import { DocLibrary } from '../../../components/workspace/project-detail/DocLibrary'
import { useOwnerDocs } from '../../../hooks/use-docs'
import {
  useGoals, useGoalActions,
  useSkills, useSkillActions,
  useResources, useResourceActions,
  useReviewsDue, useReviewActions,
  useOutputs, useOutputActions,
  useLearningOverview,
} from '../../../hooks/use-learning'
import type {
  LearningGoal,
} from '../../../api/learning'
import type { ModuleTab } from '../../../data/workspace/types'

export const TABS: ModuleTab[] = [
  { key: 'dashboard', label: '概览' },
  { key: 'goals', label: '学习目标' },
  { key: 'skills', label: '技能地图' },
  { key: 'resources', label: '资源库' },
  { key: 'notes', label: '笔记' },
  { key: 'review', label: '复习' },
  { key: 'projects', label: '实践项目' },
  { key: 'output', label: '输出' },
]

export interface Handlers {
  closeModal: () => void
  notice: (arg0: string) => void
  openNote: (arg0: string) => void
  openOutput: (arg0: string) => void
  openResource: (arg0: string) => void
  openReview: (arg0: string) => void
}

export const MODAL_SPECS = {
  openResource: { title: '资源详情', arg: true },
  openNote: { title: '笔记', arg: true },
  openReview: { title: '复习', arg: true },
  openOutput: { title: '输出详情', arg: true },
} as const

export type ModalKey = keyof typeof MODAL_SPECS

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

/* ============ 概览 ============ */

export function DashboardPanel({ handlers }: { handlers: Handlers }) {
  const { data: ov } = useLearningOverview()
  const { data: due } = useReviewsDue(todayStr())
  const { data: resources } = useResources()

  const weekHours = ov ? (ov.weekMinutes / 60).toFixed(1) : '0'
  const activeResources = resources?.filter((r) => r.status === 'active') ?? []

  return (
    <>
      <section className="card hero">
        <h1>学习概览 📚</h1>
        <p>本周已学习 {weekHours} 小时。</p>
        <div className="hero-meta">
          <span>本周学习：<strong>{weekHours}h</strong></span>
          <span>待复习：<strong>{ov?.pendingReview ?? 0}</strong></span>
          <span>进行中资源：<strong>{ov?.activeResource ?? 0}</strong></span>
          <span>已发布输出：<strong>{ov?.totalOutput ?? 0}</strong></span>
        </div>
      </section>
      <section className="grid-3">
        <div className="card">
          <div className="card-title">本周学习</div>
          <div className="stat">{weekHours}h</div>
          <div className="stat-desc">目标 10h · {Math.min(100, Math.round((Number(weekHours) / 10) * 100))}%</div>
          <div className="progress-bar" style={{ marginTop: '8px' }}>
            <div className="progress-fill" style={{ width: `${Math.min(100, (Number(weekHours) / 10) * 100)}%` }}></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">待复习</div>
          <div className="stat">{ov?.pendingReview ?? 0}</div>
          <div className="stat-desc">今日到期 {ov?.todayReview ?? 0} 条</div>
          <div className="progress-bar" style={{ marginTop: '8px' }}>
            <div className="progress-fill" style={{ width: `${Math.min(100, (ov?.todayReview ?? 0) * 20)}%` }}></div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">进行中目标</div>
          <div className="stat">{ov?.activeGoal ?? 0}</div>
          <div className="stat-desc">进行中资源 {ov?.activeResource ?? 0} 个</div>
          <div className="progress-bar" style={{ marginTop: '8px' }}>
            <div className="progress-fill" style={{ width: '50%' }}></div>
          </div>
        </div>
      </section>
      <section className="grid-2">
        <div className="card">
          <div className="card-title">进行中资源</div>
          {activeResources.length > 0 ? (
            activeResources.slice(0, 5).map((r) => (
              <div className="resource-item" key={r.id} onClick={() => handlers.openResource(r.id)}>
                <div className="resource-title">{r.title}</div>
                <div className="resource-meta">{kindLabel(r.kind)} · 进度 {r.progress}%</div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${r.progress}%` }}></div>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">还没有进行中的资源</div>
          )}
        </div>
        <div className="card">
          <div className="card-title">今日待复习</div>
          {due && due.length > 0 ? (
            due.slice(0, 5).map((r) => (
              <div className="review-item" key={r.id} onClick={() => handlers.openReview(r.id)}>
                <div className="review-question">{r.question}</div>
                <div className="review-meta">
                  {r.tag ? <span className="review-badge">{r.tag}</span> : null}
                  <span>{r.dueDate}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">今日无待复习卡片</div>
          )}
        </div>
      </section>
    </>
  )
}

/* ============ 学习目标 ============ */

export function GoalsPanel({ handlers: _handlers }: { handlers: Handlers }) {
  const { data: goals } = useGoals()
  const actions = useGoalActions()

  return (
    <>
      <section className="card">
        <div className="card-title">学习目标</div>
        {goals && goals.length > 0 ? (
          goals.map((g) => (
            <GoalRow key={g.id} goal={g} onSave={(input) => actions.update.mutate({ id: g.id, input })} onDelete={() => actions.remove.mutate(g.id)} />
          ))
        ) : (
          <div className="empty-state">还没有目标，点下方按钮添加</div>
        )}
        <div style={{ marginTop: '12px' }}>
          <button className="btn btn-primary" onClick={() => {
            const title = window.prompt('目标标题')
            if (!title) return
            actions.create.mutate({ title, description: '', progress: 0, targetDate: '', status: 'active' })
          }}>+ 添加目标</button>
        </div>
      </section>
    </>
  )
}

function GoalRow({ goal, onSave, onDelete }: { goal: LearningGoal; onSave: (input: { title: string; description: string; progress: number; targetDate: string; status: string }) => void; onDelete: () => void }) {
  return (
    <div className="goal-item">
      <div className="goal-title">{goal.title}</div>
      <div className="goal-desc">{goal.description || '无描述'}</div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: `${goal.progress}%` }}></div></div>
      <div className="progress-label">
        <span>{goal.progress}%</span>
        <span>{goal.targetDate || '无截止'}</span>
      </div>
      <div className="form-actions" style={{ marginTop: '8px' }}>
        <button className="btn btn-ghost btn-sm" onClick={() => {
          const progress = window.prompt('更新进度 (0-100)', String(goal.progress))
          if (progress === null) return
          const n = Math.max(0, Math.min(100, Number(progress)))
          if (Number.isNaN(n)) return
          onSave({ title: goal.title, description: goal.description, progress: n, targetDate: goal.targetDate, status: goal.status })
        }}>更新进度</button>
        <button className="btn btn-ghost btn-sm" onClick={() => { if (window.confirm('删除这个目标？')) onDelete() }}>删除</button>
      </div>
    </div>
  )
}

/* ============ 技能地图 ============ */

export function SkillsPanel({ handlers: _handlers }: { handlers: Handlers }) {
  const { data: skills } = useSkills()
  const actions = useSkillActions()

  return (
    <>
      <section className="card">
        <div className="card-title">技能地图</div>
        {skills && skills.length > 0 ? (
          skills.map((s) => (
            <div className="skill-item" key={s.id}>
              <div className="skill-name">{s.name}</div>
              <div className="skill-level">
                {[1, 2, 3, 4, 5].map((n) => (
                  <div key={n} className={`skill-dot ${n <= s.level ? 'on' : ''}`}
                    onClick={() => actions.update.mutate({ id: s.id, input: { name: s.name, level: n, category: s.category } })}>
                  </div>
                ))}
              </div>
              <button className="btn btn-ghost btn-sm" style={{ marginLeft: '8px' }} onClick={() => { if (window.confirm('删除这个技能？')) actions.remove.mutate(s.id) }}>×</button>
            </div>
          ))
        ) : (
          <div className="empty-state">还没有技能</div>
        )}
        <div style={{ marginTop: '12px' }}>
          <button className="btn btn-primary" onClick={() => {
            const name = window.prompt('技能名称')
            if (!name) return
            actions.create.mutate({ name, level: 1, category: '' })
          }}>+ 添加技能</button>
        </div>
      </section>
    </>
  )
}

/* ============ 资源库 ============ */

export function ResourcesPanel({ handlers }: { handlers: Handlers }) {
  const { data: resources } = useResources()
  const actions = useResourceActions()
  const list = resources ?? []

  return (
    <>
      <section className="card">
        <div className="card-title">学习资源</div>
        {list.length > 0 ? (
          list.map((r) => (
            <div className="resource-item" key={r.id} onClick={() => handlers.openResource(r.id)}>
              <div className="resource-title">{r.title}</div>
              <div className="resource-meta">
                {kindLabel(r.kind)} · 进度 {r.progress}% · {statusLabel(r.status)}
                {r.lastStudyAt ? ` · 最近 ${r.lastStudyAt}` : ''}
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${r.progress}%` }}></div>
              </div>
              {r.tags ? (
                <div className="resource-tags">
                  {r.tags.split(',').filter(Boolean).map((t) => <span className="resource-tag" key={t}>{t.trim()}</span>)}
                </div>
              ) : null}
            </div>
          ))
        ) : (
          <div className="empty-state">还没有资源</div>
        )}
        <div style={{ marginTop: '12px' }}>
          <button className="btn btn-primary" onClick={() => {
            const title = window.prompt('资源标题')
            if (!title) return
            const kind = window.prompt('类型 (doc/book/course/article)', 'doc') || 'doc'
            actions.create.mutate({ title, kind, progress: 0, tags: '', status: 'active', lastStudyAt: '', ownerId: '' })
          }}>+ 添加资源</button>
        </div>
      </section>
    </>
  )
}

/* ============ 笔记（复用 DocLibrary）============ */

export function NotesPanel({ handlers }: { handlers: Handlers }) {
  const notes = useOwnerDocs('note', 'learn')
  return (
    <DocLibrary
      docs={notes}
      owner={{ kind: 'note', id: 'learn' }}
      projectName="学习模块"
      groupLabel="来源与主题"
      notice={(text) => handlers.notice(text)}
    />
  )
}

/* ============ 复习 ============ */

export function ReviewPanel({ handlers }: { handlers: Handlers }) {
  const { data: due } = useReviewsDue(todayStr())
  const actions = useReviewActions()
  const list = due ?? []

  return (
    <>
      <section className="card">
        <div className="card-title">今日待复习（{list.length}）</div>
        {list.length > 0 ? (
          list.map((r) => (
            <div className="review-item" key={r.id} onClick={() => handlers.openReview(r.id)}>
              <div className="review-question">{r.question}</div>
              <div className="review-meta">
                {r.tag ? <span className="review-badge">{r.tag}</span> : null}
                <span>到期 {r.dueDate}</span>
                <span>间隔 {r.intervalDays} 天</span>
                <span>已复习 {r.reviewedCount} 次</span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">今日无待复习卡片</div>
        )}
        <div style={{ marginTop: '12px' }}>
          <button className="btn btn-primary" onClick={() => {
            const question = window.prompt('问题')
            if (!question) return
            const answer = window.prompt('答案（可留空）', '') || ''
            const tag = window.prompt('标签（可留空）', '') || ''
            actions.create.mutate({ question, answer, tag, dueDate: todayStr(), ownerId: '' })
          }}>+ 新建卡片</button>
        </div>
      </section>
    </>
  )
}

/* ============ 输出 ============ */

export function OutputPanel({ handlers }: { handlers: Handlers }) {
  const { data: outputs } = useOutputs()
  const actions = useOutputActions()
  const list = outputs ?? []

  return (
    <>
      <section className="card">
        <div className="card-title">输出作品</div>
        {list.length > 0 ? (
          list.map((o) => (
            <div className="doc-item" key={o.id} onClick={() => handlers.openOutput(o.id)}>
              <div className="doc-icon">{outputKindIcon(o.kind)}</div>
              <div className="doc-info">
                <div className="doc-name">{o.title}</div>
                <div className="doc-meta">
                  {outputKindLabel(o.kind)} · {statusLabel(o.status)}
                  {o.publishedAt ? ` · ${o.publishedAt}` : ''}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">还没有输出作品</div>
        )}
        <div style={{ marginTop: '12px' }}>
          <button className="btn btn-primary" onClick={() => {
            const title = window.prompt('标题')
            if (!title) return
            const kind = window.prompt('类型 (blog/share/project/note)', 'blog') || 'blog'
            actions.create.mutate({ title, kind, status: 'draft', publishedAt: '', url: '', summary: '', ownerId: '' })
          }}>+ 添加输出</button>
        </div>
      </section>
    </>
  )
}

/* ============ 顶栏 ============ */

export function TopbarActions({ handlers: _handlers }: { handlers: Handlers }) {
  return null
}

/* ============ 弹窗 ============ */

export function OpenResourceModal({ handlers, resourceId }: { handlers: Handlers; resourceId: string }) {
  const { data: resources } = useResources()
  const actions = useResourceActions()
  const res = resources?.find((r) => r.id === resourceId)

  if (!res) return <div className="empty-state">资源不存在</div>

  return (
    <>
      <div className="detail-section">
        <div className="detail-label">资源信息</div>
        <ul className="detail-list">
          <li>标题：{res.title}</li>
          <li>类型：{kindLabel(res.kind)}</li>
          <li>进度：{res.progress}%</li>
          <li>状态：{statusLabel(res.status)}</li>
          {res.lastStudyAt ? <li>最近学习：{res.lastStudyAt}</li> : null}
          {res.tags ? <li>标签：{res.tags}</li> : null}
        </ul>
      </div>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={() => handlers.closeModal()}>关闭</button>
        <button className="btn btn-primary" onClick={() => {
          const progress = window.prompt('更新进度 (0-100)', String(res.progress))
          if (progress === null) return
          const n = Math.max(0, Math.min(100, Number(progress)))
          if (Number.isNaN(n)) return
          actions.update.mutate(
            { id: res.id, input: { title: res.title, kind: res.kind, progress: n, tags: res.tags, status: res.status, lastStudyAt: todayStr(), ownerId: res.ownerId } },
            { onSuccess: () => handlers.closeModal() },
          )
        }}>更新进度</button>
        <button className="btn btn-ghost" onClick={() => {
          if (window.confirm('删除这个资源？')) actions.remove.mutate(res.id, { onSuccess: () => handlers.closeModal() })
        }}>删除</button>
      </div>
    </>
  )
}

export function OpenNoteModal({ handlers }: { handlers: Handlers }) {
  return (
    <>
      <div className="detail-section">
        <div className="detail-label">笔记</div>
        <div className="empty-state">笔记在「笔记」分区用 DocLibrary 管理。</div>
      </div>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={() => handlers.closeModal()}>关闭</button>
      </div>
    </>
  )
}

export function OpenReviewModal({ handlers, reviewId }: { handlers: Handlers; reviewId: string }) {
  const { data: due } = useReviewsDue(todayStr())
  const all = due ?? []
  const card = all.find((r) => r.id === reviewId)
  const actions = useReviewActions()
  const [revealed, setRevealed] = useState(false)

  if (!card) return <div className="empty-state">卡片不存在或已复习</div>

  return (
    <>
      <div className="detail-section">
        <div className="detail-label">问题</div>
        <div className="detail-text">{card.question}</div>
      </div>
      {card.tag ? <div className="review-meta"><span className="review-badge">{card.tag}</span></div> : null}
      <div className="detail-section">
        <div className="detail-label">答案</div>
        <div className="detail-text">
          {revealed ? card.answer || '（未填写答案）' : '点击「显示答案」查看。'}
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={() => handlers.closeModal()}>关闭</button>
        {!revealed ? (
          <button className="btn btn-ghost" onClick={() => setRevealed(true)}>显示答案</button>
        ) : null}
        {revealed ? (
          <>
            <button className="btn btn-ghost" onClick={() => actions.grade.mutate({ id: card.id, grade: 0 }, { onSuccess: () => handlers.closeModal() })}>忘了</button>
            <button className="btn btn-ghost" onClick={() => actions.grade.mutate({ id: card.id, grade: 1 }, { onSuccess: () => handlers.closeModal() })}>模糊</button>
            <button className="btn btn-primary" onClick={() => actions.grade.mutate({ id: card.id, grade: 2 }, { onSuccess: () => handlers.closeModal() })}>记得</button>
            <button className="btn btn-primary" onClick={() => actions.grade.mutate({ id: card.id, grade: 3 }, { onSuccess: () => handlers.closeModal() })}>很熟</button>
          </>
        ) : null}
        <button className="btn btn-ghost" onClick={() => { if (window.confirm('删除这张卡？')) actions.remove.mutate(card.id, { onSuccess: () => handlers.closeModal() }) }}>删除</button>
      </div>
    </>
  )
}

export function OpenOutputModal({ handlers, outputId }: { handlers: Handlers; outputId: string }) {
  const { data: outputs } = useOutputs()
  const actions = useOutputActions()
  const item = outputs?.find((o) => o.id === outputId)

  if (!item) return <div className="empty-state">输出不存在</div>

  return (
    <>
      <div className="detail-section">
        <div className="detail-label">输出信息</div>
        <ul className="detail-list">
          <li>标题：{item.title}</li>
          <li>类型：{outputKindLabel(item.kind)}</li>
          <li>状态：{statusLabel(item.status)}</li>
          {item.publishedAt ? <li>发布时间：{item.publishedAt}</li> : null}
          {item.url ? <li>链接：<a href={item.url} target="_blank" rel="noreferrer">{item.url}</a></li> : null}
          {item.summary ? <li>摘要：{item.summary}</li> : null}
        </ul>
      </div>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={() => handlers.closeModal()}>关闭</button>
        <button className="btn btn-primary" onClick={() => {
          const status = window.prompt('状态 (draft/published/archived)', item.status)
          if (!status) return
          actions.update.mutate(
            { id: item.id, input: { title: item.title, kind: item.kind, status, publishedAt: item.publishedAt, url: item.url, summary: item.summary, ownerId: item.ownerId } },
            { onSuccess: () => handlers.closeModal() },
          )
        }}>更新状态</button>
        <button className="btn btn-ghost" onClick={() => {
          if (window.confirm('删除这个输出？')) actions.remove.mutate(item.id, { onSuccess: () => handlers.closeModal() })
        }}>删除</button>
      </div>
    </>
  )
}

/* ============ 工具函数 ============ */

function kindLabel(kind: string): string {
  return { doc: '文档', book: '书', course: '课程', article: '文章' }[kind] ?? kind
}
function statusLabel(status: string): string {
  return { active: '进行中', done: '已完成', paused: '已暂停', draft: '草稿', published: '已发布', archived: '已归档' }[status] ?? status
}
function outputKindLabel(kind: string): string {
  return { blog: '博客', share: '分享', project: '项目', note: '笔记' }[kind] ?? kind
}
function outputKindIcon(kind: string): string {
  return { blog: '📝', share: '🎤', project: '🔧', note: '📒' }[kind] ?? '📝'
}
