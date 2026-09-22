import type { AiQuote } from '../../data/ai/types'
import type { TextRun } from '../../types/workbench'

/**
 * 富文本片段渲染。
 *
 * 项目口径：**不拼 HTML、不用 `dangerouslySetInnerHTML`** —— 原型的强调是字符串里的
 * `<b>…</b>`，由脚本 `innerHTML` 进去；那等于把一段文本当代码执行，而这段文本
 * 将来会来自用户自己的输入。
 *
 * ⚠️ 渲染成 `<strong>` 而不是 `<b>`，配套要求生成物把原型 CSS 里的 `b` 选择器
 *    一起改道（见 `design/build-ai-css.mjs` 的 TAG_REMAP）。两边不对齐的后果是
 *    「渲染 `<strong>`、CSS 配 `b`」—— 一个元素都匹配不到，强调色与字重**静默失效**。
 */
export function Runs({ runs }: { runs: TextRun[] }) {
  return (
    <>
      {runs.map((run, i) =>
        run.em ? (
          <strong key={i}>{run.text}</strong>
        ) : (
          <span key={i}>{run.text}</span>
        ),
      )}
    </>
  )
}

/**
 * 气泡里的引用块（原型 `.msg-quote`：一组「· xxx」行）。
 *
 * 原型是把 `<br/>` 拼在一段 HTML 字符串里的。这里改成 `lines` 数组 ——
 * 每行一个片段数组，渲染成独立的一行。好处是行与行之间可以各自带强调，
 * 而且不必把换行符写进文本里（文本里的 `\n` 在 HTML 里会被折叠成空格）。
 */
export function QuoteBlock({ quote }: { quote: AiQuote }) {
  return (
    <div className="msg-quote">
      {quote.lines.map((line, i) => (
        <div key={i}>
          <Runs runs={line} />
        </div>
      ))}
    </div>
  )
}

/**
 * 多行纯文本。
 *
 * ⚠️ 原型的消息文本里是**真的有 `\n`** 的（脚本拼 `<br/>`，或模板串里换行）。
 *    到了 React，文本节点里的 `\n` 会被 CSS 折叠成空格 —— 症状是
 *    「本来分段的回答挤成一整段」，而没有任何报错。所以按 `\n` 切开、逐段渲染。
 *    与 `QuoteBlock` 的分工：那里是"结构化的列表块"，这里是"段落内的换行"。
 */
export function Paragraphs({ runs }: { runs: TextRun[] }) {
  const groups: TextRun[][] = [[]]
  for (const run of runs) {
    const parts = run.text.split('\n')
    parts.forEach((part, i) => {
      if (i > 0) groups.push([])
      if (part) groups[groups.length - 1]!.push({ ...run, text: part })
    })
  }
  return (
    <>
      {groups.map((group, i) => (
        <span key={i} className={i > 0 ? 'block' : undefined}>
          <Runs runs={group} />
        </span>
      ))}
    </>
  )
}
