use crate::state::{AppState, DownloadEntry, DownloadKind, DownloadStatus, ProgressEvent};
use crate::store;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use std::process::Stdio;
use std::sync::atomic::Ordering;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tauri::{Emitter, State, AppHandle};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;

/// Minimum time between full downloads.json rewrites while a download is
/// actively streaming progress. yt-dlp's `--newline` progress lines can
/// arrive many times a second; writing the whole (serialized) downloads
/// list to disk on every one of them is wasted I/O for a number the user
/// only glances at. Status transitions (queued/processing/completed/
/// failed/cancelled) always persist immediately regardless of this.
const PROGRESS_SAVE_INTERVAL: Duration = Duration::from_secs(2);

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
    playlist_id: Option<String>,
    playlist_title: Option<String>,
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
        playlist_id,
        playlist_title,
    };

    // Add to downloads list
    {
        let mut downloads = state.downloads.lock().await;
        downloads.push(entry);
        let data_dir = state.data_dir.lock().await;
        store::save_downloads(&data_dir, &downloads);
    }

    begin_download(app, &state, id, url, format_args, output_path).await
}

/// Spawn a download now if there's a free concurrency slot, otherwise queue
/// it as `Pending`. Shared by `start_download` (a brand-new entry, already
/// pushed to the list) and `retry_download` (an existing entry being
/// restarted), since both boil down to the same decision.
async fn begin_download(
    app: AppHandle,
    state: &AppState,
    id: String,
    url: String,
    format_args: Vec<String>,
    output_path: String,
) -> Result<(), String> {
    let max_concurrent = state.max_concurrent.load(Ordering::Relaxed);
    let active_count = state.active_processes.lock().await.len();

    if active_count >= max_concurrent {
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
            file_size: None,
        }).ok();

        return Ok(());
    }

    // Spawn the actual download
    spawn_download(
        app,
        state.yt_dlp_path.clone(),
        state.downloads.clone(),
        state.data_dir.clone(),
        state.active_processes.clone(),
        max_concurrent,
        id,
        url,
        format_args,
        output_path,
    )
    .await
}

