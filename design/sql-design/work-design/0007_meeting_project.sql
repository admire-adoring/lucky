-- ============================================================
-- 0007 · 会议挂项目
-- ============================================================
-- `work_meeting` 原本只是"一场会"（有组织者、时间、地点、纪要），没有归属。
-- 项目详情有「会议」分区 —— 那一格要回答"这个项目的会开过哪些"，于是补一列可空的 `project_id`。
--
-- **可空是刻意的**：周会、季度复盘这类会不属任何项目，`NULL` 是事实不是缺数据。
-- 删项目时 `SET NULL`：会还在，只是不再属某个项目（与部署文档同一条口径）。
ALTER TABLE work_meeting ADD COLUMN project_id TEXT REFERENCES project(id) ON DELETE SET NULL;

CREATE INDEX ix_meeting_project ON work_meeting(project_id, starts_at DESC);
