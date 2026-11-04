-- ============================================================
-- 0004 · 项目账户（凭据）
-- ============================================================
-- 这一张是 `project` 的卫星表：一个项目在哪些平台有账号、多久轮换、谁在管。
--
-- **密码/密钥不在这张表里**：`secret_ref` 只是一个键，明文存在本机钥匙串
--   （macOS Keychain / Windows 凭据管理器）。库里连密文都没有 —— 这一条不是洁癖，
--   是"备份库文件 == 泄露所有密码"这件事的防线（`全局架构.md` §八 那一类）。
--
-- `due` 不落库：下次轮换 = `rotated_at + cycle_days`，到期天数是展示层的减法。
--   存一份就有"改了周期、到期日没跟着变"的漂移。
CREATE TABLE project_account (
  id         TEXT    PRIMARY KEY,
  project_id TEXT    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  -- 平台是自由文本（阿里云 / GitLab / 星辰后台 …）——分组维度就是它，不是枚举
  platform   TEXT    NOT NULL,
  account    TEXT    NOT NULL,
  -- 两类只差一件事：能不能回显明文（密钥只在生成那一次出现）
  kind       TEXT    NOT NULL DEFAULT 'password' CHECK (kind IN ('password', 'key')),
  env        TEXT    NOT NULL DEFAULT 'prod' CHECK (env IN ('prod', 'test', 'dev')),
  note       TEXT    NOT NULL DEFAULT '',
  cycle_days INTEGER NOT NULL DEFAULT 90 CHECK (cycle_days > 0),
  rotated_at TEXT    NOT NULL,               -- 上次轮换（YYYY-MM-DD）
  rotated_by TEXT    REFERENCES app_user(id),
  -- 钥匙串里的键（`account/<id>`）；NULL = 只登记了账号，没存密码
  secret_ref TEXT,
  disabled   INTEGER NOT NULL DEFAULT 0 CHECK (disabled IN (0, 1)),
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT    NOT NULL
);

CREATE INDEX ix_account_project ON project_account(project_id, sort_order);
