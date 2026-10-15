# -*- coding: utf-8 -*-
"""`工作-服务器-详情-index.html` 的构建脚本（可重跑）。

**派生，不重切壳**：源页 = `工作-服务器-index.html`（同一模块、同一套令牌 / 图标表 / 导航壳 /
数据模型）。本脚本做四件事：
  ① 切 CSS：拿源页的 `<style>`，**按"本页还有没有消费者"删块**（列表页的卡片墙 / 浮层 /
     筛选栏 / 分段 / 页头 / KPI 条全部不进来），再追加本页专有的那一段；
  ② 换主内容：源页的「页头 + 筛选栏 + 两格卡片墙」整段换成「② Hero + 三个区块」；
  ③ 换脚本：源页的 `<script>` 按**函数块边界**删掉列表页专属的那批（筛选 / 视角 / 卡片 /
     浮层 / KPI / 焦点跳转），本页自己的函数从 `sd_js.js` 追加；
  ④ 顶栏 / 侧栏标记逐字沿用（只改侧栏标题与副标题占位）。

⚠️ 每一步都断言（`must` / `drop_block` / `cut_css_block`）：找不到就 `SystemExit`，
   不静默跳过 —— `str.replace` 找不到时什么都不做也不报错，那正是"我以为改了"的来源。
"""
import io, os, re, shutil, subprocess, sys

# node：优先 PATH，其次托管运行时（本仓的开发机上是这个路径）
NODE_FALLBACK = '/Users/yangliu/Library/Application Support/Parall/WorkBuddy(Parall_3)/.workbuddy/binaries/node/versions/22.22.2-3/bin/node'

