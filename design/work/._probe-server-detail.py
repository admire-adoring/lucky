# -*- coding: utf-8 -*-
"""静态探针（无渲染、无测试框架）：大括号配平 / 令牌双向差集 / div 深度 / 类名双向差集 / JS 语法。"""
import io, re, os, subprocess, tempfile, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else '/Users/yangliu/Craft/riding-fancy/lucky-y/client/lucky/design/work/工作-服务器-详情-index.html'
s = io.open(OUT, encoding='utf-8').read()

fail = []
def ok(msg): print('  ok   ' + msg)
def bad(msg):
    print('  FAIL ' + msg); fail.append(msg)

print('== 1. CSS 大括号配平 ==')
css = s.split('<style>', 1)[1].split('</style>', 1)[0]
o, c = css.count('{'), css.count('}')
(ok if o == c else bad)('大括号 %d / %d' % (o, c))

css_nc = re.sub(r'/\*.*?\*/', '', css, flags=re.S)

print('== 2. 令牌双向差集 ==')
declared = set(re.findall(r'(--[\w-]+)\s*:', s))          # 含 :root / .dark / 内联 style / JS setProperty
used = set(re.findall(r'var\(\s*(--[\w-]+)', s))
miss = sorted(used - declared)                             # 用了没声明
unused = sorted(declared - used)                           # 声明了没人用
# --a / --i / --cols / --arcs / --na / --icon / --r / --dial / --dc / --tone 等是"运行期由 JS
# 或内联 style 写入"的槽位，不在本探针的语义里
slot = {'--a', '--i', '--r', '--icon', '--dial', '--arcs', '--na', '--cols', '--dc', '--tone'}
miss = [m for m in miss if m not in slot]
unused = [u for u in unused if u not in slot]
(ok if not miss else bad)('用了没声明：' + (', '.join(miss) or '无'))
(ok if not unused else bad)('声明了没人用：' + ', '.join(unused[:40]) or '无')
if unused:
    print('       未消费者的令牌：' + ', '.join(unused))

print('== 3. <body> → <script> 逐行累计 div 深度 ==')
body = s.split('<body>', 1)[1].split('<script>', 1)[0]
d = 0; low = None
for i, ln in enumerate(body.split('\n'), 1):
    d += len(re.findall(r'<div\b', ln)) - len(re.findall(r'</div>', ln))
    if d < 0 and low is None: low = (i, ln.strip()[:70])
(ok if d == 0 and low is None else bad)('终值 %d，首次为负 %s' % (d, low))

# 顺带：section / main / aside / h2 也点一遍
for tag in ('section', 'main', 'aside', 'h2', 'span', 'button', 'a',
            'table', 'thead', 'tbody', 'tr', 'th', 'td'):
    op = len(re.findall(r'<%s\b' % tag, body))
    cl = len(re.findall(r'</%s>' % tag, body))
    if op != cl:
        bad('%s 开合不等：%d / %d' % (tag, op, cl))
    else:
        ok('%s %d/%d' % (tag, op, cl))

print('== 4. 类名双向差集（CSS vs 标记/脚本）==')
css_classes = set(re.findall(r'\.([A-Za-z][\w-]*)', css_nc))

def toks(txt):
    txt = re.sub(r'\$\{[^}]*\}', ' ', txt)      # 先摘掉整段插值，再按"类的分隔符"切
    return [t for t in re.split(r'[\s\'"+,?:()={}<>;]+', txt) if re.fullmatch(r'[a-z][\w-]*', t)]

dom = set()
# ① 静态 class="..."（模板串里的 ${} 也算，逐个展开其中的字面量）
for m in re.findall(r'class="([^"]*)"', s):
    dom.update(toks(m))
    for inner in re.findall(r"\$\{[^}]*\}", m):
        for lit in re.findall(r"[\'\"]([^\'\"]*)[\'\"]", inner):
            dom.update(toks(lit))
# ② className = '...' / classList.add|remove|toggle('...')
for m in re.findall(r'className\s*=\s*[\'"]([^\'"]*)[\'"]', s):
    dom.update(toks(m))
for m in re.findall(r'classList\.(?:add|remove|toggle|contains)\(\s*[\'"]([\w-]+)[\'"]', s):
    dom.add(m)
