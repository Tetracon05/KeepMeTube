mod binary_resolver;
mod commands;
#[cfg(target_os = "macos")]
mod menu;
mod state;
mod store;

use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    #[cfg(target_os = "linux")]
    {
        if let Some(home) = dirs::home_dir() {
            let local_bin = home.join(".local").join("bin");
            if let Some(path) = std::env::var_os("PATH") {
                let mut paths = vec![local_bin, std::path::PathBuf::from("/usr/local/bin")];
                paths.extend(std::env::split_paths(&path));
                if let Ok(new_path) = std::env::join_paths(paths) {
                    std::env::set_var("PATH", &new_path);
                }
            }
        }
    }

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_drag::init())
        .plugin(tauri_plugin_updater::Builder::new().build());

    // Native app/File/Edit menu bar — macOS only, leaves Windows/Linux
    // (which have no menu bar in this app) untouched.
    #[cfg(target_os = "macos")]
    let builder = builder.menu(menu::build).on_menu_event(menu::handle_event);

    builder
        .setup(|app| {
            // Determine app data directory for persistence
            let data_dir = app
                .path()
                .app_data_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_else(|_| {
                    dirs::data_dir()
                        .map(|p| p.join("yt-downloader").to_string_lossy().to_string())
                        .unwrap_or_else(|| ".".to_string())
                });

            // Create data directory if needed
            std::fs::create_dir_all(&data_dir).ok();

            // Resolve bundled binary paths with fallback to prevent startup panics
            let yt_dlp_path = binary_resolver::resolve_sidecar_path(app.handle(), "yt-dlp")
                .unwrap_or_else(|_| std::path::PathBuf::from("yt-dlp"));
            let ffmpeg_path = binary_resolver::resolve_sidecar_path(app.handle(), "ffmpeg")
                .unwrap_or_else(|_| std::path::PathBuf::from("ffmpeg"));

            // Load persisted downloads
            let downloads = store::load_downloads(&data_dir);

            let app_state = AppState::new(
                data_dir,
                downloads,
                yt_dlp_path.to_string_lossy().to_string(),
                ffmpeg_path.to_string_lossy().to_string(),
            );

            app.manage(app_state);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::dependency::check_dependencies,
            commands::dependency::check_yt_dlp_update,
            commands::dependency::update_yt_dlp,
            commands::analyze::analyze_url,
            commands::analyze::abort_analysis,
            commands::download::start_download,
            commands::download::cancel_download,
            commands::download::get_downloads,
            commands::download::get_default_download_dir,
            commands::file_ops::delete_download,
            commands::file_ops::remove_download,
            commands::file_ops::rename_download,
            commands::file_ops::show_in_folder,
            commands::file_ops::start_drag,
            commands::app_update::check_app_update,
            commands::app_update::install_app_update,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

