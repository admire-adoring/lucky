import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { DOC_KINDS, DOC_KIND_LABEL } from '../../../data/content-pool'
import { cn } from '../../../lib/cn'
import { Icon } from '../../icons/Icon'
import type { DocKind, DocumentItem, IconName } from '../../../types'

/* ============================================================================
   文档列表 —— 项目详情「文档」分区
   （原型 `design/work/work_project_detail_document.html`，2026-09-25 落地）
   ----------------------------------------------------------------------------
   它替掉的是上一版那个"一张卡片 + 四本书脊"的简陋版本。原型这一页有**四件东西**
   是上一版没有的，也是它值得单独落地的理由：

     ① **左侧子类栏**（方案/设计/接口/测试/规范/调研/参考 + 每类计数）——
        文档库的主轴。计数由 `docs` 现算，不是画在标记里的；
     ② **工具栏**：搜索（标题/摘要/来源）+ 排序 + **书墙 / 列表**两种视图；
     ③ **活跃筛选 chips + 结果条**：改了什么筛选、还剩几篇，一眼可见；
     ④ **文档详情弹窗**：摘要 / 类型 / 来源 / 更新 / 负责人。

   ============================================================================
   五处与原型**有意不同**（都是"静态页 → 应用"必然要改的，不是审美）
   ============================================================================
   ① **状态在组件里，不在全局**。原型的 `state = {category, keyword, sort, view}` 是
      页面级变量；这里用 `useState`。**刻意没有**存进 `ui-store`：那是"用户偏好"的住处
      （排序方式这种跨页面要保持的东西），而"我现在正看着哪一类"是一次浏览的位置，
      离开就该重置。同一条判据在 `useModuleTab` 的注释里也用过。

   ② **来源与种类是两件事，两个都在页面上**。原型只有"种类"（`TYPE_MAP`）；
      应用里 `DocumentItem` 两个字段都有 —— 子类栏筛**种类**（它是什么），
      搜索命中与弹窗信息里给**来源**（它存在哪儿）。别把两者合成一个。

   ③ **没有「版本」这一栏，也没有「标签」**。原型每篇带 `ver`（v3/v1.4…）与 2~4 个
      `tags`，而应用里**没有这两个字段**：文档名里偶发带版本（「技术方案 v3」），
      再造一个 `ver` 就会出现"标题里的 v3 与角标里的 v2"打架；标签更没有来源，
      编 4 个词出来就是造假。所以列表行与弹窗里那一格换成了**真实存在的来源**。
      ⇒ 书脊 meta 只剩更新时间，列表行是「类型 · 更新 · 负责人」，弹窗多一行来源。

   ④ **排序选项去掉「创建时间」**。应用里只有"多久没更新"（`updatedHours`），
      没有创建时间 —— 留一个点了没区别的选项，与"不编字段"是同一条纪律。

   ⑤ **新建文档的入口在工具栏右端**。原型在页头 `.hero-mini`（那是它自带的简化头），
      而这一页的页头是**可折叠 Hero**（另一个原型定的，两处共用），
      往别人的头里塞一颗按钮会让两处的头部越来越像两套。表单本身照原型（标题/类型/链接/摘要）。

   ============================================================================
   动作的诚实性
   ============================================================================
   弹窗底部四颗按钮里，只有**关闭**是真的做成了事。删除 / 复制链接 / 下载 / 打开原文
   都**没有写接口、也没有存原文地址**（`DocumentItem` 上没有 `url`），所以它们各自回一句
   说得清"为什么不行"的话，而不是弹一个 `已删除`/`已下载` 的假成功 ——
   与项目详情 `⋯` 菜单、以及被撤掉的「状态徽标循环」是同一条纪律。

   ⚠️ 样式全部在 `styles/module-workspace.css` 的「项目详情 · 文档列表」段，
      作用域是 `.mw-root[data-module] .proj-detail …`（**不带模块值**）——
      这一页同时挂在项目模块与工作模块下，写成具体模块名会有一份全裸且零报错。
   ============================================================================ */

/* ------------------------------------------------------------------ *
 * 常量
 * ------------------------------------------------------------------ */

type SortKey = 'updated' | 'name' | 'kind'
type ViewKey = 'grid' | 'list'

/** 排序项。`hint` 是结果条右边那句"按什么排序"。 */
const SORT_OPTIONS: { value: SortKey; label: string; hint: string }[] = [
  { value: 'updated', label: '最近更新', hint: '按最近更新排序' },
  { value: 'name', label: '名称 A-Z', hint: '按名称排序' },
  { value: 'kind', label: '按类型', hint: '按类型排序' },
]

