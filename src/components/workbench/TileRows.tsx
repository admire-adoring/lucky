import { Link } from 'react-router-dom'
import { Icon } from '../icons/Icon'
import { SCOPE_META, STATUS_META } from '../../data/meta'
import { projectById } from '../../data/workbench'
import { toast } from '../../stores/toast-store'
import { cn } from '../../lib/cn'
import { ROW_ARROW, ROW_BASE } from './tile-classes'
import type { EventRowSpec, FlatRowSpec, ProjectRowSpec, TextRun } from '../../types/workbench'

/** 富文本片段：`em` 的那几段是原型里的 `<b>`（强调），渲染成 <strong> 而不是拼 HTML */
function Runs({ runs }: { runs: TextRun[] }) {
  return (
    <>
      {runs.map((r, i) =>
        r.em ? (
          <strong key={i} className="font-semibold text-ink-800">
            {r.text}
          </strong>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  )
}

/** 进度条 + 右侧百分比。宽度是**随数据变化的**，所以走 style 而不是拼 className */
function RowProgress({ grad, pct, pctCls }: { grad: string; pct: number; pctCls: string }) {
  return (
    <div className="hidden w-[132px] shrink-0 max-[600px]:hidden lg:block">
      <div className="flex items-center gap-2.5">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100">
          <span className={cn('block h-full', grad)} style={{ width: `${pct}%` }} />
        </div>
        <span className={cn('min-w-[34px] text-right text-12 font-bold tabular-nums', pctCls)}>{pct}%</span>
      </div>
    </div>
  )
}

const rowArrow = (
  <svg className={ROW_ARROW} aria-hidden="true">
    <use href="#i-arrow-right" />
  </svg>
)

/**
 * 项目行。**唯一有真实跳转的行** —— 点进项目详情。
 *
 * ⚠️ 项目数据按 id 现取（`projectById`）而不是从内容层带过来：
 *    内容层只存 id，于是"项目改了、行没改"在结构上不可能发生。
 *    取不到（id 被删/改名）时**不渲染这一行**并在开发期报错 ——
 *    留一行空壳比少一行更难查。
 */
export function ProjectRow({ row }: { row: ProjectRowSpec }) {
  const project = projectById(row.id)
  if (!project) {
    if (import.meta.env.DEV) console.error(`工作台列表里的项目 id 不存在：${row.id}`)
    return null
  }
  const scope = SCOPE_META[project.scope]
  const status = STATUS_META[project.status]
  const dueWarn = project.status !== 'done' && project.daysLeft <= 14

  return (
    <Link to={`/projects/${project.id}`} className={ROW_BASE}>
      <span className={cn('h-[34px] w-[3px] shrink-0 rounded-full', scope.bar)} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <b className="truncate text-13-5 font-semibold text-ink-800">{project.name}</b>
          <span
            className={cn(
              'inline-flex h-[22px] shrink-0 items-center gap-1.5 rounded-full border border-transparent px-[9px] text-11-5 font-semibold whitespace-nowrap',
              status.chip,
            )}
          >
            <i className={cn('h-[5.5px] w-[5.5px] shrink-0 rounded-full', status.dot)} />
            {status.label}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-11-5 font-medium text-ink-400">
          <span className={cn('inline-flex items-center gap-[5px]', dueWarn && 'font-semibold text-danger-strong')}>
            <Icon name="i-calendar" className="h-[12.5px] w-[12.5px] text-ink-400" />
            {project.dueShort}
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <Icon name="i-check" className="h-[12.5px] w-[12.5px] text-ink-400" />
            {project.tasksDone}/{project.tasksTotal} 任务
          </span>
        </div>
      </div>
      <RowProgress grad={scope.fill} pct={project.progress} pctCls="text-ink-600" />
      {rowArrow}
    </Link>
  )
}

/**
 * 扁平行：域汇总、"按天/按月"这类**不对应单个项目**的行。
 *
 * 它没有真实去处（原型的 `href="#"` 是占位），所以做成按钮并给一条"未实现"提示 ——
 * 页面里已有的口径就是这样：**看起来可点的东西点了必须有反应**，
 * 悬停高亮却不响应，比不做高亮更让人困惑。
 */
export function FlatRow({ row }: { row: FlatRowSpec }) {
  return (
    <button
      type="button"
      onClick={() => toast(`原型演示：${row.name} 的明细页未包含`)}
      className={cn(ROW_BASE, 'w-full text-left')}
    >
      <span className={cn('h-[34px] w-[3px] shrink-0 rounded-full', row.dot)} />
      <div className="min-w-0 flex-1">
        <b className="block truncate text-13-5 font-semibold text-ink-800">{row.name}</b>
        <div className="mt-1 text-11-5 font-medium text-ink-400">{row.meta}</div>
      </div>
      <RowProgress grad={row.grad} pct={row.pct} pctCls={row.pctCls ?? 'text-ink-600'} />
      {rowArrow}
    </button>
  )
}

/**
 * 事件行：知识库索引、关键节点这类"点 + 正文 + 副标 · 右侧"。
 *
 * ⚠️ 它是 `<li>`：这些行成组出现（"关键节点"），语义上是同一张列表，
 *    换成 div 会让读屏软件把它们读成互不相干的一串。原型也是 `<li>`。
 */
export function EventRow({ row }: { row: EventRowSpec }) {
  return (
    <li className="flex gap-3 border-b border-line px-5 py-3 last:border-b-0">
      <span className="flex w-[15px] shrink-0 justify-center">
        <i className={cn('mt-[6px] h-[7px] w-[7px] rounded-full', row.dot)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-12-5 leading-[1.6] text-ink-700">
          <Runs runs={row.text} />
        </p>
        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-11 font-medium text-ink-400">
          <span className="truncate">{row.sub}</span>
          <span className="h-[3px] w-[3px] shrink-0 rounded-full bg-ink-300" />
          <span className={cn('shrink-0 tabular-nums', row.tone === 'danger' && 'font-semibold text-danger-strong')}>
            {row.right}
          </span>
        </div>
      </div>
    </li>
  )
}
