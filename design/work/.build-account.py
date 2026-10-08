# -*- coding: utf-8 -*-
"""从运维页壳生成「账户」页 —— 只换内容区、换数据源与脚本，壳（顶栏/圆盘/超级菜单/⌘K/Hero/Tab）照搬。"""
import io, os, sys

WORK = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(WORK, '工作-项目-项目详情-运维-index.html')
DST = os.path.join(WORK, '工作-项目-项目详情-账户-index.html')

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


I_HTML     = idx('<html lang="zh-CN">')
I_TITLE    = idx('<title>')
I_STYLE    = idx('<style>')
I_BASE_END = idx('.ops-card-body-inner { padding:')
I_MODALCSS = back('/* ======', idx('弹窗 / Toast'))
# 弹窗 / Toast 段的**终点是滚动条那几条**，不是 `</style>` —— 它后面还挂着
# 一整个"响应式"段（`@media` 里全是 .server-* / .book-* / .sd-tab / .log-row 这些
# 本页没有的类）。按 `</style>` 切会把那一整段原样搬进来：既是一堆死规则，
# 又会用它的 `.kpi-bar { repeat(2/1) }` 跟本页自己的断点打架。
I_SCROLL   = back('::-webkit-scrollbar-thumb:hover', idx('</style>'))
I_STYLECL  = idx('</style>')
I_BODY     = idx('<body>')
I_CONTENT  = idx('<!-- ========== 页面级仪表')
I_MAINCLOSE = idx('</main>')
I_CMD      = idx('<div class="cmd-mask" id="cmdMask"')
I_FD       = idx('<!-- 文件抽屉')
I_MODALMK  = idx('<!-- 弹窗（仅用于破坏性操作的二次确认） -->')
I_SCRIPT   = idx('<script>')
I_INIT     = idx('/* ============ 初始化 ============ */')
I_ASSERT   = idx('console.assert(new Set(bodies)')
I_TOASTHDR = back('/* ======', idx('       Toast')) 
I_TOASTEND = idx('toastTimer = setTimeout(() => t.classList.remove(\'show\'), action ? 6000 : 2400);')
I_SCRCL    = idx('</script>')

assert I_TOASTHDR > I_INIT, 'toast 必须在初始化之后'
assert I_TOASTEND > I_TOASTHDR

NEW_COMMENT = '''<!-- ============================================================================
     项目详情 · 账户（`工作-项目-项目详情-账户-index.html`）
     ----------------------------------------------------------------------------
     项目详情第 7 个分区「账户」的界面。

     这一区回答的问题：**这个项目要用的那些账号，在哪儿、还能不能用、谁能用。**
     与「运维」的分工是一句话 —— 运维管**机器**（连上去、传文件、看日志、发版），
     账户管**身份**（登录用的账号 / 密码 / 密钥）。服务器那台机器自己的 ssh 凭据
     属于那台机器的记录，不在这里第二遍登记。

     ⚠️ 一条列表里颜色只能承载一种语义 ⇒ 这张清单的颜色**只表示有效期紧急度**
        （逾期 / 7 天内 / 正常）。「这是生产环境」由 `.env-tag` 用文字说、
        凭据类型由行首那枚字形说（锁 / 钥匙）—— 形状留给身份，颜色留给状态。
        ⚠️ 行上**能不加标签就不加**：`高权限` 那枚标记当天加、当天撤（见下），
        现在第二行只有「环境」一个 tag（有备注时是 tag + 一句灰字）。

     ⚠️ 行分两层：**第一行只放会变的状态**（账号名 + 有效期胶囊），
        第二行放不变的身份（环境 · 备注）。运维页服务器行那条判据的延续 ——
        「上次轮换」不进第二行：它和那颗有效期胶囊说的是同一件事，面板里有确切日期。
        备注在行上是**单行省略号**（它长短不一，让它自己决定行高的话 8 行会参差不齐）。

     ⚠️ **个人项目 —— 没有"权限"这一层**（2026-09-27 用户定的）。所以：
        · 展开面板**不设「可见成员 / 能看这条的人」**：凭据只有自己用，
          "谁能看这条"这个问题不存在。字段区只放这条凭据**自己**的属性
          （类型 / 轮换周期 / 上次轮换 / 下次到期 / 备注）—— 4 个短字段 + 1 句备注。
        · **不设「取用记录」**：那块回答的也是同一个问题（谁动过它）。
        判据一句话：**这条凭据还有没有第二个人拿得到**。有 ⇒ 上面两块都得有，字段区还得
        留一格跨整行放成员名单；没有 ⇒ 两块一起别做，也不该留一个"1 人"的字段占位。
        （真要加回来，清单见 `.workbuddy/memory/2026-09-27.md`。）

     ⚠️ **增 / 改 / 删各只有一个入口**（同一个动作不许有两处入口）：
        添加 = 卡头的「＋ 添加账户」（侧栏快捷里那一个是同一个函数，不算第二套）；
        编辑 / 停用 / 删除 = 行尾动作栏；行内展开面板只放"用这条凭据"的动作
        （复制账号 / 复制密码 / 轮换），不重复管理动作。
        ⚠️ 行尾那一栏**四个都常驻可见**（2026-09-27 改）：原来管理动作是 hover 才现身，
           但用 `visibility: hidden` 藏着仍旧**占宽** ⇒ 每行「复制」与折叠箭头之间
           空着约 102px。这就是本仓明令禁止的「占列 + 隐藏」。
           决定走"常驻"那一半路，是因为**内容只占行宽的左三分之一**；
           若哪天备注变长到铺满，就该换成"绝对定位 + 元数据让位"。

     ⚠️ **添加与编辑是同一张表单**（右侧抽屉）：差别只有"编辑时密钥留空 = 不更换"。
        为什么是抽屉不是整页表单：填的时候得**看得见清单** —— 平台只有三个、环境只有三个、
        账号名还不能重复，抽屉正好把左边那半留着。一次性动作，也不开独立窗口。

     ⚠️ **平台是自己输入的，没有选项表**（2026-09-27 用户定的）。所以：
        · 分组维度 = 数据里**真出现过**的那些字符串（`platformsInUse()` 现算），
          不是一张写死的表 —— 清单里有哪几个平台，只取决于手上真有哪几个；
        · 抽屉里是**文本输入 + datalist**，候选只来自"已经在用的那些"：
          给建议、不给约束（不用背拼写，也不拦着填新的）；
        · 分组时**不要那个每组长得一样的图标**了 —— 平台名就在右边一格，图标不传信息；
        · ⚠️ 代价是**拼写即分组**：`阿里云` 与 `aliyun` 会分成两个组 ⇒ `userTaken()`
          比平台时要 `trim + toLowerCase`，别让大小写凭空多出一组。
        连带作废的一件：密钥前缀。那张 `keyPrefix` 表（阿里云 `LTAI5t…` / GitLab `glpat-…`）
        是拿固定平台表当底座才成立的，平台放开之后它就是**假知识** ⇒ 生成器给纯随机串。

     ⚠️ **凭据类型只有两类：密码 / 密钥**（2026-09-27 用户定的，原来是
        密码 / AccessKey / 访问令牌）。判据是**两个字段出现了维度重叠**：
        后两类在界面上行为**完全一样**（都不能回显、都只能随机生成），只差一个前缀 ——
        而那个前缀说的其实是"哪个平台的"，平台早就独占一格了。留着它还会允许
        `阿里云 + 访问令牌` 这种不存在的组合（3 × 3 = 9 格实际只用 5 格；
        合成 2 类后每一格都成立）。类型真正区分开的只有一条：**能不能回显明文**。

     ⚠️ 表单里"机器算得出来"的值一律不出现，三条同一判据：
        · 「下次到期」= 上次轮换 + 轮换周期 ⇒ 只回显（改周期时能立刻看见到期日被推到哪天）；
        · 「上次轮换」**整格撤掉**（2026-09-27 用户定的）：新增 = 今天、编辑 = 保持原值。
          "我刚换过"是**轮换动作**该说的事，不是表单里改一个日期；
        · 账号重名是跨条目检查 ⇒ 算出来给红字，不靠用户记得。

     ⚠️ **「账号角色」加过又撤了，整个过程值得留着**（2026-09-27）。它走过的三步：
        ① 自由文本（主账号 / 子账号 / Group Owner / 发布机器人 / 测试管理员）——
           8 条里 **3 条是账号名的复述**（`release-bot`→发布机器人、`xingchen_admin`→超级管理员、
           `xingchen_qa`→测试管理员），而且全页没有一处消费它；
        ② 值域收敛成**一个布尔位**（面板那格撤掉，表单里换成开关，行上出现「高权限」标记）；
        ③ 用户看过之后判定**整格都不要** ⇒ 撤干净。
        **判据：一个字段"能不能被读懂"和"值不值得存在"是两件事 —— 改名只解决前者。**
        撤一个字段要连着撤五处：数据位 / 表单控件 / 行或面板上的表达 /
        引用它的文案（停用与删除确认里那句）/ **只为它存在的那条 CSS 规则**（`.root-tag`）。

     ⚠️ **「用途」也撤了，换成「备注」**（2026-09-27 用户定的）。同一个位置、同一种自由文本，
        换了个筐更宽的词：`用途` 暗示"这条拿干什么"，`备注` 允许写任何提醒自己的话
        （换绑手机 138****2210 / 只在发版流水线里用 / 对账出问题时才登）。
        三个落点：清单行第二行（单行省略号）+ 展开面板（完整，跨 2 列）+ 抽屉表单（**选填**）。
        ⚠️ 它是选填 ⇒ **不参与保存按钮的禁用判据**（"有才写"的字段不该拦提交）；
           为空时行上不出现，面板里显示 `—`（保留格子，免得行的层次随内容跳）。

     ⚠️ 成对并排**先量再配**：平台（输入框，可变宽）+ 凭据类型（两颗胶囊）并排、
        环境 + 轮换周期并排（周期由环境带出来）。早先平台还是三颗胶囊时量过：
        合计约 195px / 可用 206px，刚好装下 —— 那时"先量再配"是必要条件；
        换成输入框之后半宽更松，但这条规矩留着（内容一变长就得再量一次）。

     ⚠️ **停用与删除是两件事，不是深浅两档**：停用 = 留在清单里、标「已停用」、
        不再计入轮换计划与到期风险（随时可恢复）；删除 = 从清单里移走（给撤销）。
        停用态的行**不再吃告警色** —— 一条已经停用的凭据不该还在拿橙带催你轮换它。

     ⚠️ **轮换要走生成器**，不能只是"把密码改成另一个字符串"：轮换的实质是"生成一个新的、
        够强的、**当场看得见的**凭据"。所以结果是可读、可复制的一串，而不是保存完就变成一个点阵。
        三段（随机 / 容易记住 / PIN）与长度 / 开关那张表在 `GEN_TYPES` 里，标记里不写第二遍。
        · 勾了"含数字 / 含符号"就**至少给一位** —— 否则那是骗人；
        · 颜色只染数字与符号（一位字符属于哪一类）；PIN 与密钥**不染色** —— 那里没有类别可言。

     ⚠️ **这个弹窗的结构不随凭据类型变**（2026-09-27 用户提的："为什么两个位置的轮换弹窗
        还不一致"）。根因是密钥类原来把"选择类型 + 自定义"两整块 `hidden` 掉 ⇒ 从轮换计划点第一条
        （那是 release-bot，一条密钥）看到的框，和从凭据行点密码看到的框长得完全不一样。
        **一个动作有几种入口，就只该有一个样子**；类型之间能变的只有"哪些能选"：
        平台签发的密钥只能是随机串 ⇒ 另两段与「符号」开关**置灰并写明原因**（不是藏起来）。
        文案的界线：**骨架固定**（段的标题、位置、顺序），只有"必须指名对象"的地方才跟着类型走
        （标题里的账号名、复制按钮指名的是密码还是密钥）。
        两个入口的按钮文字也统一成「轮换」—— 原来展开面板写「立即轮换」，
        而它现在要先开生成器，"立即"是个空承诺。

     ⚠️ **清单与轮换计划是同一份数据的两个视图** ⇒ 一切改动只走一个 `renderAll()`
        （增 / 删 / 改 / 停用 / 轮换 / 撤销 / 重新检查全都调它）。少刷一边就会出现
        "徽标说 7 条、清单只剩 6 条"。

     ⚠️ 两个分区（凭据 / 轮换计划）**同页并列** —— 它们是同一件事的两个面、
        能同时成立 ⇒ 圆盘只做「定位 + 当前项随滚动同步」，不做 display 互斥切换。

     ⚠️ 日期一律**按今天现算**：`dueDays` 存的是"还有几天"，绝对日期由它推出来。
        写死绝对日期的话，「61 天后」和那个日期迟早互相打脸。
     ---------------------------------------------------------------------------- -->'''

