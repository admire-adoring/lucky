import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SCOPE_META } from '../data/meta'
import { useDocumentTitle } from '../hooks/use-document-title'
import { useProjectDetail } from '../hooks/use-projects'
import { toast } from '../stores/toast-store'
import type { DetailTab } from '../types'
import { AccountMenu } from '../components/layout/AccountMenu'
import { AppShell, useScrollArea } from '../components/layout/AppShell'
import { SearchField } from '../components/layout/SearchField'
import { Topbar } from '../components/layout/Topbar'
import { ActivityFeed } from '../components/detail/ActivityFeed'
import { DetailTabs } from '../components/detail/DetailTabs'
import { DocumentList } from '../components/detail/DocumentList'
import { MilestoneTimeline } from '../components/detail/MilestoneTimeline'
import { ProjectHero } from '../components/detail/ProjectHero'
import { ProjectInfoList, ProjectLinks, RiskCallout } from '../components/detail/ProjectInfoCards'
import { TaskList } from '../components/detail/TaskList'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { IconButton } from '../components/ui/IconButton'
import { EmptyState, LoadingBlock } from '../components/ui/EmptyState'
import { ProgressBar } from '../components/ui/ProgressBar'
import { Icon } from '../components/icons/Icon'

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, isPending } = useProjectDetail(id)
  const [tab, setTab] = useState<DetailTab>('overview')
  const scrollRef = useScrollArea()

  useDocumentTitle(data ? `${data.project.name} · Lucky-Y` : '项目详情 · Lucky-Y')

  // 切标签页回到顶部（原型 switchTab 的行为）
  const switchTab = (next: DetailTab) => {
    setTab(next)
    scrollRef?.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const topbar = (
    <Topbar
      search={<SearchField />}
      actions={
        <>
          <IconButton icon="i-bell" label="通知" onClick={() => toast('原型演示：通知中心未包含')} />
          <div className="h-[22px] w-px shrink-0 bg-line" />
          <Button variant="primary" icon="i-plus" onClick={() => toast('原型演示：新建任务面板未包含')}>
            新建任务
          </Button>
          {/* 账户入口始终在最右端 —— 详情页与列表页共用同一条顶栏，两处位置必须一致 */}
          <AccountMenu />
        </>
      }
    />
  )

  if (isPending || !data) {
    return (
      <AppShell topbar={topbar} scrollPadding="detail">
        <LoadingBlock label="正在读取项目详情…" />
      </AppShell>
    )
  }

  const { project, tasks, milestones, documents, activity } = data
  const scope = SCOPE_META[project.scope]
  const openTasks = tasks.filter((task) => task.status !== 'done')
  const doneMilestones = milestones.filter((milestone) => milestone.state === 'done').length

  return (
    <AppShell topbar={topbar} scrollPadding="detail">
      <Link
        to="/projects"
        className="mb-4 inline-flex items-center gap-1.5 text-13 font-semibold text-ink-500 transition-colors duration-150 hover:text-brand-600"
      >
        <Icon name="i-arrow-right" className="h-[14px] w-[14px] rotate-180" />
        返回项目管理
      </Link>

      <ProjectHero project={project} onAction={toast} />

      <DetailTabs
        active={tab}
        counts={{ tasks: tasks.length, milestones: milestones.length, documents: documents.length }}
        onChange={switchTab}
      />

      {/* ---------------- 概览 ---------------- */}
      {tab === 'overview' ? (
        <section className="grid animate-fade-up-sm grid-cols-[minmax(0,1fr)_320px] items-start gap-5 max-[1180px]:grid-cols-1">
          <div className="flex flex-col gap-5">
            <Card
              icon="i-layers"
              title="里程碑进度"
              hint={`${doneMilestones} / ${milestones.length} 已达成`}
            >
              <div className="flex justify-between text-11-5 font-semibold text-ink-400">
                <span>已完成 {doneMilestones} 个里程碑</span>
                <span>{project.progress}%</span>
              </div>
              <div className="mt-4">
                <ProgressBar value={project.progress} fill={scope.fill} height={8} showValue={false} animateOnMount />
              </div>
              <div className="mt-6">
                <MilestoneTimeline milestones={milestones} />
              </div>
            </Card>

            <Card
              icon="i-check"
              title="近期任务"
              flush
              action={
                <Button size="sm" onClick={() => switchTab('tasks')}>
                  查看全部
                </Button>
              }
            >
              <TaskList tasks={openTasks.slice(0, 5)} variant="preview" />
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            {project.risk ? (
              <Card>
                <RiskCallout risk={project.risk} />
              </Card>
            ) : null}

            <Card icon="i-file" title="项目信息">
              <ProjectInfoList project={project} />
            </Card>

            <Card icon="i-link" title="关联资源">
              <ProjectLinks project={project} onAction={toast} />
            </Card>
          </div>
        </section>
      ) : null}

      {/* ---------------- 任务 ---------------- */}
      {tab === 'tasks' ? (
        <section className="animate-fade-up-sm">
          <Card
            icon="i-check"
            title="任务清单"
            hint={`${project.tasksDone} / ${project.tasksTotal} 已完成`}
            flush
          >
            <TaskList tasks={tasks} variant="full" />
          </Card>
        </section>
      ) : null}

      {/* ---------------- 里程碑 ---------------- */}
      {tab === 'milestones' ? (
        <section className="animate-fade-up-sm">
          <Card icon="i-flag" title="关键节点">
            <MilestoneTimeline milestones={milestones} />
          </Card>
        </section>
      ) : null}

      {/* ---------------- 文档 ---------------- */}
      {tab === 'docs' ? (
        <section className="animate-fade-up-sm">
          <Card icon="i-file" title="文档索引" hint="仅存索引与链接，正文留在原工具" flush>
            {documents.length > 0 ? (
              <DocumentList documents={documents} />
            ) : (
              <EmptyState title="暂无文档" description="为项目关联文档后会出现在这里。" />
            )}
          </Card>
        </section>
      ) : null}

      {/* ---------------- 时间线 ---------------- */}
      {tab === 'timeline' ? (
        <section className="animate-fade-up-sm">
          <Card icon="i-clock" title="项目动态">
            <ActivityFeed activity={activity} />
          </Card>
        </section>
      ) : null}
    </AppShell>
  )
}
