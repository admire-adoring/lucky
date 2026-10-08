import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '../../../../lib/cn'
import { bodyOf } from '../../../../data/workspace/doc-bodies'
import { copyOf, useDocCopies } from '../../../../data/workspace/doc-copies'
import { DOC_KIND_LABEL } from '../../../../data/content-pool'
import { DocEditor, EdIcon } from './DocEditor'
import { applyCodePrefs, codeBoxOf, codeClick, codeMenuClose } from './code-block'
import { edCharsText, edCountText, mdOfBlocks } from './md'
import { rdBlockHtml, rdCharsText, rdTocItems } from './rd-render'
import { useEdWork } from './use-ed-work'
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
type Pane = 'read' | 'edit'

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
  onBack,
  notice,
}: {
  doc: SourceDoc
  /* 页头那条细栏里的项目名：② hero 在这一屏收掉了，但"这一篇属于哪个项目"不能丢 */
  projectName: string
  onBack: () => void
  notice: (text: string) => void
}) {
  useDocCopies()   /* 订阅：保存之后这一页（与书墙）当场更新 */
  const basBody = useMemo(() => bodyOf(doc), [doc])
  const copy = copyOf(doc.id)
  /* 正文副本优先 —— 保存之后读到的就是刚写的那一份。 */
  const body = copy?.body ?? basBody
  const docName = copy?.name ?? doc.name
  /* 来源工具名。部署文档没有这一说，缺了就说「来源工具」，不留空也不替它编一个名字。 */
  const srcText = doc.source || '来源工具'
  /* 类型：文档索引给的是 `DocKind` 键（查表），部署文档给的是自由串（它自己就是文案）。 */
  const kindText = (DOC_KIND_LABEL as Record<string, string>)[doc.kind] ?? doc.kind

  const pageRef = useRef<HTMLDivElement | null>(null)
  const barRef = useRef<HTMLDivElement | null>(null)
  const roRef = useRef<ResizeObserver | null>(null)
  const [bg, setBg] = useState<RdBgKey>(readBg)
  const [bgOpen, setBgOpen] = useState(false)
  const [pane, setPane] = useState<Pane>(PANE)
  const [active, setActive] = useState<string | null>(null)

  const ed = useEdWork(doc, body, () => notice('已保存到应用内副本 —— 来源工具里的原文没有被改动'))

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
  const nocopy = !basBody && !copy

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
        <div className="rd-bar-acts">
          <button className="btn btn-ghost" onClick={() => notice(`在来源工具里打开：${srcText}`)}>
            在 {srcText} 里打开
          </button>
          {editing && !nocopy ? (
            <>
              <button className="btn btn-ghost" onClick={ed.dropChanges} disabled={!ed.dirty && !ed.draft}>放弃修改</button>
              <button
                className="btn btn-primary" id="rdSave"
                disabled={!ed.dirty}
                title={ed.dirty ? '保存到应用内副本' : '还没有改动'}
                onClick={ed.save}
              >保存</button>
            </>
          ) : null}
        </div>
      </div>

      {/* 没有副本这一篇：进编辑不是"写一份草稿"，而是另建一份副本（从此两边独立）——
          这句话必须说清，不然用户会以为改动会回流到来源工具。 */}
      {editing && nocopy ? (
        <div className="ed-paper">
          <div className="ed-nocopy">
            <div className="ed-nocopy-title">这一篇还没有应用内副本</div>
            <div className="ed-nocopy-text">
              《{docName}》在应用里只有一条 <b>索引</b>，正文住在 <b>{srcText}</b>。
              在这里写 = <b>另建一份副本</b>：从此两边独立 —— {srcText} 那边后来的改动
              <b>不会自动合并</b>过来，这份副本也就只在这台设备上说了算。
            </div>
            <div className="ed-nocopy-acts">
              <button className="btn btn-ghost" onClick={() => notice(`在来源工具里打开：${srcText}`)}>去 {srcText} 写</button>
              <button className="btn btn-primary" onClick={ed.startCopy}>还是建一份副本，在这里写</button>
            </div>
          </div>
        </div>
      ) : editing ? (
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
          /* 纸头那行坐标：位置 / 类型 / 来源 —— 它读的是文档元信息，不在编辑器手里 */
          metaSlot={(
            <div className="ed-meta">
              <span><b>位置</b>{doc.module} › {doc.func}</span>
              <span className="ed-meta-dot">·</span>
              <span><b>类型</b>{kindText}</span>
              <span className="ed-meta-dot">·</span>
              <span><b>来源</b>{srcText}</span>
              <button type="button" className="ed-meta-link" onClick={() => notice('编辑信息：还没有写接口')}>编辑信息…</button>
            </div>
          )}
        />
      ) : body ? (
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
            <div className="rd-head">
              <div className="rd-meta">
                <span><b>来源</b>{srcText}</span>
                {doc.author ? <span><b>作者</b>{doc.author}</span> : null}
                {doc.updatedAt ? <span><b>来源更新</b>{copy ? '刚刚' : doc.updatedAt}</span> : null}
                <span><b>位置</b>{doc.module} › {doc.func}</span>
              </div>
              <div className="rd-note-line">
                <span>这是应用内保存的<b>只读副本</b> —— 正文由 {srcText} 维护，这里的改动不会回流。</span>
              </div>
            </div>
            {/* eslint-disable-next-line react/no-danger -- 见文件头：编辑态的「可视」面要求真实 DOM */}
            <div className="rd-body" onClick={onBodyClick} dangerouslySetInnerHTML={{ __html: html }} />
          </article>
        </div>
      ) : (
        <div className="rd-main">
          <div className="rd-empty">
            <div className="rd-empty-title">这一篇的原文还没同步进来</div>
            <div className="rd-empty-text">
              《{docName}》的正文住在 <b>{srcText}</b> 里。这一版只在应用内保存了几篇
              只读副本，其余几篇走的是"外链"这条路 —— 两种态都要能看得到。
            </div>
            <button type="button" className="btn btn-primary" onClick={() => notice(`在来源工具里打开：${srcText}`)}>
              在来源工具里打开
            </button>
          </div>
        </div>
      )}

      {/* 字数（原型语雀那个位置）：它是页级读数，不占纸头那一行 */}
      {body || editing ? <div className="rd-words">{words || '0 字'}</div> : null}
    </div>
  )
}
