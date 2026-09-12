import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import type {
  DownloadEntry,
  ProgressEvent,
  ContextMenuPosition,
  SortKey,
  SortDirection,
  SpeedMode,
} from "../types";
import * as api from "../lib/tauri";
import {
  SPEED_MODE_KEY,
  SPEED_LIMIT_SLOW_KEY,
  SPEED_LIMIT_MEDIUM_KEY,
  DEFAULT_SPEED_LIMIT_SLOW_KBPS,
  DEFAULT_SPEED_LIMIT_MEDIUM_KBPS,
} from "../lib/utils";

function loadInitialSpeedMode(): SpeedMode {
  const saved = localStorage.getItem(SPEED_MODE_KEY);
  return saved === "slow" || saved === "medium" || saved === "fast" ? saved : "fast";
}

function loadInitialSpeedLimits(): { slow: number; medium: number } {
  const slow = Number(localStorage.getItem(SPEED_LIMIT_SLOW_KEY));
  const medium = Number(localStorage.getItem(SPEED_LIMIT_MEDIUM_KEY));
  return {
    slow: slow > 0 ? slow : DEFAULT_SPEED_LIMIT_SLOW_KBPS,
    medium: medium > 0 ? medium : DEFAULT_SPEED_LIMIT_MEDIUM_KBPS,
  };
}

interface DownloadStore {
  // State
  downloads: DownloadEntry[];
  selectedIds: Set<string>;
  isMultiSelectMode: boolean;
  isAddPanelOpen: boolean;
  contextMenu: { position: ContextMenuPosition; downloadId: string } | null;
  renameDialogId: string | null;
  confirmDeleteIds: string[] | null;
  sortKey: SortKey | null;
  sortDirection: SortDirection;
  /** Id of the playlist currently drilled into, or null for the top-level list. */
  openPlaylistId: string | null;
  /** Filters the currently visible list (top-level or one playlist) by title. */
  searchQuery: string;
  /** Global download-speed cap applied to every new download's format_args. Persisted to localStorage. */
  speedMode: SpeedMode;
  /** Editable KB/s caps for Slow/Medium mode (Settings). Fast has no cap. Persisted to localStorage. */
  speedLimits: { slow: number; medium: number };

