# -*- coding: utf-8 -*-
"""`工作-项目-项目详情-Bug-index.html` 的构建脚本（可重跑）。

**派生，不重切壳**：源页 = `工作-项目-项目详情-账户-index.html`
（同为"项目详情第 N 分区"，同一套令牌 / 图标表 / 导航壳 / Hero / Tab 条 / KPI 条 / 侧栏槽）。
本脚本只换五件事：

  ① 文件头（源页那篇讲的是"凭据"，分区、分工、默认态全不是这一页的）；
  ② CSS：切掉源页"账户专属"那一整段（凭据清单 / 抽屉表单 / 密码生成器 / 它的响应式），
     换成这一页的（分组清单 + 行 + 展开区），响应式自己重写一遍；
  ③ 侧栏槽与 Tab 条：槽从四格收成三格（**不放 KPI** —— 顶部已经有仪表条了），
     Tab 条把 Bug 标成 active 且计数现算；
  ④ 主内容：KPI 条 + `#bugGroups`（分组卡由数据现算，静态那一份交给
     `._seed-bugs.cjs` 灌）；
  ⑤ 脚本：保留源页的壳（主题 / 图标表 / 导航壳 / Toast），删掉账户专属的那三段
     （数据 / 生成器 / 抽屉），换成这一页的数据与渲染。

⚠️ 每一步都断言（`must` / `rep` / 行号锚点）：找不到就 `SystemExit`，不静默跳过 ——
   `str.replace` 找不到时什么都不做也不报错，那正是"我以为改了"的来源。
"""
import io, os, subprocess, shutil, sys

NODE_FALLBACK = ('/Users/yangliu/Library/Application Support/Parall/WorkBuddy(Parall_3)'
                 '/.workbuddy/binaries/node/versions/22.22.2-3/bin/node')

# ============================================================================
# 本页专有的内容（原地维护；改完重跑本脚本即可）
# ============================================================================

NEW_COMMENT = r'''<!-- ============================================================================
     项目详情 · Bug（`工作-项目-项目详情-Bug-index.html`）
     ----------------------------------------------------------------------------
     项目详情第 3 个分区「Bug」的界面。

     这一区回答的问题：**这个项目现在坏在哪几处、各修到哪一步、我该先动哪个。**
     ⇒ 所以第一屏不是"有多少条"，而是"先修哪一条"。

     与邻页的分工：
       · `工作-项目-项目详情-总览-index.html` 只报"最坏的那一条"（六条横带里的一行），
         本页是那一条的**全部账本**；
       · `工作-任务-总览-index.html` 管任务（按期推进）；本页管 Bug（按状态推进）——
         两页不能合成一页：任务问"到期了没有"，Bug 问"修到哪一步"。

     ⚠️ **形态选型**（判据只有一条：这一段的数据是什么形状，它就长成什么样子）：
         一条 Bug = 一份**有状态流转的申报**（待修复 → 修复中 → 待验证 → 已关闭）
         ⇒ 按状态分组的清单。不是书（没有封面）、不是抽屉（不是从属的一份）、
           不是路线图（没有层级）、**也不是时间桶** —— Bug 的推进不由日期驱动。
        ⚠️ 四组**能同时成立**（都是当前项目的 Bug）⇒ 同页并列、全部可见，
           圆盘只做「定位 + 滚动同步」，不做互斥切换。
        ⚠️ 四组与组里的行**全部由 `BUGS` 现算**：写死常量会在推进一条之后继续报旧数，
           也会在一组被删空之后留一格点进去什么都没有。

     ⚠️ **颜色只承载一种语义**（全页唯一的用色处在行上）：
         · 状态 → 由**分组**承担，组头一律 图标 + 文字，不给颜色；
         · 严重度 → 行首一条 3px 色条 + 一枚胶囊，这是全页唯一用色的东西；
         · 来源（测试发现 / 用户反馈 / 监控告警 / 代码扫描）与模块 → 图标 + 文字。
       判据：一条列表里颜色只表达一件事，读者才不会把"严重"读成"这条卡住了"。

     ⚠️ 主内容**静态 + 脚本增强**：预览面板走 `/static-html/…`（不跑脚本）⇒
        `#bugGroups` 由 `._seed-bugs.cjs` 用页面**自己的模板函数**提前灌进标记
        （不手抄第二份）。

     材质 / 令牌 / 图标 / 导航壳**逐字承接账户页与运维页**（那是本仓的当前口径）。
     ---------------------------------------------------------------------------- -->'''

