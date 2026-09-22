import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { IconSprite } from './components/icons/IconSprite'
import { ToastHost } from './components/ui/ToastHost'
import { queryClient } from './lib/query-client'
import { CalendarWorkspace } from './pages/workspace/CalendarWorkspace'
import { KnowledgeWorkspace } from './pages/workspace/KnowledgeWorkspace'
import { LearningWorkspace } from './pages/workspace/LearningWorkspace'
import { LifeWorkspace } from './pages/workspace/LifeWorkspace'
import { ProjectsWorkspace } from './pages/workspace/ProjectsWorkspace'
import { SettingsWorkspace } from './pages/workspace/SettingsWorkspace'
import { TasksWorkspace } from './pages/workspace/TasksWorkspace'
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
        <ToastHost />
      </HashRouter>
    </QueryClientProvider>
  )
}
