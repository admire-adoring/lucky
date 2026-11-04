-- ============================================================
-- 0005 · 任务检查项（task_item）
-- ============================================================
-- 一个任务 → 多条子记录：可勾选的步骤（"准备评审" → 发议程 / 约会议室 / 过数据）。
--
-- 为什么是检查项而不是"标签 / 评论"：
--   · 天然 1:N、天然有完成态、天然该跟着任务一起删（标签是 N:N，要另起两张表）；
--   · 它填的是任务详情里最空的一块 —— 主表只有标题与状态，步骤无处可放。
--
-- `done` 用 0/1 而不是时间戳：这里只需要"勾没勾"，不需要"什么时候勾的"。
--   要时间线是另一件事（`task_activity`），这一版不做。
CREATE TABLE task_item (
  id         TEXT    PRIMARY KEY,
  task_id    TEXT    NOT NULL REFERENCES task(id) ON DELETE CASCADE,
  title      TEXT    NOT NULL,
  done       INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL
);

CREATE INDEX ix_task_item_task ON task_item(task_id, sort_order);
