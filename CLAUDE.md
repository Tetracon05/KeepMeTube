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
- `state.rs` defines `AppState`, a single Tauri-managed struct: `downloads` (the in-memory list, mirrored to disk), `active_processes` (child handles keyed by download id, for cancellation), `analyze_process` (the one in-flight analysis PID, for abort), `max_concurrent` (`Arc<AtomicUsize>` — user-configurable via Settings, so it's mutable at runtime rather than a plain field), and the resolved `yt_dlp_path`/`ffmpeg_path`. `DownloadStatus::Paused` still exists in the enum but nothing produces it anymore (Pause/Resume was removed — see below); it's kept only so a `downloads.json` written while that feature existed still deserializes instead of losing the user's whole history.
- `store.rs` persists `downloads` to `downloads.json` and the concurrency limit to `settings.json`, both in the OS app-data dir — no database.
- `binary_resolver.rs` locates the bundled yt-dlp/ffmpeg sidecars, trying resource dir → exe dir → dev `src-tauri/binaries` → system `PATH`, and never panics if none are found (falls back to the bare command name so `Command::new` at least attempts it).
- `commands/` is one module per concern: `analyze` (yt-dlp `-J` probe for a single video + abort; `analyze_playlist` for a fast `--flat-playlist` probe that lists a playlist's entries without resolving each one's formats), `download` (start/cancel/retry/list, concurrency-limit queueing, spawns yt-dlp as a child process and streams its stdout for progress), `dependency` (detect/update yt-dlp & ffmpeg versions), `file_ops` (delete/remove/rename/show-in-folder/OS drag-out/cookies-file import), `app_update` (Tauri self-updater).
- `menu.rs` is macOS-only (`#[cfg(target_os = "macos")]` in `lib.rs`) and builds the native app/File/Edit menu bar. Menu clicks carry no app context, so each item just emits a `menu-*` window event; the frontend's `useMacMenuEvents` hook listens for these and routes them through the exact same `useDownloadActions` handlers the on-screen toolbar uses, so the two surfaces can't drift.

### Download concurrency queue (`commands/download.rs`)
`start_download`/`retry_download` both funnel through `begin_download`, which spawns immediately if under `max_concurrent`, otherwise marks the entry `Pending`. Every place a slot can free up (a download finishes, fails, is cancelled, or the concurrency limit is raised in Settings) calls `try_start_next_pending`, which promotes the oldest `Pending` entry. This drain step is easy to forget when touching this file — without it, anything queued past the concurrency limit (routine for a playlist) just sits at `Pending` forever. `spawn_download` returns `Pin<Box<dyn Future>>` rather than being a plain `async fn` specifically because it and `try_start_next_pending` call each other; two plain `async fn`s with mutually-referencing opaque return types hit rustc's "cycle detected when computing type of opaque type" — boxing one side gives it a concrete signature and breaks the cycle.

### Where "what to download" logic lives
The yt-dlp format-selection logic (resolution/fps/container → `-f <selector>` string, `--cookies <path>`, `--merge-output-format`, subtitles/thumbnail-embed/metadata-embed flags, etc.) is built entirely in the frontend — mostly `buildFormatArgs()` in `src/lib/utils.ts`, called from `AddDownloadModal.tsx` — and passed to `start_download`/`retry_download` as a plain `format_args: Vec<String>`. The Rust side does not interpret or validate these args — it just appends them to the `Command` invocation. If a download picks the wrong quality/format, look in the frontend first, not in `download.rs`.

### Playlists
A playlist isn't its own persisted entity — `analyze_playlist` returns a flat list of entries (id/title/url/duration only, no per-video formats, since resolving those would mean one yt-dlp round trip per video), and queueing one generates a single shared `playlist_id` that gets denormalized onto every `DownloadEntry` it creates (along with `playlist_title`, since entries don't carry their own uploader). The frontend derives the grouping itself: `DownloadList.tsx` groups `downloads` by `playlist_id` into a collapsible `PlaylistGroupRow`, and drilling in is just filtering to that id (`openPlaylistId` in the store) — there's no backend concept of "a playlist" beyond that shared id. Playlist videos are saved under `<outputDir>/<sanitized playlist title>/`, so the folder itself doubles as the on-disk grouping.

### Cookies handling
The frontend never passes the user's own cookies.txt straight to yt-dlp. `--cookies FILE` is a read/write jar to yt-dlp — it rewrites FILE with refreshed session cookies after every run — so `AddDownloadModal.tsx` copies whatever the user selects into the app's private data dir via `import_cookies_file` (`commands/file_ops.rs`) once per selection, and uses that copy (`effectiveCookiesPath`) for every yt-dlp invocation. This keeps that rewriting off the user's file and out of wherever they keep it (their downloads folder, in the case that motivated this).