/// Spawn the yt-dlp download subprocess.
///
/// Takes owned/cloned state pieces rather than `State<'_, AppState>` so it
/// can also be called from `try_start_next_pending`, which runs inside an
/// already-spawned background task (no live `State` borrow available there).
///
/// Returns a boxed future rather than being a plain `async fn`: this function
/// and `try_start_next_pending` call each other (a slot freeing up promotes
/// a pending entry, which spawns a download, whose completion tries to
/// promote the next one), and two `async fn`s whose opaque return types
/// refer to each other cause rustc's "cycle detected when computing type of
/// opaque type" error. Returning `Pin<Box<dyn Future>>` here gives this
/// function a concrete, non-opaque signature, which breaks the cycle.
fn spawn_download(
    app: AppHandle,
    yt_dlp_path: String,
    downloads: Arc<Mutex<Vec<DownloadEntry>>>,
    data_dir: Arc<Mutex<String>>,
    active_processes: Arc<Mutex<HashMap<String, Child>>>,
    max_concurrent: usize,
    id: String,
    url: String,
    format_args: Vec<String>,
    output_path: String,
) -> Pin<Box<dyn Future<Output = Result<(), String>> + Send>> {
    Box::pin(async move {
    let mut cmd_args = vec![
        "--newline".to_string(),
        "--no-playlist".to_string(),
        "--force-overwrites".to_string(),
        // --windows-filenames: sanitise output filename for Windows
        // (prevents [Errno 22] Invalid argument on paths with special chars)
        "--windows-filenames".to_string(),
        // Skip per-format HEAD verification — avoids extra round-trips before
        // the actual download stream begins.
        "--no-check-formats".to_string(),
        // yt-dlp's own preferredencoding() detection ignores PYTHONIOENCODING/
        // PYTHONUTF8 and falls back to the Windows system codepage (e.g.
        // cp1252), which can't encode some characters in progress/postprocessor
        // output and crashes with OSError: [Errno 22] Invalid argument on flush.
        // Force UTF-8 explicitly to bypass that detection.
        "--encoding".to_string(),
        "utf-8".to_string(),
        "--progress-template".to_string(),
        "download:%(progress._percent_str)s|||%(progress._speed_str)s|||%(progress._eta_str)s".to_string(),
        "-o".to_string(),
        output_path.clone(),
    ];

    // Cookies are injected by the frontend as ["--cookies", "<path>", ...] at
    // the start of format_args. When a cookies file is present we skip the
    // android client override so yt-dlp uses its authenticated web client,
    // which returns the full quality ladder (1080p / 4K).
    // Without cookies we use android for a fast single-round-trip manifest
    // fetch with no JS runtime required.
    let has_cookies = format_args.iter().any(|a| a == "--cookies");
    if !has_cookies {
        cmd_args.push("--extractor-args".to_string());
        cmd_args.push("youtube:player_client=android".to_string());
    }

    cmd_args.extend(format_args);
    cmd_args.push(url);

    // Use the bundled yt-dlp binary path stored in AppState (no PATH dependency)
    let mut cmd = Command::new(&yt_dlp_path);
    cmd.args(&cmd_args)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        // PYTHONUTF8=1 / PYTHONIOENCODING=utf-8: force UTF-8 on stdout/stderr
        // so yt-dlp doesn't crash with [Errno 22] Invalid argument when the
        // Windows console codepage (cp1252) can't represent certain characters.
        cmd.env("PYTHONIOENCODING", "utf-8")
           .env("PYTHONUTF8", "1")
           .creation_flags(0x08000000); // CREATE_NO_WINDOW
    }

    let mut child = cmd
        .spawn()
        .map_err(|e| format!("Failed to start yt-dlp: {}", e))?;

    let stdout = child.stdout.take().ok_or("Failed to capture stdout")?;
    let stderr = child.stderr.take().ok_or("Failed to capture stderr")?;

    // Store process
    {
        let mut processes = active_processes.lock().await;
        processes.insert(id.clone(), child);
    }

    let app_clone = app.clone();
    let id_clone = id.clone();
    let state_downloads = downloads.clone();
    let state_data_dir = data_dir.clone();
    let state_processes = active_processes.clone();
    let yt_dlp_path_for_next = yt_dlp_path.clone();
    let app_for_next = app.clone();

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
        // Far enough in the past that the very first progress line still saves
        // immediately, so early progress isn't invisible to a restart.
        let mut last_progress_save = Instant::now() - PROGRESS_SAVE_INTERVAL;

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
                    file_size: None,
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
                            // Always emit — the frontend needs every tick for a
                            // smooth progress bar, and this is just an in-memory
                            // event, not disk I/O.
                            app_for_progress.emit("download-progress", ProgressEvent {
                                id: id_for_progress.clone(),
                                status: DownloadStatus::Downloading,
                                progress: pct,
                                speed: speed_str.clone(),
                                error: None,
                                file_size: None,
                            }).ok();

                            let mut dls = downloads_for_progress.lock().await;
                            if let Some(dl) = dls.iter_mut().find(|d| d.id == id_for_progress) {
                                dl.progress = pct;
                                dl.speed = speed_str;
                            }
                            // But only rewrite downloads.json a few times a
                            // second — the in-memory state above is already
                            // current, and that's what get_downloads() reads.
                            if last_progress_save.elapsed() >= PROGRESS_SAVE_INTERVAL {
                                let dd = data_dir_for_progress.lock().await;
                                store::save_downloads(&dd, &dls);
                                last_progress_save = Instant::now();
                            }
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

        // Compute file size on completion before taking the downloads lock —
        // tokio::fs keeps this off the async runtime's worker thread, unlike
        // std::fs which would block it for the duration of the syscall.
        let file_path_for_size = if success {
            let downloads = state_downloads.lock().await;
            downloads.iter().find(|d| d.id == id_clone).map(|d| d.file_path.clone())
        } else {
            None
        };
        let computed_size_from_disk = match &file_path_for_size {
            Some(path) => tokio::fs::metadata(path).await.ok().map(|m| m.len()),
            None => None,
        };

        // Update stored entry
        let mut computed_file_size: Option<u64> = None;
        {
            let mut downloads = state_downloads.lock().await;
            if let Some(dl) = downloads.iter_mut().find(|d| d.id == id_clone) {
                dl.status = final_status.clone();
                dl.progress = if success { 100.0 } else { dl.progress };
                dl.speed = String::new();
                dl.error = error_msg.clone();
                if let Some(size) = computed_size_from_disk {
                    dl.file_size = Some(size);
                }
                computed_file_size = dl.file_size;
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
            file_size: computed_file_size,
        }).ok();

        // A slot just freed up — try to promote the next queued download.
        try_start_next_pending(
            app_for_next,
            yt_dlp_path_for_next,
            state_downloads,
            state_data_dir,
            state_processes,
            max_concurrent,
        ).await;
    });

    Ok(())
    })
}

