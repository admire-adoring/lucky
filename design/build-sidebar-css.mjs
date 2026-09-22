/* 生成器：`design/sidebar/sidebar_index.html` 的 <style> → `src/styles/sidebar-shell.css`
   ----------------------------------------------------------------------------
   用法：
     node design/build-sidebar-css.mjs            # 写盘
     node design/build-sidebar-css.mjs --check    # 只比对，不写盘（门禁）

   为什么要有这个脚本，而不是把 CSS 抄进工程：
     1. 项目铁律 —— **CSS 不手抄**。抄一遍就多一份会漂移的第二描述。
     2. 原型是**整页**的样式（含演示主内容、极光、自带的令牌块），
        落成应用只能取其中「外壳」那一部分；"取哪一部分"必须是**可复核的清单**，
        而不是某次人工复制时的记忆。

   ============================================================================
   三件必须做的事（本项目在 `prototype-to-react-port` 里记过教训）
   ============================================================================

   ① **自定义属性全部改道到内核**。
      原型的 `:root` 自带一整套令牌（`--bg-page` / `--text-primary` / `--m-main` …），
      值与内核 `--mw-*` **同义**（实测：`--m-main` 的九组值 = 内核的 `--mw-s-<模块>`）。
      直接把原型那份抄进来 = 调色板出现第二份事实源。
      所以这里做的是**名字映射**：原型 `--x` → 内核 `--mw-x`，
      内核没有等价物的（浮层底衬、悬停底、外壳刻度）才落到 `--sb-*`，
      并在下面 TOKENS 表里逐条写明去向。

   ② **选择器收进 `.sb-root` 作用域**，撞车的类名显式改名。
      原型用的是 `.app` / `.sidebar` / `.topbar` 这批**极通用**的类名 ——
      而内核（`module-workspace.css`）已经把它们定义成另一套东西（220px 两栏栅格、
      `.menu-item` 菜单列表）。不收作用域 + 不改名 = 两套壳互相污染。
      改名只针对**实测撞车**的那几个（见 RENAME），其余保持原型原名以便逐条对照。

   ③ **`.dark` 守卫提到最外层**。
      应用的主题开关写 `<html data-theme>`，`.dark` 这个类**根本不存在**。
      原型里 `.dark X` 那一族会整族变成死规则 —— 样式表里看得见、检查器里也显示，
      就是不匹配，控制台一片安静。所以 `.dark X` → `html[data-theme='dark'] .sb-root X`。
      注意**不能**只把 `.dark` 替换成 `[data-theme='dark']` 留在原位：
      那样它会变成 `.sb-root` 的后代，而 `data-theme` 在 `<html>` 上，同样永远不匹配。

   ============================================================================
   刻意**不搬**的四块（每一块都有判据，见 DROP / REUSE）
   ============================================================================ */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(DIR, 'sidebar/sidebar_index.html')
const OUT = path.join(DIR, '../src/styles/sidebar-shell.css')
const CHECK = process.argv.includes('--check')

const SCOPE = '.sb-root'

/* ---------- ① 令牌去向：原型名 → 内核名 ----------
   左边是原型 `:root` 里的名字，右边是最终要输出的取值。
   `--mw-*` = 内核已有（**唯一事实源**，不再写值）；`--sb-*` = 内核没有等价物。 */
const TOKENS = {
  '--bg-page': 'var(--mw-bg-page)',
  '--bg-sidebar': 'var(--mw-bg-sidebar)',
  '--bg-card': 'var(--mw-bg-card)',
  '--border-subtle': 'var(--mw-border-subtle)',
  '--border-card': 'var(--mw-border-card)',
  '--text-primary': 'var(--mw-text-primary)',
  '--text-secondary': 'var(--mw-text-secondary)',
  '--text-muted': 'var(--mw-text-muted)',
  '--shadow-card': 'var(--mw-shadow-card)',
  '--blur-card': 'var(--mw-blur-card)',
  '--blob-opacity': 'var(--mw-blob-opacity)',
  '--blob-blur': 'var(--mw-blob-blur)',
  '--m1': 'var(--mw-m1)',
  '--m2': 'var(--mw-m2)',
  '--m3': 'var(--mw-m3)',
  '--m-main': 'var(--mw-m-main)',
  /* ↓ 内核没有等价物 —— 落到外壳自己的刻度上，默认值见下方 SHELL_TOKENS */
  '--bg-float': 'var(--sb-bg-float)',
  '--bg-hover': 'var(--sb-bg-hover)',
  '--shadow-float': 'var(--sb-shadow-float)',
  '--m-soft': 'var(--sb-m-soft)',
  '--m-glow': 'var(--sb-m-glow)',
  '--gap-page': 'var(--sb-gap)',
  '--sidebar-w': 'var(--sb-w)',
  '--sidebar-w-collapsed': 'var(--sb-w-collapsed)',
}

