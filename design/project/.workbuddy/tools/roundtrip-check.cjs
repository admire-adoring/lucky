/* 原文页的**往返体检**（DOM → markdown → 块 → DOM）。
   用法（在 design/project 目录下）：
     NS="/Users/yangliu/Library/Application Support/Parall/WorkBuddy(Parall_3)/.workbuddy/binaries/node/workspace/node_modules"
     NODE="/Users/yangliu/Library/Application Support/Parall/WorkBuddy(Parall_3)/.workbuddy/binaries/node/versions/22.22.2-3/bin/node"
     NODE_PATH="$NS" "$NODE" .workbuddy/tools/roundtrip-check.cjs 项目-文档原文-index.html

   为什么值得留着：它逮到过两个"看代码看不出来"的 bug ——
     · `mdOfBlocks` 把表格**按行分多次 push**，而末尾是 `join('\n\n')` ⇒ 行间被插空行
       ⇒ 再解析回来每行变成一张小表（`edSave` 走的正是这条路 ⇒ **保存一次就毁表格**）
     · `rdCodeHtml` 里用 `replace('></span>', …)` 拼开关 ⇒ **标签配错** ⇒ innerHTML 重排整块结构
     · Markdown 档高亮只输出捕获组 ⇒ 把 `[文字](…)` 的**方括号吃掉了**（改内容，不只是改颜色）
   ⚠️ 用 `.cjs` 后缀：项目根 `package.json` 里有 `"type": "module"` ⇒ `.js` 会被当 ESM，
      `require` 直接报错（这个坑踩过一次）。
   ⚠️ jsdom **没有布局**（`getBoundingClientRect` 全 0、`Element.scrollTo` 不存在）
      ⇒ 只验"结构与数据"，**验不了视觉与尺寸**（那些只能靠算）。 */
const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const html = fs.readFileSync(process.argv[2], 'utf8');
const errs = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errs.push('jsdomError: ' + (e.detail && e.detail.stack || e.message)));
/* ⚠️ **CSS 解析失败也要算异常**（只挂 `jsdomError` 会漏掉它）：
   样式表里多写/少写一个**注释结束记号**（星号 + 斜杠）就会把后面的规则错位解析 ——
   页面**看着还在**、只是有些样式悄悄不生效（本仓栽过一次：改注释块时多写了一个）。
   症状就是这一句 "Could not parse CSS stylesheet"。 */
vc.on('error', (msg) => {
  const s = String(msg);
  if (s.indexOf('Could not parse CSS') >= 0) errs.push('CSS 解析失败（多半是注释 `*/` 多写或少写）');
});
const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc });
const w = dom.window, d = w.document;
const pane = (k) => { try { w.edSetPane(k); } catch (e) { /* jsdom 没有 scrollTo */ } };
const say = (n, v) => console.log('  ' + n + ' → ' + v);

console.log('== 初始化 ==');
say('未捕获异常', errs.length);

console.log('== 编辑态结构 ==');
pane('edit');
const root = d.getElementById('edPreview');
say('块根元素数', root ? root.children.length : '无编辑根');
say('表格数 / 每张行数', root
  ? Array.prototype.map.call(root.querySelectorAll('table'), (t) => t.rows.length).join(',')
  : '-');
say('根下混进表格零件（结构被重排）', root
  ? Array.prototype.filter.call(root.children, (k) => /^(TR|TD|TH|TBODY|THEAD)$/.test(k.tagName)).length : '-');
say('代码卡数', root ? root.querySelectorAll('.rd-code').length : '-');

console.log('== 语法高亮 ==');
/* ⚠️ 这条不变式是这一层唯一的"对不对"判据：**产出剥掉标签后必须逐字等于原文**。
   高亮只许改颜色 —— 改内容（少一个字、多一个括号）在这里就会被逮到。
   实测抓到过一次：md 档只输出捕获组，把 `[文字](…)` 的方括号吃掉了。 */
const stripTk = (h) => String(h)
  .replace(/<span class="tk-[^"]*">/g, '').replace(/<\/span>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'").replace(/&amp;/g, '&');
