//! Lucky-Y 桌面应用，Tauri v2 官方布局。
//!
//! 本文件是命令层：创建窗口、注册命令、把命令转发给领域层。
//! 业务逻辑一律在 `src/server/`，那一层不 import tauri，
//! 将来加 HTTP 入口时把目录拆回独立 crate 即可。
//!
//! 数据库落在应用数据目录下的 `lucky-y.sqlite3`：命令层解析路径与建目录，
//! 领域层只收一个 `Path`。

mod server;

use server::{
    DeployDoc, DeployDocInput, DeployRelease, DeployReleaseInput, Server, ServerInput,
    ServerReleaseCount, Store, srv,
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            app.manage(Store::open(dir.join("lucky-y.sqlite3"))?);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            srv_list, srv_get, srv_create, srv_update, srv_remove, srv_delete,
            srv_release_list_by_project, srv_release_last, srv_release_counts,
            srv_release_create, srv_release_update, srv_release_delete,
            srv_doc_list, srv_doc_create, srv_doc_update, srv_doc_delete
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
