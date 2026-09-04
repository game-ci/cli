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
