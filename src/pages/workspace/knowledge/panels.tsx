/**
 * knowledge 模块的面板与弹窗。
 *
 * 原本由 `design/gen-workspace-pages.mjs` 从 `design/know/knowledge_index.html`
 * 生成（全是静态摆位数据），生成链已退役 —— 现在手写维护，数据全部走真实后端 hook
 * （`useNotes` / `useTags` / `useNoteActions`）。
 *
 * 这里只有视图：每个 onclick 仍被翻译成 `handlers.xxx(...)`，
 * 路由与弹窗外壳写在手写的 <KnowledgeWorkspace />（同目录）。
 */
import { useState } from 'react'
import type { ModuleTab } from '../../../data/workspace/types'
import { KnowledgeGraph } from '../../../components/workspace/knowledge/KnowledgeGraph'
import { useNoteActions, useNotes, useTags } from '../../../hooks/use-knowledge'
import type { KnowledgeNote } from '../../../api/knowledge'

/** Tab 定义（键 + 标签）。标签与原型顶栏面包屑的 titleMap 交叉校验过。 */
export const TABS: ModuleTab[] = [
  { key: 'notes', label: '全部笔记' },
  { key: 'topics', label: '主题' },
  { key: 'tags', label: '标签' },
  { key: 'graph', label: '双链图谱' },
  { key: 'favorites', label: '收藏' },
  { key: 'archive', label: '归档' },
]

/** 本模块所有交互回调 —— 实现写在 <KnowledgeWorkspace /> 里。 */
export interface Handlers {
  closeModal: () => void
  notice: (arg0: string) => void
  openNote: (arg0: string) => void
  openTopic: (arg0: string) => void
}

export const MODAL_SPECS = {
  openTopic: { title: null, arg: true },
} as const

export type ModalKey = keyof typeof MODAL_SPECS

/** 时间格式化：统一 zh-CN 短日期。 */
function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('zh-CN')
  } catch {
    return iso
  }
}

/** 一条笔记的行视图（NotesPanel / ArchivePanel 共用）。 */
function NoteRow({ note, handlers }: { note: KnowledgeNote; handlers: Handlers }) {
  return (
    <div className="note-item" onClick={() => handlers.openNote(note.id)}>
      <div className="note-title">{note.title}</div>
      <div className="note-excerpt">{note.excerpt}</div>
      <div className="note-meta">
        {note.tags.map((t) => (
          <span key={t.id} className="note-tag">{t.name}</span>
        ))}
        <span className="note-time">{formatDate(note.updatedAt)}</span>
      </div>
    </div>
  )
}

export function NotesPanel({ handlers }: { handlers: Handlers }) {
  const notesQ = useNotes()
  const topicsQ = useTags(true)
  const tagsQ = useTags(false)
  const notes = notesQ.data ?? []
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
  const weekNew = notes.filter((n) => new Date(n.createdAt).getTime() >= weekAgo).length

  return (
    <>
      <section className="card hero">
        <h1>知识库 📚</h1>
        <p>跨模块沉淀：学习笔记、工作脱敏知识、项目产出，统一在这里。</p>
        <div className="hero-meta">
          <span>笔记总数：<strong>{notes.length}</strong></span>
          <span>主题：<strong>{topicsQ.data?.length ?? 0}</strong></span>
          <span>标签：<strong>{tagsQ.data?.length ?? 0}</strong></span>
          <span>本周新增：<strong>{weekNew}</strong></span>
        </div>
      </section>
      <section className="card">
        <input className="search-input" placeholder="🔍 搜索笔记标题、内容、标签..." />
      </section>
      <section className="card">
        <div className="card-title">最近笔记</div>
        {notesQ.isLoading ? (
          <div className="note-item"><div className="note-excerpt">加载中…</div></div>
        ) : notes.length === 0 ? (
          <div className="note-item"><div className="note-excerpt">还没有笔记</div></div>
        ) : (
          notes.map((n) => <NoteRow key={n.id} note={n} handlers={handlers} />)
        )}
      </section>
    </>
  )
}

