use crate::state::{AppState, DownloadEntry, DownloadKind, DownloadStatus, ProgressEvent};
use crate::store;
use std::process::Stdio;
use tauri::{Emitter, State, AppHandle};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

/// Start a new download
#[tauri::command]
pub async fn start_download(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    url: String,
    title: String,
    format_args: Vec<String>,
    output_path: String,
    kind: String,
) -> Result<(), String> {
    let download_kind = match kind.as_str() {
        "video" => DownloadKind::Video,
        "audio" => DownloadKind::Audio,
        _ => DownloadKind::VideoAudio,
    };

    let entry = DownloadEntry {
        id: id.clone(),
        url: url.clone(),
        title: title.clone(),
        kind: download_kind,
        status: DownloadStatus::Downloading,
        progress: 0.0,
        speed: String::new(),
        file_path: output_path.clone(),
        file_size: None,
        error: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        format_args: format_args.clone(),
    };

    // Add to downloads list
    {
        let mut downloads = state.downloads.lock().await;
        downloads.push(entry);
        let data_dir = state.data_dir.lock().await;
        store::save_downloads(&data_dir, &downloads);
    }

    // Check concurrent download limit
    let active_count = {
        let processes = state.active_processes.lock().await;
        processes.len()
    };

    if active_count >= state.max_concurrent {
        // Queue it as pending
        let mut downloads = state.downloads.lock().await;
        if let Some(dl) = downloads.iter_mut().find(|d| d.id == id) {
            dl.status = DownloadStatus::Pending;
        }
        let data_dir = state.data_dir.lock().await;
        store::save_downloads(&data_dir, &downloads);

        app.emit("download-progress", ProgressEvent {
            id: id.clone(),
            status: DownloadStatus::Pending,
            progress: 0.0,
            speed: String::new(),
            error: None,
        }).ok();

        return Ok(());
    }

    // Spawn the actual download
    spawn_download(app, state, id, url, format_args, output_path).await
}

