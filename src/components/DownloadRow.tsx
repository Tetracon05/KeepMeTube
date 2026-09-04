import React, { useRef, useState } from "react";
import type { DownloadEntry } from "../types";
import { ProgressCell } from "./ProgressCell";
import { IconVideo, IconMusic, IconMonitor, IconCheckSquare, IconSquare } from "./Icons";
import { formatBytes, formatDate } from "../lib/utils";
import * as api from "../lib/tauri";
import { useLanguage } from "../hooks/useLanguage";

interface DownloadRowProps {
  download: DownloadEntry;
  isSelected: boolean;
  isMultiSelectMode: boolean;
  onSelect: (id: string, e: React.MouseEvent) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

const kindLabels: Record<string, string> = {
  video: "Video",
  audio: "Audio",
  videoaudio: "Video",
};

const KindIcon: React.FC<{ kind: string }> = ({ kind }) => {
  switch (kind) {
    case "video":
      return <IconVideo size={13} />;
    case "audio":
      return <IconMusic size={13} />;
    case "videoaudio":
      return <IconMonitor size={13} />;
    default:
      return <IconMonitor size={13} />;
  }
};

// Memoized so a progress tick on one row (which replaces the whole
// `downloads` array in the store) doesn't re-render every other row —
// only the row whose own `download` object actually changed re-renders.
// Requires `onSelect`/`onContextMenu` to be stable (see DownloadList).
export const DownloadRow: React.FC<DownloadRowProps> = React.memo(function DownloadRow({
  download,
  isSelected,
  isMultiSelectMode,
  onSelect,
  onContextMenu,
}) {
  const { lang } = useLanguage();
  const isDraggable = download.status === "completed" && !!download.file_path;
  const [isDragging, setIsDragging] = useState(false);
  // Track whether a drag was initiated so we can suppress the click on mouseup
  const dragStartedRef = useRef(false);
  // Timer ref to detect long-press / drag intent (200ms threshold)
  const dragTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * On mousedown, start a short timer. If the mouse is still held after
   * 200 ms, treat it as a drag intent and call the Rust backend.
   * This prevents accidental drags on single clicks.
   */
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only trigger drag on left-button, only for completed downloads
    if (e.button !== 0 || !isDraggable) return;
    // Don't initiate drag in multi-select mode — user is selecting
    if (isMultiSelectMode) return;

    dragTimerRef.current = setTimeout(async () => {
      dragStartedRef.current = true;
      setIsDragging(true);
      try {
        await api.startDrag(download.id);
      } catch (err) {
        console.warn("Drag failed:", err);
      } finally {
        setIsDragging(false);
        dragStartedRef.current = false;
      }
    }, 200);
  };

  const handleMouseUp = () => {
    // Cancel the drag timer if the user releases before 200 ms
    if (dragTimerRef.current) {
      clearTimeout(dragTimerRef.current);
      dragTimerRef.current = null;
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    // If a drag was in progress, swallow the click so it doesn't toggle selection
    if (dragStartedRef.current) return;
    onSelect(download.id, e);
  };

  return (
    <tr
      className={`download-row${isSelected ? " selected" : ""}${isDraggable ? " draggable" : ""}${isDragging ? " dragging" : ""}`}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onContextMenu={(e) => onContextMenu(e, download.id)}
      title={
        isDraggable
          ? "Dosyayı sürükleyerek Dosya Gezgini'ne kopyalayabilirsiniz"
          : download.status !== "completed"
          ? "İndirme tamamlandığında sürükleyebilirsiniz"
          : undefined
      }
    >
      {isMultiSelectMode && (
        <td className="cell-check">
          {isSelected ? (
            <IconCheckSquare size={16} className="check-icon checked" />
          ) : (
            <IconSquare size={16} className="check-icon" />
          )}
        </td>
      )}
      <td className="cell-name">
        <div className="name-content">
          {isDraggable && (
            <span className="drag-handle" aria-hidden="true">
              ⠿
            </span>
          )}
          <span className="name-text" title={download.title}>
            {download.title}
          </span>
        </div>
      </td>
      <td className="cell-kind" title={kindLabels[download.kind] || download.kind}>
        <span className="kind-badge">
          <KindIcon kind={download.kind} />
          <span className="kind-label">{kindLabels[download.kind] || download.kind}</span>
        </span>
      </td>
      <td className="cell-size">
        <span className="size-text">
          {download.file_size ? formatBytes(download.file_size) : "—"}
        </span>
      </td>
      <td className="cell-date">
        <span className="date-text">
          {formatDate(download.created_at, lang)}
        </span>
      </td>
      <td className="cell-progress">
        <ProgressCell download={download} />
      </td>
    </tr>
  );
});
