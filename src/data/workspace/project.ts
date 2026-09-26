import type { DocumentItem, Task } from '../../types'

/**
 * 项目详情的**适配层**。
 *
 * 口径（从 2026-09-22 的第一版起没变过）：
 *   · **有真实来源的一律用真实数据** —— 任务 / 文档来自 `src/api/projects.ts` 的
 *     `fetchProjectDetail`（它按 `Project` 派生），所以 8 个项目打开是 8 份不同的内容。
 *   · **没有来源的**才走 `data/derive.ts` 的池子派生，并集中标注。
 *
 * ⚠️ 2026-09-25 项目详情页换成 `design/work/work_product-detail.html` 之后，
 *    这一层**瘦掉了一大半**：笔记 / 笔记连线 / 复盘 三张演示表连同它们对应的三个分区
 *    （笔记、知识图谱、复盘）一起删了 —— 那是用户明确要移除的，不是漏迁。
 *    里程碑与动态的适配器也一样没了消费者，一并删掉；要找回来看 git 历史，
 *    别照着 `design/project/project_index.html`（那是**旧**版式的原型）补回来。
 */

/** 任务状态：原型只有三档（应用里的 `blocked` 由适配层归入 `doing`） */
export type WsTaskStatus = 'todo' | 'doing' | 'done'

/**
 * 应用的任务优先级是三档（high / mid / low），原型那一格的徽标是三档中文。
 *
 * ⚠️ 这里**不造第四档**：映射到 P2 封顶。硬凑一个更高的优先级出来就是编数据。
 */
const PRIO_OF: Record<Task['priority'], 'P0' | 'P1' | 'P2'> = {
  high: 'P0',
  mid: 'P1',
  low: 'P2',
}

/* ------------------------------------------------------------------ *
 * 适配后的形状（页面只认这些）
 * ------------------------------------------------------------------ */

export interface WsTask {
  id: string
  title: string
  status: WsTaskStatus
  prio: 'P0' | 'P1' | 'P2'
  due: string
  late: boolean
  /** 承担人（应用的真实字段；原型这一格是"标签"，这里不编标签） */
  owner: string
}

export type WsDoc = DocumentItem

/** 任务状态：应用的 `blocked` 归入 `doing` —— 原型只有三档，而"阻塞"仍然是在做。 */
function statusOf(task: Task): WsTaskStatus {
  if (task.status === 'done') return 'done'
  if (task.status === 'doing' || task.status === 'blocked') return 'doing'
  return 'todo'
}

export function adaptTasks(tasks: Task[]): WsTask[] {
  return tasks.map((task) => ({
    id: task.id,
    title: task.name,
    status: statusOf(task),
    prio: PRIO_OF[task.priority],
    due: task.due,
    late: task.late,
    owner: task.owner,
  }))
}

/**
 * 文档这一层目前是恒等映射 —— 留着它是因为**它是这一页与领域模型之间的那一道缝**：
 * 将来文档要接真表（或要补 `kind` 之类页面专属字段）时，改的是这里，不是页面。
 */
export function adaptDocs(docs: DocumentItem[]): WsDoc[] {
  return docs
}
