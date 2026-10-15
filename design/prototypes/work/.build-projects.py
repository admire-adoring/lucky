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
OUT = HERE / '工作-项目-项目台账-index.html'

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
# 1. 切壳
# ============================================================================
CSS_SHELL = seg('<style>', '        /* ========== 主内容 ========== */')
# 壳的窄屏段（顶栏胶囊收文字 / sidebar-w 收一档）在服务器页里长在「内容 CSS」那一段中间 ——
# 它是**壳**的东西，本页照切（不切的话 `.nav-p-text` 在 ≤1140 就没有任何样式）。
CSS_SHELL += rows(1249, 1273)
# `--warn-bg` 本页没有消费者 ⇒ 连声明一起撤
CSS_SHELL = rep(CSS_SHELL, '            --warn-fg: #9A4708;    --warn-bg: rgba(245,158,11,0.16);\n',
                '            --warn-fg: #9A4708;\n')
CSS_SHELL = rep(CSS_SHELL, '            --warn-fg: #FCD34D;    --warn-bg: rgba(245,158,11,0.22);\n',
                '            --warn-fg: #FCD34D;\n')
CSS_SHELL = rep(CSS_SHELL, '            --ok-fg: #047857;      --ok-bg: rgba(16,185,129,0.14);\n',
                '            --ok-fg: #047857;\n')
CSS_SHELL = rep(CSS_SHELL, '            --ok-fg: #6EE7B7;      --ok-bg: rgba(16,185,129,0.20);\n',
                '            --ok-fg: #6EE7B7;\n')

DOM_SHELL = seg('<body>', '    <div class="main-wrap">')          # 顶栏 + 侧栏

JS_THEME = seg('\n<script>\n', '    /* ============================================================\n       数据')
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
    (1314, 1351, '.kpi-bar'),          # 指标条
    (1460, 1533, '.modal-mask'),       # 弹窗 + Toast
    (1535, 1538, '::-webkit-scrollbar'),   # 全局滚动条
    (1551, 1573, '@media (max-width: 980px)'),  # 响应式（已剔掉服务器页专有条目）
    (1575, 1592, '.page-head'),        # 页头（段注释头 → .ph-actions 止）
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
CSS_COMMON = rep(CSS_COMMON, '        .kpi-val.ok { color: var(--ok-fg); }\n', '')
assert 'filter-bar' not in CSS_COMMON, '筛选栏的 CSS 没清干净'
assert 'chip' not in CSS_COMMON, '胶囊的 CSS 没清干净'
assert 'empty-state' not in CSS_COMMON, '空态的 CSS 没清干净'
assert 'server-action-btn' not in CSS_COMMON
assert 'is-server' not in CSS_COMMON
assert '.sv-' not in CSS_COMMON

