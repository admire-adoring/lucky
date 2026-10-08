# -*- coding: utf-8 -*-
"""`工作-项目-项目详情-Bug-index.html` 的静态探针（无渲染、无测试框架）。

九条通用自检 + 本页的结构断言。用法：
    python3 ._probe-bugs.py [页面路径]
"""
import io, re, os, subprocess, tempfile, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, '工作-项目-项目详情-Bug-index.html')
NODE = ('/Users/yangliu/Library/Application Support/Parall/WorkBuddy(Parall_3)'
        '/.workbuddy/binaries/node/versions/22.22.2-3/bin/node')
s = io.open(OUT, encoding='utf-8').read()
markup = s.split('<body>', 1)[1].split('<script>', 1)[0]   # ⚠️ 从 <body> 起：<style> 的注释里也有标签字面量
js = s.split('<script>', 1)[1].rsplit('</script>', 1)[0]

fail = []
def ok(msg): print('  ok   ' + msg)
def bad(msg):
    print('  FAIL ' + msg); fail.append(msg)
def check(cond, good, err):
    (ok if cond else bad)(good if cond else err)


print('== 1. CSS 大括号配平 ==')
css = s.split('<style>', 1)[1].split('</style>', 1)[0]
o, c = css.count('{'), css.count('}')
check(o == c, '大括号 %d / %d' % (o, c), '大括号不配平：%d / %d' % (o, c))
css_nc = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
check('@media' in css, '@media 段在', '@media 段丢了（响应式没了）')

print('== 2. 令牌双向差集（只查裸 var(--x)）==')
declared = set(re.findall(r'(--[\w-]+)\s*:', s))
used = set(re.findall(r'var\(\s*(--[\w-]+)\s*\)', s))          # ⚠️ 只认**裸** var：var(--x, 兜底) 是"显式声明可以没有定义"
SLOT = {'--a', '--i', '--r', '--icon', '--dial', '--arcs', '--na', '--cols', '--dc', '--tone', '--sev'}
miss = sorted(m for m in used - declared if m not in SLOT)
unused = sorted(m for m in declared - used if m not in SLOT)
check(not miss, '用了没声明：无', '用了没声明：' + ', '.join(miss))
check(not unused, '声明了没人用：无', '声明了没人用：' + ', '.join(unused[:40]))

print('== 3. <body> → <script> 逐行累计 div 深度 ==')
d, low = 0, None
for i, ln in enumerate(markup.split('\n'), 1):
    d += len(re.findall(r'<div\b', ln)) - len(re.findall(r'</div>', ln))
    if d < 0 and low is None: low = (i, ln.strip()[:70])
check(d == 0 and low is None, 'div 终值 0，中途未为负',
      'div 深度不对：终值 %d，首次为负 %s' % (d, low))
for tag in ('section', 'main', 'aside', 'h2', 'nav', 'button', 'span', 'a', 'ol', 'li'):
    op = len(re.findall(r'<%s\b' % tag, markup))
    cl = len(re.findall(r'</%s>' % tag, markup))
    check(op == cl, '%s %d/%d' % (tag, op, cl), '%s 开合不等：%d / %d' % (tag, op, cl))

print('== 3b. 内容区的层级：卡必须在 .detail 里，中间层必须自带 gap ==')
# ⚠️ 这两条查的是同一类错：**整段替换时"新块含到哪一层"判错** ——
#    区间不该含外层闭合却抄了 ⇒ 容器提前关一层，后面的块掉出去（块级之间没有默认间距）；
#    区间含了外层闭合却没补 ⇒ 外层永远不关，后一块被吞进前一块里。
#    两者的症状都是"卡片贴卡片 / 侧栏错位"，而**净深度那一条抓不全**（多一开一闭会互相抵消）。
_mc = re.sub(r'<!--.*?-->', '', markup, flags=re.S)


def _depth_before(needle):
    seg = _mc[:_mc.index(needle)]
    return len(re.findall(r'<div\b', seg)) - len(re.findall(r'</div>', seg))


_d = _depth_before('<div class="detail">')
check(_depth_before('<div class="kpi-bar">') == _d + 1,
      '仪表条在 .detail 内（深度 %d）' % (_d + 1),
      '仪表条掉到 .detail 外面了（深度 %d，应 %d）⇒ 它会与上面的 Tab 条贴住'
      % (_depth_before('<div class="kpi-bar">'), _d + 1))
check(_depth_before('<div id="bugGroups">') == _d + 1,
      '分组容器在 .detail 内（深度 %d）' % (_d + 1),
      '分组容器掉到 .detail 外面了（深度 %d，应 %d）⇒ 卡片会贴在一起'
      % (_depth_before('<div id="bugGroups">'), _d + 1))

# 中间层一进来就**隔断**了 `.detail` 的 gap（那个 gap 只作用在直接孩子上）⇒
# 它必须自己补一档，且**值跟 `.detail` 走**（两处各写各的迟早走散）。
_g_detail = re.findall(r'\.detail\s*\{[^}]*?gap:\s*(\d+)px', css)
_g_groups = re.findall(r'#bugGroups\s*\{[^}]*?gap:\s*(\d+)px', css)
check(bool(_g_groups),
      '分组容器自带 gap（%s px）' % (_g_groups[0] if _g_groups else '?'),
      '分组容器没有 gap ⇒ 三张卡会贴在一起（用户原话「都已经卡片贴卡片」）')
