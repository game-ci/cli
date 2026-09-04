#!/usr/bin/env bash

# Resolves Unity tool locations for the macOS (native host) script set.
#
# Bash counterpart of dist/platforms/windows/steps/resolve_unity_path.ps1 -
# see dist/platforms/ubuntu/steps/resolve_unity_path.sh's comment for why the
# licensing client's location lives in one place per platform.
#
# Unlike the Ubuntu image, where Unity sits at a fixed image-baked path, macOS
# runners get Unity from Unity Hub, so the install directory is version-
# specific. This mirrors src/logic/unity/platform-setup/setup-mac.ts's own
# hardcoded /Applications/Unity/Hub/Editor/$version for the same reason.
#
# $UNITY_PATH overrides the Hub default editor root;
# $UNITY_LICENSING_CLIENT_PATH overrides the resolved client path entirely.

unity_editor_root() {
  if [[ -n "${UNITY_PATH:-}" ]]; then
    echo "$UNITY_PATH"
    return 0
  fi

  echo "/Applications/Unity/Hub/Editor/$UNITY_VERSION"
}

unity_licensing_client_path() {
  if [[ -n "${UNITY_LICENSING_CLIENT_PATH:-}" ]]; then
    echo "$UNITY_LICENSING_CLIENT_PATH"
    return 0
  fi

  # Unity 6000.3+ moved UnityLicensingClient from Contents/Frameworks to
  # Contents/Helpers (https://docs.unity.com/en-us/licensing-server/client-config)
  # - a hardcoded Frameworks path 127'd ("No such file or directory") on every
  # 6000.3+ mac build using a license server (game-ci/unity-builder#842).
  local subdir="Frameworks"
  if [[ "$UNITY_VERSION" =~ ^6000\.([3-9]|[1-9][0-9]) ]]; then
    subdir="Helpers"
  fi

  echo "$(unity_editor_root)/Unity.app/Contents/$subdir/UnityLicensingClient.app/Contents/MacOS/Unity.Licensing.Client"
}
