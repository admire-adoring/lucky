import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../../../lib/cn'
import { bodyOf } from '../../../../data/workspace/doc-bodies'
import { copyOf, useDocCopies } from '../../../../data/workspace/doc-copies'
import { DOC_KIND_LABEL } from '../../../../data/content-pool'
import { DocEditor, EdIcon } from './DocEditor'
import { DocProps } from './DocProps'
import { parseFrontmatter } from './frontmatter'
import { applyCodePrefs, codeBoxOf, codeClick, codeMenuClose } from './code-block'
import { edCharsText, edCountText, mdOfBlocks, mdOfSource } from './md'
import { rdBlockHtml, rdCharsText, rdTocItems } from './rd-render'
import { useEdWork } from './use-ed-work'
import { useDocActions, useDocContent } from '../../../../hooks/use-docs'
import type { SourceDoc } from './source-doc'

/* 文档原文 · 单独一页（原型 v6.1）。

   应用内单独一页，覆盖在顶栏之下，自己铺满自己滚。两个镜头：阅读与编辑。
   与原型的三处不同：
     1 不让开顶栏：本仓顶栏是自绘的窗口标题栏，盖掉就关不掉也拖不动。
     2 vh 换成 %：这一页的高度就是视口减顶栏。
     3 正文走 dangerouslySetInnerHTML，因为可视面要把 DOM 序列化回 markdown。
   滚动容器是这一页自己，目录高亮挂它。 */

/* 面阶四选一（原型 `RD_BGS`）。只有键与名字在 JS 里，色值只在 CSS 写一次 ——
    两个消费者（这一页的面阶 + 选择器里那颗色点）读同一处。 */
const RD_BGS = [
  { key: 'gray', name: '浅灰' },
  { key: 'white', name: '纯白' },
  { key: 'green', name: '护眼绿' },
  { key: 'yellow', name: '书籍黄' },
] as const
type RdBgKey = (typeof RD_BGS)[number]['key']
export type Pane = 'read' | 'edit'

const RD_BG_STORE = 'wb-doc-bg'
/* 镜头也是"这一页的镜头"：换一篇 / 切到阅读再回来都保持（原型 `rdPane` 是全局的）。 */
let PANE: Pane = 'read'

function readBg(): RdBgKey {
  try {
    const saved = localStorage.getItem(RD_BG_STORE)
    if (RD_BGS.some((b) => b.key === saved)) return saved as RdBgKey
  } catch { /* 隐私模式 / 没有 storage：用默认 */ }
  /* 默认 = 浅灰 —— 与改之前那三支令牌逐字相同 ⇒ 不点它，页面一个像素都不变 */
  return 'gray'
}

