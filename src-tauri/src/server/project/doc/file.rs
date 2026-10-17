//! 文档正文的文件层：路径、读写、内容指纹。
//!
//! 正文是文件、索引是库 —— 这一层只管文件那一半，不碰 SQL。
//! 布局：`<documents 根>/<projectId>/<文件名>.md`，相对根目录的那一段就是库里的 `file_path`。
use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::server::error::{Error, Result};

/// 正文落点（相对根目录）。
pub fn relative_path(project_id: &str, name: &str) -> String {
    format!("{}/{}", project_id, file_name(name))
}

/// 文件名：保留字母与中日韩字符，其余（空格、标点、斜杠）折成一个 `-`。
/// 空名退成 `untitled` —— 重名由调用方补序号，见 `unique_path`。
pub fn file_name(name: &str) -> String {
    let mut out = String::new();
    let mut prev_dash = false;
    for ch in name.trim().chars() {
        if ch.is_alphanumeric() && ch != '/' && ch != '\\' {
            out.push(ch);
            prev_dash = false;
        } else if !prev_dash && !out.is_empty() {
            out.push('-');
            prev_dash = true;
        }
    }
    let slug = out.trim_matches('-');
    if slug.is_empty() {
        "untitled.md".to_string()
    } else {
        format!("{slug}.md")
    }
}

/// 重名时补 `-2` / `-3`（只在同一项目下比，不同项目各自分目录）。
pub fn unique_path(root: &Path, project_id: &str, name: &str) -> String {
    let base = file_name(name);
    let stem = base.trim_end_matches(".md");
    let mut candidate = relative_path(project_id, name);
    let mut n = 2;
    while absolute(root, &candidate).map(|p| p.exists()).unwrap_or(false) {
        candidate = format!("{project_id}/{stem}-{n}.md");
        n += 1;
    }
    candidate
}

/// 内容指纹：FNV-1a 64 位，十六进制 16 位。
///
/// 不是加密用途 —— 只回答"这个文件与上次同步时是不是同一份"。
/// 换实现要连带把库里的 `content_hash` 一起重算，否则全部判成"外部改过"。
pub fn content_hash(text: &str) -> String {
    let mut hash: u64 = 0xcbf2_9ce4_8422_2325;
    for byte in text.as_bytes() {
        hash ^= u64::from(*byte);
        hash = hash.wrapping_mul(0x0000_0100_0000_01b3);
    }
    format!("{hash:016x}")
}

/// 绝对路径。路径由写入路径生成，这里再挡一次越界（`..` 与绝对路径）。
pub fn absolute(root: &Path, file_path: &str) -> Result<PathBuf> {
    let rel = Path::new(file_path);
    if rel.is_absolute() || rel.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(Error::Invalid(format!("文档路径不合法：{file_path}")));
    }
    Ok(root.join(rel))
}

pub fn read(root: &Path, file_path: &str) -> Result<String> {
    let path = absolute(root, file_path)?;
    fs::read_to_string(&path).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => Error::NotFound(format!("文档正文 {}", path.display())),
        _ => Error::Io(e),
    })
}

pub fn write(root: &Path, file_path: &str, content: &str) -> Result<()> {
    let path = absolute(root, file_path)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    fs::write(&path, content)?;
    Ok(())
}

/// 删文件。文件已经不在 = 目标已达成，不算错。
pub fn remove(root: &Path, file_path: &str) -> Result<()> {
    let path = absolute(root, file_path)?;
    match fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(Error::Io(e)),
    }
}