# ③ 兜底：文件里任何一个"引号字面量里的单词"，只要它同时是一个 CSS 类名，就算消费点
#    （`' is-prod'` / `'btn-danger'` / `'enter-from-center'` 这类拼接片段只有这一条抓得到）
for lit in re.findall(r"[\'\"]([^\'\"\n]{1,80})[\'\"]", s):
    for t in toks(lit):
        if t in css_classes:
            dom.add(t)

# 少数"标记里有、CSS 故意没有"的类：它要么是个只有壳的容器，要么是个**标记钩子**
NO_CSS_OK = {'path-group', 'slot-panel',
             # `is-branch` = 分叉站（一个站有没有孩子 ⇒ 随数据出现）。它不需要样式：
             # 要变的两样（`.route-fold` 箭头、`.route-cnt` 条数）都只长在分叉站上。
             # 它存在的意义是"读得出来"+ 探针按它数数，不是漏了规则。
             'is-branch'}
# 状态类：它们**随数据出现**（默认那台是生产机 ⇒ `.hero-tag.is-test` 就没出现）
# 状态类：随数据 / 交互出现，不是"没写样式"（`is-leaf` = 路线图的终点站）
STATE_OK = {'is-test', 'is-plain', 'is-mono', 'is-wide', 'is-ext', 'on', 'active', 'is-open', 'dark',
            'is-leaf', 'script'}
css_only = sorted(c for c in css_classes - dom if not c.isdigit() and c not in STATE_OK)
# 反方向只查**静态** class 属性（含 `+` 拼接的那种会把 JS 变量名当成类名，全是假阳性）
dom_static = set()
for m in re.findall(r'class="([^"+]*)"', s):
    dom_static.update(toks(m))
dom_only = sorted(t for t in dom_static - css_classes - NO_CSS_OK)
(ok if not css_only else bad)('CSS 有、标记/脚本没有（孤儿样式）：' + ', '.join(css_only[:40]))
(ok if not dom_only else bad)('标记/脚本有、CSS 没有：' + ', '.join(dom_only[:40]))

print('== 5. JS 语法（node --check）==')
js = s.split('<script>', 1)[1].rsplit('</script>', 1)[0]
tf = tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8')
tf.write(js); tf.close()
node = '/Users/yangliu/Library/Application Support/Parall/WorkBuddy(Parall_3)/.workbuddy/binaries/node/versions/22.22.2-3/bin/node'
r = subprocess.run([node, '--check', tf.name], capture_output=True, text=True)
(ok if r.returncode == 0 else bad)('node --check rc=%d %s' % (r.returncode, r.stderr.strip()[:300]))

print('== 7. JS 声明没被注释吞掉 ==')
def strip_block_comments(t):
    """只摘掉块注释。
       —— 块注释没收尾（写完开头却用 HTML 注释的收尾去结）会把后面整段代码吃进注释，
          而 `node --check` 照样通过、div 深度照样 0：只有"名字还在不在代码里"查得出来。
       ⚠️ 不处理字符串/模板串：本页的 JS 里 `/*` 与 `*/` 只出现在注释中。
          真出现反例（例如 `'*/'` 这种字面量），下面的计数会不等 ⇒ 会报出来，不会静默放过。"""
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
    ok('块注释 %d 对，全部闭合' % (js.count('/*')))
    NEED = ['const ICON =', 'function svgIcon', 'const icons =', 'function iconSvg',
            'const PROJECT_META =', 'const SERVERS =', 'function buildModules()',
            'function renderRing', 'function renderRail', 'function activatePanel',
            'function syncChrome', 'function spy(', 'function fileKind', 'const roleLabelOf',
            'function connHtml', 'const sectionEl', 'function pageSections',
            'function projChipsHtml', 'function heroActsHtml', 'function whatBodyHtml',
            'function projectCardsHtml', 'const PROJECT_COLOR', 'function fpRowHtml', 'function pdBodyHtml',
            'const PROJECT_DOCS', 'const docsOfMachine', 'function docBookHtml',
            'function docShelvesHtml', 'function railTree', 'function railNodesHtml',
            'function railHtml', 'function openProjectDrawer', 'function closeProjectDrawer',
            'function countLeaves', 'function toggleRouteFold',
            'function renderMachine', 'function renderAll', 'function renderRecent',
            'function removeServer', 'function editServer', 'function refreshAll',
            'function toast', 'function openConfirm', 'function renderCmdList',
            'function openFile', 'function saveFile', 'function openLogWindow',
            'function openDeployWindow', 'function openTerminalWindow']
    lost = [x for x in NEED if x not in code]
    (ok if not lost else bad)('被注释吞掉 / 丢失的声明：' + (', '.join(lost) or '无'))
    ok('注释以外的代码 %d 字符' % len(code))

