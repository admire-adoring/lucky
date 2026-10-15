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
OUT = HERE / '工作-任务-总览-index.html'

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
    (1432, 1459, '.chip-group'),       # 胶囊 + 空态
    (1460, 1533, '.modal-mask'),       # 弹窗 + Toast
    (1535, 1538, '::-webkit-scrollbar'),   # 全局滚动条
    (1551, 1573, '@media (max-width: 980px)'),  # 响应式（已剔掉服务器页专有条目）
    (1575, 1592, '.page-head'),        # 页头（段注释头 → .ph-actions 止）
    (1608, 1647, '.filter-bar'),       # 筛选栏（只取规则段）
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
CSS_COMMON = rep(CSS_COMMON, '        .filter-bar {',
                 '''        /* ============================================================
           筛选栏：**只给另一个维度**
           —— 本页按时间分成五个桶 ⇒ 筛的只能是项目（按什么分组就别筛那个维度）。
           只有一排，所以不需要服务器页那套切视角时另一个维度归零。
           ⚠️ 圆盘（时间）与筛选（项目）是两个正交维度，谁也藏不住谁 ⇒
              不存在滚到一个 display:none 的元素上、点下去没反应那次死点击。
           ⚠️ 胶囊沿用参考页那一套 `.chip`（选中 = 白实底 + inset 0 0 0 1px 主题色描边）——
              底色差单独只有 1.08:1，撑不起选中。
           ============================================================ */
        .filter-bar {''')

# 筛选栏脚那条注释指着一个服务器页的类（本页没有 `.sv-foot`）
CSS_COMMON = rep(CSS_COMMON, ' ⇒ 与卡片脚（`.sv-foot`）用同一档。', '。')
# 筛选栏里"机器名走等宽"那条（本页筛的是项目，不是标识符）
CSS_COMMON = rep(CSS_COMMON, """        /* 机器名是**标识符**，走等宽 —— 与行上那个机器名同一种字体，
           扫一眼就知道"这一排说的是机器，不是项目"。 */
        .filter-row.is-server .chip {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 11.5px; letter-spacing: -0.01em;
        }
""", '')

# ⚠️ 有两处**段边界收在规则中间**（`.page-head` 段的尾巴停在 `.ph-actions {`、
#    `.filter-bar` 段的尾巴停在 `.filter-reset {` 的第二行）⇒ 产物里这两条规则缺体、缺 `}`。
#    **少一个 `}` 不是"少一条样式"**：浏览器会按"下一个 `}`"闭合它，
#    于是它**后面**的整段 CSS 全部错位一格（`.tk-*` 那批样式实际上没生效）。
#    ⇒ 按服务器页原文补回来。段边界不动 —— 它是有意的（要切掉服务器页专有的那几行）。
CSS_COMMON = rep(CSS_COMMON, '''        .ph-actions {
           ⚠️ 两个维度是**同一份状态的两个入口**（筛选栏 / 圆盘定位），不是两处表达：
              点圆盘上一个被筛掉的项目时，`activatePanel()` 会先把项目筛选放开。
           ⚠️ 胶囊沿用参考页那一套 `.chip`（选中 = 白实底 + inset 0 0 0 1px 主题色描边）——
              底色差单独只有 1.08:1，撑不起"选中"。
           ============================================================ */
''', '''        .ph-actions {
            display: flex; align-items: center; gap: 12px; flex-shrink: 0;
            flex-wrap: wrap; justify-content: flex-end;
        }
''')

CSS_COMMON = rep(CSS_COMMON, '''        .filter-reset {
            margin-left: auto; padding: 0; border: none; background: none;
''', '''        .filter-reset {
            margin-left: auto; padding: 0; border: none; background: none;
            font-family: inherit; font-size: 11.5px; font-weight: 700;
            color: var(--rc-fg); cursor: pointer; white-space: nowrap;
        }
        .filter-reset:hover { text-decoration: underline; text-underline-offset: 2px; }
        .filter-reset:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; border-radius: 4px; }
''')

assert 'server-action-btn' not in CSS_COMMON
assert 'is-server' not in CSS_COMMON
assert '.sv-' not in CSS_COMMON

