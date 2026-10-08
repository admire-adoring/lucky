/* "打开原文"这件事的宿主接线。

   各处要做的是同一套：记住打开的是哪一篇、把它渲染成覆盖层、关掉时清空。
   收成一支 hook，调用处只留一行 `openSource(doc)`，免得五份 state 各自漂。

   覆盖层是 `position: fixed`，挂在哪个页面里都铺在顶栏之下，不需要 portal。

   宿主自己还有 Escape 的话，读 `sourceOpen` 让位 —— 一次 Esc 只关最上面那一层，
   否则按一下两屏一起退。 */

import { useCallback, useState } from 'react'
import { DocSourcePage } from './DocSourcePage'
import type { SourceDoc } from './source-doc'

export function useSourceOverlay(projectName: string, notice: (text: string) => void) {
  const [doc, setDoc] = useState<SourceDoc | null>(null)
  const openSource = useCallback((next: SourceDoc) => setDoc(next), [])
  const closeSource = useCallback(() => setDoc(null), [])
  const sourceNode = doc ? (
    <DocSourcePage doc={doc} projectName={projectName} onBack={closeSource} notice={notice} />
  ) : null
  return { openSource, closeSource, sourceOpen: doc !== null, sourceNode }
}
