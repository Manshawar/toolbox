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
pub fn start_sidecars_on_setup(app: &AppHandle) -> Result<(), String> {
    eprintln!("[sidecar] 正在启动 core 子进程（需已存在 src-tauri/binaries/core-<target>）...");
    let api_port = portpicker::pick_unused_port().ok_or("无法分配 API 端口")?;
    let pty_port = portpicker::pick_unused_port().ok_or("无法分配 PTY 端口")?;
    eprintln!("[sidecar] 分配端口 API={} PTY={}", api_port, pty_port);
    let shell = app.shell();
    let sidecar_cmd = shell
        .sidecar("core")
        .map_err(|e| {
            let msg = format!(
                "创建 sidecar core 失败: {}（请先执行 pnpm run build:sidecar 生成 src-tauri/binaries/core-*）",
                e
            );
            eprintln!("[sidecar] {}", msg);
            msg
        })?
        .env("VITE_API_PORT", api_port.to_string())
        .env("VITE_PTY_PORT", pty_port.to_string());

    let (mut rx, _child) = sidecar_cmd.spawn().map_err(|e| {
        let msg = format!("启动 sidecar core 失败: {}", e);
        eprintln!("[sidecar] {}", msg);
        msg
    })?;

    // 转发 core 子进程的 stdout/stderr 到当前终端，否则看不到 index.ts 的打印
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => print!("{}", String::from_utf8_lossy(&line)),
                CommandEvent::Stderr(line) => eprint!("{}", String::from_utf8_lossy(&line)),
                CommandEvent::Error(e) => eprintln!("[core 子进程错误] {}", e),
                _ => {}
            }
        }
    });

    if let Some(state) = app.try_state::<SidecarPorts>() {
        *state.api_port.lock().unwrap() = Some(api_port);
        *state.pty_port.lock().unwrap() = Some(pty_port);
    }

    println!(
        "[sidecar] 启动成功 | API: http://127.0.0.1:{} | PTY: http://127.0.0.1:{}",
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
