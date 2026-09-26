import { useParams } from 'react-router-dom'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import {
  ProjectDetail,
  SECTION_TABS,
  useProjectDetailView,
} from '../../components/workspace/project-detail/ProjectDetail'

/**
 * 项目模块的详情页 —— `/projects/:id` 与 `/projects/:id/:tab`。
 *
 * ⚠️ 2026-09-25（第三轮）这一页只剩**套壳**：正文与状态搬到了
 *    `components/workspace/project-detail/ProjectDetail.tsx`，因为同一份详情现在
 *    还挂在**工作模块**下（`/work/projects/:id`，见 `WorkProjectDetailPage`）。
 *    这两处的差别只有壳与子分区基路径两样，理由写在那个文件的文件头。
 *    要改内容请改那边 —— 在这里补一行 JSX 只会让工作模块那一份悄悄落后。
 *
 * ⚠️ 环上给的是 `view.sections`（**由数据裁过**的分区表），不是 `SECTION_TABS`：
 *    work 域的项目有 7 个分区，生活/学习项目只有 4~5 个（判据见 `ProjectDetail` 文件头 ①）。
 */
export function ProjectsWorkspace() {
  const { id } = useParams<{ id: string }>()
  const view = useProjectDetailView(id, `/projects/${id ?? ''}`)

  /* 加载 / 失败两态**必须在壳里面**：那时连页面根都还没渲染（`ProjectDetail` 会直接 return null），
     让这两句话裸挂在路由上会得到一整页空白。环上这时给全集 —— 可见分区要等数据到了才裁得出来。 */
  if (view.isLoading || !view.data) {
    return (
      <WorkspaceLayout module="projects" tabs={SECTION_TABS} active={view.active} onSelectTab={view.select}>
        <div className="card">
          <div className="q-empty">{view.isError ? '项目加载失败' : '正在读取项目…'}</div>
        </div>
      </WorkspaceLayout>
    )
  }

  return (
    <WorkspaceLayout
      module="projects"
      tabs={view.sections}
      active={view.active}
      onSelectTab={view.select}
      topbarTitle={view.project?.name}
    >
      <ProjectDetail view={view} />
    </WorkspaceLayout>
  )
}