NEW_CSS = r'''        /* ============================================================
           账户 · 凭据清单
           —— 这张清单只回答一件事：**这条凭据现在还能不能用**。
              所以整张清单只有一个颜色语义 = 有效期紧急度（逾期 / 7 天内 / 正常）；
              「这是生产环境」由 .env-tag 用文字说，凭据类型由行首那枚字形说。
           ============================================================ */
        /* 仪表格 3 列：本页只回答三件"动手前要确认的事"（不是通用那套 4 列）。
           写在基础块之后，靠"后定义者赢"覆掉原来的 repeat(4, 1fr)。 */
        .kpi-bar { grid-template-columns: repeat(3, minmax(0, 1fr)); }

        /* 组头是一条细横带，不是"卡中卡"：平台名就是下面那一堆的缩写，
           给它一条底线就够，不再套一层底色。 */
        .ac-group + .ac-group { margin-top: 14px; }
        .ac-group-head {
            display: flex; align-items: center; gap: 8px;
            /* 左内距与行盒的 12px 一致：组头是"下面这一堆"的标题，
               左沿必须与它们对齐。原来写 2px —— 标题比它管的行还靠左 10px，两者不成柱。 */
            padding: 0 12px 8px; margin-bottom: 8px;
            border-bottom: 1px solid var(--border-subtle);
        }
        .ac-group-name { font-size: 12.5px; font-weight: 700; color: var(--text-secondary); }
        .ac-group-count { font-size: 11px; font-weight: 600; color: var(--text-muted); }
        .ac-group-alert {
            display: inline-flex; align-items: center; gap: 4px;
            margin-left: auto; font-size: 11px; font-weight: 700; color: var(--warn-fg);
        }
        /* ⚠️ `[hidden]` 只自带 `display: none`，作者样式里任何 `display` 都会盖掉它 ——
           下面这条不是冗余：组头那条告警自己写了 `display: inline-flex`，
           而筛选会按"可见的那些"把它整个收起。 */
        .ac-group-alert[hidden] { display: none; }

        .ac-item + .ac-item { margin-top: 6px; }
        .ac-row {
            display: grid; grid-template-columns: 28px minmax(0,1fr) auto;
            align-items: center; gap: 12px;
            padding: 10px 12px; border-radius: 10px;
            background: var(--bg-card); border: 1px solid var(--border-subtle);
            cursor: pointer; position: relative;
            transition: border-color .2s ease, background .2s ease, box-shadow .2s ease, transform .2s ease;
        }
        .ac-row:hover { border-color: var(--rc); transform: translateX(2px); box-shadow: var(--shadow-card); }
        .ac-row.active { border-color: var(--rc-fg); background: color-mix(in srgb, var(--rc) 6%, var(--bg-card)); }
        /* 逾期色条走 inset 阴影：border-left 参与盒模型，会把**整行内容右移 2px**、
           与上一行不左对齐。两条都要写 —— .ac-row:hover 与 .ac-row.alert 同特异性、
           后者在后，只写 .alert 会把 hover 的投影整个吃掉。 */
        .ac-row.alert { box-shadow: inset 3px 0 0 var(--bar-warn); }
        .ac-row.alert:hover { box-shadow: inset 3px 0 0 var(--bar-warn), var(--shadow-card); }

        /* 行首那枚字形 = 凭据类型（密码 / 密钥）。
           它只回答"这是什么"，不参与告警着色 —— 颜色已经被有效期占用了。 */
        .ac-type {
            width: 28px; height: 28px; border-radius: 8px;
            display: flex; align-items: center; justify-content: center;
            background: var(--bg-subtle); color: var(--text-secondary); flex-shrink: 0;
        }

        .ac-info { min-width: 0; }
        .ac-name {
            font-size: 12.5px; font-weight: 700; margin-bottom: 3px;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0;
        }
        .ac-meta {
            font-size: 11.5px; color: var(--text-muted);
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap; min-width: 0;
        }
        /* 备注上行：**单行 + 省略号**。它长短不一，若让它自己决定行高，
           8 行的第二行会参差不齐（行高被最长那句顶起来）⇒ `flex: 1 1 0` + `min-width: 0`
           让它只吃剩余宽度、永远不把行撑高；完整那句在 title 与展开面板里。
           ⚠️ 色阶比 `.ac-meta` 高一档：备注是**你自己写的内容**（主体），
           环境 tag 是元数据 —— 主体不能比元数据还浅。展开面板里那一格也是这一档。 */
        .ac-note {
            flex: 1 1 0; min-width: 0; color: var(--text-secondary);
            overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .ac-acts { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }
        .ac-act {
            width: 30px; height: 30px; border-radius: 8px; border: 0; background: transparent;
            color: var(--text-muted); display: flex; align-items: center; justify-content: center;
            cursor: pointer; font-family: inherit;
            transition: background .15s ease, color .15s ease;
        }
        .ac-act:hover { background: var(--bg-hover); color: var(--text-primary); }
        .ac-act:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
        /* 行尾动作栏**全部常驻**（2026-09-27 从"悬停浮出"改回来）。
           原来那三个管理动作用 `visibility: hidden` 藏着 —— 而 visibility 是**照占宽度**的：
           8 行里每一行的「复制」与折叠箭头之间都空着约 102px，什么也不换。
           本仓那条判据就是冲着它写的：**绝不要"占列 + 隐藏"**（付了宽度，什么也没换来）。
           走哪一条要看**内容占多宽**：本例 账号 + 胶囊 + 环境 + 备注 只占行宽的左三分之一
           ⇒ 动作**常驻**填上，做"安静"（无框 + muted，悬停才上色）。
           （另一半路是"内容几乎铺满 ⇒ 动作绝对定位 + 元数据让位"，本页用不上。） */
        /* 最高频的那件事（把凭据拿走）比其余亮一档。
           ⚠️ 类名**必须带页面前缀**：这里最初写的是 `.ac-act.main` —— 而 `.main` 是**外壳的
           滚动容器类**（`flex:1; overflow-y:auto; padding:24px; background:--bg-card;
           border:1px solid --border-card; border-radius:20px`）。同特异性下后定义者赢只覆盖了
           `color`，其余六条全部落在按钮上 ⇒ 复制钮变成一个 24px 内距的白底圆角大框、
           图标浮在里面（用户截图问"复制图标怎么了"）。
           判据：**新类名要和全页既有类求交集**，尤其 `main / app / detail / card / tab` 这类短词。
           外壳那一堆都是**不带前缀**的，所以本页新增一律 `ac-` 开头。 */
        .ac-lead { color: var(--text-secondary); }
        /* 展开钮是**真 button**（它是这一行的键盘入口）⇒ 需要按钮重置 + 自己的焦点环 */
        .ac-expand {
            width: 30px; height: 30px; padding: 0; border: 0; background: transparent;
            color: var(--text-muted); border-radius: 8px;
            display: inline-flex; align-items: center; justify-content: center;
            cursor: pointer; font-family: inherit;
            transition: transform .3s cubic-bezier(.34,1.4,.64,1), background .15s ease, color .15s ease;
        }
        .ac-expand:hover { background: var(--bg-hover); color: var(--text-primary); }
        .ac-expand:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
        .ac-item.open .ac-expand { transform: rotate(180deg); }

        /* 展开面板：grid-template-rows 0fr/1fr —— 内容永不被裁 */
        .ac-detail {
            display: grid; grid-template-rows: 0fr; opacity: 0;
            transition: grid-template-rows .38s cubic-bezier(.4,0,.2,1), opacity .28s ease;
        }
        .ac-item.open .ac-detail { grid-template-rows: 1fr; opacity: 1; }
        .ac-detail-inner { overflow: hidden; min-height: 0; }
        .ac-detail-pad { padding: 12px 12px 14px 52px; }

        /* 明文那一格。显示有时限 —— 后面那句提示不是装饰，
           它解释了"为什么这里的字符是点阵的"。密钥不回显，所以这一格直接不出现。 */
        .ac-secret {
            display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
            padding: 9px 12px; border-radius: 9px; background: var(--bg-subtle);
        }
        .ac-secret-label { font-size: 11px; font-weight: 700; color: var(--text-secondary); }
        .ac-secret-val {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 12.5px; letter-spacing: .1em; color: var(--text-primary); min-width: 128px;
        }
        .ac-secret-val.is-plain { letter-spacing: 0; }
        .ac-secret-tip { font-size: 11px; color: var(--text-muted); margin-left: auto; }

        .ac-detail-grid {
            display: grid; grid-template-columns: repeat(3, minmax(0,1fr));
            gap: 12px 18px; margin-top: 14px;
        }
        .ac-detail-item { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
        .ac-detail-item .label { font-size: 11px; color: var(--text-muted); }
        .ac-detail-item .value { font-size: 12.5px; font-weight: 600; }
        .ac-detail-item .value.small { font-weight: 500; color: var(--text-secondary); }
        /* 值是一整句话的字段跨 2 列：塞进一格会被挤成好几行，而它排在最后
           ⇒ 正好落在「下次到期」右边，把 3 列网格尾行那个空位填掉（4 个短字段 = 3 + 1）。
           ⚠️ 不能写 `grid-column: 1 / -1`（那会自己另起一行、空位又回来了）；
              也不能一路用 `span 2`：≤560px 只剩 1 列时它会撑出第二个隐式列。 */
        .ac-detail-item.wide { grid-column: span 2; }
        .ac-detail-actions {
            display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
            margin-top: 14px; padding-top: 12px;
            border-top: 1px dashed var(--border-subtle);
        }
        .ac-detail-actions .spacer { flex: 1; }
        /* 面板右侧那句只说"管理动作在哪"，不是动作本身 —— 灰、小、不可点 */
        .ac-detail-note { font-size: 11px; color: var(--text-muted); }

        /* 轮换计划：按日期升序的一条时间线，逾期置顶并着色 */
        .ac-time { display: flex; flex-direction: column; }
        .ac-time-item {
            display: grid; grid-template-columns: 64px minmax(0,1fr) auto;
            align-items: center; gap: 12px;
            padding: 10px 0; border-top: 1px solid var(--border-subtle);
        }
        .ac-time-item:first-child { border-top: 0; }
        .ac-time-when { display: flex; flex-direction: column; gap: 2px; }
        .ac-time-date { font-size: 12px; font-weight: 700; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .ac-time-rel { font-size: 10.5px; color: var(--text-muted); }
        .ac-time-item.overdue .ac-time-date,
        .ac-time-item.overdue .ac-time-rel,
        .ac-time-item.soon .ac-time-rel { color: var(--warn-fg); }
        .ac-time-body { min-width: 0; }
        .ac-time-title {
            font-size: 12.5px; font-weight: 700; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
        }
        .ac-time-meta { font-size: 11.5px; color: var(--text-muted); margin-top: 3px; }

        .ac-help {
            width: 20px; height: 20px; border-radius: 999px;
            /* 这个圆点的形只靠那条边 ⇒ 用输入框那一档描边（≥3:1），不用只分隔区块的 --border-subtle */
            border: 1px solid var(--border-field); background: transparent;
            color: var(--text-muted); font-family: inherit; font-size: 11px; font-weight: 700;
            line-height: 1; cursor: help; flex-shrink: 0;
            display: inline-flex; align-items: center; justify-content: center;
        }
        .ac-help:hover { color: var(--text-primary); }
        .ac-help:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }

        /* 状态徽标：本页不再引内容区那一套，自带一份（Tab / Hero 也用得上）。
           正常态**不占颜色** —— 整张清单上只有"要紧的"才有底色。 */
        .badge { font-size: 10.5px; font-weight: 700; padding: 3px 9px; border-radius: 999px; flex-shrink: 0; white-space: nowrap; letter-spacing: .01em; }
        .badge.ok { background: var(--ok-bg); color: var(--ok-fg); }
        .badge.warn { background: var(--warn-bg); color: var(--warn-fg); }
        .badge.danger { background: var(--danger-bg); color: var(--danger-fg); }
        .badge.idle { background: var(--idle-bg); color: var(--idle-fg); }
        .badge.info { background: var(--info-bg); color: var(--info-fg); }
        .badge.plain { background: var(--bg-subtle); color: var(--text-secondary); }
        .env-tag {
            font-size: 9.5px; font-weight: 800; letter-spacing: .1em; text-transform: uppercase;
            padding: 2px 6px; border-radius: 4px;
            border: 1px solid var(--border-strong); color: var(--text-muted);
        }

        /* ============================================================
           添加 / 编辑账户（右侧抽屉）
           —— 用抽屉而不是整页表单：填的时候得**看得见清单**（平台只有三个、
              环境只有三个、账号名还不能重复），抽屉正好把左边那半留着。
              一次性动作也不该为它开独立窗口 —— 那是留给"要一直盯着的流"的。
           ============================================================ */
        /* 层次：抽屉(190) < 弹窗 / ⌘K(200) < Toast(300)。
           抽屉刻意压在弹窗**下面** —— 抽屉里点保存/删除引出的二次确认必须浮在它之上；
           ⌘K 是全局快捷键，按下去就该盖在最上面，而不是被自己填了一半的表单挡住。 */
        .ac-drawer { position: fixed; inset: 0; z-index: 190; }
        .ac-drawer[hidden] { display: none; }
        .ac-drawer-mask { position: absolute; inset: 0; background: var(--scrim); }
        .ac-drawer-panel {
            position: absolute; top: 0; right: 0; bottom: 0;
            width: min(460px, calc(100% - 32px));
            display: flex; flex-direction: column;
            background: var(--bg-card);
            border-left: 1px solid var(--border-card);
            box-shadow: var(--shadow-float);
            animation: ac-drawer-in .26s cubic-bezier(.4, 0, .2, 1);
        }
        @keyframes ac-drawer-in { from { transform: translateX(28px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .ac-drawer-panel { animation: none; } }

        .ac-drawer-head {
            display: flex; align-items: flex-start; gap: 12px;
            padding: 16px 18px 14px;
            border-bottom: 1px solid var(--border-subtle);
        }
        .ac-drawer-head > div { flex: 1; min-width: 0; }
        .ac-drawer-title { font-size: 15px; font-weight: 800; }
        .ac-drawer-sub { font-size: 11.5px; color: var(--text-muted); margin-top: 5px; line-height: 1.55; }
        .ac-drawer-head .modal-close { flex-shrink: 0; }
        .ac-drawer-body {
            flex: 1; overflow-y: auto; min-height: 0;
            padding: 16px 18px 20px;
            display: flex; flex-direction: column; gap: 14px;
        }
        /* 底部动作行贴的是**它压着的那个面**（面板自己是白卡）⇒ 用区块底那一档 */
        .ac-drawer-foot {
            display: flex; align-items: center; gap: 8px;
            padding: 12px 18px;
            background: var(--bg-subtle);
            border-top: 1px solid var(--border-subtle);
        }
        .ac-drawer-foot .spacer { flex: 1; }
        /* 抽屉开着的时候背后那一列不许跟着滚（滚轮落在遮罩上会带着清单跑） */
        .main.ac-lock { overflow: hidden; }

        /* 字段。只有"两个单值并排"才用两列；其余一律占满 */
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
        .inp.mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
        .inp::placeholder { color: var(--text-muted); }
        .inp:focus { outline: none; border-color: var(--m-main); box-shadow: 0 0 0 3px var(--m-soft); }
        .inp.bad { border-color: var(--danger-fg); }

        /* 三选一的胶囊：「归类给选不给填」—— 平台 / 类型 / 环境都是有限集合 */
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
        .chip.on {
            background: var(--bg-card); color: var(--text-primary);
            box-shadow: inset 0 0 0 1.5px var(--rc-fg);
        }
        .chip.on::before { content: ""; width: 6px; height: 6px; border-radius: 999px; background: var(--rc-fg); flex-shrink: 0; }

        /* 筛选条：平台胶囊 + 关键词，同一条、贴着清单 —— 它是清单的**控件行**，
           不是独立一块 ⇒ 不套底色、不另占卡高（高度就是一组控件的高度）。 */
        .ac-filter { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
        #credPlatformChips { flex: 1; }
        /* 胶囊里的计数。选中那颗的数字也跟着染 —— 否则"选中了哪一颗"要读文字才知道 */
        .chip-n { font-weight: 800; color: var(--text-muted); }
        .chip.on .chip-n { color: var(--rc-fg); }
        .ac-search {
            display: inline-flex; align-items: center; gap: 6px; flex-shrink: 0;
            height: 28px; padding: 0 10px; border-radius: 999px;
            background: var(--bg-subtle); border: 1px solid var(--border-field); color: var(--text-muted);
        }
        /* 它是个输入框 ⇒ 描边用输入档（≥3:1），焦点与表单里的 `.inp` 同一套 */
        .ac-search:focus-within { border-color: var(--m-main); box-shadow: 0 0 0 3px var(--m-soft); }
        .ac-search input {
            width: 148px; min-width: 0; padding: 0; margin: 0;
            border: 0; background: none; outline: none;
            font-family: inherit; font-size: 12px; color: var(--text-primary);
        }
        .ac-search input::placeholder { color: var(--text-muted); }
        .ac-empty { padding: 22px 12px; text-align: center; font-size: 12px; color: var(--text-muted); }
        .btn[disabled] { opacity: .45; cursor: not-allowed; }

        /* 停用态：这一行还在，但已经不是"有效凭据"了 ⇒ 整体退到 muted、动作收起来 */
        .ac-row.is-off { background: var(--bg-subtle); }
        .ac-row.is-off .ac-name,
        .ac-row.is-off .ac-note,
        .ac-row.is-off .ac-type { color: var(--text-muted); }
        .ac-act[disabled] { opacity: .38; cursor: not-allowed; }
        .ac-act[disabled]:hover { background: transparent; color: var(--text-muted); }
        .ac-act.danger:hover { background: var(--danger-bg); color: var(--danger-fg); }

        /* ============================================================
           轮换凭据 · 密码生成器（弹窗）
           —— 三段（随机 / 容易记住 / PIN）各配一组选项，结果实时重生成。
              这个框里颜色只承载**一种**语义：字符类别（字母 vs 数字与符号）。
              PIN 不染色 —— 那里全是数字，"染出来"等于没有信息，靠字号表达就够。
           ============================================================ */
        .modal.modal-gen { max-width: 520px; }   /* 提高一档特异性，与 `.modal` 的先后无关 */
        .modal-actions .spacer { flex: 1; }

        .gen-sec { display: flex; flex-direction: column; gap: 10px; }
        .gen-sec + .gen-sec { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border-subtle); }
        .gen-sec-label { font-size: 12px; font-weight: 700; color: var(--text-secondary); }

        /* 三段选择器：灰槽 + 白药丸。形状与选中态抄页内既有的 `.sd-tabs` 口径 ——
           白药丸压灰槽只有 1.08:1，靠底色差根本看不见 ⇒ 描一圈 + 文字染 --rc-fg。 */
        .seg { display: flex; gap: 3px; padding: 3px; border-radius: 11px; background: var(--bg-subtle); }
        .seg-btn {
            flex: 1; display: inline-flex; align-items: center; justify-content: center;
            padding: 7px 10px; border: 0; border-radius: 9px; background: transparent;
            color: var(--text-muted); font-family: inherit; font-size: 12px; font-weight: 700;
            cursor: pointer; transition: background .15s ease, color .15s ease, box-shadow .15s ease;
        }
        .seg-btn:hover { color: var(--text-primary); }
        .seg-btn:focus-visible { outline: 2px solid var(--focus-ring); outline-offset: 1px; }
        .seg-btn[aria-selected="true"] {
            background: var(--bg-card); color: var(--rc-fg);
            box-shadow: inset 0 0 0 1.5px var(--rc-fg);
        }
        /* 置灰的段 / 开关：同一个位置、同一个形状，只是选不了 —— 并保留 title 说明为什么。
           用 `:disabled` 而不是只降透明度：它还得同时挡住点击与 Tab。 */
        .seg-btn:disabled, .sw:disabled { opacity: .4; cursor: not-allowed; }
        .seg-btn:disabled:hover { color: var(--text-muted); }
        .sw:disabled .sw-label { color: var(--text-muted); }

        /* 一行：标签 / 滑块 / 数字框。后两者控的是**同一个值**，双向同步 */
        .gen-row { display: grid; grid-template-columns: 56px minmax(0,1fr) 64px; align-items: center; gap: 12px; }
        .gen-row-label { font-size: 12px; color: var(--text-secondary); font-weight: 600; }
        .rng {
            -webkit-appearance: none; appearance: none;
            width: 100%; height: 4px; margin: 0; border-radius: 999px;
            background: var(--border-strong); outline: none;
        }
        .rng::-webkit-slider-thumb {
            -webkit-appearance: none; appearance: none;
            width: 18px; height: 18px; border-radius: 999px; cursor: grab;
            background: var(--bg-card); border: 1px solid var(--border-field);
            box-shadow: 0 1px 3px rgba(15, 23, 42, .18);
        }
        .rng::-moz-range-thumb {
            width: 18px; height: 18px; border-radius: 999px; cursor: grab;
            background: var(--bg-card); border: 1px solid var(--border-field);
        }
        .rng:focus-visible { box-shadow: 0 0 0 3px var(--m-soft); }
        .num-box {
            width: 100%; box-sizing: border-box; text-align: center;
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 13px; font-weight: 700;
            padding: 6px 6px; border-radius: 9px;
            background: var(--bg-card); color: var(--text-primary);
            border: 1px solid var(--border-field);
        }
        .num-box:focus { outline: none; border-color: var(--m-main); box-shadow: 0 0 0 3px var(--m-soft); }

        /* 开关：药丸 + 圆点。**圆点的位置本身就是形状线索**（左关 / 右开），不靠颜色区分状态 */
        .gen-switches { display: flex; gap: 24px; flex-wrap: wrap; margin-top: 14px; }
        .gen-switches[hidden] { display: none; }
        .sw {
            display: inline-flex; align-items: center; gap: 9px;
            background: none; border: 0; padding: 0; cursor: pointer; font-family: inherit;
        }
        .sw-track {
            width: 38px; height: 22px; border-radius: 999px; flex-shrink: 0;
            background: var(--border-strong); position: relative;
            transition: background .18s ease;
        }
        .sw-track::after {
            content: ""; position: absolute; top: 2px; left: 2px;
            width: 18px; height: 18px; border-radius: 999px;
            background: var(--bg-card); box-shadow: 0 1px 2px rgba(15, 23, 42, .25);
            transition: transform .18s cubic-bezier(.34, 1.4, .64, 1);
        }
        .sw[aria-checked="true"] .sw-track { background: var(--m-main); }
        .sw[aria-checked="true"] .sw-track::after { transform: translateX(16px); }
        .sw-label { font-size: 12px; font-weight: 600; color: var(--text-secondary); }
        .sw:focus-visible .sw-track { box-shadow: 0 0 0 3px var(--m-soft); }

        /* 生成结果。只读展示 ⇒ 用区块底而不是白底（白底会被当成输入框） */
        .gen-out {
            display: flex; align-items: center; justify-content: center;
            min-height: 66px; padding: 14px 16px;
            border-radius: var(--r-md);
            background: var(--bg-subtle); border: 1px solid var(--border-subtle);
            overflow-wrap: anywhere; user-select: all;
        }
        .gen-out code {
            font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
            font-size: 17px; font-weight: 700; line-height: 1.5;
            color: var(--text-primary); text-align: center;
        }
        .gen-out code.big { font-size: 22px; letter-spacing: .22em; }
        /* 数字与符号染强调色：这里颜色只说一件事 —— 这一位属于哪一类字符 */
        .gen-out .b { color: var(--m-ink); }
        .gen-hint { font-size: 11.5px; color: var(--text-muted); line-height: 1.6; }

        /* ============================================================
           响应式
           ============================================================ */
        @media (max-width: 980px) {
            .kpi-bar { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
            .main { padding: 16px; }
            .detail { gap: 16px; }
            .ac-detail-pad { padding-left: 12px; }
            .ac-detail-grid { grid-template-columns: minmax(0,1fr) minmax(0,1fr); }
            /* Hero 在窄屏：右侧那一堆控件换到第二行铺开（与项目详情页同一个断点）。
               「最后检查」只是新鲜度提示、不是动作，整格收起；「重新检查」留着。 */
            .hero-bar { flex-wrap: wrap; gap: 10px; }
            .hero-bar-right { width: 100%; justify-content: space-between; gap: 10px; }
            .hero-name { font-size: 14px; }
            .hero-sync { padding-right: 0; border-right: 0; margin-right: auto; }
            .hero-sync .last-sync { display: none; }
        }
        @media (max-width: 560px) {
            .kpi-bar { grid-template-columns: 1fr; }
            .ac-detail-grid { grid-template-columns: minmax(0,1fr); }
            .ac-detail-item.wide { grid-column: auto; }
            .ac-time-item { grid-template-columns: 56px minmax(0,1fr); row-gap: 8px; }
            .ac-time-item .btn { grid-column: 1 / -1; justify-self: start; }
            .ac-row { grid-template-columns: 28px minmax(0,1fr); row-gap: 8px; }
            .ac-acts { grid-column: 1 / -1; justify-content: flex-end; }
            /* 窄屏抽屉占满整宽，两列字段回落单列 */
            .ac-drawer-panel { width: 100%; border-left: 0; }
            .field.two { grid-template-columns: minmax(0, 1fr); }
            .modal-actions { flex-direction: column-reverse; }
            .modal-actions .modal-actions .btn,
            .modal-actions .btn { justify-content: center; }
        }
'''

