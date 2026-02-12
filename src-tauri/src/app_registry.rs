//! 应用安装检测：根据 app_id 列表批量检测本机是否已安装对应程序。
//!
//! ## 扩展方式
//! 新增可检测的应用时，只需在 `build_registry()` 中追加一条 `AppDetect` 即可。

use serde::Serialize;
use std::collections::HashMap;
use std::process::Command;

/// 单个应用的检测结果，返回给前端
#[derive(Debug, Clone, Serialize)]
pub struct AppInstallInfo {
    /// 是否已安装
    pub installed: bool,
    /// 检测到的版本号（未安装时为 None）
    pub version: Option<String>,
}

/// 应用检测配置：描述如何检测一个应用
struct AppDetect {
    /// 对应前端的 app id
    id: &'static str,
    /// 要执行的命令（如 "openclaw"）
    cmd: &'static str,
    /// 命令参数（如 ["--version"]）
    args: &'static [&'static str],
}

/// 注册所有可检测的应用。新增应用在这里加一行即可。
fn build_registry() -> Vec<AppDetect> {
    vec![
        AppDetect {
            id: "clawbot",
            cmd: "openclaw",
            args: &["--version"],
        },
        // 后续新增示例：
        // AppDetect { id: "node", cmd: "node", args: &["--version"] },
        // AppDetect { id: "python", cmd: "python3", args: &["--version"] },
    ]
}

/// 执行单个应用的检测
fn detect_app(detect: &AppDetect) -> AppInstallInfo {
    let result = Command::new(detect.cmd)
        .args(detect.args)
        .output();

    match result {
        Ok(output) if output.status.success() => {
            let raw = String::from_utf8_lossy(&output.stdout);
            let version = raw.lines().next().map(|l| l.trim().to_string());
            AppInstallInfo {
                installed: true,
                version,
            }
        }
        _ => AppInstallInfo {
            installed: false,
            version: None,
        },
    }
}

/// Tauri invoke 命令：批量检测应用安装状态。
///
/// 前端调用：`invoke('check_apps_installed', { appIds: ['clawbot'] })`
/// 返回：`{ "clawbot": { installed: true, version: "1.2.3" } }`
#[tauri::command]
pub fn check_apps_installed(app_ids: Vec<String>) -> HashMap<String, AppInstallInfo> {
    let registry = build_registry();
    let registry_map: HashMap<&str, &AppDetect> =
        registry.iter().map(|d| (d.id, d)).collect();

    let mut results = HashMap::new();
    for id in &app_ids {
        let info = match registry_map.get(id.as_str()) {
            Some(detect) => detect_app(detect),
            None => AppInstallInfo {
                installed: false,
                version: None,
            },
        };
        results.insert(id.clone(), info);
    }
    results
}
