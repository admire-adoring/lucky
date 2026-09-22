/* 从 `shot-app.mjs --dump` 的 DOM 里取出探针报告并打印。
   用法：… --dump | node design/debug/read-probe.mjs
   ⚠️ 必须锚在 `<pre id="PROBE">` 上：注入脚本的**源码本身**里就写着 PROBE，
      直接 match stdout 会先匹配到源码那一份（probe-series.mjs 记过这个坑）。
   ⚠️ **dump 通道里 CSS 动画不会走**。实测：命令面板（`.cmd-mask.open`）在 dump 里
      读到 `display:flex`、矩形也对，但 `opacity` 停在 `0` —— 它挂着
      `animation: sb-fade-in .2s`，而无头 dump 不做合成帧，动画停在第一帧。
      同一份页面**截图**出来是正常可见的。所以：
      · 断言"显不显示"要读 `display` / 几何，**不要读动画驱动的 `opacity`**；
      · 观感一律以出图为准（与 shot-app.mjs 头部那条"DOM 通道是降级手段"同一口径）。 */
let s = ''
process.stdin.on('data', (d) => (s += d)).on('end', () => {
  /* ⚠️ 用 `lastIndexOf`，**不是** `indexOf`。
     探针文件是被原样塞进 `<script>` 注入的，所以它的**源码本身**也会出现在 DOM dump 里。
     只要探针的注释里提到过那个标签的字面量，`indexOf` 就会命中注释里那一份，
     接着把注释后面的正文当 JSON 解析 → 报 "Unexpected token"，看起来像"探针输出格式不对"。
     真实元素是探针跑完 `document.body.appendChild(el)` 追加的，**一定排在注入脚本之后**，
     所以取最后一次出现的那一个才是对的。（实测栽过一次。） */
  const i = s.lastIndexOf('<pre id="PROBE">')
  if (i < 0) {
    /* ⚠️ 「没有输出」有三类完全不同的原因，这里要把它们分开报，否则下一步没法查：
         ① 探针没跑起来 / 页面还没渲染完（DOM 里连 `</html>` 都有）；
         ② **dump 被截断了** —— 实测 `/home` 的 `--dump-dom` 输出**稳定停在 61841 字节**
            （跑两次完全一样），而探针报告是 `document.body.appendChild` 追加的、
            排在注入脚本**之后** ⇒ 整块被截掉。这时页面本身是好的
            （`.sb-root`、页面文案都在），只有报告丢了。
         ③ 页面真的没渲染。 */
    const truncated = !s.includes('</html>')
    console.log(
      `(没有 PROBE 输出 —— dump 长度 ${s.length} 字节${truncated ? '、**没有到 `</html>`，说明被截断了**' : ''})`,
    )
    if (truncated) {
      console.log(
        '  探针报告是追加在 body 末尾的，截断点之后的内容整块看不到。\n' +
          '  换个更小的页面/更小的视口再试，或按 `--dump | head -c …` 之前的部分判断页面是否正常。',
      )
    }
    return
  }
  /* ⚠️ 内容起点要用 `indexOf('>') + 1` 算，**不要写死偏移量**。
     `<pre id="PROBE">` 是 16 个字符，而人眼/手写很容易把它数成 17 ——
     数错的后果是**恰好吃掉开头的 `{`**，于是 JSON.parse 报
     "Unexpected non-whitespace character after JSON at position 8"，
     而它看起来像"探针输出的格式不对"，不像"读法写错了"（实测栽过一次）。 */
  const start = s.indexOf('>', i) + 1
  const j = s.indexOf('</pre>', start)
  const raw = s
    .slice(start, j)
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
  try {
    const o = JSON.parse(raw)
    console.log(JSON.stringify(o.info, null, 1))
    console.log('FAIL:', o.fail.length ? o.fail : '（无）')
  } catch {
    console.log(raw.slice(0, 1500))
  }
})
