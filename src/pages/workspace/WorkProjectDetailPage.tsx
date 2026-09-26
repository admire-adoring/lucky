import { useNavigate, useParams } from 'react-router-dom'
import {
  ProjectDetail,
  useProjectDetailView,
} from '../../components/workspace/project-detail/ProjectDetail'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { tabPath } from '../../data/workspace/shell-nav'
import { TABS } from './work/panels'

/* ============================================================================
   工作模块内打开的项目详情 —— `/work/projects/:id` 与 `/work/projects/:id/:tab`
   ----------------------------------------------------------------------------
   2026-09-25（第三轮）按用户的要求加的这一条：在工作模块的「项目」分区里点开一个抽屉，
   **不要再跳到独立的项目模块**（`/projects/:id`），详情就在工作模块内打开。
   于是同一份详情挂两处，正文与数据都在
   `components/workspace/project-detail/ProjectDetail.tsx`，这里只负责套壳。

   ============================================================================
   两处与"项目模块的详情页"不同的地方（都在这份壳里，正文一模一样）
   ============================================================================
   ① **环是工作模块的 7 个分区**（`./work/panels` 的 `TABS`），高亮**固定在「项目」**上；
      项目自己的 7 个分区退化成页内那条下划线横条。项目模块那一份反过来：环就是项目分区。
      ⚠️ 所以这一页**读不到 `useParams().tab` 给工作模块用** —— 那个 `:tab` 是项目的子分区
         （`overview`/`bugs`/…），与工作模块的分区是两个命名空间。环上的点击因此要
         自己算地址（见 `selectWorkTab`），不能复用 `useModuleTab`。
   ② 正文多一条**返回项目**的回头路。在工作模块里这一页是一次下钻；环上「项目」那一项
      虽然也能回去，但那不是一条看得见的回头路。项目模块的详情是那个模块的根页面，没有上一层。

   ⚠️ 这一页**不占**工作模块的分区表：`TABS` 里没有、也不该有 `uid` 之类的第八项。
      它是「项目」这一项的下钻视图，地址落在 `/work/projects/` 这一段下面。
   ============================================================================ */

export function WorkProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const view = useProjectDetailView(id, `/work/projects/${id ?? ''}`)

  /**
   * 环上的点击 → 工作模块的分区地址。
   *
   * ⚠️ 地址必须由 `tabPath` 生成，**不能**写成 `navigate(\`/work/${key}\`)`：
   *    `tabPath` 里那条"首个分区用裸路径"（`dashboard` → `/work`）是 `useModuleTab`
   *    定的约定，两处算法不一致会出现"点了工作台、地址变了、高亮还停在别处"。
   */
  const selectWorkTab = (key: string) => {
    const index = TABS.findIndex((tab) => tab.key === key)
    navigate(tabPath('work', key, index === 0))
  }

  /* 加载 / 失败两态**在壳里面**（见 `ProjectDetail`：那时页面根还没渲染）。 */
  if (view.isLoading || !view.data) {
    return (
      <WorkspaceLayout module="work" tabs={TABS} active="projects" onSelectTab={selectWorkTab}>
        <div className="card">
          <div className="q-empty">{view.isError ? '项目加载失败' : '正在读取项目…'}</div>
        </div>
      </WorkspaceLayout>
    )
  }

  return (
    /* `topbarTitle` 给项目名：侧栏头部与文档标题都会显示它，比显示「项目」这一格更有信息量。
       环上的高亮仍由 `active="projects"` 决定，两者互不影响。 */
    <WorkspaceLayout
      module="work"
      tabs={TABS}
      active="projects"
      onSelectTab={selectWorkTab}
      topbarTitle={view.project?.name}
    >
      <ProjectDetail view={view} backTo={{ label: '项目', path: '/work/projects' }} />
    </WorkspaceLayout>
  )
}
