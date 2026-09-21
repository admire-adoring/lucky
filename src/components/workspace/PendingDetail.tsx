/**
 * 「详情视图待迁移」占位。
 *
 * 为什么要有它、而不是干脆让这些按钮什么都不做：
 *   原型里有一族**数据驱动**的详情弹窗 —— `openRecipe(name)` / `openNote(title)` /
 *   `openClient(name)` 这类。它们的函数体是「一张按名字索引的数据表 + 一段用该行拼出来的
 *   模板」，模板里还夹着 `.map(t => \`<span>\${t}</span>\`).join('')` 这种"在 JS 里拼 HTML"
 *   的写法。把它机械搬过来需要一个小型模板编译器（对象字面量 → TSX 数据、
 *   表达式 → JSX、内嵌 HTML 字符串 → JSX），是独立的一大块。
 *
 *   在它做完之前，这些入口**不能**做成"点了没反应"——那是最难查的一种缺陷
 *   （用户分不清是没做、还是卡住了）。所以统一落到这里：标题就是被点的那个名字，
 *   正文说清"这是什么、还缺哪一步、去哪找事实源"。
 *
 * 迁移完一处就删一处调用；这个组件全部删掉的那天，说明这一族都搬完了。
 */
export function PendingDetail({ source }: { source: string }) {
  return (
    <div className="detail-section">
      <div className="detail-label">待迁移</div>
      <div className="detail-text">
        <p>
          这个详情视图在原型的脚本里是<b>数据驱动</b>生成的（一张按名字索引的数据表 + 一段模板拼接），
          尚未迁移。
        </p>
        <p>
          事实源：<code>{source}</code>
        </p>
        <p>迁移方式见 design/gen-workspace-pages.mjs 头部说明的「第四类」。</p>
      </div>
    </div>
  )
}
