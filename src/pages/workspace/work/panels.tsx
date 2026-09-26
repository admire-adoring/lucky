/**
 * work 模块的**分区标记**（原来由 `design/gen-workspace-pages.mjs` 从
 * `design/work/work_index.html` 生成，那份生成链已退役 —— 这一份现在是
 * **手写维护**的：改它不必再跑脚本，但也没有门禁替你比对原型了）。
 *
 * 这里**只有标记**，没有行为：每个 onclick 都被翻译成 `handlers.xxx(...)`，
 * 实现写在手写的 <WorkWorkspace />（同目录）。
 *
 * ============================================================================
 * 2026-09-25 · 分区 12 → 7（用户定的口径）
 * ============================================================================
 *
 * 工作模块的侧栏不是普通列表，是**分区环**（`WorkspaceLayout` → `ShellSidebar`
 * → `RingNav`），环上的项数 = 本文件 `TABS` 的长度。所以这次收敛直接受益的是几何：
 * 相邻标签的中心距是 `2 · rl · sin(π/n)`（rl = 118px，见 RingNav 文件头），
 * n = 12 时只有 **61px**，标签被迫压到 `max-width: 58px` 才不叠字；
 * n = 7 时是 **102px**，标签能完整读出。**环的刻度不用动**。
 *
 * 并入关系（原 12 项 → 现 7 项，一个新分区都没造，全是合并）：
 *
 * | 现分区 | 标签 | 收了谁 |
 * | --- | --- | --- |
 * | `dashboard` | 工作台 | 原样（它本来就有「今日任务 / 今日会议」两块摘要）＋原 `calendar` 的「本周会议」 |
 * | `tasks` | 任务 | 原样 |
 * | `projects` | 项目 | 原样（手写组件 `ProjectShelf`） |
 * | `servers` | 服务器 | ＋原 `deploy` 的「部署记录」「部署文档」 |
 * | `docs` | 文档索引 | ＋「部署手册类」5 条（原 `deploy` 的文档列表） |
 * | `contacts` | 客户与联系人 | 原 `clients` ＋原 `contacts` |
 * | `review` | 复盘 | 原 `review` ＋原 `timesheet` ＋原 `okr` |
 *
 * ⚠️ 撤掉的 5 个 key（`deploy` / `calendar` / `clients` / `okr` / `timesheet`）
 * **没有留重定向**，这是有意的：`useModuleTab` 对未知 Tab 的纪律是
 * 「静默回落到首个 Tab」（见它的文件头 ②），于是老地址 `/work/deploy` 会稳稳
 * 落在工作台上、高亮也在工作台上 —— 不会白屏、也不会两边不一致。
 * 要留 301 得动 `useModuleTab`，而那是九个模块共用的，为一个模块的口径改它不划算。
 *
 * ⚠️ 以下分区**不在这里** —— 它们要状态或要按数据渲染，是手写组件：
 *      projects → src/components/workspace/work/ProjectShelf.tsx
 *      contacts → src/components/workspace/work/ClientsContacts.tsx（角色筛选）
 */

import { ToggleRow, TaskCheck, TaskText } from '../../../components/workspace/toggles'

import type { ModuleTab } from '../../../data/workspace/types'

/**
 * Tab 定义（键 + 标签）。标签同时是顶栏面包屑的尾段与环上那七个标签。
 *
 * 只有**第一个** Tab 用裸路径（`/work`）—— 这是 `useModuleTab` 的约定，
 * `tabPath` 按 `i === 0` 生成环上的地址，两处必须同一个算法。
 */
export const TABS: ModuleTab[] = [
  { key: 'dashboard', label: '工作台' },
  { key: 'tasks', label: '任务' },
  { key: 'projects', label: '项目' },
  { key: 'servers', label: '服务器' },
  { key: 'docs', label: '文档索引' },
  { key: 'contacts', label: '客户与联系人' },
  { key: 'review', label: '复盘' },
]

/** 本模块所有交互回调 —— 实现写在 <WorkWorkspace /> 里。 */
export interface Handlers {
  notice: (arg0: string) => void
  openClient: (arg0: string) => void
}

export const MODAL_SPECS = {
} as const

export type ModalKey = keyof typeof MODAL_SPECS

