import React, { useState } from "react";
import { useDownloadStore } from "../store/useDownloadStore";
import * as api from "../lib/tauri";

export const RenameDialog: React.FC = () => {
  const renameDialogId = useDownloadStore((s) => s.renameDialogId);
  const setRenameDialogId = useDownloadStore((s) => s.setRenameDialogId);
  const loadDownloads = useDownloadStore((s) => s.loadDownloads);
  // Derived selector instead of subscribing to the whole `downloads` array:
  // a progress tick on some other download leaves this entry's object
  // reference unchanged, so it doesn't re-render this (always-mounted) dialog.
  const download = useDownloadStore((s) => s.downloads.find((d) => d.id === renameDialogId));
  const [newName, setNewName] = useState("");
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (download) {
      // Set initial name without extension
      const name = download.title;
      setNewName(name);
      setError(null);
    }
  }, [download]);

  if (!renameDialogId || !download) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) {
      setError("Name cannot be empty");
      return;
    }

    try {
      await api.renameDownload(renameDialogId, newName.trim());
      await loadDownloads();
      setRenameDialogId(null);
    } catch (err) {
      setError(String(err));
    }
  };

  const handleClose = () => {
    setRenameDialogId(null);
    setError(null);
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="rename-dialog" onClick={(e) => e.stopPropagation()}>
        <h3 className="rename-title">Rename File</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            className="rename-input"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
            placeholder="Enter new name"
          />
          {error && <p className="rename-error">{error}</p>}
          <div className="rename-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Rename
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