const HL_SAMPLES = {
  text: 'const a = 1; 中文 <b> & "x"',
  js: 'const a = 1; // 注释\nfunction f(x) {\n  return "s" + x + 3.14;\n}',
  ts: 'interface A { x: number }\nconst v: A = { x: 1 };',
  java: '@Override\npublic String f(int a) { return "x" + a; /* c */ }',
  py: 'def f(a, b):\n    """doc"""\n    return a + b  # 注释\nx = 0xFF',
  go: 'func main() {\n\tfmt.Println("hi", 42)\n}',
  rs: 'fn main() { let s: String = String::from("x"); } // c',
  sql: "SELECT id, name FROM t WHERE a = 'x' -- c\nAND b > 10",
  sh: 'if [ -f "$HOME/x" ]; then echo "ok"; fi # c',
  json: '{ "a": 1, "b": [true, null], "c": "s" }',
  yaml: 'name: 测试\nlist:\n  - a  # 注释\nflag: true',
  html: '<!DOCTYPE html>\n<div class="a" id=\'b\'>文字 &amp; 更多</div>\n<!-- 注释 -->',
  xml: '<?xml version="1.0"?>\n<a b="c"><d /></a>',
  css: '@media screen { .a > .b { color: #FFF; margin: 10px; } } /* c */',
  md: '# 标题\n- 列表 X **粗** [文字](http://a.b)\n> 引用',
};
const hlBad = [];
Object.keys(HL_SAMPLES).forEach((lang) => {
  let out = '';
  try { out = w.edHlCode(HL_SAMPLES[lang], lang); } catch (e) { out = 'THROW ' + e.message; }
  if (stripTk(out) !== HL_SAMPLES[lang]) hlBad.push(lang);
});
say('15 种语言剥标签后逐字相等', hlBad.length ? '!! 不一致：' + hlBad.join(',') : 'OK');
say('text / 未知语言原样输出', w.edHlCode(HL_SAMPLES.text, 'text') === w.esc(HL_SAMPLES.text)
  && w.edHlCode('a < b', 'zzz') === w.esc('a < b'));
/* 两态结构：编辑态 `<code>` 必须是**纯文本**（光标 / 选区 / 序列化全指望它），颜色在另一层 */
if (root) {
  const cbox = root.querySelector('.rd-code');
  if (cbox) {
    const ccode = cbox.querySelector('.rd-code-pre code');
    const clayer = cbox.querySelector('.rd-code-hl');
    say('编辑态 <code> 内 span 数（必须 0）', ccode.querySelectorAll('span').length);
    say('编辑态有高亮层 .rd-code-hl', !!clayer);
    say('两层文字逐字相同（对齐前提）', clayer ? stripTk(clayer.innerHTML) === ccode.textContent : '-');
  }
}

console.log('== 上下标 / 行内嵌套 ==');
/* 判据与高亮那条一样："写出去的要能原样读回来"。markdown 没有上下标写法 ⇒ 存行内 HTML
   （`<sup>` / `<sub>`）⇒ 渲染（`rdInline`）与序列化（`mdInlineOf`）**两端都得认**，
   少一端就是"写得进去、读不出来"。这里走的是**真链路**：md → 渲染成 DOM → 再从 DOM 序列化回 md。
   ⚠️ 后两例专测"占位符跨界"：span 在外、sup 在外是**两种不同的抽取顺序**，
      内层递归若各持一份 `keep`，按下标查自己那张空表 ⇒ 写出字面的 `undefined`
      （2026-09-29 做 v8.23 时发现并把 `keep` 收成全树共享的一份）。 */
const IN_NEST = [
  'x<sup>2</sup> + y<sub>1</sub>',
  'H<sub>2</sub>O 与 10<sup>2</sup>m<sup>3</sup>',
  '<sup>**2**</sup>',
  '<span style="color:#FF0000">a<sup>b</sup></span>',
  '<sup><span style="background:#FFFF00">b</span></sup>',
];
const nestBad = [];
const nestBox = d.createElement('div');
IN_NEST.forEach((src) => {
  let back = '';
  try {
    nestBox.innerHTML = w.rdBlockHtml({ t: 'p', x: src }, 0, true);
    back = w.mdBlockOf(nestBox.firstElementChild);
  } catch (e) { back = 'THROW ' + e.message; }
  if (back !== src) nestBad.push(JSON.stringify(src) + ' ⇒ ' + JSON.stringify(back));
});
say('md → 渲染 → md 逐字相等（5 例）', nestBad.length ? '!! ' + nestBad.join(' | ') : 'OK');
const nestHtml = IN_NEST.map((s) => { try { return w.rdInline(s); } catch (e) { return 'THROW'; } });
say('渲染出真的 <sup> / <sub> 元素', /<sup>2<\/sup>/.test(nestHtml[0]) && /<sub>1<\/sub>/.test(nestHtml[0]));
say('渲染结果里没有字面的 undefined', nestHtml.filter((h) => h.indexOf('undefined') >= 0).join(' | ') || 'OK');
/* 互斥：上下标说的是"这个字在基线的哪一侧" ⇒ 一个字不可能既在上又在下
   （`ED_MARKS_SPEC.off` 登记着互斥的那一个；粗/斜/删/下划线是**可以共存**的，不填 off）。
   源码面这一支：套上标之前先把选区里的 `<sub>` 剥掉 —— 不剥就会写成 `<sub><sup>…</sup></sub>`。 */
try {
  const mixTa = d.createElement('textarea');
  mixTa.value = 'a<sub>1</sub>b';
  d.body.appendChild(mixTa);
  mixTa.setSelectionRange(0, mixTa.value.length);
  w.edWrapSel(mixTa, '<sup>', '</sup>', 'sub');
  const got = mixTa.value;
  say('套上标时剥掉 <sub>（互斥）', got === '<sup>a1b</sup>' ? 'OK' : '!! ' + got);
  mixTa.parentNode.removeChild(mixTa);
} catch (e) { say('套上标时剥掉 <sub>（互斥）', '!! THROW ' + e.message); }

