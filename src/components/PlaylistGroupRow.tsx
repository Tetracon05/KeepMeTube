import React from "react";
import type { DownloadEntry } from "../types";
import { IconList } from "./Icons";
import { formatDate } from "../lib/utils";
import { useLanguage } from "../hooks/useLanguage";

export interface PlaylistGroupInfo {
  id: string;
  title: string;
  createdAt: string;
  children: DownloadEntry[];
}

interface PlaylistGroupRowProps {
  group: PlaylistGroupInfo;
  isMultiSelectMode: boolean;
  onOpen: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
}

// Memoized for the same reason as DownloadRow: a progress tick anywhere in
// the store replaces the whole `downloads` array, so without this every
// playlist group would re-render on every tick from any download, including
// ones in other playlists entirely.
export const PlaylistGroupRow: React.FC<PlaylistGroupRowProps> = React.memo(function PlaylistGroupRow({
  group,
  isMultiSelectMode,
  onOpen,
  onContextMenu,
}) {
  const { lang, t } = useLanguage();
  const total = group.children.length;
  const completed = group.children.filter((d) => d.status === "completed").length;
  const failed = group.children.filter((d) => d.status === "failed").length;
  const active = group.children.some((d) => d.status === "downloading" || d.status === "processing");
  const avgProgress =
    total === 0
      ? 0
      : group.children.reduce((sum, d) => sum + (d.status === "completed" ? 100 : d.progress), 0) / total;

  return (
    <tr
      className="download-row playlist-group-row"
      onClick={() => onOpen(group.id)}
      onContextMenu={(e) => onContextMenu(e, group.id)}
    >
      {isMultiSelectMode && <td className="cell-check" />}
      <td className="cell-name">
        <div className="name-content">
          <span className="playlist-group-icon"><IconList size={15} /></span>
          <span className="name-text" title={group.title}>{group.title}</span>
        </div>
      </td>
      <td className="cell-kind">
        <span className="kind-badge">
          <IconList size={13} />
          <span className="kind-label">{t("kind_playlist")}</span>
        </span>
      </td>
      <td className="cell-size">
        <span className="size-text">—</span>
      </td>
      <td className="cell-date">
        <span className="date-text">{formatDate(group.createdAt, lang)}</span>
      </td>
      <td className="cell-progress">
        <div className="progress-cell">
          <div className="progress-downloading">
            <div className="progress-bar-track">
              <div
                className={`progress-bar-fill ${failed > 0 && !active ? "failed" : "downloading"}`}
                style={{ width: `${Math.min(avgProgress, 100)}%` }}
              />
            </div>
            <div className="progress-info">
              <span className="progress-percent">{completed}/{total}</span>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
});
