import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { IconSprite } from './components/icons/IconSprite'
import { ToastHost } from './components/ui/ToastHost'
import { AiDrawerHost } from './components/ai-drawer/AiDrawerHost'
import { queryClient } from './lib/query-client'
import { CalendarWorkspace } from './pages/workspace/CalendarWorkspace'
import { KnowledgeWorkspace } from './pages/workspace/KnowledgeWorkspace'
import { LearningWorkspace } from './pages/workspace/LearningWorkspace'
import { LifeWorkspace } from './pages/workspace/LifeWorkspace'
import { ProjectsWorkspace } from './pages/workspace/ProjectsWorkspace'
import { SettingsWorkspace } from './pages/workspace/SettingsWorkspace'
import { TasksWorkspace } from './pages/workspace/TasksWorkspace'
import { LogViewerPage } from './pages/workspace/LogViewerPage'
import { DeployViewerPage } from './pages/workspace/DeployViewerPage'
import { WorkProjectDetailPage } from './pages/workspace/WorkProjectDetailPage'
import { WorkWorkspace } from './pages/workspace/WorkWorkspace'
import { AiAssistantPage } from './pages/AiAssistantPage'
import { LoginPage } from './pages/LoginPage'
import { ProjectsListPage } from './pages/workspace/ProjectsListPage'
import { DashboardWorkspace } from './pages/workspace/DashboardWorkspace'
import { useAuthStore } from './stores/auth-store'

/** 未登录时回落到登录页；登录态持久化在 localStorage */
function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function EntryRedirect() {
  const user = useAuthStore((state) => state.user)
  return <Navigate to={user ? '/' : '/login'} replace />
}

/**
 * 登录之后才挂的**应用级附加层**：AI 助手抽屉 + 阶段计时（后者由前者一起渲染）。
 *
 * ⚠️ 位置：`<Routes>` **之外**。用户的要求是「每个页面都可以弹出侧边栏」——
 *    挂在页面里要走通三处壳（工作区壳 / 工作台 / 项目列表），漏一处就是
 *    "那一页点了没反应"且不报错；挂在路由之外由**构造**保证每页都有。
 *    详细的取舍写在 `components/ai-drawer/AiDrawerHost.tsx`。
 *
 * ⚠️ 为什么在这里判登录态：抽屉要读登录态里的称呼（头像上的字）。
 *    未登录时全站只有登录页，挂上去会多出一个"登录页背后藏着助手"的状态 ——
 *    而且它会去读一个空 user。判据与 `RequireAuth` 同一条。
 */
function AuthedExtras() {
  const user = useAuthStore((state) => state.user)
  return user ? <AiDrawerHost /> : null
}

/**
 * 模块工作区的路由表。
 *
 * 每个模块注册**两条**：裸路径（默认 Tab）与 `/:tab`（具体 Tab）。
 *
 * 为什么是两条而不是 `/:tab?`：v7 的可选参数（`?`）在 `useParams` 里给的是
 * `undefined` 还是空串、以及在 `navigate('/life')` 与 `navigate('/life/')` 之间
 * 会落到哪一条，都不够确定 —— 而"从侧栏点进来"必须稳定落到默认 Tab。
 * 两条具名路由没有这个歧义，代价只是多一行。
 */
