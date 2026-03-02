//! 子进程（sidecar）启动与端口管理。
//!
//! - 未设 TAURI_SKIP_SIDECAR：用 portpicker 分配端口并启动 sidecar，端口写入 SidecarPorts，由 get_config 合并后返回前端。
//! - TAURI_SKIP_SIDECAR=1：不启动 sidecar，在 sidecars/.env 写入与注入一致的环境变量，供手动启动子进程时读取。
//!
//! 侧车环境变量与 sidecars/.env 内容由 [build_sidecar_env] 统一生成，保证一致。

use std::fs;
use std::io::Write;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};
use tauri_plugin_shell::process::CommandEvent;
use tauri_plugin_shell::ShellExt;

use crate::config;

/// 应用内保存的 sidecar 端口（仅当由 Tauri 启动 sidecar 时写入），供 get_config 合并后返回前端。
#[derive(Default)]
pub struct SidecarPorts {
    pub api_port: Mutex<Option<u16>>,
    pub pty_port: Mutex<Option<u16>>,
}

/// 是否为开发环境（debug 构建视为开发；仅开发时传 SQL/Store 相关 env，避免打包后 sidecar 依赖 WASM）
fn is_dev() -> bool {
    cfg!(debug_assertions)
}

/// 侧车环境变量键值对，与 sidecars/.env 内容一致。
/// 包含：API_PORT、PTY_PORT；开发环境下增加 SQLITE_DB_PATH、DB_PATH、STORE_PATH（与 app.db 同目录）。
pub fn build_sidecar_env(app: &AppHandle, api_port: u16, pty_port: u16) -> Vec<(String, String)> {
    let mut env = vec![
        ("API_PORT".to_string(), api_port.to_string()),
        ("PTY_PORT".to_string(), pty_port.to_string()),
    ];

    if is_dev() {
        if let Ok(app_data) = app.path().app_data_dir() {
            let sql_name = config::get_sqlite_db_name(app);
            let store_name = config::get_store_name(app);
            let db_path = app_data.join(&sql_name);
            let store_path = app_data.join(&store_name);
            env.push((
                "SQLITE_DB_PATH".to_string(),
                db_path.to_string_lossy().to_string(),
            ));
            env.push(("DB_PATH".to_string(), db_path.to_string_lossy().to_string()));
            env.push((
                "STORE_PATH".to_string(),
                store_path.to_string_lossy().to_string(),
            ));
        }
    }

    env
}

/// 将环境变量键值对写成 .env 文件行（KEY=VALUE）
fn env_to_dotenv_lines(env: &[(String, String)]) -> String {
    env.iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("\n")
}

/// 解析 sidecars 目录路径（项目根/sidecars 或当前目录下 sidecars，且存在 package.json）
fn sidecars_dir() -> Option<std::path::PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    let parent_sidecars = cwd.parent().map(|p| p.join("sidecars"));
    if parent_sidecars.as_ref().is_some_and(|p| p.join("package.json").exists()) {
        return parent_sidecars;
    }
    let cur_sidecars = cwd.join("sidecars");
    if cur_sidecars.join("package.json").exists() {
        return Some(cur_sidecars);
    }
    Some(cur_sidecars)
}

pub fn start_sidecars_on_setup(app: &AppHandle) -> Result<(), String> {
    eprintln!("[sidecar] 正在启动 core 子进程（需已存在 src-tauri/binaries/core-<target>）...");

    let api_port = portpicker::pick_unused_port().ok_or("无法分配 API 端口")?;
    let pty_port = portpicker::pick_unused_port().ok_or("无法分配 PTY 端口")?;
    eprintln!("[sidecar] 分配可用端口 API={} PTY={}", api_port, pty_port);

    let env_vars = build_sidecar_env(app, api_port, pty_port);
    if is_dev() {
        if let Some((_, ref path)) = env_vars.iter().find(|(k, _)| k == "STORE_PATH") {
            println!("[sidecar] dev: STORE_PATH={}", path);
        }
        if let Some((_, ref path)) = env_vars.iter().find(|(k, _)| k == "SQLITE_DB_PATH") {
            println!("[sidecar] dev: SQLITE_DB_PATH={}", path);
        }
    }

    let mut sidecar_api = app
        .shell()
        .sidecar("core")
        .map_err(|e| {
            let msg = format!(
                "创建 sidecar core 失败: {}（请先执行 pnpm run build:sidecar 生成 src-tauri/binaries/core-*）",
                e
            );
            eprintln!("[sidecar] {}", msg);
            msg
        })?
        .args(["langchain-serve"]);

    for (k, v) in &env_vars {
        sidecar_api = sidecar_api.env(k, v);
    }

    let (mut rx_api, _child_api) = sidecar_api.spawn().map_err(|e| {
        let msg = format!("启动 core langchain-serve 失败: {}", e);
        eprintln!("[sidecar] {}", msg);
        msg
    })?;

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

    if let Some(state) = app.try_state::<SidecarPorts>() {
        *state.api_port.lock().unwrap() = Some(api_port);
        *state.pty_port.lock().unwrap() = Some(pty_port);
    }

    println!(
        "[sidecar] sidecar 接口 | API: http://127.0.0.1:{} | PTY: http://127.0.0.1:{}",
        api_port, pty_port
    );
    Ok(())
}

/// 当 TAURI_SKIP_SIDECAR=1 时调用：在 sidecars/.env 写入与 [build_sidecar_env] 一致的环境变量，供手动启动子进程时读取。
pub fn write_sidecar_env_when_skip(app: &AppHandle) {
    let sidecars_dir = match sidecars_dir() {
        Some(d) => d,
        None => {
            eprintln!("[sidecar] 无法解析 sidecars 目录，跳过写入 .env");
            return;
        }
    };

    let api_port = config::get_api_port(app);
    let pty_port = config::get_pty_port(app);
    let env_vars = build_sidecar_env(app, api_port, pty_port);
    let content = env_to_dotenv_lines(&env_vars);
    let env_path = sidecars_dir.join(".env");

    if let Err(e) = fs::create_dir_all(&sidecars_dir) {
        eprintln!("[sidecar] 创建 sidecars 目录失败: {}", e);
        return;
    }
    match fs::File::create(&env_path).and_then(|mut f| f.write_all(content.as_bytes())) {
        Ok(()) => println!(
            "[sidecar] 已写入 {}（TAURI_SKIP_SIDECAR=1，供手动启动子进程读取）",
            env_path.display()
        ),
        Err(e) => eprintln!("[sidecar] 写入 .env 失败: {}", e),
    }
}
