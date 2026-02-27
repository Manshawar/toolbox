// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use tauri::Manager;
mod invoke;
mod sidecar;
mod store;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
        .manage(sidecar::SidecarPorts::default())
        .setup(|app| {
            #[cfg(not(any(target_os = "android", target_os = "ios")))]
            {
                let skip = std::env::var("TAURI_SKIP_SIDECAR").as_deref() == Ok("1");
                if skip {
                    eprintln!("[sidecar] 已跳过（TAURI_SKIP_SIDECAR=1），请手动启动子进程");
                } else {
                    eprintln!("[sidecar] 准备启动 core 子进程...");
                    if let Err(e) = sidecar::start_sidecars_on_setup(app.handle()) {
                        eprintln!("[sidecar] 启动失败: {}", e);
                    }
                }
            }
            Ok(())
        })
        .invoke_handler(invoke_handler!())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