check(_g_groups and _g_detail and _g_groups[0] == _g_detail[0],
      '分组容器的 gap 与 .detail 同档（%s px）' % (_g_groups[0] if _g_groups else '?'),
      '两处 gap 不一致：.detail %s / #bugGroups %s' % (_g_detail, _g_groups))
check(len(_g_groups) >= 2,
      '窄屏那一档也跟了（%d 处声明）' % len(_g_groups),
      '#bugGroups 只在主档写了 gap，窄屏断点里没跟着收 ⇒ 窄屏间距会变大')

print('== 3c. 维护：抽屉 / 表单 / 删除 ==')
# 这一组全是"点了没反应"和"两处走散"的防御。判据都写成可机械执行的：
#   ⚠️ 表单字段少一个 ⇒ JS 里那行 `getElementById(...).value` **直接抛**，
#      而抛在事件回调里 = 界面看着正常、按了没反应、控制台才有。
NEED_FIELDS = ['bfName', 'bfSev', 'bfState', 'bfMod', 'bfOwn', 'bfSrc', 'bfSteps', 'bfEnv',
               'bfSave', 'bfIdLine', 'bfHead', 'bfSub']
_miss = [i for i in NEED_FIELDS if ('id="%s"' % i) not in markup]
check(not _miss, '抽屉的 %d 个字段都在' % len(NEED_FIELDS), '抽屉缺字段：' + ', '.join(_miss))

NEED_FNS = ['openBugForm', 'closeBugForm', 'saveBugForm', 'syncBugForm', 'askRemoveBug', 'removeBug',
            'openConfirm', 'closeModal', 'pickChip', 'setChips', 'chipVal', 'copySteps',
            'syncPromoted', 'orphanPromoted', 'listOf', 'paintRow', 'moveRow', 'rebuildRow',
            'addRow', 'removeRow', 'nextBugId', 'fillDatalists', 'formValue']
_miss = [f for f in NEED_FNS if ('function ' + f) not in js]
check(not _miss, '维护链路的 %d 个函数都有定义' % len(NEED_FNS),
      '缺定义（症状=点了什么都不发生）：' + ', '.join(_miss))

_miss = [i for i in ['modalMask', 'modalTitle', 'modalBody', 'modalConfirm', 'modalCancel']
         if ('id="%s"' % i) not in markup]
check(not _miss, '二次确认弹窗的五个锚点都在', '弹窗缺锚点：' + ', '.join(_miss))

# ⚠️ 选项胶囊的取值必须与**常量表同源**：静态写死是为了预览面板能看，
#    代价就是要有这条断言盯着它别和 SEV / GROUPS / SRC 走散。
def _obj_keys(name):
    i = js.index('const %s = {' % name)
    return set(re.findall(r"^\s*([a-z]+):", js[i:js.index('\n    };', i)], re.M))

_g = js.index('const GROUPS = [')
_group_keys = set(re.findall(r"key: '([a-z]+)'", js[_g:js.index('    ];', _g)]))


def _chip_keys(box):
    # ⚠️ 抓到**该 chip-row 自己的闭合 `</div>`** 为止，不能按固定窗口长度截 ——
    #    严重度与状态是并排的两组，窗口一长就会把下一组的 data-v 一起收进来
    #    （假阳性：报"和常量表走散了"，其实只是探针自己多抓了）。
    #    判据能这么做的前提：`.chip-row` 里只放 `<button>`，没有嵌套 div。
    i = markup.index('id="%s"' % box)
    return set(re.findall(r'data-v="([^"]+)"', markup[i:markup.index('</div>', i)]))


check(_chip_keys('bfSev') == _obj_keys('SEV'),
      '严重度胶囊 = SEV 的 key（%d 档）' % len(_obj_keys('SEV')),
      '严重度胶囊与 SEV 走散了：%r vs %r' % (_chip_keys('bfSev'), _obj_keys('SEV')))
check(_chip_keys('bfState') == _group_keys,
      '状态胶囊 = GROUPS 的 key（%d 档）' % len(_group_keys),
      '状态胶囊与 GROUPS 走散了：%r vs %r' % (_chip_keys('bfState'), _group_keys))
check(_chip_keys('bfSrc') == _obj_keys('SRC'),
      '来源胶囊 = SRC 的 key（%d 档）' % len(_obj_keys('SRC')),
      '来源胶囊与 SRC 走散了：%r vs %r' % (_chip_keys('bfSrc'), _obj_keys('SRC')))

# 编号是**系统给的**：只回显，不许出现输入框（判据：系统已知的值不许手填）
check(re.search(r'id="bfIdLine"', markup) and not re.search(r'<input[^>]*id="bfIdLine"', markup),
      '编号只做回显（不是输入框）', '编号变成了可以手填的输入框')

