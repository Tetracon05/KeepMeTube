//! Resolves the path to bundled sidecar binaries (yt-dlp and ffmpeg).
//!
//! Tries multiple candidate locations in order:
//! 1. Resource directory (`Contents/Resources` on macOS, resource path on Windows/Linux)
//! 2. App executable directory (`Contents/MacOS` on macOS, next to exe on Windows/Linux)
//! 3. Current working directory / dev tree (`src-tauri/binaries` or `binaries`)
//! 4. System PATH fallback (ensures the app never panics at startup)

use std::path::PathBuf;
use tauri::AppHandle;
use tauri::Manager;

/// Resolves the absolute path to a bundled sidecar binary.
pub fn resolve_sidecar_path(app: &AppHandle, name: &str) -> Result<PathBuf, String> {
    let target_triple = get_target_triple();

    #[cfg(target_os = "windows")]
    let filename_with_triple = format!("{}-{}.exe", name, target_triple);
    #[cfg(not(target_os = "windows"))]
    let filename_with_triple = format!("{}-{}", name, target_triple);

    #[cfg(target_os = "windows")]
    let plain_name = format!("{}.exe", name);
    #[cfg(not(target_os = "windows"))]
    let plain_name = name.to_string();

    let mut candidates: Vec<PathBuf> = Vec::new();

    // 1. Resource dir candidates
    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("binaries").join(&filename_with_triple));
        candidates.push(resource_dir.join("binaries").join(&plain_name));
        candidates.push(resource_dir.join(&filename_with_triple));
        candidates.push(resource_dir.join(&plain_name));
    }

    // 2. Current exe dir candidates (on macOS this is Contents/MacOS where Tauri puts sidecars)
    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            candidates.push(exe_dir.join(&filename_with_triple));
            candidates.push(exe_dir.join(&plain_name));
            candidates.push(exe_dir.join("binaries").join(&filename_with_triple));
            candidates.push(exe_dir.join("binaries").join(&plain_name));
            // macOS bundle Contents/Resources check from Contents/MacOS
            if let Some(contents_dir) = exe_dir.parent() {
                let res_dir = contents_dir.join("Resources");
                candidates.push(res_dir.join("binaries").join(&filename_with_triple));
                candidates.push(res_dir.join("binaries").join(&plain_name));
                candidates.push(res_dir.join(&filename_with_triple));
                candidates.push(res_dir.join(&plain_name));
            }
        }
    }

    // 3. Dev / working directory candidates
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("src-tauri").join("binaries").join(&filename_with_triple));
        candidates.push(cwd.join("binaries").join(&filename_with_triple));
        candidates.push(cwd.join("src-tauri").join("binaries").join(&plain_name));
        candidates.push(cwd.join("binaries").join(&plain_name));
    }

    // Check each candidate path
    for candidate in &candidates {
        if candidate.exists() && candidate.is_file() {
            // Ensure executable permission on Unix
            #[cfg(unix)]
            {
                use std::os::unix::fs::PermissionsExt;
                if let Ok(metadata) = std::fs::metadata(candidate) {
                    let mut perms = metadata.permissions();
                    if perms.mode() & 0o111 == 0 {
                        perms.set_mode(perms.mode() | 0o755);
                        let _ = std::fs::set_permissions(candidate, perms);
                    }
                }
            }
            return Ok(candidate.clone());
        }
    }

    // 4. Fallback: check if binary is available in system PATH instead of panicking
    if let Ok(path_var) = std::env::var("PATH") {
        for path_dir in std::env::split_paths(&path_var) {
            let full_path = path_dir.join(&plain_name);
            if full_path.exists() && full_path.is_file() {
                return Ok(full_path);
            }
        }
    }

    // If still not found, return plain name so Command::new still attempts to run it
    Ok(PathBuf::from(name))
}

fn get_target_triple() -> &'static str {
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
