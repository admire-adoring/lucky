/* 生成器：`design/ai-assistant/ai-assistant_index.html` 的 <style> → `src/styles/ai-assistant.css`
   ----------------------------------------------------------------------------
   用法：
     node design/build-ai-css.mjs            # 写盘
     node design/build-ai-css.mjs --check    # 只比对，不写盘（门禁）

   为什么要有这个脚本，而不是把 CSS 抄进工程：
     1. 项目铁律 —— **CSS 不手抄**。抄一遍就多一份会漂移的第二描述。
     2. 原型是**整页**的样式（含演示极光、自带的令牌块、它自己那条顶栏），
        落成应用只能取其中「这一页的正文」那一部分；"取哪一部分"必须是**可复核的清单**，
        而不是某次人工复制时的记忆。

   ============================================================================
   先量出来的三件事（`node design/debug/audit-ai.mjs` 可复现）
   ============================================================================

   ① **中性令牌与内核逐字相同**。原型 `:root` 的 24 支里，`--bg-page` / `--bg-card` /
      `--bg-sidebar` / `--border-card` / `--border-subtle` / `--text-primary` /
      `--text-secondary` / `--text-muted` / `--shadow-card` / `--blur-card` /
      `--blob-opacity` / `--blob-blur` 与内核 `--mw-*` **值完全一致**（#F7F8FA、
      rgba(255,255,255,0.62) … 逐字对上）。所以下面 TOKENS 里的这 12 条改道是
      **零像素风险**的改名，不是"取个相近的值"。

   ② 剩下 5 支（`--bg-float` / `--bg-hover` / `--shadow-float` / `--m-soft` / `--m-glow`）
      与**外壳层**（`sidebar-shell.css`）已经落地的那 5 支 `--sb-*` **值也一致** ——
      原型与外壳原型本来就是同一份设计。所以改道到 `--sb-*`，仍然零像素风险。
      ⚠️ 不另起 `--ai-*` 的名字：那会让"浮层底衬"出现第二份事实源。
      只有 `--sidebar-w` / `--aside-w` / `--gap-page` 三支是**布局刻度**，
      gap 转发到 `--sb-gap`（16px，同在），另两支落成 AI 层自己的 `--ai-*`。

   ③ **类名撞车 29 个**，但真正的"同名不同物"只有两类：
      · 内核有**根作用域**规则的 4 个 —— `.app` / `.sidebar` / `.main` / `.topbar`
        （`.mw-root .app` 那一条是 220px 两栏栅格，与原型完全是两套壳）→ **必须改名**。
      · 内核有**模块作用域**规则的 —— `.aside*` / `.icon-btn` / `.switch` / `.toast`
        （都收在 `[data-module='projects'|'calendar'|'settings']` 下）。
        它们不会泄漏到本页，但**同名不同物**这件事本身要消掉 ——
        下一个人 grep `.switch` 时会看到两处定义，而"哪个在哪生效"要靠作用域推。
      · 其余（`.dot` / `.name` / `.active` / `.open` / `.done` / `.on` …）只以
        **复合选择器**出现（`.session-item.active`），改名父级之后已被隔离，**不动**。

   ============================================================================
   与 `build-sidebar-css.mjs` 是**兄弟**，不是同一条路
   ============================================================================
   侧栏那一层是「换外壳」：它把原型的顶栏/侧栏换成应用的，只留下外壳刻度。
   这一层是「**多一页**」：原型的四栏结构整套留下，只把"顶栏"换成外壳的
   （所以 `.topbar*` 整族丢弃，见 DROP），并让出的那一行高度由应用给。

   ⚠️ 两层的类名互不重叠（`.sb-*` vs `.ai-*`），所以**导入顺序依然不承担任何前提**。 */

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const DIR = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.join(DIR, 'ai-assistant/ai-assistant_index.html')
const OUT = path.join(DIR, '../src/styles/ai-assistant.css')
const CHECK = process.argv.includes('--check')

const SCOPE = '.ai-root'

/* ---------- ① 令牌去向：原型名 → 已有令牌名 ----------
   左列是原型 `:root` 的名字，右列是最终取值。
   `var(--mw-*)` = 内核已有 · `var(--sb-*)` = 外壳层已有 · `--ai-*` = 本层自己的布局刻度。
   **一条新色值都不该出现在这张表里** —— 出现就说明"同一件事有第二份描述"。 */
