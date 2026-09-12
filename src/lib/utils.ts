import type { DownloadKind, SpeedMode } from "../types";

/** localStorage key for the user's custom default download folder (Settings). */
export const DEFAULT_DOWNLOAD_DIR_KEY = "default-download-dir";

/** localStorage keys for the download speed mode + its editable Slow/Medium caps (Settings). */
export const SPEED_MODE_KEY = "download-speed-mode";
export const SPEED_LIMIT_SLOW_KEY = "speed-limit-slow-kbps";
export const SPEED_LIMIT_MEDIUM_KEY = "speed-limit-medium-kbps";
export const DEFAULT_SPEED_LIMIT_SLOW_KBPS = 512;
export const DEFAULT_SPEED_LIMIT_MEDIUM_KBPS = 4096;

/** Resolves the active speed mode to a `--limit-rate` value in KB/s, or null for unlimited (Fast). */
export function getSpeedLimitKbps(
  mode: SpeedMode,
  limits: { slow: number; medium: number }
): number | null {
  if (mode === "slow") return limits.slow;
  if (mode === "medium") return limits.medium;
  return null;
}

/**
 * Format bytes into a human-readable string
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Format duration in seconds to mm:ss or hh:mm:ss
 */
export function formatDuration(seconds: number | null): string {
  if (seconds === null || seconds === undefined) return "--:--";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Generate a unique ID for downloads
 */
export function generateId(): string {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Get the file extension from a path
 */
export function getExtension(path: string): string {
  const parts = path.split(".");
  return parts.length > 1 ? parts[parts.length - 1] : "";
}

/**
 * Get the filename without extension
 */
export function getBaseName(path: string): string {
  const name = path.split(/[/\\]/).pop() || path;
  const dotIndex = name.lastIndexOf(".");
  return dotIndex > 0 ? name.substring(0, dotIndex) : name;
}

/**
 * Get the parent directory of a file path.
 */
export function getDirName(path: string): string {
  const idx = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
  return idx > 0 ? path.substring(0, idx) : path;
}

/**
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
}

/**
 * Detect whether a URL carries a playlist id (a `list=` query param) —
 * covers YouTube watch?v=...&list=..., youtube.com/playlist?list=..., and
 * youtu.be short links alike, matching yt-dlp's own default of resolving
 * the whole playlist whenever this is present.
 */
export function isPlaylistUrl(url: string): boolean {
  try {
    const list = new URL(url).searchParams.get("list");
    return !!list;
  } catch {
    return false;
  }
}

/**
 * Sanitize a video/playlist-entry title into a safe filename stem.
 */
export function sanitizeFilename(title: string): string {
  return (
    title
      .replace(/[/\\?%*:|"<>]/g, "_")
      .replace(/[\x00-\x1f\x7f]/g, "_")
      .replace(/\.+$/, "")
      .replace(/\s+$/, "")
      .trim()
      .substring(0, 180) || "download"
  );
}

/**
 * Build the yt-dlp `-f`/`-x` format-selection args shared by single-video
 * and playlist downloads. `fps` and `audioFormatId` only make sense when
 * picking from a specific video's real analyzed formats (single-video mode)
 * — a playlist queues many videos from one generic quality choice, so those
 * are left undefined there and yt-dlp picks the best match per video.
 */
export function buildFormatArgs(opts: {
  isAudio: boolean;
  resolution: string;
  fps?: string;
  container: string;
  videoOnly?: boolean;
  audioFormatId?: string;
  /** Video only: write a separate subtitle file alongside the video. */
  downloadSubtitles?: boolean;
  /** Embed the video/track's thumbnail as cover art (needs ffmpeg, already bundled). */
  embedThumbnail?: boolean;
  /** Embed title/artist/etc. metadata into the file (needs ffmpeg, already bundled). */
  embedMetadata?: boolean;
  /** Caps yt-dlp's transfer rate via `--limit-rate`; null/undefined means unlimited (Fast mode). */
  limitRateKbps?: number | null;
}): { formatArgs: string[]; kind: DownloadKind } {
  const extras: string[] = [];
  if (opts.embedMetadata) extras.push("--embed-metadata");
  if (opts.embedThumbnail) extras.push("--embed-thumbnail");
  if (opts.limitRateKbps) extras.push("--limit-rate", `${opts.limitRateKbps}K`);

  if (opts.isAudio) {
    const formatArgs = ["-x", "--audio-format", opts.container, ...extras];
    if (opts.audioFormatId) formatArgs.push("-f", opts.audioFormatId);
    return { formatArgs, kind: "audio" };
  }

  if (opts.downloadSubtitles) extras.push("--write-subs", "--sub-langs", "en");

  const h = opts.resolution;
  const fps = opts.fps;

  if (opts.videoOnly) {
    let fs = h ? `bestvideo[height<=${h}]` : "bestvideo";
    if (fps) fs += `[fps<=${fps}]`;
    return { formatArgs: ["-f", `${fs}/bestvideo/best`, ...extras], kind: "video" };
  }

  const fs = h
    ? `bestvideo[height<=${h}]${fps ? `[fps<=${fps}]` : ""}+bestaudio/best[height<=${h}]/best`
    : "bestvideo+bestaudio/best";
  return { formatArgs: ["-f", fs, "--merge-output-format", opts.container, ...extras], kind: "videoaudio" };
}

/** A line of pasted text that looks like a downloadable URL. */
export function isUrlLine(line: string): boolean {
  const trimmed = line.trim();
  return trimmed.startsWith("http://") || trimmed.startsWith("https://");
}

/** localStorage key for the user's custom output filename template (Settings). */
export const FILENAME_TEMPLATE_KEY = "filename-template";
export const DEFAULT_FILENAME_TEMPLATE = "{title}";

/**
 * Resolve a user-defined filename template (`{title}`, `{uploader}`) against
 * a specific download's metadata, then sanitize the result. Unlike yt-dlp's
 * own `-o` template syntax, this is resolved here from data we already have
 * (from analysis) before the output path is ever passed to yt-dlp — so
 * `file_path` always names the exact file yt-dlp will write, which every
 * other feature (rename, delete, show-in-folder) depends on.
 */
export function applyFilenameTemplate(
  template: string,
  vars: { title: string; uploader?: string | null }
): string {
  const resolved = (template || DEFAULT_FILENAME_TEMPLATE)
    .replace(/\{title\}/g, vars.title)
    .replace(/\{uploader\}/g, vars.uploader || "");
  return sanitizeFilename(resolved);
}

/**
 * Deduplicate resolutions (prefer highest bitrate/quality per resolution)
 */
export function deduplicateResolutions(
  formats: Array<{ height: number | null; fps: number | null; format_id: string; tbr: number | null }>
): Array<{ height: number; fps: number; label: string }> {
  const seen = new Map<string, { height: number; fps: number; label: string }>();

  for (const fmt of formats) {
    if (fmt.height === null) continue;
    const key = `${fmt.height}p`;
    if (!seen.has(key)) {
      seen.set(key, {
        height: fmt.height,
        fps: fmt.fps ?? 30,
        label: key,
      });
    }
  }

  return Array.from(seen.values()).sort((a, b) => b.height - a.height);
}

/**
 * Maps the app's LangCode to a BCP-47 locale for Intl date/time formatting.
 */
const LOCALE_MAP: Record<string, string> = {
  en: "en-US",
  tr: "tr-TR",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
  ar: "ar-SA",
  ja: "ja-JP",
  ko: "ko-KR",
  zh: "zh-CN",
};

export function langToLocale(lang?: string): string {
  return (lang && LOCALE_MAP[lang]) || "en-US";
}

/**
 * Format an ISO date string into date + time, localized to `lang`.
 * Today → "10:35 · Aug 20"
 * Other → "Aug 20 · 10:35"  (with year if different)
 */
export function formatDate(isoString: string, lang?: string): string {
  try {
    const locale = langToLocale(lang);
    const date = new Date(isoString);
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    const time = date.toLocaleTimeString(locale, {
      hour: "2-digit",
      minute: "2-digit",
    });
    const datePart = date.toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: now.getFullYear() !== date.getFullYear() ? "numeric" : undefined,
    });

    // Today: show time first, date second (most relevant part first)
    if (isToday) return `${time} · ${datePart}`;
    return `${datePart} · ${time}`;
  } catch {
    return "--";
  }
}
