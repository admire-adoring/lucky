import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AccountMenu } from '../components/layout/AccountMenu'
import { SearchField } from '../components/layout/SearchField'
import { ThemeToggle } from '../components/layout/ThemeToggle'
import { Topbar } from '../components/layout/Topbar'
import { WindowControls } from '../components/layout/WindowControls'
import { BrandMark } from '../components/ui/BrandMark'
import { IconButton } from '../components/ui/IconButton'
import { AssistantRail } from '../components/workbench/AssistantRail'
import { FocusPanel } from '../components/workbench/FocusPanel'
import { ModuleRing, ModuleSummary } from '../components/workbench/ModuleRing'
import { Tile } from '../components/workbench/Tile'
import { PROJECTS } from '../data/projects'
import { getModule, WORKBENCH_AGG, WORKBENCH_MODULES_LIST } from '../data/workbench'
import { useDocumentTitle } from '../hooks/use-document-title'
import { toast } from '../stores/toast-store'
import { useWorkbenchStore } from '../stores/workbench-store'

/**
 * 已经落地的模块主页面。只有它才真的跳转，其余给一条"未实现"提示 ——
 * `ENTER` 里的路由取自 `docs/模块设计.md`，但**文档写了不等于代码里有**：
 * 直接跳过去会撞到 catch-all 路由，用户看到的是"页面跳没了"，
 * 比当场说"还没做"难懂得多。
 */
const IMPLEMENTED_PATHS = new Set(['/projects'])

/** 助手栏状态行的口径：与工作台摘要同源 —— 项目数取 PROJECTS，任务数取聚合值，不另算一套 */
const RAIL_STATUS = `已接入 ${PROJECTS.length} 个项目 · ${WORKBENCH_AGG.TASKS.total} 条任务`

/**
 * 工作台（首页）。
 *
 * 三块内容各自解决的问题（这是"Hero 补磁贴没说的那部分"的具体分工）：
 *   Hero 左 —— 九个模块的**地图**（环形菜单）+ 当前模块的中心名 = "我是谁/我在哪/从这儿进"
 *   Hero 右 —— 今日焦点 = 具体是**哪几件**（磁贴全给聚合值，缺的就是这个）
 *   面板区  —— 当前模块的 5 块磁贴 = 统计
 *   助手栏  —— 当前模块的对话
 */