console.log('== 块级样式（段落对齐/行高 · 列表编号） ==');
/* 两条链路都要验（判据："写出去的要能原样读回来"）：
     · mdChain  = md → 块 → md      （**存**：`mdOfSource` ⇄ `mdOfBlocks`）
     · domChain = md → 渲染 → md    （**看**：`rdBlockHtml` ⇄ `mdBlockOf`，走真 DOM）
   ⚠️ 对齐曾经就断在这条路上：渲染端写的是 class（`rd-align-center`）、序列化端读的是
      `style.textAlign` ⇒ 从 DOM 走一趟，对齐就没了（"设了、存下来没了"）。
      现在两端共用 `rdParaStyle` / `rdParaStyleStr`，这几条用例就是钉住它。
   ⚠️ 编号样式（`<ol type="…">`）是**配对行**语法（照代码块 fence 那条路子）——
      多行结构最容易在拼接处出事（表格当年就是这么毁的），所以往返必须逐字相等。 */
const BLOCK_SAMPLES = [
  '一段普通的文字',
  '<div style="text-align:center">居中的一段</div>',
  '<div style="line-height:1.5">行高松一点的一段</div>',
  '<div style="text-align:right;line-height:2">又右又松的一段</div>',
  '1. 第一项\n2. 第二项',
  '<ol type="a">\n1. 第一项\n2. 第二项\n</ol>',
  '<ol type="cn">\n1. 甲\n2. 乙\n</ol>',
  /* ⚠️ 这条专门钉"编号按层级各算各的"：`丁` 退回一级 ⇒ 必须是 `2.`（不是 `4.`）。
     用 children/数组下标当编号就会写成 4. —— 这个 bug 是加编号样式时才露出来的。 */
  '<ol type="multi">\n1. 甲\n  1. 乙\n    1. 丙\n2. 丁\n</ol>',
  /* ⚠️ `start`（取消中间项后列表被拆开、后半段要续号）：它要**两处一起**才自洽 ——
     HTML 的 `start` 属性（编号字面量用）+ `counter-reset`（我们自己画的标号用）。
     少写一处就是"源码写着 3.、看着却是 1."。 */
  '<ol start="3">\n3. 丙\n4. 丁\n</ol>',
  /* 提示块五档（v8.35）。⚠️ 这五条钉的是**最容易漏的那一处**：
     `mdBlockOf` 里原来有一份写死的档位清单（`is-(info|warn|ok)`），加档位忘了改它，
     就会"渲染出去是 `is-imp`、读回来变默认档" —— 页面照样有色块，存一次档位就丢了。
     现在那份清单由 `RD_NOTE` 拼（`NOTE_CLS_RE`），这几条走的就是真链路。 */
  '> [!提醒] 一条提醒',
  '> [!建议] 一条建议',
  '> [!重要] 一条重要的',
  '> [!警告] 一条警告',
  '> [!注意] 一条要注意的',
  /* ⚠️ 卡里多行（v8.36）：`<br>` 是一等的行内写法，而提示卡的正文**只认 `.rd-note-body`**
     那一段 —— 结构一旦改成"标签行 + 正文"两行，这两条就是防"档名被当成正文读进来"的钉子。 */
  '> [!警告] 第一行<br>第二行',
  '> [!提醒] 甲<br>乙<br>丙',
  /* 旧写法（v8.34 之前的三档：说明 / 注意 / 结论）**不再被认成提示块** ⇒
     应当原样当成引用往返（不丢内容、也不冒充新档位）。 */
  '> [!结论] 旧写法',
];
const blkBox = d.createElement('div');
const mdChain = (md) => { try { return w.mdOfBlocks(w.mdOfSource(md)); } catch (e) { return 'THROW ' + e.message; } };
const domChain = (md) => {
  try {
    blkBox.innerHTML = w.mdOfSource(md).map((b, k) => w.rdBlockHtml(b, k, true)).join('');
    return Array.prototype.map.call(blkBox.children, (el) => w.mdBlockOf(el)).join('\n\n');
  } catch (e) { return 'THROW ' + e.message; }
};
/* `mdOfBlocks` 末尾本来就带一个换行（它的既有约定）⇒ 比的时候只忽略**末尾**的换行，
   中间一个字节都不放过。 */
const norm = (s) => String(s).replace(/\n+$/, '');
const blkBad = [];
BLOCK_SAMPLES.forEach((src) => {
  const a = mdChain(src), b = domChain(src);
  if (norm(a) !== norm(src)) blkBad.push('存 ' + JSON.stringify(src) + ' ⇒ ' + JSON.stringify(a));
  if (norm(b) !== norm(src)) blkBad.push('看 ' + JSON.stringify(src) + ' ⇒ ' + JSON.stringify(b));
});
say(BLOCK_SAMPLES.length + ' 例 · md→块→md 与 md→渲染→md 都逐字相等',
  blkBad.length ? '!! ' + blkBad.join(' | ') : 'OK');
