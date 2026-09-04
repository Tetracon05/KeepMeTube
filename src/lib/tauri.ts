import { invoke } from "@tauri-apps/api/core";
import { getVersion } from "@tauri-apps/api/app";
import type {
  AnalysisResult,
  AppUpdateInfo,
  DependencyStatus,
  DownloadEntry,
  UpdateCheckResult,
} from "../types";

// ===== App Metadata =====

// The version never changes for the lifetime of the process, but three
// separate components (Settings, About, the update dialog) each ask for it
// on mount — cache the one real IPC call instead of round-tripping three times.
let cachedVersion: Promise<string> | null = null;

export async function getAppVersion(): Promise<string> {
  if (!cachedVersion) cachedVersion = getVersion();
  return cachedVersion;
}

// ===== Dependency Commands =====

export async function checkDependencies(): Promise<DependencyStatus> {
  return invoke("check_dependencies");
}

export async function checkYtDlpUpdate(): Promise<UpdateCheckResult> {
  return invoke("check_yt_dlp_update");
}

export async function updateYtDlp(): Promise<string> {
  return invoke("update_yt_dlp");
}

// ===== App Update Commands =====

export async function checkAppUpdate(): Promise<AppUpdateInfo | null> {
  return invoke("check_app_update");
}

export async function installAppUpdate(): Promise<void> {
  return invoke("install_app_update");
}

// ===== Analysis Commands =====

export async function analyzeUrl(url: string, cookiesFile?: string): Promise<AnalysisResult> {
  return invoke("analyze_url", { url, cookiesFile: cookiesFile || null });
}

export async function abortAnalysis(): Promise<void> {
  return invoke("abort_analysis");
}

// ===== Download Commands =====

export async function startDownload(params: {
  id: string;
  url: string;
  title: string;
  formatArgs: string[];
  outputPath: string;
  kind: string;
}): Promise<void> {
  return invoke("start_download", params);
}

export async function cancelDownload(id: string): Promise<void> {
  return invoke("cancel_download", { id });
}

export async function getDownloads(): Promise<DownloadEntry[]> {
  return invoke("get_downloads");
}

export async function getDefaultDownloadDir(): Promise<string> {
  return invoke("get_default_download_dir");
}

// ===== File Operation Commands =====

export async function deleteDownload(id: string): Promise<void> {
  return invoke("delete_download", { id });
}

export async function removeDownload(id: string): Promise<void> {
  return invoke("remove_download", { id });
}

export async function renameDownload(
  id: string,
  newName: string
): Promise<string> {
  return invoke("rename_download", { id, newName });
}

export async function showInFolder(path: string): Promise<void> {
  return invoke("show_in_folder", { path });
}

/// Initiates a native OS drag-out for a completed downloaded file.
/// The backend validates that the file is completed and accessible before
/// starting the drag — this will throw if validation fails.
export async function startDrag(id: string): Promise<void> {
  return invoke("start_drag", { id });
}