NEW_CSS = r'''        /* ============================================================
           ③ 本页内容：一条 Bug 的清单（按状态分组）
           —— 数据形状与形态选型的推导写在文件头那一段，这里只说落地的样子。
           ============================================================ */

        /* ── 仪表三格的列宽 ──────────────────────────────────────────
           ⚠️ 用 `minmax(0, 1fr)` 而不是 `1fr`：后者的最小尺寸取内容的 `min-content`，
              某一格内容一长（第一格那句是"严重度 · 拖延天数 · 标题"）就会把整行撑破、
              页面出现横向滚动。与源页同一写法。 */
        .kpi-bar { grid-template-columns: repeat(3, minmax(0, 1fr)); }

        /* ── 分区卡右侧那句话：回答"这一组为什么值得看" ──────────────
           ⚠️ 它不许复述计数（徽标已经在说），也不许复述行上的值（读者往下扫就有）
              ⇒ 只写**跨这一组**才成立的那句（"有 1 条致命" / "平均 5 天修好"）。 */
        .ops-note { font-size: 11.5px; color: var(--text-muted); }

        /* ── 清单：连续的行，不逐行留白、不逐行圆角 ────────────────────
           行与行之间靠 3px 的**严重度色条**连成一条带，扫一眼就能看出轻重分布；
           每条上面一条 `--border-subtle` 分界线 —— **这是它们能被读成"一条一条"的
           唯一依据**（行是透明底，只给内边距时读者看到的是一整个长段落）。
           圆角交给 `.ops-card`（它 `overflow: hidden`）⇒ 首尾两行不会露出半个圆角。 */
        /* ── 分组容器：四张卡之间的间距 ────────────────────────────────
           ⚠️ 这一层是**必需**的（动态重渲要一个落点），但它一进来就隔断了
              `.detail` 的 `gap` —— 那个 gap 只作用在**直接孩子**上，
              而这里四张卡是"孙子"。漏掉这条的症状：卡片卡贴卡片
              （用户原话「都已经卡片贴卡片」）—— 块级 div 之间本来就没有默认间距。
           ⇒ 间距值**跟 `.detail` 那档走**（20px / 窄屏 16px），两处不许各写各的。 */
        #bugGroups { display: flex; flex-direction: column; gap: 20px; }

        .bug-list { display: flex; flex-direction: column; }

        /* 一行 = 两行文字 + 行尾一枚动作。
           ⚠️ 分成两行不是为了好看：**第一行放会变的状态**（严重度 / 标题 / 停滞天数），
              **第二行放不变的身份**（编号 / 模块 / 来源 / 负责人）——
              这样每组里纵向扫下去，第一行读的是"现在怎么样"，第二行读的是"这是哪一条"。 */
        .bug-row {
            /* 兜底 = 分隔档：既不是致命也不是严重的那两档不该整块透明 */
            --sev: var(--border-strong);
            position: relative;
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            align-items: start;
            /* 行内两行（第一行 = 会变的状态、第二行 = 不变的身份）与展开区之间的间距。
               ⚠️ 行与行的分界**不靠间距**（那是上一版的做法，12 条会糊成一片）——
                  靠 `+ .bug-row` 顶上那条分界线。 */
            gap: 4px 12px;
            padding: 10px 12px 10px 15px;
            transition: background 0.16s ease;
            /* 侧栏"最久"那几条点过来时，别把这一行压在视口顶边 */
            scroll-margin-top: 96px;
        }
        /* ⚠️ 色条用 `box-shadow: inset` 而不是 `border-left`：
              后者会让内容整体右移 2~3px，同一组里"有色的行"和"没色的行"文字就对不齐。 */
        .bug-row { box-shadow: inset 3px 0 0 var(--sev); }
        /* 每一条上面一条分界线 —— **这是 12 条能被读成"一条一条"的唯一依据**
           （行是透明底，只靠内边距分组时看起来是一整个长段落）。
           ⚠️ 与色条合在同一条 `box-shadow` 里，后者会**覆盖**前者，所以要写全两份。 */
        .bug-row + .bug-row { box-shadow: inset 3px 0 0 var(--sev), inset 0 1px 0 var(--border-subtle); }
        .bug-row:hover { background: var(--bg-hover); }

        .bug-row.is-fatal   { --sev: var(--danger-fg); }
        .bug-row.is-major   { --sev: var(--warn-fg); }
        .bug-row.is-minor   { --sev: var(--border-strong); }
        .bug-row.is-trivial { --sev: var(--border-subtle); }
        /* 已关闭那一组整体退一档注意力：色条与胶囊都换成中性档，
           否则一屏里最扎眼的会是几条早就修完的。 */
        .bug-row.is-closed { --sev: var(--border-subtle); }

        /* 整行可点（点开复现步骤）：它是一枚**真按钮** ——
           Enter / Space 天然可用，不必再挂 role + keydown。
           ⚠️ 行尾那枚"推进"按钮必须在它**外面**（按钮里套按钮非法）。 */
        .bug-main {
            grid-column: 1;
            display: flex; flex-direction: column; gap: 5px;
            min-width: 0;
            padding: 0; border: none; background: none;
            font: inherit; color: inherit; text-align: left; cursor: pointer;
            border-radius: 8px;
        }
        .bug-main:focus-visible { outline: 2px solid var(--m-main); outline-offset: 2px; }

        /* ⚠️ 这两个是 `<span>`：原生 `<button>` 里只许放 phrasing content。
              它们能当块用**只因为这里写了 display** —— span 上没写 display 时
              margin / text-align / text-overflow 全不生效（表现是"看着差不多、其实没对齐"）。 */
        .bug-line1 { display: flex; align-items: center; gap: 8px; min-width: 0; }
        .bug-line2 { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; font-size: 11.5px; color: var(--text-muted); }

        /* ── 严重度胶囊 ──────────────────────────────────────────── */
        .sev-chip {
            flex-shrink: 0; padding: 1px 7px; border-radius: 6px;
            font-size: 10.5px; font-weight: 700; letter-spacing: 0.02em;
            background: var(--bg-subtle); color: var(--text-secondary);
        }
        .bug-row.is-fatal .sev-chip { background: var(--danger-bg); color: var(--danger-fg); }
        .bug-row.is-major .sev-chip { background: var(--warn-bg);   color: var(--warn-fg); }
        .bug-row.is-trivial .sev-chip { font-weight: 600; color: var(--text-muted); }
        .bug-row.is-closed .sev-chip { background: var(--bg-subtle); color: var(--text-muted); }

        .bug-title {
            font-size: 13.5px; font-weight: 600; color: var(--text-primary);
            min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        /* 已关闭的标题退到次要色 —— 它还在清单里（要能翻账），但不该抢当前的在修项 */
        .bug-row.is-closed .bug-title { color: var(--text-secondary); font-weight: 500; }

        /* 停滞天数：**文字**而不是颜色（颜色已经被严重度占满了）。
           ⚠️ `margin-left: auto` 把它顶到右端 —— 它是第一行里唯一"会随时间变"的那个数。 */
        .bug-age {
            flex-shrink: 0; margin-left: auto;
            font-size: 11px; color: var(--text-muted);
            font-variant-numeric: tabular-nums;
        }

        /* ── 第二行：不变的身份 ──────────────────────────────────── */
        .bug-id {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 11px; letter-spacing: -0.01em;
        }
        .bug-dot { color: var(--text-muted); opacity: 0.55; }
        .bug-src { display: inline-flex; align-items: center; gap: 4px; }
        .bug-src svg { width: 12px; height: 12px; flex-shrink: 0; }
        .bug-own { color: var(--text-secondary); }
        /* 「重开过」归**风险**那一族（和严重度同一个语义：这条有多难），所以它可以用色；
           形状（一枚回转箭头）也一起给 —— 颜色在任何主题下都不是唯一线索。 */
        .bug-reopen {
            display: inline-flex; align-items: center; gap: 3px;
            font-weight: 700; color: var(--danger-fg);
        }
        .bug-reopen svg { width: 11px; height: 11px; flex-shrink: 0; }

        /* ── 行尾那枚动作：把这一条推进到下一个状态 ────────────────────
           ⚠️ 它压在**两种面**上（未悬停的行 = --bg-card、悬停的行 = --bg-hover）⇒
              不能给固定底色：一个底色必然在一种面上和背景撞成一样、
              在另一种面上变成"比背景还浅的洞"。所以只给描边，悬停只改字色。 */
        .bug-acts { grid-column: 2; align-self: start; display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
        .bug-adv {
            flex-shrink: 0; padding: 3px 10px; border-radius: 8px; border: none;
            background: transparent;
            font-size: 11.5px; font-weight: 600; color: var(--text-secondary);
            box-shadow: inset 0 0 0 1px var(--border-strong);
            cursor: pointer;
            transition: color 0.16s ease, box-shadow 0.16s ease;
        }
        .bug-adv:hover { color: var(--m-ink); box-shadow: inset 0 0 0 1px var(--m-main); }
        .bug-adv:focus-visible { outline: 2px solid var(--m-main); outline-offset: 2px; }
        /* 已关闭那一组的动作是"重开"，比推进更重 —— 但仍是同一枚按钮，只把描边提一档色 */
        .bug-row.is-closed .bug-adv { color: var(--text-muted); }
        /* 「去任务列表」= 这条路走通之后的**下一站**，不是第二个"做同一件事"的入口。
           它是 `<a>`（要离开本页），所以用链接的样式：常驻可见、悬停只加薄染底。 */
        .bug-go {
            flex-shrink: 0; padding: 3px 9px; border-radius: 8px;
            font-size: 11.5px; font-weight: 600; color: var(--m-ink);
            text-decoration: none; white-space: nowrap;
            box-shadow: inset 0 0 0 1px var(--m-main);
            transition: background 0.16s ease;
        }
        .bug-go:hover { background: var(--m-soft); }
        .bug-go:focus-visible { outline: 2px solid var(--m-main); outline-offset: 2px; }
        /* 任务号：等宽 —— 与任务页那边的 `T25` 是同一种写法 */
        .bug-promoted {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 10.5px; font-weight: 700; color: var(--m-ink);
        }

        /* ── 展开区：复现步骤 + 环境 ──────────────────────────────────
           ⚠️ 默认收起（这一层不是"被藏起来的信息"，是"每条都摊开会变成一屏一条"）。
           ⚠️ `[hidden]` 只自带 display:none ⇒ 作者样式里给过 display 的元素必须补一条。 */
        .bug-detail { grid-column: 1 / -1; margin-top: 3px; padding: 10px 12px 11px; border-radius: 8px; background: var(--bg-subtle); }
        .bug-detail[hidden] { display: none; }
        .bd-label {
            font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em;
            color: var(--text-muted); margin-bottom: 6px;
        }
        .bd-steps { margin: 0; padding-left: 17px; display: flex; flex-direction: column; gap: 4px; }
        .bd-steps li { font-size: 12.5px; color: var(--text-secondary); line-height: 1.55; }
        .bd-foot {
            margin-top: 10px; padding-top: 9px;
            border-top: 1px solid var(--border-subtle);
            display: flex; align-items: center; gap: 7px; flex-wrap: wrap;
            font-size: 11.5px; color: var(--text-muted);
        }
        .bd-acts { margin-left: auto; display: flex; gap: 4px; }
        .bd-act {
            display: inline-flex; align-items: center; gap: 4px;
            padding: 3px 8px; border: none; border-radius: 7px;
            background: transparent; cursor: pointer;
            font-size: 11.5px; color: var(--text-muted);
            transition: background 0.16s ease, color 0.16s ease;
        }
        .bd-act:hover { background: var(--bg-hover); color: var(--text-primary); }
        .bd-act svg { width: 12px; height: 12px; flex-shrink: 0; }
        /* 展开区里的删除：**同一枚按钮，只换 hover 的颜色** —— 它不该长得像
           "另一个功能"，但按下去会引出一个不可逆的确认（红色是它的预告）。 */
        .bd-act-danger:hover { background: var(--danger-bg); color: var(--danger-fg); }
        /* 复现步骤为空时的占位。表单里它是必填，所以只会出现在**早期登记的旧数据**上
           —— 与其渲染一个空的 <ol>，不如说清"这条还没写"。 */
        .bd-none { display: flex; align-items: center; gap: 6px; font-size: 12.5px; color: var(--text-muted); }
        /* "未指派"与"张琪"在同一行里要能一眼分开：前者是**待补的**，后者是人。 */
        .bug-own.is-none { font-style: italic; }

        /* 侧栏「最久」里点过来时闪一下：**只闪背景**（那条行的严重度色条不能跟着变，
           否则"我点的那条"会被读成"这条变严重了"）。 */
        @keyframes bug-flash { 0%, 100% { background: transparent; } 30% { background: var(--m-soft); } }
        .bug-row.is-flash { animation: bug-flash 1.1s ease; }

        /* KPI 第一格那枚编号：等宽 + 缩一号 —— 它是**一条 Bug 的编号**，
           `kpi-val` 原本的字号会把这一格撑成"标题"。 */
        /* 编号那一格：等宽（与下面每一行的 `BUG-1042` 同一种字体），
           字号与字重**跟另两格对齐** —— 三格并排时差一号，会被读成"这格不一样重"。 */
        .bug-kpival {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 21px; font-weight: 800; letter-spacing: -0.02em;
        }

        /* ── 模块名：它也是"身份"，但比编号/来源更需要被读到 ⇒ 提一档字色 ────── */
        .bug-mod { color: var(--text-secondary); }

        /* ── Hero 的状态徽标 ────────────────────────────────────────
           这一族的定义长在源页「账户专属」那一段里（跟着凭据清单一起来的，第 1957 行），
           整段被切掉 ⇒ 原地补回来，否则 Hero 上那枚「进行中」会变成裸文字。
           只补本页用得上的五条：基础 + ok / info / warn / danger。
           idle / plain 两档**不补** —— 本页没有"闲置""无标记"这两种状态，
           搬过来就是一份没人消费的第二描述（判据：不搬"以后可能用得上"的东西）。 */
        .badge { font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; flex-shrink: 0; white-space: nowrap; letter-spacing: 0.01em; }
        .badge.ok { background: var(--ok-bg); color: var(--ok-fg); }
        .badge.info { background: var(--info-bg); color: var(--info-fg); }
        .badge.warn { background: var(--warn-bg); color: var(--warn-fg); }
        .badge.danger { background: var(--danger-bg); color: var(--danger-fg); }

        /* 侧栏「最久」在一条都没登记时的样子。
           ⚠️ 这一页只有"池子本来就空"这一种空（没有筛选，也没有第二种分组维度）
              ⇒ 只说"还没有"，**不留一枚点了什么也不会发生的按钮**。 */
        .slot-empty { padding: 10px 4px; font-size: 12px; color: var(--text-muted); }
        /* ============================================================
           维护：报告 / 编辑一条 Bug
           —— 形态是**抽屉**，不是独立页。判据：新增与编辑都是"从清单里抽出来的
              一份"，填的时候要能看见旁边那几条（改严重度时想比一比"还有哪些致命"）；
              独立页会把这份对照拿走，而且改完还得自己找回来。
           层次：抽屉(190) < 弹窗 / ⌘K(200) < Toast(300) —— 与源页同一口径：
              抽屉里点删除引出的二次确认必须浮在它**上面**。
           ⚠️ 这一族刻意不叫 `.ac-*`（那是账户页的前缀）：同一份形状、两处消费者，
              改名是为了将来搜 `.bug-` 时不会被漏掉，不是为了另起一套。
           ============================================================ */
        .bug-drawer { position: fixed; inset: 0; z-index: 190; }
        .bug-drawer[hidden] { display: none; }      /* ⚠️ 下面写了 display，这条不能少 */
        .bug-drawer-mask { position: absolute; inset: 0; background: var(--scrim); }
        .bug-drawer-panel {
            position: absolute; top: 0; right: 0; bottom: 0;
            width: min(470px, calc(100% - 32px));
            display: flex; flex-direction: column;
            background: var(--bg-card);
            border-left: 1px solid var(--border-card);
            box-shadow: var(--shadow-float);
            animation: bug-drawer-in .26s cubic-bezier(.4, 0, .2, 1);
        }
        @keyframes bug-drawer-in { from { transform: translateX(28px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .bug-drawer-panel { animation: none; } }
        .bug-drawer-head { display: flex; align-items: flex-start; gap: 12px; padding: 16px 18px 14px; border-bottom: 1px solid var(--border-subtle); }
        .bug-drawer-head > div { flex: 1; min-width: 0; }
        .bug-drawer-title { font-size: 15px; font-weight: 800; }
        .bug-drawer-sub { font-size: 11.5px; color: var(--text-muted); margin-top: 5px; line-height: 1.55; }
        .bug-drawer-head .modal-close { flex-shrink: 0; }
        .bug-drawer-body { flex: 1; overflow-y: auto; min-height: 0; padding: 16px 18px 20px; display: flex; flex-direction: column; gap: 14px; }
        .bug-drawer-foot { display: flex; align-items: center; gap: 8px; padding: 12px 18px; background: var(--bg-subtle); border-top: 1px solid var(--border-subtle); }
        .bug-drawer-foot .spacer { flex: 1; }
        /* 抽屉开着时背后那一列不许跟着滚（滚轮落在遮罩上会带着清单跑） */
        .main.bug-lock { overflow: hidden; }

        /* ── 字段：只有"两个单值并排"才用两列，其余一律占满 ──────────── */
        .field { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
        .field.two { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 12px; }
        .field-label { font-size: 11.5px; font-weight: 700; color: var(--text-secondary); }
        .field-hint { font-size: 11px; color: var(--text-muted); line-height: 1.5; }
        .field-hint.bad { color: var(--danger-fg); font-weight: 700; }
        .inp {
            width: 100%; box-sizing: border-box;
            font-family: inherit; font-size: 12.5px;
            padding: 8px 10px; border-radius: 8px;
            background: var(--bg-card); color: var(--text-primary);
            /* 输入框的形只靠这条边 ⇒ 用 ≥3:1 的输入档，不借只分隔区块的 --border-subtle */
            border: 1px solid var(--border-field);
            transition: border-color .15s ease, box-shadow .15s ease;
        }
        .inp::placeholder { color: var(--text-muted); }
        .inp:focus { outline: none; border-color: var(--m-main); box-shadow: 0 0 0 3px var(--m-soft); }
        .inp.bad { border-color: var(--danger-fg); }
        textarea.inp { resize: vertical; min-height: 98px; line-height: 1.65; }
        /* 复现步骤一行一步 ⇒ 等宽：整块读起来像一段录下来的操作 */
        textarea.inp.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }

        /* ── 选项胶囊（严重度 / 状态 / 来源）──────────────────────────
           判据：「归类」给"选"不给"填" —— 这三样都是有限集合（4 / 3 / 4 档），
           而且它们的取值本来就和常驻显示用的是同一张表。 */
        .chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
        .chip {
            display: inline-flex; align-items: center; gap: 6px;
            font-family: inherit; font-size: 11.5px; font-weight: 600;
            padding: 5px 11px; border-radius: 999px; cursor: pointer;
            background: var(--bg-subtle); color: var(--text-secondary);
            border: 1px solid transparent;
            transition: background .15s ease, color .15s ease, box-shadow .15s ease;
        }
        .chip:hover { color: var(--text-primary); }
        .chip:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
        /* 选中态不能只靠底色差（灰底 vs 白底 ≈1.1:1，等于看不见）⇒ 描边 + 圆点两条形状线索 */
        .chip.on { background: var(--bg-card); color: var(--text-primary); box-shadow: inset 0 0 0 1.5px var(--m-main); }
        .chip.on::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: var(--m-main); flex-shrink: 0; }
        /* ⚠️ 严重度那四枚的色点与**行上的色条同源**（都用 `--sev`）：表单里看一眼
              就知道哪档更重，不用先记住四个词。其余两组不给色 —— 这一页的颜色
              只承载"多严重"一种语义。 */
        .chip-sev[data-v="fatal"]   { --sev: var(--danger-fg); }
        .chip-sev[data-v="major"]   { --sev: var(--warn-fg); }
        .chip-sev[data-v="minor"]   { --sev: var(--border-strong); }
        .chip-sev[data-v="trivial"] { --sev: var(--border-subtle); }
        .chip-sev.on { box-shadow: inset 0 0 0 1.5px var(--sev); }
        .chip-sev.on::before { background: var(--sev); }

        /* ── 破坏性操作：危险按钮 + 弹窗里那条"影响" ──────────────────
           它们长在源页的账户专属段里（跟着凭据清单一起来的），那段没搬 ⇒ 原地补。
           `.modal-warn.info` 那一档**不补**：本页只用 danger 一种影响提示。 */
        .btn-danger { background: var(--danger-fg); color: #fff; }
        .btn-danger:hover { filter: brightness(1.08); transform: translateY(-1px); }
        .btn-danger:disabled { opacity: .45; cursor: not-allowed; transform: none; filter: none; }
        .modal-warn {
            margin-top: 14px; padding: 12px 14px; border-radius: var(--r-md);
            background: var(--danger-bg); color: var(--danger-fg);
            font-size: 12.5px; line-height: 1.65;
        }
        .modal-warn strong { font-weight: 800; margin-right: 2px; }

        /* 命令面板的条目过滤：`.cmd-item` 自己写了 `display: flex` ⇒
           不补这条，`el.hidden = true` 藏不住任何东西（过滤"看着没反应"）。*/
        .cmd-item[hidden] { display: none; }

        /* ── 本分区的动作行 ──────────────────────────────────────────
           `margin-top` 是**负的**：它跟 Tab 条是一组（都在说"当前这个分区"），
           所以刻意把那一档间距收窄，让它跟下面 KPI 那一组的距离肉眼可辨
           （判据：组距 > 项距）。窄屏 `.detail` 的 gap 收到 16 ⇒ 这里仍是 8，成立。 */
        .bug-toolbar { display: flex; align-items: center; gap: 8px; margin-top: -8px; }
        /* 输入框吃掉左侧余量，两枚按钮落在右端：
           「记下来」是主路径（primary），「详细填…」是"现在就填全"的另一条路。 */
        .bug-quick { flex: 1; min-width: 0; }
        .bug-quick.bad { border-color: var(--danger-fg); }

        /* ── 页面级空态 ──────────────────────────────────────────────
           全删空之后，"空组不渲染"会把四张组卡一起收走 ⇒ 页面只剩仪表三格，
           读者会以为页面坏了。虚线框（不是实体卡）说明"这里本来该有东西"。 */
        .bug-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 44px 24px 48px; background: var(--bg-card); border: 1px dashed var(--border-strong); border-radius: var(--r-lg); }
        .bug-empty[hidden] { display: none; }   /* ⚠️ 上面写了 display，这条不能少 */
        .bug-empty-ico { color: var(--text-muted); }
        .bug-empty-title { font-size: 14px; font-weight: 800; }
        .bug-empty-sub { font-size: 12px; color: var(--text-muted); text-align: center; line-height: 1.6; }
'''

NEW_RESP = r'''        /* ============================================================
           响应式（本页自己的一段：源页那段里全是凭据抽屉的断点，一个都不适用）
           ============================================================ */
        @media (max-width: 980px) {
            .kpi-bar { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
            .main { padding: 16px; }
            .detail { gap: 16px; }
            #bugGroups { gap: 16px; }
            /* 窄屏抽屉占满整宽，两列字段回落单列 */
            .bug-drawer-panel { width: 100%; border-left: 0; }
            .field.two { grid-template-columns: minmax(0, 1fr); }
            /* Hero 右半（报告 Bug）换到第二行右端 —— 与项目详情页同一个断点 */
            .hero-bar { flex-wrap: wrap; gap: 10px; }
            .hero-bar-right { width: 100%; justify-content: flex-end; gap: 10px; }
            .hero-name { font-size: 14px; }
            .ops-note { display: none; }
        }
        @media (max-width: 560px) {
            .kpi-bar { grid-template-columns: 1fr; }
            /* 窄屏一行放不下两列 ⇒ 动作落到标题下面一行；
               ⚠️ 不能"占列 + 隐藏"（visibility:hidden 仍占宽度）。 */
            .bug-row { grid-template-columns: minmax(0, 1fr); }
            .bug-acts { grid-column: 1; justify-self: start; margin-top: 2px; }
            .bug-detail { grid-column: 1; }
            .bd-acts { margin-left: 0; width: 100%; }
            .modal-actions { flex-direction: column-reverse; }
            .modal-actions .btn { justify-content: center; }
        }'''

# 侧栏槽：三格（最久 / 快捷 / AI）。
# ⚠️ **不放 KPI** —— 页面顶部已经有那一条仪表；判据：侧栏的槽数要看有没有第二处表达，
#    槽里放 KPI 而顶部已有仪表条 ⇒ 只留一侧。
NEW_SLOTTABS = r'''                <div class="slot-tabs" id="slotTabs">
                    <div class="slot-tab active" data-slot="recent">最久</div>
                    <div class="slot-tab" data-slot="quick">快捷</div>
                    <div class="slot-tab" data-slot="ai">AI</div>
                </div>'''