  // Actions
  setDownloads: (downloads: DownloadEntry[]) => void;
  selectId: (id: string, multiKey: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setMultiSelectMode: (on: boolean) => void;
  toggleMultiSelectMode: () => void;
  setAddPanelOpen: (open: boolean) => void;
  setOpenPlaylistId: (id: string | null) => void;
  setSearchQuery: (query: string) => void;
  setSpeedMode: (mode: SpeedMode) => void;
  setSpeedLimits: (limits: Partial<{ slow: number; medium: number }>) => void;
  setContextMenu: (
    ctx: { position: ContextMenuPosition; downloadId: string } | null
  ) => void;
  setRenameDialogId: (id: string | null) => void;
  setConfirmDeleteIds: (ids: string[] | null) => void;
  toggleSort: (key: SortKey) => void;
  updateProgress: (event: ProgressEvent) => void;
  loadDownloads: () => Promise<void>;
  addDownload: (entry: DownloadEntry) => void;
  removeDownloadsFromList: (ids: string[]) => void;
  initEventListeners: () => Promise<() => void>;
}

export const useDownloadStore = create<DownloadStore>((set, get) => ({
  // Initial state
  downloads: [],
  selectedIds: new Set(),
  isMultiSelectMode: false,
  isAddPanelOpen: false,
  contextMenu: null,
  renameDialogId: null,
  confirmDeleteIds: null,
  // Newest downloads first by default.
  sortKey: "date",
  sortDirection: "desc",
  openPlaylistId: null,
  searchQuery: "",
  speedMode: loadInitialSpeedMode(),
  speedLimits: loadInitialSpeedLimits(),

  // Setters
  setDownloads: (downloads) => set({ downloads }),

  selectId: (id, multiKey) => {
    set((state) => {
      if (state.isMultiSelectMode || multiKey) {
        const next = new Set(state.selectedIds);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        return { selectedIds: next };
      }
      return { selectedIds: new Set([id]) };
    });
  },

  // Scoped to whichever view is currently visible — the top-level list
  // (standalone downloads only) or one playlist's entries — so Select All
  // inside a playlist doesn't also grab unrelated top-level rows.
  selectAll: () =>
    set((state) => {
      const visible = state.openPlaylistId
        ? state.downloads.filter((dl) => dl.playlist_id === state.openPlaylistId)
        : state.downloads.filter((dl) => !dl.playlist_id);
      return {
        selectedIds: new Set(visible.map((dl) => dl.id)),
        isMultiSelectMode: true,
      };
    }),

  clearSelection: () => set({ selectedIds: new Set() }),

  setMultiSelectMode: (on) =>
    set({ isMultiSelectMode: on, selectedIds: on ? new Set() : new Set() }),

  toggleMultiSelectMode: () =>
    set((state) => ({
      isMultiSelectMode: !state.isMultiSelectMode,
      selectedIds: new Set(),
    })),

  setAddPanelOpen: (open) => set({ isAddPanelOpen: open }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  setSpeedMode: (mode) => {
    localStorage.setItem(SPEED_MODE_KEY, mode);
    set({ speedMode: mode });
  },

  setSpeedLimits: (limits) => {
    set((state) => {
      const next = { ...state.speedLimits, ...limits };
      if (limits.slow !== undefined) localStorage.setItem(SPEED_LIMIT_SLOW_KEY, String(next.slow));
      if (limits.medium !== undefined) localStorage.setItem(SPEED_LIMIT_MEDIUM_KEY, String(next.medium));
      return { speedLimits: next };
    });
  },

  // Clears selection on navigation so a stale selection from one view
  // doesn't silently apply to rows the user can no longer see.
  setOpenPlaylistId: (id) =>
    set({ openPlaylistId: id, selectedIds: new Set(), isMultiSelectMode: false }),
  setContextMenu: (ctx) => set({ contextMenu: ctx }),
  setRenameDialogId: (id) => set({ renameDialogId: id }),
  setConfirmDeleteIds: (ids) => set({ confirmDeleteIds: ids }),

  toggleSort: (key) =>
    set((state) => {
      if (state.sortKey === key) {
        return { sortDirection: state.sortDirection === "asc" ? "desc" : "asc" };
      }
      return { sortKey: key, sortDirection: "asc" };
    }),

  // Update download progress from Tauri event
  updateProgress: (event: ProgressEvent) => {
    set((state) => ({
      downloads: state.downloads.map((dl) =>
        dl.id === event.id
          ? {
              ...dl,
              status: event.status,
              progress: event.progress,
              speed: event.speed,
              error: event.error,
              file_size: event.file_size ?? dl.file_size,
            }
          : dl
      ),
    }));
  },

  // Load downloads from backend
  loadDownloads: async () => {
    try {
      const downloads = await api.getDownloads();
      set({ downloads });
    } catch (err) {
      console.error("Failed to load downloads:", err);
    }
  },

  // Add a new download entry
  addDownload: (entry) => {
    set((state) => ({
      downloads: [...state.downloads, entry],
    }));
  },

  // Remove download entries from list (frontend only)
  removeDownloadsFromList: (ids) => {
    const idSet = new Set(ids);
    set((state) => ({
      downloads: state.downloads.filter((dl) => !idSet.has(dl.id)),
      selectedIds: new Set(
        [...state.selectedIds].filter((sid) => !idSet.has(sid))
      ),
    }));
  },

  // Initialize Tauri event listeners for progress updates
  initEventListeners: async () => {
    const unlisten = await listen<ProgressEvent>("download-progress", (event) => {
      get().updateProgress(event.payload);
    });
    return unlisten;
  },
}));