# 两个"默认关着"的容器：静态那一份必须关着，且都写了 display ⇒ 必须补 [hidden] 兜底
check(re.search(r'<div class="bug-drawer" id="bugDrawer" hidden>', markup), '抽屉默认关着', '抽屉静态是开着的（预览里会挡住页面）')
check(re.search(r'<div class="bug-empty" id="bugEmpty" hidden>', markup), '页面级空态默认关着', '空态静态是开着的')
check('.bug-drawer[hidden]' in css and '.bug-empty[hidden]' in css,
      '两个容器的 [hidden] 兜底规则都在（它们都写了 display）',
      '[hidden] 兜底缺一条 ⇒ 元素藏不住（作者样式里的 display 会盖掉它）')
check('textarea class="inp mono" id="bfSteps"' in markup,
      '复现步骤是 textarea（一行一步）', '复现步骤不是 textarea')

# 展开区三枚动作：取值集合与 JS 分支必须一一对上
_acts = set(re.findall(r'data-bug-act="([a-z]+)"', markup))
check(_acts == {'edit', 'copy', 'del'}, '展开区三枚动作 = 编辑 / 复制步骤 / 删除', '动作集合变了：%r' % sorted(_acts))
check(all(("k === '" + k + "'") in js for k in ('edit', 'del', 'copy')),
      '三枚动作在委托里都有分支', '有动作没有分支（点了什么都不发生）')

check('.btn-danger {' in css and '.modal-warn {' in css,
      '危险按钮与"影响"提示都有样式', '危险按钮或影响提示没样式（删除确认会变成素按钮）')

# 新增的落位：数据与 DOM 必须**同一个顺序**（都插最前），否则整组重渲之后会换位置
check('BUGS.unshift(b)' in js and 'dest.insertBefore(tmp.firstChild, dest.firstChild)' in js,
      '新增的落位：数据与 DOM 都插在最前', '新增的落位两处不一致 ⇒ 重渲之后那一条会跳位置')

# 会变的值必须并进唯一的 sync（否则删/改之后停在旧值）
check("stale.innerHTML = staleHtml()" in js, '侧栏「最久」并进了 sync', '侧栏「最久」只在首屏灌一次 ⇒ 删/改之后是旧值')
check('empty.hidden = BUGS.length > 0' in js, '页面级空态并进了 sync', '页面级空态没跟着数据走')

# 删除之后任务列表那一条要标 orphan（否则任务页留一个指向空处的死链）
check('orphanPromoted' in js and 'e.orphan = true' in js,
      '删除会给已推送的任务标 orphan', '删除没有处理跨页的反向链接 ⇒ 任务页会留死链')

print('== 3d. 入口的发现性（"我要怎么新增一条"这一问的答案）==')
# 判据：**这一页唯一的高频写动作必须常驻**，不许只藏在二级入口（侧栏「快捷」那格
# ⚠️ 常驻入口的位置判据：**动作要和它作用的范围在一起** ——
#    Hero 那一排是项目级的（编辑项目 / 重新检查 / 进度 / 截止），
#    而「报告 Bug」动的是本分区的清单 ⇒ 它跟 Tab 条走（`.bug-toolbar` 就是 Tab 条下面那一行）。
_tb = markup[markup.index('class="bug-toolbar"'):markup.index('class="kpi-bar"')]
check('onclick="openBugForm()"' in _tb, 'Tab 条下面有常驻的「报告 Bug」',
      '分区工具行里没有新增入口（又藏起来了）')
_hb = markup[markup.index('hero-bar-right'):markup.index('id="moreMenu"')]
check('openBugForm' not in _hb, 'Hero 那一排只放项目级动作',
      'Hero 里混进了本分区动作 ⇒ 读者分不清它动的是项目还是这一页')
# 两枚同名按钮要消歧：Hero 那枚是**编辑项目**，行展开区那枚是**编辑**（这一条 Bug）
check('>编辑项目</button>' in markup, 'Hero 那枚写成「编辑项目」（与行内的「编辑」区分）',
      'Hero 那枚还叫「编辑」⇒ 和行内"编辑这条 Bug"同名不同层级，读者会当成同一个')

# ⌘K 面板：**每一条都要有去处** —— 没有 data-goto 的条目点了什么都不发生。
# ⚠️ 逐行取，别用 `<div class="cmd-item[^"]*"` 那种前缀正则：`.cmd-item-icon` / `.cmd-item-text`
#    也以 `cmd-item` 开头 ⇒ 会把子元素一起当成"条目"，报出一堆假阳性的"没有 data-goto"。
_cmd_rows = [l for l in markup.split('\n') if '<div class="cmd-item' in l and 'cmd-item-text' in l]
_nogoto = [l for l in _cmd_rows if 'data-goto=' not in l]
check(_cmd_rows and not _nogoto, '命令面板 %d 条都有去处' % len(_cmd_rows),
      '有 %d 条没有 data-goto（点了没反应）' % len(_nogoto))

# 提示写了键位就得真能按：形式统一成 "G + 一个键"，且 JS 里有这条序列的实现
_kbds = [re.search(r'cmd-kbd">([^<]+)<', l).group(1).strip()
         for l in _cmd_rows if 'cmd-kbd' in l]