NEW_CONTENT = r'''            <!-- ========== 页面级仪表 ==========
                 三格各自回答一件"动手前要确认的事"：哪条不能用了 / 最近换过没 /
                 我拿不拿得到明文。**不是两张卡徽标的复述** ——
                 徽标负责"这张卡里有多少"，这里负责"我下一步要动手前得知道什么"。 -->
            <div class="kpi-bar">
                <div class="kpi warn" id="kpiRisk">
                    <div class="kpi-top"><span class="kpi-ico" aria-hidden="true" data-ico="alert" data-ico-size="15"></span><span class="kpi-label">到期风险</span></div>
                    <div class="kpi-val"><span id="kpiRiskCount">2</span><span class="kpi-unit">条</span></div>
                    <div class="kpi-sub warn-text" id="kpiRiskSub">正在读取…</div>
                </div>
                <div class="kpi">
                    <div class="kpi-top"><span class="kpi-ico" aria-hidden="true" data-ico="refresh" data-ico-size="15"></span><span class="kpi-label">最近轮换</span></div>
                    <div class="kpi-val" id="kpiRotateVal">—</div>
                    <div class="kpi-sub" id="kpiRotateSub">—</div>
                </div>
                <div class="kpi">
                    <div class="kpi-top"><span class="kpi-ico" aria-hidden="true" data-ico="eye" data-ico-size="15"></span><span class="kpi-label">可看明文</span></div>
                    <div class="kpi-val"><span id="kpiPlainCount">0</span><span class="kpi-unit">/ <span id="kpiPlainTotal">0</span> 条</span></div>
                    <div class="kpi-sub" id="kpiPlainSub">密钥与令牌不回显，只能重置</div>
                </div>
            </div>

            <!-- ========== 凭据清单 ========== -->
            <section class="ops-card" id="credCard" data-section="cred">
                <h2 class="ops-card-head" role="button" tabindex="0" aria-expanded="true" aria-controls="credCardBody" onclick="toggleOpsCard('credCard')">
                    <span class="ops-card-head-left">
                        <span class="card-icon" aria-hidden="true" data-ico="key" data-ico-size="15"></span>
                        <span class="ops-card-title">凭据</span>
                        <span class="ops-card-badge" id="credCardBadge">—</span>
                    </span>
                    <span class="ops-card-head-right">
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation();openCredForm()"><span data-ico="plus" data-ico-size="14"></span> 添加账户</button>
                        <span class="ops-fold-icon" aria-hidden="true" data-ico="chevD" data-ico-size="15"></span>
                    </span>
                </h2>
                <div class="ops-card-body" id="credCardBody">
                    <div class="ops-card-body-inner">
                        <!-- 筛选条。**两个控件而不是一个分段**：平台与关键词能同时成立
                             （在阿里云里搜 bot），能同时成立的就该是两个控件。
                             过滤走**已渲染的 DOM**（`el.hidden`）、不重新渲染 ⇒
                             行的展开状态、输入焦点、滚动位置都不会被打断。 -->
                        <div class="ac-filter">
                            <div class="chip-row" id="credPlatformChips" role="radiogroup" aria-label="按平台筛选"></div>
                            <label class="ac-search">
                                <span data-ico="search" data-ico-size="14" aria-hidden="true"></span>
                                <!-- 外层 label 里只有一枚图标 ⇒ **它没有可访问名**，
                                     必须显式给 aria-label（placeholder 不算名字）。 -->
                                <input id="credSearch" type="search" placeholder="搜账号 / 备注" autocomplete="off"
                                       aria-label="搜索凭据" oninput="applyCredFilter()"
                                       onkeydown="if(event.key==='Escape'){this.value='';applyCredFilter();}" />
                            </label>
                        </div>
                        <div class="ac-empty" id="credEmpty" hidden>没有匹配的凭据 —— 换个词，或点回「全部」。</div>

                        <!-- 分组与行都由 CREDS 现算出来 —— 计数写在标记里就一定会说旧话 -->
                        <div id="credGroups"></div>
                    </div>
                </div>
            </section>

            <!-- ========== 轮换计划 ========== -->
            <section class="ops-card" id="rotateCard" data-section="rotate">
                <h2 class="ops-card-head" role="button" tabindex="0" aria-expanded="true" aria-controls="rotateCardBody" onclick="toggleOpsCard('rotateCard')">
                    <span class="ops-card-head-left">
                        <span class="card-icon" aria-hidden="true" data-ico="refresh" data-ico-size="15"></span>
                        <span class="ops-card-title">轮换计划</span>
                        <span class="ops-card-badge" id="rotateCardBadge">—</span>
                    </span>
                    <span class="ops-card-head-right">
                        <!-- 策略不是界面上能自证的事，所以给一个 ? 而不是一段常驻说明。
                             卡头整条本身是"点开折叠"的按钮 ⇒ 这里要拦住冒泡。 -->
                        <button class="ac-help" type="button" aria-label="轮换策略" onclick="event.stopPropagation()"
                                title="生产环境凭据 90 天强制轮换，测试 / 开发环境 180 天。逾期未轮换的凭据会在发版前的检查里被拦下，并在这里置顶标红。">?</button>
                        <span class="ops-fold-icon" aria-hidden="true" data-ico="chevD" data-ico-size="15"></span>
                    </span>
                </h2>
                <div class="ops-card-body" id="rotateCardBody">
                    <div class="ops-card-body-inner">
                        <div class="ac-time" id="rotateList"></div>
                    </div>
                </div>
            </section>
'''

SLOT_BODY = r'''                <div class="slot-body">
                    <!-- 最近访问：都是"刚动过的那几条凭据"，点一条滚到清单里那条 -->
                    <div class="slot-panel active" data-panel="recent">
                        <button class="recent-item" type="button" onclick="activatePanel('cred')">
                            <span class="recent-icon" data-ico="lock" data-ico-size="15"></span>
                            <span class="recent-text">xingchen_admin</span>
                            <span class="recent-time">今天</span>
                        </button>
                        <button class="recent-item" type="button" onclick="activatePanel('cred')">
                            <span class="recent-icon" data-ico="lock" data-ico-size="15"></span>
                            <span class="recent-text">ops@lucky.com</span>
                            <span class="recent-time">今天</span>
                        </button>
                        <button class="recent-item" type="button" onclick="activatePanel('rotate')">
                            <span class="recent-icon" data-ico="alert" data-ico-size="15"></span>
                            <span class="recent-text">release-bot · 已逾期</span>
                            <span class="recent-time">3 天前</span>
                        </button>
                        <button class="recent-item" type="button" onclick="activatePanel('cred')">
                            <span class="recent-icon" data-ico="lock" data-ico-size="15"></span>
                            <span class="recent-text">xingchen_ops</span>
                            <span class="recent-time">3 天前</span>
                        </button>
                    </div>

                    <!-- 快捷操作 -->
                    <div class="slot-panel" data-panel="quick">
                        <div class="quick-grid">
                            <button class="quick-btn" onclick="openCredForm()">
                                <span data-ico="plus" data-ico-size="15"></span>
                                添加账户
                            </button>
                            <button class="quick-btn" onclick="activatePanel('rotate')">
                                <span data-ico="refresh" data-ico-size="15"></span>
                                轮换计划
                            </button>
                            <button class="quick-btn" onclick="refreshAll()">
                                <span data-ico="check" data-ico-size="15"></span>
                                重新检查
                            </button>
                            <button class="quick-btn" onclick="copyAllUsers()">
                                <span data-ico="copy" data-ico-size="15"></span>
                                导出账号表
                            </button>
                            <button class="quick-btn" onclick="openCmd()">
                                <span data-ico="info" data-ico-size="15"></span>
                                AI 助手
                            </button>
                        </div>
                    </div>

                    <!-- KPI：侧栏这块回答的是**时间与覆盖维度上的量**，
                         页面顶部那四格回答"现在什么状态" —— 两边各说一件事。 -->
                    <div class="slot-panel" data-panel="kpi">
                        <div class="slot-kpi-list">
                            <div class="slot-kpi-item"><span class="slot-kpi-label">本月轮换</span><span class="slot-kpi-value accent" id="slotRotated">0</span></div>
                            <div class="slot-kpi-item"><span class="slot-kpi-label">本月新增</span><span class="slot-kpi-value" id="slotAdded">0</span></div>
                            <div class="slot-kpi-item"><span class="slot-kpi-label">逾期未轮换</span><span class="slot-kpi-value" id="slotOverdue">0</span></div>
                            <div class="slot-kpi-item"><span class="slot-kpi-label">覆盖平台</span><span class="slot-kpi-value" id="slotPlatforms">0</span></div>
                        </div>
                    </div>

                    <!-- AI -->
                    <div class="slot-panel" data-panel="ai">
                        <div class="ai-chat">
                            <div class="ai-msg bot">GitLab 的 release-bot 令牌已逾期 3 天，上一次发版就是被它拦下的。要我现在把轮换步骤列出来吗？</div>
                            <div class="ai-msg user">先看谁会受影响</div>
                            <div class="ai-msg bot">它只在 CI 里用 —— 换之前记得同步更新流水线里的变量，否则下次发版会卡在拉包这一步。</div>
                        </div>
                        <div class="ai-input">
                            <input type="text" placeholder="问点什么…" />
                            <button class="ai-send" type="button" aria-label="发送">
                                <span data-ico="send" data-ico-size="12"></span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

'''

