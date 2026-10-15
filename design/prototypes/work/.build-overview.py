#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 `工作-任务-总览-index.html`。

做法：**从只读的 `工作-项目-服务器-index.html` 切壳**（导航壳 / 令牌 / 图标表 /
导航 JS / 浮层工具 JS 逐字承接），内容区（CSS / DOM / 数据 / 渲染）全部新写。
切段一律用「唯一锚点字符串」，只有少数"通用块"按行号从**只读源**取 —— 源文件不被
改写，行号不会漂；切完立刻 assert 段内确有预期的选择器。

跑法：
  /Users/.../python3.13/bin/python3 .build-tasks.py
"""
import pathlib
import re
import sys

HERE = pathlib.Path(__file__).resolve().parent
SRC = HERE / '工作-服务器-index.html'
OUT = HERE / '工作-项目-项目详情-总览-index.html'

s = SRC.read_text(encoding='utf-8')
LINES = s.split('\n')          # LINES[i] = 第 i+1 行


def seg(a, b):
    """取锚点之间的文本（不含两端锚点）。a / b 都必须唯一。"""
    assert s.count(a) == 1, '锚点不唯一(%d): %r' % (s.count(a), a[:60])
    i = s.index(a) + len(a)
    j = s.index(b, i)
    return s[i:j]


def seg2(a, b):
    """取锚点之间的文本，**含起点**（用于整段替换：起点那行注释也要被换掉）。"""
    assert s.count(a) == 1, '锚点不唯一(%d): %r' % (s.count(a), a[:60])
    i = s.index(a)
    j = s.index(b, i)
    return s[i:j]


def rows(a, b):
    """取源文件第 a..b 行（含两端），末尾补换行。"""
    return '\n'.join(LINES[a - 1:b]) + '\n'


def rep(text, a, b, n=1):
    """成对替换 + 计数断言。"""
    c = text.count(a)
    assert c == n, '替换次数不符（期望 %d 实际 %d）：%r' % (n, c, a[:70])
    return text.replace(a, b)


def swap(text, a, b, new, name):
    """把 a..b（含 a、不含 b）整段换掉。只用短锚点 —— 注释里全是全角引号，
    长字面量对不齐会静默落空。"""
    assert text.count(a) == 1, '%s: 起点不唯一(%d)' % (name, text.count(a))
    i = text.index(a)
    assert b in text[i:], '%s: 终点不在起点之后' % name
    j = text.index(b, i)
    return text[:i] + new + text[j:]


# ============================================================================
# 0. 第二个源：项目详情 · 运维页
#    —— ② Hero、③ tabs 菜单栏、那 8 个图标 key、Hero 的交互，都从它整块搬。
#       本页与它是**同一个项目的两个分区**，Hero 必须逐字相同（换分区它一个字都不动）。
# ============================================================================
SRC2 = HERE / '工作-项目-项目详情-运维-index.html'
s2 = SRC2.read_text(encoding='utf-8')
L2 = s2.split('\n')


def rows2(a, b):
    """取第二个源的第 a..b 行（含两端）。"""
    return '\n'.join(L2[a - 1:b]) + '\n'


# ============================================================================
# 1. 切壳
# ============================================================================
CSS_SHELL = seg('<style>', '        /* ========== 主内容 ========== */')
# 壳的窄屏段（顶栏胶囊收文字 / sidebar-w 收一档）在服务器页里长在「内容 CSS」那一段中间 ——
# 它是**壳**的东西，本页照切（不切的话 `.nav-p-text` 在 ≤1140 就没有任何样式）。
CSS_SHELL += rows(1249, 1273)

# 本页新需要的两支：Hero 的「进行中」胶囊（`.badge.info`）要它们。
# 从运维页取同一对值，不另立一套。
CSS_SHELL = rep(CSS_SHELL, "            --ok-fg: #047857;",
                "            --info-fg: #0E7490;    --info-bg: rgba(14,116,144,0.14);\n"
                "            --ok-fg: #047857;")
CSS_SHELL = rep(CSS_SHELL, "            --ok-fg: #6EE7B7;",
                "            --info-fg: #67E8F9;    --info-bg: rgba(34,211,238,0.18);\n"
                "            --ok-fg: #6EE7B7;")

# 壳的令牌注释里有**两段**讲"部署文档书脊"`--spine` 被 `.doc-book` 上的 `--book` 取代
# （浅色主题一段、深色主题一段）—— 那是服务器页（与项目详情运维页）的事；
# 本页的文档卡里没有书了 ⇒ 留着它就是"讲一个这里不存在的东西"。两段都摘掉。
CSS_SHELL = re.sub(r'\n[ \t]*/\* （[^\n]*--spine.*?\*/\n', '', CSS_SHELL, flags=re.S)
assert '--spine' not in CSS_SHELL and '--book' not in CSS_SHELL and '--rc-fg' in CSS_SHELL

# `--ok-bg` 原来**唯一的消费者**是运维卡里那枚"成功"徽标（随卡墙一起删了）
# ⇒ 令牌也撤：留一个没人消费的令牌，等于留一份"看着像事实源、其实没人用"的第二描述。
# ⚠️ `--ok-fg` **不撤** —— Toast 的成功态还在用它（`.toast[data-type="ok"] .toast-ico`）；
#    这一对不是连体的，"前景还有人用、底没了"是正常的（那枚徽标是唯一需要绿底的地方）。
CSS_SHELL = rep(CSS_SHELL, '      --ok-bg: rgba(16,185,129,0.14);', '')
CSS_SHELL = rep(CSS_SHELL, '      --ok-bg: rgba(16,185,129,0.20);', '')
assert '--ok-bg' not in CSS_SHELL


DOM_SHELL = seg('<body>', '    <div class="main-wrap">')          # 顶栏 + 侧栏

JS_THEME = seg('\n<script>\n', '    /* ============================================================\n       数据')

# 服务器页那张图标表里没有这 8 个（项目详情分区页才用得上）—— 路径逐字抄自运维页那张表。
# ⚠️ 这张表在**切出来的 JS 文本**里、不是 Python 变量 ⇒ 只能做文本替换，
#    不能 `ICON.update(...)`（那会 NameError，而且报的是"名字没定义"，
#    得想一下才反应过来"它是 JS 源码、不是 Python 对象"）。
ICON_EXTRA = """        /* 项目详情分区页用的那一批（服务器页那张表里没有） */
        dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
        task: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m8 12 2.5 2.5L16 9"/>',
        bug: '<circle cx="12" cy="13" r="6"/><path d="M12 7V4M8 8 6 6M16 8l2-2M6 13H3M21 13h-3M8 18l-2 2M16 18l2 2"/>',
        doc: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
        key: '<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8"/><path d="m16 7 3 3"/>',
        more: '<circle cx="5.6" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="18.4" cy="12" r="1.4"/>',
        pause: '<rect x="7" y="4.5" width="3.6" height="15" rx="1.2"/><rect x="13.4" y="4.5" width="3.6" height="15" rx="1.2"/>',
        arrowLeft: '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
"""
_ICON_ANCHOR = "        /* 标签页 / 卡片头 / 实体 */\n"
assert JS_THEME.count(_ICON_ANCHOR) == 1, '图标表的表头锚点没找到（服务器页那张表结构与预期不符）'
JS_THEME = JS_THEME.replace(_ICON_ANCHOR, _ICON_ANCHOR + ICON_EXTRA)

# `external`（"在新窗口打开"）在本页已**一个消费者都没有**：原来只有文档卡那三个书封的
# 角标用它，换成精装封面后角标没了 ⇒ 连表里的定义一起撤
# （留一个没人用的 key，就是留一份"看着像事实源、其实没人用"的冗余）。
JS_THEME = re.sub(r"\n        external: '[^']*',", '', JS_THEME)
assert 'external' not in JS_THEME, '`external` 没摘干净'
for _k in ('dashboard', 'task', 'bug', 'doc', 'key', 'more', 'pause', 'arrowLeft'):
    assert JS_THEME.count('        ' + _k + ':') == 1, '图标 %s 没插进去或插重了' % _k

JS_NAV = seg2('    /* ============================================================\n       导航壳：SECTIONS',
              '    /* ============================================================\n       渲染：两个视角各一屏卡片墙')
JS_UTIL = seg2('    /* ============================================================\n       Toast',
               '    /* ============================================================\n       文件抽屉')

# 浮层 DOM：命令面板 → Toast（中间的「文件抽屉」本页不需要，删掉）
DOM_FLOAT = seg2('\n<div class="cmd-mask"', '\n<script>\n')

# ---- 通用 CSS 块（按行号从只读源取） ----
CSS_BLOCKS = [
    (1158, 1173, '.main-wrap'),        # 主内容布局 + 滚动条
    (1175, 1248, '.cmd-mask'),         # 命令面板
    (1274, 1288, '.detail'),           # 内容收口
    (1289, 1313, '.btn'),              # 按钮 + .last-sync
    (1460, 1533, '.modal-mask'),       # 弹窗 + Toast
    (1535, 1538, '::-webkit-scrollbar'),   # 全局滚动条
    (1551, 1573, '@media (max-width: 980px)'),  # 响应式（已剔掉服务器页专有条目）
]
for a, b, must in CSS_BLOCKS:
    chunk = rows(a, b)
    assert must in chunk, '第 %d..%d 行里没有 %s' % (a, b, must)

CSS_COMMON = '\n'.join(rows(a, b).rstrip('\n') for a, b, _ in CSS_BLOCKS) + '\n'

# 响应式段里属于服务器页的两条覆写：任务页没有这两个物件 ⇒ 删掉
# 响应式段里属于服务器页的三条覆写：任务页没有这两个物件 ⇒ 连整个 980 断点一起删
CSS_COMMON = rep(CSS_COMMON, """        @media (max-width: 980px) {
            .kpi-bar { grid-template-columns: repeat(2, 1fr); }
        }
