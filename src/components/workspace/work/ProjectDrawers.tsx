import { useNavigate } from 'react-router-dom'
import { Icon } from '../../icons/Icon'
import { cn } from '../../../lib/cn'
import { buildDocuments, ownerDisplayName } from '../../../data/derive'
import { SORT_OPTIONS } from '../../../data/meta'
import { useProjects } from '../../../hooks/use-projects'
import { filterProjects } from '../../../lib/filter-projects'
import { useUiStore } from '../../../stores/ui-store'
import type { Handlers } from '../../../pages/workspace/work/panels'
import type { Project, ProjectStatus, Scope, SortMode } from '../../../types'

/* ============================================================================
   项目抽屉 —— 工作模块的「项目」分区（`/work/projects`）
   点开一个抽屉 = **进入这个项目的详情**，地址在同一段下面（`/work/projects/<id>`），
   **不出工作模块** —— 见下面第二轮与第三轮两段。
   ----------------------------------------------------------------------------
   2026-09-25 按 `design/work/work_project_v2.html` 换掉了上一版（v1「书架」）。
   v1 是**抽出一本书飞向弹窗**，v2 是**拉开抽屉露出里面的文件** —— 同一页的两种隐喻，
   用户选的是后者。v1 的原型还在（`work_project_v1.html`），要回看旧版式去那里。

   口径没变（这是这一页唯一容易搞错的地方）：
     `docs/模块设计.md` §2 ——「工作项目 `/work/projects` = 调用项目模块，scope=work」。
     所以只列 `scope === 'work'` 的项目。
   ⚠️ 原型里那 4 个「支付系统重构 / 用户中心改版 / 数据看板 / 性能优化专项」是**设计样本**，
      不是数据源；真实项目在 `src/data/projects.ts`（这一页实际是 **2 个** work 项目）。
      照搬样本就是"编数字"（与 `data/workspace/project.ts` 的同一条取舍）。

   ============================================================================
   2026-09-25（第二轮）· 点击**进入详情页**，不再开弹窗
   ============================================================================
   用户给的原型 `work_product-detail.html` 就是"点击项目进入的详情页"，所以这里改成跳详情。
   **弹窗连同它的正文一起删了** —— 那份正文（概况/描述/风险/关键节点/关联文档）与新的详情页
   重复，留着就是同一件事两个入口、两条会各自漂移的实现。
   ⇒ 连带删掉：`openId` 状态、`WorkspaceModal`、`ProjectDetailBody`，以及只为它引入的
      `useProjectDetail` / `adaptDocs` / `adaptMilestones`。

   ============================================================================
   2026-09-25（第三轮）· 去 `/work/projects/<id>`，**不出工作模块**
   ============================================================================
   上一轮跳的是 `/projects/<id>`（独立的**项目模块**），用户的反馈是：不要跳出去，
   详情在工作模块内打开。所以目标地址改成工作模块自己的那一段。
   ⚠️ 这不是"换个地址"那么轻 —— 整页详情的样式作用域原本写死在
      `.mw-root[data-module='projects'] .detail` 下，工作模块下**一条都命中不了**
      （页面照常渲染、只是全裸，零报错）。所以那一整段的作用域改成了不带模块值的
      `.mw-root[data-module] .proj-detail`，判据写在 `styles/module-workspace.css`。
   ⚠️ 独立项目模块的 `/projects/:id` **仍然保留**（顶栏九域里的「项目」还在用它），
      两处共用同一份视图组件，见 `components/workspace/project-detail/ProjectDetail.tsx`。

   ============================================================================
   与原型有意不同的三处（都是"静态页 → 应用"必然要改的，不是审美）
   ============================================================================
   ① **配色从"四个样本的随手配色"改成**状态表**。原型给 4 个样本各配一色
      （含把已归档那支配成 slate），那是点缀、不是语义；应用里四色与
      `ProjectStatus` **一一对应**，于是"哪一抽屉有风险/已归档"一眼可辨。
      · `active → rose`、`planning → purple`、`done → slate` 沿用原型那三支；
      · `risk → amber` 是**新加的**（原型样本里没有风险项目）；
      · 原型第四支 `cyan` 因此**没有状态可用，已删** —— 留着就是死规则。
      ⚠️ 这张表与项目详情页的 `STATUS_CLASS`（`components/workspace/project-detail/ProjectDetail.tsx`）
         是**同一套颜色**：从抽屉点进去，主色不变。

   ② **抽屉里那排缩略书脊用序号，不用图标**。原型写的是 `${d.icon}`（emoji），
      而应用里 `DocumentItem` **没有 icon 字段**，文档名也是标题不是文件名
      （「技术方案 v3」，没有扩展名）⇒ 按扩展名推图标也推不出来。
      硬编一套"图标表"就是造假字段；序号（1/2/3）是真实顺序，且更像档案柜里的编号。

   ③ **meta 行换成有来源的三段**。原型是「负责人 · N 个资源」，而资源数在应用里
      恒为 4（`buildDocuments` 固定派生 4 份）—— 一行永远不变的字等于没信息。
      换成 `负责人 · 进度 N% · 剩余/归档`，三个都是 `Project` 上的真字段。

   ⚠️ 排序不在这里实现：它读应用的 `ui-store.sort` 并复用 `lib/filter-projects`，
      与 `/projects` 那一页是**同一个偏好**（同一个 store 字段），不另起一套。
   ============================================================================ */