# ============================================================================
# 2. 内容 CSS（新写）
# ============================================================================
CSS_BODY = '''

        /* ============================================================
           项目总览 —— 本页专有（2026-09-29 起）
           ⚠️ 类名一律带 `pj-` 前缀（外壳自带一批短类：.main / .card / .seg）。
           ⚠️ **形状照 v2，不重新设计**：`work_project_v2.html`（抽屉版）是用户
              2026-09-25 明确选定、且已经落地到 `/work/projects` 的形态 ——
              外框（内凹柜体）+ 面（白卡）+ 把手三点 + 悬停时面下移 6px。
           ⚠️ 但**材质不照抄**：
              · v2 是毛玻璃 + 极光底衬 + 好几层渐变，本仓已全面纯色化
                ⇒ 外框换实色 + inset 阴影（凹），面换白实底 + 两段小阴影（凸）；
              · **形状靠"轮廓 + 明暗突变"，不靠渐变** —— 凹与凸的区别在
                阴影方向（inset vs drop），不在色号。
           ⚠️ 也**不搬 v2 的项目配色**（`--c` 四支）：那是书脊式的标识色，
              而本页要读的是状态与读数 —— 服务器页已经立过这条判据
              （"给每个项目一支色会让读者以为它在报错"）。一条清单里颜色只能
              承载一种语义，那支留给「逾期」。
           ============================================================ */

        /* 仪表三格里"这一格是异常读数"的那一档（与卡片上的逾期同一支色）。
           ⚠️ 不做成实底胶囊：异常色**只落在文字上**。 */
        .kpi-val.is-late { color: var(--alert-fg); }

        /* 网格：已知 4 个（3 进行中 + 1 归档）⇒ 宽屏两列。
           ⚠️ 下限按**卡内最宽的那一行**算，不按感觉：读数四格各 ≈ 106px
              ⇒ 卡 ≥ 360px 才不折行。 */
        .pj-wall {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
            grid-auto-rows: 1fr;          /* 跨行也要齐（行高各算各的会一高一低） */
            gap: 20px;
            align-items: stretch;
        }
        /* ⚠️ 网格的 `align-items: stretch` **只到网格项那一层**：
           `.pj-group` 这一层得自己 `display:flex`，卡片才过得去，否则一行里有的高有的低。 */
        .pj-group { display: flex; scroll-margin-top: 18px; }

        /* 逾期/异常色：`--alert-fg` 原本只长在 `work_index.html`（工作台）上，
           因为那一页才有"逾期"这个概念；本页按同一口径搬过来
           —— 浅 #B45309 压白 5.0:1，深色必须**翻浅**（深字压深底读不出来）。
           ⚠️ `--border-field`（浅 #7F899B）**不搬**：本页没有输入框、也没有勾选框，
              那支令牌一个消费者都没有。 */
        :root { --alert-fg: #B45309; }
        .dark { --alert-fg: #FBBF24; }

        /* 外框 = 柜体（内凹）。⚠️ `--bg-subtle` 压白卡只有 1.03:1 ⇒ 用悬停那一档；
           凹的线索主要靠 inset 阴影（与卡片的 drop shadow **方向相反**）。 */
        .pj-card {
            flex: 1; min-width: 0;
            display: flex;
            padding: 8px;
            border-radius: 18px;
            background: var(--bg-hover);
            box-shadow: inset 0 2px 5px rgba(15,23,42,0.07), inset 0 -1px 0 rgba(255,255,255,0.85);
            cursor: pointer;
            transition: background 0.3s ease, box-shadow 0.3s ease;
        }
        .dark .pj-card { box-shadow: inset 0 2px 6px rgba(0,0,0,0.36), inset 0 -1px 0 rgba(255,255,255,0.05); }
        .pj-card:hover { background: color-mix(in srgb, var(--m-main) 7%, var(--bg-hover)); }
        .pj-card:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 3px; }

        /* 面 = 抽屉门。悬停整面下移 6px（transform 不重排）。
           ⚠️ 键盘也要能"拉开"——悬停是鼠标的说法，`:focus-visible` 得补一条。 */
        .pj-face {
            flex: 1; min-width: 0;
            display: flex; flex-direction: column;
            padding: 14px 16px;
            border-radius: 12px;
            background: var(--bg-card);
            box-shadow: var(--shadow-card);
            transition: transform 0.45s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.3s ease;
        }
        .pj-card:hover .pj-face,
        .pj-card:focus-visible .pj-face { transform: translateY(6px); box-shadow: var(--shadow-card-hover); }

        /* 把手：三个点。**形状线索不承载信息** —— 均匀、不计数（画成三个"盘位"
           就会被读成"这里有三块盘"）。 */
        .pj-handle { display: flex; justify-content: center; align-items: center; gap: 5px; height: 14px; margin-bottom: 12px; }
        .pj-handle span { width: 5px; height: 5px; border-radius: 50%; background: var(--border-strong); transition: background 0.25s ease; }
        .pj-card:hover .pj-handle span { background: var(--text-muted); }

        /* 卡头：项目名 + 状态胶囊。⚠️ 两个东西也不用 `space-between` ——
           状态要**贴着名字**读，靠 `margin-left:auto` 把它送到右边，别让它飘到正中。 */
        .pj-head { display: flex; align-items: center; gap: 10px; }
        .pj-name { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; color: var(--text-primary); }
        .pj-status {
            margin-left: auto; flex-shrink: 0;
            padding: 2px 9px; border-radius: 999px;
            font-size: 11px; font-weight: 600;
        }
        .pj-status.is-live { background: var(--m-soft); color: var(--m-ink); }
        .pj-status.is-off { background: var(--bg-subtle); color: var(--text-muted); }

        .pj-desc { margin-top: 6px; font-size: 12px; line-height: 1.5; color: var(--text-muted); }

        /* 进度：条 + 数字 + 剩余天数（三者一行，天数靠右）。 */
        .pj-prog { display: flex; align-items: center; gap: 10px; margin-top: 14px; }
        .pj-prog-bar {
            flex: 1; min-width: 40px; height: 6px; border-radius: 3px;
            background: var(--bg-hover);        /* ⚠️ 不是 --bg-subtle：压白卡等于没画 */
            overflow: hidden;
        }
        .pj-prog-bar i { display: block; height: 100%; border-radius: 3px; background: var(--m-main); }
        .pj-prog-num { font-size: 12px; font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
        .pj-due { margin-left: auto; font-size: 11.5px; color: var(--text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
        /* 异常色**只落在文字上**，不涂整行底 —— 一条清单里颜色只承载一种语义 */
        .pj-due.is-late { color: var(--alert-fg); font-weight: 600; }

        /* 读数四格：**每一格都是一扇门**（点它去对应的那一页）。
           ⚠️ 不做成"悬停才出现的图标按钮"：它是**看**的东西 —— 藏在 hover 里
              等于触屏与键盘都看不见；四格常驻，行高也才稳定。 */
        .pj-reads {
            display: grid; grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 10px;
            margin-top: 14px; padding-top: 12px;
            border-top: 1px solid var(--border-subtle);
        }
        .pj-read {
            display: flex; flex-direction: column; gap: 1px;
            min-width: 0;
            font-size: 11px; color: var(--text-muted);
            text-decoration: none;
            transition: color 0.18s ease;
        }
        .pj-read b {
            font-size: 15px; font-weight: 700; line-height: 1.25;
            color: var(--text-primary);
            font-variant-numeric: tabular-nums;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pj-read:hover b { color: var(--m-ink); }
        .pj-read:hover { color: var(--text-secondary); }
        .pj-read:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; border-radius: 6px; }
        .pj-read.is-late b { color: var(--alert-fg); }

        /* 归档卡：读数行换成一句话（它不进任何统计，也不占手）。
           ⚠️ 卡片仍然等高：正文段 `flex:1` + 卡脚 `margin-top:auto`。 */
        .pj-card.is-off { opacity: 0.72; }
        .pj-card.is-off:hover, .pj-card.is-off:focus-visible { opacity: 1; }
        .pj-off-note {
            margin-top: 14px; padding-top: 12px;
            border-top: 1px solid var(--border-subtle);
            font-size: 11.5px; color: var(--text-muted);
        }

        /* 卡脚：最近更新 + **唯一的动作入口**。 */
        .pj-foot { display: flex; align-items: center; gap: 10px; margin-top: auto; padding-top: 14px; }
        .pj-updated { font-size: 11.5px; color: var(--text-muted); }
        .pj-foot .btn { margin-left: auto; }

        /* 定位到某个项目时的短闪（与任务页同一套） */
        .pj-card.is-spot { animation: pjSpot 1.6s ease; }
        @keyframes pjSpot {
            0%   { box-shadow: inset 0 0 0 2px var(--m-main), inset 0 2px 5px rgba(15,23,42,0.07); }
            100% { box-shadow: inset 0 2px 5px rgba(15,23,42,0.07); }
        }

        @media (max-width: 760px) {
            .pj-wall { grid-template-columns: 1fr; }
        }
        @media (max-width: 560px) {
            .pj-reads { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px 10px; }
        }
'''

