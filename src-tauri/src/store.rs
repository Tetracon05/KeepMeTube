use crate::state::DownloadEntry;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const STORE_FILE: &str = "downloads.json";
const SETTINGS_FILE: &str = "settings.json";

fn default_max_concurrent() -> usize {
    3
}

#[derive(Serialize, Deserialize)]
struct AppSettings {
    #[serde(default = "default_max_concurrent")]
    max_concurrent: usize,
}

/// Get the path to the downloads JSON store file
fn get_store_path(data_dir: &str) -> PathBuf {
    let path = PathBuf::from(data_dir);
    fs::create_dir_all(&path).ok();
    path.join(STORE_FILE)
}

/// Load all download entries from the JSON store
pub fn load_downloads(data_dir: &str) -> Vec<DownloadEntry> {
    let path = get_store_path(data_dir);
    if !path.exists() {
        return Vec::new();
    }

    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
        Err(_) => Vec::new(),
    }
}

/// Save all download entries to the JSON store
pub fn save_downloads(data_dir: &str, downloads: &[DownloadEntry]) {
    let path = get_store_path(data_dir);
    if let Ok(json) = serde_json::to_string_pretty(downloads) {
        fs::write(&path, json).ok();
    }
}

/// Load the persisted concurrent-download limit, defaulting to 3.
pub fn load_max_concurrent(data_dir: &str) -> usize {
    let path = PathBuf::from(data_dir).join(SETTINGS_FILE);
    fs::read_to_string(&path)
        .ok()
        .and_then(|content| serde_json::from_str::<AppSettings>(&content).ok())
        .map(|s| s.max_concurrent)
        .unwrap_or_else(default_max_concurrent)
}

/// Persist the concurrent-download limit so it survives an app restart.
pub fn save_max_concurrent(data_dir: &str, value: usize) {
    let path = PathBuf::from(data_dir).join(SETTINGS_FILE);
    if let Ok(json) = serde_json::to_string_pretty(&AppSettings { max_concurrent: value }) {
        fs::write(&path, json).ok();
    }
}
