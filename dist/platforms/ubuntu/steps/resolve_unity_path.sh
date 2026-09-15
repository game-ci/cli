#!/usr/bin/env bash

# Resolves Unity tool locations for the Ubuntu (Docker image) script set.
#
# Bash counterpart of dist/platforms/windows/steps/resolve_unity_path.ps1's
# Get-UnityLicensingClientExePath. The path used to be hardcoded inline at
# every call site (activate.sh's floating branch, return_license.sh's), which
# meant the licensing client's undocumented flags and its location were spread
# across several files. Unity ships no stable contract for either, so keeping
# them in one place per platform makes a future break a one-line fix rather
# than a hunt.
#
# $UNITY_LICENSING_CLIENT_PATH, if set, overrides the image default entirely -
# lets a custom image place the client somewhere else without a code change.

unity_licensing_client_path() {
  if [[ -n "${UNITY_LICENSING_CLIENT_PATH:-}" ]]; then
    echo "$UNITY_LICENSING_CLIENT_PATH"
    return 0
  fi

  echo "/opt/unity/Editor/Data/Resources/Licensing/Client/Unity.Licensing.Client"
}

# Whether the bundled licensing client can request a Personal seat at all.
# 1.12.1 (Unity 2020.3) cannot: it has no --include-personal, and
# --activate-all alone covers only subscriptions, so it returns "No seat
# available" for a Personal account. Newer clients can.
#
# Probe the client's own help text rather than guessing from the editor
# version - the client is versioned independently of the editor that bundles
# it, so a version comparison would be wrong the moment Unity backports or
# skips a client release.
#
# Lives here, beside unity_licensing_client_path, rather than in activate.sh:
# return_license.sh needs the same answer to pick a matching return route, and
# it does not source activate.sh. Under runsteps.sh both run in one shell so an
# activate.sh definition happened to be in scope, but `game-ci return-license`
# on its own would have called an undefined function.
unity_licensing_client_supports_personal() {
  "$(unity_licensing_client_path)" --help 2>&1 | grep -q -- '--include-personal'
}

unity_licensing_personal_flags() {
  local client_help
  client_help="$("$(unity_licensing_client_path)" --help 2>&1 || true)"

  if grep -q -- '--include-personal' <<< "$client_help"; then
    printf '%s' '--activate-all --include-personal'
  else
    printf '%s' '--activate-all'
  fi
}
