import React, { useState, useEffect, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDownloadStore } from "../store/useDownloadStore";
import { VideoTab, type ResolutionOption } from "./VideoTab";
import { AudioTab, type BitrateOption } from "./AudioTab";
import * as api from "../lib/tauri";
import {
  generateId,
  formatDuration,
  deduplicateResolutions,
  isPlaylistUrl,
  isUrlLine,
  sanitizeFilename,
  buildFormatArgs,
  applyFilenameTemplate,
  DEFAULT_DOWNLOAD_DIR_KEY,
  FILENAME_TEMPLATE_KEY,
  DEFAULT_FILENAME_TEMPLATE,
} from "../lib/utils";
import type { AnalysisResult, PlaylistAnalysisResult, TabType } from "../types";
import { open } from "@tauri-apps/plugin-dialog";
import { readText, writeText } from "@tauri-apps/plugin-clipboard-manager";
import { useLanguage } from "../hooks/useLanguage";
import { useContextMenu } from "../hooks/useContextMenu";
import { TextInputContextMenu } from "./TextInputContextMenu";
import { IconCheckCircle } from "./Icons";

// Playlist entries carry no per-video format info (probing that would mean
// one full yt-dlp round trip per video) — offer a fixed generic quality
// ladder instead. "" means "no height cap", which the existing selector
// logic in buildFormatArgs already treats as "best available".
const PLAYLIST_RESOLUTIONS: ResolutionOption[] = [
  { value: "", label: "Best available" },
  { value: "2160", label: "2160p (4K)" },
  { value: "1440", label: "1440p (2K)" },
  { value: "1080", label: "1080p" },
  { value: "720", label: "720p" },
  { value: "480", label: "480p" },
  { value: "360", label: "360p" },
];

