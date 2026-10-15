-- 工作模块专属表与视图。依赖 0001_init.sql。版本：2。
-- 专属表一律 work_ 前缀；统一层通过 scope='work' 或下面的 work_* 视图读取。

PRAGMA foreign_keys = ON;

-- ============================================================
-- 一 · 客户与联系人
-- ============================================================

CREATE TABLE work_contact (
  id            TEXT    PRIMARY KEY,
  owner_id      TEXT    NOT NULL REFERENCES app_user(id),
  name          TEXT    NOT NULL,
  org           TEXT    NOT NULL DEFAULT '',   -- 公司 / 组织；同名多人在 org 下分组
  role_code     TEXT    NOT NULL CHECK (role_code IN ('customer','colleague','partner')),
  title         TEXT    NOT NULL DEFAULT '',   -- 职务
  phone         TEXT,
  email         TEXT,
  wechat        TEXT,
  note          TEXT    NOT NULL DEFAULT '',   -- 脱敏备注
  last_touch_at TEXT,                          -- ISO 时刻；"上次联系 · 3 天前"是派生文案
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL,
  updated_at    TEXT    NOT NULL
);

-- ============================================================
-- 二 · 工作文档索引（跨项目；正文在外部工具）
-- ============================================================

-- 外部资源登记表，不是 Markdown 的索引：正文本就不在本系统，无法由文件重建。
-- kind = 它是什么；source_code = 它存在哪儿。两维不退化成同一个轴。
CREATE TABLE work_doc (
  id          TEXT    PRIMARY KEY,
  owner_id    TEXT    NOT NULL REFERENCES app_user(id),
  project_id  TEXT    REFERENCES project(id) ON DELETE SET NULL,  -- 可空：跨项目索引
  name        TEXT    NOT NULL,
  kind        TEXT    NOT NULL CHECK (kind IN ('plan','design','api','test','spec','research','ref')),
  source_code TEXT    NOT NULL CHECK (source_code IN ('company_wiki','yuque','git','deploy','external','meeting')),
  group_name  TEXT    NOT NULL DEFAULT '',     -- 该项目下的哪一类（核心方案 / 部署运维 …）
  url         TEXT,                             -- NULL = 没有可跳转地址
  summary     TEXT    NOT NULL DEFAULT '',     -- 脱敏摘要，不存正文
  author_id   TEXT    REFERENCES app_user(id),
  updated_at  TEXT    NOT NULL,                -- "是不是新文档""3 天前"都从它算
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- 文档间的有向引用；反链由查询反向扫出，不落第二份。
CREATE TABLE work_doc_link (
  from_doc_id TEXT NOT NULL REFERENCES work_doc(id) ON DELETE CASCADE,
  to_doc_id   TEXT NOT NULL REFERENCES work_doc(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL DEFAULT 'ref',
  PRIMARY KEY (from_doc_id, to_doc_id)
);

-- ============================================================
-- 三 · OKR / KPI
-- ============================================================

CREATE TABLE work_okr (
  id         TEXT    PRIMARY KEY,
  owner_id   TEXT    NOT NULL REFERENCES app_user(id),
  period     TEXT    NOT NULL,                 -- '2026-Q4'；不存"第四季度"这种中文
  objective  TEXT    NOT NULL,
  status     TEXT    NOT NULL CHECK (status IN ('planning','active','risk','done')),
  progress   INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

CREATE TABLE work_okr_kr (
  id          TEXT    PRIMARY KEY,
  okr_id      TEXT    NOT NULL REFERENCES work_okr(id) ON DELETE CASCADE,
  name        TEXT    NOT NULL,
  metric      TEXT    NOT NULL DEFAULT '',     -- 度量说明
  target_val  REAL,
  current_val REAL,
  unit        TEXT    NOT NULL DEFAULT '',
  confidence  TEXT    NOT NULL DEFAULT 'mid' CHECK (confidence IN ('high','mid','low')),
  sort_order  INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 四 · 工时
-- ============================================================

CREATE TABLE work_time_log (
  id         TEXT    PRIMARY KEY,
  owner_id   TEXT    NOT NULL REFERENCES app_user(id),
  project_id TEXT    REFERENCES project(id) ON DELETE SET NULL,
  task_id    TEXT    REFERENCES task(id)    ON DELETE SET NULL,  -- 可空：只挂项目、不指具体任务
  work_date  TEXT    NOT NULL,                 -- ISO 日期
  minutes    INTEGER NOT NULL CHECK (minutes > 0),
  note       TEXT    NOT NULL DEFAULT '',
  created_at TEXT    NOT NULL
);

-- ============================================================
-- 五 · 周报 / 复盘
-- ============================================================

CREATE TABLE work_weekly_report (
  id           TEXT PRIMARY KEY,
  owner_id     TEXT NOT NULL REFERENCES app_user(id),
  period_kind  TEXT NOT NULL CHECK (period_kind IN ('week','month')),
  period_key   TEXT NOT NULL,                  -- '2026-W42' / '2026-10'
  done_summary TEXT NOT NULL DEFAULT '',
  plan_summary TEXT NOT NULL DEFAULT '',
  blockers     TEXT NOT NULL DEFAULT '',
  status       TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (owner_id, period_kind, period_key)   -- 一人一周期一份
);

-- ============================================================
-- 六 · 会议
-- ============================================================

-- 纪要不存正文，指向 work_doc（同"正文留外部"的红线）。
CREATE TABLE work_meeting (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES app_user(id),
  title       TEXT NOT NULL,
  starts_at   TEXT NOT NULL,
  ends_at     TEXT,
  location    TEXT NOT NULL DEFAULT '',
  minutes_doc TEXT REFERENCES work_doc(id) ON DELETE SET NULL,
  status      TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','done','canceled')),
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

-- 参会人是多值，拆表，不塞进单值列。
CREATE TABLE work_meeting_attendee (
  meeting_id TEXT NOT NULL REFERENCES work_meeting(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES app_user(id),
  PRIMARY KEY (meeting_id, user_id)
);

-- ============================================================
-- 七 · 统一层的工作作用域视图
-- ============================================================

-- 让"工作模块的对象都以 work_ 打头"成立，而底层仍是唯一的 project / task 表。
-- 写操作落基表；视图只用于读。
CREATE VIEW work_project AS SELECT * FROM project WHERE scope = 'work';
CREATE VIEW work_task    AS SELECT * FROM task    WHERE scope = 'work';

-- ============================================================
-- 八 · 索引
-- ============================================================

CREATE INDEX ix_work_contact_role  ON work_contact(role_code, org);
CREATE INDEX ix_work_doc_project   ON work_doc(project_id, kind);
CREATE INDEX ix_work_doc_source    ON work_doc(source_code);
CREATE INDEX ix_work_doc_link_to   ON work_doc_link(to_doc_id);
CREATE INDEX ix_work_okr_period    ON work_okr(period, status);
CREATE INDEX ix_work_okr_kr_okr    ON work_okr_kr(okr_id, sort_order);
CREATE INDEX ix_work_time_project  ON work_time_log(project_id, work_date);
CREATE INDEX ix_work_time_owner    ON work_time_log(owner_id, work_date);
CREATE INDEX ix_work_report_period ON work_weekly_report(owner_id, period_kind, period_key);
CREATE INDEX ix_work_meeting_start ON work_meeting(starts_at);

PRAGMA user_version = 2;