# ============================================================================
# 2. 内容 CSS（新写）
# ============================================================================
CSS_BODY = '''

        /* ============================================================
           任务总览 —— 本页专有（2026-09-29 起）
           ⚠️ 类名一律带 `tk-` 前缀：外壳自带一批短类（.main / .card / .seg / .chip），
              本仓踩过"单字母 / 超短类名迟早撞"（`.k` / `.v`）。
           ⚠️ 行表示（两行文字 + 行尾一列时间）**沿用工作台那一套**
              （`work_index.html` 的 `.dash-row / .dash-row-name / .dash-row-meta / .dash-when`），
              但改名 `tk-*`：两个文件里各有一份同名类，日后对照会分不清"改的是哪一份"
              （跨文件同名类是 prototype-revision-sync 里十三类静默失效之一）。
           ============================================================ */

        /* 勾选框要做成"形状"，`--border-subtle`(7% 黑，只够分隔相邻区域)撑不起来
           ⇒ 单给一支 ≥3:1 的场域描边。
           ⚠️ `--alert-fg`（逾期那一支异常色）在服务器页**没有** —— 它原本只长在
              `work_index.html`（工作台）上，因为那一页才有"逾期"这个概念。
              本页把这条口径原样搬过来：浅 #B45309 压白 5.0:1，深色必须翻浅
              （深字压深底读不出来）。 */
        :root {
            --alert-fg: #B45309;
            --border-field: #7F899B;
        }
        .dark {
            --alert-fg: #FBBF24;
            --border-field: rgba(255,255,255,0.36);
        }

        /* 页面级仪表：三格，各自回答一件"动手前要确认的事"
            ① 进行中 N 件 —— 手上还开着几件
            ② 本周完成 N 件 —— 这一周推得怎么样
            ③ 最久的欠账 N 天 —— 有没有正在烧的火（异常位）
           ⚠️ 三格**都与五个时间桶正交**（桶是"时间"维，这三格是"状态 / 完成 / 异常"维）
              ⇒ 不与任何块头计数重复。这正是服务器页仪表条不含"机器总数"的同一条判据：
              同一个数字只在一处表达。 */
        .kpi-val.is-late { color: var(--alert-fg); }

        /* ---- 分区（时间桶）----
           五个块**同页并列、全部可见**：它们是不相交的五批任务，
           "总览"这件事本身就是"五批一起看"。
           ⇒ 圆盘只做「定位 + 当前项随滚动同步」，绝不做 display 互斥切换
              （把四块藏到一个只有图标的圆盘后面 = 内容失踪，不是分区）。
           判据（与服务器页同一句）：这几个分区**能不能同时成立**？能。 */
        .tk-group { scroll-margin-top: 18px; }
        .tk-group + .tk-group { margin-top: 22px; }

        /* 块头 = 图标 + 名称 + 计数 + 一条贯穿的细线 + 一句"这一格管什么"。
           ⚠️ 四个东西 ⇒ 不能用 `justify-content: space-between`（它会把中间那个推到正中）；
              用 `gap` + 让"说明"`margin-left:auto`。 */
        .tk-head { display: flex; align-items: center; gap: 9px; margin-bottom: 4px; }
        .tk-ico {
            width: 24px; height: 24px; border-radius: 8px; flex-shrink: 0;
            background: var(--bg-subtle); color: var(--text-secondary);
        }
        .tk-name {
            font-size: 12.5px; font-weight: 700; letter-spacing: 0.03em;
            color: var(--text-primary); white-space: nowrap;
        }
        /* 逾期是**唯一**允许出现的异常色，且只落在块头名字与行尾时间标记上，
           不涂整行底 —— 一条列表里颜色只能承载一种语义。 */
        .tk-group.is-late .tk-ico { background: var(--warn-bg); color: var(--alert-fg); }
        .tk-group.is-late .tk-name { color: var(--alert-fg); }
        .tk-count { font-size: 11.5px; color: var(--text-muted); white-space: nowrap; font-variant-numeric: tabular-nums; }
        .tk-rule { flex: 1; height: 1px; min-width: 12px; background: var(--border-subtle); }
        .tk-desc { font-size: 11.5px; color: var(--text-muted); margin-left: auto; white-space: nowrap; }

        /* ---- 行 ----
           两行文字 + 行尾一列（时间，定宽右对齐 ⇒ 行尾排成一列，扫读不必逐行找）。
           负外距：悬停底色向外扩，行内文字仍与块头对齐（不靠内距撑）。 */
        .tk-row {
            display: flex; align-items: center; gap: 10px;
            padding: 9px 10px; margin: 0 -10px;
            border-radius: 10px;
            transition: background 0.18s ease;
        }
        .tk-row:hover { background: var(--bg-hover); }
        .tk-row.is-spot { animation: tkSpot 1.4s ease; }
        @keyframes tkSpot {
            0%   { background: color-mix(in srgb, var(--m-main) 16%, transparent); }
            100% { background: transparent; }
        }

        .tk-check {
            width: 18px; height: 18px; flex-shrink: 0;
            border-radius: 6px; border: 1.5px solid var(--border-field);
            background: var(--bg-card);
            cursor: pointer; padding: 0;
            display: flex; align-items: center; justify-content: center;
            color: transparent;
            transition: background 0.18s ease, border-color 0.18s ease, color 0.18s ease;
        }
        .tk-check:hover { border-color: var(--m-main); }
        .tk-check svg { width: 12px; height: 12px; stroke-width: 3; }
        .tk-check[aria-pressed="true"] { background: var(--m-fill); border-color: var(--m-fill); color: var(--ink-on-accent); }

        .tk-text { flex: 1; min-width: 0; }
        .tk-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .tk-title {
            font-size: 14px; line-height: 1.45; color: var(--text-primary);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .tk-row.is-done .tk-title { text-decoration: line-through; color: var(--text-muted); }
        .tk-meta {
            font-size: 12px; line-height: 1.4; color: var(--text-muted);
            margin-top: 2px;
            display: flex; align-items: center; gap: 8px; min-width: 0;
        }
        /* 归属是**身份**，走一枚中性胶囊（形状表达身份）；不给项目配色 ——
           给每个项目一支色会让人以为它在报错（一条列表里颜色只承载一种语义）。 */
        .tk-proj {
            flex-shrink: 0;
            padding: 1px 7px; border-radius: 6px;
            background: var(--bg-subtle);
            font-size: 11px; color: var(--text-secondary);
        }
        .tk-note { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        /* 优先级：P0 / P1 才有标记（P2 以下不占版面），
           靠"实底 vs 薄底"分层，不靠第三支颜色。 */
        .tk-pri {
            flex-shrink: 0; padding: 1px 6px; border-radius: 6px;
            font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em;
        }
        /* 类型标「Bug」：中性胶囊 + 一枚形状（图标），**不占颜色** ——
           这一页的颜色只表达"逾期"（`.tk-when.is-late`），加第二种颜色语义就没人分得清了。 */
        .tk-kind {
            display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
            padding: 1px 7px 1px 6px; border-radius: 6px;
            font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em;
            background: var(--bg-subtle); color: var(--text-secondary);
        }
        .tk-kind svg { width: 11px; height: 11px; }
        /* 来源（测试发现 / 用户反馈 / 监控告警）：与"卡在哪"那种自由 note 分开 ——
           它是**别人报的**这条证据，本来就比一句自述更硬。 */
        .tk-src {
            flex-shrink: 0; padding: 0 6px; border-radius: 4px; white-space: nowrap;
            background: var(--bg-subtle); color: var(--text-secondary);
        }
        .tk-pri.p0 { background: var(--m-fill); color: var(--ink-on-accent); }
        .tk-pri.p1 { background: var(--m-soft); color: var(--m-ink); }

        .tk-when {
            font-size: 12px; color: var(--text-secondary);
            white-space: nowrap; flex-shrink: 0;
            min-width: 72px; text-align: right;
            font-variant-numeric: tabular-nums;
        }
        .tk-when.is-late { color: var(--alert-fg); font-weight: 600; }

        /* 两枚行内动作**常驻**（对每一行都有意义 ⇒ 宽度一致，没有"占列 + 隐藏"）。
           无框：三位一行的常驻实心小方块就是三个噪声源，悬停才显形。 */
        .tk-acts { display: flex; gap: 2px; flex-shrink: 0; }
        .tk-act {
            width: 26px; height: 26px; border-radius: 8px;
            border: 1px solid transparent; background: transparent;
            color: var(--text-muted);
            display: flex; align-items: center; justify-content: center;
            cursor: pointer; padding: 0;
            transition: background 0.18s ease, color 0.18s ease, border-color 0.18s ease;
        }
        .tk-act:hover { background: var(--bg-card); border-color: var(--border-card); color: var(--text-primary); }
        .tk-act:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }

        /* 空态：**永远渲染**，靠 JS 切 hidden（条件渲染的元素必须总是渲染，
           过滤只在已渲染 DOM 上改 el.hidden，不重渲）。 */
        .tk-empty {
            padding: 12px 10px; margin: 0 -10px;
            font-size: 12.5px; color: var(--text-muted);
            background: var(--bg-subtle); border-radius: 10px;
        }

'''

# ============================================================================
# 3. 数据 + 内容 DOM
# ============================================================================
PROJECTS = [
    ('pay',  '支付系统重构'),
    ('uc',   '用户中心改版'),
    ('dash', '数据看板'),
    ('misc', '日常事务'),
]
PROJ = dict(PROJECTS)

