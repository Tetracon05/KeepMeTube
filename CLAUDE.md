# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A Tauri v2 desktop app (macOS/Windows/Linux) wrapping `yt-dlp` and `ffmpeg` to download video/audio from YouTube and ~1800 other sites. React 19 + TypeScript frontend, Rust backend. No external i18n/state libraries beyond Zustand — everything else (i18n, design tokens) is hand-rolled in this repo.

## Commands

```bash
npm install               # install JS deps
npm run tauri dev         # full app: Vite dev server + Rust backend, hot-reloads both
npm run dev                # frontend only via Vite, no Tauri backend — invoke() calls will
                            # reject since there's no Rust side to answer them; useful only
                            # for pure CSS/layout iteration (see "Frontend-only preview" below)
npm run build              # tsc typecheck + vite build (frontend only, no bundle)
npm run tauri build         # full production build: signed installers for the host platform
cd src-tauri && cargo check # Rust typecheck without a full build
```

There are no lint scripts, no test scripts, and no test files (`#[test]` or `*.test.ts`) anywhere in this repo — `tsc` and `cargo check`/`cargo build` are the only correctness gates before `code-review`.

**Sidecar binaries**: `tauri build`/`tauri dev` expect `yt-dlp`/`ffmpeg` at `src-tauri/binaries/<name>-<target-triple>[.exe]`. Fetch them with `scripts/download-binaries.sh [target-triple]` (auto-detects the host if the arg is omitted). CI runs this on every platform in the release matrix; a fresh local checkout needs it once before the first `tauri build`.

**Frontend-only preview**: `npm run dev` opens the UI in a normal browser tab. Every `api.*` call in `src/lib/tauri.ts` will reject (no Tauri runtime), so the download list stays empty and dialogs that depend on backend data (dependency check, update checks) won't populate — but it's sufficient to verify layout, theming, and the two `.dark`/light CSS states. To see real rows without the backend, seed `useDownloadStore.getState().setDownloads([...])` from the browser console.

## Architecture

### IPC boundary
`src/lib/tauri.ts` is the *only* place that calls `invoke()` — every Rust command has exactly one typed wrapper there, and no component calls `invoke` directly. When adding a backend capability: write the handler in `src-tauri/src/commands/<module>.rs`, re-export it from `commands/mod.rs`, register it in the `tauri::generate_handler![...]` list in `src-tauri/src/lib.rs`, then add its typed wrapper to `lib.rs` (frontend). Progress-style updates flow the other way as events (`app.emit(...)` in Rust → `listen()` in `useDownloadStore.initEventListeners`), currently just `"download-progress"`.

### Rust backend (`src-tauri/src`)
- `state.rs` defines `AppState`, a single Tauri-managed struct: `downloads` (the in-memory list, mirrored to disk), `active_processes` (child handles keyed by download id, for cancellation), `analyze_process` (the one in-flight analysis PID, for abort), and the resolved `yt_dlp_path`/`ffmpeg_path`.
- `store.rs` persists `downloads` as `downloads.json` in the OS app-data dir — no database.
- `binary_resolver.rs` locates the bundled yt-dlp/ffmpeg sidecars, trying resource dir → exe dir → dev `src-tauri/binaries` → system `PATH`, and never panics if none are found (falls back to the bare command name so `Command::new` at least attempts it).
- `commands/` is one module per concern: `analyze` (yt-dlp `-J` probe + abort), `download` (start/cancel/list, spawns yt-dlp as a child process and streams its stdout for progress), `dependency` (detect/update yt-dlp & ffmpeg versions), `file_ops` (delete/remove/rename/show-in-folder/OS drag-out), `app_update` (Tauri self-updater).
- `menu.rs` is macOS-only (`#[cfg(target_os = "macos")]` in `lib.rs`) and builds the native app/File/Edit menu bar. Menu clicks carry no app context, so each item just emits a `menu-*` window event; the frontend's `useMacMenuEvents` hook listens for these and routes them through the exact same `useDownloadActions` handlers the on-screen toolbar uses, so the two surfaces can't drift.

### Where "what to download" logic lives
The yt-dlp format-selection logic (resolution/fps/container → `-f <selector>` string, `--cookies <path>`, `--merge-output-format`, etc.) is built entirely in `AddDownloadModal.tsx` and passed to `start_download` as a plain `format_args: Vec<String>`. The Rust side does not interpret or validate these args — it just appends them to the `Command` invocation. If a download picks the wrong quality/format, look in the frontend first, not in `download.rs`.

### Frontend state
`useDownloadStore` (Zustand) holds the downloads list plus UI-only state (selection, active modal ids, sort). The backend is the source of truth: the store hydrates once via `getDownloads()` on launch and then only ever patches individual entries in place via the `download-progress` event — it never re-fetches the full list afterward.

### i18n (`src/lib/i18n.ts`)
No library. `LANGUAGES` lists the 10 supported locales (`en tr es fr de pt ar ja ko zh`, with `ar` flagged `rtl: true`). Translation strings are ten flat objects (`en`, `tr`, ...), each typed as `Translations = typeof en` — **`en` is the shape source of truth**, so adding a UI string means adding the key to `en` first, then to the other nine; `tsc`/`cargo`-style strictness means a missing key in any language object is a compile error, not a silent runtime fallback (there's also a runtime fallback to `en` then to the raw key in `t()`, but the type system should catch omissions before that ever matters). Current language persists to `localStorage["app-language"]`; `setLanguage()` also flips `<html dir>` for RTL.

### Design system (`src/index.css`)
A from-scratch token system (custom properties in `:root`/`.dark`) — monochrome black/white/gray surfaces with three status hues reserved for meaning only: moss (done), rust (failed), sky (connecting). Typefaces are self-hosted (not Google-CDN-linked) in `public/fonts` + `src/fonts.css`: Space Grotesk for display/UI, IBM Plex Sans for body copy, IBM Plex Mono for every numeric readout (percent, speed, size, date, version). Don't reintroduce the old Inter/indigo-gradient look this replaced.

### Versioning & release
Version is duplicated in three places that must move together: `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`. Releases are cut by pushing a `v*` tag, which triggers `.github/workflows/build.yml`: a 4-way matrix (macOS arm64, macOS x64, Windows, Linux) that must run with `max-parallel: 1` — `tauri-action` read-modify-writes the shared release's `latest.json` (merging in each platform's updater signature), so parallel jobs race and silently clobber each other's entry. `prerelease` must stay `false`: the in-app updater's endpoint (`releases/latest/download/latest.json`) only resolves to the newest non-prerelease release.