SLOT_BODY = r'''                <div class="slot-body">
                    <!-- 「最久」= 未关闭里停滞最久的四条，点一条滚过去并展开那一条。
                         ⚠️ 它不是"最近访问" —— Bug 这一页没有"我最近看过什么"这个状态，
                            有的是"哪几条已经躺太久了"，那才是读者在这一格里要的。 -->
                    <div class="slot-panel active" data-panel="recent" id="slotStale"></div>

                    <!-- 快捷操作 -->
                    <div class="slot-panel" data-panel="quick">
                        <div class="quick-grid">
                            <button class="quick-btn" onclick="openBugForm()">
                                <span data-ico="plus" data-ico-size="15"></span>
                                报告 Bug
                            </button>
                            <button class="quick-btn" onclick="activatePanel('open')">
                                <span data-ico="alert" data-ico-size="15"></span>
                                跳到待修复
                            </button>
                            <button class="quick-btn" onclick="copyBugList()">
                                <span data-ico="copy" data-ico-size="15"></span>
                                复制清单
                            </button>
                            <button class="quick-btn" onclick="focusBug(firstFix().id)">
                                <span data-ico="bug" data-ico-size="15"></span>
                                看最该先动的
                            </button>
                            <button class="quick-btn" onclick="openCmd()">
                                <span data-ico="info" data-ico-size="15"></span>
                                AI 助手
                            </button>
                        </div>
                    </div>

                    <!-- AI -->
                    <div class="slot-panel" data-panel="ai">
                        <div class="ai-chat">
                            <div class="ai-msg bot">BUG-1042 躺了 12 天，是唯一一条致命的 —— 它在「待修复」，但没有负责人以外的任何记录。要我按对账链路列一遍可能的断点吗？</div>
                            <div class="ai-msg user">先看它卡在哪</div>
                            <div class="ai-msg bot">它的复现步骤只写了"导出后末位被四舍五入"，没有带金额样例。先补一条样例再动手，比现在直接改要省一半时间。</div>
                        </div>
                        <div class="ai-input">
                            <input type="text" placeholder="问点什么…" />
                            <button class="ai-send" type="button" aria-label="发送">
                                <span data-ico="send" data-ico-size="12"></span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>'''

TABS = r'''                <div class="tabs" role="tablist" aria-label="项目详情分区">
                    <button class="tab" role="tab" onclick="demo('总览 Tab')"><span data-ico="dashboard" data-ico-size="15"></span> 总览</button>
                    <button class="tab" role="tab" onclick="demo('任务 Tab')"><span data-ico="task" data-ico-size="15"></span> 任务 <span class="tab-count">5/8</span></button>
                    <button class="tab active" role="tab" aria-selected="true" onclick="toast('已在本页','info')"><span data-ico="bug" data-ico-size="15"></span> Bug <span class="tab-count" id="tabBugCount">—</span></button>
                    <button class="tab" role="tab" onclick="location.href='work_project_detail_document.html'"><span data-ico="doc" data-ico-size="15"></span> 文档 <span class="tab-count">9</span></button>
                    <button class="tab" role="tab" onclick="location.href='工作-项目-项目详情-运维-index.html'"><span data-ico="rocket" data-ico-size="15"></span> 运维 <span class="tab-count">2·3·4</span></button>
                    <button class="tab" role="tab" onclick="demo('会议 Tab')"><span data-ico="calendar" data-ico-size="15"></span> 会议 <span class="tab-count">2</span></button>
                    <button class="tab" role="tab" onclick="location.href='工作-项目-项目详情-账户-index.html'"><span data-ico="key" data-ico-size="15"></span> 账户 <span class="tab-count">8</span></button>
                </div>'''

NEW_CONTENT = r'''            <!-- ========== 本分区的动作行 ==========
                 放在 Tab 条**下面**而不是 Hero 里：Hero 那一排是项目级的
                 （编辑项目 / 重新检查 / 进度 / 截止），而"报告 Bug"动的是**本分区**的清单 ——
                 动作要和它作用的范围在一起。
                 ⚠️ 它属于 **Tab 条那一组**（都在说"当前这个分区"）⇒ 与 Tab 条的间距
                    要明显小于与下面 KPI 那一组的（判据：组距 > 项距），靠负 margin 收。
                 ⚠️ 不给底色：它是一条**控件行**，不是一张卡（卡要有页脚与落点）。 -->
            <div class="bug-toolbar">
                <!-- 记一条的成本必须接近"打一句话" —— 这是**主路径**，不是"快捷方式"。
                     其余字段全给默认值（一般 / 待修复 / 测试发现），缺的由清单自己说出来
                     （"还没写复现步骤" / "未指派"），而不是在录入时拦着人。
                     判据：**拦着人填全的代价，是他干脆不记了。** -->
                <input class="inp bug-quick" id="quickName" type="text" autocomplete="off" spellcheck="false"
                       placeholder="一句话说清哪儿不对 —— 回车就记下来，剩下的回头补"
                       onkeydown="if(event.key==='Enter'){event.preventDefault();quickAddBug();}" />
                <button class="btn btn-primary btn-sm" type="button" onclick="quickAddBug()">记下来</button>
                <button class="btn btn-ghost btn-sm" type="button" onclick="openBugForm()">详细填…</button>
            </div>

            <!-- ========== 页面级仪表 ==========
                 三格都回答"我下一步该动哪个" —— 这是本页唯一不可替代的一屏，
                 **不是四个分组徽标的复述**：
                   · 先修哪条 = 跨四组取"严重度最高、又卡得最久"的那一条；
                   · 谁最多   = 跨四组数手上未关闭最多的那个人；
                   · 重开过   = 跨四组数"修完又坏"的条数。
                 ⚠️ 三格都**不报未关闭总数** —— 总数已经在 ③ 那排 tab 与圆盘上，
                    "同一个数字只在一处表达"。
                 ⚠️ 三个值全部由 `sync()` 现算（会变的值不许写死在常量表里），
                    并且对空数据集有护栏（一条都没有时显示 "—" 而不是抛异常）。 -->
            <div class="kpi-bar">
                <div class="kpi" id="kpiFirst">
                    <div class="kpi-top"><span class="kpi-ico" aria-hidden="true" data-ico="bug" data-ico-size="15"></span><span class="kpi-label">先修哪条</span></div>
                    <div class="kpi-val bug-kpival" id="kpiFirstVal">—</div>
                    <div class="kpi-sub" id="kpiFirstSub">—</div>
                </div>
                <div class="kpi">
                    <div class="kpi-top"><span class="kpi-ico" aria-hidden="true" data-ico="user" data-ico-size="15"></span><span class="kpi-label">谁最多</span></div>
                    <div class="kpi-val" id="kpiOwnVal">—</div>
                    <div class="kpi-sub" id="kpiOwnSub">—</div>
                </div>
                <div class="kpi" id="kpiReopen">
                    <div class="kpi-top"><span class="kpi-ico" aria-hidden="true" data-ico="undo" data-ico-size="15"></span><span class="kpi-label">重开过</span></div>
                    <div class="kpi-val" id="kpiReopenVal">—</div>
                    <div class="kpi-sub" id="kpiReopenSub">—</div>
                </div>
            </div>

            <!-- ========== Bug 清单：按状态分四组 ==========
                 ⚠️ 四组的顺序 = 圆盘那四格 = `GROUPS` 的顺序，一处改三处跟着变。
                 ⚠️ 组与行全部由 `BUGS` 现算；**空组不渲染**（删空之后不该留一格
                    点进去什么都没有）。静态那一份由 `._seed-bugs.cjs` 灌进来。 -->
            <div id="bugGroups"></div>

            <!-- 页面级空态：全删空之后，"空组不渲染"会把四张组卡一起收走 ⇒
                 页面上只剩仪表三格，读者会以为页面坏了。 -->
            <div class="bug-empty" id="bugEmpty" hidden>
                <span class="bug-empty-ico" aria-hidden="true" data-ico="bug" data-ico-size="22"></span>
                <div class="bug-empty-title">还没有登记任何 Bug</div>
                <div class="bug-empty-sub">报告一条，或者从任务列表把已经在做的事拉过来。</div>
                <button class="btn btn-primary" type="button" onclick="openBugForm()">报告 Bug</button>
            </div>'''

NEW_DRAWER = r'''<!-- ========== 报告 / 编辑一条 Bug：右侧抽屉 ==========
     为什么是抽屉而不是独立页：新增与编辑都是**从清单里抽出来的一份** ——
     改严重度时你想比一比"还有哪些致命"，独立页会把这份对照直接拿走。
     ⚠️ 骨架是**静态**的（预览面板走静态 HTML 视图，脚本不跑）；JS 只负责
        "填进现值 / 读出输入 / 校验 / 提交"这四件事。
     ⚠️ 编号**不在这里** —— 它是系统已知的值，不许手填；在底部只做回显。 -->
<div class="bug-drawer" id="bugDrawer" hidden>
    <div class="bug-drawer-mask" onclick="closeBugForm()"></div>
    <aside class="bug-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="bfHead">
        <header class="bug-drawer-head">
            <div>
                <div class="bug-drawer-title" id="bfHead">报告 Bug</div>
                <div class="bug-drawer-sub" id="bfSub">编号自动生成；复现步骤一行一步 —— 它是这一页存在的理由。</div>
            </div>
            <button class="modal-close" type="button" onclick="closeBugForm()" aria-label="关闭"><span data-ico="x" data-ico-size="15"></span></button>
        </header>
        <div class="bug-drawer-body">
            <div class="field">
                <label class="field-label" for="bfName">标题</label>
                <input class="inp" id="bfName" type="text" autocomplete="off" spellcheck="false"
                       placeholder="一句话说清哪儿不对，别写「有 bug」" oninput="syncBugForm()" />
                <div class="field-hint" id="bfNameHint">必填：读者扫这一行就知道是什么事（其余都可以留空）</div>
            </div>

            <!-- 严重度与状态并排：它们是**会变的两个值**，写的时候通常一起定 -->
            <div class="field two">
                <div class="field">
                    <span class="field-label" id="bfSevLabel">严重度</span>
                    <div class="chip-row" id="bfSev" role="radiogroup" aria-labelledby="bfSevLabel">
                        <button class="chip chip-sev" type="button" role="radio" aria-checked="false" data-v="fatal" onclick="pickChip(this)">致命</button>
                        <button class="chip chip-sev" type="button" role="radio" aria-checked="false" data-v="major" onclick="pickChip(this)">严重</button>
                        <button class="chip chip-sev on" type="button" role="radio" aria-checked="true" data-v="minor" onclick="pickChip(this)">一般</button>
                        <button class="chip chip-sev" type="button" role="radio" aria-checked="false" data-v="trivial" onclick="pickChip(this)">轻微</button>
                    </div>
                </div>
                <div class="field">
                    <span class="field-label" id="bfStateLabel">状态</span>
                    <div class="chip-row" id="bfState" role="radiogroup" aria-labelledby="bfStateLabel">
                        <button class="chip on" type="button" role="radio" aria-checked="true" data-v="open" onclick="pickChip(this)">待修复</button>
                        <button class="chip" type="button" role="radio" aria-checked="false" data-v="fixing" onclick="pickChip(this)">修复中</button>
                        <button class="chip" type="button" role="radio" aria-checked="false" data-v="closed" onclick="pickChip(this)">已关闭</button>
                    </div>
                </div>
            </div>

            <!-- 模块与负责人：**给建议不给约束** —— 候选来自"已经在用的那些"
                 （datalist），既不用背拼写，也不拦着填一个新的模块 / 换个人。 -->
            <div class="field two">
                <div class="field">
                    <label class="field-label" for="bfMod">模块</label>
                    <input class="inp" id="bfMod" type="text" list="bfModList" autocomplete="off" spellcheck="false"
                           placeholder="对账 / 导出 / 鉴权" oninput="syncBugForm()" />
                    <datalist id="bfModList"></datalist>
                </div>
                <div class="field">
                    <label class="field-label" for="bfOwn">负责人</label>
                    <input class="inp" id="bfOwn" type="text" list="bfOwnList" autocomplete="off" spellcheck="false"
                           placeholder="留空 = 还没指派" oninput="syncBugForm()" />
                    <datalist id="bfOwnList"></datalist>
                </div>
            </div>

            <div class="field">
                <span class="field-label" id="bfSrcLabel">来源</span>
                <div class="chip-row" id="bfSrc" role="radiogroup" aria-labelledby="bfSrcLabel">
                    <button class="chip" type="button" role="radio" aria-checked="false" data-v="qa" onclick="pickChip(this)">测试发现</button>
                    <button class="chip" type="button" role="radio" aria-checked="false" data-v="user" onclick="pickChip(this)">用户反馈</button>
                    <button class="chip" type="button" role="radio" aria-checked="false" data-v="monitor" onclick="pickChip(this)">监控告警</button>
                    <button class="chip" type="button" role="radio" aria-checked="false" data-v="scan" onclick="pickChip(this)">代码扫描</button>
                </div>
            </div>

            <div class="field">
                <label class="field-label" for="bfSteps">怎么复现</label>
                <textarea class="inp mono" id="bfSteps" rows="5" spellcheck="false"
                          placeholder="一行一步：&#10;导出 3 月对账单（金额两位小数）&#10;用 Excel 打开&#10;末位被四舍五入" oninput="syncBugForm()"></textarea>
                <div class="field-hint" id="bfStepsHint">建议至少写一步；先不写也行 —— 清单上会标出来提醒你补</div>
            </div>

            <div class="field">
                <label class="field-label" for="bfEnv">环境</label>
                <input class="inp" id="bfEnv" type="text" autocomplete="off" spellcheck="false"
                       placeholder="v3.3.4 · Chrome 128 · 生产" oninput="syncBugForm()" />
            </div>

            <div class="field-hint" id="bfIdLine">编号 保存时自动生成</div>
        </div>
        <footer class="bug-drawer-foot">
            <button class="btn btn-ghost" type="button" onclick="closeBugForm()">取消</button>
            <span class="spacer"></span>
            <button class="btn btn-primary" id="bfSave" type="button" onclick="saveBugForm()">保存</button>
        </footer>
    </aside>
</div>'''

# 圆盘 / 侧栏名称条读的是 SECTIONS（= GROUPS），计数走 sectionCount() **现算**。
NEW_SECTIONS = r'''    /* 本页的分区 = 四个状态分组。key **必须**等于分组容器的 data-section。
       ⚠️ 分组是**数据的分组**，不是"页面上摞着四张卡" ⇒ 条数由 countOf() 现算：
          推进一条之后圆盘上那一格要跟着变，写死就会继续说旧数。
       ⚠️ 四组**同时成立**（都是当前项目的 Bug）⇒ 圆盘只做「定位 + 滚动同步」。 */
    const GROUPS = [
        { key: 'open',   label: '待修复', icon: 'alert' },
        { key: 'fixing', label: '修复中', icon: 'edit'  },
        { key: 'closed', label: '已关闭', icon: 'check' }
    ];
    const SECTIONS = GROUPS;'''

NEW_SECTIONCOUNT = r'''    function sectionCount(sec) {
        return countOf(sec.key) + ' 条';
    }'''

# 图标表补两条（其余全部复用源页那 40 多条，一套网格 / stroke-width 2）
# ⚠️ 这一段**必须以换行收尾**：末行的 JS 字符串要用 `'` 闭合，而它后面紧跟的就是
#    Python 三引号的收尾符 —— 写成 `.../>'''` 时最后那个 `'` 会被当成收尾符的一部分，
#    产物里那行会少一个引号（症状：整张图标表 check 不过）。
NEW_ICONS_EXTRA = r'''        /* Bug 页补的两条 */
        user: '<circle cx="12" cy="8.2" r="3.4"/><path d="M5.2 20.4c0-3.4 3-5.8 6.8-5.8s6.8 2.4 6.8 5.8"/>',
        chip: '<rect x="7" y="7" width="10" height="10" rx="2"/><path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4"/>'
'''