const WORKSPACE_ROUTES: { path: string; element: ReactNode }[] = [
  /**
   * 工作台。**它现在也是一个 `WorkspacePageKey` 之外的"域"** ——
   * 2026-09-22 统一到侧栏那套外壳之后，它有了自己的基路径 `/home` 与三个分区
   * （今日概览 / 最近活动 / AI 简报）。`/` 仍然可用，只是重定向到这里（见下面那条路由）。
   *
   * ⚠️ 为什么必须给它一段真路径、而不是把分区做成页内状态：
   *    其余八域的分区都是路由（`/life/habits` 这类），深链、后退键、以及"从别处跳进某个分区"
   *    三件事同时成立。工作台要是例外，`useModuleTab` 那套约定就得开一个口子。
   */
  { path: '/home', element: <DashboardWorkspace /> },
  { path: '/home/:tab', element: <DashboardWorkspace /> },
  { path: '/tasks', element: <TasksWorkspace /> },
  { path: '/tasks/:tab', element: <TasksWorkspace /> },
  { path: '/calendar', element: <CalendarWorkspace /> },
  { path: '/calendar/:tab', element: <CalendarWorkspace /> },
  { path: '/life', element: <LifeWorkspace /> },
  { path: '/life/:tab', element: <LifeWorkspace /> },
  { path: '/work', element: <WorkWorkspace /> },
  { path: '/work/:tab', element: <WorkWorkspace /> },
  /**
   * 工作模块内打开的项目详情：`/work/projects/:id` 与 `/work/projects/:id/:tab`。
   *
   * ⚠️ 为什么有这两条：在工作模块的「项目」分区里点开一个抽屉，**不跳去独立的项目模块**
   *    （`/projects/:id`），详情就在工作模块内打开 —— 环仍是工作模块的 7 个分区、
   *    高亮停在「项目」上。正文与数据与 `/projects/:id` 是**同一份组件**
   *    （`components/workspace/project-detail/ProjectDetail.tsx`），差别只有壳。
   *
   * ⚠️ 与 `/work/:tab` 不冲突：那一条是两段（`/work/projects` 落进去、给抽屉网格），
   *    这两条是三段与四段。React Router 按特异性排序，段数不同本来也不会互相抢。
   */
  { path: '/work/projects/:id', element: <WorkProjectDetailPage /> },
  { path: '/work/projects/:id/:tab', element: <WorkProjectDetailPage /> },
  /**
   * 日志查看器：`/logs/:id`。
   *
   * ⚠️ **它不在任何模块下**，也不套 `WorkspaceLayout` —— 原型就是一个
   *    `window.open` 出来的独立窗口（自带标题栏、服务器分段、刷新与关闭，
   *    而且没有任何模块导航）。套进模块外壳会同时多出侧栏环与顶栏，与它自己那条 bar 重复。
   *    所以它只借两样东西：`mw-root` 的令牌 + `data-module="work"` 的强调色。
   *    **窗框由页面自己补**（`components/shell/MacWindow`：红黄绿三颗 / 拖动 / 最小化 /
   *    全屏），因为"独立窗口"这一层语义只有页面自己知道 —— 路由表只负责把它挂到一段
   *    自己的地址上。
   *
   * ⚠️ 路径**刻意不挂在 `/work/projects/:id/logs`**：那会是四段，
   *    与 `/work/projects/:id/:tab` **同形**（靠"静态段优先于动态段"才能分对，
   *    一旦有人把 tab 名写成 logs 就撞车）。两段路径没有这个歧义。
   */
  { path: '/logs/:id', element: <LogViewerPage /> },
  /**
   * 部署查看器：`/deploy/:id`。
   *
   * ⚠️ 与 `/logs/:id` 是**同一形态的第二条**：原型也是 `window.open` 出来的独立窗口
   *    （运维页 →「打开部署面板」），所以它同样不套 `WorkspaceLayout`、只借
   *    `mw-root` 的令牌 + `data-module="work"` 的强调色，窗框由页面自己补（`MacWindow`）。
   *
   * ⚠️ 同样是**两段路径**，不挂在 `/work/projects/:id/deploy` —— 那会与
   *    `/work/projects/:id/:tab` 同形，一旦有人把 tab 名写成 deploy 就撞车。
   */
  { path: '/deploy/:id', element: <DeployViewerPage /> },
  { path: '/learning', element: <LearningWorkspace /> },
  { path: '/learning/:tab', element: <LearningWorkspace /> },
  { path: '/knowledge', element: <KnowledgeWorkspace /> },
  { path: '/knowledge/:tab', element: <KnowledgeWorkspace /> },
  { path: '/settings', element: <SettingsWorkspace /> },
  { path: '/settings/:tab', element: <SettingsWorkspace /> },
  /**
   * 项目工作区：`/projects/:id` 与 `/projects/:id/:tab`。
   *
   * 这一页替代了原来的 `ProjectDetailPage`（旧玻璃材质那一版）。
   * 之所以能替，是因为它现在是**按项目取数**的 —— `useProjectDetail(id)`
   * 把任务 / 里程碑 / 文档 / 动态按该项目派生，8 个项目打开是 8 份内容。
   * （上一轮没换，正是因为当时那一版的内容还写死在原型的数据里：
   *   换过去会让每个项目长得一样，同时丢掉一页可用功能。）
   *
   * ⚠️ 2026-09-25（第三轮）这两条**不再是详情唯一的地址**：同一页还挂在
   *    `/work/projects/:id`（工作模块内打开，见上面那两条）。正文与数据是同一份组件
   *    （`components/workspace/project-detail/ProjectDetail.tsx`），只有壳不同。
   *    改详情内容时改那一个文件，两处同时生效。
   *
   * ⚠️ 路由顺序：`/projects/:id` 与 `/projects/:id/:tab` 是两条不同的路径，
   * 不冲突；而 `/projects`（列表）也是独立的一条。React Router 按特异性排序，
   * 静态段优先于动态段，所以将来加 `/projects/new` 之类的静态子路径不会被 `:id` 抢走。
   */
  { path: '/projects/:id', element: <ProjectsWorkspace /> },
  { path: '/projects/:id/:tab', element: <ProjectsWorkspace /> },
]

