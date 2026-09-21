/*
 * ⚠️ 已被取代（2026-09-21），**当前没有任何路由指向这个文件**。
 *
 * 取代它的是：
 *   · src/pages/workspace/ProjectsListPage.tsx   —— 列表（新壳 + 原型的设计语言）
 *   · src/pages/workspace/ProjectsWorkspace.tsx  —— 工作区（design/project 原型的落地）
 *
 * 保留它的唯一理由是**这个仓库还没有任何提交** —— 删掉就找不回来了。
 * 确认新页面可用之后可以整体删除（连组件目录一起）：
 *   src/pages/ProjectsPage.tsx        + src/components/projects/**
 *   src/pages/ProjectDetailPage.tsx   + src/components/detail/**
 * 删完记得再跑一次 tsc —— 这两个页面是 AppShell / glass-* 那一套的最后使用者，
 * 它们一走，AppShell 与旧列表组件 也就没有别的引用了。
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { computeStats } from '../data/derive'
import { filterProjects } from '../lib/filter-projects'
import { useDebouncedValue } from '../hooks/use-debounced-value'
import { useDocumentTitle } from '../hooks/use-document-title'
import { useProjects } from '../hooks/use-projects'
import { useUiStore } from '../stores/ui-store'
import { toast } from '../stores/toast-store'
import { AccountMenu } from '../components/layout/AccountMenu'
import { AppShell } from '../components/layout/AppShell'
import { SearchField } from '../components/layout/SearchField'
import { Topbar } from '../components/layout/Topbar'
import { ProjectCard } from '../components/projects/ProjectCard'
import { ProjectKanban } from '../components/projects/ProjectKanban'
import { ProjectStatsPanel } from '../components/projects/ProjectStatsPanel'
import { ProjectTable } from '../components/projects/ProjectTable'
import { ProjectToolbar } from '../components/projects/ProjectToolbar'
import { Button } from '../components/ui/Button'
import { EmptyState, LoadingBlock } from '../components/ui/EmptyState'
import { IconButton } from '../components/ui/IconButton'
import { Icon } from '../components/icons/Icon'
import type { ScopeFilter } from '../types'

export function ProjectsPage() {
  useDocumentTitle('项目管理 · Lucky-Y')

  const navigate = useNavigate()
  const { data, isPending } = useProjects()

  const scope = useUiStore((state) => state.scope)
  const view = useUiStore((state) => state.view)
  const sort = useUiStore((state) => state.sort)
  const query = useUiStore((state) => state.query)
  const setQuery = useUiStore((state) => state.setQuery)

  // 输入框持有原始值，160ms 防抖后写入 store（与原型一致）
  const [keyword, setKeyword] = useState(query)
  const debouncedKeyword = useDebouncedValue(keyword, 160)

  useEffect(() => {
    setQuery(debouncedKeyword)
  }, [debouncedKeyword, setQuery])

  const projects = data ?? []
  const stats = computeStats(projects)
  const visible = filterProjects(projects, { scope, query, sort })

  const counts: Record<ScopeFilter, number> = {
    all: projects.length,
    life: stats.scopeCounts.life,
    work: stats.scopeCounts.work,
    learn: stats.scopeCounts.learn,
  }

  const openProject = (id: string) => navigate(`/projects/${id}`)

  return (
    <AppShell
      topbar={
        <Topbar
          search={<SearchField value={keyword} onChange={setKeyword} />}
          actions={
            <>
              <IconButton
                icon="i-bell"
                label="通知"
                dot
                onClick={() => toast('原型演示：通知中心未包含')}
              />
              <div className="h-[22px] w-px shrink-0 bg-line" />
              {/* 账户入口（含退出登录）。与侧栏底部共用同一个组件 */}
              <AccountMenu />
            </>
          }
        />
      }
    >
      {/* 页头 */}
      <div className="mb-6 flex flex-wrap items-start gap-6">
        <div className="min-w-[260px] flex-1">
          <div className="mb-2 flex items-center gap-[7px] text-12-5 text-ink-400">
            <span>统一执行层</span>
            <Icon name="i-arrow-right" className="h-[13px] w-[13px]" />
            <b className="font-semibold text-ink-600">项目管理</b>
          </div>
          <h1 className="text-24 leading-[1.35]">项目管理</h1>
          <p className="mt-1.5 max-w-[560px] text-13-5 text-ink-500">
            生活、工作、学习共用同一套执行模型，用 scope 隔离归属。所有关联表（任务 / 里程碑 / 文档 /
            笔记）均带 scope，后端强制过滤。
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-[22px] max-[600px]:w-full max-[600px]:pt-0">
          <Button
            icon="i-download"
            className="max-[600px]:flex-1"
            onClick={() => toast('原型演示：导出功能未包含')}
          >
            导出
          </Button>
          <Button
            variant="primary"
            icon="i-plus"
            className="max-[600px]:flex-1"
            onClick={() => toast('原型演示：新建项目面板未包含')}
          >
            新建项目
          </Button>
        </div>
      </div>

      {isPending ? (
        <LoadingBlock label="正在读取项目…" />
      ) : (
        <>
          <ProjectStatsPanel stats={stats} />

          <ProjectToolbar counts={counts} />

          {visible.length === 0 ? (
            <EmptyState title="没有匹配的项目" description="试试切换 scope 或清空搜索关键词。" />
          ) : (
            <>
              {view === 'cards' ? (
                <section className="grid animate-fade-up grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-4 max-[860px]:grid-cols-1">
                  {visible.map((project, index) => (
                    <ProjectCard key={project.id} project={project} index={index} onOpen={openProject} />
                  ))}
                </section>
              ) : null}

              {view === 'table' ? (
                <section className="animate-fade-up">
                  <ProjectTable projects={visible} onOpen={openProject} />
                </section>
              ) : null}

              {view === 'kanban' ? (
                <section className="animate-fade-up">
                  <ProjectKanban projects={visible} onOpen={openProject} />
                </section>
              ) : null}
            </>
          )}
        </>
      )}
    </AppShell>
  )
}
