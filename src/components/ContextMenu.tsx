import React from "react";
import { useDownloadStore } from "../store/useDownloadStore";
import {
  IconFolderOpen,
  IconEdit,
  IconX,
  IconTrash,
} from "./Icons";
import * as api from "../lib/tauri";
import { useLanguage } from "../hooks/useLanguage";

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

  if (!download) return null;

  const isCompleted = download.status === "completed";

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
