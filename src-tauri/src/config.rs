//! 配置：读 settings.json 文本，缺键补占位默认（数字 0、字符串 ""）后当 JSON 发给前端。
//! 各 getter 在取到时再做「保证运行」的 fallback，避免与真实配置歧义。

use serde_json::{Map, Number, Value};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

const SETTINGS_RESOURCE_PATH: &str = "config/settings.json";

/// 占位默认：数字 0、字符串 ""，仅表示「未配置」，不做业务含义。
fn default_json() -> Value {
    let mut m = Map::new();
    m.insert("sqlite_db_name".into(), Value::String(String::new()));
    m.insert("api_port".into(), Value::Number(Number::from(0)));
    m.insert("pty_port".into(), Value::Number(Number::from(0)));
    m.insert("store_name".into(), Value::String(String::new()));
    Value::Object(m)
}

/// 供 get_config 命令与内部使用；仅读文件，不合并 runtime 端口。
pub fn load_config_json(app: &AppHandle) -> Value {
    let path = match app
        .path()
        .resolve(SETTINGS_RESOURCE_PATH, BaseDirectory::Resource)
    {
        Ok(p) => p,
        Err(_) => return default_json(),
    };
    let s = match std::fs::read_to_string(&path) {
        Ok(x) => x,
        Err(_) => return default_json(),
    };
    let mut obj: Map<String, Value> = match serde_json::from_str(&s) {
        Ok(Value::Object(m)) => m,
        _ => return default_json(),
    };
    obj.entry("sqlite_db_name")
        .or_insert_with(|| Value::String(String::new()));
    obj.entry("api_port")
        .or_insert_with(|| Value::Number(Number::from(0)));
    obj.entry("pty_port")
        .or_insert_with(|| Value::Number(Number::from(0)));
    obj.entry("store_name")
        .or_insert_with(|| Value::String(String::new()));
    Value::Object(obj)
}

/// 供 sidecar 等内部使用。配置为空时 fallback 为 app.db 以保证运行。
pub fn get_sqlite_db_name(app: &AppHandle) -> String {
    load_config_json(app)
        .get("sqlite_db_name")
        .and_then(Value::as_str)
        .filter(|s| !s.trim().is_empty())
        .map(String::from)
        .unwrap_or_else(|| "app.db".to_string())
}

/// 供 sidecar 等内部使用。配置为 0 或缺失时 fallback 为 8264 以保证运行。
pub fn get_api_port(app: &AppHandle) -> u16 {
    load_config_json(app)
        .get("api_port")
        .and_then(Value::as_u64)
        .map(|n| n as u16)
        .filter(|&n| n != 0)
        .unwrap_or(8264)
}

/// 供 sidecar 等内部使用。配置为 0 或缺失时 fallback 为 8265 以保证运行。
pub fn get_pty_port(app: &AppHandle) -> u16 {
    load_config_json(app)
        .get("pty_port")
        .and_then(Value::as_u64)
        .map(|n| n as u16)
        .filter(|&n| n != 0)
        .unwrap_or(8265)
}

/// 供 sidecar 等内部使用；与 app.db 同目录的 Tauri Store 文件名。配置为空时 fallback 为 store.bin。
pub fn get_store_name(app: &AppHandle) -> String {
    load_config_json(app)
        .get("store_name")
        .and_then(Value::as_str)
        .filter(|s| !s.trim().is_empty())
        .map(String::from)
        .unwrap_or_else(|| "store.bin".to_string())
}
