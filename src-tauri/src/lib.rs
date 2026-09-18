//! Lucky-Y 桌面外壳。
//!
//! 这一层只做三件事：创建窗口、注册命令、把命令转发给领域层。
//! 业务逻辑一律写在 `lucky_y_server`（backend/lucky_y_server），
//! 这样领域代码不依赖任何传输层类型，将来要加 HTTP 入口时无需重写。

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

