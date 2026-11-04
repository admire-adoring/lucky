-- 服务器凭据落库。版本：13。
--
-- 原先只有 cred_ref（指向钥匙串条目）。钥匙串在签名、换构建、重装之后都会丢，
-- 且编辑页读不回来 —— 改成正文直接跟着台账走：一列存 AES-256-GCM 密文，
-- 密钥在库同目录的 vault.key（0600），备份库文件时不会连人带锁一起带走。
--
-- 内容随 auth_code 走：key 档存私钥路径，pwd 档存登录密码。
-- NULL = 这台机器没存凭据（只在台账登记了连接方式）。
ALTER TABLE srv_server ADD COLUMN secret TEXT;

-- 两列并存期：cred_ref 留作历史引用，读凭据时以 secret 为准。
