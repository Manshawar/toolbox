//! Core 子进程：用 **Node 侧车** 执行 `resources/core/index.js`。
//!
//! ## 正常流程
//! 1. 解析 core 目录（打包后 resource_dir，开发时 target/…/resources/core）。
//! 2. 分配端口，构造环境变量（API_PORT、APP_DATA_DIR 等）。
//! 3. 通过 `app.shell().sidecar("toolbox_node")` 启动：`toolbox_node index.js`，环境变量与工作目录注入。
//!
//! ## 跳过侧车时（TAURI_SKIP_SIDECAR=1 或未找到 core/侧车）
//! 仅向 `core/.env` 写入与 [build_core_env] 一致的内容，供本地自启 core 使用。

use std::fs;
use std::io::Write;
use std::sync::{Mutex, OnceLock};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use tauri_plugin_shell::ShellExt;

use crate::config;

/// 侧车 PID 的全局副本，用于 Ctrl+C 时在信号处理里按 PID 终止（Drop 可能来不及执行）。
static SIDECAR_PID: OnceLock<Mutex<Option<u32>>> = OnceLock::new();

// ---------------------------------------------------------------------------
// 状态与配置
// ---------------------------------------------------------------------------

/// 由本模块启动 core 时写入的 API 端口，供 [crate::invoke::get_config] 合并返回前端。
#[derive(Default)]
pub struct CorePorts {
    pub api_port: Mutex<Option<u16>>,
}

/// 保存 Node 侧车子进程句柄，应用退出时（Drop）自动 kill，避免残留进程。
pub struct CoreSidecarChild(pub Mutex<Option<CommandChild>>);

impl Default for CoreSidecarChild {
    fn default() -> Self {
        Self(Mutex::new(None))
    }
}

impl Drop for CoreSidecarChild {
    fn drop(&mut self) {
        if let Ok(mut guard) = self.0.lock() {
            if let Some(child) = guard.take() {
                if let Err(e) = child.kill() {
                    eprintln!("[core] 关闭 Node 侧车进程失败: {}", e);
                } else {
                    eprintln!("[core] 已关闭 Node 侧车进程");
                }
            }
        }
        if let Some(m) = SIDECAR_PID.get() {
            if let Ok(mut g) = m.lock() {
                *g = None;
            }
        }
    }
}

/// 按 PID 终止侧车（供 Ctrl+C 等信号处理使用，此时 Drop 可能不会执行）。
pub fn kill_sidecar_by_pid() {
    let pid = SIDECAR_PID
        .get()
        .and_then(|m| m.lock().ok())
        .and_then(|mut g| g.take());
    if let Some(pid) = pid {
        #[cfg(windows)]
        {
            let _ = std::process::Command::new("taskkill")
                .args(["/PID", &pid.to_string(), "/F"])
                .status();
        }
        #[cfg(not(windows))]
        {
            let _ = std::process::Command::new("kill")
                .args(["-9", &pid.to_string()])
                .status();
        }
    }
}

fn is_dev() -> bool {
    cfg!(debug_assertions)
}

// ---------------------------------------------------------------------------
// 环境变量（与 core/.env 一致）
// ---------------------------------------------------------------------------

