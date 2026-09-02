import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import type {
  DownloadEntry,
  ProgressEvent,
  ContextMenuPosition,
  SortKey,
  SortDirection,
} from "../types";
import * as api from "../lib/tauri";

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

  // Actions
  setDownloads: (downloads: DownloadEntry[]) => void;
  selectId: (id: string, multiKey: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  setMultiSelectMode: (on: boolean) => void;
  toggleMultiSelectMode: () => void;
  setAddPanelOpen: (open: boolean) => void;
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
  sortKey: null,
  sortDirection: "asc",

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

  selectAll: () =>
    set((state) => ({
      selectedIds: new Set(state.downloads.map((dl) => dl.id)),
      isMultiSelectMode: true,
    })),

  clearSelection: () => set({ selectedIds: new Set() }),

  setMultiSelectMode: (on) =>
    set({ isMultiSelectMode: on, selectedIds: on ? new Set() : new Set() }),

  toggleMultiSelectMode: () =>
    set((state) => ({
      isMultiSelectMode: !state.isMultiSelectMode,
      selectedIds: new Set(),
    })),

  setAddPanelOpen: (open) => set({ isAddPanelOpen: open }),
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
