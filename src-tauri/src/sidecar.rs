//! 子进程（sidecar）启动与端口管理：检测可用端口，通过环境变量传给 core，通过 invoke 给前端。

use std::sync::Mutex;
use tauri::command;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use crate::config;

/// 应用内保存的 sidecar 端口，供前端 invoke 读取
#[derive(Default)]
pub struct SidecarPorts {
    pub api_port: Mutex<Option<u16>>,
    pub pty_port: Mutex<Option<u16>>,
}

/// 是否为开发环境（debug 构建视为开发；仅开发时传 SQL 相关 env，避免打包后 sidecar 依赖 WASM）
fn is_dev() -> bool {
    cfg!(debug_assertions)
}

pub fn start_sidecars_on_setup(app: &AppHandle) -> Result<(), String> {
    eprintln!("[sidecar] 正在启动 core 子进程（需已存在 src-tauri/binaries/core-<target>）...");
    let api_port = portpicker::pick_unused_port().ok_or("无法分配 API 端口")?;
    let pty_port = portpicker::pick_unused_port().ok_or("无法分配 PTY 端口")?;
    eprintln!("[sidecar] 分配端口 API={} PTY={}", api_port, pty_port);

    let app_data = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("无法获取 app_data_dir: {}", e))?;

    // 仅开发环境设置 SQL 库路径，供 langchain-serve 使用；生产不设则 Node 侧 /db-test 返回 503
    // 库文件名从 config（resource/settings.json）读取，与前端一致
    let sql_db_path_opt: Option<String> = if is_dev() {
        let sql_db_filename = config::get_sqlite_db_name(app);
        let p = app_data.join(&sql_db_filename);
        let s = p.to_string_lossy().to_string();
        println!("[sidecar] dev: SQLITE_DB_PATH={}", p.display());
        Some(s)
    } else {
        eprintln!("[sidecar] prod: 不设置 SQL 环境变量");
        None
    };

    let shell = app.shell();
    let api_port_s = api_port.to_string();
    let pty_port_s = pty_port.to_string();

    // 1. 启动 langchain-serve（开发环境才传 SQLITE_DB_PATH / DB_PATH）
    let mut sidecar_api = shell
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
        .env("API_PORT", &api_port_s)
        .env("PTY_PORT", &pty_port_s);
    if let Some(ref sql_path) = sql_db_path_opt {
        sidecar_api = sidecar_api.env("SQLITE_DB_PATH", sql_path).env("DB_PATH", sql_path);
    }

    let (mut rx_api, _child_api) = sidecar_api.spawn().map_err(|e| {
        let msg = format!("启动 core langchain-serve 失败: {}", e);
        eprintln!("[sidecar] {}", msg);
        msg
    })?;

    // 2. 启动 pty-host（暂时注释，后期再启用）
    // let sidecar_pty = shell
    //     .sidecar("core")
    //     .map_err(|e| {
    //         let msg = format!("创建 sidecar core 失败: {}", e);
    //         eprintln!("[sidecar] {}", msg);
    //         msg
    //     })?
    //     .args(["pty-host"])
    //     .env("API_PORT", &api_port_s)
    //     .env("PTY_PORT", &pty_port_s);

    // let (mut rx_pty, _child_pty) = sidecar_pty.spawn().map_err(|e| {
    //     let msg = format!("启动 core pty-host 失败: {}", e);
    //     eprintln!("[sidecar] {}", msg);
    //     msg
    // })?;

    // 转发 core 子进程的 stdout/stderr 到当前终端（仅 langchain-serve；pty-host 已注释）
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
    // pty-host 已注释，后期再启用
    // tauri::async_runtime::spawn(async move {
    //     while let Some(event) = rx_pty.recv().await {
    //         match event {
    //             CommandEvent::Stdout(line) => print!("{}", String::from_utf8_lossy(&line)),
    //             CommandEvent::Stderr(line) => eprint!("{}", String::from_utf8_lossy(&line)),
    //             CommandEvent::Error(e) => eprintln!("[core pty-host 错误] {}", e),
    //             _ => {}
    //         }
    //     }
    // });

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
