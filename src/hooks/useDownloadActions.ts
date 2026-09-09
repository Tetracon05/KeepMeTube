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
  const selectedIds = useDownloadStore((s) => s.selectedIds);
  const isMultiSelectMode = useDownloadStore((s) => s.isMultiSelectMode);
  const setAddPanelOpen = useDownloadStore((s) => s.setAddPanelOpen);
  const toggleMultiSelectMode = useDownloadStore((s) => s.toggleMultiSelectMode);

  // Scoped to the one selected entry, not the whole `downloads` array:
  // `updateProgress` replaces that array on every progress tick, but `.find`
  // below returns the *same* object reference for every id it doesn't
  // match. So this only produces a new value (and re-renders the toolbar /
  // native menu bridge) when the actually-selected download changes, not
  // when some other download in the list is merely progressing.
  const singleSelected = useDownloadStore((s) => {
    if (s.selectedIds.size !== 1) return null;
    const id = s.selectedIds.values().next().value as string;
    return s.downloads.find((d) => d.id === id) ?? null;
  });

  const selectedArray = [...selectedIds];
  const hasSelection = selectedArray.length > 0;
  const isCompleted = singleSelected?.status === "completed";
  // "paused" can only exist from data written before Pause/Resume was
  // removed — Retry still restarts it.
  const canRetry = singleSelected?.status === "failed" || singleSelected?.status === "paused";

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

  const handleRetry = async () => {
    const { selectedIds } = useDownloadStore.getState();
    if (selectedIds.size !== 1) return;
    const id = [...selectedIds][0];
    try {
      await api.retryDownload(id);
    } catch (err) {
      console.error("Failed to retry:", id, err);
    }
  };

  return {
    selectedArray,
    singleSelected,
    hasSelection,
    isCompleted,
    canRetry,
    isMultiSelectMode,
    setAddPanelOpen,
    toggleMultiSelectMode,
    handleRename,
    handleDelete,
    handleRemove,
    handleShowInFolder,
    handleRetry,
  };
}
