/* 文档原文 · 文件头的 YAML（Obsidian 的「笔记属性」）。

   绑定的正文多半来自 Obsidian 仓，开头是一段 `---` 包着的 frontmatter。原来它被当成
   正文段落灌进 `.rd-body`，界面上就是 `title: …` `tags:` `- roll-call` 这么一竖条原文。
   这一支把它切出来交给属性面板，正文只留 `---` 之后的部分。

   只认"键 + 值 + 缩进列表"这一层（Obsidian 属性面板能画出来的就是这些）；
   认不出的行原样留在值里，不丢内容也不报错。
   切出来的 `head` 是逐字的那一段（含两行 `---`），保存时原样贴回去 ——
   正文改了、头不能跟着被规范化掉。 */

export type FmKind = 'text' | 'list' | 'date'

export interface FmEntry {
  key: string
  values: string[]
  kind: FmKind
}

export interface Frontmatter {
  /** 逐字的 frontmatter 原文（含首尾 `---`），没有就是空串 */
  head: string
  entries: FmEntry[]
  /** `---` 之后的正文 */
  body: string
}

/* 缩进列表在 Obsidian 里是这几类；其余的键即使写成列表也按行内串走 */
const LIST_KEYS = /^(tags?|aliases?|modules?|categories|cssclasses|authors?|related)$/i
/* 日期类键：值不是 ISO 日期也画成日期（用户既然这么命名，那就是个日期） */
const DATE_KEYS = /^(created|updated|modified|date|published|start|end|due)$/i
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(?:[T ]\d{1,2}:\d{2}(?::\d{2})?)?$/
const KEY_RE = /^([A-Za-z0-9_][\w\u4e00-\u9fa5-]*)\s*:(?:\s+(.*))?$/

function unquote(raw: string): string {
  const s = raw.trim()
  if (s.length >= 2 && ((s[0] === '"' && s.endsWith('"')) || (s[0] === "'" && s.endsWith("'")))) {
    return s.slice(1, -1)
  }
  return s
}

function kindOf(key: string, value: string): FmKind {
  if (DATE_KEYS.test(key)) return 'date'
  if (value && ISO_DATE.test(unquote(value))) return 'date'
  if (LIST_KEYS.test(key)) return 'list'
  return 'text'
}

function readRows(rows: string[]): FmEntry[] {
  const out: FmEntry[] = []
  let cur: FmEntry | null = null
  const flush = () => { if (cur) out.push(cur) }

  rows.forEach((raw) => {
    const line = raw.replace(/\s+$/, '')
    if (!line.trim()) return

    if (/^\s/.test(line)) {
      if (!cur) return
      const item = /^\s*-(?:\s+(.*))?$/.exec(line)
      if (item) {
        const v = unquote(item[1] ?? '')
        if (v) cur.values.push(v)
        /* 列表项出现 ⇒ 就是列表（日期键也照旧按日期画） */
        if (cur.kind !== 'date') cur.kind = 'list'
        return
      }
      /* 嵌套表 / 折行续写：原样塞进值里，不猜它的结构 */
      cur.values.push(line.trim())
      cur.kind = 'text'
      return
    }

    const m = KEY_RE.exec(line)
    if (!m) return
    flush()
    const key = m[1]
    const value = (m[2] ?? '').trim()
    cur = { key, values: [], kind: kindOf(key, value) }
    if (!value) return

    const inline = /^\[(.*)\]$/.exec(value)
    if (inline) {
      cur.values = inline[1].split(',').map(unquote).filter(Boolean)
      cur.kind = 'list'
      return
    }
    cur.values = [unquote(value)]
  })

  flush()
  return out
}

export function parseFrontmatter(md: string): Frontmatter {
  const text = String(md ?? '').replace(/\r\n?/g, '\n')
  const lines = text.split('\n')
  if (lines[0]?.trim() !== '---') return { head: '', entries: [], body: text }

  let end = -1
  for (let i = 1; i < lines.length; i += 1) {
    const bare = lines[i].trim()
    if (bare === '---' || bare === '...') { end = i; break }
  }
  if (end < 0) return { head: '', entries: [], body: text }

  return {
    head: lines.slice(0, end + 1).join('\n'),
    entries: readRows(lines.slice(1, end)),
    body: lines.slice(end + 1).join('\n').replace(/^\n+/, ''),
  }
}

/** ISO 日期 → Obsidian 面板上那种 `2026/11/02`（带时间的保留时分）。 */
export function fmDateText(value: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{1,2}):(\d{2}))?$/.exec(value)
  if (!m) return value
  const day = `${m[1]}/${m[2]}/${m[3]}`
  return m[4] ? `${day} ${m[4]}:${m[5]}` : day
}
