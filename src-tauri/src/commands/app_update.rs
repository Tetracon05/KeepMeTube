//! Application self-update commands powered by `tauri-plugin-updater`.
//!
//! The updater checks the GitHub Releases endpoint configured in `tauri.conf.json`
//! and compares the remote version against the currently running version.
//! All downloads are verified against the cryptographic signature embedded in
//! `latest.json`, so tampered packages are rejected automatically.

use crate::state::AppUpdateInfo;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

/// Check whether a newer application version is available.
///
/// Returns `Some(AppUpdateInfo)` when an update exists, `None` when the app is
/// already up to date, or an error if the network request fails.
#[tauri::command]
pub async fn check_app_update(app: AppHandle) -> Result<Option<AppUpdateInfo>, String> {
    let updater = app
        .updater_builder()
        .build()
        .map_err(|e| format!("Failed to initialise updater: {}", e))?;

    match updater.check().await {
        Ok(Some(update)) => Ok(Some(AppUpdateInfo {
            version: update.version.clone(),
            notes: update.body.clone(),
            pub_date: update.date.map(|d| d.to_string()),
        })),
        Ok(None) => Ok(None),
        Err(e) => Err(format!("Update check failed: {}", e)),
    }
}

/// Download, verify, and install the pending application update, then restart.
///
/// This command blocks until the installer is ready, then hands off to the OS.
/// The application will relaunch automatically after the update completes.
#[tauri::command]
pub async fn install_app_update(app: AppHandle) -> Result<(), String> {
    let updater = app
        .updater_builder()
        .build()
        .map_err(|e| format!("Failed to initialise updater: {}", e))?;

    let update = updater
        .check()
        .await
        .map_err(|e| format!("Update check failed: {}", e))?
        .ok_or_else(|| "No update available".to_string())?;

    update
        .download_and_install(
            |_chunk, _total| {
                // Progress events could be emitted here if needed.
                // The frontend polls via the Tauri event system instead.
            },
            || {
                // Called just before the installer is launched.
            },
        )
        .await
        .map_err(|e| format!("Update installation failed: {}", e))?;

    // Relaunch the application after installation.
    app.restart();
}