/* 渲染端要真的把样式落在 `<p style>` 上（不然"看得见的效果"与"存下来的"是两回事） */
const pStyle = (() => {
  try { return w.rdBlockHtml({ t: 'p', x: 'x', al: 'center', lh: '1.5' }, 0, true); } catch (e) { return 'THROW'; }
})();
say('段落样式落在行内 style 上', /style="text-align:center;line-height:1\.5"/.test(pStyle) ? 'OK' : '!! ' + pStyle);
const olAttr = (() => {
  try { return w.rdBlockHtml({ t: 'ol', x: ['甲', '乙'], num: 'multi' }, 0, true); } catch (e) { return 'THROW'; }
})();
say('编号样式落在 data-num 上', /<ol data-num="multi">/.test(olAttr) ? 'OK' : '!! ' + olAttr);

console.log('== 往返：块 → md ==');
/* 往返：直接拿这一篇的 md 走两遍（md → 块 → md） */
const ta0 = (function () { try { w.edSetMode('src'); } catch (e) { return null; } return d.getElementById('edBody'); })();
const md1 = ta0 ? ta0.value : '';
say('md 长度', md1.length);
const md2 = w.mdOfBlocks(w.mdOfSource(md1));
say('md → 块 → md 是否逐字相等', md1 === md2 ? 'OK' : '!! 不相等（下面给差异）');
if (md1 !== md2) {
  const a = md1.split('\n'), b = md2.split('\n');
  for (let i = 0; i < Math.max(a.length, b.length); i += 1) {
    if (a[i] !== b[i]) { console.log('    第一处差异 第 ' + (i + 1) + ' 行：'); console.log('      旧: ' + JSON.stringify(a[i])); console.log('      新: ' + JSON.stringify(b[i])); break; }
  }
}
say('表格是否连续（不该有空行打断）', /\|\s*---[\s\S]{0,40}\n\n/.test(md2) ? '!! 表格行间有空行' : 'OK');
console.log('== 可视面：上下标互斥 ==');
/* 同一个 `off` 判据的可视面那一支（读 DOM、摘元素、按**字符区间**把选区找回来）。
   ⚠️ 放在**最后**跑：`edWysWrap` 末尾会 `edWysSync()`（把整份 DOM 序列化回 md），
      排在它前面的"往返"那两节会被改过的数据影响。
   ⚠️ 这里故意用 `selectNodeContents`：它让选区的**头尾都落在元素上**
      （`endOffset` 是**子节点下标**、不是字符数）—— 正是边界换算最容易算错的那种情形。 */
try {
  /* ⚠️ 前面那一节把面切到了「源码」⇒ `#edPreview` 已经不在文档里了（编辑面是 textarea），
     先切回「可视」再动手，否则拿到的是 null。 */
  try { w.edSetMode('wys'); } catch (e) { /* 忽略 */ }
  const eRoot = d.getElementById('edPreview');
  if (!eRoot) throw new Error('切不回可视面（#edPreview 不在）');
  const host = d.createElement('p');
  host.innerHTML = 'a<sub>123</sub>b';
  eRoot.insertBefore(host, eRoot.firstChild);
  const r2 = d.createRange();
  r2.selectNodeContents(host.querySelector('sub'));
  const sel2 = w.getSelection();
  if (sel2.removeAllRanges) sel2.removeAllRanges();
  sel2.addRange(r2);
  w.edWysWrap('sup');
  const b2 = d.getElementById('edPreview').firstElementChild;
  const sup2 = b2.querySelector('sup');
  say('在 <sub> 上点上标 = 换过去（不是套成 <sub><sup>）',
    !b2.querySelector('sub') && sup2 && String(sup2.textContent) === '123' ? 'OK' : '!! ' + b2.innerHTML);
  b2.parentNode.removeChild(b2);
} catch (e) { say('在 <sub> 上点上标 = 换过去（可视面）', '!! THROW ' + e.message); }

console.log('== 编号样式：不在列表里也要点得动 ==');
/* 用户实测撞上的那条：**光标在正文段落里点「编号样式」** —— 以前只回一句
   "编号样式只对有序列表有效"（用户读成"这个按钮点不动"）。
   现在的口径：点这一项 = "这段按这个样式编号"，所以**先把这一段变成有序列表**再套档位。 */
