use crate::state::{AppState, DownloadStatus};
use crate::store;
use std::fs;
use std::path::Path;
use tauri::{Manager, State};

/// Copy a user-selected cookies.txt into the app's private data directory
/// and return the copy's path.
///
/// yt-dlp treats `--cookies FILE` as a read/write jar: after a run it
/// rewrites FILE with refreshed session cookies. Passing the user's own
/// file straight through means that rewrite happens wherever they picked it
/// from — if that's their download folder, it looks like a stray cookies
/// file appearing after every download. Using a private copy keeps that
/// rewriting entirely inside the app's own data dir instead.
#[tauri::command]
pub async fn import_cookies_file(
    state: State<'_, AppState>,
    source_path: String,
) -> Result<String, String> {
    let data_dir = state.data_dir.lock().await.clone();
    let dest_path = Path::new(&data_dir).join("cookies.txt");
    fs::copy(&source_path, &dest_path)
        .map_err(|e| format!("Failed to import cookies file: {}", e))?;
    Ok(dest_path.to_string_lossy().to_string())
}

/// Delete a download entry AND its file from disk
#[tauri::command]
pub async fn delete_download(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let mut downloads = state.downloads.lock().await;

    // Find and remove the entry, delete the file
    if let Some(pos) = downloads.iter().position(|d| d.id == id) {
        let file_path = downloads[pos].file_path.clone();
        downloads.remove(pos);

        // Try to delete the file from disk
        if !file_path.is_empty() {
            let path = Path::new(&file_path);
            if path.exists() {
                fs::remove_file(path).ok();
            }
            // Also try to remove .part files (yt-dlp temporary)
            let part_path = format!("{}.part", file_path);
            if Path::new(&part_path).exists() {
                fs::remove_file(&part_path).ok();
            }
        }
    }

    let data_dir = state.data_dir.lock().await;
    store::save_downloads(&data_dir, &downloads);
    Ok(())
}

/// Remove a download entry from the list (keep file on disk)
#[tauri::command]
pub async fn remove_download(
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let mut downloads = state.downloads.lock().await;
    downloads.retain(|d| d.id != id);
    let data_dir = state.data_dir.lock().await;
    store::save_downloads(&data_dir, &downloads);
    Ok(())
}

/// Rename a downloaded file on disk and update the entry
#[tauri::command]
pub async fn rename_download(
    state: State<'_, AppState>,
    id: String,
    new_name: String,
) -> Result<String, String> {
    let mut downloads = state.downloads.lock().await;

    let dl = downloads
        .iter_mut()
        .find(|d| d.id == id)
        .ok_or("Download not found")?;

    let old_path = Path::new(&dl.file_path);
    if !old_path.exists() {
        return Err("File not found on disk".to_string());
    }

    let parent = old_path
        .parent()
        .ok_or("Cannot determine parent directory")?;
    let extension = old_path
        .extension()
        .map(|e| e.to_string_lossy().to_string())
        .unwrap_or_default();

    let new_filename = if new_name.contains('.') {
        new_name.clone()
    } else if !extension.is_empty() {
        format!("{}.{}", new_name, extension)
    } else {
        new_name.clone()
    };

    let new_path = parent.join(&new_filename);

    fs::rename(old_path, &new_path)
        .map_err(|e| format!("Failed to rename file: {}", e))?;

    let new_path_str = new_path.to_string_lossy().to_string();
    dl.file_path = new_path_str.clone();
    dl.title = new_name;

    let data_dir = state.data_dir.lock().await;
    store::save_downloads(&data_dir, &downloads);

    Ok(new_path_str)
}

/// Open the file's location in the OS file manager
#[tauri::command]
pub async fn show_in_folder(path: String) -> Result<(), String> {
    let file_path = Path::new(&path);

    if !file_path.exists() {
        return Err("File not found".to_string());
    }

    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| format!("Failed to open Finder: {}", e))?;
    }

    #[cfg(target_os = "windows")]
    {
        use std::ffi::OsStr;
        use std::os::windows::ffi::OsStrExt;

        let clean_path = path.replace('/', "\\");
        let p = Path::new(&clean_path);

        let param = if p.is_dir() {
            format!("\"{}\"", clean_path)
        } else {
            format!("/select,\"{}\"", clean_path)
        };

        let operation: Vec<u16> = OsStr::new("open").encode_wide().chain(std::iter::once(0)).collect();
        let file: Vec<u16> = OsStr::new("explorer.exe").encode_wide().chain(std::iter::once(0)).collect();
        let parameters: Vec<u16> = OsStr::new(&param).encode_wide().chain(std::iter::once(0)).collect();

        unsafe {
            extern "system" {
                fn ShellExecuteW(
                    hwnd: *mut std::ffi::c_void,
                    lpOperation: *const u16,
                    lpFile: *const u16,
                    lpParameters: *const u16,
                    lpDirectory: *const u16,
                    nShowCmd: i32,
                ) -> *mut std::ffi::c_void;
            }
            ShellExecuteW(
                std::ptr::null_mut(),
                operation.as_ptr(),
                file.as_ptr(),
                parameters.as_ptr(),
                std::ptr::null(),
                1,
            );
        }
    }

    #[cfg(target_os = "linux")]
    {
        // Try xdg-open on the parent directory
        let parent = file_path
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| path.clone());
        std::process::Command::new("xdg-open")
            .arg(&parent)
            .spawn()
            .map_err(|e| format!("Failed to open file manager: {}", e))?;
    }

    Ok(())
}

