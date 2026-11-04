//! 文档正文的文件层：路径、读写、内容指纹。
//!
//! 正文是文件、索引是库 —— 这一层只管文件那一半，不碰 SQL。
//! 布局：`<documents 根>/<owner_kind>/<owner_id>/<文件名>.md`，
//! 相对根目录的那一段就是库里的 `file_path`。
//! 按宿主分目录：同一宿主的文档聚在一起，删宿主时整目录可回收，不同宿主的同名文件不撞。
//! 宿主目录只是**默认落点** —— 新建时给 `dir` 就按它落（同一宿主下再分子目录，如「技术方案 /」）。
//!
//! `file_path` 有两种形态，靠"是不是绝对路径"区分，不需要额外标记：
//!   · 相对路径 = 托管在文档根里的文件（删文档时连文件一起收）
//!   · 绝对路径 = 绑定本机已有的 `.md`（正文就是那个文件本身，删文档只解绑、不删它）
use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::server::error::{Error, Result};

/// 文件名：保留字母与中日韩字符，其余（空格、标点、斜杠）折成一个 `-`。
/// 空名退成 `untitled.md` —— 重名由 `unique_file_in` 补序号。
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

/// 目录里重名时的文件名：`名字.md` → `名字-2.md`。
fn unique_file_in(dir: &Path, name: &str) -> String {
    let base = file_name(name);
    let stem = base.trim_end_matches(".md").to_string();
    let mut candidate = base.clone();
    let mut n = 2;
    while dir.join(&candidate).exists() {
        candidate = format!("{stem}-{n}.md");
        n += 1;
    }
    candidate
}

/// 存放目录 → 入库用的落点。
///
/// 目录可以是相对文档根的一段（`project/p1/技术方案`），也可以是绝对路径
/// （选择器里挑到了根外的文件夹）。落点仍在根内 ⇒ 返回相对根的一段；
/// 在根外 ⇒ 返回绝对路径，与"绑定已有文件"同一种存法。
pub fn dest_for(root: &Path, dir: &str, name: &str) -> Result<String> {
    let raw = dir.trim();
    let target = if raw.is_empty() {
        root.to_path_buf()
    } else if Path::new(raw).is_absolute() {
        clean_path(Path::new(raw))
    } else {
        root.join(normalize_dir(raw)?)
    };
    let target = clean_path(&target);
    let file = unique_file_in(&target, name);
    let full = target.join(&file);
    /* 比前缀之前先解一次符号链接：macOS 的 `/var` 指向 `/private/var`，
       选择器给的是真实路径，而配置里的根可能是链接那一条 —— 不解会误判成"根外"。 */
    let root_norm = fs::canonicalize(root).unwrap_or_else(|_| clean_path(root));
    let full_norm = fs::canonicalize(&target)
        .map(|t| t.join(&file))
        .unwrap_or_else(|_| full.clone());
    match full_norm.strip_prefix(&root_norm) {
        Ok(rel) => Ok(rel.to_string_lossy().replace('\\', "/")),
        Err(_) => Ok(full.to_string_lossy().replace('\\', "/")),
    }
}