try {
  try { w.edSetMode('wys'); } catch (e) { /* 忽略 */ }
  const eRoot3 = d.getElementById('edPreview');
  const p3 = d.createElement('p');
  p3.textContent = '一段普通正文';
  eRoot3.insertBefore(p3, eRoot3.firstChild);
  const r4 = d.createRange();
  r4.setStart(p3.firstChild, 2);
  r4.collapse(true);
  const sel4 = w.getSelection();
  if (sel4.removeAllRanges) sel4.removeAllRanges();
  sel4.addRange(r4);
  w.edWysListNum('multi');
  const b4 = d.getElementById('edPreview').firstElementChild;
  say('段落里点编号样式 → 先变列表、再套档位',
    b4 && b4.tagName === 'OL' && b4.getAttribute('data-num') === 'multi'
      ? 'OK' : '!! ' + (b4 ? String(b4.outerHTML).slice(0, 90) : 'null'));
  /* ⚠️ 连带必须验的一条：li 上要**永远有** `rd-indN`（`rd-ind0` 也是值）。
     编号样式的 CSS 全挂在 `li.rd-ind0/1/2/3` 上、同时又 `list-style:none` 关掉了浏览器默认标号
     ⇒ li 一旦光秃秃，**标号整排消失，只剩 ol 那点内距**（用户原话"只加了缩进"）。 */
  const li4 = (b4 && b4.querySelector) ? b4.querySelector('li') : null;
  say('…且 li 带层级 class（否则标号画不出来）',
    li4 && /(?:^|\s)rd-ind\d(?:\s|$)/.test(String(li4.className))
      ? 'OK' : '!! li class = ' + (li4 ? JSON.stringify(li4.className) : 'null'));
  if (b4 && b4.parentNode) b4.parentNode.removeChild(b4);
} catch (e) { say('段落里点编号样式', '!! THROW ' + e.message); }
/* 反过来：**不能换的块要拦住**（表格 / 代码卡 / 图 —— 换掉就是把结构拆了） */
try {
  const tb = d.getElementById('edPreview').querySelector('table');
  if (tb) {
    const r5 = d.createRange();
    r5.selectNodeContents(tb.querySelector('th') || tb);
    r5.collapse(true);
    const sel5 = w.getSelection();
    if (sel5.removeAllRanges) sel5.removeAllRanges();
    sel5.addRange(r5);
    w.edWysListNum('a');
    say('表格里点编号样式 → 拦住（表格还在）',
      d.getElementById('edPreview').querySelector('table') ? 'OK' : '!! 表格被换掉了');
  } else say('表格里点编号样式 → 拦住（表格还在）', '（这一篇没有表格，跳过）');
} catch (e) { say('表格里点编号样式 → 拦住', '!! THROW ' + e.message); }

console.log('== 取消列表 → 变回段落 ==');
/* 用户实测的第二个问题：**点了列表再点一次取消，结果变成了无序列表**。
   根因：把 `<li>` 整个搬进 `<p>` —— 孤立的 li（不在 ol/ul 里）仍按 `display: list-item`
   渲染、标号取 UA 默认的 **disc** ⇒ 看着就是"无序列表"；多项目列表还会挤进同一个 `<p>`。
   现在的口径：列表 → 段落 / 标题 / 引用时，**每一项各成一个块**，且只搬每一项的"内容"。 */
try {
  const eRoot6 = d.getElementById('edPreview');
  const ol6 = d.createElement('ol');
  ol6.innerHTML = '<li class="rd-ind0">甲</li><li class="rd-ind0">乙</li>';
  eRoot6.insertBefore(ol6, eRoot6.firstChild);
  const r7 = d.createRange();
  r7.setStart(ol6.querySelector('li').firstChild, 1);
  r7.collapse(true);
  const sel7 = w.getSelection();
  if (sel7.removeAllRanges) sel7.removeAllRanges();
  sel7.addRange(r7);
  const before6 = eRoot6.children.length;
  w.edWysSetBlock('ol', true);                 /* 再点一次 = 取消（回到正文） */
  const after6 = eRoot6.children.length;
  /* ⚠️ 判据只看**我插的这一片**：`#edPreview` 里本来就有示例文档的列表，
     拿"全页还有没有 `<li>`"当判据会误报（这次就误报了一次）。
     ol6 插在最前面 ⇒ 取消后前两个元素应当是 `<p>`，且里面不含 `<li>`。 */
  /* ⚠️ 口径（v8.33 起）：取消**只作用于选中的那一项**（默认光标所在项），
     不是把整张列表散掉 —— 所以两项列表取消第一项 ⇒ 一个段落 + 一个还留着一项的列表。
     判据还是那两条：**不残留孤立 `<li>`**（孤立的 li 会被浏览器画成圆点）＋ 块数对得上。 */
  const two = [eRoot6.children[0], eRoot6.children[1]];
  const okTwo = two[0] && two[0].tagName === 'P' && !two[0].querySelector('li')
    && two[1] && two[1].tagName === 'OL' && !!two[1].querySelector('li');
  say('两项列表取消第一项 → 段落 +（剩一项的）列表，不残留孤立 <li>',
    okTwo && after6 === before6 + 1 ? 'OK' : '!! ' + two.map((el) => el && el.tagName).join(',')
      + ' 块数 ' + before6 + '→' + after6);
  const first6 = eRoot6.firstElementChild;
  if (first6) first6.parentNode.removeChild(first6);
  const second6 = eRoot6.firstElementChild;
  if (second6) second6.parentNode.removeChild(second6);
} catch (e) { say('取消列表 → 变回段落', '!! THROW ' + e.message); }

