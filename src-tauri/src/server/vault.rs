//! 服务器凭据的加解密。
//!
//! 正文落在 `srv_server.secret`，AES-256-GCM；密钥是库同目录的 `vault.key`（0600）。
//! 分开存的原因：库文件经常被复制去排查问题、进备份、发给人看，密钥不跟着走，
//! 那些副本就只是密文。
//!
//! 进程启动时 `init` 一次，之后 `seal` / `open` 不再碰文件系统。
//! 老数据（没有 `v1:` 前缀）按明文读 —— 迁移前 `cred_ref` 指向钥匙串，这一列是空的。
use std::fs::OpenOptions;
use std::io::Write;
use std::os::unix::fs::OpenOptionsExt;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use aes_gcm::aead::{Aead, KeyInit, OsRng};
use aes_gcm::{AeadCore, Aes256Gcm};

use crate::server::error::{Error, Result};

/// 密文前缀。带上它才能区分"加密过的"与"迁移前就在库里的明文"。
const PREFIX: &str = "v1:";
const KEY_FILE: &str = "vault.key";

static KEY: OnceLock<[u8; 32]> = OnceLock::new();

/// 密钥文件位置：跟库放同一个目录。
pub fn key_path(db_path: &Path) -> PathBuf {
    db_path.parent().unwrap_or(Path::new(".")).join(KEY_FILE)
}

/// 启动时调一次。已有密钥就读，没有就生成 —— 建不出来直接失败，
/// 免得一路跑到"保存密码"才发现存不了。
pub fn init(db_path: &Path) -> Result<()> {
    let key = load_or_create(db_path)?;
    let _ = KEY.set(key);
    Ok(())
}

fn key() -> Result<[u8; 32]> {
    KEY.get()
        .copied()
        .ok_or_else(|| Error::Invalid("凭据密钥没初始化（Store 没走 open？）".into()))
}

/// 加密。空串不加密 —— 空串在这套语义里表示"清掉"，由调用方转成 NULL。
pub fn seal(plain: &str) -> Result<String> {
    let cipher = Aes256Gcm::new_from_slice(&key()?)
        .map_err(|error| Error::Invalid(format!("密钥长度不对：{error}")))?;
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let sealed = cipher
        .encrypt(&nonce, plain.as_bytes())
        .map_err(|_| Error::Invalid("凭据加密失败".into()))?;

    let mut raw = Vec::with_capacity(12 + sealed.len());
    raw.extend_from_slice(nonce.as_slice());
    raw.extend_from_slice(&sealed);

    let mut out = String::with_capacity(PREFIX.len() + raw.len() * 2);
    out.push_str(PREFIX);
    for byte in raw {
        out.push_str(&format!("{byte:02x}"));
    }
    Ok(out)
}

/// 解密。没有前缀的一律当明文返回 —— 那是迁移前写进来的，或用户手改过库。
pub fn open(stored: &str) -> Result<String> {
    let Some(body) = stored.strip_prefix(PREFIX) else {
        return Ok(stored.to_string());
    };
    let raw = unhex(body)?;
    if raw.len() <= 12 {
        return Err(Error::Invalid("凭据密文不是完整的一段 —— 库被改过？".into()));
    }
    let (nonce, cipher_text) = raw.split_at(12);

    let cipher = Aes256Gcm::new_from_slice(&key()?)
        .map_err(|error| Error::Invalid(format!("密钥长度不对：{error}")))?;
    let plain = cipher
        .decrypt(nonce.into(), cipher_text)
        .map_err(|_| Error::Invalid("解不开这份凭据 —— vault.key 换过？".into()))?;
    String::from_utf8(plain).map_err(|_| Error::Invalid("凭据不是合法的 UTF-8".into()))
}

/* ------------------------------------------------------------------ *
 * 密钥文件
 * ------------------------------------------------------------------ */

