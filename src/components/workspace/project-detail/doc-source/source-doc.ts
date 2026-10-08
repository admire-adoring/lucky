/* 原文页的入参契约。

   这一页会被三种"文档"打开：文档索引的书（`DocumentItem`）、运维那一格的部署文档
   （`DeployDocItem`）、以及以后别处冒出来的书。三者字段各不相同，而页面只读其中几样，
   所以在这里收成一支形状 —— 谁打开谁按这个形状给。

   `kind` 两边的取值域不同：文档索引是 `DocKind` 键（显示时查 `DOC_KIND_LABEL`），
   部署文档是自由串（它自己就是文案）。页面查表兜底回原值，两条都对。
   `source` 可缺：部署文档没有"存在哪个工具里"这一说，缺了页面统一说「来源工具」。 */

import type { DeployDocItem } from '../../../../data/derive'

export interface SourceDoc {
  id: string
  name: string
  /** 位置那两级（面包屑与编辑面的坐标行读它） */
  module: string
  func: string
  kind: string
  /** 来源工具。缺省 = 没有这一说，页面说「来源工具」 */
  source?: string
  author?: string
  updatedAt?: string
}

/* 文档索引那一族的 `DocumentItem` 本身就是这个形状的超集，调用处直接传，不转写。 */

/** 部署文档：它没有"模块 / 功能"两级，位置那一行给项目名与「部署文档」。 */
export function deploySourceDoc(doc: DeployDocItem, projectName: string): SourceDoc {
  return {
    id: doc.id,
    name: doc.name,
    module: projectName,
    func: '部署文档',
    kind: doc.kind,
    updatedAt: doc.updatedAt,
  }
}
