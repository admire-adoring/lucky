-- Lucky-Y 数据库初始层：主数据 + 统一执行层。
-- 跨模块共用；工作模块是其第一个消费者。版本：1。
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

-- 项目内的文档索引；正文不入库（红线：只存索引、链接、脱敏摘要）。
CREATE TABLE project_document (
  id         TEXT    PRIMARY KEY,
  project_id TEXT    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  kind       TEXT    NOT NULL CHECK (kind IN ('plan','design','api','test','spec','research','ref')),
  source     TEXT    NOT NULL CHECK (source IN ('tencent_doc','yuque','git','local_md')),
  summary    TEXT    NOT NULL DEFAULT '',
  author_id  TEXT    REFERENCES app_user(id),
  updated_at TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
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