/// 去掉 `.` 与多余的尾分隔符，留下可比较的路径（不碰盘、不解析符号链接）。
fn clean_path(path: &Path) -> PathBuf {
    let mut out = PathBuf::new();
    for part in path.components() {
        if let Component::CurDir = part {
            continue;
        }
        out.push(part.as_os_str());
    }
    out
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

/// 选择器列表里的一行。时间给毫秒戳，怎么写成"今天 10:02"是界面的事。
#[derive(Debug, Clone)]
pub struct Entry {
    pub name: String,
    /// 绝对路径
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
    pub modified: i64,
    /// 文件夹里的项数（截图里那个"1 项"）
    pub items: usize,
}

/// 一次浏览的结果：当前目录、上一级、两个常用入口、目录里的条目。
#[derive(Debug, Clone)]
pub struct Listing {
    pub path: String,
    pub parent: Option<String>,
    pub home: String,
    pub root: String,
    pub entries: Vec<Entry>,
}

/// 一次最多列这么多 —— 再多的目录也不是用来挑的，列表只会卡。
const MAX_ENTRIES: usize = 500;

/// 浏览本机目录：只列文件夹与 `.md`。这一栏是给文档正文挑家的，
/// 别的文件选进来也读不成正文，列出来只会误导。
pub fn browse(root: &Path, at: Option<&str>) -> Result<Listing> {
    let home = std::env::var("HOME").unwrap_or_else(|_| "/".to_string());
    let start = match at.map(str::trim).filter(|s| !s.is_empty()) {
        Some(p) if p == "~" => PathBuf::from(&home),
        Some(p) => match p.strip_prefix("~/") {
            Some(rest) => PathBuf::from(&home).join(rest),
            None => PathBuf::from(p),
        },
        None => root.to_path_buf(),
    };
    let dir = match fs::canonicalize(&start) {
        Ok(path) if path.is_dir() => path,
        Ok(_) => return Err(Error::Invalid(format!("不是一个文件夹：{}", start.display()))),
        /* 还没建出来的目录：新建项目的第一篇就是这样（宿主目录要等第一份正文落盘才存在）。
           只对文档根之内的路径开这个口子 —— 根外的地方要真存在，免得手抖打成别的路径
           也照样列出一张空表、还让人在那儿新建。 */
        Err(_) if inside(root, &start) && creatable(&start) => {
            return Ok(Listing {
                path: start.display().to_string(),
                parent: start.parent().map(|p| p.display().to_string()),
                home,
                root: root.display().to_string(),
                entries: Vec::new(),
            })
        }
        Err(_) => return Err(Error::NotFound(format!("目录 {}", start.display()))),
    };
    if !dir.is_dir() {
        return Err(Error::Invalid(format!("不是一个文件夹：{}", dir.display())));
    }

    let mut entries: Vec<Entry> = Vec::new();
    if let Ok(read) = fs::read_dir(&dir) {
        for item in read.flatten() {
            if entries.len() >= MAX_ENTRIES {
                break;
            }
            let Ok(name) = item.file_name().into_string() else { continue };
            if name.starts_with('.') {
                continue;
            }
            let Ok(meta) = item.metadata() else { continue };
            let path = item.path();
            let is_dir = meta.is_dir();
            if !is_dir && !is_markdown(&name) {
                continue;
            }
            entries.push(Entry {
                name,
                path: path.display().to_string(),
                is_dir,
                size: if is_dir { 0 } else { meta.len() },
                modified: millis(meta.modified()),
                items: if is_dir { count_items(&path) } else { 0 },
            });
        }
    }
    /* 文件夹在前、各自按名字排 —— 与 Finder 的列法一致 */
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });

    Ok(Listing {
        path: dir.display().to_string(),
        parent: dir.parent().map(|p| p.display().to_string()),
        home,
        root: root.display().to_string(),
        entries,
    })
}

fn is_markdown(name: &str) -> bool {
    let lower = name.to_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown")
}

/// 这条路径还建得出来吗：往上找到最近的一层祖先，它得是个存在的目录。
fn creatable(path: &Path) -> bool {
    let mut cur = path.parent();
    for _ in 0..16 {
        let Some(dir) = cur else { return false };
        match fs::metadata(dir) {
            Ok(meta) => return meta.is_dir(),
            Err(_) => cur = dir.parent(),
        }
    }
    false
}

/// 路径是否落在文档根之内。
/// 两处都比：原文（词法）与解链接后的真实路径 —— macOS 的 `/var` 指向 `/private/var`，
/// 只比原文会把根内的路径判成根外。
fn inside(root: &Path, path: &Path) -> bool {
    let mut roots = vec![clean_path(root)];
    if let Ok(real) = fs::canonicalize(root) {
        roots.push(real);
    }

    let mut candidates = vec![clean_path(path)];
    if let (Some(parent), Some(name)) = (path.parent(), path.file_name()) {
        if let Ok(real_parent) = fs::canonicalize(parent) {
            candidates.push(real_parent.join(name));
        }
    }

    candidates
        .iter()
        .any(|c| roots.iter().any(|r| !r.as_os_str().is_empty() && c.starts_with(r)))
}

fn count_items(dir: &Path) -> usize {
    fs::read_dir(dir)
        .map(|read| {
            read.flatten()
                .filter(|e| {
                    e.file_name()
                        .to_str()
                        .map(|n| !n.starts_with('.'))
                        .unwrap_or(false)
                })
                .count()
        })
        .unwrap_or(0)
}

fn millis(time: std::io::Result<std::time::SystemTime>) -> i64 {
    time.ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

/// 内容指纹：FNV-1a 64 位，十六进制 16 位。///
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

/// 外部绑定：`file_path` 是绝对路径 ⇒ 正文就是本机上那个文件本身。
pub fn is_external(file_path: &str) -> bool {
    Path::new(file_path).is_absolute()
}

/// `file_path` → 绝对路径。托管的拼到文档根下，外部绑定的原样用。
/// 两种都挡 `..`：不管路径从哪儿来，越界一律拒。
pub fn resolve(root: &Path, file_path: &str) -> Result<PathBuf> {
    let rel = Path::new(file_path);
    if rel.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(Error::Invalid(format!("文档路径不合法：{file_path}")));
    }
    if rel.is_absolute() {
        Ok(rel.to_path_buf())
    } else {
        Ok(root.join(rel))
    }
}

pub fn read(root: &Path, file_path: &str) -> Result<String> {
    let path = resolve(root, file_path)?;
    fs::read_to_string(&path).map_err(|e| match e.kind() {
        std::io::ErrorKind::NotFound => Error::NotFound(format!("文档正文 {}", path.display())),
        _ => Error::Io(e),
    })
}

