import { useMemo } from 'react'
import { DOC_KIND_LABEL } from '../../../data/content-pool'
import { cn } from '../../../lib/cn'
import { Icon } from '../../icons/Icon'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { copyOf, copyAgoText, useDocCopies } from '../../../data/workspace/doc-copies'
import type { DocKind, IconName } from '../../../types'

/* ============================================================================
   文档 · 书（精装封面，四行版面）—— 全站「一本书」只有这一种样子
   ----------------------------------------------------------------------------
   2026-09-27 统一（用户给了封面截图）：此前应用里有两套书 —— 概览格与文档书墙是
   "简版书脊"（`db-tag` + `db-title` + `db-meta` 三行），运维的部署文档是"精装四行"
   （`db-top` / `db-mid` / `db-rule` / `db-sub` / `db-foot`）。现在只剩这一份。

   四行版面：
     · `签 + 图形`        —— 类型签（左）+ 类型图形（右）
     · `题 + 发丝线 + 副题` —— 题居中偏上、发丝线带一粒菱形、副题 = 来源（部署文档那档给版本号）
     · `发丝线 + 页脚`     —— 左作者 · 右更新时间
   行距由两处 `margin-bottom: auto` 均分 ⇒ 题落在封面中部，而不是贴着上边。
   金书签（`db-mark`）= 今天动过 —— 判据是 `updatedHours < 24` 本身，不另设阈值常量。
   工作台那一档把它用作已收藏（原型 `work_index.html` 的文档段注明「差异③：
      那边表'今天动过'，本页表已收藏」）⇒ 给了 `marked` 这个显式口子。
      判据仍然只有一处：不传 `marked` 就走上面那条。

   版式与尺寸分开：这一份只管版式；尺寸由各自的档在 CSS 里覆盖那四个值
      （`--bk-spine` / `--bk-frame` / `--bk-frame-l` / `--bk-tag`，其余 calc 推）——
      概览格 92px · 紧凑档 88px · 书墙（栅格给宽）· 运维 96px。
   ============================================================================ */

/**
 * 种类 → 封面右上角那颗图形。
 *
 * 这是降级：就近取已有的 53 个精灵符号（与 `shell-nav.ts` 的 `TAB_ICON` 同一条判据）——
 *    原型用的是 emoji（📘📐🔌🧪📋🔍🔗），照抄会把 emoji 混进这一页的字阶里；
 *    为这 7 类新增 7 个 symbol 又要同时动 `IconSprite` 与 `IconName` 两处。
 */
export const DOC_KIND_ICON: Record<DocKind, IconName> = {
  plan: 'i-file',
  design: 'i-grid',
  api: 'i-link',
  test: 'i-check',
  spec: 'i-list',
  research: 'i-search',
  ref: 'i-layers',
}

/**
 * 一本书要的全部字段 —— 只有这几样，所以不要求调用方给整个 `DocumentItem`。
 * （工作模块的「文档索引」那是一份跨项目的清单，不是 `DocumentItem`；给一个窄类型，
 *   两处都能直接用，而 `DocumentItem` 是它的超集、天然兼容。）
 */
export interface DocBookDoc {
  /**
   * 应用内副本的键 —— 给了才订阅"编辑面保存之后那一次"。
   *
   * 保存会把正文回写副本、并把那一篇的 `hours` 归 0（原型 `edSave`）⇒ 书上要当场
   *    换名字 + 挂金书签 + 更新时间说"刚刚"。这三件事都由这里一处算出来，
   *    免得"存完了、书还是老样子"（那正是用户判断"保存没成功"的唯一依据）。
   * 工作模块那份「文档索引」是跨项目清单、没有 id ⇒ 不传，走原来的字段。
   *    这是"窄类型 + 可选口子"，不是新增一条必填契约。
   */
  id?: string
  name: string
  kind: DocKind
  /** 副题：它存在哪儿（文档 = 来源）／ 版本号（部署手册那一档） */
  source: string
  author: string
  /** 给金书签用：`< 24` 算"今天动过" */
  updatedHours: number
  /** 给人读的「多久没更新」。由 `docUpdatedText(hours)` 算，不在调用处手写字符串 */
  updatedAt: string
}

/**
 * 一本书。
 *
 * `script` 那支是原型给部署脚本用的深灰封面（`.doc-book.script`，白字压 #374151 = 10.4:1，
 * 不随主题换）。`onOpen` 给了才挂"可点"那一套（role / tabIndex / Enter / Space）——
 * 概览格那几本与「文档索引」那一页都是不可点的缩略，书墙与详情屏里的是入口。
 * 不给 `onOpen` 时 CSS 会一并去掉"可点"的两个信号（手型 + 悬停抬起），见那段注释。
 */