/* ---------- ② 撞车改名 ----------
   只改**实测**与现有代码撞车的那几个（跑 `node design/build-sidebar-css.mjs --audit` 复核）。
   ⚠️ 撞车判据是「同名但不同物」，不是「名字像不像」——
      `.dot` / `.name` / `.active` / `.open` 也同名，但它们只以**复合选择器**出现
      （`.sidebar-title .dot`），改名父级之后已经被隔离，不必动。 */
const RENAME = {
  app: 'sb-app',
  sidebar: 'sb-sidebar',
  'sidebar-title': 'sb-head-title',
  topbar: 'sb-topbar',
  'icon-btn': 'sb-icon-btn',
  avatar: 'sb-avatar',
  'quick-btn': 'sb-quick-btn',
}

/* ---------- ③ 丢弃清单（选择器 → 理由）----------
   按**顶层选择器**匹配（前缀式，不是全等 —— `.card:hover .card-value` 这类
   复合选择器也要一并带走，否则会留下"半块"样式）。`@media` / `@keyframes` 按块名匹配。 */
const DROP = [
  [/^\*$/, '全局 reset —— 应用已有 Tailwind preflight'],
  [/^:root$/, '原型自带令牌块 —— 已按 TOKENS 表改道到内核 --mw-*（唯一事实源）'],
  [/^\.dark$/, '同上'],
  [/^html\s*,\s*body$/, '页面级 chrome（height/overflow/字体）由应用持有'],
  [/^\.aurora-bg$/, '极光底衬 —— 应用已有 AuroraBackdrop.tsx，结构逐字一致，只渲染一次'],
  [/^\.blob(-[123])?\b/, '同上'],
  /* 演示主内容：原型这一页的正文是 mock（4 张 KPI 卡 + 一条列表）。
     真页面的正文来自各模块的 panels.tsx，走内核的 .tabs/.panel。
     ⚠️ 尤其 `.card` / `.btn` —— 它们是内核的**接口类名**（700+ 条模块增量规则在引用），
        搬过来会当场改掉全部模块页的卡片与按钮。
     ⚠️ `.main` / `.main-wrap` 也丢，但**容器本身留着**：新壳仍然渲染
        `<main class="main">`，栅格区域名 `main` 由 `.sb-app` 提供 ——
        这样内核的 `.mw-root .main`（padding / overflow / gap）与
        `WorkspaceLayout` 里那句 scroll-to-top 的 `.mw-root .main` 都不用改。 */
  /* `.main-wrap` 丢（原型的栅格包裹层，应用里主区直接挂在 `.sb-app` 上）。
     ⚠️ **`.main` 不丢**，见 BOOST_SCOPE —— 原型那一条给的是主区的**表面**，
        而主区仍是内核的 `.main`（各模块面板的容器）。 */
  [/^\.main-wrap\b/, '演示主内容（原型自己的栅格包裹层）'],
  [/^\.page-/, '演示主内容'],
  [/^\.btn(-primary|-ghost)?\b/, '演示主内容；且 .btn 是内核接口类名，不能覆盖'],
  [/^\.card\b/, '演示主内容；且 .card 是内核接口类名，不能覆盖'],
  [/^\.section\b/, '演示主内容'],
  [/^\.list-/, '演示主内容'],
]

/* ---------- ④ 提高作用域特异性的名单 ----------
   这几个类名**同时**被内核定义，但原型那一条不是"另一套壳"，而是**同一个元素的另一半**：

     `.main` 内核给的是布局（`grid-area: main` / `display: flex` / `gap` / `overflow-y`），
            原型给的是表面（卡片底衬 / 描边 / 圆角 20 / 投影 / 26px 内边距）。
            两者都要，冲突的只有 `padding` 与 `overflow-y`。

   两条规则的特异性都是 0,2,0 —— 让"谁赢"取决于**导入顺序**就是留了一个隐含前提
   （这正是 `workspace-shell.css` 开头记过的那类缺陷）。所以这里把这一条的作用域
   抬成 `.mw-root.sb-root`（0,3,0），确定性压过内核那条，不再依赖顺序。 */
const BOOST_SCOPE = ['main']

/* ---------- ④ 复用清单 ----------
   环形导航（`.radial` / `.radial__*` / `.hub-*`）**不搬**，直接复用
   `src/styles/workbench-hero.css` 里已落地的那一套。判据是三条，缺一不可：

     1. **同一件东西**。工作台 Hero 的九模块环与本原型的侧栏环是同一个元件
        （同族类名 `hub-door` / `hub-dial` / `hub-arc` / `hub-compass__*` / `radial__item`）。
        搬第二份 = 项目最忌讳的「同一元件两份描述」。
     2. **原型这一份代际更旧**。实测关键词对比：
        原型有 `hub-aura` / `hub-back` / `hub-name-flip` / `is-nested`、
        而**没有** `hub-pin` / `hub-door__clip` / `hub-name__pad` / `--nameY`；
        应用那一份反过来。也就是说应用那一份是原型这一份**之后**的迭代。
     3. **里面有用户已定的决策**。`hub-aura`（中心光晕）与「指针射线」是用户
        2026-09-19 / 09-21 明确要求撤掉的，判据写在 workbench-hero.css 的注释里；
        重搬原型这一份会把它们**原样复活**。
        另有 `@keyframes ring-in` / `sel-pulse` 两份同名实现，重搬会互相覆盖。

   所以这一族的规则在下面按选择器前缀丢弃，侧栏只覆盖**刻度**
   （`--r` / `--rl` / `--dial` / 瓦片尺寸）与 `--accent` 接线，见 RING_SCALE。 */
