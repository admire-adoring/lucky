
> ## ⚠️ 材质口径已换：**纯色**（2026-09-25），本文件部分章节已作废
>
> 这一版把整套材质从「毛玻璃 + 极光」换成**纯色**。本文件是设计令牌的事实源，
> 但它有一批章节写的是旧口径，**照它实现会和代码不符**。逐节状态：
>
> | 章节 | 状态 |
> |---|---|
> | 一 · 颜色令牌 | ✅ 有效（§一.3 中性色已按纯色更新） |
> | 二 · 渐变令牌 | ❌ **作废** —— 全站不再用素材性渐变 |
> | 三 · 毛玻璃与弥散令牌 | ❌ **作废** —— 无 backdrop-filter、无弥散底衬 |
> | 四~七 · 字号/动效/布局/组件 | ✅ 有效 |
> | 八 · CSS 变量汇总 | 🟡 **部分作废**（`--grad-ai` 等已改成纯色） |
> | 九 · 设计规则 | ✅ 有效（对比度判据未变，且本轮只增不减） |
>
> 代码侧的事实源与完整判据在 `src/styles/`：
> `prism.css`（面阶 / 边 / 文字 / 语义色，含每一条取值的理由）、
> `index.css`（@theme 兜底 + 工具类）、`module-workspace.css`（模块层）。
> 一句话规则：**面一律不透明；层次靠「底色明度差 + 1px 实描边 + 两段小阴影」；
> 域色薄染（叠在实底上的强调色）保留；只表达数据的渐变（环弧）保留。**
>
> ⚠️ 另外：生成这套令牌的脚本（`sync-design-tokens.mjs` / `build-workspace-css.mjs` /
> `prism-derive-colors.mjs` 等）已随原型生成链一并退役，**门禁脚本也没了** ——
> 改代码不会再被本文件拦下，改本文件也不会被代码拦下。两边都要人工同步。

## 一、颜色令牌

### 1. 模块色（亮色）

| 模块 | 色团1 | 色团2 | 色团3 | 强调色 |
|---|---|---|---|---|
| 工作台 | `#A5B4FC` | `#C4B5FD` | `#BAE6FD` | `#6366F1` |
| 任务清单 | `#FDE68A` | `#FED7AA` | `#FEF3C7` | `#F59E0B` |
| 日程 | `#7DD3FC` | `#A5F3FC` | `#BAE6FD` | `#0EA5E9` |
| 生活 | `#86EFAC` | `#A7F3D0` | `#BBF7D0` | `#10B981` |
| 工作 | `#FDA4AF` | `#FECDD3` | `#FBCFE8` | `#E11D48` |
| 学习 | `#F0ABFC` | `#E9D5FF` | `#FBCFE8` | `#D946EF` |
| 项目 | `#FDBA74` | `#FED7AA` | `#FDE68A` | `#F97316` |
| 知识库 | `#99F6E4` | `#A7F3D0` | `#CCFBF1` | `#14B8A6` |
| 设置 | `#B8C4D9` | `#C9D5E5` | `#DCE4F0` | `#475569` |

### 2. 模块色（暗色）

| 模块 | 色团1 | 色团2 | 色团3 | 强调色 |
|---|---|---|---|---|
| 工作台 | `#4F46E5` | `#7C3AED` | `#0EA5E9` | `#818CF8` |
| 任务清单 | `#B45309` | `#C2410C` | `#92400E` | `#FBBF24` |
| 日程 | `#0284C7` | `#0E7490` | `#075985` | `#38BDF8` |
| 生活 | `#059669` | `#047857` | `#065F46` | `#34D399` |
| 工作 | `#BE123C` | `#9F1239` | `#881337` | `#FB7185` |
| 学习 | `#A21CAF` | `#86198F` | `#701A75` | `#E879F9` |
| 项目 | `#EA580C` | `#C2410C` | `#9A3412` | `#FB923C` |
| 知识库 | `#14B8A6` | `#0F766E` | `#115E59` | `#2DD4BF` |
| 设置 | `#5A6B82` | `#44546B` | `#2E3B52` | `#A8B8CC` |

### 3. 中性色

⚠️ 2026-09-25 纯色化：亮色那几支**从半透明改成了实色实描边**
（原来 `rgba(255,255,255,.62/.72)` 那层是"玻璃材质"，现在是"面"）。
实色值同时落到 `src/styles/prism.css` §1 的面阶与 `module-workspace.css` §1/§2 的 `--mw-*`。

