// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;
mod config;
mod core;
mod invoke;
mod store;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Ctrl+C 时先终止 Node 侧车再退出，避免 Drop 来不及执行导致侧车残留
    let _ = ctrlc::set_handler(|| {
        core::kill_sidecar_by_pid();
        std::process::exit(0);
    });

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(w) = app.get_webview_window("main") {
                let _ = w.show();
                let _ = w.set_focus();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .manage(core::CorePorts::default())
        .manage(core::CoreSidecarChild::default())
        .setup(|app| {
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let skip = std::env::var("TAURI_SKIP_SIDECAR").as_deref() == Ok("1");
                if skip {
                    eprintln!("[core] TAURI_SKIP_SIDECAR=1，不启动 Node 服务，已写入 .env 供自启");
                    core::write_core_env_when_skip(app.handle());
                } else {
                    eprintln!("[core] 准备启动 Node 服务...");
                    if let Err(e) = core::start_core_on_setup(app.handle()) {
                        eprintln!("[core] 启动失败: {}", e);
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(invoke_handler!())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
