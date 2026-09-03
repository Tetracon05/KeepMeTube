import React, { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { AppUpdateInfo, UpdateCheckResult } from "../types";

interface UpdateCheckControlsProps {
  /** Non-null when a newer app version was found in the background */
  pendingAppUpdate: AppUpdateInfo | null;
  /** Non-null when a newer yt-dlp version was found in the background */
  pendingYtDlpUpdate: UpdateCheckResult | null;
  /** Opens the app update modal */
  onTriggerAppUpdate: () => void;
  /** Opens the yt-dlp update modal */
  onTriggerYtDlpUpdate: () => void;
  /** Re-runs both update checks on demand; resolves with which check(s) failed */
  onCheckUpdates: () => Promise<{ appError: boolean; ytError: boolean }>;
  /** Runs a check automatically once on mount (used by the standalone dialog) */
  autoCheck?: boolean;
}

/**
 * The "is there an update?" row: an idle check button, or a badge (+ install
 * button) once one is found. Shared by the Settings "About" section and the
 * standalone "Check for Updates" dialog opened from the macOS app menu.
 */
export const UpdateCheckControls: React.FC<UpdateCheckControlsProps> = ({
  pendingAppUpdate,
  pendingYtDlpUpdate,
  onTriggerAppUpdate,
  onTriggerYtDlpUpdate,
  onCheckUpdates,
  autoCheck,
}) => {
  const { t } = useLanguage();

  const [checking, setChecking] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);
  const [checkError, setCheckError] = useState(false);

  const hasAppUpdate = pendingAppUpdate !== null;
  const hasYtDlpUpdate = pendingYtDlpUpdate !== null;
  const hasAnyUpdate = hasAppUpdate || hasYtDlpUpdate;

  const handleCheckUpdates = async () => {
    setChecking(true);
    // Clear the stale result badge from a previous check so it doesn't
    // render alongside the new checking spinner while this one is in flight.
    setCheckedOnce(false);
    setCheckError(false);
    const { appError, ytError } = await onCheckUpdates();
    // A failed check must never be reported as "up to date" — that's a
    // false positive. Surface it as a distinct error state instead.
    setCheckError(appError || ytError);
    setCheckedOnce(true);
    setChecking(false);
  };

  useEffect(() => {
    if (autoCheck) handleCheckUpdates();
    // Only ever auto-runs once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="settings-updates-row">
      {/* App update button */}
      {hasAppUpdate ? (
        <div className="settings-update-item">
          <div className="settings-update-badge">
            <span className="settings-update-badge__dot" />
            {t("settings_appUpdateAvailable")} — <strong>v{pendingAppUpdate!.version}</strong>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={onTriggerAppUpdate}
          >
            {t("settings_updateAppBtn")}
          </button>
        </div>
      ) : (
        /* yt-dlp update button — shown when only yt-dlp has an update */
        hasYtDlpUpdate ? (
          <div className="settings-update-item">
            <div className="settings-update-badge">
              <span className="settings-update-badge__dot" />
              {t("settings_ytdlpUpdateAvailable")} — <strong>{pendingYtDlpUpdate!.latest_version}</strong>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={onTriggerYtDlpUpdate}
            >
              {t("settings_updateYtdlpBtn")}
            </button>
          </div>
        ) : (
          /* Idle: no pending updates. The button's label is always
             static — the in-progress/result state is shown as a
             separate status badge to its left (same pattern as the
             pending-update rows above), so the button itself never
             swaps content and can't glitch on re-layout. */
          <div className="settings-update-item settings-update-item--idle">
            {checking ? (
              <div className="settings-update-badge">
                <div className="spinner spinner-small" />
                {t("settings_checking")}
              </div>
            ) : checkedOnce && checkError ? (
              <span className="settings-update-error">{t("settings_checkFailed")}</span>
            ) : checkedOnce && !hasAnyUpdate ? (
              <span className="settings-update-uptodate">{t("settings_upToDate")}</span>
            ) : null}
            <button
              className="btn btn-secondary btn-sm settings-update-check-btn"
              onClick={handleCheckUpdates}
              disabled={checking}
            >
              {t("settings_checkForUpdates")}
            </button>
          </div>
        )
      )}

      {/* Also show yt-dlp button when both updates are pending */}
      {hasAppUpdate && hasYtDlpUpdate && (
        <div className="settings-update-item">
          <div className="settings-update-badge">
            <span className="settings-update-badge__dot" />
            {t("settings_ytdlpUpdateAvailable")} — <strong>{pendingYtDlpUpdate!.latest_version}</strong>
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={onTriggerYtDlpUpdate}
          >
            {t("settings_updateYtdlpBtn")}
          </button>
        </div>
      )}
    </div>
  );
};