print('== 8. id 不能重复 ==')
html_only = s.split('<script>', 1)[0]          # 只看标记区：JS 里的 id 是带 ${} 的模板
ids = re.findall(r'\sid="([\w-]+)"', html_only)
dup = sorted({i for i in ids if ids.count(i) > 1})
(ok if not dup else bad)('重复 id：' + (', '.join(dup[:20]) or '无'))
if dup:
    print('       ⚠️ `getElementById` 只会拿第一份 ⇒ 另一份永远打不开 / 永远没反应，也不报错')
    print('       同一份数据在多个视角/视图里各有表达时：id 要带视角前缀，取元素改走"按关系找"')

print('== 9. 裸标识符必须先声明（`total` 那类）==')
"""⚠️ 这一类**所有其它探针都看不见**：读一个没声明的名字是**合法语法**
（`node --check` 通过），只在运行到那一行时抛 ReferenceError。
2026-09-29 踩：`applyFilter()` 里写了 `total > 0` 而 `total` 从来没声明 ⇒
整条函数在最后两行炸掉，而**筛选看着完全正常**（前半段已经改完 DOM 了），
坏掉的只有两个空态 —— 页面一声不吭。
判据：凡"读"到的名字，必须在同一段代码里被 const/let/var/function/class/参数/catch 声明过，
或属于语言内置（白名单）。"""
if code:
    def strip_strings(t):
        """把字符串 / 模板串 / 正则字面量换成空格（**注释已经在上一步摘掉了**）。
           ⚠️ 必须连同**正则**一起认：本页有 `replace(/'/g, ...)` —— 那个 `'` 在正则里，
              不认识正则的剥离器会从它开始"吃字符串"，一路吃到下一个引号，
              把中间整段代码吞掉（于是查不出东西，还不报警）。"""
        out, i, n, prev = [], 0, len(t), ''
        while i < n:
            c = t[i]
            if c in '\'"`':
                q = c; i += 1
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
            if c == '/' and prev in '(,=:[!&|?{};+-*%~^<>':
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
            out.append(c)
            if not c.isspace(): prev = c
            i += 1
        return ''.join(out)

    code9 = strip_strings(code)
    BUILTIN = set('''window document console globalThis Math JSON Date Number String Boolean Array Object
        Set Map WeakMap WeakSet Promise Symbol BigInt RegExp Error TypeError RangeError SyntaxError
        parseFloat parseInt isNaN isFinite encodeURIComponent decodeURIComponent
        setTimeout clearTimeout setInterval clearInterval queueMicrotask requestAnimationFrame
        localStorage sessionStorage location history navigator screen performance crypto fetch
        FormData Blob FileReader URLSearchParams Intl structuredClone undefined NaN Infinity
        true false null this super new typeof instanceof void delete in of return if else for while do
        switch case break continue function class const let var try catch finally throw yield await
        async default export import extends static get set'''.split())
    decl = set()
    # ⚠️ 一条声明里可能有**多个** declarator（`const R_MIN = 52, R_MAX = 74;`）——
    #    只取第一个名字会把它后面的都当成"没声明"（探针自己误报）。
    for m in re.finditer(r'\b(?:const|let|var)\s+([^;\n]*)', code9):
        seg, depth, cur = m.group(1), 0, ''
        parts = []
        for ch in seg:
            if ch in '([{': depth += 1
            elif ch in ')]}': depth -= 1
            if ch == ',' and depth == 0:
                parts.append(cur); cur = ''
            else:
                cur += ch
        parts.append(cur)
        for decl_txt in parts:
            # 取等号左边那一段里的所有名字：`R_MAX`、`{ a, b: c }`（解构，c 才是新名字）、`[a, b]`
            decl.update(re.findall(r'[\w$]+', decl_txt.split('=')[0]))
    for m in re.finditer(r'\bfunction\s*([\w$]+)', code9): decl.add(m.group(1))
    for m in re.finditer(r'\bclass\s+([\w$]+)', code9): decl.add(m.group(1))
    for m in re.finditer(r'\bfunction\s*[\w$]*\s*\(([^)]*)\)', code9):
        decl.update(re.findall(r'[\w$]+', m.group(1)))
    for m in re.finditer(r'\(([^()]*)\)\s*=>', code9):
        decl.update(re.findall(r'[\w$]+', m.group(1)))
    for m in re.finditer(r'(?<![\w$.])([\w$]+)\s*=>', code9): decl.add(m.group(1))
    for m in re.finditer(r'\bcatch\s*\(([\w$]+)\)', code9): decl.add(m.group(1))
    unknown = []
    for m in re.finditer(r'(?<![\w$.])([A-Za-z_$][\w$]*)(?![\w$])', code9):
        name = m.group(1)
        if name in decl or name in BUILTIN: continue
        nxt = code9[m.end():m.end() + 30].lstrip()
        if nxt.startswith(':'): continue          # 对象字面量的键 / case 标签
        if name not in unknown: unknown.append(name)
    (ok if not unknown else bad)('读了但没声明的名字：' + (', '.join(unknown[:30]) or '无'))
    if unknown:
        print('       ⚠️ 读未声明的名字 = 运行到那一行抛 ReferenceError；')
        print('          `node --check` 查不出、div 深度/令牌/类名差集也查不出')
