import React, { useEffect, useState } from "react";
import * as api from "../lib/tauri";
import { useLanguage } from "../hooks/useLanguage";
import { renderMarkdown } from "../lib/markdown";
import type { AppUpdateInfo } from "../types";

interface AppUpdateDialogProps {
  updateInfo: AppUpdateInfo;
  onSkip: () => void;
}

export const AppUpdateDialog: React.FC<AppUpdateDialogProps> = ({
  updateInfo,
  onSkip,
}) => {
  const { t } = useLanguage();
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState("");

  useEffect(() => {
    api.getAppVersion().then(setCurrentVersion).catch((e) => console.error("Failed to get app version:", e));
  }, []);

  const handleInstall = async () => {
    setInstalling(true);
    setError(null);
    try {
      await api.installAppUpdate();
      // App will restart automatically after this — no further UI needed.
    } catch (err) {
      setError(String(err));
      setInstalling(false);
    }
  };

  return (
    <div className="update-dialog-overlay">
      <div className="update-dialog">
        {/* Icon */}
        <div className="update-dialog__icon">🚀</div>

        <h2 className="update-dialog__title">{t("appUpdate_title")}</h2>
        <p className="update-dialog__desc">{t("appUpdate_desc")}</p>

        {/* Version comparison */}
        <div className="update-version-box">
          <div className="update-version-row">
            <span className="update-version-label">{t("update_current")}</span>
            <span className="update-version-value update-version-value--old">
              {currentVersion && `v${currentVersion}`}
            </span>
          </div>
          <div className="update-version-arrow">↓</div>
          <div className="update-version-row">
            <span className="update-version-label">{t("update_latest")}</span>
            <span className="update-version-value update-version-value--new">
              v{updateInfo.version}
            </span>
          </div>
        </div>

        {/* Release notes */}
        {updateInfo.notes && (
          <div className="update-notes">
            {renderMarkdown(updateInfo.notes)}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="update-result update-result--error">
            <span>✗ {error}</span>
          </div>
        )}

        {/* Installing indicator */}
        {installing && (
          <div className="update-result update-result--success">
            <div className="spinner spinner-small" />
            <span style={{ marginLeft: "0.5rem" }}>{t("appUpdate_installing")}</span>
          </div>
        )}

        {/* Actions */}
        {!installing && (
          <div className="update-dialog__actions">
            <button
              className="btn btn-secondary"
              onClick={onSkip}
              disabled={installing}
            >
              {t("update_skip")}
            </button>
            <button
              className="btn btn-primary"
              onClick={handleInstall}
              disabled={installing}
            >
              {t("appUpdate_installAndRestart")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
