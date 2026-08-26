use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Represents the current status of a download
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadStatus {
    Pending,
    Analyzing,
    Downloading,
    Processing,
    Completed,
    Failed,
    Cancelled,
}

/// Represents the type of download content
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum DownloadKind {
    Video,
    Audio,
    VideoAudio,
}

/// A single download entry stored in the app's download history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownloadEntry {
    pub id: String,
    pub url: String,
    pub title: String,
    pub kind: DownloadKind,
    pub status: DownloadStatus,
    pub progress: f64,
    pub speed: String,
    pub file_path: String,
    pub file_size: Option<u64>,
    pub error: Option<String>,
    pub created_at: String,
    /// The yt-dlp format arguments used when this download was started.
    /// Stored so that resume can replay the exact same format selection.
    #[serde(default)]
    pub format_args: Vec<String>,
}

/// Progress event emitted to the frontend during downloads
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEvent {
    pub id: String,
    pub status: DownloadStatus,
    pub progress: f64,
    pub speed: String,
    pub error: Option<String>,
}

/// Result of analyzing a URL with yt-dlp
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoFormat {
    pub format_id: String,
    pub ext: String,
    pub resolution: String,
    pub width: Option<u32>,
    pub height: Option<u32>,
    pub fps: Option<f64>,
    pub vcodec: String,
    pub acodec: String,
    pub filesize: Option<u64>,
    pub tbr: Option<f64>,
    pub abr: Option<f64>,
    pub format_note: String,
    pub has_video: bool,
    pub has_audio: bool,
}

/// Structured analysis result sent to the frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnalysisResult {
    pub title: String,
    pub duration: Option<f64>,
    pub thumbnail: Option<String>,
    pub uploader: Option<String>,
    pub video_formats: Vec<VideoFormat>,
    pub audio_formats: Vec<VideoFormat>,
    pub combined_formats: Vec<VideoFormat>,
}

/// Dependency check result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DependencyStatus {
    pub yt_dlp_installed: bool,
    pub ffmpeg_installed: bool,
    pub yt_dlp_version: Option<String>,
    pub ffmpeg_version: Option<String>,
}

/// Result of checking whether yt-dlp has an update available
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub update_available: bool,
}

/// Information about an available application self-update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppUpdateInfo {
    pub version: String,
    pub notes: Option<String>,
    pub pub_date: Option<String>,
}

/// Shared application state managed by Tauri
pub struct AppState {
    pub downloads: Arc<Mutex<Vec<DownloadEntry>>>,
    pub active_processes: Arc<Mutex<HashMap<String, tokio::process::Child>>>,
    pub analyze_process: Arc<Mutex<Option<u32>>>,
    pub data_dir: Arc<Mutex<String>>,
    pub max_concurrent: usize,
    /// Absolute path to the bundled yt-dlp binary (resolved at startup).
    pub yt_dlp_path: String,
    /// Absolute path to the bundled ffmpeg binary (resolved at startup).
    pub ffmpeg_path: String,
}

impl AppState {
    pub fn new(
        data_dir: String,
        initial_downloads: Vec<DownloadEntry>,
        yt_dlp_path: String,
        ffmpeg_path: String,
    ) -> Self {
        Self {
            downloads: Arc::new(Mutex::new(initial_downloads)),
            active_processes: Arc::new(Mutex::new(HashMap::new())),
            analyze_process: Arc::new(Mutex::new(None)),
            data_dir: Arc::new(Mutex::new(data_dir)),
            max_concurrent: 3,
            yt_dlp_path,
            ffmpeg_path,
        }
    }
}