TABS = r'''                <div class="tabs" role="tablist" aria-label="项目详情分区">
                    <button class="tab" role="tab" onclick="demo('总览 Tab')"><span data-ico="dashboard" data-ico-size="15"></span> 总览</button>
                    <button class="tab" role="tab" onclick="demo('任务 Tab')"><span data-ico="task" data-ico-size="15"></span> 任务 <span class="tab-count">5/8</span></button>
                    <button class="tab" role="tab" onclick="location.href='工作-项目-项目详情-Bug-index.html'"><span data-ico="bug" data-ico-size="15"></span> Bug <span class="tab-count">12</span></button>
                    <button class="tab" role="tab" onclick="location.href='work_project_detail_document.html'"><span data-ico="doc" data-ico-size="15"></span> 文档 <span class="tab-count">9</span></button>
                    <button class="tab" role="tab" onclick="location.href='工作-项目-项目详情-运维-index.html'"><span data-ico="rocket" data-ico-size="15"></span> 运维 <span class="tab-count">2·3·4</span></button>
                    <button class="tab" role="tab" onclick="demo('会议 Tab')"><span data-ico="calendar" data-ico-size="15"></span> 会议 <span class="tab-count">2</span></button>
                    <button class="tab active" role="tab" aria-selected="true" onclick="toast('已在账户页','info')"><span data-ico="key" data-ico-size="15"></span> 账户 <span class="tab-count" id="tabCredCount">8</span></button>
                </div>
'''

CMDLIST = r'''        <div class="cmd-list">
            <div class="cmd-item active" data-goto="panel:cred"><div class="cmd-item-icon" data-icon="key"></div><div class="cmd-item-text">凭据 · 分区</div><span class="cmd-kbd">G 1</span></div>
            <div class="cmd-item" data-goto="panel:rotate"><div class="cmd-item-icon" data-icon="refresh"></div><div class="cmd-item-text">轮换计划 · 分区</div><span class="cmd-kbd">G 2</span></div>
            <div class="cmd-item" data-goto="module:dashboard"><div class="cmd-item-icon" data-icon="grid"></div><div class="cmd-item-text">工作台 · 模块</div><span class="cmd-kbd">G D</span></div>
            <div class="cmd-item"><div class="cmd-item-icon" data-icon="check"></div><div class="cmd-item-text">任务清单</div><span class="cmd-kbd">G T</span></div>
            <div class="cmd-item" data-goto="module:calendar"><div class="cmd-item-icon" data-icon="calendar"></div><div class="cmd-item-text">日程 · 模块</div><span class="cmd-kbd">G C</span></div>
            <div class="cmd-item" data-goto="module:life"><div class="cmd-item-icon" data-icon="leaf"></div><div class="cmd-item-text">生活 · 模块</div><span class="cmd-kbd">G L</span></div>
            <div class="cmd-item"><div class="cmd-item-icon" data-icon="briefcase"></div><div class="cmd-item-text">工作</div><span class="cmd-kbd">G W</span></div>
            <div class="cmd-item" data-goto="module:learning"><div class="cmd-item-icon" data-icon="book"></div><div class="cmd-item-text">学习 · 模块</div><span class="cmd-kbd">G S</span></div>
            <div class="cmd-item" data-goto="module:projects"><div class="cmd-item-icon" data-icon="project"></div><div class="cmd-item-text">项目 · 模块</div><span class="cmd-kbd">G P</span></div>
            <div class="cmd-item" data-goto="module:knowledge"><div class="cmd-item-icon" data-icon="file"></div><div class="cmd-item-text">知识库 · 模块</div><span class="cmd-kbd">G K</span></div>
            <div class="cmd-item" data-goto="module:settings"><div class="cmd-item-icon" data-icon="user"></div><div class="cmd-item-text">设置 · 模块</div><span class="cmd-kbd">G ,</span></div>
'''

DRAWER = r'''
<!-- ========== 添加 / 编辑账户：右侧抽屉（浮层，与弹窗同级，放在 .app 之外） ==========
     添加与编辑是**同一张表单** —— 字段完全一样，差别只有两处：
       ① 编辑时密钥那一格留空 = 不更换（添加时必须填，否则这条凭据没有可用的密钥）；
       ② 标题与副标题不同。
     「下次到期」**不给输入框**：它 = 上次轮换 + 轮换周期，机器算得出来 ⇒ 只回显。 -->
<div class="ac-drawer" id="credDrawer" hidden>
    <div class="ac-drawer-mask" onclick="closeCredForm()"></div>
    <aside class="ac-drawer-panel" role="dialog" aria-modal="true" aria-labelledby="cfTitle">
        <header class="ac-drawer-head">
            <div>
                <div class="ac-drawer-title" id="cfTitle">添加账户</div>
                <div class="ac-drawer-sub" id="cfSub">平台自己填，类型 / 环境从已有的里选 —— 清单就是按平台分的。</div>
            </div>
            <button class="modal-close" type="button" onclick="closeCredForm()" aria-label="关闭"><span data-ico="x" data-ico-size="15"></span></button>
        </header>

        <div class="ac-drawer-body">
            <div class="field">
                <label class="field-label" for="cfUser">账号</label>
                <input class="inp mono" id="cfUser" type="text" autocomplete="off" spellcheck="false"
                       placeholder="ops@lucky.com" oninput="syncForm()" />
                <div class="field-hint" id="cfUserHint">同一个平台下不能有两条同名账号</div>
            </div>

            <!-- 平台与凭据类型并排：平台是**自己填的**，类型只能从两类里选。
                 datalist 的候选只来自"已经在用的那些" —— 给建议、不给约束：
                 既不用背拼写（拼错就会多出一个组），也不拦着填新的平台名。 -->
            <div class="field two">
                <div class="field">
                    <label class="field-label" for="cfPlatform">平台</label>
                    <input class="inp" id="cfPlatform" type="text" autocomplete="off" spellcheck="false"
                           list="cfPlatformList" placeholder="阿里云 / GitLab / 自建后台" oninput="syncForm()" />
                    <datalist id="cfPlatformList"></datalist>
                </div>
                <div class="field">
                    <span class="field-label" id="cfTypeLabel">凭据类型</span>
                    <div class="chip-row" id="cfType" role="radiogroup" aria-labelledby="cfTypeLabel">
                        <button class="chip on" type="button" role="radio" aria-checked="true"  data-v="password" onclick="pickChip(this)">密码</button>
                        <button class="chip"    type="button" role="radio" aria-checked="false" data-v="key"      onclick="pickChip(this)">密钥</button>
                    </div>
                </div>
            </div>

            <!-- 环境与周期并排：周期是**由环境带出来的**（生产 90 / 测试与开发 180），
                 本来就相关，放一行里读。 -->
            <div class="field two">
                <div class="field">
                    <span class="field-label" id="cfEnvLabel">环境</span>
                    <div class="chip-row" id="cfEnv" role="radiogroup" aria-labelledby="cfEnvLabel">
                        <button class="chip on" type="button" role="radio" aria-checked="true"  data-v="prod" onclick="pickChip(this)">生产</button>
                        <button class="chip"    type="button" role="radio" aria-checked="false" data-v="test" onclick="pickChip(this)">测试</button>
                        <button class="chip"    type="button" role="radio" aria-checked="false" data-v="dev"  onclick="pickChip(this)">开发</button>
                    </div>
                </div>
                <div class="field">
                    <label class="field-label" for="cfCycle">轮换周期（天）</label>
                    <input class="inp" id="cfCycle" type="number" min="1" step="1" value="90" oninput="syncForm()" />
                </div>
            </div>
            <!-- 到期日 = 上次轮换 + 周期，两个值都不用手填 ⇒ 只回显。
                 开头的数字就是上面那格，把"这是它算出来的"说清楚。 -->
            <div class="field-hint" id="cfDue">下次到期 = 上次轮换 + 轮换周期</div>

            <!-- 「用途」换成「备注」：同一个位置、同一种自由文本，但筐更宽 ——
                 `用途` 暗示"这条拿干什么"，`备注` 允许写任何提醒自己的话。
                 选填：备注本来就是"有才写"，所以它不参与保存按钮的禁用判据。 -->
            <div class="field">
                <label class="field-label" for="cfNote">备注</label>
                <input class="inp" id="cfNote" type="text" placeholder="换绑手机 / 只在发版流水线里用 / 到期前先通知谁" oninput="syncForm()" />
            </div>

            <div class="field">
                <label class="field-label" for="cfSecret">密码 / 密钥</label>
                <input class="inp mono" id="cfSecret" type="password" autocomplete="new-password" oninput="syncForm()" />
                <div class="field-hint" id="cfSecretHint">保存后不回显；密钥只在生成时出现一次</div>
            </div>
        </div>

        <footer class="ac-drawer-foot">
            <button class="btn btn-ghost" type="button" onclick="closeCredForm()">取消</button>
            <span class="spacer"></span>
            <button class="btn btn-primary" type="button" id="cfSave" onclick="saveCredForm()">保存</button>
        </footer>
    </aside>
</div>

<!-- ========== 轮换凭据 · 生成器 ==========
     两个入口：行内展开面板的「轮换」、轮换计划里每条右侧的「轮换」——
     同一个函数、同一个框、同一个样子。
     为什么轮换要经过它：轮换不是"把密码改成另一个字符串"，而是"**生成一个新的、够强的、
     你看得见的**" —— 所以结果必须当场可读、可复制，而不是保存完就变成一个点阵。 -->
<div class="modal-mask" id="genMask">
    <div class="modal modal-gen" role="dialog" aria-modal="true" aria-labelledby="genTitle">
        <div class="modal-head">
            <div class="modal-title" id="genTitle">轮换凭据</div>
            <button class="modal-close" type="button" onclick="closeGen()" aria-label="关闭"><span data-ico="x" data-ico-size="15"></span></button>
        </div>
        <div class="modal-body">

            <div class="gen-sec" id="genTypeSec">
                <!-- 段的标题**不随类型变**（「选择生成方式」对密码与密钥都成立）——
                     只有"必须指名对象"的地方才跟着类型走：弹窗标题里的账号名、复制按钮指名的
                     是密码还是密钥。骨架一样，才不会被读成两个弹窗。 -->
                <div class="gen-sec-label" id="genTypeLabel">选择生成方式</div>
                <div class="seg" role="tablist" aria-labelledby="genTypeLabel">
                    <button class="seg-btn" type="button" role="tab" aria-selected="true"  data-gen="random" onclick="pickGenType('random')">随机</button>
                    <button class="seg-btn" type="button" role="tab" aria-selected="false" data-gen="words"  onclick="pickGenType('words')">容易记住</button>
                    <button class="seg-btn" type="button" role="tab" aria-selected="false" data-gen="pin"    onclick="pickGenType('pin')">PIN</button>
                </div>
            </div>

            <div class="gen-sec" id="genOptSec">
                <!-- 段标题一律**不指名对象**（「自定义新密码」对一把密钥是错的）：
                     三段骨架固定，能变的只有"哪些能选"。 -->
                <div class="gen-sec-label">调整参数</div>
                <div class="gen-row">
                    <span class="gen-row-label" id="genLenLabel">字符</span>
                    <input class="rng" id="genLen" type="range" min="8" max="32" step="1" value="17"
                           aria-labelledby="genLenLabel" oninput="onGenLenInput()" />
                    <input class="num-box" id="genLenNum" type="number" min="8" max="32" step="1" value="17"
                           aria-labelledby="genLenLabel" oninput="onGenLenNum()" />
                </div>
                <!-- 开关随类型换：随机 = 数字/符号，容易记住 = 首字母大写/完整单词，PIN = 没有 -->
                <div class="gen-switches" id="genSwitches"></div>
            </div>

            <div class="gen-sec">
                <div class="gen-sec-label">生成结果</div>
                <div class="gen-out"><code id="genOut"></code></div>
                <div class="gen-hint" id="genHint"></div>
            </div>

        </div>
        <div class="modal-actions">
            <button class="btn btn-ghost" type="button" id="genCopy" onclick="copyGen()"></button>
            <span class="spacer"></span>
            <button class="btn btn-ghost" type="button" onclick="regen()"><span data-ico="refresh" data-ico-size="14"></span> 换一个</button>
            <button class="btn btn-primary" type="button" onclick="applyGen()">用它轮换</button>
        </div>
    </div>
</div>
'''

NEW_SECTIONS = '''    /* 本页的两个分区。**会变的值不写在这儿**（条数由 sectionCount() 现算）——
       否则删掉一条凭据之后，圆盘名称条与侧栏副标题还在说旧数字。
       只有两个分区是有意的：这里**没有**「取用记录」—— 见文件头那条判据。 */
    const SECTIONS = [
        { key: 'cred',   label: '凭据',     icon: 'key',     count: '8 条',
          desc: '项目在外部平台上的账号、密钥与令牌' },
        { key: 'rotate', label: '轮换计划', icon: 'refresh', count: '7 条',
          desc: '按到期日排的下一次轮换，逾期置顶' }
    ];'''

NEW_SECTIONCOUNT = '''    function sectionCount(sec) {
        if (sec.key === 'cred')   return CREDS.length + ' 条';
        if (sec.key === 'rotate') return rotatePlan().length + ' 条';
        return sec.count;
    }'''

NEW_ICONS_EXTRA = """        /* 账户页补的：锁 / 眼睛 / 云 / 代码 / 后台 / 人 / 盾 / 时钟 / 波形…… */
        lock: '<rect x="4.6" y="10.4" width="14.8" height="10.2" rx="2.4"/><path d="M8.2 10.4V7.6a3.8 3.8 0 0 1 7.6 0v2.8"/><path d="M12 14.6v2.4"/>',
        eye: '<path d="M2.6 12S6.1 5.8 12 5.8 21.4 12 21.4 12 17.9 18.2 12 18.2 2.6 12 2.6 12z"/><circle cx="12" cy="12" r="2.9"/>',
        shield: '<path d="M12 3.2l7 2.9v6c0 4.4-2.9 8.2-7 9.1-4.1-.9-7-4.7-7-9.1v-6z"/><path d="m9.2 12.1 2 2 3.8-4"/>',
        activity: '<path d="M3 12.4h3.9l2.4-6.2 4.1 12.4 2.5-6.2H21"/>',
        send: '<path d="M21 3.4 3.4 10.6l6.4 2.6 2.6 6.4z"/><path d="M21 3.4 9.8 13.2"/>',
        app: '<rect x="3" y="4.4" width="18" height="15.6" rx="2.4"/><path d="M3 9.2h18"/><path d="M6.6 6.8h.01M9.4 6.8h.01"/>',
        ban: '<circle cx="12" cy="12" r="8.4"/><path d="m6.1 17.9 11.8-11.8"/>',
        link: '<path d="M10.4 13.6a3.6 3.6 0 0 0 5.1 0l2.9-2.9a3.6 3.6 0 0 0-5.1-5.1l-1.2 1.2"/><path d="M13.6 10.4a3.6 3.6 0 0 0-5.1 0l-2.9 2.9a3.6 3.6 0 0 0 5.1 5.1l1.2-1.2"/>',
        database: '<ellipse cx="12" cy="6.2" rx="7.4" ry="3"/><path d="M4.6 6.2v11.6c0 1.7 3.3 3 7.4 3s7.4-1.3 7.4-3V6.2"/><path d="M4.6 12c0 1.7 3.3 3 7.4 3s7.4-1.3 7.4-3"/>',
        search: '<circle cx="11" cy="11" r="7.2"/><path d="m16.3 16.3 4.3 4.3"/>',
"""

