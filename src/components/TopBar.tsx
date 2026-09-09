import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import {
  IconPlus,
  IconFolderOpen,
  IconEdit,
  IconX,
  IconTrash,
  IconCheckSquare,
  IconLogo,
  IconSearch,
  IconRefreshCw,
} from "./Icons";
import { useLanguage } from "../hooks/useLanguage";
import { useDownloadActions } from "../hooks/useDownloadActions";
import { useDownloadStore } from "../store/useDownloadStore";

interface TopBarProps {
  onOpenSettings: () => void;
}

export const TopBar: React.FC<TopBarProps> = ({ onOpenSettings }) => {
  const { t } = useLanguage();
  const {
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
  } = useDownloadActions();
  const searchQuery = useDownloadStore((s) => s.searchQuery);
  const setSearchQuery = useDownloadStore((s) => s.setSearchQuery);

  // Drop button labels (icon-only) exactly when the toolbar's actual
  // content no longer fits — a fixed pixel breakpoint can't get this right
  // for every language (label lengths vary a lot) or every display's DPI
  // scaling, so it either clips controls too soon or goes icon-only with
  // room to spare.
  const topBarRef = useRef<HTMLDivElement>(null);
  const [isCompact, setIsCompact] = useState(false);

  const checkOverflow = useCallback(() => {
    const el = topBarRef.current;
    if (!el) return;
    // Measure as if expanded, regardless of the current state, so shrinking
    // the window and then growing it back re-expands correctly instead of
    // getting stuck compact.
    const wasCompact = el.classList.contains("top-bar--compact");
    if (wasCompact) el.classList.remove("top-bar--compact");
    const fits = el.scrollWidth <= el.clientWidth;
    if (wasCompact) el.classList.add("top-bar--compact");
    setIsCompact(!fits);
  }, []);

  // Re-check on an actual window resize — the toolbar's own box changes
  // width, which ResizeObserver reports.
  useLayoutEffect(() => {
    const el = topBarRef.current;
    if (!el) return;
    checkOverflow();
    const observer = new ResizeObserver(checkOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [checkOverflow]);

  // Also re-check whenever the set of rendered buttons changes — selecting
  // an item adds Show/Rename/Retry/Remove/Delete, which can overflow
  // without the toolbar's own box size changing at all, so ResizeObserver
  // alone never notices (it only reports box-size changes, not children
  // overflowing inside a fixed-width container).
  useLayoutEffect(() => {
    checkOverflow();
  }, [checkOverflow, hasSelection, isCompleted, canRetry]);

  return (
    <div className={`top-bar${isCompact ? " top-bar--compact" : ""}`} ref={topBarRef}>
      <div className="brand">
        <div className="logo-mark">
          <IconLogo size={16} />
        </div>
        <span className="brand-wordmark">KeepMeTube</span>
      </div>

      <div className="top-bar-divider" />

      <button
        className="btn btn-primary btn-add-download"
        onClick={() => setAddPanelOpen(true)}
      >
        <IconPlus size={16} />
        {t("topBar_addDownload")}
      </button>

      <div className="top-bar-divider" />

      <div className="top-bar-actions">
        <button
          className={`btn btn-action ${isMultiSelectMode ? "btn-active" : ""}`}
          onClick={toggleMultiSelectMode}
          title={isMultiSelectMode ? t("topBar_exitSelect") : t("topBar_select")}
        >
          <IconCheckSquare size={15} />
          <span className="btn-label">{t("topBar_select")}</span>
        </button>

        {singleSelected && isCompleted && (
          <>
            <button className="btn btn-action" onClick={handleShowInFolder} title={t("topBar_show")}>
              <IconFolderOpen size={15} />
              <span className="btn-label">{t("topBar_show")}</span>
            </button>
            <button
              className="btn btn-action"
              onClick={handleRename}
              title={t("topBar_rename")}
            >
              <IconEdit size={15} />
              <span className="btn-label">{t("topBar_rename")}</span>
            </button>
          </>
        )}

        {singleSelected && canRetry && (
          <button className="btn btn-action" onClick={handleRetry} title={t("topBar_retry")}>
            <IconRefreshCw size={15} />
            <span className="btn-label">{t("topBar_retry")}</span>
          </button>
        )}

        {hasSelection && (
          <>
            <button className="btn btn-action" onClick={handleRemove} title={t("topBar_remove")}>
              <IconX size={15} />
              <span className="btn-label">{t("topBar_remove")}</span>
            </button>
            <button className="btn btn-action btn-danger" onClick={handleDelete} title={t("topBar_delete")}>
              <IconTrash size={15} />
              <span className="btn-label">
                {t("topBar_delete")}{selectedArray.length > 1 ? ` (${selectedArray.length})` : ""}
              </span>
            </button>
          </>
        )}
      </div>

      <div style={{ flex: 1 }} />

      <div className="search-box">
        <IconSearch size={14} className="search-box__icon" />
        <input
          type="text"
          className="search-box__input"
          placeholder={t("topBar_searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Settings button */}
      <button
        className="btn btn-action btn-settings"
        onClick={onOpenSettings}
        title={t("topBar_settings")}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/>
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
        <span className="btn-label">{t("topBar_settings")}</span>
      </button>
    </div>
  );
};