const REUSE_RING = [
  /^\.radial(\.|$|__)/,
  /^\.radial:hover/,
  /^\.hub-/,
  /^\.bubble$/,
]
const REUSE_RING_KEYFRAMES = ['drift', 'pulse', 'ring-in', 'ring-in-strong', 'sel-pulse']

/* ---------- 保留的关键帧要改名：`fadeUp` 这类通用名会与别的层互相覆盖 ---------- */
const KEYFRAME_RENAME = {
  fadeUp: 'sb-fade-up',
  fadeIn: 'sb-fade-in',
  cmdIn: 'sb-cmd-in',
  'slot-in': 'sb-slot-in',
}

/* ---------- ⑤ id 选择器改道 ----------
   原型是静态页，顶栏那几个按钮靠**固定 id**（`#themeBtn` / `#themeIcon` / `#collapseBtn`…）
   给脚本挂监听。React 里 id 是"每实例一份"的东西，用它当选择器等于把 CSS 绑死在某一处渲染上。
   这里只把**出现在选择器里**的那个 id 换成类名，脚本用的 id 不影响样式、不必管。
   `.sb-narrow-keep` 的语义是"窄屏下这几个按钮**不许**被隐藏"，由顶栏组件挂上去。 */
const ID_REMAP = {
  themeBtn: 'sb-narrow-keep',
}

/* ---------- ⑥ 断点改道 ----------
   原型是独立静态页，按 1100 / 900 / 600 三档收敛；应用自己的断点是 **768**（≤768 侧栏变抽屉）。
   ⚠️ 两个断点必须**同一个数**：原型在 ≤900 直接 `display: none` 掉侧栏，
      而应用的抽屉开关是 ≤768 才出现 —— 照搬会出现 768~900 这一段
      **既没有侧栏、也没有开关**的宽度区间，也就是"整页没有任何导航入口"。
      这正是 `workspace-shell.css` 开头记过的那一类缺陷。 */
const BREAKPOINT_REMAP = {
  900: 768,
}

/* ---------- ⑦ 状态色改道 ----------
   原型里写死的状态色，值与应用的设计令牌**逐字相同**，所以这是一次零像素风险的替换：
     #EF4444 = 亮色 --c-error · #F87171 = 暗色 --c-error
   替换之后"红色"只有一个事实源 —— 令牌本身已经按主题分好了两档，
   所以连"暗色要另写一条覆写"都不需要。
   ⚠️ 徽标那支 16% 的底衬**不动**：它在原型的亮暗两套里是同一个 rgba，
      换成 color-mix(--c-error 16%) 反而会让暗色底衬跟着变浅 —— 那是改观感，不是去重。
   ⚠️ `.logo-mark` 的 AI 渐变**也不动**：`--grad-ai` 是"AI 功能入口"的令牌，
      而 logo 是品牌标记；把一支令牌挂到两个用途上，就等于它不再是事实源。 */
const COLOR_REMAP = {
  '#EF4444': 'var(--c-error)',
  '#F87171': 'var(--c-error)',
}