check(_kbds and all(re.fullmatch(r'G \S', k) for k in _kbds),
      '键位提示统一成 "G + 键"（%d 条：%s）' % (len(_kbds), ' '.join(sorted(_kbds))),
      '键位提示形式不一（%r）⇒ 一条序列规则兑现不了' % sorted(_kbds))
check("=== 'G ' + k" in js and 'cmdG' in js,
      '键位提示有实现（面板里 ↑↓ / Enter / "G + 键"）',
      '写了键位却没有实现 ⇒ 承诺落空（比不写更坏）')
# ⚠️ 键位**不许撞**：两条同键时后一条永远按不出来（而提示照样写着，等于承诺落空）
_dup = sorted(k for k in set(_kbds) if _kbds.count(k) > 1)
check(not _dup, '键位两两不同（%d 条）' % len(_kbds), '键位撞了：' + ', '.join(_dup))

# 输入框承诺了"或输入命令" ⇒ 过滤要实现，且 `[hidden]` 要能真的藏住（`.cmd-item` 写了 display）
check("cmdInput.addEventListener('input'" in js, '命令面板的输入框有过滤实现',
      'placeholder 写着"输入命令"却没有过滤 ⇒ 那三个字是空话')
check('.cmd-item[hidden]' in css, '条目的 [hidden] 兜底规则在',
      '.cmd-item 自己写了 display ⇒ 少了这条，过滤"看着没反应"')

print('== 3e. 录入成本（"方便记录"这一问）==')
# 判据：一条记录的录入成本必须接近"打一句话"。快速通道 + 表单两条路都要在。
_tb = markup[markup.index('class="bug-toolbar"'):markup.index('class="kpi-bar"')]
check('id="quickName"' in _tb and 'quickAddBug()' in _tb,
      '工具栏里有"一句话记录"的主路径', '工具栏里没有快速记录（只剩一条要填 8 格的表单）')
check('回车' in _tb, '输入框自己说了"回车就记下来"', '快速记录的输入框没告诉人怎么提交')
check('function quickAddBug' in js, 'quickAddBug 有定义（点了没反应的另一半）', '缺 quickAddBug')

# 必填降到**只有标题**：复现步骤是"建议"，但不许悄悄消失
check('missSteps' not in js, '必填只剩标题（复现步骤降成建议）',
      '复现步骤还是必填 ⇒ 随手记一条会被表单拦下（代价是人干脆不记了）')
check('if (!v.title) { syncBugForm(); return; }' in js, '保存的兜底判据也只认标题', '保存仍要求步骤')
check('还没写复现步骤' in js and "data-bug-act=\"edit\"" in js,
      '缺复现步骤时清单上标出来并给一枚「补上」',
      '缺步骤之后没有任何提示 ⇒ "允许不填"退化成"忘了也没人知道"')
check("(b && !(b.steps || []).length) ? 'bfSteps' : 'bfName'" in js,
      '打开编辑时焦点落在**缺的那一格**（缺步骤 ⇒ 落步骤框）',
      '焦点固定落标题 ⇒ 点「补上」进来还要自己找那一格')

# 不填的留空、不猜默认值
check("const src = SRC[b.src] || null;" in js and "QUICK_DEFAULTS.src" not in js,
      '来源不兜底（"没记来源" ≠ "来源是测试发现"）',
      '来源被兜底成"测试发现" ⇒ 清单替人下了结论')
check("bug-own is-none" in js, '负责人空 ⇒ 写"未指派"（它是待办，不是没这个字段）', '负责人为空时没有任何交代')

# 键盘流也要能记：⌘K 搜不到 → 新建
check('id="cmdNew"' in markup and 'data-goto="new:quick"' in markup,
      '⌘K 里有"搜不到就新建"的条目', '⌘K 只能跳转，不能记东西')
check(re.search(r'<div class="cmd-item" id="cmdNew"[^>]*hidden>', markup) is not None,
      '那条新建条目默认关着（静态里不该冒出来）', '新建条目静态可见 ⇒ 空着的一句话会显示在面板里')
# ⚠️ 分两件事查：`new:quick` 是**标记**里的 data-goto，JS 里对应的是 `key === 'quick'` ——
#    把两者串成一个 and 会永远失败（js 里本来就没有那个字面量）。
check('function openBugFormWithTitle' in js and "key === 'quick'" in js and 'openBugFormWithTitle(typed)' in js,
      '新建会把打进去的那句话带进表单', '缺 openBugFormWithTitle 或分派没接上（点了会新建出空标题）')
# ⚠️ 抓文本必须在 closeCmd() 之前 —— 它会清空输入框
check('const typed =' in js and js.index('const typed =') < js.index('closeCmd();', js.index('const typed =') - 200) + 200,
      '打进去的文本在 closeCmd() 之前抓下来', '读输入框的时机在 closeCmd 之后 ⇒ 永远是空标题')

# ⚠️ 过滤之后键盘只能走可见项（否则 ↑↓ 停在隐藏项上、回车执行它）
check('function cmdVisible' in js and 'const items = cmdVisible();' in js,
      '键盘只走看得见的条目', '键盘遍历全量列表 ⇒ 过滤后回车会执行一条看不见的条目')

print('== 4. 类名双向差集（CSS vs 标记/脚本）==')
css_classes = set(re.findall(r'\.([A-Za-z][\w-]*)', css_nc))

