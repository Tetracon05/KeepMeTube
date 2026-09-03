import { useDownloadStore } from "../store/useDownloadStore";
import * as api from "../lib/tauri";

/**
 * Shared selection-aware download actions (rename, delete, remove, show in
 * folder) plus the derived selection state they depend on. Used by the
 * on-screen toolbar and by the native macOS "File" menu so both stay wired
 * to the exact same logic.
 *
 * The action functions read selection state fresh via `getState()` at call
 * time rather than closing over the reactive values below, so a caller that
 * grabs them once (like the menu-event bridge) never operates on stale
 * selection — same approach as `useDownloadListShortcuts`.
 */
export function useDownloadActions() {
  const {
    downloads,
    selectedIds,
    isMultiSelectMode,
    setAddPanelOpen,
    toggleMultiSelectMode,
  } = useDownloadStore();

  const selectedArray = [...selectedIds];
  const singleSelected =
    selectedArray.length === 1
      ? downloads.find((d) => d.id === selectedArray[0])
      : null;
  const hasSelection = selectedArray.length > 0;
  const isCompleted = singleSelected?.status === "completed";

  const handleRename = () => {
    const { selectedIds, downloads, setRenameDialogId } = useDownloadStore.getState();
    if (selectedIds.size !== 1) return;
    const id = [...selectedIds][0];
    if (downloads.some((d) => d.id === id)) setRenameDialogId(id);
  };

  const handleDelete = () => {
    const { selectedIds, setConfirmDeleteIds } = useDownloadStore.getState();
    if (selectedIds.size === 0) return;
    setConfirmDeleteIds([...selectedIds]);
  };

  const handleRemove = async () => {
    const { selectedIds, removeDownloadsFromList } = useDownloadStore.getState();
    const ids = [...selectedIds];
    for (const id of ids) {
      try {
        await api.removeDownload(id);
      } catch (err) {
        console.error("Failed to remove:", id, err);
      }
    }
    removeDownloadsFromList(ids);
  };

  const handleShowInFolder = async () => {
    const { selectedIds, downloads } = useDownloadStore.getState();
    if (selectedIds.size !== 1) return;
    const item = downloads.find((d) => d.id === [...selectedIds][0]);
    if (!item?.file_path) return;
    await api.showInFolder(item.file_path);
  };

  return {
    selectedArray,
    singleSelected,
    hasSelection,
    isCompleted,
    isMultiSelectMode,
    setAddPanelOpen,
    toggleMultiSelectMode,
    handleRename,
    handleDelete,
    handleRemove,
    handleShowInFolder,
  };
}
