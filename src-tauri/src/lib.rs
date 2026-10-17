//! Lucky-Y 桌面应用，Tauri v2 官方布局。
//!
//! 本文件是命令层：创建窗口、注册命令、把命令转发给领域层。
//! 业务逻辑一律在 `src/server/`，那一层不 import tauri，
//! 将来加 HTTP 入口时把目录拆回独立 crate 即可。
//!
//! 数据库与日志的路径由工程根 `config.toml` 配置（见 `config.rs`），命令层读配置、
//! 建目录、初始化日志；领域层只收一个 `Path`。

mod config;
mod server;

use server::{
    DocContent, DeployDoc, DeployDocInput, DeployRelease, DeployReleaseInput, Document,
    DocumentInput, Project, ProjectInput, Server, ServerInput, ServerReleaseCount, Store, Task,
    TaskInput, project, srv, task,
};
use serde::Serialize;
use tauri::{Manager, State};

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 命令错误的可序列化形态：`code` 给前端按类型分支（冲突不关弹窗、找不到退列表），
/// `message` 给人读。TS 侧对应 `src/api/error.ts` 的 `ApiError`。
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiError {
    code: &'static str,
    message: String,
}

impl From<server::Error> for ApiError {
    fn from(e: server::Error) -> Self {
        tracing::warn!("命令错误：{}", e);
        ApiError { code: e.code(), message: e.to_string() }
    }
}

/* ============================================================
   服务器台账 · 命令
   ------------------------------------------------------------
   命令只做三件事：取 state、调领域层、把错误转成 ApiError。
   机器的业务键是 `host`（路由 `/work/servers/:host` 用它）；
   发布记录与部署文档没有路由级业务键，直接用 id。
   ============================================================ */

#[tauri::command]
fn srv_list(store: State<'_, Store>) -> Result<Vec<Server>, ApiError> {
    srv::list(&store).map_err(ApiError::from)
}

#[tauri::command]
fn srv_get(store: State<'_, Store>, host: String) -> Result<Server, ApiError> {
    srv::get(&store, &host).map_err(ApiError::from)
}

#[tauri::command]
fn srv_create(store: State<'_, Store>, input: ServerInput) -> Result<Server, ApiError> {
    srv::create(&store, &input).map_err(ApiError::from)
}

/// `host` 是改动前的机器名；`input.host` 可以是新名字。
#[tauri::command]
fn srv_update(store: State<'_, Store>, host: String, input: ServerInput) -> Result<Server, ApiError> {
    srv::update(&store, &host, &input).map_err(ApiError::from)
}

/// 从台账收走（软删）。机器本身不受影响。
#[tauri::command]
fn srv_remove(store: State<'_, Store>, host: String) -> Result<(), ApiError> {
    srv::remove(&store, &host).map_err(ApiError::from)
}

#[tauri::command]
fn srv_delete(store: State<'_, Store>, host: String) -> Result<(), ApiError> {
    srv::delete(&store, &host).map_err(ApiError::from)
}

/* —— 发布记录 —— */

#[tauri::command]
fn srv_release_list_by_project(store: State<'_, Store>, project_id: String) -> Result<Vec<DeployRelease>, ApiError> {
    srv::release_list_by_project(&store, &project_id).map_err(ApiError::from)
}

/// 跨项目的最近一条；一条都没有时回 null。
#[tauri::command]
fn srv_release_last(store: State<'_, Store>) -> Result<Option<DeployRelease>, ApiError> {
    srv::release_last(&store).map_err(ApiError::from)
}

/// 每台机器名下的发布条数（台账徽标）。
#[tauri::command]
fn srv_release_counts(store: State<'_, Store>) -> Result<Vec<ServerReleaseCount>, ApiError> {
    srv::release_counts(&store).map_err(ApiError::from)
}

