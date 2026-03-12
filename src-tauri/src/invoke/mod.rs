//! 应用级 invoke 命令与集中注册。
//!
//! 新增命令时：在对应业务模块实现后，在 `invoke_handler!` 宏内的列表中追加；在 `lib.rs` 中通过 `.invoke_handler(invoke_handler!())` 注册。

use serde::{Deserialize, Serialize};
use serde_json::{Number, Value};
use std::process::Command;
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

/// Node Runtime 执行结果（resources 内 help/nodeRuntime 的 node/npm）
#[derive(Debug, Serialize, Deserialize)]
pub struct NodeRuntimeOutput {
    pub stdout: String,
    pub stderr: String,
    pub success: bool,
}

fn node_runtime_bin_dir(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let bin_dir = app
        .path()
        .resource_dir()
        .ok()
        .map(|d| d.join("help").join("nodeRuntime").join("bin"));
    let bin_dir = match bin_dir {
        Some(ref d) if d.exists() => d.clone(),
        _ => {
            // 开发环境：resources 可能尚未复制，回退到 src-tauri/help/nodeRuntime/bin
            let fallback = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .join("help")
                .join("nodeRuntime")
                .join("bin");
            if fallback.exists() {
                fallback
            } else {
                return Err(format!(
                    "Node Runtime 未找到（已尝试 resource_dir 与 CARGO_MANIFEST_DIR/help/nodeRuntime/bin）"
                ));
            }
        }
    };
    Ok(bin_dir)
}

/// 使用 resources 内 help/nodeRuntime 的 node 执行，参数同 node 命令行（如 ["-e", "console.log(1)"]）
#[tauri::command]
pub fn run_node_runtime(app: tauri::AppHandle, args: Vec<String>) -> Result<NodeRuntimeOutput, String> {
    let bin_dir = node_runtime_bin_dir(&app)?;
    let node_exe = bin_dir.join(if cfg!(target_os = "windows") { "node.exe" } else { "node" });
    if !node_exe.exists() {
        return Err(format!("node 可执行文件未找到: {}", node_exe.display()));
    }
    let output = Command::new(&node_exe)
        .args(args)
        .env("PATH", {
            let path = std::env::var("PATH").unwrap_or_default();
            let sep = if cfg!(target_os = "windows") { ";" } else { ":" };
            format!("{}{}{}", bin_dir.display(), sep, path)
        })
        .current_dir(&bin_dir)
        .output()
        .map_err(|e| format!("执行 node 失败: {}", e))?;
    Ok(NodeRuntimeOutput {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        success: output.status.success(),
    })
}

/// 使用 resources 内 help/nodeRuntime 的 npm 执行，参数同 npm 命令行（如 ["--version"]）。
/// 通过 node 执行 npm-cli.js，避免 Node 24 将 npm 入口当作 ESM 导致 require 报错。
#[tauri::command]
pub fn run_npm_runtime(app: tauri::AppHandle, args: Vec<String>) -> Result<NodeRuntimeOutput, String> {
    let bin_dir = node_runtime_bin_dir(&app)?;
    let node_exe = bin_dir.join(if cfg!(target_os = "windows") { "node.exe" } else { "node" });
    let npm_cli_js = bin_dir
        .parent()
        .ok_or("nodeRuntime bin 父路径无效")?
        .join("lib")
        .join("node_modules")
        .join("npm")
        .join("bin")
        .join("npm-cli.js");
    if !node_exe.exists() {
        return Err(format!("node 可执行文件未找到: {}", node_exe.display()));
    }
    if !npm_cli_js.exists() {
        return Err(format!("npm-cli.js 未找到: {}", npm_cli_js.display()));
    }
    let mut node_args = vec![npm_cli_js.to_string_lossy().into_owned()];
    node_args.extend(args);
    let output = Command::new(&node_exe)
        .args(node_args)
        .env("PATH", {
            let path = std::env::var("PATH").unwrap_or_default();
            let sep = if cfg!(target_os = "windows") { ";" } else { ":" };
            format!("{}{}{}", bin_dir.display(), sep, path)
        })
        .current_dir(bin_dir.parent().unwrap_or(&bin_dir))
        .output()
        .map_err(|e| format!("执行 npm 失败: {}", e))?;
    Ok(NodeRuntimeOutput {
        stdout: String::from_utf8_lossy(&output.stdout).into_owned(),
        stderr: String::from_utf8_lossy(&output.stderr).into_owned(),
        success: output.status.success(),
    })
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
            $crate::invoke::run_node_runtime,
            $crate::invoke::run_npm_runtime,
            $crate::store::store_read,
            $crate::store::store_write,
        ]
    };
}

