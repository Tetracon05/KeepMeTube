import React, { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import * as api from "../lib/tauri";
import { IconInfo } from "./Icons";

const GITHUB_REPO_URL = "https://github.com/Tetracon05/YT-Downloader";

interface AboutDialogProps {
  onClose: () => void;
}

/** Opened from the macOS app menu's "About YT Downloader" item. */
export const AboutDialog: React.FC<AboutDialogProps> = ({ onClose }) => {
  const { t } = useLanguage();
  const [appVersion, setAppVersion] = useState("");

  useEffect(() => {
    api.getAppVersion().then(setAppVersion).catch((e) => console.error("Failed to get app version:", e));
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t("settings_about")}</h2>
          <button className="modal-close" onClick={onClose}>X</button>
        </div>

        <div className="modal-body">
          <div className="confirm-icon-wrapper confirm-icon-wrapper--neutral">
            <IconInfo size={28} className="confirm-icon" />
          </div>
          <p className="confirm-message">
            YT Downloader {appVersion && `v${appVersion}`}
            <br />
            {t("settings_aboutCreatedBy")}
          </p>
          <a
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noreferrer"
            className="settings-link"
          >
            {t("settings_aboutRepo")} ↗
          </a>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            {t("common_close")}
          </button>
        </div>
      </div>
    </div>
  );
};
