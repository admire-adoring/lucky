import type { ReactNode } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { IconSprite } from './components/icons/IconSprite'
import { ToastHost } from './components/ui/ToastHost'
import { queryClient } from './lib/query-client'
import { LoginPage } from './pages/LoginPage'
import { ProjectDetailPage } from './pages/ProjectDetailPage'
import { ProjectsPage } from './pages/ProjectsPage'
import { useAuthStore } from './stores/auth-store'

/** 未登录时回落到登录页；登录态持久化在 localStorage */
function RequireAuth({ children }: { children: ReactNode }) {
  const user = useAuthStore((state) => state.user)
  if (!user) return <Navigate to="/login" replace />
  return <>{children}</>
}

function EntryRedirect() {
  const user = useAuthStore((state) => state.user)
  return <Navigate to={user ? '/projects' : '/login'} replace />
}

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
          <Route
            path="/projects"
            element={
              <RequireAuth>
                <ProjectsPage />
              </RequireAuth>
            }
          />
          <Route
            path="/projects/:id"
            element={
              <RequireAuth>
                <ProjectDetailPage />
              </RequireAuth>
            }
          />
          <Route path="*" element={<EntryRedirect />} />
        </Routes>
        <ToastHost />
      </HashRouter>
    </QueryClientProvider>
  )
}
