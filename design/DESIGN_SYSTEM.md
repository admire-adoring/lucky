# Lucky-Y 设计系统

> **面向对象**：要在这个仓库里改界面的人（写 `client/lucky/src/**` 的组件、或调令牌的人）。
> **目标**：看完能直接写代码，不必回头猜"这个灰该用哪一级"。
> **最后核对**：2026-09-19（对着 `src/styles/index.css` 逐值核对过；令牌有变动请同步更新本文件的日期与数值）。

---

## 0. 先看这一节：事实源在哪

设计系统只有一份事实源，就是代码。本文件是**索引与判据**，不是事实源。

| 层 | 位置 | 内容 |
| --- | --- | --- |
| **令牌（唯一事实源）** | `src/styles/index.css` 的 `@theme` 块 | 颜色 / 圆角 / 阴影 / 字号 / 字体 / 动效 |
| **材质与降级** | 同文件的 `@utility`、`@layer base`、`@layer components` | 五档玻璃、环境光层、外壳圆角、滚动条、焦点环 |
| **语义映射（唯一事实源）** | `src/data/meta.ts` | 三域色、状态、优先级 → 具体类名 |
| **原型（历史参照）** | `../../ui-design/v1.0/*.html` | 令牌最初 1:1 的来源；**不再改**，仅作对照 |

### 一条铁律：令牌 → 工具类 → 组件，不要跳级

```
@theme 里定义令牌  →  Tailwind v4 自动产出工具类  →  组件里只用工具类
--color-ink-400     →  text-ink-400 / border-ink-400  →  <b className="text-ink-400">
```

**不要在组件里写十六进制、写 `rgb()`、也不要新增表面色。** 组件里出现硬编码颜色，就等于把令牌复制了一份，而复制品不会跟着令牌更新（本仓库已经踩过，见 §6.4）。

### 三条不许做的事

1. 不许在组件里直接写 `text-life` / `bg-work` 这类三域色 —— 必须走 `SCOPE_META`（见 §2.3）。
2. 不许新增表面色（`--color-surface` 一族之外的浅底），见 §2.3。
3. 不许改 `#root` 的 `filter` / `opacity` / `mask`（会切断玻璃的采样，见 §3.3）。

### 改令牌的流程

```
改 @theme  →  npx tsc --noEmit  →  npx vite build  →  重跑对比度审计（§5.3）
```

**任何影响底衬亮度、亮度对比、或几何的改动，都必须重跑审计。** 玻璃上的对比度无法从令牌推算（底衬是「半透明白 + 极光」的合成结果），只能量真实像素。

---

## 1. 设计令牌

### 1.1 颜色

Tailwind v4 命名空间是 `--color-*`，所以每个令牌自动产出 `text-*` / `bg-*` / `border-*` / `ring-*` 等全套工具类。

#### 中性灰阶 `ink-*`

冷调灰。**级差本身就是层级语言**：数字越大越深。

| 令牌 | 值 | 典型用途 | 在玻璃上的实测对比度 |
| --- | --- | --- | --- |
| `--color-ink-50` | `rgba(17,20,28,.045)` | **不是浅灰实色，是深色遮罩**。hover 底、内凹槽 | — |
| `--color-ink-100` | `rgba(17,20,28,.075)` | 同上，比 50 深一档；进度条槽、chip 底 | — |
| `--color-ink-200` | `#d3d7de` | 滚动条滑块、分隔线重色 | — |
| `--color-ink-300` | `#9ba4b2` | 禁用态图标、三级箭头、优先级「低」的圆点 | — |
| `--color-ink-400` | `#74808f` | **装饰层**：分组标签、`PERSONAL OS`、⌘K 徽标、表头 | 3.14 ~ 3.92（见 §5.2 已知偏差） |
| `--color-ink-500` | `#5b6370` | **信息层**：次级正文、邮箱、占位符、单位 | 4.7（原型在纯白上 4.83） |
| `--color-ink-600` | `#454c58` | 正文、导航项未激活、表格单元格 | ≥ 7 |
| `--color-ink-700` | `#343a46` | 强调正文、菜单项 | ≥ 9 |
| `--color-ink-800` | `#1b1e26` | 次级标题 | ≥ 13 |
| `--color-ink-900` | `#101218` | 标题、正文默认色（`body` 的 `color`） | ≥ 15 |

> ⚠️ **比原型整体下调了约 8%~12%，不要再调回原值。** 理由：文字底衬不再是纯白，而是「半透明白 α.70 + 极光」的合成色，亮度低于 `#fff`；沿用原灰阶会让 ink-400/500 这些**小字号**跌破原型水平。下调后各级相对层级不变。
> ⚠️ **ink-400 与 ink-500 的分流判据是「装饰 vs 信息」，不是「想让它多浅」。** 同一层里两种角色并存是正常的（侧栏就是这样）。

#### 表面与描边：这是**材质**，不是实色

| 令牌 | 值 | 工具类 | 用途 |
| --- | --- | --- | --- |
| `--color-surface` | `rgba(255,255,255,.70)` | `bg-surface` | **常规玻璃**。卡片、外壳（侧栏/顶栏）、输入框聚焦态 |
| `--color-surface-raised` | `rgba(255,255,255,.84)` | `bg-surface-raised` | **抬升玻璃**。hover 提升、弹出菜单、浮层 |
| `--color-surface-sunken` | `rgba(255,255,255,.42)` | `bg-surface-sunken` | **沉槽**。分段控件凹槽、进度环槽、搜索框底 |
| `--color-canvas` | `rgba(255,255,255,.38)` | `bg-canvas` | 页面级最淡底衬、表格表头 |
| `--color-line` | `rgba(17,20,28,.085)` | `border-line` | 发丝线：卡片描边、分隔线 |
| `--color-line-strong` | `rgba(17,20,28,.155)` | `border-line-strong` | 强描边：输入框、次要按钮、表格竖线 |

> ⚠️ **外壳（侧栏 / 顶栏）用 `surface` 而不是 `surface-raised`。** α.84 会把背后极光几乎全部盖掉 —— 实测侧栏底衬退化成 `250,249,252` ≈ 纯白，像一块白板。薄一档之后侧栏中心是 `236,236,250`（B 通道比 R 高 14，看得见靛蓝）。

#### 品牌 / 交互色 `brand-*`

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--color-brand-50` | `rgba(99,102,241,.12)` | 「已完成」chip 底、极淡品牌底 |
| `--color-brand-100` | `rgba(99,102,241,.20)` | 同上深一档 |
| `--color-brand-400` | `#6366f1` | 进度环渐变起点、极光基色 |
| `--color-brand-500` | `#4f46e5` | **焦点环 `outline`、侧栏激活指示条、分页点**、进度环渐变终点 |
| `--color-brand-600` | `#4338ca` | chip 文字、链接强调 |
| `--color-brand-700` | `#3730a3` | 侧栏激活态渐变的深端 |

> **品牌的职责边界很窄：只用于「可交互」与「品牌标识」。** 不要用品牌色表达"归属"（那是三域色的活）或"状态"（那是语义色的活）。这是这套系统里最容易混淆的一处，见 §2.1。

#### 三域语义色（`life` / `work` / `learn`）

**全局唯一的「归属」信号。** 贯穿徽标 / 进度条填充 / 卡片左侧指示条 / 看板列头 / 头像。