# due: 相对今天的天数（none = 未排期）；when 是要显示的那句话
# ⚠️ 第 10 位起是**可选**的：kind（'req' 默认 / 'bug'）、src（来源）、bug（Bug 页的编号）。
#    写成可选是因为**只有少数几条需要它** —— 给 24 行都补一个 'req' 只会让真正的那条淹掉。
TASKS = [
    # id,   标题,                                     项目,   卡在哪,           due,  when,      P, 进行中, 已完成
    ('T01', '优化首页加载速度',                        'pay',  '等前端联调',      -2,  '逾期 2 天', 1, True,  False),
    ('T02', '补齐回滚手册',                            'pay',  '运维',            -1,  '逾期 1 天', 1, True,  False),
    ('T03', '回复数据口径确认邮件',                    'dash', '口径还没定',      -3,  '逾期 3 天', 2, False, False),
    ('T04', '修复登录页样式回归',                      'uc',   '已定位到 flex 换行', 0, '下班前',  0, True,  False, 'bug', '测试发现'),
    ('T05', '准备项目评审材料',                        'pay',  '评审材料',         0,  '评审前',   0, True,  False),
    ('T06', '评审「支付回调幂等」分支',                'pay',  '等对方提 PR',      0,  '下班前',   1, False, False),
    ('T07', '更新支付接口文档',                        'pay',  '文档',             0,  '下班前',   2, False, False),
    ('T08', '写日报',                                  'misc', '',                 0,  '下班前',   3, False, False),
    ('T09', '用户中心灰度方案定稿',                    'uc',   '灰度比例待拍',     1,  '周四',     0, True,  False),
    ('T10', '数据看板慢查询优化',                      'dash', '三条 SQL 待改',    2,  '周三',     1, False, False),
    ('T11', '支付对账脚本跑通',                        'pay',  '差一天的边界',     4,  '周五',     1, True,  False),
    ('T12', '用户中心埋点校对',                        'uc',   '对 12 个事件',     4,  '周五',     2, False, False),
    ('T13', '月末复盘初稿',                            'misc', '本周先出骨架',     5,  '周日',     2, False, False),
    ('T14', '支付系统压测方案',                        'pay',  '',                13,  '10-12',    1, False, False),
    ('T15', '数据看板权限模型设计',                    'dash', '等安全那边回话',  17,  '10-16',    2, False, False),
    ('T16', '用户中心无障碍走查',                      'uc',   '对照 WCAG 清单',  21,  '10-20',    3, False, False),
    ('T17', '季度 OKR 拆解',                           'misc', '先收三个方向',    26,  '10-25',    1, False, False),
    ('T18', '整理支付链路的历史决策记录',              'pay',  '选型那几次讨论',  None, '',       2, False, False),
    ('T19', '评估要不要给慢查询加告警',                'dash', '先从慢日志取样',  None, '',       3, False, False),
    ('T20', '统一用户中心错误码表',                    'uc',   '两套码要合',      None, '',       2, False, False),
    ('T21', '排下周的值班表',                          'misc', '先问谁要调休',    None, '',       3, False, False),
]

DONE_TASKS = [
    ('T22', '晨会纪要归档',            'misc', ''),
    ('T23', '支付回调超时日志核对',    'pay',  ''),
    ('T24', '数据看板口径对齐会',      'dash', ''),
]

# 信息架构：五个时间桶。**顺序 = 动手的优先顺序**，所以逾期在最前。
# 顺序判据（技能 module-prototype-nav-mount §五）：日用的在前，偶尔用的在后。
BUCKETS = [
    ('overdue',     '逾期',   'alert',    '已经欠下了，先从这里挑'),
    ('today',       '今天',   'sun',      '今天下班前要交的'),
    ('week',        '本周',   'calendar', '这周内要推进的'),
    ('later',       '之后',   'clock',    '时间还没到，先放着'),
    ('unscheduled', '未排期', 'inbox',    '还没落到日子上'),
]


def bucket_of(due):
    if due is None:
        return 'unscheduled'
    if due < 0:
        return 'overdue'
    if due == 0:
        return 'today'
    if due <= 5:
        return 'week'
    return 'later'


NOTE = ('<!-- 任务行是**静态标记**，由本文件下方的数据表生成后落盘 ——\n'
        '     预览面板走静态 HTML 视图，主内容不许依赖脚本；JS 只做"计数 / 勾选 / 筛选"三件增强。\n'
        '     ⚠️ 静态一份 + 动态再渲一份必然走岔 ⇒ 这里**只有静态这一份**，\n'
        '        所有会变的数字走 `syncCounts()` 一处收敛。 -->')


def pri_html(p):
    if p == 0:
        return '<span class="tk-pri p0">P0</span>'
    if p == 1:
        return '<span class="tk-pri p1">P1</span>'
    return ''


def kind_html(kind):
    """类型标。只有「缺陷」标出来 —— 需求是默认状态，标它等于没标。"""
    if kind != 'bug':
        return ''
    return ('<span class="tk-kind"><span aria-hidden="true" data-ico="bug" data-ico-size="11">'
            '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" '
            'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">'
            '<circle cx="12" cy="13" r="6"/><path d="M12 7V4M8 8 6 6M16 8l2-2M6 13H3M21 13h-3M8 18l-2 2M16 18l2 2"/>'
            '</svg></span>Bug</span>')


def row_html(t, bucket):
    tid, name, proj, note, due, when, pri, doing, done = t[:9]
    # 第 10 位起可选：老行不写 = 普通需求
    kind = t[9] if len(t) > 9 else 'req'
    src = t[10] if len(t) > 10 else ''
    meta = '<span class="tk-proj">%s</span>' % PROJ[proj]
    if src:
        meta += '<span class="tk-src">%s</span>' % src
    if note:
        meta += '<span class="tk-note">%s</span>' % note
    if doing and not done:
        meta += '<span class="tk-note">进行中</span>'
    when_cls = 'tk-when is-late' if bucket == 'overdue' else 'tk-when'
    when = '<span class="%s">%s</span>' % (when_cls, when) if when else '<span class="tk-when"></span>'
    return (
        '            <div class="tk-row%s" data-task="%s" data-project="%s" data-kind="%s" data-bucket="%s"%s>\n'
        '                <button class="tk-check" type="button" aria-pressed="%s" onclick="toggleTask(\'%s\')" aria-label="完成：%s">'
        '<span aria-hidden="true" data-ico="check" data-ico-size="12"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg></span></button>\n'
        '                <div class="tk-text">\n'
        '                    <div class="tk-top"><span class="tk-title">%s</span>%s</div>\n'
        '                    <div class="tk-meta">%s</div>\n'
        '                </div>\n'
        '                %s\n'
        '                <span class="tk-acts">\n'
        '                    <button class="tk-act" type="button" title="顺延到今天" aria-label="把「%s」顺延到今天" onclick="reschedule(\'%s\')">'
        '<span aria-hidden="true" data-ico="refresh" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/></svg></span></button>\n'
        '                    <button class="tk-act" type="button" title="打开所属项目" aria-label="打开「%s」所属的项目" onclick="openProject(\'%s\')">'
        '<span aria-hidden="true" data-ico="external" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 4h6v6"/><path d="m20 4-8.5 8.5"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 18.5v-10A1.5 1.5 0 0 1 6.5 7H11"/></svg></span></button>\n'
        '                </span>\n'
        '            </div>\n'
    ) % (' is-done' if done else '', tid, proj, kind, bucket,
         ' data-doing="1"' if (doing and not done) else '',
         'true' if done else 'false', tid, name,
         name, pri_html(pri) + kind_html(kind), meta, when,
         name, tid, PROJ[proj], proj)


def group_html(key, label, icon, desc, late, items, hint):
    body = ''.join(row_html(t, key) for t in items)
    # ⚠️ 计数**静态就写对**（不写 0 让 JS 填）：无脚本时页面要自洽 ——
    #    块头写「0 件」而下面躺着 3 行，是比"看不见"更糟的一种错。
    return (
        '\n        <section class="tk-group%s" data-section="%s">\n'
        '            <div class="tk-head">\n'
        '                <span class="tk-ico" aria-hidden="true" data-ico="%s" data-ico-size="15"></span>\n'
        '                <span class="tk-name">%s</span>\n'
        '                <span class="tk-count" data-group-count>%d 件</span>\n'
        '                <span class="tk-rule" aria-hidden="true"></span>\n'
        '                <span class="tk-desc">%s</span>\n'
        '            </div>\n'
        '%s'
        '            <div class="tk-empty" id="empty-%s" hidden>%s</div>\n'
        '        </section>\n'
    ) % (' is-late' if late else '', key, icon, label, len(items), desc, body, key, hint)


