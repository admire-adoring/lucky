import { useState } from 'react'
import { Icon } from '../../icons/Icon'
import { SCOPE_META, SORT_OPTIONS } from '../../../data/meta'
import { ProjectFormModal, type ProjectFormValue } from '../../projects/ProjectModal'
import { blankProjectPatch } from '../../../api/projects'
import { useProjectActions } from '../../../hooks/use-projects'
import { errorText } from '../../../api/error'
import { useUiStore } from '../../../stores/ui-store'
import type { Scope, SortMode } from '../../../types'

/* ============================================================================
   项目分区的顶栏动作：排序 + 新建（`/work/projects` 与 `/learning/projects`）
   ----------------------------------------------------------------------------
   与 `ProjectShelf` 同处共用层：那一份是版面（按 scope 参数化），这一份是它顶栏的
   两颗动作，两个域各来一份。原件在工作模块的 `ProjectDrawers.tsx` 里，2026-10-17 搬出来
   —— 学习域的「实践项目」要同一排动作，不该从 `work/` 目录里取。

   新建走的是项目模块那一套（同一个 `ProjectFormModal`、同一个 `blankProjectPatch`、
   同一批命令），只是 **scope 锁在当前域**：在这个模块里新建，归属本来就只有一个，
   给一个能改的下拉，只会让人建出"列表里看不见"的项目。
   项目模块自己的 `/projects` 是跨域总览，那里的表单仍然可选 —— 见 `ProjectsListPage`。
   ============================================================================ */

/**
 * 原型的「排序」是一个没有定义交互的 `.btn-ghost`（原型里点了没反应）。
 *    这里落成原生 `<select>` —— 不是自选，是沿用本仓已有的那条口径：
 *    `/projects` 的排序（`components/projects/ProjectToolbar.tsx`）就是一个原生 select，
 *    选项来自 `data/meta` 的 `SORT_OPTIONS`，偏好存在 `ui-store.sort`。
 *    于是两页的排序控件外形一致、偏好同一个字段、比较逻辑同一份（`lib/filter-projects`）。
 */
export function ProjectTopbarActions({
  scope,
  notice,
}: {
  /** 这个分区锁定的归属域（`work` / `learn`） */
  scope: Scope
  notice: (text: string) => void
}) {
  const sort = useUiStore((state) => state.sort)
  const setSort = useUiStore((state) => state.setSort)
  const actions = useProjectActions()
  const [creating, setCreating] = useState(false)

  const create = (value: ProjectFormValue) => {
    setCreating(false)
    actions.create.mutate(value, {
      /* scope 已锁，回读的归属恒等于参数；仍然说一句 —— "建成了"与"建到哪儿了"
         是两件事，后者在列表里看不见的时候最容易被问。 */
      onSuccess: (project) =>
        notice(`已创建「${project.name}」· 归到「${SCOPE_META[project.scope].label}」`),
      onError: (error) => notice(`创建失败：${errorText(error)}`),
    })
  }

  return (
    <>
      {/* 原生 `<select>` 而不是 `.btn`：`.btn` 是 `display: inline-flex`，
          套在 select 这种替换元素上会让它自己的箭头与内边距都失准。
          于是外壳样式写在 `.sort-select` 里（项目抽屉段），外形与旁边的 `.btn-ghost` 对齐。 */}
      <div className="sort-select">
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value as SortMode)}
          aria-label="排序方式"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <Icon name="i-chevron" className="sort-caret" />
      </div>
      <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
        + 新建项目
      </button>
      {creating ? (
        <ProjectFormModal
          mode="create"
          initial={blankProjectPatch(scope)}
          fixedScope={scope}
          onClose={() => setCreating(false)}
          onSubmit={create}
        />
      ) : null}
    </>
  )
}
