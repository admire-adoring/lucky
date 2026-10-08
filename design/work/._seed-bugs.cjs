/* 内容生成器（可反复跑）。⚠️ 扩展名必须是 `.cjs`：本仓上层的 package.json 里
 * `"type": "module"` ⇒ `.js` 会被当成 ESM，`require` 直接不可用。
 *
 * 为什么需要它：预览面板走 `/static-html/<id>/xx.html` —— **静态 HTML 视图，脚本不跑**。
 * 这一页的四张分组卡、每一条 Bug 的行、侧栏「最久」、仪表三格的值全是现算出来的，
 * 没有它静态视图里只剩一个空壳（而且"看不见"这件事不会报错）。
 *
 * ⚠️ 不重写一份模板：从页面里**切出** ICON 表 / GROUPS 表 / 数据段 / 渲染函数，
 *    用 `new Function` 跑一遍就得到标记 ⇒ 静态那份与运行期重渲的那份永远出自
 *    **同一个函数**，不会走岔。
 * ⚠️ 每次 `.build-bugs.py` 重建之后都要再跑一次（构建脚本会自己调）。
 */
const fs = require('fs');
global.window = { console: console };          // svgIcon 会读 window.console 打"未知图标"的警告
/* ⚠️ `bugRowHtml()` 会读 `promotedMap()` 判断"这条推过没推过" ⇒ node 里没有 localStorage，
   给一个空桩：静态那一份必然是**还没推过**的状态（推是运行期的动作）。 */
global.localStorage = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
const PATH = process.argv[2];
if (!PATH) { console.error('用法: node ._seed-bugs.cjs <页面路径>'); process.exit(2); }
let s = fs.readFileSync(PATH, 'utf8');

const HTML_END = s.indexOf('\n<script>\n');
if (HTML_END < 0) throw new Error('[seed] 找不到页尾脚本区');
let html = s.slice(0, HTML_END);
const tail = s.slice(HTML_END);

function between(from, to) {
    const inHtml = html.indexOf(from) >= 0;
    const base = inHtml ? html : tail;
    const a = base.indexOf(from);
    if (a < 0) throw new Error('[seed] 起点没找到: ' + from);
    const b = base.indexOf(to, a);
    if (b < 0) throw new Error('[seed] 终点没找到: ' + to);
    return base.slice(a, b);
}

/* ① ICON 表 + svgIcon（到 `const icons = {` 为止：那是导航圆盘用的另一张表，本页不需要） */
const ICON_DATA = between('    const ICON = {', '    const icons = {');
/* ② 分区表：连 `const SECTIONS = GROUPS;` 一起切（渲染函数只读 GROUPS） */
const GROUPS_SRC = between('    const GROUPS = [', '    const MODULES = [');
/* ③ 数据 + 取数 + 渲染（到「交互」那一节为止 —— 交互要碰 DOM，不 eval） */
const CONTENT = between('    const SEV = {', '    /* ============ 交互 ============ */');

const M = new Function(
    ICON_DATA + '\n' + GROUPS_SRC + '\n' + CONTENT +
    '\n  return { ICON, svgIcon, GROUPS, SEV, BUGS, countOf, groupNote, kpiValues, groupsHtml, staleHtml };'
)();

/* 每行加前缀（空行不加）—— 灌进去的那一段要是逐行缩进的，
   否则 diff 里整块会跟着上一次的缩进一起飘。 */
function indent(text, pad) {
    return text.split('\n').map(l => (l.trim() ? pad + l : l)).join('\n');
}

function sub(re, val, tag) {
    if (!re.test(html)) throw new Error('[seed] 占位符没找到: ' + tag);
    html = html.replace(re, val);
}

/* 只换某个元素里的**文字**（用函数式替换，值里带 `$` 也不会被当成反向引用） */
function setText(re, val, tag) {
    if (!re.test(html)) throw new Error('[seed] 占位符没找到: ' + tag);
    html = html.replace(re, (all, a, b) => a + val + b);
}

