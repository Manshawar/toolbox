//! 配置：通过 IPC 暴露给前端。优先读打包进应用的 settings.json（bundle.resources），再回退到默认。

use serde::{Deserialize, Serialize};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

const DEFAULT_SQLITE_DB_NAME: &str = "test.db";
const SETTINGS_RESOURCE_PATH: &str = "resource/settings.json";

#[derive(Debug, Deserialize)]
struct SettingsFile {
    #[serde(default)]
    sqlite_db_name: Option<String>,
}

/// 从打包进应用的 settings.json（bundle.resources）读取
fn sqlite_db_name_from_resource(app: &AppHandle) -> Option<String> {
    let path = app.path().resolve(SETTINGS_RESOURCE_PATH, BaseDirectory::Resource).ok()?;
    let s = std::fs::read_to_string(&path).ok()?;
    let settings: SettingsFile = serde_json::from_str(&s).ok()?;
    settings
        .sqlite_db_name
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
}

/// 前端常用配置项（settings.json → 默认值）
#[derive(Debug, Serialize)]
pub struct AppConfig {
    pub sqlite_db_name: String,
}

/// 供 Rust 内部使用（如 sidecar）：从 resource/settings.json 取 SQLite 库文件名，与 get_config 一致。
pub fn get_sqlite_db_name(app: &AppHandle) -> String {
    sqlite_db_name_from_resource(app)
        .unwrap_or_else(|| DEFAULT_SQLITE_DB_NAME.to_string())
}

/// 读取当前配置，供前端 invoke 使用。来源：打包的 settings.json（bundle.resources），否则默认值。
#[tauri::command]
pub fn get_config(app: AppHandle) -> AppConfig {
    let sqlite_db_name = get_sqlite_db_name(&app);
    AppConfig { sqlite_db_name }
}
