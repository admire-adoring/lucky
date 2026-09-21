
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

| 令牌 | 亮色 | 暗色 | 用途 |
|---|---|---|---|
| `--bg-page` | `#FAFBFC` | `#0F172A` | 页面背景 |
| `--bg-card` | `rgba(255,255,255,0.62)` | `rgba(30,41,59,0.55)` | 卡片背景 |
| `--bg-sidebar` | `rgba(255,255,255,0.66)` | `rgba(15,23,42,0.7)` | 侧边栏 |
| `--bg-topbar` | `rgba(255,255,255,0.66)` | `rgba(15,23,42,0.7)` | 顶部栏 |
| `--border-card` | `rgba(255,255,255,0.7)` | `rgba(255,255,255,0.08)` | 卡片边框 |
| `--border-subtle` | `rgba(15,23,42,0.06)` | `rgba(255,255,255,0.06)` | 分割线 |
| `--text-primary` | `#1E293B` | `#E2E8F0` | 主文字 |
| `--text-secondary` | `#64748B` | `#94A3B8` | 次文字 |
| `--text-muted` | `#94A3B8` | `#64748B` | 弱文字 |

### 4. 状态色

| 状态 | 亮色 | 暗色 |
|---|---|---|
| 成功 | `#10B981` | `#34D399` |
| 警告 | `#F59E0B` | `#FBBF24` |
| 错误 | `#EF4444` | `#F87171` |
| 信息 | `#3B82F6` | `#60A5FA` |
| 中性 | `#64748B` | `#94A3B8` |

### 5. AI 色

| 令牌 | 值 |
|---|---|
| AI 渐变 | `linear-gradient(135deg, #6366F1, #8B5CF6, #A855F7)` |
| AI 暗色渐变 | `linear-gradient(135deg, #818CF8, #A78BFA, #C084FC)` |
| AI 图标 | `#8B5CF6` |
| AI 边框 | `rgba(139,92,246,0.3)` |

## 二、渐变令牌

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

| 令牌 | 亮色 | 暗色 |
|---|---|---|
| `--blur-card` | `blur(24px) saturate(160%)` | `blur(28px) saturate(140%)` |
| `--blob-opacity` | `0.38` | `0.26` |
| `--blob-blur` | `110px` | `130px` |
| 色团尺寸 | 520 / 480 / 560px | 同 |
| 色团数量 | 每模块 3 个 | 同 |
| 漂移动画 | `22s ease-in-out infinite alternate` | 同 |
| 卡片圆角 | `20px` | 同 |
| 卡片阴影 | `0 4px 24px rgba(15,23,42,0.06)` | `0 4px 24px rgba(0,0,0,0.3)` |
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
  --bg-page: #FAFBFC;
  --bg-card: rgba(255,255,255,0.62);
  --bg-sidebar: rgba(255,255,255,0.66);
  --bg-topbar: rgba(255,255,255,0.66);
  --border-card: rgba(255,255,255,0.7);
  --border-subtle: rgba(15,23,42,0.06);
  --text-primary: #1E293B;
  --text-secondary: #64748B;
  --text-muted: #94A3B8;

  /* 阴影 */
  --shadow-card: 0 4px 24px rgba(15,23,42,0.06);
  --shadow-card-hover: 0 8px 32px rgba(15,23,42,0.10);

  /* 毛玻璃 */
  --blur-card: blur(24px) saturate(160%);
  --blob-opacity: 0.38;
  --blob-blur: 110px;

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
  --bg-page: #0F172A;
  --bg-card: rgba(30,41,59,0.55);
  --bg-sidebar: rgba(15,23,42,0.7);
  --bg-topbar: rgba(15,23,42,0.7);
  --border-card: rgba(255,255,255,0.08);
  --border-subtle: rgba(255,255,255,0.06);
  --text-primary: #E2E8F0;
  --text-secondary: #94A3B8;
  --text-muted: #64748B;
  --shadow-card: 0 4px 24px rgba(0,0,0,0.3);
  --shadow-card-hover: 0 8px 32px rgba(0,0,0,0.4);
  --blur-card: blur(28px) saturate(140%);
  --blob-opacity: 0.26;
  --blob-blur: 130px;

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