# 本页专有的三段内容（原地维护；改完重跑本脚本即可）
CSS_PART = r"""
        /* ============================================================
           ② Hero：**这台机器的实体头**（形态照同模块的详情页 `.hero-card`）
           —— 一个模块里"详情页的 ②"只该有一种长相，所以形状逐条照抄
              `工作-项目-项目详情-运维-index.html` 的 `.hero-card / .hero-bar`；
              内容换成机器：身份（机器名 / 环境 / 角色）+ 状态（连接）+ 它服务的项目。
           ⚠️ **不折叠**（与项目详情页的"默认收起"不同，这是有意的偏离）：
              hero 的右半是这台机器的**全部动作**（终端 / 日志 / 部署 / 编辑 / 移除），
              折进"展开后才看得见"的地方 = 唯一的高频动作被藏起来（判据：高频动作不许藏）。
              少一个折叠开关，也少一条键盘路径与一个 aria-expanded。
           ⚠️ 三个动作是**开窗**（`<a href=…#win>`，被拦时退回本页），所以它们是 `<a>` 不是 `<button>`；
              `移除` 走本页确认弹窗 —— 三件事三种形态，别一律做成按钮。
           ============================================================ */
        .hero-card {
            position: relative;
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: var(--r-lg);
            box-shadow: var(--shadow-card);
        }
        .hero-bar {
            display: flex; align-items: center; justify-content: space-between;
            gap: 14px; padding: 12px 16px; min-height: 58px; flex-wrap: wrap;
        }
        .hero-bar-left { display: flex; align-items: center; gap: 10px; min-width: 0; flex: 1; flex-wrap: wrap; }
        /* 返回：它不是"页面级动作"而是一条**来路**（这一页是从列表点进来的）⇒ 放在最左、次要色 */
        .hero-back {
            display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
            margin-left: -8px; padding: 4px 8px; border-radius: 8px;
            font-size: 12px; color: var(--text-muted); text-decoration: none;
            transition: background 0.18s ease, color 0.18s ease;
        }
        .hero-back:hover { background: var(--bg-hover); color: var(--text-primary); }
        .hero-name {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 18px; font-weight: 700; letter-spacing: -0.01em; line-height: 1.2;
            white-space: nowrap; min-width: 0;
        }
        /* 角色：与列表页卡片同一种表达 —— **形状**（一枚图标），文字在 title / 详情字段里 */
        .hero-role { display: flex; flex-shrink: 0; color: var(--text-muted); }
        /* 环境标签：照参考页 `.hero-tag` 的形态（小写字母间距 + 圆角块），文字换成环境 */
        .hero-tag {
            flex-shrink: 0; padding: 3px 9px; border-radius: 8px;
            font-size: 10px; font-weight: 700; letter-spacing: 0.08em;
            background: var(--m-soft); color: var(--m-ink);
        }
        .hero-tag.is-test { background: var(--warn-bg); color: var(--warn-fg); }
        .hero-bar-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; flex-wrap: wrap; }
        .hero-sep { width: 1px; height: 22px; background: var(--border-subtle); flex-shrink: 0; }
        /* ============================================================
           ③ 内容区块：本页的分区（同页并列 ⇒ 圆盘只做"定位 + 滚动同步"）
           ============================================================ */
        .sec {
            background: var(--bg-card);
            border: 1px solid var(--border-card);
            border-radius: var(--r-lg);
            box-shadow: var(--shadow-card);
            padding: 16px 18px 18px;
            /* 圆盘点一格滚过来时，别把标题压在视口顶边 */
            scroll-margin-top: 12px;
        }
        .sec-head { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .sec-ico { display: flex; color: var(--text-muted); }
        .sec-name { font-size: 14px; font-weight: 700; }
        .sec-count {
            padding: 2px 8px; border-radius: 999px;
            font-size: 10.5px; font-weight: 700;
            background: var(--bg-subtle); color: var(--text-secondary);
        }
        /* 段头的右侧那句话：回答"这一节为什么值得看"（它给不了别处已有的信息就别写） */
        .sec-note { margin-left: auto; font-size: 11.5px; color: var(--text-muted); }

        /* ── 概览：字段（标签在上、值在下，两列）──────────────────────── */
        .fld-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px 16px; }
        .fld { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
        .fld .k { font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; color: var(--text-muted); }
        .fld .v {
            font-size: 13px; color: var(--text-primary);
            display: flex; align-items: center; gap: 6px; flex-wrap: wrap; min-width: 0;
        }
        .fld .v.is-mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-weight: 600; }
        .fld.is-wide { grid-column: 1 / -1; }

        /* ── 端口胶囊：等宽端口号 + 次要服务名（会被复制的是端口号）── */
        .chips { display: flex; flex-wrap: wrap; gap: 6px; min-width: 0; }
        .pchip {
            display: inline-flex; align-items: baseline; gap: 6px;
            padding: 3px 9px; border-radius: 6px;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12px; font-weight: 700; color: var(--text-primary);
            background: var(--bg-subtle);
            box-shadow: inset 0 0 0 1px var(--border-strong);
        }
        .pchip .svc { font-family: inherit; font-size: 10.5px; font-weight: 500; color: var(--text-muted); }

        /* ── 项目：**项目卡片**（形状照用户给的参考图，2026-09-29）
           参考的形态是"一张有底色的卡 + 顶部一个缩略窗 + 名字 + 右上角一颗星 + 一行读数"。
           照抄的是**形状**；字段全换成这一页真有的 ——
             参考里那三样本页都没有：收藏星、进度 72%、截止 11月15日：
               · 缩略窗  → 留作**纯装饰**（一条横条 + 三点，不承载任何数字）
               · 收藏星  → 换成「去运维页」（同一个位置，一个真动作）
               · 进度/截止 → 换成「文件位置 N 条」（这一段的本分）
           ⚠️ **卡底色 = 项目身份色** —— 这段里颜色只承载这一种语义。
              三支都取冷色（靛 245° / 紫 285° / 青 192°）：红 / 绿 / 琥珀已经被语义色占了
              （危险 / 正常 / 警告），项目色落进那三支会被读成"这个项目出问题了"。
           ⚠️ 卡是**抽屉把手**：`div[role=button]`（右上角嵌着 `<a>` 去运维页，
              而按钮里不许嵌链接）。整张卡都是命中区，右上角那颗是本页唯一的第二动作。
           ⚠️ 三档浓度（卡底 9% / 窗底 6% / 窗里那条 20%）全是**同色浓淡**，不是"混白" ——
              混白在深色主题下会翻向，同色浓淡两套令牌方向一致，不用另写 `.dark` 覆盖。 */
        .pc-grid {
            display: grid; gap: 14px;
            grid-template-columns: repeat(auto-fill, minmax(258px, 1fr));
        }
        .pc-card {
            /* 兜底 = 中性色：没有配色的项目（真接了数据之后新冒出来的）不该整块透明 */
            --pc: var(--text-muted);
            --pc-bg: color-mix(in srgb, var(--pc) 9%, var(--bg-card));
            --pc-well: color-mix(in srgb, var(--pc) 6%, var(--bg-card));
            --pc-line: color-mix(in srgb, var(--pc) 26%, var(--border-card));
            --pc-ink: color-mix(in srgb, var(--pc) 78%, var(--text-primary));
            /* 图形档（底下那枚彩点 / 缩略窗里那三点）单独一支槽：
               ⚠️ 深色主题下项目色**直接压深底不够 3:1**（实测靛 1.96:1、紫 2.13:1，只有青够）
               ⇒ 深色下把它往白里提一档当"图形档"，与 `--m-main / --m-ink` 是同一套做法
               （同一支色分图形档与文字档；判据：这是**唯一线索**吗？是 ⇒ 必须 ≥3:1）。 */
            --pc-mark: var(--pc);
            display: flex; flex-direction: column; gap: 11px;
            padding: 12px 13px 13px;
            border-radius: var(--r-lg);
            background: var(--pc-bg);
            border: 1px solid var(--pc-line);
            cursor: pointer;
            transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
        }
        .pc-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-card); }
        .pc-card:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 2px; }

        /* 缩略窗：**只承载形状**（一条横条 + 三点 = "一份东西的缩略图"）。
           ⚠️ 别往里放计数 —— 那是"形状线索不许承载数字"的老账。 */
        .pc-thumb {
            position: relative; height: 52px; border-radius: 9px;
            background: var(--pc-well);
            box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--pc) 13%, transparent);
        }
        .pc-bar {
            position: absolute; left: 11px; right: 46px; top: 12px; height: 9px;
            border-radius: 5px; background: color-mix(in srgb, var(--pc) 20%, var(--bg-card));
        }
        .pc-dots { position: absolute; right: 11px; top: 13px; display: flex; gap: 4px; }
        .pc-dots span {
            width: 6px; height: 6px; border-radius: 50%;
            background: color-mix(in srgb, var(--pc-mark) 78%, var(--bg-card));
        }

        .pc-head { display: flex; align-items: flex-start; gap: 8px; }
        .pc-name { flex: 1; min-width: 0; font-size: 14px; font-weight: 800; line-height: 1.35; }
        /* 右上角那颗：参考里是收藏星，本页换成**去运维页**（同一个位置上的一个真动作）。
           `margin` 负值把它的命中区吃回卡片内边距里，视觉上贴角、又不把这一行推高。 */
        .pc-go {
            flex-shrink: 0; display: flex; align-items: center; justify-content: center;
            width: 26px; height: 26px; margin: -4px -4px 0 0; border-radius: 7px;
            color: var(--text-secondary); text-decoration: none;
            transition: background 0.16s ease, color 0.16s ease;
        }
        .pc-go:hover { background: color-mix(in srgb, var(--pc) 15%, var(--bg-card)); color: var(--pc-ink); }

        .pc-meta {
            display: flex; align-items: center; gap: 6px;
            font-size: 11.5px; color: var(--text-secondary);
        }
        .pc-meta b { font-weight: 700; color: var(--text-primary); font-variant-numeric: tabular-nums; }
        .pc-dot { flex-shrink: 0; width: 6px; height: 6px; border-radius: 50%; background: var(--pc-mark); }

        /* ============================================================
           文档：**书**（精装封面）
           —— 整段取自 `工作-项目-项目详情-运维-index.html` 的 `.doc-books / .doc-book / .db-*`
              （那一版又是从 `design/project/项目-文档主页-index.html` 搬来的）。
              照抄的是**材质与四行版面**：布纹 / 书脊 / 压印框 / 三摞页边 / 题签 / 发丝线。
              在这里只改三处，其余逐字照抄：
                ① **颜色不写 `--book`**，让兜底 `var(--text-muted)` 生效（参考页三本里也只有
                   "脚本"那本另给一支深灰 `.script`）。
                   ⚠️ 别在这儿补 `--book: <项目色>` —— 那就把颜色变成"项目身份"，
                      而本页的颜色只承载**连接状态**（一条清单里颜色只承载一种语义）。
                ② `.db-icon` 用本页 `ICON` 表的 svg（本页是一套图标制，没有 emoji）。
                ③ 尺寸取参考页给"部署文档那一格"的 96 宽档（那边原话：「同一本书的小一号」）。
              ⚠️ 参考页的 `.book-actions`（书上那两个下载 / 更多按钮）与 `.db-mark`（书签）
                 **没搬**：本页的书只有"点开读"这一个动作，管理（下载 / 新建 / 移动）
                 各只有一个家（文档主页）—— 搬到这儿会长出第二套入口。
                 书签的判据是"今天动过"，本页这几本的更新时间都够不上，规则留着也是死的。
              ⚠️ 渐变只出现在这**一个物件**上：封面 / 书脊 / 布纹都是"书"的材质，
                 不是界面的面阶（面阶仍然全实色）。
           ============================================================ */
        .dc-shelf { margin-top: 18px; }
        .dc-shelf:first-child { margin-top: 0; }
        .dc-shead {
            display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
            font-size: 11.5px; font-weight: 700; color: var(--text-secondary);
        }
        .dc-shead .n { font-weight: 600; color: var(--text-muted); }
        /* `align-items: flex-start` 是**照抄之外多加的一句**：flex 默认的 `stretch` 会不会
           压掉 `aspect-ratio` 取决于规范细节，显式钉住"按比例、靠上对齐"就不必赌它。 */
        .doc-books { display: flex; align-items: flex-start; gap: 12px; flex-wrap: wrap; }
        .doc-book {
            /* 尺度：只写四个基准值，其余装饰与字号全部由 calc 推出来 ——
               比写百分比省事，也不会踩"padding 的百分比一律按**宽**解析"那个坑。 */
            --bk-spine: 8px;                         /* 书脊带宽 */
            --bk-frame: 6px;                         /* 压印框：上 / 右 / 下 */
            --bk-frame-l: 10px;                      /* 压印框：左边（让过书脊） */
            --bk-tag: 8px;                           /* 唯一一个基准字号 */
            --bk-pad-y: calc(var(--bk-frame) + 8px);
            --bk-pad: calc(var(--bk-frame) + 8px);
            --bk-pad-l: calc(var(--bk-frame-l) + 8px);
            --bk-title: calc(var(--bk-tag) * 1.4);
            --bk-sub: calc(var(--bk-tag) - 1px);
            --bk-foot: calc(var(--bk-tag) - 0.5px);
            --bk-icon: calc(var(--bk-tag) * 1.65);

            width: 96px;                             /* 书不随栏宽变形 */
            aspect-ratio: 5 / 7;                     /* 精装书开本（与参考页同一个比） */
            border-radius: 3px 8px 8px 3px;          /* 书脊那侧直角，翻口那侧圆角 */
            cursor: pointer; position: relative; overflow: hidden;
            color: #fff; border: none; text-align: left; font-family: inherit;
            padding: var(--bk-pad-y) var(--bk-pad) var(--bk-pad-y) var(--bk-pad-l);
            display: flex; flex-direction: column;
            /* 四层底色（上 → 下）：布纹 → 折痕高光 → 书脊 → 封面。
               145° 那层的**最亮一档就是 --book 本身**，往右下压深 ——
               所以封面上没有一处比它更亮，白字比值仍是验过的那个。 */
            background-image:
                repeating-linear-gradient(45deg,
                    color-mix(in srgb, #fff 3.5%, transparent) 0 1px,
                    transparent 1px 3px),
                linear-gradient(90deg,
                    transparent 0 var(--bk-spine),
                    color-mix(in srgb, #fff 15%, transparent) var(--bk-spine) calc(var(--bk-spine) + 1px),
                    transparent calc(var(--bk-spine) + 1px)),
                linear-gradient(90deg,
                    color-mix(in srgb, #000 40%, transparent) 0 var(--bk-spine),
                    transparent var(--bk-spine)),
                linear-gradient(145deg,
                    var(--book, var(--text-muted)) 0%,
                    color-mix(in srgb, var(--book, var(--text-muted)) 78%, #000) 58%,
                    color-mix(in srgb, var(--book, var(--text-muted)) 58%, #000) 100%);
            /* 三摞"页边"的硬阴影 + 一段柔和投影 —— 书的厚度靠这个，不靠描边 */
            box-shadow: 0 1px 0 rgba(0,0,0,0.09), 0 2px 0 rgba(0,0,0,0.06), 0 5px 14px rgba(15,23,42,0.20);
            transition: transform 0.35s cubic-bezier(0.34, 1.4, 0.64, 1), box-shadow 0.35s ease;
            transform-origin: center bottom;
        }
        /* 压印装饰框：外框 1px + 内框 1px。内框用 outline 做，为的是不为此再加一层节点 ——
           它是压印，不承载信息，所以 `pointer-events: none`。 */
        .doc-book::after {
            content: ""; position: absolute; pointer-events: none;
            inset: var(--bk-frame) var(--bk-frame) var(--bk-frame) var(--bk-frame-l);
            border: 1px solid color-mix(in srgb, #fff 26%, transparent);
            outline: 1px solid color-mix(in srgb, #fff 13%, transparent);
            outline-offset: -4px;
            border-radius: 3px 6px 6px 3px;
        }
        /* 悬停：抬起 + 微微歪一点 + 页边跟着变厚 */
        .doc-book:hover, .doc-book:focus-visible {
            transform: translateY(-5px) rotate(-1.2deg) scale(1.015);
            box-shadow: 0 2px 0 rgba(0,0,0,0.10), 0 4px 0 rgba(0,0,0,0.07), 0 18px 34px rgba(15,23,42,0.26);
        }
        .doc-book:focus-visible { outline: 2px solid var(--m-ink); outline-offset: 3px; }
        /* 深色下那三摞"页边"会变成一圈白毛边，必须另给一套 */
        .dark .doc-book {
            box-shadow: 0 1px 0 rgba(0,0,0,0.5), 0 2px 0 rgba(0,0,0,0.42), 0 6px 16px rgba(0,0,0,0.55);
        }
        /* 项目卡的图形档：深色下把项目色提亮（62% 项目色 + 白 ≈ 5.6:1 / 5.9:1） */
        .dark .pc-card { --pc-mark: color-mix(in srgb, var(--pc) 62%, #fff); }
        /* 脚本类（deploy.sh 说明那种）另给一支深灰。实底 + 白字不随主题换：白字压 #374151 = 10.4:1 */
        .doc-book.script { --book: #374151; }

        /* 第一行：类型小签 + 类型图形。小签是封面上的**白描边**，不是"淡底 + 彩字"。 */
        .db-top {
            display: flex; align-items: flex-start; justify-content: space-between; gap: 6px;
            margin-bottom: auto;                     /* ← 与 .db-mid 一起均分空白 */
        }
        .db-tag {
            font-size: var(--bk-tag); font-weight: 700; letter-spacing: 0.14em;
            color: color-mix(in srgb, #fff 90%, transparent);
            padding: 2px 5px; border-radius: 3px;
            border: 1px solid color-mix(in srgb, #fff 32%, transparent);
            text-transform: uppercase; white-space: nowrap;
        }
        .db-icon { display: flex; flex-shrink: 0; color: color-mix(in srgb, #fff 82%, transparent); }
        .db-icon svg { width: var(--bk-icon); height: var(--bk-icon); display: block; }

        /* 第二行：题 + 发丝分隔线 + 副题。压印味大半来自那两条发丝线
           ⚠️ 这一族是 `<span>` 不是 `<div>`（书是原生 `<button>`，里面只许放 phrasing content）
              ⇒ **必须补 display**：inline 的 span 上 margin / text-align / ellipsis 全都不生效，
                 而"没生效"在这里的表现是"看着差不多、其实那一行既没居中也没截断"。
              `.db-title` 的 `-webkit-box` 本身就是块级，不用补。 */
        .db-mid { display: block; margin-bottom: auto; }
        .db-title {
            font-size: var(--bk-title); font-weight: 700; line-height: 1.32; letter-spacing: 0.02em;
            margin-bottom: 6px;
            text-shadow: 0 1px 2px rgba(0,0,0,0.45);
            display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
        }
        .db-rule { display: flex; align-items: center; gap: 4px; margin-bottom: 5px; }
        .db-rule::before, .db-rule::after {
            content: ""; flex: 1; height: 1px;
            background: color-mix(in srgb, #fff 32%, transparent);
        }
        .db-rule span {
            width: 3px; height: 3px; flex-shrink: 0;
            background: color-mix(in srgb, #fff 50%, transparent);
            transform: rotate(45deg);
        }
        .db-sub {
            display: block;
            font-size: var(--bk-sub); letter-spacing: 0.14em;
            color: color-mix(in srgb, #fff 62%, transparent);
            text-align: center;
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        /* 第三行：页脚（发丝线 + 一格读数：更新时间） */
        .db-foot {
            display: flex; align-items: center; justify-content: space-between; gap: 6px;
            margin-top: 6px; padding-top: 6px;
            border-top: 1px solid color-mix(in srgb, #fff 16%, transparent);
            font-size: var(--bk-foot);
            color: color-mix(in srgb, #fff 76%, transparent);
        }
        .db-foot span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* ============================================================
           文件位置：**路线图**（线路 + 站点）
           —— 判据（2026-09-29）：这段数据里只有**层级**关系（谁在谁下面），
              没有方位、远近、相邻这类信息 ⇒ 该画的是**拓扑图**，不是地形图。
              所以走地铁图那一套：**同源干线合并**、每一段是一个站点、末站是这条线的终点。
              ⚠️ 画成"地图"（把路径摆成区域、让它们彼此相邻）就必须**编造方位关系** ——
                 正是"没有的数字一处都不许出现"的同一条反过来用。
           ⚠️ 合并只发生在**真实同源处**（前 N 段完全相同才共用干线），
              不是"为了摆整齐把相近的凑一起"。
           ⚠️ 行高写死 26px：线路的 y 坐标必须是整数（用 `50%` 会落在半像素上，1px 的线会发虚）。
           ── 2026-09-29 追加两件：**分叉站可收起** + **每行可复制路径 / 名称** ──
           ① 可收起：一个站点有孩子 ⇒ 它下面那一段能整段藏起来。**默认全展开**
              （收起是读者的动作，不是默认视图 —— 默认收起等于把这一页的答案先藏一半）。
              收起后那一行要补一个"还藏着几条"，否则"收起来"就等于"信息丢了"。
           ② 每行两枚复制动作（路径 / 名称）：**常驻可见**。为什么不做 hover 才显形，
              判据与取舍写在 `.route-act` 那一段上。
           ⚠️ 这一层**不套 `role="tree"`**：那套 ARIA 要配上下键 / Home / End / 单 Tab 停靠的
              完整键盘模型，只做"一层展开"时，真按钮 + `aria-expanded` 更省事、也更不容易说错。
           ============================================================ */
        .route { --route-line: var(--border-strong); }
        .route-list { list-style: none; }
        .route-item { position: relative; padding-left: 20px; }
        /* 竖干线：每个兄弟各项自己画一小段、首尾相接成一条（比给父层 border-left 更好控
           "末项之后不再往外冒头"）。 */
        .route-item::before {
            content: ""; position: absolute; left: 5px; top: 0; bottom: 0; width: 1px;
            background: var(--route-line);
        }
        .route-item:last-child::before { bottom: auto; height: 13px; }   /* 干线只连到本站 */
        .route-node {
            position: relative; display: flex; align-items: center;
            min-height: 26px; min-width: 0; border-radius: 7px;
            /* 右边留 10px、再用负边距抵消：hover 底色贴到段的内容边，不越出去 */
            padding-right: 10px; margin-right: -10px;
        }
        .route-node:hover { background: var(--bg-hover); }
        /* ── 主按钮 = **整行**（只除了右边那两枚复制动作）：站点 / 名字 / 用途 / 读数全在它里面。
           ⚠️ 做成真 `<button>` 而不是给 `div` 挂 `role="button"`：它右边就是两枚**真按钮**，
              "角色按钮里套按钮"是非法结构（读屏与校验都会罚）。
              这样"点行 = 这一行的事"仍然成立，而键盘 / 读屏拿到的是一个朴素的按钮；
              又因为两枚复制按钮在主按钮**外面**，点击只冒泡到 `.route-node`（那里没有监听）
              ⇒ 省掉了两处 `stopPropagation`。 */
        .route-main {
            display: flex; align-items: center; gap: 10px;
            flex: 1 1 auto; min-width: 0;
            padding: 0 0 0 15px;                 /* 左边 15px = 收起箭头的槽位（见 .route-fold） */
            border: 0; border-radius: 7px; background: none;
            font: inherit; color: inherit; text-align: left; cursor: pointer;
        }
        .route-main:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
        /* 收起箭头：占**固定槽位**（行内左起 15px）—— 分叉站有、终点站没有，
           而两边的名字必须对齐（同一层里 `.app` 与 `.uc/web/dist` 就是混着的）。
           ⚠️ 槽位由 `.route-main` 的 `padding-left` 给，不是"再放一个空 span 占位" ——
              后者会在标记里多出一批什么都没拿的元素，而"占列 + 隐藏"是这一路的老坑。 */
        .route-fold {
            position: absolute; left: 0; top: 3px; width: 15px; height: 20px;
            display: flex; align-items: center; justify-content: center;
            color: var(--text-muted);
            transition: transform 0.18s ease;
        }
        .route-item.is-collapsed > .route-node .route-fold { transform: rotate(-90deg); }
        .route-main:hover .route-fold { color: var(--text-primary); }
        /* 横支线：从干线（x=5）伸到行内左缘（x=20 —— 收起箭头的槽位就落在这儿）。 */
        .route-node::before {
            content: ""; position: absolute; left: -15px; top: 13px; width: 15px; height: 1px;
            background: var(--route-line);
        }
        /* 站点：骑在横支线上（圆心 x ≈ 11）。空心 = **分叉站**（单链压缩之后，
           中间站就只剩分叉点了 —— 没有"纯路过"的站，"空心"因此正好等于"这里还分得开"） */
        .route-stop {
            position: absolute; left: -13px; top: 9px;
            width: 8px; height: 8px; border-radius: 50%;
            background: var(--bg-card);
            box-shadow: inset 0 0 0 1.5px var(--route-line);
        }
        .route-name {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12.5px; color: var(--text-secondary);
            /* ⚠️ `min-width: 0` + 省略号：flex 项默认 `min-width: auto` ⇒ 长名字**不收缩**，
               把整行撑出段外（表现是右侧被切掉一截，而不是显示省略号）。 */
            white-space: nowrap; min-width: 0; overflow: hidden; text-overflow: ellipsis;
        }
        /* 终点站：实心 + 一档更重 —— "这条线到这里就是那个文件 / 目录"。
           外圈那 3px 的底色环是**让站点从线上断开**（同一招也用在文件抽屉的入口上）。 */
        .route-item.is-leaf > .route-node .route-stop {
            left: -14px; top: 8px; width: 10px; height: 10px;
            background: var(--text-secondary); box-shadow: 0 0 0 3px var(--bg-card);
        }
        .route-item.is-leaf > .route-node .route-name { font-weight: 700; color: var(--text-primary); }
        /* 终点站悬停：站点换成强调色（"这一条就是它"）。
           ⚠️ 只有终点这么画 —— 分叉站悬停时变的是**箭头**（可收起），
              站点跟着变色会把"当前站 / 选中"这层意思混进来。 */
        .route-item.is-leaf > .route-node:hover .route-stop { background: var(--m-main); }
        /* 终点右侧：这条位置的用途 / 版本 / 归属项目 —— 一路上"路过站不带信息，终点才带" */
        /* 用途：**紧跟站点名**（读序"我在哪 → 它是什么 → 它的状态"）。
           ⚠️ 它原先是和版本/项目一起被推到右端的 —— 那样一行两头离得远，眼睛要来回扫。 */
        .route-use {
            min-width: 0; margin-left: 2px;
            font-size: 12.5px; font-weight: 600; color: var(--text-primary);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        /* 右侧收口：版本 + 项目（回答"新不新、是谁的"，与名字的关系次要一层） */
        .route-meta {
            margin-left: auto; display: flex; align-items: center; gap: 10px;
            min-width: 0; padding-left: 12px; overflow: hidden;
        }
        /* ⚠️ flex 项默认 `min-width: auto` ⇒ **不会收缩**，长名字/长用途会把这行撑出段外
           （表现是右侧被切掉一截，而不是显示省略号）。这三处都要显式允许收缩。 */
        .route-note {
            min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
            font-size: 11px; color: var(--text-muted);
            font-variant-numeric: tabular-nums;
        }
        .route-proj {
            flex-shrink: 0; padding: 2px 8px; border-radius: 999px;
            font-size: 10.5px; font-weight: 600;
            background: var(--bg-subtle); color: var(--text-secondary); white-space: nowrap;
        }
        /* 收起之后那一行剩下的**唯一一个数**：这一站下面还藏了几条位置。
           ⚠️ 展开时**不显示** —— 那些条就在下面，再写一遍是把同一件事说两遍。
           ⚠️ 这个数只数叶子（中间站是"路过"的，不是"登记的位置"），现算，不另存一份。 */
        .route-cnt {
            display: none; font-size: 11px; color: var(--text-muted);
            font-variant-numeric: tabular-nums;
        }
        .route-item.is-collapsed > .route-node .route-cnt { display: inline; }
        /* 收起 = 整段子树不显示。⚠️ 只切一个类、**不重建标记**：
           重建会顺手丢掉别处的收起状态、焦点与滚动位置（同"多视角全留 DOM"那条）。 */
        .route-item.is-collapsed > .route-list { display: none; }
        /* ── 两枚复制动作（路径 / 名称）──
           ⚠️ **常驻可见，不藏进 hover**：这一段的高频动作就是"把这条路径拿走"，
              把它和第二枚（名称）一起藏进 hover，正好踩在"唯一的高频动作不能和低频动作
              一起藏在 hover 里"那条判据上。代价是每行右边常驻 ~115px，
              换来的是"不用先悬停才知道这里有动作"（触屏还有 `hover` 这件事都没有）。
           标签只写"路径 / 名称"两个词：完整值与整句话在 `title` / `aria-label` 上 ——
           13 行都写"复制完整路径"会把线路图淹掉。 */
        .route-act {
            display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
            margin-left: 8px; padding: 3px 7px;
            border: 0; border-radius: 6px; cursor: pointer; white-space: nowrap;
            background: none; color: var(--text-muted);
            font-family: inherit; font-size: 10.5px; font-weight: 600;
            transition: color 0.14s ease;
        }
        /* ⚠️ 悬停**只改字色，不给底色**：这两个按钮压在两种面上（未悬停的行 = `--bg-card`，
           悬停的行 = `--bg-hover`）—— 给一个固定底色，必然在其中一个面上"和背景撞成一样"，
           在另一个面上变成"比背景还浅的洞"。字色从 `--text-muted` 提到 `--text-primary`
           在两种面上都成立，也够明显。 */
        .route-act:hover { color: var(--text-primary); }
        .route-act:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -1px; }
        /* 根：一条线从哪儿起（一屏里只有一个） */
        .route-root { display: flex; align-items: center; gap: 8px; padding-left: 5px; margin-bottom: 2px; }
        .route-root-name { font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12.5px; font-weight: 700; color: var(--text-primary); }

        /* ── 项目抽屉里的文件位置清单：这里只有**性质**一级
           （项目级已经由抽屉本身说了 —— 抽屉是从某一行的"拉开"进来的，重复一遍项目名是废话）── */
        .fp-row {
            display: flex; align-items: center; gap: 10px;
            padding: 9px 10px; border-radius: 8px;
            cursor: pointer; transition: background 0.15s ease;
            min-width: 0;
        }
        .fp-row:hover { background: var(--bg-hover); }
        .fp-row:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: -2px; }
        .fp-ico { display: flex; flex-shrink: 0; color: var(--text-muted); }
        .fp-use { flex-shrink: 0; font-size: 12.5px; font-weight: 600; color: var(--text-primary); }
        .fp-path {
            flex: 1; min-width: 0;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12px; color: var(--text-secondary);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .fp-note {
            flex-shrink: 0; font-size: 11px; color: var(--text-muted);
            font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        /* 项目内的次要分组：一条发丝线 + 缩进，不再套一张卡（卡里不套卡）。
           首个分组不要上边距 —— 抽镜头那 14px 会变成"抽屉顶部空了一截"。 */
        .fp-sub { margin-top: 10px; }
        .fp-sub:first-child { margin-top: 0; }
        .fp-sub-head {
            display: flex; align-items: center; gap: 8px;
            padding: 6px 10px 4px;
            font-size: 10.5px; font-weight: 700; letter-spacing: 0.04em; color: var(--text-muted);
        }
        .fp-sub-head .n { font-weight: 600; }
        .fp-sub .fp-row { padding-left: 10px; }

        /* ============================================================
           项目抽屉：从「服务项目」那一行拉开
           —— 形态与 `.fd-*`（文件抽屉）**刻意同族**：都是"从右边抽出来的一份"，
              两处只差三件事：宽度更窄、内容不同、z-index 更低。
           ⚠️ z-index 必须**低于**文件抽屉（205 < 210）：抽屉里的清单点一行会再开文件抽屉，
              两个面板同时开着时后开的那个压在上面才符合"一层层拉开"的直觉；
              反过来的话文件抽屉会被挡掉半个身子。ESC 逐层退出。
           ============================================================ */
        .pd-mask { position: fixed; inset: 0; z-index: 205; background: var(--scrim); display: none; }
        .pd-mask.open { display: block; animation: fadeIn 0.2s ease; }
        .pd-panel {
            position: absolute; top: 0; right: 0; bottom: 0;
            width: min(480px, 100%);
            display: flex; flex-direction: column;
            background: var(--bg-card-solid);
            box-shadow: -2px 0 8px rgba(15,23,42,0.06), -18px 0 48px rgba(15,23,42,0.18);
            animation: fdIn 0.26s cubic-bezier(0.32, 0.72, 0, 1);   /* 与文件抽屉同一条入场曲线 */
        }
        .pd-head {
            display: flex; align-items: center; gap: 12px; flex-shrink: 0;
            padding: 16px 18px; border-bottom: 1px solid var(--border-subtle);
        }
        .pd-ico { display: flex; flex-shrink: 0; color: var(--text-muted); }
        .pd-titles { min-width: 0; flex: 1 1 auto; }
        .pd-title { font-size: 13.5px; font-weight: 800; }
        .pd-sub {
            margin-top: 3px; font-size: 11.5px; color: var(--text-secondary);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .pd-body { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 14px 18px 18px; }
        /* 空态：这一行说的"0 条"到底是什么意思（不是"加载失败"，是"本来就没登记"） */
        .fp-empty { padding: 14px 2px; font-size: 12px; color: var(--text-muted); }
        .pd-hint { font-size: 11.5px; color: var(--text-muted); }
        .pd-foot {
            display: flex; align-items: center; gap: 10px; flex-shrink: 0;
            padding: 12px 18px; border-top: 1px solid var(--border-subtle);
        }
        .pd-foot .btn { margin-left: auto; }

        /* 文件抽屉头那枚图标容器（源页叫 `.path-ico`，那一条随列表页的路径行一起删了；
           内容由 openFile() 用 innerHTML 灌进 #fdIco ⇒ 这里只需要一个 color 落点） */
        .path-ico { display: flex; color: var(--text-muted); }

        /* 外链小箭头（日志 / 部署 是开新窗口的动作）：比按钮文字再小一档、次要色 */
        .sv-ext { display: flex; margin-left: -2px; color: var(--text-muted); }

        /* 复制 IP：与端口 / 地址同族的一条动作（值本身在上面的字段里 —— 这里只给复制） */
        .sec-acts { display: flex; align-items: center; gap: 10px; margin-top: 14px; padding-top: 12px;
            border-top: 1px solid var(--border-subtle); }
        .sec-acts .btn { margin-left: auto; }

        @media (max-width: 768px) {
            .fld-grid { grid-template-columns: 1fr; }
            /* 窄屏先让掉两处"读一次就够"的次要读数：终点站的版本 / 时间、抽屉里那列路径。
               路线图的行不换行（换行会破坏"一站一行"的读法）⇒ 让的是信息不是结构。 */
            .route-note { display: none; }
            .fp-note { display: none; }
            /* 再让掉复制按钮上的那两个字：图标还在 ⇒ 动作还在，只是不再写字
               （窄屏一整行本来就紧，两枚"图标 + 两字"要占掉 ~100px） */
            .route-act { padding: 3px 5px; }
            .route-act .act-t { display: none; }
        }
"""

