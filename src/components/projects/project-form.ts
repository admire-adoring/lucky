import type { ProjectPatch } from '../../api/projects'
import type { Project } from '../../types'

/**
 * 项目 → 编辑表单的初值（`ProjectPatch` 那十列，与 `ProjectFormModal` 的 `initial` 同形）。
 *
 * 三处都要它：项目列表页、工作台的项目卡、项目详情的 Hero。放这里而不是各写一份 ——
 * 少一列就是"编辑时那一项被清空"，而这种错在界面上看不出来（保存前后都不报错）。
 *
 * `path` 的 `''` 是刻意的：`Project.path` 可选（没有目录的项目本来就没有），
 * 而表单要的是字符串；写回时 `''` 落成 `null`（见 `api/projects.ts` 的 `ProjectPatch` 注释）。
 */
export function patchOf(project: Project): ProjectPatch {
  return {
    name: project.name,
    description: project.description,
    scope: project.scope,
    priority: project.priority,
    status: project.status,
    dueDate: project.dueDate,
    tags: project.tags,
    owners: project.owners,
    milestone: project.milestone,
    path: project.path ?? '',
  }
}
