//! Tauri Store 的 invoke 封装：一次调用完成 load + get/set + save，供前端统一使用。

use std::path::Path;
use serde_json::Value as JsonValue;
use tauri::AppHandle;
use tauri_plugin_store::StoreExt;

/// 从 Tauri Store 读取指定 path 下 key 的值，一次 invoke 完成 load + get。
#[tauri::command]
pub fn store_read(
    app: AppHandle<tauri::Wry>,
    path: String,
    key: String,
) -> Result<Option<JsonValue>, String> {
    let store = app.store(Path::new(&path)).map_err(|e| e.to_string())?;
    let value = store.get(key.as_str());
    value
        .map(|v| {
            let s = serde_json::to_string(&v).map_err(|e| e.to_string())?;
            serde_json::from_str(&s).map_err(|e| e.to_string())
        })
        .transpose()
}

/// 向 Tauri Store 写入指定 path 下 key 的值并落盘，一次 invoke 完成 load + set + save。
#[tauri::command]
pub fn store_write(
    app: AppHandle<tauri::Wry>,
    path: String,
    key: String,
    value: JsonValue,
) -> Result<(), String> {
    let store = app.store(Path::new(&path)).map_err(|e| e.to_string())?;
    store.set(key, value);
    store.save().map_err(|e| e.to_string())?;
    Ok(())
}
