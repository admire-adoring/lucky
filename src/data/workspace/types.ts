/**
 * 「模块工作区」这一层的类型。
 *
 * 为什么单独一层类型而不是复用 `src/types/index.ts`：
 *   那套类型描述的是**领域模型**（Project / Task / Milestone…，22 个必填字段）。
 *   这一层描述的是**界面**：哪个页面有哪些 Tab、每块面板长什么样。
 *   两者会互相引用（项目工作区的面板里就有 Project），但不等同 ——
 *   把界面结构塞进领域模型会让领域模型变成万能结构。
 */

/** 有独立页面的 8 个模块。`dashboard`（工作台）不在其中，它由九宫环那套渲染。 */
export type WorkspacePageKey =
  | 'tasks'
  | 'calendar'
  | 'life'
  | 'work'
  | 'learning'
  | 'projects'
  | 'knowledge'
  | 'settings'

/**
 * 九个菜单域的 key —— 与 `prism.css` 的九模块色槽、`design/*_index.html`
 * 的 `--a-<模块>-*` / `--s-<模块>` 同名。三处必须同步。
 *
 * ⚠️ 这里是**九**个而不是八个：`dashboard` 没有独立页面，但侧栏第 1 项要用它的强调色。
 */
export type WorkspaceModuleKey = 'dashboard' | WorkspacePageKey

/** 一个 Tab：路由片段 + 标签。标签同时用于顶栏面包屑的尾部。 */
export interface ModuleTab {
  key: string
  label: string
}