| 令牌 | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| `--bg-page` | `#F4F5F7` | `#0A0F1C` | 页面底（= Prism `--g-page`） |
| `--bg-card` | `#FFFFFF` | `#171F32` | 卡面（= `--g-card`） |
| `--bg-sidebar` | `#FFFFFF` | `#111827` | 侧边栏（= `--g-shell`） |
| `--bg-topbar` | `#FFFFFF` | `#111827` | 顶部栏（= `--g-shell`） |
| `--border-card` | `#E7EAF0` | `#232D42` | 卡片边框（= `--g-edge`） |
| `--border-subtle` | `#E3E7EE` | `#232D42` | 分割线（= `--line`） |
| `--text-primary` | `#0F172A` | `#F1F5F9` | 主文字（模块层口径，见下注） |
| `--text-secondary` | `#64748B` | `#94A3B8` | 次文字 |
| `--text-muted` | `#94A3B8` | `#64748B` | 弱文字 |

另有三支不属于上表、但同属"面"（Prism 侧，亮/暗各一）：
`--g-subtle` `#F7F8FA` / `#131A2A`（区块）· `--g-field` `#F1F3F7` / `#0E1424`（输入框）·
`--g-groove` `#E7EBF1` / `#0A101E`（轨道）· `--g-hover` `#EDF0F4` / `#1E2739`（悬停底）。

> ⚠️ 表里这三支 `--text-*` 是**模块层（`--mw-text-*`）的取值**，本轮刻意未动
> （它们是 8 个原型逐字一致的移植结果）。Prism 侧另有一套 `--fg / --fg-2 / --fg-3 /
> --fg-mute`（按实测底衬反解），两套不要互相套。

### 4. 状态色

| 状态 | 亮色 | 暗色 |
|---|---|---|
| 成功 | `#10B981` | `#34D399` |
| 警告 | `#F59E0B` | `#FBBF24` |
| 错误 | `#EF4444` | `#F87171` |
| 信息 | `#3B82F6` | `#60A5FA` |
| 中性 | `#64748B` | `#94A3B8` |

### 5. AI 色

⚠️ 2026-09-25 纯色化：`--grad-ai` 两支**从渐变改成了纯色**（取原渐变的中间那一支）。
名字保留是历史锚点（它有 ~20 个消费者，改名要动标记）。

| 令牌 | 值 |
|---|---|
| AI 色（亮） | `#6264EF`（原 `linear-gradient(135deg, #6366F1, #8B5CF6, #A855F7)`） |
| AI 色（暗） | `#A78BFA`（原 `linear-gradient(135deg, #818CF8, #A78BFA, #C084FC)`） |
| AI 图标 | `#8B5CF6` |
| AI 边框 | `rgba(139,92,246,0.3)` |

另加一支**不随主题**的品牌实底（承白字，供 logo / 头像 / AI 按钮用）：
`--brand-solid: #6264EF`（白字 4.58:1；写进 `src/styles/design-tokens.css`）。

## 二、渐变令牌

> ❌ **本节作废**（2026-09-25 纯色化）：全站不再使用素材性渐变。
> 保留原文是为了记录历史口径；**不要照它实现**。
> 唯一保留的是"表达数据的渐变"：工作台环上的进度弧（`conic-gradient`，弧长 = 第几格），
> 以及登录页那块网格纹理（两条 1px 线平铺 + 一个 mask，不产生任何色相/亮度斜坡）。

| 令牌 | 值 |
|---|---|
| 方向 | `135deg` |
| 亮色 | `500 → 700` |
| 暗色 | `400 → 600` |
| AI | 三色渐变，`#6366F1 → #8B5CF6 → #A855F7` |

使用场景：

| 场景 | 用渐变 | 说明 |
|---|---|---|
| 主按钮 | ✅ | 模块强调色 |
| 激活项 | ✅ | 模块色 12% 透明 |
| 图标背景 | ✅ | 模块色 14% 透明 |
| 卡片顶条 | ✅ | 模块渐变 |
| 正文背景 | ❌ | 不用 |
| 表格 | ❌ | 用实色 |

## 三、毛玻璃与弥散令牌

> ❌ **本节作废**（2026-09-25 纯色化）：没有 backdrop-filter、没有弥散底衬、
> 没有色团。下面那张表的四支令牌在代码侧**已删除**（`--mw-blur-card` / `--mw-blob-*`），
> 连同消费它们的 `.aurora-bg` / `.blob-1~3` / `.ambient__aurora` 一起。
> 保留原文只为记录历史口径。