/** 这一页的口径。放宽到"全部项目"只改这一个常量 —— 但那就和 `/projects` 重复了。 */
const SHELF_SCOPE: Scope = 'work'

/**
 * 状态 → 抽屉主色（见文件头 ①）。
 *
 * ⚠️ 四个类是**新增**的（内核里原有 `.p-*`），写在 `styles/module-workspace.css`
 *    的 work 增量里；色板与原型 `work_project_v2.html` 的「4 个主题色」一致，
 *    只有 `amber` 是补的（原型样本里没有风险项目）。
 */
const DRAWER_THEME: Record<ProjectStatus, string> = {
  active: 'p-rose',
  risk: 'p-amber',
  planning: 'p-purple',
  done: 'p-slate',
}

/** 抽屉里最多摆几份缩略；多出来的走「+N」 */
const PREVIEW_LIMIT = 3

/** 「剩余 38 天」/「已逾期 3 天」。与 `ProjectsListPage` 是同一套措辞（那边也是就地写的）。 */
function leftText(daysLeft: number): string {
  return daysLeft >= 0 ? `剩 ${daysLeft} 天` : `逾期 ${-daysLeft} 天`
}

/** 已归档的抽屉不报"逾期 N 天" —— 那个数字对一件已经收尾的事没有意义。 */
function trailingOf(project: Project): string {
  return project.status === 'done' ? '已归档' : leftText(project.daysLeft)
}

/**
 * 负责人那一格的文案。
 *
 * ⚠️ **不**用 v1 那句 `owners.map(ownerDisplayName).join(' · ')`：这一行是 11.5px 的小字，
 *    而 `p3` 的 `owners` 是 `['LY', 'ZQ', 'HM']`，名字表（`derive.ts` 的 `OWNER_NAMES`）
 *    只登记了 `LY → 刘阳` —— 于是那三格会渲染成「刘阳 · ZQ · HM」，两个内部代号摆在
 *    最显眼的一行上。v2 原型的 meta 本来就是**单负责人**（「杨刘 · 3 个资源」），
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
  const archived = project.status === 'done'
  /* 缩略用**派生**的文档（`buildDocuments` 按 id 确定性取值），不发请求：
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
 * 顶栏动作（v2 把这两个按钮放在 `.topbar-actions` 里，不在页头）
 * ------------------------------------------------------------------ */

/**
 * ⚠️ 原型的「排序」是一个**没有定义交互**的 `.btn-ghost`（原型里点了没反应）。
 *    这里落成原生 `<select>` —— 不是自选，是**沿用本仓已有的那条口径**：
 *    `/projects` 的排序（`components/projects/ProjectToolbar.tsx`）就是一个原生 select，
 *    选项来自 `data/meta` 的 `SORT_OPTIONS`，偏好存在 `ui-store.sort`。
 *    于是两页的排序控件外形一致、偏好同一个字段、比较逻辑同一份（`lib/filter-projects`）。
 */
export function ProjectTopbarActions({ handlers }: { handlers: Handlers }) {
  const sort = useUiStore((state) => state.sort)
  const setSort = useUiStore((state) => state.setSort)

  return (
    <>
      {/* 原生 `<select>` 而不是 `.btn`：`.btn` 是 `display: inline-flex`，
          套在 select 这种替换元素上会让它自己的箭头与内边距都失准。
          于是外壳样式写在 `.sort-select` 里（work 增量），外形与旁边的 `.btn-ghost` 对齐。 */}
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
      <button
        type="button"
        className="btn btn-primary"
        onClick={() => handlers.notice('新建项目：创建流程还没接')}
      >
        + 新建项目
      </button>
    </>
  )
}

/* ------------------------------------------------------------------ *
 * 页面
 * ------------------------------------------------------------------ */

/**
 * ⚠️ `handlers` 这一页**用不上**（它是外壳统一传的，见 `WorkWorkspace` 的 `PANELS`）：
 *    这张页面上唯一那个动作「+ 新建项目」在**顶栏**（`ProjectTopbarActions`），
 *    不在这里。留着形参是为了与另外六个分区的签名一致 —— 不然 `PANELS` 那张表
 *    就得为一项开特例。
 */
export function ProjectDrawers({ handlers: _handlers }: { handlers: Handlers }) {
  const { data: projects = [], isLoading } = useProjects()
  const sort = useUiStore((state) => state.sort)
  const navigate = useNavigate()

  /* 过滤 + 排序都交给 `filterProjects`（与 `/projects` 同一份实现）——
     `scope` 就是本页的口径，不必先筛一遍再排。 */
  const shelf = filterProjects(projects, { scope: SHELF_SCOPE, query: '', sort })
  const doing = shelf.filter((project) => project.status !== 'done').length
  const archived = shelf.filter((project) => project.status === 'done').length

  return (
    <>
      {/* 页头。⚠️ 原型这两个块带 `margin-bottom`（`.tabs` 24px / `.page-head` 32px），
          这里**一律不带** —— `.panel` 自己就是 flex 列 + gap 20px，再写一遍就是双倍间距
          （与 `WorkspaceSidebar` 那条"别让包裹层决定间距"是同一条纪律）。 */}
      <div className="page-head">
        <div>
          <div className="page-title">
            我的<span className="accent">项目</span>
          </div>
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
            <Drawer key={project.id} project={project} onOpen={(id) => navigate(`/work/projects/${id}`)} />
          ))}
        </div>
      ) : (
        <div className="empty-state">这个领域还没有项目</div>
      )}
    </>
  )
}