# ============================================================================
# 3. 数据 + 内容 DOM
# ============================================================================
# 项目的**元信息**：这一份就是"我手上有哪些项目"的事实源，页面上的每一处
# 数字都从它现算。⚠️ 顺序 = 页面顺序 = 圆盘顺序：进行中按「还剩多少天」升序
# （最紧的在前），已归档沉到最后。
PROJECTS = [
    # slug, 名称, 图标, 状态, 进度, 还剩天数(None=已归档), 待办, 逾期, 机器, 生产,
    # 发布版本, 发布文案, 发布成功, 最近更新, 定位一句话
    ('dash', '数据看板', 'graph', 'live', 80, 1, 3, 1, 2, 1, 'v0.9.2', '上周三 16:20', True, '昨天', ),
    ('pay', '支付系统重构', 'project', 'live', 62, 25, 6, 2, 2, 2, 'v2.3.1', '昨天 14:30', True, '昨天', ),
    ('uc', '用户中心改版', 'users', 'live', 38, 47, 5, 0, 2, 1, 'v1.8.0-rc3', '3 天前', True, '3 天前', ),
    ('perf', '性能优化专项', 'archive', 'off', 20, None, 0, 0, 0, 0, '', '', True, '2026-08-14', ),
]
DESCS = {
    'dash': '指标口径与看板搭建：Web 与测试各一台机器',
    'pay': '支付链路的改造：Web 层与数据库层各一台机器，另有对账脚本',
    'uc': '用户中心的改版：生产一台、测试一台机器',
    'perf': '首屏与打包体积的专项 —— 这一轮先搁着，等支付那边收口',
}

# 页内跳转（原型只有这几页，都指向同一个文件；真接数据时换成带 id 的 URL）
URL_TASK = '工作-任务-总览-index.html'
URL_SERVER = '工作-项目-服务器-index.html'
URL_OPS = '工作-项目-项目详情-运维-index.html'
URL_DETAIL = 'work_product-detail.html'