def toks(txt):
    txt = re.sub(r'\$\{[^}]*\}', ' ', txt)
    return [t for t in re.split(r'[\s\'"+,?:()={}<>;]+', txt) if re.fullmatch(r'[a-z][\w-]*', t)]

dom = set()
for m in re.findall(r'class="([^"]*)"', s):
    dom.update(toks(m))
    for inner in re.findall(r"\$\{[^}]*\}", m):
        for lit in re.findall(r"['\"]([^'\"]*)['\"]", inner):
            dom.update(toks(lit))
for m in re.findall(r'className\s*=\s*[\'"]([^\'"]*)[\'"]', s):
    dom.update(toks(m))
for m in re.findall(r'classList\.(?:add|remove|toggle|contains)\(\s*[\'"]([\w-]+)[\'"]', s):
    dom.add(m)
for lit in re.findall(r"['\"]([^'\"\n]{1,80})['\"]", s):
    for t in toks(lit):
        if t in css_classes:
            dom.add(t)

# 标记里读得出来、**故意没有 CSS 规则**的钩子（别为了让探针闭嘴给它编一条不生效的规则）
NO_CSS_OK = {
    # `is-flash` 有规则（含在 @keyframes 同族里），这里列的是纯钩子
    'bug-row',           # 只在选择器里以 `.bug-row` 出现 ✓ 不是孤儿
}
STATE_OK = {'dark', 'active', 'open', 'on', 'is-open', 'is-closed',
            # 运行期由导航壳加的动画/布局类（`classList.add('enter-from-center' + ' strong')` 这种拼接
            # 抓不到字面量，只能白名单）
            'enter-from-center-strong', 'is-nested', 'is-over',
            # ⚠️ `rail__back` / `sr-only` 是**源页既存的孤儿**（账户页也一样只有声明没有消费者）：
            #    它们属于导航壳那一族，删掉会让本页与源页的壳偏离 —— 留着，并在下一页继承时一起清。
            'rail__back', 'sr-only',
            'is-fatal', 'is-major', 'is-minor', 'is-trivial', 'is-flash', 'is-reopened',
            'bug-kpival', 'slot-empty', 'warn', 'ok', 'danger', 'info'}
css_only = sorted(c for c in css_classes - dom if not c.isdigit() and c not in STATE_OK)
dom_static = set()
for m in re.findall(r'class="([^"+]*)"', s):
    dom_static.update(toks(m))
dom_only = sorted(t for t in dom_static - css_classes - NO_CSS_OK)
check(not css_only, 'CSS 有、标记/脚本没有：无（孤儿样式 0）', '孤儿样式：' + ', '.join(css_only[:40]))
check(not dom_only, '标记/脚本有、CSS 没有：无', '标记有 CSS 没有：' + ', '.join(dom_only[:40]))

print('== 5. JS 语法（node --check）==')
tf = tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8')
tf.write(js); tf.close()
node = NODE if os.path.exists(NODE) else 'node'
r = subprocess.run([node, '--check', tf.name], capture_output=True, text=True)
check(r.returncode == 0, 'node --check 通过',
      'node --check rc=%d %s' % (r.returncode, r.stderr.strip()[:300]))
os.unlink(tf.name)

print('== 6. 块注释开合 + 关键声明没被吞掉 ==')
def strip_block_comments(t):
    """只摘掉块注释。
       ⚠️ 块注释没收尾（写完 `/*` 却用 HTML 注释的 `-->` 去结）会把后面整段代码吃进注释，
          而 `node --check`、div 深度、令牌/类名差集**全都通过** ——
          只有"名字还在不在代码里"查得出来。"""
    opens = [m.start() for m in re.finditer(r'/\*', t)]
    closes = [m.start() for m in re.finditer(r'\*/', t)]
    if len(opens) != len(closes):
        return None, '块注释开合不等：%d 个 /* · %d 个 */' % (len(opens), len(closes))
    spans, i, j = [], 0, 0
    while i < len(opens) and j < len(closes):
        if closes[j] < opens[i]:
            return None, '存在没有开头的块注释收尾（位置 %d）' % closes[j]
        spans.append((opens[i], closes[j] + 2)); i += 1; j += 1
    out, last = [], 0
    for a, b in spans:
        out.append(t[last:a]); last = b
    out.append(t[last:])
    return ''.join(out), None

code, err = strip_block_comments(js)
if err:
    bad(err)
else:
    ok('块注释 %d 对，全部闭合' % js.count('/*'))
    NEED = ['const ICON =', 'function svgIcon', 'function paintIcons', 'function setIcon',
            'const icons =', 'function iconSvg', 'const GROUPS =', 'const SECTIONS = GROUPS',
            'const MODULES =', 'function sectionCount', 'function renderRing', 'function renderRail',
            'function activatePanel', 'function syncChrome', 'function spy(', 'const sectionEl',
            'function toggleOpsCard', 'function toast', 'function openCmd',
            'const SEV =', 'const SRC =', 'const NEXT =', 'const ADV =', 'const BUGS =',
            'const escTxt', 'function countOf', 'function firstFix', 'function busiest',
            'function reopenList', 'function groupNote', 'function kpiValues', 'function ageText',
            'function detailHtml', 'function bugRowHtml', 'function groupsHtml', 'function staleHtml',
            'function renderGroups', 'function sync(', 'function toggleBug', 'function focusBug',
            'function advance', 'function copyBugList', 'function demo']
    lost = [x for x in NEED if x not in code]
    check(not lost, '关键声明 %d 条全部在代码里' % len(NEED), '被注释吞掉 / 丢失：' + ', '.join(lost))