/// Initiate a native OS drag of a downloaded file out of the application window.
///
/// Safety checks performed before starting the drag:
///   1. The download entry exists and its status is "completed"
///   2. The file path is non-empty and the file exists on disk
///   3. The file is readable (not exclusively locked by another process)
///
/// The drag is dispatched to the main OS thread via `run_on_main_thread`, so the
/// async Tauri command does not block the UI while waiting.
#[tauri::command]
pub async fn start_drag(
    state: State<'_, AppState>,
    window: tauri::WebviewWindow,
    id: String,
) -> Result<(), String> {
    // --- 1. Validate download state ---
    let downloads = state.downloads.lock().await;
    let dl = downloads
        .iter()
        .find(|d| d.id == id)
        .ok_or("Download not found")?;

    if dl.status != DownloadStatus::Completed {
        return Err(format!(
            "Cannot drag '{}': download is not completed (status: {:?})",
            dl.title, dl.status
        ));
    }

    if dl.file_path.is_empty() {
        return Err("Cannot drag: file path is not set".to_string());
    }

    // --- 2. Validate file existence ---
    let path = Path::new(&dl.file_path);
    if !path.exists() {
        return Err(format!(
            "Cannot drag: file no longer exists on disk at '{}'",
            dl.file_path
        ));
    }

    // --- 3. Check file is readable (not exclusively locked) ---
    fs::File::open(path)
        .map_err(|e| format!("Cannot drag: file is locked or not accessible: {}", e))?;

    // Canonicalize for an absolute path the OS drag API requires
    let canonical = std::fs::canonicalize(&dl.file_path)
        .unwrap_or_else(|_| std::path::PathBuf::from(&dl.file_path));

    // Release the state lock before dispatching to the main thread
    drop(downloads);

    // --- 4. Dispatch native OS drag to the main thread ---
    // drag::start_drag must run on the OS main thread (Win32 / Cocoa requirement).
    // We use a channel to propagate any error back to this async context.
    let (tx, rx) = std::sync::mpsc::channel::<Result<(), String>>();

    let app = window.app_handle().clone();
    app.run_on_main_thread(move || {
        #[allow(unused_variables)]
        let item = drag::DragItem::Files(vec![canonical]);
        // 32x32 white PNG bytes as a minimal drag icon
        #[allow(unused_variables)]
        let icon = drag::Image::Raw(vec![]);

        #[cfg(target_os = "windows")]
        let result = drag::start_drag(
            &window,
            item,
            icon,
            |_result, _cursor_pos| { /* drag ended — no-op */ },
            drag::Options {
                mode: drag::DragMode::Copy,
                skip_animatation_on_cancel_or_failure: false,
            },
        )
        .map_err(|e| format!("Failed to start native drag: {}", e));

        #[cfg(target_os = "linux")]
        let result = (|| {
            let gtk_window = window
                .gtk_window()
                .map_err(|e| format!("Failed to get GTK window: {}", e))?;
            drag::start_drag(
                &gtk_window,
                item,
                icon,
                |_result, _cursor_pos| { /* drag ended — no-op */ },
                drag::Options {
                    mode: drag::DragMode::Copy,
                    skip_animatation_on_cancel_or_failure: false,
                },
            )
            .map_err(|e| format!("Failed to start native drag: {}", e))
        })();

        #[cfg(not(any(target_os = "windows", target_os = "linux")))]
        let result: Result<(), String> = Err("Drag is not supported on this platform".to_string());

        let _ = tx.send(result);
    })
    .map_err(|e| format!("Failed to dispatch drag to main thread: {}", e))?;

    // Wait for the drag to complete (or fail)
    rx.recv()
        .map_err(|_| "Drag channel closed unexpectedly".to_string())?
}
