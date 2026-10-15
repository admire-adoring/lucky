/* 内容生成器（可反复跑）。⚠️ 扩展名必须是 `.cjs`：本仓上层的 package.json 里
 * `"type": "module"` ⇒ `.js` 会被当成 ESM，`require` 直接不可用。
 *
 * 内容生成器（可反复跑）：把"只能由脚本产出"的主内容，用**页面自己的模板函数**灌成静态标记。
 *
 * 为什么要它：预览面板走 `/static-html/<id>/xx.html` —— 静态 HTML 视图，脚本不跑。
 * 这一页的 Hero / 概览 / 项目 / 文档 / 文件位置全由脚本渲染，没有它整页只剩空壳。
 * ⚠️ 抽屉（`.pd-body`）**不在**灌入范围：它默认是关着的，静态视图里看不见，灌了也是死的。
 *
 * ⚠️ 不重写一份模板：从页面里**切出** ICON 表 / 数据段 / 那几个模板函数，用 `new Function`
 *    跑一遍就得到标记 ⇒ 静态那份与运行期重渲的那份永远出自同一个函数，不会走岔。
 * ⚠️ 每次 `.build-server-detail.py` 重建之后都要再跑一次（构建脚本会自己调）。
 */
const fs = require('fs');
global.window = { console: console };          // svgIcon 会读 window.console 打"未知图标"的警告
const PATH = process.argv[2];
if (!PATH) { console.error('用法: node ._seed-server-detail.cjs <页面路径>'); process.exit(2); }
let s = fs.readFileSync(PATH, 'utf8');

const HTML_END = s.indexOf('\n<script>\n');
if (HTML_END < 0) throw new Error('[seed] 找不到页尾脚本区');
let html = s.slice(0, HTML_END);
const tail = s.slice(HTML_END);

function between(from, to) {
    const a = html.indexOf(from) >= 0 ? html.indexOf(from) : tail.indexOf(from);
    const base = html.indexOf(from) >= 0 ? html : tail;
    const b = base.indexOf(to, a);
    if (a < 0) throw new Error('[seed] 起点没找到: ' + from);
    if (b < 0) throw new Error('[seed] 终点没找到: ' + to);
    return base.slice(a, b);
}

/* 按声明取一整块（花括号配平）——只取需要的函数，避免把 DOM 相关的代码一起 eval 进来 */
function takeFn(src, name) {
    let start = -1;
    for (const pat of ['\n    function ' + name, '\n    const ' + name, '\n    let ' + name]) {
        const i = src.indexOf(pat);
        if (i >= 0) { start = i + 1; break; }
    }
    if (start < 0) throw new Error('[seed] 找不到声明: ' + name);
    const semi = src.indexOf(';', start), brace = src.indexOf('{', start);
    if (semi >= 0 && (brace < 0 || semi < brace)) return src.slice(start, semi + 1);
    let depth = 1, k = brace + 1;
    while (k < src.length && depth) {
        if (src[k] === '{') depth++;
        else if (src[k] === '}') depth--;
        k++;
    }
    return src.slice(start, k);
}

/* ICON 表 + 数据段（两者之间只有 icons / svgIcon / iconSvg，全是纯函数） */
const ICON_DATA = between('    const ICON = {', '    let MODULES = buildModules();');
/* 小工具：fileKind / qs / KIND_TXT / roleLabelOf（到连接徽标那一段为止） */
const HELPERS = between('    /* 路径 → 文件 / 目录 / 二进制', '    function connHtml(host) {');

const NAMES = ['connHtml', 'LOG_PAGE', 'DEPLOY_PAGE', 'AUTH_TXT', 'escTxt', 'pathsOfProject',
    'PROJECT_DOCS', 'PROJECT_COLOR', 'docsOfMachine',
    'projChipsHtml', 'heroActsHtml', 'whatBodyHtml', 'projectCardsHtml', 'fpRowHtml',
    'pdBodyHtml', 'docBookHtml', 'docShelvesHtml',
    'railTree', 'routeMerge', 'railNodesHtml', 'railHtml', 'pageSections', 'countLeaves'];
const FN = NAMES.map(n => takeFn(tail, n)).join('\n');