/// 原子写：先写同目录下的 `xxx.md.tmp`，再 `rename` 覆盖。
/// 直接 `fs::write` 写到一半崩掉会把正文截成半截 —— 而它往往是用户唯一的一份。
pub fn write(root: &Path, file_path: &str, content: &str) -> Result<()> {
    let path = resolve(root, file_path)?;
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir)?;
    }
    let tmp = path.with_extension("md.tmp");
    fs::write(&tmp, content)?;
    fs::rename(&tmp, &path)?;
    Ok(())
}

/// 删文件。文件已经不在 = 目标已达成，不算错。
///
/// 外部绑定的不删：那个文件本来就在用户自己的目录里，删一条索引不该把它的原件带走。
pub fn remove(root: &Path, file_path: &str) -> Result<()> {
    if is_external(file_path) {
        return Ok(());
    }
    let path = resolve(root, file_path)?;
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
    fn dest_for_lands_in_dir_and_avoids_clash() {
        let root = temp_root("dest");
        let first = dest_for(&root, "project/p1/技术方案", "登录 鉴权").unwrap();
        assert_eq!(first, "project/p1/技术方案/登录-鉴权.md");
        write(&root, &first, "").unwrap();

        let second = dest_for(&root, "project/p1/技术方案", "登录 鉴权").unwrap();
        assert_eq!(second, "project/p1/技术方案/登录-鉴权-2.md");

        /* 同名不同目录不算撞 */
        let other = dest_for(&root, "project/p1/会议", "登录 鉴权").unwrap();
        assert_eq!(other, "project/p1/会议/登录-鉴权.md");
        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn dest_for_keeps_paths_outside_root_absolute() {
        let root = temp_root("outside/root");
        let outside = temp_root("outside/linked");

        /* 根内的绝对目录 ⇒ 仍然存相对根，跟着"删宿主收目录"那套走 */
        let inside = dest_for(&root, &root.join("project/p1/技术方案").display().to_string(), "纪要").unwrap();
        assert_eq!(inside, "project/p1/技术方案/纪要.md");

        /* 根外 ⇒ 绝对路径（与绑定已有文件同一种存法） */
        let out = dest_for(&root, &outside.display().to_string(), "纪要").unwrap();
        assert_eq!(out, format!("{}/纪要.md", outside.display()));

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

    #[test]
    fn remove_leaves_external_files_alone() {
        let root = temp_root("remove");
        let outside = temp_root("remove-linked");
        let file = outside.join("notes.md");
        fs::write(&file, "# 笔记").unwrap();

        remove(&root, file.to_str().unwrap()).unwrap();
        assert!(file.exists(), "绑定的是用户自己的文件，删索引不能把它带走");

        let managed = dest_for(&root, "project/p1", "纪要").unwrap();
        write(&root, &managed, "").unwrap();
        remove(&root, &managed).unwrap();
        assert!(!root.join(&managed).exists());

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

    #[test]
    fn read_and_write_work_on_bound_files() {
        let root = temp_root("bound");
        let outside = temp_root("bound-linked");
        let file = outside.join("记要.md");
        fs::write(&file, "# 旧的").unwrap();

        let abs = file.to_str().unwrap();
        assert_eq!(read(&root, abs).unwrap(), "# 旧的");
        write(&root, abs, "# 新的").unwrap();
        assert_eq!(fs::read_to_string(&file).unwrap(), "# 新的");

        let _ = fs::remove_dir_all(&root);
        let _ = fs::remove_dir_all(&outside);
    }

    #[test]
    fn browse_lists_folders_and_markdown_only() {
        let root = temp_root("browse");
        fs::create_dir_all(root.join("技术方案")).unwrap();
        fs::create_dir_all(root.join(".git")).unwrap();
        fs::write(root.join("技术方案/登录.md"), "# 登录").unwrap();
        fs::write(root.join("readme.md"), "# 说明").unwrap();
        fs::write(root.join("pay-api.jar"), "x").unwrap();
        fs::write(root.join(".DS_Store"), "x").unwrap();

        let listing = browse(&root, None).unwrap();
        let names: Vec<&str> = listing.entries.iter().map(|e| e.name.as_str()).collect();
        assert_eq!(names, vec!["技术方案", "readme.md"], "文件夹在前；jar 与隐藏项都不列");
        assert_eq!(listing.entries[0].items, 1);

        /* 往上走一层 */
        let up = browse(&root, listing.parent.as_deref()).unwrap();
        assert!(up.entries.iter().all(|e| !e.name.is_empty()));
        /* 根内还没建的一层：当作空文件夹（新建项目的第一篇就是这样） */
        let pending = root.join("project/p1");
        let empty = browse(&root, Some(pending.to_str().unwrap())).unwrap();
        assert!(empty.entries.is_empty());
        assert_eq!(empty.path, pending.to_str().unwrap());

        /* 不存在 / 不是文件夹 */
        assert!(browse(&root, Some("/no/such/dir")).is_err());
        assert!(browse(&root, Some("/etc/hosts")).is_err());

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
