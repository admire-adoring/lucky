import { DOC_KIND_LABEL } from '../content-pool'
import { docUpdatedText } from '../derive'
import type { DocKind, DocLink, DocumentItem } from '../../types'

/* ============================================================================
   学习模块 · 笔记（`/learning/notes`）—— 挂在学习对象下的那一份笔记清单
   ----------------------------------------------------------------------------
   2026-09-27：这一页整页换成与项目详情「文档」那一格、工作模块「文档索引」同一套布局与组件
   （`DocLibrary`：左栏两级目录 + 工具栏 + 书墙/列表/图谱 + 主从详情屏）。

   与「知识库 · 笔记」是两件事（判据早就定过，别合并）：
      学习模块的笔记 = 过程库 —— 随来源（课程 / 书 / 项目）结束而失效，
      挂在学习对象下，要复习到期 / 闪卡 / 掌握度，升级为永久笔记后移出；
      知识库的笔记 = 沉淀库 —— 脱离来源仍成立，挂在概念下（主题 / 标签 / 双链），只进不出。
      ⇒ 两个页面的粗维不同：这里是「来源（学习对象） → 主题」，知识库那边是「模块 → 功能」。
   `kind` 仍借用文档那一张 7 类表（`DOC_KINDS`）：它在应用里本来就读作
      "这一类内容是什么"（设计 / 规范 / 调研 / 测试 / 参考 …），条数少时那几类为 0 是正常缺口。
      不另造一张"笔记类型"表 —— 那要同时造色板与图标，性价比不划算（用户要的是同一个布局）。
   只存 `updatedHours`（数字），「昨天 / 3 天前」由 `docUpdatedText()` 算。
   关联只留笔记之间那一族（`family: 'doc'`）：这一页的"产出到哪个任务"归学习项目页，
      这里编出来就是假关系。反链照旧扫出来。
   ============================================================================ */

interface LearnNoteSeed {
  id: string
  name: string
  kind: DocKind
  /** 学习对象（书 / 课程 / 项目）—— 组件里的 `module` 位 */
  from: string
  /** 主题 —— 组件里的 `func` 位 */
  topic: string
  /** 存在哪儿：本地 Markdown / 语雀 / Git 仓库 */
  source: string
  author: string
  updatedHours: number
  /** 指向本页的另一条笔记（写名字，与 `DocLinkSeed` 同一条判据） */
  refs?: string[]
}

const SEEDS: LearnNoteSeed[] = [
  { id: 'ln-1', name: 'React 19 新特性', kind: 'research', from: '前端工程化（课程）', topic: 'React',
    source: '本地 Markdown', author: '刘阳', updatedHours: 20, refs: ['闪卡：React Hooks 规则'] },
  { id: 'ln-2', name: 'Vite 构建优化记录', kind: 'ref', from: '前端工程化（课程）', topic: '构建工具',
    source: '本地 Markdown', author: '刘阳', updatedHours: 48 },
  { id: 'ln-3', name: '弥散风格 UI 要点', kind: 'design', from: '设计系统实践（项目）', topic: '视觉设计',
    source: '语雀', author: '张琪', updatedHours: 72 },
  { id: 'ln-4', name: 'TypeScript 类型体操笔记', kind: 'spec', from: '前端工程化（课程）', topic: '类型系统',
    source: '本地 Markdown', author: '刘阳', updatedHours: 120 },
  { id: 'ln-5', name: 'Rust 所有权与借用', kind: 'spec', from: '《Rust 异步编程》', topic: '语言基础',
    source: '本地 Markdown', author: '刘阳', updatedHours: 96, refs: ['async / await 状态机拆解'] },
  { id: 'ln-6', name: 'async / await 状态机拆解', kind: 'design', from: '《Rust 异步编程》', topic: '异步运行时',
    source: '本地 Markdown', author: '刘阳', updatedHours: 30, refs: ['Executor 源码走读'] },
  { id: 'ln-7', name: 'mini-runtime 骨架笔记', kind: 'plan', from: 'mini-runtime 实战（项目）', topic: '异步运行时',
    source: 'Git 仓库', author: '刘阳', updatedHours: 12 },
  { id: 'ln-8', name: 'Executor 源码走读', kind: 'ref', from: 'mini-runtime 实战（项目）', topic: '异步运行时',
    source: 'Git 仓库', author: '刘阳', updatedHours: 60 },
  { id: 'ln-9', name: 'D3 比例尺速查', kind: 'ref', from: '数据可视化课程', topic: '图表',
    source: '语雀', author: '张琪', updatedHours: 168 },
  { id: 'ln-10', name: '闪卡：React Hooks 规则', kind: 'test', from: '前端工程化（课程）', topic: 'React',
    source: '本地 Markdown', author: '刘阳', updatedHours: 6 },
]

function buildLearnNotes(): DocumentItem[] {
  const list: DocumentItem[] = SEEDS.map((seed) => ({
    id: seed.id,
    name: seed.name,
    kind: seed.kind,
    module: seed.from,
    func: seed.topic,
    source: seed.source,
    summary: '笔记正文留在原工具里，这里只存索引与双链',
    updatedAt: docUpdatedText(seed.updatedHours),
    updatedHours: seed.updatedHours,
    author: seed.author,
    links: (seed.refs ?? []).flatMap((name): DocLink[] => {
      const target = SEEDS.find((s) => s.name === name)
      if (!target) return []
      return [{ kind: 'ref', family: 'doc', id: target.id, label: target.name, meta: DOC_KIND_LABEL[target.kind] }]
    }),
    back: [],
  }))

  /* 反链扫出来（同一段做法）：只有笔记之间才有反链。
     必须等 `list` 建完再扫 —— 一条边可能指向排在后面的那一条。 */
  list.forEach((doc) => doc.links.forEach((link) => {
    const target = list.find((d) => d.id === link.id)
    if (!target) return
    target.back.push({
      kind: link.kind, family: 'doc', id: doc.id, label: doc.name, meta: DOC_KIND_LABEL[doc.kind],
    })
  }))

  return list
}

export const LEARN_NOTES: DocumentItem[] = buildLearnNotes()
