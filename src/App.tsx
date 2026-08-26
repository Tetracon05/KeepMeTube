import { useEffect, useState } from "react";
import { useTheme } from "./hooks/useTheme";
import { useDownloadStore } from "./store/useDownloadStore";
import { LanguageSelect } from "./components/LanguageSelect";
import { TopBar } from "./components/TopBar";
import { DownloadList } from "./components/DownloadList";
import { AddDownloadModal } from "./components/AddDownloadModal";
import { RenameDialog } from "./components/RenameDialog";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { SettingsPanel } from "./components/SettingsPanel";
import { UpdateDialog } from "./components/UpdateDialog";
import { AppUpdateDialog } from "./components/AppUpdateDialog";
import { getSavedLanguage, initLanguage } from "./lib/i18n";
import * as api from "./lib/tauri";
import type { UpdateCheckResult, AppUpdateInfo } from "./types";

// Initialize language from localStorage before first render
initLanguage();

function App() {
  const { mode, setMode } = useTheme();
  const { loadDownloads, initEventListeners } = useDownloadStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Language selection: show if no language saved yet
  const [languageSelected, setLanguageSelected] = useState<boolean>(() => {
    return getSavedLanguage() !== null;
  });

  // ── Step 1: App self-update check ─────────────────────────────────────────
  const [appUpdateChecked, setAppUpdateChecked] = useState(false);
  const [pendingAppUpdate, setPendingAppUpdate] = useState<AppUpdateInfo | null>(null);

  useEffect(() => {
    if (!languageSelected || appUpdateChecked) return;

    api.checkAppUpdate()
      .then((info) => {
        if (info) {
          setPendingAppUpdate(info);
        } else {
          setAppUpdateChecked(true);
        }
      })
      .catch(() => {
        // Network error or updater not configured — skip silently
        setAppUpdateChecked(true);
      });
  }, [languageSelected]);

  // ── Step 2: yt-dlp update check ───────────────────────────────────────────
  const [ytDlpUpdateChecked, setYtDlpUpdateChecked] = useState(false);
  const [pendingYtDlpUpdate, setPendingYtDlpUpdate] = useState<UpdateCheckResult | null>(null);

  useEffect(() => {
    if (!appUpdateChecked || ytDlpUpdateChecked) return;

    api.checkYtDlpUpdate()
      .then((result) => {
        if (result.update_available) {
          setPendingYtDlpUpdate(result);
        } else {
          setYtDlpUpdateChecked(true);
        }
      })
      .catch(() => {
        setYtDlpUpdateChecked(true);
      });
  }, [appUpdateChecked]);

  // ── Step 3: Load downloads once both checks are done ──────────────────────
  useEffect(() => {
    if (appUpdateChecked && ytDlpUpdateChecked) {
      loadDownloads();
      let unlisten: (() => void) | undefined;
      initEventListeners().then((fn) => { unlisten = fn; });
      return () => { unlisten?.(); };
    }
  }, [appUpdateChecked, ytDlpUpdateChecked]);

  // ── Render: step-by-step gates ────────────────────────────────────────────

  // Step 0: Language selection (first launch only)
  if (!languageSelected) {
    return <LanguageSelect onSelect={() => setLanguageSelected(true)} />;
  }

  // Step 1a: App update dialog
  if (!appUpdateChecked) {
    if (pendingAppUpdate) {
      return (
        <AppUpdateDialog
          updateInfo={pendingAppUpdate}
          onSkip={() => {
            setPendingAppUpdate(null);
            setAppUpdateChecked(true);
          }}
        />
      );
    }
    // Still checking — render nothing (instant network call)
    return null;
  }

  // Step 2a: yt-dlp update dialog
  if (!ytDlpUpdateChecked) {
    if (pendingYtDlpUpdate) {
      return (
        <UpdateDialog
          updateInfo={pendingYtDlpUpdate}
          onDone={() => {
            setPendingYtDlpUpdate(null);
            setYtDlpUpdateChecked(true);
          }}
        />
      );
    }
    return null;
  }

  // Step 3: Main app
  return (
    <div className="app-container">
      <TopBar onOpenSettings={() => setSettingsOpen(true)} />
      <DownloadList />
      <AddDownloadModal />
      <RenameDialog />
      <ConfirmDialog />
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        themeMode={mode}
        onSetTheme={setMode}
      />
    </div>
  );
}

export default App;