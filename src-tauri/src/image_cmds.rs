use std::path::{Path, PathBuf};
use image::{GenericImageView, DynamicImage};
use image::ImageReader;
use serde::{Deserialize, Serialize};
use tauri_plugin_shell::ShellExt;
use std::fs::File;
use std::io::BufReader;
use uuid::Uuid;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageMetadata {
    pub width: u32,
    pub height: u32,
    pub format: String,
    pub size: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertOptions {
    pub format: Option<String>,
    pub quality: Option<u8>,
    pub width: Option<String>,
    pub height: Option<String>,
    pub fit: Option<String>,
    pub dpi: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConvertResult {
    pub url: String,
    pub filename: String,
    pub size: u64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StitchOptions {
    pub direction: Option<String>,
    pub gap: Option<String>,
    pub background_color: Option<String>,
    pub align: Option<String>,
    pub format: Option<String>,
    pub target_width: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitOptions {
    pub direction: Option<String>,
    pub limit: Option<String>,
    pub format: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SplitResult {
    pub images: Vec<ConvertResult>,
    pub count: usize,
    pub dir: String,
}

async fn ensure_compatible_path(app: &tauri::AppHandle, path: &str) -> Result<String, String> {
    let lower_path = path.to_lowercase();
    if lower_path.ends_with(".heic") || lower_path.ends_with(".heif") {
        let out_dir = std::env::temp_dir();
        let out_path = out_dir.join(format!("{}.png", Uuid::new_v4()));
        let out_str = out_path.to_string_lossy().to_string();
        
        // Use ffmpeg sidecar instead of magick
        let output = app.shell().sidecar("bin/ffmpeg")
            .map_err(|e| e.to_string())?
            .args(["-i", path, "-y", &out_str])
            .output()
            .await
            .map_err(|e| format!("FFmpeg sidecar error: {}", e))?;
            
        if !output.status.success() {
            return Err(format!("HEIC 转换失败: {}", String::from_utf8_lossy(&output.stderr)));
        }
        Ok(out_str)
    } else {
        Ok(path.to_string())
    }
}

fn open_image_robust(path: &str) -> Result<DynamicImage, String> {
    let file = File::open(path).map_err(|e| format!("无法打开文件: {}", e))?;
    let reader = ImageReader::new(BufReader::new(file))
        .with_guessed_format()
        .map_err(|e| format!("自动探测图片格式失败: {}", e))?;
    
    reader.decode().map_err(|e| format!("解码图片失败: {}", e))
}

fn gen_output_path(base_name: &str, ext: &str) -> PathBuf {
    let mut dir = std::env::temp_dir();
    dir.push("hotel-designer-toolkit");
    let _ = std::fs::create_dir_all(&dir);
    dir.join(format!("{}-{}.{}", base_name, Uuid::new_v4(), ext))
}

#[tauri::command]
pub async fn get_image_metadata(app: tauri::AppHandle, file_path: String) -> Result<ImageMetadata, String> {
    let safe_path = ensure_compatible_path(&app, &file_path).await?;
    let p = Path::new(&safe_path);
    let size = p.metadata().map_err(|e| e.to_string())?.len();
    
    let img = open_image_robust(&safe_path)?;
    let (width, height) = img.dimensions();
    
    let format = p.extension().unwrap_or_default().to_string_lossy().into_owned();

    Ok(ImageMetadata {
        width,
        height,
        format,
        size,
    })
}

#[tauri::command]
pub async fn convert_image(app: tauri::AppHandle, file_path: String, options: ConvertOptions) -> Result<ConvertResult, String> {
    let safe_path = ensure_compatible_path(&app, &file_path).await?;
    let mut img = open_image_robust(&safe_path)?;
    
    if let (Some(w_str), Some(h_str)) = (&options.width, &options.height) {
        if let (Ok(w), Ok(h)) = (w_str.parse::<u32>(), h_str.parse::<u32>()) {
            let fit = options.fit.as_deref().unwrap_or("inside");
            if fit == "cover" {
                img = img.resize_to_fill(w, h, image::imageops::FilterType::Lanczos3);
            } else if fit == "fill" {
                img = img.resize_exact(w, h, image::imageops::FilterType::Lanczos3);
            } else {
                img = img.resize(w, h, image::imageops::FilterType::Lanczos3);
            }
        }
    } else if let Some(w_str) = &options.width {
        if let Ok(w) = w_str.parse::<u32>() {
            let ratio = w as f32 / img.width() as f32;
            let h = (img.height() as f32 * ratio) as u32;
            img = img.resize(w, h, image::imageops::FilterType::Lanczos3);
        }
    } else if let Some(h_str) = &options.height {
        if let Ok(h) = h_str.parse::<u32>() {
            let ratio = h as f32 / img.height() as f32;
            let w = (img.width() as f32 * ratio) as u32;
            img = img.resize(w, h, image::imageops::FilterType::Lanczos3);
        }
    }

    let ext = options.format.unwrap_or_else(|| "jpg".to_string());
    let out_path = gen_output_path("converted", &ext);
    
    img.save(&out_path).map_err(|e| e.to_string())?;
    
    let filename = out_path.file_name().unwrap().to_string_lossy().to_string();
    let size = out_path.metadata().unwrap().len();

    Ok(ConvertResult {
        url: out_path.to_string_lossy().to_string(),
        filename,
        size
    })
}

#[tauri::command]
pub async fn stitch_images(app: tauri::AppHandle, file_paths: Vec<String>, options: StitchOptions) -> Result<ConvertResult, String> {
    if file_paths.is_empty() {
        return Err("No images provided".to_string());
    }

    let mut images = Vec::new();
    for p in file_paths {
        let safe_p = ensure_compatible_path(&app, &p).await?;
        let img = open_image_robust(&safe_p)?;
        images.push(img);
    }

    let direction = options.direction.as_deref().unwrap_or("vertical");
    let gap = options.gap.as_ref()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(0);
    
    let target_width = options.target_width.as_ref()
        .and_then(|s| s.parse::<u32>().ok());

    if let Some(tw) = target_width {
        for img in &mut images {
            if img.width() != tw {
                let ratio = tw as f32 / img.width() as f32;
                let h = (img.height() as f32 * ratio) as u32;
                *img = img.resize(tw, h, image::imageops::FilterType::Lanczos3);
            }
        }
    }

    let (total_width, total_height) = if direction == "vertical" {
        (
            images.iter().map(|i| i.width()).max().unwrap_or(0),
            images.iter().map(|i| i.height()).sum::<u32>() + gap * (images.len() as u32 - 1)
        )
    } else {
        (
            images.iter().map(|i| i.width()).sum::<u32>() + gap * (images.len() as u32 - 1),
            images.iter().map(|i| i.height()).max().unwrap_or(0)
        )
    };

    let mut canvas = image::RgbaImage::new(total_width, total_height);
    
    if let Some(bg) = options.background_color.as_deref() {
        let color = match bg {
            "white" => image::Rgba([255, 255, 255, 255]),
            "black" => image::Rgba([0, 0, 0, 255]),
            _ => image::Rgba([0, 0, 0, 0]),
        };
        for pixel in canvas.pixels_mut() {
            *pixel = color;
        }
    }

    let mut current_x = 0;
    let mut current_y = 0;
    
    for img in images {
        let x_offset = if direction == "vertical" {
            match options.align.as_deref().unwrap_or("center") {
                "left" => 0,
                "right" => (total_width - img.width()) as i64,
                _ => ((total_width - img.width()) / 2) as i64,
            }
        } else { 0 };

        let y_offset = if direction == "horizontal" {
            match options.align.as_deref().unwrap_or("center") {
                "top" => 0,
                "bottom" => (total_height - img.height()) as i64,
                _ => ((total_height - img.height()) / 2) as i64,
            }
        } else { 0 };

        image::imageops::overlay(&mut canvas, &img, current_x as i64 + x_offset, current_y as i64 + y_offset);
        if direction == "vertical" {
            current_y += img.height() + gap;
        } else {
            current_x += img.width() + gap;
        }
    }

    let ext = options.format.unwrap_or_else(|| "png".to_string());
    let out_path = gen_output_path("stitched", &ext);
    canvas.save(&out_path).map_err(|e| e.to_string())?;
    
    Ok(ConvertResult {
        url: out_path.to_string_lossy().to_string(),
        filename: out_path.file_name().unwrap().to_string_lossy().to_string(),
        size: std::fs::metadata(&out_path).unwrap().len()
    })
}

#[tauri::command]
pub async fn split_image(app: tauri::AppHandle, file_path: String, options: SplitOptions) -> Result<SplitResult, String> {
    let safe_path = ensure_compatible_path(&app, &file_path).await?;
    let img = open_image_robust(&safe_path)?;

    let direction = options.direction.as_deref().unwrap_or("vertical");
    let limit = options.limit.as_ref()
        .and_then(|s| s.parse::<u32>().ok())
        .unwrap_or(1000);
    let ext = options.format.unwrap_or_else(|| "png".to_string());
    
    let mut results = Vec::new();
    let total_width = img.width();
    let total_height = img.height();

    let mut out_dir = std::env::temp_dir();
    out_dir.push(format!("split-{}", Uuid::new_v4()));
    std::fs::create_dir_all(&out_dir).map_err(|e| e.to_string())?;

    if direction == "vertical" {
        let slices = (total_height as f64 / limit as f64).ceil() as u32;
        for i in 0..slices {
            let top = i * limit;
            let current_height = std::cmp::min(limit, total_height - top);
            
            let cropped = img.crop_imm(0, top, total_width, current_height);
            let filename = format!("split-{}.{}", i + 1, ext);
            let out_path = out_dir.join(&filename);
            cropped.save(&out_path).map_err(|e| e.to_string())?;
            
            results.push(ConvertResult {
                url: out_path.to_string_lossy().to_string(),
                filename,
                size: std::fs::metadata(&out_path).unwrap().len()
            });
        }
    } else {
        let slices = (total_width as f64 / limit as f64).ceil() as u32;
        for i in 0..slices {
            let left = i * limit;
            let current_width = std::cmp::min(limit, total_width - left);
            
            let cropped = img.crop_imm(left, 0, current_width, total_height);
            let filename = format!("split-{}.{}", i + 1, ext);
            let out_path = out_dir.join(&filename);
            cropped.save(&out_path).map_err(|e| e.to_string())?;
            
            results.push(ConvertResult {
                url: out_path.to_string_lossy().to_string(),
                filename,
                size: std::fs::metadata(&out_path).unwrap().len()
            });
        }
    }

    Ok(SplitResult {
        count: results.len(),
        images: results,
        dir: out_dir.to_string_lossy().to_string(),
    })
}