export const AddDownloadModal: React.FC = () => {
  // This modal is always mounted (App.tsx renders it unconditionally) and
  // holds a fair amount of its own state/effects — none of which depend on
  // `downloads`, so scoping this subscription means it no longer re-runs
  // on every download-progress tick while closed.
  const { isAddPanelOpen, setAddPanelOpen, loadDownloads, addDownload } = useDownloadStore(
    useShallow((s) => ({
      isAddPanelOpen: s.isAddPanelOpen,
      setAddPanelOpen: s.setAddPanelOpen,
      loadDownloads: s.loadDownloads,
      addDownload: s.addDownload,
    }))
  );
  const { t } = useLanguage();
  const { contextMenu: urlContextMenu, handleContextMenu: handleUrlContextMenu, closeContextMenu: closeUrlContextMenu } =
    useContextMenu();
  const urlInputRef = useRef<HTMLInputElement>(null);

  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [playlistResult, setPlaylistResult] = useState<PlaylistAnalysisResult | null>(null);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>("video");
  const [downloading, setDownloading] = useState(false);
  const [outputDir, setOutputDir] = useState("");

  const [selectedResolution, setSelectedResolution] = useState("");
  const [selectedFps, setSelectedFps] = useState("");
  const [selectedContainer, setSelectedContainer] = useState("mp4");
  const [videoOnly, setVideoOnly] = useState(false);

  const [selectedAudioFormat, setSelectedAudioFormat] = useState("");
  const [selectedAudioContainer, setSelectedAudioContainer] = useState("mp3");

  const [downloadSubtitles, setDownloadSubtitles] = useState(false);
  const [embedThumbnail, setEmbedThumbnail] = useState(false);
  const [embedMetadata, setEmbedMetadata] = useState(false);

  // Cookies.txt path — persisted to localStorage. `cookiesFile` is the raw
  // path the user picked (shown in the UI); `effectiveCookiesPath` is a
  // private copy of it inside the app's data dir, which is what actually
  // gets passed to yt-dlp. yt-dlp treats --cookies as a read/write jar and
  // rewrites it with refreshed session cookies after every run — using a
  // private copy keeps that rewrite off the user's own file (and out of
  // their download folder, if that's where they keep it) instead of it
  // showing up as a mysterious new .txt file.
  const [cookiesFile, setCookiesFile] = useState<string>(
    () => localStorage.getItem("yt-cookies-file") || ""
  );
  const [effectiveCookiesPath, setEffectiveCookiesPath] = useState("");

  useEffect(() => {
    if (!cookiesFile) { setEffectiveCookiesPath(""); return; }
    let cancelled = false;
    api.importCookiesFile(cookiesFile)
      .then((imported) => { if (!cancelled) setEffectiveCookiesPath(imported); })
      .catch((err) => {
        console.error("Failed to import cookies file:", err);
        if (!cancelled) setEffectiveCookiesPath(cookiesFile);
      });
    return () => { cancelled = true; };
  }, [cookiesFile]);

  const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef(url);

  useEffect(() => {
    if (isAddPanelOpen && !outputDir) {
      const savedDefault = localStorage.getItem(DEFAULT_DOWNLOAD_DIR_KEY);
      if (savedDefault) {
        setOutputDir(savedDefault);
      } else {
        api.getDefaultDownloadDir().then(setOutputDir).catch(console.error);
      }
    }
  }, [isAddPanelOpen]);

  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  // Pre-fill from the clipboard when opening with an empty field — not
  // everyone re-copies a link right before opening this dialog, and if
  // they've just copied one, this saves the manual paste entirely.
  useEffect(() => {
    if (!isAddPanelOpen || urlRef.current) return;
    readText()
      .then((text) => {
        if (text && isUrlLine(text) && !urlRef.current) {
          setUrl(text);
          triggerAnalysis(text);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAddPanelOpen]);

  const triggerAnalysis = useCallback(
    (inputUrl: string, overrideCookies?: string) => {
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
      setAnalysis(null);
      setPlaylistResult(null);
      setSelectedEntryIds(new Set());
      setAnalyzeError(null);

      if (!inputUrl.trim()) { setAnalyzing(false); return; }
      if (!inputUrl.startsWith("http://") && !inputUrl.startsWith("https://")) {
        setAnalyzeError("Please enter a valid URL");
        return;
      }

      setAnalyzing(true);
      analyzeTimeoutRef.current = setTimeout(async () => {
        try {
          await api.abortAnalysis().catch(() => {});
          const activeCookies = overrideCookies !== undefined ? overrideCookies : (effectiveCookiesPath || cookiesFile);

          // Only probe as a playlist when the URL actually carries a `list=`
          // id — keeps the hot path (a plain video URL) exactly as fast as
          // before, with no extra round trip.
          const playlist = isPlaylistUrl(inputUrl)
            ? await api.analyzePlaylist(inputUrl, activeCookies || undefined).catch(() => null)
            : null;

          if (urlRef.current !== inputUrl) return;

          if (playlist && playlist.entries.length > 1) {
            setPlaylistResult(playlist);
            setSelectedEntryIds(new Set(playlist.entries.map((e) => e.id)));
            setAnalysis(null);
            setAnalyzeError(null);
            setSelectedResolution("");
            setSelectedFps("");
            setSelectedAudioFormat("");
            return;
          }

          // Not a (multi-entry) playlist — fall back to normal single-video
          // analysis, whether or not a `list=` id was present.
          const result = await api.analyzeUrl(inputUrl, activeCookies || undefined);
          if (urlRef.current !== inputUrl) return;

          setPlaylistResult(null);
          setAnalysis(result);
          setAnalyzeError(null);
          const allVideo = [...result.video_formats, ...result.combined_formats];
          if (allVideo.length > 0) {
            const h = allVideo[0]?.height;
            if (h) { setSelectedResolution(String(h)); }
            const fps = allVideo[0]?.fps;
            if (fps) setSelectedFps(String(Math.round(fps)));
          }
          if (result.audio_formats.length > 0)
            setSelectedAudioFormat(result.audio_formats[0].format_id);
        } catch (err) {
          if (urlRef.current === inputUrl) setAnalyzeError(String(err));
        } finally {
          if (urlRef.current === inputUrl) setAnalyzing(false);
        }
      }, 500);
    },
    [cookiesFile, effectiveCookiesPath]
  );

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; setUrl(v); triggerAnalysis(v);
  };

  // Several links pasted at once (one per line) get queued directly as
  // separate downloads at the currently selected quality — no per-link
  // picker, since that would mean a full analysis round trip just to show
  // one. Each is still individually analyzed (for its real title/formats)
  // right before being queued, one at a time.
  const handleMultiUrlPaste = (text: string): boolean => {
    const urls = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(isUrlLine);
    if (urls.length < 2) return false;

    const isAudio = activeTab === "audio";
    const ext = isAudio ? selectedAudioContainer : selectedContainer;
    const { formatArgs: baseFormatArgs, kind } = buildFormatArgs({
      isAudio,
      resolution: "",
      container: ext,
      videoOnly,
      downloadSubtitles,
      embedThumbnail,
      embedMetadata,
    });
    const template = localStorage.getItem(FILENAME_TEMPLATE_KEY) || DEFAULT_FILENAME_TEMPLATE;
    const activeCookiesPath = effectiveCookiesPath || cookiesFile;

    // Same reasoning as the playlist flow: don't make the user wait through
    // N sequential analyses with the modal open.
    setUrl(""); setAnalysis(null); setPlaylistResult(null); setAddPanelOpen(false);

    (async () => {
      for (const singleUrl of urls) {
        try {
          const result = await api.analyzeUrl(singleUrl, activeCookiesPath || undefined);
          const id = generateId();
          const formatArgs = activeCookiesPath ? ["--cookies", activeCookiesPath, ...baseFormatArgs] : baseFormatArgs;
          const sanitizedTitle = applyFilenameTemplate(template, { title: result.title, uploader: result.uploader });
          const outputPath = `${outputDir}/${sanitizedTitle}.${ext}`;

          addDownload({
            id, url: singleUrl, title: result.title, kind,
            status: "pending", progress: 0, speed: "",
            file_path: outputPath, file_size: null, error: null,
            created_at: new Date().toISOString(), format_args: formatArgs,
            playlist_id: null, playlist_title: null,
          });

          await api.startDownload({ id, url: singleUrl, title: result.title, formatArgs, outputPath, kind });
        } catch (err) {
          console.error("Failed to queue pasted URL:", singleUrl, err);
        }
      }
      await loadDownloads();
    })();

    return true;
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (handleMultiUrlPaste(text)) {
      e.preventDefault();
    }
  };

  // Right-click Cut/Copy/Paste/Select All for the URL field — Ctrl/Cmd+V
  // already works via the native paste event above, but not everyone uses
  // keyboard shortcuts, and the webview doesn't reliably offer its own
  // right-click menu with a working Paste item.
  const urlSelection = () => {
    const input = urlInputRef.current;
    const start = input?.selectionStart ?? 0;
    const end = input?.selectionEnd ?? url.length;
    return { start, end, text: url.slice(start, end) };
  };

  const applyUrlEdit = (newValue: string, cursorPos: number) => {
    setUrl(newValue);
    triggerAnalysis(newValue);
    requestAnimationFrame(() => {
      urlInputRef.current?.focus();
      urlInputRef.current?.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const handleUrlCut = async () => {
    closeUrlContextMenu();
    const { start, end, text } = urlSelection();
    const cut = text || url;
    try {
      await writeText(cut);
    } catch (err) {
      console.error("Cut failed:", err);
      return;
    }
    if (text) {
      applyUrlEdit(url.slice(0, start) + url.slice(end), start);
    } else {
      applyUrlEdit("", 0);
    }
  };

  const handleUrlCopy = async () => {
    closeUrlContextMenu();
    const { text } = urlSelection();
    try {
      await writeText(text || url);
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleUrlPaste = async () => {
    closeUrlContextMenu();
    try {
      const clipboardText = await readText();
      if (!clipboardText) return;
      if (handleMultiUrlPaste(clipboardText)) return;
      const { start, end } = urlSelection();
      const newValue = url.slice(0, start) + clipboardText + url.slice(end);
      applyUrlEdit(newValue, start + clipboardText.length);
    } catch (err) {
      console.error("Paste failed:", err);
    }
  };

  const handleUrlSelectAll = () => {
    closeUrlContextMenu();
    urlInputRef.current?.focus();
    urlInputRef.current?.select();
  };

  const handleSelectFolder = async () => {
    try {
      const sel = await open({ directory: true, defaultPath: outputDir || undefined });
      if (sel) setOutputDir(sel as string);
    } catch (e) { console.error(e); }
  };

  const handleSelectCookiesFile = async () => {
    try {
      const sel = await open({
        multiple: false,
        filters: [{ name: "Cookies", extensions: ["txt"] }, { name: "All", extensions: ["*"] }],
        title: "Select cookies.txt exported from your browser",
      });
      if (sel && typeof sel === "string") {
        setCookiesFile(sel);
        localStorage.setItem("yt-cookies-file", sel);
        if (url.trim()) triggerAnalysis(url, sel);
      }
    } catch (e) { console.error(e); }
  };

  const handleClearCookies = () => {
    setCookiesFile("");
    localStorage.removeItem("yt-cookies-file");
    if (url.trim()) triggerAnalysis(url, "");
  };

  const handleStartDownload = async () => {
    if (!analysis || !url.trim() || downloading) return;
    setDownloading(true);
    try {
      const id = generateId();
      const isAudio = activeTab === "audio";
      const ext = isAudio ? selectedAudioContainer : selectedContainer;

      const { formatArgs: baseFormatArgs, kind } = buildFormatArgs({
        isAudio,
        resolution: selectedResolution,
        fps: selectedFps,
        container: ext,
        videoOnly,
        audioFormatId: selectedAudioFormat,
        downloadSubtitles,
        embedThumbnail,
        embedMetadata,
      });
      const activeCookiesPath = effectiveCookiesPath || cookiesFile;
      const formatArgs = activeCookiesPath ? ["--cookies", activeCookiesPath, ...baseFormatArgs] : baseFormatArgs;

      const template = localStorage.getItem(FILENAME_TEMPLATE_KEY) || DEFAULT_FILENAME_TEMPLATE;
      const sanitizedTitle = applyFilenameTemplate(template, { title: analysis.title, uploader: analysis.uploader });

      await api.startDownload({
        id, url, title: analysis.title,
        formatArgs, outputPath: `${outputDir}/${sanitizedTitle}.${ext}`, kind,
      });

      await loadDownloads();
      setUrl(""); setAnalysis(null); setAddPanelOpen(false);
    } catch (err) {
      console.error(err); setAnalyzeError(String(err));
    } finally { setDownloading(false); }
  };

  const handleStartPlaylistDownload = () => {
    if (!playlistResult || selectedEntryIds.size === 0) return;

    const isAudio = activeTab === "audio";
    const ext = isAudio ? selectedAudioContainer : selectedContainer;

    // One shared quality choice, applied per-video at download time — see
    // the PLAYLIST_RESOLUTIONS comment for why this can't be per-format.
    const { formatArgs: baseFormatArgs, kind } = buildFormatArgs({
      isAudio,
      resolution: selectedResolution,
      container: ext,
      videoOnly,
      downloadSubtitles,
      embedThumbnail,
      embedMetadata,
    });
    const selectedEntries = playlistResult.entries.filter((e) => selectedEntryIds.has(e.id));
    // One shared id ties every queued entry back to this playlist so the
    // list can group them under a single collapsible row instead of
    // flattening the whole playlist into the top-level list.
    const playlistId = generateId();
    const playlistTitle = playlistResult.title;
    const playlistUploader = playlistResult.uploader;
    // Playlist videos land in their own subfolder on disk, named after the
    // playlist, instead of dumping every video directly into outputDir. The
    // folder name is always just the playlist title, independent of the
    // per-video filename template below.
    const playlistFolder = sanitizeFilename(playlistTitle);
    const template = localStorage.getItem(FILENAME_TEMPLATE_KEY) || DEFAULT_FILENAME_TEMPLATE;
    const activeCookiesPath = effectiveCookiesPath || cookiesFile;

    // Queueing dozens of yt-dlp spawns one at a time can take a while — the
    // user shouldn't have to wait on this modal for it. Close immediately;
    // each entry is added to the main list right as it's queued (and then
    // kept live by the normal download-progress events), the same way it
    // would look if they were started one at a time.
    setUrl(""); setAnalysis(null); setPlaylistResult(null); setSelectedEntryIds(new Set()); setAddPanelOpen(false);

    (async () => {
      for (const entry of selectedEntries) {
        const id = generateId();
        const formatArgs = activeCookiesPath ? ["--cookies", activeCookiesPath, ...baseFormatArgs] : baseFormatArgs;
        // Playlist entries don't carry their own uploader (only the
        // playlist as a whole might), so {uploader} falls back to that.
        const sanitizedTitle = applyFilenameTemplate(template, { title: entry.title, uploader: playlistUploader });
        const outputPath = `${outputDir}/${playlistFolder}/${sanitizedTitle}.${ext}`;

        addDownload({
          id,
          url: entry.url,
          title: entry.title,
          kind,
          status: "pending",
          progress: 0,
          speed: "",
          file_path: outputPath,
          file_size: null,
          error: null,
          created_at: new Date().toISOString(),
          format_args: formatArgs,
          playlist_id: playlistId,
          playlist_title: playlistTitle,
        });

        try {
          await api.startDownload({
            id, url: entry.url, title: entry.title, formatArgs, outputPath, kind,
            playlistId, playlistTitle,
          });
        } catch (err) {
          // One bad entry (e.g. a deleted/private video in the playlist)
          // shouldn't block queuing the rest.
          console.error("Failed to queue playlist entry:", entry.url, err);
        }
      }
      // Reconcile with the backend's authoritative state (exact file size,
      // any entries that failed to queue, etc.) now that it's all settled.
      await loadDownloads();
    })();
  };

  const handleClose = () => {
    api.abortAnalysis().catch(() => {});
    if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
    setUrl(""); setAnalysis(null); setPlaylistResult(null); setSelectedEntryIds(new Set());
    setAnalyzeError(null); setAnalyzing(false); setAddPanelOpen(false);
  };

  const toggleEntry = (entryId: string) => {
    setSelectedEntryIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId); else next.add(entryId);
      return next;
    });
  };

  if (!isAddPanelOpen) return null;

  const cookiesFileName = cookiesFile ? cookiesFile.split(/[/\\]/).pop() || cookiesFile : "";

  // Resolution/FPS/bitrate options: real analyzed formats for a single
  // video, or the fixed generic ladder above when browsing a playlist.
  let resolutionOptions: ResolutionOption[];
  let fpsOptions: number[];
  let bitrateOptions: BitrateOption[];
  if (playlistResult) {
    resolutionOptions = PLAYLIST_RESOLUTIONS;
    fpsOptions = [];
    bitrateOptions = [];
  } else {
    const allVideoFormats = analysis ? [...analysis.video_formats, ...analysis.combined_formats] : [];
    resolutionOptions = deduplicateResolutions(allVideoFormats).map((r) => ({
      value: String(r.height),
      label: r.label,
    }));
    const selectedHeightNum = parseInt(selectedResolution) || 0;
    fpsOptions = Array.from(
      new Set(
        allVideoFormats
          .filter((f) => f.height === selectedHeightNum && f.fps)
          .map((f) => Math.round(f.fps!))
      )
    ).sort((a, b) => b - a);
    bitrateOptions = Array.from(
      new Map(
        (analysis?.audio_formats ?? [])
          .filter((f) => f.abr)
          .map((f) => [
            Math.round(f.abr!),
            { bitrate: Math.round(f.abr!), formatId: f.format_id, codec: f.acodec },
          ])
      ).values()
    ).sort((a, b) => b.bitrate - a.bitrate);
  }

  const allSelected = !!playlistResult && selectedEntryIds.size === playlistResult.entries.length;
  const someSelected = selectedEntryIds.size > 0 && !allSelected;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="add-download-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t("modal_title")}</h2>
          <button className="modal-close" onClick={handleClose}>X</button>
        </div>

        <div className="modal-body">
          {/* Cookies banner — optional, non-intrusive */}
          {cookiesFile ? (
            <div className="cookies-banner cookies-banner--active">
              <span className="cookies-banner__icon"><IconCheckCircle size={15} /></span>
              <span className="cookies-banner__text"><strong>Cookies:</strong> {cookiesFileName}</span>
              <button className="cookies-banner__btn cookies-banner__btn--change" onClick={handleSelectCookiesFile}>{t("common_change")}</button>
              <button className="cookies-banner__btn cookies-banner__btn--clear" onClick={handleClearCookies}>X</button>
            </div>
          ) : (
            <div className="cookies-banner cookies-banner--info">
              <span className="cookies-banner__icon">🍪</span>
              <span className="cookies-banner__text">
                {t("modal_noCookies")}{" "}
                <a href="https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp"
                   target="_blank" rel="noreferrer" className="cookies-banner__link">
                  {t("modal_howToCookies")}
                </a>
              </span>
              <button className="cookies-banner__btn cookies-banner__btn--set" onClick={handleSelectCookiesFile}>
                {t("modal_selectCookies")}
              </button>
            </div>
          )}

          <div className="form-group">
            <div className="url-input-wrapper">
              <input type="text" className="form-input url-input" ref={urlInputRef}
                placeholder={t("modal_urlPlaceholder")}
                value={url} onChange={handleUrlChange} onPaste={handlePaste}
                onContextMenu={(e) => handleUrlContextMenu(e, "url")} autoFocus />
              {analyzing && <div className="url-spinner"><div className="spinner" /></div>}
            </div>
            {analyzeError && <p className="form-error">{analyzeError}</p>}
          </div>

          {urlContextMenu && (
            <TextInputContextMenu
              x={urlContextMenu.position.x}
              y={urlContextMenu.position.y}
              onCut={handleUrlCut}
              onCopy={handleUrlCopy}
              onPaste={handleUrlPaste}
              onSelectAll={handleUrlSelectAll}
              onClose={closeUrlContextMenu}
            />
          )}

          {(analysis || playlistResult) && (
            <div className="video-preview">
              <div className="preview-info">
                <h3 className="preview-title">{playlistResult ? playlistResult.title : analysis!.title}</h3>
                <div className="preview-meta">
                  {(playlistResult?.uploader || analysis?.uploader) && (
                    <span className="preview-uploader">{playlistResult?.uploader || analysis?.uploader}</span>
                  )}
                  {analysis?.duration && <span className="preview-duration">{formatDuration(analysis.duration)}</span>}
                  {playlistResult && (
                    <span className="preview-duration">
                      {t("modal_videoCount").replace("{count}", String(playlistResult.entries.length))}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {playlistResult && (
            <div className="playlist-picker">
              <div className="playlist-picker__header">
                <label className="form-checkbox-label">
                  <input
                    type="checkbox"
                    className="form-checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    onChange={(e) =>
                      setSelectedEntryIds(
                        e.target.checked ? new Set(playlistResult.entries.map((en) => en.id)) : new Set()
                      )
                    }
                  />
                  <span className="checkbox-text">{t("modal_selectAll")}</span>
                </label>
                <span className="playlist-picker__count">
                  {selectedEntryIds.size}/{playlistResult.entries.length}
                </span>
              </div>
              <div className="playlist-entry-list">
                {playlistResult.entries.map((entry) => (
                  <label key={entry.id} className="playlist-entry-row">
                    <input
                      type="checkbox"
                      className="form-checkbox"
                      checked={selectedEntryIds.has(entry.id)}
                      onChange={() => toggleEntry(entry.id)}
                    />
                    <span className="playlist-entry-index">{entry.index}</span>
                    <span className="playlist-entry-title" title={entry.title}>{entry.title}</span>
                    <span className="playlist-entry-duration">{formatDuration(entry.duration)}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {(analysis || playlistResult) && (
            <>
              <div className="tabs">
                <button className={`tab ${activeTab === "video" ? "active" : ""}`} onClick={() => setActiveTab("video")}>Video</button>
                <button className={`tab ${activeTab === "audio" ? "active" : ""}`} onClick={() => setActiveTab("audio")}>Audio</button>
              </div>

              {activeTab === "video" ? (
                <VideoTab
                  resolutions={resolutionOptions}
                  fpsOptions={fpsOptions}
                  selectedResolution={selectedResolution} setSelectedResolution={setSelectedResolution}
                  selectedFps={selectedFps} setSelectedFps={setSelectedFps}
                  selectedContainer={selectedContainer} setSelectedContainer={setSelectedContainer}
                  videoOnly={videoOnly} setVideoOnly={setVideoOnly}
                  downloadSubtitles={downloadSubtitles} setDownloadSubtitles={setDownloadSubtitles} />
              ) : (
                <AudioTab
                  bitrateOptions={bitrateOptions}
                  isPlaylistMode={!!playlistResult}
                  selectedAudioFormat={selectedAudioFormat} setSelectedAudioFormat={setSelectedAudioFormat}
                  selectedAudioContainer={selectedAudioContainer} setSelectedAudioContainer={setSelectedAudioContainer}
                  embedThumbnail={embedThumbnail} setEmbedThumbnail={setEmbedThumbnail}
                  embedMetadata={embedMetadata} setEmbedMetadata={setEmbedMetadata} />
              )}

              <div className="form-group">
                <label className="form-label">Save to</label>
                <div className="folder-picker">
                  <input type="text" className="form-input folder-input" value={outputDir} readOnly />
                  <button className="btn btn-secondary btn-browse" onClick={handleSelectFolder}>Browse</button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleClose}>{t("modal_cancel")}</button>
          <button className="btn btn-primary"
            onClick={playlistResult ? handleStartPlaylistDownload : handleStartDownload}
            disabled={
              (!analysis && !playlistResult) ||
              analyzing ||
              downloading ||
              (!!playlistResult && selectedEntryIds.size === 0)
            }>
            {downloading ? (
              <><div className="spinner spinner-small" /> {t("modal_starting")}</>
            ) : playlistResult ? (
              t("modal_startDownloadPlaylist").replace("{count}", String(selectedEntryIds.size))
            ) : (
              t("modal_startDownload")
            )}
          </button>
        </div>
      </div>
    </div>
  );
};