export function DashboardPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="card hero">
      <h1>下午好，杨刘 👋</h1>
      <p>今天是 2026-09-20 星期日，本周还有 1 天。</p>
      <div className="hero-meta">
      <span>今日任务：<strong>3 / 8</strong></span>
      <span>今日会议：<strong>2 场</strong></span>
      <span>进行项目：<strong>4 个</strong></span>
      <span>本周工时：<strong>32h</strong></span>
      </div>
      </section>
      <section className="grid-3">
      <div className="card">
      <div className="card-title">今日任务</div>
      <div className="stat">3 / 8</div>
      <div className="stat-desc">2 个高优先级 · 1 个逾期</div>
      <div className="progress-bar" style={{ marginTop: "8px" }}><div className="progress-fill" style={{ width: "38%" }}></div></div>
      </div>
      <div className="card">
      <div className="card-title">今日会议</div>
      <div className="stat">2</div>
      <div className="stat-desc">下一场 14:00 项目评审</div>
      <div className="progress-bar" style={{ marginTop: "8px" }}><div className="progress-fill" style={{ width: "40%" }}></div></div>
      </div>
      <div className="card">
      <div className="card-title">本周工时</div>
      <div className="stat">32h</div>
      <div className="stat-desc">目标 40h · 80%</div>
      <div className="progress-bar" style={{ marginTop: "8px" }}><div className="progress-fill" style={{ width: "80%" }}></div></div>
      </div>
      </section>
      <section className="grid-2">
      <div className="card">
      <div className="card-title">今日任务</div>
      <ToggleRow className="task-item">
      <div className="task-check done">✓</div>
      <TaskText>修复登录页样式</TaskText>
      <span className="task-tag">已完成</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <div className="task-check done">✓</div>
      <TaskText>代码评审</TaskText>
      <span className="task-tag">已完成</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <div className="task-check done">✓</div>
      <TaskText>写日报</TaskText>
      <span className="task-tag">已完成</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <TaskCheck />
      <TaskText>准备项目评审</TaskText>
      <span className="task-tag">进行中</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <TaskCheck />
      <TaskText>更新接口文档</TaskText>
      <span className="task-tag">待办</span>
      </ToggleRow>
      </div>
      <div className="card">
      <div className="card-title">今日会议</div>
      <div className="meeting-item">
      <div className="meeting-time">10:00</div>
      <div className="meeting-info">
      <div className="meeting-title">每日站会</div>
      <div className="meeting-meta">30 分钟 · 线上</div>
      </div>
      </div>
      <div className="meeting-item">
      <div className="meeting-time">14:00</div>
      <div className="meeting-info">
      <div className="meeting-title">项目评审</div>
      <div className="meeting-meta">60 分钟 · 会议室 A</div>
      </div>
      </div>
      </div>
      {/* 本周会议 —— 2026-09-25 从撤掉的 `calendar` 分区搬来。
          今日会议本来就在上面那张卡里，所以「工作台含今日会议」这条本来就成立；
          搬过来的是**它多出来的那一段**（本周其余三天），不搬就等于删功能。 */}
      <div className="card">
      <div className="card-title">本周会议</div>
      <div className="meeting-item">
      <div className="meeting-time">周一</div>
      <div className="meeting-info">
      <div className="meeting-title">周会</div>
      <div className="meeting-meta">60 分钟</div>
      </div>
      </div>
      <div className="meeting-item">
      <div className="meeting-time">周三</div>
      <div className="meeting-info">
      <div className="meeting-title">技术分享</div>
      <div className="meeting-meta">90 分钟</div>
      </div>
      </div>
      <div className="meeting-item">
      <div className="meeting-time">周五</div>
      <div className="meeting-info">
      <div className="meeting-title">项目复盘</div>
      <div className="meeting-meta">60 分钟</div>
      </div>
      </div>
      </div>
      </section>
      <section className="grid-2">
      <div className="card">
      <div className="card-title">进行中项目</div>
      <div className="doc-item">
      <div className="doc-icon">📦</div>
      <div className="doc-info">
      <div className="doc-name">支付系统重构</div>
      <div className="doc-meta">进度 62% · 截止 10-31</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">📦</div>
      <div className="doc-info">
      <div className="doc-name">用户中心改版</div>
      <div className="doc-meta">进度 38% · 截止 11-15</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">📦</div>
      <div className="doc-info">
      <div className="doc-name">数据看板</div>
      <div className="doc-meta">进度 80% · 截止 09-30</div>
      </div>
      </div>
      </div>
      <div className="card">
      <div className="card-title">最近文档</div>
      <div className="doc-item">
      <div className="doc-icon">📄</div>
      <div className="doc-info">
      <div className="doc-name">支付系统重构方案</div>
      <div className="doc-meta">更新于昨天</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">📘</div>
      <div className="doc-info">
      <div className="doc-name">接口设计规范</div>
      <div className="doc-meta">更新于 3 天前</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">📝</div>
      <div className="doc-info">
      <div className="doc-name">周会纪要 09-18</div>
      <div className="doc-meta">更新于 2 天前</div>
      </div>
      </div>
      </div>
      </section>
    </>
  )
}