/* ---------- 外壳自己的刻度 ----------
   分两类，**不要混**：

   · **布局刻度**（`--sb-w` / `--sb-w-collapsed` / `--sb-gap` / `--sb-topbar-h`）
     亮暗同值，只写一次。前三支照抄原型 `:root`；顶栏高 68px 是应用侧算出来的
     （胶囊 10+10 内边距 + 内容 48），原型没有这个数 —— 原型靠内容撑高。

   · **配色**（`--sb-bg-float` / `--sb-bg-hover` / `--sb-shadow-float` /
     `--sb-m-soft` / `--sb-m-glow`）**必须亮暗各写一份**，逐支的理由写在下面。

   ============================================================================
   这五支为什么不转发内核
   ============================================================================
   它们在**外壳原型**里有、在 8 个模块原型里一个都没有 —— 而内核的壳令牌来自
   「8 份模块原型里名字与取值逐字一致」的共识（见 `build-workspace-css.mjs`），
   所以内核里没有对应物，转发无处可去。

   ⚠️ 上一版我在这里把其中三支**近似**掉了（`--sb-bg-float` 转发成 `--mw-bg-topbar`
      的 .66/.70、`--sb-shadow-float` 转发成 `--mw-shadow-card`、柔底/辉光固定 12%/32%）。
      症状不是报错，而是**「外壳看起来不像原型」**：
      原型的顶栏/侧栏/主区挂的是**两层浮动投影**（`0 10px 40px` + `0 2px 8px`），
      转发成卡片投影后三块面板都"贴"在页面上而没有浮起感。

   ⚠️ 代价明写：`var(--sb-*)` 一旦写漏，`background: var(--sb-bg-float)` 会变成
      **非法值、整条声明被丢弃**（元素透明），浏览器零报错。
      本文件的「门禁 2」会查 `var()` 引用有没有定义，所以写漏会当场红。
*/
const SHELL_TOKENS = `/* ---------- 外壳刻度（亮色为基准值；暗色在下面覆盖） ---------- */

.sb-root {
  --sb-w: 300px;
  --sb-w-collapsed: 64px;
  --sb-gap: 16px;
  --sb-topbar-h: 68px;

  /* 浮层底衬（顶栏 / 命令面板）。原型 「--bg-float」：亮 .78 / 暗 .85 ——
     比侧栏（.72/.78）更实一档，因为它是浮在别的玻璃**之上**的那一层。 */
  --sb-bg-float: rgba(255,255,255,0.78);

  /* 悬停底。原型 「--bg-hover」：亮 rgba(15,23,42,.045) / 暗 rgba(255,255,255,.05)。
     ⚠️ 别改回 「color-mix(var(--mw-text-primary) 5%)」：那会跟着**主文字色**走，
        而暗色的主文字是 「#F1F5F9」（偏蓝白），压出来的悬停底会带一层冷调。 */
  --sb-bg-hover: rgba(15,23,42,0.045);

  /* 浮动投影。原型 「--shadow-float」：**两层** —— 大范围弥散 + 贴边接触影。
     顶栏 / 侧栏 / 主区 / 命令面板四块读的都是这一支。 */
  --sb-shadow-float: 0 10px 40px rgba(15,23,42,0.10), 0 2px 8px rgba(15,23,42,0.04);

  /* 强调色的柔底与辉光。原型按模块写成 「rgba(当前模块主色, α)」，
     这里用 color-mix 在 sRGB 下取同一个 α —— 于是它会**跟着模块走**，
     不需要为九个模块各写一遍。
     ⚠️ α 取的是原型**运行时**的值（脚本 applyColors：亮 .10/.28、暗 .16/.40），
        不是它 :root/.dark 里那几支字面量。原型的 :root 写 .10/.14、.dark 写
        「--m-soft: rgba(...,0.14)」，但脚本一加载就会把它们覆盖成 .10/.16 ——
        **暗色那支差 0.02**。读字面量会得到一支原型从来不显示的值。 */
  --sb-m-soft: color-mix(in srgb, var(--mw-m-main) 10%, transparent);
  --sb-m-glow: color-mix(in srgb, var(--mw-m-main) 28%, transparent);
}

/* ⚠️ 选择器抬到 「html[data-theme='dark'] .sb-root」（0,2,0）而不是 「.sb-root.dark」：
   应用的主题写在 「<html>」 上，「.sb-root」 上永远没有那个类 —— 写成后者的症状是
   **暗色下这五支全部不动**（仍取亮色值），而页面其余部分已经变暗，看起来像"漏改了几处"。 */
html[data-theme='dark'] .sb-root {
  --sb-bg-float: rgba(15,23,42,0.85);
  --sb-bg-hover: rgba(255,255,255,0.05);
  --sb-shadow-float: 0 10px 40px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.3);
  --sb-m-soft: color-mix(in srgb, var(--mw-m-main) 16%, transparent);
  --sb-m-glow: color-mix(in srgb, var(--mw-m-main) 40%, transparent);
}`

/* ---------- 环形的侧栏刻度 ----------
   几何数取自原型的脚本常量 `R = 76, RL = 118` 与 CSS 的 `--dial: 62px`、瓦片 34px。
   只覆盖刻度，不动 workbench-hero.css 的任何一条规则。 */