GROUPS = []
for k, label, icon, desc in BUCKETS:
    items = [t for t in TASKS if bucket_of(t[4]) == k]
    hint = ('这里还空着 —— 手上每件事都落到日子上了' if k == 'unscheduled'
            else '这一格没有匹配的任务')
    GROUPS.append(group_html(k, label, icon, desc, k == 'overdue', items, hint))

DONE_ROWS = ''.join(
    '            <div class="tk-row is-done" data-task="%s" data-project="%s" data-kind="req" data-bucket="done">\n'
    '                <button class="tk-check" type="button" aria-pressed="true" onclick="toggleTask(\'%s\')" aria-label="取消完成：%s">'
    '<span aria-hidden="true" data-ico="check" data-ico-size="12"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg></span></button>\n'
    '                <div class="tk-text">\n'
    '                    <div class="tk-top"><span class="tk-title">%s</span></div>\n'
    '                    <div class="tk-meta"><span class="tk-proj">%s</span><span class="tk-note">本周完成</span></div>\n'
    '                </div>\n'
    '                <span class="tk-when"></span>\n'
    '                <span class="tk-acts"></span>\n'
    '            </div>\n' % (tid, proj, tid, name, name, PROJ[proj])
    for tid, name, proj, _ in DONE_TASKS)

MAIN_DOM = '''
    <div class="main-wrap">
        <main class="main">
        <div class="detail">

            <!-- ========== 页头 ==========
                 本页横跨所有项目 ⇒ 没有单一实体可以挂那块可折叠 Hero。
                 标题回答"这是什么"，副标题只回答"这一页管什么"（**不写计数** ——
                 那些数字在仪表条与块头里各有其位，写进副标题就是同一件事的第三处表达）。 -->
            <header class="page-head">
                <div>
                    <h1 class="ph-title">任务总览</h1>
                    <p class="ph-sub">工作相关的全部任务，按动手的先后排开 —— 先看欠下的，再看今天要交的。</p>
                </div>
                <div class="ph-actions">
                    <span class="last-sync" id="lastSync">最后更新 09:00</span>
                    <button class="btn btn-primary btn-sm" type="button" onclick="newTask()">
                        <span aria-hidden="true" data-ico="plus" data-ico-size="14"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg></span> 新建任务
                    </button>
                </div>
            </header>

            <!-- ========== 页面级仪表（三格） ==========
                 三格**都与五个时间桶正交**：桶是"时间"维，这三格是"状态 / 完成 / 异常"维
                 ⇒ 不与任何块头计数重复（同一句判据见下方 syncCounts）。
                 ① 进行中 N 件 —— 手上还开着几件
                 ② 本周完成 N 件 —— 这一周推得怎么样
                 ③ 最久的欠账 N 天 —— 有没有正在烧的火 -->
            <div class="kpi-bar">
                <div class="kpi">
                    <div class="kpi-top"><span class="kpi-ico" aria-hidden="true" data-ico="play" data-ico-size="15"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M7 4.5v15l12-7.5z"/></svg></span><span class="kpi-label">进行中</span></div>
                    <div class="kpi-val"><span id="kpiDoing">6</span><span class="kpi-unit">件</span></div>
                    <div class="kpi-sub" id="kpiDoingSub">已经动手、还没收尾的</div>
                </div>
                <div class="kpi">
                    <div class="kpi-top"><span class="kpi-ico" aria-hidden="true" data-ico="check" data-ico-size="15"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg></span><span class="kpi-label">本周完成</span></div>
                    <div class="kpi-val"><span id="kpiDone">3</span><span class="kpi-unit">件</span></div>
                    <div class="kpi-sub" id="kpiDoneSub">上周 8 件</div>
                </div>
                <div class="kpi">
                    <div class="kpi-top"><span class="kpi-ico" aria-hidden="true" data-ico="alert" data-ico-size="15"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3.5 21 19H3z"/><path d="M12 9.5v4"/><path d="M12 16.4h.01"/></svg></span><span class="kpi-label">最久的欠账</span></div>
                    <div class="kpi-val is-late" id="kpiLateVal"><span id="kpiLate">3</span><span class="kpi-unit">天</span></div>
                    <div class="kpi-sub" id="kpiLateSub">优化首页加载速度</div>
                </div>
            </div>

            <!-- ========== 筛选：**只给"另一个维度"** ==========
                 本页按**时间**分块 ⇒ 筛的只能是「项目」（按什么分组就别筛那个维度）。
                 只有一排，所以不需要"切视角时另一个维度归零"那一套。
                 ⚠️ 筛选**不重渲**：在已渲染的 DOM 上改 `el.hidden` ⇒ 展开态 / 焦点 / 滚动全留。
                    代价是每一条任务必须**总是渲染**（下方五个块里的行都是静态的）。 -->
            <div class="filter-bar">
                <div class="filter-row" data-dim="project">
                    <span class="filter-label">项目</span>
                    <div class="chip-group" id="fProject" role="group" aria-label="按项目筛选"><button type="button" class="chip active" data-dim="project" data-key="all" aria-pressed="true">全部</button><button type="button" class="chip" data-dim="project" data-key="pay" aria-pressed="false">支付系统重构</button><button type="button" class="chip" data-dim="project" data-key="uc" aria-pressed="false">用户中心改版</button><button type="button" class="chip" data-dim="project" data-key="dash" aria-pressed="false">数据看板</button><button type="button" class="chip" data-dim="project" data-key="misc" aria-pressed="false">日常事务</button></div>
                </div>
                <div class="filter-row" data-dim="kind">
                    <span class="filter-label">类型</span>
                    <div class="chip-group" id="fKind" role="group" aria-label="按类型筛选"><button type="button" class="chip active" data-dim="kind" data-key="all" aria-pressed="true">全部</button><button type="button" class="chip" data-dim="kind" data-key="req" aria-pressed="false">需求</button><button type="button" class="chip" data-dim="kind" data-key="bug" aria-pressed="false">缺陷</button></div>
                </div>
                <div class="filter-foot">
                    <span id="filterSummary">显示全部任务</span>
                    <button class="filter-reset" type="button" id="filterReset" onclick="resetFilter()" hidden>清空筛选</button>
                </div>
            </div>

            <!-- ========== 五个时间桶（同页并列、全部可见） ==========
                 ⚠️ 这是"能不能同时成立"那一问的直接产物：五批任务不相交，
                    "总览"就是五批一起看 ⇒ 圆盘只做「定位 + 随滚动同步」，
                    绝不做 display 互斥切换（那会把四块藏到一个只有图标的圆盘后面）。
                 ⚠️ 块头的计数**跟筛选走**（没有第二处表达它的地方）；
                    圆盘悬停名称条与侧栏副标题的计数**不跟**（它是分区级读数）。
                    两个数不一样是**对的**，不是 bug。 -->
            __GROUPS__

            <!-- 已完成：不占任何桶（桶回答的是"还剩什么"）⇒ 单独一条折叠，
                 卡头仍然只有"任务总览"一个。用原生 <details> ⇒ 零 JS。 -->
            <section class="tk-group" data-section="done">
                <details class="tk-done">
                    <summary>
                        <span class="tk-ico" aria-hidden="true" data-ico="check" data-ico-size="15"></span>
                        <span class="tk-name">本周已完成</span>
                        <span class="tk-count" id="doneCount">3 件</span>
                    </summary>
                    <div class="tk-done-body">
__DONE_ROWS__                    </div>
                </details>
            </section>

            <!-- 筛到一个都不剩时才出现：给一条退路，别让人对着空白猜是不是没数据 -->
            <div class="empty-state" id="filterEmpty" hidden>
                <div class="empty-icon" aria-hidden="true" data-ico="check" data-ico-size="22"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg></div>
                <div class="empty-title">没有匹配的任务</div>
                <div class="empty-desc">换个项目看看 —— 也可以清空筛选</div>
            </div>

        </div>
        </main>
    </div>
</div>
'''
MAIN_DOM = MAIN_DOM.replace('__GROUPS__', ''.join(GROUPS)).replace('__DONE_ROWS__', DONE_ROWS)