export function DocSourcePage({
  doc,
  projectName,
  initialPane,
  onBack,
  onEditMeta,
  notice,
}: {
  doc: SourceDoc
  /* 页头那条细栏里的项目名：② hero 在这一屏收掉了，但"这一篇属于哪个项目"不能丢 */
  projectName: string
  /** 进来落在哪个镜头。不给就沿用上一次（`PANE`），与原型 `rdPane` 同 */
  initialPane?: Pane
  onBack: () => void
  /** 改这一篇的登记信息。宿主没有那个弹窗时不给 —— 也就不出那颗按钮（别留一颗点了没反应的） */
  onEditMeta?: (doc: SourceDoc) => void
  notice: (text: string) => void
}) {
  useDocCopies()   /* 订阅：演示副本保存之后这一页（与书墙）当场更新 */

  /* 本地正文（`filePath` 有值的那一类）从 `.md` 文件读；其余回落演示稿。
     都没有就是空正文 —— 不往里造骨架：登记那几行由纸头一行与页脚说，正文留白。 */
  const localDoc = useDocContent(doc.filePath ? doc.id : undefined)
  const saveDoc = useDocActions()
  /* 文件头那段 YAML 单独切出来：正文只留 `---` 之后的部分，头交给属性面板画。
     绑定的多半是 Obsidian 仓里的笔记，头本来就是"这一篇的属性"，不是正文段落。 */
  const fm = useMemo(
    () => (localDoc.data?.content != null ? parseFrontmatter(localDoc.data.content) : null),
    [localDoc.data],
  )
  const basBody = useMemo(() => {
    if (fm) return mdOfSource(fm.body)
    return bodyOf(doc) ?? []
  }, [fm, doc])
  const copy = copyOf(doc.id)
  /* 副本优先 —— 但只对演示态生效：本地正文的那些以文件为源，不看应用内副本。 */
  const body = doc.filePath ? basBody : copy?.body ?? basBody
  const docName = doc.filePath ? doc.name : copy?.name ?? doc.name
  /* 来源工具名。部署文档没有这一说，缺了就说「来源工具」，不留空也不替它编一个名字。 */
  const srcText = doc.source || '来源工具'
  /* 类型：文档索引给的是 `DocKind` 键（查表），部署文档给的是自由串（它自己就是文案）。 */
  const kindText = (DOC_KIND_LABEL as Record<string, string>)[doc.kind] ?? doc.kind
  /* 位置 = 模块 › 功能。索引型文档这两格常是空的（只登记了名字与来源），
     空着就不出这一项 —— 否则页头留一条"位置 ›"，后面什么也没有。 */
  const posText = [doc.module, doc.func].filter(Boolean).join(' › ')
  /* 编辑面纸头那一行要说的几件事。登记信息原来在正文里另起一段（提醒 + 列表 + 小标题），
     一屏全是"关于这一篇"的字；挪到这一行，正文从第一行就是自己的内容。 */
  const edFactsAll: ([string, string] | null)[] = [
    posText ? ['位置', posText] : null,
    ['类型', kindText],
    ['来源', srcText],
    doc.author ? ['作者', doc.author] : null,
    doc.updatedAt ? ['来源更新', copy ? '刚刚' : doc.updatedAt] : null,
  ]
  const edFacts = edFactsAll.filter((f): f is [string, string] => f !== null)

  const pageRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const [bg, setBg] = useState<RdBgKey>(readBg)
  const [bgOpen, setBgOpen] = useState(false)
  const [pane, setPane] = useState<Pane>(initialPane ?? PANE)
  const [active, setActive] = useState<string | null>(null)

  const ed = useEdWork(
    doc,
    body,
    () =>
      notice(
        doc.filePath
          ? '已写入 documents 里的正文文件'
          : '已保存到应用内副本 —— 来源工具里的原文没有被改动',
      ),
    /* 本地正文写回 `.md`（顺带把编辑器里改过的标题落进索引）；其余存应用内副本。
       文件头那段 YAML 原样贴回去 —— 编辑器里只有正文，不贴就等于"保存一次把头删了"。 */
    doc.filePath
      ? (_id, name, blocks) => saveDoc.save.mutate({
          id: doc.id,
          content: (fm?.head ? fm.head + '\n\n' : '') + mdOfBlocks(blocks),
          name,
        })
      : undefined,
  )

  const toc = useMemo(() => (body ? rdTocItems(body) : []), [body])
  const html = useMemo(() => (body ? body.map((b, i) => rdBlockHtml(b, i)).join('') : ''), [body])
  const readWords = useMemo(() => (body ? rdCharsText(mdOfBlocks(body).replace(/<[^>]+>/g, '')) : ''), [body])
  const words = pane === 'edit' ? edCharsText(ed.md) : readWords

  const gotoPane = (next: Pane) => {
    if (next === pane) return
    /* 离开编辑面先 `park`（脏就留一份草稿）—— 不 park 的话"切到阅读再切回来"
       那一篇的改动就没了（用户视角："我写的东西不见了"）。 */
    if (pane === 'edit') ed.park()
    /* 切回编辑面要重新读一次草稿（它是模块级 Map，不在 React 的依赖里） */
    if (next === 'edit') ed.refreshDraft()
    PANE = next
    setPane(next)
    pageRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const close = () => {
    if (pane === 'edit') ed.park()
    onBack()
  }

  const setBgAndStore = (key: RdBgKey) => {
    setBg(key)
    setBgOpen(false)
    try { localStorage.setItem(RD_BG_STORE, key) } catch { /* 存不下也不影响这一页 */ }
  }

  /* 关掉这一页有三条路：←、Esc、切分区。编辑态下 Esc 不关页，那一下只退出当前输入或收起气泡。 */
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      const t = event.target as HTMLElement | null
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      if (bgOpen) { setBgOpen(false); return }
      if (pane === 'edit' && ed.dirty) return
      close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bgOpen, pane, ed.dirty])

  /* 这一页是覆盖层，顺手锁住外壳主区的滚动。
     那个元素不在页面 DOM 里，只能拿 document 找；CSS 也得写 .mw-root .main.rd-lock。 */
  useEffect(() => {
    const main = document.querySelector('.main')
    main?.classList.add('rd-lock')
    return () => main?.classList.remove('rd-lock')
  }, [])

  /* 工具条实高写进 `--ed-tb`（这一页所有"跟着工具条走"的停靠位都读它）。
     控件两排 ⇒ 视口一变就可能折行，高度不能写死一个 41 —— 写死就会出
        "目录卡片上半截钻进工具条底下"。 */
  /* 页头实高写进 `--rd-bar-h`（原型写死 59 —— 那是它自己那套按钮量出来的高度；
     本仓的 `.btn` 与它不同 ⇒ 写死会出现"吸顶错位 1~3px"，滚动时内容从那条缝里透出来）。
     与工具条那支（`--ed-tb`）同一个理由：跟着实高走的东西就读实高。 */
  useEffect(() => {
    const bar = barRef.current
    const page = pageRef.current
    if (!bar || !page) return
    const set = () => page.style.setProperty('--rd-bar-h', Math.round(bar.offsetHeight) + 'px')
    set()
    const ro = new ResizeObserver(set)
    ro.observe(bar)
    return () => ro.disconnect()
  }, [])

  const onToolbar = useCallback((el: HTMLDivElement | null) => {
    roRef.current?.disconnect()
    if (!el) return
    const set = () => pageRef.current?.style.setProperty('--ed-tb', Math.round(el.offsetHeight) + 'px')
    set()
    const ro = new ResizeObserver(set)
    ro.observe(el)
    roRef.current = ro
  }, [])
  useEffect(() => () => roRef.current?.disconnect(), [])

  /* 阅读态也要敷代码块偏好（行号 / 换行 / 字号 / 标题栏）—— 那一份是模块级的、两态共用；
     重渲会造出新 DOM ⇒ 每次正文换了都要重新敷一遍，否则"切到阅读态设置就回到默认"。 */
  useEffect(() => { applyCodePrefs(pageRef.current) }, [html])

  /* 切分区时这一页会被整个卸载（不是切阅读态）⇒ 在这里也 park 一次：漏了它，
     "正在编辑时点了侧栏另一个分区"就是把刚写的丢掉（而用户以为它还在）。
     用 ref 拿最新的 `park` —— 它每次都重建（依赖 md / name），不取最新就存的是旧内容。 */
  const parkRef = useRef(ed.park)
  parkRef.current = ed.park
  useEffect(() => () => { parkRef.current() }, [])

  /* 滚动高亮（原型 `sourceSpy`）：正文标题滚过一条线就点亮对应目录项。
      门槛 100 —— 它是"页头 59 + 一点余量"，与 `scroll-margin-top: 80` 是同一件事的两个数。 */
  const onScroll = useCallback(() => {
    const page = pageRef.current
    if (!page || !toc.length) return
    let cur: string | null = null
    toc.forEach((it) => {
      const el = page.querySelector(`#${it.id}`)
      if (!el) return
      if (el.getBoundingClientRect().top - page.getBoundingClientRect().top <= 100) cur = it.id
    })
    setActive(cur)
  }, [toc])

  const goto = (id: string) => {
    const el = pageRef.current?.querySelector(`#${id}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* 正文里的交互走事件委托，正文是 innerHTML 灌进来的。
      代码块的偏好（字号 / 换行 / 行号 / 标题栏）在阅读态也生效，
      同步到全文那两项在阅读态是禁用的。 */
  const onBodyClick = (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement
    const box = codeBoxOf(target)
    if (box) { codeClick(event.nativeEvent, box, { canSync: false, notice }); return }
    codeMenuClose()
  }

  const editing = pane === 'edit'
  /* 本地正文是异步读来的：还没到手时编辑面先给一张"正在读"（详见下面那支分支） */
  const loadingBody = Boolean(doc.filePath) && localDoc.isLoading

  return (
    <div className="rd-page" ref={pageRef} data-doc-bg={bg} data-pane={pane} onScroll={onScroll}>
      <div className="rd-bar" ref={barRef}>
        <button type="button" className="rd-back" onClick={close} title="返回文档详情" aria-label="返回文档详情">
          <EdIcon name="chevronLeft" />
        </button>
        <span className="rd-crumb">{projectName} › 文档</span>
        <span className="rd-bar-name">{docName}</span>
        {editing ? (
          <span className={cn('rd-status', ed.dirty && 'is-dirty')}>
            {ed.dirty ? '未保存' : '已保存'}
          </span>
        ) : null}
        <div className="seg">
          <button
            type="button" className={cn('seg-btn', !editing && 'active')}
            aria-pressed={!editing} data-rd-pane="read"
            onClick={() => gotoPane('read')}
          >
            <EdIcon name="file" />阅读
          </button>
          <button
            type="button" className={cn('seg-btn', editing && 'active')}
            aria-pressed={editing} data-rd-pane="edit"
            onClick={() => gotoPane('edit')}
          >
            <EdIcon name="pen" />编辑
          </button>
        </div>
        {/* 背景色紧跟读·写分段：两件都是"这一页的镜头"，与右边那排"对文档做的事"分开 */}
        <div className={cn('rd-bg', bgOpen && 'open')}>
          <button
            type="button" className="rd-bg-btn" aria-label="背景色" title="背景色"
            aria-expanded={bgOpen} data-rd-bg=""
            onClick={() => setBgOpen((v) => !v)}
          >
            <span className={cn('rd-bg-dot', `is-${bg}`)} />
          </button>
          {bgOpen ? (
            <div className="rd-bg-pop" role="menu">
              {RD_BGS.map((b) => (
                <button
                  key={b.key}
                  type="button"
                  className={cn('rd-bg-item', b.key === bg && 'is-on')}
                  /* 原型用属性选择器给色点（`.rd-bg-item[data-rd-bg-set="gray"] .rd-bg-dot`）——
                     转换过来的那四条的键就是这个属性；不给的话那四条一条都不命中
                     （色点会是透明的一小块，而页面看着"只是没颜色"，不报错）。 */
                  data-rd-bg-set={b.key}
                  onClick={() => setBgAndStore(b.key)}
                >
                  <span className={cn('rd-bg-dot', `is-${b.key}`)} />
                  {b.name}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {/* 右端只放编辑面那两颗。原来这里还有一颗「在 {来源} 里打开」——
            文档在应用内可读可写之后它就是多余的一扇门（2026-10-14 用户令去掉）。
            "正文住在哪儿"这件事仍由正文开头那行「来源」说。 */}
        {editing ? (
          <div className="rd-bar-acts">
            <button className="btn btn-ghost" onClick={ed.dropChanges} disabled={!ed.dirty && !ed.draft}>放弃修改</button>
            <button
              className="btn btn-primary" id="rdSave"
              disabled={!ed.dirty}
              title={ed.dirty ? '保存到应用内副本' : '还没有改动'}
              onClick={ed.save}
            >保存</button>
          </div>
        ) : null}
      </div>

      {editing ? (
        loadingBody ? (
          /* 正文还在路上：给一张"正在读"，而不是让他对着一张空纸敲 ——
             空纸上敲出来的东西一保存就会盖掉文件里的原文。 */
          <div className="rd-loading">正在读取正文…</div>
        ) : (
        <DocEditor
          md={ed.md}
          name={ed.name}
          onName={ed.setName}
          mode={ed.mode}
          canUndo={ed.canUndo}
          canRedo={ed.canRedo}
          histToken={ed.histToken}
          onMd={ed.change}
          onUndo={() => { ed.undo() }}
          onRedo={() => { ed.redo() }}
          onMode={ed.setMode}
          onSave={ed.save}
          onNotice={notice}
          onToolbar={onToolbar}
          /* 草稿条：纸头上的第一块 —— 它在正文之前，因为"接不接这份改动"得先答 */
          draftSlot={ed.draft ? (
            <div className="ed-draft">
              <EdIcon name="clock" />
              <span>
                上一次有一份没保存的改动（{edCountText(ed.draft.md)}）。这里先给你 <b>已保存</b> 的那一版 —— 接不接由你。
              </span>
              <div className="ed-draft-btns">
                <button className="btn btn-ghost" onClick={() => ed.useDraft()}>接上改动</button>
                <button className="btn btn-ghost" onClick={ed.dropDraft}>丢弃</button>
              </div>
            </div>
          ) : null}
          /* 纸头那行坐标：位置 / 类型 / 来源 / 作者 / 来源更新 —— 它读的是文档元信息，不在编辑器手里 */
          metaSlot={(
            <div className="ed-meta">
              {edFacts.map(([k, v], i) => (
                <Fragment key={k}>
                  {i ? <span className="ed-meta-dot">·</span> : null}
                  <span><b>{k}</b>{v}</span>
                </Fragment>
              ))}
              {onEditMeta ? (
                <button type="button" className="ed-meta-link" onClick={() => onEditMeta(doc)}>编辑信息…</button>
              ) : null}
            </div>
          )}
        />
        )
      ) : (
        <div className="rd-layout">
          <aside className="card rd-toc">
            <div className="rd-toc-title">本篇目录</div>
            <div className="rd-toc-list">
              {toc.length ? toc.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={cn('rd-toc-item', it.lv > 1 && `is-lv${it.lv}`, it.id === active && 'is-on')}
                  onClick={() => goto(it.id)}
                >
                  {it.name}
                </button>
              )) : (
                <p className="rd-toc-empty">这一篇还没有小标题 —— 正文里写一段「标题」就有了。</p>
              )}
            </div>
          </aside>

          <article className="rd-main">
            {/* 笔记属性：头里有 YAML 才出。标题取文件名 —— 与 Obsidian 的内联标题同一件事
                （属性在上、正文在下，正文自己的 `# 一句话结论` 不跟着挪）。 */}
            {fm?.head ? <DocProps title={docName} entries={fm.entries} /> : null}
            {/* eslint-disable-next-line react/no-danger -- 见文件头：编辑态的「可视」面要求真实 DOM */}
            <div className="rd-body" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: html }} />
          </article>
        </div>
      )}

      {/* 页脚：这一篇的坐标 + 字数。坐标原本在正文开头（还带着一条"副本不会回流"的说明），
          阅读时它压在正文前面、又不属于正文 ⇒ 一并收到左下角（2026-11-04 用户令）。 */}
      <div className="rd-foot">
        {editing ? null : (
          <>
            <div className="rd-meta">
              <span><b>来源</b>{srcText}</span>
              {doc.author ? <span><b>作者</b>{doc.author}</span> : null}
              {doc.updatedAt ? <span><b>来源更新</b>{copy ? '刚刚' : doc.updatedAt}</span> : null}
              {posText ? <span><b>位置</b>{posText}</span> : null}
            </div>
            <span className="rd-foot-dot">·</span>
          </>
        )}
        <span className="rd-words">{words || '0 字'}</span>
      </div>
    </div>
  )
}
