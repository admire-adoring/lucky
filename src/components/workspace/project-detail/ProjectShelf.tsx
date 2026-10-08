import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { cn } from '../../../lib/cn'
import { buildDocuments, isClosed, ownerDisplayName } from '../../../data/derive'
import { useProjects } from '../../../hooks/use-projects'
import { filterProjects } from '../../../lib/filter-projects'
import { useUiStore } from '../../../stores/ui-store'
import type { Project, ProjectStatus, Scope } from '../../../types'

/* ============================================================================
   项目列表（抽屉网格）——「档案柜」版式，挂在多个领域下
   ----------------------------------------------------------------------------
   事实源：`design/work/work_project_v2.html`（工作模块的「项目」分区）。
   2026-09-27（第四轮）把原来只属于工作模块的那一份抽到这里，按 `scope` 参数化。

   为什么抽：用户定的结构是「工作区的项目、学习区的项目都依赖项目区，
   项目区是整体全局的；两处布局一致，只是有个性」。
   ⇒ 列表版式属于「项目区」，不属于任何一个领域模块。复制一份的代价不是多 200 行，
     而是两处的配色表、meta 三段、缩略图数量会各自漂移。

   挂了哪几处（新增一处只需再写一个 3 行的壳，见下面的调用方）：
     · `/work/projects`      —— 工作模块「项目」分区（`components/workspace/work/ProjectDrawers.tsx`）
     · `/learning/projects`  —— 学习模块「实践项目」分区（`components/workspace/learning/PracticeProjects.tsx`）

   两个调用方与这里的关系（这就是「布局一致，只是有个性」的全部内容）：
     · 一致：本文件整份。版式、抽屉隐喻、状态四色、meta 三段、缩略规则。
     · 个性：只有两个入参 —— `scope`（列哪些项目）与 `basePath`（点开去哪儿），
       外加标题那一个节点（`title`，各模块自己的措辞 + 自己的 `.accent` 强调色）。
       强调色不需要在这里做：`.page-title .accent { color: var(--mw-m-main) }`
          取的是当前模块的强调色，`data-module` 一变它自己就跟着变。

   样式作用域：`.mw-root[data-module] .drawer*`（属性不带值）。
      写成 `[data-module='work']` 时，学习模块那一份会一条规则都不命中 ——
      页面照常渲染、只是全裸，且零报错。判据在 `styles/module-workspace.css` 的项目抽屉段首。

   排序不在这里重新实现：它读应用的 `ui-store.sort` 并复用 `lib/filter-projects`，
      与 `/projects`（项目域的全局列表页）是同一个偏好（同一个 store 字段），不另起一套。

   ============================================================================
   与原型有意不同的三处（都是"静态页 → 应用"必然要改的，不是审美）
   ============================================================================
   ① 配色从"四个样本的随手配色"改成状态表。原型给 4 个样本各配一色
      （含把已归档那支配成 slate），那是点缀、不是语义；应用里四色与
      `ProjectStatus` 一一对应，于是"哪一抽屉有风险/已归档"一眼可辨。
      · `active → rose`、`planning → purple`、`done → slate` 沿用原型那三支；
      · `risk → amber` 是新加的（原型样本里没有风险项目）；
      · 原型第四支 `cyan` 因此没有状态可用，已删 —— 留着就是死规则。
      这张表与项目详情页的 `STATUS_CLASS`
         （`components/workspace/project-detail/ProjectDetail.tsx`）
         是同一套颜色：从抽屉点进去，主色不变。

   ② 抽屉里那排缩略书脊用序号，不用图标。原型写的是 `${d.icon}`（emoji），
      而应用里 `DocumentItem` 没有 icon 字段，文档名也是标题不是文件名
      （「技术方案 v3」，没有扩展名）⇒ 按扩展名推图标也推不出来。
      硬编一套"图标表"就是造假字段；序号（1/2/3）是真实顺序，且更像档案柜里的编号。

   ③ meta 行换成有来源的三段。原型是「负责人 · N 个资源」，而资源数在应用里
      恒为 4（`buildDocuments` 固定派生 4 份）—— 一行永远不变的字等于没信息。
      换成 `负责人 · 进度 N% · 剩余/归档`，三个都是 `Project` 上的真字段。

   页头两个块（`.page-head` / `.page-title`）不带 margin（原型 `.tabs` 24px /
      `.page-head` 32px 那两条没搬）—— `.panel` 自己就是 flex 列 + gap 20px，
      再写一遍就是双倍间距（与 `WorkspaceSidebar` 那条"别让包裹层决定间距"是同一条纪律）。
   ============================================================================ */

/**
 * 状态 → 抽屉主色（见文件头 ①）。
 *
 * 四个类是新增的（内核里原有 `.p-*`），写在 `styles/module-workspace.css`
 *    的项目抽屉段里；色板与原型 `work_project_v2.html` 的「4 个主题色」一致，
 *    只有 `amber` 是补的（原型样本里没有风险项目）。
 */
const DRAWER_THEME: Record<ProjectStatus, string> = {
  active: 'p-rose',
  risk: 'p-amber',
  planning: 'p-purple',
  done: 'p-slate',
  /* 归档与「已完成」同色：都是"已经收口"，抽屉上那一条色带只用来区分"在推进的"
     与"已收口的"，再分一层就失去区分度了 */
  archived: 'p-slate',
}

