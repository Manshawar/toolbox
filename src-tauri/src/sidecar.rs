//! 子进程（sidecar）启动与端口管理：检测可用端口，通过环境变量传给 core，通过 invoke 给前端。

use std::sync::Mutex;
use tauri::command;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

/// 应用内保存的 sidecar 端口，供前端 invoke 读取
#[derive(Default)]
pub struct SidecarPorts {
    pub api_port: Mutex<Option<u16>>,
    pub pty_port: Mutex<Option<u16>>,
}

/// 在应用启动时调用：检测两个可用端口，通过环境变量启动 core 子进程，并保存端口供前端读取。
/// 开发前需先执行一次 `pnpm run build:sidecar`（或 build:sidecar:mac），确保 `src-tauri/binaries/core-*` 存在。
/// 与前端 SQL 插件一致的 DB 文件名（前端使用 Database.load("sqlite:shared.db")）
const SHARED_DB_FILENAME: &str = "shared.db";

pub fn start_sidecars_on_setup(app: &AppHandle) -> Result<(), String> {
    eprintln!("[sidecar] 正在启动 core 子进程（需已存在 src-tauri/binaries/core-<target>）...");
    let api_port = portpicker::pick_unused_port().ok_or("无法分配 API 端口")?;
    let pty_port = portpicker::pick_unused_port().ok_or("无法分配 PTY 端口")?;
    eprintln!("[sidecar] 分配端口 API={} PTY={}", api_port, pty_port);

    // 与前端 SQL 插件同路径：BaseDirectory::App / shared.db
    let db_path = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取 app_data_dir: {}", e))?
        .join(SHARED_DB_FILENAME);
    let db_path_s = db_path.to_string_lossy().to_string();
    println!("[sidecar] SHARED_DB_PATH={}", db_path.display());

    let shell = app.shell();
    let api_port_s = api_port.to_string();
    let pty_port_s = pty_port.to_string();

    // 1. 启动 langchain-serve
    let sidecar_api = shell
        .sidecar("core")
        .map_err(|e| {
            let msg = format!(
                "创建 sidecar core 失败: {}（请先执行 pnpm run build:sidecar 生成 src-tauri/binaries/core-*）",
                e
            );
            eprintln!("[sidecar] {}", msg);
            msg
        })?
        .args(["langchain-serve"])
        .env("VITE_API_PORT", &api_port_s)
        .env("VITE_PTY_PORT", &pty_port_s)
        .env("SHARED_DB_PATH", &db_path_s);

    let (mut rx_api, _child_api) = sidecar_api.spawn().map_err(|e| {
        let msg = format!("启动 core langchain-serve 失败: {}", e);
        eprintln!("[sidecar] {}", msg);
        msg
    })?;

    // 2. 启动 pty-host
    let sidecar_pty = shell
        .sidecar("core")
        .map_err(|e| {
            let msg = format!("创建 sidecar core 失败: {}", e);
            eprintln!("[sidecar] {}", msg);
            msg
        })?
        .args(["pty-host"])
        .env("VITE_API_PORT", &api_port_s)
        .env("VITE_PTY_PORT", &pty_port_s)
        .env("SHARED_DB_PATH", &db_path_s);

    let (mut rx_pty, _child_pty) = sidecar_pty.spawn().map_err(|e| {
        let msg = format!("启动 core pty-host 失败: {}", e);
        eprintln!("[sidecar] {}", msg);
        msg
    })?;

    // 转发两个 core 子进程的 stdout/stderr 到当前终端
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx_api.recv().await {
            match event {
                CommandEvent::Stdout(line) => print!("{}", String::from_utf8_lossy(&line)),
                CommandEvent::Stderr(line) => eprint!("{}", String::from_utf8_lossy(&line)),
                CommandEvent::Error(e) => eprintln!("[core langchain-serve 错误] {}", e),
                _ => {}
            }
        }
    });
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx_pty.recv().await {
            match event {
                CommandEvent::Stdout(line) => print!("{}", String::from_utf8_lossy(&line)),
                CommandEvent::Stderr(line) => eprint!("{}", String::from_utf8_lossy(&line)),
                CommandEvent::Error(e) => eprintln!("[core pty-host 错误] {}", e),
                _ => {}
            }
        }
    });

    if let Some(state) = app.try_state::<SidecarPorts>() {
        *state.api_port.lock().unwrap() = Some(api_port);
        *state.pty_port.lock().unwrap() = Some(pty_port);
    }

    println!(
        "[sidecar] sidecar接口分配| API: http://127.0.0.1:{} | PTY: http://127.0.0.1:{}",
        api_port, pty_port
    );
    Ok(())
}

/// 返回当前 sidecar 的 API 与 PTY 端口；若尚未启动则返回 None。
#[command]
pub fn get_sidecar_ports(state: tauri::State<SidecarPorts>) -> Result<Option<SidecarPortsPayload>, String> {
    let api = *state.api_port.lock().map_err(|e| e.to_string())?;
    let pty = *state.pty_port.lock().map_err(|e| e.to_string())?;
    match (api, pty) {
        (Some(a), Some(p)) => Ok(Some(SidecarPortsPayload {
            api_port: a,
            pty_port: p,
        })),
        _ => Ok(None),
    }
}

#[derive(serde::Serialize)]
pub struct SidecarPortsPayload {
    pub api_port: u16,
    pub pty_port: u16,
}
