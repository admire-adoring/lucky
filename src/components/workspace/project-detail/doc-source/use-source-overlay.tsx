/* "打开原文"这件事的宿主接线。

   各处要做的是同一套：记住打开的是哪一篇、把它渲染成覆盖层、关掉时清空。
   收成一支 hook，调用处只留一行 `openSource(doc)`，免得五份 state 各自漂。

   第二个参数是"进去落在哪个镜头"：不传就沿用上一次的镜头（`PANE` 是模块级的，
   与原型 `rdPane` 同一条口径），传 `'edit'` 就是书上的"编辑"那颗 —— 点一下直接进编辑面。

   覆盖层是 `position: fixed`，挂在哪个页面里都铺在顶栏之下，不需要 portal。

   宿主自己还有 Escape 的话，读 `sourceOpen` 让位 —— 一次 Esc 只关最上面那一层，
   否则按一下两屏一起退。 */

import { useCallback, useState } from 'react'
import { DocSourcePage, type Pane } from './DocSourcePage'
import type { SourceDoc } from './source-doc'

export function useSourceOverlay(
  projectName: string,
  notice: (text: string) => void,
  /** 改这一篇的登记信息。只有宿主真有那个弹窗时才给（见 `DocSourcePage`） */
  onEditMeta?: (doc: SourceDoc) => void,
) {
  const [open, setOpen] = useState<{ doc: SourceDoc; pane?: Pane } | null>(null)
  const openSource = useCallback((next: SourceDoc, pane?: Pane) => setOpen({ doc: next, pane }), [])
  const closeSource = useCallback(() => setOpen(null), [])
  const sourceNode = open ? (
    <DocSourcePage
      doc={open.doc}
      projectName={projectName}
      initialPane={open.pane}
      onBack={closeSource}
      onEditMeta={onEditMeta}
      notice={notice}
    />
  ) : null
  return { openSource, closeSource, sourceOpen: open !== null, sourceNode }
}