# 命令面板里属于本页的两条（其余九条是跨模块跳转，逐字沿用）
CMDLIST = r'''            <div class="cmd-item" id="cmdNew" data-goto="new:quick" hidden><div class="cmd-item-icon" data-icon="plus"></div><div class="cmd-item-text">新建一条</div></div>
            <div class="cmd-item" data-goto="new:bug"><div class="cmd-item-icon" data-icon="plus"></div><div class="cmd-item-text">报告一条 Bug</div><span class="cmd-kbd">G N</span></div>
            <div class="cmd-item active" data-goto="panel:open"><div class="cmd-item-icon" data-icon="alert"></div><div class="cmd-item-text">待修复 · 分组</div><span class="cmd-kbd">G 1</span></div>
            <div class="cmd-item" data-goto="panel:fixing"><div class="cmd-item-icon" data-icon="edit"></div><div class="cmd-item-text">修复中 · 分组</div><span class="cmd-kbd">G 2</span></div>
            <div class="cmd-item" data-goto="panel:closed"><div class="cmd-item-icon" data-icon="check"></div><div class="cmd-item-text">已关闭 · 分组</div><span class="cmd-kbd">G 3</span></div>
'''

NEW_JS = r'''    /* ============================================================
       本页内容：Bug 清单
       —— 数据 → 渲染 → 交互，全部按"一处定义、多处消费"写：
          条数只有 countOf() 一个来源，状态流转只有 NEXT 一张表。
       ============================================================ */

    /* ── 严重度四档。`rank` 只服务"先修哪条"的取法，没有第二处消费 ── */
    const SEV = {
        fatal:   { label: '致命', rank: 4, cls: 'is-fatal'   },
        major:   { label: '严重', rank: 3, cls: 'is-major'   },
        minor:   { label: '一般', rank: 2, cls: 'is-minor'   },
        trivial: { label: '轻微', rank: 1, cls: 'is-trivial' }
    };

    /* ── 来源：靠**形状**（图标）承载，不占颜色 ─────────────────────
       这一页的颜色整块分给了严重度，所以来源只能靠图标 + 文字区分。 */
    const SRC = {
        qa:      { label: '测试发现', icon: 'clipboard' },
        user:    { label: '用户反馈', icon: 'user'      },
        monitor: { label: '监控告警', icon: 'activity'  },
        scan:    { label: '代码扫描', icon: 'search'    }
    };

    /* ── 状态流转：四个状态是一条**环**，不是一条线 ─────────────────
       「已关闭」不是终点 —— 它有一条回到「待修复」的边（重开）。
       一行上的那枚按钮 = 这条边，文案从这张表里取。 */
    const NEXT = { open: 'fixing', fixing: 'closed', closed: 'open' };
    const ADV = {
        /* ⚠️ 「推到任务」不是"开始修复"改了个名 —— 它**真的**会在任务列表里落一条，
           状态因此才走到「修复中」（含义：已经排进我要做的事里了）。 */
        open:   { label: '推到任务',   to: '修复中' },
        fixing: { label: '标记已修好', to: '已关闭' },
        closed: { label: '重开',       to: '待修复' }
    };

    /* ── 数据 ──────────────────────────────────────────────────────
       `days`：未关闭 = 已经多少天没有动静；已关闭 = 从发现到修好一共几天。
       `closedAgo`：已关闭的才有，几天前关的。
       两个数分开是因为它们回答不同的问题 —— "还躺着多久"与"修得快不快"。
       ⚠️ 条数在这一页里**没有一处**写死在标记里，全走 countOf()。 */
    const BUGS = [
        { id: 'BUG-1042', title: '对账金额精度丢失，合计差 0.02 元', state: 'open', sev: 'fatal', mod: '对账', src: 'user', own: '张琪', days: 12,
          steps: ['导出 3 月对账单（金额两位小数）', '用 Excel 打开，末位被四舍五入', '页面合计与后台差 0.02 元'],
          env: 'v3.3.4 · Chrome 128 · 生产' },
        { id: 'BUG-1039', title: '导出 Excel 时中文文件名乱码', state: 'open', sev: 'major', mod: '导出', src: 'qa', own: '何敏', days: 6,
          steps: ['在列表页点「导出」', 'Safari 下文件名变成一串 %E5%AF%B9', 'Chrome 下正常'],
          env: 'v3.3.4 · Safari 17 · 生产' },
        { id: 'BUG-1037', title: '看板拖拽后顺序刷新就丢', state: 'open', sev: 'minor', mod: '看板', src: 'user', own: '刘阳', days: 4,
          steps: ['拖动三张卡换顺序', '刷新页面', '顺序回到拖之前'],
          env: 'v3.3.3 · Chrome 128 · 测试' },
        { id: 'BUG-1035', title: '空态文案末尾多了一个句号', state: 'open', sev: 'trivial', mod: '前端', src: 'scan', own: '何敏', days: 2,
          steps: ['打开一个还没有任务的项目', '看空态那句话'],
          env: 'v3.3.4 · 任意浏览器 · 测试' },

        { id: 'BUG-1040', title: '鉴权 token 刷新竞态导致偶发 401', state: 'fixing', sev: 'major', mod: '鉴权', src: 'monitor', own: '刘阳', days: 5, reopened: true,
          steps: ['同一账号同时开 6 个标签页', '等 token 到期（30 分钟）', '其中两个标签页偶发 401 被踢出'],
          env: 'v3.3.4 · Chrome 128 · 生产' },
        { id: 'BUG-1036', title: '批量导入超过 500 行时网关超时', state: 'fixing', sev: 'major', mod: '导入', src: 'qa', own: '张琪', days: 3,
          steps: ['准备一个 800 行的 CSV', '走导入流程', '第 40 秒返回 504'],
          env: 'v3.3.4 · 生产' },
        { id: 'BUG-1034', title: '通知邮件里项目名没有转义', state: 'fixing', sev: 'minor', mod: '通知', src: 'qa', own: '何敏', days: 2,
          steps: ['把项目名改成含 & 的名字', '触发一条通知', '邮件里显示成 &amp;'],
          env: 'v3.3.3 · 生产' },

        { id: 'BUG-1033', title: '第 2 页点排序会跳回第 1 页', state: 'fixing', sev: 'minor', mod: '列表', src: 'user', own: '刘阳', days: 3,
          steps: ['翻到第 2 页', '点「按截止时间」排序', '页码回到第 1 页'],
          env: 'v3.3.4 · Chrome 128 · 生产' },
        { id: 'BUG-1031', title: '移动端筛选弹层贴着屏幕左边缘', state: 'open', sev: 'trivial', mod: '前端', src: 'qa', own: '何敏', days: 1,
          steps: ['用手机打开任务列表', '点右上角筛选', '弹层左边被裁掉 8px'],
          env: 'v3.3.4 · iOS Safari · 生产' },

        { id: 'BUG-1030', title: '灰度发布时旧版本 cookie 未清理', state: 'closed', sev: 'major', mod: '鉴权', src: 'monitor', own: '张琪', days: 9, closedAgo: 1,
          steps: ['灰度发布到 10% 流量', '部分用户带着旧 cookie 进来', '被路由到新版本后登录态错乱'],
          env: 'v3.3.4 · 生产' },
        { id: 'BUG-1028', title: '金额输入框允许输入多个小数点', state: 'closed', sev: 'minor', mod: '对账', src: 'qa', own: '张琪', days: 4, closedAgo: 3,
          steps: ['在金额框输入 12.3.4', '失焦后原样保存'],
          env: 'v3.3.2 · Chrome 128 · 测试' },
        { id: 'BUG-1025', title: '帮助中心的「对账规则」链接 404', state: 'closed', sev: 'trivial', mod: '文档', src: 'user', own: '何敏', days: 2, closedAgo: 5,
          steps: ['打开帮助中心', '点「对账规则」', '跳到 404'],
          env: 'v3.3.1 · 生产' }
    ];

    const escTxt = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

    /* ============ 取数：仪表三格与四句组头注解，全部现算 ============ */

    function countOf(state) { return BUGS.filter(b => b.state === state).length; }

    /* 「先修哪条」= 未关闭里严重度最高；同档取停滞最久的那条。
       ⚠️ 空数据集必须有护栏 —— 直接 sort()[0] 会抛，整条 sync 断在中间：
          后面每一处都停在旧值，而且**一个字都不报**。 */
    function firstFix() {
        const live = BUGS.filter(b => b.state !== 'closed');
        if (!live.length) return null;
        return live.slice().sort((a, b) =>
            (SEV[b.sev].rank - SEV[a.sev].rank) || (b.days - a.days))[0];
    }

    /* 「谁最多」= 未关闭的按负责人计数取最多。
       ⚠️ 并列时按名字定序 —— 不定序的话同一个数据集每次排序结果可能不同。 */
    function busiest() {
        const by = {};
        BUGS.filter(b => b.state !== 'closed').forEach(b => { by[b.own] = (by[b.own] || 0) + 1; });
        const names = Object.keys(by).sort((a, b) => (by[b] - by[a]) || a.localeCompare(b));
        if (!names.length) return null;
        const own = names[0];
        return {
            own: own, n: by[own],
            heavy: BUGS.filter(b => b.state !== 'closed' && b.own === own
                                    && (b.sev === 'fatal' || b.sev === 'major')).length
        };
    }

    function reopenList() { return BUGS.filter(b => b.reopened); }

    /* 组头右侧那一句：只写**跨这一组**才成立的话。
       复述计数（徽标已经在说）或复述行上的值（往下扫就有）都不算。 */
    function groupNote(key) {
        const list = BUGS.filter(b => b.state === key);
        if (!list.length) return '';
        if (key === 'open') {
            const n = list.filter(b => b.sev === 'fatal').length;
            return n ? '有 ' + n + ' 条致命' : '没有致命的';
        }
        if (key === 'fixing') {
            const n = list.filter(b => b.reopened).length;
            return n ? '有 ' + n + ' 条是重开的' : '都在推进';
        }
        const avg = Math.round(list.reduce((s, b) => s + b.days, 0) / list.length);
        return '平均 ' + avg + ' 天修好';
    }

    function kpiValues() {
        const f = firstFix(), w = busiest(), r = reopenList();
        return {
            firstVal:  f ? f.id : '—',
            firstSub:  f ? (SEV[f.sev].label + ' · ' + f.days + ' 天没动 · ' + f.title) : '没有未关闭的 Bug',
            ownVal:    w ? (w.own + ' ' + w.n + ' 条') : '—',
            ownSub:    w ? ('手上未关闭最多' + (w.heavy ? '，其中 ' + w.heavy + ' 条严重及以上' : '')) : '没有未关闭的 Bug',
            reopenVal: r.length ? (r.length + ' 条') : '没有',
            reopenSub: r.length ? (r[0].id + ' ' + r[0].title + ' · 第一次没修干净') : '没有修完又坏的'
        };
    }

    /* ============ 推到任务列表：跨页的一份状态 ============
       ⚠️ 键要**跨页同名**、且不绑窗口生命周期 —— "这条 Bug 已经有对应任务了"
          属于数据，不属于哪个窗口（同一条 Bug 在两个页面里不该有两种说法）。
       ⚠️ `storage` 事件只在**别的窗口**改键时触发 ⇒ 本窗口自己写完要自己刷一遍 UI。 */
    const PROMOTE_KEY = 'work:bugs:promoted';

    /* 严重度 → 任务页的优先级：致命 P0 / 严重 P1 / 一般 P2 / 轻微 P3。
       ⚠️ 两页用**同一维**表达"先做哪个" —— 推过去之后，任务行上不会再冒出第二枚等级徽标
          （那会让人去比较"P1 但致命，先做哪个"）。 */
    const PRI_OF = { fatal: 0, major: 1, minor: 2, trivial: 3 };

    /* 推到任务列表时要带上"这条属于哪个项目"。
       ⚠️ 两页的项目**名**现在不一致（本页叫「Q4 客户交付系统重构」，任务页那份表里是
          「支付系统重构」）—— 这里按 id 映射、不靠名字比。真接数据时这一格该来自项目的 id。 */
    const PROMOTE_PROJ = { key: 'pay', name: '支付系统重构' };

    function promotedMap() {
        try { return JSON.parse(localStorage.getItem(PROMOTE_KEY) || '{}') || {}; }
        catch (e) { return {}; }
    }

    function savePromoted(m) {
        try { localStorage.setItem(PROMOTE_KEY, JSON.stringify(m)); } catch (e) {}
    }

    /* 任务号接在任务页现有的编号后面（T01–T24 是既定数据，新的从 T25 起）。
       ⚠️ 兼容早期只存字符串的形态（`{ 'BUG-1': 'T25' }`）—— 读到就升成对象，
          不写"迁移"这种一次性代码，只让读法两种都认。 */
    function entryOf(v) { return (v && typeof v === 'object') ? v : { code: v }; }

    function nextTaskCode(m) {
        let max = 24;
        Object.keys(m).forEach(k => {
            const n = parseInt(String(entryOf(m[k]).code || '').replace(/\D/g, ''), 10);
            if (n > max) max = n;
        });
        return 'T' + String(max + 1).padStart(2, '0');
    }

    /* ============ 渲染 ============ */

    function ageText(b) {
        if (b.state === 'closed') return (b.closedAgo || 0) + ' 天前关';
        /* ⚠️ 0 天要说"今天刚报"而不是"0 天没动" —— 同一个 0 在这两种读法里
           一个是"刚发生"、一个是"数字坏了"。 */
        return b.days > 0 ? (b.days + ' 天没动') : '今天刚报';
    }

    /* ⚠️ 三条空值护栏（`steps` 空 / `env` 空 / `own` 空）：表单必填挡住了新增时的空，
       但**早期登记的旧数据**可能什么都不缺、也可能什么都没有 —— 渲染函数必须两种都吃。
       判据：新增出来的数据一定比既有的更不完整，渲染侧不能假设"字段都在"。 */
    function detailHtml(b) {
        const steps = (b.steps && b.steps.length)
            ? '<ol class="bd-steps">' + b.steps.map(s => '<li>' + escTxt(s) + '</li>').join('') + '</ol>'
            : '<div class="bd-none">还没写复现步骤'
              + '<button class="bd-act" type="button" data-bug-act="edit">补上</button></div>';
        return ''
        + '<div class="bd-label">怎么复现</div>'
        + steps
        + '<div class="bd-foot">'
        +   '<span>' + (b.env ? escTxt(b.env) : '没记环境') + '</span>'
        +   '<span class="bd-acts">'
        /* 三枚动作都在 `.bug-main`（整行那枚按钮）**外面** —— 按钮里不许套按钮。
           「编辑」进来之后不再单独留「指派」：它的能力被编辑表单整个包含，
           两枚按钮做同一件事就是同一层级的归类出现两处。 */
        +     '<button class="bd-act" type="button" data-bug-act="edit">' + svgIcon('edit', 12) + '编辑</button>'
        +     '<button class="bd-act" type="button" data-bug-act="copy">' + svgIcon('copy', 12) + '复制步骤</button>'
        +     '<button class="bd-act bd-act-danger" type="button" data-bug-act="del">' + svgIcon('trash', 12) + '删除</button>'
        +   '</span>'
        + '</div>';
    }

    function bugRowHtml(b) {
        const s = SEV[b.sev] || SEV.minor;
        /* ⚠️ 这里**不能**兜底成 SRC.qa：`SRC[b.src]` 为空表示"还没记来源"，
           兜底成"测试发现"会让清单替人下结论（而它是错的，如果那条其实来自用户反馈）。 */
        const src = SRC[b.src] || null;
        const aw = ADV[b.state] || ADV.open;
        const cls = 'bug-row ' + s.cls + (b.state === 'closed' ? ' is-closed' : '');
        const id = escTxt(b.id);
        const task = entryOf(promotedMap()[b.id]).code || '';
        return ''
        + '<div class="' + cls + '" id="' + id + '" data-state="' + b.state + '">'
        /* 整行可点 = 一枚**真按钮**（Enter / Space 天然可用）；
           ⚠️ 里面只放 phrasing content，所以两个"行"是写了 display 的 span。 */
        +   '<button class="bug-main" type="button" aria-expanded="false" title="展开复现步骤">'
        +     '<span class="bug-line1">'
        +       '<span class="sev-chip">' + s.label + '</span>'
        +       '<span class="bug-title">' + escTxt(b.title) + '</span>'
        +       '<span class="bug-age">' + ageText(b) + '</span>'
        +     '</span>'
        +     '<span class="bug-line2">'
        +       '<span class="bug-id">' + id + '</span>'
        /* ⚠️ 身份三件套**逐项条件渲染**：分隔点跟在自己的那一项前面 ——
           一条一句话记下来的 Bug 可能只有编号，硬渲染会出来一串"· · ·"。 */
        +       (b.mod ? '<span class="bug-dot">·</span><span class="bug-mod">' + escTxt(b.mod) + '</span>' : '')
        +       (src ? '<span class="bug-dot">·</span><span class="bug-src" title="' + src.label + '">' + svgIcon(src.icon, 12) + escTxt(src.label) + '</span>' : '')
        +       '<span class="bug-dot">·</span>'
        /* 负责人空 ⇒ 写"未指派"：它是**待办**，不是"没有这个字段"（其余两项可以整块消失）。 */
        +       (b.own ? '<span class="bug-own">' + escTxt(b.own) + '</span>'
                       : '<span class="bug-own is-none">未指派</span>')
        +       (b.reopened ? '<span class="bug-dot">·</span><span class="bug-reopen">' + svgIcon('undo', 11) + '重开过</span>' : '')
        +       (task ? '<span class="bug-dot">·</span><span class="bug-promoted" title="已经在任务列表里（未排期）">' + escTxt(task) + '</span>' : '')
        +     '</span>'
        +   '</button>'
        /* ⚠️ 这枚按钮在整行按钮**外面**：按钮里套按钮非法。
              附带的好处是不用 stopPropagation。 */
        +   '<span class="bug-acts">'
        +     '<button class="bug-adv" type="button" title="'
        +       (b.state === 'closed' ? '重开这条' : '推进到「' + aw.to + '」') + '">' + aw.label + '</button>'
        /* 「去任务列表」只在**推过之后**才出现 —— 它是下一站，不是一个并列的入口。 */
        +     (task ? '<a class="bug-go" href="工作-任务-总览-index.html#promoted" title="去任务列表看这条（未排期）">去任务列表</a>' : '')
        +   '</span>'
        +   '<div class="bug-detail" hidden>' + detailHtml(b) + '</div>'
        + '</div>';
    }

    function groupsHtml() {
        return GROUPS.map(g => {
            const list = BUGS.filter(b => b.state === g.key);
            /* ⚠️ 空组**不渲染**：写死四张卡就会在删空一组之后，
                  圆盘上留一格点进去什么都没有。 */
            if (!list.length) return '';
            return ''
            + '<section class="ops-card" id="group-' + g.key + '" data-section="' + g.key + '">'
            +   '<h2 class="ops-card-head" role="button" tabindex="0" aria-expanded="true"'
            +       ' aria-controls="group-' + g.key + '-body"'
            +       ' onclick="toggleOpsCard(\'group-' + g.key + '\')">'
            +     '<span class="ops-card-head-left">'
            +       '<span class="card-icon" aria-hidden="true" data-ico="' + g.icon + '" data-ico-size="15"></span>'
            +       '<span class="ops-card-title">' + g.label + '</span>'
            +       '<span class="ops-card-badge" id="badge-' + g.key + '">' + list.length + ' 条</span>'
            +     '</span>'
            +     '<span class="ops-card-head-right">'
            +       '<span class="ops-note" id="note-' + g.key + '">' + groupNote(g.key) + '</span>'
            +       '<span class="ops-fold-icon" aria-hidden="true" data-ico="chevD" data-ico-size="15"></span>'
            +     '</span>'
            +   '</h2>'
            +   '<div class="ops-card-body" id="group-' + g.key + '-body">'
            +     '<div class="ops-card-body-inner">'
            +       '<div class="bug-list">' + list.map(bugRowHtml).join('\n') + '</div>'
            +     '</div>'
            +   '</div>'
            + '</section>';
        }).join('\n');
    }

    /* 侧栏「最久」：未关闭里停滞最久的四条，点一条滚过去并展开。
       ⚠️ 它不是"最近访问" —— 这一页没有"我最近看过什么"这个状态，
          有的是"哪几条已经躺太久了"，那才是读者在这一格里要的。 */
    function staleHtml() {
        const list = BUGS.filter(b => b.state !== 'closed')
                         .slice().sort((a, b) => b.days - a.days).slice(0, 4);
        /* 「池子本来就是空的」与「筛掉了」是两种空，退路也不同 ——
           这里只有前者，所以只说"还没有登记的"。 */
        if (!list.length) return '<div class="slot-empty">还没有未关闭的 Bug</div>';
        return list.map(b => ''
            + '<button class="recent-item" type="button" onclick="focusBug(\'' + escTxt(b.id) + '\')">'
            +   '<span class="recent-icon" data-ico="bug" data-ico-size="15"></span>'
            +   '<span class="recent-text">' + escTxt(b.id + ' ' + b.title) + '</span>'
            +   '<span class="recent-time">' + b.days + ' 天</span>'
            + '</button>').join('');
    }

    function renderGroups() {
        const box = document.getElementById('bugGroups');
        if (!box) return;
        box.innerHTML = groupsHtml();
        paintIcons(box);   /* 组头图标是静态标记（data-ico）⇒ 渲染完统一灌一次 */
    }

    /* ============ 唯一的 sync ============
       全页只有这一个：tab 计数 / 每个组头的徽标与注解 / 仪表三格 —— 全在这里收口。
       分开写一定会走散（症状：推进一条之后徽标变了、圆盘还停在旧数）。
       ⚠️ 圆盘与侧栏副标题读的是 SECTIONS ⇒ 交给 syncChrome 自己重排。 */
    function sync() {
        const tabEl = document.getElementById('tabBugCount');
        if (tabEl) tabEl.textContent = String(BUGS.length);

        GROUPS.forEach(g => {
            const bd = document.getElementById('badge-' + g.key);
            if (bd) bd.textContent = countOf(g.key) + ' 条';
            const nt = document.getElementById('note-' + g.key);
            if (nt) nt.textContent = groupNote(g.key);
        });

        const v = kpiValues();
        const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
        set('kpiFirstVal', v.firstVal);   set('kpiFirstSub', v.firstSub);
        set('kpiOwnVal', v.ownVal);       set('kpiOwnSub', v.ownSub);
        set('kpiReopenVal', v.reopenVal); set('kpiReopenSub', v.reopenSub);

        /* 致命还在没人动的状态里 ⇒ 第一格提一档色；修完了就自己退回去 */
        const f = firstFix();
        const kf = document.getElementById('kpiFirst');
        if (kf) kf.classList.toggle('warn', !!(f && f.sev === 'fatal'));

        /* 侧栏「最久」跟数据走。它原来只在首屏灌一次 ⇒ 新增/删除/改严重度之后
           它会停在旧值上（判据：「会变的值不能放在一处只跑一次的地方」）。
           用 getElementById 现查而不是提一个模块级常量 —— 免得以后再被**定义顺序**绊住。 */
        const stale = document.getElementById('slotStale');
        if (stale) stale.innerHTML = staleHtml();

        /* 全删空 ⇒ 四张组卡被"空组不渲染"一起收走 ⇒ 给出页面级空态。
           否则页面上只剩仪表三格（还都写着"没有"），读者会以为页面坏了。 */
        const empty = document.getElementById('bugEmpty');
        if (empty) empty.hidden = BUGS.length > 0;

        syncChrome(false);
    }

    /* ============ 交互 ============ */

    /* 分区卡的折叠。源页把它放在"账户抽屉"那一段里（第 4377 行）⇒ 那一段没搬进来，
       而四张分区卡的组头 onclick 正指着它 —— 不补就是"点组头什么都不发生"。
       ⚠️ 只切一个类、**不重建标记**：重建会丢别处的收起态、焦点与滚动位置。 */
    function toggleOpsCard(cardId) {
        const card = document.getElementById(cardId);
        if (!card) return;
        const folded = card.classList.toggle('collapsed');
        const head = card.querySelector('.ops-card-head');
        if (head) head.setAttribute('aria-expanded', String(!folded));
    }

    function toggleBug(row) {
        const d = row.querySelector('.bug-detail');
        const btn = row.querySelector('.bug-main');
        if (!d || !btn) return;
        const open = d.hidden;
        d.hidden = !open;
        btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    function focusBug(id) {
        const row = document.getElementById(id);
        if (!row) return;
        activatePanel(row.dataset.state);          /* 先滚到它所在那一组（圆盘的当前项跟着走） */
        const d = row.querySelector('.bug-detail'), btn = row.querySelector('.bug-main');
        if (d) { d.hidden = false; if (btn) btn.setAttribute('aria-expanded', 'true'); }
        row.classList.remove('is-flash');
        void row.offsetWidth;                      /* 强制重排 ⇒ 动画能重放（不然连点两次只闪一次） */
        row.classList.add('is-flash');
        setTimeout(() => row.classList.remove('is-flash'), 1200);
    }

    /* 推进一条：改数据 → **把行搬到下一组** → 重算全部计数。
       ⚠️ 搬的是**节点本身**（appendChild），不重建整组 —— 重建会顺手把
          "刚点开的那一条"折回去，并把焦点与滚动位置一起丢掉。 */
    function advance(row, quiet) {
        const b = BUGS.find(x => x.id === row.id);
        if (!b) return;
        const from = b.state, to = NEXT[from];
        const reopenedNow = (to === 'open' && from === 'closed');

        b.state = to;
        b.days = 0;                       /* 刚动过 ⇒ 停滞归零（这条是"已经多久没动静"，不是"开了多久"） */
        if (reopenedNow) { b.reopened = true; b.closedAgo = undefined; }

        /* 重开会在第二行多出一枚「重开过」⇒ 只有这一种推进需要重造标记；
           另外三种只是换组 + 重画。 */
        if (reopenedNow) rebuildRow(b, from);
        else { moveRow(b); paintRow(b); }

        sync();
        if (!quiet) toast('已推进到「' + ADV[to].to + '」· ' + b.id, 'ok');
    }

    /* 「推到任务」= 把这条 Bug 排进我要做的事里（跨页的一步）。
       ⚠️ 三件事的顺序不能换：① 先发号并存下来；② 再走状态流转（待修复 → 修复中）；
          ③ 最后**重造这一行** —— 推过之后这一行会多出两样东西（元信息里的任务号、
          行尾的「去任务列表」），而 `advance` 只换按钮文案与类名，**不会加元素**。 */
    function promote(row) {
        const b = BUGS.find(x => x.id === row.id);
        if (!b) return;
        const m = promotedMap();
        if (!entryOf(m[b.id]).code) {
            m[b.id] = {
                code: nextTaskCode(m),
                title: b.title,
                pri: PRI_OF[b.sev],
                src: (SRC[b.src] || SRC.qa).label,
                /* 复现步骤只搬**最后一步**（最关键的那一步）当任务行上的注解 ——
                   任务行没有展开区，完整的三步留在本页，反向链接指回来。 */
                note: b.steps[b.steps.length - 1],
                proj: PROMOTE_PROJ.key,
                projName: PROMOTE_PROJ.name
            };
            savePromoted(m);
        }
        advance(row, true);
        const fresh = document.getElementById(b.id);
        if (fresh) {
            const tmp = document.createElement('div');
            tmp.innerHTML = bugRowHtml(b);
            fresh.replaceWith(tmp.firstChild);
        }
        toast('已推到任务列表 · ' + entryOf(m[b.id]).code + '（未排期）', 'ok');
    }

    function copyBugList() {
        const txt = BUGS.map(b => b.id + '\t' + (SEV[b.sev] || SEV.minor).label + '\t'
                                   + b.state + '\t' + b.title).join('\n');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(
                () => toast('已复制 ' + BUGS.length + ' 条清单', 'ok'),
                () => toast('浏览器没让复制，手动选中吧', 'warn'));
        } else {
            toast('这个浏览器不支持一键复制', 'warn');
        }
    }

    /* ============================================================
       维护：报告 / 编辑 / 删除
       —— 三件事共用同一套"改数据 → 只动该动的那一行"：
          新增只插一行、编辑只重造那一行、删除只摘掉那一行，
          **都不重建整组**（重建会把别处展开着的那几条一起折回去）。
       ============================================================ */

    /* ── 行级的五个动词。advance / 保存表单 / 删除全走它们 ────────────
       ⚠️ 之所以抽出来：状态流转原来有两处入口（行尾推进 / 编辑改状态），
          内联写一遍就会有两份"搬行 + 改类名 + 改按钮文案" —— 迟早走散。 */
    function listOf(state) {
        const card = document.querySelector('.ops-card[data-section="' + state + '"]');
        return card ? card.querySelector('.bug-list') : null;
    }

    /* 把一行画成数据现在说的样子（类名 / 停滞读数 / 行尾按钮文案）。 */
    function paintRow(b) {
        const row = document.getElementById(b.id);
        if (!row) return null;
        const s = SEV[b.sev] || SEV.minor;
        row.className = 'bug-row ' + s.cls + (b.state === 'closed' ? ' is-closed' : '');
        row.dataset.state = b.state;
        const ageEl = row.querySelector('.bug-age');
        if (ageEl) ageEl.textContent = ageText(b);
        const btn = row.querySelector('.bug-adv');
        if (btn) {
            const aw = ADV[b.state] || ADV.open;
            btn.textContent = aw.label;
            btn.title = (b.state === 'closed') ? '重开这条' : ('推进到「' + aw.to + '」');
        }
        return row;
    }

    /* 搬到它现在该在的那一组。⚠️ 搬的是**节点本身**（appendChild），不重建整组 ——
       重建会顺手把"刚点开的那一条"折回去，并把焦点与滚动位置一起丢掉。 */
    function moveRow(b) {
        let row = document.getElementById(b.id);
        if (!row) return null;
        let dest = listOf(b.state);
        if (!dest) {
            /* 目标组当前没有卡（空组是不渲染的）⇒ 先补一张出来再搬。
               ⚠️ 这里只能整组重渲 —— 这是"目标组本来就不存在"的唯一出路，
                  代价是别处的展开态会折回去，所以能不走就 不走。 */
            renderGroups();
            row = document.getElementById(b.id);
            dest = listOf(b.state);
        }
        if (!dest || !row) return null;
        dest.appendChild(row);
        /* 旧那一组空了 ⇒ 那张卡撤掉（"空组不渲染"是同一条判据，两处都得守） */
        document.querySelectorAll('#bugGroups .ops-card').forEach(c => {
            if (!c.querySelector('.bug-row')) c.remove();
        });
        return row;
    }

    /* 重造这一行（字段变了，或第二行要多一枚「重开过」）。
       ⚠️ 只重建**这一条**：它原来是展开的就给它恢复展开 —— 重造出来的是默认收起的节点。 */
    function rebuildRow(b, fromState) {
        const old = document.getElementById(b.id);
        if (!old) { addRow(b); return null; }
        const d = old.querySelector('.bug-detail');
        const wasOpen = !!(d && !d.hidden);
        const tmp = document.createElement('div');
        tmp.innerHTML = bugRowHtml(b);
        old.replaceWith(tmp.firstChild);
        const row = document.getElementById(b.id);
        if (row && wasOpen) toggleBug(row);
        if (fromState && fromState !== b.state) moveRow(b);
        paintRow(b);
        return document.getElementById(b.id);
    }

    /* 新登记一条：插在**组首**。
       ⚠️ 数据侧也要 unshift 到数组头（`saveBugForm` 里做了）—— 否则整组重渲之后
          新增的那条会跑到组尾，同一份顺序出现两种说法。 */
    function addRow(b) {
        let dest = listOf(b.state);
        if (!dest) { renderGroups(); dest = listOf(b.state); }
        if (!dest) return null;
        const tmp = document.createElement('div');
        tmp.innerHTML = bugRowHtml(b);
        dest.insertBefore(tmp.firstChild, dest.firstChild);
        return document.getElementById(b.id);
    }

    function removeRow(b) {
        const row = document.getElementById(b.id);
        if (!row) return;
        const card = row.closest('.ops-card');
        row.remove();
        if (card && !card.querySelector('.bug-row')) card.remove();
    }

    /* ── 表单控件：三组胶囊共用（判据「归类给选不给填」）────────────── */
    function chipVal(boxId) {
        const on = document.querySelector('#' + boxId + ' .chip.on');
        return on ? on.dataset.v : '';
    }

    function setChips(boxId, v) {
        document.querySelectorAll('#' + boxId + ' .chip').forEach(c => {
            const on = c.dataset.v === v;
            c.classList.toggle('on', on);
            c.setAttribute('aria-checked', String(on));
        });
    }

    /* 单选胶囊：同一组里只有一枚亮着。用 `closest('.chip-row')` 而不是 id ——
       这样它不关心自己长在哪一组里，将来复用不用改。 */
    function pickChip(el) {
        const box = el.closest('.chip-row');
        if (!box) return;
        box.querySelectorAll('.chip').forEach(c => {
            const on = (c === el);
            c.classList.toggle('on', on);
            c.setAttribute('aria-checked', String(on));
        });
        syncBugForm();
    }

    /* ── 二次确认弹窗：破坏性操作唯一的口 ───────────────────────────
       ⚠️ 它必须浮在抽屉**上面**（z-index 200 > 190）—— 抽屉里点删除时，
          二次确认要盖住自己那半张表单。 */
    const modalMask = document.getElementById('modalMask');
    const mTitle = document.getElementById('modalTitle');
    const mBody = document.getElementById('modalBody');
    const mConfirm = document.getElementById('modalConfirm');
    const mCancel = document.getElementById('modalCancel');
    let lastFocused = null;

    function openConfirm(o) {
        lastFocused = document.activeElement;
        mTitle.textContent = o.title || '确认';
        mBody.innerHTML = '';                      /* ⚠️ 先清空：不清会把上一次的说明留在下面 */
        if (o.desc) {
            const p = document.createElement('p');  /* 用 textContent 而不是拼 innerHTML：
                                                       标题里可能有自输入的字符 */
            p.textContent = o.desc;
            mBody.appendChild(p);
        }
        if (o.warn) {
            const box = document.createElement('div');
            box.className = 'modal-warn';
            box.setAttribute('role', 'note');
            const strong = document.createElement('strong');
            strong.textContent = '影响：';
            const span = document.createElement('span');
            span.textContent = o.warn;
            box.append(strong, span);
            mBody.appendChild(box);
        }
        mConfirm.textContent = o.confirmText || '确定';
        mConfirm.className = 'btn ' + (o.danger ? 'btn-danger' : 'btn-primary');
        mConfirm.onclick = () => { if (o.onConfirm) o.onConfirm(); closeModal(); };
        modalMask.classList.add('open');
        mConfirm.focus();
    }

    function closeModal() {
        if (!modalMask.classList.contains('open')) return;
        modalMask.classList.remove('open');
        if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    modalMask.addEventListener('click', e => { if (e.target === modalMask) closeModal(); });
    mCancel.addEventListener('click', closeModal);

    /* ── 抽屉：新增与编辑是**同一份表单**，只有标题、编号回显与提交文案不同 ── */
    const bugDrawerEl = document.getElementById('bugDrawer');
    let editingId = null;                          /* null = 新增 */

    function nextBugId() {
        /* ⚠️ 现算 + 空集护栏：BUGS 被删空时 `Math.max()` 是 -Infinity，
           拼出来是 "BUG--Infinity"，而且**不报任何错**。 */
        const nums = BUGS.map(b => parseInt(String(b.id).replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
        return 'BUG-' + ((nums.length ? Math.max.apply(null, nums) : 1000) + 1);
    }

    /* 候选来自"已经在用的那些"：给建议、不给约束（datalist）——
       既不用背拼写，也不拦着你填一个新模块或换个人。 */
    function fillDatalists() {
        const uniq = a => a.filter(Boolean).filter((v, i) => a.indexOf(v) === i);
        const put = (id, vals) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = vals.map(v => '<option value="' + escTxt(v) + '"></option>').join('');
        };
        put('bfModList', uniq(BUGS.map(b => b.mod)));
        put('bfOwnList', uniq(BUGS.map(b => b.own)));
    }

    function fieldVal(id) {
        const el = document.getElementById(id);
        return el ? String(el.value || '').trim() : '';
    }

    function formValue() {
        return {
            title: fieldVal('bfName'),
            sev: chipVal('bfSev') || 'minor',
            state: chipVal('bfState') || 'open',
            mod: fieldVal('bfMod'),
            own: fieldVal('bfOwn'),
            src: chipVal('bfSrc') || 'qa',
            /* 一行一步：**空行不算一步** —— 粘进来一堆空行不该变成"写了 5 步" */
            steps: (document.getElementById('bfSteps').value || '')
                       .split('\n').map(x => x.trim()).filter(Boolean),
            env: fieldVal('bfEnv')
        };
    }

    /* 必填**只有标题**。复现步骤是"建议"而不是"必填" ——
       ⚠️ 它确实是这一页存在的理由，但把它设成必填的代价是**人干脆不记了**：
          测试时随手记一条，先要的是一句话落地，回头再补步骤。
       ⇒ 缺了不拦、但**必须可见**：清单上那一行会显示"还没写复现步骤 [补上]"。 */
    function syncBugForm() {
        const v = formValue();
        const missName = !v.title;
        const save = document.getElementById('bfSave');
        if (save) save.disabled = missName;
        /* ⚠️ 提示要落在**它指的那一格**上，不能只给一句笼统的"表单不完整" */
        const nh = document.getElementById('bfNameHint');
        if (nh) nh.classList.toggle('bad', missName);
        const ni = document.getElementById('bfName');
        if (ni) ni.classList.toggle('bad', missName);
        const st = document.getElementById('bfSteps');
        const sh = document.getElementById('bfStepsHint');
        if (sh) sh.classList.toggle('bad', false);
        if (st) st.classList.remove('bad');
    }

    function openBugForm(id) {
        editingId = id || null;
        let b = editingId ? BUGS.find(x => x.id === editingId) : null;
        if (editingId && !b) { editingId = null; }   /* 传进来一个已经删掉的 id ⇒ 退回新增 */
        fillDatalists();
        const d = b || { title: '', sev: 'minor', state: 'open', mod: '', own: '', src: 'qa', steps: [], env: '' };
        const setV = (eid, val) => { const el = document.getElementById(eid); if (el) el.value = val; };

        document.getElementById('bfHead').textContent = b ? ('编辑 ' + b.id) : '报告 Bug';
        document.getElementById('bfSub').textContent = b
            ? '改哪一格都行；状态改了它会跟着换组。'
            : '编号自动生成；复现步骤一行一步 —— 它是这一页存在的理由。';
        document.getElementById('bfIdLine').textContent = b
            ? ('编号 ' + b.id + ' · 系统给的，不可改')
            : ('编号 保存时自动生成（下一条 ' + nextBugId() + '）');

        setV('bfName', d.title);
        setV('bfMod', d.mod);
        setV('bfOwn', d.own);
        setV('bfEnv', d.env);
        document.getElementById('bfSteps').value = (d.steps || []).join('\n');
        setChips('bfSev', d.sev);
        setChips('bfState', d.state);
        setChips('bfSrc', d.src);

        bugDrawerEl.hidden = false;
        const main = document.querySelector('.main');
        if (main) main.classList.add('bug-lock');    /* 背后那一列不许跟着滚 */
        syncBugForm();
        /* 焦点落在**最该补的那一格**上：这条缺复现步骤 ⇒ 落步骤框（它就是为此点进来的）；
           否则落标题（多数时候是改标题 / 换严重度）。 */
        setTimeout(() => {
            const el = document.getElementById((b && !(b.steps || []).length) ? 'bfSteps' : 'bfName');
            if (el) el.focus();
        }, 60);
    }

    /* "搜不到就新建"：⌘K 里打一句话 → 回车 → 标题已经写好了，接着选严重度就行。
       ⚠️ 这里不走快速记录那条路（直接进清单），而是打开表单：从 ⌘K 敲进来的人
          意图是"记详细一点"，直接进清单会让他以为自己点错了。 */
    function openBugFormWithTitle(title) {
        openBugForm();
        const el = document.getElementById('bfName');
        if (el) { el.value = title || ''; syncBugForm(); }
    }

    function closeBugForm() {
        if (!bugDrawerEl || bugDrawerEl.hidden) return;
        bugDrawerEl.hidden = true;
        editingId = null;
        const main = document.querySelector('.main');
        if (main) main.classList.remove('bug-lock');
    }

    function saveBugForm() {
        const v = formValue();
        /* 兜底：按钮禁用拦得住鼠标，拦不住回车与程序化调用 */
        if (!v.title) { syncBugForm(); return; }

        if (editingId) {
            const b = BUGS.find(x => x.id === editingId);
            if (!b) { closeBugForm(); return; }
            const from = b.state;
            b.title = v.title; b.sev = v.sev; b.state = v.state;
            b.mod = v.mod; b.own = v.own; b.src = v.src; b.steps = v.steps; b.env = v.env;
            closeBugForm();
            rebuildRow(b, from);
            sync();
            focusBug(b.id);
            syncPromoted(b);           /* 推成过任务的那条，任务行上的快照要跟着改 */
            toast('已保存 ' + b.id, 'ok');
        } else {
            const b = {
                id: nextBugId(), title: v.title, state: v.state, sev: v.sev,
                mod: v.mod, own: v.own, src: v.src,
                days: 0,               /* 今天刚报 ⇒ 停滞读数从 0 起（显示成"今天刚报"） */
                steps: v.steps, env: v.env
            };
            BUGS.unshift(b);           /* ⚠️ 与 addRow() 的"插在组首"对齐（见那边注释） */
            closeBugForm();
            addRow(b);
            sync();
            focusBug(b.id);
            toast('已登记 ' + b.id + ' · ' + (SEV[b.sev] || SEV.minor).label, 'ok');
        }
    }

    /* ── 快速记录：只问一句话 ────────────────────────────────────────
       其余字段全给默认值（一般 / 待修复 / 测试发现），不填的是**空**而不是"猜一个"——
       猜出来的严重度会让 KPI 条上的"先修哪条"变成假的。
       ⚠️ 记完不滚动、不抢焦点：随手记是连着记好几条的，视野和焦点被搬走就记不下去了。
          想看它就用 toast 上那枚「看它」。 */
    /* 只给"渲染上必须有一个值"的那两样默认（状态决定它落在哪一组、严重度决定色条）；
       其余一律留**空** —— "没记来源"和"来源是测试发现"是两件事，猜一个清单就开始说谎。
       严重度取最中性的"一般"：四个档里必须选一个，而"没判断"与"确实一般"在界面上分不出来
       （KPI 的"先修哪条"因此不会被它带偏到"致命"那一档）。 */
    const QUICK_DEFAULTS = { sev: 'minor', state: 'open' };

    function quickAddBug() {
        const el = document.getElementById('quickName');
        if (!el) return;
        const title = String(el.value || '').trim();
        if (!title) {
            el.classList.add('bad');
            el.focus();
            toast('先写一句"哪儿不对"', 'warn');
            return;
        }
        el.classList.remove('bad');
        const b = {
            id: nextBugId(), title: title,
            state: QUICK_DEFAULTS.state, sev: QUICK_DEFAULTS.sev,
            src: '', mod: '', own: '', days: 0, steps: [], env: ''
        };
        BUGS.unshift(b);            /* ⚠️ 与 addRow() 的"插组首"同序（见那边的注释） */
        addRow(b);
        sync();
        el.value = '';              /* 清空 ⇒ 接着记下一条 */
        el.focus();
        toast('已记下 ' + b.id + '（待修复）· 缺的回头补', 'ok',
              { label: '看它', onClick: () => focusBug(b.id) });
    }

    /* ── 删除：不可逆 ⇒ 必须过二次确认，且要说清**后果** ───────────── */
    function askRemoveBug(id) {
        const b = BUGS.find(x => x.id === id);
        if (!b) return;
        const code = entryOf(promotedMap()[b.id]).code || '';
        openConfirm({
            title: '删除 ' + b.id + '？',
            desc: '「' + b.title + '」会从清单里消失，这条记录不再留档。',
            /* ⚠️ 后果要说清，否则读者不敢按、或者按了才发现不是他想的：
               任务列表里那一条**保留**（"我要做的事"是另一个决定），
               只是它上面那枚「回到 BUG-xxxx」会失效。 */
            warn: code
                ? ('任务列表里的 ' + code + ' 会保留 —— 删掉这条 Bug 不代表那件事不用做了；'
                   + '只是它上面的「回到 ' + b.id + '」会失效。')
                : '这一条还没推成任务，删掉就是真的没有了。',
            confirmText: '删除',
            danger: true,
            onConfirm: () => removeBug(b)
        });
    }

    function removeBug(b) {
        const i = BUGS.indexOf(b);
        if (i >= 0) BUGS.splice(i, 1);
        removeRow(b);
        orphanPromoted(b);
        sync();
        toast('已删除 ' + b.id, 'ok');
    }

    /* ── 与任务列表的联动 ──────────────────────────────────────────
       任务页读不到这一页的数据，它手里是**推过去那一刻的快照** ⇒
       这边改了内容就得把快照改掉，否则两页对同一条 Bug 有两种说法。 */
    function syncPromoted(b) {
        const m = promotedMap();
        const e = m[b.id];
        if (!e || typeof e !== 'object') return;
        e.title = b.title;
        e.pri = PRI_OF[b.sev];
        e.src = (SRC[b.src] || SRC.qa).label;
        e.note = b.steps.length ? b.steps[b.steps.length - 1] : '';
        savePromoted(m);
    }

    /* 删掉之后任务列表里那一条**留着**，但反向链接失效 ⇒ 标成 orphan，
       任务页据此把那枚按钮收掉（不标的话它就是一个指向空处的死链）。 */
    function orphanPromoted(b) {
        const m = promotedMap();
        const e = m[b.id];
        if (e && typeof e === 'object') { e.orphan = true; savePromoted(m); }
    }

    /* 复制复现步骤：整段（编号 + 标题 + 步骤 + 环境）——
       比只复制三步有用，粘到别处不用再补上下文。 */
    function copySteps(id) {
        const b = BUGS.find(x => x.id === id);
        if (!b) return;
        const txt = b.id + ' ' + b.title + '\n'
                  + b.steps.map((x, i) => (i + 1) + '. ' + x).join('\n')
                  + (b.env ? '\n\n环境：' + b.env : '');
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(txt).then(
                () => toast('已复制复现步骤 · ' + b.id, 'ok'),
                () => toast('浏览器没让复制，手动选中吧', 'warn'));
        } else {
            toast('这个浏览器不支持一键复制', 'warn');
        }
    }

    /* 抽屉里 ⌘/Ctrl + Enter 提交（填完最后一行不用去够鼠标） */
    if (bugDrawerEl) {
        bugDrawerEl.addEventListener('keydown', e => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); saveBugForm(); }
        });
    }

    function demo(label) { toast('原型演示：' + label, 'info'); }

    /* 事件委托挂在容器上：四张卡是现算出来的，
       逐行绑监听器会在每次重渲之后**全部失效**（而且不报错，只是点了没反应）。
       分三支，顺序不能换：行尾推进 → 展开区里的次要动作 → 整行展开。 */
    (function wireBugGroups() {
        const box = document.getElementById('bugGroups');
        if (!box) return;
        box.addEventListener('click', function (e) {
            const adv = e.target.closest('.bug-adv');
            if (adv) {
                const r = adv.closest('.bug-row');
                if (!r) return;
                /* 行尾那一枚按钮按状态分流：只有「待修复」那一步是**跨页**的 */
                if (r.dataset.state === 'open') promote(r); else advance(r);
                return;
            }
            const act = e.target.closest('[data-bug-act]');
            if (act) {
                const r = act.closest('.bug-row');
                if (!r) return;
                const k = act.dataset.bugAct;
                if (k === 'edit') openBugForm(r.id);
                else if (k === 'del') askRemoveBug(r.id);
                else if (k === 'copy') copySteps(r.id);
                return;
            }
            const main = e.target.closest('.bug-main');
            if (main) toggleBug(main.closest('.bug-row'));
        });
    })();

    /* 首屏：先渲染分组，再交给导航壳对齐 —— 顺序不能反：
       圆盘与侧栏副标题读的就是渲染出来之后的条数。 */
    renderGroups();
    sync();

    /* 从任务页那枚「回到 BUG-xxxx」跳回来时带 hash ⇒ 直接落在那一条上
       （滚到它所在的分组 + 展开 + 闪一下）。等一帧再跑：`sync()` 刚重排过圆盘。 */
    if (location.hash.length > 1) {
        const bid = decodeURIComponent(location.hash.slice(1));
        if (BUGS.some(b => b.id === bid)) setTimeout(() => focusBug(bid), 60);
    }
'''