/** 抽屉里最多摆几份缩略；多出来的走「+N」 */
const PREVIEW_LIMIT = 3

/** 「剩余 38 天」/「已逾期 3 天」。与 `ProjectsListPage` 是同一套措辞（那边也是就地写的）。 */
function leftText(daysLeft: number): string {
  return daysLeft >= 0 ? `剩 ${daysLeft} 天` : `逾期 ${-daysLeft} 天`
}

/** 已收口的抽屉不报"逾期 N 天" —— 那个数字对一件已经收尾的事没有意义。
 *  判据是 `isClosed`（已完成 或 已归档），不是 `status === 'done'`：
 *     2026-09-27 起多了「已归档」这个真状态，只认 done 会让归档的项目
 *     在这一栏里报"剩 N 天"。 */
function trailingOf(project: Project): string {
  return isClosed(project) ? '已归档' : leftText(project.daysLeft)
}

/**
 * 负责人那一格的文案。
 *
 * 不用 v1 那句 `owners.map(ownerDisplayName).join(' · ')`：这一行是 11.5px 的小字，
 *    而 `p3` 的 `owners` 是 `['LY', 'ZQ', 'HM']`，名字表（`derive.ts` 的 `OWNER_NAMES`）
 *    只登记了 `LY → 刘阳` —— 于是那三格会渲染成「刘阳 · ZQ · HM」，两个内部代号摆在
 *    最显眼的一行上。v2 原型的 meta 本来就是单负责人（「杨刘 · 3 个资源」），
 *    所以这里取首位 + 「等 N 人」，与原型的分量一致，也不瞒人数。
 */
function ownerText(project: Project): string {
  const first = ownerDisplayName(project.owners[0] ?? project.ownerId)
  return project.owners.length > 1 ? `${first} 等 ${project.owners.length} 人` : first
}

/* ------------------------------------------------------------------ *
 * 一个抽屉
 * ------------------------------------------------------------------ */

function Drawer({ project, onOpen }: { project: Project; onOpen: (id: string) => void }) {
  const archived = isClosed(project)
  /* 缩略用派生的文档（`buildDocuments` 按 id 确定性取值），不发请求：
     每张卡都挂一个 `useProjectDetail` 就是 N 个查询，而这里要的只是"有几份、长什么样"。 */
  const docs = buildDocuments(project)
  const shown = docs.slice(0, PREVIEW_LIMIT)
  const rest = docs.length - shown.length

  const open = () => onOpen(project.id)

  return (
    <div
      className={cn('drawer', DRAWER_THEME[project.status], archived && 'archived')}
      role="button"
      tabIndex={0}
      aria-label={`${project.name} · 进度 ${project.progress}% · ${trailingOf(project)}`}
      onClick={open}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        open()
      }}
    >
      <div className="drawer-face">
        {/* 把手：三点。纯装饰，所以 aria-hidden —— 整块的可点语义在 .drawer 上。 */}
        <div className="drawer-handle" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        {shown.length ? (
          <div className="drawer-preview" aria-hidden="true">
            {shown.map((doc, i) => (
              <div key={doc.id} className="preview-book">
                {i + 1}
              </div>
            ))}
            {rest > 0 ? <span className="preview-more">+{rest}</span> : null}
          </div>
        ) : null}

        <div className="drawer-content">
          <div className="drawer-name">{project.name}</div>
          <div className="drawer-meta">
            <span className="meta-dot" />
            <span>{ownerText(project)}</span>
            <span>·</span>
            <span>进度 {project.progress}%</span>
            <span>·</span>
            <span>{trailingOf(project)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * 页面
 * ------------------------------------------------------------------ */

export function ProjectShelf({
  scope,
  basePath,
  title,
  emptyText = '这个领域还没有项目',
}: {
  /** 这一页的口径。放宽到"全部项目"只改调用方那一个值 —— 但那就和 `/projects` 重复了。 */
  scope: Scope
  /** 点开一个抽屉要去的前缀（不含 id）。由壳按 `useModuleTab` 的约定给。 */
  basePath: string
  /** 页头标题。各模块自己的措辞，强调色写 `<span className="accent">`。 */
  title: ReactNode
  /** 空态文案（默认与工作模块一致） */
  emptyText?: string
}) {
  const { data: projects = [], isLoading } = useProjects()
  const sort = useUiStore((state) => state.sort)
  const navigate = useNavigate()

  /* 过滤 + 排序都交给 `filterProjects`（与 `/projects` 同一份实现）——
     `scope` 就是本页的口径，不必先筛一遍再排。 */
  const shelf = filterProjects(projects, { scope, query: '', sort })
  const doing = shelf.filter((project) => !isClosed(project)).length
  const archived = shelf.filter((project) => isClosed(project)).length

  return (
    <>
      <div className="page-head">
        <div>
          <div className="page-title">{title}</div>
          <div className="page-sub">
            {isLoading
              ? '正在读取项目…'
              : `${shelf.length} 个项目 · ${doing} 进行中 · ${archived} 已归档 · 悬停拉开抽屉，点击进入详情`}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="empty-state">正在读取项目…</div>
      ) : shelf.length ? (
        <div className="drawers">
          {shelf.map((project) => (
            <Drawer key={project.id} project={project} onOpen={(id) => navigate(`${basePath}/${id}`)} />
          ))}
        </div>
      ) : (
        <div className="empty-state">{emptyText}</div>
      )}
    </>
  )
}
