#!/usr/bin/env bash
#
# Installs the game-ci CLI binary for the current platform, from this repo's
# own GitHub releases. This is the ONE place platform detection, version
# resolution, and download/extract logic lives - every engine wrapper (Action)
# that needs the CLI (unity-builder today, others later) fetches and runs
# this script by tag/ref instead of reimplementing this logic itself:
#
#   curl -fsSL "https://raw.githubusercontent.com/game-ci/cli/$VERSION/scripts/install.sh" \
#     | bash -s -- "$VERSION" "$DEST_DIR"
#
# Fetching from raw.githubusercontent.com at a specific tag/ref means this
# script is implicitly versioned together with the CLI itself - a wrapper
# pinned to an older CLI version gets that version's install.sh, so a
# breaking change here ships alongside the release that needs it, not
# retroactively to every wrapper on next checkout. This is the whole point:
# install/download logic changes ONCE, here, and wrapper repos that just
# curl-and-run this script never need a code change to pick it up.
#
# GitHub Actions caching (via @actions/cache) is deliberately NOT handled
# here - it's an Actions-only service with no shell-callable API, so it has
# to stay in each wrapper's own Action code, wrapped around a call to this
# script. Everything else (platform/arch detection, "latest" resolution,
# download, extract, chmod) is fully generic and belongs here instead.
#
# Usage: install.sh [VERSION] [DEST_DIR]
#   VERSION   A release tag (e.g. v0.1.31), or "latest" (default: latest)
#   DEST_DIR  Directory to extract into (default: a fresh mktemp -d)
#
# On success, prints the absolute path to the extracted binary on stdout and
# exits 0. All progress/diagnostic output goes to stderr, so stdout is safe
# to capture directly as the binary path.

set -euo pipefail

CLI_REPO="game-ci/cli"
VERSION="${1:-latest}"
DEST_DIR="${2:-}"

log() { echo "$@" >&2; }

# --- Platform/arch detection -------------------------------------------------

os_name="$(uname -s)"
arch_name="$(uname -m)"

case "$os_name" in
  Linux) platform="linux" ;;
  Darwin) platform="darwin" ;;
  MINGW* | MSYS* | CYGWIN*) platform="win32" ;;
  *)
    log "Unsupported OS for the game-ci CLI: $os_name"
    exit 1
    ;;
esac

case "$arch_name" in
  x86_64 | amd64) arch="x64" ;;
  arm64 | aarch64) arch="arm64" ;;
  *)
    log "Unsupported architecture for the game-ci CLI: $arch_name"
    exit 1
    ;;
esac

case "$platform-$arch" in
  linux-x64) target="linux-x64" ;;
  linux-arm64) target="linux-arm64" ;;
  darwin-x64) target="macos-x64" ;;
  darwin-arm64) target="macos-arm64" ;;
  win32-x64) target="windows-x64" ;;
  *)
    log "Unsupported platform/arch combination for the game-ci CLI: $platform/$arch"
    exit 1
    ;;
esac

if [ "$platform" = "win32" ]; then
  asset="game-ci-${target}.zip"
  binary_name="game-ci.exe"
else
  asset="game-ci-${target}.tar.gz"
  binary_name="game-ci"
fi

# --- Version resolution -------------------------------------------------------

# GitHub's own /releases/latest redirect can't be used here (it redirects to
# an HTML tag page, not something a plain download can follow to an asset),
# so "latest" is resolved via the API, same as unity-builder's own
# resolveLatestTag used to. Authenticated when possible - Actions runners
# share IPs across many concurrent jobs from unrelated repos/orgs, so the
# unauthenticated rate limit (60 req/hour per IP) is easy to exhaust with
# traffic this job never generated.
resolved_version="$VERSION"
if [ "$VERSION" = "latest" ]; then
  auth_header=()
  token="${GITHUB_TOKEN:-${GH_TOKEN:-}}"
  if [ -n "$token" ]; then
    auth_header=(-H "Authorization: Bearer $token")
  fi

  # Buffered into a variable rather than piped straight into grep/sed: a
  # piped `grep -m1` closes its read end as soon as it matches, which sends
  # curl a SIGPIPE and (under `set -o pipefail`) fails the whole pipeline
  # even though the request itself succeeded.
  api_response="$(curl -fsSL "${auth_header[@]}" -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${CLI_REPO}/releases/latest")"
  resolved_version="$(grep -m1 '"tag_name"' <<< "$api_response" | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')"

  if [ -z "$resolved_version" ]; then
    log "Failed to resolve the latest game-ci CLI release."
    exit 1
  fi
fi

# --- Download and extract -----------------------------------------------------

if [ -z "$DEST_DIR" ]; then
  DEST_DIR="$(mktemp -d)"
else
  mkdir -p "$DEST_DIR"
fi

url="https://github.com/${CLI_REPO}/releases/download/${resolved_version}/${asset}"
archive_path="$DEST_DIR/$asset"

log "Downloading game-ci CLI ${resolved_version} from ${url}"
curl -fsSL "$url" -o "$archive_path"

if [ "$platform" = "win32" ]; then
  unzip -q -o "$archive_path" -d "$DEST_DIR"
else
  tar -xzf "$archive_path" -C "$DEST_DIR"
fi
rm -f "$archive_path"

binary_path="$DEST_DIR/$binary_name"
if [ "$platform" != "win32" ]; then
  chmod 755 "$binary_path"
fi

if [ ! -f "$binary_path" ]; then
  log "Extraction succeeded but the expected binary was not found at: $binary_path"
  exit 1
fi

echo "$binary_path"