console.log('== 列表可拆：只取消选中的项、后面续号 ==');
/* 用户：「取消列表的时候，只取消选中的行，默认当前行，如果是取消的中间的，那后面的序号重写计算」。
   两个面同一条口径：把列表拆成「前段 / 裸行 / 后段」，后段用 `start` **接着数** ——
   被取消的那一行**留在原位**（不搬到列表末尾），也不把整张列表散掉。 */
try {
  try { w.edSetMode('src'); } catch (e) { /* 忽略 */ }
  const ta2 = d.getElementById('edBody');
  if (!ta2) { say('源码面取消中间行', '（切不到源码面）'); } else {
    ta2.value = '1. 甲\n2. 乙\n3. 丙';
    ta2.setSelectionRange('1. 甲\n2. 乙'.length, '1. 甲\n2. 乙'.length);
    w.edToggleOl(ta2);
    const want = '1. 甲\n乙\n<ol start="2">\n2. 丙\n</ol>';
    say('源码面 · 取消中间行 ⇒ 该行变正文、后半段从 2. 续',
      ta2.value === want ? 'OK' : '!! ' + JSON.stringify(ta2.value));
    ta2.value = '1. 甲\n2. 乙\n3. 丙';
    ta2.setSelectionRange(2, 2);
    w.edToggleOl(ta2);
    say('源码面 · 取消第一行 ⇒ 剩下的从 1. 重排',
      ta2.value === '甲\n<ol>\n1. 乙\n2. 丙\n</ol>' ? 'OK' : '!! ' + JSON.stringify(ta2.value));
  }
} catch (e) { say('源码面取消中间行', '!! THROW ' + e.message); }
try {
  try { w.edSetMode('wys'); } catch (e) { /* 忽略 */ }
  const eRoot7 = d.getElementById('edPreview');
  const ol7 = d.createElement('ol');
  ol7.innerHTML = '<li class="rd-ind0">甲</li><li class="rd-ind0">乙</li><li class="rd-ind0">丙</li>';
  eRoot7.insertBefore(ol7, eRoot7.firstChild);
  const r8 = d.createRange();
  r8.setStart(ol7.children[1].firstChild, 1);
  r8.collapse(true);
  const sel8 = w.getSelection();
  if (sel8.removeAllRanges) sel8.removeAllRanges();
  sel8.addRange(r8);
  w.edWysSetBlock('ol', true);
  const got = [eRoot7.children[0], eRoot7.children[1], eRoot7.children[2]]
    .map((el) => el ? el.outerHTML.replace(/ class="[^"]*"/g, '').replace(/<li[^>]*>/g, '<li>') : '');
  const okWys = got[0] === '<ol><li>甲</li></ol>' && got[1] === '<p>乙</p>'
    && got[2] === '<ol start="2"><li>丙</li></ol>';
  say('可视面 · 取消中间项 ⇒ 前段列表 / 段落 / 后段续号', okWys ? 'OK' : '!! ' + got.join(' | '));
  got.forEach(() => { const el = eRoot7.firstElementChild; if (el) el.parentNode.removeChild(el); });
} catch (e) { say('可视面 · 取消中间项', '!! THROW ' + e.message); }

console.log('== 列表项里 Tab / Shift+Tab ==');
/* 判据：**在容器里，Tab 干这个容器的活**（与"表格里 Tab 走格"同一条）——
   不接管的话 Tab 会把焦点移出编辑面（写着字突然脱手）。
   ⚠️ 反过来也验一条：**正文段落里按 Tab 不该被吃**（那才是"跳到下一个控件"）。 */
try {
  try { w.edSetMode('wys'); } catch (e) { /* 忽略 */ }
  const eRoot5 = d.getElementById('edPreview');
  const ol5 = d.createElement('ol');
  ol5.innerHTML = '<li class="rd-ind0">第一项</li>';
  eRoot5.insertBefore(ol5, eRoot5.firstChild);
  const li5 = ol5.querySelector('li');
  const put5 = (node, off) => {
    const r = d.createRange(); r.setStart(node, off); r.collapse(true);
    const s = w.getSelection(); if (s.removeAllRanges) s.removeAllRanges(); s.addRange(r);
  };
  put5(li5.firstChild, 1);
  const tab5 = (shift) => {
    const ev = new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: !!shift, bubbles: true, cancelable: true });
    w.edWysKeydown(ev);
    return ev.defaultPrevented;
  };
  const up5 = tab5(false);
  const m5 = /rd-ind(\d)/.exec(String(li5.className));
  const dn5 = tab5(true);
  const m6 = /rd-ind(\d)/.exec(String(li5.className));
  say('列表项里 Tab → 层级 +1（并阻止焦点跳走）',
    up5 && m5 && m5[1] === '1' ? 'OK' : '!! prevented=' + up5 + ' class=' + li5.className);
  say('Shift+Tab → 层级 -1（回到第 0 层）',
    dn5 && m6 && m6[1] === '0' ? 'OK' : '!! prevented=' + dn5 + ' class=' + li5.className);
  ol5.parentNode.removeChild(ol5);
  const p5 = d.createElement('p');
  p5.textContent = '正文一段';
  eRoot5.insertBefore(p5, eRoot5.firstChild);
  put5(p5.firstChild, 1);
  const pv = tab5(false);
  say('正文段落里按 Tab **不接管**（让它去跳控件）', pv ? '!! 被吃掉了' : 'OK');
  p5.parentNode.removeChild(p5);
} catch (e) { say('列表项里 Tab / Shift+Tab', '!! THROW ' + e.message); }