/// 构造 core 进程环境变量：API_PORT；若有 app_data 则加 APP_DATA_DIR、SQLITE_DB_PATH、DB_PATH、STORE_PATH。
pub fn build_core_env(app: &AppHandle, api_port: u16) -> Vec<(String, String)> {
    let mut env: Vec<(String, String)> = vec![("API_PORT".to_string(), api_port.to_string())];

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

fn env_to_dotenv_lines(env: &[(String, String)]) -> String {
    env.iter()
        .map(|(k, v)| format!("{}={}", k, v))
        .collect::<Vec<_>>()
        .join("\n")
}

// ---------------------------------------------------------------------------
// 路径解析
// ---------------------------------------------------------------------------

/// 解析 monorepo 下 core 源码目录（用于写入 .env），按 cwd 与 package.json 推断。
fn core_src_dir() -> Option<std::path::PathBuf> {
    let cwd = std::env::current_dir().ok()?;
    let name = "core";
    if let Some(p) = cwd.parent() {
        let parent = p.join(name);
        if parent.join("package.json").exists() {
            return Some(parent);
        }
    }
    if cwd.join(name).join("package.json").exists() {
        return Some(cwd.join(name));
    }
    Some(cwd.join("core"))
}

/// 解析 **运行时** core 目录（含 index.js）。
/// 优先级：resource_dir → target/debug|release/resources/core → src-tauri/resources/core。
fn resolve_core_dir(app: &AppHandle) -> Option<(std::path::PathBuf, std::path::PathBuf)> {
    let manifest = std::path::PathBuf::from(env!("CARGO_MANIFEST_DIR"));

    if let Ok(res) = app.path().resource_dir() {
        if res.exists() {
            let core = res.join("core");
            if core.join("index.js").exists() {
                return Some((res.clone(), core));
            }
        }
    }

    for sub in ["debug", "release"] {
        let core = manifest
            .join("target")
            .join(sub)
            .join("resources")
            .join("core");
        if core.join("index.js").exists() {
            let res = manifest.join("target").join(sub).join("resources");
            return Some((res, core));
        }
    }

    let src_core = manifest.join("resources").join("core");
    if src_core.join("index.js").exists() {
        return Some((manifest.join("resources"), src_core));
    }

    None
}

// ---------------------------------------------------------------------------
// 侧车启动
// ---------------------------------------------------------------------------

/// Setup 阶段调用：若未跳过侧车，则用 Node 侧车启动 resources/core/index.js。
pub fn start_core_on_setup(app: &AppHandle) -> Result<(), String> {
    let (_resource_dir, core_dir) = match resolve_core_dir(app) {
        Some(pair) => pair,
        None => {
            eprintln!("[core] 未找到 core 目录（请先执行 pnpm -C core run build）");
            write_core_env_when_skip(app);
            return Ok(());
        }
    };

    let index_js = core_dir.join("index.js");
    if !index_js.exists() {
        eprintln!("[core] index.js 未找到: {}", index_js.display());
        write_core_env_when_skip(app);
        return Ok(());
    }

    let api_port = match portpicker::pick_unused_port() {
        Some(p) => p,
        None => {
            eprintln!("[core] 无法分配端口，跳过启动");
            write_core_env_when_skip(app);
            return Ok(());
        }
    };

    let env_vars = build_core_env(app, api_port);
    if is_dev() {
        log_dev_paths(&env_vars);
    }

    let sidecar = match app.shell().sidecar("toolbox_node") {
        Ok(cmd) => cmd,
        Err(e) => {
            eprintln!("[core] toolbox_node 侧车未找到（请先执行 pnpm run init:runtime）: {}", e);
            write_core_env_when_skip(app);
            return Ok(());
        }
    };

    let env_pairs: Vec<_> = env_vars.iter().map(|(k, v)| (k.as_str(), v.as_str())).collect();
    match sidecar
        .arg(&index_js)
        .current_dir(&core_dir)
        .envs(env_pairs.iter().map(|(k, v)| (*k, *v)))
        .spawn()
    {
        Ok((mut rx, child)) => {
            let pid = child.pid();
            eprintln!("[core] toolbox_node 侧车已启动 core | 端口 {}", api_port);
            if let Some(state) = app.try_state::<CorePorts>() {
                *state.api_port.lock().unwrap() = Some(api_port);
            }
            if let Some(sidecar_state) = app.try_state::<CoreSidecarChild>() {
                if let Ok(mut g) = sidecar_state.0.lock() {
                    *g = Some(child);
                }
            }
            SIDECAR_PID.get_or_init(|| Mutex::new(None)).lock().unwrap().replace(pid);
            println!("[core] 接口 | http://127.0.0.1:{}", api_port);
            // 在后台消费侧车 stdout/stderr，否则缓冲区满会导致子进程阻塞
            let app_handle = app.clone();
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => {
                            let _ = std::io::stdout().write_all(&line);
                            let _ = std::io::stdout().flush();
                            // 检测 Core 服务就绪标记
                            if let Ok(text) = String::from_utf8(line.clone()) {
                                if text.contains("###CORE_READY###") {
                                    let _ = app_handle.emit("core-ready", serde_json::json!({
                                        "ready": true,
                                        "apiPort": api_port,
                                    }));
                                    println!("[core] 已 emit core-ready 事件到前端");
                                }
                            }
                        }
                        CommandEvent::Stderr(line) => {
                            let _ = std::io::stderr().write_all(&line);
                            let _ = std::io::stderr().flush();
                        }
                        _ => {}
                    }
                }
            });
        }
        Err(e) => eprintln!("[core] 侧车启动失败（应用继续运行）: {}", e),
    }

    Ok(())
}

fn log_dev_paths(env_vars: &[(String, String)]) {
    const KEYS: &[&str] = &["APP_DATA_DIR", "STORE_PATH", "SQLITE_DB_PATH"];
    for key in KEYS {
        if let Some((_, v)) = env_vars.iter().find(|(k, _)| k == key) {
            println!("[core] dev: {}={}", key, v);
        }
    }
}

// ---------------------------------------------------------------------------
// 跳过侧车时的回退（写入 .env）
// ---------------------------------------------------------------------------

/// 不启动侧车时：向 core 源码目录写入 .env，内容与 [build_core_env] 一致，供本地自启 core。
pub fn write_core_env_when_skip(app: &AppHandle) {
    let core_dir = match core_src_dir() {
        Some(d) => d,
        None => {
            eprintln!("[core] 无法解析 core 目录，跳过写入 .env");
            return;
        }
    };

    let api_port = config::get_api_port(app);
    let mut env_vars = build_core_env(app, api_port);
    // 写入 core/.env 时默认标记为开发模式，供本地自启 core 使用。
    env_vars.push(("TOOLBOX_ENV".to_string(), "development".to_string()));
    let content = env_to_dotenv_lines(&env_vars);
    let env_path = core_dir.join(".env");

    if let Err(e) = fs::create_dir_all(&core_dir) {
        eprintln!("[core] 创建 core 目录失败: {}", e);
        return;
    }
    match fs::File::create(&env_path).and_then(|mut f| f.write_all(content.as_bytes())) {
        Ok(()) => println!(
            "[core] 已写入 {}（TAURI_SKIP_SIDECAR=1 或未启动侧车）",
            env_path.display()
        ),
        Err(e) => eprintln!("[core] 写入 .env 失败: {}", e),
    }
}
