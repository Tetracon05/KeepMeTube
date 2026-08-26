import React, { useState } from "react";
import * as api from "../lib/tauri";
import { useLanguage } from "../hooks/useLanguage";
import type { AppUpdateInfo, UpdateCheckResult } from "../types";

interface UpdateBannerProps {
  pendingAppUpdate: AppUpdateInfo | null;
  pendingYtDlpUpdate: UpdateCheckResult | null;
  onDismissAppUpdate: () => void;
  onDismissYtDlpUpdate: () => void;
}

export const UpdateBanner: React.FC<UpdateBannerProps> = ({
  pendingAppUpdate,
  pendingYtDlpUpdate,
  onDismissAppUpdate,
  onDismissYtDlpUpdate,
}) => {
  const { t } = useLanguage();

  // App update install state
  const [appInstalling, setAppInstalling] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);

  // yt-dlp update state
  const [ytUpdating, setYtUpdating] = useState(false);
  const [ytDone, setYtDone] = useState(false);

  const handleInstallApp = async () => {
    setAppInstalling(true);
    setAppError(null);
    try {
      await api.installAppUpdate();
      // App restarts automatically — no UI cleanup needed.
    } catch (err) {
      setAppError(String(err));
      setAppInstalling(false);
    }
  };

  const handleUpdateYtDlp = async () => {
    setYtUpdating(true);
    try {
      await api.updateYtDlp();
      setYtDone(true);
      setTimeout(onDismissYtDlpUpdate, 1800);
    } catch {
      // silently dismiss on error — user can retry from Settings
      onDismissYtDlpUpdate();
    } finally {
      setYtUpdating(false);
    }
  };

  const hasAny = pendingAppUpdate || pendingYtDlpUpdate;
  if (!hasAny) return null;

  return (
    <div className="update-banner" role="status" aria-live="polite">
      {/* App self-update notification */}
      {pendingAppUpdate && (
        <div className="update-banner__item update-banner__item--app">
          <span className="update-banner__icon">🚀</span>
          <span className="update-banner__text">
            {t("appUpdate_title")}&nbsp;
            <strong>v{pendingAppUpdate.version}</strong>
            {" is available"}
          </span>
          <div className="update-banner__actions">
            {appError && (
              <span className="update-banner__error" title={appError}>⚠</span>
            )}
            <button
              className="btn btn-primary btn-sm"
              onClick={handleInstallApp}
              disabled={appInstalling}
            >
              {appInstalling ? (
                <><div className="spinner spinner-small" />&nbsp;{t("appUpdate_installing")}</>
              ) : (
                t("appUpdate_installAndRestart")
              )}
            </button>
            {!appInstalling && (
              <button
                className="update-banner__dismiss"
                onClick={onDismissAppUpdate}
                aria-label="Dismiss app update"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}

      {/* yt-dlp update notification */}
      {pendingYtDlpUpdate && (
        <div className="update-banner__item update-banner__item--ytdlp">
          <span className="update-banner__icon">⬆️</span>
          <span className="update-banner__text">
            {t("update_title")}&nbsp;
            <strong>{pendingYtDlpUpdate.latest_version}</strong>
            {" is available"}
          </span>
          <div className="update-banner__actions">
            {ytDone ? (
              <span className="update-banner__done">✓ {t("update_success")}</span>
            ) : (
              <button
                className="btn btn-primary btn-sm"
                onClick={handleUpdateYtDlp}
                disabled={ytUpdating}
              >
                {ytUpdating ? (
                  <><div className="spinner spinner-small" />&nbsp;{t("update_updating")}</>
                ) : (
                  t("update_now")
                )}
              </button>
            )}
            {!ytUpdating && !ytDone && (
              <button
                className="update-banner__dismiss"
                onClick={onDismissYtDlpUpdate}
                aria-label="Dismiss yt-dlp update"
              >
                ✕
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
