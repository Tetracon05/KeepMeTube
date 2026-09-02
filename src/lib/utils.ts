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
 * Truncate text with ellipsis
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + "...";
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