NEW_JS = r'''
    /* ============================================================
       账户 · 数据
       —— 一份数据就是全部：清单 / 轮换计划 / 每处计数都由它现算。
          任何数字都不在标记里写第二遍（写死了就会在改动之后继续说旧话）。
       ============================================================ */
    /* 界面上的内容全靠拼字符串进 `innerHTML` ⇒ **用户自己填的那些必须先转义**：
       备注里一个 `"` 会把 `title` 属性截断，密码里一个 `<` 会吞掉后面半行标记 ——
       两者都不报错，只是把这一行显示坏，很难往回找。而密码里出现符号是常态。
       （不用它的地方：弹窗、Toast、表单回填都走 `textContent` / `.value`，天然安全。） */
    const esc = v => String(v == null ? '' : v)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

    /* 平台**由自己输入**（2026-09-27 用户定的）⇒ 这里没有一张固定表。
       分组维度 = 数据里真出现过的那些字符串，现算 —— 清单里有哪几个平台，
       只取决于手上真有哪几个，不由界面先验地规定。
       顺序取**第一次出现的先后**：新增的平台排在末尾，已有的不跳位。 */
    function platformsInUse() {
        const seen = [];
        CREDS.forEach(c => { if (!seen.includes(c.platform)) seen.push(c.platform); });
        return seen;
    }
    /* 凭据类型。plain = 能不能回显明文 —— 这一条同时决定
       行尾那个常驻按钮是"复制密码"还是"复制账号"，以及展开面板里有没有明文那一格。 */
    const TYPES = {
        password:  { name: '密码',       icon: 'lock', plain: true  },
        key:       { name: '密钥',       icon: 'key',  plain: false }
    };
    const ENVS = { prod: '生产', test: '测试', dev: '开发' };

    /* dueDays / rotatedDays 存的是"距今几天"，负数 = 已逾期。
       绝对日期在渲染时按今天推出来 —— 写死绝对日期的话，
       「3 天后」和那个日期迟早互相打脸。 */
    const CREDS = [
        { id: 'ali-ops',    platform: '阿里云',   user: 'ops@lucky.com',    type: 'password',  env: 'prod',
          note: '换绑手机 138****2210', cycle: 90,  rotatedDays: 29,  rotatedBy: '张琪',
          dueDays: 61,  secret: 'Lk9#pQ2vR7tW' },
        { id: 'ali-deploy', platform: '阿里云',   user: 'deploy-bot',       type: 'key', env: 'prod',
          cycle: 90,  rotatedDays: 87,  rotatedBy: '张琪',
          dueDays: 3,   secret: 'LTAI5tQvR7tWk2mN' },
        { id: 'ali-test',   platform: '阿里云',   user: 'test@lucky.com',   type: 'key', env: 'test',
          cycle: 180, rotatedDays: 102, rotatedBy: '何敏',
          dueDays: 78,  secret: 'LTAI5tB9mK4pQ7xZ' },
        { id: 'gl-dev',     platform: 'GitLab',   user: 'dev@lucky.com',    type: 'password',  env: 'dev',
          cycle: 180, rotatedDays: 60,  rotatedBy: '刘阳',
          dueDays: 120, secret: 'Gy7!mQ4zTn' },
        { id: 'gl-release', platform: 'GitLab',   user: 'release-bot',      type: 'key',      env: 'prod',
          note: '只在发版流水线里用，改完记得同步 CI 变量', cycle: 90,  rotatedDays: 90,  rotatedBy: '张琪',
          dueDays: -3,  secret: 'glpat-9Kd2Xr7pLm4Q' },
        { id: 'xc-admin',   platform: '星辰后台', user: 'xingchen_admin',   type: 'password',  env: 'prod',
          note: '对账出问题时才登', cycle: 90,  rotatedDays: 49,  rotatedBy: '刘阳',
          dueDays: 41,  secret: 'Xc8@hR5tVb' },
        { id: 'xc-qa',      platform: '星辰后台', user: 'xingchen_qa',      type: 'password',  env: 'test',
          cycle: 180, rotatedDays: 128, rotatedBy: '何敏',
          dueDays: 52,  secret: 'Qa3$kN7wZp' },
        { id: 'xc-ops',     platform: '星辰后台', user: 'xingchen_ops',     type: 'password',  env: 'prod',
          cycle: 90,  rotatedDays: 57,  rotatedBy: '张琪',
          dueDays: 33,  secret: 'Op5%vB2mHs' }
    ];

    const TODAY = (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
    const credById = id => CREDS.find(c => c.id === id);

    function fmtDate(days) {
        const d = new Date(TODAY.getTime() + days * 86400000);
        const p = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
    function fmtShort(days) { return fmtDate(days).slice(5); }
    /* 还差多少天：只说"还有多久"，不重复那个日期 —— 日期在左边一列 */
    function dueText(n) {
        if (n < 0) return '已逾期 ' + (-n) + ' 天';
        if (n === 0) return '今天到期';
        return n + ' 天后';
    }
    /* 有效期胶囊：**整张清单唯一的颜色语义**。
       ≤0 逾期 / ≤7 天以内 / ≤30 天 / 其余——正常态不给底色，只给一个淡胶囊。 */
    function dueBadge(n) {
        if (n < 0) return { cls: 'danger', text: '已逾期 ' + (-n) + ' 天' };
        if (n <= 7) return { cls: 'warn', text: n + ' 天后轮换' };
        if (n <= 30) return { cls: 'plain', text: n + ' 天后轮换' };
        return { cls: 'plain', text: n + ' 天后轮换' };
    }
    /* 轮换计划 = 90 天内到期的凭据，按日期升序（逾期的负数自然排在最前）。
       ⚠️ 停用的不算 —— 一条已经停用的凭据不该还在催你轮换它。 */
    function rotatePlan() { return CREDS.filter(c => !c.disabled && c.dueDays <= 90).slice().sort((a, b) => a.dueDays - b.dueDays); }
    function overdue() { return CREDS.filter(c => !c.disabled && c.dueDays < 0); }

    /* ============ 凭据清单 ============ */
    function credRow(c) {
        const t = TYPES[c.type];
        const off = !!c.disabled;
        /* 停用态先于"逾期"：一条已经停用的凭据不该再拿橙带催你 —— 那是两件事 */
        const b = off ? { cls: 'idle', text: '已停用' } : dueBadge(c.dueDays);
        const hot = off ? ' is-off' : (c.dueDays < 0 ? ' alert' : '');
        /* 行尾那个**常驻**动作 = 这条凭据最高频的一件事：把能拿走的东西拿走。
           停用之后它就不是"有效凭据"了 ⇒ 一起禁用，别留一个假入口。 */
        const main = t.plain
            ? { icon: 'copy', label: '复制密码', act: "copyCred('" + c.id + "','secret')" }
            : { icon: 'copy', label: '复制账号', act: "copyCred('" + c.id + "','user')" };
        const secret = t.plain ? (
            '<div class="ac-secret">' +
                '<span class="ac-secret-label">' + t.name + '</span>' +
                '<code class="ac-secret-val" id="secret-' + c.id + '" data-plain="' + esc(c.secret) + '">••••••••••••</code>' +
                '<button class="btn btn-ghost btn-sm" type="button" onclick="revealSecret(\'' + c.id + '\', this)"' + (off ? ' disabled' : '') + '>显示</button>' +
                '<span class="ac-secret-tip">显示 30 秒后自动隐藏</span>' +
            '</div>'
        ) : (
            '<div class="ac-secret">' +
                '<span class="ac-secret-label">' + t.name + '</span>' +
                '<span class="ac-secret-val">不回显</span>' +
                '<span class="ac-secret-tip">' + t.name + '只在生成时出现一次，丢失请重置</span>' +
            '</div>'
        );
        return (
            '<div class="ac-item" id="item-' + c.id + '">' +
                /* 整行可点（鼠标），但**不再声明 `role="button"`**：行里嵌着 4 个真按钮，
                   role=button 里套 button 是无效 ARIA；而且它此前只有 `tabindex`、没有键盘处理
                   ⇒ 聚焦得到、按 Enter 什么也不发生（说了自己是按钮却不响应键盘）。
                   键盘入口交给行尾那枚展开按钮 —— 与项目详情页 Hero 卡同一处判据、同一个改法。 */
                '<div class="ac-row' + hot + '" onclick="toggleCred(\'' + c.id + '\')">' +
                    '<span class="ac-type" title="' + t.name + '" aria-hidden="true">' + svgIcon(t.icon, 15) + '</span>' +
                    '<div class="ac-info">' +
                        '<div class="ac-name">' + esc(c.user) + '<span class="badge ' + b.cls + '">' + b.text + '</span></div>' +
                        /* 第二行只放**不变的身份**：环境 + 备注。
                           「上次轮换」不放这儿 —— 它和上面那颗有效期胶囊说的是同一件事
                           （还剩多久才轮换），展开面板里已经写了确切日期。
                           ⚠️ 备注为空时**不出现**（不留空占位）；这里的文本会被截断，
                           完整那句在 title 与展开面板里。 */
                        '<div class="ac-meta">' +
                            '<span class="env-tag">' + ENVS[c.env] + '</span>' +
                            (c.note ? '<span class="ac-note" title="' + esc(c.note) + '">' + esc(c.note) + '</span>' : '') +
                        '</div>' +
                    '</div>' +
                    '<span class="ac-acts">' +
                        '<button class="ac-act ac-lead" type="button" title="' + main.label + '" aria-label="' + main.label + '"' +
                                (off ? ' disabled' : '') + ' onclick="event.stopPropagation();' + main.act + '">' + svgIcon(main.icon, 15) + '</button>' +
                        /* 管理动作（编辑 / 停用 / 删除）都只在这里，一处一个入口。
                           它们和上面的「复制」一样常驻可见 —— 但只在悬停时才上色，
                           所以行看着仍是静的（CSS 里记了为什么不能 reverting 成 hover 浮出）。 */
                        '<button class="ac-act" type="button" title="编辑" aria-label="编辑"' +
                                ' onclick="event.stopPropagation();openCredForm(\'' + c.id + '\')">' + svgIcon('edit', 15) + '</button>' +
                        '<button class="ac-act" type="button" title="' + (off ? '恢复使用' : '停用') + '" aria-label="' + (off ? '恢复使用' : '停用') + '"' +
                                ' onclick="event.stopPropagation();toggleDisable(\'' + c.id + '\')">' + svgIcon(off ? 'undo' : 'ban', 15) + '</button>' +
                        '<button class="ac-act danger" type="button" title="删除" aria-label="删除"' +
                                ' onclick="event.stopPropagation();askDelete(\'' + c.id + '\')">' + svgIcon('trash', 15) + '</button>' +
                        '<button class="ac-expand" type="button" aria-expanded="false"' +
                                ' aria-controls="detail-' + c.id + '" aria-label="展开这条凭据"' +
                                ' onclick="event.stopPropagation();toggleCred(\'' + c.id + '\')">' +
                            svgIcon('chevD', 15) + '</button>' +
                    '</span>' +
                '</div>' +
                '<div class="ac-detail" id="detail-' + c.id + '">' +
                    '<div class="ac-detail-inner"><div class="ac-detail-pad">' +
                        secret +
                        '<div class="ac-detail-grid">' +
                            '<div class="ac-detail-item"><span class="label">凭据类型</span><span class="value">' + t.name + '</span></div>' +
                            '<div class="ac-detail-item"><span class="label">轮换周期</span><span class="value">' + c.cycle + ' 天</span></div>' +
                            '<div class="ac-detail-item"><span class="label">上次轮换</span><span class="value">' + fmtDate(-c.rotatedDays) + ' · ' + c.rotatedBy + '</span></div>' +
                            '<div class="ac-detail-item"><span class="label">下次到期</span><span class="value">' + fmtDate(c.dueDays) + '</span></div>' +
                            '<div class="ac-detail-item wide"><span class="label">备注</span><span class="value small">' + (c.note || '—') + '</span></div>' +
                        '</div>' +
                        /* 面板里只留"用这条凭据"的动作；编辑 / 停用 / 删除都在行尾，不在这儿开第二个入口 */
                        '<div class="ac-detail-actions">' +
                            '<button class="btn btn-ghost btn-sm" type="button"' + (off ? ' disabled' : '') + ' onclick="copyCred(\'' + c.id + '\',\'user\')">' + svgIcon('copy', 13) + ' 复制账号</button>' +
                            (t.plain ? '<button class="btn btn-ghost btn-sm" type="button"' + (off ? ' disabled' : '') + ' onclick="copyCred(\'' + c.id + '\',\'secret\')">' + svgIcon('key', 13) + ' 复制密码</button>' : '') +
                            '<button class="btn btn-ghost btn-sm" type="button"' + (off ? ' disabled' : '') + ' onclick="rotateCred(\'' + c.id + '\')">' + svgIcon('refresh', 13) + ' 轮换</button>' +
                            '<span class="spacer"></span>' +
                            '<span class="ac-detail-note">' + (off ? '已停用 · 在行尾点 ↺ 恢复' : '编辑 / 停用 / 删除在行尾') + '</span>' +
                        '</div>' +
                    '</div></div>' +
                '</div>' +
            '</div>'
        );
    }

    /* ============ 凭据清单的筛选（平台胶囊 + 关键词） ============ */
    let credPlatform = 'all';   /* 当前选中的平台，'all' = 全部 */
    let credQuery = '';

    /* 一条凭据是否命中当前筛选。**判据只此一处** —— DOM 过滤、组头计数、卡片徽标
       都调它，否则三处会各算各的。 */
    function credMatch(c) {
        if (credPlatform !== 'all' && c.platform !== credPlatform) return false;
        if (!credQuery) return true;
        return (c.user + ' ' + (c.note || '') + ' ' + c.platform).toLowerCase().indexOf(credQuery) >= 0;
    }
    /* 徽标跟着筛选走：贴着清单的那个数字必须与眼睛看到的行数一致
       （组头计数也按可见的算，两处若各说各的，当场打架）。
       分区级的总数（Tab / 圆盘 / 侧栏）不动 —— 那说的是"这一区一共有多少条"。 */
    function credBadgeText() {
        const filtering = credPlatform !== 'all' || !!credQuery;
        return (filtering ? '筛出 ' + CREDS.filter(credMatch).length + ' / ' + CREDS.length + ' 条'
                          : CREDS.length + ' 条')
             + ' · ' + platformsInUse().length + ' 个平台';
    }
    /* 平台胶囊**从数据现算**（"全部" + 真用到的每个平台 + 条数）——
       平台由自己输入，所以这一排也必须跟着数据走。 */
    function renderCredFilter() {
        const list = platformsInUse();
        /* 选中的平台没了（最后一条被删、或改了平台）⇒ 退回"全部"，
           否则会停在一个筛不出任何东西的状态上。 */
        if (credPlatform !== 'all' && list.indexOf(credPlatform) < 0) credPlatform = 'all';
        const items = [{ v: 'all', label: '全部', n: CREDS.length }].concat(
            list.map(p => ({ v: p, label: p, n: CREDS.filter(c => c.platform === p).length })));
        document.getElementById('credPlatformChips').innerHTML = items.map(it => {
            const on = credPlatform === it.v;
            return '<button class="chip' + (on ? ' on' : '') + '" type="button" role="radio"' +
                   ' aria-checked="' + on + '" data-v="' + esc(it.v) + '" onclick="pickCredPlatform(this)">' +
                   esc(it.label) + '<span class="chip-n">' + it.n + '</span></button>';
        }).join('');
    }
    function pickCredPlatform(btn) {
        credPlatform = btn.dataset.v;
        renderCredFilter();
        applyCredFilter();
    }
    /* 过滤在**已渲染的 DOM** 上做（`el.hidden`）：不重建清单 ⇒
       展开着的行不会合上、搜索框不会失焦、滚动位置不动。 */
    function applyCredFilter() {
        const box = document.getElementById('credSearch');
        credQuery = box ? box.value.trim().toLowerCase() : '';
        let shown = 0;
        document.querySelectorAll('#credGroups .ac-group').forEach(g => {
            let n = 0, bad = 0;
            g.querySelectorAll('.ac-item').forEach(it => {
                const c = credById(it.id.slice(5));   /* id = 'item-' + c.id */
                const ok = !!c && credMatch(c);
                it.hidden = !ok;
                if (!ok) return;
                n++;
                if (!c.disabled && c.dueDays <= 7) bad++;
            });
            shown += n;
            g.hidden = n === 0;
            /* 组头那两个数按**可见的那些**重算：筛出 2 条却写着"3 条"，两处当场打架。 */
            const cnt = g.querySelector('.ac-group-count');
            if (cnt) cnt.textContent = n + ' 条';
            const al = g.querySelector('.ac-group-alert');
            if (al) al.hidden = bad === 0;
            const aln = g.querySelector('.ac-group-alert-n');
            if (aln) aln.textContent = bad;
        });
        const empty = document.getElementById('credEmpty');
        empty.hidden = shown > 0;
        /* 两种"空"不是一回事：**一条都没有**（该去添加）≠ **筛不出来**（该改条件）。
           同一句话套两种场景，就会在真没数据时叫人"换个词"。 */
        empty.textContent = CREDS.length === 0
            ? '这个项目还没有登记凭据 —— 点卡头的「＋ 添加账户」开始。'
            : '没有匹配的凭据 —— 换个词，或者点回「全部」。';
        document.getElementById('credCardBadge').textContent = credBadgeText();
    }

    /* 平台名自己就是分组名 —— 不再配图标：每组的图标长得一样时，
       它只占 15px 不传任何信息（平台名就在右边一格）。 */
    function renderCreds() {
        document.getElementById('credGroups').innerHTML = platformsInUse().map(name => {
            const list = CREDS.filter(c => c.platform === name);
            const bad = list.filter(c => !c.disabled && c.dueDays <= 7).length;
            return '<div class="ac-group">' +
                '<div class="ac-group-head">' +
                    '<span class="ac-group-name">' + esc(name) + '</span>' +
                    '<span class="ac-group-count">' + list.length + ' 条</span>' +
                    /* 告警条**总是渲染**（计数为 0 时 hidden）：筛选会按"可见的那些"重算它，
                       元素不存在就没法写回去，只能整条重建 —— 那会把展开状态打掉。 */
                    '<span class="ac-group-alert"' + (bad ? '' : ' hidden') + '>' +
                        svgIcon('alert', 12) + ' <span class="ac-group-alert-n">' + bad + '</span> 条待处理</span>' +
                '</div>' +
                '<div class="ac-group-list">' + list.map(credRow).join('') + '</div>' +
            '</div>';
        }).join('');
    }

    /* ============ 轮换计划 ============ */
    function renderRotate() {
        const list = rotatePlan();
        document.getElementById('rotateList').innerHTML = list.map(c => {
            const cls = c.dueDays < 0 ? ' overdue' : (c.dueDays <= 7 ? ' soon' : '');
            const badge = c.dueDays < 0 ? '<span class="badge danger">已逾期</span>'
                        : c.dueDays <= 7 ? '<span class="badge warn">' + c.dueDays + ' 天后</span>' : '';
            return '<div class="ac-time-item' + cls + '">' +
                '<div class="ac-time-when">' +
                    '<span class="ac-time-date">' + fmtShort(c.dueDays) + '</span>' +
                    '<span class="ac-time-rel">' + dueText(c.dueDays) + '</span>' +
                '</div>' +
                '<div class="ac-time-body">' +
                    '<div class="ac-time-title">' + esc(c.user) + badge + '</div>' +
                    '<div class="ac-time-meta">' + c.platform + ' · ' + TYPES[c.type].name + ' · 周期 ' + c.cycle + ' 天</div>' +
                '</div>' +
                '<button class="btn btn-ghost btn-sm" type="button" onclick="rotateCred(\'' + c.id + '\')">' +
                    svgIcon('refresh', 13) + ' 轮换</button>' +
            '</div>';
        }).join('');
    }

    /* ============ 一处刷新，四处同步 ============
       增 / 删 / 轮换 / 撤销 / 初始化都只调这一个 —— 分开写必然有一处忘记。 */
    function sync() {
        const risk = CREDS.filter(c => !c.disabled && c.dueDays <= 7);
        const od = overdue();
        document.getElementById('kpiRiskCount').textContent = risk.length;
        document.getElementById('kpiRisk').classList.toggle('warn', risk.length > 0);
        const worst = od[0] || risk[0];
        document.getElementById('kpiRiskSub').textContent = risk.length
            ? (worst.platform + ' · ' + worst.user + ' ' + dueText(worst.dueDays))
            : '没有 7 天内到期的凭据';
        document.getElementById('kpiRiskSub').className = risk.length ? 'kpi-sub warn-text' : 'kpi-sub';

        /* ⚠️ 必须挡住"一条都没有"：这里是全页唯一没护栏的取值，
           把凭据删光会让 `recent` 变 undefined ⇒ 抛错 ⇒ **整条 sync 从中间断掉**，
           后面的徽标 / 侧栏槽板 / 圆盘计数全部停在旧值（页面还不显示哪里错了）。 */
        const recent = CREDS.slice().sort((a, b) => a.rotatedDays - b.rotatedDays)[0];
        document.getElementById('kpiRotateVal').textContent =
            recent ? (recent.rotatedDays < 1 ? '今天' : recent.rotatedDays + ' 天前') : '—';
        document.getElementById('kpiRotateSub').textContent =
            recent ? (recent.platform + ' · ' + recent.user + ' · ' + recent.rotatedBy) : '还没有登记凭据';

        const plain = CREDS.filter(c => TYPES[c.type].plain).length;
        document.getElementById('kpiPlainCount').textContent = plain;
        document.getElementById('kpiPlainTotal').textContent = CREDS.length;
        document.getElementById('kpiPlainSub').textContent = CREDS.length - plain + ' 条密钥不回显，只能重置';

        document.getElementById('credCardBadge').textContent = credBadgeText();
        document.getElementById('rotateCardBadge').textContent =
            '未来 90 天 ' + rotatePlan().length + ' 条' + (od.length ? ' · ' + od.length + ' 条逾期' : '');
        document.getElementById('tabCredCount').textContent = CREDS.length;

        /* 侧栏槽板按**维度**分工：页面 = 现在什么状态，侧栏 = 时间与覆盖上的量 */
        document.getElementById('slotRotated').textContent = CREDS.filter(c => c.rotatedDays <= 30).length;
        document.getElementById('slotAdded').textContent = 1;
        document.getElementById('slotOverdue').textContent = od.length;
        document.getElementById('slotPlatforms').textContent = platformsInUse().length;

        paintIcons(document);
        /* 会变的值也在圆盘名称条与侧栏副标题里 —— 现算之后补一次，且不再播动画 */
        syncChrome(false);
    }

    /* 清单与轮换计划是**同一份数据的两个视图** ⇒ 任何一处改动都要同时刷两边。
       所以只留这一个入口，不在各个动作里各写各的（少刷一边 = 徽标说 7 条、清单只剩 6 条）。 */
    function renderAll() {
        renderCreds(); renderRotate(); renderPlatformOptions(); renderCredFilter(); sync();
        /* 最后一步：清单刚重建过 ⇒ 把当前的筛选重新落上去（变量还在，筛选状态不丢） */
        applyCredFilter();
    }

    /* ============ 交互 ============ */
    function toggleCred(id) {
        const item = document.getElementById('item-' + id);
        const open = item.classList.toggle('open');
        /* `aria-expanded` / `aria-controls` 挂在**那枚真按钮**上（不再挂在行上）——
           它才是键盘用户按到的那个东西。 */
        const btn = item.querySelector('.ac-expand');
        if (btn) {
            btn.setAttribute('aria-expanded', String(open));
            btn.setAttribute('aria-label', open ? '收起这条凭据' : '展开这条凭据');
        }
        const row = item.querySelector('.ac-row');
        if (row) row.classList.toggle('active', open);
    }

    /* 显示明文：有时限。没有第二个消费者要读这件事（本页不设取用记录），
       所以它只做一件事 —— 30 秒后自己收回去。 */
    function revealSecret(id, btn) {
        const el = document.getElementById('secret-' + id);
        const plain = el.dataset.plain;
        const shown = el.classList.contains('is-plain');
        if (shown) { el.textContent = '••••••••••••'; el.classList.remove('is-plain'); btn.textContent = '显示'; return; }
        el.textContent = plain;
        el.classList.add('is-plain');
        btn.textContent = '隐藏';
        toast('明文 30 秒后自动隐藏', 'info');
        clearTimeout(el._t);
        el._t = setTimeout(() => {
            if (el.classList.contains('is-plain')) { el.textContent = '••••••••••••'; el.classList.remove('is-plain'); btn.textContent = '显示'; }
        }, 30000);
    }

    async function copyText(text) {
        try {
            if (navigator.clipboard) { await navigator.clipboard.writeText(text); return true; }
        } catch (e) { /* 落到下面的兜底 */ }
        const ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        let ok = false;
        try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
        document.body.removeChild(ta);
        return ok;
    }

    function copyCred(id, what) {
        const c = credById(id);
        const t = TYPES[c.type];
        if (what === 'secret' && !t.plain) { toast(t.name + '不回显，请用「轮换」重新生成一个', 'warn'); return; }
        const text = what === 'secret' ? c.secret : c.user;
        copyText(text).then(ok => {
            toast(ok ? '已复制 ' + (what === 'secret' ? t.name : '账号') + ' · ' + c.user : '复制失败，请手动选中', ok ? 'ok' : 'warn');
        });
    }

    function copyAllUsers() {
        copyText(CREDS.map(c => c.user).join('\n')).then(ok => toast(ok ? '已复制 ' + CREDS.length + ' 个账号名（不含密码）' : '复制失败', ok ? 'ok' : 'warn'));
    }

    /* 「轮换」不再直接换掉一个字符串 —— 两个入口都走同一个生成器（面板里那个、轮换计划里那个）。
       轮换的实质是"生成一个新的、够强的、当场看得见的凭据"，不是一个静默的数据改动。 */
    function rotateCred(id) { openGen(id); }

    /* ============================================================
       轮换凭据 · 密码生成器
       —— 三段的选项、长度区间、默认值都在这张表里，标记里不写第二遍。
          字符集里剔掉了 l / 1 / O / 0 这类看着像的，省得抄错。
       ============================================================ */
    const GEN_CHARS = {
        upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
        lower: 'abcdefghijkmnpqrstuvwxyz',
        digits: '23456789',
        symbols: '!@#$%^&*()-_=+'
    };
    const GEN_TYPES = {
        random: { min: 8, max: 32, len: 17, unit: '字符',
                  switches: [{ k: 'digits', label: '数字', on: true }, { k: 'symbols', label: '符号', on: true }] },
        words:  { min: 3, max: 8, len: 4, unit: '单词',
                  switches: [{ k: 'caps', label: '首字母大写', on: false }, { k: 'full', label: '使用完整单词', on: true }] },
        pin:    { min: 4, max: 10, len: 6, unit: '位', switches: [] }
    };
    const GEN_WORDS = ('amber anchor basket beacon bottle branch bridge bucket cactus camera candle canyon carrot castle ' +
        'cinder circus cobalt copper cotton crater cricket crystal dagger desert dolphin donkey dragon ember falcon ' +
        'feather forest fossil garden garnet ginger glacier granite guitar hammer harbor harvest helmet honey indigo ' +
        'ivory jasmine jungle kettle lantern lemon lilac lobster magnet mango marble meadow melon meteor mirror monkey ' +
        'mountain napkin needle nickel noodle olive orchid otter oyster paddle palace panda pebble pelican pepper pigeon ' +
        'pillar planet pocket pollen poppy prairie pretzel pumpkin quartz rabbit radish ranger ribbon rocket rubber saddle ' +
        'salmon satin scarlet sequoia shadow shovel signal silver socket spider spiral sparrow stencil sunset syrup tangle ' +
        'teapot tundra tunnel turtle velvet vessel violin wallet walnut willow winter wizard yellow zephyr zigzag').split(' ');

    const genMask = document.getElementById('genMask');
    let genId = null;
    let genType = 'random';
    let genSw = {};
    let genValue = '';
    let genIsPwd = true;      /* 当前这条是不是密码类 —— 只有它才三段全开 */
    /* 平台签发的密钥长度由我们给随机部分的位数决定，与密码的取值范围不同 */
    const GEN_KEY_LEN = { min: 12, max: 32, len: 20 };

    function randInt(max) {
        if (window.crypto && crypto.getRandomValues) {
            const a = new Uint32Array(1);
            crypto.getRandomValues(a);
            return a[0] % max;
        }
        return Math.floor(Math.random() * max);
    }
    const pickFrom = s => s[randInt(s.length)];
    function genAlnum(n, digits) {
        const pool = GEN_CHARS.upper + GEN_CHARS.lower + (digits ? GEN_CHARS.digits : '');
        let out = '';
        for (let i = 0; i < n; i++) out += pickFrom(pool);
        return out;
    }
    function genRandom(len) {
        const pools = [GEN_CHARS.upper, GEN_CHARS.lower];
        if (genSw.digits) pools.push(GEN_CHARS.digits);
        if (genSw.symbols) pools.push(GEN_CHARS.symbols);
        const all = pools.join('');
        const chars = [];
        for (let i = 0; i < len; i++) chars.push(pickFrom(all));
        /* 勾了就**至少给一位** —— 否则"含数字"可能一位数字都没有，那是骗人。
           ⚠️ 补位不能用"换掉某一位"：两类同时缺位时，后补的那一类会正好把先补上的换掉
              （实测 400 次里能抓到一次）⇒ 先占位、再整体打乱。 */
        const need = [];
        if (genSw.digits) need.push(GEN_CHARS.digits);
        if (genSw.symbols) need.push(GEN_CHARS.symbols);
        need.forEach((pool, k) => {
            if (!pool.split('').some(ch => chars.indexOf(ch) >= 0)) chars[k] = pickFrom(pool);
        });
        for (let i = chars.length - 1; i > 0; i--) {
            const j = randInt(i + 1);
            const t = chars[i]; chars[i] = chars[j]; chars[j] = t;
        }
        return chars.join('');
    }
    function genWords(n) {
        const out = [];
        while (out.length < n) {
            let w = pickFrom(GEN_WORDS);
            if (!genSw.full) w = w.slice(0, Math.max(3, Math.round(w.length / 2)));
            if (genSw.caps) w = w[0].toUpperCase() + w.slice(1);
            out.push(w);
        }
        return out.join('-');
    }
    function genPin(n) { let s = ''; for (let i = 0; i < n; i++) s += pickFrom(GEN_CHARS.digits + '0' + '1'); return s; }

    const genLenVal = () => {
        const n = document.getElementById('genLenNum');
        return Math.max(Number(n.min), Math.min(Number(n.max), Number(n.value) || Number(n.min)));
    };
    function buildGenValue() {
        const c = credById(genId);
        const len = genLenVal();
        /* 密钥**不拼前缀**：平台名是用户自己写的，系统不认识它 ⇒ 猜不出那边签发的形状。
           早先那张 `keyPrefix` 表（阿里云 LTAI5t… / GitLab glpat-…）是拿固定平台表当底座
           才成立的，平台放开之后它就成了假知识。 */
        if (c.type === 'key') return genAlnum(len, genSw.digits);
        if (genType === 'pin') return genPin(len);
        if (genType === 'words') return genWords(len);
        return genRandom(len);
    }
    /* 熵只算给"人记的密码" —— 密钥的长度本来就由平台定，算出来也没人用 */
    function genHintText() {
        const c = credById(genId);
        const len = genLenVal();
        if (c.type !== 'password') {
            return len + ' 位随机（' + (genSw.digits ? '字母 + 数字' : '纯字母') + '）—— '
                 + TYPES[c.type].name + '只在生成时出现一次，现在复制走，之后只能重置。';
        }
        if (genType === 'pin') return len + ' 位纯数字 · 约 ' + Math.round(len * Math.log2(10)) + ' bit —— 小程序、门禁这类只收数字的地方用它。';
        if (genType === 'words') return len + ' 个词 · 约 ' + Math.round(len * Math.log2(GEN_WORDS.length)) + ' bit —— 念得出来、抄得下来。';
        const pool = GEN_CHARS.upper.length + GEN_CHARS.lower.length
                   + (genSw.digits ? GEN_CHARS.digits.length : 0)
                   + (genSw.symbols ? GEN_CHARS.symbols.length : 0);
        return len + ' 字符 · ' + (genSw.digits ? '含' : '不含') + '数字 · ' + (genSw.symbols ? '含' : '不含')
             + '符号 · 约 ' + Math.round(len * Math.log2(pool)) + ' bit';
    }

    function renderGenSwitches() {
        const t = GEN_TYPES[genType];
        const wrap = document.getElementById('genSwitches');
        wrap.innerHTML = t.switches.map(s => {
            /* 密钥类不收符号：开关留着（同一个位置、同一个形状），但置灰并写明原因 */
            const off = !genIsPwd && s.k === 'symbols';
            return '<button class="sw" type="button" role="switch"' +
                    ' aria-checked="' + (genSw[s.k] && !off ? 'true' : 'false') + '"' +
                    ' aria-disabled="' + String(!!off) + '"' +
                    ' data-sw="' + s.k + '"' + (off ? ' disabled title="平台签发的密钥只收字母和数字"' : '') +
                    ' onclick="toggleGenSw(this)">' +
                '<span class="sw-track" aria-hidden="true"></span><span class="sw-label">' + s.label + '</span></button>';
        }).join('');
        wrap.hidden = t.switches.length === 0;
    }
    function regen() {
        const c = credById(genId);
        if (!c) return;
        genValue = buildGenValue();
        const out = document.getElementById('genOut');
        if (c.type === 'password' && genType !== 'pin') {
            /* 逐字符建 span：数字与符号染强调色（这里颜色只说一件事 —— 这一位是哪类字符）。
               用 textContent 逐个写，不做 innerHTML 拼接。 */
            out.className = '';
            out.textContent = '';
            for (const ch of genValue) {
                const b = document.createElement('span');
                if (GEN_CHARS.digits.indexOf(ch) >= 0 || GEN_CHARS.symbols.indexOf(ch) >= 0) b.className = 'b';
                b.textContent = ch;
                out.appendChild(b);
            }
        } else {
            /* PIN 与密钥类都不染色：那里没有"类别"可言，靠字号 / 等宽表达就够 */
            out.className = (c.type === 'password' && genType === 'pin') ? 'big' : '';
            out.textContent = genValue;
        }
        document.getElementById('genHint').textContent = genHintText();
    }
    function toggleGenSw(btn) {
        if (btn.disabled) return;      /* 置灰的那一档不响应 —— disabled 只挡点击，不挡内联 onclick */
        genSw[btn.dataset.sw] = !genSw[btn.dataset.sw];
        btn.setAttribute('aria-checked', String(genSw[btn.dataset.sw]));
        regen();
    }
    /* 滑块与数字框控的是同一个值 ⇒ 双向同步。
       数字框那头**先不夹**（输入 1 就被顶到 8 很难受），只在取值时夹。 */
    function onGenLenInput() {
        document.getElementById('genLenNum').value = document.getElementById('genLen').value;
        regen();
    }
    function onGenLenNum() {
        document.getElementById('genLen').value = genLenVal();
        regen();
    }
    function pickGenType(t) {
        genType = t;
        const cfg = GEN_TYPES[t];
        document.querySelectorAll('#genTypeSec .seg-btn').forEach(b => b.setAttribute('aria-selected', String(b.dataset.gen === t)));
        /* 密钥类只走随机那一段，长度按"随机部分"给 —— 前缀由平台固定，不占滑块的位 */
        const min = genIsPwd ? cfg.min : GEN_KEY_LEN.min;
        const max = genIsPwd ? cfg.max : GEN_KEY_LEN.max;
        const len = genIsPwd ? cfg.len : GEN_KEY_LEN.len;
        const s = document.getElementById('genLen'), n = document.getElementById('genLenNum');
        s.min = n.min = min;
        s.max = n.max = max;
        s.value = n.value = len;
        document.getElementById('genLenLabel').textContent = genIsPwd ? cfg.unit : '字符';
        renderGenSwitches();
        regen();
    }
    function openGen(id) {
        const c = credById(id);
        if (!c) return;
        genId = id;
        genIsPwd = c.type === 'password';
        document.getElementById('genTitle').textContent = '轮换 ' + c.user;
        document.getElementById('genCopy').innerHTML = svgIcon('copy', 14) + ' 复制' + (genIsPwd ? '密码' : TYPES[c.type].name);

        /* ⚠️ 弹窗结构**不随类型变**：生成方式、长度、开关永远在同一批位置。
           （踩过：原来密钥类把"选择类型 + 自定义"两整块 hidden 掉，于是从轮换计划点第一条
             ——那是 release-bot，一个令牌——看到的框，和从凭据行点密码看到的框长得完全不一样，
             读起来就像"两个地方的轮换弹窗不是同一个"。）
           变的只是**哪些能选**：平台签发的密钥只能是随机串，另两段置灰并写明原因。 */
        document.querySelectorAll('#genTypeSec .seg-btn').forEach(b => {
            const ok = genIsPwd || b.dataset.gen === 'random';
            b.disabled = !ok;
            b.setAttribute('aria-disabled', String(!ok));
            b.title = ok ? '' : '平台签发的密钥只能是随机串，选不了这一种';
        });
        genSw = genIsPwd ? { digits: true, symbols: true, caps: false, full: true }
                         : { digits: true, symbols: false };
        pickGenType('random');   /* 里面会重建开关、同步滑块并生成第一个值 */
        genMask.classList.add('open');
    }
    function closeGen() {
        if (!genMask.classList.contains('open')) return;
        genMask.classList.remove('open');
        genId = null; genValue = '';
    }
    function copyGen() {
        copyText(genValue).then(ok => {
            toast(ok ? '已复制新密码 —— 记得「用它轮换」之后再关掉' : '复制失败，请手动选中', ok ? 'ok' : 'warn');
        });
    }
    function applyGen() {
        const c = credById(genId);
        if (!c) return;
        c.secret = genValue;
        c.rotatedDays = 0; c.rotatedBy = '我'; c.dueDays = c.cycle;
        closeGen(); renderAll();
        toast('已轮换 ' + c.user + ' · 下次 ' + fmtDate(c.dueDays) + ' 到期');
    }
    genMask.addEventListener('click', e => { if (e.target === genMask) closeGen(); });

    /* 停用与删除是**两件事**，所以是两个入口、两句后果：
         停用 = 留在清单里、标成「已停用」、不再催你轮换（随时能恢复）；
         删除 = 从清单里移走（给撤销，但撤销只在提示还在的时候有效）。 */
    function toggleDisable(id) {
        const c = credById(id);
        if (c.disabled) {
            c.disabled = false; renderAll();
            toast('已恢复使用 ' + c.user, 'ok');
            return;
        }
        openConfirm({
            title: '停用 ' + c.user + '？',
            desc: '停用后这条凭据立刻失效，正在用它跑的任务会跟着失败。',
            warn: '凭据会留在清单里并标成「已停用」，也不再计入轮换计划；随时可以恢复使用。',
            confirmText: '停用',
            onConfirm: () => { c.disabled = true; renderAll(); toast('已停用 ' + c.user, 'warn'); }
        });
    }

    function askDelete(id) {
        const c = credById(id);
        openConfirm({
            title: '删除 ' + c.user + '？',
            desc: '这一条会从清单里移走，「' + c.platform + '」组里少一条。',
            warn: '密钥明文不会回显、也找不回来；正在用它跑的任务会在下次运行时失败。这一步可以撤销。',
            confirmText: '删除',
            danger: true,
            onConfirm: () => {
                const at = CREDS.indexOf(c);
                CREDS.splice(at, 1);
                renderAll();
                toast('已删除 ' + c.user, 'warn', {
                    label: '撤销',
                    onClick: () => { CREDS.splice(at, 0, c); renderAll(); toast('已恢复 ' + c.user, 'ok'); }
                });
            }
        });
    }

    /* ============================================================
       添加 / 编辑账户（右侧抽屉）
       —— 两张榜共用一张表单：字段一样，差别只有两处 ——
            ① 编辑时密钥留空 = 不更换（添加时必须填，否则这条凭据没有可用的密钥）；
            ② 标题与副标题。
          到期日不给输入框：它 = 上次轮换 + 轮换周期，**机器算得出来** ⇒ 只回显。
       ============================================================ */
    const drawerEl = document.getElementById('credDrawer');
    const mainScroll = document.querySelector('.main');
    let editingId = null;
    let lastEnv = '';

    function chipVal(rowId) {
        const on = document.querySelector('#' + rowId + ' .chip.on');
        return on ? on.dataset.v : '';
    }
    /* 平台是输入框不是胶囊 ⇒ 单独取。trim 是必须的：前后空格会被当成另一个平台，
       而分组只看字符串相等。 */
    const platformVal = () => document.getElementById('cfPlatform').value.trim();
    /* 候选 = 已经在用的平台名。**只做建议**：填一个新的照样能存。 */
    function renderPlatformOptions() {
        document.getElementById('cfPlatformList').innerHTML =
            platformsInUse().map(n => '<option value="' + esc(n) + '"></option>').join('');
    }
    function setChip(rowId, val) {
        document.querySelectorAll('#' + rowId + ' .chip').forEach(b => {
            const on = b.dataset.v === val;
            b.classList.toggle('on', on);
            b.setAttribute('aria-checked', String(on));
        });
    }
    function pickChip(btn) {
        const row = btn.parentNode;
        row.querySelectorAll('.chip').forEach(b => {
            b.classList.toggle('on', b === btn);
            b.setAttribute('aria-checked', String(b === btn));
        });
        if (row.id === 'cfEnv') applyCycleDefault();
        syncForm();
    }
    /* 换环境就把周期带到那一档的默认值 —— 但**只在当前值还是上一档的默认值时才带**
       （否则会把手填过的 180 悄悄改回 90）。 */
    function applyCycleDefault() {
        const env = chipVal('cfEnv');
        const def = env === 'prod' ? 90 : 180;
        const prev = lastEnv === 'prod' ? 90 : (lastEnv ? 180 : null);
        const inp = document.getElementById('cfCycle');
        if (!inp.value || Number(inp.value) === prev) inp.value = def;
        lastEnv = env;
    }
    /* 重名是**跨条目**检查 ⇒ 只能算出来给用户看，让他自己记得是不可能的。
       ⚠️ 平台是自己输入的 ⇒ 比的时候两边都要 `trim + toLowerCase`：
       `GitLab` 与 `gitlab` 会分成两个组，同名就会各存一条。 */
    function userTaken(platform, user) {
        const p = platform.trim().toLowerCase(), u = user.trim().toLowerCase();
        return CREDS.some(c => c.id !== editingId
            && c.platform.trim().toLowerCase() === p
            && c.user.trim().toLowerCase() === u);
    }

    function syncForm() {
        const platform = platformVal();
        const userEl = document.getElementById('cfUser');
        const taken = !!userEl.value.trim() && !!platform && userTaken(platform, userEl.value);
        userEl.classList.toggle('bad', taken);
        const hint = document.getElementById('cfUserHint');
        hint.textContent = taken
            ? '「' + platform + '」下已经有这个账号了'
            : '同一个平台下不能有两条同名账号';
        hint.classList.toggle('bad', taken);

        /* 密钥那格的说明跟着类型走 —— 它**不能是写死的一句**：
           密码保存后是要回显的，写成"保存后不回显"就是当面说反话。 */
        const type = chipVal('cfType');
        document.getElementById('cfSecretHint').textContent = type === 'password'
            ? '保存后可以回显 —— 展开这条就能看到明文，也能复制。'
            : '保存后不回显 —— 密钥只在生成那一次出现，之后只能重置。';

        /* 到期日 = 上次轮换 + 周期。**两个值都不用手填**（新增时上次轮换 = 今天）⇒
           这里只回显 —— 让改周期的人立刻看见它把到期日推到了哪天。 */
        const cyc = Number(document.getElementById('cfCycle').value);
        const rotDays = editingId ? credById(editingId).rotatedDays : 0;
        const dueEl = document.getElementById('cfDue');
        if (cyc > 0) {
            const dueDays = cyc - rotDays;
            dueEl.textContent = (rotDays > 0 ? '上次轮换 ' + fmtDate(-rotDays) : '上次轮换记为今天')
                + ' · 下次到期 ' + fmtDate(dueDays) + '（' + dueText(dueDays) + '）';
        } else {
            dueEl.textContent = '下次到期 = 上次轮换 + 轮换周期';
        }

        const secret = document.getElementById('cfSecret').value.trim();
        document.getElementById('cfSave').disabled =
            !(userEl.value.trim() && platform && !taken && cyc > 0 && (editingId || secret));
    }

    function openCredForm(id) {
        editingId = id || null;
        const c = editingId ? credById(editingId) : null;
        document.getElementById('cfTitle').textContent = c ? '编辑账户' : '添加账户';
        document.getElementById('cfSub').textContent = c
            ? '改完立即生效。密钥 / 密码那一格留空表示不更换。'
            : '平台自己填（填过的会自动出现在候选里），类型 / 环境从已有的里选。';

        document.getElementById('cfPlatform').value = c ? c.platform : '';
        setChip('cfType', c ? c.type : 'password');
        setChip('cfEnv', c ? c.env : 'prod');
        lastEnv = c ? c.env : 'prod';

        document.getElementById('cfUser').value = c ? c.user : '';
        document.getElementById('cfNote').value = c ? (c.note || '') : '';
        document.getElementById('cfCycle').value = c ? c.cycle : 90;
        const sec = document.getElementById('cfSecret');
        sec.value = '';
        sec.placeholder = c ? '留空 = 不更换' : (chipVal('cfType') === 'password' ? '登录密码' : '平台签发的密钥');

        drawerEl.hidden = false;
        if (mainScroll) mainScroll.classList.add('ac-lock');
        syncForm();
        setTimeout(() => document.getElementById('cfUser').focus(), 60);
    }

    function closeCredForm() {
        if (drawerEl.hidden) return;
        drawerEl.hidden = true;
        editingId = null;
        document.getElementById('cfSecret').value = '';
        if (mainScroll) mainScroll.classList.remove('ac-lock');
    }

    function saveCredForm() {
        const platform = platformVal(), type = chipVal('cfType'), env = chipVal('cfEnv');
        const user = document.getElementById('cfUser').value.trim();
        if (!platform || !type || !env || !user) return;
        if (userTaken(platform, user)) { syncForm(); toast('这个账号在「' + platform + '」下已经有了', 'warn'); return; }
        const note = document.getElementById('cfNote').value.trim();
        const secret = document.getElementById('cfSecret').value.trim();
        const cycle = Number(document.getElementById('cfCycle').value) || 0;
        /* 「上次轮换」不在这张表里：新增 = 今天（此刻），编辑 = 保持原值。
           要"我刚换过"就去走轮换流程 —— 那是它自己的动作，不是表单里改一个日期。 */
        const rotatedDays = editingId ? credById(editingId).rotatedDays : 0;
        const dueDays = cycle - rotatedDays;

        if (editingId) {
            const c = credById(editingId);
            Object.assign(c, { platform: platform, type: type, env: env, user: user, note: note,
                               cycle: cycle, rotatedDays: rotatedDays, dueDays: dueDays });
            if (secret) c.secret = secret;
            revealAfterSave(c);
            closeCredForm(); renderAll();
            toast('已保存 ' + user + ' · 下次 ' + fmtDate(dueDays) + ' 到期');
        } else {
            /* id 只做内部键（`item-` / `detail-` / `secret-` 都用它）⇒ 不复用中文平台名，
               避免把非 ASCII 带进 id 与选择器。 */
            CREDS.push({ id: 'acc-' + Date.now().toString(36), platform: platform, type: type, env: env,
                         user: user, note: note, cycle: cycle, rotatedDays: rotatedDays, rotatedBy: '我',
                         dueDays: dueDays, secret: secret || '—' });
            revealAfterSave(CREDS[CREDS.length - 1]);
            closeCredForm(); renderAll();
            toast('已添加 ' + user + ' · 下次 ' + fmtDate(dueDays) + ' 到期');
        }
    }

    /* 存完的那条若不在当前筛选里 ⇒ **先把筛选退回「全部」**：
       否则它保存完当场消失，看着像根本没存上（改过平台的那一条尤其容易碰上）。 */
    function revealAfterSave(c) {
        if (c && credMatch(c)) return;
        credPlatform = 'all';
        credQuery = '';
        const box = document.getElementById('credSearch');
        if (box) box.value = '';
    }

    /* Esc：先关抽屉，再关生成器（两者不会同时开着）。外壳那条 Esc 各管各的（⌘K 与超级菜单）。 */
    document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        if (!drawerEl.hidden) closeCredForm();
        else if (genMask.classList.contains('open')) closeGen();
    });

    /* ============ 卡片折叠 ============
       grid-template-rows 0fr/1fr —— 内容永不被裁 */
    function toggleOpsCard(cardId) {
        const card = document.getElementById(cardId);
        const folded = card.classList.toggle('collapsed');
        const head = card.querySelector('.ops-card-head');
        if (head) head.setAttribute('aria-expanded', String(!folded));
    }

    /* ============ 二次确认弹窗 ============
       破坏性操作不给"一键成功"：确认之后只给回执（应用里还没有那些接口）。 */
    const mask = document.getElementById('modalMask');
    const mTitle = document.getElementById('modalTitle');
    const mBody = document.getElementById('modalBody');
    const mConfirm = document.getElementById('modalConfirm');
    const mCancel = document.getElementById('modalCancel');
    let lastFocused = null;

    function openConfirm({ title, desc, warn, confirmText = '确定', danger = false, onConfirm }) {
        lastFocused = document.activeElement;
        mTitle.textContent = title;
        mBody.innerHTML = '';
        if (desc) {
            const p = document.createElement('p');
            p.textContent = desc;
            mBody.appendChild(p);
        }
        if (warn) {
            const box = document.createElement('div');
            box.className = 'modal-warn';
            box.setAttribute('role', 'note');
            const strong = document.createElement('strong');
            strong.textContent = '影响：';
            const span = document.createElement('span');
            span.textContent = warn;
            box.append(strong, span);
            mBody.appendChild(box);
        }
        mConfirm.textContent = confirmText;
        mConfirm.className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
        mConfirm.onclick = () => {
            if (onConfirm) onConfirm();
            closeModal();
        };
        mask.classList.add('open');
        mConfirm.focus();
    }

    function closeModal() {
        if (!mask.classList.contains('open')) return;
        mask.classList.remove('open');
        if (lastFocused && lastFocused.focus) lastFocused.focus();
    }

    mask.addEventListener('click', e => { if (e.target === mask) closeModal(); });
    mCancel.addEventListener('click', closeModal);

    /* ============ 演示占位 ============ */
    function demo(label) { toast('原型演示：' + label, 'info'); }

    /* ============ 「最后检查」 ============
       它是**页面级**的新鲜度 + 重新检查，原来在页头里；页头整段撤掉后
       没别处可去 —— 它和项目无关，所以在 Hero 右侧占一格，用一条分隔线隔开。 */
    let lastSyncAt = Date.now();
    function refreshAll() {
        lastSyncAt = Date.now();
        const el = document.getElementById('lastSync');
        if (el) el.textContent = '最后检查 刚刚';
        renderAll();
        toast('已重新检查 ' + CREDS.length + ' 条凭据');
    }
    setInterval(() => {
        const el = document.getElementById('lastSync');
        if (!el) return;
        const s = Math.floor((Date.now() - lastSyncAt) / 1000);
        el.textContent = '最后检查 ' + (s < 60 ? s + ' 秒前' : Math.floor(s / 60) + ' 分钟前');
    }, 10000);

    /* ============ ② 项目 Hero 的交互（整块搬自项目详情页，绑定方式一模一样）============
       两条要点：
         ① 右侧那一整块自己 stopPropagation —— 里面每个控件都有自己的动作，
            点它们不该顺手把 Hero 收起来；也正因为拦在这里，里面的 [data-demo]
            必须自己接一手（挂在文档上的委托收不到它）。
         ② 进度那一格是 role=button 的 div，键盘可得 ⇒ Enter / Space 也要能按，
            少了这一段键盘用户就够不到它。
       ============================================================ */
    (function () {
        const heroCard = document.getElementById('heroCard');
        const heroBar = document.getElementById('heroBar');
        const heroBarRight = document.getElementById('heroBarRight');
        const foldToggle = document.getElementById('foldToggle');
        const heroProgress = document.getElementById('heroProgress');
        const moreBtn = document.getElementById('moreBtn');
        const moreDropdown = document.getElementById('moreDropdown');
        if (!heroCard || !heroBar) return;

        function toggleHero() {
            const open = !heroCard.classList.contains('open');
            heroCard.classList.toggle('open', open);
            foldToggle.setAttribute('aria-expanded', String(open));
            foldToggle.title = open ? '收起' : '展开';
            foldToggle.setAttribute('aria-label', foldToggle.title);
        }
        function closeMore() {
            moreDropdown.classList.remove('open');
            moreBtn.setAttribute('aria-expanded', 'false');
        }

        heroBar.addEventListener('click', toggleHero);
        heroBarRight.addEventListener('click', (e) => {
            e.stopPropagation();
            const d = e.target.closest('[data-demo]');
            if (d) demo(d.dataset.demo);
        });
        foldToggle.addEventListener('click', (e) => { e.stopPropagation(); toggleHero(); });

        heroProgress.addEventListener('click', (e) => {
            e.stopPropagation();
            demo('调整项目进度');
        });
        heroProgress.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault(); e.stopPropagation();
            demo('调整项目进度');
        });

        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const open = !moreDropdown.classList.contains('open');
            moreDropdown.classList.toggle('open', open);
            moreBtn.setAttribute('aria-expanded', String(open));
        });
        moreDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
            if (e.target.closest('[data-back-list]')) {
                closeMore();
                demo('返回全部项目');
                return;
            }
            const d = e.target.closest('[data-demo]');
            if (d) { closeMore(); demo(d.dataset.demo); }
        });
        /* 点别处 / 按 Esc 收起 ⋯ 菜单 */
        document.addEventListener('click', (e) => { if (!e.target.closest('#moreMenu')) closeMore(); });
        document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMore(); });
    })();

    /* ============ 首屏渲染 ============
       放在最后：上面的 sync() 会读 CREDS / rotatePlan()，声明在它后面会撞 TDZ。
       走 renderAll() 而不是三行手写 —— "清单 / 轮换 / 平台候选 / 计数"是同一份数据的
       四个视图，只留一个入口，省得下次再加一块时漏掉首屏。 */
    renderAll();
'''