const M = new Function(
    ICON_DATA + '\n' + HELPERS + '\n' + FN +
    '\n  return { ICON, svgIcon, SERVERS, PROJECT_META, projChipsHtml, heroActsHtml, whatBodyHtml,'
    + ' projectCardsHtml, docShelvesHtml, railHtml, pdBodyHtml, pageSections, roleLabelOf, escTxt };'
)();

/* 默认那一台 = SERVERS[0]（与页面里 MACHINE 的兜底**同一个取法**） */
const m = M.SERVERS[0];
const secs = M.pageSections(m);
const byKey = k => secs.find(x => x.key === k) || { count: '—' };

function sub(re, val, tag) {
    if (!re.test(html)) throw new Error('[seed] 占位符没找到: ' + tag);
    html = html.replace(re, val);
}

/* ① Hero：机器名 / 角色（图标名 + title）/ 环境标签 / 服务项目胶囊 / 动作行 */
sub(/<h1 class="hero-name" id="heroName">[^<]*<\/h1>/,
    '<h1 class="hero-name" id="heroName">' + m.host + '</h1>', 'heroName');
sub(/(<span class="hero-role" id="heroRole")[^>]*><\/span>/,
    '$1 title="' + M.roleLabelOf(m) + '" aria-label="' + M.roleLabelOf(m) + '"'
    + ' data-ico="' + (m.role === 'db' ? 'database' : 'server') + '" data-ico-size="15"></span>', 'heroRole');
sub(/<span class="hero-tag" id="heroTag">[^<]*<\/span>/,
    '<span class="hero-tag' + (m.env === '生产' ? '' : ' is-test') + '" id="heroTag">' + m.env + '</span>', 'heroTag');
sub(/<span class="sv-projs" id="heroProjs"><\/span>/,
    '<span class="sv-projs" id="heroProjs">' + M.projChipsHtml(m) + '</span>', 'heroProjs');
sub(/<div class="hero-bar-right" id="heroActs"><\/div>/,
    '<div class="hero-bar-right" id="heroActs">' + M.heroActsHtml(m) + '</div>', 'heroActs');

/* ② 四个区块的内容 + 段头计数 */
sub(/<span class="sec-count" id="cntWhat">[^<]*<\/span>/,
    '<span class="sec-count" id="cntWhat">' + byKey('what').count + '</span>', 'cntWhat');
sub(/<span class="sec-count" id="cntProjects">[^<]*<\/span>/,
    '<span class="sec-count" id="cntProjects">' + byKey('projects').count + '</span>', 'cntProjects');
sub(/<span class="sec-count" id="cntDocs">[^<]*<\/span>/,
    '<span class="sec-count" id="cntDocs">' + byKey('docs').count + '</span>', 'cntDocs');
sub(/<span class="sec-count" id="cntFiles">[^<]*<\/span>/,
    '<span class="sec-count" id="cntFiles">' + byKey('files').count + '</span>', 'cntFiles');
sub(/<div id="whatBody"><\/div>/, '<div id="whatBody">' + M.whatBodyHtml(m) + '</div>', 'whatBody');
/* ⚠️ 四个容器都写成**三段式**（开标签换行 → 内容 → 缩进收口）：
   内容本身就是逐行缩进的标记，若第一行还贴在 `>` 后面，diff 里那一行永远在变。 */
const PAD = '                    ';
sub(/<div class="pc-grid" id="pjBody"><\/div>/,
    '<div class="pc-grid" id="pjBody">\n' + M.projectCardsHtml(m) + '\n' + PAD + '</div>', 'pjBody');
sub(/<div id="dcBody"><\/div>/, '<div id="dcBody">\n' + M.docShelvesHtml(m) + '\n' + PAD + '</div>', 'dcBody');
sub(/<div id="fpBody"><\/div>/, '<div id="fpBody">\n' + M.railHtml(m) + '\n' + PAD + '</div>', 'fpBody');

/* ③ 图标：标记区里空着的 `data-ico` 容器一次灌满（用页面那一张表）。
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

fs.writeFileSync(PATH, html + tail);
console.log('[seed] %s · 图标 %d 个容器 · 项目 %d 个 · 文档 %d 篇 · 文件位置 %d 条',
    m.host, painted, m.projects.length,
    M.pageSections(m).find(x => x.key === 'docs').count.replace(' 篇', ''), m.paths.length);
