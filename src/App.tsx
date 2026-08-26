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
import { UpdateBanner } from "./components/UpdateBanner";
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

  // ── Update state (populated asynchronously, never blocks UI) ──────────────
  const [pendingAppUpdate, setPendingAppUpdate] = useState<AppUpdateInfo | null>(null);
  const [pendingYtDlpUpdate, setPendingYtDlpUpdate] = useState<UpdateCheckResult | null>(null);

  // Modals for update flows (opened from banner / settings button)
  const [appUpdateModalOpen, setAppUpdateModalOpen] = useState(false);
  const [ytDlpUpdateModalOpen, setYtDlpUpdateModalOpen] = useState(false);

  // ── Load downloads immediately once language is confirmed ─────────────────
  useEffect(() => {
    if (!languageSelected) return;
    loadDownloads();
    let unlisten: (() => void) | undefined;
    initEventListeners().then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, [languageSelected]);

  // ── Fire both update checks concurrently in the background ───────────────
  useEffect(() => {
    if (!languageSelected) return;

    Promise.allSettled([
      api.checkAppUpdate(),
      api.checkYtDlpUpdate(),
    ]).then(([appResult, ytResult]) => {
      if (appResult.status === "fulfilled" && appResult.value) {
        setPendingAppUpdate(appResult.value);
      }
      if (ytResult.status === "fulfilled" && ytResult.value?.update_available) {
        setPendingYtDlpUpdate(ytResult.value);
      }
    });
  }, [languageSelected]);

  // Helper to re-run update checks on demand (used by SettingsPanel)
  const runUpdateChecks = () => {
    Promise.allSettled([
      api.checkAppUpdate(),
      api.checkYtDlpUpdate(),
    ]).then(([appResult, ytResult]) => {
      if (appResult.status === "fulfilled" && appResult.value) {
        setPendingAppUpdate(appResult.value);
      }
      if (ytResult.status === "fulfilled" && ytResult.value?.update_available) {
        setPendingYtDlpUpdate(ytResult.value);
      }
    });
  };

  // ── Render ────────────────────────────────────────────────────────────────

  // Language selection (first launch only) — only gate in the entire app
  if (!languageSelected) {
    return <LanguageSelect onSelect={() => setLanguageSelected(true)} />;
  }

  // Main UI renders immediately; update dialogs/banner are overlays
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
        pendingAppUpdate={pendingAppUpdate}
        pendingYtDlpUpdate={pendingYtDlpUpdate}
        onTriggerAppUpdate={() => {
          setSettingsOpen(false);
          setAppUpdateModalOpen(true);
        }}
        onTriggerYtDlpUpdate={() => {
          setSettingsOpen(false);
          setYtDlpUpdateModalOpen(true);
        }}
        onCheckUpdates={runUpdateChecks}
      />

      {/* App self-update modal */}
      {appUpdateModalOpen && pendingAppUpdate && (
        <AppUpdateDialog
          updateInfo={pendingAppUpdate}
          onSkip={() => {
            setPendingAppUpdate(null);
            setAppUpdateModalOpen(false);
          }}
        />
      )}

      {/* yt-dlp update modal */}
      {ytDlpUpdateModalOpen && pendingYtDlpUpdate && (
        <UpdateDialog
          updateInfo={pendingYtDlpUpdate}
          onDone={() => {
            setPendingYtDlpUpdate(null);
            setYtDlpUpdateModalOpen(false);
          }}
        />
      )}

      {/* Non-intrusive bottom banner — hidden while a modal is open */}
      {(pendingAppUpdate || pendingYtDlpUpdate) &&
        !appUpdateModalOpen &&
        !ytDlpUpdateModalOpen && (
          <UpdateBanner
            pendingAppUpdate={pendingAppUpdate}
            pendingYtDlpUpdate={pendingYtDlpUpdate}
            onDismissAppUpdate={() => setPendingAppUpdate(null)}
            onDismissYtDlpUpdate={() => setPendingYtDlpUpdate(null)}
          />
        )}
    </div>
  );
}

export default App;
