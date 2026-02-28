//! 配置：读 settings.json 文本，缺键补默认后当 JSON 发给前端，无单独类型。

use serde_json::{Map, Number, Value};
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

const SETTINGS_RESOURCE_PATH: &str = "resource/settings.json";

fn default_json() -> Value {
    let mut m = Map::new();
    m.insert("sqlite_db_name".into(), Value::String("test.db".into()));
    m.insert("api_port".into(), Value::Number(Number::from(8264)));
    m.insert("pty_port".into(), Value::Number(Number::from(8265)));
    Value::Object(m)
}

/// 供 get_config 命令与内部使用；仅读文件，不合并 runtime 端口。
pub fn load_config_json(app: &AppHandle) -> Value {
    let path = match app.path().resolve(SETTINGS_RESOURCE_PATH, BaseDirectory::Resource) {
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
        .or_insert_with(|| Value::String("test.db".into()));
    obj.entry("api_port")
        .or_insert_with(|| Value::Number(Number::from(8264)));
    obj.entry("pty_port")
        .or_insert_with(|| Value::Number(Number::from(8265)));
    Value::Object(obj)
}

/// 供 sidecar 等内部使用
pub fn get_sqlite_db_name(app: &AppHandle) -> String {
    load_config_json(app)
        .get("sqlite_db_name")
        .and_then(Value::as_str)
        .filter(|s| !s.trim().is_empty())
        .unwrap_or("test.db")
        .to_string()
}

/// 供 sidecar 等内部使用
pub fn get_api_port(app: &AppHandle) -> u16 {
    load_config_json(app)
        .get("api_port")
        .and_then(Value::as_u64)
        .map(|n| n as u16)
        .unwrap_or(8264)
}

/// 供 sidecar 等内部使用
pub fn get_pty_port(app: &AppHandle) -> u16 {
    load_config_json(app)
        .get("pty_port")
        .and_then(Value::as_u64)
        .map(|n| n as u16)
        .unwrap_or(8265)
}