# ============================================================================
# 组装
# ============================================================================
import re

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, '工作-项目-项目详情-账户-index.html')
DST = os.path.join(HERE, '工作-项目-项目详情-Bug-index.html')
L = io.open(SRC, encoding='utf-8').read().split('\n')


def idx(sub, start=0):
    for i in range(start, len(L)):
        if sub in L[i]:
            return i
    raise SystemExit('MARKER NOT FOUND: ' + sub)


def back(sub, start):
    i = start
    while i >= 0:
        if sub in L[i]:
            return i
        i -= 1
    raise SystemExit('MARKER NOT FOUND (back): ' + sub)


def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, 'REPLACE 命中 %d 次（期望 %d）：%s' % (n, count, old[:70])
    return s.replace(old, new)


I_HTML      = idx('<html lang="zh-CN">')
I_TITLE     = idx('<title>')
I_STYLE     = idx('<style>')
I_STYLECL   = idx('</style>')
I_BODY      = idx('<body>')
I_CONTENT   = idx('<!-- ========== 页面级仪表')
I_MAINCLOSE = idx('</main>')
I_CMD       = idx('<div class="cmd-mask" id="cmdMask"')
I_MODALMK   = idx('<!-- 弹窗（仅用于破坏性操作的二次确认） -->')
I_ACCDRAWER = idx('<!-- ========== 添加 / 编辑账户：右侧抽屉')
I_SCRIPT    = idx('<script>')
I_TOASTEND  = idx('toastTimer = setTimeout')
I_ACCDATA   = back('/* ======', idx('账户 · 数据'))
I_INIT      = idx('/* ============ 初始化 ============ */')
I_ASSERT    = idx('console.assert(new Set(bodies)')
I_SCRCL     = idx('</script>')
# 账户专属 CSS 的起点（它自己那段的第一行注释）
I_ACC_CSS   = back('        /* ====', idx('账户 · 凭据清单'))
I_SLOTTABS  = idx('<div class="slot-tabs" id="slotTabs">')
I_SLOTBODY  = idx('<div class="slot-body">')
I_SIDEFOOT  = idx('<div class="sidebar-foot">')

