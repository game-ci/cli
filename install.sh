#!/bin/sh
# game-ci CLI installer
# Usage: curl -fsSL https://raw.githubusercontent.com/game-ci/cli/main/install.sh | sh
#
# Environment variables:
#   GAME_CI_VERSION   - Install a specific version (e.g., v0.1.0). Defaults to latest.
#   GAME_CI_INSTALL   - Installation directory. Defaults to ~/.game-ci/bin.
#
# This is the user-facing half of the installer: friendly progress output,
# PATH setup guidance, and nothing else. Platform detection, version
# resolution, download, checksum verification and extraction all live in
# scripts/install.sh, which this script delegates to - see that script's
# header for why it is the single source of truth. They used to be two
# independent implementations of the same logic, which is exactly how this
# one silently rotted into requesting release assets that did not exist
# (#242) while the other stayed correct.
#
# Windows' PowerShell path (install.ps1, and action.yml's pwsh branch) is
# intentionally NOT consolidated into scripts/install.sh: PowerShell users
# have no bash to run it with, so that path stays self-contained.

set -e

REPO="game-ci/cli"
INSTALL_DIR="${GAME_CI_INSTALL:-$HOME/.game-ci/bin}"
VERSION="${GAME_CI_VERSION:-latest}"

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

TMP_DIR=""
cleanup() {
  [ -n "$TMP_DIR" ] && rm -rf "$TMP_DIR"
  return 0
}
trap cleanup EXIT INT TERM

# Only a UX hint - the actual platform detection is scripts/install.sh's job.
case "$(uname -s)" in
  MINGW* | MSYS* | CYGWIN*)
    warn "For Windows, consider using install.ps1 instead:"
    warn "  irm https://raw.githubusercontent.com/game-ci/cli/main/install.ps1 | iex"
    ;;
esac

# scripts/install.sh is #!/usr/bin/env bash and uses bash-only features
# (arrays, herestrings), while this script is POSIX sh and documented as
# being run via `sh`. Invoke it explicitly with bash rather than letting it
# be sourced by whatever /bin/sh happens to be.
command -v bash > /dev/null 2>&1 || error \
  "bash is required to install the game-ci CLI. Install bash and re-run, or on Windows use install.ps1: irm https://raw.githubusercontent.com/game-ci/cli/main/install.ps1 | iex"

# Prefer a scripts/install.sh sitting next to this script (a real checkout:
# action.yml runs "${GITHUB_ACTION_PATH}/install.sh", and contributors run
# ./install.sh from a clone). Resolving it relative to this script's own
# location rather than the caller's cwd keeps the Action on the ref it
# checked out and saves it a pointless network fetch.
INSTALLER=""
case "$0" in
  # `curl ... | sh` leaves $0 as the shell's own name, with no script on
  # disk to resolve against; anything else is a real path (possibly bare,
  # e.g. `sh install.sh`, hence the -f test rather than a slash test).
  sh | -sh | bash | -bash | dash | -dash | ash | -ash | '') ;;
  *)
    if [ -f "$0" ]; then
      SCRIPT_DIR=$(CDPATH='' cd -- "$(dirname -- "$0")" > /dev/null 2>&1 && pwd) || SCRIPT_DIR=""
      if [ -n "$SCRIPT_DIR" ] && [ -f "${SCRIPT_DIR}/scripts/install.sh" ]; then
        INSTALLER="${SCRIPT_DIR}/scripts/install.sh"
      fi
    fi
    ;;
esac

fetch_installer() {
  if command -v curl > /dev/null 2>&1; then
    curl -fsSL "$1" -o "$2" || return 1
  elif command -v wget > /dev/null 2>&1; then
    wget -q "$1" -O "$2" || return 1
  else
    error "Neither curl nor wget found. Please install one of them."
  fi
  [ -s "$2" ] || return 1
}

if [ -n "$INSTALLER" ]; then
  info "Using local installer: ${INSTALLER}"
else
  # Piped install (no checkout). Fetch the installer at the ref matching the
  # version being installed where one was requested, so the install logic is
  # versioned with the release it installs (see scripts/install.sh's header);
  # fall back to main when installing "latest".
  if [ -n "${GAME_CI_VERSION:-}" ]; then
    INSTALLER_REF="$GAME_CI_VERSION"
  else
    INSTALLER_REF="main"
  fi

  TMP_DIR=$(mktemp -d 2>/dev/null || mktemp -d -t game-ci)
  INSTALLER="${TMP_DIR}/install.sh"
  INSTALLER_URL="https://raw.githubusercontent.com/${REPO}/${INSTALLER_REF}/scripts/install.sh"

  info "Fetching installer: ${INSTALLER_URL}"
  if ! fetch_installer "$INSTALLER_URL" "$INSTALLER"; then
    # scripts/install.sh only exists from v0.1.31 onwards; pinning an older
    # GAME_CI_VERSION must still install that older release, so fall back to
    # main's copy of the installer rather than failing. The release being
    # installed is unaffected - only which install logic downloads it.
    if [ "$INSTALLER_REF" = "main" ]; then
      error "Could not download the installer from ${INSTALLER_URL}"
    fi
    warn "No installer at ref ${INSTALLER_REF}; falling back to main."
    INSTALLER_URL="https://raw.githubusercontent.com/${REPO}/main/scripts/install.sh"
    fetch_installer "$INSTALLER_URL" "$INSTALLER" \
      || error "Could not download the installer from ${INSTALLER_URL}"
  fi
fi

printf "\n"
info "Installing game-ci CLI (${VERSION})"
info "  to: ${INSTALL_DIR}"
printf "\n"

# scripts/install.sh writes all of its progress to stderr (shown to the user
# as it happens) and prints only the absolute binary path on stdout.
BINARY_PATH=$(bash "$INSTALLER" "$VERSION" "$INSTALL_DIR") \
  || error "Installation failed. See the output above for details."

[ -n "$BINARY_PATH" ] && [ -f "$BINARY_PATH" ] \
  || error "Installer did not report a valid binary path."

chmod +x "$BINARY_PATH" 2> /dev/null || true

if "$BINARY_PATH" --help > /dev/null 2>&1; then
  info "Verified: binary runs successfully"
else
  warn "Binary installed but could not verify. It may still work."
fi

printf "\n"
printf "${BOLD}game-ci CLI installed successfully!${RESET}\n"
printf "\n"
info "Installed: ${BINARY_PATH}"

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