# 折叠小节的样式（跟着 DOM 走）
CSS_BODY += '''
        .tk-done { margin: 0; }
        .tk-done > summary {
            display: flex; align-items: center; gap: 9px;
            cursor: pointer; list-style: none;
            padding: 8px 10px; margin: 0 -10px;
            border-radius: 10px;
            transition: background 0.18s ease;
        }
        .tk-done > summary::-webkit-details-marker { display: none; }
        .tk-done > summary:hover { background: var(--bg-hover); }
        .tk-done > summary .tk-name { color: var(--text-secondary); }
        .tk-done > summary .tk-count { margin-left: auto; }
        .tk-done-body { padding-top: 2px; }
'''

# ============================================================================
# 4. JS：数据段（新写）
# ============================================================================
TASK_ROWS = '\n'.join(
    "        { id: '%s', due: %s, pri: %d, doing: %s },"
    % (t[0], 'null' if t[4] is None else t[4], t[6], 'true' if t[7] else 'false')
    for t in TASKS)

JS_DATA = '''
    /* ============================================================
       数据
       —— 原型没有后端，这一份就是"我手上有哪些任务"的事实源。
          **页面上的每一处数字都从它现算**（块头计数 / 仪表条 / 圆盘悬停名称条 /
          侧栏副标题 / 命令面板），勾掉一条之后，不会有哪一处还说着旧数。
       ⚠️ 只有**会变的东西**进这张表：到期、优先级、有没有动手、完成没有。
          行的标题 / 项目 / 卡在哪是静态标记 —— 它们不参与任何计算。
       ⚠️ `due` 是**相对今天的天数**（负数 = 已逾期，null = 未排期），不是绝对日期。
          写死日期的话，这份原型过两天再看，五个桶会全部错位。
       ⚠️ 优先级 0 = P0 … 3 = P3；只有 P0 与 P1 在行上有标记（P2 以下不占版面）。
       ============================================================ */
    const PROJECTS = {
        pay:  '支付系统重构',
        uc:   '用户中心改版',
        dash: '数据看板',
        misc: '日常事务'
    };

    const TASKS = [
__TASK_ROWS__
    ];

    /* 类型只有两档：**是不是缺陷**。杂活不单列 —— 它由标题自明（"写日报" / "排值班表"），
       多一档只会在筛选条上多一个永远只有一两条的选项。 */
    const KINDS = { req: '需求', bug: '缺陷' };

    /* 已完成的那几条**不占桶**（桶回答的是"还剩什么"）⇒ 另存一份 id。
       它们也没有 due：有 due 就会被算进"最久的欠账"，而做完的活不是欠账。 */
    const DONE_IDS = ['T22', 'T23', 'T24'];

    /* ============================================================
       导航壳的分区 = 五个**时间桶**
       —— 与服务器页（分区 = 各项目，从数据里现算）的关键差别：
            项目是"分组"，某个项目的机器全删空之后，那一格就该从圆盘上消失；
            **时间桶是格子，不是分组** —— 空格子仍然要留着（"逾期是空的"这件事
            本身就是要一眼看到的信息）。
          ⇒ 桶写死五个，count 由 `syncCounts()` 现算。
       ============================================================ */
    let SECTIONS = [
        { key: 'overdue',     label: '逾期',   icon: 'alert',    count: '0 件', desc: '已经欠下了，先从这里挑' },
        { key: 'today',       label: '今天',   icon: 'sun',      count: '0 件', desc: '今天下班前要交的' },
        { key: 'week',        label: '本周',   icon: 'calendar', count: '0 件', desc: '这周内要推进的' },
        { key: 'later',       label: '之后',   icon: 'clock',    count: '0 件', desc: '时间还没到，先放着' },
        { key: 'unscheduled', label: '未排期', icon: 'inbox',    count: '0 件', desc: '还没落到日子上' }
    ];

    /* 计数必须现算：圆盘悬停名称条与侧栏副标题读的是同一份 SECTIONS。
       **不跟筛选**（它是分区级读数）—— 块头那个数才跟筛选，两个数不一样是对的。 */
    function sectionCount(sec) { return sec.count || '0 件'; }
'''.replace('__TASK_ROWS__', TASK_ROWS)

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
               "        cmdItems.push({ icon: 'plus', text: '新建任务', kbd: '', run: newTask });\n"
               "        cmdItems.push({ icon: 'refresh', text: '重新检查全部任务', kbd: '', run: refreshAll });")
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
       任务总览的交互 —— 只有四件：计数、勾选、筛选、顺延
       ⚠️ 行的标记是**静态的**（预览面板走静态 HTML 视图，主内容不许依赖脚本）
          ⇒ 这里只做"改数字 / 改 hidden / 改 class / 搬节点"，**一次都不重建行**。
          代价是每一条任务必须总是渲染 —— 换来的是勾选态、焦点、滚动位置全留。
       ⚠️ 行上的动作走**内联 onclick**（不是 addEventListener）：顺延会把节点整行搬到
          另一个桶里，内联不会因为搬动而失效（宿主 prototype-revision-sync 的同族坑）。
       ============================================================ */

    const groupEl = key => document.querySelector('.detail [data-section="' + key + '"]');
    const rowEl = id => document.querySelector('.tk-row[data-task="' + id + '"]');
    const titleOf = row => { const el = row && row.querySelector('.tk-title'); return el ? el.textContent : ''; };
    const bucketLabel = key => { const s = SECTIONS.filter(x => x.key === key)[0]; return s ? s.label : key; };

    let filterProject = 'all';
    let filterKind = 'all';

    /* ---------- 唯一的统计函数 ----------
       一处收敛：块头 / 仪表条 / 圆盘悬停名称条 / 侧栏副标题 / 完成折叠，全部读它。
       ⚠️ 两个数**故意不同**，不是 bug：
          · 块头计数**跟筛选走**（"这一格现在看得见几条"）；
          · 分区级计数（圆盘 / 侧栏）**不跟**（"这一格总共有多少"）。
       ⚠️ 对空数据集取值必须有护栏：一条逾期都没有时 `sort()[0]` 是 undefined ——
          不加护栏会整条 sync 断在中间，后面每一处都停在旧值，**而页面不报任何错**。 */
    function syncCounts() {
        const rows = [...document.querySelectorAll('.tk-row')];
        const alive = rows.filter(r => !r.classList.contains('is-done'));

        SECTIONS.forEach(function (sec) {
            const host = groupEl(sec.key);
            if (!host) return;
            const inBox = alive.filter(r => r.dataset.bucket === sec.key);
            sec.count = inBox.length + ' 件';                              /* 不跟筛选 */
            const vis = inBox.filter(r => !r.hidden);
            const cnt = host.querySelector('[data-group-count]');
            if (cnt) cnt.textContent = vis.length + ' 件';                 /* 跟筛选 */
            const emp = document.getElementById('empty-' + sec.key);
            if (emp) emp.hidden = vis.length > 0;
            host.classList.toggle('is-late', sec.key === 'overdue' && inBox.length > 0);
        });

        /* 仪表三格：与五个时间桶**正交** ⇒ 不与任何块头计数重复 */
        const doing = alive.filter(r => r.dataset.doing === '1').length;
        const doneN = rows.filter(r => r.classList.contains('is-done')).length;
        const late = TASKS.filter(t => t.due !== null && t.due < 0).sort((a, b) => a.due - b.due)[0];
        const put = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        put('kpiDoing', doing);
        put('kpiDone', doneN);
        put('kpiLate', late ? -late.due : 0);
        const lateVal = document.getElementById('kpiLateVal');
        if (lateVal) lateVal.classList.toggle('is-late', !!late);
        put('kpiLateSub', late ? (titleOf(rowEl(late.id)) || '已逾期') : '没有逾期任务');
        put('doneCount', doneN + ' 件');

        syncChrome(false);
    }

    /* ---------- 勾选：完成 / 取消完成 ----------
       ⚠️ 勾上的行**留在原地**（划线降级），不移到「本周已完成」折叠里 ——
          移走之后它会从"桶回答还剩什么"的正确性上占便宜，但要还原就得把
          行尾那两列存下来再写回去（可逆性换不来）。留原地 ⇒ 计数扣掉它、
          行还在，取消勾选天然可逆。 */
    function toggleTask(id) {
        const row = rowEl(id);
        if (!row) return;
        const done = row.classList.toggle('is-done');
        const chk = row.querySelector('.tk-check');
        if (chk) chk.setAttribute('aria-pressed', String(done));
        row.hidden = !passFilter(row);
        syncCounts();
        toast((done ? '已完成：' : '已取消完成：') + titleOf(row), 'ok');
    }

    /* ---------- 顺延到今天：只对逾期有意义（其余行点了也不会错，只是没变化） ---------- */
    function reschedule(id) {
        const row = rowEl(id);
        if (!row) return;
        if (row.dataset.bucket !== 'overdue') { toast('这条不在逾期里，不用顺延', 'info'); return; }
        const when = row.querySelector('.tk-when');
        if (when) { when.classList.remove('is-late'); when.textContent = '今天'; }
        row.dataset.bucket = 'today';
        const host = groupEl('today');
        const anchor = host.querySelector('.tk-row');
        if (anchor) host.insertBefore(row, anchor); else host.insertBefore(row, host.querySelector('.tk-empty'));
        applyFilter();
        toast('已顺延到今天：' + titleOf(row), 'ok');
    }

    /* ---------- 打开所属项目（行尾那一枚） ---------- */
    function openProject(proj) {
        toast('原型演示：打开「' + (PROJECTS[proj] || proj) + '」的项目详情', 'info');
    }

    /* ---------- 点行的正文 = 看这条的详情（一行只是一个入口，不是一个面板） ---------- */
    function openTask(id) {
        const row = rowEl(id);
        if (!row) return;
        const pick = sel => { const el = row.querySelector(sel); return el && el.textContent.trim() ? el.textContent.trim() : ''; };
        const bits = [pick('.tk-proj'), pick('.tk-note'), pick('.tk-pri'), bucketLabel(row.dataset.bucket)].filter(Boolean);
        const done = row.classList.contains('is-done');
        openConfirm({
            title: titleOf(row),
            desc: bits.join(' · ') + (done ? '｜已完成' : ''),
            warn: done ? '' : '勾掉它会从「' + bucketLabel(row.dataset.bucket) + '」里移出，块头与仪表条的读数跟着变。',
            confirmText: done ? '取消完成' : '标记完成',
            onConfirm: function () { toggleTask(id); return true; }
        });
    }

    function newTask() { toast('原型演示：新建任务（这一页还没有表单）', 'info'); }

    /* ---------- 筛选：两个维度（项目 × 类型） ----------
       判据：**筛的永远是"另一个维度"** —— 本页按时间分块，所以筛的是项目与类型。
       ⚠️ "两维"是**两个控件**而不是一个分段：它们能同时成立
          （在「支付系统重构」里只看「缺陷」），能同时成立的就该是两个控件。
       ⚠️ 过滤只改 `el.hidden`，不重渲 ⇒ 勾选态、焦点、滚动位置全留。
       ⚠️ 筛到一条不剩时要有退路（`.empty-state` 与"清空筛选"）。 */
    function passFilter(row) {
        return (filterProject === 'all' || row.dataset.project === filterProject)
            && (filterKind === 'all' || row.dataset.kind === filterKind);
    }

    function renderFilterChips() {
        [['#fProject', filterProject], ['#fKind', filterKind]].forEach(function (pair) {
            document.querySelectorAll(pair[0] + ' .chip').forEach(function (c) {
                const on = c.dataset.key === pair[1];
                c.classList.toggle('active', on);
                c.setAttribute('aria-pressed', String(on));
            });
        });
    }

    function applyFilter() {
        let shown = 0;
        document.querySelectorAll('.tk-row').forEach(function (row) {
            const ok = passFilter(row);
            row.hidden = !ok;
            if (ok) shown++;
        });
        const sum = document.getElementById('filterSummary');
        if (sum) {
            const bits = [];
            if (filterProject !== 'all') bits.push('「' + (PROJECTS[filterProject] || filterProject) + '」');
            if (filterKind !== 'all') bits.push(KINDS[filterKind] || filterKind);
            sum.textContent = bits.length ? '只看 ' + bits.join(' + ') : '显示全部任务';
        }
        const reset = document.getElementById('filterReset');
        if (reset) reset.hidden = filterProject === 'all' && filterKind === 'all';
        const fe = document.getElementById('filterEmpty');
        if (fe) fe.hidden = shown > 0;
        syncCounts();
    }

    function setFilter(dim, key) {
        if (dim === 'kind') filterKind = key; else filterProject = key;
        renderFilterChips();
        applyFilter();
    }
    function resetFilter() { filterProject = 'all'; filterKind = 'all'; renderFilterChips(); applyFilter(); }

    /* 一行一个委托：两排 chip 的 `data-dim` 自己说明它属于哪个维度 */
    document.querySelector('.filter-bar').addEventListener('click', function (e) {
        const chip = e.target.closest('.chip');
        if (chip) setFilter(chip.dataset.dim, chip.dataset.key);
    });

    /* 点行的正文看详情；点在勾选框 / 两枚动作上时不进（它们各有各的活） */
    document.querySelector('.detail').addEventListener('click', function (e) {
        const row = e.target.closest('.tk-row');
        if (!row) return;
        if (e.target.closest('.tk-check') || e.target.closest('.tk-act')) return;
        openTask(row.dataset.task);
    });

    /* ---------- 侧栏「最近」/ 命令面板的定位落点 ---------- */
    function focusTask(id) {
        const row = rowEl(id);
        if (!row) return;
        if (filterProject !== 'all' && row.dataset.project !== filterProject) setFilter('project', 'all');
        if (filterKind !== 'all' && row.dataset.kind !== filterKind) setFilter('kind', 'all');
        activatePanel(row.dataset.bucket);
        row.classList.remove('is-spot');
        void row.offsetWidth;               /* 强制回流：连着点两次也要重放动画 */
        row.classList.add('is-spot');
        toast('已定位到：' + titleOf(row), 'info');
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
        toast('已重新检查全部任务', 'ok');
    }

    /* ---------- 接收 Bug 页推过来的任务 ----------
       ⚠️ 这一份**只能是运行期生成的**：静态标记里不可能有它（推是刚刚发生的动作）
          ⇒ 与"静态一份 + 动态再渲一份必然走岔"不冲突（静态那份只可能为空）。
       ⚠️ 键与 Bug 页**跨页同名**；`storage` 事件只在**别的窗口**改键时触发
          ⇒ 本窗口自己写完要自己刷（那是 Bug 页的事），这里只负责"别人推的我能跟上"。 */
    const PROMOTE_KEY = 'work:bugs:promoted';

    function priTag(pri) {
        if (pri === 0) return '<span class="tk-pri p0">P0</span>';
        if (pri === 1) return '<span class="tk-pri p1">P1</span>';
        return '';
    }

    /* 与静态行**同构**（勾选框 / 文本 / 时间位 / 两枚动作），否则 CSS 一条都不认。 */
    function promotedRowHtml(p, bid) {
        const svgCheck = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg>';
        const svgBug = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="13" r="6"/><path d="M12 7V4M8 8 6 6M16 8l2-2M6 13H3M21 13h-3M8 18l-2 2M16 18l2 2"/></svg>';
        const svgRefresh = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 12a8 8 0 1 1-2.3-5.6"/><path d="M20 4v4h-4"/></svg>';
        const svgExt = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 4h6v6"/><path d="m20 4-8.5 8.5"/><path d="M18 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 5 18.5v-10A1.5 1.5 0 0 1 6.5 7H11"/></svg>';
        return ''
            /* ⚠️ `p.orphan` = 来源那条 Bug 已经被删掉了（Bug 页删除时会标上）。
               这一行任务**留着** —— "我要做的事"是另一个决定，删 Bug 不等于不做了；
               但它身上一切指向那条 Bug 的东西都要撤掉，否则就是死链。 */
            + '<div class="tk-row" data-task="' + p.code + '" data-project="' + p.proj + '" data-kind="bug" data-bug="' + (p.orphan ? '' : bid) + '" data-bucket="unscheduled">'
            + '<button class="tk-check" type="button" aria-pressed="false" onclick="toggleTask(&#39;' + p.code + '&#39;)" aria-label="完成：' + esc(p.title) + '">'
            + '<span aria-hidden="true">' + svgCheck + '</span></button>'
            + '<div class="tk-text">'
            + '<div class="tk-top"><span class="tk-title">' + esc(p.title) + '</span>' + priTag(p.pri)
            + '<span class="tk-kind"><span aria-hidden="true">' + svgBug + '</span>Bug</span></div>'
            + '<div class="tk-meta"><span class="tk-proj">' + esc(p.projName) + '</span>'
            + '<span class="tk-src">' + esc(p.src) + '</span>'
            + '<span class="tk-note" title="' + (p.orphan
                ? ('原 ' + bid + ' 已删除 · 这一行现在只剩当时抄来的那一步')
                : ('从 ' + bid + ' 推过来 · 完整复现步骤在 Bug 页')) + '">' + esc(p.note) + '</span></div>'
            + '</div>'
            + '<span class="tk-when"></span>'
            + '<span class="tk-acts">'
            + '<button class="tk-act" type="button" title="顺延到今天" aria-label="把「' + esc(p.title) + '」顺延到今天" onclick="reschedule(&#39;' + p.code + '&#39;)"><span aria-hidden="true">' + svgRefresh + '</span></button>'
            + (p.orphan ? '' : '<button class="tk-act" type="button" title="回到 ' + bid + '" aria-label="回到 ' + bid + '" onclick="openBug(&#39;' + bid + '&#39;)"><span aria-hidden="true">' + svgExt + '</span></button>')
            + '</span>'
            + '</div>';
    }

    function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]; }); }

    /* 行尾那枚不是"打开项目"而是"回到报它的那条 Bug" —— 推过来的任务，
       它的上下文在 Bug 页（复现步骤、环境、谁提的都在那边）。 */
    function openBug(bid) {
        location.href = '工作-项目-项目详情-Bug-index.html#' + bid;
    }

    function injectPromoted() {
        let m = {};
        try { m = JSON.parse(localStorage.getItem(PROMOTE_KEY) || '{}') || {}; } catch (e) { return; }
        const host = groupEl('unscheduled');
        if (!host) return;
        let added = 0;
        Object.keys(m).forEach(function (bid) {
            const p = m[bid] || {};
            if (!p.code || document.querySelector('[data-task="' + p.code + '"]')) return;   /* 幂等 */
            const tmp = document.createElement('div');
            tmp.innerHTML = promotedRowHtml(p, bid);
            host.insertBefore(tmp.firstChild, host.querySelector('.tk-empty'));
            added++;
        });
        if (added) toast && 0;   /* 计数交给 applyFilter → syncCounts，不在这里另算一遍 */
    }

    window.addEventListener('storage', function (e) {
        if (e.key === PROMOTE_KEY) { injectPromoted(); applyFilter(); }
    });

    /* ---------- 一次把页面立起来 ----------
       ⚠️ 顺序不能反：图标要在 DOM 就位之后灌（先灌等于灌了个空容器）；
          计数要在图标之后（块头与仪表的文本节点由它写）。 */
    function renderAll() {
        injectPromoted();
        paintIcons(document);
        renderFilterChips();
        applyFilter();
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
        '    <!-- ========== 侧栏（圆盘 = 本页的五个时间桶 + 已完成） ========== -->')