def card_html(p):
    slug, name, icon, state, prog, left, todo, late, srv, prod, ver, when, ok, upd = p[:14]
    desc = DESCS[slug]
    status = ('<span class="pj-status is-live">进行中</span>' if state == 'live'
              else '<span class="pj-status is-off">已归档</span>')
    due_cls = 'pj-due is-late' if (left is not None and left <= 3) else 'pj-due'
    due = ('还剩 %d 天' % left) if left is not None else '已收尾'
    prog_row = (
        '                    <div class="pj-prog">\n'
        '                        <span class="pj-prog-bar" aria-hidden="true"><i style="width:%d%%"></i></span>\n'
        '                        <span class="pj-prog-num">%d%%</span>\n'
        '                        <span class="%s">%s</span>\n'
        '                    </div>\n' % (prog, prog, due_cls, due)
    )
    if state == 'live':
        reads = (
            '                    <div class="pj-reads">\n'
            '                        <a class="pj-read" href="%s" onclick="event.stopPropagation()">待办 <b>%d</b></a>\n'
            '                        <a class="pj-read%s" href="%s" onclick="event.stopPropagation()">逾期 <b>%d</b></a>\n'
            '                        <a class="pj-read" href="%s" onclick="event.stopPropagation()">机器 <b>%d</b></a>\n'
            '                        <a class="pj-read" href="%s" onclick="event.stopPropagation()">发布 <b>%s</b></a>\n'
            '                    </div>\n'
            % (URL_TASK, todo, ' is-late' if late else '', URL_TASK, late,
               URL_SERVER, srv, URL_OPS, ver)
        )
    else:
        reads = ('                    <div class="pj-off-note">已归档 · 不占手，也不进上面那三格的统计</div>\n')

    return (
        '        <section class="pj-group" data-section="%s">\n'
        '            <div class="pj-card%s" role="button" tabindex="0" data-project="%s"\n'
        '                 title="进入「%s」"\n'
        '                 onclick="openProject(\'%s\')" onkeydown="cardKey(event,\'%s\')">\n'
        '                <div class="pj-face">\n'
        '                    <div class="pj-handle" aria-hidden="true"><span></span><span></span><span></span></div>\n'
        '                    <div class="pj-head">\n'
        '                        <span class="pj-name">%s</span>\n'
        '                        %s\n'
        '                    </div>\n'
        '                    <p class="pj-desc">%s</p>\n'
        '%s'
        '%s'
        '                    <div class="pj-foot">\n'
        '                        <span class="pj-updated">最近更新 %s</span>\n'
        '                        <button class="btn btn-primary btn-sm" type="button"\n'
        '                                onclick="event.stopPropagation();openProject(\'%s\')">进入项目</button>\n'
        '                    </div>\n'
        '                </div>\n'
        '            </div>\n'
        '        </section>\n'
    ) % (slug, ' is-off' if state == 'off' else '', slug, name,
         slug, slug, name, status, desc, prog_row, reads, upd, slug)


CARDS = [card_html(p) for p in PROJECTS]

MAIN_DOM = '''
    <div class="main-wrap">
        <main class="main">
        <div class="detail">

            <!-- ========== 页头 ==========
                 本页横跨全部项目 ⇒ 没有单一实体可以挂那块可折叠 Hero。
                 标题回答"这是什么"，副标题只回答"这一页管什么"（**不写计数** ——
                 那些数字在仪表条与每张卡的读数里各有其位）。 -->
            <header class="page-head">
                <div>
                    <h1 class="ph-title">项目总览</h1>
                    <p class="ph-sub">手上有哪些项目、各自到哪一步了 —— 要动手，就从这里进去。</p>
                </div>
                <div class="ph-actions">
                    <span class="last-sync" id="lastSync">最后更新 09:00</span>
                    <button class="btn btn-primary btn-sm" type="button" onclick="newProject()">
                        <span aria-hidden="true" data-ico="plus" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg></span> 新建项目
                    </button>
                </div>
            </header>

            <!-- ========== 页面级仪表（三格） ==========
                 三格都回答一件"动手前要确认的事"，且都是**跨项目**的读数：
                   ① 进行中 N / M 个 —— 别把已归档的当成还在手上的活
                   ② 30 天内到期 N 个 —— 别让 deadline 悄悄过去
                   ③ 有欠账 N 个 —— 哪个项目拖着没动（异常位）
                 ⚠️ 与每张卡上的数字**不是重复**：卡上回答"这个项目怎么样"，
                    仪表回答"我下一步动手前要知道什么"（同一条判据见服务器页
                    仪表条不含"机器总数"）。 -->
            <div class="kpi-bar">
                <div class="kpi">
                    <div class="kpi-top"><span class="kpi-ico" aria-hidden="true" data-ico="play" data-ico-size="15"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 4.5v15l12-7.5z"/></svg></span><span class="kpi-label">进行中</span></div>
                    <div class="kpi-val"><span id="kpiLive">3</span><span class="kpi-unit">/ <span id="kpiAll">4</span> 个</span></div>
                    <div class="kpi-sub" id="kpiLiveSub">已归档 1 个不计入</div>
                </div>
                <div class="kpi">
                    <div class="kpi-top"><span class="kpi-ico" aria-hidden="true" data-ico="calendar" data-ico-size="15"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg></span><span class="kpi-label">30 天内到期</span></div>
                    <div class="kpi-val is-late"><span id="kpiSoon">2</span><span class="kpi-unit">个</span></div>
                    <div class="kpi-sub" id="kpiSoonSub">最紧的「数据看板」还剩 1 天</div>
                </div>
                <div class="kpi">
                    <div class="kpi-top"><span class="kpi-ico" aria-hidden="true" data-ico="alert" data-ico-size="15"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3.5 21 19H3z"/><path d="M12 9.5v4"/><path d="M12 16.4h.01"/></svg></span><span class="kpi-label">有欠账</span></div>
                    <div class="kpi-val is-late"><span id="kpiLateN">2</span><span class="kpi-unit">个</span></div>
                    <div class="kpi-sub" id="kpiLateSub">数据看板 · 支付系统重构</div>
                </div>
            </div>

            <!-- ========== 项目卡片墙（同页并列、全部可见） ==========
                 ⚠️ 圆盘上的分区 = **项目**（从 PROJECTS 现算）——判据与服务器页逐字相同：
                    这些项目**能不能同时成立**？能（它们是同一件事的不同归属，
                    三个项目各自的读数本来就要一起看）⇒ 定位 + 随滚动同步，不做 display 切换。
                 ⚠️ 与任务页的**关键差别**：任务页的分区是"格子"（空桶要留着，
                    因为"逾期是空的"本身就是信息）；项目是"数据里分出来的组" ——
                    删掉一个项目，它那一格就该从圆盘上消失。
                 ⚠️ 本页**不配筛选栏**：4 张卡一屏放得下，筛选器省的是滚动距离
                    不是点击 ⇒ 加了只是噪声（判据：一屏放得下的清单不配筛选）。
                    已归档的那一张靠"沉到最后 + 降饱和"区分，不靠筛选。 -->
            <div class="pj-wall">
__CARDS__
            </div>

        </div>
        </main>
    </div>
</div>
'''
MAIN_DOM = MAIN_DOM.replace('__CARDS__', '\n'.join(CARDS))

