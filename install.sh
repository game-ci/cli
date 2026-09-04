#!/bin/sh
# game-ci CLI installer
# Usage: curl -fsSL https://raw.githubusercontent.com/game-ci/cli/main/install.sh | sh
#
# Environment variables:
#   GAME_CI_VERSION   - Install a specific version (e.g., v0.1.0). Defaults to latest.
#   GAME_CI_INSTALL   - Installation directory. Defaults to ~/.game-ci/bin.

set -e

REPO="game-ci/cli"
INSTALL_DIR="${GAME_CI_INSTALL:-$HOME/.game-ci/bin}"
BINARY_NAME="game-ci"

# Colors (disabled if not a terminal)
if [ -t 1 ]; then
  BOLD='\033[1m'
  GREEN='\033[0;32m'
  YELLOW='\033[0;33m'
  RED='\033[0;31m'
  RESET='\033[0m'
else
  BOLD=''
  GREEN=''
  YELLOW=''
  RED=''
  RESET=''
fi

info() {
  printf "${GREEN}info${RESET}: %s\n" "$1"
}

warn() {
  printf "${YELLOW}warn${RESET}: %s\n" "$1"
}

error() {
  printf "${RED}error${RESET}: %s\n" "$1" >&2
  exit 1
}

detect_platform() {
  OS="$(uname -s)"
  ARCH="$(uname -m)"

  case "$OS" in
    Linux*)  PLATFORM="linux" ;;
    Darwin*) PLATFORM="macos" ;;
    MINGW*|MSYS*|CYGWIN*)
      PLATFORM="windows"
      warn "For Windows, consider using install.ps1 instead:"
      warn "  irm https://raw.githubusercontent.com/game-ci/cli/main/install.ps1 | iex"
      ;;
    *) error "Unsupported operating system: $OS" ;;
  esac

  case "$ARCH" in
    x86_64|amd64)  ARCH="x64" ;;
    aarch64|arm64) ARCH="arm64" ;;
    *) error "Unsupported architecture: $ARCH" ;;
  esac

  # Releases ship archives, not bare binaries: the executable is not
  # self-contained, it resolves its own static assets (default-build-script/,
  # platforms/*, unity-config/) from a dist/ directory that must sit next to
  # it on disk (see game-ci/cli#73). Both live inside this archive, so the
  # install has to extract it rather than download a single file.
  if [ "$PLATFORM" = "windows" ]; then
    ASSET_NAME="game-ci-${PLATFORM}-${ARCH}.zip"
    BINARY_NAME="game-ci.exe"
  else
    ASSET_NAME="game-ci-${PLATFORM}-${ARCH}.tar.gz"
  fi
}

get_latest_version() {
  if [ -n "$GAME_CI_VERSION" ]; then
    VERSION="$GAME_CI_VERSION"
    info "Using specified version: $VERSION"
    return
  fi

  info "Fetching latest release..."

  if command -v curl > /dev/null 2>&1; then
    VERSION=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
  elif command -v wget > /dev/null 2>&1; then
    VERSION=$(wget -qO- "https://api.github.com/repos/${REPO}/releases/latest" \
      | grep '"tag_name"' | sed -E 's/.*"([^"]+)".*/\1/')
  else
    error "Neither curl nor wget found. Please install one of them."
  fi

  if [ -z "$VERSION" ]; then
    error "Could not determine latest version. Check https://github.com/${REPO}/releases"
  fi
}

download() {
  DOWNLOAD_URL="https://github.com/${REPO}/releases/download/${VERSION}/${ASSET_NAME}"

  printf "\n"
  info "Installing game-ci CLI ${VERSION} (${PLATFORM}-${ARCH})"
  info "  from: ${DOWNLOAD_URL}"
  info "  to:   ${INSTALL_DIR}/${BINARY_NAME}"
  printf "\n"

  mkdir -p "$INSTALL_DIR"

  TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t game-ci)
  ARCHIVE_PATH="${TMP_DIR}/${ASSET_NAME}"

  if command -v curl > /dev/null 2>&1; then
    HTTP_CODE=$(curl -fSL "$DOWNLOAD_URL" -o "$ARCHIVE_PATH" \
      -w "%{http_code}" 2>/dev/null) || true
    if [ "$HTTP_CODE" = "404" ]; then
      rm -rf "$TMP_DIR"
      error "Release asset not found: ${ASSET_NAME} (${VERSION})."
    elif [ ! -f "$ARCHIVE_PATH" ]; then
      rm -rf "$TMP_DIR"
      error "Download failed. URL: ${DOWNLOAD_URL}"
    fi
  elif command -v wget > /dev/null 2>&1; then
    wget -q "$DOWNLOAD_URL" -O "$ARCHIVE_PATH" \
      || { rm -rf "$TMP_DIR"; error "Download failed. URL: ${DOWNLOAD_URL}"; }
  fi
}