D = rep(D, '<span class="name" id="sidebarTitle">服务器</span>',
        '<span class="name" id="sidebarTitle">任务</span>')
# ⚠️ 副标题的初值带着**服务器页当前的数据**（"… · 3 台"那种）—— 把那个数写死在
#    锚点里，源页数据一变（2 台 → 3 台）这里就静默失效 ⇒ 用正则整段换掉，别赌那个数。
D, _n = re.subn(r'<div class="sidebar-subtitle" id="sidebarSubtitle">[^<]*</div>',
                '<div class="sidebar-subtitle" id="sidebarSubtitle">逾期 · 3 件</div>', D)
assert _n == 1, '侧栏副标题没换到（找到 %d 处）' % _n

# 顶栏「任务」胶囊上的计数徽标：本页的仪表条已经在说"进行中几件"，
# 同一个数字不再在顶栏说第二遍（"同一个数字只在一处表达"）。
D = rep(D, """                    <span class="nav-p-text">任务</span>
                    <span class="nav-p-badge">5</span>""",
        """                    <span class="nav-p-text">任务</span>""")
D = rep(D, """                    <span class="nav-p-text">工作</span>
                    <span class="nav-p-badge warn">2</span>""",
        """                    <span class="nav-p-text">工作</span>
                    <span class="nav-p-badge warn" title="3 件逾期">3</span>""")