/// If there's a free download slot, promote the oldest `Pending` entry to
/// `Downloading` and spawn it.
///
/// `start_download` marks a download `Pending` when the concurrency limit is
/// already reached, but nothing previously drained that queue once a slot
/// freed up — entries just sat at `Pending` forever. That was latent as long
/// as downloads were only ever added one at a time by hand; it becomes an
/// immediate problem once a playlist can queue far more entries than
/// `max_concurrent` at once. Called after a download finishes, fails, or is
/// cancelled.
async fn try_start_next_pending(
    app: AppHandle,
    yt_dlp_path: String,
    downloads: Arc<Mutex<Vec<DownloadEntry>>>,
    data_dir: Arc<Mutex<String>>,
    active_processes: Arc<Mutex<HashMap<String, Child>>>,
    max_concurrent: usize,
) {
    if active_processes.lock().await.len() >= max_concurrent {
        return;
    }

    // Oldest Pending entry first (insertion order), so a queued playlist
    // downloads in the order it was added.
    let promoted = {
        let mut downloads_guard = downloads.lock().await;
        let next = downloads_guard
            .iter_mut()
            .find(|d| d.status == DownloadStatus::Pending);
        next.map(|dl| {
            dl.status = DownloadStatus::Downloading;
            (dl.id.clone(), dl.url.clone(), dl.format_args.clone(), dl.file_path.clone())
        })
    };

    let (id, url, format_args, output_path) = match promoted {
        Some(v) => v,
        None => return,
    };

    {
        let downloads_guard = downloads.lock().await;
        let dd = data_dir.lock().await;
        store::save_downloads(&dd, &downloads_guard);
    }

    app.emit("download-progress", ProgressEvent {
        id: id.clone(),
        status: DownloadStatus::Downloading,
        progress: 0.0,
        speed: String::new(),
        error: None,
        file_size: None,
    }).ok();

    let _ = spawn_download(
        app, yt_dlp_path, downloads, data_dir, active_processes, max_concurrent,
        id, url, format_args, output_path,
    ).await;
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
        file_size: None,
    }).ok();

    // A slot just freed up — try to promote the next queued download.
    try_start_next_pending(
        app,
        state.yt_dlp_path.clone(),
        state.downloads.clone(),
        state.data_dir.clone(),
        state.active_processes.clone(),
        state.max_concurrent.load(Ordering::Relaxed),
    ).await;

    Ok(())
}

/// Re-run a failed download using its stored url/format_args/output_path.
///
/// Pause/Resume was removed: YouTube's direct media URLs are short-lived
/// and IP-locked, so a killed-and-later-resumed download frequently can't
/// actually continue from its `.part` file — yt-dlp just restarts it, which
/// is indistinguishable from Retry but with confusing "Paused" UI in
/// between. Retry (re-running from scratch, no partial-resume promise) is
/// the operation that actually works reliably.
#[tauri::command]
pub async fn retry_download(
    app: AppHandle,
    state: State<'_, AppState>,
    id: String,
) -> Result<(), String> {
    let (url, format_args, output_path) = {
        let mut downloads = state.downloads.lock().await;
        let dl = downloads
            .iter_mut()
            .find(|d| d.id == id)
            .ok_or("Download not found")?;
        dl.status = DownloadStatus::Downloading;
        dl.speed = String::new();
        dl.error = None;
        (dl.url.clone(), dl.format_args.clone(), dl.file_path.clone())
    };

    begin_download(app, &state, id, url, format_args, output_path).await
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

/// Get the current concurrent-download limit.
#[tauri::command]
pub async fn get_max_concurrent(state: State<'_, AppState>) -> Result<usize, String> {
    Ok(state.max_concurrent.load(Ordering::Relaxed))
}

/// Set the concurrent-download limit (clamped to 1-10) and persist it.
#[tauri::command]
pub async fn set_max_concurrent(
    app: AppHandle,
    state: State<'_, AppState>,
    value: usize,
) -> Result<(), String> {
    let clamped = value.clamp(1, 10);
    state.max_concurrent.store(clamped, Ordering::Relaxed);
    {
        let data_dir = state.data_dir.lock().await;
        store::save_max_concurrent(&data_dir, clamped);
    }

    // If the limit went up, promote as many now-fitting Pending entries as
    // possible instead of leaving them queued until something else finishes.
    loop {
        let active_count = state.active_processes.lock().await.len();
        if active_count >= clamped {
            break;
        }
        let has_pending = {
            let downloads = state.downloads.lock().await;
            downloads.iter().any(|d| d.status == DownloadStatus::Pending)
        };
        if !has_pending {
            break;
        }
        try_start_next_pending(
            app.clone(),
            state.yt_dlp_path.clone(),
            state.downloads.clone(),
            state.data_dir.clone(),
            state.active_processes.clone(),
            clamped,
        ).await;
    }

    Ok(())
}
