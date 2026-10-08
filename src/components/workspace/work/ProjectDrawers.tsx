import { Icon } from '../../icons/Icon'
import { SORT_OPTIONS } from '../../../data/meta'
import { ProjectShelf } from '../project-detail/ProjectShelf'
import { useUiStore } from '../../../stores/ui-store'
import type { Handlers } from '../../../pages/workspace/work/panels'
import type { SortMode } from '../../../types'

/* ============================================================================
   工作模块的「项目」分区（`/work/projects`）
   点开一个抽屉 = 进入这个项目的详情，地址在同一段下面（`/work/projects/<id>`），
   不出工作模块 —— 见下面第二轮与第三轮两段。
   ----------------------------------------------------------------------------
   2026-09-25 按 `design/work/work_project_v2.html` 换掉了上一版（v1「书架」）。
   v1 是抽出一本书飞向弹窗，v2 是拉开抽屉露出里面的文件 —— 同一页的两种隐喻，
   用户选的是后者。v1 的原型还在（`work_project_v1.html`），要回看旧版式去那里。

   口径没变（这是这一页唯一容易搞错的地方）：
     `docs/模块设计.md` §2 ——「工作项目 `/work/projects` = 调用项目模块，scope=work」。
     所以只列 `scope === 'work'` 的项目。
   原型里那 4 个「支付系统重构 / 用户中心改版 / 数据看板 / 性能优化专项」是设计样本，
      不是数据源；真实项目在 `src/data/projects.ts`（这一页实际是 2 个 work 项目）。
      照搬样本就是"编数字"（与 `data/workspace/project.ts` 的同一条取舍）。

   ============================================================================
   2026-09-25（第二轮）· 点击进入详情页，不再开弹窗
   ============================================================================
   用户给的原型 `work_product-detail.html` 就是"点击项目进入的详情页"，所以这里改成跳详情。
   弹窗连同它的正文一起删了 —— 那份正文（概况/描述/风险/关键节点/关联文档）与新的详情页
   重复，留着就是同一件事两个入口、两条会各自漂移的实现。

   ============================================================================
   2026-09-25（第三轮）· 去 `/work/projects/<id>`，不出工作模块
   ============================================================================
   上一轮跳的是 `/projects/<id>`（独立的项目模块），用户的反馈是：不要跳出去，
   详情在工作模块内打开。所以目标地址改成工作模块自己的那一段。
   独立项目模块的 `/projects/:id` 仍然保留（顶栏九域里的「项目」还在用它），
      两处共用同一份视图组件，见 `components/workspace/project-detail/ProjectDetail.tsx`。

   ============================================================================
   2026-09-27（第四轮）· 抽屉网格整块搬去共用层，这里只剩套壳
   ============================================================================
   用户定的结构：「工作区的项目、学习区的项目都依赖项目区，项目区是整体全局的；
   两处布局一致，只是有个性」。⇒ 抽屉网格（含状态四色、meta 三段、缩略规则）
   搬去 `components/workspace/project-detail/ProjectShelf.tsx`，按 `scope` 参数化，
   学习模块的「实践项目」分区复用同一份。
   本文件现在只剩三样属于工作模块的东西：
     · `scope="work"` 与基路径 `/work/projects`（这一页的口径）；
     · 页头措辞「我的项目」（+ `.accent`，颜色自动取工作模块的强调色）；
     · 顶栏那一排动作（排序 + 新建，见 `ProjectTopbarActions`）。
   与抽屉一起搬走的还有原型的整改说明（配色表 / 缩略序号 / meta 三段那三条），
      它们现在写在 `ProjectShelf.tsx` 的文件头 —— 要改版式去那边，别在这里补。
   连带改的：抽屉那一族样式（`.drawer*` / `.page-head` / `.sort-select`）原本锁在
      `.mw-root[data-module='work']` 下，第四轮放宽成 `[data-module]`（属性不带值，
      特异性不变）—— 否则学习模块那一份会一条规则都不命中、页面全裸且零报错。
   ============================================================================ */

/**
 * 原型的「排序」是一个没有定义交互的 `.btn-ghost`（原型里点了没反应）。
 *    这里落成原生 `<select>` —— 不是自选，是沿用本仓已有的那条口径：
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

/**
 * `handlers` 这一页用不上（它是外壳统一传的，见 `WorkWorkspace` 的 `PANELS`）：
 *    这张页面上唯一那个动作「+ 新建项目」在顶栏（`ProjectTopbarActions`），
 *    不在这里。留着形参是为了与另外六个分区的签名一致 —— 不然 `PANELS` 那张表
 *    就得为一项开特例。
 */
export function ProjectDrawers({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <ProjectShelf
      scope="work"
      basePath="/work/projects"
      title={
        <>
          我的<span className="accent">项目</span>
        </>
      }
    />
  )
}