export function TasksPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="card">
      <div className="card-title">工作任务</div>
      <ToggleRow className="task-item">
      <div className="task-check done">✓</div>
      <TaskText>修复登录页样式</TaskText>
      <span className="task-tag">已完成</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <div className="task-check done">✓</div>
      <TaskText>代码评审</TaskText>
      <span className="task-tag">已完成</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <TaskCheck />
      <TaskText>准备项目评审</TaskText>
      <span className="task-tag">进行中</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <TaskCheck />
      <TaskText>更新接口文档</TaskText>
      <span className="task-tag">待办</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <TaskCheck />
      <TaskText>优化首页加载速度</TaskText>
      <span className="task-tag">待办</span>
      </ToggleRow>
      <ToggleRow className="task-item">
      <TaskCheck />
      <TaskText>排查线上告警</TaskText>
      <span className="task-tag">待办</span>
      </ToggleRow>
      </section>
    </>
  )
}

export function ServersPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="grid-3">
      <div className="card">
      <div className="card-title">服务器总数</div>
      <div className="stat">8</div>
      <div className="stat-desc">生产 3 · 测试 3 · 预发 2</div>
      </div>
      <div className="card">
      <div className="card-title">运行中</div>
      <div className="stat" style={{ color: "#10B981" }}>7</div>
      <div className="stat-desc">1 台已停止</div>
      </div>
      <div className="card">
      <div className="card-title">即将到期</div>
      <div className="stat" style={{ color: "#F59E0B" }}>1</div>
      <div className="stat-desc">30 天内</div>
      </div>
      </section>
      <section className="card">
      <div className="card-title">生产环境</div>
      <div className="server-item">
      <div className="server-env">生产</div>
      <div className="server-info">
      <div className="server-name">prod-web-01</div>
      <div className="server-meta">47.100.x.x · 阿里云 · 4C8G · Ubuntu 22.04</div>
      </div>
      <span className="server-status">运行中</span>
      </div>
      <div className="server-item">
      <div className="server-env">生产</div>
      <div className="server-info">
      <div className="server-name">prod-db-01</div>
      <div className="server-meta">47.100.x.x · 阿里云 · 8C16G · Ubuntu 22.04</div>
      </div>
      <span className="server-status">运行中</span>
      </div>
      <div className="server-item">
      <div className="server-env">生产</div>
      <div className="server-info">
      <div className="server-name">prod-cache-01</div>
      <div className="server-meta">47.100.x.x · 阿里云 · 2C4G · Ubuntu 22.04</div>
      </div>
      <span className="server-status">运行中</span>
      </div>
      </section>
      <section className="card">
      <div className="card-title">测试环境</div>
      <div className="server-item">
      <div className="server-env">测试</div>
      <div className="server-info">
      <div className="server-name">test-web-01</div>
      <div className="server-meta">10.0.1.x · 内网 · 2C4G · Ubuntu 22.04</div>
      </div>
      <span className="server-status">运行中</span>
      </div>
      <div className="server-item">
      <div className="server-env">测试</div>
      <div className="server-info">
      <div className="server-name">test-db-01</div>
      <div className="server-meta">10.0.1.x · 内网 · 4C8G · Ubuntu 22.04</div>
      </div>
      <span className="server-status">运行中</span>
      </div>
      <div className="server-item">
      <div className="server-env">测试</div>
      <div className="server-info">
      <div className="server-name">test-job-01</div>
      <div className="server-meta">10.0.1.x · 内网 · 2C4G · Ubuntu 22.04</div>
      </div>
      <span className="server-status">已停止</span>
      </div>
      </section>
      {/* ↓ 2026-09-25 从撤掉的 `deploy` 分区整段搬来（用户口径：服务器并入部署记录、部署文档）。
          ⚠️ 顺序是刻意的：**清单 → 记录 → 文档 → 边界** —— 这一页的主语始终是「机器」，
             部署只是发生在机器上的事；把它插在服务器清单中间会让主语跳来跳去。 */}
      <section className="card">
      <div className="card-title">部署记录</div>
      <div className="timesheet-row">
      <span>2026-09-20 · v2.3.1</span>
      <span className="deploy-status success">成功</span>
      </div>
      <div className="timesheet-row">
      <span>2026-09-15 · v2.3.0</span>
      <span className="deploy-status success">成功</span>
      </div>
      <div className="timesheet-row">
      <span>2026-09-10 · v2.2.9</span>
      <span className="deploy-status rollback">回滚</span>
      </div>
      <div className="timesheet-row">
      <span>2026-09-05 · v2.2.8</span>
      <span className="deploy-status success">成功</span>
      </div>
      </section>
      <section className="card">
      <div className="card-title">部署文档</div>
      <div className="doc-item">
      <div className="doc-icon">🚀</div>
      <div className="doc-info">
      <div className="doc-name">生产环境部署手册</div>
      <div className="doc-meta">部署 · 生产 · v2.3 · 更新于昨天</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">🔙</div>
      <div className="doc-info">
      <div className="doc-name">回滚流程</div>
      <div className="doc-meta">回滚 · 生产 · v1.2 · 更新于 3 天前</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">⚙️</div>
      <div className="doc-info">
      <div className="doc-name">环境变量配置</div>
      <div className="doc-meta">配置 · 生产 · v1.0 · 更新于 1 周前</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">✅</div>
      <div className="doc-info">
      <div className="doc-name">发布检查清单</div>
      <div className="doc-meta">检查清单 · 生产 · v1.1 · 更新于 2 天前</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">📜</div>
      <div className="doc-info">
      <div className="doc-name">部署脚本 deploy.sh</div>
      <div className="doc-meta">脚本 · 生产 · v1.4 · 更新于 5 天前</div>
      </div>
      </div>
      </section>
      <section className="card">
      <div className="card-title" style={{ color: "var(--mw-m-main)" }}>安全与边界</div>
      <div className="notice">
      密码、密钥不存明文，只存引用；生产 IP 脱敏；敏感信息走公司密钥管理工具。
      </div>
      <div className="notice">
      部署文档正文留在公司 Wiki，个人系统只存索引、链接、脱敏摘要；服务器和部署按项目走。
      </div>
      </section>
    </>
  )
}