#[tauri::command]
fn srv_release_create(store: State<'_, Store>, input: DeployReleaseInput) -> Result<DeployRelease, ApiError> {
    srv::release_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn srv_release_update(store: State<'_, Store>, id: String, input: DeployReleaseInput) -> Result<DeployRelease, ApiError> {
    srv::release_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn srv_release_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    srv::release_delete(&store, &id).map_err(ApiError::from)
}

/* —— 部署文档 —— */

#[tauri::command]
fn srv_doc_list(store: State<'_, Store>, project_id: String) -> Result<Vec<DeployDoc>, ApiError> {
    srv::doc_list(&store, &project_id).map_err(ApiError::from)
}

#[tauri::command]
fn srv_doc_create(store: State<'_, Store>, input: DeployDocInput) -> Result<DeployDoc, ApiError> {
    srv::doc_create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn srv_doc_update(store: State<'_, Store>, id: String, input: DeployDocInput) -> Result<DeployDoc, ApiError> {
    srv::doc_update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn srv_doc_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    srv::doc_delete(&store, &id).map_err(ApiError::from)
}

/* ============================================================
   项目 · 执行层「项目」域
   ------------------------------------------------------------
   三个域的 `/x/projects` 入口都走 `project_list`，只是 scope 不同。
   ============================================================ */

#[tauri::command]
fn project_list(store: State<'_, Store>, scope: Option<String>) -> Result<Vec<Project>, ApiError> {
    project::list(&store, scope.as_deref()).map_err(ApiError::from)
}

#[tauri::command]
fn project_get(store: State<'_, Store>, id: String) -> Result<Project, ApiError> {
    project::get(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn project_create(store: State<'_, Store>, input: ProjectInput) -> Result<Project, ApiError> {
    project::create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn project_update(
    store: State<'_, Store>,
    id: String,
    input: ProjectInput,
) -> Result<Project, ApiError> {
    project::update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn project_set_status(
    store: State<'_, Store>,
    id: String,
    status: String,
) -> Result<Project, ApiError> {
    project::set_status(&store, &id, &status).map_err(ApiError::from)
}

#[tauri::command]
fn project_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    project::delete(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn project_log_activity(
    store: State<'_, Store>,
    id: String,
    action: String,
) -> Result<(), ApiError> {
    project::log_activity(&store, &id, &action).map_err(ApiError::from)
}

/* ============================================================
   任务 · 全局层「任务清单」域
   ------------------------------------------------------------
   项目详情页的任务分区也读这里，带上 `projectId` 过滤。
   ============================================================ */

#[tauri::command]
fn task_list(
    store: State<'_, Store>,
    project_id: Option<String>,
    scope: Option<String>,
) -> Result<Vec<Task>, ApiError> {
    task::list(&store, project_id.as_deref(), scope.as_deref()).map_err(ApiError::from)
}

#[tauri::command]
fn task_create(store: State<'_, Store>, input: TaskInput) -> Result<Task, ApiError> {
    task::create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn task_update(store: State<'_, Store>, id: String, input: TaskInput) -> Result<Task, ApiError> {
    task::update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn task_set_state(store: State<'_, Store>, id: String, state: String) -> Result<Task, ApiError> {
    task::set_state(&store, &id, &state).map_err(ApiError::from)
}

#[tauri::command]
fn task_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    task::delete(&store, &id).map_err(ApiError::from)
}

/* ============================================================
   项目文档 · 项目族的文档子域
   ------------------------------------------------------------
   正文两类：local_md 是本地 .md 文件（文件是正文的源，库只存索引与坐标），
   其余三种来源只有在原工具的索引。见 全局架构.md §三 / §九。
   ============================================================ */

#[tauri::command]
fn project_doc_list(store: State<'_, Store>, project_id: String) -> Result<Vec<Document>, ApiError> {
    project::doc::list(&store, &project_id).map_err(ApiError::from)
}

#[tauri::command]
fn project_doc_get(store: State<'_, Store>, id: String) -> Result<Document, ApiError> {
    project::doc::get(&store, &id).map_err(ApiError::from)
}

#[tauri::command]
fn project_doc_create(store: State<'_, Store>, input: DocumentInput) -> Result<Document, ApiError> {
    project::doc::create(&store, &input).map_err(ApiError::from)
}

#[tauri::command]
fn project_doc_update(
    store: State<'_, Store>,
    id: String,
    input: DocumentInput,
) -> Result<Document, ApiError> {
    project::doc::update(&store, &id, &input).map_err(ApiError::from)
}

#[tauri::command]
fn project_doc_delete(store: State<'_, Store>, id: String) -> Result<(), ApiError> {
    project::doc::delete(&store, &id).map_err(ApiError::from)
}

/// 读正文；文件被外部改过时顺带把索引同步掉，`changed` 告诉界面这件事。
#[tauri::command]
fn project_doc_read(store: State<'_, Store>, id: String) -> Result<DocContent, ApiError> {
    project::doc::read(&store, &id).map_err(ApiError::from)
}

/// 写正文；`name` 是编辑器里可能改过的标题（不给就不动索引里的名字）。
#[tauri::command]
fn project_doc_write(
    store: State<'_, Store>,
    id: String,
    content: String,
    name: Option<String>,
) -> Result<Document, ApiError> {
    project::doc::write(&store, &id, &content, name.as_deref()).map_err(ApiError::from)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let config = config::Config::load()?;
            config::init_log(&config.log);
            let db_path = config.database_path();
            if let Some(dir) = db_path.parent() {
                std::fs::create_dir_all(dir)?;
            }
            tracing::info!("启动：数据库 {}", db_path.display());
            app.manage(Store::open(&db_path, config.documents_root())?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            srv_list, srv_get, srv_create, srv_update, srv_remove, srv_delete,
            srv_release_list_by_project, srv_release_last, srv_release_counts,
            srv_release_create, srv_release_update, srv_release_delete,
            srv_doc_list, srv_doc_create, srv_doc_update, srv_doc_delete,
            project_list, project_get, project_create, project_update,
            project_set_status, project_delete, project_log_activity,
            project_doc_list, project_doc_get, project_doc_create, project_doc_update,
            project_doc_delete, project_doc_read, project_doc_write,
            task_list, task_create, task_update, task_set_state, task_delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