const TOKENS = {
  /* 与内核 --mw-* 逐字同值（见文件头 ①） */
  '--bg-page': 'var(--mw-bg-page)',
  '--bg-card': 'var(--mw-bg-card)',
  '--bg-sidebar': 'var(--mw-bg-sidebar)',
  '--border-card': 'var(--mw-border-card)',
  '--border-subtle': 'var(--mw-border-subtle)',
  '--text-primary': 'var(--mw-text-primary)',
  '--text-secondary': 'var(--mw-text-secondary)',
  '--text-muted': 'var(--mw-text-muted)',
  '--shadow-card': 'var(--mw-shadow-card)',
  '--blur-card': 'var(--mw-blur-card)',
  '--blob-opacity': 'var(--mw-blob-opacity)',
  '--blob-blur': 'var(--mw-blob-blur)',
  /* 强调色系列。--m-main 的亮/暗两支（#6366F1 / #818CF8）与内核 --mw-s-dashboard
     逐字相同；--m-grad（135deg 三档 indigo→violet→purple）与 design-tokens 的
     --grad-ai 是**同一条渐变**（只差停靠点写没写 0%/50%/100%） */
  '--m-main': 'var(--mw-m-main)',
  '--m-grad': 'var(--grad-ai)',
  /* 与外壳层 --sb-* 逐字同值（见文件头 ②） */
  '--bg-float': 'var(--sb-bg-float)',
  '--bg-hover': 'var(--sb-bg-hover)',
  '--shadow-float': 'var(--sb-shadow-float)',
  '--m-soft': 'var(--sb-m-soft)',
  '--m-glow': 'var(--sb-m-glow)',
  '--gap-page': 'var(--sb-gap)',
  /* 本层自己的布局刻度 */
  '--sidebar-w': 'var(--ai-sidebar-w)',
  '--aside-w': 'var(--ai-aside-w)',
  /* 状态色：原型 `--m-success` / `--m-danger` / `--m-warn` 在**第二轮原型**里真的被用上了
     （`.toast.warn`、`msg-stopped-badge`、`continue-btn`、搜索结果的 `mark` 高亮等）。
     亮色档与 `--c-*` **逐字相同**（#10B981 / #EF4444 / #F59E0B），暗色档不同 ——
     仍然改道到 `--c-*`：判据与 `build-sidebar-css.mjs` 的 COLOR_REMAP 同一条，
     **状态色由令牌层持有**，本层不该冻结一个"只对亮色成立"的值。
     代价明写：暗色下这三处会比原型略亮（#FBBF24 / #F87171 / #34D399），
     那是"主题化"的正常结果，不是走样。 */
  '--m-success': 'var(--c-success)',
  '--m-danger': 'var(--c-error)',
  '--m-warn': 'var(--c-warning)',
}

/* ---------- ② 撞车改名（判据见文件头 ③）---------- */
const RENAME = {
  app: 'ai-app',
  sidebar: 'ai-sidebar',
  'sidebar-head': 'ai-sidebar-head',
  main: 'ai-main',
  aside: 'ai-aside',
  'aside-card': 'ai-aside-card',
  'aside-title': 'ai-aside-title',
  'icon-btn': 'ai-icon-btn',
  switch: 'ai-switch',
  /* `search-input` —— 原型**第二轮**新增的那个顶栏搜索框带来的。
     它与内核 `module-workspace.css` 的 `.search-input` 同名（知识库面板也在用），
     而那是**另一件东西**（列表页的筛选输入框）。不改名的话，两边会互相套样式：
     知识库那个框会拿到顶栏搜索框的 999px 胶囊外观、反过来也一样。
     判据仍是「同名**不同物**」——不是"名字像不像"。 */
  'search-input': 'ai-search-input',
  /* toast 整族丢弃（复用 `stores/toast-store` + `ToastHost`），
     这里登记名字只为让「产物里不得出现内核类名」那条门禁能算得清。 */
  toast: 'ai-toast',
  'toast-container': 'ai-toast-container',
}

/* ---------- ③ 丢弃清单（选择器 → 理由）----------
   按**顶层选择器**前缀匹配（不是全等 —— `.topbar-title .badge-ai` 这类复合选择器
   只要父级被丢掉，就该一起走）。`@media` / `@keyframes` 按块名匹配。 */
const DROP = [
  [/^\*$/, '全局 reset —— 应用已有 Tailwind preflight'],
  [/^:root$/, '原型自带令牌块 —— 已按 TOKENS 表改道到内核/外壳令牌（唯一事实源）'],
  [/^\.dark$/, '同上'],
  [/^html\s*,\s*body$/, '页面级 chrome（height / overflow / 字体）由应用持有'],
  [
    /^\.aurora-bg$/,
    '极光底衬 —— 应用已有 AuroraBackdrop.tsx，结构逐字一致、只渲染一次；' +
      '它的三团颜色读 --mw-m1/2/3，由本层的色指针给（见下方 AI_TOKENS）',
  ],
  /* ⚠️ 原型里 `.dark .blob-1/2/3` 这三条**以 `.dark` 开头**，按 `.blob` 前缀匹配不到。
     处置是 `dropReason` 里**先剥掉前导的 `.dark` 再判** —— 与作用域变换同一口径。
     不剥的话会留下三条只给 blob 上色的死规则，而 blob 已经不渲染了。 */
  [/^\.blob(-[123])?\b/, '同上（极光的三团，含 .dark 下的那三条 —— 见 dropReason 的剥 `.dark`）'],
  [/^\.topbar\b/, '顶栏 —— 本页换成应用外壳的 ShellTopbar（九域导航 + 窗口控制都在那儿）'],
  [/^\.topbar-right$/, '同上（外壳的对应件叫 .topbar-right，由 sidebar-shell.css 给）'],
  [/^\.logo-mark$/, 'logo —— 外壳已有 .logo-mark（品牌标记只有一处事实源）'],
  [/^\.toast\b/, 'Toast —— 复用 stores/toast-store + components/ui/ToastHost（全站一份实现）'],
  [
    /^\.code(-block|-head|-copy|-body)?$/,
    '代码块 —— 原型里**没有任何消息用到它**（示例消息只有 <b> 与 .msg-quote）。' +
      '按"不留死规则"处置：真的需要代码块时再连同消息渲染一起加，' +
      '否则它会是一条永远不匹配的样式（`@keyframes` 那一支同理）。',
  ],
]