export function DocBook({
  doc,
  script = false,
  marked,
  onOpen,
  actions,
}: {
  doc: DocBookDoc
  script?: boolean
  /** 金缎带。不传 = 按「今天动过」（`updatedHours < 24`）判；传了就听调用方的 */
  marked?: boolean
  onOpen?: () => void
  /**
   * 书墙上的四件事（预览正文 / 进入详情 / 编辑 / 删除）。
   *
   * 给了才包一层 `.doc-book-wrap` 并把抽屉挂上 —— 书本身 `overflow: hidden`
   *    （压印框与缎带要裁），抽屉装不进去；而且它是"延伸出去的一截"，抬起与歪要跟着书一起走
   *    （所以 hover 那一步的主角是外层）。概览格 / 运维 / 详情屏那几处不传：原型也只在书墙传。
   */
  actions?: { onPreview: () => void; onEdit: () => void; onDelete: () => void }
}) {
  /* 订阅"应用内副本"：保存之后这一本当场更新（名字 / 缎带 / 更新时间）。
     `version` 只是用来触发重渲的 —— 值本身不用判断，真正的读值是底下那句 `copyOf`。 */
  const version = useDocCopies()
  const copy = useMemo(() => copyOf(doc.id), [doc.id, version])
  const name = copy?.name ?? doc.name
  const updatedHours = copy ? 0 : doc.updatedHours
  const updatedAt = copy ? copyAgoText(copy) : doc.updatedAt

  const book = (
    <div
      className={cn('doc-book', `dk-${doc.kind}`, script && 'script')}
      {...(onOpen
        ? {
            role: 'button',
            tabIndex: 0,
            'aria-label': `打开《${name}》`,
            onClick: onOpen,
            onKeyDown: (event: ReactKeyboardEvent) => {
              if (event.key !== 'Enter' && event.key !== ' ') return
              event.preventDefault()
              onOpen()
            },
          }
        : {})}
    >
      {(marked ?? updatedHours < 24) ? <span className="db-mark" aria-hidden="true" /> : null}
      <div className="db-top">
        <span className="db-tag">{DOC_KIND_LABEL[doc.kind]}</span>
        <span className="db-icon" aria-hidden="true">
          <Icon name={DOC_KIND_ICON[doc.kind]} />
        </span>
      </div>
      <div className="db-mid">
        <div className="db-title">{name}</div>
        <div className="db-rule">
          <span />
        </div>
        <div className="db-sub">{doc.source}</div>
      </div>
      <div className="db-foot">
        <span>{doc.author}</span>
        <span>{updatedAt}</span>
      </div>
    </div>
  )

  if (!actions) return book

  return (
    <div
      className="doc-book-wrap"
      /**
       * 抽屉翻不翻到左侧是实测的（原型 `docActsSide`）：右边缘 + 抽屉宽 > 书墙右边界
       *    ⇒ 加 `is-left`。这里直接改 `classList`、不走 state —— 它只影响 hover 态的一个视觉
       *    开关，而每次 hover 都让整面书墙重渲染（书一多就掉帧）。
       *    判据取"实测"而不是"这一排有几本"：列数由 `minmax` 与容器宽共同决定，猜不准。
       */
      onMouseEnter={(event) => {
        const wrap = event.currentTarget
        const acts = wrap.querySelector('.doc-book-acts')
        const shelf = wrap.closest('.doc-shelf')
        if (!acts || !shelf) return
        const overflowRight =
          wrap.getBoundingClientRect().right + (acts as HTMLElement).offsetWidth - 6 >
          shelf.getBoundingClientRect().right
        wrap.classList.toggle('is-left', overflowRight)
      }}
    >
      {book}
      {/* 只有图形 ⇒ 动作名靠 `title` / `aria-label`（悬停有提示、读屏读得到）。
          删除那颗带 `data-dd-del`：破坏性动作只在指向它时变红（CSS 那一档） */}
      <div className="doc-book-acts">
        <button type="button" title="预览正文" aria-label="预览正文" onClick={actions.onPreview}>
          <Icon name="i-eye" />
        </button>
        <button type="button" title="进入详情" aria-label="进入详情" onClick={onOpen}>
          <Icon name="i-arrow-right" />
        </button>
        <button type="button" title="编辑" aria-label="编辑" onClick={actions.onEdit}>
          <Icon name="i-edit" />
        </button>
        <button type="button" data-dd-del="" title="删除" aria-label="删除" onClick={actions.onDelete}>
          <Icon name="i-trash" />
        </button>
      </div>
    </div>
  )
}
