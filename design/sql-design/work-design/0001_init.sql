-- Lucky-Y 数据库初始层：主数据 + 项目族 + 任务。
-- 归属：项目族（project_*）是执行层「项目」模块（/projects）的表；
--   task 是全局层「任务清单」（/tasks）的表。
-- 存储：两者都跨域共用一张表、用 scope 隔离 —— 生活 / 工作 / 学习页只是**引用**
--   同一个项目模块（各自 WHERE scope=…），不是各有一套表。
-- 约定见 ../全局架构.md：主键 TEXT、时间列 ISO-8601 文本、枚举用 CHECK、中文标签不入库。

PRAGMA foreign_keys = ON;

-- ============================================================
-- 一 · 主数据
-- ============================================================

-- 被项目 / 任务 / 文档 / 动态多方引用的唯一主数据。
CREATE TABLE app_user (
  id           TEXT PRIMARY KEY,          -- 'me' / 'u_zq'
  code         TEXT NOT NULL UNIQUE,      -- 'LY' / 'ZQ'，前端头像上那两个字母
  display_name TEXT NOT NULL,             -- 中文名；名单不全要在数据里补，不在代码里拼
  created_at   TEXT NOT NULL
);

-- 名单种子：表里没有行时，`project_member` / `task.owner_code` 的写入会直接失败
--   （外键指向不存在的用户），而"谁是谁"是数据不是代码。
--   LY 见前端 `OWNER_NAMES`；ZQ / HM 见账户页出现过的 `rotatedBy`；WQ 按拼音推，待核。
INSERT OR IGNORE INTO app_user (id, code, display_name, created_at) VALUES
  ('me',   'LY', '刘阳', strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  ('u_wq', 'WQ', '王琪', strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  ('u_zq', 'ZQ', '张琪', strftime('%Y-%m-%dT%H:%M:%SZ','now')),
  ('u_hm', 'HM', '何敏', strftime('%Y-%m-%dT%H:%M:%SZ','now'));

-- ============================================================
-- 二 · 统一执行层：项目
-- ============================================================

-- 三域（生活 / 工作 / 学习）共用一张表，用 scope 隔离。
-- 工作页、项目页、学习区的项目都是它的不同 WHERE，不是三张表。
CREATE TABLE project (
  id                TEXT    PRIMARY KEY,
  owner_id          TEXT    NOT NULL REFERENCES app_user(id),
  scope             TEXT    NOT NULL CHECK (scope IN ('life','work','learn')),
  name              TEXT    NOT NULL,
  description       TEXT    NOT NULL DEFAULT '',
  status            TEXT    NOT NULL CHECK (status IN ('planning','active','risk','done','archived')),
  priority          TEXT    NOT NULL CHECK (priority IN ('high','mid','low')),
  progress          INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  current_milestone TEXT    NOT NULL DEFAULT '',
  start_date        TEXT    NOT NULL,          -- ISO
  due_date          TEXT    NOT NULL,          -- ISO
  budget_cents      INTEGER CHECK (budget_cents IS NULL OR budget_cents >= 0),
  visibility        TEXT    NOT NULL,
  repo_url          TEXT,                      -- NULL = 没有仓库
  docs_ref          TEXT,                      -- 资料的显示名，不是 URL
  path              TEXT,                      -- 本地目录；NULL = 没有目录可指（「团队 OKR」这种）
  sort_order        INTEGER NOT NULL DEFAULT 0,-- 'default' 排序需要一个稳定列
  created_at        TEXT    NOT NULL,
  updated_at        TEXT    NOT NULL,

  -- scope × visibility：允许集合由域决定，一行写完，不用触发器
  CHECK (
    (scope = 'life'  AND visibility IN ('private','family')) OR
    (scope = 'work'  AND visibility IN ('work_internal','confidential')) OR
    (scope = 'learn' AND visibility IN ('private','public'))
  )
);

CREATE TABLE project_member (
  project_id TEXT    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  user_id    TEXT    NOT NULL REFERENCES app_user(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (project_id, user_id)
);

CREATE TABLE tag (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL UNIQUE               -- 用户随手写的短词，无层级、无颜色
);

CREATE TABLE project_tag (
  project_id TEXT    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES tag(id)     ON DELETE CASCADE,
  PRIMARY KEY (project_id, tag_id)
);
CREATE INDEX ix_project_tag_tag ON project_tag(tag_id);   -- 搜索项 haystack 含 tags，需按标签反查

-- ============================================================
-- 三 · 统一执行层：任务
-- ============================================================

-- 三域共用一张表。"某项目的任务" = project_id 指向它的那些行。
-- scope 与 project_id 的一致性由写入路径保证：挂项目时 scope 同步为项目的 scope。
CREATE TABLE task (
  id              TEXT    PRIMARY KEY,
  scope           TEXT    NOT NULL CHECK (scope IN ('life','work','learn')),
  project_id      TEXT    REFERENCES project(id) ON DELETE SET NULL,
  owner_code      TEXT    REFERENCES app_user(code),  -- 负责人码；前端出参就是 'LY' 这种
  title           TEXT    NOT NULL,
  state           TEXT    NOT NULL CHECK (state IN ('todo','doing','blocked','done')),
  priority        TEXT    NOT NULL CHECK (priority IN ('high','mid','low')),
  due_at          TEXT,                                -- ISO；NULL = 没定截止
  scheduled_start TEXT,                                -- 排期落点，时间轴用它定位
  estimate_min    INTEGER CHECK (estimate_min IS NULL OR estimate_min > 0),
  completed_at    TEXT,
  source_kind     TEXT    CHECK (source_kind IS NULL OR source_kind IN ('todo','idea','ref')),
  inbox_at        TEXT,                                -- 进收件箱的时刻，算"停留超过 N 天"
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT    NOT NULL,
  updated_at      TEXT    NOT NULL,

  -- 有排期就必须有预估时长，否则时间轴算不出块高
  CHECK (scheduled_start IS NULL OR estimate_min IS NOT NULL)
);

-- ============================================================
-- 四 · 项目的卫星表（1:N）
-- ============================================================

CREATE TABLE project_milestone (
  id         TEXT    PRIMARY KEY,
  project_id TEXT    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  state      TEXT    NOT NULL CHECK (state IN ('done','now','todo')),
  due_date   TEXT,
  detail     TEXT    NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0
);
-- 一个项目至多一条"当前阶段"
CREATE UNIQUE INDEX ux_milestone_now ON project_milestone(project_id) WHERE state = 'now';

-- 项目内的文档索引。正文分两类存法（见 ../全局架构.md §三）：
--   · source='local_md'：正文是本地 .md 文件（`documents/<projectId>/<文件名>`），
--     库只存索引 + 文件坐标（file_path / content_hash / synced_at），文件是正文的源；
--   · 其余三类（腾讯文档 / 语雀 / Git）：正文留在原工具，这里只有索引与链接。
-- module / func 是筛选栏「模块 → 功能」两层的分组键（自由文本，不是枚举）。
CREATE TABLE project_document (
  id           TEXT    PRIMARY KEY,
  project_id   TEXT    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name         TEXT    NOT NULL,
  module       TEXT    NOT NULL DEFAULT '',
  func         TEXT    NOT NULL DEFAULT '',
  kind         TEXT    NOT NULL CHECK (kind IN ('plan','design','api','test','spec','research','ref')),
  source       TEXT    NOT NULL CHECK (source IN ('local_md','tencent_doc','yuque','git')),
  file_path    TEXT,                 -- 相对 documents/ 根；NULL = 无本地正文
  content_hash TEXT,                 -- 正文 sha256 前 16 位；与文件比对判"外部改过"
  synced_at    TEXT,                 -- 上次与文件同步的时刻
  summary      TEXT    NOT NULL DEFAULT '',
  author_id    TEXT    REFERENCES app_user(id),
  updated_at   TEXT    NOT NULL,
  sort_order   INTEGER NOT NULL DEFAULT 0,

  -- local_md 必须有文件坐标；外部登记的那三类则没有
  CHECK (source <> 'local_md' OR file_path IS NOT NULL)
);

-- 文档关联（有向边）。反链由查询反向扫出，不落第二份（同 work_doc_link 的口径）。
-- kind 与 to_kind 一一对应（out→task、risk→bug、meet→meeting、bind/ref→doc），
--   一致性由写入路径保证；两列都留是为了两个方向都好查。
-- to_kind 四族一次写全：目标表还没落的（bug）由写入路径拦住，将来落表不必改 CHECK。
-- to_id 不挂外键：它可能指向 task / work_meeting 这些别的表（SQLite 不能按行外键）。
CREATE TABLE project_document_link (
  from_doc_id TEXT NOT NULL REFERENCES project_document(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL CHECK (kind IN ('out','risk','meet','bind','ref')),
  to_kind     TEXT NOT NULL CHECK (to_kind IN ('task','doc','bug','meeting')),
  to_id       TEXT NOT NULL,
  PRIMARY KEY (from_doc_id, to_kind, to_id)
);

-- 类型里是单值，建成 1:N：单值是"当前最该看的那条"这个视图，不是表结构。
CREATE TABLE project_risk (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  opened_at   TEXT NOT NULL,
  closed_at   TEXT                       -- NULL = 未关闭
);

CREATE TABLE project_activity (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  actor_id   TEXT REFERENCES app_user(id),
  action     TEXT NOT NULL,
  at         TEXT NOT NULL
);

-- ============================================================
-- 五 · 索引（每条对应一条真实查询）
-- ============================================================

CREATE INDEX ix_project_scope_status   ON project(scope, status);
CREATE INDEX ix_project_scope_due      ON project(scope, due_date);
CREATE INDEX ix_project_scope_progress ON project(scope, progress DESC);
CREATE INDEX ix_project_owner          ON project(owner_id);

CREATE INDEX ix_task_project       ON task(project_id, state);
CREATE INDEX ix_task_scope_due     ON task(scope, due_at);
CREATE INDEX ix_task_scope_state   ON task(scope, state);

CREATE INDEX ix_milestone_project  ON project_milestone(project_id, sort_order);
CREATE INDEX ix_document_project   ON project_document(project_id, kind);
CREATE INDEX ix_document_link_to   ON project_document_link(to_kind, to_id);  -- 反链：谁指向它
CREATE INDEX ix_activity_project   ON project_activity(project_id, at DESC);
CREATE INDEX ix_risk_project       ON project_risk(project_id, closed_at, opened_at);

-- ============================================================
-- 六 · 视图
-- ============================================================

-- 列表页读数：任务计数不落冗余列，用视图现算（D1）。
CREATE VIEW v_project_list AS
SELECT p.*,
       (SELECT COUNT(*) FROM task t WHERE t.project_id = p.id) AS tasks_total,
       (SELECT COUNT(*) FROM task t WHERE t.project_id = p.id AND t.state = 'done') AS tasks_done
FROM project p;

PRAGMA user_version = 1;