/* ---------- ④ 断点改道 ----------
   原型是独立静态页，按 1200 / 900 两档收敛；应用自己的断点是 **768**（≤768 侧栏变抽屉）。
   ⚠️ 两个断点必须**同一个数**：原型在 ≤900 直接 `display: none` 掉侧栏，
      而应用的抽屉开关是 ≤768 才出现 —— 照搬会出现 768~900 这一段
      **既没有侧栏、也没有开关**的宽度区间，也就是"整页没有任何会话入口"。
      这正是 `workspace-shell.css` 开头记过的那一类缺陷。
   1200 不动：应用对右栏用的也是 1200（项目域那里 `display:none`、工作台那里落下一行）。 */
const BREAKPOINT_REMAP = {
  900: 768,
}

/* ---------- ⑤ 关键帧一律加前缀 ----------
   原型有 14 支关键帧。除了 `drift` 已随极光丢弃之外，其余 13 支留在产物里。
   统统一加 `ai-` 前缀，而不是"逐个判断这个名字像不像通用名"：
   判据是**可机械执行** —— 后者要人猜，前者一次做完、将来也不会与别的层撞。
   （项目里已有一支真教训：`ring-in` / `sel-pulse` 在工作台与侧栏各有一份实现，
    重搬过的那一次直接互相覆盖。） */
const KEYFRAME_PREFIX = 'ai-'

/* ---------- ⑧ 标签改道：`b` → `strong` ----------
   原型的强调一律是 `<b>`，产物里因此有 4 条 `… b { … }` 的选择器
   （`.tc-step .tc-text b` / `.tl-desc b` / `.quick-prompt b` / `.quick-prompt:hover b`）。
   而应用侧的富文本约定是**另一套**：`types/workbench.ts` 的 `TextRun.em` 明写
   「渲染层按 em 决定要不要套一层 <strong>」（`AssistantRail` 就是这么做的）。

   两边都不改的后果很难发现：React 渲染 `<strong>`，CSS 里配的是 `b` ——
   **一个元素都匹配不到**，强调文字退回浏览器默认的加粗，颜色与字重那两条静默失效。
   与「原型在窄屏下并没有真的把文字收掉」（见 Sidebar 那次）是同一类缺陷。

   处置是**照渲染层的约定改选择器**（不是反过来在 CSS 里同时写 `b, strong`：
   那会留下一条永远匹配不到的 `b` 分支，下一个人会以为标记里真的会用 `b`）。
   ⚠️ 必须要求 `b` 前面是空白/组合符/逗号 —— 否则 `.msg-bubble` 里的那个 `b`
     也会被改成 `strong`（`-` 在词内，但正则不加约束就会咬到）。 */
const TAG_REMAP = { b: 'strong' }

