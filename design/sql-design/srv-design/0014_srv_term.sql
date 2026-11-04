-- 终端会话与命令审计。版本：14。
--
-- 终端页此前是纯演示：进程表、CPU、日志、命令回显全是前端常量。
-- 接上真 SSH 之后需要两件"关掉窗口还在"的东西：
--   1. 会话 —— 谁在哪台机器上开了终端、什么时候开的、怎么结束的；
--   2. 命令 —— 真实执行过的每一条，含退出码与耗时，退出码非 0 的那条要能回查。
-- 两者都是审计用途，不存命令输出正文：输出可能几百 KB，落库只会让库长胖。

-- ============================================================
-- 一 · 会话
-- ============================================================

CREATE TABLE srv_term_session (
  id         TEXT    PRIMARY KEY,          -- 'ts-<纳秒>-<序号>'
  server_id  TEXT    NOT NULL REFERENCES srv_server(id) ON DELETE CASCADE,
  -- 登录账户与落到哪台机器，改机器名之后仍读得懂
  login_user TEXT    NOT NULL DEFAULT '',
  -- 认通时机器自报的系统；连不上时为空
  os         TEXT    NOT NULL DEFAULT '',
  -- 起始工作目录（$HOME）
  cwd        TEXT    NOT NULL DEFAULT '',
  started_at TEXT    NOT NULL,             -- ISO 时刻
  ended_at   TEXT,                         -- NULL = 还开着（进程退出后为 NULL，下次打开时标 lost）
  -- open / closed / lost
  status     TEXT    NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed','lost')),
  -- 这条会话里跑过多少条命令，关会话时回填；列表页不必再 count(*)
  command_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX ix_srv_term_session_server ON srv_term_session(server_id, started_at DESC);

-- ============================================================
-- 二 · 命令
-- ============================================================

CREATE TABLE srv_term_command (
  id          TEXT    PRIMARY KEY,         -- 'tc-<纳秒>-<序号>'
  session_id  TEXT    NOT NULL REFERENCES srv_term_session(id) ON DELETE CASCADE,
  -- 冗余一列机器 id：查"这台机器最近敲过什么"不必 JOIN 会话表
  server_id   TEXT    NOT NULL REFERENCES srv_server(id) ON DELETE CASCADE,
  command     TEXT    NOT NULL,
  -- 退出码：NULL = 没跑起来（连接断了 / 超时被杀）
  exit_code   INTEGER,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  -- 输出字节数，用来判断是不是该截断
  output_bytes INTEGER NOT NULL DEFAULT 0,
  -- 执行这条命令时所在目录
  cwd         TEXT    NOT NULL DEFAULT '',
  ran_at      TEXT    NOT NULL
);

CREATE INDEX ix_srv_term_command_server ON srv_term_command(server_id, ran_at DESC);
CREATE INDEX ix_srv_term_command_session ON srv_term_command(session_id, ran_at);
