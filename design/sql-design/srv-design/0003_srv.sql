-- 服务器台账。前缀 srv_：这一簇不属于任何单一模块 —— 一台机器可服务任意 scope 的项目。
-- 依赖 0001_init.sql（app_user / project）。版本：3。

PRAGMA foreign_keys = ON;

-- ============================================================
-- 一 · 机器台账
-- ============================================================

-- 凭据不在这里：密码 / 私钥正文存本机钥匙串（AddServerForm 的文件头写着"不写进项目配置、
--   不同步到其它设备"），表里只留一个引用。列 auth/esc 说的是"怎么连"，不是"用什么连"。
CREATE TABLE srv_server (
  id         TEXT    PRIMARY KEY,          -- uuid / 种子 's1'
  host       TEXT    NOT NULL UNIQUE,      -- 机器名 prod-web-01；路由 /work/servers/:host 用它
  ip         TEXT    NOT NULL,             -- 主机地址：IPv4 或内网域名，两处都读它
  ssh_port   INTEGER NOT NULL DEFAULT 22 CHECK (ssh_port BETWEEN 1 AND 65535),
  os         TEXT    NOT NULL DEFAULT '',  -- 机器自己会报，连上一次后缓存
  cores      INTEGER CHECK (cores   IS NULL OR cores   > 0),
  mem_gb     INTEGER CHECK (mem_gb  IS NULL OR mem_gb  > 0),
  disk_gb    INTEGER CHECK (disk_gb IS NULL OR disk_gb > 0),
  role_code  TEXT    NOT NULL CHECK (role_code IN ('web','db','cache')),
  env_code   TEXT    NOT NULL CHECK (env_code IN ('prod','stage','test','local')),
  login_user TEXT    NOT NULL DEFAULT '',
  auth_code  TEXT    NOT NULL DEFAULT 'key'  CHECK (auth_code IN ('key','pwd')),
  esc_mode   TEXT    NOT NULL DEFAULT 'none' CHECK (esc_mode IN ('none','su','sudo')),
  esc_user   TEXT    NOT NULL DEFAULT '',    -- 提权到的账户；none 时为空串
  cred_ref   TEXT,                          -- 钥匙串条目引用；NULL = 凭据不在本机
  note       TEXT    NOT NULL DEFAULT '',   -- 这台机器是干什么的
  sort_order INTEGER NOT NULL DEFAULT 0,
  removed_at TEXT,                          -- NULL = 在册；有值 = 已从台账收走
  created_at TEXT    NOT NULL,
  updated_at TEXT    NOT NULL
);

-- 机器 ↔ 项目，多对多。一台 nginx 挂两个站点、一个 PG 两个库、测试机被两个项目共用
--   ⇒ 卡脚那排项目胶囊就是这张表。sort_order 首位 = 主项目（拼日志 / 部署 / 终端路由用它）。
CREATE TABLE srv_server_project (
  server_id  TEXT    NOT NULL REFERENCES srv_server(id) ON DELETE CASCADE,
  project_id TEXT    NOT NULL REFERENCES project(id)    ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (server_id, project_id)
);

-- 应用端口（带服务名）。与「SSH 端口」是两件事：那个是连它的入口，这些是它对外跑的服务。
CREATE TABLE srv_server_port (
  server_id  TEXT    NOT NULL REFERENCES srv_server(id) ON DELETE CASCADE,
  port       INTEGER NOT NULL CHECK (port BETWEEN 1 AND 65535),
  svc        TEXT    NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (server_id, port)
);

-- ============================================================
-- 二 · 标签（服务器自己的词表，与项目标签不是一套）
-- ============================================================

CREATE TABLE srv_tag (
  id   INTEGER PRIMARY KEY,
  name TEXT    NOT NULL UNIQUE
);

CREATE TABLE srv_server_tag (
  server_id  TEXT    NOT NULL REFERENCES srv_server(id) ON DELETE CASCADE,
  tag_id     INTEGER NOT NULL REFERENCES srv_tag(id)    ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (server_id, tag_id)
);

-- ============================================================
-- 三 · 文件位置
-- ============================================================

-- 每台机器自己的一套分组（有序）。归类给"选"不给"填"，自由输入会长出
--   「配置 / 配置文件 / conf」三个组。空组不显示 —— 分组表在、路径表里没有它的行。
CREATE TABLE srv_path_group (
  server_id  TEXT    NOT NULL REFERENCES srv_server(id) ON DELETE CASCADE,
  name       TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (server_id, name)
);

CREATE TABLE srv_server_path (
  id         TEXT    PRIMARY KEY,
  server_id  TEXT    NOT NULL,
  group_name TEXT    NOT NULL,
  use_label  TEXT    NOT NULL DEFAULT '',   -- 这条路径是干什么用的
  path       TEXT    NOT NULL,
  note       TEXT    NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (server_id, group_name) REFERENCES srv_path_group(server_id, name) ON DELETE CASCADE
);

-- ============================================================
-- 四 · 发布记录
-- ============================================================

-- when 存时刻（"昨天""5 天前"由它算）；duration 存秒；回滚那条没有耗时。
CREATE TABLE srv_deploy_release (
  id            TEXT    PRIMARY KEY,
  project_id    TEXT    NOT NULL REFERENCES project(id)    ON DELETE CASCADE,
  server_id     TEXT    REFERENCES srv_server(id)          ON DELETE SET NULL,
  version       TEXT    NOT NULL,
  result_code   TEXT    NOT NULL CHECK (result_code IN ('success','rollback')),
  released_at   TEXT    NOT NULL,
  operator_code TEXT    REFERENCES app_user(code),
  duration_sec  INTEGER CHECK (duration_sec IS NULL OR duration_sec >= 0),
  commit_sha    TEXT    NOT NULL DEFAULT '',
  changes       TEXT    NOT NULL DEFAULT '',  -- 成功读作变更说明，回滚读作原因
  rollback_to   TEXT,                         -- 仅 result_code='rollback' 有值
  sort_order    INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 五 · 部署文档（归属是项目，机器只是路过）
-- ============================================================

CREATE TABLE srv_deploy_doc (
  id         TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES project(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  kind_code  TEXT NOT NULL CHECK (kind_code IN ('manual','process','script')),
  version    TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 六 · 索引
-- ============================================================

CREATE INDEX ix_srv_server_env      ON srv_server(env_code, role_code);          -- 环境 / 角色筛选
CREATE INDEX ix_srv_server_project  ON srv_server_project(project_id);           -- 项目视角分组
CREATE INDEX ix_srv_server_tag      ON srv_server_tag(tag_id);                   -- 按标签反查
CREATE INDEX ix_srv_path_server     ON srv_server_path(server_id, sort_order);   -- 文件位置清单
CREATE INDEX ix_srv_release_project ON srv_deploy_release(project_id, released_at DESC);  -- 项目发布记录
CREATE INDEX ix_srv_release_server  ON srv_deploy_release(server_id, released_at DESC);   -- 这台机器几条
CREATE INDEX ix_srv_doc_project     ON srv_deploy_doc(project_id, sort_order);   -- 项目部署文档

PRAGMA user_version = 3;
