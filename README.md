# Lucky-Y 客户端

生活 / 工作 / 学习三域一体的个人管理系统的桌面客户端。本工程是 `ui-design/v1.0` 三个静态原型的 React 落地，并用 Tauri v2 打包成 macOS 应用。

## 技术栈

| 层面 | 选型 |
| --- | --- |
| 框架 | React 19 + TypeScript |
| 构建 | Vite 8 |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite`，设计令牌走 `@theme`） |
| 路由 | react-router-dom 7（HashRouter） |
| 状态 | Zustand 5 |
| 数据获取 | TanStack Query 5 |
| 桌面外壳 | Tauri v2 |

包管理器统一为 **pnpm**（见 `packageManager` 字段）。

## 脚本

```bash
pnpm install          # 安装依赖
pnpm dev              # 前端开发服务器（127.0.0.1:1420）
pnpm typecheck        # tsc --noEmit
pnpm build            # 类型检查 + 产出 dist/
pnpm preview          # 预览构建产物

pnpm desktop:dev      # 起 Tauri 桌面窗口（内部会先跑 pnpm dev）
pnpm desktop:build    # 打包 macOS .app
pnpm desktop:icon     # 由 scripts/generate-app-icon.py 的产物重新生成图标集
```

`pnpm build` 的产物落在本工程内的 `dist/`，`base` 为相对路径，配合 HashRouter
既能被静态服务器托管、也能直接 `file://` 打开，还能被 Tauri 从归档里直接取。

## 目录结构

```
client/lucky/
├─ src/
│  ├─ pages/            LoginPage / ProjectsPage / ProjectDetailPage
│  ├─ components/
│  │  ├─ layout/        AppShell（含滚动容器与侧栏抽屉）/ Sidebar / Topbar / SearchField
│  │  ├─ projects/      统计面板 / 工具栏 / 卡片 / 表格 / 看板
│  │  ├─ detail/        Hero / 进度环 / 标签页 / 任务 / 里程碑 / 文档 / 动态 / 信息卡
│  │  ├─ ui/            Button / IconButton / Badge / Avatar / ProgressBar / Card / EmptyState / ToastHost
│  │  └─ icons/         IconSprite（图标精灵）+ Icon
│  ├─ stores/           ui（视图·筛选·排序·侧栏）/ auth（登录态，persist）/ toast
│  ├─ data/             projects（8 条演示数据）/ content-pool / derive（派生算法）/ meta（字典）
│  ├─ api/              projects（模拟异步，接 Rust 时只改这一层）
│  ├─ hooks/            use-projects（TanStack Query）/ use-debounced-value / use-document-title
│  ├─ lib/              query-client / filter-projects / cn
│  ├─ styles/index.css  设计令牌 → @theme，含 base 与极少量 components
│  └─ types/index.ts    领域模型（scope / status / priority 三处口径之一）
└─ src-tauri/           桌面薄壳：窗口、权限、命令注册；领域逻辑在 backend/lucky_y_server
```

## 与原型的关系

| 原型 | 路由 | 还原要点 |
| --- | --- | --- |
| `ui-design/v1.0/index.html` | `/login` | 左侧品牌面板（径向渐变 + 56px 网格蒙版）、六项 domain-grid、右侧表单、密码可见性、提交 loading 与延迟跳转、入场动画错位 |
| `ui-design/v1.0/projects.html` | `/projects` | 4 张统计卡、scope 筛选（带计数角标）、四种排序、卡片 / 表格 / 看板三视图、搜索（160ms 防抖 + ⌘K）、空态 |
| `ui-design/v1.0/project-detail.html` | `/projects/:id` | Hero + 进度环、5 个标签页、里程碑三态时间线、任务四态、文档索引、动态流、风险块、标签页切换滚顶 |

设计令牌（三域色、中性阶、圆角、阴影、间距、动效）在 `src/styles/index.css` 的 `@theme` 中与原型 `:root` 逐项对应；
原型 CSS 变量名中的 `--bg` / `--border` / `--border-strong` 分别落为 `--color-canvas` / `--color-line` / `--color-line-strong`，
取值不变。图标为原型 `<symbol>` 的逐条搬运，不引入图标库。

## 与原型的有意偏离

以下差异是**有意为之**，不是遗漏：

1. **登录页之外加了路由与登录保护**。原型是三份独立 HTML 互跳；这里用 HashRouter + `RequireAuth`，未登录访问 `/projects` 会回到登录页。
2. **数据层是模拟异步**（`src/api/projects.ts`，约 260ms 延迟），因此首屏有 loading 态——原型没有。接真实 `invoke` 时只改 `src/api/` 一层。
3. **卡片左侧 scope 色条、Hero 左侧色条用真实元素而非 `::after` / `::before` 伪元素**。几何、颜色、过渡与原型一致，仅 DOM 多一个节点。
4. **列表页表格行做了可达性加固**：行内项目名是真实 `<button>`，键盘可 Tab 可达并自带可访问名（原型行不可聚焦）。
5. **标签页补了 `role="tablist"` / `aria-selected`，提示补了 `role="status"`**，原型没有。
6. **`rounded-full` 用 Tailwind 默认值**（`calc(infinity * 1px)`）而非原型的 `999px`，本项目全部用例（22px 胶囊 / 7px 圆点）视觉等价。
7. **详情页搜索框也响应 ⌘K**（原型只有列表页有），因为两页共用同一个顶栏组件。

## 已知待办

- `src-tauri` 只注册了 `projects_list` 一个命令，前端尚未 `invoke`（仍走模拟数据）。
- `lucky_y_server::list_projects` 是占位数据，待接 rusqlite + pulldown-cmark 索引层。
- `src/types/index.ts` 的 `Project` 有 22 个字段，比后端 `model.rs` 多 11 个必填字段
  （`dueShort` / `dueLong` / `daysLeft` / `milestone` / `budget` / `visibility` / `repoUrl` / `docsUrl` / `risk` / `startDate` / `ownerId`），
  接真实数据时会出现"类型说有、运行时没有"的静默不一致，需要一并补齐或改为可选。
- 未配置 ESLint / Prettier / 测试工具链。
- `docs/模块设计.md` 把 scope 写成 `learning`，与代码及 `model.rs` 的 `learn` 不一致，待统一。
# lucky