### Frontend state
`useDownloadStore` (Zustand) holds the downloads list plus UI-only state (selection, active modal ids, sort, search query, which playlist is drilled into). The backend is the source of truth: the store hydrates once via `getDownloads()` on launch and then only ever patches individual entries in place via the `download-progress` event — it never re-fetches the full list afterward, except once after a playlist/multi-URL batch finishes queueing (each entry is also added optimistically via `addDownload` as it's queued, so the list updates live without waiting on that).

### Settings persistence
Most settings (cookies file, default download directory, filename template) are frontend-only — read/written straight to `localStorage`, never touching Rust — because they're just strings threaded through per-download-call. The one exception is the concurrency limit: it governs a Rust-side scheduling decision that also happens autonomously (no frontend call in progress) when `try_start_next_pending` runs, so it has to live in `AppState.max_concurrent` and persist to `settings.json` via `get_max_concurrent`/`set_max_concurrent` instead. If a new setting only affects what args get built before a call, localStorage is enough; if Rust needs to consult it on its own, it needs to go through `AppState`.

### Clipboard (`@tauri-apps/plugin-clipboard-manager`)
Used for two things in `AddDownloadModal.tsx`: pre-filling the URL field from the clipboard on open, and the URL input's right-click Cut/Copy/Paste/Select All menu (`TextInputContextMenu.tsx`) — added because not everyone uses Ctrl/Cmd+V, and the webview doesn't reliably surface its own working right-click paste. Plain `navigator.clipboard` is still used for one-off writes elsewhere (e.g. "Copy URL" in `ContextMenu.tsx`) since writing doesn't have the same reliability problem reading does.

### A `useShallow`/`ResizeObserver` gotcha worth remembering
Two bugs this codebase already hit once each, in case the pattern comes up again: (1) A Zustand selector that returns a freshly-constructed array/object every call (e.g. `s.downloads.filter(...)`) without `useShallow` breaks React's snapshot-stability check and can crash the whole tree with "Maximum update depth exceeded" — `ContextMenu.tsx` has a comment where this happened (right-clicking a playlist row). (2) `ResizeObserver` only fires when the *observed element's own box* changes size — not when its children start overflowing inside a fixed-width container. `TopBar.tsx`'s icon-only fallback re-checks on both an actual resize *and* whenever the set of rendered buttons changes (selecting an item adds several), because the second case never triggers the observer on its own.

### i18n (`src/lib/i18n.ts`)
No library. `LANGUAGES` lists the 10 supported locales (`en tr es fr de pt ar ja ko zh`, with `ar` flagged `rtl: true`). Translation strings are ten flat objects (`en`, `tr`, ...), each typed as `Translations = typeof en` — **`en` is the shape source of truth**, so adding a UI string means adding the key to `en` first, then to the other nine; `tsc`/`cargo`-style strictness means a missing key in any language object is a compile error, not a silent runtime fallback (there's also a runtime fallback to `en` then to the raw key in `t()`, but the type system should catch omissions before that ever matters). Current language persists to `localStorage["app-language"]`; `setLanguage()` also flips `<html dir>` for RTL.

### Design system (`src/index.css`)
A from-scratch token system (custom properties in `:root`/`.dark`) — monochrome black/white/gray surfaces with three status hues reserved for meaning only: moss (done), rust (failed), sky (connecting). Typefaces are self-hosted (not Google-CDN-linked) in `public/fonts` + `src/fonts.css`: Space Grotesk for display/UI, IBM Plex Sans for body copy, IBM Plex Mono for every numeric readout (percent, speed, size, date, version). Don't reintroduce the old Inter/indigo-gradient look this replaced.

### Versioning & release
Version is duplicated in three places that must move together: `package.json`, `src-tauri/tauri.conf.json`, and `src-tauri/Cargo.toml`. Releases are cut by pushing a `v*` tag, which triggers `.github/workflows/build.yml`: a 4-way matrix (macOS arm64, macOS x64, Windows, Linux) that must run with `max-parallel: 1` — `tauri-action` read-modify-writes the shared release's `latest.json` (merging in each platform's updater signature), so parallel jobs race and silently clobber each other's entry. `prerelease` must stay `false`: the in-app updater's endpoint (`releases/latest/download/latest.json`) only resolves to the newest non-prerelease release. The GitHub release's body text isn't a static placeholder — a step in `build.yml` reads the pushed tag's own annotated message (`git tag -l --format='%(contents)'`) and feeds it into `releaseBody`, so whatever you write with `git tag -a -m "..."` becomes the release notes verbatim (plus a fixed "Installation" section appended after it). A lightweight tag (no `-m` message) falls back to a generic "see commit history" line.