HTML_PART = r"""        <!-- ============================================================
             主内容：一台机器的详情
             ① 导航壳在主内容之外（顶栏 + 侧栏），这一块只放"这台机器"的四段：
                ② Hero（实体头）→ ③ 概览 / 项目 / 文档 / 文件位置（同页并列）
                ⚠️ 四段各用**一种物**：项目 = 抽屉（拉开看它在这台机器上放了什么）、
                   文档 = 书（有限、可数、有封面）、文件位置 = 路线图（线路 + 站点，
                   只有层级关系 ⇒ 画拓扑不画地图）、概览 = 字段读数（没有形状）。
                   判据都是同一句：**这一段的数据是什么形状，它就长成什么样子**。
             ⚠️ 本页**没有 sticky 菜单栏**（兄弟页都有那一条），这是有意的偏离：
                那一条在各分区页里装的是"**兄弟分区页**"（总览 / 任务 / Bug / 运维 …），
                而这一页没有兄弟页 —— 它的分区就在下面这四段里，而这四段**已经由左上的圆盘
                导航**（可点 + 滚动同步）。再架一条一模一样的菜单栏 = 同一份导航做两遍。
             ⚠️ 四个区块的内容全部由页尾脚本里的模板函数产出；静态那一份由
                `._seed-server-detail.cjs` 用**同一批函数**跑一遍灌进来（不手抄第二份）。
             ============================================================ -->
        <main class="main" id="main">
            <div class="detail">

                <!-- ========== ② Hero：这台机器的实体头 ==========
                     形态照同模块的详情页（`.hero-card`）；内容 = 身份 + 状态 + 动作。
                     ⚠️ 与项目详情页的两处不同，都是判据推出来的：
                        · **不折叠**：右半是这台机器的全部动作，折起来 = 高频动作被藏；
                        · 左端多一条 **返回**：这一页是从列表点进来的（`?host=`），有来路。 -->
                <div class="hero-card" id="heroCard">
                    <div class="hero-bar">
                        <div class="hero-bar-left">
                            <a class="hero-back" href="工作-服务器-index.html"><span aria-hidden="true" data-ico="chevL" data-ico-size="13"></span>服务器</a>
                            <h1 class="hero-name" id="heroName">—</h1>
                            <span class="hero-role" id="heroRole" title="" data-ico="server" data-ico-size="15"></span>
                            <span class="hero-tag" id="heroTag">—</span>
                            <span class="sv-projs" id="heroProjs"></span>
                        </div>
                        <div class="hero-bar-right" id="heroActs"></div>
                    </div>
                </div>

                <!-- ========== ③ 概览：这台机器是什么、怎么连上去 ========== -->
                <section class="sec" id="secWhat" data-section="what">
                    <div class="sec-head">
                        <span class="sec-ico" aria-hidden="true" data-ico="info" data-ico-size="15"></span>
                        <span class="sec-name">概览</span>
                        <span class="sec-count" id="cntWhat">—</span>
                        <span class="sec-note">只放「没连上时也存在」的值</span>
                    </div>
                    <div id="whatBody"></div>
                </section>

                <!-- ========== ③ 服务项目：这台机器被谁共用 ==========
                     ⚠️ 项目 ↔ 机器 是**多对多**（一台机器能服务多个项目）：这一节就是它的收口 ——
                        列表页卡脚那排胶囊说"服务哪些项目"，这里一张卡一个项目、**整卡可点、拉开是抽屉**。
                         ⚠️ 卡片形状照用户给的参考图（有底色的卡 + 缩略窗 + 名字 + 右上角一个动作 +
                        一行读数）；参考里那三个字段（收藏星 / 进度 / 截止）本页都没有，
                        已换成真值 —— 见 CSS 段首那一段说明。
                     ⚠️ 抽屉里只放**该项目的文件位置**：它是这张卡的"全量"，
                        与行上那句"N 条"形成"摘要 → 全量"。端口 / 日志 / 发布记录都不进抽屉 ——
                        那些各自另有归属（分区的计数值在运维页，端口在概览段）。 -->
                <section class="sec" id="secProjects" data-section="projects">
                    <div class="sec-head">
                        <span class="sec-ico" aria-hidden="true" data-ico="project" data-ico-size="15"></span>
                        <span class="sec-name">服务项目</span>
                        <span class="sec-count" id="cntProjects">—</span>
                        <span class="sec-note">点一张卡拉开看它放了什么</span>
                    </div>
                    <div class="pc-grid" id="pjBody"></div>
                </section>

                <!-- ========== ③ 文档：这台机器服务的项目各自的部署文档 ==========
                     ⚠️ 归属是**项目**，不是"这台机器" —— 部署文档长在项目里（运维页那 3 篇），
                        本页只说"它服务的那几个项目、各自有几本、都是什么"，所以按项目分排书架。
                     ⚠️ 真值在运维页 / 文档主页：本页**不给**下载 / 新建 / 移动（搬到这儿就是
                        第二套管理入口）⇒ 这里的书只有"点开读"一个动作。 -->
                <section class="sec" id="secDocs" data-section="docs">
                    <div class="sec-head">
                        <span class="sec-ico" aria-hidden="true" data-ico="book" data-ico-size="15"></span>
                        <span class="sec-name">文档</span>
                        <span class="sec-count" id="cntDocs">—</span>
                        <span class="sec-note">它服务的项目各自的部署文档</span>
                    </div>
                    <div id="dcBody"></div>
                </section>

                <!-- ========== ③ 文件位置：这台机器上登记的文件都在哪 ==========
                     形态是**路线图**（线路 + 站点）：这段数据里只有层级关系（谁在谁下面），
                     所以画拓扑、不画地图 —— 判据在 CSS 段首。
                     ⚠️ 两种站、两种主动作：**终点站**点开文件抽屉看它写了什么；
                        **分叉站**点一下把它下面那一段收起来（`aria-expanded` 跟着换）。
                        两件都是"点这一行"，所以整行就是按钮（`.route-main`）。
                     ⚠️ 行尾那两枚复制（路径 / 名称）在主按钮**外面** —— 否则就是按钮套按钮。 -->
                <section class="sec" id="secFiles" data-section="files">
                    <div class="sec-head">
                        <span class="sec-ico" aria-hidden="true" data-ico="folder" data-ico-size="15"></span>
                        <span class="sec-name">文件位置</span>
                        <span class="sec-count" id="cntFiles">—</span>
                        <span class="sec-note">分叉站可收起，每行可复制路径</span>
                    </div>
                    <div id="fpBody"></div>
                </section>

            </div>
        </main>
"""

