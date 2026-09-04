import { useEffect, useState } from "react";
import { useTheme } from "./hooks/useTheme";
import { useDownloadStore } from "./store/useDownloadStore";
import { useMacMenuEvents } from "./hooks/useMacMenuEvents";
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
import { AboutDialog } from "./components/AboutDialog";
import { CheckForUpdatesDialog } from "./components/CheckForUpdatesDialog";
import { getSavedLanguage, initLanguage } from "./lib/i18n";
import * as api from "./lib/tauri";
import type { UpdateCheckResult, AppUpdateInfo } from "./types";

// Initialize language from localStorage before first render
initLanguage();

function App() {
  const { mode, setMode } = useTheme();
  // Individual selectors, not a bare `useDownloadStore()`: these two are
  // stable action references, so selecting them precisely means this
  // top-of-tree component never re-renders for store changes (including
  // every download-progress tick) — a bare call would re-render on all of
  // them and cascade through the whole app, since nothing below is memoized
  // against App re-rendering except DownloadRow.
  const loadDownloads = useDownloadStore((s) => s.loadDownloads);
  const initEventListeners = useDownloadStore((s) => s.initEventListeners);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [aboutDialogOpen, setAboutDialogOpen] = useState(false);
  const [checkUpdatesDialogOpen, setCheckUpdatesDialogOpen] = useState(false);

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

  // Re-runs both update checks and reports back which ones failed, so callers
  // can surface a real error state instead of silently treating a failed
  // check the same as "no update available".
  const runUpdateChecks = async (): Promise<{ appError: boolean; ytError: boolean }> => {
    const [appResult, ytResult] = await Promise.allSettled([
      api.checkAppUpdate(),
      api.checkYtDlpUpdate(),
    ]);

    if (appResult.status === "fulfilled" && appResult.value) {
      setPendingAppUpdate(appResult.value);
    } else if (appResult.status === "rejected") {
      console.error("App update check failed:", appResult.reason);
    }

    if (ytResult.status === "fulfilled" && ytResult.value?.update_available) {
      setPendingYtDlpUpdate(ytResult.value);
    } else if (ytResult.status === "rejected") {
      console.error("yt-dlp update check failed:", ytResult.reason);
    }

    return {
      appError: appResult.status === "rejected",
      ytError: ytResult.status === "rejected",
    };
  };

  // ── Fire both update checks once in the background on launch ─────────────
  useEffect(() => {
    if (!languageSelected) return;
    runUpdateChecks();
  }, [languageSelected]);

  const triggerAppUpdate = () => {
    setSettingsOpen(false);
    setCheckUpdatesDialogOpen(false);
    setAppUpdateModalOpen(true);
  };

  const triggerYtDlpUpdate = () => {
    setSettingsOpen(false);
    setCheckUpdatesDialogOpen(false);
    setYtDlpUpdateModalOpen(true);
  };

  // Native macOS app/File menu bridge — a no-op on Windows/Linux, where the
  // Rust side never builds a custom menu or emits these events.
  useMacMenuEvents({
    onAbout: () => setAboutDialogOpen(true),
    onSettings: () => setSettingsOpen(true),
    onCheckUpdates: () => setCheckUpdatesDialogOpen(true),
  });

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
        onTriggerAppUpdate={triggerAppUpdate}
        onTriggerYtDlpUpdate={triggerYtDlpUpdate}
        onCheckUpdates={runUpdateChecks}
      />

      {/* macOS app menu: About */}
      {aboutDialogOpen && (
        <AboutDialog onClose={() => setAboutDialogOpen(false)} />
      )}

      {/* macOS app menu: Check for Updates */}
      {checkUpdatesDialogOpen && (
        <CheckForUpdatesDialog
          onClose={() => setCheckUpdatesDialogOpen(false)}
          pendingAppUpdate={pendingAppUpdate}
          pendingYtDlpUpdate={pendingYtDlpUpdate}
          onTriggerAppUpdate={triggerAppUpdate}
          onTriggerYtDlpUpdate={triggerYtDlpUpdate}
          onCheckUpdates={runUpdateChecks}
        />
      )}

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