/* ----------------------------------------------------------------------------
   2026-09-25 移除的两个面板：`DeployPanel`（部署）与 `CalendarPanel`（日历会议）
   ----------------------------------------------------------------------------
   它们**不是被删掉**，是被搬进别的分区了，所以这里留一条指路，免得下次有人
   在原型里又看到 `data-panel="deploy"` 就把它当成"漏迁的分区"补回来：

     DeployPanel   → 部署记录 · 部署文档  → `ServersPanel`（服务器）
                     其中「部署手册类」5 条另在 `DocsPanel`（文档索引）里出现 ——
                     那是**用户要的两处**：一处是运维现场用的清单，一处是全站文档的可检索入口。
     CalendarPanel → 今日会议（原本就已在 `DashboardPanel` 里）＋ 本周会议 → `DashboardPanel`（工作台）

   撤掉的 key：`deploy` / `calendar` / `clients` / `okr` / `timesheet`（共 5 个，
   `TABS` 12 → 7）。老地址会静默落到工作台，判据见文件头。
   ---------------------------------------------------------------------------- */

export function DocsPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="card">
      <div className="card-title">文档索引</div>
      <div className="doc-item">
      <div className="doc-icon">📄</div>
      <div className="doc-info">
      <div className="doc-name">支付系统重构方案</div>
      <div className="doc-meta">Wiki · 更新于昨天</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">📘</div>
      <div className="doc-info">
      <div className="doc-name">接口设计规范</div>
      <div className="doc-meta">Wiki · 更新于 3 天前</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">📝</div>
      <div className="doc-info">
      <div className="doc-name">周会纪要 09-18</div>
      <div className="doc-meta">会议纪要 · 更新于 2 天前</div>
      </div>
      </div>
      {/* ↓ 部署手册类 —— 2026-09-25 吸收自撤掉的 `deploy` 分区。
          与 `ServersPanel` 里那份**不是重复登记**：那边是"运维现场要用的清单"，
          这边是"全站文档的可检索入口"（用户两条口径都写了）。
          排序沿用原 deploy 面板的顺序，元信息前缀保留 `部署` 这一档，便于一眼归堆。 */}
      <div className="doc-item">
      <div className="doc-icon">🚀</div>
      <div className="doc-info">
      <div className="doc-name">生产环境部署手册</div>
      <div className="doc-meta">部署 · 生产 · v2.3 · 更新于昨天</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">🔙</div>
      <div className="doc-info">
      <div className="doc-name">回滚流程</div>
      <div className="doc-meta">部署 · 生产 · v1.2 · 更新于 3 天前</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">⚙️</div>
      <div className="doc-info">
      <div className="doc-name">环境变量配置</div>
      <div className="doc-meta">部署 · 配置 · v1.0 · 更新于 1 周前</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">✅</div>
      <div className="doc-info">
      <div className="doc-name">发布检查清单</div>
      <div className="doc-meta">部署 · 检查清单 · v1.1 · 更新于 2 天前</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">📜</div>
      <div className="doc-info">
      <div className="doc-name">部署脚本 deploy.sh</div>
      <div className="doc-meta">部署 · 脚本 · v1.4 · 更新于 5 天前</div>
      </div>
      </div>
      <div className="doc-item">
      <div className="doc-icon">🔗</div>
      <div className="doc-info">
      <div className="doc-name">GitLab 仓库</div>
      <div className="doc-meta">外部链接</div>
      </div>
      </div>
      </section>
      <section className="card">
      <div className="card-title" style={{ color: "var(--mw-m-main)" }}>注意</div>
      <div className="notice">
      工作文档正文留在公司工具，个人系统只存索引、链接、脱敏摘要。
      </div>
      </section>
    </>
  )
}

