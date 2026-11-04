-- ============================================================
-- 0011 · 设置项（setting_item）
-- ============================================================
-- 用一张 key-value 表存所有可配置项：模块开关、通知偏好、集成配置、快捷键。
-- 不为每类设置建单独的表 —— 它们都是"一个键对应一个值"，结构同构。
-- 账户信息走 app_user 表（已有），不在这里。
CREATE TABLE setting_item (
  id          TEXT    PRIMARY KEY,
  -- 分组：module/notification/integration/shortcut/data/privacy
  category    TEXT    NOT NULL,
  -- 唯一键，如 'module.life.enabled' / 'shortcut.newTask'
  item_key    TEXT    NOT NULL UNIQUE,
  -- 显示名（中文标签入库是因为它就是数据本身，不像 status 那样是枚举）
  label       TEXT    NOT NULL,
  -- 值（统一存文本，前端按 item_key 解析类型）
  value       TEXT    NOT NULL DEFAULT '',
  -- 描述/帮助文本
  description TEXT    NOT NULL DEFAULT '',
  sort_order  INTEGER NOT NULL DEFAULT 0,
  updated_at  TEXT    NOT NULL
);

CREATE INDEX ix_setting_category ON setting_item(category, sort_order);
