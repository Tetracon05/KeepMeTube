import React, { useEffect, useState } from "react";
import { open } from "@tauri-apps/plugin-dialog";
import { useLanguage } from "../hooks/useLanguage";
import { LANGUAGES, LangCode, setLanguage } from "../lib/i18n";
import * as api from "../lib/tauri";
import type { AppUpdateInfo, UpdateCheckResult } from "../types";
import {
  IconShield,
  IconPalette,
  IconGlobe,
  IconInfo,
  IconSun,
  IconMonitor,
  IconMoon,
  IconCheckCircle,
} from "./Icons";
import { UpdateCheckControls } from "./UpdateCheckControls";

const GITHUB_REPO_URL = "https://github.com/Tetracon05/YT-Downloader";

type ThemeMode = "system" | "light" | "dark";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  themeMode: ThemeMode;
  onSetTheme: (mode: ThemeMode) => void;
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
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({
  isOpen,
  onClose,
  themeMode,
  onSetTheme,
  pendingAppUpdate,
  pendingYtDlpUpdate,
  onTriggerAppUpdate,
  onTriggerYtDlpUpdate,
  onCheckUpdates,
}) => {
  const { t, lang } = useLanguage();

  const [cookiesFile, setCookiesFile] = useState<string>(
    () => localStorage.getItem("yt-cookies-file") || ""
  );

  const [appVersion, setAppVersion] = useState("");
  useEffect(() => {
    api.getAppVersion().then(setAppVersion).catch((e) => console.error("Failed to get app version:", e));
  }, []);

  const cookiesFileName = cookiesFile
    ? cookiesFile.split(/[/\\]/).pop() || cookiesFile
    : "";

  const handleSelectCookies = async () => {
    try {
      const sel = await open({
        multiple: false,
        filters: [
          { name: "Cookies", extensions: ["txt"] },
          { name: "All files", extensions: ["*"] },
        ],
        title: "Select cookies.txt exported from your browser",
      });
      if (sel && typeof sel === "string") {
        setCookiesFile(sel);
        localStorage.setItem("yt-cookies-file", sel);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClearCookies = () => {
    setCookiesFile("");
    localStorage.removeItem("yt-cookies-file");
  };

  const handleLanguageChange = (code: LangCode) => {
    setLanguage(code);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="settings-backdrop" onClick={onClose} />

      {/* Drawer */}
      <div className="settings-drawer">
        <div className="settings-drawer__header">
          <h2 className="settings-drawer__title">{t("settings_title")}</h2>
          <button className="settings-drawer__close" onClick={onClose}>✕</button>
        </div>

        <div className="settings-drawer__body">

          {/* ── Section: Cookies ──────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section__title"><IconShield size={16} /> {t("settings_cookies")}</h3>
            <p className="settings-section__desc">{t("settings_cookiesDesc")}</p>

            <div className="settings-cookies-row">
              {cookiesFile ? (
                <>
                  <div className="settings-cookies-file">
                    <span className="settings-cookies-icon"><IconCheckCircle size={14} /></span>
                    <span className="settings-cookies-name" title={cookiesFile}>
                      {cookiesFileName}
                    </span>
                  </div>
                  <div className="settings-cookies-actions">
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleSelectCookies}
                    >
                      {t("settings_changeCookies")}
                    </button>
                    <button
                      className="btn btn-danger-ghost btn-sm"
                      onClick={handleClearCookies}
                    >
                      {t("settings_clearCookies")}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <span className="settings-cookies-empty">
                    {t("settings_noCookies")}
                  </span>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={handleSelectCookies}
                  >
                    {t("settings_selectCookies")}
                  </button>
                </>
              )}
            </div>

            <a
              href="https://github.com/yt-dlp/yt-dlp/wiki/FAQ#how-do-i-pass-cookies-to-yt-dlp"
              target="_blank"
              rel="noreferrer"
              className="settings-link"
            >
              {t("settings_howToCookies")} ↗
            </a>
          </section>

          <div className="settings-divider" />

          {/* ── Section: Appearance ──────────────── */}
          <section className="settings-section">
            <h3 className="settings-section__title"><IconPalette size={16} /> {t("settings_appearance")}</h3>

            <div className="theme-selector">
              {(["light", "system", "dark"] as ThemeMode[]).map((m) => {
                const icons = { light: IconSun, system: IconMonitor, dark: IconMoon };
                const ThemeIcon = icons[m];
                const labels: Record<ThemeMode, string> = {
                  light: t("settings_themeLight"),
                  dark: t("settings_themeDark"),
                  system: t("settings_themeSystem"),
                };
                return (
                  <button
                    key={m}
                    className={`theme-option ${themeMode === m ? "theme-option--active" : ""}`}
                    onClick={() => onSetTheme(m)}
                  >
                    <span className="theme-option__icon"><ThemeIcon size={18} /></span>
                    <span className="theme-option__label">{labels[m]}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="settings-divider" />

          {/* ── Section: Language ─────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section__title"><IconGlobe size={16} /> {t("settings_language")}</h3>

            <div className="lang-selector-grid">
              {LANGUAGES.map((language) => (
                <button
                  key={language.code}
                  className={`lang-selector-item ${lang === language.code ? "lang-selector-item--active" : ""}`}
                  onClick={() => handleLanguageChange(language.code)}
                >
                  <span className="lang-selector-item__flag">{language.flag}</span>
                  <span className="lang-selector-item__name">{language.name}</span>
                </button>
              ))}
            </div>
          </section>

          <div className="settings-divider" />

          {/* ── Section: About ────────────────────── */}
          <section className="settings-section">
            <h3 className="settings-section__title"><IconInfo size={16} /> {t("settings_about")}</h3>

            <div className="settings-about-info">
              <span className="settings-about-version">
                {t("settings_aboutVersion")} {appVersion && `v${appVersion}`}
              </span>
              <span className="settings-about-author">{t("settings_aboutCreatedBy")}</span>
            </div>

            <a
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="settings-link"
            >
              {t("settings_aboutRepo")} ↗
            </a>

            <UpdateCheckControls
              pendingAppUpdate={pendingAppUpdate}
              pendingYtDlpUpdate={pendingYtDlpUpdate}
              onTriggerAppUpdate={onTriggerAppUpdate}
              onTriggerYtDlpUpdate={onTriggerYtDlpUpdate}
              onCheckUpdates={onCheckUpdates}
            />
          </section>

        </div>
      </div>
    </>
  );
};