JS_PART = r"""
    /* ============================================================================
       本页 = **一台机器的详情**
       —— 默认那台（`SERVERS[0]`：服务两个项目、九条文件位置，用料最足）是**静态标记**，
          因为预览面板走静态 HTML 视图、脚本不跑；带 `?host=` 时由脚本把整页重绘成那一台。
          两处都出自下面这几个模板函数（`._seed-server-detail.js` 跑的就是它们），不会走岔。
       ============================================================================ */
    const WANTED_HOST = new URLSearchParams(location.search).get('host');
    const MACHINE = (WANTED_HOST && byHost(WANTED_HOST)) || SERVERS[0];
    const LIST_PAGE = '工作-服务器-index.html';
    const LOG_PAGE = '工作-项目-项目详情-运维-日志-index.html';
    const DEPLOY_PAGE = '工作-项目-项目详情-运维-部署-index.html';

    /* 登录与提权：与运维页「添加服务器」那张表存的同一组字段，词表也照它的（`su -` / `sudo`）。
       ⚠️ 判据「这个值，没连上的时候存在吗？」—— 它们是**配置**，不用连就知道 ⇒ 可以进字段区；
          负载 / 版本 / 运行时长要连上才读得到 ⇒ 永不进字段区。 */
    const AUTH_TXT = { key: '密钥文件', pwd: '密码' };
    const escTxt = s => (s.esc === 'none' ? '不需要（登录用户是 root）'
        : (s.esc === 'su' ? 'su - root' : 'sudo -u root -n'));

    const pathsOfProject = (s, name) => s.paths.filter(p => p.project === name);

    /* 项目的部署文档 —— **真值在项目的运维页**（那边"部署文档 3 篇"就是这几本）。
       本页只说"这台机器服务的那几个项目、各自有几本、都是什么"，不搬正文、不给管理动作。
       ⚠️ 归属是**项目**不是机器：文档长在项目里，一台机器服务多个项目 ⇒ 书要按项目分排。
       ⚠️ 真接数据时这里 = 运维页文档区按项目过滤后的列表（类型 / 标题 / 版本 / 更新时间），
          别在台账页另存一份正文 —— 那会变成第二份事实源（改了一边、另一边还说旧话）。
       ⚠️ 「支付系统重构」那三本与运维页**逐字一致**（生产环境部署手册 v2.3 / 回滚流程 v1.2 /
          deploy.sh v1.4）—— 两页说的是同一批文档，标题对不上就是两套说法。 */
    const PROJECT_DOCS = {
        '支付系统重构': [
            { kind: '手册', title: '生产环境部署手册', ver: 'v2.3', when: '昨天',  ico: 'book' },
            { kind: '流程', title: '回滚流程',         ver: 'v1.2', when: '3 天前', ico: 'book' },
            { kind: '脚本', title: 'deploy.sh',        ver: 'v1.4', when: '5 天前', ico: 'rocket', cls: 'script' }
        ],
        '用户中心改版': [
            { kind: '手册', title: '上线检查清单', ver: 'v1.1', when: '上周', ico: 'book' },
            { kind: '流程', title: '灰度与回滚',   ver: 'v0.9', when: '上周', ico: 'book' }
        ],
        '数据看板': [
            { kind: '手册', title: '看板服务部署说明', ver: 'v3.5', when: '2 周前', ico: 'book' }
        ]
    };
    /* 项目的**身份色** —— 只在这一段的卡片上使用（不是全页令牌：它表达"这是哪个项目"，
       不是页面层级；所以长在卡片自己的 `--pc` 上，不往 `:root` 加东西）。
       ⚠️ 三支都取**冷色**（靛 245° / 紫 285° / 青 192°）：红 / 绿 / 琥珀已经被语义色占了
          （`--danger-*` / `--ok-*` / `--warn-*`），项目色落进那三支会被读成"这个项目出问题了"。
       ⚠️ 色相要拉得开：三个都在蓝紫区间时要保证"遮住名字也认得出是哪张卡"。
       ⚠️ 没有配色的项目走 `.pc-card` 上的中性兜底（真接了数据之后新冒出来的项目不该整块透明）。 */
    const PROJECT_COLOR = {
        '支付系统重构': '#4F46E5',
        '用户中心改版': '#9333EA',
        '数据看板':     '#0891B2'
    };

    /* 机器上会看到的文档 = 它服务的那些项目的文档（**按 `projects` 现算**）。
       ⚠️ 不另存"本机文档"清单：文档的归属是项目、机器只是"路过"——
          写死一份就必然在某台机器改了服务项目之后说错话。 */
    const docsOfMachine = s => s.projects.reduce((a, p) => a.concat(PROJECT_DOCS[p] || []), []);

    /* ============================================================
       模板（纯产出、不查 DOM）
       ============================================================ */
    function projChipsHtml(s) {
        return s.projects.map(p => '<span class="sv-proj">' + p + '</span>').join('');
    }

    /* 抽屉里的行与路线图的终点站都是 `role="button"` / `<button>`：整页那条键盘委托
       （`[role="button"]` 的 Enter / Space ⇒ click）会把它们一起接上，不必各写一条。 */

    /* Hero 右侧 = **这台机器的全部动作**，一件不藏（判据：高频动作不许藏在展开里）。
       三件事三种形态，别一律做成按钮：
         · 终端 / 日志 / 部署 = **开独立窗口** ⇒ `<a href>`（被拦时退回本页打开），
           窗口名带机器名（一台一个会话，web 与 db 可并存）；
         · 编辑 = 去整页表单（带 `?host=`，那张表据此预填）；
         · 移除 = 本页确认弹窗（破坏性动作，留在最后）。 */
    function heroActsHtml(s) {
        return connHtml(s.host)
            + '<span class="hero-sep" aria-hidden="true"></span>'
            + '<a class="btn btn-ghost btn-sm" href="终端.html" title="打开终端窗口（一台机器一个会话）"'
            + ' onclick="return openTerminalWindow(this, \'' + qs(s.host) + '\')">'
            + '<span aria-hidden="true" data-ico="window" data-ico-size="14"></span>终端</a>'
            + '<a class="btn btn-ghost btn-sm" href="' + LOG_PAGE + '?host=' + encodeURIComponent(s.host) + '"'
            + ' title="在新窗口打开这台机器的日志" onclick="return openLogWindow(this)">'
            + '<span aria-hidden="true" data-ico="file" data-ico-size="14"></span>日志'
            + '<span class="sv-ext" aria-hidden="true" data-ico="external" data-ico-size="11"></span></a>'
            + '<a class="btn btn-ghost btn-sm" href="' + DEPLOY_PAGE + '"'
            + ' title="在新窗口打开部署面板" onclick="return openDeployWindow(this, \'' + qs(s.host) + '\')">'
            + '<span aria-hidden="true" data-ico="rocket" data-ico-size="14"></span>部署'
            + '<span class="sv-ext" aria-hidden="true" data-ico="external" data-ico-size="11"></span></a>'
            + '<span class="hero-sep" aria-hidden="true"></span>'
            + '<button class="btn btn-ghost btn-sm" type="button" onclick="editServer(\'' + qs(s.host) + '\')">'
            + '<span aria-hidden="true" data-ico="edit" data-ico-size="14"></span>编辑</button>'
            + '<button class="btn btn-ghost btn-sm" type="button" onclick="askRemoveServer(\'' + qs(s.host) + '\')">'
            + '<span aria-hidden="true" data-ico="trash" data-ico-size="14"></span>移除</button>';
    }

    /* 概览：字段（2 列）+ 端口（宽字段）+ 复制 IP。
       ⚠️ 「角色」「环境」的文字在这里 —— hero 上它们只是**形状**（一枚图标 / 一个标签），
          文字得有第二个家（判据：文字不许只留在 hover 里）。 */
    function whatBodyHtml(s) {
        const fld = (k, v, mono, wide) =>
            '<div class="fld' + (wide ? ' is-wide' : '') + '"><span class="k">' + k + '</span>'
            + '<span class="v' + (mono ? ' is-mono' : '') + '">' + v + '</span></div>';
        const ports = '<span class="chips">' + s.ports.map(p =>
            '<span class="pchip">' + p[0] + '<span class="svc">' + p[1] + '</span></span>').join('') + '</span>';
        return '<div class="fld-grid">'
            + fld('IP 地址', s.ip, true)
            + fld('操作系统', s.os)
            + fld('角色', roleLabelOf(s))
            + fld('环境', s.env)
            + fld('登录用户', s.user + ' · ' + (AUTH_TXT[s.auth] || s.auth))
            + fld('提权方式', escTxt(s))
            /* 端口数量不定 ⇒ 跨满整行 + 胶囊换行（塞进固定列网格必被撑爆） */
            + fld('应用端口', ports, false, true)
            + '</div>'
            + '<div class="sec-acts">'
            + '<button class="btn btn-ghost btn-sm" type="button" onclick="copyText(\'' + qs(s.ip) + '\')">'
            + '<span aria-hidden="true" data-ico="copy" data-ico-size="14"></span>复制 IP</button>'
            + '</div>';
    }

    /* 项目：一台机器被谁共用（项目 ↔ 机器 是多对多）。
       「本机文件位置 N 条」从**每条文件位置自己的 `project`** 现算 —— 不另存一份计数。
       ⚠️ 一张卡 = **抽屉把手**（`div[role=button]`，不是 `<button>` —— 卡里还有一个 `<a>`
          去运维页，而按钮里嵌链接是非法结构）。拉开的 = 该项目的文件位置。
       ⚠️ 卡上**不写项目描述** —— 那句话（`PROJECT_META[].desc`）的第二个家在抽屉头上（`pdSub`）：
          卡是"一览"，描述属于"拉开了细看"。卡上也**不放项目图标** —— 底色已经在说"这是哪个项目"，
          再加一枚图标就是同一件事两处表达（图标在文档段组头 / 侧栏圆盘上还有，不丢）。 */
    function projectCardsHtml(s) {
        return s.projects.map(function (p) {
            const meta = PROJECT_META[p] || { icon: 'project', desc: '', ops: '' };
            const n = pathsOfProject(s, p).length;
            /* ⚠️ 逐行缩进，不压成一行：这三段的标记是**给人读、给 diff 的**
               （一段两三千字符落成一行，改一台机器就是"整行都变了"）。 */
            return '                    <div class="pc-card" role="button" tabindex="0" data-project="' + p + '"\n'
                + '                         style="--pc: ' + (PROJECT_COLOR[p] || 'var(--text-muted)') + '"\n'
                + '                         aria-controls="pdBody" title="拉开看它在这台机器上放了什么"\n'
                + '                         onclick="openProjectDrawer(\'' + qs(p) + '\')">\n'
                + '                        <div class="pc-thumb" aria-hidden="true">\n'
                + '                            <span class="pc-bar"></span>\n'
                + '                            <span class="pc-dots"><span></span><span></span><span></span></span>\n'
                + '                        </div>\n'
                + '                        <div class="pc-head">\n'
                + '                            <span class="pc-name">' + p + '</span>\n'
                + (meta.ops
                    ? '                            <a class="pc-go" href="' + meta.ops + '"\n'
                      + '                               title="去这个项目的运维页"\n'
                      + '                               onclick="event.stopPropagation()"><span aria-hidden="true" data-ico="external" data-ico-size="15"></span></a>\n'
                    : '')
                + '                        </div>\n'
                + '                        <div class="pc-meta"><span class="pc-dot"></span>文件位置 <b>' + n + '</b> 条</div>\n'
                + '                    </div>';
        }).join('\n');      /* ⚠️ 卡片是多行的（上面每条都是）⇒ 卡与卡之间必须换行：
                                   从"一行一条"改过来时最容易漏这一处，表现是
                                   "上一张的 </div> 和下一张的 <div 挤在同一行" */
    }

    /* ============================================================
       文档：**书**（精装封面）
       —— 一台机器上会看到的是"它服务的那些项目各自的部署文档"，按项目分排书架。
          ⚠️ 书自己**不写项目名**（组头说过的事不再重复），也不写"本机"这种归属词 ——
             它属于那个项目，只是恰好在这台机器上看得到。
          ⚠️ 用原生 `<button>` 而不是参考页的 `div[role=button]`：参考页里书右上角嵌了两个
             按钮（下载 / 更多）所以不能是 button；本页没搬那两个动作（管理只有一处家），
             那就该用最正确的那一个元素 —— 原生键盘行为不用自己接。
       ============================================================ */
    function docBookHtml(d) {
        return '                            <button class="doc-book' + (d.cls ? ' ' + d.cls : '') + '" type="button"\n'
            + '                                    title="打开文档：' + d.title + '"\n'
            + '                                    onclick="toast(\'打开文档：' + d.title + '\',\'info\')">\n'
            + '                                <span class="db-top">\n'
            + '                                    <span class="db-tag">' + d.kind + '</span>\n'
            + '                                    <span class="db-icon" aria-hidden="true" data-ico="' + d.ico + '" data-ico-size="14"></span>\n'
            + '                                </span>\n'
            + '                                <span class="db-mid">\n'
            + '                                    <span class="db-title">' + d.title + '</span>\n'
            + '                                    <span class="db-rule"><span></span></span>\n'
            + '                                    <span class="db-sub">' + d.ver + '</span>\n'
            + '                                </span>\n'
            + '                                <span class="db-foot"><span>' + d.when + '</span></span>\n'
            + '                            </button>';
    }
    function docShelvesHtml(s) {
        const html = s.projects.map(function (p) {
            const list = PROJECT_DOCS[p] || [];
            if (!list.length) return '';
            const meta = PROJECT_META[p] || { icon: 'project' };
            return '                    <div class="dc-shelf">\n'
                + '                        <div class="dc-shead">\n'
                + '                            <span aria-hidden="true" data-ico="' + meta.icon + '" data-ico-size="13"></span>\n'
                + '                            ' + p + '<span class="n">' + list.length + ' 篇</span>\n'
                + '                        </div>\n'
                + '                        <div class="doc-books">\n'
                + list.map(docBookHtml).join('\n') + '\n'
                + '                        </div>\n'
                + '                    </div>';
        }).join('\n');
        return html || '<div class="fp-empty">它服务的项目都还没有部署文档</div>';
    }

    /* 抽屉里的内容 = **这个项目在这台机器上的文件位置**，按性质分。
       ⚠️ 项目那一级不重复：抽屉本身就是从某个项目的行上拉开的。
       ⚠️ 行仍然可点（再开文件抽屉）—— 两层抽屉是**两件不同的事**：
          外层回答"这个项目在这台机器上放了什么"，内层回答"这个文件写了什么"。 */
    function fpRowHtml(p) {
        const kind = fileKind(p.path);
        const ico = kind === 'dir' ? 'folder' : (kind === 'binary' ? 'rocket' : 'file');
        return '<div class="fp-row" role="button" tabindex="0" data-path="' + p.path + '"'
            + ' title="' + p.path + '"'
            + ' onclick="openFile(\'' + qs(p.path) + '\',\'' + qs(p.use) + '\')">'
            + '<span class="fp-ico" aria-hidden="true" data-ico="' + ico + '" data-ico-size="14"></span>'
            + '<span class="fp-use">' + p.use + '</span>'
            + '<span class="fp-path">' + p.path + '</span>'
            + '<span class="fp-note">' + p.note + '</span>'
            + '</div>';
    }
    function pdBodyHtml(s, project) {
        const mine = pathsOfProject(s, project);
        if (!mine.length) return '<div class="fp-empty">这台机器上还没有登记属于它的文件位置</div>';
        const groups = s.groups.filter(g => mine.some(x => x.group === g));
        return groups.map(function (g) {
            const rows = mine.filter(x => x.group === g);
            return '<div class="fp-sub">'
                + '<div class="fp-sub-head">' + g + '<span class="n">' + rows.length + ' 条</span></div>'
                + rows.map(fpRowHtml).join('')
                + '</div>';
        }).join('');
    }

    /* ============================================================
       文件位置：**路线图**（线路 + 站点）
       建树：每条绝对路径按 `/` 切开、逐段挂上去 —— 相同的前缀**自然共用同一批节点**，
             这就是"同源干线合并"，不是"为了摆整齐把相近的凑一起"。
             ⚠️ 线路图**从数据现算**：加一条路径，该合并的自动合并、该分叉的自动分叉。
                手写一份就必然在某条路径改名之后说错话。
       ⚠️ 终点站 = "这条路径到此为止"的那个节点（`n.leaf` 且没有子节点）。
          有子节点的节点即使自己也挂牌（前缀路径，例如同时登记了 `/opt/app` 与 `/opt/app/web`），
          也按**路过站**画：它下面还有东西，画成终点会读成"这条线断了"。
       ============================================================ */
    function railTree(s) {
        const root = { name: '', kids: {}, leaf: null, isDir: true };
        s.paths.forEach(function (p) {
            const parts = p.path.split('/').filter(Boolean);
            let node = root;
            parts.forEach(function (seg, i) {
                if (!node.kids[seg]) node.kids[seg] = { name: seg, kids: {}, leaf: null, isDir: false };
                node = node.kids[seg];
                if (i === parts.length - 1) {
                    node.leaf = p;
                    node.isDir = p.path.slice(-1) === '/';
                }
            });
        });
        return root;
    }
    /* **单链压缩**（地铁图里叫"区间合并"）：一个节点若**只有 1 个孩子**，就把孩子并上来
       （名字用 `/` 连），一直并到"分叉点"（≥2 个孩子）或"叶子"（没有孩子）为止。
       判据：**一个站点值得占一行的理由 = 它要么是分叉点、要么是终点。**
       ⚠️ 不压的代价是量出来的：这台机器 22 行里 **13 行是纯路过站**（`opt` / `app` / `web` /
          `nginx` / `conf.d` …），每行 26px、共 338px，而它们**一个字的信息都没有**；
          更糟的是读者每看一条路径，都要把祖先名在脑子里拼一遍（`opt→app→web→dist`）。
       ⚠️ 合并只在**真实同源**处发生（拼出来的就是路径本身），不是"为了短把相近的凑一起"。
       ⚠️ 一个节点**自己挂着信息（`leaf`）时不并** —— 前缀路径（同时登记了 `/opt/app` 与
          `/opt/app/web/dist`）那种情况，并掉就等于把它的读数丢了。 */
    function routeMerge(node) {
        Object.keys(node.kids).forEach(function (k) {
            let cur = node.kids[k];
            while (!cur.leaf && Object.keys(cur.kids).length === 1) {
                const child = cur.kids[Object.keys(cur.kids)[0]];
                cur = { name: cur.name + '/' + child.name, kids: child.kids,
                        leaf: child.leaf, isDir: child.isDir };
            }
            node.kids[k] = cur;
            routeMerge(cur);
        });
        return node;
    }
    /* 这一站下面还藏着多少条**文件位置**（只数叶子）—— 收起之后那一行唯一还看得见的数。
       ⚠️ 中间站是"路过"的、不是"登记的位置" ⇒ 不数；节点自己挂的那条 `leaf` 也不数
          （它按分叉站画、本来就没露出来，数进去就成了"藏起来的数"与"露出来的行"对不上）。
       判据：收起把 N 行藏起来 ⇒ 必须有一处说"藏了几条"，否则"收起来"就等于"信息丢了"。 */
    function countLeaves(node) {
        let n = 0;
        Object.keys(node.kids).forEach(function (k) {
            const c = node.kids[k];
            const kids = Object.keys(c.kids);
            if (c.leaf && !kids.length) n += 1;
            if (kids.length) n += countLeaves(c);
        });
        return n;
    }
    function railNodesHtml(node, multi, ind, acc) {
        const pad = '                            ' + '    '.repeat(ind);
        return Object.keys(node.kids).map(function (k) {
            const n = node.kids[k];
            const kids = Object.keys(n.kids);
            const hit = n.leaf && !kids.length;                  /* 终点站 */
            const cnt = kids.length ? countLeaves(n) : 0;
            /* 这一站自己的绝对路径：终点站用**登记值原样**（`/var/log/pay-api/` 那个尾斜杠
               是数据的一部分，去掉就不是数据里那一串了）；中间站由祖先拼出来 ——
               合并过的站名（`uc/web/dist`）本来就是路径的一段，拼出来必然等于真路径。 */
            const full = n.leaf ? n.leaf.path : acc + '/' + n.name;
            const base = full.replace(/\/+$/, '').split('/').pop();   /* 复制名称 = 最后一段 */
            /* 读序：**我在哪 → 它是什么 → 它的状态**。
               ⚠️ 用途紧跟在名字后面（原来它和版本/项目一起被 `margin-left: auto` 推到右端，
                  一行两头离得远、眼睛要来回扫；用途才是紧挨名字的那条信息）。
               版本与项目贴右端收口（回答"新不新、是谁的"，与名字的关系次要一层）。 */
            const use = hit ? '<span class="route-use">' + n.leaf.use + '</span>' : '';
            const info = hit
                ? '<span class="route-meta">'
                  + '<span class="route-note">' + n.leaf.note + '</span>'
                  + (multi ? '<span class="route-proj">' + n.leaf.project + '</span>' : '')
                  + '</span>'
                : (kids.length
                    ? '<span class="route-meta"><span class="route-cnt">' + cnt + ' 条</span></span>'
                    : '');
            /* 收起箭头：**只有分叉站有**。它 `aria-hidden` —— 状态与动作都归主按钮说，
               它只是那 15px 槽位里的一个可见信号（槽位由 `.route-main` 的 padding 给）。 */
            const fold = kids.length
                ? '<span class="route-fold" aria-hidden="true" title="点一下收起或展开">'
                  + svgIcon('chevD', 13) + '</span>'
                : '';
            /* 主动作两种、落的都是"点这一行"：终点 = 开文件抽屉看它写了什么；
               分叉 = 把下面那一段收起来。 */
            const main = '<button class="route-main" type="button" data-path="' + full + '"'
                + ' title="' + full + '"'
                + (hit
                    ? ' aria-label="打开 ' + full + '"'
                      + ' onclick="openFile(\'' + qs(n.leaf.path) + '\',\'' + qs(n.leaf.use) + '\')"'
                    : ' aria-expanded="true"'
                      + ' aria-label="' + n.name + '，下面还有 ' + cnt + ' 条位置"'
                      + ' onclick="toggleRouteFold(this)"')
                + '>\n'
                + (fold ? pad + '            ' + fold + '\n' : '')
                + pad + '            <span class="route-stop" aria-hidden="true"></span>\n'
                + pad + '            <span class="route-name">' + n.name + (hit && n.isDir ? '/' : '') + '</span>\n'
                + (use ? pad + '            ' + use + '\n' : '')
                + (info ? pad + '            ' + info + '\n' : '')
                + pad + '        </button>\n'
                /* 两枚复制：**在主按钮外面**（按钮里不能套按钮），所以点击不会碰到主动作。
                   标签只写"路径 / 名称"两个词，完整值与句子写在 title / aria-label 上 ——
                   一行 13 条，写全"复制完整路径"会把线路图淹掉。 */
                + pad + '        <button class="route-act" type="button"'
                + ' title="复制完整路径：' + full + '" aria-label="复制路径 ' + full + '"'
                + ' onclick="copyText(\'' + qs(full) + '\')">'
                + svgIcon('copy', 12) + '<span class="act-t">路径</span></button>\n'
                + pad + '        <button class="route-act" type="button"'
                + ' title="复制名称：' + base + '" aria-label="复制名称 ' + base + '"'
                + ' onclick="copyText(\'' + qs(base) + '\')">'
                + svgIcon('copy', 12) + '<span class="act-t">名称</span></button>';
            return pad + '<li class="route-item' + (hit ? ' is-leaf' : ' is-branch') + '">\n'
                + pad + '    <div class="route-node">\n'
                + pad + '        ' + main + '\n'
                + pad + '    </div>\n'
                + (kids.length
                    ? pad + '    <ul class="route-list">\n'
                      + railNodesHtml(n, multi, ind + 1, full) + '\n' + pad + '    </ul>\n'
                    : '')
                + pad + '</li>';
        }).join('\n');
    }
    function railHtml(s) {
        /* 单项目机器不用在终点上再挂一枚项目胶囊（整段只有一个项目 ⇒ 挂 9 遍是噪声）；
           多项目时才挂 —— 那时"这条属于谁"才是真信息。 */
        const multi = s.projects.length > 1;
        return '                    <div class="route">\n'
            + '                        <div class="route-root"><span class="route-root-name">/</span></div>\n'
            + '                        <ul class="route-list">\n'
            + railNodesHtml(routeMerge(railTree(s)), multi, 0, '') + '\n'
            + '                        </ul>\n'
            + '                    </div>';
    }
    /* ============================================================
       分叉站收起 / 展开
       ⚠️ 只切一个类，**不重建标记** —— 重建会顺手丢掉别处的收起状态、焦点与滚动位置
          （同"多视角全留 DOM、切换只改可见性"那条；本页只有一处折叠，更要省）。
       ⚠️ `aria-expanded` 挂在**那枚真按钮**上（不是行上、更不是箭头那个 `aria-hidden` 的 span）：
          读屏只认按钮上那个状态，箭头只是给眼睛的信号。
       ============================================================ */
    function toggleRouteFold(btn) {
        const li = btn.closest ? btn.closest('.route-item') : null;
        if (!li) return;
        const folded = li.classList.toggle('is-collapsed');
        btn.setAttribute('aria-expanded', String(!folded));
    }

    /* ============================================================
       分区 = **本页这四段**（与兄弟详情页同一口径：圆盘 = 本页内容分区，
       点它只做"滚到它 + 更新当前项"，绝不互斥隐藏）
       ⚠️ 段名用「项目」不用「服务项目」：圆盘上只有四格，每格两个字以内才扫得动；
          "服务"这层意思由段头那句 note 说（"拉开一行看它在这台机器上放了什么"）。
       ============================================================ */
    function pageSections(s) {
        return [
            { key: 'what', label: '概览', icon: 'info', count: (6 + s.ports.length) + ' 项',
              desc: '这台机器是什么、用什么身份连上去' },
            { key: 'projects', label: '项目', icon: 'project', count: s.projects.length + ' 个',
              desc: '这台机器被哪些项目共用 —— 拉开一行看它放了什么' },
            { key: 'docs', label: '文档', icon: 'book', count: docsOfMachine(s).length + ' 篇',
              desc: '它服务的项目各自的部署文档' },
            { key: 'files', label: '文件位置', icon: 'folder', count: s.paths.length + ' 条',
              desc: '按路径层级合成线路 —— 分叉站可收起，每行可复制路径' }
        ];
    }

    /* ============================================================
       项目抽屉：从「项目」那一行拉开
       ⚠️ 两个抽屉（项目 / 文件）同时开着时**后开的在上面**（z-index 205 < 210）——
          这正是"一层层拉开"的直觉；ESC 也逐层退（先文件、后项目）。
       ⚠️ 面板内容每次**现算**（`pdBodyHtml`）而不是把 3 份都渲在 DOM 里等显隐：
          抽屉一次只开一个，为它预渲 N 份是纯浪费（与本页"多视角全留 DOM"那条口径不冲突 ——
          那条针对的是**同时并存**的几种视角，抽屉是互斥的）。
       ============================================================ */
    function openProjectDrawer(project) {
        const s = MACHINE;
        const meta = PROJECT_META[project] || { icon: 'project', desc: '', ops: '' };
        const box = document.getElementById('pdPanel');
        if (!box) return;
        const mine = pathsOfProject(s, project);
        const ico = document.getElementById('pdIco');
        ico.dataset.ico = meta.icon;
        document.getElementById('pdTitle').textContent = project;
        document.getElementById('pdSub').textContent =
            (meta.desc ? meta.desc + ' · ' : '') + '本机文件位置 ' + mine.length + ' 条';
        document.getElementById('pdBody').innerHTML = pdBodyHtml(s, project);
        document.getElementById('pdFoot').innerHTML = meta.ops
            ? '<span class="pd-hint">改这些文件、看日志与发版都在运维页</span>'
              + '<a class="btn btn-primary btn-sm" href="' + meta.ops + '">去运维页'
              + '<span class="sv-ext" aria-hidden="true" data-ico="chevR" data-ico-size="12"></span></a>'
            : '';
        paintIcons(box);                                 /* 新灌进来的容器再描一遍 */
        document.getElementById('pdMask').classList.add('open');
        /* 焦点进面板（否则 Tab 还在身后的画布上走）—— 落在关闭键上最稳 */
        const close = box.querySelector('.modal-close');
        if (close) setTimeout(function () { close.focus(); }, 60);
    }
    function closeProjectDrawer() {
        const m = document.getElementById('pdMask');
        if (m) m.classList.remove('open');
    }
    /* 唯一的"切换"函数：圆盘 / 收起态图标列 / 超级菜单 / 命令面板 —— 全部汇到这里。
       本页三个分区**同时可见** ⇒ 它做的是"滚到它 + 更新当前项"，绝不互斥隐藏。
       ⚠️ 源页那一版要处理"视角 / 筛选"，本页两个都没有 ⇒ 只留定位与滚动同步。 */
    function activatePanel(key) {
        if (!SECTIONS.some(x => x.key === key)) return;
        activeKey = key;
        const el = sectionEl(key);
        if (el && scroller) {
            const box = scroller.getBoundingClientRect();
            const r = el.getBoundingClientRect();
            /* 已经落在"上四分之一"里就不动它：滚动本身是一次视觉噪声，
               只有它真的不在视野里才值得跳 */
            const inView = r.top >= box.top + 20 && r.top <= box.top + box.height * 0.5;
            if (!inView) {
                spyLock = Date.now() + 600;
                el.scrollIntoView({ behavior: SMOOTH, block: 'start' });
            }
        }
        syncChrome(false);
    }

    /* 分区元素 = 「当前分区」那一段。⚠️ 取法按 `data-section`，与源页按项目 slug 取法不同：
       本页的分区就是三段，没有"视角"这一层。 */
    const sectionEl = key => document.querySelector('.sec[data-section="' + key + '"]');

    /* ============================================================
       铺设"当前这台"
       ============================================================ */
    function renderMachine() {
        const s = MACHINE;
        document.title = s.host + ' · 服务器 · 工作';
        const setText = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
        setText('heroName', s.host);
        setText('cntWhat', (6 + s.ports.length) + ' 项');
        setText('cntProjects', s.projects.length + ' 个');
        setText('cntDocs', docsOfMachine(s).length + ' 篇');
        setText('cntFiles', s.paths.length + ' 条');

        const role = document.getElementById('heroRole');
        if (role) {
            role.dataset.ico = (s.role === 'db' ? 'database' : 'server');
            role.title = roleLabelOf(s);
            role.setAttribute('aria-label', roleLabelOf(s));
        }
        const tag = document.getElementById('heroTag');
        if (tag) {
            tag.textContent = s.env;
            tag.className = 'hero-tag' + (s.env === '生产' ? '' : ' is-test');
        }
        const projs = document.getElementById('heroProjs');
        if (projs) projs.innerHTML = projChipsHtml(s);
        const acts = document.getElementById('heroActs');
        if (acts) acts.innerHTML = heroActsHtml(s);
        const what = document.getElementById('whatBody');
        if (what) what.innerHTML = whatBodyHtml(s);
        const pj = document.getElementById('pjBody');
        if (pj) pj.innerHTML = projectCardsHtml(s);
        const dc = document.getElementById('dcBody');
        if (dc) dc.innerHTML = docShelvesHtml(s);
        const fp = document.getElementById('fpBody');
        if (fp) fp.innerHTML = railHtml(s);
        paintIcons(document);        /* 新灌进来的图标容器要再描一遍 */
    }

    /* ============================================================
       一次把页面立起来
       ⚠️ 顺序：分区先算（圆盘与侧栏副标题读它）→ 标记后灌 → 图标最后灌（先灌等于灌了个空容器）
       ============================================================ */
    function renderAll() {
        SECTIONS = pageSections(MACHINE);
        /* 命令面板 / 超级菜单里的「工作」那一支也吃 SECTIONS ⇒ 一起重建 */
        MODULES = buildModules();
        MODULE = Object.fromEntries(MODULES.map(m => [m.key, m]));
        if (!SECTIONS.some(x => x.key === activeKey)) activeKey = SECTIONS[0].key;

        renderMachine();
        readConnStates();
        renderCmdList();
        renderRecent();
        syncChrome(false);
    }

    /* ============================================================
       侧栏「最近」：**跳去那台机器的详情页**（本页不是"定位"，是"换一台"）
       —— 所以用 `<a href>` 而不是 `onclick`：中键 / 新窗口 / 键盘都天然可用。
       ============================================================ */
    function renderRecent() {
        const box = document.querySelector('.slot-panel[data-panel="recent"]');
        if (!box) return;
        const when = ['2 小时前', '今天', '昨天', '3 天前', '上周', '上周'];
        box.innerHTML = SERVERS.slice(0, 4).map(function (s, i) {
            return '<a class="recent-item" href="' + LIST_PAGE.replace('-index.html', '-详情-index.html')
                + '?host=' + encodeURIComponent(s.host) + '"'
                + (s.host === MACHINE.host ? ' aria-current="page"' : '') + '>'
                + '<span class="recent-icon" aria-hidden="true" data-ico="'
                + (s.role === 'db' ? 'database' : 'server') + '" data-ico-size="11"></span>'
                + '<span class="recent-text">' + s.host + '</span>'
                + '<span class="recent-time">' + (when[i] || '更早') + '</span>'
                + '</a>';
        }).join('') || '<div class="recent-empty">还没有机器</div>';
    }
    /* 详情页的「重新检查」= 重读连接标记 + 更新新鲜度。它不重渲标记（那是 renderMachine 的事）：
       刷新要做的只是"再读一遍本机记的状态"。 */
    function refreshAll() {
        readConnStates();
        const el = document.getElementById('lastSync');
        if (el) {
            const now = new Date();
            el.textContent = '最后检查 ' + String(now.getHours()).padStart(2, '0') + ':'
                + String(now.getMinutes()).padStart(2, '0');
        }
        toast('已重新检查 ' + MACHINE.host);
    }

    /* 移除：本页删掉一台之后**页面本身就没了意义** ⇒ 确认后回列表页，
       不在这里给"撤销"（那需要一个还看得见这台机器的界面）。 */
    function removeServer(name) {
        const idx = SERVERS.findIndex(s => s.host === name);
        if (idx < 0) return;
        SERVERS.splice(idx, 1);
        try { localStorage.removeItem(TERM_KEY + name); } catch (e) {}
        location.href = LIST_PAGE;
    }
"""