extract() {
  case "$ASSET_NAME" in
    *.tar.gz)
      command -v tar > /dev/null 2>&1 || { rm -rf "$TMP_DIR"; error "tar is required to extract ${ASSET_NAME}."; }
      tar -xzf "$ARCHIVE_PATH" -C "$INSTALL_DIR" \
        || { rm -rf "$TMP_DIR"; error "Failed to extract ${ASSET_NAME}."; }
      ;;
    *.zip)
      command -v unzip > /dev/null 2>&1 || { rm -rf "$TMP_DIR"; error "unzip is required to extract ${ASSET_NAME}. On Windows, use install.ps1 instead."; }
      unzip -oq "$ARCHIVE_PATH" -d "$INSTALL_DIR" \
        || { rm -rf "$TMP_DIR"; error "Failed to extract ${ASSET_NAME}."; }
      ;;
    *)
      rm -rf "$TMP_DIR"
      error "Unrecognized asset type: ${ASSET_NAME}"
      ;;
  esac

  rm -rf "$TMP_DIR"

  if [ ! -f "${INSTALL_DIR}/${BINARY_NAME}" ]; then
    error "Archive extracted but ${BINARY_NAME} was not found in ${INSTALL_DIR}."
  fi

  chmod +x "${INSTALL_DIR}/${BINARY_NAME}"

  if "${INSTALL_DIR}/${BINARY_NAME}" --help > /dev/null 2>&1; then
    info "Verified: binary runs successfully"
  else
    warn "Binary installed but could not verify. It may still work."
  fi

  printf "\n"
  printf "${BOLD}game-ci CLI installed successfully!${RESET}\n"
  printf "\n"

  case ":$PATH:" in
    *":${INSTALL_DIR}:"*)
      info "game-ci is already in your PATH. Run: game-ci --help"
      ;;
    *)
      SHELL_NAME=$(basename "$SHELL" 2>/dev/null || echo "sh")
      case "$SHELL_NAME" in
        zsh)  PROFILE="~/.zshrc" ;;
        bash) PROFILE="~/.bashrc" ;;
        fish) PROFILE="~/.config/fish/config.fish" ;;
        *)    PROFILE="~/.profile" ;;
      esac
      printf "${YELLOW}Add game-ci to your PATH by adding this to ${PROFILE}:${RESET}\n"
      printf "\n"
      if [ "$SHELL_NAME" = "fish" ]; then
        printf "  set -gx PATH \"%s\" \$PATH\n" "$INSTALL_DIR"
      else
        printf "  export PATH=\"%s:\$PATH\"\n" "$INSTALL_DIR"
      fi
      printf "\n"
      info "Then restart your shell or run: source ${PROFILE}"
      ;;
  esac
}

# Verifies the downloaded archive, and must therefore run before extract().
# checksums.txt lists the release archives, not the binary inside them.
verify_checksum() {
  if command -v sha256sum > /dev/null 2>&1; then
    SHA_CMD="sha256sum"
  elif command -v shasum > /dev/null 2>&1; then
    SHA_CMD="shasum -a 256"
  else
    warn "No sha256sum/shasum available; skipping checksum verification."
    return 0
  fi

  CHECKSUM_URL="https://github.com/${REPO}/releases/download/${VERSION}/checksums.txt"

  CHECKSUMS=""
  if command -v curl > /dev/null 2>&1; then
    CHECKSUMS=$(curl -fsSL "$CHECKSUM_URL" 2>/dev/null) || true
  elif command -v wget > /dev/null 2>&1; then
    CHECKSUMS=$(wget -qO- "$CHECKSUM_URL" 2>/dev/null) || true
  fi

  if [ -z "$CHECKSUMS" ]; then
    warn "Could not fetch checksums.txt; skipping checksum verification."
    return 0
  fi

  # Anchor to end-of-line so game-ci-linux-x64.tar.gz can't match the
  # game-ci-linux-arm64.tar.gz line (or vice versa).
  EXPECTED=$(echo "$CHECKSUMS" | grep " ${ASSET_NAME}$" | awk '{print $1}')
  if [ -z "$EXPECTED" ]; then
    warn "No checksum listed for ${ASSET_NAME}; skipping verification."
    return 0
  fi

  ACTUAL=$($SHA_CMD "$ARCHIVE_PATH" | awk '{print $1}')
  if [ "$EXPECTED" != "$ACTUAL" ]; then
    rm -rf "$TMP_DIR"
    error "Checksum verification failed!\n  Expected: ${EXPECTED}\n  Got:      ${ACTUAL}"
  fi

  info "Checksum verified (SHA256)"
}

detect_platform
get_latest_version
download
verify_checksum
extract