print('== 7. 渐变的归属 ==')
grad = re.findall(r'background(?:-image)?\s*:[^;]*linear-gradient', css_nc)
check(not grad, '没有"面"上的线性渐变',
      '出现 %d 处面上的线性渐变' % len(grad))
# 允许的两处：导航壳 `.hub-arc` 的 conic（一圈进度弧）与 `.hub-compass` 的 radial mask（一圈遮罩）——
# 判据是"它画的是物件还是背景"，不是"有没有 gradient"这个词。
check(css_nc.count('conic-gradient') == 1 and css_nc.count('radial-gradient') == 2,
      '物件上的三处渐变（弧 1 + 遮罩 2）在',
      '导航壳的弧/遮罩渐变数变了：conic %d · radial %d'
      % (css_nc.count('conic-gradient'), css_nc.count('radial-gradient')))

print('== 8. 标记区 id 不许重复 ==')
ids = re.findall(r'\sid="([\w-]+)"', markup)
dup = sorted({i for i in ids if ids.count(i) > 1})
check(not dup, '%d 个 id，无重复' % len(ids), '重复 id：' + ', '.join(dup[:20]))

print('== 9. 裸标识符必须先声明 ==')
def strip_strings(t):
    """把字符串 / 模板串 / 正则字面量换成空格（注释已在上一步摘掉）。
       ⚠️ 必须连**正则**一起认：本页有 `replace(/[&<>"]/g, ...)` 与 `replace(/'/g, ...)`，
          不认识正则的剥离器会从那里开始"吃字符串"，一路吃到下一个引号，把中间整段吞掉。"""
    out, i, n, prev = [], 0, len(t), ''
    while i < n:
        ch = t[i]
        if ch in '\'"`':
            q = ch; i += 1
            while i < n:
                if t[i] == '\\': i += 2; continue
                if q == '`' and t[i] == '$' and i + 1 < n and t[i + 1] == '{':
                    depth, i = 1, i + 2
                    while i < n and depth:
                        if t[i] == '{': depth += 1
                        elif t[i] == '}': depth -= 1
                        i += 1
                    continue
                if t[i] == q: i += 1; break
                i += 1
            out.append(' '); prev = q
            continue
        if ch == '/' and prev in '(,=:[!&|?{};+-*%~^<>':
            j, incls = i + 1, False
            while j < n:
                if t[j] == '\\': j += 2; continue
                if t[j] == '[': incls = True
                elif t[j] == ']': incls = False
                elif t[j] == '/' and not incls: break
                elif t[j] == '\n': break
                j += 1
            i = j + 1; out.append(' '); prev = '/'
            continue
        out.append(ch)
        if not ch.isspace(): prev = ch
        i += 1
    return ''.join(out)

if code:
    code9 = strip_strings(code)
    # ⚠️ 先摘掉**对象字面量的 key**：`{ fatal: {...}, qa: {...} }` 里的 key 在语法上不是
    #    "读到的名字"，不摘掉会把整张 ICON 表的 40 多个图标名全报成未声明（探针自己误报）。
    code9 = re.sub(r'(?<![\w$.])([A-Za-z_$][\w$]*)\s*:', ' ', code9)
    BUILTIN = set('''window document console globalThis Math JSON Date Number String Boolean Array Object
        Set Map WeakMap WeakSet Promise Symbol BigInt RegExp Error TypeError RangeError SyntaxError
        parseFloat parseInt isNaN isFinite encodeURIComponent decodeURIComponent
        setTimeout clearTimeout setInterval clearInterval queueMicrotask requestAnimationFrame
        alert confirm prompt
        localStorage sessionStorage location history navigator screen performance crypto fetch
        FormData Blob FileReader URLSearchParams Intl structuredClone undefined NaN Infinity
        true false null this super new typeof instanceof void delete in of return if else for while do
        switch case break continue function class const let var try catch finally throw yield await
        async default export import extends static get set'''.split())
    decl = set()
    # ⚠️ 一条声明里可能有**多个** declarator（`const R_MIN = 52, R_MAX = 74;`）⇒ 全都要收，
    #    只取第一个名字会把后面的当成"没声明"（探针自己误报）。
    for m in re.finditer(r'\b(?:const|let|var)\s+([^;\n]*)', code9):
        depth, cur, parts = 0, '', []
        for ch in m.group(1):
            if ch in '([{': depth += 1
            elif ch in ')]}': depth -= 1
            if ch == ',' and depth == 0:
                parts.append(cur); cur = ''
            else:
                cur += ch
        parts.append(cur)
        for piece in parts:
            decl.update(re.findall(r'[\w$]+', piece.split('=')[0]))
    for m in re.finditer(r'\bfunction\s*([\w$]+)', code9): decl.add(m.group(1))
    for m in re.finditer(r'\bclass\s+([\w$]+)', code9): decl.add(m.group(1))
    for m in re.finditer(r'\bfunction\s*[\w$]*\s*\(([^)]*)\)', code9):
        decl.update(re.findall(r'[\w$]+', m.group(1)))
    for m in re.finditer(r'\(\s*([^()]*?)\s*\)\s*=>', code9):
        decl.update(n for n in re.findall(r'[\w$]+', m.group(1)))
    for m in re.finditer(r'(?<![\w$])([A-Za-z_$][\w$]*)\s*=>', code9):   # 不带括号的那一种
        decl.add(m.group(1))
    for m in re.finditer(r'\bcatch\s*\(\s*([\w$]+)', code9): decl.add(m.group(1))
    declared_all = decl | BUILTIN
    used_names = set(re.findall(r'(?<![\w$.])([A-Za-z_$][\w$]*)', code9))
    undeclared = sorted(n for n in used_names - declared_all
                        if n not in ('typeof', 'new', 'await', 'in', 'of'))
    check(not undeclared, '读到的名字全部有声明（%d 个名字）' % len(used_names),
          '疑似未声明就被读：' + ', '.join(undeclared[:20]))