const RING_SCALE = `/* ---------- 环形导航的侧栏刻度 ----------
   复用 workbench-hero.css 的 .radial / .radial__item / .hub-*（见脚本头 REUSE_RING 的判据）。
   这里只改三件事，都是"侧栏比 Hero 窄"带来的尺度差：

     · 半径 92/130 → 76/118、表盘 82 → 62（原型脚本里的 R/RL 与 CSS 的 --dial）
     · 瓦片 44 → 34（Hero 是九项 40° 一档，侧栏是模块 Tab，最多 12 项 30° 一档）
     · --accent 接到本模块强调色上。Hero 的 --accent 来自页面上的 [data-accent]，
       模块页没有那个属性，会落回 @property 的 initial-value（品牌紫）——
       于是"当前项"的高亮会是紫的，而不是当前模块的颜色。 */

.sb-ring {
  --accent: var(--mw-m-main);
  --accent-deep: var(--mw-m-main);
}

.sb-ring .radial {
  --r: 76px;
  --rl: 118px;
  --dial: 62px;
  /* 环在原型的侧栏里是**定宽正方形**（2×(rl+12)），不是撑满一行。
     Hero 那一份是 width:100%（Hero 本身就够宽），照过来会让环在 300px 侧栏里溢出。 */
  width: calc(2 * (var(--rl) + 12px));
  height: calc(2 * (var(--rl) + 12px));
  flex-shrink: 0;
}

/* 瓦片的状态。
   ⚠️ 工作台那一份的画法是 ".radial__item .g .g1 .mod-tile" ——
      实底由 prism.css 的 ".g.mod-tile[data-current='true']" 给（0,3,0）。
      而侧栏环上的瓦片**不是模块**，不挂 .mod-tile，于是那一族规则不匹配：
      实测 data-current='true' 的瓦片 background-color 仍是 rgba(0,0,0,0)、
      文字色是 rgb(30,41,59)（深墨）—— "当前在哪"只剩一圈发光，
      在白底上几乎读不出来。所以这里按**侧栏刻度**把实底补回来：
      悬停是淡染、当前是实底白字，与模块瓦片同一套语义。
   ⚠️ 本段是模板字符串，**一个反引号都不能出现**（参见上面那条同名警告）。 */
.sb-ring .radial__item {
  width: 34px;
  height: 34px;
  color: var(--mw-text-secondary);
  background: transparent;
  border: 1px solid transparent;
}

.sb-ring .radial__item:hover {
  color: var(--mw-m-main);
  background: var(--sb-m-soft);
}

/* 放在 hover 之后：当前项被悬停时，实底要压过淡染（同特异性，后到者赢） */
.sb-ring .radial__item[data-current='true'] {
  background: var(--mw-m-main);
  color: #fff;
}

/* 外圈标签：原型 11px / 单行省略。
   ⚠️ 标签宽度上限原型给的是 76px，这里**必须收到 58px**，否则会叠字。
      判据：相邻标签中心的弦长 = 2 · rl · sin(π / n)，n = 12（工作模块 Tab 最多）时约 61px，
      两个标签各占一半 → 每个不得超过 ~61px。76px 是按原型自己那九个模块算的
      （n = 9 时弦长约 81px），换成"模块的 Tab"之后项数变多、弦长变短，同一个数就不再成立。
      标签是 2~4 个汉字（10.5px ≈ 每字 10.5px）→ 58px 装得下 4 字，再长走省略号。
   ⚠️ 这段注释里**不能出现反引号**：整段是模板字符串，一个反引号就会把它提前闭合
      （症状是 SyntaxError 指向很远的一行，而真正的原因在这里）。与技能里那条
      「注释里的星号紧跟斜杠」是同一类坑，所以一律用引号或书名号。 */
.sb-ring .radial__label {
  font-size: 10.5px;
  font-weight: 500;
  opacity: 0.9;
  max-width: 58px;
  overflow: hidden;
  text-overflow: ellipsis;
}`

/* ============================================================================
   解析与变换
   ============================================================================ */

/** 极简 CSS 切块：顶层「规则 / @块」逐块取出，保留原文。
 *
 * ⚠️ 必须**同时**认注释与字符串两种"内部状态"。
 *    只认注释是不够的：`content: "}"` 这类**带引号的值里出现花括号**会当场把
 *    深度计数带偏 —— 于是后面一大段规则被当成前一条规则的**规则体**吞进去，
 *    而 `emit` 对规则体只做令牌/关键帧替换、不做作用域前缀与改名。
 *    症状极具欺骗性：产物看起来"大部分是对的"、只有一小段没有作用域，
 *    类名门禁报出来的却是那一段里的**原始**类名（看起来像"改名漏了"）。 */
function splitTop(css) {
  const out = []
  let start = 0
  let depth = 0
  let mode = null // null | 'comment' | 'string'
  let quote = ''
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]
    const two = css.slice(i, i + 2)

    if (mode === 'comment') {
      if (two === '*/') {
        mode = null
        i++
      }
      continue
    }
    if (mode === 'string') {
      if (ch === '\\') {
        i++
        continue
      }
      if (ch === quote) mode = null
      continue
    }
    if (two === '/*') {
      mode = 'comment'
      i++
      continue
    }
    if (ch === '"' || ch === "'") {
      mode = 'string'
      quote = ch
      continue
    }
    if (ch === '{') {
      depth++
      continue
    }
    if (ch === '}') {
      depth--
      if (depth === 0) {
        out.push(css.slice(start, i + 1))
        let j = i + 1
        while (j < css.length && /\s/.test(css[j])) j++
        start = j
        i = j - 1
      }
      if (depth < 0) throw new Error(`原型 CSS 里出现多余的「}」，位置 ${i}`)
      continue
    }
  }
  if (depth !== 0) throw new Error(`原型 CSS 的花括号不配平（剩余深度 ${depth}）`)
  return out.filter((b) => b.trim())
}