INIT_BLOCK = None


def rep(s, old, new, count=1):
    n = s.count(old)
    assert n == count, 'REPLACE 命中 %d 次（期望 %d）：%s' % (n, count, old[:70])
    return s.replace(old, new)


# ---------------- 组装 ----------------
out = []
out.append(L[0])                       # <!DOCTYPE html>
out.extend(NEW_COMMENT.split('\n'))
out.extend(L[I_HTML:I_TITLE])           # <html><head><meta×2>
out.append('    <title>账户 · 项目详情</title>')
out.extend(L[I_STYLE:I_BASE_END + 1])   # <style> … 基础令牌 / 壳 / Hero / 按钮 / KPI / ops-card
out.extend(L[I_MODALCSS:I_SCROLL + 1])   # 弹窗 / Toast + 滚动条（响应式段自己写）
out.extend(NEW_CSS.rstrip('\n').split('\n'))
out.append(L[I_STYLECL])                # </style>

shell = L[I_BODY:I_CONTENT]

# ── 侧栏标题与副标题
shell = '\n'.join(shell)
shell = rep(shell, '<span class="name" id="sidebarTitle">运维</span>',
                   '<span class="name" id="sidebarTitle">账户</span>')
shell = rep(shell, '<div class="sidebar-subtitle" id="sidebarSubtitle">服务器 · 2 台</div>',
                   '<div class="sidebar-subtitle" id="sidebarSubtitle">凭据 · 8 条</div>')