else:
    bad('JS 未能剥离注释 ⇒ 第 9 条无法执行')

print('== 10. 静态主内容不是空壳（预览面板不跑脚本）==')
hero = re.search(r'<h1 class="hero-name" id="heroName">([^<]*)</h1>', html_only)
(ok if hero and hero.group(1).strip() not in ('', '—') else bad)('Hero 机器名：%s' % (hero.group(1) if hero else '没找到'))
for cid, label in [('whatBody', '概览'), ('pjBody', '项目'), ('dcBody', '文档'), ('fpBody', '文件位置')]:
    m = re.search(r'<div[^>]*id="%s"[^>]*>(.*?)</div>\s*</section>' % cid, html_only, re.S)
    n = len(m.group(1)) if m else 0
    (ok if n > 200 else bad)('%s 段静态内容 %d 字符（>200 才算真灌进去了）' % (label, n))
# 三套形态各点一遍数：书（有限可数）/ 书架 / 线路终点站（应等于路径条数）
n_book = len(re.findall(r'<button class="doc-book', html_only))
n_leaf = len(re.findall(r'class="route-item is-leaf"', html_only))
n_pj = len(re.findall(r'class="pc-card"', html_only))
(ok if n_book >= 3 else bad)('静态书架上的书 %d 本（≥3）' % n_book)
(ok if n_leaf >= 6 else bad)('路线图的终点站 %d 个（≥6）' % n_leaf)
(ok if n_pj >= 1 else bad)('项目卡（抽屉把手）%d 张（≥1）' % n_pj)
# 每张卡都要有身份色（`--pc`）—— 少了它就是"这张卡没有项目色"（视觉上会和别的不一样却查不出来）
n_pc = len(re.findall(r'class="pc-card"[^>]*style="--pc: ', html_only))
(ok if n_pc == n_pj else bad)('带身份色的项目卡 %d / %d' % (n_pc, n_pj))
if n_leaf != 9:
    bad('终点站 %d 个 ≠ 默认那台的路径条数 9 —— 线路图漏了节点或合并过头' % n_leaf)
# ⚠️ 别写 `item == leaf + (ul-1)` —— 那条是**树的定义决定的**（任何树都满足），
#    证明不了"单链压缩"做没做。真正要验的是：**每一层的孩子数都 ≥ 2**
#    （压缩的判据是"一个站点值得占一行 ⇔ 它是分叉点或终点"⇒ 不存在只有一个孩子的层）。
_counts, _st = [], []
for _l in [x.strip() for x in html_only.split('\n')]:
    if _l.startswith('<ul class="route-list">'):
        _st.append(0)
    elif _l.startswith('</ul>'):
        if _st: _counts.append(_st.pop())
    elif _l.startswith('<li class="route-item'):
        if _st: _st[-1] += 1
(ok if _counts and min(_counts) >= 2 else bad
    )('路线图每一层的孩子数 ≥2（没有纯路过站）：%s' % (_counts or '没解析到'))
