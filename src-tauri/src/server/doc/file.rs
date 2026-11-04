//! 文档正文的文件层：路径、读写、内容指纹。
//!
//! 正文是文件、索引是库 —— 这一层只管文件那一半，不碰 SQL。
//! 布局：`<documents 根>/<owner_kind>/<owner_id>/<文件名>.md`，
//! 相对根目录的那一段就是库里的 `file_path`。
//! 按宿主分目录：同一宿主的文档聚在一起，删宿主时整目录可回收，不同宿主的同名文件不撞。
//! 宿主目录只是**默认落点** —— 新建时给 `dir` 就按它落（同一宿主下再分子目录，如「技术方案 /」）。
use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::server::error::{Error, Result};

/// 文件名：保留字母与中日韩字符，其余（空格、标点、斜杠）折成一个 `-`。
/// 空名退成 `untitled.md` —— 重名由 `unique_path_in` 补序号。
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

/// 指定目录下的落点（相对根）。目录为空 ⇒ 根下。
pub fn relative_path_in(dir: &str, name: &str) -> String {
    if dir.is_empty() {
        file_name(name)
    } else {
        format!("{dir}/{}", file_name(name))
    }
}

/// 目录里重名时的落点：`<目录>/<名字>-2.md`。
pub fn unique_path_in(root: &Path, dir: &str, name: &str) -> String {
    let stem = file_name(name);
    let stem = stem.trim_end_matches(".md").to_string();
    let mut candidate = relative_path_in(dir, name);
    let mut n = 2;
    while absolute(root, &candidate).map(|p| p.exists()).unwrap_or(false) {
        candidate = relative_path_in(dir, &format!("{stem}-{n}"));
        n += 1;
    }
    candidate
}

/// 目录参数归一化：`\` 当分隔符、折叠重复 `/`、丢掉 `.`，拒绝 `..` 与盘符那种绝对路径。
/// 落点最终还要过 `absolute` 的越界检查 —— 这一层负责把"看起来像目录"的输入收成干净相对路径。
pub fn normalize_dir(dir: &str) -> Result<String> {
    let raw = dir.trim().replace('\\', "/");
    if raw.starts_with('/') || raw.contains(':') {
        return Err(Error::Invalid(format!("存放目录要相对文档根：{dir}")));
    }
    let mut parts: Vec<&str> = Vec::new();
    for part in raw.split('/') {
        match part {
            "" | "." => continue,
            ".." => return Err(Error::Invalid(format!("存放目录不合法：{dir}"))),
            p => parts.push(p),
        }
    }
    Ok(parts.join("/"))
}

/// 文档根下的目录（相对根，最多三层、最多 [`MAX_DIRS`] 条）—— 新建文档时给人挑存放位置。
/// 根不存在算空：还没有任何本地正文的仓就是这种状态。
pub fn list_dirs(root: &Path) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    collect_dirs(root, "", 0, &mut out);
    out.sort();
    out
}

/// 三层封顶：再多也没人挑得动，而弹窗里那一排胶囊本来就放不下。
const MAX_DIRS: usize = 200;
const MAX_DEPTH: usize = 3;

fn collect_dirs(dir: &Path, prefix: &str, depth: usize, out: &mut Vec<String>) {
    if depth >= MAX_DEPTH || out.len() >= MAX_DIRS {
        return;
    }
    let Ok(entries) = fs::read_dir(dir) else { return };
    let mut names: Vec<String> = entries
        .flatten()
        .filter(|e| e.file_type().map(|t| t.is_dir()).unwrap_or(false))
        .filter_map(|e| e.file_name().to_str().map(str::to_string))
        /* 隐藏目录（`.git` 一类）不参与挑位置 */
        .filter(|n| !n.starts_with('.'))
        .collect();
    names.sort();
    for name in names {
        let rel = if prefix.is_empty() { name.clone() } else { format!("{prefix}/{name}") };
        out.push(rel.clone());
        collect_dirs(&dir.join(&name), &rel, depth + 1, out);
    }
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

/// 原子写：先写同目录下的 `xxx.md.tmp`，再 `rename` 覆盖。
/// 直接 `fs::write` 写到一半崩掉会把正文截成半截 —— 而它往往是用户唯一的一份。
pub fn write(root: &Path, file_path: &str, content: &str) -> Result<()> {
    let path = absolute(root, file_path)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("md.tmp");
    fs::write(&tmp, content)?;
    fs::rename(&tmp, &path)?;
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

/// 收掉一个宿主的文档目录 —— 只在空了的时候。目录还在（还有别的文件）不算错。
pub fn remove_host_dir(root: &Path, owner_kind: &str, owner_id: &str) -> Result<()> {
    match fs::remove_dir(root.join(owner_kind).join(owner_id)) {
        Ok(()) => Ok(()),
        Err(e)
            if e.kind() == std::io::ErrorKind::NotFound
                || e.kind() == std::io::ErrorKind::DirectoryNotEmpty =>
        {
            Ok(())
        }
        Err(e) => Err(Error::Io(e)),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 临时根目录：每支测试各用一个，跑完自己收。
    fn temp_root(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("lucky-doc-file-{tag}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn normalize_dir_folds_separators_and_trim() {
        assert_eq!(normalize_dir(" project/pj-1/技术方案/ ").unwrap(), "project/pj-1/技术方案");
        assert_eq!(normalize_dir("project//pj-1/./x").unwrap(), "project/pj-1/x");
        assert_eq!(normalize_dir("project\\pj-1").unwrap(), "project/pj-1");
        assert_eq!(normalize_dir("").unwrap(), "");
    }

    #[test]
    fn normalize_dir_rejects_escape_and_absolute() {
        assert!(normalize_dir("../etc").is_err());
        assert!(normalize_dir("project/../../x").is_err());
        assert!(normalize_dir("/Users/me/docs").is_err());
        assert!(normalize_dir("C:/docs").is_err());
    }

    #[test]
    fn unique_path_in_lands_in_dir_and_avoids_clash() {
        let root = temp_root("unique");
        let first = unique_path_in(&root, "project/p1/技术方案", "登录 鉴权");
        assert_eq!(first, "project/p1/技术方案/登录-鉴权.md");
        write(&root, &first, "").unwrap();

        let second = unique_path_in(&root, "project/p1/技术方案", "登录 鉴权");
        assert_eq!(second, "project/p1/技术方案/登录-鉴权-2.md");

        /* 同名不同目录不算撞 */
        let other = unique_path_in(&root, "project/p1/会议", "登录 鉴权");
        assert_eq!(other, "project/p1/会议/登录-鉴权.md");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn list_dirs_is_relative_shallow_and_skips_hidden() {
        let root = temp_root("list");
        for dir in ["project/p1", "project/p1/技术方案", "note/learn", ".git/objects"] {
            fs::create_dir_all(root.join(dir)).unwrap();
        }
        assert_eq!(
            list_dirs(&root),
            vec![
                "note".to_string(),
                "note/learn".to_string(),
                "project".to_string(),
                "project/p1".to_string(),
                "project/p1/技术方案".to_string(),
            ]
        );
        let _ = fs::remove_dir_all(&root);
    }
}
