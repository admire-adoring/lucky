//! Lucky-Y 领域层。
//!
//! 不 import `tauri`、`serde_json` 等传输层类型，只依赖 `rusqlite` 与 `serde`
//! 的序列化派生。将来加 HTTP 入口时把本目录拆回独立 crate，代码零改动。
//!
//! 表结构的唯一事实源是 `design/sql-design/` 下的 DDL，`db::MIGRATIONS`
//! 用 `include_str!` 直接引用那三份文件，不另存副本。

pub mod db;
pub mod error;
pub mod project;
pub mod srv;
pub mod store;
pub mod task;

mod id;

// 重导出是领域层的公共面：命令层只消费一部分，其余留给将来的 HTTP 入口与测试。
#[allow(unused_imports)]
pub use error::{Error, Result};
#[allow(unused_imports)]
pub use project::{DocContent, Document, DocumentInput, Project, ProjectInput, ProjectRisk};
#[allow(unused_imports)]
pub use srv::{
    DeployDoc, DeployDocInput, DeployRelease, DeployReleaseInput, Server, ServerInput, ServerPath,
    ServerPathInput, ServerPort, ServerProjectRef, ServerReleaseCount,
};
pub use store::Store;
#[allow(unused_imports)]
pub use task::{Task, TaskInput};
