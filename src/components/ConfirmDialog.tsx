import React from "react";
import { useDownloadStore } from "../store/useDownloadStore";
import { IconAlertTriangle } from "./Icons";
import * as api from "../lib/tauri";

export const ConfirmDialog: React.FC = () => {
  const { confirmDeleteIds, setConfirmDeleteIds, removeDownloadsFromList, downloads } =
    useDownloadStore();

  if (!confirmDeleteIds || confirmDeleteIds.length === 0) return null;

  const count = confirmDeleteIds.length;
  const items = downloads.filter((d) => confirmDeleteIds.includes(d.id));
  const singleTitle = count === 1 ? items[0]?.title : null;

  const handleConfirm = async () => {
    for (const id of confirmDeleteIds) {
      try {
        await api.deleteDownload(id);
      } catch (err) {
        console.error("Failed to delete:", id, err);
      }
    }
    removeDownloadsFromList(confirmDeleteIds);
    setConfirmDeleteIds(null);
  };

  const handleCancel = () => {
    setConfirmDeleteIds(null);
  };

  return (
    <div className="modal-overlay" onClick={handleCancel}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Delete {count > 1 ? `${count} files` : "file"}?</h2>
          <button className="modal-close" onClick={handleCancel}>X</button>
        </div>

        <div className="modal-body">
          <div className="confirm-icon-wrapper">
            <IconAlertTriangle size={28} className="confirm-icon" />
          </div>
          <p className="confirm-message">
            {singleTitle ? (
              <>
                Are you sure you want to permanently delete{" "}
                <strong>"{singleTitle}"</strong>? This cannot be undone.
              </>
            ) : (
              <>
                Are you sure you want to permanently delete{" "}
                <strong>{count} files</strong>? This cannot be undone.
              </>
            )}
          </p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn btn-destructive" onClick={handleConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};
