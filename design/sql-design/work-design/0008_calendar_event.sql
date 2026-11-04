-- ============================================================
-- 0008 · 日历事件（calendar_event）
-- ============================================================
-- 日程模块的唯一表：月/周/日/议程四个视图都是这张表的不同 GROUP BY。
-- 不分"全天事件"和"时段事件"两张表 —— all_day 标志位区分，查询时一条 SQL 搞定。
CREATE TABLE calendar_event (
  id          TEXT    PRIMARY KEY,
  title       TEXT    NOT NULL,
  detail      TEXT    NOT NULL DEFAULT '',
  -- ISO-8601：all_day=1 时只取日期部分（YYYY-MM-DD），否则带时间
  start_at    TEXT    NOT NULL,
  end_at      TEXT    NOT NULL,
  all_day     INTEGER NOT NULL DEFAULT 0 CHECK (all_day IN (0, 1)),
  location    TEXT    NOT NULL DEFAULT '',
  -- 前端色板Key：blue/green/amber/rose/violet/teal，与原型色团对齐
  color       TEXT    NOT NULL DEFAULT 'blue',
  -- 来源域：life/work/learn/global，用于按域筛选
  scope       TEXT    NOT NULL DEFAULT 'global' CHECK (scope IN ('life','work','learn','global')),
  project_id  TEXT    REFERENCES project(id) ON DELETE SET NULL,
  owner_id    TEXT    REFERENCES app_user(id),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE INDEX ix_event_start ON calendar_event(start_at);
CREATE INDEX ix_event_scope ON calendar_event(scope, start_at);