HERE = os.path.dirname(os.path.abspath(__file__))
# 开发期脚本在 /tmp 迭代 ⇒ 源页/产物目录用 SD_BASE 指定；放进仓库后它默认就是脚本所在目录
BASE = os.environ.get('SD_BASE', HERE)
SRC = os.path.join(BASE, '工作-服务器-index.html')
OUT = os.path.join(BASE, '工作-服务器-详情-index.html')
# 开发期：内容（CSS / 主内容 / 脚本）先放 /tmp 里迭代，最后打包进本脚本
PARTS = os.environ.get('SD_PARTS', '/tmp')

s = io.open(SRC, encoding='utf-8').read()


def must(text, old, new, tag=''):
    if old not in text:
        raise SystemExit('[patch miss%s] %s' % ((' ' + tag) if tag else '', old[:70]))
    return text.replace(old, new, 1)


# ─────────────────────────────────────────────────────────────
# ① CSS：删掉列表页专属的规则块（按选择器里的类名判），再追加本页专有段
# ─────────────────────────────────────────────────────────────
STYLE_AT = s.index('<style>') + len('<style>')
STYLE_END = s.index('</style>')
head = s[:STYLE_AT]
css_src = s[STYLE_AT:STYLE_END]
rest = s[STYLE_END:]