# ── 侧栏槽：整段换（最近 / 快捷 / KPI / AI）
a = shell.index('                <div class="slot-body">')
b = shell.index('            <div class="sidebar-foot">')
shell = shell[:a] + SLOT_BODY + shell[b:]

# ── Tab 条：整段换（账户 active，运维/文档跳兄弟页）
a = shell.index('                <div class="tabs" role="tablist"')
b = shell.index('</div>', shell.index('账户 <span class="tab-count">8</span>')) + len('</div>')
shell = shell[:a] + TABS + shell[b:]

out.extend(shell.split('\n'))
out.extend(NEW_CONTENT.rstrip('\n').split('\n'))
# ⚠️ 内容区的**收尾四行**（`.detail` / `</main>` / 两层 div）必须自己补回来：
#    它们夹在"最后一张卡"与 `.cmd-mask` 之间，而那一整段是被整段替换掉的。
#    少写这几行浏览器照样渲染（会自动闭合），只有数标签才看得出来 —— 静默的那种错。
out.extend(L[I_MAINCLOSE - 1:I_MAINCLOSE + 3])

# ── 页级浮层：⌘K（换条目）→ 弹窗 → Toast；文件抽屉随「文件分布」一起撤掉
cmd = '\n'.join(L[I_CMD:I_FD])
# ⚠️ 终点取**最后一条 item 那一行的行尾**，不是"「设置 · 模块」之后第一个 `</div>`"——
#    后者关的是条目里那个文字容器，替换会在行中间断开：行尾残料留在外面，
#    再加上原来那个 `</div>`，净多出一个闭合（浏览器照样渲染，只有数深度才看得出来）。
#    CMDLIST 只写到"最后一条 item"，**不带** `</div>` —— 列表的闭合用原来那一行。
_a = cmd.index('        <div class="cmd-list">')
_k = cmd.index('设置 · 模块')
cmd = cmd[:_a] + CMDLIST.rstrip('\n') + cmd[cmd.index('\n', _k):]
out.extend(cmd.split('\n'))
out.extend(L[I_MODALMK:I_SCRIPT])
out.extend(DRAWER.rstrip('\n').split('\n'))

