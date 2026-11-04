-- ============================================================
-- 0009 · 知识库（knowledge_note + knowledge_tag + 关联表）
-- ============================================================
-- 笔记是知识库的核心实体；标签是多对多分类（一篇笔记可挂多个标签）。
-- "主题"不单独建表 —— 它是标签的一个子集（is_topic=1），避免两层分类打架。
-- 收藏/归档是笔记自身的状态位（favorited/archived），不是单独的表。
CREATE TABLE knowledge_note (
  id          TEXT    PRIMARY KEY,
  title       TEXT    NOT NULL,
  content     TEXT    NOT NULL DEFAULT '',
  excerpt     TEXT    NOT NULL DEFAULT '',
  -- draft/published/archived：archived 走"归档"tab
  status      TEXT    NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','archived')),
  favorited   INTEGER NOT NULL DEFAULT 0 CHECK (favorited IN (0, 1)),
  owner_id    TEXT    REFERENCES app_user(id),
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL,
  updated_at  TEXT    NOT NULL
);

CREATE TABLE knowledge_tag (
  id          TEXT    PRIMARY KEY,
  name        TEXT    NOT NULL UNIQUE,
  -- 0=普通标签，1=主题（在"主题"tab 里单独展示）
  is_topic    INTEGER NOT NULL DEFAULT 0 CHECK (is_topic IN (0, 1)),
  color       TEXT    NOT NULL DEFAULT 'blue',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT    NOT NULL
);

CREATE TABLE knowledge_note_tag (
  note_id     TEXT    NOT NULL REFERENCES knowledge_note(id) ON DELETE CASCADE,
  tag_id      TEXT    NOT NULL REFERENCES knowledge_tag(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

CREATE INDEX ix_note_status ON knowledge_note(status, updated_at);
CREATE INDEX ix_note_favorited ON knowledge_note(favorited, updated_at);
