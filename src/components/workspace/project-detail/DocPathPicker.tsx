import { Fragment, useEffect, useState } from 'react'
import { errorText } from '../../../api/error'
import { useDocBrowse } from '../../../hooks/use-docs'
import { cn } from '../../../lib/cn'
import { Icon } from '../../icons/Icon'
import '../../../styles/doc-path-picker.css'

/**
 * 存放位置选择器。
 *
 * 两种结果，靠点哪儿区分：
 *   · 点文件夹 = 在这儿新建（文件名用弹窗里的「文档名」）
 *   · 点一个 `.md` = 绑定它，之后编辑改的就是那个文件本身
 *
 * 为什么自己做而不是调系统文件框：系统框只能选文件或只能选文件夹，二选一；
 * 这一格要同时回答"存哪儿"和"用哪个现成的"，还要能一路看到文档根。
 */
export type DocPick = { kind: 'dir'; path: string } | { kind: 'file'; path: string }

/** 路径展示：文档根内的收成 `documents/…`，根外的照原样。 */
export function shortPath(path: string, root?: string) {
  if (!root) return path
  const norm = root.replace(/\/+$/, '')
  if (path === norm) return 'documents'
  if (path.startsWith(`${norm}/`)) return `documents/${path.slice(norm.length + 1)}`
  return path
}

/** 面包屑：根固定叫「本机」，与截图一致。 */
function crumbsOf(path: string): { label: string; path: string }[] {
  const norm = path.replace(/\\/g, '/')
  /* Windows 盘符：`C:/Users/...`，第一段就是盘本身 */
  if (/^[A-Za-z]:\//.test(norm)) {
    const drive = norm.slice(0, 3)
    const rest = norm.slice(3).split('/').filter(Boolean)
    return [
      { label: drive.replace(/\/$/, ''), path: drive },
      ...rest.map((seg, i) => ({ label: seg, path: drive + rest.slice(0, i + 1).join('/') })),
    ]
  }
  const parts = norm.split('/').filter(Boolean)
  return [
    { label: '本机', path: '/' },
    ...parts.map((seg, i) => ({ label: seg, path: `/${parts.slice(0, i + 1).join('/')}` })),
  ]
}

function sizeText(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  const units = ['KB', 'MB', 'GB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function timeText(ms: number): string {
  if (!ms) return ''
  const date = new Date(ms)
  const now = new Date()
  const clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (date.toDateString() === now.toDateString()) return `今天 ${clock}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `昨天 ${clock}`
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function DocPathPicker({
  startPath,
  docName,
  root,
  onClose,
  onPick,
}: {
  /** 打开时落在哪 —— 通常给默认落点；不给就从文档根起 */
  startPath?: string | null
  /** 弹窗里那个文档名，页脚用它说明"将新建哪一篇" */
  docName?: string
  /** 文档根绝对路径，用来把长路径收成 `documents/…` */
  root?: string
  onClose: () => void
  onPick: (pick: DocPick) => void
}) {
  const [path, setPath] = useState<string | null>(startPath ?? null)
  const [draft, setDraft] = useState('')
  const { data, error, isFetching, refetch } = useDocBrowse(path, true)

  /* 输入框跟着"当前目录"走：进下一层、点面包屑都同步 */
  useEffect(() => {
    if (data?.path) setDraft(data.path)
  }, [data?.path])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  const crumbs = crumbsOf(data?.path ?? draft ?? '/')

  const go = (next: string) => {
    const value = next.trim()
    if (!value) return
    if (value === data?.path) refetch()
    else setPath(value)
  }

  return (
    <div
      className="pk-mask"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="pk" role="dialog" aria-modal="true" aria-label="选择存放位置">
        <div className="pk-head">
          <div className="pk-title">选择存放位置</div>
          <button type="button" className="pk-close" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>

        <div className="pk-body">
          <div className="pk-nav">
            <div className="pk-crumbs">
              {crumbs.map((crumb, index) => (
                <Fragment key={crumb.path}>
                  {index > 0 ? <span className="pk-crumb-sep">›</span> : null}
                  <button
                    type="button"
                    className={cn('pk-crumb', index === crumbs.length - 1 && 'is-last')}
                    onClick={() => go(crumb.path)}
                  >
                    {crumb.label}
                  </button>
                </Fragment>
              ))}
            </div>
            {/* 深处也能一步跳回去 —— 一层层点面包屑点不回去的时候，这两颗是退路 */}
            <div className="pk-shortcuts">
              {data && data.path !== data.home ? (
                <button type="button" className="pk-shortcut" onClick={() => go(data.home)}>
                  主目录
                </button>
              ) : null}
              {root && data && data.path !== data.root ? (
                <button type="button" className="pk-shortcut" onClick={() => go(data.root)}>
                  文档根
                </button>
              ) : null}
            </div>
          </div>

          <form
            className="pk-path"
            onSubmit={(event) => {
              event.preventDefault()
              go(draft)
            }}
          >
            <input
              value={draft}
              aria-label="路径"
              spellCheck={false}
              autoComplete="off"
              onChange={(event) => setDraft(event.target.value)}
            />
          </form>

          <div className="pk-list">
            {error ? (
              <p className="pk-empty">{errorText(error)}</p>
            ) : !data ? (
              <p className="pk-empty">读取中…</p>
            ) : data.entries.length === 0 ? (
              <p className="pk-empty">这个文件夹是空的 —— 可以就在这儿新建</p>
            ) : (
              data.entries.map((entry) => (
                <button
                  key={entry.path}
                  type="button"
                  className={cn('pk-row', entry.isDir && 'is-dir')}
                  title={entry.path}
                  onClick={() =>
                    entry.isDir ? go(entry.path) : onPick({ kind: 'file', path: entry.path })
                  }
                >
                  <Icon name={entry.isDir ? 'i-chevron-right' : 'i-file'} className="pk-row-icon" />
                  <span className="pk-row-name">{entry.name}</span>
                  <span className="pk-row-meta">
                    {entry.isDir
                      ? `${entry.items} 项`
                      : [sizeText(entry.size), timeText(entry.modified)].filter(Boolean).join(' · ')}
                  </span>
                </button>
              ))
            )}
          </div>

          <p className="pk-tip">
            点文件夹 = 在这里新建；点开一个 .md = 绑定它，之后改的就是那个文件本身。
            {isFetching && data ? <span className="pk-loading">更新中…</span> : null}
          </p>
        </div>

        <div className="pk-foot">
          <span className="pk-foot-hint">
            {docName ? `将新建：${docName}.md` : '将在这里新建一篇文档'}
          </span>
          <button type="button" className="pk-btn" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className="pk-btn pk-btn-primary"
            disabled={!data}
            onClick={() => {
              if (data) onPick({ kind: 'dir', path: data.path })
            }}
          >
            用这个文件夹
          </button>
        </div>
      </div>
    </div>
  )
}