/// Spawn the yt-dlp download subprocess
async fn spawn_download(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
    url: String,
    format_args: Vec<String>,
    output_path: String,
) -> Result<(), String> {
    let mut cmd_args = vec![
        "--newline".to_string(),
        "--no-playlist".to_string(),
        "--force-overwrites".to_string(),
        // Let yt-dlp pick the best client automatically — do NOT hardcode
        // player_client as YouTube frequently rotates client restrictions.
        // Cookies (--cookies path/to/cookies.txt) are passed via format_args
        // from the frontend if the user has configured a cookies file.
        //
        // --windows-filenames: sanitise output filename for Windows
        // (prevents [Errno 22] Invalid argument on paths with special chars)
        "--windows-filenames".to_string(),
        "--progress-template".to_string(),
        "download:%(progress._percent_str)s|||%(progress._speed_str)s|||%(progress._eta_str)s".to_string(),
        "-o".to_string(),
        output_path.clone(),
    ];
    cmd_args.extend(format_args);
    cmd_args.push(url);

    // Use the bundled yt-dlp binary path stored in AppState (no PATH dependency)
    let mut cmd = Command::new(&state.yt_dlp_path);
    cmd.args(&cmd_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        cmd.creation_flags(0x08000000);
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start yt-dlp: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Store process
    {
        let mut processes = state.active_processes.lock().await;
        processes.insert(id.clone(), child);
    }

    let app_clone = app.clone();
    let id_clone = id.clone();
    let state_downloads = state.downloads.clone();
    let state_data_dir = state.data_dir.clone();
    let state_processes = state.active_processes.clone();

    // Read stderr in background
    let stderr_content = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
    let stderr_clone = stderr_content.clone();

    tokio::spawn(async move {
        let mut reader = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = reader.next_line().await {
            let mut content = stderr_clone.lock().unwrap();
            if !content.is_empty() {
                content.push('\n');
            }
            content.push_str(&line);
        }
    });

    // Read stdout progress in background
    let downloads_for_progress = state_downloads.clone();
    let data_dir_for_progress = state_data_dir.clone();
    let id_for_progress = id.clone();
    let app_for_progress = app.clone();

    tokio::spawn(async move {
        let mut reader = BufReader::new(stdout).lines();
        let mut is_processing = false;

        while let Ok(Some(line)) = reader.next_line().await {
            let trimmed = line.trim().to_string();

            // Check for processing phase markers
            if trimmed.contains("[Merger]")
                || trimmed.contains("[ExtractAudio]")
                || trimmed.contains("[ffmpeg]")
                || trimmed.contains("[Fixup")
            {
                is_processing = true;
                app_for_progress.emit("download-progress", ProgressEvent {
                    id: id_for_progress.clone(),
                    status: DownloadStatus::Processing,
                    progress: 100.0,
                    speed: String::new(),
                    error: None,
                }).ok();

                let mut dls = downloads_for_progress.lock().await;
                if let Some(dl) = dls.iter_mut().find(|d| d.id == id_for_progress) {
                    dl.status = DownloadStatus::Processing;
                }
                let dd = data_dir_for_progress.lock().await;
                store::save_downloads(&dd, &dls);
                continue;
            }

            // Parse progress template output: "  45.2%|||3.21MiB/s|||00:25"
            if trimmed.contains("|||") {
                let parts: Vec<&str> = trimmed.split("|||").collect();
                if parts.len() >= 2 {
                    let percent_str = parts[0].trim().trim_end_matches('%');
                    let speed_str = parts[1].trim().to_string();

                    if let Ok(pct) = percent_str.parse::<f64>() {
                        if !is_processing {
                            app_for_progress.emit("download-progress", ProgressEvent {
                                id: id_for_progress.clone(),
                                status: DownloadStatus::Downloading,
                                progress: pct,
                                speed: speed_str.clone(),
                                error: None,
                            }).ok();

                            let mut dls = downloads_for_progress.lock().await;
                            if let Some(dl) = dls.iter_mut().find(|d| d.id == id_for_progress) {
                                dl.progress = pct;
                                dl.speed = speed_str;
                            }
                            let dd = data_dir_for_progress.lock().await;
                            store::save_downloads(&dd, &dls);
                        }
                    }
                }
            }
        }
    });

    // Wait for process completion in background
    tokio::spawn(async move {
        let exit_status = {
            let mut processes = state_processes.lock().await;
            if let Some(child) = processes.get_mut(&id_clone) {
                child.wait().await.ok()
            } else {
                None
            }
        };

        // Remove from active processes
        {
            let mut processes = state_processes.lock().await;
            processes.remove(&id_clone);
        }

        let success = exit_status.map(|s| s.success()).unwrap_or(false);

        let final_status = if success {
            DownloadStatus::Completed
        } else {
            // Check if it was cancelled (process killed intentionally)
            let downloads = state_downloads.lock().await;
            if let Some(dl) = downloads.iter().find(|d| d.id == id_clone) {
                if dl.status == DownloadStatus::Cancelled {
                    return; // Don't overwrite intentional status
                }
            }
            DownloadStatus::Failed
        };

        let error_msg = if !success {
            let content = stderr_content.lock().unwrap();
            if content.is_empty() {
                Some("Download failed with unknown error".to_string())
            } else {
                Some(content.clone())
            }
        } else {
            None
        };

        // Update stored entry
        {
            let mut downloads = state_downloads.lock().await;
            if let Some(dl) = downloads.iter_mut().find(|d| d.id == id_clone) {
                dl.status = final_status.clone();
                dl.progress = if success { 100.0 } else { dl.progress };
                dl.speed = String::new();
                dl.error = error_msg.clone();
                // Compute file size on completion
                if success {
                    if let Ok(meta) = std::fs::metadata(&dl.file_path) {
                        dl.file_size = Some(meta.len());
                    }
                }
            }
            let data_dir = state_data_dir.lock().await;
            store::save_downloads(&data_dir, &downloads);
        }

        app_clone.emit("download-progress", ProgressEvent {
            id: id_clone.clone(),
            status: final_status,
            progress: if success { 100.0 } else { 0.0 },
            speed: String::new(),
            error: error_msg,
        }).ok();
    });

    Ok(())
}

/// Cancel a download and remove partial files
#[tauri::command]
pub async fn cancel_download(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    // Mark as cancelled first
    {
        let mut downloads = state.downloads.lock().await;
        if let Some(dl) = downloads.iter_mut().find(|d| d.id == id) {
            dl.status = DownloadStatus::Cancelled;
            dl.speed = String::new();
        }
        let data_dir = state.data_dir.lock().await;
        store::save_downloads(&data_dir, &downloads);
    }

    // Kill process
    {
        let mut processes = state.active_processes.lock().await;
        if let Some(child) = processes.get_mut(&id) {
            child.kill().await.ok();
        }
        processes.remove(&id);
    }

    app.emit("download-progress", ProgressEvent {
        id,
        status: DownloadStatus::Cancelled,
        progress: 0.0,  // Reset to 0 on cancel (intentional)
        speed: String::new(),
        error: None,
    }).ok();

    Ok(())
}

/// Get all downloads from the state
#[tauri::command]
pub async fn get_downloads(state: State<'_, AppState>) -> Result<Vec<DownloadEntry>, String> {
    let downloads = state.downloads.lock().await;
    Ok(downloads.clone())
}

/// Get the default download directory
#[tauri::command]
pub async fn get_default_download_dir() -> Result<String, String> {
    dirs::download_dir()
        .or_else(|| dirs::home_dir().map(|h| h.join("Downloads")))
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not determine download directory".to_string())
}