print('== 10. 结构断言（本页专有）==')
# ① 静态区里的行数 == BUGS 的条数（两处走的是不同函数：countOf 与 groupsHtml 里的 filter）
rows = [(m.group(1).split()[0], m.group(2), m.group(3))
        for m in re.finditer(r'class="bug-row ([a-z- ]+)" id="(BUG-\d+)" data-state="([a-z]+)"', markup)]
check(len([r for r in rows if ' is-closed' in r[0]]) == 0, '行类名解析正常', '行正则没吃住多类名的行')
bug_data = re.findall(r"\{ id: '(BUG-\d+)', title: '", js)
check(len(rows) == len(bug_data) == 12,
      '静态 %d 行 == BUGS %d 条' % (len(rows), len(bug_data)),
      '行数与 BUGS 对不上：静态 %d / 数据 %d' % (len(rows), len(bug_data)))

# ② 每一条所在的分组 == 它自己的 data-state（搬错组是最容易静默发生的错）
groups = re.findall(r'<section class="ops-card" id="group-([a-z]+)" data-section="([a-z]+)">', markup)
# 三态：待修复 / 修复中（= 已排进任务）/ 已关闭。「待验证」撤掉了 ——
# 它需要一个**验收人**，而这条流程里没有（"修完不用别人点头"）。
check(len(groups) == 3 and all(a == b for a, b in groups),
      '3 个分组卡的 id 前缀与 data-section 一致', '分组锚点不对：%r' % (groups,))
check(len(set(bug_data)) == 12, '12 条编号两两不同', 'BUG 编号有重复')

sec_txt = {}
for key in [g[0] for g in groups]:
    a = markup.index('data-section="%s"' % key)
    b = markup.index('</section>', a)
    sec_txt[key] = markup[a:b]
    st = set(re.findall(r'data-state="([a-z]+)"', sec_txt[key]))
    check(st == {key}, '分组 %s 里的行状态都是 %s' % (key, key),
          '分组 %s 里混进了别的状态：%r' % (key, st))
    badge = re.search(r'id="badge-%s">(\d+) 条' % key, sec_txt[key])
    n_row = len(re.findall(r'class="bug-row ', sec_txt[key]))
    check(bool(badge) and int(badge.group(1)) == n_row,
          '分组 %s 徽标 %s == 行数 %d' % (key, badge.group(1) if badge else '?', n_row),
          '分组 %s 徽标与行数不符' % key)

# ③ 严重度胶囊的文字与 is-* 类必须对得上（一个致命的行挂着"轻微"是最坏的一种静默错）
SEV_TXT = {'is-fatal': '致命', 'is-major': '严重', 'is-minor': '一般', 'is-trivial': '轻微'}
mismatch = []
for cls, bid, st in rows:
    blk = markup[markup.index('id="%s"' % bid):]
    blk = blk[:blk.index('</div>')] if '</div>' in blk else blk
    chip = re.search(r'<span class="sev-chip">([^<]+)</span>', blk)
    if cls not in SEV_TXT or not chip or chip.group(1) != SEV_TXT[cls]:
        mismatch.append((bid, cls, chip.group(1) if chip else '?'))
check(not mismatch, '12 行的严重度类与胶囊文字一致', '严重度类与文字不符：%r' % (mismatch,))

# ④ 整行按钮与行尾按钮：按钮里不许套按钮（`<div role=button>` 那种更糟，Enter 什么都不发生）
nest_bad = []
for cls, bid, st in rows:
    a = markup.index('id="%s"' % bid)
    blk = markup[a:a + 2600]
    m = re.search(r'<button class="bug-main".*?</button>', blk, flags=re.S)
    if not m or '<button' in m.group(0)[len('<button class="bug-main"'):] or 'role="button"' in m.group(0):
        nest_bad.append(bid)