export function TopicsPanel({ handlers }: { handlers: Handlers }) {
  const topicsQ = useTags(true)
  const allNotesQ = useNotes({ status: null, favorited: null, tagId: null })
  const topics = topicsQ.data ?? []
  const allNotes = allNotesQ.data ?? []
  const countByTag = (tagId: string) => allNotes.filter((n) => n.tags.some((t) => t.id === tagId)).length

  return (
    <>
      <section className="card">
        <div className="card-title">主题</div>
        {topicsQ.isLoading ? (
          <div className="note-item"><div className="note-excerpt">加载中…</div></div>
        ) : topics.length === 0 ? (
          <div className="note-item"><div className="note-excerpt">还没有主题</div></div>
        ) : (
          topics.map((t) => (
            <div key={t.id} className="topic-item" onClick={() => handlers.openTopic(t.name)}>
              <div className="topic-icon">{t.name.slice(0, 1)}</div>
              <div className="topic-info">
                <div className="topic-name">{t.name}</div>
                <div className="topic-meta">{countByTag(t.id)} 条笔记</div>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  )
}

export function TagsPanel({ handlers: _handlers }: { handlers: Handlers }) {
  const tagsQ = useTags(false)
  const tags = tagsQ.data ?? []
  return (
    <>
      <section className="card">
        <div className="card-title">标签云</div>
        {tagsQ.isLoading ? (
          <div className="note-item"><div className="note-excerpt">加载中…</div></div>
        ) : tags.length === 0 ? (
          <div className="note-item"><div className="note-excerpt">还没有标签</div></div>
        ) : (
          <div className="tag-cloud">
            {tags.map((t) => (
              <span key={t.id} className="tag-item">{t.name}</span>
            ))}
          </div>
        )}
      </section>
    </>
  )
}

export function GraphPanel({ handlers }: { handlers: Handlers }) {
  /* KnowledgeGraph 目前只接受 notice，不接受数据 props —— 保持原样。
     图谱内核仍读 data/workspace/know-notes 的静态模型，待后续迁移。 */
  return <KnowledgeGraph notice={handlers.notice} />
}

export function FavoritesPanel({ handlers }: { handlers: Handlers }) {
  const favQ = useNotes({ status: null, favorited: true, tagId: null })
  const notes = favQ.data ?? []
  return (
    <>
      <section className="card">
        <div className="card-title">收藏</div>
        {favQ.isLoading ? (
          <div className="note-item"><div className="note-excerpt">加载中…</div></div>
        ) : notes.length === 0 ? (
          <div className="note-item"><div className="note-excerpt">还没有收藏笔记</div></div>
        ) : (
          notes.map((n) => (
            <div key={n.id} className="favorite-item" onClick={() => handlers.openNote(n.id)}>
              <div className="favorite-icon">⭐</div>
              <div className="favorite-info">
                <div className="favorite-name">{n.title}</div>
                <div className="favorite-meta">
                  {n.tags.map((t) => t.name).join(' / ') || '无标签'} · 收藏于 {formatDate(n.updatedAt)}
                </div>
              </div>
            </div>
          ))
        )}
      </section>
    </>
  )
}

export function ArchivePanel({ handlers }: { handlers: Handlers }) {
  const archQ = useNotes({ status: 'archived', favorited: null, tagId: null })
  const notes = archQ.data ?? []
  return (
    <>
      <section className="card">
        <div className="card-title">归档</div>
        {archQ.isLoading ? (
          <div className="note-item"><div className="note-excerpt">加载中…</div></div>
        ) : notes.length === 0 ? (
          <div className="note-item"><div className="note-excerpt">还没有归档笔记</div></div>
        ) : (
          notes.map((n) => <NoteRow key={n.id} note={n} handlers={handlers} />)
        )}
      </section>
    </>
  )
}

/**
 * 顶栏动作区 —— 原型的 `.topbar-actions` 里的按钮。
 * 主题开关已从这里剔掉（外壳自己提供一份，全站只能有一个主题开关）。
 */
export function TopbarActions({ handlers }: { handlers: Handlers }) {
  return (
    <>
      <button className="btn btn-ghost" id="quickAdd" onClick={() => handlers.notice('原型演示：新建笔记')}>+ 新建笔记</button>
    </>
  )
}

/** 弹窗体：主题详情 + 该主题下的笔记列表 + 新建笔记表单（接 useNoteActions）。 */
export function OpenTopicModal({ handlers, name }: { handlers: Handlers; name: string }) {
  const topicsQ = useTags(true)
  const topic = topicsQ.data?.find((t) => t.name === name)
  const notesQ = useNotes({ status: null, favorited: null, tagId: topic?.id ?? null })
  const actions = useNoteActions()
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')

  const submit = async () => {
    if (!title.trim() || !topic) return
    try {
      const created = await actions.create.mutateAsync({
        title: title.trim(),
        content: content.trim(),
        excerpt: content.trim().slice(0, 100),
        status: 'published',
        favorited: false,
        ownerId: null,
      })
      await actions.setTags.mutateAsync({ noteId: created.id, tagIds: [topic.id] })
      setTitle('')
      setContent('')
    } catch {
      /* 错误已由 hook 的 onError 提示 */
    }
  }

  return (
    <>
      <div className="detail-section">
        <div className="detail-label">主题说明</div>
        <div className="detail-text">
          {topic ? `这是「${name}」主题下的笔记集合，按时间倒序排列。` : `未找到「${name}」主题。`}
        </div>
      </div>
      <div className="detail-section">
        <div className="detail-label">新建笔记</div>
        <input
          className="search-input"
          placeholder="标题"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <textarea
          className="search-input"
          placeholder="正文"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          rows={4}
          style={{ marginTop: 8, width: '100%' }}
        />
      </div>
      <div className="detail-section">
        <div className="detail-label">笔记列表</div>
        <ul className="detail-list">
          {notesQ.isLoading ? (
            <li>加载中…</li>
          ) : (notesQ.data ?? []).length === 0 ? (
            <li>还没有笔记</li>
          ) : (
            (notesQ.data ?? []).map((n) => <li key={n.id}>{n.title}</li>)
          )}
        </ul>
      </div>
      <div className="form-actions">
        <button className="btn btn-ghost" onClick={() => handlers.closeModal()}>关闭</button>
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={actions.create.isPending || !title.trim() || !topic}
        >
          {actions.create.isPending ? '保存中…' : '+ 新建笔记'}
        </button>
      </div>
    </>
  )
}