| 域 | 主色阶 | 文字级 `-strong` | 染色底 `-bg` | 描边 `-line` |
| --- | --- | --- | --- | --- |
| `life` 生活 | `#0f9d76` | `#0a6b52` | `rgba(15,157,118,.13)` | `#bfe8da` |
| `work` 工作 | `#2f6fed` | `#1d4fb8` | `rgba(47,111,237,.13)` | `#c5d9fb` |
| `learn` 学习 | `#7c3aed` | `#5b21b6` | `rgba(124,58,237,.13)` | `#dccdfb` |

**三档色阶各有分工，选错就会出现"文字看不清"：**

| 色阶 | 承载文字？ | 用在哪 | 实测 |
| --- | --- | --- | --- |
| 主色阶 `bg-life` / `text-life` | ❌ 不承载 | 色条、进度条填充、圆点、头像底 | — |
| `-strong` `text-life-strong` | ✅ 承载 | 11.5px 徽标文字、需要达标的彩色小字 | 5.2 ~ 5.3（主色阶只有 **2.8**） |
| `-bg` `bg-life-bg` | — | 13% 半透明染色底（不是实色块） | — |
| `-line` | — | 13% 描边（原型遗留，当前组件未使用） | — |

> ⚠️ `-bg` 是 **13% 半透明染色**，不是实色浅底。实色块压在玻璃上会像"贴上去的贴纸"；半透明染色才是"同一片玻璃上的色"。
> ⚠️ 正因为底变透明了，**徽标文字必须换到 `-strong`**。这是改了 `-bg` 之后必须跟着做的一步，漏了就是 2.8:1。

#### 语义色（状态，不是归属）

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--color-danger` | `#d82323` | 危险圆点、勾选框激活态、关闭键 hover 底 |
| `--color-danger-bg` | `rgba(220,38,38,.11)` | 风险提示卡底、退出登录 hover 底 |
| `--color-danger-strong` | `#b91c1c` | **危险文字**（风险 chip、退出登录），实测 6.21 |
| `--color-danger-line` | `rgba(220,38,38,.26)` | 风险卡描边 |
| `--color-success` | `#0f9d76` | 「进行中」圆点、完成勾选 |
| `--color-success-bg` | `rgba(15,157,118,.13)` | 「进行中」chip 底 |
| `--color-success-strong` | `#0b7a5c` | 「进行中」chip 文字 |
| `--color-warning` | `#c2740a` | 警示（当前主要用于文案与图标） |
| `--color-warning-bg` | `rgba(194,116,10,.13)` | 警示底 |
| `--color-warning-line` | `rgba(194,116,10,.28)` | 警示描边 |
| `--color-online` | `#22c55e` | 同步状态圆点（唯一一处"活着"的信号） |
| `--color-prio-high` | `#e5484d` | 优先级「高」圆点 |
| `--color-prio-mid` | `#e0a020` | 优先级「中」圆点 |

#### 玻璃专用

| 令牌 | 值 | 作用 |
| --- | --- | --- |
| `--color-glass-hi` | `rgba(255,255,255,.80)` | 上沿 1px 高光（`::after` 的 `inset 0 1px 0`） |
| `--color-glass-lo` | `rgba(17,20,28,.055)` | 下沿 1px 暗线，给材质"厚度" |

### 1.2 圆角

| 令牌 | 值 | 工具类 | 该用在哪（按现有代码的实际用法） |
| --- | --- | --- | --- |
| `--radius-xs` | `7px` | `rounded-xs` | 小徽标（`Tag`）；焦点环的兜底圆角 |
| `--radius-sm` | `10px` | `rounded-sm` | 图标按钮、导航项、菜单项、侧栏小方块 |
| `--radius-md` | `12px` | `rounded-md` | **按钮 / 输入框 / 下拉框 / 分段控件 / 警示卡** |
| `--radius-lg` | `18px` | `rounded-lg` | 看板列、看板卡、弹出菜单面板 |
| `--radius-xl` | `24px` | `rounded-xl` | **卡片 / 统计面板 / 表格容器 / 空态图标 / 进度环槽** |
| `--radius-2xl` | `30px` | `rounded-2xl` | **页面级大面板**：登录表单卡、详情页 Hero |
| `--window-radius` | `24px` | **无工具类** | 窗口与外壳（侧栏/顶栏）的圆角 |

**`--window-radius` 是唯一不产出工具类的令牌** —— 它不在 Tailwind 的 `--radius-*` 命名空间里（名字不同），只能用 `var()` 引用或走 `.shell-frame-*` 组件类。**三处消费**：`.ambient`（环境光层的圆角）、`#root`（裁剪子树）、`.shell-frame-*`（外壳每块自己声明）。改一处令牌，三处一起变。

```css
:root                          { --window-radius: 24px; }  /* 默认，所有平台/宿主 */
html[data-platform='windows']  { --window-radius: 0px; }   /* 唯一覆写：交给系统画，见下 */
```

> ⚠️ **Windows 的 0px 是刻意的，不是漏了。** 官方 schema 写明 `shadow: true` 会让无边框窗口在 Windows 11 上自带圆角、再由 DWM 按窗口区域裁剪；CSS 再画一层只会被 DWM 裁掉、且与系统圆角错位。
> 注意它和"macOS 用 24px"并不矛盾：**「谁来画」属宿主能力，可以按平台分；「画多圆」属设计属性，只该有一套数。**

> ⚠️ **24px 是"跟随内容层级"，不是"对齐系统原生"。** 原生 macOS 是 10px、Linux/Adwaita 是 12px，都比它里面的卡片（`xl` 24px）小 —— 于是"外面的壳比里面的东西还硬"。现在把外壳拉到与主面板同档，**代价是它不再像一扇原生 macOS 窗口**（比系统窗口明显更圆）。这是一次口径选择：**平台保真 < 内容一致性**。

**圆角的两条经验**：① 半径越大，材质越像"一片"（所以玻璃拟态偏好饱满圆角，`xl`/`2xl` 用得多）；② **窗口圆角现在等于 `--radius-xl`（同 24px）**，视觉上"壳"与"面"同档；再往上只有登录表单卡与详情 Hero（`2xl` 30px）比它更圆。

**改窗口圆角时必须一起验的两件事**（半径 24px 时圆弧与视口对角线的理论交点在 `24×(1−1/√2) = 7.03px`）：

1. **四个角在背景漂移的各个相位都干净**（不能只在静止那一帧量，见 §5.3）；
2. **贴着角的所有可点元素都没被裁掉** —— 判据是"元素的包围盒 ∩ 角方块"那一小块的最远点仍在半径圆内（`dist ≤ R`）。实测 24px 下全部通过：macOS 圆点盒 `[16,20,36,40]`、顶栏账户胶囊 `[1358,13,1416,47]`、登录页窗口控制、表单卡、左下角提示胶囊都在弧内。

**没有令牌化的圆角（当前实际存在）**：`rounded-[9px]` / `[7px]` / `[6px]`（头像 `Avatar` 的三种尺寸）、`rounded-[5px]`（⌘K 徽标、勾选框）、`rounded-[8px]`（分段控件内项）、`rounded-[11px]`（登录页品牌标）、`rounded-[2px]`（优先级小圆点）。**新增元素优先用上面六档**；确有必要跟随父元素尺寸时（如头像随字号缩放）才写任意值。

`rounded-full` 是使用最多的一档：胶囊 chip、圆点、进度条、头像组。

### 1.3 阴影

