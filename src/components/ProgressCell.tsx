import React from "react";
import type { DownloadEntry } from "../types";
import { IconAlertTriangle } from "./Icons";
import { useLanguage } from "../hooks/useLanguage";

interface ProgressCellProps {
  download: DownloadEntry;
}

export const ProgressCell: React.FC<ProgressCellProps> = ({ download }) => {
  const { status, progress, speed, error } = download;
  const { t } = useLanguage();

  // "Connecting" phase: download has started but no bytes received yet
  const isConnecting = status === "downloading" && progress === 0 && !speed;

  return (
    <div className="progress-cell">
      {status === "downloading" && (
        isConnecting ? (
          <div className="progress-connecting">
            <div className="progress-bar-track">
              <div className="progress-bar-fill progress-bar-indeterminate connecting" />
            </div>
            <span className="progress-label connecting-label">{t("progress_connecting")}</span>
          </div>
        ) : (
          <div className="progress-downloading">
            <div className="progress-bar-track">
              <div
                className="progress-bar-fill downloading"
                style={{ width: `${Math.min(progress, 100)}%` }}
              />
            </div>
            <div className="progress-info">
              <span className="progress-percent">{progress.toFixed(1)}%</span>
              {speed && <span className="progress-speed">{speed}</span>}
            </div>
          </div>
        )
      )}

      {status === "processing" && (
        <div className="progress-processing">
          <div className="progress-bar-track">
            <div className="progress-bar-fill processing progress-bar-indeterminate" />
          </div>
          <span className="progress-label processing-label">{t("progress_processing")}</span>
        </div>
      )}

      {status === "completed" && (
        <span className="progress-label completed-label">{t("progress_completed")}</span>
      )}

      {status === "failed" && (
        <div className="progress-failed" title={error || t("progress_unknownError")}>
          <span className="progress-label failed-label">{t("progress_failed")}</span>
          {error && <span className="failed-icon" title={error}><IconAlertTriangle size={14} /></span>}
        </div>
      )}


      {status === "pending" && (
        <span className="progress-label pending-label">{t("progress_queued")}</span>
      )}

      {status === "paused" && (
        <div className="progress-paused">
          <div className="progress-bar-track">
            <div
              className="progress-bar-fill paused"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="progress-info">
            <span className="progress-percent">{progress.toFixed(1)}%</span>
            <span className="progress-label paused-label">{t("progress_paused")}</span>
          </div>
        </div>
      )}

      {status === "cancelled" && (
        <span className="progress-label cancelled-label">{t("progress_cancelled")}</span>
      )}
    </div>
  );
};
