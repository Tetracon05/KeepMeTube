//! Resolves the path to a bundled sidecar binary (yt-dlp or ffmpeg).
//!
//! Tauri bundles external binaries using the naming convention:
//!   {name}_{target-triple}[.exe]
//!
//! At runtime we locate the binary inside the app's resource directory,
//! ensure it is executable (Unix), and return the absolute path so that
//! `tokio::process::Command` can invoke it directly — no PATH dependency.

use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

/// Returns the absolute path to a bundled sidecar binary.
///
/// # Arguments
/// * `app`  - The Tauri `AppHandle` used to locate the resource directory.
/// * `name` - The binary name without extension or target suffix (e.g. `"yt-dlp"`).
///
/// # Errors
/// Returns an error string if the resource directory cannot be resolved or the
/// binary file does not exist.
pub fn resolve_sidecar_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    // Determine the target triple this binary was compiled for.
    // `std::env::consts` gives us the OS and architecture at compile time.
    let target_triple = get_target_triple();

    // Build the platform-specific filename that Tauri produces.
    // Tauri's externalBin uses dash-separated naming: {name}-{target-triple}[.exe]
    #[cfg(target_os = "windows")]
    let filename = format!("{}-{}.exe", name, target_triple);
    #[cfg(not(target_os = "windows"))]
    let filename = format!("{}-{}", name, target_triple);

    // Resolve against the app's resource directory (where `externalBin` files land).
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| format!("Could not locate resource directory: {}", e))?;

    let binary_path = resource_dir.join("binaries").join(&filename);

    if !binary_path.exists() {
        return Err(format!(
            "Bundled binary not found: {} (expected at {})",
            filename,
            binary_path.display()
        ));
    }

    // On Unix systems ensure the executable bit is set.
    // The bit may be lost if the binary was extracted from a zip/tar without
    // preserving permissions.
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = std::fs::metadata(&binary_path)
            .map_err(|e| format!("Cannot read permissions for {}: {}", filename, e))?
            .permissions();
        if perms.mode() & 0o111 == 0 {
            perms.set_mode(perms.mode() | 0o755);
            std::fs::set_permissions(&binary_path, perms)
                .map_err(|e| format!("Cannot set executable bit on {}: {}", filename, e))?;
        }
    }

    Ok(binary_path)
}

/// Returns the Rust target triple for the current compilation target.
/// This mirrors how `tauri-build` names sidecar binaries.
fn get_target_triple() -> &'static str {
    // These cfg values are set by the Rust compiler based on the build target.
    #[cfg(all(target_os = "macos", target_arch = "aarch64"))]
    return "aarch64-apple-darwin";

    #[cfg(all(target_os = "macos", target_arch = "x86_64"))]
    return "x86_64-apple-darwin";

    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    return "x86_64-pc-windows-msvc";

    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return "x86_64-unknown-linux-gnu";

    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    return "aarch64-unknown-linux-gnu";

    #[allow(unreachable_code)]
    "unknown-unknown-unknown"
}
