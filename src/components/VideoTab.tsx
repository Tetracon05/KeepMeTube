import React from "react";
import { useLanguage } from "../hooks/useLanguage";

export interface ResolutionOption {
  value: string;
  label: string;
}

interface VideoTabProps {
  resolutions: ResolutionOption[];
  fpsOptions: number[];
  selectedResolution: string;
  setSelectedResolution: (r: string) => void;
  selectedFps: string;
  setSelectedFps: (f: string) => void;
  selectedContainer: string;
  setSelectedContainer: (c: string) => void;
  videoOnly: boolean;
  setVideoOnly: (v: boolean) => void;
  downloadSubtitles: boolean;
  setDownloadSubtitles: (v: boolean) => void;
}

export const VideoTab: React.FC<VideoTabProps> = ({
  resolutions,
  fpsOptions,
  selectedResolution,
  setSelectedResolution,
  selectedFps,
  setSelectedFps,
  selectedContainer,
  setSelectedContainer,
  videoOnly,
  setVideoOnly,
  downloadSubtitles,
  setDownloadSubtitles,
}) => {
  const { t } = useLanguage();
  return (
    <div className="tab-content">
      <div className="form-group">
        <label className="form-label">{t("modal_resolution")}</label>
        <select
          className="form-select"
          value={selectedResolution}
          onChange={(e) => setSelectedResolution(e.target.value)}
        >
          {resolutions.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
          {resolutions.length === 0 && (
            <option value="">{t("modal_noVideoFormats")}</option>
          )}
        </select>
      </div>

      {fpsOptions.length > 1 && (
        <div className="form-group">
          <label className="form-label">{t("modal_frameRate")}</label>
          <select
            className="form-select"
            value={selectedFps}
            onChange={(e) => setSelectedFps(e.target.value)}
          >
            {fpsOptions.map((fps) => (
              <option key={fps} value={String(fps)}>
                {fps} fps
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="form-group">
        <label className="form-label">{t("modal_containerFormat")}</label>
        <select
          className="form-select"
          value={selectedContainer}
          onChange={(e) => setSelectedContainer(e.target.value)}
        >
          <option value="mp4">MP4</option>
          <option value="mkv">MKV</option>
          <option value="webm">WebM</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-checkbox-label">
          <input
            type="checkbox"
            className="form-checkbox"
            checked={videoOnly}
            onChange={(e) => setVideoOnly(e.target.checked)}
          />
          <span className="checkbox-text">{t("modal_videoOnly")}</span>
        </label>
      </div>

      <div className="form-group">
        <label className="form-checkbox-label">
          <input
            type="checkbox"
            className="form-checkbox"
            checked={downloadSubtitles}
            onChange={(e) => setDownloadSubtitles(e.target.checked)}
          />
          <span className="checkbox-text">{t("modal_downloadSubtitles")}</span>
        </label>
      </div>
    </div>
  );
};