/**
 * 种类 → 图标。
 *
 * ⚠️ 这是**降级：就近取已有的 53 个精灵符号**（与 `shell-nav.ts` 的 `TAB_ICON` 同一条判据）——
 *    原型用的是 emoji（📘📐🔌🧪📋🔍🔗），照抄会把 emoji 混进这一页的字阶里；
 *    为这 7 类新增 7 个 symbol 又要同时动 `IconSprite` 与 `IconName` 两处。
 */
const DOC_KIND_ICON: Record<DocKind, IconName> = {
  plan: 'i-file',
  design: 'i-grid',
  api: 'i-link',
  test: 'i-check',
  spec: 'i-list',
  research: 'i-search',
  ref: 'i-layers',
}

/** 「是不是新文档」。判据只有一条：24 小时内更新过（`updatedHours` 由池子给）。 */
const isNew = (doc: DocumentItem) => doc.updatedHours < 24

/* ------------------------------------------------------------------ *
 * 搜索命中高亮
 * ------------------------------------------------------------------ */

/**
 * 把一段文本按关键词切成「普通 / 命中 / 普通…」，命中那段套 `<mark>`。
 *
 * ⚠️ **不用 `dangerouslySetInnerHTML`**：原型的 `highlight()` 是拼字符串再 `innerHTML`，
 *    照搬就等于把用户输入（搜索框）当 HTML 注入。这里返回的是 React 节点数组，
 *    转义由 React 负责 —— 关键词里带 `<` 也只是普通文本。
 */
function highlight(text: string, keyword: string): ReactNode {
  const needle = keyword.trim().toLowerCase()
  if (!needle) return text

  const haystack = text.toLowerCase()
  const parts: ReactNode[] = []
  let from = 0
  let at = haystack.indexOf(needle, from)
  while (at >= 0) {
    if (at > from) parts.push(text.slice(from, at))
    parts.push(
      <mark key={parts.length} className="hl">
        {text.slice(at, at + needle.length)}
      </mark>,
    )
    from = at + needle.length
    at = haystack.indexOf(needle, from)
  }
  if (!parts.length) return text
  if (from < text.length) parts.push(text.slice(from))
  return parts
}

/* ------------------------------------------------------------------ *
 * 文档详情弹窗
 * ------------------------------------------------------------------ */

function DocModal({
  doc,
  onClose,
  notice,
}: {
  doc: DocumentItem
  onClose: () => void
  notice: (text: string) => void
}) {
  /* ESC 关闭挂在这个弹窗上（不是 document 上一次注册、永不卸载 —— 与 `WorkspaceModal` 同一取舍）。
     这里没有复用 `WorkspaceModal`：那个组件只有 head(title) + body 两个槽，而这一页的弹窗
     要「标题 + 副标题」与一条**底部动作栏**，为一个页面的版式去改三处共用的组件不划算。 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const label = DOC_KIND_LABEL[doc.kind]

  return (
    <div
      className="modal-mask open"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal wide" role="dialog" aria-modal="true" aria-label={doc.name}>
        <div className="modal-head">
          <div className="modal-titles">
            <div className="modal-title">{doc.name}</div>
            <div className="modal-subtitle">
              {label} · {doc.updatedAt} · {doc.author}
            </div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-section">
            <div className="modal-label">摘要</div>
            <div className="modal-text">{doc.summary}</div>
          </div>

          <div className="modal-section">
            <div className="modal-label">信息</div>
            <div className="modal-info-row">
              <span className="label">类型</span>
              <span className="value">{label}</span>
            </div>
            <div className="modal-info-row">
              <span className="label">来源</span>
              <span className="value">{doc.source}</span>
            </div>
            <div className="modal-info-row">
              <span className="label">更新</span>
              <span className="value">
                {doc.updatedAt}
                {isNew(doc) ? '（新）' : ''}
              </span>
            </div>
            <div className="modal-info-row">
              <span className="label">负责人</span>
              <span className="value">{doc.author}</span>
            </div>
          </div>
        </div>

        {/* 四颗按钮里只有"打开原文"是这一页最想给的，但它没有地址可给 ——
            文案因此写成"地址存在哪"，而不是含糊的"打开失败"。 */}
        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-ghost btn-sm doc-action-danger"
            onClick={() => notice('删除文档：还没有写接口')}
          >
            删除
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => notice(`文档地址留在${doc.source}里，索引没有存`)}
          >
            复制链接
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => notice('下载：正文在原工具里维护')}
          >
            下载
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => notice(`打开原文：地址在${doc.source}，索引没有存`)}
          >
            打开原文
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 新建文档弹窗
 * ------------------------------------------------------------------ */

