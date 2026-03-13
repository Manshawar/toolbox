//! Core 子进程启动与端口管理。
//!
//! - 未设 TAURI_SKIP_SIDECAR：用 portpicker 分配端口，使用 resources 内 Node 执行 resources/core/index.js，注入环境变量。
//! - TAURI_SKIP_SIDECAR=1 或 resource_dir/core 不存在：不启动进程，在 core/.env 写入与 [build_core_env] 一致的环境变量。

use std::fs;
use std::io::Write;
use std::process::{Command, Stdio};
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::config;

/// 应用内保存的 core 端口（仅当由 Tauri 启动 Node 服务时写入），供 get_config 合并后返回前端。
#[derive(Default)]
pub struct CorePorts {
    pub api_port: Mutex<Option<u16>>,
}

/// 是否为开发环境（仅用于控制是否打印路径日志）
fn is_dev() -> bool {
    cfg!(debug_assertions)
}

/// Core 环境变量键值对，与 core/.env 内容一致。
/// 包含：API_PORT；若有 app_data 目录则增加 APP_DATA_DIR、SQLITE_DB_PATH、DB_PATH、STORE_PATH。
pub fn build_core_env(app: &AppHandle, api_port: u16) -> Vec<(String, String)> {
    let mut env = vec![("API_PORT".to_string(), api_port.to_string())];

    if let Ok(app_data) = app.path().app_data_dir() {
        let sql_name = config::get_sqlite_db_name(app);
        let store_name = config::get_store_name(app);
        let db_path = app_data.join(&sql_name);
        let store_path = app_data.join(&store_name);
        env.push((
            "APP_DATA_DIR".to_string(),
            app_data.to_string_lossy().to_string(),
        ));
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

    env
}

/// 将环境变量键值对写成 .env 文件行（KEY=VALUE）
fn env_to_dotenv_lines(env: &[(String, String)]) -> String {
    env.iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("\n")
}

/// 解析 core 源码目录（core 或 sidecars），用于写入 .env
fn core_src_dir() -> Option<std::path::PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    for name in ["core", "sidecars"] {
        let parent = cwd.parent().map(|p| p.join(name));
        if parent.as_ref().is_some_and(|p| p.join("package.json").exists()) {
            return parent;
        }
        let cur = cwd.join(name);
        if cur.join("package.json").exists() {
            return Some(cur);
        }
    }
    Some(cwd.join("core"))
}

/// 获取 resources 内 Node 可执行文件路径（与 invoke 一致：先 resource_dir，再回退到 CARGO_MANIFEST_DIR）
fn node_runtime_bin_dir(app: &AppHandle) -> Option<std::path::PathBuf> {
    let bin = app
        .path()
        .resource_dir()
        .ok()
        .map(|d| d.join("help").join("nodeRuntime").join("bin"));
    if let Some(ref b) = bin {
        if b.exists() {
            return Some(b.clone());
        }
    }
    let fallback = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("help")
        .join("nodeRuntime")
        .join("bin");
    if fallback.exists() {
        Some(fallback)
    } else {
        None
    }
}

/// 解析 core 目录：优先 resource_dir，再回退到 target/debug|release/resources/core 或源码 resources/core
fn resolve_core_dir(app: &AppHandle) -> Option<(std::path::PathBuf, std::path::PathBuf)> {
    let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    // 1. 打包后：target/debug/resources 或 target/release/resources 或 .app/Contents/Resources
    if let Ok(res) = app.path().resource_dir() {
        if res.exists() {
            let core = res.join("core");
            if core.join("index.js").exists() {
                return Some((res.clone(), core));
            }
        }
    }

    // 2. debug 构建：target/debug/resources/core
    let debug_core = manifest.join("target").join("debug").join("resources").join("core");
    if debug_core.join("index.js").exists() {
        let res = manifest.join("target").join("debug").join("resources");
        return Some((res, debug_core));
    }

    // 3. release 构建：target/release/resources/core
    let release_core = manifest.join("target").join("release").join("resources").join("core");
    if release_core.join("index.js").exists() {
        let res = manifest.join("target").join("release").join("resources");
        return Some((res, release_core));
    }

    // 4. 源码：src-tauri/resources/core（dev 未打包时）
    let src_core = manifest.join("resources").join("core");
    if src_core.join("index.js").exists() {
        return Some((manifest.join("resources"), src_core));
    }

    None
}

