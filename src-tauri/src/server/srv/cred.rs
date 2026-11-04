//! 历史遗留：早期版本把服务器凭据存在本机钥匙串（`server/{id}/key|pwd`）。
//!
//! 现在正文在 `srv_server.secret`，加密存、跟库一起走（见 `crate::server::vault`）。
//! 这个模块只剩清理：删掉一台机器时顺手抹掉旧条目，免得升级后钥匙串里
//! 还躺着没人认领的密码。
use keyring::Entry;

/// 与服务名同 `project_account`（`lucky-y`）。条目名 `server/{id}/{kind}`。
const SERVICE: &str = "lucky-y";

fn entry(server_id: &str, kind: &str) -> Option<Entry> {
    Entry::new(SERVICE, &format!("server/{server_id}/{kind}")).ok()
}

/// 两档一起清。失败不报：`NoEntry` 是最常见的一种，不该让删除失败。
pub fn clear(server_id: &str) {
    for kind in ["key", "pwd"] {
        if let Some(item) = entry(server_id, kind) {
            let _ = item.delete_credential();
        }
    }
}