# 本页没有消费者的类（前缀匹配，涵盖 `.kpi-bar` / `.sv-card-wrap` 这类派生名）
DROP = [
    '.kpi', '.page-head', '.ph-', '.filter', '.chip', '.seg', '.last-sync',
    '.sv-grid', '.sv-group', '.sv-card', '.sv-spine', '.sv-body', '.sv-head', '.sv-name',
    '.sv-role', '.sv-tag', '.sv-read', '.sv-foot', '.sv-pop', '.sv-tabs', '.sv-tab',
    '.sv-fields', '.sv-field', '.sv-ports', '.sv-port', '.sv-copy', '.sv-acts',
    '.server-action-btn', '.sv-mono', '.sv-proj-', '.meta-env',
    '.skel', '.sk-',
    # 探针第 4 条报出来的孤儿（第一次跑完按名单补的）
    '.card-icon', '.count', '.empty-state', '.empty-icon', '.empty-title', '.empty-desc',
    '.hero-fact', '.is-ext', '.is-plain', '.is-server',
    '.sv-expand', '.sv-led', '.sv-screw', '.sv-sep', '.sv-spine', '.sv-tabs', '.sv-acts',
    '.sv-pane', '.sv-port', '.sv-read', '.sv-field', '.sv-card', '.sv-slot-',
]