/* ----------------------------------------------------------------------------
   2026-09-25 合并掉的两个面板：`ContactsPanel`（联系人）与 `ClientsPanel`（客户资料）
   ----------------------------------------------------------------------------
   合并成「客户与联系人」= `contacts`，但**没有留在本文件** —— 它要一个角色筛选，
   而筛选是状态（`useState`），静态标记表达不了。按 `ProjectShelf` 的同一条判据
   （"要状态或要按数据渲染 ⇒ 手写组件"）移到：

     src/components/workspace/work/ClientsContacts.tsx

   内容一个都没丢：客户资料库 4 张卡（`handlers.openClient` 原样）、最近资料 4 条、
   客户统计 3 格、联系人 4 位 —— 全在那份手写组件里，只是排布重新组织过。
   ---------------------------------------------------------------------------- */


/**
 * 复盘 —— 工作模块的「复盘」分区（`/work/review`）。
 *
 * 2026-09-25 由三个分区合并而来：`review`（周报复盘）＋ `timesheet`（工时）＋ `okr`（OKR/KPI）。
 *
 * 排布口径：**先量后述**。工时与 OKR 都是可核对的数字，放前面；文字复盘是主观归纳，
 * 放最后。顺序反过来读的人会先读到一段散文，再回头找它对应的数字 —— 那一找就散了。
 *
 * ⚠️ 三块的内容是**原样搬来的**，一个数字都没改（包括「目标 40h / 本周 32h」这类
 *    对不上的地方 —— 那是原设计样本的口径，不是这次合并要解决的问题）。
 * ⚠️ 唯一新增的标记是「文字复盘」那行 `card-title`：原来它是页面里唯一的卡片，
 *    没有标题也不突兀；现在一页四张卡，只有它没标题就会显得是块漏了头的残留。
 */
