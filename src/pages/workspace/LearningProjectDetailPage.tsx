import { useNavigate, useParams } from 'react-router-dom'
import {
  ProjectDetail,
  useProjectDetailView,
} from '../../components/workspace/project-detail/ProjectDetail'
import { WorkspaceLayout } from '../../components/workspace/WorkspaceLayout'
import { tabPath } from '../../data/workspace/shell-nav'
import { TABS } from './learning/panels'

/* ============================================================================
   学习模块内打开的项目详情 —— `/learning/projects/:id` 与 `/learning/projects/:id/:tab`
   ----------------------------------------------------------------------------
   2026-09-27 加的这一条。结构依据（用户令）：

     「工作区的项目依赖项目区／学习区的项目依赖项目区／项目区是整体全局的／
       工作区的项目和学习区的项目，布局一致，只是有个性」

   ⇒ 与 `pages/workspace/WorkProjectDetailPage.tsx` 是同一形态的第二份壳，
     正文与数据都在 `components/workspace/project-detail/ProjectDetail.tsx`
     （第三处是项目模块自己的 `ProjectsWorkspace`，`/projects/:id`）。
     三处差别只有壳与子分区基路径两样 —— 这是本仓库里"一份页面挂多个入口"的既有做法
     （先例：`/projects/:id` ↔ `/work/projects/:id`）。

   ============================================================================
   两处与"工作模块那一份"不同的地方
   ============================================================================
   ① 环是学习模块的 8 个分区（`./learning/panels` 的 `TABS`），高亮固定在「实践项目」
     （key = `projects`）上；项目自己的 7 个分区退化成页内那条下划线横条。
     所以这一页读不到 `useParams().tab` 给学习模块用 —— 那个 `:tab` 是项目的子分区
        （`overview`/`bugs`/…），与学习模块的分区是两个命名空间。环上的点击因此要
        自己算地址（见 `selectLearningTab`），不能复用 `useModuleTab`。
   ② 正文多一条返回实践项目的回头路。在学习模块里这一页是一次下钻；环上「实践项目」
      那一项虽然也能回去，但那不是一条看得见的回头路。

   这一页不占学习模块的分区表：`TABS` 里没有、也不该有第九项。
      它是「实践项目」这一项的下钻视图，地址落在 `/learning/projects/` 这一段下面。
   与 `/learning/:tab`（两段）不冲突：这两条是三段与四段。React Router 按特异性排序，
      段数不同本来也不会互相抢。
   ============================================================================ */

export function LearningProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const view = useProjectDetailView(id, `/learning/projects/${id ?? ''}`)

  /**
   * 环上的点击 → 学习模块的分区地址。
   *
   * 地址必须由 `tabPath` 生成，不能写成 `navigate(\`/learning/${key}\`)`：
   *    `tabPath` 里那条"首个分区用裸路径"（`dashboard` → `/learning`）是 `useModuleTab`
   *    定的约定，两处算法不一致会出现"点了概览、地址变了、高亮还停在别处"。
   */
  const selectLearningTab = (key: string) => {
    const index = TABS.findIndex((tab) => tab.key === key)
    navigate(tabPath('learning', key, index === 0))
  }

  /* 加载 / 失败两态在壳里面（见 `ProjectDetail`：那时页面根还没渲染）。 */
  if (view.isLoading || !view.data) {
    return (
      <WorkspaceLayout module="learning" tabs={TABS} active="projects" onSelectTab={selectLearningTab}>
        <div className="card">
          <div className="q-empty">{view.isError ? '项目加载失败' : '正在读取项目…'}</div>
        </div>
      </WorkspaceLayout>
    )
  }

  return (
    /* `topbarTitle` 给项目名：侧栏头部与文档标题都会显示它，比显示「实践项目」这一格更有信息量。
       环上的高亮仍由 `active="projects"` 决定，两者互不影响。 */
    <WorkspaceLayout
      module="learning"
      tabs={TABS}
      active="projects"
      onSelectTab={selectLearningTab}
      topbarTitle={view.project?.name}
    >
      <ProjectDetail view={view} backTo={{ label: '实践项目', path: '/learning/projects' }} />
    </WorkspaceLayout>
  )
}