def cut_css_block(text, prefixes):
    """按"块"删：一个块 = 深度 0 处的选择器起、到配对的 `}` 止。
       @media / @keyframes 整块判（若它内部只剩被删的类，整块一起去）。"""
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
        # ⚠️ 先把选择器文本里的**注释**摘掉再取类名：注释里会提到 `.card-icon / .kpi-ico` 这种
        #    "解释性文字"，把它们当类名会让判据整个失效（实测：几十条该删的规则因为注释里
        #    提到一个不在名单里的类而留下）。[data-ico] 这种属性选择器不产类名 ✓
        sel_clean = re.sub(r'/\*.*?\*/', '', sel, flags=re.S)
        sels = [x.strip() for x in re.split(r',(?![^(]*\))', sel_clean) if x.strip()]
        # 判"这个块要不要删"时，**状态类与主题类不算数**：
        # `.sv-card:hover` / `.dark .sv-card` / `.sv-pop.is-open` 里的 active / is-open / dark
        # 会把"全是列表页的类"这条判据冲掉 ⇒ 整块留下（正是它们把 39 个孤儿类带进来的）。
        STATE = {'dark', 'is-open', 'is-active', 'active', 'is-on', 'is-test', 'is-prod', 'is-wide',
                 'is-plain', 'is-server', 'is-flat', 'is-ext', 'is-danger', 'is-alert', 'is-multi',
                 'dense', 'ok', 'danger', 'info', 'warn', 'is-selected', 'is-current'}
        def all_dropped(one):
            # 判据：**只要有一个类命中删除名单**就删这条规则。
            # ⚠️ 原来是"所有类都要命中"—— 太严：`.sv-field .k` 里 `k` 是通用标签类（新写的
            #    `.fld .k` 还在用），于是整条 `.sv-field .k` 永远删不掉。改成"任一命中"之后，
            #    漏删会由探针第 4 条另一方向（标记有、CSS 没有）兜住 —— 那是会更早喊出来的方向。
            cs = [c for c in re.findall(r'\.([A-Za-z][\w-]*)', one) if c not in STATE]
            return any(any(c == p.lstrip('.') or c.startswith(p.lstrip('.')) for p in prefixes) for c in cs)
        # `@media (…) { … }`：外层选择器没有类 ⇒ 递归过滤内层，空了就整块去掉
        #   （不这么做，`@media (max-width:980px){ .kpi-bar{…} }` 这类"只剩列表页内容"的
        #     媒体查询会整块留下，把 .kpi-bar / .server-action-btn 这些孤儿类带进产物）
        # ⚠️ 判定要**在整段选择器文本里找** `@media`：它前面往往还贴着一条注释
        #    （`.strip().startswith('@media')` 会漏 —— 漏掉就整块留下，把里头的孤儿类带进产物）
        if re.search(r'@(media|supports)\b', sel):
            inner = block[block.index('{') + 1:block.rindex('}')]
            inner2, sub = cut_css_block(inner, prefixes)
            if inner2.strip() == '':
                dropped.append((sel.strip().split('\n')[-1][:60], k - i))
            else:
                out.append(sel + '{' + inner2 + '}')
            i = k
            continue
        if sels and all(all_dropped(x) for x in sels):
            dropped.append((sel.strip().split('\n')[-1][:60], k - i))
        else:
            out.append(block)
        i = k
    return ''.join(out), dropped


css_kept, dropped = cut_css_block(css_src, DROP)
# 没人消费的令牌：`--ok-bg` 原消费者是卡片浮层的计数徽标、`--shadow-card-hover` 是卡片的悬停影，
# 两者都随列表页的卡片一起没搬进来 ⇒ 声明也撤掉（留一个没人用的令牌 = 一份"看着像事实源"的第二描述）
for dead in ["            --ok-fg: #047857;      --ok-bg: rgba(16,185,129,0.14);\n",
             "            --ok-fg: #6EE7B7;      --ok-bg: rgba(16,185,129,0.20);\n"]:
    if dead in css_kept:
        css_kept = css_kept.replace(dead, dead[:dead.index(';') + 1] + '\n', 1)
# `--shadow-card-hover` 只剩声明（它的消费者是卡片的悬停影，随卡片一起没搬进来）
css_kept = '\n'.join(l for l in css_kept.split('\n') if '--shadow-card-hover' not in l)
css_kept = re.sub(r'\n{4,}', '\n\n\n', css_kept)
css_new = CSS_PART

# ⚠️ **新类名先和"全页既有类"求交集**（2026-09-29 踩，代价是整段被吃掉）：
#     路线图容器我取名 `.rail`，而导航壳的"收起态图标列"正是 `.rail`
#     （`display:none` + 只有 `.sidebar.collapsed` 时才 `display:flex`）
#     ⇒ 文件位置段在默认状态下**根本不显示**。
#     ⚠️ 而**类名双向差集查不出这一类**：两边都有定义、两边都有标记，它只查"有没有"，
#        查不出"是不是同一个东西"。判据是**交集**，不是差集。
#     白名单 = 有意复用源页的类（按钮 / 文件抽屉 / 外链箭头 / 关闭键那一族）。
REUSE_OK = {
    # ① 有意复用源页那一族（元素的形态由它们定义，本页只是使用者）
    'btn', 'btn-ghost', 'btn-sm', 'btn-primary', 'modal-close', 'toast', 'toast-msg',
    'path-ico', 'sv-ext', 'sv-projs', 'sv-proj', 'conn', 'dark', 'fadeIn', 'ok', 'danger', 'info', 'warn',
    # ② 第二个名单是**第一次跑这条断言时它报出来的**，逐个判过：
    #    · 状态类（本页与源页同语义）：is-test / is-wide / open
    #    · 通用短名，且本页两处都**限定在父类下**（`.fld .k` / `.fld .v` / `.pchip .svc`）
    #      —— 与源页那三个是同一个语义（字段标签 / 字段值 / 端口上的服务名）。
    #      ⚠️ 这三个正是"单字母类名迟早撞"的活例子：限定父类才安全，别单独用。
    'is-test', 'is-wide', 'open', 'k', 'v', 'svc',
}
def _classes(t):
    return set(re.findall(r'\.([A-Za-z][\w-]*)', re.sub(r'/\*.*?\*/', '', t, flags=re.S)))
_src_cls, _new_cls = _classes(css_src), _classes(css_new)
_clash = sorted(c for c in (_new_cls & _src_cls) if c not in REUSE_OK)
if _clash:
    raise SystemExit('[clash] 本页新增的类名撞了源页既有类：' + ', '.join(_clash))
print('[build] 新类名 %d 个 / 白名单复用 %d 个，与源页既有类零冲突' % (len(_new_cls), len(REUSE_OK)))

# ─────────────────────────────────────────────────────────────
# ② 主内容：源页的 `<main>…</main>` 整段换成详情页那三段
# ─────────────────────────────────────────────────────────────
main_at = rest.index('<main')
main_end = rest.index('</main>') + len('</main>')
old_main = rest[main_at:main_end]
if 'class="filter-bar"' not in old_main or 'id="view-project-cards"' not in old_main:
    raise SystemExit('[guard] 取到的不是列表页的主内容区')
new_main = HTML_PART.rstrip('\n')
rest = rest[:main_at] + new_main + rest[main_end:]


# ─────────────────────────────────────────────────────────────
# ③ 脚本：删掉列表页专属的函数块，追加本页的函数
# ─────────────────────────────────────────────────────────────
def drop_block(text, name):
    """按声明找块并删掉（含紧贴上面的注释块）。
       声明形态：`function x(` / `const x =` / `let x =`。"""
    pats = [r'\n    function ' + re.escape(name) + r'\b',
            r'\n    const ' + re.escape(name) + r'\s*=',
            r'\n    let ' + re.escape(name) + r'\s*=']
    start = -1
    for p in pats:
        m = re.search(p, text)
        if m:
            start = m.start() + 1
            break
    if start < 0:
        raise SystemExit('[drop miss] ' + name)
    # 向上吃掉紧贴上面的**完整注释块**。
    # ⚠️ 必须按 `/* … */` 配对来吃，不能按"这一行像注释"逐行吃：注释体里有很多行
    #    不以 `*` 开头（中文句子），逐行吃会在注释体中间停住 —— 于是 `*/` 被吃掉、
    #    `/*` 留着 ⇒ **注释没闭合，把后面整段代码吞进去**（`node --check` 报在很远的地方）。
    a = start
    while True:
        k2 = a - 1
        while k2 >= 0 and text[k2] in ' \t\n':
            k2 -= 1
        if k2 < 0 or not text[:k2 + 1].endswith('*/'):
            break
        open_at = text.rfind('/*', 0, k2)
        if open_at < 0:
            break
        # ⚠️ 取**行首**而不是 `/*` 的位置：留一行行首那几格缩进，被删掉的下一行就会
        #    变成"8 格缩进"，于是下一条 drop 的正则 `\n    let …` 匹配不上（又一个静默 miss）。
        a = text.rfind('\n', 0, open_at) + 1
    # 两种形态分开处理（写错过一次：`let x = 'all';` 这种**没有花括号**的声明，
    # 直接去找下一个 `{` 会一路吃到后面某个函数的 `}` —— 一次静默删掉几百行）：
    #   · 分号先出现（`let x = ...;` / 单行箭头函数）⇒ 删到分号为止
    #   · 花括号先出现（`function x() {…}` / 多行对象字面量）⇒ 配平到块的 `}`
    semi, brace = text.find(';', start), text.find('{', start)
    if semi >= 0 and (brace < 0 or semi < brace):
        # `let x = ...;` 这种：**整行删掉**（含行尾注释），不留半截注释碎片
        k = text.find('\n', semi)
        return text[:a] + ('' if k < 0 else text[k + 1:])
    j = brace
    if j < 0:
        raise SystemExit('[drop miss: 没有块也没有分号] ' + name)
    depth, k = 1, j + 1
    while k < len(text) and depth:
        if text[k] == '{': depth += 1
        elif text[k] == '}': depth -= 1
        k += 1
    # ⚠️ 只删到**本行行尾**：用 `[;\s]*` 会把下一行开头的缩进一起吃掉
    #    （写错过一次 ⇒ `\nfunction projectChipsHtml()` 少了 4 格，于是下一次 drop
    #      的正则 `\n    function …` 匹配不上，报"找不到"）。
    nl = text.find('\n', k)
    return text[:a] + ('' if nl < 0 else text[nl + 1:])


MARK = '\n<script>\n'   # ⚠️ 用带换行的锚：注释里出现 `\`<script>\`` 会把定位带偏
script_at = rest.index(MARK) + len(MARK)
script_end = rest.index('</script>')
js = rest[script_at:script_end]

DROP_JS = [
    # 筛选栏（本页没有筛选）
    'filterProject', 'filterServer', 'chipHtml', 'projectChipsHtml', 'serverChipsHtml',
    'renderFilterChips', 'applyFilter', 'resetFilter',
    # 视角 / 视图切换
    'perspective', 'PERSPECTIVES', 'viewId', 'applyDisplay', 'setPerspective',
    # 卡片墙与浮层（源页"只保留卡片"之后剩下的那一批）
    'cardTileHtml', 'cardsViewHtml', 'popHtml', 'portsHtml', 'actsHtml',
    'renderAllViews', 'groupsOf', 'scopeOf', 'ALL_SEC', 'toggleCardPop', 'closeCardPop',
    'setPopTab', 'extTab',
    # 仪表条 / 列表页的整页刷新 / 焦点跳转
    'syncInstrument', 'setText', 'focusServer', 'addServer', 'refreshAll',
    # 本页要换成自己的那一批
    'renderAll', 'renderRecent', 'removeServer', 'undoRemoveServer', 'sectionEl', 'activatePanel',
    'slugOfProject', 'nameOfSlug', 'buildSections', 'refreshSections', 'sectionCount',
]
for name in DROP_JS:
    if name == 'README_NOT_A_REAL_NAME':
        continue
    js = drop_block(js, name)