# 锚点之间的相对位置（源页结构动了就得回头改这个脚本，而不是让它静默拼错）
assert (I_HTML < I_TITLE < I_STYLE < I_ACC_CSS < I_STYLECL < I_BODY
        < I_SLOTTABS < I_SLOTBODY < I_SIDEFOOT < I_CONTENT < I_MAINCLOSE
        < I_CMD < I_MODALMK < I_ACCDRAWER < I_SCRIPT < I_TOASTEND
        < I_ACCDATA < I_INIT < I_ASSERT < I_SCRCL), '锚点顺序不对（源页结构变了）'
assert L[I_TOASTEND + 1].strip() == '}', 'Toast 段收尾没找准：' + L[I_TOASTEND + 1][:60]
assert L[I_MAINCLOSE - 1].strip() == '</div>', '内容区收尾四行的起点不对'
assert '账户' in L[I_TITLE], '源页 title 锚点不对'
assert '页面级仪表' in L[I_CONTENT], '内容区锚点不对（页面级仪表那段被换过？）'
# 内容区起点往后六行内必须出现 KPI 条 —— 否则取到的是别处的同名注释
assert any('class="kpi-bar"' in L[I_CONTENT + i] for i in range(1, 8)), '内容区起点不像仪表条那一段'

def cut_css_blocks(text, prefixes):
    """按"块"删：一个块 = 深度 0 处的选择器起、到配对的 `}` 止。
       @media / @supports 递归进去，内部删空了就整块去掉（否则媒体查询会带着孤儿类留下）。"""
    out, i, n, dropped = [], 0, len(text), []
    while i < n:
        j = text.find('{', i)
        if j < 0:
            out.append(text[i:]); break
        sel = text[i:j]
        depth, k = 1, j + 1
        while k < n and depth:
            if text[k] == '{': depth += 1
            elif text[k] == '}': depth -= 1
            k += 1
        block = text[i:k]
        sel_clean = re.sub(r'/\*.*?\*/', '', sel, flags=re.S)
        sels = [x.strip() for x in re.split(r',(?![^(]*\))', sel_clean) if x.strip()]
        if re.search(r'@(media|supports)\b', sel):
            inner = block[block.index('{') + 1:block.rindex('}')]
            inner2, sub_ = cut_css_blocks(inner, prefixes)
            dropped.extend(sub_)
            out.append(sel + '{' + inner2 + '}' if inner2.strip() else '')
            i = k
            continue
        hit = False
        for one in sels:
            for c in re.findall(r'\.([A-Za-z][\w-]*)', one):
                if any(c == p.lstrip('.') or c.startswith(p.lstrip('.')) for p in prefixes):
                    hit = True
        if hit:
            dropped.append(sel.strip().split('\n')[-1][:60])
            out.append('')
        else:
            out.append(block)
        i = k
    return ''.join(out), dropped


