import { useState } from 'react'
import { cn } from '../../../lib/cn'
import { docIcon, parseRuns, type WsBlock, type WsDoc, type WsNote, type WsRun } from '../../../data/workspace/project'
import type { ProjectApi } from './api'

/**
 * 文档与笔记。
 *
 * 两者共用一套**主从约定**：索引 ⇄ 详情（`screen` 切换 + 返回条）。
 * 原型把这条约定写进了注释 —— 长内容不发明第二套承载方式，
 * 所以这里文档与笔记的详情外壳是同一个形状。
 */

/* ------------------------------------------------------------------ *
 * 富文本
 * ------------------------------------------------------------------ */

function Runs({ runs }: { runs: WsRun[] }) {
  return (
    <>
      {runs.map((run, i) =>
        run.code ? (
          <code key={i}>{run.text}</code>
        ) : run.strong ? (
          <strong key={i}>{run.text}</strong>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  )
}

/**
 * 正文块：`{ h, p }` 或 `{ h, ul }`。
 *
 * ⚠️ 不用 `dangerouslySetInnerHTML`。原型的演示文案里带 `<code>` 这类内联 HTML，
 * 而 `parseRuns` 已经把反引号 / 双星号解析成片段了 —— 数据仍可读，
 * 渲染层拿到的是结构化数据，不是一段会被当代码执行的字符串。
 */
export function Prose({ blocks }: { blocks: WsBlock[] }) {
  return (
    <div className="prose">
      {blocks.map((block, i) => (
        <div key={i}>
          <h4>{block.h}</h4>
          {block.p ? (
            <p>
              <Runs runs={block.p} />
            </p>
          ) : null}
          {block.ul ? (
            <ul>
              {block.ul.map((item, j) => (
                <li key={j}>
                  <Runs runs={item} />
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ))}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 反向链接 / 关系清单
 * ------------------------------------------------------------------ */

/**
 * 关系清单。`mode` 决定点击后的动作：
 *   · `open`  —— 直接打开它（用在文档 / 笔记详情里）
 *   · `select` —— 在图谱里选中它（便于顺着链往下走）
 * 原型用同一个渲染、两个 data 属性区分，这里用两个回调，语义一样。
 */
export function NeighborList({
  api,
  id,
  mode,
}: {
  api: ProjectApi
  id: string
  mode: 'open' | 'select'
}) {
  const neighbors = api.neighbors(id)
  if (!neighbors.length) return <div className="q-empty">还没有连线</div>
  return (
    <>
      {neighbors.map((nid) => {
        const isDoc = api.nodeKind(nid) === 'doc'
        return (
          <div
            key={nid}
            className="backlink"
            role="button"
            tabIndex={0}
            onClick={() => (mode === 'open' ? (isDoc ? api.openDoc(nid) : api.openNote(nid)) : api.selectNode(nid))}
            onKeyDown={(event) => {
              if (event.key !== ' ' && event.key !== 'Enter') return
              event.preventDefault()
              if (mode === 'open') {
                if (isDoc) api.openDoc(nid)
                else api.openNote(nid)
              } else {
                api.selectNode(nid)
              }
            }}
          >
            <span className="backlink-icon">{isDoc ? '📄' : '📝'}</span>
            <span>{api.nodeLabel(nid)}</span>
          </div>
        )
      })}
    </>
  )
}

/** 关联任务。原型按 id 查任务；这里按**下标**查（任务来自真实派生，id 随项目变）。 */
export function RelatedTasks({ api, indexes }: { api: ProjectApi; indexes: number[] }) {
  const rows = indexes.map((i) => api.tasks[i]).filter((t): t is NonNullable<typeof t> => Boolean(t))
  const done = rows.filter((t) => t.status === 'done').length
  return (
    <div className="card">
      <div className="card-title">关联任务</div>
      {rows.length ? (
        rows.map((task) => (
          <div key={task.id} className="task-item">
            <div
              className={cn('task-check', task.status === 'done' && 'done')}
              role="checkbox"
              aria-checked={task.status === 'done'}
              tabIndex={0}
              onClick={() => api.toggleTask(task.id)}
              onKeyDown={(event) => {
                if (event.key === ' ' || event.key === 'Enter') {
                  event.preventDefault()
                  api.toggleTask(task.id)
                }
              }}
            >
              {task.status === 'done' ? '✓' : ''}
            </div>
            <div className={cn('task-text', task.status === 'done' && 'done')}>{task.title}</div>
            <span className={cn('pill', task.status === 'done' ? 'pill-done' : task.status === 'doing' ? 'pill-doing' : 'pill-todo')}>
              {task.status === 'done' ? '已完成' : task.status === 'doing' ? '进行中' : '待办'}
            </span>
          </div>
        ))
      ) : (
        <div className="q-empty">没有关联任务（已完成 {done}）</div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 文档
 * ------------------------------------------------------------------ */

export function DocIndexPanel({ api }: { api: ProjectApi }) {
  return (
    <section className="card">
      <div className="card-title">文档索引</div>
      {api.docs.length === 0 ? <div className="q-empty">还没有索引到文档</div> : null}
      {api.docs.map((doc) => (
        <DocIndexRow key={doc.id} api={api} doc={doc} />
      ))}
    </section>
  )
}

function DocIndexRow({ api, doc, index = 0 }: { api: ProjectApi; doc: WsDoc; index?: number }) {
  return (
    <div
      className="doc-item"
      role="button"
      tabIndex={0}
      onClick={() => api.openDoc(doc.id)}
      onKeyDown={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        api.openDoc(doc.id)
      }}
    >
      <div className="doc-icon">{docIcon(index)}</div>
      <div className="doc-info">
        <div className="doc-name">{doc.name}</div>
        <div className="doc-meta">
          {doc.source} · {doc.updatedAt}
        </div>
      </div>
      <span className="doc-arrow" aria-hidden="true">
        ›
      </span>
    </div>
  )
}

/**
 * 文档详情。
 *
 * ⚠️ 与原型**形态不同，但这是数据决定的**：原型里有几篇文档带完整正文
 * （sections + callout + 目录），而应用的文档模型只有
 * `{ name, source, summary, updatedAt }` —— 「工作文档正文留在原工具，
 * 个人系统只存索引、链接、脱敏摘要」是 `docs/模块设计.md` 定下的原则。
 * 所以这里渲染的是原型里那个**外部索引变体**（链接卡 + 反向链接），
 * 而不是给自己编一段不存在的正文。
 */
export function DocDetailPanel({ api, doc }: { api: ProjectApi; doc: WsDoc }) {
  const index = api.docs.findIndex((d) => d.id === doc.id)
  return (
    <>
      <section className="card">
        <div className="doc-head">
          <div className="doc-head-icon">{docIcon(index)}</div>
          <div className="doc-head-main">
            <div className="doc-head-title">{doc.name}</div>
            <div className="doc-head-meta">
              <span className="pill pill-todo">{doc.source}</span>
              <span>{doc.updatedAt}</span>
            </div>
          </div>
          <div className="doc-head-actions">
            <button className="btn btn-ghost" onClick={() => api.notice('已复制文档链接')}>
              复制链接
            </button>
            <button className="btn btn-primary" onClick={() => api.notice(`打开文档：${doc.name}`)}>
              打开
            </button>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="link-card">
          <div className="doc-head-icon">{docIcon(index)}</div>
          <div className="link-card-main">
            <div className="doc-name">{doc.source}</div>
            <div className="link-card-url">{doc.summary}</div>
          </div>
          <button className="btn btn-primary" onClick={() => api.notice('打开来源系统')}>
            打开来源
          </button>
        </div>
      </section>

      <section className="card">
        <div className="card-title">反向链接</div>
        <NeighborList api={api} id={doc.id} mode="open" />
      </section>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * 笔记
 * ------------------------------------------------------------------ */

/**
 * 摘要：正文首段；随手记没有正文，标题本身就是内容。
 *
 * ⚠️ 数据里存的已经是**解析好的片段**（`parseRuns` 在定义数据时就跑过了），
 * 所以这里只做拼接，不再解析一次 —— 再解析一次会去认反引号，
 * 而那些字符早就被拆走了，等于白跑。
 */
export function noteSnippet(note: WsNote): string {
  const first = note.body[0]
  if (!first?.p) return note.title
  return first.p.map((run) => run.text).join('')
}

/**
 * 笔记行：右栏、概览、笔记索引**共用同一个渲染** ——
 * 改一次样式三处同时生效。这是原型明确写下的约定。
 */
export function NoteRow({ api, note }: { api: ProjectApi; note: WsNote }) {
  return (
    <div
      className="note-row"
      role="button"
      tabIndex={0}
      onClick={() => api.openNote(note.id)}
      onKeyDown={(event) => {
        if (event.key !== ' ' && event.key !== 'Enter') return
        event.preventDefault()
        api.openNote(note.id)
      }}
    >
      <div className="note-row-head">
        <span className="note-row-title" title={note.title}>
          {note.title}
        </span>
        <span className="note-row-time">{note.time}</span>
      </div>
      <div className="note-row-snippet">{noteSnippet(note)}</div>
    </div>
  )
}

/** 捕获类入口用"就在那儿的输入框"，不写成按钮 —— 捕获路径上不许多一个动作。 */
export function NoteCapture({ api, placeholder = '记一笔…' }: { api: ProjectApi; placeholder?: string }) {
  const [text, setText] = useState('')
  return (
    <label className="note-capture">
      <input
        type="text"
        value={text}
        placeholder={placeholder}
        autoComplete="off"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== 'Enter') return
          const trimmed = text.trim()
          if (!trimmed) return
          api.captureNote(trimmed)
          setText('')
        }}
      />
      <span className="note-capture-key">↵</span>
    </label>
  )
}

export function NoteIndexPanel({ api }: { api: ProjectApi }) {
  const starred = api.notes.filter((n) => n.star).length
  return (
    <section className="card">
      <div className="ov-card-head">
        <div className="card-title">关联笔记</div>
        <div className="ov-pos">
          {api.notes.length} 条{starred ? ` · ${starred} 条收藏` : ''}
        </div>
        <div style={{ marginLeft: 'auto', flex: '0 1 240px' }}>
          <NoteCapture api={api} />
        </div>
      </div>
      {api.notes.map((note) => (
        <div
          key={note.id}
          className="doc-item"
          role="button"
          tabIndex={0}
          onClick={() => api.openNote(note.id)}
          onKeyDown={(event) => {
            if (event.key !== ' ' && event.key !== 'Enter') return
            event.preventDefault()
            api.openNote(note.id)
          }}
        >
          <div className="doc-icon">📝</div>
          <div className="doc-info">
            <div className="doc-name">{note.title}</div>
            <div className="doc-meta">
              {note.tag}笔记 · {note.time}
              {note.star ? ' · ★ 已收藏' : ''}
            </div>
          </div>
          <span className="doc-arrow" aria-hidden="true">
            ›
          </span>
        </div>
      ))}
    </section>
  )
}

export function NoteDetailPanel({ api, note }: { api: ProjectApi; note: WsNote }) {
  const blocks: WsBlock[] = note.body.length ? note.body : [{ h: '内容', p: parseRuns(note.title) }]
  return (
    <>
      <section className="card">
        <div className="doc-head">
          <div className="doc-head-icon">📝</div>
          <div className="doc-head-main">
            <div className="doc-head-title">{note.title}</div>
            <div className="doc-head-meta">
              <span className="pill pill-todo">{note.tag}笔记</span>
              <span>{note.time}</span>
            </div>
          </div>
          <div className="doc-head-actions">
            <button
              className={cn('btn btn-ghost btn-star', note.star && 'is-on')}
              onClick={() => api.toggleStar(note.id)}
            >
              {note.star ? '★ 已收藏' : '☆ 收藏'}
            </button>
            <button className="btn btn-ghost" onClick={() => api.notice(`在编辑器中打开：${note.title}`)}>
              编辑
            </button>
          </div>
        </div>
      </section>

      <section className="doc-body-grid">
        <div className="card">
          <Prose blocks={blocks} />
        </div>
        <div className="doc-side">
          <RelatedTasks api={api} indexes={note.taskIndexes} />
          <div className="card">
            <div className="card-title">相关</div>
            <NeighborList api={api} id={note.id} mode="open" />
          </div>
          <div className="card">
            <div className="card-title">所属</div>
            <div className="backlink" onClick={() => api.notice('跳转到知识库')}>
              <span className="backlink-icon">📚</span>
              <span>知识库</span>
            </div>
            <div className="backlink" onClick={() => api.notice(`跳转到项目「${api.project.name}」`)}>
              <span className="backlink-icon">🧩</span>
              <span>{api.project.name}</span>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