# ============================================================================
# 4. JS：数据段（新写）
# ============================================================================
JS_DATA = '''
    /* ============================================================
       数据
       —— 原型没有后端，这一份就是"我手上有哪些项目"的事实源。
          **页面上的每一处数字都从它现算**（仪表三格 / 圆盘悬停名称条 /
          侧栏副标题 / 命令面板）—— 改一个 `left`，不会有哪一处还说着旧数。
       ⚠️ 卡面上的读数（待办 / 逾期 / 机器 / 发布）是**静态标记**里写好的：
          它们是项目的"属性"，六个数字里只有跨项目那三格需要现算。
       ⚠️ `left` 是**还剩多少天**（相对今天），不是绝对日期 —— 写死日期的话，
          这份原型过两天再看，"还剩 1 天"就变成假的了。
       ⚠️ 顺序 = 页面顺序 = 圆盘顺序：进行中按剩余天数升序（最紧的在前），
          已归档沉到最后。
       ============================================================ */
    const PROJECTS = [
        { slug: 'dash', name: '数据看板',     icon: 'graph',   state: 'live', progress: 80, left: 1,    late: 1 },
        { slug: 'pay',  name: '支付系统重构', icon: 'project', state: 'live', progress: 62, left: 25,   late: 2 },
        { slug: 'uc',   name: '用户中心改版', icon: 'users',   state: 'live', progress: 38, left: 47,   late: 0 },
        { slug: 'perf', name: '性能优化专项', icon: 'archive', state: 'off',  progress: 20, left: null, late: 0 }
    ];

    const URL_DETAIL = 'work_product-detail.html';

    /* ============================================================
       导航壳的分区 = 项目（**现算**）
       ⚠️ 写死一份常量就会出现"某个项目归档之后，圆盘上还留着一格空的"。
       count 会拼进悬停名称条（圆盘上只有图标，计数是"值不值得点"的唯一线索）
       —— 这里给**进度**，它是项目卡片上唯一的"量"。
       ⚠️ 与任务页**正相反**的一处：那边的时间桶是**格子**（空桶要留着，
          "逾期是空的"本身就是信息）；这边的项目是**分组** —— 没有了就该消失。
       ============================================================ */
    let SECTIONS = PROJECTS.map(function (p) {
        return {
            key: p.slug, label: p.name, icon: p.icon,
            count: p.progress + '%',
            desc: p.state === 'off' ? '已归档' : '还剩 ' + p.left + ' 天',
            state: p.state, left: p.left, late: p.late
        };
    });

    function sectionCount(sec) { return sec.count || ''; }
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
       项目总览的交互 —— 只有三件：跨项目统计、定位、进出
       ⚠️ 卡面的数字是**静态标记**（预览面板走静态 HTML 视图，主内容不许依赖脚本）
          ⇒ 这里不重建任何一张卡。
       ⚠️ 卡片是 `role="button"`，Enter / Space 得自己接（`<div>` 不会替你做这件事）。
       ============================================================ */

    const groupEl = slug => document.querySelector('.detail [data-section="' + slug + '"]');
    const cardEl = slug => { const g = groupEl(slug); return g ? g.querySelector('.pj-card') : null; };
    const secOf = slug => SECTIONS.filter(s => s.key === slug)[0];
    const nameOf = slug => { const s = secOf(slug); return s ? s.label : slug; };

    /* ---------- 唯一的统计函数 ----------
       只算**跨项目**的三格（卡面上的读数是静态的）。
       ⚠️ 对空数据集取值必须有护栏：一个进行中的项目都没有时 `sort()[0]` 是
          undefined —— 不加护栏会整条 sync 断在中间，后面每一处都停在旧值，
          **而页面不报任何错**。 */
    function syncCounts() {
        const live = PROJECTS.filter(p => p.state === 'live');
        const soon = live.filter(p => p.left !== null && p.left <= 30).sort((a, b) => a.left - b.left);
        const late = live.filter(p => p.late > 0).sort((a, b) => b.late - a.late);
        const put = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        /* 异常色跟着"有没有"走：一条都没有时那一格要退回普通读数（否则是假警报） */
        const lateBox = id => { const el = document.getElementById(id); return el ? el.parentElement : null; };

        put('kpiLive', live.length);
        put('kpiAll', PROJECTS.length);
        put('kpiLiveSub', '已归档 ' + (PROJECTS.length - live.length) + ' 个不计入');

        put('kpiSoon', soon.length);
        put('kpiSoonSub', soon.length
            ? '最紧的「' + soon[0].name + '」还剩 ' + soon[0].left + ' 天'
            : '30 天内没有到期的');
        const sBox = lateBox('kpiSoon');
        if (sBox) sBox.classList.toggle('is-late', soon.length > 0);

        put('kpiLateN', late.length);
        put('kpiLateSub', late.length
            ? late.slice(0, 2).map(p => p.name).join(' · ') + (late.length > 2 ? ' 等' : '')
            : '没有拖着没动的项目');
        const lBox = lateBox('kpiLateN');
        if (lBox) lBox.classList.toggle('is-late', late.length > 0);

        syncChrome(false);
    }

    /* ---------- 进出一个项目 ----------
       整卡点击与卡脚那枚按钮走同一条路（一件事只有一处实现）。
       原型里项目详情只有一页；真接数据时换成带 id 的 URL（`?project=<slug>`）。 */
    function openProject(slug) {
        location.href = URL_DETAIL;          /* slug 现在没用上，接真数据时换 ?project=<slug> */
    }

    /* `role="button"` 的键盘契约：Enter / Space 要自己接。
       ⚠️ 只认"焦点就在卡片自己身上"—— 卡里的四格读数是 `<a>`，在它们身上按 Enter
          会同时触发链接的默认行为与这里的 `openProject`（一次按键跳两次）。 */
    function cardKey(e, slug) {
        if (e.target !== e.currentTarget) return;
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        openProject(slug);
    }

    function newProject() { toast('原型演示：新建项目（这一页还没有表单）', 'info'); }

    /* ---------- 侧栏「最近」/ 命令面板的定位落点 ---------- */
    function focusProject(slug) {
        const card = cardEl(slug);
        if (!card) return;
        activatePanel(slug);
        card.classList.remove('is-spot');
        void card.offsetWidth;           /* 强制回流：连着点两次也要重放动画 */
        card.classList.add('is-spot');
        const s = secOf(slug);
        toast('已定位到：' + nameOf(slug) + (s ? '（' + s.count + '）' : ''), 'info');
    }

    /* 「看欠账」那颗快捷按钮的落点：**现算**第一个有欠账的项目 ——
       写死一个 slug 就会在它被收口之后，指着某个根本没欠账的项目。 */
    function focusLate() {
        const p = PROJECTS.filter(x => x.state === 'live' && x.late > 0).sort((a, b) => b.late - a.late)[0];
        if (!p) { toast('没有拖着没动的项目', 'ok'); return; }
        focusProject(p.slug);
    }

    /* ---------- 刷新：更新"最后更新" + 重算一遍读数 ---------- */
    function stamp() {
        const now = new Date();
        const el = document.getElementById('lastSync');
        if (el) el.textContent = '最后更新 ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    }
    function refreshAll() {
        stamp();
        syncCounts();
        toast('已重新检查全部项目', 'ok');
    }

    /* ---------- 一次把页面立起来 ----------
       ⚠️ 顺序不能反：图标要在 DOM 就位之后灌（先灌等于灌了个空容器）；
          计数要在图标之后（仪表的文本节点由它写）。 */
    function renderAll() {
        paintIcons(document);
        syncCounts();
        renderCmdList();
        stamp();
    }
'''

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
        '    <!-- ========== 侧栏（圆盘 = 本页的项目，**从数据现算**） ========== -->')
