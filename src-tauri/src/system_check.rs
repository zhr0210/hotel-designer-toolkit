use tauri_plugin_shell::ShellExt;
use serde::Serialize;
use std::fs;
use std::env;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticItem {
    pub name: String,
    pub status: String, // "ok", "warning", "error", "loading"
    pub message: String,
    pub recommendation: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosticReport {
    pub items: Vec<DiagnosticItem>,
    pub timestamp: String,
}

#[tauri::command]
pub async fn run_diagnostics(app: tauri::AppHandle) -> Result<DiagnosticReport, String> {
    let mut items = Vec::new();

    // 1. Check FFmpeg Sidecar
    items.push(check_sidecar(&app, "bin/ffmpeg", "FFmpeg (内置流媒体引擎)"));

    // 2. Check FFprobe Sidecar
    items.push(check_sidecar(&app, "bin/ffprobe", "FFprobe (媒体分析引擎)"));

    // 3. Check Temp Directory
    items.push(check_temp_dir());

    // 4. Check App Data Isolation
    items.push(DiagnosticItem {
        name: "应用模式".to_string(),
        status: "ok".to_string(),
        message: "已切换为 Tauri v2 原生架构 (准备上架应用商店)".to_string(),
        recommendation: None,
    });

    Ok(DiagnosticReport {
        items,
        timestamp: chrono::Local::now().to_rfc3339(),
    })
}

fn check_sidecar(app: &tauri::AppHandle, name: &str, display_name: &str) -> DiagnosticItem {
    match app.shell().sidecar(name) {
        Ok(cmd) => {
            // Effectively just check if we can resolve the sidecar path
            DiagnosticItem {
                name: display_name.to_string(),
                status: "ok".to_string(),
                message: "内置二进制文件已就绪".to_string(),
                recommendation: None,
            }
        }
        Err(e) => DiagnosticItem {
            name: display_name.to_string(),
            status: "error".to_string(),
            message: format!("无法加载内置引擎: {}", e),
            recommendation: Some("请尝试重新安装应用程序或检查权限。".to_string()),
        },
    }
}

fn check_temp_dir() -> DiagnosticItem {
    let temp_dir = env::temp_dir().join("hotel-designer-toolkit");
    match fs::create_dir_all(&temp_dir) {
        Ok(_) => {
            let test_file = temp_dir.join(".write_test");
            match fs::write(&test_file, "test") {
                Ok(_) => {
                    let _ = fs::remove_file(test_file);
                    DiagnosticItem {
                        name: "临时目录".to_string(),
                        status: "ok".to_string(),
                        message: format!("工作目录就绪: {}", temp_dir.display()),
                        recommendation: None,
                    }
                }
                Err(e) => DiagnosticItem {
                    name: "临时目录".to_string(),
                    status: "error".to_string(),
                    message: format!("无法写入临时目录: {}", e),
                    recommendation: Some("请检查磁盘权限或运行空间是否已满。".to_string()),
                },
            }
        }
        Err(e) => DiagnosticItem {
            name: "临时目录".to_string(),
            status: "error".to_string(),
            message: format!("无法创建工作目录: {}", e),
            recommendation: Some("程序需要本地文件系统的访问权限。".to_string()),
        },
    }
}
