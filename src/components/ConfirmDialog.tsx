import React from "react";
import { useShallow } from "zustand/react/shallow";
import { useDownloadStore } from "../store/useDownloadStore";
import { useLanguage } from "../hooks/useLanguage";
import { IconAlertTriangle } from "./Icons";
import * as api from "../lib/tauri";

/** Splits a "{placeholder}" template and bolds the interpolated value. */
function renderWithEmphasis(template: string, placeholder: string, value: string): React.ReactNode {
  const idx = template.indexOf(placeholder);
  if (idx === -1) return template;
  return (
    <>
      {template.slice(0, idx)}
      <strong>{value}</strong>
      {template.slice(idx + placeholder.length)}
    </>
  );
}

export const ConfirmDialog: React.FC = () => {
  const confirmDeleteIds = useDownloadStore((s) => s.confirmDeleteIds);
  const setConfirmDeleteIds = useDownloadStore((s) => s.setConfirmDeleteIds);
  const removeDownloadsFromList = useDownloadStore((s) => s.removeDownloadsFromList);
  // Derived + shallow-compared: only the handful of entries actually being
  // confirmed for deletion, so an unrelated download's progress tick
  // doesn't re-render this (always-mounted) dialog.
  const items = useDownloadStore(
    useShallow((s) =>
      confirmDeleteIds ? s.downloads.filter((d) => confirmDeleteIds.includes(d.id)) : []
    )
  );
  const { t } = useLanguage();

  if (!confirmDeleteIds || confirmDeleteIds.length === 0) return null;

  const count = confirmDeleteIds.length;
  const singleTitle = count === 1 ? items[0]?.title : null;

  const title = singleTitle
    ? t("confirmDelete_titleSingle")
    : t("confirmDelete_titleMultiple").replace("{count}", String(count));
  const message = singleTitle
    ? renderWithEmphasis(t("confirmDelete_messageSingle"), "{name}", singleTitle)
    : renderWithEmphasis(t("confirmDelete_messageMultiple"), "{count}", String(count));

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
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={handleCancel}>X</button>
        </div>

        <div className="modal-body">
          <div className="confirm-icon-wrapper">
            <IconAlertTriangle size={28} className="confirm-icon" />
          </div>
          <p className="confirm-message">{message}</p>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={handleCancel}>
            {t("confirmDelete_cancel")}
          </button>
          <button className="btn btn-destructive" onClick={handleConfirm}>
            {t("confirmDelete_delete")}
          </button>
        </div>
      </div>
    </div>
  );
};
