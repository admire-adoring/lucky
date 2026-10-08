import type { ReactNode } from 'react'
import { cn } from '../../../lib/cn'
import type { DeployDocItem } from '../../../data/derive'
import { OpsIcon } from './ops-icon'

/* ==================================================================== *
 * 部署文档的那本「书」—— 精装四行版面（签+图标 / 题+发丝线+副题 / 页脚）
 *
 * 为什么单独一个组件、而不是复用 `DocBook.tsx`：
 *   `DocBook` 的 `kind` 是 `DocKind` 这个枚举（方案 / 设计 / 接口 / …），
 *   它的 `db-tag` 走 `DOC_KIND_LABEL`、`db-icon` 走 `DOC_KIND_ICON`。
 *   而部署文档的 `kind` 是自由字符串（手册 / 流程 / 脚本，池子 `DeployDocSeed` 里声明的），
 *   图形也跟着它分（脚本 → rocket，其余 → book）。硬塞进 `DocBook` 要么放开枚举、
 *   要么在调用处转写一层 —— 两条都会让"同一本书"长出一个第二说法。
 *   ⇒ 两本共用同一套基类（`.doc-book` / `.db-*` 在 `[data-module]` 一级只有一份），
 *     差的只是"标签与图形从哪儿来"，所以壳分成两个组件、材质仍是一份。
 *
 * 两处消费者：
 *   · `OpsPanel`（项目详情 · 运维）—— 那一格还要「下载 / 更多」两颗（传 `actions`）；
 *   · `ServerDetail`（服务器详情 · 文档）—— 那一页的书只有"点开读"一个动作，不传。
 *
 * `actions` 决定宿主元素：给了就必须是 `<div role="button">` ——
 *    `button` 里嵌 `button` 是无效 HTML（原型那一版也是这么改的）。
 *    而原型那条 `div` 只挂了 `onclick`，键盘用户够不到 ⇒ 这里补 Enter / Space。
 * ==================================================================== */

export function DeployDocBook({
  doc,
  onOpen,
  actions,
}: {
  doc: DeployDocItem
  onOpen: () => void
  /** 卡头上那两颗（下载 / 更多）。给了才包 `.book-actions`（顶行的让位规则挂在它上面） */
  actions?: ReactNode
}) {
  const shell = {
    className: cn('doc-book', doc.kind === '脚本' && 'script'),
    onClick: onOpen,
  }
  const shellProps = actions
    ? {
        ...shell,
        role: 'button' as const,
        tabIndex: 0,
        onKeyDown: (event: React.KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== ' ') return
          event.preventDefault()
          onOpen()
        },
      }
    : { ...shell, type: 'button' as const }

  const body = (
    <>
      <div className="db-top">
        <span className="db-tag">{doc.kind}</span>
        <span className="db-icon" aria-hidden="true">
          {/* 参考页这两个位置原本是 emoji（📘 / 🚀）⇒ 换成本仓同一张 24 网格表里的图形 */}
          <OpsIcon name={doc.kind === '脚本' ? 'rocket' : 'book'} size={14} />
        </span>
        {/* 这两颗是运维那一格特有的。做法：hover / 键盘进入时整条顶行让位 ——
            96px 宽的书框内只有 64px，排不下"签 + 图标 + 两个按钮"，
            于是 hover 前放"签 + 图标"、hover 后放这两颗，各用一刻（绝对定位 ⇒ 零重排）。 */}
        {actions ? (
          <span className="book-actions" onClick={(event) => event.stopPropagation()}>
            {actions}
          </span>
        ) : null}
      </div>

      <div className="db-mid">
        <div className="db-title">{doc.name}</div>
        <div className="db-rule">
          <span />
        </div>
        <div className="db-sub">{doc.version}</div>
      </div>

      {/* 书签：判据是今天动过（与页脚那句读数同一个 `< 24 小时` 口径，不另设阈值常量）。
          池子里那几本现在是 26 / 72 / 120 小时前 ⇒ 一本都不显示，规则留着，
          等真有"今天更新"的那本自己出现。 */}
      {doc.updatedHours < 24 ? <span className="db-mark" aria-hidden="true" /> : null}
      <div className="db-foot">
        <span>{doc.updatedAt}</span>
      </div>
    </>
  )

  return actions ? <div {...shellProps}>{body}</div> : <button {...shellProps}>{body}</button>
}