fn load_or_create(db_path: &Path) -> Result<[u8; 32]> {
    let path = key_path(db_path);
    if let Ok(bytes) = std::fs::read(&path) {
        return to_key(&bytes);
    }

    let mut raw = [0u8; 32];
    {
        use aes_gcm::aead::rand_core::RngCore;
        OsRng.fill_bytes(&mut raw);
    }

    match open_exclusive(&path) {
        Ok(mut file) => {
            file.write_all(&raw)?;
            file.sync_all()?;
            /* 目录权限来自 umask，文件权限必须自己钉死 */
            let _ = std::fs::set_permissions(
                &path,
                std::os::unix::fs::PermissionsExt::from_mode(0o600),
            );
            Ok(raw)
        }
        /* 另一个进程先建好了 —— 用它那份，别覆盖：覆盖等于把已加密的行全变成孤儿 */
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            to_key(&std::fs::read(&path)?)
        }
        Err(error) => Err(Error::Invalid(format!("建不了凭据密钥 {}：{error}", path.display()))),
    }
}

fn open_exclusive(path: &Path) -> std::io::Result<std::fs::File> {
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    OpenOptions::new().write(true).create_new(true).mode(0o600).open(path)
}

fn to_key(bytes: &[u8]) -> Result<[u8; 32]> {
    bytes.try_into().map_err(|_| {
        Error::Invalid("vault.key 长度不对（该是 32 字节）—— 删掉它会让已存的凭据解不开".into())
    })
}

/* ------------------------------------------------------------------ *
 * hex
 * ------------------------------------------------------------------ */

fn unhex(text: &str) -> Result<Vec<u8>> {
    if !text.len().is_multiple_of(2) {
        return Err(Error::Invalid("凭据密文的十六进制长度是奇数".into()));
    }
    let mut out = Vec::with_capacity(text.len() / 2);
    let bytes = text.as_bytes();
    for pair in bytes.chunks(2) {
        let hi = (pair[0] as char)
            .to_digit(16)
            .ok_or_else(|| Error::Invalid("凭据密文里有非十六进制字符".into()))?;
        let lo = (pair[1] as char)
            .to_digit(16)
            .ok_or_else(|| Error::Invalid("凭据密文里有非十六进制字符".into()))?;
        out.push((hi * 16 + lo) as u8);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::{key_path, load_or_create, open, seal, unhex};

    #[test]
    fn round_trip_and_tamper() {
        let dir = std::env::temp_dir().join(format!("vault-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = dir.join("lucky.db");
        super::init(&db).unwrap();

        let sealed = seal("p@ss word 中文").unwrap();
        assert!(sealed.starts_with("v1:"));
        assert_eq!(open(&sealed).unwrap(), "p@ss word 中文");

        /* 密文改一个字符就该解不开，而不是悄悄给出一段乱码 */
        let mut broken = sealed.clone().into_bytes();
        let last = broken.len() - 1;
        broken[last] = if broken[last] == b'a' { b'b' } else { b'a' };
        assert!(open(&String::from_utf8(broken).unwrap()).is_err());

        /* 没前缀 = 迁移前的明文，原样读 */
        assert_eq!(open("plain-old-value").unwrap(), "plain-old-value");

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn key_file_is_private_and_stable() {
        let dir = std::env::temp_dir().join(format!("vault-key-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let db = dir.join("lucky.db");

        let first = load_or_create(&db).unwrap();
        let second = load_or_create(&db).unwrap();
        assert_eq!(first, second, "第二次该读到同一份密钥");

        let meta = std::fs::metadata(key_path(&db)).unwrap();
        use std::os::unix::fs::PermissionsExt;
        assert_eq!(meta.permissions().mode() & 0o777, 0o600);

        std::fs::remove_dir_all(&dir).unwrap();
    }

    #[test]
    fn hex_rejects_garbage() {
        assert!(unhex("abc").is_err());
        assert!(unhex("zz").is_err());
        assert_eq!(unhex("00ff").unwrap(), vec![0, 255]);
    }
}
