#!/usr/bin/env bash
#
# Safely cuts a game-ci/cli release.
#
# `gh release create` makes GitHub's /releases/latest API - and therefore
# `cliVersion: latest` and the `v0` major tag every consumer resolves - point
# at the new release immediately, before release-cli.yml has built or
# attached a single binary. That build takes several minutes and can fail
# (v0.1.66 sat as "latest" with zero attached binaries for ~6 hours after a
# transient npm registry blip on one platform's build job went unnoticed -
# see game-ci/cli#285). Every consumer that resolved "latest" in that window
# got a hard 404 downloading the CLI.
#
# This script closes that gap structurally: the release is created as a
# draft (drafts are never returned by /releases/latest), binaries are built
# and attached to it while still a draft, every expected asset is verified
# present, and only then is it published - so "latest" never resolves to a
# release with missing assets, by construction.
#
# Usage: scripts/release/cut-release.sh <tag e.g. v0.1.67> [notes-file]
#   Requires: gh (authenticated), git, run from a checkout of the commit to
#   release (that commit does not need to be pushed as a tag beforehand).

set -euo pipefail

REPO="game-ci/cli"
TAG="${1:?Usage: cut-release.sh <tag> [notes-file]}"
NOTES_FILE="${2:-}"
COMMIT="$(git rev-parse HEAD)"

EXPECTED_ASSETS=(
  checksums.txt
  game-ci-linux-arm64 game-ci-linux-arm64.tar.gz
  game-ci-linux-x64 game-ci-linux-x64.tar.gz
  game-ci-macos-arm64 game-ci-macos-arm64.tar.gz
  game-ci-macos-x64 game-ci-macos-x64.tar.gz
  game-ci-windows-x64.exe game-ci-windows-x64.zip
)

echo "Cutting $TAG at $COMMIT (repo: $REPO)"

# 1. Create as a draft. Not visible via /releases/latest, so nothing can
#    resolve it - and the `v0` major-tag-move workflow (versioning.yml)
#    doesn't fire either, since it also only triggers on `release: published`.
echo "==> Creating draft release..."
if [ -n "$NOTES_FILE" ]; then
  gh release create "$TAG" --repo "$REPO" --draft --target "$COMMIT" --title "$TAG" --notes-file "$NOTES_FILE"
else
  gh release create "$TAG" --repo "$REPO" --draft --target "$COMMIT" --title "$TAG" --generate-notes
fi

# 2. Build binaries against this exact commit via workflow_dispatch, passing
#    the commit explicitly - a draft's tag has no real git ref yet for
#    actions/checkout to resolve on its own.
echo "==> Dispatching release-cli.yml..."
DISPATCH_TIME="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
gh workflow run release-cli.yml --repo "$REPO" -f "tag=$TAG" -f "commit=$COMMIT"

echo "==> Waiting for the dispatched run to appear..."
RUN_ID=""
for _ in $(seq 1 24); do
  RUN_ID="$(gh run list --repo "$REPO" --workflow release-cli.yml --event workflow_dispatch --limit 1 --json databaseId,createdAt \
    --jq --arg since "$DISPATCH_TIME" '[.[] | select(.createdAt >= $since)] | .[0].databaseId // empty')"
  [ -n "$RUN_ID" ] && break
  sleep 5
done
if [ -z "$RUN_ID" ]; then
  echo "Could not find the dispatched run after 2 minutes. Check manually and rerun this script once resolved:" >&2
  echo "  gh run list --repo $REPO --workflow release-cli.yml" >&2
  echo "Draft left in place: https://github.com/$REPO/releases/tag/$TAG" >&2
  exit 1
fi

echo "==> Watching run $RUN_ID (this takes several minutes)..."
if ! gh run watch "$RUN_ID" --repo "$REPO" --exit-status; then
  echo "Build failed. Draft left in place, NOT published - fix and rerun this script, or dispatch release-cli.yml manually and rerun once green:" >&2
  echo "  https://github.com/$REPO/actions/runs/$RUN_ID" >&2
  echo "  https://github.com/$REPO/releases/tag/$TAG" >&2
  exit 1
fi

# 3. Verify every expected asset actually landed - the build succeeding
#    doesn't by itself prove the upload-to-release step did, so check the
#    release object directly rather than trusting the run's green checkmark.
echo "==> Verifying release assets..."
ACTUAL_ASSETS="$(gh release view "$TAG" --repo "$REPO" --json assets --jq '.assets[].name')"
MISSING=0
for asset in "${EXPECTED_ASSETS[@]}"; do
  if ! grep -qxF "$asset" <<< "$ACTUAL_ASSETS"; then
    echo "  MISSING: $asset" >&2
    MISSING=1
  fi
done
if [ "$MISSING" -ne 0 ]; then
  echo "One or more expected assets are missing - NOT publishing. Draft left in place for inspection:" >&2
  echo "  https://github.com/$REPO/releases/tag/$TAG" >&2
  exit 1
fi
echo "All expected assets present."

# 4. Only now does this become visible as `latest` and move the `v0` tag -
#    every consumer that resolves it from this point on gets a release that
#    was already fully built and verified, never a race.
echo "==> Publishing $TAG..."
gh release edit "$TAG" --repo "$REPO" --draft=false
echo "Published: https://github.com/$REPO/releases/tag/$TAG"