玻璃的重心在**上沿高光**，投影只负责交代"离地高度"。所以数值刻意偏轻。

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--shadow-xs` | `0 1px 2px rgba(17,20,28,.04)` | 分段控件的选中项 |
| `--shadow-sm` | `0 2px 6px rgba(17,20,28,.05), 0 1px 2px rgba(17,20,28,.03)` | 卡片默认态（用到最多） |
| `--shadow-md` | `0 8px 20px rgba(17,20,28,.07), 0 2px 5px rgba(17,20,28,.035)` | 卡片 hover |
| `--shadow-lg` | `0 18px 40px rgba(17,20,28,.10), 0 4px 10px rgba(17,20,28,.04)` | 卡片 hover 抬升、登录页提示条 |
| `--shadow-xl` | `0 32px 64px rgba(17,20,28,.14)` | 弹出菜单、登录表单卡、卡片 hover 顶档 |

`glass-lift` 工具类内置的是 `0 18px 40px rgba(17,20,28,.11), 0 4px 10px rgba(17,20,28,.04)`（与 `shadow-lg` 同量级，但数值独立）。

> ⚠️ **上沿高光不能写进 `box-shadow`。** Tailwind 的 `shadow-*` 工具类写的就是 `box-shadow` 属性，两者会互相覆盖，而"谁生效"取决于产出顺序、不取决于 class 书写顺序。高光隔离在 `@utility glass*` 的 `::after` 里，`box-shadow` 才能完整留给工具类。
> ⚠️ 浮层（弹出菜单）的**可辨边界主要靠投影 + 上沿高光**，不靠描边 —— 描边只有 1.17:1，见 §5.2。

### 1.4 字体与字号

```css
--font-sans: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB',
             'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'SF Mono', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace;