/** 取块的选择器（'{' 之前那一截），去掉前导注释与空白 */
function selectorOf(block) {
  const head = block.slice(0, block.indexOf('{'))
  return head
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 把一条选择器改名（整词匹配，避免 .app 改到 .appbar 上） */
function renameClasses(sel) {
  return sel.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(RENAME, name) ? '.' + RENAME[name] : whole,
  )
}

/** 把选择器里的固定 id 换成类名（见 ID_REMAP 的判据） */
function remapIds(sel) {
  return sel.replace(/#([a-zA-Z][a-zA-Z0-9_-]*)/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(ID_REMAP, name) ? `.${ID_REMAP[name]}` : whole,
  )
}

/** 断点改道：`@media (max-width: 900px)` → 768px（见 BREAKPOINT_REMAP 的判据） */
function remapBreakpoints(prelude) {
  let out = prelude
  for (const [from, to] of Object.entries(BREAKPOINT_REMAP)) {
    out = out.replace(new RegExp(`(max-width\\s*:\\s*)${from}px\\b`), `$1${to}px`)
  }
  return out
}

/**
 * 作用域前缀 + 主题守卫。
 * ⚠️ 守卫必须**提到最外层**：`.dark X` → `html[data-theme='dark'] .sb-root X`。
 *    留在原位（`.sb-root .dark X`）会永远不匹配 —— `data-theme` 在 `<html>` 上。
 */
function scopeSelector(sel) {
  return sel
    .split(',')
    .map((one) => {
      let s = remapIds(one.trim())
      if (!s) return s
      const dark = /^\.dark\b/.test(s)
      if (dark) s = s.replace(/^\.dark\b\s*/, '')
      const bare = s.match(/^\.([a-zA-Z][a-zA-Z0-9_-]*)\b/)
      const boosted = bare && BOOST_SCOPE.includes(bare[1])
      const themed = dark
        ? `html[data-theme='dark'] ${boosted ? '.mw-root.sb-root' : SCOPE}`
        : boosted
          ? '.mw-root.sb-root'
          : SCOPE
      return `${themed} ${renameClasses(s).trim()}`.replace(/\s+/g, ' ').trim()
    })
    .filter(Boolean)
    .join(', ')
}

/**
 * 统一缩进。
 *
 * 原型 CSS 的缩进是"整页排版"的八格制，切成单条规则之后会变成一堆
 * 参差不齐的深缩进 —— 700 行里几乎每一行都从第 9 格开始，review 时看不出层级。
 * 这里按**花括号深度**重排一次：只动行首空白，不动任何字符。
 */
