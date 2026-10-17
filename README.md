# Lucky-Y

生活 / 工作 / 学习三域一体的个人管理系统，Tauri v2 桌面应用。本工程采用 **Tauri 官方布局**：前端与 Rust 同住一个工程，壳在 `src-tauri/`，业务在 `src-tauri/src/server/`。由 `lucky-y` 迁移而来（2026-10-15），原目录保留未动。

## 目录结构

```text
lucky-jarvise/
├─ package.json            一份管两层：前端依赖 + @tauri-apps/api + @tauri-apps/cli
├─ config.toml             应用配置：数据库路径 · 日志级别与输出文件（缺失时用内置默认值）
├─ index.html · vite.config.ts · tsconfig.json
├─ src/                    React 19 前端
│  ├─ api/                 数据访问层（invoke 只出现在这里）
│  ├─ hooks/               TanStack Query；组件只读这里
│  ├─ pages/  components/  九域工作区与整窗页
│  ├─ stores/  data/  lib/  styles/  types/
├─ src-tauri/              Rust 侧（普通 Cargo crate + tauri-build）
│  ├─ tauri.conf.json      frontendDist: ../dist；beforeDevCommand: pnpm dev
│  ├─ Cargo.toml           tauri + rusqlite(bundled) + serde
│  ├─ src/main.rs          桌面入口（6 行，调 lucky_lib::run()，不改它）
│  ├─ src/lib.rs           命令层：setup 建 Store + 17 条命令转发 + ApiError
│  └─ src/server/          领域层（原独立 crate lucky_y_server 并入）
│     ├─ mod.rs store.rs error.rs db.rs
│     └─ srv/              服务器台账域：mod.rs（门面）· model.rs · repo.rs
├─ docs/                   设计验收记录与令牌一致性核对
├─ db/                     运行时数据库（lucky-y.sqlite3，gitignore，应用启动自动建）
├─ documents/              文档正文（<项目id>/<文件名>.md；库只存索引与文件坐标）
└─ design/
   ├─ architecture-design/ 架构设计：后台架构设计 · 后台架构图 · 模块设计 · 技术选型
   ├─ sql-design/          DDL 单一事实源（db.rs 用 include_str! 编译期引入，删改会断编译）
   ├─ ui-design/           v1.0 初版三页原型
   └─ prototypes/          活跃原型库与设计令牌（design-tokens/design-tokens.md）
```

## 快速开始

```bash
pnpm install          # 安装依赖
pnpm dev              # 前端开发服务器（127.0.0.1:1420，浏览器可看 UI）
pnpm build            # tsc --noEmit + vite build
pnpm desktop:dev      # Tauri 桌面窗口（内部先起 pnpm dev）
pnpm desktop:build    # 打包 macOS .app

cd src-tauri && cargo check    # 只验证 Rust 侧
```

## 关键约定

- **命令体 ≤3 行**（取 state / 调领域层 / 转错误），业务判断不进命令层。
- **领域层目录不 import tauri**：`grep -r "use tauri" src-tauri/src/server/` 必须为 0；将来加 HTTP 入口时把该目录拆回独立 crate，代码零改动。
- **rusqlite 只出现在 `src-tauri/src/server/` 内**，不外溢到命令层。
- **组件不 invoke**：`invoke(` 只出现在 `src/api/`，组件只 import hooks。
- **DDL 唯一事实源在 `design/sql-design/`**：`0001`→`0003` 按 `PRAGMA user_version` 顺序执行，已发布的文件不改；`db.rs` 的 `include_str!` 路径是编译期契约。
- **错误协议**：领域层 `Error::code()`（db / io / notFound / conflict / invalid）经壳层 `ApiError { code, message }` 序列化，TS 侧 `src/api/error.ts` 换回 `ApiError`，页面按 code 分支。
- **业务键优先于主键**：服务器用 `host`（路由 `/work/servers/:host`），id 由写入方生成。
- 迁移与建表判据见 `design/sql-design/全局架构.md`，分层与契约见 `docs/后台架构设计.md`。