export function WorkbenchPage() {
  const navigate = useNavigate()
  const series = useWorkbenchStore((state) => state.series)
  const setSeries = useWorkbenchStore((state) => state.setSeries)
  const railCollapsed = useWorkbenchStore((state) => state.railCollapsed)
  const toggleRail = useWorkbenchStore((state) => state.toggleRail)

  const module = getModule(series)
  useDocumentTitle(`${module.label} · Lucky-Y`)

  /**
   * `data-series` 必须写到 `<html>` 上，不能只留在 React 状态里。
   *
   * 因为整页的氛围（极光底衬、九个域色）用的是 **CSS 属性选择器** ——
   * `[data-series="<模块>"]` 定义在 `prism.css §3`，靠"一个属性驱动整页"，
   * 卡片、顶栏、助手栏都在消费它，它们**不在这个组件的子树里**（助手栏是同级的兄弟）。
   * 走 Context 就得让每个远房组件都订阅一次；写属性是"一次写、全页生效"。
   *
   * ⚠️ 写在 effect 里而不是 render 里：render 期间改 DOM 会在严格模式下被执行两次，
   *    而这个属性是幂等的，放 effect 里语义更清楚。
   */
  useEffect(() => {
    document.documentElement.dataset.series = series
  }, [series])

  /* 「进门」：中心名本身就是门（原型撤掉了那枚"进入 XX 主菜单"的胶囊按钮 ——
     它把动作喊了出来，而这一屏要的是"仪表本身就是门"）。
     同一个元素承担两个语义的前提是它们在操作链上相邻：选模块 → 进模块。 */
  function enterModule(target: typeof module) {
    if (target.enter.self) return
    if (IMPLEMENTED_PATHS.has(target.enter.path)) {
      navigate(target.enter.path)
      return
    }
    toast(`原型演示：${target.label}主菜单（${target.enter.path}）尚未实现`)
  }

  const leading = (
    <>
      <WindowControls className="shrink-0" />
      {/* ⚠️ 尺寸**必须**由调用方给：BrandMark 内部只有 `shrink-0`，没有 `h-* w-*`。
          漏给的话它在 flex 里会撑到可用空间（实测 1392×1392，整个 Hero 被盖住），
          而且**不报错** —— 页面上只是多了一个巨大的渐变圆。 */}
      <BrandMark className="h-7 w-7" />
      <span className="h-[22px] w-px shrink-0 bg-line" />
      <span className="shrink-0 text-13-5 font-bold text-ink-900">{module.label}</span>
    </>
  )

  return (
    /* 竖向 flex：顶栏横贯全宽（含助手栏上方），下面才是 [主列 | 助手栏] */
    <div className="flex h-screen flex-col overflow-hidden">
      <Topbar
        leading={leading}
        search={<div className="min-w-0 flex-1 max-w-[560px]"><SearchField /></div>}
        actions={
          <>
            <ThemeToggle />
            <IconButton icon="i-bell" label="通知" dot onClick={() => toast('原型演示：通知中心未包含')} />
            <div className="h-[22px] w-px shrink-0 bg-line" />
            <AccountMenu />
          </>
        }
      />

      <div className="flex min-h-0 flex-1 max-[1180px]:flex-col">
        <main className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden px-6 pb-16 pt-5 max-[1024px]:px-4">
          {/* Hero：data-accent 挂在**这一层**（不是环上）——
              同一条色链还要给底色带与门的光边用，它们都不在环里面。 */}
          <section
            data-accent={module.key}
            className="relative"
            aria-label={`${module.label}模块径向菜单`}
          >
            <div className="flex items-start gap-8 max-[1240px]:flex-col max-[1240px]:gap-5">
              <div className="w-[360px] shrink-0 max-[1240px]:w-full">
                <ModuleRing
                  modules={WORKBENCH_MODULES_LIST}
                  current={series}
                  onSelect={setSeries}
                  onEnter={enterModule}
                />
                <ModuleSummary summary={module.summary} />
              </div>

              {/* 今日焦点：数据全部由 projects.ts 派生 */}
              <section className="g g3 g--refr min-w-0 flex-1 self-stretch rounded-2xl border border-line p-4 max-[1240px]:w-full">
                <div className="flex items-baseline gap-2">
                  <h2 className="text-13-5 font-bold text-ink-900">今日焦点</h2>
                  <span className="text-11-5 font-medium text-ink-400">
                    {module.key === 'home' ? '先风险、再临近' : `${module.label}模块`}
                  </span>
                </div>
                <div className="mt-3">
                  <FocusPanel
                    items={module.focus}
                    emptyHint={`${module.label}模块未接入数据源 —— 文档里的设置页见下方面板`}
                  />
                </div>
              </section>
            </div>
          </section>

          {/* 磁贴面板：3 块 KPI 占满第一排，剩下两块各占一半。
              ⚠️ 这里不再用 `hidden` 属性切面板 —— 组件层只渲染当前模块那一份，
                "切换"由 React 的条件渲染完成，比藏 9 份 DOM 更省也更好查。 */}
          <section className="mt-6" aria-label={`${module.label}模块面板`}>
            <div className="grid grid-cols-2 gap-4 max-[860px]:grid-cols-1">
              <div className="col-span-2 grid grid-cols-3 gap-4 max-[860px]:col-span-full max-[1240px]:grid-cols-2 max-[600px]:grid-cols-1">
                {module.tiles.slice(0, 3).map((tile, i) => (
                  <Tile key={`${module.key}-${i}`} tile={tile} />
                ))}
              </div>
              {module.tiles.slice(3).map((tile, i) => (
                <Tile key={`${module.key}-l${i}`} tile={tile} />
              ))}
            </div>
          </section>
        </main>

        <AssistantRail
          messages={module.chat}
          collapsed={railCollapsed}
          onToggle={toggleRail}
          statusLine={RAIL_STATUS}
        />
      </div>
    </div>
  )
}
