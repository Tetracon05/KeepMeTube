import React, { useCallback, useEffect, useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDownloadStore } from "../store/useDownloadStore";
import { DownloadRow } from "./DownloadRow";
import { PlaylistGroupRow, type PlaylistGroupInfo } from "./PlaylistGroupRow";
import { useContextMenu } from "../hooks/useContextMenu";
import { useDownloadListShortcuts } from "../hooks/useDownloadListShortcuts";
import { ContextMenu } from "./ContextMenu";
import { IconLogo, IconChevronUp, IconChevronDown, IconChevronLeft } from "./Icons";
import { useLanguage } from "../hooks/useLanguage";
import type { DownloadEntry, SortKey } from "../types";

function compareDownloads(a: DownloadEntry, b: DownloadEntry, key: SortKey): number {
  switch (key) {
    case "name":
      return a.title.localeCompare(b.title);
    case "kind":
      return a.kind.localeCompare(b.kind);
    case "size":
      return (a.file_size ?? -1) - (b.file_size ?? -1);
    case "date":
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    case "progress":
      return a.progress - b.progress || a.status.localeCompare(b.status);
    default:
      return 0;
  }
}

interface SortableHeaderProps {
  label: string;
  sortKey: SortKey;
  className: string;
  activeSortKey: SortKey | null;
  sortDirection: "asc" | "desc";
  onSort: (key: SortKey) => void;
}

const SortableHeader: React.FC<SortableHeaderProps> = ({
  label,
  sortKey,
  className,
  activeSortKey,
  sortDirection,
  onSort,
}) => {
  const isActive = activeSortKey === sortKey;
  return (
    <th
      className={`${className} th-sortable${isActive ? " th-sorted" : ""}`}
      onClick={() => onSort(sortKey)}
      aria-sort={isActive ? (sortDirection === "asc" ? "ascending" : "descending") : "none"}
    >
      <span className="th-sortable-content">
        {label}
        <span className="th-sort-icon">
          {isActive ? (
            sortDirection === "asc" ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />
          ) : null}
        </span>
      </span>
    </th>
  );
};