console.log('== 提示：五档下拉 ==');
/* 用户给的两张图：工具条上一颗三角图标，点开是五档（提醒 / 建议 / 重要 / 警告 / 注意）。
   判据落在三处 ——
     ① 五档的**中文名、key、菜单顺序**只有一个来源（`RD_NOTE`），菜单直接读它；
     ② 五档都要**写出去还能读回来**（`is-*` 类名 ⇄ `[!…]` 标记）：这是最容易漏的一处；
     ③ 页面上的提示块**不许有认不出的档位** —— 认不出会渲染成字面的 undefined 标签
        （改档位名时漏改示例数据就是这个症状，看着是一条"标签写着 undefined"的色块）。 */
try {
  try { w.edSetMode('wys'); } catch (e) { /* 忽略 */ }
  const box = d.getElementById('edPop-note');
  const items = box ? box.querySelectorAll('[data-note]') : [];
  const names = Array.prototype.map.call(items, (b) => String(b.textContent).trim());
  say('菜单 = 5 项且文案照截图', names.length === 5
    && names.join('/') === '提醒内容/建议内容/重要内容/警告内容/注意内容' ? 'OK' : '!! ' + names.join('/'));
  say('每项带自己的档位（左边那颗色点读它定色）',
    Array.prototype.every.call(items, (b) =>
      /^note:(info|tip|imp|danger|warn)$/.test(String(b.getAttribute('data-ed-pop-set') || ''))));
  say('主按钮 = 干默认那一档（点图标就插一条，不必先展开菜单）',
    !!(box && box.querySelector('.ed-tool[data-ed-tool="note"]')));
  const KINDS = ['info', 'tip', 'imp', 'danger', 'warn'];
  const CN = { info: '提醒', tip: '建议', imp: '重要', danger: '警告', warn: '注意' };
  const noteBad = [];
  const nb = d.createElement('div');
  KINDS.forEach((k) => {
    let cls = '', back = '';
    try {
      nb.innerHTML = w.rdBlockHtml({ t: 'note', kind: k, x: '正文' }, 0, true);
      const el = nb.firstElementChild;
      cls = String(el.className);
      back = w.mdBlockOf(el);
    } catch (e) { back = 'THROW ' + e.message; }
    if (cls.indexOf('is-' + k) < 0) noteBad.push(k + ' 的类名是 ' + cls);
    if (back !== '> [!' + CN[k] + '] 正文') noteBad.push(k + ' 回读成 ' + JSON.stringify(back));
  });
  say('五档 · 渲染出的类名与回读出的标记都对', noteBad.length ? '!! ' + noteBad.join(' | ') : 'OK');
  /* —— 告警卡的**结构**（v8.36 照用户给的截图重做）——
     一张卡分两行：上一行"图标 + 档名"（装饰，`contenteditable="false"`）、下一行正文。
     三条都要验，因为第 ② 条坏起来是**静默**的：正文取错元素 ⇒ 每存一次正文前面多一个档名。 */
  const cardBad = [];
  const cb = d.createElement('div');
  KINDS.forEach((k) => {
    cb.innerHTML = w.rdBlockHtml({ t: 'note', kind: k, x: '正文' }, 0, true);
    const el = cb.firstElementChild;
    const head = el.querySelector('.rd-note-head');
    const body = el.querySelector('.rd-note-body');
    if (!head || !body) { cardBad.push(k + ' 缺 head/body'); return; }
    if (head.getAttribute('contenteditable') !== 'false') cardBad.push(k + ' 的档名行可编辑（改了存不下来）');
    const svg = head.querySelector('svg');
    if (!svg || !String(svg.innerHTML).trim()) cardBad.push(k + ' 没有图标（`RD_NOTE_ICO` 与 `icons` 对不上）');
    const back = w.mdBlockOf(el);
    if (back !== '> [!' + CN[k] + '] 正文') cardBad.push(k + ' 回读成 ' + JSON.stringify(back));
  });
  say('五档 · 卡结构（图标 + 不可编辑的档名行 + 正文行）', cardBad.length ? '!! ' + cardBad.join(' | ') : 'OK');
  /* 卡里按 Enter = 换行（插 `<br>`），不是拆块 —— 不接管的话浏览器自造一层 `<div>`，
     而序列化只认 `.rd-note-body` ⇒ **多出来的那层悄悄丢掉**（写了几行、存下来只剩一行）。 */
  try {
    const eRootC = d.getElementById('edPreview');
    const card = d.createElement('div');
    card.className = 'rd-note is-danger';
    card.innerHTML = '<div class="rd-note-head" contenteditable="false">' + w.iconSvg('alert')
      + '<b>警告</b></div><div class="rd-note-body">甲乙丙</div>';
    eRootC.insertBefore(card, eRootC.firstChild);
    const cbBody = card.querySelector('.rd-note-body');
    const rc = d.createRange();
    rc.setStart(cbBody.firstChild, 2);
    rc.collapse(true);
    const sc = w.getSelection();
    if (sc.removeAllRanges) sc.removeAllRanges();
    sc.addRange(rc);
    const evC = new w.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    w.edWysKeydown(evC);
    const inner = String(cbBody.innerHTML);
    const backC = w.mdBlockOf(card);
    say('卡里 Enter → 插 `<br>`（不是拆块）且在正文里', evC.defaultPrevented && inner.indexOf('<br>') > 0
      ? 'OK' : '!! prevented=' + evC.defaultPrevented + ' inner=' + JSON.stringify(inner));
    say('…且 **回读不含档名**（新结构最容易漏的一条）',
      backC === '> [!警告] 甲乙<br>丙' ? 'OK' : '!! ' + JSON.stringify(backC));
    card.parentNode.removeChild(card);
  } catch (e) { say('卡里 Enter → 插 <br>', '!! THROW ' + e.message); }
  const eRootN = d.getElementById('edPreview');
  const nodes = eRootN ? eRootN.querySelectorAll('.rd-note') : [];
  const badKind = Array.prototype.filter.call(nodes, (n) =>
    !/is-(?:info|tip|imp|danger|warn)(?:\s|$)/.test(String(n.className))
      || String((n.querySelector('b') || {}).textContent || '') === 'undefined').length;
  say('当前这篇上 ' + nodes.length + ' 条提示 · 档位都认得出（没有 undefined 标签）',
    badKind ? '!! ' + badKind + ' 条认不出' : 'OK');
  /* ⚠️ 真正要验的是**整个文件里的示例数据**（不只当前打开的这一篇）：
     换档位名时漏改某一条的 `kind`，那一条会渲染成"标签写着 undefined"的色块 ——
     而它可能不在默认打开的那一篇里，光看页面看不出来。 */
  const keys = Array.prototype.map.call(items, (b) => String(b.getAttribute('data-ed-pop-set') || '').replace('note:', ''));
  const poolKinds = (html.match(/t: 'note', kind: '([a-z]+)'/g) || [])
    .map((s) => (/'([a-z]+)'\s*$/.exec(s) || [])[1]);
  const poolBad = poolKinds.filter((k) => keys.indexOf(k) < 0);
  say('示例数据里 ' + poolKinds.length + ' 条提示 · kind 都在五档内',
    poolBad.length ? '!! 认不出：' + poolBad.join(',') : 'OK');
} catch (e) { say('提示五档', '!! THROW ' + e.message); }

