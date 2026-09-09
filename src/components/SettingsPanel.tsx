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
  IconFolderOpen,
  IconDownload,
  IconFile,
} from "./Icons";
import { UpdateCheckControls } from "./UpdateCheckControls";
import { DEFAULT_DOWNLOAD_DIR_KEY, FILENAME_TEMPLATE_KEY, DEFAULT_FILENAME_TEMPLATE } from "../lib/utils";

const GITHUB_REPO_URL = "https://github.com/Tetracon05/KeepMeTube";

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

  // Empty string means "use the OS default" — `systemDefaultDir` (fetched
  // once, below) is what's actually shown/used until the user picks one.
  const [downloadDir, setDownloadDir] = useState<string>(
    () => localStorage.getItem(DEFAULT_DOWNLOAD_DIR_KEY) || ""
  );
  const [systemDefaultDir, setSystemDefaultDir] = useState("");
  useEffect(() => {
    api.getDefaultDownloadDir().then(setSystemDefaultDir).catch((e) => console.error("Failed to get default download dir:", e));
  }, []);
  const effectiveDownloadDir = downloadDir || systemDefaultDir;

  const [maxConcurrent, setMaxConcurrentState] = useState(3);
  useEffect(() => {
    api.getMaxConcurrent().then(setMaxConcurrentState).catch((e) => console.error("Failed to get concurrency limit:", e));
  }, []);

  const [filenameTemplate, setFilenameTemplate] = useState<string>(
    () => localStorage.getItem(FILENAME_TEMPLATE_KEY) || ""
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

  const handleSelectDownloadDir = async () => {
    try {
      const sel = await open({ directory: true, defaultPath: effectiveDownloadDir || undefined });
      if (sel && typeof sel === "string") {
        setDownloadDir(sel);
        localStorage.setItem(DEFAULT_DOWNLOAD_DIR_KEY, sel);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetDownloadDir = () => {
    setDownloadDir("");
    localStorage.removeItem(DEFAULT_DOWNLOAD_DIR_KEY);
  };

  const handleMaxConcurrentChange = async (value: number) => {
    setMaxConcurrentState(value);
    try {
      await api.setMaxConcurrent(value);
    } catch (e) {
      console.error("Failed to set concurrency limit:", e);
    }
  };

  const handleFilenameTemplateChange = (value: string) => {
    setFilenameTemplate(value);
    if (value.trim()) {
      localStorage.setItem(FILENAME_TEMPLATE_KEY, value);
    } else {
      localStorage.removeItem(FILENAME_TEMPLATE_KEY);
    }
  };

  const handleResetFilenameTemplate = () => {
    setFilenameTemplate("");
    localStorage.removeItem(FILENAME_TEMPLATE_KEY);
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

          {/* ── Section: Default Download Location ─── */}
          <section className="settings-section">
            <h3 className="settings-section__title"><IconFolderOpen size={16} /> {t("settings_downloadDir")}</h3>
            <p className="settings-section__desc">{t("settings_downloadDirDesc")}</p>

            <div className="settings-cookies-row">
              <div className="settings-cookies-file">
                <span className="settings-cookies-icon"><IconFolderOpen size={14} /></span>
                <span className="settings-cookies-name" title={effectiveDownloadDir}>
                  {effectiveDownloadDir || "—"}
                </span>
              </div>
              <div className="settings-cookies-actions">
                <button className="btn btn-secondary btn-sm" onClick={handleSelectDownloadDir}>
                  {t("settings_selectDownloadDir")}
                </button>
                {downloadDir && (
                  <button className="btn btn-danger-ghost btn-sm" onClick={handleResetDownloadDir}>
                    {t("settings_resetDownloadDir")}
                  </button>
                )}
              </div>
            </div>
          </section>

          <div className="settings-divider" />

          {/* ── Section: Filename Template ─────────── */}
          <section className="settings-section">
            <h3 className="settings-section__title"><IconFile size={16} /> {t("settings_filenameTemplate")}</h3>
            <p className="settings-section__desc">{t("settings_filenameTemplateDesc")}</p>

            <div className="settings-cookies-row">
              <input
                type="text"
                className="form-input"
                placeholder={DEFAULT_FILENAME_TEMPLATE}
                value={filenameTemplate}
                onChange={(e) => handleFilenameTemplateChange(e.target.value)}
              />
              {filenameTemplate && (
                <button className="btn btn-danger-ghost btn-sm" onClick={handleResetFilenameTemplate}>
                  {t("settings_resetDownloadDir")}
                </button>
              )}
            </div>
          </section>

          <div className="settings-divider" />

          {/* ── Section: Concurrent Downloads ──────── */}
          <section className="settings-section">
            <h3 className="settings-section__title"><IconDownload size={16} /> {t("settings_concurrency")}</h3>
            <p className="settings-section__desc">{t("settings_concurrencyDesc")}</p>

            <select
              className="form-select settings-concurrency-select"
              value={maxConcurrent}
              onChange={(e) => handleMaxConcurrentChange(Number(e.target.value))}
            >
              {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </section>

          <div className="settings-divider" />

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