check(not nest_bad, '整行按钮里没有嵌套按钮（12 行）', '整行按钮里嵌了按钮：' + ', '.join(nest_bad))
check(len(re.findall(r'class="bug-adv"', markup)) == 12,
      '行尾推进按钮 12 枚', '行尾推进按钮数不对：%d' % len(re.findall(r'class="bug-adv"', markup)))
# 行尾是"一组动作"（推完之后会多出第二站），十二行每组都得在
check(len(re.findall(r'class="bug-acts"', markup)) == 12,
      '12 行各有一组行尾动作', '行尾动作组数不对：%d' % len(re.findall(r'class="bug-acts"', markup)))
# 静态那一份必然是**还没推过**的状态（推是运行期动作）⇒ 这两样一处都不该出现。
# ⚠️ 反过来说：如果哪天静态里冒出来了，说明有人把"推过之后"的样子手抄进了标记。
check('class="bug-go"' not in markup and 'bug-promoted' not in markup,
      '静态那份是"还没推过"的状态（无「去任务列表」/无任务号）',
      '静态标记里出现了"推过之后"才有的东西')
# 「推到任务」是唯一跨页的一步，文案必须真在状态表里（不是散在 onclick 里的字符串）
check("label: '推到任务'" in js and "'work:bugs:promoted'" in js,
      '「推到任务」与跨页键都在脚本里',
      '推送那一步的文案或跨页键丢了（点了会变成"什么都没发生"）')
check(not re.search(r'class="bug-main"[^>]*>\s*<button', markup),
      '行尾按钮落在整行按钮外面', '推进按钮长在整行按钮里面（按钮套按钮非法）')

# ⑤ 计数只在一处表达：tab 计数 == 侧栏副标题里的条数 == 行数
tab = re.search(r'id="tabBugCount">(\d+)<', markup)
sub = re.search(r'id="sidebarSubtitle">[^<]*?(\d+) 条<', markup)
check(bool(tab) and tab.group(1) == str(len(rows)), 'tab 计数 == 行数 (%s)' % (tab.group(1) if tab else '?'),
      'tab 计数与行数不符：%s vs %d' % (tab.group(1) if tab else '?', len(rows)))
# ⚠️ 副标题说的是**当前分区**的条数（运行期由 syncChrome 写 `sec.label + ' · ' + count`），
#    不是总数 —— 所以它该等于"第一个分组徽标"的值，而不是全部行数。
badge0 = re.search(r'id="badge-%s">(\d+) 条' % groups[0][0], markup)
check(bool(sub) and bool(badge0) and sub.group(1) == badge0.group(1),
      '侧栏副标题 == 当前分组的条数 (%s · %s 条)' % (groups[0][0], sub.group(1) if sub else '?'),
      '侧栏副标题与分组徽标不符：%s vs %s' % (sub.group(1) if sub else '?', badge0.group(1) if badge0 else '?'))
check(len(re.findall(r'id="badge-[a-z]+">\d+ 条<', markup)) == 3, '三组徽标都在', '组头徽标缺了')

# ⑥ 仪表三格都填上了（三格是"下一步该动哪个"，空着等于这一页没有主见）
kv = {k: re.search(r'id="kpi%s">([^<]*)<' % k, markup) for k in ('FirstVal', 'OwnVal', 'ReopenVal')}
empty = [k for k, m in kv.items() if not m or m.group(1) in ('', '—')]
check(not empty, '仪表三格都有值 (%s)' % ' · '.join(m.group(1) for m in kv.values()),
      '仪表空格：' + ', '.join(empty))

# ⑦ 圆盘槽数 == 分组数；命令面板里指向本页分组的条目 key 都真实存在
gkeys = [g[0] for g in groups]
sec_keys = re.findall(r"\{ key: '([a-z]+)',\s+label:", js)
check(sec_keys == gkeys, "圆盘 SECTIONS 的 key 与四个分组一致 %r" % (sec_keys,),
      '圆盘 key 与分组不一致：%r vs %r' % (sec_keys, gkeys))
gotos = re.findall(r'data-goto="panel:([a-z]+)"', markup)
check(sorted(gotos) == sorted(gkeys), '命令面板 %d 条分组跳转都能落到真分组' % len(gkeys),
      '命令面板指向不存在的分组：%r' % (sorted(set(gotos) - set(gkeys)),))
n_tab = len(re.findall(r'class="slot-tab[ "]', markup))
n_panel = len(re.findall(r'class="slot-panel[ "]', markup))
check(n_tab == 3 and n_panel == 3, '侧栏槽 3 格对 3 个面板（无 KPI 格 —— 顶部已有仪表条）',
      '侧栏槽与面板数不匹配：tab %d / panel %d' % (n_tab, n_panel))

# ⑧ 颜色只承载一种语义：组头不许出现颜色令牌（颜色全在行上）
head_blk = markup[markup.index('id="bugGroups"'):markup.index('<div class="cmd-mask"')]
check(not re.search(r'ops-card-head[^>]*style="[^"]*color', head_blk),
      '组头没有单独上色（颜色只在行上表达严重度）', '组头被单独上了色')

print('')
if fail:
    print('FAIL %d 条：' % len(fail))
    for f in fail: print('  - ' + f)
    sys.exit(1)
print('ALL GREEN')