| 令牌 | 亮色 | 暗色 |
|---|---|---|
| `--blur-card` | `blur(24px) saturate(180%)` | `blur(28px) saturate(160%)` |
| `--blob-opacity` | `0.38` | `0.24` |
| `--blob-blur` | `120px` | `140px` |
| 色团尺寸 | 520 / 480 / 560px | 同 |
| 色团数量 | 每模块 3 个 | 同 |
| 漂移动画 | `22s ease-in-out infinite alternate` | 同 |
| 卡片圆角 | `20px` | 同 |
| 卡片阴影 | `0 4px 24px rgba(15,23,42,0.05)` | `0 4px 24px rgba(0,0,0,0.3)` |
| 悬停阴影 | `0 8px 32px rgba(15,23,42,0.10)` | `0 8px 32px rgba(0,0,0,0.4)` |

## 四、字体与间距令牌

| 令牌 | 值 |
|---|---|
| 字体 | `-apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif` |
| 等宽 | `ui-monospace, "SF Mono", Menlo, monospace` |
| 主文字 | `14px / 1.6` |
| 次文字 | `13px / 1.6` |
| 弱文字 | `12px / 1.5` |
| 标题 H1 | `22px / 700` |
| 标题 H2 | `18px / 700` |
| 卡片标题 | `12px / 600 / uppercase` |
| 统计数字 | `24px / 700` |
| 间距基数 | `4px` |
| 卡片内边距 | `20px` |
| 卡片间距 | `16px` |
| 主内容边距 | `24px` |
| 圆角 sm | `8px` |
| 圆角 md | `10px` |
| 圆角 lg | `14px` |
| 圆角 xl | `20px` |
| 圆角 pill | `999px` |

## 五、动效令牌

| 令牌 | 值 |
|---|---|
| 快速过渡 | `0.18s ease` |
| 标准过渡 | `0.25s ease` |
| 慢速过渡 | `0.3s ease` |
| 色团漂移 | `22s ease-in-out infinite alternate` |
| 悬停位移 | `translateY(-1px)` 或 `-2px` |
| 进度条 | `0.4s ease` |
| 主题切换 | `0.3s ease` |
| 减少动效 | `prefers-reduced-motion: reduce` 时关闭 |

## 六、布局令牌

| 令牌 | 值 |
|---|---|
| 侧边栏宽 | `220px` |
| 顶部栏高 | `56px` |
| 主内容边距 | `24px` |
| 卡片最小宽 | `200px`（grid-3）/ `300px`（grid-2） |
| 弹窗最大宽 | `560px` / `640px` |
| 移动断点 | `768px` |
| 隐藏侧边栏 | `≤768px` |

## 七、组件令牌

| 组件 | 令牌 |
|---|---|
| 按钮主 | 模块强调色 + 白字 + 阴影 |
| 按钮次 | 卡片背景 + 边框 |
| 按钮 AI | AI 渐变 |
| 开关 | 44x24px，圆角 999px |
| 输入框 | 圆角 10px，聚焦时模块色边框 |
| 标签 | 圆角 999px，模块色 12% 透明背景 |
| 进度条 | 高 6px，圆角 999px，模块色 |
| 头像 | 圆形 / 圆角 12px |
| 分割线 | `1px solid var(--border-subtle)` |
| 弹窗遮罩 | `rgba(15,23,42,0.35)` + `blur(8px)` |

## 八、CSS 变量汇总

