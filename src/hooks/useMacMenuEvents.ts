import { useEffect } from "react";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useDownloadActions } from "./useDownloadActions";

interface MacMenuCallbacks {
  onAbout: () => void;
  onSettings: () => void;
  onCheckUpdates: () => void;
}

/**
 * Bridges native macOS menu bar clicks to the same actions the on-screen
 * toolbar uses. The Rust side (src-tauri/src/menu.rs) only builds/emits
 * these `menu-*` events on macOS, so this hook is inert — never receives
 * anything — on Windows/Linux, and is safe to mount unconditionally.
 */
export function useMacMenuEvents({ onAbout, onSettings, onCheckUpdates }: MacMenuCallbacks) {
  const {
    setAddPanelOpen,
    toggleMultiSelectMode,
    handleRename,
    handleDelete,
    handleRemove,
    handleShowInFolder,
  } = useDownloadActions();

  useEffect(() => {
    let unlistenFns: UnlistenFn[] = [];
    let cancelled = false;

    Promise.all([
      listen("menu-about", () => onAbout()),
      listen("menu-settings", () => onSettings()),
      listen("menu-check-updates", () => onCheckUpdates()),
      listen("menu-add-download", () => setAddPanelOpen(true)),
      listen("menu-select-mode", () => toggleMultiSelectMode()),
      listen("menu-rename", () => handleRename()),
      listen("menu-delete", () => handleDelete()),
      listen("menu-remove", () => handleRemove()),
      listen("menu-show-in-finder", () => handleShowInFolder()),
    ]).then((fns) => {
      if (cancelled) {
        fns.forEach((fn) => fn());
      } else {
        unlistenFns = fns;
      }
    });

    return () => {
      cancelled = true;
      unlistenFns.forEach((fn) => fn());
    };
    // Registered once; the actions above read fresh state at call time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
