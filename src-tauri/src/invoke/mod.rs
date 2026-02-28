//! 应用级 invoke 命令与集中注册。
//!
//! 新增命令时：在对应业务模块实现后，在 `invoke_handler!` 宏内的列表中追加；在 `lib.rs` 中通过 `.invoke_handler(invoke_handler!())` 注册。

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

/// 集中列出所有 invoke 命令，展开为 `generate_handler![...]`，供 `lib.rs` 使用。
/// 避免在 lib 中手写一长串，且不依赖未导出的 `tauri::Wry` 等类型。
#[macro_export]
macro_rules! invoke_handler {
    () => {
        tauri::generate_handler![
            $crate::invoke::greet,
            $crate::invoke::get_platform,
            $crate::config::get_config,
            $crate::sidecar::get_sidecar_ports,
            $crate::store::store_read,
            $crate::store::store_write,
        ]
    };
}

