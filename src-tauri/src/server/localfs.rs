//! 本机文件系统：部署页「绑定本地文件」与「选择本机文件」读的是这台机器的事实。
//!
//! 只读，不写。三件事：一个绝对路径存不存在、它的修改时间与大小、某一层目录里有什么。
//!
//! 为什么不给前端编一份清单：本机有没有这个文件是磁盘的决定，编出来的清单只会在
//! 用户绑一个真实存在的包时回一句「本机没有这个文件」。同理目录树也必须现读 ——
//! 换了个构建产物，树里还是旧的。
//!
//! 修改时间只回 epoch 毫秒，不回"今天 09:41"这类文案：时区与"今天"的边界在前端
//! 拼（`mtimeText`），后端猜出来的文案在跨时区/跨天时会对不上。

use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use super::error::{Error, Result};

/// 一个路径探测出来的事实。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalMeta {
    pub path: String,
    /// 最后一段（`pay-api.jar`）；根目录回退成整条路径
    pub name: String,
    pub dir: bool,
    /// 目录固定 0 —— 目录大小不是"这个包多大"，拿去算总量是假账
    pub size: u64,
    /// epoch 毫秒
    pub mtime: i64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalEntry {
    pub name: String,
    pub dir: bool,
    pub size: u64,
    pub mtime: i64,
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LocalDir {
    /// 实际读的那一层（`~` 已展开、软链已跟随）
    pub path: String,
    pub entries: Vec<LocalEntry>,
    /// 有项读不到时的说明（权限）；空串表示这一层全读到了
    pub note: String,
}

/// 家目录。`HOME` 缺失（有些 launchd 场景）时退回 `/`，不 panic。
pub fn home() -> String {
    let key = if cfg!(target_os = "windows") { "USERPROFILE" } else { "HOME" };
    std::env::var(key).ok().filter(|value| !value.is_empty()).unwrap_or_else(|| "/".to_string())
}

/// 探测一个路径。不存在回 `None`（前端据此标「未找到」），
/// 权限不足回错 —— 那两种情况用户要做的动作完全相反，不能都混成一句"没有这个文件"。
pub fn stat(path: &str) -> Result<Option<LocalMeta>> {
    let target = absolute(path)?;
    let meta = match fs::metadata(&target) {
        Ok(meta) => meta,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(e) if e.kind() == std::io::ErrorKind::PermissionDenied => {
            return Err(Error::Invalid(format!(
                "没有权限读取 {path}（macOS 的系统目录需在「隐私与安全性 · 完全磁盘访问权限」里放行）"
            )))
        }
        Err(e) => return Err(Error::Io(e)),
    };
    Ok(Some(meta_of(&target, &meta)))
}

/// 读一层目录。路径指向文件时直接报错 —— 选择器要的是目录。
pub fn list(path: &str) -> Result<LocalDir> {
    let target = if path.trim().is_empty() { PathBuf::from(home()) } else { absolute(path)? };
    let meta = fs::metadata(&target)?;
    if !meta.is_dir() {
        return Err(Error::Invalid(format!("{} 不是一个目录", target.display())));
    }

    let mut entries = Vec::new();
    let mut unreadable = 0usize;
    for item in fs::read_dir(&target)? {
        let Ok(item) = item else {
            unreadable += 1;
            continue;
        };
        // 跟随软链：选择器里点进去应该到真实目录，而不是停在链上
        let Ok(meta) = fs::metadata(item.path()) else {
            unreadable += 1;
            continue;
        };
        entries.push(LocalEntry {
            name: item.file_name().to_string_lossy().to_string(),
            dir: meta.is_dir(),
            size: if meta.is_dir() { 0 } else { meta.len() },
            mtime: mtime_of(&meta),
        });
    }

    Ok(LocalDir {
        path: target.to_string_lossy().to_string(),
        entries,
        note: if unreadable > 0 { format!("{unreadable} 项读不到（权限不足）") } else { String::new() },
    })
}

/// 打开选择器时落在哪一层：路径是目录就是它自己，是文件就取所在目录，
/// 整条都不存在就往上退到最近一层存在且是目录的祖先。
/// 让人从一个不存在的位置开始点，等于把"路径写错了"这件事丢给下一屏。
pub fn dir_for(path: &str) -> Result<String> {
    let text = path.trim();
    if text.is_empty() {
        return Ok(home());
    }
    let mut target = absolute(text)?;
    loop {
        if target.is_dir() {
            return Ok(target.to_string_lossy().to_string());
        }
        match target.parent() {
            Some(up) if up != target => target = up.to_path_buf(),
            _ => return Ok(home()),
        }
    }
}

fn absolute(raw: &str) -> Result<PathBuf> {
    let text = raw.trim();
    if text.is_empty() {
        return Err(Error::Invalid("先填一个本机文件的绝对路径".to_string()));
    }
    if let Some(rest) = text.strip_prefix('~') {
        return Ok(PathBuf::from(home()).join(rest.trim_start_matches('/')));
    }
    if !text.starts_with('/') {
        return Err(Error::Invalid("要绝对路径（从 / 开始）".to_string()));
    }
    Ok(PathBuf::from(text))
}

fn meta_of(path: &Path, meta: &fs::Metadata) -> LocalMeta {
    LocalMeta {
        path: path.to_string_lossy().to_string(),
        name: path
            .file_name()
            .map(|name| name.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string()),
        dir: meta.is_dir(),
        size: if meta.is_dir() { 0 } else { meta.len() },
        mtime: mtime_of(meta),
    }
}

fn mtime_of(meta: &fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|since| since.as_millis() as i64)
        .unwrap_or(0)
}
