# YT Downloader

A modern, fast, and cross-platform desktop application for downloading videos and audio from **YouTube, Instagram, Twitch, TikTok, Twitter/X, Reddit, Facebook, Vimeo, SoundCloud, and [1800+ other websites](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md)**.

Powered by [yt-dlp](https://github.com/yt-dlp/yt-dlp) and built with [Tauri v2](https://tauri.app/) (Rust backend) and React + TypeScript + Tailwind CSS (frontend).

<img width="1128" height="817" alt="SCR-20260820-ksuk" src="https://github.com/user-attachments/assets/e0f9fbb2-12eb-4751-b100-0839660d4a34" />

<img width="1072" height="792" alt="SCR-20260820-kppx" src="https://github.com/user-attachments/assets/b0414769-0783-43f7-9946-c48844c5da64" />

<img width="1128" height="817" alt="SCR-20260820-kswl" src="https://github.com/user-attachments/assets/86335e44-0fc0-424f-9385-6dc987fa1cdf" />


# Download
👉 **[Get Latest Release (macOS, Windows, Linux)](https://github.com/Tetracon05/YT-Downloader/releases)**

**Note for macOS
How to Fix "Damaged Application" Warning
When you first download YT Downloader, macOS may show a "YT Downloader is damaged and can't be opened" warning, even though the application is perfectly fine.

Why This Happens
macOS automatically marks files downloaded from the internet with a "quarantine" attribute for security. This is a safety feature—it helps prevent accidentally running malicious software. However, since YT Downloader is not yet notarized by Apple (a process that requires Apple Developer Program membership), macOS treats it as potentially untrusted and refuses to open it.

The warning is misleading. The app isn't actually damaged. macOS is simply being cautious about an unsigned application.

How to Fix It
Copy and paste this command into Terminal, then press Enter:


xattr -d com.apple.quarantine "/Applications/YT Downloader.app"
This command tells macOS to remove the quarantine flag from the app. After running it once, you'll be able to open YT Downloader normally without any warnings.

Is It Safe?
Yes. You're telling your Mac to trust this specific application. The command only removes the quarantine mark—it doesn't modify the app itself or bypass any other security features. Your system will still protect you from other potentially harmful software.

Alternative: Right-Click to Open
If you prefer not to use Terminal, you can also:

Right-click the YT Downloader app in Finder
Select "Open"
Click "Open" in the warning dialog
This bypasses the warning once, but you'll see it again next time you launch the app. Using the Terminal command is a permanent fix.

---

## 🌐 Supported Sites

Although named **YT Downloader**, the application leverages yt-dlp's universal extractor engine and supports **over 1,800 websites and platforms**, including:

| Platform | Supported Content |
| :--- | :--- |
| **YouTube** | Videos, Shorts, Playlists, Audio-only streams (up to 4K/8K) |
| **Instagram** | Reels, Stories, Posts, IGTV |
| **Twitch** | Clips, Full VODs, Highlights |
| **TikTok** | Videos, Audio tracks (with or without watermark) |
| **Twitter / X** | Video tweets, GIFs |
| **Reddit** | Hosted video posts with merged audio |
| **Facebook** | Public & shared video posts, Reels |
| **SoundCloud** | High-quality music tracks, Sets |
| **Vimeo** | HD & 4K video streams |
| **Bilibili / Dailymotion / Pinterest** | Full video downloads |
| **+1800 more platforms** | [Full list of supported extractors](https://github.com/yt-dlp/yt-dlp/blob/master/supportedsites.md) |

---

## Features

- 🌐 **1800+ Websites Supported**: Download videos, clips, reels, and audio from virtually any online video or streaming platform.
- 🔄 **Automatic yt-dlp Version Check**: Checks for new yt-dlp updates on startup and offers one-click upgrades to keep site extractors compatible.
- 🍪 **Authentication & Cookies (cookies.txt)**: Optional cookies support to download age-restricted, member-only, or private content across YouTube and other platforms.
- 🌍 **Multi-Language Support**: 10 built-in languages (English, Türkçe, Español, Français, Deutsch, Português, العربية, 日本語, 한국어, 中文).
- ⚙️ **Settings Drawer**: Easy management of cookies, appearance themes, and language preferences.
- 📊 **Real-time Progress**: Live download percentage, speed tracking, and status indicators.
- 🎨 **Modern Theming**: Native Dark mode, Light mode, and automatic OS system theme following.
- 📁 **File Management**: Direct access to downloaded files in Finder / Windows Explorer / Linux file manager.
- ✏️ **File Operations**: Rename downloaded files and manage history.
- 🔄 **Queue Manager**: Up to 3 concurrent downloads with automatic queue handling.
- 💾 **Persistent History**: Download history is preserved across application restarts.
- 🛠️ **Dependency Auto-Detection**: Checks for `yt-dlp` and `ffmpeg` on first launch with one-click installation support.

---

## 🍪 Authentication & High-Quality Downloads (cookies.txt)

### Why is this needed?
> Most public videos across YouTube, Instagram, and Twitch do not require authentication. However, for **age-restricted (+18) videos, member-only streams, private accounts, or high-tier formats**, passing a `cookies.txt` file authenticates your session as a real logged-in user.

### How to get your `cookies.txt`?

1. **Install a Browser Extension:**
   - **Chrome / Edge / Brave / Opera:** [Get cookies.txt locally (Chrome Web Store)](https://chromewebstore.google.com/detail/get-cookiestxt-locally/cclelndahbckbenkjhflpdbgdldlbecc)
   - **Firefox:** [cookies.txt (Firefox Add-ons)](https://addons.mozilla.org/firefox/addon/cookies-txt/)
2. **Log in to the Website:**
   - Open your browser and log in to your account (e.g. YouTube, Instagram, etc.).
3. **Export Cookies:**
   - Click the extension icon and select **Export** / **Download**.
   - Save the file as `cookies.txt` on your computer.
4. **Select in YT Downloader:**
   - Open YT Downloader and click **Settings (⚙️)** or use the banner inside the **Add Download** modal.
   - Click **"Select cookies.txt"** and choose your file.
   - *The file path is saved automatically; you only need to select it once!*

---

## Prerequisites

### Required System Tools

The app requires two external tools. On first launch, it will check for these and offer to install them:

- **yt-dlp** — The video & audio downloader engine
- **ffmpeg** — Required for merging video + audio streams and format conversion

### Development Tools

- **Rust** (1.70+) — [Install via rustup](https://rustup.rs/)
- **Node.js** (18+) — [Download](https://nodejs.org/)
- **npm** (9+) — Comes with Node.js

### Platform-Specific Requirements

#### macOS
- Xcode Command Line Tools: `xcode-select --install`
- Homebrew (recommended): [brew.sh](https://brew.sh/)

#### Windows
- [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/) (usually pre-installed on Windows 10/11)
- [Build Tools for Visual Studio](https://visualstudio.microsoft.com/visual-cpp-build-tools/)

#### Linux
- `webkit2gtk-4.1` and related libraries:
  ```bash
  # Debian/Ubuntu
  sudo apt install libwebkit2gtk-4.1-dev build-essential curl wget file libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev
  
  # Fedora
  sudo dnf install webkit2gtk4.1-devel openssl-devel curl wget file libappindicator-gtk3-devel librsvg2-devel
  ```

---

## Build Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Development Mode

```bash
npm run tauri dev
```

This starts both the Vite dev server (frontend HMR) and the Tauri Rust backend.

### 3. Production Build

```bash
npm run tauri build
```

This produces platform-specific installer bundles:

| Platform | Output |
| :--- | :--- |
| **macOS** | `src-tauri/target/release/bundle/dmg/YT Downloader.dmg` |
| **Windows** | `src-tauri/target/release/bundle/msi/YT Downloader.msi` |
| **Linux** | `src-tauri/target/release/bundle/appimage/YT Downloader.AppImage` |

---

## Installing yt-dlp and ffmpeg Manually

### macOS (Homebrew)
```bash
brew install yt-dlp ffmpeg
```

### Windows (winget)
```bash
winget install yt-dlp.yt-dlp
winget install Gyan.FFmpeg
```

### Linux
```bash
# yt-dlp
pip3 install yt-dlp

# ffmpeg
sudo apt install ffmpeg      # Debian/Ubuntu
sudo dnf install ffmpeg      # Fedora
sudo pacman -S ffmpeg        # Arch
```

---

## Architecture

```
├── src/                    # React Frontend (TypeScript)
│   ├── components/         # UI Components (Download List, Modals, Settings, Dialogs)
│   ├── store/              # Zustand state management
│   ├── hooks/              # Custom React hooks (Language, Theme, ContextMenu)
│   ├── lib/                # API wrappers (Tauri IPC), i18n, utils
│   └── types/              # TypeScript type definitions
├── src-tauri/              # Rust Backend (Tauri v2)
│   └── src/
│       ├── commands/       # Tauri command handlers (Download, Analyze, Dependencies, File Ops)
│       ├── state.rs        # App state types
│       └── store.rs        # JSON persistence & configuration
```

---

## License

MIT