```

**这是原型使用的非标准刻度，1:1 映射，不要"规范化"成 12/14/16。** 之所以是 0.5px 步进，是因为整套界面是按 1440×900 的桌面视口调的，`11.5` 与 `12` 的差别在密集表格里是看得出来的。

| 令牌 | 值 | 实际高频用途（按出现次数） |
| --- | --- | --- |
| `--text-9-5` | 9.5px | 头像组内的首字母 |
| `--text-10` | 10px | `PERSONAL OS` 之类的全大写小标 |
| `--text-10-5` | 10.5px | 小头像首字母 |
| `--text-11` | 11px | 侧栏分组标签、计数徽标 |
| `--text-11-5` | **11.5px** | **第 1 高频**：chip 文字、元信息、侧栏小字、表格辅助行 |
| `--text-12` | 12px | 提示语、卡片底部标签 |
| `--text-12-5` | 12.5px | 卡片小标题、统计卡标签 |
| `--text-13` | 13px | **按钮、导航项、表格单元格** |
| `--text-13-5` | 13.5px | **第 2 高频**：正文段落、搜索框、卡片描述 |
| `--text-14` | 14px | 导航项（大号）、次级标题 |
| `--text-14-5` | 14.5px | 登录输入框、次要按钮文字 |
| `--text-15` | 15px | `body` 默认 |
| `--text-15-5` | 15.5px | 品牌名 |
| `--text-16` | 16px | 段落标题 |
| `--text-19` | 19px | 登录页品牌名 |
| `--text-21` | 21px | 少用 |
| `--text-24` | 24px | **页面标题（h1）** |
| `--text-26` | 26px | 详情页标题 |
| `--text-29` | 29px | **统计卡的大数字** |
| `--text-30` | 30px | 少用 |

**行高不在令牌里**：`body` 是 `line-height: 1.7`，其余按需用任意值（实际用到 `1.2 / 1.3 / 1.35 / 1.4 / 1.5 / 1.65 / 1.7` 与 `leading-none`）。经验值：

- 标题 / 单行标签：`leading-[1.2] ~ leading-[1.35]`
- 正文段落：`leading-[1.65] ~ leading-[1.7]`（继承 `body` 即可）
- 数字与按钮：`leading-none` 或 `leading-[1.4]`

**字距 `tracking-*` 也按需用**，只有两条约定：

- 全大写小标（`PERSONAL OS`）：`tracking-[.13em] ~ tracking-[.14em]`
- 大标题 / 大数字：负字距 `tracking-[-0.01em] ~ tracking-[-0.02em]`

**数字必须对齐时加 `tabular-nums`**（计数徽标、统计值、进度百分比、表格数字列）。这是本项目里区分「数字」与「文本」的唯一手段，表格与统计卡必加。

### 1.5 间距与布局

> ⚠️ **间距没有令牌化，这是当前的真实状态，不要以为漏看了。** 全部使用 Tailwind 默认刻度（基准 `0.25rem = 4px`）+ 大量任意像素值。

按使用频次排序，主力档位是 `4`(16px) → `5`(20px) → `3`(12px) → `2`(8px) → `6`(24px) → `1.5`(6px)；另有 `[13px]` `[11px]` `[7px]` 这类**贴合原型逐像素还原**的值（出现频次与上面的 4/5/3 同量级，不能忽略）。

**约定（靠纪律而非令牌维持）**：

| 场景 | 取法 |
| --- | --- |
| 页面内容区外边距 | `px-6 pt-6 pb-16`（≤1024px 降为 `px-4 pt-5 pb-12`） |
| 卡片内边距 | `p-5`（统计卡、项目卡） |
| 面板内边距 | `p-6`（Hero）、`p-8`（登录卡） |
| 卡片之间的栅格间距 | `gap-4` |
| 图标与文字 | `gap-[7px]`（按钮）、`gap-[11px]`（导航项） |
| 区块之间的纵向间隔 | `mb-5` / `mb-6` |

**断点也是 ad-hoc 的**（Tailwind 的 `max-[Npx]:` 任意变体，共 7 个值）。用得多的是前四个：

| 断点 | 出现 | 语义 |
| --- | --- | --- |
| `max-[860px]` | 19 | **主布局断点**：侧栏收成抽屉、顶栏出现 hamburger、窗口控制换兜底位置 |
| `max-[880px]` | 12 | **登录页专用**：品牌面板隐藏、收成单栏 |
| `max-[1024px]` | 9 | 侧栏宽度 248 → 236px、内容区内边距收窄 |
| `max-[600px]` | 7 | 表格横向滚动、页头按钮换行 |
| `max-[1080px]` / `max-[1180px]` / `max-[1240px]` | 各 1~3 | 登录页 / 详情页 Hero 的局部降级 |

> **新增响应式行为时，先看能不能复用 860 / 1024 / 600 这三档。** 每加一个新断点，就要多验证一条几何回归路径。

### 1.6 动效

```css
--ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);   /* 唯一自定义缓动 */
```

| 令牌 | 值 | 用途 |
| --- | --- | --- |
| `--animate-fade-up` | `fadeUp10 .34s cubic-bezier(0,0,.2,1) both` | **列表项入场**（`translateY(10px) → 0` + 淡入） |
| `--animate-fade-up-sm` | `fadeUp8 .3s` | 小元素入场 |
| `--animate-fade-up-lg` | `fadeUp14 .58s` | 页面级入场（登录页表单） |
| `--animate-spin-fast` | `spinnerRotate .65s linear infinite` | 加载转圈 |
| `--animate-dot-pulse` | `dotPulse 2.4s infinite` | 同步状态点呼吸（1 → .4） |
| `--animate-badge-pulse` | `badgePulse 2s infinite` | 徽标呼吸（1 → .35） |

**过渡时长约定**：交互反馈统一 `duration-150 ease-out`（绝对主力）；卡片抬升 `duration-[220ms]`；进度条宽度 `duration-[400ms]`；Toast 进出 `duration-[240ms]`。**不要引入新的时长档**（如 180ms、300ms），除非有明确理由。

**列表错峰入场**用内联 `style={{ animationDelay: \`${index * 45}ms\` }}`。

**降低动效可访问性**已在全局处理（`prefers-reduced-motion: reduce` 时所有动画降到 `0.01ms`、极光漂移直接关掉），组件层不需要各自处理。

---

## 2. 配色规范

### 2.1 分工：四套色各管一件事

这是整套系统里最需要背下来的一张表。**用错色系不是"不好看"，是让信息读不出来。**

| 色系 | 负责什么 | **不负责什么** |
| --- | --- | --- |
| **三域色** `life/work/learn` | **归属**（这条数据属于生活/工作/学习） | 状态、可交互性、品牌 |
| **语义色** `danger/success/warning` | **状态**（风险、进行中、警示） | 归属、可交互性 |
| **品牌色** `brand-*` | **可交互性 + 品牌标识**（焦点环、激活指示、链接、logo） | 归属、状态 |
| **中性灰阶** `ink-*` | **层级**（标题 → 正文 → 元信息 → 装饰） | 任何语义 |

**自检问法**：如果你在犹豫"这个红该用 `danger` 还是 `prio-high`" —— 看它表达的是**状态**（风险阻塞 → `danger`）还是**属性**（优先级高 → `prio-high`）。两个红不一样（`#d82323` vs `#e5484d`），这是刻意的。

### 2.2 场景 → 取色决策表

| 场景 | 用什么 | 具体写法 |
| --- | --- | --- |
| 项目归属徽标 | 三域 `-bg` + `-strong` | `SCOPE_META[scope].badge` |
| 归属色条 / 进度填充 / 圆点 | 三域主色阶 | `SCOPE_META[scope].bar` / `.fill` |
| 项目状态 chip | 语义色 `-bg` + `-strong` | `STATUS_META[status].chip` |
| 任务状态 pill | 同上 | `TASK_STATUS_META[status].pill` |
| 优先级圆点 | `prio-*` / `ink-300` | `PRIORITY_META[prio].dot` |
| 主按钮 | `bg-ink-900` + `text-white` | 见 §4 |
| 次要按钮 | `bg-surface` + `border-line-strong` + `text-ink-700` | 见 §4 |
| 焦点环 | `brand-500` | 全局 `:focus-visible`（`outline: 2px` + `offset: 2px`） |
| 侧栏激活项 | 品牌渐变 + `text-white` | `#4f46e5 → #6d28d9`，见 §4 |
| 危险操作文字 | `text-danger-strong` | 退出登录（6.21） |
| 元信息 / 装饰标签 | `ink-400` | 见 §5.2 已知偏差 |
| 次级正文 / 占位符 | `ink-500` | 占位符必须用 ink-500（4.77~5.14） |

### 2.3 三条硬性规则

**① 三域色只能通过 `SCOPE_META` 使用，不许在组件里直接写类名。**

```tsx
// ✅ 唯一正确写法
import { SCOPE_META } from '../../data/meta'
<span className={SCOPE_META[scope].badge}>{SCOPE_META[scope].label}</span>

// ❌ 组件里出现 text-life 类名
<span className="bg-life-bg text-life-strong">生活</span>
```

判据：三域色是**跨页面的一致性信号**。它必须能被一次改遍（改 `meta.ts` 一处），而不是靠 20 个组件里的类名同步。当前代码全部遵守这条 —— 用下面的命令可复现（结果应为空）。

**② 不许新增表面色。** 三档材质 + `canvas` 已经覆盖所有"面"的需要。需要更亮/更暗，先问自己：**这是"同一片玻璃上的另一层"，还是"另一片玻璃"？**

- 同一片玻璃上的层 → 换 `bg-ink-50` / `bg-ink-100`（遮罩）或 `bg-surface-sunken`（沉槽）
- 另一片玻璃 → 换材质档位（`glass-soft` / `glass-panel` / `glass-bar`）

**③ 承载文字的彩色表面，文字色必须用 `-strong` 色阶。**

| 表面 | 文字 | 实测 |
| --- | --- | --- |
| `bg-life-bg` + `text-life` | ❌ | **2.8:1** |
| `bg-life-bg` + `text-life-strong` | ✅ | **≥ 5:1**（实测 5.2 ~ 5.3，随底衬而定） |

同一条规则适用于 `danger` / `success` / `warning` / `work` / `learn`。

**可复现的检查命令**（⚠️ `\b` 与 `\|` 在 macOS 自带的 BSD grep 里**不生效**，写了会静默返回空、被误读成"没问题"）：

```bash
cd src && grep -rlE "(text|bg|border)-(life|work|learn)-" .
# 正确结果应只有 ./data/meta.ts 与 ./styles/index.css（后者是令牌定义本身）
```

### 2.4 macOS 窗口圆点：一处刻意不改的例外

`#ff5f57` / `#febc2e` / `#28c840`（红 / 黄 / 绿）实测对比度 **2.37 / 1.35 / 1.79**，远低于非文字元素 3:1 的要求。

**不修。** 同一组色值在 macOS 自己的浅色标题栏上也是这个数；黄色的相对亮度约 0.57，在浅色底上**数学上不可能**到 3:1（要达标得压成橄榄色，那就不像 macOS 了）。Apple 的兜底是「色相区分 + 大命中区 + 键盘快捷键（⌘W）+ 应用菜单」，这四样本应用也都具备。

**判据**：这是一次口径选择（平台保真 > 合规），不是实现缺陷。**已单列为已知偏差**，见 §5.2。

---

## 3. 玻璃拟态（Glassmorphism）规范

### 3.1 三条前提（缺一条就退化成"半透明灰块"）

玻璃不是"半透明白 + 模糊"。它成立需要三个条件同时满足：

| # | 前提 | 在哪实现 | 破坏它会怎样 |
| --- | --- | --- | --- |
| 1 | **底下必须有可折射的环境色** | `index.html` 的 `.ambient__aurora`（极光） | `backdrop-filter` 无物可糊，玻璃发灰 |
| 2 | **表面令牌必须是半透明白，不是实色** | `--color-surface` 一族（α .38 ~ .84） | 没有"透光"，只剩描边 |
| 3 | **边缘要有一道 1px 上沿高光** | `@utility glass*` 的 `::after` | 材质没有厚度，看着像塑料片 |

另外有一条**禁令**：`#root` 只能加 `position` + `z-index`。加 `filter` / `opacity < 1` / `mask` 会形成 **backdrop root**，直接切断 `backdrop-filter` 对极光的采样（玻璃会瞬间变成不透明灰块）。

### 3.2 五档材质

**选择依据是「面积 + 背后内容的可辨认度」，不是「想多模糊」。**

| 工具类 | 模糊 | 饱和度 | 上沿 / 下沿高光 | 适用面积 | 用在哪（在 `src/**/*.tsx` 里搜类名可复现） |
| --- | --- | --- | --- | --- | --- |
| `glass-bar` | `blur(28px)` | `saturate(190%)` | 上 + 下 | **大面积、内容会从它下面滚过** | 侧栏、顶栏、弹出菜单、Toast、登录页品牌面板 |
| `glass-panel` | `blur(22px)` | `saturate(180%)` | 上 + 下 | 与内容同层的面板 | `Card`、`ProjectCard`、`ProjectStatsPanel`、`ProjectTable`、`ProjectKanban`、`ProjectHero`、登录表单卡 |
| `glass` | `blur(18px)` | `saturate(175%)` | 上 + 下 | 中等面积通用档 | **无。全站 0 处引用 ← 见 §6.1** |
| `glass-soft` | `blur(12px)` | `saturate(160%)` | 仅上 | **小控件**（面积小，模糊重了会在描边外泛光晕） | `Button`、`IconButton`、`Badge`、`SearchField`、`ProjectToolbar`、`Sidebar`、`AccountMenu`、`DocumentList`、`EmptyState`、`ProgressRing`、`ProjectInfoCards`、`ProjectKanban`、登录页各控件 |
| `glass-lift` | — | — | — | 只加投影，不碰高光 | **无。全站 0 处引用 ← 见 §6.1** |

> 表中"用在哪"是**类名出现的位置**，可复现；不写"多少处"，因为 `cn()` 多行调用的计数方法不同、结果会飘。真正需要统计时以"文件清单"为准。

**为什么面积越大模糊越厚**：`backdrop-filter` 的职责是"把背后糊到不可辨认"。面积大 → 遮挡的内容多 → 需要更厚的模糊，否则能辨认出底下的文字轮廓，反而不像玻璃。面积小（如 34×34 的图标按钮）用 28px 则会在自身描边外形成一圈光晕。

**为什么高光走 `::after`**：见 §1.3 的警告。`::after` 用 `border-radius: inherit`，所以圆角自动跟随，不必重复声明。

**为什么必须有 `-webkit-` 前缀**：WebKit（Tauri 在 macOS 上的宿主）需要 `-webkit-backdrop-filter`。四档都写了。

**降级**：`@supports not ((backdrop-filter: …))` 时移除模糊并关掉噪点层。⚠️ 该规则的注释声称"退回不透明表面"，但**代码里没有恢复不透明度的语句** —— 见 §6.2。

### 3.3 环境光层：为什么是两层，不能合并

```
index.html
└── .ambient                ← 外层：只负责"形状"。静止。
    │                          基色 #e9edf6 + border-radius: var(--window-radius) + overflow: hidden
    ├── .ambient__aurora    ← 内层：只负责"漂"。8 层渐变 + auroraDrift 26s
    └── .ambient__noise     ← 霜感噪点 180×180 / opacity .3，不参与漂移
#root                       ← z-index: 1，内容整体抬到环境光之上，且**不**形成 backdrop root
```

**必须拆成两层的理由（这是一个真踩过的坑）**：极光要"漂"，漂移用的是 `transform`。如果极光和圆角在同一个元素上，`transform` 会把**带圆角的那一层整体挪出视口** —— 它自己的圆角跑到画面之外，色就顺着窗口四角的楔形区漏出去。只有 `transform` 接近恒等的那一帧是对齐的，所以这是**偶发**的，缩略图完全看不出来。

**拆的时候有个几何陷阱**：内层放大一圈（`inset: -10%`）给漂移留余量之后，`background-image` 里的百分比会按放大后的尺寸重算。必须同时给：

```css
background-size: 100vw 100vh;   /* 把渐变图像固定成"一屏大小" */
background-position: 50% 50%;   /* 再在放大的元素里居中 */
```

少了这两行，`@6%` 的色斑会变成 `-2.8%`、`@21%` 的色带归零点变成 `15.2%` —— 左侧色带会扫进内容列，13.5px 正文直接掉到 4.4:1。

**极光几何（改前必读）**：强色压在两侧与上下边缘（外壳之外、内容区四周），中央内容带留得更淡。三层关键色：

| 层 | 几何 | 为什么要这个数 |
| --- | --- | --- |
| 左侧全高色带 | `linear-gradient(96deg, rgba(99,102,241,.52) → .3 @13% → 0 @21%)` | 侧栏是**整列**，只有线性色带能覆盖整列（角点 radial 到列中段就归零 → 侧栏变白板）。**21% 归零**是硬约束：侧栏右边缘 17.2%、内容列从 18.9% 开始，放到 30% 会把 13.5px 正文从 4.66 压到 4.40 |
| 顶栏紫纱 | `linear-gradient(180deg, rgba(124,58,237,.36) → 0 @7.2%)` | 侧栏色带 21% 就归零、顶栏从 17.2% 才开始，中间 600~1100px 本来一点色都没有 → 「白横条紧贴有色竖柱」。**给 0.14 不够**（α.70 玻璃把底衬稀释到 30%，只做出 6 个通道差），要到 **0.36** |
| 中央淡紫 | `radial-gradient(72% 62% at 50% 42%, rgba(99,102,241,.06) → 0)` | 避免大面积空白发死 |

### 3.4 层叠顺序

从下往上（`z-index` 全部为正整数或 0，没有负数）：

| z | 层 | 说明 |
| --- | --- | --- |
| — | `html` 背景 | **仅浏览器宿主**：模拟"桌面"底衬 `linear-gradient(140deg,#5f6980,#6e6a88,#7b7566)`。圆角要看得见，圆角**外面**必须有东西 |
| 0 | `.ambient` | 基色 + 圆角 + 极光 + 噪点（`position: fixed`、`pointer-events: none`） |
| 1 | `#root` | 应用内容。`border-radius` + `overflow: hidden`（无条件，两个宿主都裁） |
| 20 | 顶栏 | `glass-bar` |
| 29 | 抽屉遮罩 | `fixed inset-0` + `backdrop-blur-[8px]`（用"霜化"代替压黑） |
| 30 | 侧栏 | `glass-bar`（高于遮罩，抽屉打开时在遮罩之上） |
| 50 | 弹出菜单 | `glass-bar` + `shadow-xl` |

**桌面壳专属**：`html[data-shell='desktop']` 时 `html` / `body` 背景透明（浏览器标签页里没有"窗口透明"这回事，硬透明掉会让四角变成真·空洞）。

**窗口与外壳的圆角由谁承担**（`.shell-frame-*` 组件类，取值与 `--window-radius` 同源）：

| 类 | 承担 | 生效条件 |
| --- | --- | --- |
| `.shell-frame-left` | 侧栏左上 + 左下 | 无条件（窄断点下侧栏开着时它就是窗口左缘） |
| `.shell-frame-top-right` | 顶栏右上 | 无条件 |
| `.shell-frame-top-left` | 顶栏左上 | **仅 ≤860px**（此时侧栏收成抽屉不占位） |
| `.shell-frame-right` | 登录页表单栏右上 + 右下 | 无条件 |
| `.shell-frame-left-sm` | 登录页表单栏左上 + 左下 | **仅 ≤880px**（此时品牌面板隐藏） |

> 为什么外壳每块要**自己**声明圆角，而不是靠 `#root` 裁一次：外壳是整片铺满视口的矩形，`#root` 的裁剪是"借来的"圆角 —— 任何一层引入新的裁剪上下文或合成层，它就可能失效；而侧栏与顶栏恰恰都带 `backdrop-filter`（玻璃在部分引擎里会被提升为独立合成层）。

### 3.5 适用场景

**该做玻璃的地方**：

| 场景 | 档位 | 理由 |
| --- | --- | --- |
| 侧栏、顶栏 | `glass-bar` | 内容从下面滚过，必须糊到不可辨认 |
| 弹出菜单 / Toast / 浮层 | `glass-bar` + `shadow-xl` | 盖在内容上，且要读作"浮起来的一层" |
| 卡片 / 面板 / 表格容器 | `glass-panel` | 与内容同层，模糊适度即可（过厚会让文字底衬发脏） |
| 按钮 / 输入框 / 徽标 / 图标按钮 | `glass-soft` | 面积小，轻模糊；重模糊会在描边外泛光晕 |
| 凹槽（分段控件、进度环槽） | `glass-soft` + `bg-surface-sunken` | 沉槽是"嵌进玻璃里的凹坑"，用暗遮罩而不是浅色，凹感才成立 |

**不该做玻璃的地方**：

| 场景 | 用什么 | 理由 |
| --- | --- | --- |
| 正文段落、长文本容器 | 直接压底衬（透明） | 文字后面再加一层模糊，等于白付一次合成开销，还降低可读性 |
| 登录页品牌面板 | `glass-bar` 但**底色接近不透明**（`rgba(9,11,16,.92)`） | 白字要够对比。保留 `backdrop-filter` 只是让极光渗进来一点，避免变成死黑实心板 —— **"带一点透光的实色"和"玻璃"是两回事，别混** |
| 深色 Toast | `glass-bar` + `bg-[rgba(16,18,24,.82)]` | 同上：深色浮层的底色必须够实，才撑得起白字 |
| 表格单元格 | `bg-canvas`（非玻璃） | 单元格数量多，逐个加 `backdrop-filter` 会拖垮合成 |

**一个判断口诀**：**「它会盖住别的内容吗？」** 会 → 玻璃（且面积越大、模糊越厚）；不会 → 别用玻璃。

### 3.6 反例清单（这些是踩过的，不是理论风险）

| 反例 | 现象 | 根因 |
| --- | --- | --- |
| 环境光写成 `inset: -12%` + 四角 `radial(at 0% 0%)` | 四个色斑中心被推出视口，只剩尾部衰减 → 页面底衬几乎纯灰白，玻璃无物可折射 | 色斑"中心"必须落在真实视口内 |
| 用角点 radial 给整列（侧栏）上色 | 侧栏中段落到色斑之外 → 侧栏中心 `245,248,250` 中性灰，像白板 | **整列只能用全高线性色带** |
| 外壳用 `surface-raised`（α.84） | 环境色被盖光，侧栏 `250,249,252` ≈ 纯白 | 外壳要薄一档（α.70） |
| 把上沿高光写进 `box-shadow` | `shadow-md/lg` 时有时无 | 同属性覆盖，胜负取决于产出顺序 |
| 漂移动画和圆角在同一个元素上 | 极光从窗口四角漏出（偶发，跨 26s 相位） | `transform` 把带圆角的那层挪出视口 |
| 内层放大后没配 `background-size/position` | 所有色斑位置偏移，色带扫进内容列，正文掉档 | 百分比按放大后的尺寸重算 |
| 给 `#root` 加 `filter` / `opacity` | 玻璃瞬间变不透明灰块 | 形成 backdrop root，切断 `backdrop-filter` 采样 |
| 只在某个宿主下定义 `--window-radius` | 另一个宿主圆角静默归零 | 圆角是设计属性、透明才是宿主能力，两者要解耦 |

---

## 4. 组件配方（可直接抄）

| 组件 | 材质 | 圆角 | 阴影 | 关键色 |
| --- | --- | --- | --- | --- |
| **主按钮** | `glass-soft` | `rounded-md` | hover `shadow-md` | `bg-ink-900 text-white`，hover `-translate-y-px` + `bg-black` |
| **次要按钮** | `glass-soft` | `rounded-md` | — | `bg-surface border-line-strong text-ink-700`，hover `bg-surface-raised` |
| **图标按钮** | `glass-soft`（`framed`/`outline` 档） | `rounded-sm` | — | `text-ink-500` → hover `text-ink-900` + `bg-ink-50` |
| **输入框** | `glass-soft` | `rounded-md` | 聚焦 `shadow-[0_0_0_3.5px_rgba(79,70,229,.12)]` | `bg-ink-50` → 聚焦 `bg-surface` + `border-brand-500`；占位符 `text-ink-500` |
| **卡片** | `glass-panel` | `rounded-xl` | `shadow-sm` → hover `shadow-lg` | `bg-surface` → hover `bg-surface-raised`；hover `-translate-y-[3px]` |
| **统计面板** | `glass-panel` | `rounded-xl` | `shadow-sm` → hover `shadow-md` | 同上；大数字 `text-29 tabular-nums` |
| **表格容器** | `glass-panel` | `rounded-xl` | `shadow-sm` | 表头 `bg-canvas` + `text-ink-400`；行 hover `bg-ink-50` |
| **看板列** | `glass-soft` | `rounded-lg` | — | `bg-surface-sunken`（凹槽语义） |
| **看板卡** | `glass-panel` | `rounded-lg` | `shadow-xs` → hover `shadow-md` | 同卡片 |
| **项目徽标 chip** | `glass-soft` | `rounded-full` | — | `SCOPE_META[scope].badge`（`-bg` + `-strong`） |
| **弹出菜单** | `glass-bar` | `rounded-lg` | `shadow-xl` | `bg-surface-raised`；危险项 `text-danger-strong` + hover `bg-danger-bg` |
| **凹槽分段控件** | `glass-soft` | `rounded-md`（内项 `rounded-[8px]`） | 选中项 `shadow-xs` | 槽 `bg-surface-sunken`；选中 `bg-surface`、未选 `text-ink-500` |
| **侧栏 / 顶栏** | `glass-bar` | `.shell-frame-*` | — | `bg-surface` + 顶部镜面反光渐变 |
| **页面级大面板** | `glass-panel` | `rounded-2xl` | `shadow-xl`（登录卡）/ `shadow-md`（Hero） | `bg-surface` |

**侧栏激活项**（一处特殊配方）：品牌渐变 + 白字 + 外发光

```tsx
'bg-[linear-gradient(135deg,rgba(79,70,229,.96)_0%,rgba(109,40,217,.94)_100%)] text-white shadow-[0_10px_24px_rgba(79,70,229,.26)]'
```

> 渐变的两个端点取的是 **600/700 级**（`#4f46e5 → #6d28d9`）而不是 400 级：400 级最亮处白字只有 **4.17:1**（不达标），600 级之后稳定在 **6.03:1**。
> 另一条备选是"近黑实心块"（视觉更重），但它与玻璃拟态的语汇相冲 —— 近黑是不透光的，会像在玻璃上贴了一块板。所以选了渐变。

---

## 5. 无障碍与对比度

### 5.1 阈值

| 类型 | 阈值 |
| --- | --- |
| 正文文字 | 4.5:1 |
| 大字（≥18.66px bold 或 ≥24px） | 3:1 |
| 非文字元素（描边、状态、图标） | 3:1 |
| **占位符** | **4.5:1**（占位符在 WCAG 里就是文字，不是装饰） |

### 5.2 已实测的基线（可直接引用）

每一项都标了**审计清单里的 id**，方便对号复核；数值取最近一次全量采集（1440×900，浏览器宿主）。

| 审计 id | 是什么 | 实测 | 阈值 |
| --- | --- | --- | --- |
| `page-sub` | 列表页正文（13.5px） | **4.68** | 4.5 ✅ |
| `search-placeholder` | 顶栏搜索框占位符 | **4.77** | 4.5 ✅ |
| `input-email-placeholder` | 登录页邮箱占位符 | **5.15** | 4.5 ✅ |
| `sidebar-email` / `sidebar-account-email` | 侧栏邮箱（ink-500） | **4.91** | 4.5 ✅ |
| `sidebar-active-item` | 侧栏激活项白字（品牌渐变上） | **6.03** | 4.5 ✅ |
| `tab-idle` | 分段控件未选中项 | **5.41**（坐标探针，见下） | 4.5 ✅ |
| `card-desc` / `card-meta` / `card-tag` | 卡片描述 / 元信息行 / 底部标签 | **5.64 / 5.66 / 5.83** | 4.5 ✅ |
| `menu-item-signout` | 退出登录（`danger-strong`） | **6.21** | 4.5 ✅ |

> ⚠️ `tab-idle` 这一项**不要直接引用审计报告里的数字**：清单里该目标的采样带会落在胶囊内的**三域色点**上
> （实测背景采样到 `(91,186,161)` 青绿），报告因此报 **2.59** 的假值。
> 用坐标探针绕开色点后，真实底衬是分段控件凹槽 `(239,242,249)`，文字 ink-500 `(91,99,112)` → **5.41:1**。
> 同类污染还有 `remember-label`（采样带落在已勾选的勾选框上，报 1.38，按 p50 复核真实值 8.09）。

**已知偏差（刻意保留，非缺陷）**：

| 项目 | 实测 | 原型口径 | 说明 |
| --- | --- | --- | --- |
| **ink-400 元信息层** | 3.14 ~ 3.92 | 原型在纯白上 **3.50** | 同档。分层来看：**压在卡片/面板上 3.72~3.86**（高于原型），**直接压底衬或外壳玻璃 3.14~3.41**（低于原型） |
| 发丝线（`--color-line`） | 1.2 ~ 1.5 | 原型 1.19 ~ 1.46 | 同档。浮层的可辨性由**投影**（1.30）与**上沿高光**（1.19）承担，不是描边 |
| macOS 窗口圆点 | 红 2.37 / 黄 1.35 / 绿 1.79 | 与系统一致 | 见 §2.4 |

**ink-400 的机械修法（需要时执行，不要凭感觉调）**：

1. 粗修：把 `--color-ink-400` 并入 `--color-ink-500`。代价是元信息与正文的层级差从 1.35 倍压到 1.06 倍（层级被压平）。
2. 外科修法：**规定 `ink-400` 只用于卡片/面板之上**（3.72~3.86，达标），直接压在页面底衬或外壳玻璃上的元信息一律改 `ink-500`（3.14~3.41）。
   涉及：`breadcrumb`、`divider-or`、`sidebar-brand-sub`、`sidebar-group-label`、`stat-foot`、`th-first`。

### 5.3 怎么验收

**前提**：玻璃上的对比度**无法从令牌推算**（底衬是「半透明白 + 极光」的合成结果），只能量真实像素。

```bash
# 1. 构建 + 合成单文件 HTML（file:// 下 ES module 会被 CORS 拦）
npx vite build
# 用 inline 脚本把 dist/index.html 的 <script type=module src> 与 <link stylesheet> 内联

# 2. 用 html-ds-delivery-verify 技能采集 + 计算
#    Chrome 需加 --allow-file-access-from-files（页面要写 localStorage 才能到登录后路由）
```

**三条前提中最容易被忘的一条**：**审计必须把"可见条件"一并造出来。** 凡是靠"外部背景"才成立的视觉（窗口圆角、投影、外发光），要先把那个外部造出来（在 `<html>` 上铺一层模拟桌面底衬），否则四角全是应用自己的颜色，**连截图都看不出问题**。

**第二条：先怀疑采样，再怀疑设计。** 目标是"文字"时，采样带若横跨了**装饰性子元素**（胶囊里的色点、已勾选的勾选框、图标），报出来的就是"文字 vs 那个子元素"的假值。判据：**比值 ≤ 3 但目视明显可读**时，改用坐标探针在目标内取几个**纯底衬点**复算（本仓库已有两例：`tab-idle` 2.59 → 真值 5.41；`remember-label` 1.38 → 真值 8.09）。

**定格相位验证**：背景有无限漂移动画时，不能只在"静止的那一帧"量。用 `animation-delay` + `paused` 定格到 0 / 25% / 50% / 75% 四个相位各量一次。

---

## 6. 已知缺口与不一致（诚实清单）

> 这一节是给"下一个改这里的人"的。**如果不写下来，每一条都会被重新发现一次。**

### 6.1 两档材质定义了但没人用

`glass`（18px）与 `glass-lift` 在 `@theme`/`@utility` 里定义完整，但**在 `src/**/*.tsx` 里搜类名 0 命中**（只在 CSS 里作为定义与 `@supports` 选择器出现）。

- 处置建议：**保留**。`glass` 是 18/22/28 之间的自然中间档，将来出现"面积中等但会遮内容"的元素时会用到；`glass-lift` 的投影数值与 `shadow-lg` 不同，是独立语义。
- 但**新写代码时不要为了"用上它"而挑它** —— 按 §3.2 的面积判据选档。

### 6.2 `@supports` 降级与本意不符 ⚠️

```css
/* 注释说：「不支持 backdrop-filter 时把玻璃退回不透明表面」
   并且说：「未分层的规则优先级高于 @layer，因此这里的 background-color 能压过工具类」
   但规则体里没有任何 background-color */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass, .glass-bar, .glass-panel, .glass-soft { backdrop-filter: none !important; }
  .ambient__noise { display: none; }
}
```

**当前实际行为**：不支持 `backdrop-filter` 时只去掉模糊与噪点，表面仍是 α.70 的半透明白 → 「半透明 + 无模糊」会让文字压在偏花的底衬上（正是注释想避免的情况）。

**影响面**：只影响不支持 `backdrop-filter` 的环境；现代 Chromium / WebKit 都支持，所以**在浏览器里测不出来**。
**修法**（需要真机/旧引擎验证后再做）：给这四个类补 `background-color: rgba(255,255,255,.92)` 之类的实色回退。**不要未经验证就改** —— 这条路径没有可用的验证环境。

### 6.3 间距与断点未令牌化

见 §1.5。间距靠 Tailwind 默认刻度 + 任意像素值，断点有 7 个 ad-hoc 值。这是**有意为之**（原型是逐像素还原的），但代价是"间距节奏"只能靠纪律维持，新人容易写出第 8 个断点。

### 6.4 `hex` 字段是手工复制的令牌，已经漂移 ⚠️

`src/data/meta.ts` 里每个 meta 都带一个 `hex`，被 6 处内联样式消费（SVG 圆点、进度条填充、`box-shadow` 光晕）。**问题是它是手抄的令牌副本，而令牌改过两次，它没跟上**：

| 字段 | 值 | 对应令牌的现值 | 一致？ |
| --- | --- | --- | --- |
| `STATUS_META.planning.hex` | `#8b93a1` | `--color-ink-400` = `#74808f` | ❌ **这是旧版 ink-400** |
| `STATUS_META.risk.hex` | `#dc2626` | `--color-danger` = `#d82323` | ❌ **这是旧版 danger** |
| `STATUS_META.active.hex` | `#0f9d76` | `--color-success` = `#0f9d76` | ✅ |
| `STATUS_META.done.hex` | `#4f46e5` | `--color-brand-500` = `#4f46e5` | ✅ |
| `SCOPE_META.*.hex` | 与三域主色阶一致 | 同上 | ✅ |

**可观察到的现象**：看板「待启动」列的状态圆点用的是 `#8b93a1`（旧灰），而同一列 chip 里的 `dot` 用的是 `bg-ink-400`（新灰）—— **同一列里两个灰不一样**。
**修法**（两条，推荐第一条）：① 让内联样式改读 CSS 变量（`var(--color-ink-400)`）或直接用工具类，`hex` 字段只在确实需要字符串的场景保留；② 至少手工同步这 2 个值。
**这是一条通用教训**：**只要令牌被复制过一份，就必须建立"改令牌时同步副本"的检查**，否则它一定会漂移。

### 6.5 其他

- 无 ESLint / Prettier / 测试工具链。样式回归完全依赖 §5.3 的人工审计流程。
- 三个 git 仓库（client / backend / 根目录）均无提交；`design/`、`docs/`、`ui-design/`、`.workbuddy/` 未纳入版本控制。

---

## 附录 A · 令牌全量清单

> ⚠️ **这是快照，不是事实源。** 与代码不一致时**以代码为准**，并回来更新本附录。
> 核对方式（列出 `@theme` 里定义的全部令牌，逐行对照）：
>
> ```bash
> cd client/lucky && sed -n '/^@theme/,/^}/p' src/styles/index.css | grep -E '^\s+--'
> ```
>
> 正文各节（§1.1 ~ §1.6、§3.2、§3.4）里的数值是**判据所在**，与附录不一致时必须先改正文。

<details>
<summary>展开（按 <code>@theme</code> 出现顺序）</summary>

```css
/* 字体 */
--font-sans: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Hiragino Sans GB',
             'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif;
--font-mono: 'SF Mono', ui-monospace, 'JetBrains Mono', Menlo, Consolas, monospace;

/* 品牌 */
--color-brand-50:  rgba(99,102,241,.12);
--color-brand-100: rgba(99,102,241,.20);
--color-brand-400: #6366f1;
--color-brand-500: #4f46e5;
--color-brand-600: #4338ca;
--color-brand-700: #3730a3;

/* 三域 */
--color-life:        #0f9d76;  --color-life-strong:  #0a6b52;
--color-life-bg:     rgba(15,157,118,.13);   --color-life-line:  #bfe8da;
--color-work:        #2f6fed;  --color-work-strong:  #1d4fb8;
--color-work-bg:     rgba(47,111,237,.13);   --color-work-line:  #c5d9fb;
--color-learn:       #7c3aed;  --color-learn-strong: #5b21b6;
--color-learn-bg:    rgba(124,58,237,.13);   --color-learn-line: #dccdfb;

/* 中性 */
--color-ink-50:  rgba(17,20,28,.045);   --color-ink-100: rgba(17,20,28,.075);
--color-ink-200: #d3d7de;  --color-ink-300: #9ba4b2;  --color-ink-400: #74808f;
--color-ink-500: #5b6370;  --color-ink-600: #454c58;  --color-ink-700: #343a46;
--color-ink-800: #1b1e26;  --color-ink-900: #101218;

/* 表面 / 描边 */
--color-surface:        rgba(255,255,255,.70);
--color-surface-raised: rgba(255,255,255,.84);
--color-surface-sunken: rgba(255,255,255,.42);
--color-canvas:         rgba(255,255,255,.38);
--color-line:           rgba(17,20,28,.085);
--color-line-strong:    rgba(17,20,28,.155);

/* 玻璃 */
--color-glass-hi: rgba(255,255,255,.80);
--color-glass-lo: rgba(17,20,28,.055);

/* 语义 */
--color-danger:        #d82323;  --color-danger-bg:  rgba(220,38,38,.11);
--color-danger-strong: #b91c1c;  --color-danger-line: rgba(220,38,38,.26);
--color-success:       #0f9d76;  --color-success-bg: rgba(15,157,118,.13);
--color-success-strong:#0b7a5c;
--color-warning:       #c2740a;  --color-warning-bg: rgba(194,116,10,.13);
--color-warning-line:  rgba(194,116,10,.28);
--color-online:        #22c55e;
--color-prio-high:     #e5484d;  --color-prio-mid:   #e0a020;

/* 圆角 */
--radius-xs: 7px;  --radius-sm: 10px; --radius-md: 12px;
--radius-lg: 18px; --radius-xl: 24px; --radius-2xl: 30px;
--window-radius: 24px;   /* 唯一覆写：windows 0px（见 §1.2 的四点说明） */

/* 阴影 */
--shadow-xs: 0 1px 2px rgba(17,20,28,.04);
--shadow-sm: 0 2px 6px rgba(17,20,28,.05), 0 1px 2px rgba(17,20,28,.03);
--shadow-md: 0 8px 20px rgba(17,20,28,.07), 0 2px 5px rgba(17,20,28,.035);
--shadow-lg: 0 18px 40px rgba(17,20,28,.10), 0 4px 10px rgba(17,20,28,.04);
--shadow-xl: 0 32px 64px rgba(17,20,28,.14);

/* 字号 */ 9.5 / 10 / 10.5 / 11 / 11.5 / 12 / 12.5 / 13 / 13.5 / 14 / 14.5 /
           15 / 15.5 / 16 / 19 / 21 / 24 / 26 / 29 / 30  (px)

/* 动效 */
--ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
--animate-fade-up:    fadeUp10 .34s cubic-bezier(0,0,.2,1) both;
--animate-fade-up-sm: fadeUp8  .30s cubic-bezier(0,0,.2,1) both;
--animate-fade-up-lg: fadeUp14 .58s cubic-bezier(0,0,.2,1) both;
--animate-spin-fast:  spinnerRotate .65s linear infinite;
--animate-dot-pulse:  dotPulse 2.4s infinite;
--animate-badge-pulse:badgePulse 2s infinite;
```

</details>

## 附录 B · 环境光层的完整数值

<details>
<summary>展开（<code>.ambient__aurora</code> 的 8 层渐变）</summary>

```css
/* 顶部 7.2%（≈65px，即顶栏高度），全宽均匀 */
linear-gradient(180deg, rgba(124,58,237,.36) 0%, rgba(124,58,237,0) 7.2%),

/* 顶栏左端靛蓝：y 半径 10%（≈90px），压在顶栏高度内，与侧栏顶部同色 */
radial-gradient(30% 10% at 6% 0%, rgba(99,102,241,.46) 0%, rgba(99,102,241,0) 76%),

/* 左侧全高色带：侧栏的"料"。峰值 .52 → 13% 处 .3 → 21% 归零（硬约束） */
linear-gradient(96deg, rgba(99,102,241,.52) 0%, rgba(99,102,241,.3) 13%, rgba(99,102,241,0) 21%),

/* 右上紫，同时负责顶栏右端 */
radial-gradient(40% 24% at 101% -2%, rgba(124,58,237,.34) 0%, rgba(124,58,237,0) 74%),

/* 侧栏底部青绿：让纵向也有色相变化（上靛蓝 → 下青绿） */
radial-gradient(18% 40% at 7% 104%, rgba(15,157,118,.36) 0%, rgba(15,157,118,0) 74%),

/* 右下天蓝 */
radial-gradient(26% 32% at 100% 100%, rgba(14,165,233,.34) 0%, rgba(14,165,233,0) 72%),

/* 下中粉 */
radial-gradient(30% 34% at 54% 102%, rgba(236,72,153,.16) 0%, rgba(236,72,153,0) 76%),

/* 中央 6% 极淡紫：避免大面积空白发死 */
radial-gradient(72% 62% at 50% 42%, rgba(99,102,241,.06) 0%, rgba(99,102,241,0) 72%);
```

容器：`background-color: #e9edf6` / `background-size: 100vw 100vh` / `background-position: 50% 50%` /
`animation: auroraDrift 26s ease-in-out infinite alternate`（`translate3d(-2.2%,1.6%,0) scale(1.06)`）。

</details>
