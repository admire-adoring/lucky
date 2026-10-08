import { useState } from 'react'
import {
  clockToMin,
  DEMO_TODAY,
  durationText,
  estText,
  minToClock,
  PRIO_LABEL,
  SCOPE_LABEL,
  STATE_LABEL,
  stampLabel,
  TASK_SECTIONS,
  TASK_VIEWS,
  type TaskRow,
  type TaskSectionKey,
} from '../../../data/workspace/tasks'
import { toast } from '../../../stores/toast-store'
import { WorkspaceModal } from '../../../components/workspace/WorkspaceModal'
import { useTaskApi } from './task-state'

/**
 * 「任务」的四个弹窗。
 *
 * 弹窗本体用应用的 `WorkspaceModal`（外壳的 `.modal-mask > .modal`），
 *    不搬原型那份 —— 原型那套要自己管 `.open` 类、自己在 document 上挂 Esc、
 *    自己判断点遮罩关闭；这些都已经是应用组件的职责（见它的文件头）。
 *    这里只写弹窗里的内容与按钮的动作。
 *
 * 四个弹窗各有一条"不许假装"的红线（项目口径：动作/数字会不会让界面显示
 *    一个系统里不存在的东西）：
 *    · 新建任务 → 真的往这份数据里加一条（不是 alert 一句"已创建"）；
 *    · 排期 → 真的写 `scheduledStart`（空档跟着变），放不下就直说；
 *    · 详情里的主按钮 → 按来源分派到真动作（不是只改个标记）；
 *    · AI 拆解 → 明说没有通道。这一页没有模型调用能力，
 *      按钮点下去假装"拆好了"会比不给这个按钮更糟，所以在弹窗里就写明。
 */

/* ============================================================
 * 新建任务
 * ============================================================ */

export function NewTaskModal({ date }: { date: string }) {
  const api = useTaskApi()
  const [title, setTitle] = useState('')
  const [scope, setScope] = useState<TaskRow['scope']>('work')
  const [prio, setPrio] = useState<TaskRow['prio']>('mid')
  const [due, setDue] = useState(date)
  const [project, setProject] = useState('无')
  const [note, setNote] = useState('')

  const submit = () => {
    const text = title.trim()
    if (!text) {
      toast('先写个标题')
      return
    }
    api.addTask({
      title: text,
      scope,
      prio,
      due,
      project: project === '无' ? undefined : project,
      note: note.trim() || undefined,
    })
  }

  return (
    <WorkspaceModal
      title={`新建任务${due === DEMO_TODAY ? '' : ` · ${due.slice(5).replace('-', '/')}`}`}
      onClose={api.closeNewTask}
    >
      <div className="form-field">
        <label className="form-label">任务标题</label>
        <input
          className="form-input"
          placeholder="要做什么…"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="form-label">领域</label>
        <select
          className="form-select"
          value={scope}
          onChange={(event) => setScope(event.target.value as TaskRow['scope'])}
        >
          <option value="life">生活</option>
          <option value="work">工作</option>
          <option value="learn">学习</option>
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">优先级</label>
        <select
          className="form-select"
          value={prio}
          onChange={(event) => setPrio(event.target.value as TaskRow['prio'])}
        >
          <option value="high">高</option>
          <option value="mid">中</option>
          <option value="low">低</option>
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">截止时间</label>
        <input
          className="form-input"
          type="date"
          value={due}
          onChange={(event) => setDue(event.target.value)}
        />
      </div>
      <div className="form-field">
        <label className="form-label">关联项目</label>
        <select
          className="form-select"
          value={project}
          onChange={(event) => setProject(event.target.value)}
        >
          <option value="无">无</option>
          <option value="个人系统前端">个人系统前端</option>
          <option value="支付系统重构">支付系统重构</option>
        </select>
      </div>
      <div className="form-field">
        <label className="form-label">备注</label>
        <textarea
          className="form-textarea"
          placeholder="补充说明…"
          value={note}
          onChange={(event) => setNote(event.target.value)}
        />
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={api.closeNewTask}>
          取消
        </button>
        <button type="button" className="btn btn-primary" onClick={submit}>
          创建
        </button>
      </div>
    </WorkspaceModal>
  )
}

/* ============================================================
 * AI 拆解
 * ============================================================ */

export function AiBreakdownModal() {
  const api = useTaskApi()
  const [text, setText] = useState('')
  return (
    <WorkspaceModal title="✨ AI 拆解任务" onClose={api.closeAi}>
      <div className="form-field">
        <label className="form-label">输入一句话，AI 帮你拆成子任务</label>
        <textarea
          className="form-textarea"
          placeholder="例如：上线个人系统前端"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        {/*
          这一段是主动偏离原型的地方，理由只有一条：这一页没有模型调用能力。
             原型的「拆解」按钮弹一句"原型演示：AI 拆解"就结束了。
             摆一颗按下去"看起来拆完了"的按钮，比不摆更糟 —— 用户分不清
             "没做"和"卡住了"。所以这里在弹窗里就把事实写清楚。
             要接真模型时改的是 `onClick`（把请求发出去），这段说明同时删掉。
        */}
        <p className="form-hint">
          当前没有接入模型通道：这一页**不会**发送任何请求，也不会凭空生成子任务。
          接入后这一步的产物应当是一组可编辑的子任务草稿。
        </p>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={api.closeAi}>
          取消
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled
          title="还没有可用的模型通道"
        >
          拆解
        </button>
      </div>
    </WorkspaceModal>
  )
}

