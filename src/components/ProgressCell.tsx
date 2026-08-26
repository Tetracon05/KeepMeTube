import React from "react";
import type { DownloadEntry } from "../types";
import { IconAlertTriangle } from "./Icons";

interface ProgressCellProps {
  download: DownloadEntry;
}

export const ProgressCell: React.FC<ProgressCellProps> = ({ download }) => {
  const { status, progress, speed, error } = download;

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
            <span className="progress-label connecting-label">Connecting…</span>
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
          <span className="progress-label processing-label">Processing</span>
        </div>
      )}

      {status === "completed" && (
        <span className="progress-label completed-label">Completed</span>
      )}

      {status === "failed" && (
        <div className="progress-failed" title={error || "Unknown error"}>
          <span className="progress-label failed-label">Failed</span>
          {error && <span className="failed-icon" title={error}><IconAlertTriangle size={14} /></span>}
        </div>
      )}


      {status === "pending" && (
        <span className="progress-label pending-label">Queued</span>
      )}

      {status === "cancelled" && (
        <span className="progress-label cancelled-label">Cancelled</span>
      )}
    </div>
  );
};