function remapTags(sel) {
  return sel.replace(/(^|[\s>+~,(])b(?![-\w])/g, (whole, pre) => `${pre}${TAG_REMAP.b}`)
}

/* ---------- ⑥ 本层自己的刻度与色指针 ----------
   分两类，**不要混**：

   · **布局刻度**（`--ai-sidebar-w` / `--ai-aside-w`）：原型 `:root` 的
     `--sidebar-w: 260px` / `--aside-w: 280px`，照抄，亮暗同值、只写一次。

   · **色指针**：本页不是九域之一（顶栏那九项里没有"AI"），所以**没有** `data-module`，
     内核 §4 那段强调色指针一条都匹配不到。缺它的后果是 `--mw-m-main` **没有值** ——
     环/按钮/柔底/辉光全部落回 `@property --accent` 的 initial-value（品牌紫），
     零报错。这与 `workspace-shell.css` §5d 给 dashboard 补的那条是同一件事。

     底料是齐的：`--mw-a-dashboard-*` / `--mw-s-dashboard` 亮暗都有。
     ⚠️ 为什么借 dashboard 那一组而不是新起一组"AI 色"：
        原型 `--m-main` 亮 `#6366F1` / 暗 `#818CF8`，与 `--mw-s-dashboard` **逐字相同**；
        原型三团极光 `#A5B4FC / #C4B5FD / #BAE6FD`（暗 `#4F46E5 / #7C3AED / #0EA5E9`）
        与 `--mw-a-dashboard-1/2/3` **也逐字相同**。同一份设计，没有第二份色值可写。
        这也与 `design-tokens.css` 的 `--grad-ai`（同一条 indigo→violet→purple）互证。

   ⚠️ 这一段是模板字符串，**一个反引号都不能出现**（否则提前闭合、报错指向很远的一行）。 */
const AI_TOKENS = `/* ---------- AI 层自己的刻度与色指针 ---------- */

.ai-root {
  /* 会话侧栏 260 / 上下文右栏 280 —— 原型 :root 的原值，应用里没有等价刻度 */
  --ai-sidebar-w: 260px;
  --ai-aside-w: 280px;

  /* 色指针（选择器 → 已有槽位，本段里**不该出现任何新色值**） */
  --mw-m1: var(--mw-a-dashboard-1);
  --mw-m2: var(--mw-a-dashboard-2);
  --mw-m3: var(--mw-a-dashboard-3);
  --mw-m-main: var(--mw-s-dashboard);
}

/* 顶栏那一行的高度。
   原型是 56px —— 那是它自己那条细顶栏。本页换成应用外壳的 ShellTopbar（68px 胶囊），
   照搬 56 会让胶囊溢出 12px、并被 grid 的隐式行拉出滚动条。

   ⚠️ 选择器抬到 「.mw-root.ai-root .ai-app」（0,3,0），不是同特异性的「.ai-root .ai-app」：
      生成物里 ≤768 那条（原型 900 改道来的）也会写同样的 grid-template-rows: 56px 1fr，
      同特异性下靠"谁在后面"决定胜负 —— 症状是**窄屏顶栏溢出、宽屏正常**，
      只在某一个宽度才发作，极难归因。抬一档就不再依赖顺序。
   ⚠️ 另一条判据：**宽屏与窄屏都要给**，所以这里不写进 @media —— 它在两个宽度下都对。 */
.mw-root.ai-root .ai-app {
  grid-template-rows: var(--sb-topbar-h) 1fr;
}

/* ---------- 暗色下用户气泡要换深色字 ----------
   原型写的是「用户气泡：背景取原型的 --m-grad（已改道到 --grad-ai），文字 #fff」——
   而 --grad-ai **按主题分了两档**，暗色那一档（#818CF8 → #A78BFA → #C084FC）
   本身就偏浅。白字压在上面的对比度只有 **1.9:1 ~ 2.9:1**，远低于设计规范 §九 的 4.5:1；
   亮色那一档是 3.3:1 ~ 5.2:1（与外壳里 .sb-icon-btn.ai / .sb-avatar 那两处白字同一水平）。

   ⚠️ 这是**主动偏离原型的一处**，判据是"文字"与"图标"在这套规范里不同档：
   图标（.sb-icon-btn.ai 的那颗星）可以容忍低对比，14px 的正文不行。
   所以只改暗色（那里是"读不出来"），亮色保持原型原样（那里是"偏浅但可读"，
   且与全站已有的 AI 渐变元素一致）。

   色值用的是 var(--mw-bg-page)（暗色档 #0A0F1C）—— 不新起色值：
   它就是这套深色主题的"最深的底"，当深色字用对比度是 7.0:1（#818CF8 一侧）
   与 8.6:1（#C084FC 一侧）。
   ⚠️ 本段是**模板字符串**：注释中一个反引号都不能有。
      这里原本写的是带反引号的令牌名，于是模板被提前闭合 —— 后面的正文被当成代码解析，
      报错指向 AI_TOKENS 那一行、说"postfix operation"，
      而真正的原因是两百行之后的一个字符。与脚本头那条「注释里的星号紧跟斜杠」同一类坑。

   ⚠️ 选择器必须抬到「html[data-theme='dark'] .mw-root.ai-root .msg.user .msg-bubble」（0,6,0）。
      写成不带 .mw-root 的那一版是 0,4,0 —— 与生成物里那条

          .ai-root .msg.user .msg-bubble { color: #fff }

      **同分**。本段排在 generated 之前，所以同分时后到的那条赢 ⇒ 改了等于没改
      （实测：探针读到的仍是 rgb(255,255,255)，页面看着"改了没生效"）。
      这一条与本项目在 .main / .sidebar-wrap / .workspace-drawer-toggle 上
      踩过的是同一个坑：**同特异性下"谁赢"由导入顺序决定，那是一个隐含前提**。
   ⚠️ 上面那段 CSS 用缩进写出来、**不加反引号**：本段是模板字符串（见 AI_TOKENS 的警告）。 */
html[data-theme='dark'] .mw-root.ai-root .msg.user .msg-bubble {
  color: var(--mw-bg-page);
}`

/* ---------- ⑦ 窄屏：会话侧栏改抽屉 ----------
   生成物里 ≤768 那条是从原型 ≤900 改道来的，内容是「.ai-sidebar { display: none }」
   —— 原型是独立页，直接藏掉侧栏没问题；到了应用就是"整页没有任何会话入口"。
   应用的处置是**抽屉**（与外壳同一条判据：侧栏消失与抽屉出现必须同一个断点）。

   为什么这里不写成「.sidebar-wrap」（外壳那套抽屉词汇）：
   外壳那一份的抽屉规则挂在「.sb-app > .sidebar-wrap」上，而本页的栅格容器叫 .ai-app
   —— 直接复用会**一条都不匹配**（症状与"忘了写抽屉"完全一样，零报错）。
   把本层的抽屉写全，比让本层去依赖兄弟层的容器契约便宜：少了"改外壳要记得改这一页"。

   ⚠️ 生成物里那条（0,2,0）与下面这条（0,3,0）：抬特异性是为了不吃导入顺序
      —— 与上面 .mw-root.ai-root 那条同一个理由。 */
const AI_DRAWER = `/* ---------- 窄屏抽屉（判据见脚本头 ⑦）---------- */

@media (max-width: 768px) {
  .mw-root.sb-root.ai-root .ai-app > .ai-sidebar {
    display: flex;
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    width: 280px;
    z-index: 60;
    padding: 8px;
    transform: translateX(-100%);
    transition: transform 0.22s ease;
    /* 抽屉浮在内容之上，必须自带底衬：本层侧栏自己的 α 只有 .72，
       底下透出的会是正文而不是极光。与 workspace-shell.css 那条同一处置。 */
    background: var(--mw-bg-page);
  }

  .mw-root.sb-root.ai-root .ai-app > .ai-sidebar.is-open {
    transform: translateX(0);
  }
}`

/* ============================================================================
   解析与变换
   ============================================================================ */

/** 极简 CSS 切块：顶层「规则 / @块」逐块取出，保留原文。
 *
 * ⚠️ 必须**同时**认注释与字符串两种"内部状态"。只认注释是不够的：
 *    `content: "}"` 这类**带引号的值里出现花括号**会当场把深度计数带偏 ——
 *    于是后面一大段规则被当成前一条规则的**规则体**吞进去，
 *    而 `emit` 对规则体只做令牌/关键帧替换、不做作用域前缀与改名。
 *    症状极具欺骗性：产物看起来"大部分是对的"、只有一小段没有作用域。 */
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

/** 把一条选择器改名（按 `.name` 整词匹配，避免 .app 改到 .appbar 上） */
function renameClasses(sel) {
  return sel.replace(/\.([a-zA-Z][a-zA-Z0-9_-]*)/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(RENAME, name) ? '.' + RENAME[name] : whole,
  )
}

/** 断点改道（见 BREAKPOINT_REMAP 的判据） */
function remapBreakpoints(prelude) {
  let out = prelude
  for (const [from, to] of Object.entries(BREAKPOINT_REMAP)) {
    out = out.replace(new RegExp(`(max-width\\s*:\\s*)${from}px\\b`), `$1${to}px`)
  }
  return out
}

/**
 * 作用域前缀 + 主题守卫。
 *
 * ⚠️ 守卫必须**提到最外层**：`.dark X` → `html[data-theme='dark'] .ai-root X`。
 *    留在原位（`.ai-root .dark X`）会永远不匹配 —— `data-theme` 在 `<html>` 上，
 *    而 `.ai-root` 是它的后代。
 * ⚠️ 本原型里 `.dark` 开头的规则只有 `.dark .blob-*`（随极光丢弃）与
 *    `.dark .code-block`（随代码块丢弃），所以这一段当前**没有实际产出**。
 *    留着它是因为它是**正确性**的一部分：原型下次加一条 `.dark X` 时，
 *    没有这一段的症状是"整族变死规则、样式表里看得见、就是不匹配"，零报错。
 */
function scopeSelector(sel) {
  return sel
    .split(',')
    .map((one) => {
      let s = one.trim()
      if (!s) return s
      const dark = /^\.dark\b/.test(s)
      if (dark) s = s.replace(/^\.dark\b\s*/, '')
      return `${dark ? `html[data-theme='dark'] ` : ''}${SCOPE} ${remapTags(renameClasses(s)).trim()}`
        .replace(/\s+/g, ' ')
        .trim()
    })
    .filter(Boolean)
    .join(', ')
}

/**
 * 统一缩进。
 *
 * 原型 CSS 的缩进是"整页排版"的八格制，切成单条规则之后会变成一堆参差不齐的深缩进。
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
    line = line.replace(/([^\s{])\{$/, '$1 {')
    const leadingClose = /^\}/.test(line)
    if (leadingClose) depth = Math.max(0, depth - 1)
    out.push('  '.repeat(depth) + line)
    const opens = (line.match(/\{/g) || []).length
    const closes = (line.match(/\}/g) || []).length
    depth += opens - (closes - (leadingClose ? 1 : 0))
  }
  return out.join('\n').replace(/\n{3,}/g, '\n\n')
}

/** 映射表里的目标名：`var(--mw-bg-page)` 与 `--ai-sidebar-w` 两种写法都归一成 `--xxx` */
const tokenName = (v) => v.replace(/^var\((.*)\)$/, '$1')

/**
 * 令牌名改道 —— 引用处（`var(--x`）与**声明处**（`--x:`）都要改。
 *
 * 声明处为什么也要改：原型顶层的 `:root` 令牌块整块丢弃，所以那里不需要；
 * 但 `@media` 里的**断点令牌覆写**（`@media(max-width:1100px){ :root{ --sidebar-w: … } }`）
 * 是设计意图、要被保留 —— 留着旧名字就等于这条覆写接不上。
 * 本原型当前没有这种写法，但函数按同一个口径写，免得下次加的时候静默失效。 */
function retoken(text) {
  return text
    .replace(/var\(--([a-z0-9-]+)/g, (whole, name) =>
      Object.prototype.hasOwnProperty.call(TOKENS, `--${name}`) ? `var(${tokenName(TOKENS[`--${name}`])}` : whole,
    )
    .replace(/(^|[\s;({])--([a-z0-9-]+)\s*:/g, (whole, pre, name) =>
      Object.prototype.hasOwnProperty.call(TOKENS, `--${name}`) ? `${pre}${tokenName(TOKENS[`--${name}`])}:` : whole,
    )
}

/**
 * 全部关键帧名 —— 在切块**之前**从原型 CSS 收集一次。
 *
 * ⚠️ 必须是全局集合，不能"改到哪一块就现收哪一块"：`@keyframes X` 的定义与
 *    `animation: X …` 的引用在**不同的块**里（前者是 @keyframes 块、后者是普通规则块），
 *    逐块收集的话，普通规则块里一个名字都收不到 ⇒ 定义改了前缀、引用没改，
 *    **全站入场动画静默失效**（`animation: msg-in` 找不到 `ai-msg-in`）。
 *    这一类缺陷浏览器只字不提。 */
let KF_NAMES = new Set()

/**
 * 关键帧改名：定义处与 animation 引用处都要改（见 KEYFRAME_PREFIX 的判据）。
 *
 * ⚠️ **按"真的被定义成关键帧的那些名字"改，不按"长得像名字的词"改。**
 *    第一版用的是"逐词打前缀 + 一张内置词表"，实测当场写坏 20 处：
 *      · `animation:` 的属性名自己也被当成关键帧名 → 产物里出现 `ai-animation:`
 *        （浏览器视作未知属性，**整条声明被丢弃** ⇒ 动画全没了，零报错）；
 *      · `cubic-bezier(...)` 的 `cubic-bezier` 被改成 `ai-cubic-bezier(...)`
 *        （同样是非法值 ⇒ 该条声明被丢弃）。
 *    改成"名字从源码里收"之后，属性名与时间函数**根本不在集合里**，
 *    这两类错就不可能再发生。门禁 5 直接钉死这一类。
 *
 * ⚠️ 引用处要保证名字前面不是 `-`：`animation: ai-dropdown-in` 里
 *    `\bdropdown-in\b` 也成立（`-` 是非词字符），不加 `[\s,]` 约束会把
 *    `ai-dropdown-in` 再改一次成 `ai-ai-dropdown-in`。 */
function rekeyframe(text) {
  let out = text
  for (const name of KF_NAMES) {
    if (name.startsWith(KEYFRAME_PREFIX)) continue
    const to = `${KEYFRAME_PREFIX}${name}`
    out = out.replace(new RegExp(`(@keyframes\\s+)${name}\\b`, 'g'), `$1${to}`)
    out = out.replace(
      new RegExp(`(animation(?:-name)?\\s*:[^;}]*?)([\\s,])${name}\\b`, 'g'),
      (whole, head, sep) => `${head}${sep}${to}`,
    )
  }
  return out
}

/**
 * 关键帧去悬空：`@keyframes X` 的 X 必须在产物的 `animation:` 里出现过。
 *
 * 随 `.blob` / `.code-block` / `.toast` 一起被丢掉的那些关键帧会变成死代码，
 * 这条机械地删掉它们。⚠️ 顺序是"先剥注释再匹配"：注释里提到某个动画名会把它
 * 从"死"救成"活"，那正是这条守卫要防的假阴性。
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

const stats = { kept: 0, dropped: 0 }

/**
 * 丢弃判据。
 *
 * ⚠️ **两个形态都要试**，这是踩过的坑：`.dark` 这个**令牌块**本身要被丢掉（它的
 *    选择器恰好等于 `.dark`），而 `.dark .blob-1` 这类**后代规则**要按"剥掉 `.dark`
 *    之后剩下的那一截"去匹配 `.blob` 前缀。只试其中一种都会漏：
 *      · 只试 `sel` → 三条 `.dark .blob-*` 留下，成为给已不再渲染的元素上色的死规则；
 *      · 只试剥 `.dark` 之后的那一截 → `.dark` 令牌块**整块写进产物**，
 *        于是 `html[data-theme='dark'] .ai-root { --mw-bg-page: #0A0F1C; … }`
 *        会把整个中性色板在暗色下改回原型那一套（而内核给的是同一批值，
 *        看起来"只是令牌多了一份定义"）。实测踩到过这一次，所以下面两个 test 都留着。
 */
function dropReason(sel, insideMedia) {
  const bare = sel.replace(/^\.dark\b\s*/, '')
  /* 断点里的 `:root` / `.dark` 是**断点上的令牌覆写**（设计意图，要留），不是令牌块 */
  if (insideMedia && /^(:root|\.dark)$/.test(sel)) return null
  for (const [re, why] of DROP) if (re.test(sel) || re.test(bare)) return why
  return null
}

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
    stats.kept++
    /* ⚠️ 关键帧的**规则体也要走 retoken**。
       第一版这里只做了 rekeyframe —— 而 `@keyframes` 的体里是可以有 `var()` 的
       （原型第二轮新增的 `anchor-pulse` 就写了
        `box-shadow: 0 0 0 3px var(--m-main), 0 0 0 0 var(--m-glow)`）。
       不 remap 的后果：令牌名在内核里**不存在** ⇒ `box-shadow` 整条声明被丢弃 ⇒
       那一刻的阴影直接没有，而**动画本身照常跑**（所以看起来只是"少了一圈光晕"）。
       门禁 2「var() 引用必须有定义」把这类漏网兜住了 —— 它是这一条唯一的报警器。 */
    return `${indent}${rekeyframe(retoken(`${sel}${body}`))}\n`
  }

  const why = dropReason(sel, insideMedia)
  if (why) {
    stats.dropped++
    return ''
  }

  stats.kept++
  /* 断点里的 `:root` → 作用域根；`.dark` → 主题守卫（同样提到最外层） */
  const scoped =
    insideMedia && /^(:root|\.dark)$/.test(sel)
      ? sel === ':root'
        ? SCOPE
        : `html[data-theme='dark'] ${SCOPE}`
      : scopeSelector(sel)
  return `${indent}${scoped}${rekeyframe(retoken(body))}\n`
}

/* ============================================================================
   主流程
   ============================================================================ */

const html = fs.readFileSync(SRC, 'utf8')
const style = html.match(/<style>([\s\S]*?)<\/style>/)
if (!style) throw new Error(`原型里找不到 <style>：${SRC}`)

const blocks = splitTop(style[1])
KF_NAMES = new Set([...style[1].matchAll(/@keyframes\s+([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((m) => m[1]))
const emitted = reindent(pruneKeyframes(blocks.map((b) => emit(b)).filter(Boolean).join('\n')))

const header = `/* ============================================================================
   ${path.relative(path.join(DIR, '..'), OUT)} —— AI 助手（/ai）
   ----------------------------------------------------------------------------
   ⚠️ 这是**生成物**，不要手改。事实源是 「design/ai-assistant/ai-assistant_index.html」
      的 <style>，改原型后跑：
        node design/build-ai-css.mjs          # 写盘
        node design/build-ai-css.mjs --check  # 门禁：产物是否过期

   这一层与另外两层的分工：
     · module-workspace.css（内核）= 8 个模块原型共用的**内容**层（.card / .btn / .tabs / .panel）
     · sidebar-shell.css（外壳）= 顶栏九域导航 / 侧栏分区环 / 命令面板
     · **本文件** = 这一页自己的正文（会话侧栏 / 对话流 / 思考链 / 输入区 / 上下文栏 / 浮层）

   所有选择器收在 「${SCOPE}」 之下，撞车的类名已改名（见脚本 RENAME），
   所以它与内核、与外壳**零冲突** —— 导入顺序不再承担任何隐含前提。

   产出统计：保留 ${stats.kept} 块 · 丢弃 ${stats.dropped} 块
   ========================================================================= */

`

const out = `${header}${AI_TOKENS}\n\n${AI_DRAWER}\n\n${emitted}`

/* ---------- 门禁 1：产物里不得出现内核/外壳的类名 ----------
   报告要**带上命中的原文**：只报类名的话，下一步还是得手工回去找。 */
const forbidden = []
for (const name of [
  'app',
  'sidebar',
  'topbar',
  'card',
  'btn',
  'tabs',
  'tab',
  'panel',
  'menu-item',
  'switch',
  'toast',
  'main',
  'aside',
  'icon-btn',
  'logo-mark',
]) {
  const re = new RegExp(`\\.${name}\\b(?![a-zA-Z0-9_-])`, 'g')
  for (const m of emitted.matchAll(re)) {
    forbidden.push(`.${name} :: ${emitted.slice(Math.max(0, m.index - 70), m.index + 70).replace(/\n/g, '⏎')}`)
  }
}
if (forbidden.length) {
  console.error('✗ 产物里出现了未改名/未丢弃的既有类名（会被内核或外壳抢样式）：')
  for (const line of new Set(forbidden)) console.error(`    ${line}`)
  process.exit(1)
}

/* ---------- 门禁 2：var() 引用必须有定义 ----------
   「有没有定义」要扫**全部**样式表 + 本段手写常量，不能只扫内核 ——
   本层会有意引用别的层（`--grad-ai` 在 design-tokens.css、`--sb-*` 在 sidebar-shell.css、
   `--c-error` 在 design-tokens.css）。
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
const missing = new Map()
for (const m of out.matchAll(/var\((--[a-z0-9-]+)/g)) {
  const v = m[1]
  /* 由 React 写在 style 属性上的"逐实例参数"不在样式表里定义 */
  if (['--w', '--i'].includes(v)) continue
  if (!defined.has(v) && !missing.has(v)) {
    /* ⚠️ 报告要**带上命中的原文**。只报令牌名的话，下一个人还得回去 grep
       （本项目的门禁一直按这条写：副作用小、省一整轮排查）。 */
    missing.set(v, out.slice(Math.max(0, m.index - 70), m.index + 60).replace(/\n/g, '⏎'))
  }
}
if (missing.size) {
  console.error('✗ 引用了但没定义的令牌：')
  for (const [name, where] of missing) console.error(`    ${name}\n      …${where}…`)
  process.exit(1)
}

/* ---------- 门禁 3：产物里不许有自定义属性声明 ----------
   原型的 `:root` / `.dark` 两块令牌**整块丢弃**（值按 TOKENS 表改道到内核/外壳令牌，
   由别的层持有）。它们要是漏进产物，"中性色板"就多了一份定义 ——
   测过一次真漏：丢了三条 `.dark .blob-*`、却把整个 `.dark` 令牌块写了出来
   （`html[data-theme='dark'] .ai-root { --mw-bg-page: #0A0F1C; … }`），
   而**值恰好与内核相同**，所以看不出任何视觉差异，只有 diff 才发现。

   判据：本层只做**引用**，不做**定义**。将来若原型真的加了 `@media` 里的断点令牌覆写
   （那是设计意图、该留），这条门禁会拦住 —— 那时按需要把豁免写在这里，而不是让它静默通过。 */
const declaredTokens = [...emitted.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1])
if (declaredTokens.length) {
  console.error(
    `✗ 产物里有 ${declaredTokens.length} 处自定义属性声明（应为 0 —— 令牌块该整块丢弃）：\n    ` +
      [...new Set(declaredTokens)].join(', '),
  )
  process.exit(1)
}

/* ---------- 门禁 4：.dark 不许留在产物里 ----------
   应用的主题写在 `<html data-theme>` 上，`.dark` 这个类**根本不存在**。
   本原型里那两条 `.dark X` 所属的两族都已丢弃，所以这条门禁当前是"确认没有漏网"。 */
const strayDark = [...emitted.matchAll(/\.dark\b/g)].length
if (strayDark) {
  console.error(`✗ 产物里还有 ${strayDark} 处 .dark —— 应用里没有这个类，那一族会变成死规则`)
  process.exit(1)
}

/* ---------- 门禁 5：`ai-` 前缀只许出现在类名、关键帧名与动画值里 ----------
   这条钉的是"批量改名改坏了 CSS 的**属性名**或**函数名**"这一类缺陷。
   它的可怕之处在于**极其安静**：`ai-animation: …` 是一个未知属性，
   浏览器整条丢弃；`ai-cubic-bezier(...)` 是非法值，同样整条丢弃。
   页面照常渲染，只是所有入场动画、所有缓动一起没了 —— 而没人会去怀疑"动画为什么不动"。

   判据：
     · 属性名 = `ai-xxx` 紧跟在 `{` / `;` / 行首空白之后、后面跟 `:`
       （类选择器前面是 `.`，不在这个位置集合里）
     · 函数名 = `ai-xxx(`，其中 xxx 是 CSS 数学/缓动/滤镜函数 */
const badProps = [...emitted.matchAll(/(^|[\s;{])(ai-[a-z0-9-]+)\s*:/gm)].map((m) => m[2])
const badFns = [
  ...emitted.matchAll(
    /\b(ai-(?:cubic-bezier|steps|linear|ease[a-z-]*|var|calc|min|max|clamp|translate[a-z-]*|scale[a-z-]*|rotate[a-z-]*|blur|saturate|rgba?|hsla?))\s*\(/g,
  ),
].map((m) => m[1])
if (badProps.length || badFns.length) {
  console.error(
    '✗ 产物里 `ai-` 前缀落到了 CSS 的属性名/函数名上（那会让整条声明被静默丢弃）：\n' +
      [...new Set([...badProps, ...badFns])].map((n) => `    ${n}`).join('\n'),
  )
  process.exit(1)
}

/* ---------- 门禁 6：动画引用必须都有定义 ----------
   与门禁 5 互补：门禁 5 管"改坏"，这一条管"漏改"——
   `animation: msg-in` 而定义了 `ai-msg-in` 时，浏览器同样只字不提。 */
const definedKf = new Set([...emitted.matchAll(/@keyframes\s+([a-zA-Z_][a-zA-Z0-9_-]*)/g)].map((m) => m[1]))
const missingKf = new Set()
for (const m of emitted.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
  for (const word of m[1].matchAll(/(^|[\s,])([a-zA-Z_][a-zA-Z0-9_-]*)/g)) {
    const name = word[2]
    if (/^(none|infinite|linear|ease|ease-in|ease-out|ease-in-out|forwards|backwards|both|alternate|reverse|normal|running|paused)$/.test(name)) continue
    if (/^[\d.]/.test(name) || /s$/.test(name) || name.startsWith('cubic') || name.startsWith('steps')) continue
    if (!definedKf.has(name)) missingKf.add(name)
  }
}
if (missingKf.size) {
  console.error(`✗ 这些动画名没有对应的 @keyframes（入场动画会静默失效）：${[...missingKf].join(', ')}`)
  process.exit(1)
}

/* ---------- 写盘 / 比对 ---------- */
const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null
if (CHECK) {
  if (prev === out) {
    console.log(`✓ ${path.relative(process.cwd(), OUT)} 与原型一致（保留 ${stats.kept} / 丢弃 ${stats.dropped}）`)
  } else {
    console.error(`✗ ${path.relative(process.cwd(), OUT)} 已过期 —— 重跑一次 build-ai-css.mjs 写盘`)
    process.exit(1)
  }
} else {
  fs.writeFileSync(OUT, out)
  console.log(
    `✓ 已写 ${path.relative(process.cwd(), OUT)}  ·  保留 ${stats.kept} 块 / 丢弃 ${stats.dropped} 块`,
  )
}
