//! 应用级 invoke 命令与集中注册。
//!
//! 新增命令时：在对应业务模块实现后，在 `invoke_handler!` 宏内的列表中追加；在 `lib.rs` 中通过 `.invoke_handler(invoke_handler!())` 注册。

use serde::{Deserialize, Serialize};
use serde_json::{Number, Value};
use tauri::Manager;
use tauri_plugin_shell::ShellExt;

use crate::config;
use crate::core;

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

/// Node 侧车执行结果（app.shell().sidecar("toolbox_node")）
#[derive(Debug, Serialize, Deserialize)]
pub struct NodeRuntimeOutput {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
}

/// 使用 Node 侧车执行，参数同 node 命令行（如 ["-e", "console.log(1)"]）
#[tauri::command]
pub async fn run_node_runtime(app: tauri::AppHandle, args: Vec<String>) -> Result<NodeRuntimeOutput, String> {
    let sidecar = app.shell().sidecar("toolbox_node").map_err(|e| e.to_string())?;
    let output = sidecar
        .args(args)
        .output()
        .await
        .map_err(|e| format!("执行 node 失败: {}", e))?;
    Ok(NodeRuntimeOutput {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        success: output.status.success(),
    })
}

/// 返回 config（settings.json）；若已启动 core 则用其分配端口覆盖 api_port，前端只调此一次即可。
#[tauri::command]
pub fn get_config(app: tauri::AppHandle) -> Value {
    let mut val = config::load_config_json(&app);
    if let Some(ports) = app.try_state::<core::CorePorts>() {
        let api = *ports.api_port.lock().unwrap();
        if let Some(a) = api {
            if let Value::Object(ref mut m) = val {
                m.insert("api_port".into(), Value::Number(Number::from(a)));
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
            $crate::invoke::run_node_runtime,
            $crate::store::store_read,
            $crate::store::store_write,
        ]
    };
}

