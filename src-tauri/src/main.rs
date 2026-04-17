// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod image_cmds;
mod video_cmds;
mod system_check;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            image_cmds::get_image_metadata,
            image_cmds::convert_image,
            image_cmds::stitch_images,
            image_cmds::split_image,
            video_cmds::probe_video,
            video_cmds::transcode_video,
            video_cmds::extract_frames,
            video_cmds::video_to_gif,
            video_cmds::get_task_progress,
            video_cmds::open_folder,
            video_cmds::save_file,
            system_check::run_diagnostics,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
