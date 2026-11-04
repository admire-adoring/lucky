//! 项目目录里的 HTML（流程图 / 架构图那一类产物）。
//!
//! 只做两件事：**列出**、**校验并给出绝对路径**。开窗口是壳层的事 ——
//! 这一层不许 `use tauri`（项目红线），拿不到 `AppHandle` 也就不该知道窗口长什么样。
//!
//! 安全边界：只认项目目录（`project.path`）**之内**的 `.html`。
//! 这条校验是必须的 —— 前端传来的是相对路径，放行 `../` 就能打开任意文件。
use std::fs;
use std::path::{Component, Path, PathBuf};

use rusqlite::Connection;

use crate::server::error::{Error, Result};

/// 一个可打开的 HTML。`rel` 是相对项目目录的路径（前端原样传回来）。
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HtmlFile {
    pub rel: String,
    pub name: String,
    pub size: u64,
    /// 修改时刻（Unix 秒）。**格式化交给前端** —— 后端自己算时区要么引 `chrono`，
    /// 要么按 UTC 显示（差 8 小时，"刚改的图显示成昨天"）。`new Date(secs * 1000)` 是本地时区。
    pub mtime: u64,
}

/// 项目目录（`project.path`）。没填就明确说"这个项目没有本地目录"，
/// 不要退化成 home 或空目录 —— 那会让"列文件"看起来像坏了。
fn project_dir(conn: &Connection, project_id: &str) -> Result<PathBuf> {
    let path: Option<String> = conn
        .query_row("SELECT path FROM project WHERE id = ?1", [project_id], |row| row.get(0))
        .map_err(|_| Error::NotFound(format!("项目 {project_id}")))?;
    let raw = path.unwrap_or_default();
    if raw.trim().is_empty() {
        return Err(Error::Invalid("这个项目还没有填本地目录（项目设置 → 本地目录）".into()));
    }
    let dir = PathBuf::from(raw.trim());
    if !dir.is_dir() {
        return Err(Error::Invalid(format!("项目目录不存在：{}", dir.display())));
    }
    Ok(dir)
}

/// 列 HTML：项目目录一层 + 一层子目录（够装 `diagrams/` 这种约定俗成的分类）。
pub fn list(conn: &Connection, project_id: &str) -> Result<Vec<HtmlFile>> {
    let dir = project_dir(conn, project_id)?;
    let mut out = Vec::new();
    collect(&dir, &dir, 0, &mut out)?;
    /* 新改的在前 —— 刚画完的那张图应该在最上面 */
    out.sort_by(|a, b| b.mtime.cmp(&a.mtime).then_with(|| a.rel.cmp(&b.rel)));
    Ok(out)
}

fn collect(root: &Path, dir: &Path, depth: u8, out: &mut Vec<HtmlFile>) -> Result<()> {
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return Ok(()), /* 子目录读不了就跳过，不影响别的 */
    };
    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        /* 不往 `node_modules` / `.git` / 构建产物里钻 —— 那里面的 html 不是给人看的 */
        if path.is_dir() {
            if depth == 0 && !name.starts_with('.') && name != "node_modules" && name != "dist" {
                collect(root, &path, 1, out)?;
            }
            continue;
        }
        let ext = path.extension().and_then(|e| e.to_str()).unwrap_or_default();
        if !ext.eq_ignore_ascii_case("html") && !ext.eq_ignore_ascii_case("htm") {
            continue;
        }
        let rel = path
            .strip_prefix(root)
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|_| name.clone());
        let meta = entry.metadata().ok();
        out.push(HtmlFile {
            rel,
            name,
            size: meta.as_ref().map(|m| m.len()).unwrap_or(0),
            mtime: meta
                .and_then(|m| m.modified().ok())
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_secs())
                .unwrap_or(0),
        });
    }
    Ok(())
}

/// 校验并给出绝对路径。**只放行项目目录内、扩展名是 html 的文件**。
pub fn resolve(conn: &Connection, project_id: &str, rel: &str) -> Result<PathBuf> {
    let dir = project_dir(conn, project_id)?;
    let rel_path = Path::new(rel);
    if rel_path.is_absolute() || rel_path.components().any(|c| matches!(c, Component::ParentDir)) {
        return Err(Error::Invalid(format!("路径不合法：{rel}")));
    }
    let abs = dir.join(rel_path);
    let ext = abs.extension().and_then(|e| e.to_str()).unwrap_or_default();
    if !ext.eq_ignore_ascii_case("html") && !ext.eq_ignore_ascii_case("htm") {
        return Err(Error::Invalid("只能打开 .html / .htm".into()));
    }
    if !abs.is_file() {
        return Err(Error::NotFound(format!("文件不存在：{}", abs.display())));
    }
    Ok(abs)
}
