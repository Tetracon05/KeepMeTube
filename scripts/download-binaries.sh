#!/usr/bin/env bash
# scripts/download-binaries.sh
#
# Downloads yt-dlp and ffmpeg binaries for the current (or specified) platform
# and places them in src-tauri/binaries/ with Tauri sidecar naming convention:
#   {binary-name}_{target-triple}[.exe]
#
# Usage:
#   ./scripts/download-binaries.sh                        # auto-detect
#   ./scripts/download-binaries.sh aarch64-apple-darwin   # CI explicit
set -euo pipefail

BINARIES_DIR="$(cd "$(dirname "$0")/.." && pwd)/src-tauri/binaries"
mkdir -p "$BINARIES_DIR"

# ── Determine target triple ───────────────────────────────────────────────────
if [[ "${1:-}" != "" ]]; then
    TARGET_TRIPLE="$1"
else
    OS=$(uname -s)
    ARCH=$(uname -m)
    case "$OS-$ARCH" in
        Darwin-arm64)  TARGET_TRIPLE="aarch64-apple-darwin" ;;
        Darwin-x86_64) TARGET_TRIPLE="x86_64-apple-darwin" ;;
        Linux-x86_64)  TARGET_TRIPLE="x86_64-unknown-linux-gnu" ;;
        Linux-aarch64) TARGET_TRIPLE="aarch64-unknown-linux-gnu" ;;
        MINGW*|MSYS*|CYGWIN*) TARGET_TRIPLE="x86_64-pc-windows-msvc" ;;
        *) echo "ERROR: Unsupported platform: $OS-$ARCH" >&2; exit 1 ;;
    esac
fi

echo "Target triple: $TARGET_TRIPLE"

# ── Helper ────────────────────────────────────────────────────────────────────
download() {
    local url="$1" dest="$2"
    echo "  Downloading: $url"
    if command -v curl &>/dev/null; then
        curl -fsSL "$url" -o "$dest"
    else
        wget -q "$url" -O "$dest"
    fi
}

# ── yt-dlp ────────────────────────────────────────────────────────────────────
echo ""
echo "==> yt-dlp"
YT_DLP_BASE="https://github.com/yt-dlp/yt-dlp/releases/latest/download"
case "$TARGET_TRIPLE" in
    aarch64-apple-darwin|x86_64-apple-darwin)
        YT_DLP_URL="$YT_DLP_BASE/yt-dlp_macos"
        YT_DLP_DEST="$BINARIES_DIR/yt-dlp-${TARGET_TRIPLE}" ;;
    x86_64-pc-windows-msvc)
        YT_DLP_URL="$YT_DLP_BASE/yt-dlp.exe"
        YT_DLP_DEST="$BINARIES_DIR/yt-dlp-${TARGET_TRIPLE}.exe" ;;
    x86_64-unknown-linux-gnu|aarch64-unknown-linux-gnu)
        YT_DLP_URL="$YT_DLP_BASE/yt-dlp_linux"
        YT_DLP_DEST="$BINARIES_DIR/yt-dlp-${TARGET_TRIPLE}" ;;
    *) echo "ERROR: No yt-dlp binary for $TARGET_TRIPLE" >&2; exit 1 ;;
esac
download "$YT_DLP_URL" "$YT_DLP_DEST"
[[ "$TARGET_TRIPLE" != *windows* ]] && chmod +x "$YT_DLP_DEST"
echo "  Saved: $(basename $YT_DLP_DEST)"

# ── ffmpeg (ffmpeg-static builds) ─────────────────────────────────────────────
echo ""
echo "==> ffmpeg"
FFMPEG_BASE="https://github.com/eugeneware/ffmpeg-static/releases/latest/download"
case "$TARGET_TRIPLE" in
    aarch64-apple-darwin)
        FFMPEG_URL="$FFMPEG_BASE/ffmpeg-darwin-arm64"
        FFMPEG_DEST="$BINARIES_DIR/ffmpeg-${TARGET_TRIPLE}" ;;
    x86_64-apple-darwin)
        FFMPEG_URL="$FFMPEG_BASE/ffmpeg-darwin-x64"
        FFMPEG_DEST="$BINARIES_DIR/ffmpeg-${TARGET_TRIPLE}" ;;
    x86_64-pc-windows-msvc)
        FFMPEG_URL="$FFMPEG_BASE/ffmpeg-win32-x64"
        FFMPEG_DEST="$BINARIES_DIR/ffmpeg-${TARGET_TRIPLE}.exe" ;;
    x86_64-unknown-linux-gnu)
        FFMPEG_URL="$FFMPEG_BASE/ffmpeg-linux-x64"
        FFMPEG_DEST="$BINARIES_DIR/ffmpeg-${TARGET_TRIPLE}" ;;
    aarch64-unknown-linux-gnu)
        FFMPEG_URL="$FFMPEG_BASE/ffmpeg-linux-arm64"
        FFMPEG_DEST="$BINARIES_DIR/ffmpeg-${TARGET_TRIPLE}" ;;
    *) echo "ERROR: No ffmpeg binary for $TARGET_TRIPLE" >&2; exit 1 ;;
esac
download "$FFMPEG_URL" "$FFMPEG_DEST"
[[ "$TARGET_TRIPLE" != *windows* ]] && chmod +x "$FFMPEG_DEST"
echo "  Saved: $(basename $FFMPEG_DEST)"

echo ""
echo "Done. Binaries in: $BINARIES_DIR"
