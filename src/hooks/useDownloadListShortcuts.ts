import { useEffect } from "react";
import { useDownloadStore } from "../store/useDownloadStore";

const isMac = () =>
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform ?? navigator.userAgent);

/** Overlays that should swallow the list's shortcuts while open. */
const isBlockedByOverlay = () =>
  !!document.querySelector(".modal-overlay, .update-dialog-overlay, .settings-drawer");

const isEditableTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
};

/**
 * Platform-aware "Select All" (Cmd+A / Ctrl+A) and delete (Delete / Backspace)
 * shortcuts for the downloads list. Scoped to the app document but ignores
 * key events while an input is focused or a modal/overlay is open.
 */
export function useDownloadListShortcuts() {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isEditableTarget(e.target) || isBlockedByOverlay()) return;

      const { downloads, selectedIds, selectAll, setConfirmDeleteIds } =
        useDownloadStore.getState();

      const selectAllPressed = isMac()
        ? e.metaKey && !e.ctrlKey && e.key.toLowerCase() === "a"
        : e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "a";

      if (selectAllPressed) {
        if (downloads.length === 0) return;
        e.preventDefault();
        selectAll();
        return;
      }

      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.size === 0) return;
        e.preventDefault();
        setConfirmDeleteIds([...selectedIds]);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
}
