// ===== Download Types =====

export type DownloadStatus =
  | "pending"
  | "analyzing"
  | "downloading"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type DownloadKind = "video" | "audio" | "videoaudio";

export interface DownloadEntry {
  id: string;
  url: string;
  title: string;
  kind: DownloadKind;
  status: DownloadStatus;
  progress: number;
  speed: string;
  file_path: string;
  file_size: number | null;
  error: string | null;
  created_at: string;
  format_args: string[];
}

export interface ProgressEvent {
  id: string;
  status: DownloadStatus;
  progress: number;
  speed: string;
  error: string | null;
}

// ===== Analysis Types =====

export interface VideoFormat {
  format_id: string;
  ext: string;
  resolution: string;
  width: number | null;
  height: number | null;
  fps: number | null;
  vcodec: string;
  acodec: string;
  filesize: number | null;
  tbr: number | null;
  abr: number | null;
  format_note: string;
  has_video: boolean;
  has_audio: boolean;
}

export interface AnalysisResult {
  title: string;
  duration: number | null;
  thumbnail: string | null;
  uploader: string | null;
  video_formats: VideoFormat[];
  audio_formats: VideoFormat[];
  combined_formats: VideoFormat[];
}

// ===== Dependency Types =====

export interface DependencyStatus {
  yt_dlp_installed: boolean;
  ffmpeg_installed: boolean;
  yt_dlp_version: string | null;
  ffmpeg_version: string | null;
}

export interface UpdateCheckResult {
  current_version: string;
  latest_version: string;
  update_available: boolean;
}

export interface AppUpdateInfo {
  version: string;
  notes: string | null;
  pub_date: string | null;
}

// ===== UI State Types =====

export interface ContextMenuPosition {
  x: number;
  y: number;
}

export type TabType = "video" | "audio";
