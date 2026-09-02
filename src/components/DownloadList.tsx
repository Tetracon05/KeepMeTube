import React, { useMemo } from "react";
import { useDownloadStore } from "../store/useDownloadStore";
import { DownloadRow } from "./DownloadRow";
import { useContextMenu } from "../hooks/useContextMenu";
import { useDownloadListShortcuts } from "../hooks/useDownloadListShortcuts";
import { ContextMenu } from "./ContextMenu";
import { IconDownload, IconChevronUp, IconChevronDown } from "./Icons";
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
  const { downloads, selectedIds, selectId, isMultiSelectMode, sortKey, sortDirection, toggleSort } =
    useDownloadStore();
  const { contextMenu, handleContextMenu, closeContextMenu } =
    useContextMenu();
  const { t } = useLanguage();

  useDownloadListShortcuts();

  const handleSelect = (id: string, e: React.MouseEvent) => {
    const multiKey = e.metaKey || e.ctrlKey || isMultiSelectMode;
    selectId(id, multiKey);
  };

  const sortedDownloads = useMemo(() => {
    if (!sortKey) return downloads;
    const sorted = [...downloads].sort((a, b) => compareDownloads(a, b, sortKey));
    if (sortDirection === "desc") sorted.reverse();
    return sorted;
  }, [downloads, sortKey, sortDirection]);

  return (
    <div className="download-list-container">
      {downloads.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">
            <IconDownload size={48} />
          </div>
          <h3 className="empty-title">{t("empty_title")}</h3>
          <p className="empty-description">
            {t("empty_desc")}
          </p>
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
              {sortedDownloads.map((dl) => (
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
