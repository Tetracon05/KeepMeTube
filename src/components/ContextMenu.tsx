import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useDownloadStore } from "../store/useDownloadStore";
import {
  IconFolderOpen,
  IconEdit,
  IconX,
  IconTrash,
  IconRefreshCw,
} from "./Icons";
import * as api from "../lib/tauri";
import { useLanguage } from "../hooks/useLanguage";
import { getDirName } from "../lib/utils";

interface ContextMenuProps {
  x: number;
  y: number;
  downloadId: string;
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  downloadId,
  onClose,
}) => {
  const { t } = useLanguage();
  const removeDownloadsFromList = useDownloadStore((s) => s.removeDownloadsFromList);
  const setRenameDialogId = useDownloadStore((s) => s.setRenameDialogId);
  const setConfirmDeleteIds = useDownloadStore((s) => s.setConfirmDeleteIds);
  const download = useDownloadStore((s) => s.downloads.find((d) => d.id === downloadId));
  // A playlist group row's "id" isn't a real download — it's the shared
  // playlist_id its children carry. If it doesn't match any download's own
  // id but does match some downloads' playlist_id, this is a group menu.
  // useShallow matters here: a plain selector returning `.filter()` (or a
  // derived `.map()` of it) constructs a new array every call, which breaks
  // React's snapshot-stability check and causes an infinite re-render loop
  // (crashes the whole tree — this is what a right-click on a playlist row
  // used to do). `.filter()` alone returns references to the SAME entry
  // objects when `downloads` hasn't changed, so useShallow's element-wise
  // comparison correctly treats repeated calls as unchanged.
  const groupChildren = useDownloadStore(
    useShallow((s) => s.downloads.filter((d) => d.playlist_id === downloadId))
  );

  if (!download && groupChildren.length === 0) return null;

  if (!download) {
    const groupChildIds = groupChildren.map((d) => d.id);
    // Every entry in a playlist batch is written under the same
    // `<outputDir>/<playlist title>/` subfolder, so any child's directory
    // is the playlist's folder.
    const playlistFolder = getDirName(groupChildren[0].file_path);

    const handleShowPlaylistFolder = async () => {
      onClose();
      if (playlistFolder) {
        await api.showInFolder(playlistFolder);
      }
    };

    const handleRemovePlaylist = async () => {
      onClose();
      for (const id of groupChildIds) {
        try {
          await api.removeDownload(id);
        } catch (err) {
          console.error("Failed to remove:", id, err);
        }
      }
      removeDownloadsFromList(groupChildIds);
    };

    const handleDeletePlaylistFiles = () => {
      onClose();
      setConfirmDeleteIds(groupChildIds);
    };

    const groupMenuStyle: React.CSSProperties = { position: "fixed", top: y, left: x, zIndex: 1000 };

    return (
      <div className="context-menu-overlay" onClick={onClose}>
        <div className="context-menu" style={groupMenuStyle} onClick={(e) => e.stopPropagation()}>
          <button className="context-menu-item" onClick={handleShowPlaylistFolder}>
            <span className="menu-icon"><IconFolderOpen size={14} /></span> {t("ctx_showInFolder")}
          </button>
          <div className="context-menu-divider" />
          <button className="context-menu-item" onClick={handleRemovePlaylist}>
            <span className="menu-icon"><IconX size={14} /></span> {t("ctx_removePlaylist")}
          </button>
          <button className="context-menu-item danger" onClick={handleDeletePlaylistFiles}>
            <span className="menu-icon"><IconTrash size={14} /></span> {t("ctx_deletePlaylistFiles")}
          </button>
        </div>
      </div>
    );
  }

  const isCompleted = download.status === "completed";
  // "paused" can only exist from data written before Pause/Resume was
  // removed (YouTube's direct media URLs expire and are IP-locked, so a
  // killed download usually can't really resume) — Retry still restarts it.
  const canRetry = download.status === "failed" || download.status === "paused";

  const handleDelete = () => {
    onClose();
    setConfirmDeleteIds([downloadId]);
  };

  const handleRemove = async () => {
    onClose();
    await api.removeDownload(downloadId);
    removeDownloadsFromList([downloadId]);
  };

  const handleRename = () => {
    onClose();
    setRenameDialogId(downloadId);
  };

  const handleShowInFolder = async () => {
    onClose();
    if (download.file_path) {
      await api.showInFolder(download.file_path);
    }
  };

  const handleCopyUrl = () => {
    onClose();
    navigator.clipboard.writeText(download.url).catch(() => {});
  };

  const handleRetry = async () => {
    onClose();
    try {
      await api.retryDownload(downloadId);
    } catch (err) {
      console.error("Failed to retry:", downloadId, err);
    }
  };

  // Adjust position to stay within viewport
  const menuStyle: React.CSSProperties = {
    position: "fixed",
    top: y,
    left: x,
    zIndex: 1000,
  };

  return (
    <div className="context-menu-overlay" onClick={onClose}>
      <div
        className="context-menu"
        style={menuStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {isCompleted && (
          <>
            <button className="context-menu-item" onClick={handleShowInFolder}>
              <span className="menu-icon"><IconFolderOpen size={14} /></span> {t("ctx_showInFolder")}
            </button>
            <button className="context-menu-item" onClick={handleRename}>
              <span className="menu-icon"><IconEdit size={14} /></span> {t("ctx_rename")}
            </button>
          </>
        )}
        {canRetry && (
          <button className="context-menu-item" onClick={handleRetry}>
            <span className="menu-icon"><IconRefreshCw size={14} /></span> {t("ctx_retry")}
          </button>
        )}
        <button className="context-menu-item" onClick={handleCopyUrl}>
          <span className="menu-icon">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </span> {t("ctx_copyUrl")}
        </button>
        <div className="context-menu-divider" />
        <button className="context-menu-item" onClick={handleRemove}>
          <span className="menu-icon"><IconX size={14} /></span> {t("ctx_remove")}
        </button>
        <button className="context-menu-item danger" onClick={handleDelete}>
          <span className="menu-icon"><IconTrash size={14} /></span> {t("ctx_deleteFile")}
        </button>
      </div>
    </div>
  );
};
