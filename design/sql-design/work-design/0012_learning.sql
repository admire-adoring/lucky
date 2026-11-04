-- 学习域：目标 / 技能 / 资源 / 复习 / 输出 / 学习日志
-- 概览统计从 study_log + resource + review 聚合。

CREATE TABLE learning_goal (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  target_date TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE learning_skill (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  category TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE learning_resource (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'doc' CHECK (kind IN ('doc', 'book', 'course', 'article')),
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  tags TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'done', 'paused')),
  last_study_at TEXT NOT NULL DEFAULT '',
  owner_id TEXT REFERENCES app_user(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE learning_review (
  id TEXT PRIMARY KEY,
  question TEXT NOT NULL,
  answer TEXT NOT NULL DEFAULT '',
  tag TEXT NOT NULL DEFAULT '',
  -- SM-2 简化字段：到期日 / 间隔天数 / 难度系数
  due_date TEXT NOT NULL,
  interval_days INTEGER NOT NULL DEFAULT 1,
  ease_factor REAL NOT NULL DEFAULT 2.5,
  reviewed_count INTEGER NOT NULL DEFAULT 0,
  owner_id TEXT REFERENCES app_user(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE learning_output (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'blog' CHECK (kind IN ('blog', 'share', 'project', 'note')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  published_at TEXT NOT NULL DEFAULT '',
  url TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  owner_id TEXT REFERENCES app_user(id),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE learning_study_log (
  id TEXT PRIMARY KEY,
  log_date TEXT NOT NULL,
  duration_min INTEGER NOT NULL DEFAULT 0,
  resource_id TEXT NOT NULL DEFAULT '',
  note TEXT NOT NULL DEFAULT '',
  owner_id TEXT REFERENCES app_user(id),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_learning_review_due ON learning_review(due_date);
CREATE INDEX idx_learning_study_log_date ON learning_study_log(log_date);