function reindent(text) {
  const out = []
  let depth = 0
  for (const raw of text.split('\n')) {
    let line = raw.trim()
    if (!line) {
      out.push('')
      continue
    }
    // 选择器与左花括号之间补一个空格（原型里有 `X{` 的写法）
    line = line.replace(/([^\s{])\{$/, '$1 {')
    // 行首是 `}` 的先退一级：它属于上一级
    const leadingClose = /^\}/.test(line)
    if (leadingClose) depth = Math.max(0, depth - 1)
    out.push('  '.repeat(depth) + line)
    const opens = (line.match(/\{/g) || []).length
    const closes = (line.match(/\}/g) || []).length
    // 行首那个 `}` 已经退过了，计数时不要再算一次
    depth += opens - (closes - (leadingClose ? 1 : 0))
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** 映射表里的目标名：`var(--mw-bg-page)` 与 `--sb-w` 两种写法都归一成 `--xxx` */
const tokenName = (v) => v.replace(/^var\((.*)\)$/, '$1')

/**
 * 令牌名改道 —— 引用处（`var(--x`）与**声明处**（`--x:`）都要改。
 *
 * 声明处为什么也要改：原型顶层的 `:root` 令牌块整块丢弃，所以那里不需要；
 * 但 `@media` 里的**断点令牌覆写**（`@media (max-width:1100px){ :root{ --sidebar-w:280px } }`）
 * 是设计意图、要被保留 —— 留着旧名字就等于这条覆写接不上（重复声明一个新变量，
 * 而真正的 `--sb-w` 还是 300px）。**症状是"某个断点看起来没生效"且零报错。**
 */
function retoken(text) {
  return text
    .replace(/var\(--([a-z0-9-]+)/g, (whole, name) =>
      Object.prototype.hasOwnProperty.call(TOKENS, `--${name}`) ? `var(${tokenName(TOKENS[`--${name}`])}` : whole,
    )
    .replace(/(^|[\s;({])--([a-z0-9-]+)\s*:/g, (whole, pre, name) =>
      Object.prototype.hasOwnProperty.call(TOKENS, `--${name}`) ? `${pre}${tokenName(TOKENS[`--${name}`])}:` : whole,
    )
}

/** 关键帧改名：定义处与 animation 引用处 */
function rekeyframe(text) {
  let out = text
  for (const [from, to] of Object.entries(KEYFRAME_RENAME)) {
    out = out.replace(new RegExp(`@keyframes\\s+${from}\\b`, 'g'), `@keyframes ${to}`)
    out = out.replace(new RegExp(`(animation(?:-name)?\\s*:[^;]*?)\\b${from}\\b`, 'g'), `$1${to}`)
  }
  return out
}

/** 状态色改道（见 COLOR_REMAP 的判据） */
function recolor(text) {
  let out = text
  for (const [from, to] of Object.entries(COLOR_REMAP)) out = out.split(from).join(to)
  return out
}

function dropReason(sel, insideMedia) {
  /* `:root` / `.dark` 在**顶层**是原型那整套令牌块（已按 TOKENS 改道，整块丢）；
     但在 `@media` 里出现时它是**断点上的令牌覆写**（例如 ≤1100px 把 --sidebar-w 收成 280px）——
     那是设计意图，要留，只要把选择器从 `:root` 换成作用域根即可。 */
  if (insideMedia && /^(:root|\.dark)$/.test(sel)) return null
  for (const [re, why] of DROP) if (re.test(sel)) return why
  for (const re of REUSE_RING) if (re.test(sel)) return '复用 workbench-hero.css 的环（见脚本头 REUSE_RING）'
  return null
}

/**
 * 关键帧去悬空。
 *
 * 原型的 `fadeUp` / `fadeIn` 挂在**演示主内容**（`.section` / `.card`）上；
 * 那些块被丢掉之后，关键帧就成了"定义了但没有任何规则在用"的死代码。
 * 判据是机械的：`@keyframes X` 的 X 必须在产物的 `animation:` 里出现过。
 * ⚠️ 顺序是"先剥注释再匹配"：注释里提到某个动画名（本项目注释写得很啰嗦）
 *    会把它从"死"救成"活"，那正是这条守卫要防的假阴性。
 */
function pruneKeyframes(text) {
  const stripped = text.replace(/\/\*[\s\S]*?\*\//g, '')
  const used = new Set()
  for (const m of stripped.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
    for (const word of m[1].matchAll(/[a-zA-Z_][a-zA-Z0-9_-]*/g)) used.add(word[0])
  }
  const dropped = []
  const kept = text.replace(/@keyframes\s+([a-zA-Z_][a-zA-Z0-9_-]*)\s*\{/g, (whole, name, offset) => {
    if (used.has(name)) return whole
    // 连同整块一起删：找到与之配对的闭合花括号
    let depth = 0
    let i = offset + whole.length - 1
    for (; i < text.length; i++) {
      if (text[i] === '{') depth++
      else if (text[i] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    dropped.push(name)
    return `\u0000DROP\u0000${i + 1}`
  })
  if (!dropped.length) return text
  // 把占位标记连同它到下一个标记/行尾之间的内容一起吃掉
  let out = ''
  let cursor = 0
  for (const m of kept.matchAll(/\u0000DROP\u0000(\d+)/g)) {
    out += kept.slice(cursor, m.index)
    cursor = parseInt(m[1], 10)
  }
  out += kept.slice(cursor)
  console.log(`  · 丢掉没有任何规则引用的关键帧：${dropped.join(', ')}`)
  return out
}

const stats = { kept: 0, dropped: 0, reused: 0 }

/** 递归处理：普通规则 / @media（内含规则）/ @keyframes */
function emit(block, indent = '', insideMedia = false) {
  const sel = selectorOf(block)
  const body = block.slice(block.indexOf('{'))

  if (sel.startsWith('@media')) {
    const inner = splitTop(body.slice(1, -1))
    const parts = inner.map((b) => emit(b, '  ', true)).filter(Boolean)
    if (!parts.length) return ''
    return `${indent}${remapBreakpoints(sel)} {\n${parts.join('\n\n')}\n${indent}}\n`
  }

  if (sel.startsWith('@keyframes')) {
    const name = sel.replace('@keyframes', '').trim()
    if (REUSE_RING_KEYFRAMES.includes(name)) {
      stats.reused++
      return ''
    }
    stats.kept++
    return `${indent}${rekeyframe(`${sel}${body}`)}\n`
  }

  const why = dropReason(sel, insideMedia)
  if (why) {
    if (why.startsWith('复用 workbench-hero')) stats.reused++
    else stats.dropped++
    return ''
  }

  stats.kept++
  /* 断点里的 `:root` → 作用域根；`.dark` → 主题守卫（同样要提到最外层） */
  const scoped =
    insideMedia && /^(:root|\.dark)$/.test(sel)
      ? sel === ':root'
        ? SCOPE
        : `html[data-theme='dark'] ${SCOPE}`
      : scopeSelector(sel)
  return `${indent}${scoped}${recolor(rekeyframe(retoken(body)))}\n`
}

/* ============================================================================
   主流程
   ============================================================================ */

const html = fs.readFileSync(SRC, 'utf8')
const style = html.match(/<style>([\s\S]*?)<\/style>/)
if (!style) throw new Error(`原型里找不到 <style>：${SRC}`)

const blocks = splitTop(style[1])
const emitted = reindent(pruneKeyframes(blocks.map((b) => emit(b)).filter(Boolean).join('\n')))

const header = `/* ============================================================================
   ${path.relative(path.join(DIR, '..'), OUT)} —— 模块工作区外壳（sidebar 版）
   ----------------------------------------------------------------------------
   ⚠️ 这是**生成物**，不要手改。事实源是 「design/sidebar/sidebar_index.html」 的 <style>，
      改原型后跑：
        node design/build-sidebar-css.mjs          # 写盘
        node design/build-sidebar-css.mjs --check  # 门禁：产物是否过期

   这一层与 「module-workspace.css」（内核）的分工：
     · 内核 = 8 个模块原型共用的**内容**层（.card / .btn / .tabs / .panel / 表单 / 弹窗）
     · 本文件 = 应用**外壳**层（顶栏九模块主导航 / 侧栏头 / 工具槽 / 折叠 / 命令面板 / 栅格）
   所有选择器收在 「${SCOPE}」 之下，撞车的类名已改名（见脚本 RENAME），
   所以它与内核**零冲突** —— 导入顺序不再承担任何隐含前提。

   产出统计：保留 ${stats.kept} 块 · 丢弃 ${stats.dropped} 块 · 复用内核环 ${stats.reused} 块
   ========================================================================= */

`

const out = `${header}${SHELL_TOKENS}\n\n${RING_SCALE}\n\n${emitted}`

/* ---------- 门禁 1：产出里不得出现内核的外壳类名 ----------
   报告要**带上命中的原文**：只报类名的话，下一步还是得手工回去找。 */
const forbidden = []
for (const name of ['app', 'sidebar', 'topbar', 'card', 'btn', 'tabs', 'tab', 'panel', 'menu-item', 'switch']) {
  const re = new RegExp(`\\.${name}\\b(?![a-zA-Z0-9_-])`, 'g')
  for (const m of emitted.matchAll(re)) forbidden.push(`.${name} :: ${emitted.slice(Math.max(0, m.index - 70), m.index + 70).replace(/\n/g, '⏎')}`)
}
if (forbidden.length) {
  console.error('✗ 产物里出现了未改名/未丢弃的内核外壳类名（会被内核那套抢样式）：')
  for (const line of new Set(forbidden)) console.error(`    ${line}`)
  process.exit(1)
}

/* ---------- 门禁 2：var() 引用必须有定义 ----------
   「有没有定义」要扫**全部**样式表，不能只扫内核 ——
   本层还会有意引用别的层（例如状态色 `--c-error` 在 design-tokens.css 里）。
   只扫一层的话，一条正确的引用会被报成漏定义，门禁就变成噪声源。 */
const cssFiles = fs
  .readdirSync(path.join(DIR, '../src/styles'))
  .filter((f) => f.endsWith('.css') && f !== path.basename(OUT))
const defined = new Set()
for (const f of cssFiles) {
  const text = fs.readFileSync(path.join(DIR, '../src/styles', f), 'utf8')
  for (const m of text.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1])
}
for (const m of out.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1])
const missing = new Set()
for (const m of out.matchAll(/var\((--[a-z0-9-]+)/g)) {
  const v = m[1]
  // 由 React 写在 style 属性上的"逐实例参数"不在样式表里定义
  if (['--a', '--lx', '--ly', '--i', '--arc', '--r', '--rl', '--dial', '--bx', '--by', '--na'].includes(v)) continue
  if (!defined.has(v)) missing.add(v)
}
if (missing.size) {
  console.error(`✗ 引用了但没定义的令牌：${[...missing].join(', ')}`)
  process.exit(1)
}

/* ---------- 写盘 / 比对 ---------- */
const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null
if (CHECK) {
  if (prev === out) {
    console.log(`✓ ${path.relative(process.cwd(), OUT)} 与原型一致（保留 ${stats.kept} / 丢弃 ${stats.dropped} / 复用 ${stats.reused}）`)
  } else {
    console.error(`✗ ${path.relative(process.cwd(), OUT)} 已过期 —— 重跑一次 build-sidebar-css.mjs 写盘`)
    process.exit(1)
  }
} else {
  fs.writeFileSync(OUT, out)
  console.log(
    `✓ 已写 ${path.relative(process.cwd(), OUT)}  ·  保留 ${stats.kept} 块 / 丢弃 ${stats.dropped} 块 / 复用内核环 ${stats.reused} 块`,
  )
}