RECENT_OLD = seg2('                    <!-- 最近：最近动过的机器。带的是**机器名**（不是分区名）——',
                 '                    <!-- 快捷：')
RECENT_NEW = '''                    <!-- 最近：最近动过的**任务**。带的是任务名（不是桶名）——
                         这一槽回答的是"我刚才在弄哪一件"，不是"我滚到哪一节了"。 -->
                    <div class="slot-panel active" data-panel="recent">
                        <button class="recent-item" type="button" onclick="focusTask('T02')">
                            <span class="recent-icon" aria-hidden="true" data-ico="check" data-ico-size="11"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg></span>
                            <span class="recent-text">补齐回滚手册</span>
                            <span class="recent-time">今天</span>
                        </button>
                        <button class="recent-item" type="button" onclick="focusTask('T05')">
                            <span class="recent-icon" aria-hidden="true" data-ico="check" data-ico-size="11"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg></span>
                            <span class="recent-text">准备项目评审材料</span>
                            <span class="recent-time">今天</span>
                        </button>
                        <button class="recent-item" type="button" onclick="focusTask('T09')">
                            <span class="recent-icon" aria-hidden="true" data-ico="check" data-ico-size="11"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg></span>
                            <span class="recent-text">用户中心灰度方案定稿</span>
                            <span class="recent-time">昨天</span>
                        </button>
                        <button class="recent-item" type="button" onclick="focusTask('T11')">
                            <span class="recent-icon" aria-hidden="true" data-ico="check" data-ico-size="11"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 6 9 17l-5-5"/></svg></span>
                            <span class="recent-text">支付对账脚本跑通</span>
                            <span class="recent-time">周一</span>
                        </button>
                    </div>

'''
D = D.replace(RECENT_OLD, RECENT_NEW)

