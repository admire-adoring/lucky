//! 领域层错误。展示文案直接给到界面，所以写成中文，不暴露 SQL 细节以外的英文。
use std::fmt;

#[derive(Debug)]
pub enum Error {
    /// SQLite 本身的错误（约束、IO、语句）。
    Db(rusqlite::Error),
    /// 数据库文件 / 目录的读写。
    Io(std::io::Error),
    /// 按业务键找不到记录。
    NotFound(String),
    /// 唯一键冲突（机器名已存在）。
    Conflict(String),
    /// 参数不合法。写入路径与 CHECK 约束的同一批规则，提前在这里拦下来。
    Invalid(String),
}

impl Error {
    /// 机器可读的错误类型。壳层把它随文案一起序列化出去，前端按它分支
    /// （冲突不关弹窗、找不到退列表），文案仍给人读。
    pub fn code(&self) -> &'static str {
        match self {
            Error::Db(_) => "db",
            Error::Io(_) => "io",
            Error::NotFound(_) => "notFound",
            Error::Conflict(_) => "conflict",
            Error::Invalid(_) => "invalid",
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Db(e) => write!(f, "数据库错误：{e}"),
            Error::Io(e) => write!(f, "文件错误：{e}"),
            Error::NotFound(what) => write!(f, "找不到{what}"),
            Error::Conflict(what) => write!(f, "{what}"),
            Error::Invalid(what) => write!(f, "{what}"),
        }
    }
}

impl std::error::Error for Error {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            Error::Db(e) => Some(e),
            Error::Io(e) => Some(e),
            _ => None,
        }
    }
}

impl From<rusqlite::Error> for Error {
    fn from(e: rusqlite::Error) -> Self {
        Error::Db(e)
    }
}

impl From<std::io::Error> for Error {
    fn from(e: std::io::Error) -> Self {
        Error::Io(e)
    }
}

pub type Result<T> = std::result::Result<T, Error>;
