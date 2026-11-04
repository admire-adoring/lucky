-- ============================================================
-- 0010 · 生活域（习惯/财务/运动/食谱/宠物/日记）
-- ============================================================
-- 生活域 7 个子模块各一张表，互不引用 —— 它们是并列的个人记录，不是层级关系。
-- 习惯打卡单独一张 log 表（habit 是定义、log 是每日打卡记录）。

-- 习惯定义：每天/每周要打卡的事
CREATE TABLE life_habit (
  id            TEXT    PRIMARY KEY,
  name          TEXT    NOT NULL,
  icon          TEXT    NOT NULL DEFAULT '',
  color         TEXT    NOT NULL DEFAULT 'blue',
  -- 每周目标次数
  target_per_week INTEGER NOT NULL DEFAULT 7 CHECK (target_per_week BETWEEN 1 AND 7),
  enabled       INTEGER NOT NULL DEFAULT 1 CHECK (enabled IN (0, 1)),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL
);

-- 习惯每日打卡
CREATE TABLE life_habit_log (
  id          TEXT    PRIMARY KEY,
  habit_id    TEXT    NOT NULL REFERENCES life_habit(id) ON DELETE CASCADE,
  -- YYYY-MM-DD
  log_date    TEXT    NOT NULL,
  done        INTEGER NOT NULL DEFAULT 1 CHECK (done IN (0, 1)),
  UNIQUE (habit_id, log_date)
);

CREATE INDEX ix_habit_log_date ON life_habit_log(log_date);

-- 财务记录：收入/支出
CREATE TABLE life_finance (
  id          TEXT    PRIMARY KEY,
  -- income/expense
  kind        TEXT    NOT NULL CHECK (kind IN ('income', 'expense')),
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  category    TEXT    NOT NULL DEFAULT '',
  note        TEXT    NOT NULL DEFAULT '',
  -- YYYY-MM-DD
  log_date    TEXT    NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);

CREATE INDEX ix_finance_date ON life_finance(log_date);

-- 运动记录
CREATE TABLE life_workout (
  id            TEXT    PRIMARY KEY,
  -- run/cycle/swim/strength/yoga/other
  kind          TEXT    NOT NULL DEFAULT 'run',
  duration_min  INTEGER NOT NULL DEFAULT 0,
  distance_km   REAL    NOT NULL DEFAULT 0,
  calories      INTEGER NOT NULL DEFAULT 0,
  note          TEXT    NOT NULL DEFAULT '',
  -- YYYY-MM-DD
  log_date      TEXT    NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL
);

CREATE INDEX ix_workout_date ON life_workout(log_date);

-- 食谱
CREATE TABLE life_recipe (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  ingredients TEXT    NOT NULL DEFAULT '',
  steps       TEXT    NOT NULL DEFAULT '',
  tags        TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);

-- 宠物
CREATE TABLE life_pet (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL,
  species     TEXT    NOT NULL DEFAULT 'cat',
  birth_date  TEXT    NOT NULL DEFAULT '',
  reminder    TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);

-- 日记
CREATE TABLE life_journal (
  id          TEXT    PRIMARY KEY,
  -- YYYY-MM-DD
  log_date    TEXT    NOT NULL UNIQUE,
  -- happy/calm/neutral/sad/angry
  mood        TEXT    NOT NULL DEFAULT 'neutral',
  content     TEXT    NOT NULL DEFAULT '',
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE INDEX ix_journal_date ON life_journal(log_date);
