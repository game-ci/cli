#!/usr/bin/env bash

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

if [[ -n "$UNITY_LICENSING_SERVER" ]]; then
  #
  # Return any floating license used.
  #
  # This branch was missing entirely - activate.sh's own UNITY_LICENSING_SERVER
  # branch acquires a floating license via UnityLicensingClient, but with no
  # matching return step here, that license seat was never released back to
  # the server after a build, for every single mac floating-license build
  # (found while porting game-ci/unity-builder#842's Unity 6000.3+ path fix,
  # which patches this exact branch on unity-builder's side).
  echo "Returning floating license: \"$FLOATING_LICENSE\""

  # Unity 6000.3+ moved UnityLicensingClient from Contents/Frameworks to
  # Contents/Helpers (https://docs.unity.com/en-us/licensing-server/client-config) -
  # same reasoning as activate.sh's matching acquire-floating call.
  UNITY_LICENSING_CLIENT_SUBDIR="Frameworks"
  if [[ "$UNITY_VERSION" =~ ^6000\.([3-9]|[1-9][0-9]) ]]; then
    UNITY_LICENSING_CLIENT_SUBDIR="Helpers"
  fi

  "/Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/$UNITY_LICENSING_CLIENT_SUBDIR/UnityLicensingClient.app/Contents/MacOS/Unity.Licensing.Client" \
    --return-floating "$FLOATING_LICENSE"
elif [[ -n "$UNITY_SERIAL" ]]; then
  #
  # SERIAL LICENSE MODE
  #
  # This will return the license that is currently in use.
  #
  /Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/MacOS/Unity \
    -logFile - \
    -batchmode \
    -nographics \
    -quit \
    -username "$UNITY_EMAIL" \
    -password "$UNITY_PASSWORD" \
    -returnlicense \
    -projectPath "$ACTIVATE_LICENSE_PATH"
fi

# Return to previous working directory
popd
