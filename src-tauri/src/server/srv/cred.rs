//! 服务器凭据。**库里只有 `srv_server.cred_ref`（引用），正文在本机钥匙串。**
//!
//! 与 `project/account.rs` 是同一套做法，只是条目名多一档认证方式：
//!
//! | 认证 | 条目名 | 存的是什么 |
//! |---|---|---|
//! | `key` | `server/{id}/key` | 私钥路径（不是正文，`ssh -i` 要的是路径） |
//! | `pwd` | `server/{id}/pwd` | 登录密码 |
//!
//! 两档分条目的原因：`auth_code` 可以在编辑时切换，切换后旧档的凭据不该还躺在
//! 钥匙串里等人误用 —— 写入时把另一档清掉，钥匙串里最多一份。
//!
//! 私钥路径本身不敏感，但它与密码是同一件事的两面（"怎么证明我是我"），放一处
//! 才不会出现"密码在钥匙串、路径在库里"这种两套生命周期。
use keyring::Entry;

use crate::server::error::{Error, Result};

/// 与服务名同 `project_account`（`lucky-y`），靠条目前缀隔离。
const SERVICE: &str = "lucky-y";

/// 钥匙串访问串行化。
///
/// macOS 的 security-framework 第一次被调用时要去取"默认钥匙串"，几个线程同时首访
/// 会有一半拿到 `A default keychain could not be found`（本机实测，并行测试必现）。
/// 这道闸门只在进程内排队几百微秒，换掉一个只出现在并发首访时的报错。
static GATE: std::sync::Mutex<()> = std::sync::Mutex::new(());

fn gate() -> std::sync::MutexGuard<'static, ()> {
    GATE.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

fn entry(server_id: &str, kind: &str) -> Result<Entry> {
    Entry::new(SERVICE, &format!("server/{server_id}/{kind}"))
        .map_err(|error| Error::Invalid(format!("钥匙串打不开：{error}")))
}

/// 按机器 id + 认证方式读凭据。没存过 → `None`（**不是空串**：
/// 空串会被下游当成"密码是空的"，而没存是"没存"）。
pub fn read(server_id: &str, kind: &str) -> Result<Option<String>> {
    let _guard = gate();
    read_inner(server_id, kind)
}

fn read_inner(server_id: &str, kind: &str) -> Result<Option<String>> {
    match entry(server_id, kind)?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(error) => Err(Error::Invalid(format!("钥匙串读不到这份凭据：{error}"))),
    }
}

/// 写一份、清另一档。
fn write_inner(server_id: &str, kind: &str, value: &str) -> Result<String> {
    entry(server_id, kind)?
        .set_password(value)
        .map_err(|error| Error::Invalid(format!("写钥匙串失败：{error}")))?;
    clear_kind(server_id, if kind == "pwd" { "key" } else { "pwd" });
    Ok(format!("server/{server_id}"))
}

/// 按入参的三态决定钥匙串怎么动，返回这一行该记的 `cred_ref`。
///
/// - `secret` 为 `None`：**不动**（编辑时密码框留空的常态）→ 保留入参里的 cred_ref
/// - 空串：清掉 → `None`
/// - 有值：写入 → `server/{id}`
///
/// `auth_code` 决定写进哪一档：切换认证方式后第一次保存，新档有值、旧档被清。
pub fn apply(server_id: &str, auth_code: &str, secret: Option<&str>, current: Option<&str>) -> Result<Option<String>> {
    let _guard = gate();
    match secret {
        None => Ok(current.map(str::to_string)),
        Some("") => {
            clear_inner(server_id);
            Ok(None)
        }
        Some(value) => {
            let kind = if auth_code == "pwd" { "pwd" } else { "key" };
            write_inner(server_id, kind, value.trim()).map(Some)
        }
    }
}

/// 两档一起清。失败不报：`NoEntry` 是最常见的一种，不该让删除失败
/// （行没了之后那份凭据再没有入口）。
pub fn clear(server_id: &str) {
    let _guard = gate();
    clear_inner(server_id);
}

fn clear_inner(server_id: &str) {
    clear_kind(server_id, "key");
    clear_kind(server_id, "pwd");
}

fn clear_kind(server_id: &str, kind: &str) {
    if let Ok(item) = entry(server_id, kind) {
        let _ = item.delete_credential();
    }
}

#[cfg(test)]
mod tests {
    use super::{apply, read, SERVICE};

    #[test]
    fn keychain_roundtrip_and_switch() {
        let id = format!("srvtest-{}", std::process::id());
        let ref_name = apply(&id, "pwd", Some("p@ss word"), None).expect("写不进去");
        assert_eq!(ref_name.as_deref(), Some(format!("server/{id}").as_str()));
        assert_eq!(read(&id, "pwd").unwrap().as_deref(), Some("p@ss word"));

        /* 换成一档密钥：旧的密码条目该被清掉，不能留着 */
        apply(&id, "key", Some("~/.ssh/id_ed25519"), Some(&format!("server/{id}"))).expect("写不进去");
        assert_eq!(read(&id, "key").unwrap().as_deref(), Some("~/.ssh/id_ed25519"));
        assert_eq!(read(&id, "pwd").unwrap(), None);

        /* None = 不动：ref 原样回来 */
        let kept = apply(&id, "key", None, Some(&format!("server/{id}"))).expect("不该报错");
        assert_eq!(kept.as_deref(), Some(format!("server/{id}").as_str()));

        /* 空串 = 清空 */
        assert_eq!(apply(&id, "key", Some(""), Some(&format!("server/{id}"))).unwrap(), None);
        assert_eq!(read(&id, "key").unwrap(), None);

        super::clear(&id);
        assert!(keyring::Entry::new(SERVICE, &format!("server/{id}/key")).unwrap().get_password().is_err());
    }
}