/**
 * ⚠️ 表单是**受控的**（标题/类型/链接/摘要各有 state），但**保存不落任何地方** ——
 *    没有写接口。给"保存成功"的假回执比不给按钮更糟（见文件头「动作的诚实性」）。
 */
function NewDocModal({
  projectName,
  onClose,
  notice,
}: {
  projectName: string
  onClose: () => void
  notice: (text: string) => void
}) {
  const [kind, setKind] = useState<DocKind>('plan')
  const [title, setTitle] = useState('')
  const [link, setLink] = useState('')
  const [summary, setSummary] = useState('')

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="modal-mask open"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="modal wide" role="dialog" aria-modal="true" aria-label="新建文档">
        <div className="modal-head">
          <div className="modal-titles">
            <div className="modal-title">新建文档</div>
            <div className="modal-subtitle">{projectName}</div>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="form-field">
            <label htmlFor="nd-title">标题</label>
            <input
              id="nd-title"
              type="text"
              className="doc-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：支付对账设计"
            />
          </div>

          <div className="form-field">
            <label>类型</label>
            <div className="type-picker">
              {DOC_KINDS.map((key) => (
                <button
                  key={key}
                  type="button"
                  className={cn('type-option', `dk-${key}`, kind === key && 'active')}
                  aria-pressed={kind === key}
                  onClick={() => setKind(key)}
                >
                  <span className="type-dot" />
                  <span>{DOC_KIND_LABEL[key]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="nd-link">链接</label>
            <input
              id="nd-link"
              type="text"
              className="doc-input"
              value={link}
              onChange={(event) => setLink(event.target.value)}
              placeholder="wiki://… 或 https://…"
            />
          </div>

          <div className="form-field">
            <label htmlFor="nd-summary">摘要</label>
            <textarea
              id="nd-summary"
              className="doc-input"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              placeholder="一句话说明这篇文档讲什么…"
            />
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => notice('保存文档：还没有写接口')}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 页面
 * ------------------------------------------------------------------ */

export function DocLibrary({
  docs,
  projectName,
  notice,
}: {
  docs: DocumentItem[]
  /** 新建弹窗的副标题用它（原型那里写的就是项目名） */
  projectName: string
  notice: (text: string) => void
}) {
  const [kind, setKind] = useState<DocKind | 'all'>('all')
  const [keyword, setKeyword] = useState('')
  const [sort, setSort] = useState<SortKey>('updated')
  const [view, setView] = useState<ViewKey>('grid')
  const [openId, setOpenId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  /** 每一类的计数。7 类**全都给 0 起步** —— 0 也要显示（它是一份封闭词表，不是"恰好有这些"）。 */
  const counts = useMemo(() => {
    const map = new Map<DocKind, number>(DOC_KINDS.map((key) => [key, 0]))
    docs.forEach((doc) => map.set(doc.kind, (map.get(doc.kind) ?? 0) + 1))
    return map
  }, [docs])

  const list = useMemo(() => {
    const needle = keyword.trim().toLowerCase()
    const filtered = docs.filter((doc) => {
      if (kind !== 'all' && doc.kind !== kind) return false
      if (!needle) return true
      /* 命中面与原型一致（标题/摘要），另外两条是这一页有的真值：种类名与来源 */
      return (
        doc.name.toLowerCase().includes(needle) ||
        doc.summary.toLowerCase().includes(needle) ||
        DOC_KIND_LABEL[doc.kind].includes(needle) ||
        doc.source.toLowerCase().includes(needle)
      )
    })

    const sorted = [...filtered]
    if (sort === 'updated') sorted.sort((a, b) => a.updatedHours - b.updatedHours)
    else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'zh'))
    else
      sorted.sort(
        (a, b) =>
          DOC_KINDS.indexOf(a.kind) - DOC_KINDS.indexOf(b.kind) ||
          a.name.localeCompare(b.name, 'zh'),
      )
    return sorted
  }, [docs, kind, keyword, sort])

  const hint = SORT_OPTIONS.find((option) => option.value === sort)?.hint ?? ''
  const openDoc = docs.find((doc) => doc.id === openId) ?? null

  /* 活跃筛选：一条 chip 对应一个可清掉的筛选。原型把"清除动作"存成回调数组，
     这里照 React 的写法就地给两个 onClick。 */
  const chips: { key: string; label: string; clear: () => void }[] = []
  if (kind !== 'all') {
    chips.push({
      key: 'kind',
      label: DOC_KIND_LABEL[kind],
      clear: () => setKind('all'),
    })
  }
  if (keyword.trim()) {
    chips.push({ key: 'kw', label: `“${keyword.trim()}”`, clear: () => setKeyword('') })
  }

  return (
    <div className="doc-layout">
      <aside className="doc-side" aria-label="文档子类">
        <div className="side-title">子类</div>
        <button
          type="button"
          className={cn('side-item', 'dk-all', kind === 'all' && 'active')}
          aria-pressed={kind === 'all'}
          onClick={() => setKind('all')}
        >
          <span className="side-dot" />
          <span className="side-label">全部</span>
          <span className="side-count">{docs.length}</span>
        </button>
        {DOC_KINDS.map((key) => (
          <button
            key={key}
            type="button"
            className={cn('side-item', `dk-${key}`, kind === key && 'active')}
            aria-pressed={kind === key}
            onClick={() => setKind(key)}
          >
            <span className="side-dot" />
            <span className="side-label">{DOC_KIND_LABEL[key]}</span>
            <span className="side-count">{counts.get(key) ?? 0}</span>
          </button>
        ))}
      </aside>

      <div className="doc-main">
        <div className="doc-toolbar">
          <div className="search-wrap">
            <Icon name="i-search" className="search-icon" />
            <input
              type="search"
              className="doc-search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="搜索标题 / 摘要 / 来源…"
              aria-label="搜索文档"
            />
            {keyword ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => setKeyword('')}
                aria-label="清空搜索"
              >
                ✕
              </button>
            ) : null}
          </div>

          <div className="sort-select">
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              aria-label="排序方式"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <Icon name="i-chevron" className="sort-caret" />
          </div>

          <div className="view-toggle" role="group" aria-label="视图切换">
            <button
              type="button"
              className={cn(view === 'grid' && 'active')}
              aria-pressed={view === 'grid'}
              onClick={() => setView('grid')}
            >
              ▦ 书墙
            </button>
            <button
              type="button"
              className={cn(view === 'list' && 'active')}
              aria-pressed={view === 'list'}
              onClick={() => setView('list')}
            >
              ☰ 列表
            </button>
          </div>

          <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
            + 新建文档
          </button>
        </div>

        {chips.length ? (
          <div className="active-filters">
            {chips.map((chip) => (
              <button key={chip.key} type="button" className="af-tag" onClick={chip.clear}>
                {chip.label}
                <span className="af-x">×</span>
              </button>
            ))}
          </div>
        ) : null}

        <div className="result-bar">
          <span>
            共 <strong>{list.length}</strong> 篇文档
          </span>
          <span>{hint}</span>
        </div>

        {list.length ? (
          <>
            <div className={cn('view-grid', view !== 'grid' && 'hidden')}>
              {list.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  className={cn('doc-book', `dk-${doc.kind}`)}
                  onClick={() => setOpenId(doc.id)}
                >
                  {isNew(doc) ? <span className="book-badge" aria-hidden="true" /> : null}
                  <span className="db-tag">{DOC_KIND_LABEL[doc.kind]}</span>
                  <span className="db-title">{highlight(doc.name, keyword)}</span>
                  <span className="db-meta">{doc.updatedAt}</span>
                </button>
              ))}
            </div>

            <div className={cn('view-list', view === 'list' && 'active')}>
              {list.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  className={cn('doc-row', `dk-${doc.kind}`)}
                  onClick={() => setOpenId(doc.id)}
                >
                  <span className="doc-row-icon">
                    <Icon name={DOC_KIND_ICON[doc.kind]} />
                  </span>
                  <span className="doc-row-info">
                    <span className="doc-row-title">
                      {highlight(doc.name, keyword)}
                      {isNew(doc) ? <span className="badge-new">NEW</span> : null}
                    </span>
                    <span className="doc-row-meta">
                      <span>{DOC_KIND_LABEL[doc.kind]}</span>
                      <span className="sep">·</span>
                      <span>{doc.updatedAt}</span>
                      <span className="sep">·</span>
                      <span>{doc.author}</span>
                      <span className="sep">·</span>
                      <span className="tag-mini">{doc.source}</span>
                    </span>
                  </span>
                  <span className="doc-row-arrow" aria-hidden="true">
                    →
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          /* 空态有两种成因（这一类本来是 0 篇 / 筛完是 0 篇），文案只写后者 ——
             前者一进来就会看到，不需要解释。 */
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <div className="empty-title">没有匹配的文档</div>
            <div className="empty-desc">试试换个筛选条件，或者新建一篇</div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => setCreating(true)}>
              + 新建文档
            </button>
          </div>
        )}
      </div>

      {openDoc ? (
        <DocModal doc={openDoc} onClose={() => setOpenId(null)} notice={notice} />
      ) : null}
      {creating ? (
        <NewDocModal
          projectName={projectName}
          onClose={() => setCreating(false)}
          notice={notice}
        />
      ) : null}
    </div>
  )
}
