import type { DocumentItem } from '../../types'
import { Icon } from '../icons/Icon'
import { Tag } from '../ui/Badge'

/** 文档索引：只存索引与链接，正文留在原工具 */
export function DocumentList({ documents }: { documents: DocumentItem[] }) {
  return (
    <>
      {documents.map((document) => (
        <div
          key={document.id}
          className="flex items-center gap-4 border-b border-line px-5 py-[14px] transition-colors duration-150 ease-out last:border-b-0 hover:bg-surface-raised"
        >
          <span className="glass-soft flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-sm border border-line bg-ink-50 text-ink-500">
            <Icon name="i-file" className="h-4 w-4" />
          </span>

          <span className="min-w-0 flex-1">
            <b className="block truncate text-13-5 font-semibold leading-[1.5]">{document.name}</b>
            <span className="block truncate text-12 text-ink-400">{document.summary}</span>
          </span>

          <Tag>{document.source}</Tag>
          <span className="whitespace-nowrap text-12 tabular-nums text-ink-400">{document.updatedAt}</span>
        </div>
      ))}
    </>
  )
}