/* ============================================================
 * 排期（先补齐时长）
 * ============================================================ */

const EST_OPTIONS = [15, 30, 45, 60, 90, 120]

export function ScheduleModal({ row }: { row: TaskRow }) {
  const api = useTaskApi()
  const [minutes, setMinutes] = useState(row.estMin ?? 30)
  return (
    <WorkspaceModal title={`排期 · ${row.title}`} onClose={api.closeSchedule}>
      <div className="form-field">
        <label className="form-label">预估时长</label>
        <select
          className="form-select"
          value={minutes}
          onChange={(event) => setMinutes(Number(event.target.value))}
        >
          {EST_OPTIONS.map((value) => (
            <option value={value} key={value}>
              {value >= 60 ? `${value / 60} 小时` : `${value} 分钟`}
            </option>
          ))}
        </select>
        <p className="form-hint">
          时长决定它占多少空档。没填时长的任务不进时间轴 —— 否则「空档」是假的。
        </p>
      </div>
      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={api.closeSchedule}>
          取消
        </button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => api.schedule(row.id, minutes)}
        >
          排进去
        </button>
      </div>
    </WorkspaceModal>
  )
}

/* ============================================================
 * 任务详情
 * ============================================================ */

export function TaskDetailModal({ row, section }: { row: TaskRow; section: TaskSectionKey }) {
  const api = useTaskApi()
  const done = row.state === 'done'

  /**
   * 主按钮按来源分派（原型的 `actionLabel`）：
   *   看板里的卡 → 推进到下一列；其余 → 标记完成 / 取消完成。
   *
   * 原型还分了"时间轴块 = 这一段时段用掉了""矩阵项 / 日历 chip = 从这一格划掉"，
   *    那三件事在数据上都是同一个写入（`state=done` + `completed_at=now`），
   *    差别只在视觉。所以这里合成了一个动作，只有看板的"推进"是真的另一个语义。
   */
  const boardView = api.view === 'board' && section === 'all'
  const label = boardView && !done ? '推进到下一列' : done ? '取消完成' : '标记完成'
  const act = () => {
    if (boardView && !done) api.advance(row.id)
    else api.toggleDone(row.id)
    api.closeDetail()
  }

  const sectionLabel = TASK_SECTIONS.find((item) => item.key === section)?.label ?? ''
  const viewLabel = section === 'all' ? TASK_VIEWS.find((item) => item.key === api.view)?.label : null
  const est = row.estMin ?? 0
  const endAt = row.scheduledStart
    ? minToClock(clockToMin(row.scheduledStart) + est)
    : null

  return (
    <WorkspaceModal title={row.title} onClose={api.closeDetail}>
      {/*
        原型是从被点的那一个元素上把 `.list-tag` / `.list-meta` 的文本抓下来当 chips，
           于是同一个任务在列表里点开是"工作 / 高 / 逾期 2 天"、在矩阵里点开只剩一条 ——
           那是"从 DOM 抓标签"这个实现方式的副产品，不是设计意图。
           这里统一成这条任务自己的四个标签（领域 / 优先级 / 截止 / 时长）。
      */}
      <div className="detail-meta">
        <span className="list-tag">{SCOPE_LABEL[row.scope]}</span>
        <span className="list-tag">{PRIO_LABEL[row.prio]}优先级</span>
        <span className="list-meta">{row.dueLabel}</span>
        <span className="list-meta">{estText(row)}</span>
      </div>

      <div className="detail-row">
        <span className="k">状态</span>
        <span className="v">{STATE_LABEL[row.state]}</span>
      </div>
      <div className="detail-row">
        <span className="k">截止</span>
        <span className="v">{stampLabel(row.dueAt)}</span>
      </div>
      <div className="detail-row">
        <span className="k">预估</span>
        <span className="v">{est ? durationText(est) : '—'}</span>
      </div>
      <div className="detail-row">
        <span className="k">排期</span>
        {/* 有没有排期，是"待排池"与"时间轴"的唯一区别 —— 这个字段必须看得见 */}
        <span className="v">
          {row.scheduledStart && endAt ? `${row.scheduledStart}–${endAt}` : '未排期'}
        </span>
      </div>
      <div className="detail-row">
        <span className="k">关联项目</span>
        <span className="v">{row.project ?? '—'}</span>
      </div>
      <div className="detail-row">
        <span className="k">创建于</span>
        <span className="v">{stampLabel(row.createdAt)}</span>
      </div>
      <div className="detail-row">
        <span className="k">更新于</span>
        <span className="v">{stampLabel(row.updatedAt)}</span>
      </div>
      {row.completedAt ? (
        <div className="detail-row">
          <span className="k">完成于</span>
          <span className="v">{stampLabel(row.completedAt)}</span>
        </div>
      ) : null}
      {row.inboxAt ? (
        <div className="detail-row">
          <span className="k">进收件箱</span>
          <span className="v">{stampLabel(row.inboxAt)}</span>
        </div>
      ) : null}
      <div className="detail-row">
        <span className="k">所在</span>
        <span className="v">
          {sectionLabel}
          {viewLabel ? ` · 视图「${viewLabel}」` : ''}
        </span>
      </div>

      <div className="form-actions">
        <button type="button" className="btn btn-ghost" onClick={api.closeDetail}>
          关闭
        </button>
        <button type="button" className="btn btn-primary" onClick={act}>
          {label}
        </button>
      </div>
    </WorkspaceModal>
  )
}