painted = len(re.findall(r'<svg\b', html_only))
(ok if painted >= 20 else bad)('标记区里已灌 svg 的图标 %d 个（≥20）' % painted)
if ' data-ico="' in html_only and re.search(r'data-ico="[^"]+"></span>', html_only):
    bad('标记区里还有没灌的空图标容器')

print('== 13. 文件位置：收起 / 复制（结构断言）==')
"""⚠️ 这一组查的是**模板串算出来的东西对不对**：折叠按钮的数量、每行复制的两个值、
   以及"收起时那个条数"能不能和子树里真有的叶子逐层对上。
   这些错了都不报错 —— 页面照常渲染，只是"点一下收起"少收一块、或复制的值悄悄不对。"""
n_branch = len(re.findall(r'class="route-item is-branch"', html_only))
n_fold = len(re.findall(r'class="route-fold"', html_only))
(ok if n_branch >= 3 else bad)('分叉站 %d 个（≥3）' % n_branch)
(ok if n_fold == n_branch else bad)('收起箭头 %d 个 == 分叉站 %d 个' % (n_fold, n_branch))
n_act = len(re.findall(r'class="route-act"', html_only))
(ok if n_act == 2 * (n_leaf + n_branch) else bad
    )('复制按钮 %d 枚 == 2 × %d 行' % (n_act, n_leaf + n_branch))
# CSS：收起那一条规则必须在（少了它 = 点了没反应，而且不报错）
(ok if re.search(r'\.route-item\.is-collapsed\s*>\s*\.route-list\s*\{\s*display:\s*none', css_nc)
    else bad)('CSS 里有 `.route-item.is-collapsed > .route-list { display:none }`')

# 逐行走一遍：每行的**主动作 / 两个复制值 / 收起条数**三样都要自洽。
# ⚠️ 行的"自己的字段"在遇到嵌套 `<ul>` 之前 —— 用 cap 收口，别把子树的按钮算进这一行。
_stack, _top_total, _bad, _row_n = [], 0, [], 0
for _ln in [x.strip() for x in html_only.split('\n')]:
    if _ln.startswith('<li class="route-item'):
        _stack.append({'sub': 0, 'cnt': None, 'head': [], 'cap': True,
                       'leaf': 1 if 'is-leaf' in _ln else 0})
        continue
    if not _stack:
        continue
    if _ln.startswith('</li>'):
        _r = _stack.pop()
        _row_n += 1
        _head = '\n'.join(_r['head'])
        _m = re.search(r'<button class="route-main"[^>]*>', _head)
        _title = re.search(r'\btitle="([^"]*)"', _m.group(0)) if _m else None
        _copies = re.findall(r"copyText\('([^']*)'\)", _head)
        if not _m:
            _bad.append('有一行没有主按钮')
        else:
            _inner = re.search(r'<button class="route-main"[^>]*>(.*?)</button>', _head, re.S)
            if _inner and '<button' in _inner.group(1):
                _bad.append('主按钮里还套着按钮')
            if ('aria-expanded' in _m.group(0)) != bool(_r['leaf'] == 0):
                _bad.append('aria-expanded 与"是不是分叉站"对不上：' + _head[:50])
        if len(_copies) != 2:
            _bad.append('复制按钮不是两枚：' + (_title.group(1) if _title else _head[:40]))
        else:
            _p, _nm = _copies
            if not _p.startswith('/'):
                _bad.append('复制的路径不是绝对路径：' + _p)
            if _nm != _p.rstrip('/').split('/')[-1]:
                _bad.append('复制的名称不是路径最后一段：%s / %s' % (_p, _nm))
            if not _title or _title.group(1) != _p:
                _bad.append('行的 title 与复制的路径对不上：%s / %s'
                            % (_title.group(1) if _title else '无', _p))
        _n_here = _r['leaf'] + _r['sub']
        if _r['cnt'] is not None and _r['cnt'] != _n_here:
            _bad.append('收起条数 %d ≠ 子树里的叶子 %d 条' % (_r['cnt'], _n_here))
        if _stack:
            _stack[-1]['sub'] += _n_here
        else:
            _top_total += _n_here
        continue
    if _ln.startswith('<ul class="route-list">') or _ln.startswith('</ul>'):
        _stack[-1]['cap'] = False                      # 本行自己的字段到此为止
        continue
    if _stack[-1]['cap']:
        _stack[-1]['head'].append(_ln)
        _c = re.search(r'class="route-cnt">(\d+) 条<', _ln)
        if _c:
            _stack[-1]['cnt'] = int(_c.group(1))
