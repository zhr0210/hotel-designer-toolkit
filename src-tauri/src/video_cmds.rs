use serde::{Deserialize, Serialize};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;
use std::path::{Path, PathBuf};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoMetadata {
    pub duration: String,
    pub size: String,
    pub bitrate: String,
    pub format: String,
    pub video: Option<VideoStream>,
    pub audio: Option<AudioStream>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VideoStream {
    pub codec: String,
    pub width: String,
    pub height: String,
    pub fps: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStream {
    pub codec: String,
    pub sample_rate: String,
    pub channels: String,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TranscodeOptions {
    pub format: Option<String>,
    pub video_codec: Option<String>,
    pub audio_codec: Option<String>,
    pub video_bitrate: Option<String>,
    pub fps: Option<String>,
    pub width: Option<String>,
    pub height: Option<String>,
    pub resolution: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FrameOptions {
    pub fps: Option<String>,
    pub format: Option<String>,
    pub quality: Option<String>,
    pub start_time: Option<String>,
    pub duration: Option<String>,
    pub width: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GifOptions {
    pub width: Option<String>,
    pub fps: Option<String>,
    pub start_time: Option<String>,
    pub duration: Option<String>,
    pub loop_opt: Option<String>,
}

fn gen_output_path(base_name: &str, ext: &str) -> PathBuf {
    let mut dir = std::env::temp_dir();
    dir.push("hotel-designer-toolkit");
    let _ = std::fs::create_dir_all(&dir);
    dir.join(format!("{}-{}.{}", base_name, Uuid::new_v4(), ext))
}

#[tauri::command]
pub async fn probe_video(app: tauri::AppHandle, file_path: String) -> Result<VideoMetadata, String> {
    let output = app.shell().sidecar("bin/ffprobe")
        .map_err(|e| e.to_string())?
        .args([
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            &file_path,
        ])
        .output()
        .await
        .map_err(|e| format!("无法执行 ffprobe sidecar: {}", e))?;

    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    let raw_json = String::from_utf8_lossy(&output.stdout);
    let probed: serde_json::Value = serde_json::from_str(&raw_json).map_err(|e| e.to_string())?;

    let format_info = &probed["format"];
    let mut video_info = None;
    let mut audio_info = None;

    if let Some(streams) = probed["streams"].as_array() {
        for s in streams {
            let t = s["codec_type"].as_str().unwrap_or("");
            if t == "video" {
                video_info = Some(VideoStream {
                    codec: s["codec_name"].as_str().unwrap_or("").to_string(),
                    width: s["width"].to_string(),
                    height: s["height"].to_string(),
                    fps: s["r_frame_rate"].as_str().unwrap_or("").to_string(),
                });
            } else if t == "audio" {
                audio_info = Some(AudioStream {
                    codec: s["codec_name"].as_str().unwrap_or("").to_string(),
                    sample_rate: s["sample_rate"].as_str().unwrap_or("").to_string(),
                    channels: s["channels"].to_string(),
                });
            }
        }
    }

    Ok(VideoMetadata {
        duration: format_info["duration"].as_str().unwrap_or("0").to_string(),
        size: format_info["size"].as_str().unwrap_or("0").to_string(),
        bitrate: format_info["bit_rate"].as_str().unwrap_or("0").to_string(),
        format: format_info["format_name"].as_str().unwrap_or("").to_string(),
        video: video_info,
        audio: audio_info,
    })
}

#[tauri::command]
pub async fn transcode_video(app: tauri::AppHandle, file_path: String, options: TranscodeOptions) -> Result<String, String> {
    let ext = options.format.unwrap_or_else(|| "mp4".to_string());
    let out_path = gen_output_path("transcoded", &ext);

    let mut args = vec!["-i".to_string(), file_path, "-y".to_string()];

    if let Some(v_codec) = options.video_codec { 
        if !v_codec.is_empty() { args.extend(["-c:v".to_string(), v_codec]); }
    }
    if let Some(a_codec) = options.audio_codec { 
        if !a_codec.is_empty() { args.extend(["-c:a".to_string(), a_codec]); }
    }
    if let Some(fps) = options.fps { 
        if !fps.is_empty() { args.extend(["-r".to_string(), fps]); }
    }
    if let Some(bitrate) = options.video_bitrate { 
        if !bitrate.is_empty() { args.extend(["-b:v".to_string(), bitrate]); }
    }
    
    if let (Some(w), Some(h)) = (options.width, options.height) {
        if !w.is_empty() && !h.is_empty() {
            args.extend(["-s".to_string(), format!("{}x{}", w, h)]);
        }
    } else if let Some(res) = options.resolution {
        let size = match res.as_str() {
            "4k" => "3840x2160",
            "1080p" => "1920x1080",
            "720p" => "1280x720",
            "480p" => "854x480",
            _ => "1920x1080"
        };
        args.extend(["-s".to_string(), size.to_string()]);
    }

    args.push(out_path.to_string_lossy().to_string());

    let output = app.shell().sidecar("bin/ffmpeg")
        .map_err(|e| e.to_string())?
        .args(args)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!("转码失败: {}", String::from_utf8_lossy(&output.stderr)));
    }

    Ok(out_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn extract_frames(app: tauri::AppHandle, file_path: String, options: FrameOptions) -> Result<String, String> {
    let mut out_dir = std::env::temp_dir();
    out_dir.push(format!("frames-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;

    let ext = options.format.unwrap_or_else(|| "png".to_string());
    let pattern = out_dir.join(format!("frame-%04d.{}", ext));

    let mut args = Vec::new();
    
    if let Some(st) = &options.start_time {
        if !st.is_empty() { args.extend(["-ss".to_string(), st.clone()]); }
    }

    args.extend(["-i".to_string(), file_path]);

    if let Some(t) = &options.duration {
        if !t.is_empty() { args.extend(["-t".to_string(), t.clone()]); }
    }
    if let Some(fps) = options.fps { 
        if !fps.is_empty() { args.extend(["-r".to_string(), fps]); }
    }
    if let Some(w) = options.width { 
        if !w.is_empty() { args.extend(["-vf".to_string(), format!("scale={}:-1", w)]); }
    }
    
    if ext == "jpg" {
        if let Some(q) = options.quality {
            args.extend(["-q:v".to_string(), q]);
        }
    }

    args.push(pattern.to_string_lossy().to_string());

    let output = app.shell().sidecar("bin/ffmpeg")
        .map_err(|e| e.to_string())?
        .args(args)
        .output()
        .await
        .map_err(|e| e.to_string())?;
    
    if !output.status.success() {
        return Err(format!("帧提取失败: {}", String::from_utf8_lossy(&output.stderr)));
    }

    Ok(out_dir.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn video_to_gif(app: tauri::AppHandle, file_path: String, options: GifOptions) -> Result<String, String> {
    let out_path = gen_output_path("video2gif", "gif");

    let mut args = Vec::new();

    if let Some(st) = &options.start_time {
        if !st.is_empty() { args.extend(["-ss".to_string(), st.clone()]); }
    }

    args.extend(["-i".to_string(), file_path, "-y".to_string()]);
    
    if let Some(t) = &options.duration {
        if !t.is_empty() { args.extend(["-t".to_string(), t.clone()]); }
    }
    
    let fps = if options.fps.as_ref().map(|s| s.is_empty()).unwrap_or(true) { "15" } else { options.fps.as_ref().unwrap() };
    let w = if options.width.as_ref().map(|s| s.is_empty()).unwrap_or(true) { "480" } else { options.width.as_ref().unwrap() };

    let filter = format!(
        "fps={},scale={}:-1:flags=lanczos,split [a][b];[a] palettegen=stats_mode=full [p];[b][p] paletteuse=dither=sierra2_4a",
        fps, w
    );
    
    args.extend(["-filter_complex".to_string(), filter]);

    if let Some(l) = options.loop_opt { 
        if !l.is_empty() { args.extend(["-loop".to_string(), l]); }
    }

    args.push(out_path.to_string_lossy().to_string());

    let output = app.shell().sidecar("bin/ffmpeg")
        .map_err(|e| e.to_string())?
        .args(args)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if !output.status.success() {
        return Err(format!("GIF 转换失败: {}", String::from_utf8_lossy(&output.stderr)));
    }

    Ok(out_path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn get_task_progress(task_id: String) -> Result<serde_json::Value, String> {
    Ok(serde_json::json!({
        "percent": 100,
        "status": "done",
        "result": {
            "url": task_id,
            "filename": Path::new(&task_id).file_name().unwrap_or_default().to_string_lossy(),
            "size": std::fs::metadata(&task_id).map(|m| m.len()).unwrap_or(0),
            "isDir": std::fs::metadata(&task_id).map(|m| m.is_dir()).unwrap_or(false)
        }
    }))
}

#[tauri::command]
pub async fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let _ = std::process::Command::new("open")
            .arg(path)
            .status()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }
    #[cfg(target_os = "windows")]
    {
        let _ = std::process::Command::new("explorer")
            .arg(path)
            .status()
            .map_err(|e| format!("无法打开文件夹: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn save_file(app: tauri::AppHandle, source_path: String, filename: String) -> Result<(), String> {
    let source = Path::new(&source_path);
    if !source.exists() {
        return Err("源文件不存在".to_string());
    }

    let save_path = app.dialog().file()
        .set_file_name(&filename)
        .blocking_save_file();

    if let Some(dest) = save_path {
        let dest_path = match dest {
            tauri_plugin_dialog::FilePath::Path(p) => p,
            tauri_plugin_dialog::FilePath::Url(u) => {
                if u.scheme() == "file" {
                    u.to_file_path().map_err(|_| "无效的路径格式")?
                } else {
                    return Err("不支持保存到网络路径".to_string());
                }
            }
        };
        std::fs::copy(source, &dest_path).map_err(|e| format!("拷贝文件失败: {}", e))?;
        Ok(())
    } else {
        Err("CANCELLED".to_string())
    }
}