js_new = JS_PART
js = js.rstrip('\n') + '\n\n' + js_new

# ⓪-a ICON 表补一枚 `book`（文档段与段头都要它）—— 路径取自运维页同一张表，
#     本页是一套图标制：新图标必须进**这一张**表，不许就地写 svg。
js = must(js, """        chevL: '<path d="m14.5 6-6 6 6 6"/>'""",
"""        chevL: '<path d="m14.5 6-6 6 6 6"/>',
        /* 文档（书）—— 段头与书封面右上角共用 */
        book: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19h15"/>'""", 'ICON book')
# ⓪-b ESC 逐层退出：项目抽屉在文件抽屉**下面** ⇒ 先退上面那个（一次只关一层，
#      一次全关会让"关了文件抽屉，项目抽屉也跟着没了"，上下文一起丢）
js = must(js, """            if (document.getElementById('fdMask').classList.contains('open')) { closeFile(); return; }""",
"""            if (document.getElementById('fdMask').classList.contains('open')) { closeFile(); return; }
            if (document.getElementById('pdMask').classList.contains('open')) { closeProjectDrawer(); return; }""", 'esc pdMask')
# ⓪ 浮层相关的调用点：函数已删，调用还在 ⇒ 删调用（Esc 与"点别处收起"两条路）
js = must(js, """            /* 卡片浮层是最上面那层（它挂在卡片里、压着卡片）⇒ 先收它 */
            if (document.querySelector('.sv-pop.is-open')) { closeCardPop(); return; }
""", "", 'esc closeCardPop')
js = must(js, """    /* 点卡片区**以外**的任何地方收起浮层（参考的做法）。
       判据取 `closest('.sv-card-wrap')`：浮层本身也在这一层里 ⇒ 点浮层内部不会误关
       （参考里专门为"点浮层内部不关"写了一行 `stopPropagation`，用范围判断可以省掉它）。
       ⚠️ 与"整卡点击 = 打开浮层"不冲突：那一句是卡片元素上的内联 onclick，
          先于本监听器触发；而它自己会调 `closeCardPop()` —— 两条路都收得干净。 */
    document.addEventListener('click', function (e) {
        const t = e.target;
        if (t && t.closest && t.closest('.sv-card-wrap')) return;
        closeCardPop();
    });
""", "", 'click closeCardPop')
# ── 删掉那一批之后留下的"接线"要一并改掉（每一条都是**运行到才炸**的静默错误）──
# ① 连接状态刷完会去刷顶部仪表条 —— 本页没有仪表条，那个函数已经不在了
js = must(js, "        syncInstrument();\n", "", 'applyConnState→syncInstrument')
# ② 分区计数：源页从"列表行数"现算，本页的分区就是三段 ⇒ 直接用 SECTIONS 里的 count
js = must(js, "sectionCount(sec)", "sec.count", 'syncChrome count')
js = must(js, "sectionCount(item)", "item.count", 'ring caption count')
# ③ `SECTIONS` 由本页 renderAll() 现算
js = must(js, "    SECTIONS = buildSections();", "    SECTIONS = [];   /* 由 renderAll() 按「本页四段」现算（见页尾） */", 'SECTIONS init')
# ④ 命令面板：条目文案 + "添服务器"这一条在本页没有对象 ⇒ 换成"回到服务器列表"
js = must(js, "text: s.label + ' · 项目'", "text: s.label + ' · 本页分区'", 'cmd label')
js = must(js, """        cmdItems.push({ icon: 'plus', text: '添加服务器', kbd: '', run: function () { location.href = ADD_SERVER_URL; } });""",
"""        /* 本页是"一台机器"，没有"添加服务器"那个对象 ⇒ 这一条换成"回到服务器列表" */
        cmdItems.push({ icon: 'server', text: '回到服务器列表', kbd: '', run: function () { location.href = LIST_PAGE; } });""", 'cmd addServer')
# ⑤ 侧栏「最近」的**静态**那一份还是 `<button onclick="focusServer(...)">` —— 那个函数在本页不存在
#    （本页的"最近"是"换一台机器"= 跳页，不是页内定位）⇒ 换成 `<a href>`。
js = js  # (下面在整页范围内做，见 out 之后)
# 初始化段：视口那个分段已经不存在 ⇒ 删掉那一段绑定；`renderAll()` 由本页自己的版本承担
js = must(js, """    /* 视角切换（2026-09-29 起只剩这一个分段：列表 / 表格两个视图已删）。
       两份标记都在 DOM 里，事件只绑一次 —— 切换不重建标记，所以没有"第二次渲染后监听器静默失效"。 */
    document.querySelectorAll('.seg-btn[data-persp]').forEach(function (b) {
        b.addEventListener('click', function () { setPerspective(b.dataset.persp); });
    });
""", "", 'seg binding')
js = must(js, """    /* 一次把页面立起来：分区（项目）现算 → 卡片与行渲染 → 图标一次灌完 →
       连接状态按本机记的标记回填 → 命令面板 / 最近 / 仪表 → 导航壳对齐。""",
"""    /* 一次把页面立起来：分区（**本页这四段**）现算 → 这台机器的标记 → 图标一次灌完 →
       连接状态按本机记的标记回填 → 命令面板 / 最近 → 导航壳对齐。""", 'init render')
# 源页的自检断言针对"卡片由 SECTIONS 产出"，本页仍然成立（圆盘图标两两不同），保留。

rest = rest[:script_at] + js + rest[script_end:]

out = head + css_kept.rstrip('\n') + '\n' + css_new + '    </style>' + rest[len('</style>'):]

# ─────────────────────────────────────────────────────────────
# ④ 侧栏两处：标题 + 副标题占位（副标题由脚本按当前分区现算）
# ─────────────────────────────────────────────────────────────
out = must(out, "不再需要 `.sv-card .conn` 那种\"覆盖基类\"的写法 —— 基类与用法合一，少一处第二描述。",
           "基类与用法合一，少一处第二描述（本页唯一的消费者就是它）。", 'conn comment')
# 项目抽屉的骨架挂在**文件抽屉之前**：两者都必须是 `<body>` 直接子级 ——
# 塞进 `.main`（那是滚动容器）里虽然 `position: fixed` 多半也照常，但那是在赌浏览器的细节，
# 而这两个遮罩一旦被裁掉，表现是"点了没反应"，最难查。
out = must(out, '<!-- 文件抽屉：从「文件分布」点一行打开 -->',
"""<!-- 项目抽屉：从「项目」那一行拉开（`openProjectDrawer`）。
     ⚠️ 与文件抽屉刻意同族、z-index 更低（205 < 210）：抽屉里的清单点一行会再开文件抽屉，
        两个同时开着时后开的那个压在上面。 -->
<div class="pd-mask" id="pdMask" onclick="if(event.target===this)closeProjectDrawer()">
    <div class="pd-panel" id="pdPanel" role="dialog" aria-modal="true" aria-labelledby="pdTitle">
        <div class="pd-head">
            <span class="pd-ico" id="pdIco" aria-hidden="true" data-ico="project" data-ico-size="16"></span>
            <div class="pd-titles">
                <div class="pd-title" id="pdTitle">项目</div>
                <div class="pd-sub" id="pdSub"></div>
            </div>
            <button class="modal-close" type="button" onclick="closeProjectDrawer()" aria-label="关闭"><span data-ico="x" data-ico-size="15"></span></button>
        </div>
        <div class="pd-body" id="pdBody"></div>
        <div class="pd-foot" id="pdFoot"></div>
    </div>
</div>

<!-- 文件抽屉：从路线图的终点站 / 抽屉里的清单点一行打开 -->""", 'pdMask')

# 文件头：派生时整段留的是**源页**（列表页那篇"跨项目的机器台账"）⇒ 换成这一页自己的。
# 不换的话，下一个读这页的人会以为这是列表页的说明（而它描述的分区、分工、默认态全都不是）。
NEW_HEAD = """<!-- ============================================================================
     工作 · 服务器 · 详情（`工作-服务器-详情-index.html`）
     ----------------------------------------------------------------------------
     一台机器的**全部**：它是什么、怎么连上去、被哪些项目共用、有哪些文档、文件都在哪。

     与另外两页的分工：
       · `工作-服务器-index.html`（列表页）回答"我手上有哪些机器" —— 卡片一眼看完；
       · 本页回答"**这一台**是什么" —— 四段：概览 / 项目 / 文档 / 文件位置；
       · `工作-项目-项目详情-运维-index.html` 是**动手**的地方（部署 / 看日志 / 发版 / 回滚），
         本页只给门，不给第二套入口。
     ⇒ 所以本页不重复列表页的卡片墙与筛选，也不重复运维页的动作。

     ⚠️ 四段各用**一种物**（判据只有一条：这一段的数据是什么形状，它就长成什么样子）：
          · 项目 = **抽屉**：一行只够说"有多少"，拉开才是"都是哪几个、都在哪"；
          · 文档 = **书**：有限、可数、有封面 —— "这里有几本，点开读"；
          · 文件位置 = **路线图**（线路 + 站点）：数据里只有层级关系、没有方位与距离
            ⇒ 画拓扑图，不画地图（画地图就得编造"这两条路径挨着"这种不存在的关系）；
          · 概览 = 字段读数：它没有形状，就是一组值。
        ⚠️ 抽屉里的清单与路线图的终点站**可点**（再开文件抽屉）—— 两层抽屉是两件事：
           外层答"这个项目在这台机器上放了什么"，内层答"这个文件写了什么"。
        ⚠️ 路线图整行是按钮：终点站点开抽屉、分叉站点一下把下面那一段收起来；
           行尾两枚（路径 / 名称）是复制，位置在主按钮**外面** ⇒ 不是按钮套按钮。

     ⚠️ 主内容**静态 + 脚本增强**：预览面板走 `/static-html/…`（不跑脚本）⇒ 四段的主内容
        由 `._seed-server-detail.cjs` 用页面**自己的模板函数**提前灌进标记（不手抄第二份）。
     ⚠️ 默认那一台 = `SERVERS[0]`；带 `?host=` 时脚本把整页重绘成那一台。

     材质 / 令牌 / 图标 / 导航壳**逐字承接**运维页（那是本仓的当前口径）：
       · 面阶四档、强调色三档（--m-main 图形 / --m-ink 文字 / --m-fill 实底）、描边两档；
       · 图标一套制：一张 ICON 表 + `svgIcon / paintIcons / setIcon`，全页无 emoji；
       · 导航壳 = design/index/导航-v5.html 的导航段，与运维页同一个口径的三处偏差也照搬：
           ① 二级圆盘不自动下钻（本页分区没有 children，点非当前项只切内容）；
           ② 一级模块里只有「工作」有承载内容，其余点击只给提示；
           ③ 页头只放路径，模块标题在各面板内。
     ---------------------------------------------------------------------------- -->"""

out, n_head = re.subn(r'<!-- =+\n     工作 · 服务器（`工作-服务器-index\.html`）.*?\n     -+ -->',
                      lambda m: NEW_HEAD, out, count=1, flags=re.S)
if n_head != 1:
    raise SystemExit('[guard] 文件头没换掉（源页那一段的形状变了？）')

out = must(out, '<span class="name" id="sidebarTitle">服务器</span>',
           '<span class="name" id="sidebarTitle">服务器 · 详情</span>', 'sidebar title')

# 侧栏「最近」的**静态**那一份：`<button onclick="focusServer('x')">` → `<a href="…-详情-index.html?host=x">`
# （本页的"最近"是"换一台机器"，不是页内定位；脚本不跑时那份静态标记也必须点得动）
def recent_to_link(m):
    host = m.group(1)
    return ('<a class="recent-item" href="工作-服务器-详情-index.html?host=' + host + '">'
            + m.group(2) + '</a>')

out, n_recent = re.subn(
    r'<button class="recent-item" type="button" onclick="focusServer\(\'([\w-]+)\'\)">(.*?)</button>',
    recent_to_link, out, flags=re.S)

io.open(OUT, 'w', encoding='utf-8').write(out)
print('[build] %s → %d 行 / %d 字节' % (os.path.basename(OUT), out.count('\n') + 1, len(out.encode())))
print('[build] CSS 删掉 %d 块（列表页专属）；新增 CSS %d 字符；新增 JS %d 字符'
      % (len(dropped), len(css_new), len(js_new)))
print('[build] 删掉的块前 12 个：', ' | '.join(d[0] for d in dropped[:12]))
print('[build] 静态「最近」按钮改成跳页链接：%d 个；文件头已换成详情页那一段' % n_recent)

# ── 收尾：把"只能由脚本产出"的主内容用**页面自己的模板函数**灌成静态标记
#    （预览面板走静态 HTML 视图，脚本不跑；这一页的 Hero / 概览 / 服务项目 / 文件位置全由脚本渲染）
seeder = os.path.join(HERE, '._seed-server-detail.cjs')
node = shutil.which('node') or NODE_FALLBACK
if not os.path.exists(seeder):
    print('[build] 跳过灌静态：找不到 %s' % seeder)
elif not node:
    print('[build] 跳过灌静态：没有 node')
else:
    r = subprocess.run([node, seeder, OUT], capture_output=True, text=True)
    print(r.stdout.strip() or r.stderr.strip())