# ── 脚本：壳（含图标表）→ 内容 → 初始化（必须放最后：sectionCount 要读 CREDS）
script_shell = '\n'.join(L[I_SCRIPT:I_INIT])

a = script_shell.index('    const SECTIONS = [')
b = script_shell.index('    ];', a) + len('    ];')
script_shell = script_shell[:a] + NEW_SECTIONS + script_shell[b:]

a = script_shell.index('    function sectionCount(sec) {')
b = script_shell.index('\n    }\n', a) + len('\n    }\n')
script_shell = script_shell[:a] + NEW_SECTIONCOUNT + '\n' + script_shell[b:]

# 图标表补条目（插在 grid/list 那两条之前，末尾两条之后不再有逗号问题）
NEW_SPY = '''    /* ============ 当前项跟着滚动走 ============
       不跟的话就会出现"圆盘说在看凭据、眼睛已经在轮换计划"两套说法。
       取法：以滚动口顶部往下 130px 画一条判据线，取**顶边越过它最多**的那一个分区。
       ⚠️ 判据要写成"越过最多"而不是"最后一个越过" —— 两个分区若在同一条水平线上
          （并排的两张卡），后者会让左边那张永远当不上当前项。 */
    function spy() {
        if (!scroller || Date.now() < spyLock) return;
        const top = scroller.getBoundingClientRect().top;
        let cur = SECTIONS[0].key, best = -Infinity;
        SECTIONS.forEach(s => {
            const el = sectionEl(s.key);
            if (!el) return;
            const d = el.getBoundingClientRect().top - top;
            if (d <= 130 && d > best) { best = d; cur = s.key; }
        });
        if (cur !== activeKey) { activeKey = cur; syncChrome(false); }
    }'''

OLD_SPY = """    /* ============ 当前项跟着滚动走 ============
       不跟的话就会出现"圆盘说在看服务器、眼睛已经在发布记录"两套说法。
       取法：以滚动口顶部往下 130px 画一条判据线，取最后一个顶边越过它的分区。 */
    function spy() {
        if (!scroller || Date.now() < spyLock) return;
        const top = scroller.getBoundingClientRect().top;
        let cur = SECTIONS[0].key;
        SECTIONS.forEach(s => {
            const el = sectionEl(s.key);
            if (el && el.getBoundingClientRect().top - top <= 130) cur = s.key;
        });
        if (cur !== activeKey) { activeKey = cur; syncChrome(false); }
    }"""

# 图标表补条目：插在**表尾**（`const ICON = {` 与紧随其后的第一条 `    };` 之间）。
# ⚠️ 不要拿"某条图标的注释"当锚点 —— 那条注释会随它描述的功能一起被删掉（踩过：
#    布局切换被撤掉时，`/* 布局切换用的一对 … */` 一起没了，整个构建就断在断言上）。
_a = script_shell.index('    const ICON = {')
_b = script_shell.index('\n    };\n', _a)
assert 0 < _b - _a < 4000, 'ICON 表的表尾没找准'
script_shell = script_shell[: _b] + ',' + '\n' + NEW_ICONS_EXTRA.rstrip('\n') + script_shell[_b:]

assert OLD_SPY in script_shell, 'spy() 没找到'
script_shell = script_shell.replace(OLD_SPY, NEW_SPY, 1)

out.extend(script_shell.split('\n'))

# Toast 块原样保留（内容脚本第一件事就要用它）
toast_block = '\n'.join(L[I_TOASTHDR:I_TOASTEND + 2])   # +2：带上函数收尾那个 `}`
out.extend(toast_block.split('\n'))
out.extend(NEW_JS.rstrip('\n').split('\n'))

# 初始化块：从壳里搬出来，放到内容之后
init_block = '\n'.join(L[I_INIT:I_ASSERT + 2])
assert 'syncChrome(false)' in init_block, '初始化块没取对'
out.extend(init_block.split('\n'))
out.append('')
out.append('    /* 图标：一次灌完（静态那一份）。动态生成的（清单行 / 轮换计划 / 平台候选）'
           '在构造时就已经是 svg 字符串，不需要第二遍。 */')
out.append('    paintIcons(document);')
out.append(L[I_SCRCL])
out.extend(L[I_SCRCL + 1:])

# ⚠️ 这里原来有一个 `drop_spine()`：把运维页那支 `--spine`（部署文档书脊的封面色）
#    和它上面紧贴的注释块一起撤掉。**它已经不需要、而且会吃错行** ——
#    运维页后来自己把 `--spine` 的**声明**删干净了，只剩注释里还提了两次这个名字，
#    于是 `'--spine' in l` 命中的是**注释行**，而"往上吃掉紧贴的注释块"那段逻辑
#    会一路 pop 到注释开头 —— 把注释块**前面**的 `--rc` 与 `--rc-fg` 两行真的声明一起吃了
#    （症状：重跑之后账户页 8 处 `var(--rc-fg)` 变成"用了没声明"，而 HTML 里看着像"落后于脚本"）。
#    ⇒ 整段撤掉。源页现在自己就是干净的，派生脚本不该再做这个二次清理。
def drop_comment_block(lines, head):
    """整段吃掉一个注释块（从含 head 的那一行起到它自己的 `*/` 为止）。
       ⚠️ 判据是"这段说明在这个页面里还成不成立"，不是"能不能留"：
          运维页那两段讲的是 `.doc-book` 的封面色（账户页没有书墙），
          留着会让读者去找一个这一页根本不存在的东西。"""
    out, hit = [], False
    for l in lines:
        if head in l:
            hit = True
        if hit:
            if l.strip().endswith('*/'):
                hit = False
            continue
        out.append(l)
    return out


# 运维页留下的两段"`--spine` 已删"的说明 —— 它们是**给有书墙的页**写的。
out = drop_comment_block(out, '/* （这里原来有一支 --spine')
out = drop_comment_block(out, '/* （同上：--spine 随绿封面一起删。')

io.open(DST, 'w', encoding='utf-8').write('\n'.join(out))
print('WROTE', DST, len('\n'.join(out)), 'chars,', len(out), 'lines')