# ─────────────────────────────────────────────────────────────
# ① 文件头 + 头部 + CSS（保留源页基础段，切掉账户专属段，接本页两段）
# ─────────────────────────────────────────────────────────────
out = []
out.append(L[0])                          # <!DOCTYPE html>
out.extend(NEW_COMMENT.split('\n'))
out.extend(L[I_HTML:I_TITLE])             # <html><head><meta×2>
out.append('    <title>Bug · 项目详情</title>')
# 基础段里混着几条"只在账户页有消费者"的规则（侧栏 KPI 槽 / KPI 单位 / 危险按钮 / 警示条）
# —— 本页把那些消费者一起删掉了 ⇒ 这些块留着就是孤儿声明（探针第 4 条会报）。
BASE_CSS, _dropped = cut_css_blocks('\n'.join(L[I_STYLE:I_ACC_CSS]),
                                    ['.slot-kpi', '.accent', '.kpi-unit', '.btn-danger', '.modal-warn'])
# `--border-field`（输入框那一档描边）的六个消费者全在账户专属段里 ⇒ 声明一起撤。
# 原地留一句：本页没有表单，将来真要加表单，从账户页把这一行拿回来。
BASE_CSS = '\n'.join(l for l in BASE_CSS.split('\n')
                       if '--idle-fg' not in l)   # ℹ️ `--border-field` 不再过滤：本页现在有表单了
print('[build] 基础段删掉 %d 块（本页无消费者的）' % len(_dropped))
out.extend(BASE_CSS.split('\n'))
out.extend(NEW_CSS.rstrip('\n').split('\n'))
out.extend(NEW_RESP.rstrip('\n').split('\n'))
out.append(L[I_STYLECL])                  # </style>

# ── 新类名先和「全页既有类」求交集（判据是**交集**不是差集）：
#    给新组件起名前拿候选名去和源页已有的类名比，非白名单的一律停构建。
#    ⚠️ 双向差集查不出这一类（两边都有定义、两边都有标记，它只查"有没有"）。
REUSE_OK = {
    # 有意复用源页那一族（元素的形态由它们定义，本页只是使用者）
    'btn', 'btn-ghost', 'btn-sm', 'btn-primary', 'modal-close', 'modal-actions', 'toast',
    'badge', 'hero-bar-left', 'hero-tag',
    # 表单控件那一族（源页账户抽屉在用，本页搬同一份形状 —— 两个页面的输入框不该长得不一样）
    'field', 'two', 'field-label', 'field-hint', 'inp', 'mono', 'chip', 'chip-row',
    'modal-warn', 'btn-danger', 'spacer',
    'ops-card', 'ops-card-head', 'ops-card-head-left', 'ops-card-head-right', 'ops-card-title',
    'ops-card-badge', 'ops-card-body', 'ops-card-body-inner', 'ops-fold-icon', 'card-icon',
    'kpi', 'kpi-top', 'kpi-ico', 'kpi-label', 'kpi-val', 'kpi-unit', 'kpi-sub', 'kpi-bar',
    'tabs', 'tabs-wrap', 'tab', 'tab-count', 'detail', 'main', 'hero-bar', 'hero-bar-right',
    'hero-name', 'slot-tab', 'slot-tabs', 'slot-body', 'slot-panel', 'recent-item',
    'recent-icon', 'recent-text', 'recent-time', 'quick-grid', 'quick-btn',
    'ai-chat', 'ai-msg', 'bot', 'user', 'ai-input', 'ai-send',
    'cmd-item', 'cmd-item-icon', 'cmd-item-text', 'cmd-kbd', 'cmd-list',
    # 状态类（本页与源页同语义）
    'active', 'dark', 'warn', 'ok', 'danger', 'info', 'open',
    # `.bad`（校验没过那一格）/ `.on`（胶囊选中）—— 与源页同名同义，有意复用
    'bad', 'on',
}


def _classes(t):
    return set(re.findall(r'\.([A-Za-z][\w-]*)', re.sub(r'/\*.*?\*/', '', t, flags=re.S)))


_src_all = io.open(SRC, encoding='utf-8').read()
_src_cls = _classes(_src_all)
_new_cls = _classes(NEW_CSS + NEW_RESP)
_clash = sorted(c for c in (_new_cls & _src_cls) if c not in REUSE_OK)
if _clash:
    raise SystemExit('[clash] 本页新增的类名撞了源页既有类：' + ', '.join(_clash))
print('[build] 新类名 %d 个，与源页既有类零冲突（白名单复用 %d 个）' % (len(_new_cls), len(REUSE_OK)))

# ─────────────────────────────────────────────────────────────
# ② 壳：<body> … 内容区之前（顶栏 / 侧栏 / 圆盘 / Hero / Tab 条）
# ─────────────────────────────────────────────────────────────
shell = '\n'.join(L[I_BODY:I_CONTENT])
shell = rep(shell, '<span class="name" id="sidebarTitle">账户</span>',
                   '<span class="name" id="sidebarTitle">Bug</span>')
shell = rep(shell, '<div class="sidebar-subtitle" id="sidebarSubtitle">凭据 · 8 条</div>',
                   '<div class="sidebar-subtitle" id="sidebarSubtitle">待修复 · 4 条</div>')

# ── Hero 右半：新增一条 Bug 是本页**唯一的高频写动作** ⇒ 常驻，不许只藏在
#    侧栏「快捷」那格二级面板与 ⌘K 里（判据：唯一的高频动作不能藏在二级入口里）。
#    ⚠️ 同时把旁边那枚「编辑」改成「编辑项目」：这一页里还有一枚「编辑」是编辑**某一条
#       Bug**（在行的展开区里），两枚同名按钮在不同层级会让读者以为是同一个。
# ⚠️ 只改名、不加动作：**Hero 右半那一排是"项目级"的**（编辑项目 / 重新检查 / 进度 / 截止），
#    而「报告 Bug」是**本分区**的动作 —— 放这里读者会分不清它动的是项目还是这一页的清单。
#    它跟 Tab 条走（见 NEW_CONTENT 里的 `.bug-toolbar`）。
shell = rep(shell, '<button class="btn btn-ghost btn-sm" type="button" data-demo="编辑项目">编辑</button>',
                   '<button class="btn btn-ghost btn-sm" type="button" data-demo="编辑项目">编辑项目</button>')

# 侧栏槽的 tab 条：四格收成三格。**去掉 KPI 那一格**——
# 页面顶部已经有仪表条了，判据：「槽里放 KPI 而顶部已有仪表条 ⇒ 只留一侧」。
a = shell.index('                <div class="slot-tabs" id="slotTabs">')
b = shell.index('                <div class="slot-body">')
shell = shell[:a] + NEW_SLOTTABS.rstrip('\n') + '\n' + shell[b:]

