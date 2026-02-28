//! 应用级 invoke 命令与集中注册。
//!
//! 新增命令时：在对应业务模块实现后，在 `invoke_handler!` 宏内的列表中追加；在 `lib.rs` 中通过 `.invoke_handler(invoke_handler!())` 注册。

use serde_json::{Number, Value};
use tauri::Manager;

use crate::config;
use crate::sidecar;

/// 应用级命令（可后续拆到 `app` 子模块）
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// 返回当前操作系统：macos、windows、linux 等
#[tauri::command]
pub fn get_platform() -> &'static str {
    std::env::consts::OS
}

/// 返回 config（settings.json）；若已启动 sidecar 则用其分配端口覆盖 api_port / pty_port，前端只调此一次即可。
#[tauri::command]
pub fn get_config(app: tauri::AppHandle) -> Value {
    let mut val = config::load_config_json(&app);
    if let Some(ports) = app.try_state::<sidecar::SidecarPorts>() {
        let api = *ports.api_port.lock().unwrap();
        let pty = *ports.pty_port.lock().unwrap();
        if let (Some(a), Some(p)) = (api, pty) {
            if let Value::Object(ref mut m) = val {
                m.insert("api_port".into(), Value::Number(Number::from(a)));
                m.insert("pty_port".into(), Value::Number(Number::from(p)));
            }
        }
    }
    val
}

/// 集中列出所有 invoke 命令，展开为 `generate_handler![...]`，供 `lib.rs` 使用。
/// 避免在 lib 中手写一长串，且不依赖未导出的 `tauri::Wry` 等类型。
#[macro_export]
macro_rules! invoke_handler {
    () => {
        tauri::generate_handler![
            $crate::invoke::greet,
            $crate::invoke::get_platform,
            $crate::invoke::get_config,
            $crate::store::store_read,
            $crate::store::store_write,
        ]
    };
}

