import React from "react";
import { useLanguage } from "../hooks/useLanguage";

export interface BitrateOption {
  bitrate: number;
  formatId: string;
  codec: string;
}

interface AudioTabProps {
  bitrateOptions: BitrateOption[];
  selectedAudioFormat: string;
  setSelectedAudioFormat: (f: string) => void;
  selectedAudioContainer: string;
  setSelectedAudioContainer: (c: string) => void;
  /** True when quality can't be probed per-item (playlist mode) — yt-dlp
   * picks the best available source audio for each video automatically. */
  isPlaylistMode?: boolean;
  embedThumbnail: boolean;
  setEmbedThumbnail: (v: boolean) => void;
  embedMetadata: boolean;
  setEmbedMetadata: (v: boolean) => void;
}

export const AudioTab: React.FC<AudioTabProps> = ({
  bitrateOptions,
  selectedAudioFormat,
  setSelectedAudioFormat,
  selectedAudioContainer,
  setSelectedAudioContainer,
  isPlaylistMode,
  embedThumbnail,
  setEmbedThumbnail,
  embedMetadata,
  setEmbedMetadata,
}) => {
  const { t } = useLanguage();
  return (
    <div className="tab-content">
      <div className="form-group">
        <label className="form-label">Audio Quality</label>
        {bitrateOptions.length === 0 && isPlaylistMode ? (
          <p className="form-static-note">Best available quality (auto)</p>
        ) : (
          <select
            className="form-select"
            value={selectedAudioFormat}
            onChange={(e) => setSelectedAudioFormat(e.target.value)}
          >
            {bitrateOptions.map((opt) => (
              <option key={opt.formatId} value={opt.formatId}>
                {opt.bitrate} kbps ({opt.codec})
              </option>
            ))}
            {bitrateOptions.length === 0 && (
              <option value="">No audio formats available</option>
            )}
          </select>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Output Format</label>
        <select
          className="form-select"
          value={selectedAudioContainer}
          onChange={(e) => setSelectedAudioContainer(e.target.value)}
        >
          <option value="mp3">MP3</option>
          <option value="m4a">M4A</option>
          <option value="opus">Opus</option>
          <option value="wav">WAV</option>
        </select>
      </div>

      <div className="form-group">
        <label className="form-checkbox-label">
          <input
            type="checkbox"
            className="form-checkbox"
            checked={embedThumbnail}
            onChange={(e) => setEmbedThumbnail(e.target.checked)}
          />
          <span className="checkbox-text">{t("modal_embedThumbnail")}</span>
        </label>
      </div>

      <div className="form-group">
        <label className="form-checkbox-label">
          <input
            type="checkbox"
            className="form-checkbox"
            checked={embedMetadata}
            onChange={(e) => setEmbedMetadata(e.target.checked)}
          />
          <span className="checkbox-text">{t("modal_embedMetadata")}</span>
        </label>
      </div>
    </div>
  );
};