QUICK_OLD = seg2('                    <!-- 快捷：四个各干一件事的入口。不放"删机器 / 移机器"这类破坏性动作 ——',
                '                    <!-- AI：')
QUICK_NEW = '''                    <!-- 快捷：四个各干一件事的入口。不放"删任务"这类破坏性动作 ——
                         它们只该出现在那一条自己的详情里（错一条就是把别人在等的事删了）。 -->
                    <div class="slot-panel" data-panel="quick">
                        <div class="quick-grid">
                            <button class="quick-btn" type="button" onclick="newTask()">
                                <span aria-hidden="true" data-ico="plus" data-ico-size="12"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 5v14M5 12h14"/></svg></span>
                                新建任务
                            </button>
                            <button class="quick-btn" type="button" onclick="activatePanel('today')">
                                <span aria-hidden="true" data-ico="sun" data-ico-size="12"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.6v2.2M12 19.2v2.2M2.6 12h2.2M19.2 12h2.2M5.4 5.4l1.6 1.6M17 17l1.6 1.6M18.6 5.4 17 7M7 17l-1.6 1.6"/></svg></span>
                                看今天
                            </button>
                            <button class="quick-btn" type="button" onclick="activatePanel('unscheduled')">
                                <span aria-hidden="true" data-ico="inbox" data-ico-size="12"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3.5 12.5 6 5.5h12l2.5 7v5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 12.5h4l1 2h7l1-2h4"/></svg></span>
                                收未排期的
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
AI_NEW = '''                    <!-- AI：示例对话跟着这一页的口径走（看欠账 → 排次序 → 定下一步）。
                         原来那版问的是"这台测试机在上什么版本"，而那台机器在这一页上不存在
                         ⇒ 那会是一句页面上没有依据的话。 -->
                    <div class="slot-panel" data-panel="ai">
                        <div class="ai-chat">
                            <div class="ai-msg bot">今天有 3 件欠账，要先把「优化首页加载速度」提到最前吗？</div>
                            <div class="ai-msg user">先看看用户中心那摊还剩什么</div>
                            <div class="ai-msg bot">用户中心还有 3 件：灰度方案周四定稿、埋点校对周五，另有 2 件还没排日子。</div>
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
     工作 · 任务 · 总览（`工作-任务-总览-index.html`）
     ----------------------------------------------------------------------------
     这是**工作这一摊任务的总览页**：一屏回答两件事 ——
       「我现在该动哪几件」以及「还有多少没动」。

     ⚠️ 它与 `work_index.html`（工作台）的分工：
          · 工作台的「今日任务」只放**逾期 + 今天**（用户口径："这一屏只放常用的三样"）；
          · 本页是**全量**：逾期 / 今天 / 本周 / 之后 / 未排期五格一次看全。
        行表示（两行文字 + 行尾一列时间）与工作台同源，只是换了 `tk-` 前缀
        （跨文件同名类会让日后对照分不清改的是哪一份）。

     ⚠️ 圆盘上的分区 = **五个时间桶**（+ 已完成折叠小节，它不占圆盘）。
        判据（与服务器页同一句）：这几个分区**能不能同时成立**？能 ——
        五批任务互不相交，"总览"这件事本身就是"五批一起看"。
        ⇒ 本页做「定位 + 当前项随滚动同步」，**不做** display 互斥切换。
        连带三条（一件都不能漏）：
          ① 每块 `scroll-margin-top`，滚过去的落点不被 sticky 条压住；
          ② 切换函数加守卫：已经在眼前就不滚 + `spyLock` 挡滚动回声；
          ③ h1 写**页面**名（任务总览），不写当前分区名。

     ⚠️ 与服务器页的一处**关键差别**：那边的分区是"数据里分出来的组"（各项目），
        删空就该从圆盘上消失；本页的时间桶是**格子**，空格子仍然留在那儿 ——
        "逾期是空的"本身就是要一眼看到的信息。所以桶写死五个，计数现算。

     ⚠️ 顶部三格是**页面级仪表**，各自回答一件"动手前要确认的事"，且**都与时间桶正交**
        （桶是时间维，这三格是状态 / 完成 / 异常维）⇒ 不与任何块头计数重复：
          ① 进行中 N 件 —— 手上还开着几件
          ② 本周完成 N 件 —— 这一周推得怎么样
          ③ 最久的欠账 N 天 —— 有没有正在烧的火

     ⚠️ 筛选**只给「项目」**：筛的永远是"另一个维度"——本页按时间分块，所以筛项目。
        由此还白拿一条：圆盘（时间）与筛选（项目）是两个正交维度，
        谁也藏不住谁 ⇒ **不需要**服务器页那套"先放开筛选再滚"（那是对同维度的补丁）。

     材质 / 令牌 / 图标 / 导航壳**逐字承接**服务器页（那是本仓当前口径）：
       · 面阶四档、强调色三档（--m-main 图形 / --m-ink 文字 / --m-fill 实底）、描边两档；
       · 逾期只用 `--alert-fg`，且只落在块头名字与行尾时间标记上，不涂整行底；
       · 图标一套制：一张 ICON 表 + `svgIcon / paintIcons / setIcon`，全页无 emoji；
       · 导航壳 = design/index/导航-v5.html 的导航段 + 三处偏差（不自动下钻 /
         一级模块只有「工作」可进 / 页头只放路径）。
       · ⚠️ 本页**新加了**一支 `--border-field`（≥3:1）：勾选框是"形状"，
         分隔档的 `--border-subtle`(7% 黑) 撑不起来。
       · ⚠️ `--danger-*` / `--info-*` / `--idle-*` 没有搬进来：本页没有破坏性操作、
         也没有"待机 / 信息"这两种语义的消费者 ⇒ 留一个没人消费的令牌
         等于留一份"看着像事实源、其实没人用"的第二描述。
     ---------------------------------------------------------------------------- -->
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>任务 · 工作</title>
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