pub fn start_core_on_setup(app: &AppHandle) -> Result<(), String> {
    let (_resource_dir, core_dir) = match resolve_core_dir(app) {
        Some(pair) => pair,
        None => {
            eprintln!("[core] 未找到 core（已尝试 resource_dir、target/debug|release/resources/core、resources/core），请先执行 pnpm -C core run build");
            write_core_env_when_skip(app);
            return Ok(());
        }
    };

    let index_js = core_dir.join("index.js");

    // Node：与 core 同源的 resource_dir 下的 help/nodeRuntime/bin，否则回退到 manifest
    let bin_dir = _resource_dir
        .join("help")
        .join("nodeRuntime")
        .join("bin");
    let bin_dir = if bin_dir.exists() {
        bin_dir
    } else {
        match node_runtime_bin_dir(app) {
            Some(d) => d,
            None => {
                eprintln!("[core] Node Runtime 未找到（已尝试 {}）", bin_dir.display());
                write_core_env_when_skip(app);
                return Ok(());
            }
        }
    };

    let node_exe = bin_dir.join(if cfg!(target_os = "windows") {
        "node.exe"
    } else {
        "node"
    });
    if !node_exe.exists() {
        eprintln!("[core] node 可执行文件未找到: {}", node_exe.display());
        write_core_env_when_skip(app);
        return Ok(());
    }

    let api_port = match portpicker::pick_unused_port() {
        Some(p) => p,
        None => {
            eprintln!("[core] 无法分配端口，跳过启动 core");
            write_core_env_when_skip(app);
            return Ok(());
        }
    };
    eprintln!("[core] 使用内置 Node 启动 core | 端口 {}", api_port);

    let env_vars = build_core_env(app, api_port);
    if is_dev() {
        if let Some((_, ref path)) = env_vars.iter().find(|(k, _)| k == "APP_DATA_DIR") {
            println!("[core] dev: APP_DATA_DIR={}", path);
        }
        if let Some((_, ref path)) = env_vars.iter().find(|(k, _)| k == "STORE_PATH") {
            println!("[core] dev: STORE_PATH={}", path);
        }
        if let Some((_, ref path)) = env_vars.iter().find(|(k, _)| k == "SQLITE_DB_PATH") {
            println!("[core] dev: SQLITE_DB_PATH={}", path);
        }
    }

    let env_iter: Vec<_> = env_vars.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();

    // 启动 core（内部由 index.ts 调用 langchain-serve 的 run）
    match Command::new(&node_exe)
        .arg(&index_js)
        .current_dir(&core_dir)
        .envs(env_iter.iter().map(|(k, v)| (*k, *v)))
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
    {
        Ok(_) => {}
        Err(e) => eprintln!("[core] 启动 core 失败（应用继续运行）: {}", e),
    }

    if let Some(state) = app.try_state::<CorePorts>() {
        *state.api_port.lock().unwrap() = Some(api_port);
    }

    println!("[core] 接口 | http://127.0.0.1:{}", api_port);
    Ok(())
}

/// 当 TAURI_SKIP_SIDECAR=1 时调用：在 core/.env 写入与 [build_core_env] 一致的环境变量。
pub fn write_core_env_when_skip(app: &AppHandle) {
    let core_dir = match core_src_dir() {
        Some(d) => d,
        None => {
            eprintln!("[core] 无法解析 core 目录，跳过写入 .env");
            return;
        }
    };

    let api_port = config::get_api_port(app);
    let env_vars = build_core_env(app, api_port);
    let content = env_to_dotenv_lines(&env_vars);
    let env_path = core_dir.join(".env");

    if let Err(e) = fs::create_dir_all(&core_dir) {
        eprintln!("[core] 创建 core 目录失败: {}", e);
        return;
    }
    match fs::File::create(&env_path).and_then(|mut f| f.write_all(content.as_bytes())) {
        Ok(()) => println!(
            "[core] 已写入 {}（TAURI_SKIP_SIDECAR=1，不启动 Node 服务）",
            env_path.display()
        ),
        Err(e) => eprintln!("[core] 写入 .env 失败: {}", e),
    }
}
