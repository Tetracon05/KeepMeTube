import React, { useState, useEffect, useRef, useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDownloadStore } from "../store/useDownloadStore";
import { VideoTab } from "./VideoTab";
import { AudioTab } from "./AudioTab";
import * as api from "../lib/tauri";
import { generateId, formatDuration } from "../lib/utils";
import type { AnalysisResult, TabType } from "../types";
import { open } from "@tauri-apps/plugin-dialog";
import { useLanguage } from "../hooks/useLanguage";
import { IconCheckCircle } from "./Icons";

export const AddDownloadModal: React.FC = () => {
  // This modal is always mounted (App.tsx renders it unconditionally) and
  // holds a fair amount of its own state/effects — none of which depend on
  // `downloads`, so scoping this subscription means it no longer re-runs
  // on every download-progress tick while closed.
  const { isAddPanelOpen, setAddPanelOpen, loadDownloads } = useDownloadStore(
    useShallow((s) => ({
      isAddPanelOpen: s.isAddPanelOpen,
      setAddPanelOpen: s.setAddPanelOpen,
      loadDownloads: s.loadDownloads,
    }))
  );
  const { t } = useLanguage();

  const [url, setUrl] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
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

  // Cookies.txt path — persisted to localStorage
  const [cookiesFile, setCookiesFile] = useState<string>(
    () => localStorage.getItem("yt-cookies-file") || ""
  );

  const analyzeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urlRef = useRef(url);

  useEffect(() => {
    if (isAddPanelOpen && !outputDir) {
      api.getDefaultDownloadDir().then(setOutputDir).catch(console.error);
    }
  }, [isAddPanelOpen]);

  useEffect(() => {
    urlRef.current = url;
  }, [url]);

  const triggerAnalysis = useCallback(
    (inputUrl: string, overrideCookies?: string) => {
      if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
      setAnalysis(null);
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
          const activeCookies = overrideCookies !== undefined ? overrideCookies : cookiesFile;
          const result = await api.analyzeUrl(inputUrl, activeCookies || undefined);

          if (urlRef.current === inputUrl) {
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
          }
        } catch (err) {
          if (urlRef.current === inputUrl) setAnalyzeError(String(err));
        } finally {
          if (urlRef.current === inputUrl) setAnalyzing(false);
        }
      }, 500);
    },
    [cookiesFile]
  );

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; setUrl(v); triggerAnalysis(v);
  };
  const handlePaste = (_e: React.ClipboardEvent<HTMLInputElement>) => {};

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
      let formatArgs: string[] = [];
      let kind = "videoaudio";
      let ext = selectedContainer;

      if (isAudio) {
        kind = "audio"; ext = selectedAudioContainer;
        formatArgs = ["-x", "--audio-format", selectedAudioContainer];
        if (selectedAudioFormat) formatArgs.push("-f", selectedAudioFormat);
      } else {
        const h = selectedResolution; const fps = selectedFps;
        if (videoOnly) {
          kind = "video";
          let fs = h ? `bestvideo[height<=${h}]` : "bestvideo";
          if (fps) fs += `[fps<=${fps}]`;
          formatArgs = ["-f", `${fs}/bestvideo/best`];
        } else {
          kind = "videoaudio";
          const fs = h
            ? `bestvideo[height<=${h}]${fps ? `[fps<=${fps}]` : ""}+bestaudio/best[height<=${h}]/best`
            : "bestvideo+bestaudio/best";
          formatArgs = ["-f", fs, "--merge-output-format", selectedContainer];
        }
      }

      if (cookiesFile) formatArgs = ["--cookies", cookiesFile, ...formatArgs];

      const sanitizedTitle =
        analysis.title
          .replace(/[/\\?%*:|"<>]/g, "_")
          .replace(/[\x00-\x1f\x7f]/g, "_")
          .replace(/\.+$/, "").replace(/\s+$/, "").trim()
          .substring(0, 180) || "download";

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

  const handleClose = () => {
    api.abortAnalysis().catch(() => {});
    if (analyzeTimeoutRef.current) clearTimeout(analyzeTimeoutRef.current);
    setUrl(""); setAnalysis(null); setAnalyzeError(null); setAnalyzing(false); setAddPanelOpen(false);
  };

  if (!isAddPanelOpen) return null;

  const cookiesFileName = cookiesFile ? cookiesFile.split(/[/\\]/).pop() || cookiesFile : "";

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
              <input type="text" className="form-input url-input"
                placeholder={t("modal_urlPlaceholder")}
                value={url} onChange={handleUrlChange} onPaste={handlePaste} autoFocus />
              {analyzing && <div className="url-spinner"><div className="spinner" /></div>}
            </div>
            {analyzeError && <p className="form-error">{analyzeError}</p>}
          </div>

          {analysis && (
            <div className="video-preview">
              <div className="preview-info">
                <h3 className="preview-title">{analysis.title}</h3>
                <div className="preview-meta">
                  {analysis.uploader && <span className="preview-uploader">{analysis.uploader}</span>}
                  {analysis.duration && <span className="preview-duration">{formatDuration(analysis.duration)}</span>}
                </div>
              </div>
            </div>
          )}

          {analysis && (
            <>
              <div className="tabs">
                <button className={`tab ${activeTab === "video" ? "active" : ""}`} onClick={() => setActiveTab("video")}>Video</button>
                <button className={`tab ${activeTab === "audio" ? "active" : ""}`} onClick={() => setActiveTab("audio")}>Audio</button>
              </div>

              {activeTab === "video" ? (
                <VideoTab analysis={analysis}
                  selectedResolution={selectedResolution} setSelectedResolution={setSelectedResolution}
                  selectedFps={selectedFps} setSelectedFps={setSelectedFps}
                  selectedContainer={selectedContainer} setSelectedContainer={setSelectedContainer}
                  videoOnly={videoOnly} setVideoOnly={setVideoOnly} />
              ) : (
                <AudioTab analysis={analysis}
                  selectedAudioFormat={selectedAudioFormat} setSelectedAudioFormat={setSelectedAudioFormat}
                  selectedAudioContainer={selectedAudioContainer} setSelectedAudioContainer={setSelectedAudioContainer} />
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
          <button className="btn btn-primary" onClick={handleStartDownload}
            disabled={!analysis || analyzing || downloading}>
            {downloading ? (<><div className="spinner spinner-small" /> {t("modal_starting")}</>) : t("modal_startDownload")}
          </button>
        </div>
      </div>
    </div>
  );
};