export const DownloadList: React.FC = () => {
  // Scoped to exactly the fields this component uses — without this, any
  // unrelated store change (opening Settings, a rename dialog, etc.) would
  // re-render the whole table too, since the default `useDownloadStore()`
  // subscribes to every field regardless of which ones are destructured.
  const {
    downloads,
    selectedIds,
    selectId,
    isMultiSelectMode,
    sortKey,
    sortDirection,
    toggleSort,
    openPlaylistId,
    setOpenPlaylistId,
    searchQuery,
  } = useDownloadStore(
      useShallow((s) => ({
        downloads: s.downloads,
        selectedIds: s.selectedIds,
        selectId: s.selectId,
        isMultiSelectMode: s.isMultiSelectMode,
        sortKey: s.sortKey,
        sortDirection: s.sortDirection,
        toggleSort: s.toggleSort,
        openPlaylistId: s.openPlaylistId,
        setOpenPlaylistId: s.setOpenPlaylistId,
        searchQuery: s.searchQuery,
      }))
    );
  const { contextMenu, handleContextMenu, closeContextMenu } =
    useContextMenu();
  const { t } = useLanguage();

  useDownloadListShortcuts();

  // Stable reference so DownloadRow's React.memo can actually skip
  // re-rendering rows a progress tick didn't touch.
  const handleSelect = useCallback(
    (id: string, e: React.MouseEvent) => {
      const multiKey = e.metaKey || e.ctrlKey || isMultiSelectMode;
      selectId(id, multiKey);
    },
    [isMultiSelectMode, selectId]
  );

  // Split the flat list into standalone downloads and playlist batches —
  // entries sharing a `playlist_id` collapse into one group row at the top
  // level, with their own view when that group is opened.
  const { standaloneDownloads, playlistGroups } = useMemo(() => {
    const standalone: DownloadEntry[] = [];
    const groupMap = new Map<string, PlaylistGroupInfo>();
    const groupOrder: string[] = [];
    for (const d of downloads) {
      if (!d.playlist_id) {
        standalone.push(d);
        continue;
      }
      let group = groupMap.get(d.playlist_id);
      if (!group) {
        group = { id: d.playlist_id, title: d.playlist_title || d.playlist_id, createdAt: d.created_at, children: [] };
        groupMap.set(d.playlist_id, group);
        groupOrder.push(d.playlist_id);
      }
      group.children.push(d);
    }
    const playlistGroups = groupOrder
      .map((id) => groupMap.get(id)!)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return { standaloneDownloads: standalone, playlistGroups };
  }, [downloads]);

  const openGroup = openPlaylistId ? playlistGroups.find((g) => g.id === openPlaylistId) ?? null : null;
  const activeEntries = openPlaylistId ? openGroup?.children ?? [] : standaloneDownloads;

  // A playlist view that's lost all its entries (e.g. every video was
  // individually deleted from within it) would otherwise be a dead end —
  // fall back to the top-level list instead.
  useEffect(() => {
    if (openPlaylistId && activeEntries.length === 0) {
      setOpenPlaylistId(null);
    }
  }, [openPlaylistId, activeEntries.length, setOpenPlaylistId]);

  const sortedDownloads = useMemo(() => {
    if (!sortKey) return activeEntries;
    const sorted = [...activeEntries].sort((a, b) => compareDownloads(a, b, sortKey));
    if (sortDirection === "desc") sorted.reverse();
    return sorted;
  }, [activeEntries, sortKey, sortDirection]);

  // Search filters the current view's display only — it never affects the
  // "playlist emptied out" check above, so a search matching nothing inside
  // an open playlist shows "no results" instead of bouncing back to the
  // top-level list.
  const searchLower = searchQuery.trim().toLowerCase();
  const visibleDownloads = useMemo(() => {
    if (!searchLower) return sortedDownloads;
    return sortedDownloads.filter((d) => d.title.toLowerCase().includes(searchLower));
  }, [sortedDownloads, searchLower]);
  const visibleGroups = useMemo(() => {
    if (!searchLower) return playlistGroups;
    return playlistGroups.filter((g) => g.title.toLowerCase().includes(searchLower));
  }, [playlistGroups, searchLower]);

  const isEmpty = openPlaylistId
    ? visibleDownloads.length === 0
    : visibleDownloads.length === 0 && visibleGroups.length === 0;

  return (
    <div className="download-list-container">
      {openPlaylistId && openGroup && (
        <div className="playlist-breadcrumb">
          <button className="playlist-breadcrumb__back" onClick={() => setOpenPlaylistId(null)}>
            <IconChevronLeft size={15} /> {t("playlist_back")}
          </button>
          <span className="playlist-breadcrumb__title">{openGroup.title}</span>
          <span className="playlist-breadcrumb__count">{openGroup.children.length}</span>
        </div>
      )}

      {isEmpty ? (
        <div className="empty-state">
          <div className="empty-icon">
            <IconLogo size={28} />
          </div>
          <h3 className="empty-title">{searchLower ? t("empty_noResultsTitle") : t("empty_title")}</h3>
          {!searchLower && <p className="empty-description">{t("empty_desc")}</p>}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="download-table">
            <thead>
              <tr>
                {isMultiSelectMode && <th className="th-check" />}
                <SortableHeader
                  label={t("col_name")}
                  sortKey="name"
                  className="th-name"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label={t("col_kind")}
                  sortKey="kind"
                  className="th-kind"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label={t("col_size")}
                  sortKey="size"
                  className="th-size"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label={t("col_date")}
                  sortKey="date"
                  className="th-date"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label={t("col_progress")}
                  sortKey="progress"
                  className="th-progress"
                  activeSortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {!openPlaylistId &&
                visibleGroups.map((group) => (
                  <PlaylistGroupRow
                    key={group.id}
                    group={group}
                    isMultiSelectMode={isMultiSelectMode}
                    onOpen={setOpenPlaylistId}
                    onContextMenu={handleContextMenu}
                  />
                ))}
              {visibleDownloads.map((dl) => (
                <DownloadRow
                  key={dl.id}
                  download={dl}
                  isSelected={selectedIds.has(dl.id)}
                  isMultiSelectMode={isMultiSelectMode}
                  onSelect={handleSelect}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {contextMenu && (
        <ContextMenu
          x={contextMenu.position.x}
          y={contextMenu.position.y}
          downloadId={contextMenu.targetId}
          onClose={closeContextMenu}
        />
      )}
    </div>
  );
};
