use crate::state::{AppState, DependencyStatus, UpdateCheckResult};
use std::path::Path;
use std::process::Command;
use tauri::State;

/// Check if the bundled yt-dlp and ffmpeg binaries are present and functional.
#[tauri::command]
pub async fn check_dependencies(state: State<'_, AppState>) -> Result<DependencyStatus, String> {
    let yt_dlp = run_version_check(&state.yt_dlp_path, &["--version"]);
    let ffmpeg = run_version_check(&state.ffmpeg_path, &["-version"]);

    Ok(DependencyStatus {
        yt_dlp_installed: yt_dlp.is_some(),
        ffmpeg_installed: ffmpeg.is_some(),
        yt_dlp_version: yt_dlp,
        ffmpeg_version: ffmpeg,
    })
}

/// Try to run a binary at an explicit path and return its version string.
fn run_version_check(path: &str, args: &[&str]) -> Option<String> {
    if path.is_empty() || !Path::new(path).exists() {
        return None;
    }

    let mut cmd = Command::new(path);
    cmd.args(args);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    match cmd.output() {
        Ok(output) if output.status.success() => {
            let stdout = String::from_utf8_lossy(&output.stdout);
            let version = stdout.lines().next().unwrap_or("").trim().to_string();
            Some(version)
        }
        _ => None,
    }
}

/// Check if a newer version of yt-dlp is available.
/// Compares the locally bundled version against the latest GitHub release.
#[tauri::command]
pub async fn check_yt_dlp_update(
    state: State<'_, AppState>,
) -> Result<UpdateCheckResult, String> {
    // Get current bundled version
    let current = run_version_check(&state.yt_dlp_path, &["--version"])
        .ok_or_else(|| "Could not determine bundled yt-dlp version".to_string())?;

    // Fetch the latest release tag from GitHub API
    let latest = fetch_latest_yt_dlp_version().await?;

    let update_available = normalize_version(&latest) > normalize_version(&current);

    Ok(UpdateCheckResult {
        current_version: current,
        latest_version: latest,
        update_available,
    })
}

/// Fetch the latest yt-dlp version string from GitHub releases API.
async fn fetch_latest_yt_dlp_version() -> Result<String, String> {
    let url = "https://api.github.com/repos/yt-dlp/yt-dlp/releases/latest";

    let mut cmd = Command::new("curl");
    cmd.args(["-s", "-A", "keepmetube-app/1.0", url]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        cmd.creation_flags(0x08000000);
    }

    let output = cmd
        .output()
        .map_err(|e| format!("Failed to fetch latest version: {}", e))?;

    if !output.status.success() {
        return Err("Failed to fetch latest yt-dlp release from GitHub".to_string());
    }

    let body = String::from_utf8_lossy(&output.stdout);

    let tag = body
        .split("\"tag_name\"")
        .nth(1)
        .and_then(|s| s.split('"').nth(1))
        .map(|s| s.trim().to_string())
        .ok_or_else(|| "Could not parse latest version from GitHub response".to_string())?;

    Ok(tag)
}

/// Normalize a version string: strip leading "stable@", "nightly@" etc.
fn normalize_version(v: &str) -> String {
    if let Some(pos) = v.find('@') {
        v[pos + 1..].to_string()
    } else {
        v.to_string()
    }
}

/// Update the bundled yt-dlp binary by downloading the latest release from GitHub
/// and replacing the current binary file.
#[tauri::command]
pub async fn update_yt_dlp(state: State<'_, AppState>) -> Result<String, String> {
    let current_path = state.yt_dlp_path.clone();
    if current_path.is_empty() {
        return Err("Could not determine bundled yt-dlp path".to_string());
    }

    #[cfg(target_os = "macos")]
    let download_url =
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_macos";
    #[cfg(target_os = "windows")]
    let download_url = "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe";
    #[cfg(target_os = "linux")]
    let download_url =
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp_linux";

    let tmp_path = format!("{}.tmp", current_path);

    let mut curl_cmd = Command::new("curl");
    curl_cmd.args(["-fsSL", "-o", &tmp_path, download_url]);

    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        curl_cmd.creation_flags(0x08000000);
    }

    let output = curl_cmd
        .output()
        .map_err(|e| format!("Download failed: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "Download failed: {}",
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&tmp_path)
            .map_err(|e| format!("Cannot read temp file permissions: {}", e))?
            .permissions();
        perms.set_mode(0o755);
        std::fs::set_permissions(&tmp_path, perms)
            .map_err(|e| format!("Cannot set executable bit: {}", e))?;
    }

    std::fs::rename(&tmp_path, &current_path)
        .map_err(|e| format!("Failed to replace binary: {}", e))?;

    let new_version = run_version_check(&current_path, &["--version"])
        .unwrap_or_else(|| "unknown".to_string());

    Ok(format!(
        "yt-dlp updated successfully to {}",
        new_version
    ))
}