D = rep(D, '<span class="name" id="sidebarTitle">服务器</span>',
        '<span class="name" id="sidebarTitle">项目</span>')
# ⚠️ 副标题的初值带着**服务器页当前的数据**（"… · 3 台"那种）—— 把那个数写死在
#    锚点里，源页数据一变（2 台 → 3 台）这里就静默失效 ⇒ 用正则整段换掉，别赌那个数。
D, _n = re.subn(r'<div class="sidebar-subtitle" id="sidebarSubtitle">[^<]*</div>',
                '<div class="sidebar-subtitle" id="sidebarSubtitle">数据看板 · 80%</div>', D)
assert _n == 1, '侧栏副标题没换到（找到 %d 处）' % _n

# 顶栏「任务」胶囊上那个计数徽标说的是任务模块的事，与本页无关 ⇒ 摘掉；
# 「工作」那一枚改成"有欠账的项目数"，并补 title 说清它是什么。
D = rep(D, """                    <span class="nav-p-text">任务</span>
                    <span class="nav-p-badge">5</span>""",
        """                    <span class="nav-p-text">任务</span>""")
D = rep(D, """                    <span class="nav-p-text">工作</span>
                    <span class="nav-p-badge warn">2</span>""",
        """                    <span class="nav-p-text">工作</span>
                    <span class="nav-p-badge warn" title="2 个项目有欠账">2</span>""")