/**
 * 用 HashRouter：打包产物既能被静态服务器托管，也能直接以 file:// 打开，
 * 后续接入 Tauri 外壳时同样不需要服务端 rewrite。
 */
export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <IconSprite />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* 工作台 = 首页。它现在是**九个域之一**（`/home`），与其余八域共用同一套外壳；
              以前它是"自成一体的全屏页"，那一版的 `WorkbenchPage.tsx` 仍在仓库里但已无路由指向。
              ⚠️ `/` 只做重定向：老书签、以及下面 `EntryRedirect` 的落点都还指着它。
                 直接让 `/` 渲染工作台的话，工作台就会有两段可用的地址（`/` 与 `/home`），
                 "第一个分区用裸路径"那条约定会变得含糊。 */}
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route
            path="/projects"
            element={
              <RequireAuth>
                <ProjectsListPage />
              </RequireAuth>
            }
          />
          {/*
            AI 助手（`/ai`）—— 一个**独立页面，不是第十个域**。
            ⚠️ 它不进 `WORKSPACE_ROUTES`：那张表的每一项都对应九域之一，
               `module` 会被拿去查 `MODULE_BASE_PATH` / `navLabel` / 环上的图标，
               而 AI 助手是跨域的（读全部项目与任务），没有"属于自己的分区"。
               塞进去会让 `useModuleTab` 拿一个不存在的模块去算默认 Tab。

            ⚠️ 它**仍然在 RequireAuth 之内**：这一页要读登录态的称呼，
               而且它与九域共用顶栏 —— 未登录时顶栏的账户入口会指向一个空用户。
               让登录页之外的任何页面在未登录时可达，都是把"登录"这道门说成可选的。
          */}
          <Route
            path="/ai"
            element={
              <RequireAuth>
                <AiAssistantPage />
              </RequireAuth>
            }
          />
          {WORKSPACE_ROUTES.map((route) => (
            <Route key={route.path} path={route.path} element={<RequireAuth>{route.element}</RequireAuth>} />
          ))}
          <Route path="*" element={<EntryRedirect />} />
        </Routes>
        {/* AI 助手抽屉（应用级，每个页面都能弹）。放在 `<Routes>` 之外是有意的 —— 见上面 AuthedExtras */}
        <AuthedExtras />
        <ToastHost />
      </HashRouter>
    </QueryClientProvider>
  )
}