export function ReviewPanel({ handlers: _handlers }: { handlers: Handlers }) {
  return (
    <>
      <section className="grid-3">
      <div className="card">
      <div className="card-title">本周工时</div>
      <div className="stat">32h</div>
      <div className="stat-desc">目标 40h</div>
      </div>
      <div className="card">
      <div className="card-title">本月工时</div>
      <div className="stat">142h</div>
      <div className="stat-desc">平均 8h / 天</div>
      </div>
      <div className="card">
      <div className="card-title">加班</div>
      <div className="stat">6h</div>
      <div className="stat-desc">本月</div>
      </div>
      </section>
      <section className="card">
      <div className="card-title">2026 Q3 OKR</div>
      <div className="okr-item">
      <div className="okr-title">O1：提升系统稳定性</div>
      <div className="okr-desc">KR1：线上故障数下降 50%</div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: "70%" }}></div></div>
      <div className="progress-label"><span>70%</span><span>目标 50% 下降</span></div>
      </div>
      <div className="okr-item">
      <div className="okr-title">O2：交付支付系统重构</div>
      <div className="okr-desc">KR1：完成核心链路重构</div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: "62%" }}></div></div>
      <div className="progress-label"><span>62%</span><span>截止 10-31</span></div>
      </div>
      <div className="okr-item">
      <div className="okr-title">O3：提升团队效率</div>
      <div className="okr-desc">KR1：CI 构建时间缩短 40%</div>
      <div className="progress-bar"><div className="progress-fill" style={{ width: "45%" }}></div></div>
      <div className="progress-label"><span>45%</span><span>目标 40% 缩短</span></div>
      </div>
      </section>
      <section className="card">
      <div className="card-title">本周工时明细</div>
      <div className="timesheet-row">
      <span>支付系统重构</span>
      <span className="timesheet-value">14h</span>
      </div>
      <div className="timesheet-row">
      <span>用户中心改版</span>
      <span className="timesheet-value">8h</span>
      </div>
      <div className="timesheet-row">
      <span>数据看板</span>
      <span className="timesheet-value">5h</span>
      </div>
      <div className="timesheet-row">
      <span>会议</span>
      <span className="timesheet-value">3h</span>
      </div>
      <div className="timesheet-row">
      <span>代码评审</span>
      <span className="timesheet-value">2h</span>
      </div>
      </section>
      <section className="card">
      <div className="card-title">文字复盘</div>
      <div className="review-block">
      <div className="review-label">本周完成</div>
      <ul className="review-list">
      <li>完成支付系统重构方案评审</li>
      <li>修复登录页样式问题</li>
      <li>完成 3 次代码评审</li>
      <li>更新接口设计规范</li>
      </ul>
      </div>
      <div className="review-block">
      <div className="review-label">下周计划</div>
      <ul className="review-list">
      <li>支付系统核心链路重构</li>
      <li>用户中心改版接口联调</li>
      <li>数据看板验收</li>
      </ul>
      </div>
      <div className="review-block">
      <div className="review-label">问题与阻塞</div>
      <ul className="review-list">
      <li>支付系统依赖第三方接口，联调延迟</li>
      <li>用户中心改版需求有变更</li>
      </ul>
      </div>
      <div className="review-block">
      <div className="review-label">经验沉淀</div>
      <ul className="review-list">
      <li>重构前先做接口梳理，减少返工</li>
      <li>代码评审提前介入，效果更好</li>
      </ul>
      </div>
      </section>
    </>
  )
}

/**
 * 顶栏动作区 —— 原型的 `.topbar-actions` 里的按钮。
 *
 * 为什么要生成：这排按钮**每个模块都不一样**（任务页是「AI 拆解 / 新建任务」，
 * 生活页是「快速记录」，设置页一个都没有）。只把它们交给外壳会全丢掉 ——
 * 而且丢得没有声响：外壳照常渲染，只是那排主入口不存在了。
 * 主题开关已从这里剔掉（外壳自己提供一份，全站只能有一个主题开关）。
 */
export function TopbarActions({ handlers }: { handlers: Handlers }) {
  return (
    <>
      <button className="btn btn-ghost" id="quickAdd" onClick={() => handlers.notice('原型演示：快速记录')}>+ 快速记录</button>
    </>
  )
}
