import { Icon } from '../icons/Icon'
import { cn } from '../../lib/cn'
import { MiniChart } from './MiniChart'
import { EventRow, FlatRow, ProjectRow } from './TileRows'
import { HEAD_CHIP, LIST_CLASS, MORE_BUTTON, TILE_CLASS } from './tile-classes'
import type { KpiTileSpec, ListTileSpec, PlannedBlock as PlannedBlockSpec, TileRow, TileSpec } from '../../types/workbench'

/** 磁贴标题左侧的图标底托 */
function TileChip({ name }: { name: KpiTileSpec['icon'] }) {
  return (
    <span className={HEAD_CHIP}>
      <Icon name={name} className="h-[15px] w-[15px]" />
    </span>
  )
}

/** 「更多操作」：工作台里这些菜单项都还没有实现，点了给一条统一提示 */
function MoreButton() {
  return (
    <button type="button" aria-label="更多操作" className={MORE_BUTTON}>
      <Icon name="i-more" className="h-[15px] w-[15px]" />
    </button>
  )
}

/** 「规划中」清单：知识库"数据接入"磁贴里那块占位（图表区被它顶替） */
function PlannedBlock({ block }: { block: PlannedBlockSpec }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-line g g1 px-3 py-2.5 text-11-5 font-medium text-ink-500">
      {block.items.map((item) => (
        <span key={item} className="flex items-center gap-2">
          <Icon name="i-empty" className="h-[13px] w-[13px] text-ink-400" />
          {item}
          <span className="ml-auto text-ink-400">{block.note}</span>
        </span>
      ))}
    </div>
  )
}

/**
 * KPI 磁贴：标题 + 口径副标 + 大数字 + 图表区。
 *
 * 布局上有一处是刻意的：图表区那一段是 `mt-auto pt-4` —— 把图表**推到卡片底部**，
 * 于是同一行里的三块磁贴无论副标长短，图表都对齐在同一条线上。
 * 换成固定 margin 就会因为副标换行而错位。
 */
export function KpiTile({ tile }: { tile: KpiTileSpec }) {
  return (
    <article className={TILE_CLASS}>
      <div className="relative flex items-center gap-2">
        <TileChip name={tile.icon} />
        <b className="text-13 font-semibold text-ink-700">{tile.title}</b>
        <span className="flex-1" />
        <MoreButton />
      </div>
      <div className="relative mt-2.5 text-11-5 font-medium text-ink-400">{tile.sub}</div>
      <div className="relative mt-3 flex items-center gap-2">
        <b className="text-29 leading-none font-bold tracking-[-0.02em] tabular-nums">{tile.value}</b>
        {tile.unit ? <small className="text-13 font-semibold text-ink-400">{tile.unit}</small> : null}
        {tile.dot ? <i className={cn('h-[7px] w-[7px] shrink-0 rounded-full', tile.dot)} /> : null}
      </div>
      <div className="relative mt-auto pt-4">
        {tile.chart ? <MiniChart spec={tile.chart} /> : null}
        {tile.labels ? (
          <div
            className="mt-1.5 grid text-center text-11 font-medium text-ink-400"
            style={{ gridTemplateColumns: `repeat(${tile.labels.length}, minmax(0, 1fr))` }}
          >
            {tile.labels.map((label) => (
              <span key={label} className="truncate">
                {label}
              </span>
            ))}
          </div>
        ) : null}
        {tile.legend ? (
          <div className="mt-1.5 flex items-center justify-center gap-5 text-11 font-medium text-ink-400">
            {tile.legend.map(([dot, label]) => (
              <span key={label} className="inline-flex items-center gap-1.5">
                <i className={cn('h-[6px] w-[6px] rounded-full', dot)} />
                {label}
              </span>
            ))}
          </div>
        ) : null}
        {tile.tail ? <PlannedBlock block={tile.tail} /> : null}
      </div>
    </article>
  )
}

/** 行容器的语义由行本身决定：有事件行就是 `<ul>`，否则是普通堆叠 */
function RowList({ rows }: { rows: TileRow[] }) {
  const body = rows.map((row, i) => {
    if (row.kind === 'project') return <ProjectRow key={i} row={row} />
    if (row.kind === 'flat') return <FlatRow key={i} row={row} />
    return <EventRow key={i} row={row} />
  })
  const hasEvent = rows.some((r) => r.kind === 'event')
  return hasEvent ? <ul className="flex flex-1 flex-col">{body}</ul> : <div className="flex flex-1 flex-col">{body}</div>
}

/** 列表卡：抬头上边框 + 行体 */
export function ListTile({ tile }: { tile: ListTileSpec }) {
  return (
    <article className={LIST_CLASS}>
      <div className="flex items-center gap-2 border-b border-line px-5 py-4">
        <TileChip name={tile.icon} />
        <b className="text-13 font-semibold text-ink-700">{tile.title}</b>
        <span className="flex-1" />
        <span className="text-12 font-medium text-ink-400">{tile.right}</span>
      </div>
      <RowList rows={tile.body} />
    </article>
  )
}

/** 按 kind 分派。放这里是为了让面板只认 `TileSpec`，不必到处判 kind */
export function Tile({ tile }: { tile: TileSpec }) {
  return tile.kind === 'kpi' ? <KpiTile tile={tile} /> : <ListTile tile={tile} />
}
