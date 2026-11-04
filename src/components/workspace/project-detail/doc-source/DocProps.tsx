/* 文档原文 · 笔记属性（Obsidian 那套「属性」面板的样子）。

   头上那段 YAML 不再当正文读：标题一行、`笔记属性` 一行、下面键值成行。
   列表值（tags / modules）画成胶囊，日期画成"日历 + 2026/11/02"，其余一行字。

   键的图标按 Obsidian 的对应关系挑：title 文本、tags 标签、日期日历、模块列表 ——
   认不出的键给一枚圆点，不留空格子（空格子看起来像加载失败）。

   阅读态专用：这里是只读的一份，不提供 Obsidian 面板上那两件事（× 删项、+ 加项）——
   它们在只读页里点了也不该有反应，不如不画。 */

import type { FmEntry } from './frontmatter'
import { fmDateText } from './frontmatter'

const FM_ICONS: Record<string, string> = {
  text: '<line x1="4" y1="7" x2="20" y2="7"></line><line x1="4" y1="12" x2="20" y2="12"></line><line x1="4" y1="17" x2="14" y2="17"></line>',
  tag: '<path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2A2 2 0 0 1 3 12V5a2 2 0 0 1 2-2h7a2 2 0 0 1 1.4.6l7.2 7.2a2 2 0 0 1 0 2.6Z"></path><circle cx="7.8" cy="7.8" r="1.2"></circle>',
  calendar: '<rect x="3.2" y="5" width="17.6" height="16" rx="2.4"></rect><line x1="3.2" y1="10" x2="20.8" y2="10"></line><line x1="8" y1="2.8" x2="8" y2="6.4"></line><line x1="16" y1="2.8" x2="16" y2="6.4"></line>',
  list: '<line x1="9" y1="6" x2="20" y2="6"></line><line x1="9" y1="12" x2="20" y2="12"></line><line x1="9" y1="18" x2="20" y2="18"></line><circle cx="4.6" cy="6" r="1.2"></circle><circle cx="4.6" cy="12" r="1.2"></circle><circle cx="4.6" cy="18" r="1.2"></circle>',
  dot: '<circle cx="12" cy="12" r="3.2"></circle>',
}

function iconOf(entry: FmEntry): string {
  if (entry.kind === 'date') return 'calendar'
  if (entry.kind === 'list') return entry.key === 'tags' || entry.key === 'tag' ? 'tag' : 'list'
  if (entry.key === 'title' || entry.key === 'name') return 'text'
  return 'dot'
}

function FmIcon({ name }: { name: string }) {
  return (
    <svg
      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: FM_ICONS[name] ?? FM_ICONS.dot }}
    />
  )
}

function Value({ entry }: { entry: FmEntry }) {
  if (!entry.values.length) return <span className="rd-prop-empty">—</span>
  if (entry.kind === 'list') {
    return (
      <>
        {entry.values.map((v, i) => (
          <span className="rd-prop-chip" key={entry.key + i}>{v}</span>
        ))}
      </>
    )
  }
  if (entry.kind === 'date') {
    return (
      <span className="rd-prop-date">
        <FmIcon name="calendar" />
        {fmDateText(entry.values[0])}
      </span>
    )
  }
  return <span className="rd-prop-text">{entry.values.join(' · ')}</span>
}

export function DocProps({ title, entries }: { title: string; entries: FmEntry[] }) {
  return (
    <section className="rd-props" aria-label="笔记属性">
      {title ? <h1 className="rd-props-title">{title}</h1> : null}
      {entries.length ? (
        <>
          <div className="rd-props-head"><span>笔记属性</span></div>
          <div className="rd-props-rows">
            {entries.map((entry) => (
              <div className="rd-prop" key={entry.key}>
                <div className="rd-prop-key">
                  <FmIcon name={iconOf(entry)} />
                  <span>{entry.key}</span>
                </div>
                <div className="rd-prop-val">
                  <Value entry={entry} />
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}
    </section>
  )
}