/* ① 四张分组卡：由 `groupsHtml()` 整块产出（空组不会出现 —— 这里是现算的） */
sub(/<div id="bugGroups"><\/div>/,
    '<div id="bugGroups">\n' + indent(M.groupsHtml(), '                ') + '\n            </div>',
    'bugGroups');

/* ② 侧栏「最久」 */
sub(/(<div class="slot-panel active" data-panel="recent" id="slotStale">)<\/div>/,
    '$1\n' + indent(M.staleHtml(), '                        ') + '\n                    </div>',
    'slotStale');

/* ③ 仪表三格 + Tab 计数 + 侧栏副标题（三处读的是**同一个** kpiValues()/countOf()） */
const v = M.kpiValues();
setText(/(<div class="kpi-val bug-kpival" id="kpiFirstVal">)[^<]*(<\/div>)/, v.firstVal, 'kpiFirstVal');
setText(/(<div class="kpi-sub" id="kpiFirstSub">)[^<]*(<\/div>)/, v.firstSub, 'kpiFirstSub');
setText(/(<div class="kpi-val" id="kpiOwnVal">)[^<]*(<\/div>)/, v.ownVal, 'kpiOwnVal');
setText(/(<div class="kpi-sub" id="kpiOwnSub">)[^<]*(<\/div>)/, v.ownSub, 'kpiOwnSub');
setText(/(<div class="kpi-val" id="kpiReopenVal">)[^<]*(<\/div>)/, v.reopenVal, 'kpiReopenVal');
setText(/(<div class="kpi-sub" id="kpiReopenSub">)[^<]*(<\/div>)/, v.reopenSub, 'kpiReopenSub');
setText(/(<span class="tab-count" id="tabBugCount">)[^<]*(<\/span>)/, String(M.BUGS.length), 'tabBugCount');
/* ⚠️ 副标题的取法与运行期**同一条**（syncChrome 里那句 `sec.label + ' · ' + count`），
      静态这份写死一个别的值，翻到这一页就会先看到一秒钟的假数。 */
setText(/(<div class="sidebar-subtitle" id="sidebarSubtitle">)[^<]*(<\/div>)/,
    M.GROUPS[0].label + ' · ' + M.countOf(M.GROUPS[0].key) + ' 条', 'sidebarSubtitle');

/* ④ 图标：标记区里空着的 `data-ico` 容器一次灌满（用页面那一张表）。
      ⚠️ **只在脚本区之前做** —— 脚本里也有 `data-ico="${…}"` 的模板源码。 */
let painted = 0;
const unknown = new Set();
html = html.replace(/<([a-z]+)([^>]*?)\sdata-ico="([^"]+)"([^>]*?)>\s*<\/\1>/g, function (all, tag, a, name, c) {
    if (!(name in M.ICON)) unknown.add(name);
    const mm = /data-ico-size="(\d+)"/.exec(a + c);
    painted++;
    return '<' + tag + a + ' data-ico="' + name + '"' + c + '>' + M.svgIcon(name, mm ? +mm[1] : 16) + '</' + tag + '>';
});
if (unknown.size) throw new Error('[seed] 图标名不在表里：' + [...unknown].join(', '));
if (/data-ico="[^"]*\$/.test(html)) throw new Error('[seed] 标记区里还有未展开的 data-ico 插值');

/* ⚠️ 分区的条数必须和灌进去的行数对得上 —— 这两处走的是两个函数
      （countOf 与 groupsHtml 里的 filter），错了不会报错，只会少一行。 */
const rowsInHtml = (html.match(/class="bug-row /g) || []).length;
if (rowsInHtml !== M.BUGS.length) {
    throw new Error('[seed] 分区分到的行数与 BUGS 对不上：' + rowsInHtml + ' vs ' + M.BUGS.length);
}

fs.writeFileSync(PATH, html + tail);
console.log('[seed] %d 条 · %d 个分组 · 图标 %d 个容器（未识别 %d）',
    M.BUGS.length, M.GROUPS.filter(g => M.countOf(g.key)).length, painted, unknown.size);
