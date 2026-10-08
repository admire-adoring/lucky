import { DOC_KIND_LABEL } from '../content-pool'
import { docUpdatedText } from '../derive'
import type { DocKind, DocLink, DocumentItem } from '../../types'

/* ============================================================================
   工作模块 · 文档索引（`/work/docs`）—— 跨项目的那一份清单
   ----------------------------------------------------------------------------
   2026-09-27：这一页整页换成与项目详情「文档」那一格同一套布局与组件
   （`DocLibrary`：左栏两级目录 + 工具栏 + 书墙/列表/图谱 + 主从详情屏）。

   为什么不进 `content-pool.ts` 的 `POOL`：那个池子按 `scope` 分，
      装的是"项目内的文档"（`buildDocuments(project)` 派生它）。
      这一页是跨项目的 —— 8 个项目各登记一份索引，外加公司工具里的部署手册类。
      `POOL` 装不下"一条文档属于哪个项目"这层信息，硬塞进去会让两条派生链打架。
   两维的名字在这一页换了语义（组件里那两个槽是通用的）：
      `module` = 项目（粗的那一层）、`func` = 这条索引属于该项目的哪一类
      （核心方案 / 接口契约 / 部署运维 …）。左栏标题由调用方传「项目与分类」。
   只存 `updatedHours`（数字），「昨天 / 3 天前」由 `docUpdatedText()` 算 ——
      与项目详情那边同一条口径（把文案写死，迟早与数字打架）。
   关联只留文档之间那一族（`family: 'doc'`）：跨项目的索引里，
      "这份索引拆出了别的项目里的哪个任务"没有意义，编出来就是假关系。
      反链照旧扫出来（不手挂第二份）。
   ============================================================================ */

interface WorkDocSeed {
  id: string
  name: string
  kind: DocKind
  /** 项目名（组件里的 `module` 位） */
  project: string
  /** 这一条属于该项目的哪一类（组件里的 `func` 位） */
  group: string
  /** 存在的工具：公司 Wiki / 部署文档 / 外部链接 */
  source: string
  author: string
  updatedHours: number
  /** 指向别的工作文档（写名字，与 `DocLinkSeed` 同一条判据：名字不会随重排漂移） */
  refs?: string[]
}

const SEEDS: WorkDocSeed[] = [
  { id: 'wd-1', name: '支付系统重构方案', kind: 'plan', project: 'Q4 客户交付系统重构', group: '核心方案',
    source: '公司 Wiki', author: '刘阳', updatedHours: 20, refs: ['接口设计规范'] },
  { id: 'wd-2', name: '接口设计规范', kind: 'api', project: 'Q4 客户交付系统重构', group: '接口契约',
    source: '公司 Wiki', author: '张琪', updatedHours: 72, refs: ['支付系统重构方案'] },
  { id: 'wd-3', name: '周会纪要 09-18', kind: 'ref', project: 'Q4 客户交付系统重构', group: '会议纪要',
    source: '会议纪要', author: '何敏', updatedHours: 48 },
  /* ↓ 部署手册类：2026-09-25 从撤掉的 `deploy` 分区吸收进来。与 `ServersPanel` 里那份
       不是重复登记：那边是"运维现场要用的清单"，这边是"全站文档的可检索入口"
       （用户两条口径都写了）。 */
  { id: 'wd-4', name: '生产环境部署手册', kind: 'spec', project: 'Q4 客户交付系统重构', group: '部署运维',
    source: '部署 · 生产', author: '刘阳', updatedHours: 26, refs: ['回滚流程'] },
  { id: 'wd-5', name: '回滚流程', kind: 'test', project: 'Q4 客户交付系统重构', group: '部署运维',
    source: '部署 · 生产', author: '张琪', updatedHours: 72 },
  { id: 'wd-6', name: '环境变量配置', kind: 'ref', project: 'Q4 客户交付系统重构', group: '部署运维',
    source: '部署 · 配置', author: '何敏', updatedHours: 168 },
  { id: 'wd-7', name: '发布检查清单', kind: 'spec', project: 'Q4 客户交付系统重构', group: '部署运维',
    source: '部署 · 检查清单', author: '刘阳', updatedHours: 48, refs: ['生产环境部署手册'] },
  { id: 'wd-8', name: '部署脚本 deploy.sh', kind: 'test', project: 'Q4 客户交付系统重构', group: '部署运维',
    source: '部署 · 脚本', author: '张琪', updatedHours: 120 },
  { id: 'wd-9', name: 'GitLab 仓库', kind: 'ref', project: 'Q4 客户交付系统重构', group: '仓库与链接',
    source: '外部链接', author: '何敏', updatedHours: 240 },
  { id: 'wd-10', name: 'OKR 对齐文档', kind: 'plan', project: '团队 OKR 落地推进', group: '目标对齐',
    source: '公司 Wiki', author: '刘阳', updatedHours: 60 },
  { id: 'wd-11', name: '季度复盘模板', kind: 'spec', project: '团队 OKR 落地推进', group: '目标对齐',
    source: '语雀', author: '张琪', updatedHours: 96, refs: ['OKR 对齐文档'] },
]

function buildWorkDocs(): DocumentItem[] {
  const list: DocumentItem[] = SEEDS.map((seed) => ({
    id: seed.id,
    name: seed.name,
    kind: seed.kind,
    module: seed.project,
    func: seed.group,
    source: seed.source,
    summary: '索引与外部链接，正文由原工具维护',
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

  /* 反链扫出来（与 `buildDocuments` 同一段做法）：只有文档之间才有反链。
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

export const WORK_DOC_INDEX: DocumentItem[] = buildWorkDocs()