console.log('== 工具条：四颗带箭头的下拉 ==');
/* 判据（用户给的那张工具条截图）：有序列表 / 缩进 / 行高 / 提示 四颗 = **主按钮 + 箭头**两半 ——
   主按钮干活、箭头展开菜单；**无序列表那颗没有箭头**（它没有"样式"可选）。 */
const tbEl = d.querySelector('.ed-toolbar');
if (tbEl) {
  const splits = tbEl.querySelectorAll('.ed-pop-split');
  say('带箭头的下拉颗数（有序 / 缩进 / 行高 / 提示）', splits.length);
  say('分别是', Array.prototype.map.call(splits, (el) => el.id).join(', '));
  say('每颗都是「主按钮 + 箭头」两半（两个真 button）',
    Array.prototype.every.call(splits, (el) =>
      !!el.querySelector('.ed-tool[data-ed-tool]') && !!el.querySelector('.ed-pop-btn[data-ed-pop]')));
  say('有序列表菜单 = 3 张编号卡片', tbEl.querySelectorAll('#edPop-ol .ed-pop-card').length);
  say('行高菜单 = 7 档', tbEl.querySelectorAll('#edPop-lh [data-lh]').length);
  say('提示菜单 = 5 档', tbEl.querySelectorAll('#edPop-note [data-note]').length);
  /* ⚠️ 要限定在菜单里：主按钮**自己也带** `data-ed-tool`（它就是干活的），
     不限定就会把它数进去（3 而不是 2）*/
  say('缩进菜单 = 2 项', tbEl.querySelectorAll('#edPop-ind .ed-pop-menu [data-ed-tool]').length);
  say('无序列表那颗**不带**箭头', !(function () {
    const b = tbEl.querySelector('[data-ed-tool="ul"]');
    return !!(b && b.closest && b.closest('.ed-pop-split'));
  })());
} else say('工具条', '找不到（不在编辑态？）');

console.log('== 异常总数:', errs.length, '==');
errs.slice(0, 5).forEach((e) => console.log('  !', e.split('\n').slice(0, 2).join(' | ')));
