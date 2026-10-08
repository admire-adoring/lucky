/* ============================================================================
   文档正文的「应用内副本」—— 可变的那一层
   ----------------------------------------------------------------------------
   事实源：`doc-bodies.ts` 里那份只读副本（机器转写自原型）。
   这一层加的是「编辑面点了保存之后」的结果 —— 原型 `edSave` 把块写回
   `POOL[scope].documents[i].body` 并把 `hours` 归 0（那本书立刻挂金书签）。

   本仓的文档数据是静态常量（`data/workspace/project.ts`）⇒ 保存只能落在这一层上。
      它是会话内的覆盖（原型也是内存），刷新即回到只读副本 —— 与"原型演示"同一档
      诚实度：不假装写进了后端，也不假装回流去了来源工具。
   用 `useSyncExternalStore` 而不是 Context：消费者是三棵不同的树
      （原文页 / 详情屏 / 文档主页的书墙），而"保存"这个动作要从编辑器一路通知到书墙 ——
      订阅比层层传 props 短，也免得漏一处（漏了就是"存完书不改样"）。
   ============================================================================ */

import { useSyncExternalStore } from 'react'
import type { RdBlock } from './doc-bodies'

export interface DocCopy {
  /** 保存时的文档名（编辑面那个标题框能改它） */
  name: string
  body: RdBlock[]
  /** 保存时刻。书上的「更新时间」由它现算 —— 存一个"刚刚"这种字符串会立刻过期 */
  at: number
}

const COPIES = new Map<string, DocCopy>()
const SUBS = new Set<() => void>()
let VERSION = 0

function emit(): void {
  VERSION += 1
  SUBS.forEach((fn) => fn())
}

export function copyOf(id: string | undefined): DocCopy | undefined {
  return id ? COPIES.get(id) : undefined
}

export function saveCopy(id: string, name: string, body: RdBlock[]): void {
  COPIES.set(id, { name, body, at: Date.now() })
  emit()
}

/** 版本号 —— 组件的唯一用途是"订阅，让重渲发生"，值本身不用判断。 */
export function useDocCopies(): number {
  return useSyncExternalStore(
    (fn) => { SUBS.add(fn); return () => { SUBS.delete(fn) } },
    () => VERSION,
    () => VERSION,
  )
}

/** 保存之后那本书什么时候"动过"。原型 `edSave` 写的是 `hours = 0` ⇒ 一律「刚刚」。 */
export function copyAgoText(copy: DocCopy): string {
  const min = Math.floor((Date.now() - copy.at) / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  return `${Math.floor(min / 60)} 小时前`
}