RECENT_OLD = seg2('                    <!-- 最近：最近动过的机器。带的是**机器名**（不是分区名）——',
                  '                    <!-- 快捷：')
RECENT_NEW = '''                    <!-- 最近：最近动过的**项目**。带的是项目名（不是分区名）——
                         这一槽回答的是"我刚才在弄哪个项目"，不是"我滚到哪一节了"。 -->
                    <div class="slot-panel active" data-panel="recent">
                        <button class="recent-item" type="button" onclick="focusProject('dash')">
                            <span class="recent-icon" aria-hidden="true" data-ico="graph" data-ico-size="11"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M4 19.5V14M10 19.5V8M16 19.5v-9M22 19.5v-3"/><path d="M2 21.5h20"/></svg></span>
                            <span class="recent-text">数据看板</span>
                            <span class="recent-time">昨天</span>
                        </button>
                        <button class="recent-item" type="button" onclick="focusProject('pay')">
                            <span class="recent-icon" aria-hidden="true" data-ico="project" data-ico-size="11"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 7l9-4 9 4-9 4-9-4z"/><path d="M3 12l9 4 9-4"/><path d="M3 17l9 4 9-4"/></svg></span>
                            <span class="recent-text">支付系统重构</span>
                            <span class="recent-time">昨天</span>
                        </button>
                        <button class="recent-item" type="button" onclick="focusProject('uc')">
                            <span class="recent-icon" aria-hidden="true" data-ico="users" data-ico-size="11"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="9" cy="8" r="3.4"/><path d="M2.6 20c0-3.5 2.9-5.6 6.4-5.6s6.4 2.1 6.4 5.6"/><path d="M16.5 5.2a3.4 3.4 0 0 1 0 6.6M18 14.8c2.2.6 3.6 2.2 3.6 5.2"/></svg></span>
                            <span class="recent-text">用户中心改版</span>
                            <span class="recent-time">3 天前</span>
                        </button>
                    </div>

'''
D = D.replace(RECENT_OLD, RECENT_NEW)

QUICK_OLD = seg2('                    <!-- 快捷：四个各干一件事的入口。不放"删机器 / 移机器"这类破坏性动作 ——',
                 '                    <!-- AI：')
QUICK_NEW = '''                    <!-- 快捷：四个各干一件事的入口。不放"归档 / 删除项目"这类破坏性动作 ——
                         它们只该出现在那个项目自己的详情里（错一个就是把整摊事收走了）。 -->
                    <div class="slot-panel" data-panel="quick">
                        <div class="quick-grid">
                            <button class="quick-btn" type="button" onclick="newProject()">
                                <span aria-hidden="true" data-ico="plus" data-ico-size="12"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg></span>
                                新建项目
                            </button>
                            <button class="quick-btn" type="button" onclick="focusLate()">
                                <span aria-hidden="true" data-ico="alert" data-ico-size="12"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3.5 21 19H3z"/><path d="M12 9.5v4"/><path d="M12 16.4h.01"/></svg></span>
                                看欠账
                            </button>
                            <button class="quick-btn" type="button" onclick="location.href='工作-项目-服务器-index.html'">
                                <span aria-hidden="true" data-ico="server" data-ico-size="12"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/></svg></span>
                                去看机器
                            </button>
                            <button class="quick-btn" type="button" onclick="openCmd()">
                                <span aria-hidden="true" data-ico="keyboard" data-ico-size="12"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6.5 10h.01M10.2 10h.01M13.9 10h.01M17.6 10h.01M8.4 14h7.2"/></svg></span>
                                命令面板
                            </button>
                        </div>
                    </div>

'''
D = D.replace(QUICK_OLD, QUICK_NEW)

AI_OLD = seg2('                    <!-- AI：示例对话跟着这一页的口径走（找机器 → 连上 → 去动手）。',
              '                </div>\n            </div>\n\n            <div class="sidebar-foot">')