(ok if not _bad else bad)('每行的主动作 / 两个复制值 / 收起条数自洽：'
                          + ('是' if not _bad else '；'.join(_bad[:4])))
(ok if _top_total == n_leaf == 9 else bad
    )('逐层对账：最外层各站下面合计 %d 条 == 终点站 %d 个 == 数据里 9 条' % (_top_total, n_leaf))
(ok if _row_n == n_leaf + n_branch and not _stack else bad
    )('解析到 %d 行（应 %d 行），栈%s' % (_row_n, n_leaf + n_branch, '空' if not _stack else '没清空'))

print('== 12. 与源页既有类不撞名（交集，不是差集）==')
# 路线图容器最初取名 `.rail` —— 而导航壳的"收起态图标列"正是 `.rail`（`display:none` +
# 只有 `.sidebar.collapsed` 时才显示）⇒ 整段文件位置被吃掉，而**类名双向差集查不出来**
# （两边都有定义、两边都有标记，它只查"有没有"，查不出"是不是同一个东西"）。
# 这里守两条：① 路线图那一族在产物里**用的是 `.route`**；② `.rail` 的规则块只剩导航壳那一份。
# ⚠️ 数"恰好是 `.rail` 本身"（后面不许再接字母/`-`/`_`）—— 导航壳那一族是 `.rail__btn`
#    这种 BEM 名，用宽松正则会把它们全算进来（第一次跑就因此报了 29 条假阳性）。
n_route = len(re.findall(r'\.route[\w-]*', css))
n_rail_exact = len(re.findall(r'\.rail(?![\w_-])', css))
(ok if n_route >= 10 else bad)('路线图一族（.route*）规则 %d 处' % n_route)
(ok if n_rail_exact <= 3 else bad
    )('恰好叫 `.rail` 的规则 %d 处（导航壳只有"默认隐藏 + 收起时显示"两条）' % n_rail_exact)
if 'class="rail"' in html_only and 'class="route"' not in html_only:
    bad('路线图容器还是 `class="rail"`（会把导航壳的收起态图标列样式吃过来）')

print('== 6. 其它 ==')
for pat, label in [(r'<div class="app"', '.app 只有一个'), (r'id="moduleRing"', '圆盘'),
                   (r'id="heroCard"', '② Hero'), (r'id="cmdList"', '命令面板条目容器'),
                   (r'data-section="what"', '概览段'), (r'data-section="projects"', '项目段'),
                   (r'data-section="docs"', '文档段'), (r'data-section="files"', '文件位置段'),
                   (r'id="pdMask"', '项目抽屉')]:
    (ok if len(re.findall(pat, s)) == 1 else bad)('%s：%d 个' % (label, len(re.findall(pat, s))))
# 删掉的容器 / 视图不该再留半点引用（它们的"死引用"不报错、只是永远不生效）
for ghost in ['id="view-project-cards"', 'id="view-server-cards"', 'class="filter-bar"',
              'class="kpi-bar"', 'sectionsWrap', 'seg-btn', 'sv-card', 'sv-pop',
              'focusServer(', 'addServer(', 'syncInstrument(',
              # 本页这次改掉的那些：文件位置不再"按项目分组"、抽屉里不再有项目级组头
              'fileGroupsHtml', 'fp-ghead', 'sv-pos', 'sv-preview',
              'pj-row', 'pj-ico', 'pj-main', 'pj-more', 'pj-stat', 'projectRowsHtml']:
    if ghost in s:
        bad('已删的视图还留着引用：' + ghost)
    else:
        ok('已删的视图无残留引用：' + ghost)
for i, ln in enumerate(s.split('\n'), 1):
    if re.search(r'[\u200b-\u200f\ufeff]', ln): bad('零宽字符 @%d' % i)
if 'closeDrawer' in s: bad('残留 closeDrawer 调用（参考页那个孤儿）')

print()
print('结论：' + ('全部通过' if not fail else '%d 项待修' % len(fail)))
sys.exit(1 if fail else 0)
