//! 应用配置：工程根 `config.toml`，缺失或某节缺失时用内置默认值。
//!
//! 相对路径以工程根为基准解析（编译期 `CARGO_MANIFEST_DIR` 回一层），
//! 配置文件随项目搬家仍指向同一批文件；写绝对路径则原样使用。

use std::path::{Path, PathBuf};

use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(default)]
pub struct Config {
    pub database: DatabaseConfig,
    pub log: LogConfig,
    pub documents: DocumentsConfig,
}

#[derive(Debug, Deserialize)]
#[serde(default)]
pub struct DatabaseConfig {
    pub path: PathBuf,
}

#[derive(Debug, Deserialize)]
#[serde(default)]
pub struct LogConfig {
    pub level: String,
    pub file: PathBuf,
}

/// 文档正文（`.md`）的根目录。库只存索引，正文是文件 —— 见 `全局架构.md` §三。
#[derive(Debug, Deserialize)]
#[serde(default)]
pub struct DocumentsConfig {
    pub root: PathBuf,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            database: DatabaseConfig::default(),
            log: LogConfig::default(),
            documents: DocumentsConfig::default(),
        }
    }
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self { path: PathBuf::from("db/lucky-y.sqlite3") }
    }
}

impl Default for LogConfig {
    fn default() -> Self {
        Self { level: "info".to_string(), file: PathBuf::from("db/app.log") }
    }
}

impl Default for DocumentsConfig {
    fn default() -> Self {
        Self { root: PathBuf::from("documents") }
    }
}

fn project_root() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("..")
}

fn resolve(p: &Path) -> PathBuf {
    if p.is_absolute() { p.to_path_buf() } else { project_root().join(p) }
}

impl Config {
    /// 读工程根 config.toml；文件不存在 ⇒ 整体走默认值，不挡启动。
    pub fn load() -> Result<Self, Box<dyn std::error::Error>> {
        let file = project_root().join("config.toml");
        if !file.exists() {
            return Ok(Config::default());
        }
        let raw = std::fs::read_to_string(&file)?;
        Ok(toml::from_str(&raw)?)
    }

    pub fn database_path(&self) -> PathBuf {
        resolve(&self.database.path)
    }

    /// 文档正文根目录。目录本身由文档仓储按需创建（`<root>/<projectId>/`）。
    pub fn documents_root(&self) -> PathBuf {
        resolve(&self.documents.root)
    }
}

/// 按配置初始化日志：追加写单文件，级别经 EnvFilter 解析（`error`…`trace`）。
pub fn init_log(cfg: &LogConfig) {
    let file = resolve(&cfg.file);
    if let Some(dir) = file.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let appender = tracing_appender::rolling::never(
        file.parent().unwrap_or(Path::new(".")),
        file.file_name().unwrap_or_default(),
    );
    let _ = tracing_subscriber::fmt()
        .with_writer(appender)
        .with_env_filter(tracing_subscriber::EnvFilter::new(&cfg.level))
        .try_init();
}
