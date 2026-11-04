-- ============================================================
-- 0006 · 项目问题清单（project_bug）
-- ============================================================
-- 项目详情「Bug」分区与概览卡的那两条。此前是 `buildBugs()` 派生（条数按"有没有风险"编的），
-- 现在落库：一条问题有提出人、发现时间、严重度、修复状态与版本。
--
-- 与 `project_risk` 的分工：**风险是"可能出事"，Bug 是"已经出事"**。
--   风险没有严重度与版本（它还没发生），Bug 有（它发生在某个版本上）。
--   `state` 与 `status` 也是两套词表，不合并。
CREATE TABLE project_bug (
  id          TEXT    PRIMARY KEY,
  project_id  TEXT    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  title       TEXT    NOT NULL,
  -- 严重度：阻断 / 严重 / 一般（与前端 `BugItem.level` 同集合）
  level       TEXT    NOT NULL CHECK (level IN ('critical', 'major', 'minor')),
  -- 修复状态：待修 / 修复中 / 已修复
  status      TEXT    NOT NULL CHECK (status IN ('open', 'fixing', 'fixed')),
  -- 出现在哪个版本（可空：有些问题没有版本概念）
  version     TEXT    NOT NULL DEFAULT '',
  reporter_id TEXT    REFERENCES app_user(id),
  found_at    TEXT    NOT NULL,
  detail      TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL
);

CREATE INDEX ix_bug_project ON project_bug(project_id, status, level);