a = shell.index('                <div class="slot-body">')
b = shell.index('            <div class="sidebar-foot">')
shell = shell[:a] + SLOT_BODY.rstrip('\n') + '\n' + shell[b:]

# Tab 条：整段换（Bug 标成 active，计数由 sync() 现算）
a = shell.index('                <div class="tabs" role="tablist"')
_k = shell.index('账户 <span class="tab-count"', a)
b = shell.index('\n', shell.index('</div>', _k))
shell = shell[:a] + TABS.rstrip('\n') + shell[b:]

out.extend(shell.split('\n'))
out.extend(NEW_CONTENT.rstrip('\n').split('\n'))
# ⚠️ 内容区的**收尾四行**（.detail / </main> / 两层 div）要自己补回来：
#    它们夹在"最后一张卡"与 .cmd-mask 之间，而那一整段是被整段替换掉的。
#    少写这几行浏览器照样渲染（会自动闭合），只有数 div 深度才看得出来 —— 静默的那种错。
out.extend(L[I_MAINCLOSE - 1:I_MAINCLOSE + 3])

# ─────────────────────────────────────────────────────────────
# ③ 页级浮层：⌘K（换成本页四个分组）→ 弹窗 → Toast
#    源页的「账户抽屉」与「密码生成器」两个浮层**不搬**（本页没有消费者）。
# ─────────────────────────────────────────────────────────────
cmd = '\n'.join(L[I_CMD:I_MODALMK])
_a = cmd.index('            <div class="cmd-item active" data-goto="panel:cred">')
_b = cmd.index('            <div class="cmd-item" data-goto="module:dashboard">')
cmd = cmd[:_a] + CMDLIST + cmd[_b:]
# ⚠️ 壳里带过来的两条条目**没有 `data-goto`** ⇒ 点它们什么都不发生（面板里最扎眼的那种坏）。
#    「任务清单」有真实去处（任务页）；「工作」是当前模块 ⇒ 给一句"已经在这里了"的回执。
cmd = rep(cmd, '<div class="cmd-item"><div class="cmd-item-icon" data-icon="check"></div>'
               '<div class="cmd-item-text">任务清单</div><span class="cmd-kbd">G T</span></div>',
               '<div class="cmd-item" data-goto="page:tasks"><div class="cmd-item-icon" data-icon="check"></div>'
               '<div class="cmd-item-text">任务清单</div><span class="cmd-kbd">G T</span></div>')
cmd = rep(cmd, '<div class="cmd-item"><div class="cmd-item-icon" data-icon="briefcase"></div>'
               '<div class="cmd-item-text">工作</div><span class="cmd-kbd">G W</span></div>',
               '<div class="cmd-item" data-goto="module:work"><div class="cmd-item-icon" data-icon="briefcase"></div>'
               '<div class="cmd-item-text">工作</div><span class="cmd-kbd">G W</span></div>')
out.extend(cmd.split('\n'))
out.extend(L[I_MODALMK:I_ACCDRAWER])
out.extend(NEW_DRAWER.rstrip('\n').split('\n'))

# ─────────────────────────────────────────────────────────────
# ④ 脚本：壳（主题 / 图标表 / 导航壳 / Toast）→ 本页内容 → 初始化
#    源页的三段内容脚本（账户数据 / 生成器 / 抽屉）在 I_TOASTEND 处被截断，不进来。
# ─────────────────────────────────────────────────────────────
script_shell = '\n'.join(L[I_SCRIPT:I_TOASTEND + 2])

a = script_shell.index('    const SECTIONS = [')
b = script_shell.index('    ];', a) + len('    ];')
script_shell = script_shell[:a] + NEW_SECTIONS + script_shell[b:]

a = script_shell.index('    function sectionCount(sec) {')
b = script_shell.index('\n    }\n', a) + len('\n    }\n')
script_shell = script_shell[:a] + NEW_SECTIONCOUNT + '\n' + script_shell[b:]

# 图标表补条目：插在**表尾**（`const ICON = {` 与紧随其后的第一条 `    };` 之间）。
# ⚠️ 不要拿"某条图标的注释"当锚点 —— 那条注释会随它描述的功能一起被改掉。
_a = script_shell.index('    const ICON = {')
_b = script_shell.index('\n    };\n', _a)
assert 0 < _b - _a < 6000, 'ICON 表的表尾没找准'
# ⚠️ 源页那一条**可能已经带尾逗号**（账户页的 `search` 就是）⇒ 不加这一句会拼出 `,,`
_sep = '' if script_shell[:_b].rstrip().endswith(',') else ','
script_shell = script_shell[:_b] + _sep + '\n' + NEW_ICONS_EXTRA.rstrip('\n') + script_shell[_b:]

# ⚠️ 下面两处改的是**源页文本**（脚本壳是从源页逐字切的）⇒ 只能用 rep。
#    改的是壳里那两段通用逻辑，本页的两个浮层要接进同一套入口 ——
#    不然就是一个"点了什么都不发生"的抽屉（ESC 关不掉、⌘K 打不开）。

# ① ESC：浮层从**最上面那一层**开始退
script_shell = rep(script_shell, """        if (e.key === 'Escape') {
            if (cmdMask.classList.contains('open')) { closeCmd(); return; }
            if (megaMod) { closeMega(); return; }
        }""", """        if (e.key === 'Escape') {
            /* ⚠️ 从**最上面那一层**开始退，顺序不能换：
               弹窗（在抽屉里点删除引出的二次确认）> 抽屉 > ⌘K > 超级菜单。
               反过来的话，抽屉里按 ESC 会先去关背后那个根本没开的 ⌘K。 */
            if (modalMask.classList.contains('open')) { closeModal(); return; }
            if (bugDrawerEl && !bugDrawerEl.hidden) { closeBugForm(); return; }
            if (cmdMask.classList.contains('open')) { closeCmd(); return; }
            if (megaMod) { closeMega(); return; }
        }""")

# ② 命令面板：分派补两种 kind（`page:` 走跳转；`module:work` 是"已经在这儿了"）
script_shell = rep(script_shell, """            closeCmd();
            if (kind === 'panel') activatePanel(key);""",
                   """            /* ⚠️ 先把要用的文本抓下来 —— 紧跟着的 `closeCmd()` 会把输入框清空，
               等它跑完再读就是空字符串（"搜不到就新建"会新建出一条空标题）。 */
            const typed = (kind === 'new' && key === 'quick') ? cmdInput.value.trim() : '';
            closeCmd();
            if (kind === 'new' && key === 'quick') openBugFormWithTitle(typed);
            else if (kind === 'new') openBugForm();
            else if (kind === 'panel') activatePanel(key);
            else if (kind === 'page' && key === 'tasks') location.href = '工作-任务-总览-index.html';
            else if (kind === 'module' && key === 'work') toast('已经在这个模块里了', 'info');""")

# ③ 开合时重置过滤态（关掉再打开不能留着上一次的筛选结果）
script_shell = rep(script_shell,
    """    function openCmd() { cmdMask.classList.add('open'); setTimeout(() => cmdInput.focus(), 50); }
    function closeCmd() { cmdMask.classList.remove('open'); cmdInput.value = ''; }""",
    """    function openCmd() { cmdMask.classList.add('open'); cmdInput.value = ''; filterCmd(); setTimeout(() => cmdInput.focus(), 50); }
    function closeCmd() { cmdMask.classList.remove('open'); cmdInput.value = ''; filterCmd(); }""")

# ④ 面板里的键盘。**这几条是把提示兑现**：条目上写着 `G 1` / `G N` / `G T`，
#    就得真的能按 —— 写着按不出来，比不写更坏（承诺落空）。
script_shell = rep(script_shell, """    document.addEventListener('keydown', (e) => {
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {""",
    """    /* ↑↓ 移动高亮、Enter 执行、"G + 键"直选（条目右侧那枚提示就是它）。 */
    let cmdG = false;
    function cmdItems() { return [...cmdMask.querySelectorAll('.cmd-item')]; }
    /* 输入框的过滤：placeholder 写着"…或输入命令"，那就得真能筛 —— 否则那三个字是空话。
       ⚠️ 高亮要跟着落到"第一条还看得见的"上，否则回车会执行一条已经被筛掉的条目。 */
    /* ⚠️ 键盘只能走**看得见的**那几条：过滤之后若还用全量列表，
       ↑↓ 会停在一条隐藏项上、回车把它执行掉 —— 而屏幕上什么都没有。 */
    function cmdVisible() { return cmdItems().filter(el => !el.hidden); }

    function filterCmd() {
        const q = cmdInput.value.trim().toLowerCase();
        const list = cmdItems().filter(el => el.id !== 'cmdNew');   /* 它是现算的，不参与过滤 */
        list.forEach(el => {
            const t = (el.querySelector('.cmd-item-text') || {}).textContent || '';
            el.hidden = !!q && t.toLowerCase().indexOf(q) < 0;
        });
        const first = list.find(el => !el.hidden);
        /* 一句话都没匹配上 ⇒ 给一条"记下来"（"搜不到就新建"）：直接写进清单，
           不是先跳到一个空白表单。 */
        const nu = document.getElementById('cmdNew');
        const none = !!q && !first;
        if (nu) {
            nu.hidden = !none;
            const t = nu.querySelector('.cmd-item-text');
            if (t) t.textContent = '新建「' + cmdInput.value.trim() + '」';
        }
        list.forEach(el => el.classList.toggle('active', el === first));
        if (none && nu) nu.classList.add('active');
    }
    cmdInput.addEventListener('input', filterCmd);
    document.addEventListener('keydown', (e) => {
        if (cmdMask.classList.contains('open')) {
            const items = cmdVisible();
            if (items.length) {
                const cur = Math.max(0, items.findIndex(el => el.classList.contains('active')));
                const setActive = i => {
                    items.forEach((el, k) => el.classList.toggle('active', k === i));
                    items[i].scrollIntoView({ block: 'nearest' });
                };
                if (e.key === 'ArrowDown') { e.preventDefault(); setActive((cur + 1) % items.length); return; }
                if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((cur - 1 + items.length) % items.length); return; }
                if (e.key === 'Enter')     { e.preventDefault(); items[cur].click(); return; }
                const k = e.key.toUpperCase();
                /* ⚠️ 只有当输入框**是空的**时才把 G 当序列键 —— 否则想搜 "grid" 时
                   第一个字母会被吃掉（面板的输入框是用来打字的）。 */
                if (k === 'G' && e.target === cmdInput && !cmdInput.value) { cmdG = true; return; }
                if (cmdG) {
                    cmdG = false;
                    const hit = items.find(el => {
                        const kb = el.querySelector('.cmd-kbd');
                        return kb && kb.textContent.trim().toUpperCase() === 'G ' + k;
                    });
                    if (hit) { e.preventDefault(); hit.click(); }
                    return;
                }
            }
        }
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {""")

out.extend(script_shell.split('\n'))
out.extend(NEW_JS.rstrip('\n').split('\n'))

# 初始化块：从壳里搬出来、放到内容之后（它要读渲染出来的分组）
init_block = '\n'.join(L[I_INIT:I_ASSERT + 2])
assert 'syncChrome(false)' in init_block, '初始化块没取对'
out.extend(init_block.split('\n'))
out.append('')
out.append('    /* 图标：一次灌完（静态那一份）。动态生成的（清单行 / 分组头 / 侧栏「最久」）'
           '在构造时就已经是 svg 字符串，不需要第二遍。 */')
out.append('    paintIcons(document);')
out.append(L[I_SCRCL])
out.extend(L[I_SCRCL + 1:])

# ── 结构断言：KPI 条与四张分组卡必须在 `.detail` **里面**。
#    判据：`.detail` 是内容区容器，**它的直接孩子才有那 20px 的 gap**。
#    ⚠️ 曾经错在：整段替换 tab 条时把**外层容器的闭合 `</div>` 一起抄进了新块**，
#       产物里 `.detail` 提前关闭 ⇒ KPI 卡与分组卡成了 `<main>` 的直接孩子，
#       块级之间没有默认间距 ⇒ "卡片贴卡片"。而这类错**没有任何一条别的断言会报**：
#       div 深度终值仍是 0（多的一开一闭互相抵消，后面又少了一层），标签开合数也平衡。
_final = '\n'.join(out)
_markup = _final.split('<body>', 1)[1].split('<script>', 1)[0]
_markup = re.sub(r'<!--.*?-->', '', _markup, flags=re.S)   # ⚠️ 注释里也写着 `<div ...>` 字面量


def _depth_before(needle):
    """某个标记之前，`<div>` 的净深度（剥过注释）。"""
    seg = _markup[:_markup.index(needle)]
    return len(re.findall(r'<div\b', seg)) - len(re.findall(r'</div>', seg))


_d_detail = _depth_before('<div class="detail">')
_d_kpi    = _depth_before('<div class="kpi-bar">')
_d_groups = _depth_before('<div id="bugGroups">')
assert _d_kpi == _d_detail + 1, \
    'KPI 条掉到 .detail 外面了（深度 %d，应为 %d）⇒ 它会与上面的 tab 条贴住' % (_d_kpi, _d_detail + 1)
assert _d_groups == _d_detail + 1, \
    '分组容器掉到 .detail 外面了（深度 %d，应为 %d）⇒ 卡片会贴在一起' % (_d_groups, _d_detail + 1)
print('[build] 结构：kpi-bar / bugGroups 都在 .detail 内（深度 %d）' % (_d_detail + 1))

io.open(DST, 'w', encoding='utf-8').write('\n'.join(out))
print('[build] WROTE %s · %d 行 / %d 字节' % (os.path.basename(DST), len(out), len('\n'.join(out).encode())))

# ── 收尾：把"只能由脚本产出"的主内容用**页面自己的模板函数**灌成静态标记
#    （预览面板走静态 HTML 视图，脚本不跑；`#bugGroups` 与侧栏「最久」都是现算的）
seeder = os.path.join(HERE, '._seed-bugs.cjs')
node = shutil.which('node') or NODE_FALLBACK
if not os.path.exists(seeder):
    print('[build] 跳过灌静态：找不到 %s' % seeder)
elif not os.path.exists(node):
    print('[build] 跳过灌静态：没有 node')
else:
    r = subprocess.run([node, seeder, DST], capture_output=True, text=True)
    print((r.stdout or '').strip() or (r.stderr or '').strip())
    if r.returncode != 0:
        sys.exit(r.returncode)

    # ── 收尾断言：含 seeder 灌进来的那一份，整个 `<body>` 的 div 必须净平衡。
    #    判据：**负值=多了闭合（提前关一层容器）／正值=少了闭合（外层容器没关）**，
    #    两种都会让"卡片贴卡片"或"侧栏错位"，而且**不会**让页面报任何错。
    _after = io.open(DST, encoding='utf-8').read()
    _m = re.sub(r'<!--.*?-->', '', _after.split('<body>', 1)[1].split('<script>', 1)[0], flags=re.S)
    _n = len(re.findall(r'<div\b', _m)) - len(re.findall(r'</div>', _m))
    assert _n == 0, 'div 净深度 %d（应 0）：某个容器的闭合在整段替换时被抄进来或吃掉了' % _n
    print('[build] 结构：整页 div 净深度 0（含 seeder 灌入的静态标记）')