```css
:root {
  /* 中性色 */
  --bg-page: #F7F8FA;
  --bg-card: rgba(255,255,255,0.62);
  --bg-sidebar: rgba(255,255,255,0.72);
  --bg-topbar: rgba(255,255,255,0.72);
  --border-card: rgba(255,255,255,0.7);
  --border-subtle: rgba(15,23,42,0.07);
  --text-primary: #0F172A;
  --text-secondary: #64748B;
  --text-muted: #94A3B8;

  /* 阴影 */
  --shadow-card: 0 4px 24px rgba(15,23,42,0.05);
  --shadow-card-hover: 0 8px 32px rgba(15,23,42,0.10);

  /* 毛玻璃 */
  --blur-card: blur(24px) saturate(180%);
  --blob-opacity: 0.38;
  --blob-blur: 120px;

  /* 模块色 - 工作台 */
  --a-dashboard-1: #A5B4FC;
  --a-dashboard-2: #C4B5FD;
  --a-dashboard-3: #BAE6FD;
  --s-dashboard: #6366F1;

  /* 任务 */
  --a-tasks-1: #FDE68A; --a-tasks-2: #FED7AA; --a-tasks-3: #FEF3C7;
  --s-tasks: #F59E0B;

  /* 日程 */
  --a-calendar-1: #7DD3FC; --a-calendar-2: #A5F3FC; --a-calendar-3: #BAE6FD;
  --s-calendar: #0EA5E9;

  /* 生活 */
  --a-life-1: #86EFAC; --a-life-2: #A7F3D0; --a-life-3: #BBF7D0;
  --s-life: #10B981;

  /* 工作 */
  --a-work-1: #FDA4AF; --a-work-2: #FECDD3; --a-work-3: #FBCFE8;
  --s-work: #E11D48;

  /* 学习 */
  --a-learning-1: #F0ABFC; --a-learning-2: #E9D5FF; --a-learning-3: #FBCFE8;
  --s-learning: #D946EF;

  /* 项目 */
  --a-projects-1: #FDBA74; --a-projects-2: #FED7AA; --a-projects-3: #FDE68A;
  --s-projects: #F97316;

  /* 知识库 */
  --a-knowledge-1: #99F6E4; --a-knowledge-2: #A7F3D0; --a-knowledge-3: #CCFBF1;
  --s-knowledge: #14B8A6;

  /* 设置 */
  --a-settings-1: #B8C4D9; --a-settings-2: #C9D5E5; --a-settings-3: #DCE4F0;
  --s-settings: #475569;

  /* 状态色 */
  --c-success: #10B981;
  --c-warning: #F59E0B;
  --c-error: #EF4444;
  --c-info: #3B82F6;

  /* AI */
  --grad-ai: linear-gradient(135deg, #6366F1, #8B5CF6, #A855F7);

  /* 圆角 */
  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 14px;
  --radius-xl: 20px;
  --radius-pill: 999px;

  /* 动效 */
  --transition-fast: 0.18s ease;
  --transition-base: 0.25s ease;
  --transition-slow: 0.3s ease;
}

.dark {
  --bg-page: #0A0F1C;
  --bg-card: rgba(30,41,59,0.5);
  --bg-sidebar: rgba(15,23,42,0.78);
  --bg-topbar: rgba(15,23,42,0.78);
  --border-card: rgba(255,255,255,0.08);
  --border-subtle: rgba(255,255,255,0.06);
  --text-primary: #F1F5F9;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  --shadow-card: 0 4px 24px rgba(0,0,0,0.3);
  --shadow-card-hover: 0 8px 32px rgba(0,0,0,0.4);
  --blur-card: blur(28px) saturate(160%);
  --blob-opacity: 0.24;
  --blob-blur: 140px;

  --a-dashboard-1: #4F46E5; --a-dashboard-2: #7C3AED; --a-dashboard-3: #0EA5E9;
  --s-dashboard: #818CF8;
  --a-tasks-1: #B45309; --a-tasks-2: #C2410C; --a-tasks-3: #92400E;
  --s-tasks: #FBBF24;
  --a-calendar-1: #0284C7; --a-calendar-2: #0E7490; --a-calendar-3: #075985;
  --s-calendar: #38BDF8;
  --a-life-1: #059669; --a-life-2: #047857; --a-life-3: #065F46;
  --s-life: #34D399;
  --a-work-1: #BE123C; --a-work-2: #9F1239; --a-work-3: #881337;
  --s-work: #FB7185;
  --a-learning-1: #A21CAF; --a-learning-2: #86198F; --a-learning-3: #701A75;
  --s-learning: #E879F9;
  --a-projects-1: #EA580C; --a-projects-2: #C2410C; --a-projects-3: #9A3412;
  --s-projects: #FB923C;
  --a-knowledge-1: #14B8A6; --a-knowledge-2: #0F766E; --a-knowledge-3: #115E59;
  --s-knowledge: #2DD4BF;
  --a-settings-1: #5A6B82; --a-settings-2: #44546B; --a-settings-3: #2E3B52;
  --s-settings: #A8B8CC;

  --c-success: #34D399;
  --c-warning: #FBBF24;
  --c-error: #F87171;
  --c-info: #60A5FA;
}
```

## 九、设计规则

| 规则 | 说明 |
|---|---|
| 色团只用于弥散背景 | 不用于正文 |
| 强调色只用于小面积 | 按钮、激活项、进度条 |
| 渐变只用于按钮和图标 | 正文背景不用 |
| 文字对比度 ≥ 4.5:1 | 设置模块尤其注意 |
| 错误色独立 | 不跟知识库正红混 |
| 工作机密降饱和 | 保持克制 |
| AI 用靛蓝→紫 | 不抢模块色 |
| 移动端降 blur | 80px / 90px |
| 减少动效 | 尊重系统偏好 |

## 十、一句话总结

**设计令牌 = 9 模块 × 2 模式的颜色 + 中性色 + 状态色 + AI 色 + 毛玻璃参数 + 圆角 + 动效 + 间距；色团只做背景，强调色只做小面积，渐变只做按钮和图标，文字对比度必须达标，工作机密降饱和，AI 用独立渐变。**