""", '')
CSS_COMMON = rep(CSS_COMMON, '            /* 三个动作钮在窄屏放大到 44px 的命中区（手指不是鼠标） */\n            .server-action-btn { width: 44px; height: 44px; }\n', '')
CSS_COMMON = rep(CSS_COMMON, '            .kpi-bar { grid-template-columns: 1fr; }\n', '')
assert 'filter-bar' not in CSS_COMMON, '筛选栏的 CSS 没清干净'
assert 'chip' not in CSS_COMMON, '胶囊的 CSS 没清干净'
# CSS_COMMON 的 `.btn` 那一段里夹着 `.last-sync`（服务器页页头右侧那颗），
# 本页没有那一格 ⇒ 删
CSS_COMMON = rep(CSS_COMMON,
                 '        /* 页头右侧的"最后检查"：常驻说明，不是动作 */\n'
                 '        .last-sync { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; }\n', '')
assert 'last-sync' not in CSS_COMMON
assert 'empty-state' not in CSS_COMMON, '空态的 CSS 没清干净'

# ============================================================================
# 1b. 从运维页搬来的三段 CSS：② Hero / ③ tabs 菜单栏 / `.badge`
#     ⚠️ Hero 与同项目的其他分区页**必须逐字相同** ⇒ 整段搬，只删本页没有的那一格。
# ============================================================================
# ⚠️ 运维页的 1384..1497 里混着「命令面板 + .detail」（它从别处拷剩下的残片），
#    真正属于 Hero 的是 1255..1382 ⇒ 分段取，别整段切（整切会与 CSS_COMMON 重复一份）。
CSS_HERO_TABS = rows2(1255, 1382) + rows2(1498, 1558)

# 本页的 Hero 里**没有**「最后检查 / 重新检查」（截图里就没有，那是运维页为了安置被撤掉的
# 页头动作才加的）⇒ 连同它的注释一起摘掉；`.last-sync` 也随之没有消费者。
CSS_HERO_TABS = re.sub(r'[ \t]*/\* 本页特有的那一格.*?\*/\n', '', CSS_HERO_TABS, flags=re.S)
CSS_HERO_TABS = re.sub(r'[ \t]*\.hero-sync \{[^}]*\}\n', '', CSS_HERO_TABS)
CSS_HERO_TABS = re.sub(r'[ \t]*/\* 页头右侧的"最后检查"[^\n]*\*/\n', '', CSS_HERO_TABS)
CSS_HERO_TABS = re.sub(r'[ \t]*\.last-sync \{[^}]*\}\n', '', CSS_HERO_TABS)
# `.hd-urgent.is-over` 是 Hero 那颗「剩 58 天」胶囊的"已过期"变体，本页没有这条数据 ⇒ 删
CSS_HERO_TABS = re.sub(r'[ \t]*\.hd-urgent\.is-over \{[^}]*\}\n', '', CSS_HERO_TABS)
# 段头注释里那句"页面级动作挪进 .hero-sync"也跟着改 —— 本页没有那一格
CSS_HERO_TABS = re.sub(r'页面级动作（最后检查 / 重新检查）挪进 \.hero-sync。',
                       '本页没有页面级动作那一格（照用户给的截图）。', CSS_HERO_TABS)
assert 'hero-sync' not in CSS_HERO_TABS and 'last-sync' not in CSS_HERO_TABS

# `.badge` 那一族（Hero 的「进行中」用它）—— 只留本页用得到的两档，
# 其余（idle / danger / warn / ok）本页有 `.ov-badge` 自己的写法。
CSS_BADGE = rows2(1768, 1776)
for _drop in ('idle', 'danger', 'warn', 'ok'):
    CSS_BADGE = re.sub(r'\n        \.badge\.' + _drop + r' \{[^\n]*\}', '', CSS_BADGE)
assert '.badge.info' in CSS_BADGE and '.badge.idle' not in CSS_BADGE

CSS_COMMON += '\n' + CSS_HERO_TABS + CSS_BADGE


# ============================================================================
# 2. 内容 CSS（新写）
# ============================================================================
CSS_BODY = '''

        /* ============================================================
           总览 · 六条横带（本页专有）
           —— 一条 = 这个项目的一个面，**一行**回答两件事：
                「这是谁、有多少」= 图标 + 分区名 + 计数徽标；
                「此刻要知道什么」= 一句结论 —— **这一句才是本页唯一不可替代的东西**。
           ⚠️ 这里原来是六张**三列卡墙**，每张卡塞 3~6 条摘要。它的问题不是好不好看，
              而是**净增量接近零**：卡头计数 = ③ 那排 tab 上的计数；卡脚「查看全部」=
              点那个 tab；卡里那几条摘要 = 点进分区第一屏就能看到（而且分区页给得更多）。
              三列两排铺满一屏还得滚 ⇒ 用户判词「用处好像不太大，我都点到项目详情了」。
           ⇒ 压成六条：一屏放下、不必滚，每条只留"tabs 说不出的话"。
              摘要列表 / 勾选框 / 三本书都回到各自的**分区页**去
              （书在文档分区页本来就有整面书墙 —— 那里才是它的家）。
           ⚠️ 六条的顺序 = ③ 那排 tab 的顺序 = 圆盘那六格 = `SECTIONS` 的顺序，
              一处改三处跟着变。
           ============================================================ */
        /* 一张**卡片，里面是一张表**。
           —— "表格"的全部意义在**列对齐**：上一版六行是 `flex` 顺序排的，
              "数量"跟着名字的宽度走、"此刻"跟着徽标的宽度走 ⇒ 两列的起点一行一个位置。
              改成 grid 六列之后，六行的每一列上下都齐（这才是"表格卡片"）。
           ⚠️ 列宽写成 `.ov-list` 上的一个变量：表头与数据行读**同一份** ——
              两处各写一遍，改一处就错位。
           ⚠️ 带 `--ov-` 前缀：**命令面板的 `.mega-grid` 已经有一支同名的 `--cols`**
              （那边存的是列**数**，这边是列**宽列表**）—— 同名的两样东西放一页上，
              下一个人改错一处不会报错，只会"某一块突然排成一列"。
           ⚠️ 六列 = 图标 / 名字 / 数量 / 此刻 / 图形 / 箭头，与行内那六个子元素的顺序一一对应
              （所以行不用包一层容器）。 */
        .ov-list {
            --ov-cols: 24px 44px 152px minmax(0, 1fr) 72px 24px;
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: var(--r-lg);
            box-shadow: var(--shadow-card);
            overflow: hidden;                 /* 行的悬停底不许越过面板圆角 */
        }
        /* 表头（叫 `thead` 不叫 `head`：**上一版六张卡片墙的卡头用的正是那个名字**，
           而收尾断言正盯着它不许回来 —— 复用旧名等于把那条守卫废掉；
           ⚠️ 连注释里都别写出那个全名，不然守卫连注释一起抓）。
           只给一条**稍重的下沿**，不给底色 —— `--bg-subtle` 压白卡只有 1.03:1，
           那等于"一个看不出来的底"，白加一层解释。表头与数据行靠**列对齐**和这条线分开。
           第一个格跨"图标 + 名字"两列（那两列合起来才是"分区"）。 */
        .ov-thead {
            display: grid; grid-template-columns: var(--ov-cols); column-gap: 10px;
            align-items: center;
            padding: 8px 14px 8px 16px;
            border-bottom: 1px solid var(--border-strong);
            font-size: 10px; font-weight: 700; letter-spacing: 0.1em;
            color: var(--text-muted);
        }
        .ov-h-name { grid-column: 1 / span 2; }
        /* 一行 = 一扇门。整行可点 ⇒ 用 `<a href>`（不是 `role="button"` + onclick）：
           Enter 天然可用，不必再手写一次 keydown 拦截。 */
        .ov-item {
            position: relative;                       /* 给异常那道色条做定位参照 */
            display: grid; grid-template-columns: var(--ov-cols); column-gap: 10px;
            align-items: center;
            padding: 10px 14px 10px 16px;
            text-decoration: none; color: inherit;
            transition: background 0.16s ease;
        }
        .ov-item + .ov-item { border-top: 1px solid var(--border-subtle); }
        .ov-item:hover { background: var(--bg-hover); }
        /* outline 往里缩 2px：面板 `overflow:hidden` 会把向外的环裁掉 */
        .ov-item:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
        /* 异常那一档：在行的**左沿**给一道 3px 的实线。
           ⚠️ 用伪元素而不是 `border-left`（那会把整行内容右移 3px），
              也不是 `inset` 阴影（那会被 `is-spot` 的动画整条覆盖掉）。
           颜色与形状一起给，而句子本身也说了是什么事（"1 条致命待修复"）
           ⇒ 遮掉颜色仍然读得出来"这一行要去看"。 */
        .ov-item.is-alert::before {
            content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
            background: var(--warn-fg);
        }

        .ov-ico {
            width: 24px; height: 24px; border-radius: 8px; flex-shrink: 0;
            background: var(--bg-subtle); color: var(--text-secondary);
        }
        /* 名字那一列的宽度（44px）就是对齐手段 —— 不用再给 `min-width`：
           列宽把"任务"(2 个汉字) 与 "BUG"(3 个拉丁) 钉在同一个起点上。 */
        .ov-name {
            font-size: 12.5px; font-weight: 700; color: var(--text-primary); white-space: nowrap;
        }
        .ov-count {
            font-size: 10.5px; font-weight: 700; padding: 1px 7px; border-radius: 999px;
            background: var(--bg-subtle); color: var(--text-muted);
            white-space: nowrap; font-variant-numeric: tabular-nums;
            justify-self: start;              /* 列里靠左 —— 徽标宽度不一，靠左才与表头齐 */
        }
        /* 「此刻」—— 一句结论。
           ⚠️ 这一句是**本页唯一不可替代的东西**，所以它拿"会被用到的那一档"色
              （`--text-secondary`）；名字与计数是"读一次就记住的身份"（primary / muted）。
           ⚠️ 会变的那一个数（"1 天后""3 小时前"）用 `<b>` 加粗 —— 同一句里也要有层级。 */
        .ov-note {
            min-width: 0;
            font-size: 12px; color: var(--text-secondary);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ov-note b { font-weight: 700; }

        /* ---------- 行尾的「这一面专属的图形」 ----------
           ⚠️ 这里是本页**唯一**回答"为什么六个面不该长一个样"的地方：六个面本来就不一样。
              所以每行的图形都不同，而且**每一个都从这一行自己的数据里长出来** ——
                26 / 36            → 一条进度条
                1 条致命待修复       → 一枚告警三角
                最近三本文档         → 三根书脊（中间那根亮一档 = 刚更新那本）
                2 台服务器          → 两枚机架
                11 月 5 日          → 一个日期块
                3 个平台            → 三枚方块
              没有一个是纯装饰：装饰性的图形读第二遍就没有信息了，还会把结论句挤小。
           ⚠️ 图形**右对齐**、且那一条列宽固定 72px —— 左边那句结论的结束位置才是齐的。
           ⚠️ 颜色仍只承载一种语义：除异常那一行，图形**全用中性色**（同一支色的两档）。 */
        .ov-glyph {
            display: flex; align-items: center; justify-content: flex-end; gap: 5px;
        }

        /* ① 任务：26 / 36 的迷你进度条 */
        .ov-bar { width: 56px; height: 6px; border-radius: 999px; background: var(--border-strong); overflow: hidden; }
        .ov-bar i { display: block; height: 100%; border-radius: 999px; background: var(--text-muted); }

        /* ② BUG：一枚告警三角（这一面有"1 条致命待修复"） */
        .ov-warn {
            width: 0; height: 0;
            border-left: 7px solid transparent; border-right: 7px solid transparent;
            border-bottom: 12px solid var(--warn-fg);
        }

        /* ③ 文档：最近三本的书脊（中间那根 = 刚更新过的那一本，亮一档、高一档） */
        .ov-spines { display: flex; align-items: flex-end; gap: 5px; }
        .ov-spines i { width: 5px; height: 20px; border-radius: 1px 2px 2px 1px; background: var(--text-muted); }
        .ov-spines i.is-fresh { height: 24px; background: var(--text-secondary); }

        /* ④ 运维：两枚机架（2 台服务器；上面那枚 = "运行中"的 prod-web-01） */
        .ov-racks { display: flex; flex-direction: column; gap: 3px; }
        .ov-racks i { width: 18px; height: 9px; border-radius: 2px; background: var(--text-muted); }
        .ov-racks i.is-on { background: var(--text-secondary); }

        /* ⑤ 会议：11 月 5 日那一块。
           ⚠️ 钉在 24×24 —— 与 `.ov-ico` 同高。图形**超过** 24px 会把那一行撑高，
              六行的分隔线就不等距了（参差 6px，看着像"这一行更重要"）。 */
        .ov-day {
            width: 24px; height: 24px; border-radius: 7px;
            background: var(--bg-subtle); border: 1px solid var(--border-subtle);
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            line-height: 1;
        }
        .ov-day b { font-size: 11px; font-weight: 700; color: var(--text-primary); }
        .ov-day span { margin-top: 1px; font-size: 6.5px; font-weight: 700; letter-spacing: 0.06em; color: var(--text-muted); }

        /* ⑥ 账户：三枚平台（横排；最左那枚 = "生产"那一个） */
        .ov-plats { display: flex; align-items: center; gap: 4px; }
        .ov-plats i { width: 7px; height: 7px; border-radius: 2px; background: var(--text-muted); }
        .ov-plats i.is-main { background: var(--text-secondary); }

        .ov-go {
            display: flex; align-items: center; justify-content: flex-end;
            color: var(--text-muted);
        }
        .ov-item:hover .ov-go { color: var(--text-secondary); }
        .ov-item.is-alert .ov-note { color: var(--warn-fg); }

        /* 从侧栏「最近」定位到某一条时的一闪 —— 与别的页同一套，只改描边不改尺寸 */
        .ov-item.is-spot { animation: ovSpot 1.6s ease; }
        @keyframes ovSpot {
            0%   { box-shadow: 0 0 0 2px var(--m-main), var(--shadow-card); }
            100% { box-shadow: var(--shadow-card); }
        }

        /* ⚠️ 窄档：**整组列宽收一档**（`--ov-cols` 是表头与行共用的那一份 ⇒ 只改这一处），
           再让结论句从"截断"放开成"折行"。
           表格比卡墙耐压得多（一行 44px 高）—— 宽度不够时让那**一句**自己换行、
           把"数量"列收窄，而不是把六行挤回六张卡（那正是更早那两版的样子）。
           ⚠️ 量的是**容器**不是视口 —— 见下面 `.detail` 的容器声明。 */
        @container (max-width: 620px) {
            .ov-list { --ov-cols: 24px 40px 78px minmax(0, 1fr) 40px 18px; }
            .ov-bar { width: 34px; }
            .ov-racks i { width: 14px; height: 7px; }
            .ov-note { white-space: normal; }
        }
        /* 「换容器」这一步：`.detail` 从共享壳里来，本页给它加一行容器声明
           （⚠️ 写在 CSS_BODY 里 = 在本页所有壳 CSS **之后**，同特异性后者胜）。 */
        .detail { container-type: inline-size; }
        .detail { container-type: inline-size; }
'''

# ============================================================================
# 3. 数据 + 内容 DOM（本页只有 Hero / tabs / 六条横带三段，台账页那套 PROJECTS 死代码已清）
# ============================================================================

# ---------------------------------------------------------------------------
# ② Hero 与 ③ tabs：整块从运维页搬，只做四处本页口径的改动
#    （① 摘掉「最后检查」那一格；② 「总览」变 active；③ 「运维」由 active 变跳转；
#      ④ 六个 tab 的计数挂上 `data-count`，与卡头徽标同源）
# ---------------------------------------------------------------------------
HERO_DOM = rows2(2966, 3035)
_i = HERO_DOM.index('<!-- 本页特有的一格')
_j = HERO_DOM.index('</div>', HERO_DOM.index('<div class="hero-sync">')) + len('</div>\n')
HERO_DOM = HERO_DOM[:_i] + HERO_DOM[_j:]
assert 'hero-sync' not in HERO_DOM and 'lastSync' not in HERO_DOM

TABS_DOM = rows2(3037, 3048)
# 本页就是「总览」⇒ 它 active，原来那句占位 toast 换成"已在本页"
TABS_DOM = rep(TABS_DOM,
               '<button class="tab" role="tab" onclick="toast(\'总览 Tab · 原型占位\',\'info\')">',
               '<button class="tab active" role="tab" aria-selected="true" onclick="toast(\'已在本页\',\'info\')">')
# 「运维」不再是当前页 ⇒ 去 active，并且**真的跳过去**
TABS_DOM = rep(TABS_DOM,
               '<button class="tab active" role="tab" aria-selected="true" onclick="toast(\'已在运维页\',\'info\')">',
               '<button class="tab" role="tab" onclick="location.href=\'工作-项目-项目详情-运维-index.html\'">')
# 「账户」有独立页了 ⇒ 也真的跳过去
TABS_DOM = rep(TABS_DOM,
               "onclick=\"toast('账户 Tab · 原型占位','info')\"",
               "onclick=\"location.href='工作-项目-项目详情-账户-index.html'\"")
# 六个计数：静态就写**本页的数**（无脚本时也要自洽），并挂 `data-count` 让 JS 同源刷新。
# ⚠️ 锚点里**不许出现那个数字** —— 它是**运维页当前的数据**，那边一变（Bug 2 → 12）
#    整组就静默失效。所以锚只到「标签名 + 计数格的引号」为止，数字由这里写。
for _label, _key, _val in [('任务', 'tasks', '26/36'), ('Bug', 'bugs', '12'),
                           ('文档', 'docs', '11'), ('运维', 'ops', '2·3·4'),
                           ('会议', 'meets', '2'), ('账户', 'accs', '8')]:
    TABS_DOM, _n = re.subn(r'(%s <span class="tab-count")>[^<]*</span>' % re.escape(_label),
                           r'\1 data-count="%s">%s</span>' % (_key, _val), TABS_DOM)
    assert _n == 1, 'tab「%s」没挂上 data-count（匹配 %d 处）' % (_label, _n)
assert TABS_DOM.count('data-count=') == 6

MAIN_DOM = '''
    <div class="main-wrap">
        <main class="main">
        <div class="detail">

__HERO__

__TABS__

            <!-- ========== 总览 · 六条横带 ==========
                 一条 = 这个项目的一个面，**一行**回答两件事：
                   「这是谁、有多少」= 图标 + 分区名 + 计数徽标（与 ③ 那排 tab 同源）；
                   「此刻要知道什么」= 一句结论 —— 这句是 ③ 菜单栏给不了的，
                                       也是本页唯一不可替代的东西。
                 ⚠️ 整条可点 ⇒ 用 `<a href>`：Enter 天然可用，不必再写 role="button" + keydown。
                 ⚠️ 六条的顺序 = ③ 那排 tab = 圆盘那六格 = `SECTIONS` 的顺序，一处改三处跟着变。
                 ⚠️ 摘要列表 / 勾选框都不在这里 —— 它们回到各自的**分区页**去。
                    总览只回答"要不要去"，不替分区页把内容再抄一遍（那正是上一版的病）。
                 ⚠️ **行尾那个图形是六行唯一不一样的东西**，而且每个都从这行自己的数据里长出来
                    （26/36 → 进度条；1 条致命 → 告警三角；最近三本文档 → 三根书脊；
                     2 台服务器 → 两枚机架；11 月 5 日 → 日期块；3 个平台 → 三枚方块）。
                    六个一样的图标 + 六行一样的排版 = "六个设置项"（用户判词"太普通了"）；
                    要破的正是这个 —— 六个面本来就不一样，为什么长得一样。 -->
            <div class="ov-list">
                <!-- 表头：三列各给一个名字（列名要说得像人话，"数量""此刻"就够了）。
                     ⚠️ 它与下面六行读**同一份列宽**（`.ov-list` 上的 `--ov-cols`）——
                        两处各写一遍，改一处就错位。 -->
                <div class="ov-thead" aria-hidden="true">
                    <span class="ov-h-name">分区</span>
                    <span>数量</span>
                    <span>此刻</span>
                </div>
                <!-- ① 任务 -->
                <!-- 原来卡里那三条任务（3 天后 / 4 天后 / 1 天后，高优先级那条是"设计统一鉴权方案"）压成一句 —— 只留会变的那一个数 + 它是哪一条。 -->
                <a class="ov-item" data-section="tasks" href="工作-任务-总览-index.html">
                    <span class="ov-ico" aria-hidden="true" data-ico="task" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="16" rx="2.5"/><path d="m8 12 2.5 2.5L16 9"/></svg></span>
                    <span class="ov-name">任务</span>
                    <span class="ov-count" id="cntTasks">26 / 36</span>
                    <span class="ov-note">最紧的一条 <b>1 天后</b>到期：设计统一鉴权方案</span>
                    <span class="ov-glyph" aria-hidden="true"><span class="ov-bar"><i style="width:72%"></i></span></span>
                    <span class="ov-go" aria-hidden="true" data-ico="chevR" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9.5 6 6 6-6 6"/></svg></span>
                </a>

                <!-- ② BUG -->
                <!-- 原来卡里两条（致命"对账金额精度丢失"待修复 / 严重"鉴权 token 刷新竞态"修复中）压成一句，先报最坏的那条。⚠️ 现有数据里六条中**只有这一条**是异常（没有逾期、也没有到期的密钥）⇒ `is-alert` 只出现在这里，颜色才继续"只承载一种语义"。 -->
                <a class="ov-item is-alert" data-section="bugs" href="工作-项目-项目详情-Bug-index.html">
                    <span class="ov-ico" aria-hidden="true" data-ico="bug" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="13" r="6"/><path d="M12 7V4M8 8 6 6M16 8l2-2M6 13H3M21 13h-3M8 18l-2 2M16 18l2 2"/></svg></span>
                    <span class="ov-name">BUG</span>
                    <span class="ov-count" id="cntBugs">12 条</span>
                    <span class="ov-note"><b>1 条致命</b>待修复：对账金额精度丢失</span>
                    <span class="ov-glyph" aria-hidden="true"><span class="ov-warn"></span></span>
                    <span class="ov-go" aria-hidden="true" data-ico="chevR" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9.5 6 6 6-6 6"/></svg></span>
                </a>

                <!-- ③ 文档 -->
                <!-- 原来卡里那三本书（技术方案 v3 昨天 / 接口契约说明 3 小时前 / 灰度发布预案 2 天前）压成一句 —— 只回答"最新动过的是哪一本"。三本书本身回文档分区页，那里有整面书墙。 -->
                <a class="ov-item" data-section="docs" href="work_project_detail_document.html">
                    <span class="ov-ico" aria-hidden="true" data-ico="doc" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg></span>
                    <span class="ov-name">文档</span>
                    <span class="ov-count" id="cntDocs">11</span>
                    <span class="ov-note"><b>3 小时前</b>刚更新：接口契约说明</span>
                    <span class="ov-glyph" aria-hidden="true"><span class="ov-spines"><i></i><i class="is-fresh"></i><i></i></span></span>
                    <span class="ov-go" aria-hidden="true" data-ico="chevR" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9.5 6 6 6-6 6"/></svg></span>
                </a>

                <!-- ④ 运维 -->
                <!-- 原来卡里是"一台机器 + 两条版本记录"⇒ 压成一句：机器在不在 + 最近一版的结果。 -->
                <a class="ov-item" data-section="ops" href="工作-项目-项目详情-运维-index.html">
                    <span class="ov-ico" aria-hidden="true" data-ico="rocket" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3c3.5 1.5 5.5 4.6 5.5 8.2L12 21l-5.5-9.8C6.5 7.6 8.5 4.5 12 3z"/><circle cx="12" cy="10" r="1.6"/></svg></span>
                    <span class="ov-name">运维</span>
                    <span class="ov-count" id="cntOps">2 服务器 · 3 文档 · 4 记录</span>
                    <span class="ov-note">prod-web-01 运行中 · <b>v3.3.4</b> 昨天上线成功</span>
                    <span class="ov-glyph" aria-hidden="true"><span class="ov-racks"><i class="is-on"></i><i></i></span></span>
                    <span class="ov-go" aria-hidden="true" data-ico="chevR" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9.5 6 6 6-6 6"/></svg></span>
                </a>

                <!-- ⑤ 会议 -->
                <!-- 原来卡里只有一个日期方块 + 标题 + 时间，压成一句 —— 顺带把"周会"说清是项目周会。 -->
                <a class="ov-item" data-section="meets" href="#" onclick="event.preventDefault();toast('会议 分区还没有独立页面','info')">
                    <span class="ov-ico" aria-hidden="true" data-ico="calendar" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg></span>
                    <span class="ov-name">会议</span>
                    <span class="ov-count" id="cntMeets">2</span>
                    <span class="ov-note"><b>11 月 5 日 14:00</b> 项目周会（60 分钟 · 会议室 A）</span>
                    <span class="ov-glyph" aria-hidden="true"><span class="ov-day"><b>5</b><span>NOV</span></span></span>
                    <span class="ov-go" aria-hidden="true" data-ico="chevR" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9.5 6 6 6-6 6"/></svg></span>
                </a>

                <!-- ⑥ 账户 -->
                <!-- 原来卡里是"阿里云 · 生产 / ops@lucky.com / 密码已加密"⇒ 压成一句；邮箱那条回账户分区页（那里整页都是它）。 -->
                <a class="ov-item" data-section="accs" href="工作-项目-项目详情-账户-index.html">
                    <span class="ov-ico" aria-hidden="true" data-ico="key" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="8" cy="15" r="4"/><path d="m11 12 8-8"/><path d="m16 7 3 3"/></svg></span>
                    <span class="ov-name">账户</span>
                    <span class="ov-count" id="cntAccs">8 · 3 平台</span>
                    <span class="ov-note">阿里云<b>生产</b>账号在用 · 密码已加密</span>
                    <span class="ov-glyph" aria-hidden="true"><span class="ov-plats"><i class="is-main"></i><i></i><i></i></span></span>
                    <span class="ov-go" aria-hidden="true" data-ico="chevR" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9.5 6 6 6-6 6"/></svg></span>
                </a>

            </div>
        </div>
        </main>
    </div>
</div>
'''
MAIN_DOM = MAIN_DOM.replace('__HERO__', HERO_DOM).replace('__TABS__', TABS_DOM)


# ============================================================================
# 4. JS：数据段（新写）
# ============================================================================
JS_DATA = '''
    /* ============================================================
       数据
       —— 这一份就是"这个项目现在长什么样"的读数源。
          ⚠️ 六条横带的徽标与 ③ 菜单栏那排 tab 的计数**是同一批数**
             ⇒ 都从 `STATS` 现算，改一个数两处一起变，绝不手改两遍。
          ⚠️ 横带上那句**结论**（"最紧的一条 1 天后到期：…"）是静态标记 ——
             它是"项目现在的样子"，不是可计算的聚合。
       ⚠️ 与项目详情其他分区页共用同一个 Hero ⇒ 项目名 / 进度 / 截止日
          那一组读数不在这里（它们写在 Hero 的标记里，换个分区一个字都不该动）。
       ============================================================ */
    const STATS = {
        tasks: { done: 26, all: 36 },
        bugs: 12,
        docs: 11,
        ops: { servers: 2, docs: 3, records: 4 },
        meets: 2,
        accs: { total: 8, platforms: 3 }
    };

    /* ============================================================
       侧栏圆盘的分区 = 本页的**六张卡**
       —— 判据还是那一句：这几块**能不能同时成立**？能 —— 它们本来就是
          "这个项目现在的六个面"，当然要一起看 ⇒ 定位 + 当前项随滚动同步，
          不做 display 互斥切换。
       ⚠️ 与 ③ 菜单栏那排 tab 不是一回事：tab 是**项目的七个分区**（跨页导航，
          一页一个），圆盘是**本页内部**的六块。运维页也是同一套两级分工。
       ============================================================ */
    let SECTIONS = [
        { key: 'tasks', label: '任务', icon: 'task',     desc: '这个项目还要做什么' },
        { key: 'bugs',  label: 'Bug',  icon: 'bug',      desc: '坏了哪几处、修到哪了' },
        { key: 'docs',  label: '文档', icon: 'doc',      desc: '方案、契约与预案' },
        { key: 'ops',   label: '运维', icon: 'rocket',   desc: '机器、部署文档与发布记录' },
        { key: 'meets', label: '会议', icon: 'calendar', desc: '排在这个项目下的会' },
        { key: 'accs',  label: '账户', icon: 'key',      desc: '这个项目用到的账号与平台' }
    ];

    /* 计数拼进圆盘悬停名称条与侧栏副标题 —— 圆盘上只有图标，计数是
       "值不值得点"的唯一线索。这里是**分区级**读数（不跟任何筛选，本页也没有筛选栏）。 */
    function sectionCount(sec) {
        const C = countsSnapshot();
        return C[sec.key] ? C[sec.key].tab : '';
    }
'''

# ============================================================================
# 5. 导航段改造（原样承接 + 五处按本页口径改）
# ============================================================================
JS_NAV2 = JS_NAV

# ① SECTIONS 的构造整段删掉（改在「数据」段里写死五个桶）
JS_NAV2 = swap(JS_NAV2,
               '    /* ============================================================\n       导航壳：SECTIONS = 项目',
               '    /* 一级模块。',
               '    /* 导航壳的分区（SECTIONS）在「数据」段里定义 —— 五个时间桶。 */\n\n',
               'sections-block')

# ② 一级模块那段注释里的"各项目"改成本页口径
JS_NAV2 = swap(JS_NAV2,
               '    /* 一级模块。',
               '    function buildModules() {',
               '''    /* 一级模块。9 个都保留（顶栏 + 超级菜单要有真内容可展开）。
       ⚠️ 偏差②：只有「工作」有承载内容，其余点击时给提示且**不改 active、不换色、不重建环**。
       工作那一支的二级项 = SECTIONS（本页的五个时间桶）。
       ⚠️ 顶栏那个顶层「任务」模块（全部 / 今天 / 收件箱 / 看板 / 四象限 / 日历）是**另一页**的事 ——
          本页是"工作这一摊的任务"，两者不重名、也不重内容。 */
''',
               'modules-comment')

# ③ sectionCount：搬去「数据」段（那里才是它唯一的读者）
JS_NAV2 = swap(JS_NAV2,
               '    /* 计数必须现算：圆盘悬停名称条与侧栏副标题读的是同一份 SECTIONS */',
               '    /* ============ 状态 ============ */',
               '''    /* `sectionCount()` 跟着 SECTIONS 一起放在「数据」段里 —— 圆盘悬停名称条
       与侧栏副标题读的是同一份 SECTIONS。 */

''',
               'sectionCount-block')

# ④ 切换函数那段注释：没有"项目卡"了
JS_NAV2 = swap(JS_NAV2,
               '    /* ============ 唯一的切换函数（本页 = 定位，不是切视图） ============',
               '    /* 分区元素 = ',
               '''    /* ============ 唯一的切换函数（本页 = 定位，不是切视图） ============
       圆盘 / 收起态图标列 / 超级菜单 / 命令面板 / 侧栏槽 —— 全部汇到 activatePanel。
       ⚠️ 本页五个桶**同时可见** ⇒ 这里做的是"滚到它 + 更新当前项"。
          绝不要再改回 display 切换 —— 那会把另外四块藏到一个只有图标的圆盘后面。 */

''',
               'activatePanel-comment')

# ⑤ sectionEl：本页没有"视角"，落点就是那一个分组
JS_NAV2 = swap(JS_NAV2,
               '    /* 分区元素 = ',
               '    /* 程序滚动期间锁住滚动的回声',
               '''    /* 分区元素 = 本页的分组（五个时间桶 + 已完成折叠小节），**同页并列、没有视角**。
       ⚠️ 限定在 .detail 里找：圆盘、侧栏槽、命令面板都可能有同名 data-section。 */
    const sectionEl = key => document.querySelector('.detail [data-section="' + key + '"]');

''',
               'sectionEl')

# ⑥ activatePanel 的头部：去掉视角切换
JS_NAV2 = swap(JS_NAV2,
               '    function activatePanel(key) {',
               '        const el = card;',
               '''    function activatePanel(key) {
        if (!SECTIONS.some(s => s.key === key)) return;
        /* ⚠️ 本页**不需要**"先放开筛选再滚"那一套：圆盘说的是**时间桶**，
           筛选栏说的是**项目** —— 两个正交维度，谁也藏不住谁，因此不存在
           "滚到一个 display:none 的元素上"那次死点击。
           （服务器页那两处放开，是因为它的圆盘与筛选说的是同一个维度"项目"。） */
        activeKey = key;''',
               'activatePanel-head')

# ⑦ spy 那段注释：视角已经不存在
JS_NAV2 = swap(JS_NAV2,
               '       ⚠️ 必须跳过被筛掉、以及',
               '    function spy() {',
               '''       ⚠️ 必须跳过被藏起来的分区：`display:none`（自己是、或祖先之一是）的元素
          `getBoundingClientRect()` **全是 0** ⇒ `0 - 顶部 <= 130` 恒真，
          最后一个被藏起来的会把"当前项"抢过去（圆盘与侧栏副标题指着屏幕上看不见的东西）。
          所以判据用 `closest('[hidden]')` —— 它同时覆盖"自己被藏"与"祖先被藏"。
          本页五个桶不会被藏（筛选只藏行，不藏桶），但这条守卫要留着：
          它是"圆盘说在看 A、眼睛已经在 B"那类走散的唯一防线。 */
''',
               'spy-comment')

# ⑧ 中心门的文案：没有"项目"了
JS_NAV2 = rep(JS_NAV2, "        hubDoor.setAttribute('aria-label', '回到「' + (list[0] ? list[0].label : '第一个项目') + '」');",
              "        hubDoor.setAttribute('aria-label', '回到「' + (list[0] ? list[0].label : '第一格') + '」');")

# ⑨ 渲染环里那条"没有 children"的注释：把三级机制的去留写清楚
JS_NAV2 = swap(JS_NAV2,
               '            /* 本页的分区没有 children',
               '            html += `',
               '''            /* 本页的分区没有 children ⇒ data-has-children 恒为 false，小圆点永不出现。
               这是**正确**的，不是漏了（v5 里它表示"可下钻"）。
               三级机制整段保留、当前一次也不会触发：删掉它会丢掉 v5 的契约
               （下次给某个分区加 children 就得重写导航），留着又不说清，
               下一个人会以为这里是漏了。 */
''',
               'ring-comment')

assert 'SERVERS' not in JS_NAV2, '导航段里还残留 SERVERS'
assert 'perspective' not in JS_NAV2, '导航段里还残留 perspective'
assert 'buildSections' not in JS_NAV2
assert 'viewId' not in JS_NAV2
assert 'activatePanel(key) {' in JS_NAV2, 'activatePanel 被改坏了'
assert 'function spy() {' in JS_NAV2, 'spy 被改坏了'
assert 'function renderRing(' in JS_NAV2
assert 'function buildModules()' in JS_NAV2
assert 'function renderRail(' in JS_NAV2
assert 'activatePanel(key) {' in JS_NAV2, 'activatePanel 被改坏了'
assert 'function spy() {' in JS_NAV2, 'spy 被改坏了'
assert 'function renderRing(' in JS_NAV2
assert 'function buildModules()' in JS_NAV2
assert 'function renderRail(' in JS_NAV2
assert 'activatePanel(key) {' in JS_NAV2, 'activatePanel 被改坏了'
assert 'function spy() {' in JS_NAV2, 'spy 被改坏了'
assert 'function renderRing(' in JS_NAV2
assert 'function buildModules()' in JS_NAV2
assert 'function renderRail(' in JS_NAV2

# ============================================================================
# 6. 通用工具段（Toast / 弹窗 / 槽 / 超级菜单 / 折叠 / 命令面板 / 键盘）—— 三处按本页口径改
# ============================================================================
JS_UTIL2 = JS_UTIL
JS_UTIL2 = rep(JS_UTIL2,
               "        cmdItems.push({ icon: s.icon, text: s.label + ' · 项目', kbd: 'G ' + (i + 1), run: function () { activatePanel(s.key); } });",
               "        cmdItems.push({ icon: s.icon, text: '跳到「' + s.label + '」', kbd: 'G ' + (i + 1), run: function () { activatePanel(s.key); } });")
JS_UTIL2 = rep(JS_UTIL2,
               "        cmdItems.push({ icon: 'plus', text: '添加服务器', kbd: '', run: function () { location.href = ADD_SERVER_URL; } });\n"
               "        cmdItems.push({ icon: 'refresh', text: '重新检查全部机器', kbd: '', run: refreshAll });",
               "        cmdItems.push({ icon: 'plus', text: '新建项目', kbd: '', run: newProject });\n"
               "        cmdItems.push({ icon: 'refresh', text: '重新检查全部项目', kbd: '', run: refreshAll });")
JS_UTIL2 = rep(JS_UTIL2,
               "       —— 条目从 SECTIONS / MODULES 现算：项目名不是写死的常量，\n          删掉一个项目之后面板里也不该还留着它。",
               "       —— 条目从 SECTIONS / MODULES 现算：桶名不是写死的常量，\n          改一处 SECTIONS，这里跟着变。")
# 键盘段里那句"Esc 先关文件抽屉"——本页没有文件抽屉
JS_UTIL2 = rep(JS_UTIL2,
               "            if (document.getElementById('fdMask').classList.contains('open')) { closeFile(); return; }\n",
               "")
assert 'ADD_SERVER_URL' not in JS_UTIL2
assert 'fdMask' not in JS_UTIL2

# ============================================================================
# 7. 内容逻辑（新写）
# ============================================================================
JS_BODY = '''
    /* ============================================================
       总览页的交互 —— 只有两件：计数同源、定位
       ⚠️ 六条横带的标记是**静态的**（预览面板走静态 HTML 视图，主内容不许依赖脚本）
          ⇒ 这里不重建任何一条，只改数字与 class。
       ⚠️ 原来还有第三件"勾任务"——六条横带里**没有勾选框**了（勾选是分区页的事），
          那个函数与它读的任务行/勾选框那两个类一起删，不留一个恒为 0 的变量。
       ============================================================ */

    const groupEl = key => document.querySelector('.detail [data-section="' + key + '"]');
    const secOf = key => SECTIONS.filter(s => s.key === key)[0];
    const labelOf = key => { const s = secOf(key); return s ? s.label : key; };

    /* ---------- 两份口径的计数快照（横带徽标 / tab 计数各一份写法） ----------
       ⚠️ 横带够宽 ⇒ 用**长**的那个格式（「26 / 36」「2 服务器 · 3 文档 · 4 记录」，自明）；
          tab 只有一格 ⇒ 用**短**的（「26/36」「2·3·4」）。两个格式**同源**，放在一处算。 */
    function countsSnapshot() {
        const d = STATS.tasks.done, a = STATS.tasks.all;
        return {
            tasks: { tab: d + '/' + a, card: d + ' / ' + a },
            bugs:  { tab: String(STATS.bugs),  card: STATS.bugs + ' 条' },
            docs:  { tab: String(STATS.docs),  card: String(STATS.docs) },
            ops:   { tab: STATS.ops.servers + '·' + STATS.ops.docs + '·' + STATS.ops.records,
                     card: STATS.ops.servers + ' 服务器 · ' + STATS.ops.docs + ' 文档 · ' + STATS.ops.records + ' 记录' },
            meets: { tab: String(STATS.meets), card: String(STATS.meets) },
            accs:  { tab: String(STATS.accs.total), card: STATS.accs.total + ' · ' + STATS.accs.platforms + ' 平台' }
        };
    }

    /* ---------- 唯一的统计函数 ----------
       一处现算，**两处写回**：六条横带的徽标 + ③ 菜单栏那六个 tab 计数。 */
    function syncCounts() {
        const C = countsSnapshot();
        Object.keys(C).forEach(function (k) {
            const id = 'cnt' + k.charAt(0).toUpperCase() + k.slice(1);
            const el = document.getElementById(id);
            if (el) el.textContent = C[k].card;
        });
        document.querySelectorAll('.tabs [data-count]').forEach(function (el) {
            const k = el.dataset.count;
            if (C[k]) el.textContent = C[k].tab;
        });
        syncChrome(false);
    }

    /* ---------- 侧栏「最近」/ 命令面板的定位落点 ---------- */
    function focusCard(key) {
        const el = groupEl(key);
        if (!el) return;
        activatePanel(key);
        el.classList.remove('is-spot');
        void el.offsetWidth;               /* 强制回流：连着点两次也要重放动画 */
        el.classList.add('is-spot');
        toast('已定位到：' + labelOf(key), 'info');
    }

    /* ---------- 刷新 ----------
       ⚠️ 本页的 Hero 里**没有**「最后检查 / 重新检查」那一格（截图里就没有）
          ⇒ 这里只重算一遍读数。命令面板里那条"重新检查"仍然走它。 */
    function refreshAll() {
        syncCounts();
        toast('已重新检查全部读数', 'ok');
    }

    /* ---------- 一次把页面立起来 ----------
       ⚠️ 顺序不能反：图标要在 DOM 就位之后灌（先灌等于灌了个空容器）；
          计数要在图标之后。 */
    function renderAll() {
        paintIcons(document);
        syncCounts();
        renderCmdList();
    }
'''

# ---------------------------------------------------------------------------
# ② Hero 的交互：整段从运维页搬（绑定方式一模一样）。
#    ⚠️ 它必须排在 `toast()` 之后 —— 里面直接调 toast，而函数声明虽然会提升，
#       但这一段是 IIFE、在文件求值时立刻执行。
# ---------------------------------------------------------------------------
_i = s2.index('    /* ============================================================\n       ② 项目 Hero 的交互')
_j = s2.index('    })();', _i) + len('    })();\n')
JS_HERO = '\n' + s2[_i:_j] + '\n'

JS_INIT = '''
    /* 窄屏（≤900）顶栏只剩图标，补 title 作为悬停提示 */
    navItemEls.forEach(function (el) {
        const m = MODULE[el.dataset.module];
        if (m) el.title = m.name;
    });
    collapseBtn.title = '收起侧栏';
    collapseBtn.setAttribute('aria-expanded', 'true');

    renderAll();

    /* 自检：圆盘的图标必须两两不同 —— 全都一样时页面不报任何错，只有肉眼能看出来。
       （`iconSvg()` 对未定义的 key 会静默回落成 grid，这条是唯一能自动抓住它的方式。） */
    if (window.console && console.assert) {
        const bodies = [...document.querySelectorAll('#moduleRing .radial__item svg')].map(s => s.innerHTML.trim());
        console.assert(new Set(bodies).size === bodies.length, '[nav] 圆盘图标重复了：有分区的 icon key 写错或漏写');
    }
'''

# ============================================================================
# 8. 壳 DOM 的局部替换（顶栏徽标 / 侧栏标题 / 三个槽 / 侧栏注释）
# ============================================================================
D = DOM_SHELL

D = rep(D, '    <!-- ========== 侧栏（圆盘 = 本页的分区，即各项目） ========== -->',
        '    <!-- ========== 侧栏（圆盘 = 本页的六张卡） ========== -->')
D = rep(D, '<span class="name" id="sidebarTitle">服务器</span>',
        '<span class="name" id="sidebarTitle">总览</span>')
# ⚠️ 副标题的初值带着**服务器页当前的数据**（"支付系统重构 · 3 台"那种）——
#    把这个数字写死在锚点里，源页数据一变（2 台 → 3 台）这里就静默失效
#    ⇒ 用正则把内容整段换掉，别赌那个数。
D, _n = re.subn(r'<div class="sidebar-subtitle" id="sidebarSubtitle">[^<]*</div>',
                '<div class="sidebar-subtitle" id="sidebarSubtitle">任务 · 26/36</div>', D)
assert _n == 1, '侧栏副标题没换到（找到 %d 处）' % _n

# 顶栏「任务」胶囊那枚计数徽标是**顶层任务模块**的数，与本页无关 ⇒ 摘掉。
# 「工作」那一枚改成"这个项目有没有正在烧的火"（1 条致命 Bug），
# 与卡头的"BUG 3 条"不是一回事：卡头说总数，顶栏说最急的那一条。
D = rep(D, """                    <span class="nav-p-text">任务</span>
                    <span class="nav-p-badge">5</span>""",
        """                    <span class="nav-p-text">任务</span>""")
D = rep(D, """                    <span class="nav-p-text">工作</span>
                    <span class="nav-p-badge warn">2</span>""",
        """                    <span class="nav-p-text">工作</span>
                    <span class="nav-p-badge warn" title="1 条致命 Bug 待修复">1</span>""")

RECENT_OLD = seg2('                    <!-- 最近：最近动过的机器。带的是**机器名**（不是分区名）——',
                  '                    <!-- 快捷：')
RECENT_NEW = '''                    <!-- 最近：最近看过的**这一页内的几块**。带的是块名 ——
                         这一槽回答的是"我刚才在弄哪一块"，不是"我滚到哪一节了"。
                         本页只有六块，取前三块就够了（一屏内它们本来都看得见）。 -->
                    <div class="slot-panel active" data-panel="recent">
                        <button class="recent-item" type="button" onclick="focusCard('tasks')">
                            <span class="recent-icon" aria-hidden="true" data-ico="task" data-ico-size="11"></span>
                            <span class="recent-text">任务</span>
                            <span class="recent-time">26/36</span>
                        </button>
                        <button class="recent-item" type="button" onclick="location.href='工作-项目-项目详情-Bug-index.html'">
                            <span class="recent-icon" aria-hidden="true" data-ico="bug" data-ico-size="11"></span>
                            <span class="recent-text">Bug</span>
                            <span class="recent-time">3 条</span>
                        </button>
                        <button class="recent-item" type="button" onclick="focusCard('ops')">
                            <span class="recent-icon" aria-hidden="true" data-ico="rocket" data-ico-size="11"></span>
                            <span class="recent-text">运维</span>
                            <span class="recent-time">v3.3.4</span>
                        </button>
                    </div>

'''
D = D.replace(RECENT_OLD, RECENT_NEW)

QUICK_OLD = seg2('                    <!-- 快捷：四个各干一件事的入口。不放"删机器 / 移机器"这类破坏性动作 ——',
                 '                    <!-- AI：')
QUICK_NEW = '''                    <!-- 快捷：四个各干一件事的入口。不放"归档 / 删除项目"这类破坏性动作 ——
                         它们只该出现在 Hero 右上那个 ⋯ 菜单里（那里已经有一份）。 -->
                    <div class="slot-panel" data-panel="quick">
                        <div class="quick-grid">
                            <button class="quick-btn" type="button" onclick="location.href='工作-任务-总览-index.html'">
                                <span aria-hidden="true" data-ico="task" data-ico-size="12"></span>
                                全部任务
                            </button>
                            <button class="quick-btn" type="button" onclick="location.href='工作-项目-项目详情-Bug-index.html'">
                                <span aria-hidden="true" data-ico="bug" data-ico-size="12"></span>
                                看 Bug
                            </button>
                            <button class="quick-btn" type="button" onclick="location.href='工作-项目-项目详情-运维-index.html'">
                                <span aria-hidden="true" data-ico="rocket" data-ico-size="12"></span>
                                去看运维
                            </button>
                            <button class="quick-btn" type="button" onclick="openCmd()">
                                <span aria-hidden="true" data-ico="keyboard" data-ico-size="12"></span>
                                命令面板
                            </button>
                        </div>
                    </div>

'''
D = D.replace(QUICK_OLD, QUICK_NEW)

AI_OLD = seg2('                    <!-- AI：示例对话跟着这一页的口径走（找机器 → 连上 → 去动手）。',
              '                </div>\n            </div>\n\n            <div class="sidebar-foot">')
AI_NEW = '''                    <!-- AI：示例对话跟着这一页的口径走（这个项目最急的是什么 → 各自的读数）。
                         原来那版问的是"这台测试机在上什么版本"，而这一页上根本没有那台机器
                         ⇒ 那会是一句页面上没有依据的话。 -->
                    <div class="slot-panel" data-panel="ai">
                        <div class="ai-chat">
                            <div class="ai-msg bot">这个项目有一条致命 Bug「对账金额精度丢失」，还在待修复，要现在看吗？</div>
                            <div class="ai-msg user">任务那边还剩多少</div>
                            <div class="ai-msg bot">任务 36 条里完成 26 条，卡上那三条是最近要交的；另外两台机器都连着，最近一次发布 v3.3.4 是成功的。</div>
                        </div>
                        <div class="ai-input">
                            <input type="text" placeholder="问点什么…" />
                            <button class="ai-send" type="button" aria-label="发送">
                                <span aria-hidden="true" data-ico="chevR" data-ico-size="12"></span>
                            </button>
                        </div>
                    </div>
'''
D = D.replace(AI_OLD, AI_NEW)
DOM_SHELL2 = D

# ---- 浮层 DOM：删掉「文件抽屉」（本页没有文件位置那一块） ----
F = DOM_FLOAT
FD_OLD = seg2('<!-- 文件抽屉：从「文件分布」点一行打开 -->', '<!-- 弹窗（仅用于破坏性操作的二次确认） -->')
F = F.replace(FD_OLD, '')
F = rep(F, 'placeholder="跳转分区、切换模块，或输入命令（⌘K）"', 'placeholder="跳到某一格、切换模块，或输入命令（⌘K）"')
F = rep(F, """        <!-- 条目由 renderCmdList() 从 SECTIONS / MODULES 现算 —— 项目名不是写死的常量，
             删掉一个项目之后，这里也不该还留着它。 -->""",
        """        <!-- 条目由 renderCmdList() 从 SECTIONS / MODULES 现算 —— 桶名不是写死的常量，
             改一处 SECTIONS，这里跟着变。 -->""")
assert 'fd-' not in F
DOM_FLOAT2 = '\n\n<!-- ============================================================\n     浮层：命令面板 / 二次确认 / Toast（照搬运维页那一套）\n     ============================================================ -->\n' + F

# ============================================================================
# 9. 拼装
# ============================================================================
HEAD_COMMENT = '''<!DOCTYPE html>
<!-- ============================================================================
     工作 · 项目 · 项目详情 · 总览（`工作-项目-项目详情-总览-index.html`）
     ----------------------------------------------------------------------------
     这是**一个项目的总览分区** —— 项目详情七个分区里的第一个：
     一屏看全"这个项目现在的六个面"（任务 / Bug / 文档 / 运维 / 会议 / 账户），
     每张卡都通向它自己的详细页。

     ⚠️ 它与别的页的分工（别把它们的清单搬过来）：
          · **本页** = **一个项目**的六个面；
          · `工作-任务-总览-index.html` = 工作这一摊的**全部任务**（跨项目）；
          · `工作-项目-项目详情-运维-index.html` = 同一个项目的**运维**分区；
          · `工作-项目-项目详情-账户-index.html` / `work_project_detail_document.html` = 另两个分区。
        ⇒ 本页只给"这个项目有几条 / 几台 / 几篇"，不搬它们各自的清单。

     ⚠️ 骨架与兄弟分区页**逐字相同**：② Hero（跟着**项目**走，不跟选中态变）→
        ③ tabs 菜单栏（项目的七个分区）→ 内容。换个分区，Hero 与 tab 栏一个字都不该动。
        ⚠️ Hero 里**没有**「最后检查 / 重新检查」那一格 —— 运维页有，是因为它的页头被撤掉后
           那一格没别处放；本页照用户给的截图，没有它。

     ⚠️ 内容区 = **六条横带**（一条 = 这个项目的一个面），一行回答两件事：
          「这是谁、有多少」（图标 + 分区名 + 计数）与「此刻要知道什么」（一句结论）。
        ⚠️ 它原来是照用户给的截图重建的**六张三列卡墙**（他说"这是之前的布局"）——
           做完之后的判词是「用处好像不太大，我都点到项目详情了」。
           判据：那一版的**净增量接近零** —— 卡头计数 = ③ 那排 tab 上的计数；
           卡脚「查看全部」= 点那个 tab；卡里那几条摘要 = 点进分区第一屏就能看到，
           而且分区页给得更多。三列两排铺满一屏，还得滚。
        ⇒ 压成六条：一屏放下、不必滚，每条只留"tabs 说不出的话"。
          摘要列表 / 勾选框 / 三本书回到各自的**分区页**
          （书在文档分区页本来就有整面书墙 —— 那里才是它的家）。
        ⚠️ 材质仍走本仓当前口径（纯色 + 令牌），**不照抄截图里的玻璃质感**。

     ⚠️ 六条横带上的计数与 ③ 菜单栏那排 tab 的计数**是同一批数**
        ⇒ 都从 `STATS` 现算、一处写回两处，绝不手改两遍。
        （这一处"两表达"是**有意**留的：同一条横带上"多少"与"要紧的是什么"并排可读。
          要收成一处的话，删的是横带上那枚徽标，不是 tab 上的。）
     ⚠️ 侧栏圆盘的分区 = **本页的六条横带**（定位 + 随滚动同步），与 ③ 那排 tab
        不是一回事：tab 是**项目的七个分区**（跨页导航，一页一个），圆盘是**页内**的六块。
        运维页也是同一套两级分工。

     材质 / 令牌 / 图标 / 导航壳**逐字承接**兄弟分区页（本仓当前口径）。
     ---------------------------------------------------------------------------- -->
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>项目详情 · 总览</title>
    <style>'''

HTML = (
    HEAD_COMMENT
    + CSS_SHELL
    + CSS_COMMON
    + CSS_BODY
    + '    </style>\n</head>\n<body>\n'
    + DOM_SHELL2
    + MAIN_DOM
    + DOM_FLOAT2
    + '\n<script>'
    + JS_THEME
    + JS_DATA
    + JS_NAV2
    + JS_UTIL2
    + JS_BODY
    + JS_HERO
    + JS_INIT
    + '</script>\n</body>\n</html>\n'
)

OUT.write_text(HTML, encoding='utf-8')
print('写出 %s：%d 行 / %d 字节' % (OUT.name, HTML.count('\n') + 1, len(HTML.encode('utf-8'))))


# ---------------------------------------------------------------------------
# 本项目专有的收尾断言：确认该走的都走了、该留的都留了


# ---------------------------------------------------------------------------
# 本页专有的收尾断言：确认该走的都走了、该留的都留了
# ---------------------------------------------------------------------------
for _bad in ('tk-', 'TASKS', 'DONE_IDS', 'filterProject', 'bucketOf', '顺延', 'pj-'):
    assert _bad not in HTML, '还残留别的页面的东西：%s' % _bad
for _need in ('ov-list', 'ov-item', 'ov-note', 'ov-go', 'ov-thead', 'ov-h-name',
              '--cols:', 'data-section="tasks"',
              'focusCard', 'hero-card', 'tabs-wrap', 'data-count="tasks"', 'badge info',
              'ov-glyph', 'ov-bar', 'ov-warn', 'ov-spines', 'ov-racks', 'ov-day', 'ov-plats'):
    assert _need in HTML, '缺了本页的东西：%s' % _need
assert 'hero-sync' not in HTML and 'lastSync' not in HTML, '运维页那格「最后检查」没摘干净'
# 六条横带之后**不该再出现**的东西：卡片墙那一族、卡里的摘要块、勾选框、三本书
# （书回文档分区页去了；总览卡里那三本是它的第二处表达）。
for _old in ('ov-grid', 'ov-card', 'ov-head', 'ov-body', 'ov-foot', 'ov-more',
             'ov-task', 'ov-chk', 'ov-bug', 'ov-srv', 'ov-ver', 'ov-meet', 'ov-acc',
             'doc-book', 'db-title', 'db-foot', 'toggleOvTask'):
    assert _old not in HTML, '上一版卡片墙的残留：%s' % _old
# 六条 = 六个 data-section，各一次
for _k in ('tasks', 'bugs', 'docs', 'ops', 'meets', 'accs'):
    assert HTML.count('class="ov-item" data-section="%s"' % _k) + \
           HTML.count('class="ov-item is-alert" data-section="%s"' % _k) == 1, \
        '六条横带里「%s」不是恰好一条' % _k
assert HTML.count('class="ov-item') == 6, '横带应为 6 条，实际 %d' % HTML.count('class="ov-item')
# 六行各一个图形，而且六个都不一样（这是"不普通"的唯一依据，少一个就退回"六个设置项"）
assert HTML.count('class="ov-glyph"') == 6, '行尾图形应为 6 个，实际 %d' % HTML.count('class="ov-glyph"')
# 表格的命根子：表头与六行读**同一份列宽**（写死两遍就会错位）
assert HTML.count('--ov-cols:') == 2 and HTML.count('var(--ov-cols)') == 2, \
    '列宽该在 .ov-list 上定义（+ 窄档覆写一次）、被表头与行各引一次；实际定义 %d 引用 %d' % (
        HTML.count('--ov-cols:'), HTML.count('var(--ov-cols)'))
for _g in ('ov-bar', 'ov-warn', 'ov-spines', 'ov-racks', 'ov-day', 'ov-plats'):
    # ⚠️ `>= 1` 而不是 `== 1`：窄档可能给同一个图形再写一档尺寸（`.ov-bar` 就是）
    assert HTML.count('.' + _g + ' {') >= 1 and ('class="%s"' % _g) in HTML, '图形 %s 缺定义或没上标记' % _g
assert 'backdrop-filter' not in HTML, '本仓已纯色化，不许出现毛玻璃'
print('  收尾断言通过（无别页残留、项目详情总览要素齐全）')