AI_NEW = '''                    <!-- AI：示例对话跟着这一页的口径走（哪个紧 → 各自到哪一步 → 去哪动手）。
                         原来那版问的是"这台测试机在上什么版本"，而那台机器在这一页上不存在
                         ⇒ 那会是一句页面上没有依据的话。 -->
                    <div class="slot-panel" data-panel="ai">
                        <div class="ai-chat">
                            <div class="ai-msg bot">「数据看板」明天到期，还有 1 件逾期，要先进去看吗？</div>
                            <div class="ai-msg user">支付那边呢</div>
                            <div class="ai-msg bot">支付系统重构 62%，6 件待办、2 件逾期；两台机器都在生产，最近一次发布是昨天。</div>
                        </div>
                        <div class="ai-input">
                            <input type="text" placeholder="问点什么…" />
                            <button class="ai-send" type="button" aria-label="发送">
                                <span aria-hidden="true" data-ico="chevR" data-ico-size="12"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="m9.5 6 6 6-6 6"/></svg></span>
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
     工作 · 项目 · 总览（`工作-项目-总览-index.html`）
     ----------------------------------------------------------------------------
     这是**全部项目的台账页**：一屏回答「我手上有哪些项目、各自到哪一步了、
     要动手该进哪一个」。

     ⚠️ 它与另外三页的分工（别把其中任何一页的活搬过来）：
          · `work_index.html`（工作台）—— 常用三样的**入口**；
          · **本页** —— 全部项目的读数与门；
          · `工作-项目-服务器-index.html` —— 全部项目下的**机器**（在哪、连上没有）；
          · `work_product-detail.html` —— **一个项目**的详情（本页每张卡都通向它）。
        ⇒ 本页**不重复**服务器页的机器清单，只给"这个项目有几台"那一个数；
           "是哪几台、在哪、连上没有"是服务器页的事 —— 卡片上那一格就是门。

     ⚠️ 形状照 `work_project_v2.html`（**抽屉版**）：用户 2026-09-25 用它替换了
        书架版（v1），且已经落地到 `/work/projects` ⇒ 这是**用户选定过的形态**，
        不重新设计。留下的是那三样：外框（内凹柜体）+ 面（白卡）+ 悬停面下移。
        ⚠️ 但**材质不照抄**：v2 是毛玻璃 + 极光底衬 + 好几层渐变，本仓已全面纯色化
           ⇒ 外框换实色 + inset 阴影（凹），面换白实底 + 两段小阴影（凸）。
           **形状靠"轮廓 + 明暗突变"，不靠渐变** —— 凹与凸的区别在阴影方向，
           不在色号。
        ⚠️ 也**不搬 v2 的项目配色**（`--c` 四支）：服务器页已经立过这条判据
           （"给每个项目一支色会让读者以为它在报错"）。一条清单里颜色只能承载
           一种语义，那支留给「逾期」。

     ⚠️ 圆盘上的分区 = **项目**（从数据现算）—— 与服务器页逐字同构，判据也同一句：
        这几个分区**能不能同时成立**？能（它们本来就是同一件事的不同归属，
        各自的读数要一起看）⇒ 定位 + 当前项随滚动同步，不做 display 互斥切换。
        ⚠️ 与任务页**正相反**的一处：那边的时间桶是**格子**（空桶要留着，
           "逾期是空的"本身就是信息）；这边的项目是**分组** —— 没有了就该从圆盘消失。

     ⚠️ 顶部三格是**页面级仪表**，只放**跨项目**的读数（进行中 / 30 天内到期 /
        有欠账）。它与每张卡上的数字**不是重复**：卡上回答"这个项目怎么样"，
        仪表回答"我动手前要知道什么"（同一条判据见服务器页仪表条不含"机器总数"）。

     ⚠️ 本页**不配筛选栏**：4 张卡一屏放得下，筛选器省的是滚动距离不是点击
        ⇒ 加了只是噪声。已归档那一张靠"沉到最后 + 降饱和"区分，不靠筛选。

     材质 / 令牌 / 图标 / 导航壳**逐字承接**服务器页与任务页（本仓当前口径）：
       · 面阶四档、强调色三档（--m-main 图形 / --m-ink 文字 / --m-fill 实底）、描边两档；
       · 逾期只用 `--alert-fg`，且只落在文字上，不涂整行底；
       · 图标一套制：一张 ICON 表 + `svgIcon / paintIcons / setIcon`，全页无 emoji；
       · 导航壳 = design/index/导航-v5.html 的导航段 + 三处偏差（不自动下钻 /
         一级模块只有「工作」可进 / 页头只放路径）。
       · ⚠️ `--border-field`（浅 #7F899B）**没有搬进来**：本页既没有输入框、
         也没有勾选框，那支令牌一个消费者都没有 —— 留一个没人消费的令牌
         等于留一份"看着像事实源、其实没人用"的第二描述。
     ---------------------------------------------------------------------------- -->
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>项目 · 工作</title>
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
    + JS_INIT
    + '</script>\n</body>\n</html>\n'
)

OUT.write_text(HTML, encoding='utf-8')
print('写出 %s：%d 行 / %d 字节' % (OUT.name, HTML.count('\n') + 1, len(HTML.encode('utf-8'))))


# ---------------------------------------------------------------------------
# 本项目专有的收尾断言：确认该走的都走了、该留的都留了
# ---------------------------------------------------------------------------
for _bad in ('tk-', 'TASKS', 'DONE_IDS', 'filterProject', 'bucketOf', '顺延'):
    assert _bad not in HTML, '还残留任务页的东西：%s' % _bad
for _need in ('.pj-card', 'pj-reads', 'data-section="dash"', 'focusProject', 'syncCounts'):
    assert _need in HTML, '缺了本页的东西：%s' % _need
print('  收尾断言通过（无任务页残留、项目页要素齐全）')
