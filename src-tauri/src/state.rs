use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::atomic::AtomicUsize;
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
    /// No longer produced by anything (Pause/Resume was removed — YouTube's
    /// direct media URLs expire and are IP-locked, so a killed download
    /// usually can't actually resume from its partial file; Retry, a plain
    /// restart, is what actually works). Kept only so a `downloads.json`
    /// written while this existed still deserializes instead of losing the
    /// user's whole history.
    Paused,
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
    /// Shared id for every entry queued from the same playlist download —
    /// absent for a standalone download. The frontend groups entries with
    /// the same `playlist_id` into one collapsible row rather than a
    /// separate persisted "playlist" record, so this and `playlist_title`
    /// are the only backend representation of a playlist batch.
    #[serde(default)]
    pub playlist_id: Option<String>,
    /// The playlist's display title, denormalized onto every one of its
    /// entries so the frontend can render the group without a separate
    /// lookup table.
    #[serde(default)]
    pub playlist_title: Option<String>,
}

/// Progress event emitted to the frontend during downloads
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressEvent {
    pub id: String,
    pub status: DownloadStatus,
    pub progress: f64,
    pub speed: String,
    pub error: Option<String>,
    /// Populated once the file size is known (on completion); `None` otherwise.
    pub file_size: Option<u64>,
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

/// A single entry within a playlist, from a fast `--flat-playlist` probe.
/// Unlike `AnalysisResult`, this does not carry per-video formats — resolving
/// those for every entry would mean one full yt-dlp round trip per video.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistEntry {
    pub id: String,
    pub index: u32,
    pub title: String,
    pub url: String,
    pub duration: Option<f64>,
}

/// Result of a flat playlist analysis sent to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistAnalysisResult {
    pub title: String,
    pub uploader: Option<String>,
    pub entries: Vec<PlaylistEntry>,
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
    /// User-configurable (Settings) concurrent-download limit. An atomic
    /// rather than a plain `usize` so `set_max_concurrent` can update it
    /// without needing a lock at every one of its (many) read sites.
    pub max_concurrent: Arc<AtomicUsize>,
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
        max_concurrent: usize,
    ) -> Self {
        Self {
            downloads: Arc::new(Mutex::new(initial_downloads)),
            active_processes: Arc::new(Mutex::new(HashMap::new())),
            analyze_process: Arc::new(Mutex::new(None)),
            data_dir: Arc::new(Mutex::new(data_dir)),
            max_concurrent: Arc::new(AtomicUsize::new(max_concurrent)),
            yt_dlp_path,
            ffmpeg_path,
        }
    }
}
