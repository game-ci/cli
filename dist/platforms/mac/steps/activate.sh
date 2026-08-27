#!/usr/bin/env bash

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

if [[ -n "$UNITY_SERIAL" && -n "$UNITY_EMAIL" && -n "$UNITY_PASSWORD" ]]; then
  #
  # SERIAL LICENSE MODE
  #
  echo "Requesting activation"

  # Unity's licensing client occasionally fails to reach/handshake with
  # Unity's cloud license service in time here too, not just during the
  # build's own Unity invocation (see build.sh's matching comment/retry) -
  # same signatures ("Code 404/408/1500 ...", "Access token is unavailable"),
  # same fix: retry a few times, but only on those known-transient
  # signatures, so a genuine activation failure (bad serial, expired
  # license, etc.) still fails immediately rather than burning retries.
  ACTIVATE_MAX_ATTEMPTS=4
  ACTIVATE_RETRY_DELAY_SECONDS=20
  ACTIVATE_TRANSIENT_LICENSE_ERROR_PATTERN='TimeoutPolicy did not complete|Access token is unavailable|entitlement groups and 0 free entitlements|License activation has failed|No valid Unity Editor license found|License is not active'

  ACTIVATE_LOG="$(mktemp)"
  for ACTIVATE_ATTEMPT in $(seq 1 "$ACTIVATE_MAX_ATTEMPTS"); do
    # Activate license
    /Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/MacOS/Unity \
      -logFile - \
      -batchmode \
      -nographics \
      -quit \
      -serial "$UNITY_SERIAL" \
      -username "$UNITY_EMAIL" \
      -password "$UNITY_PASSWORD" \
      -projectPath "$ACTIVATE_LICENSE_PATH" 2>&1 | tee "$ACTIVATE_LOG"
    UNITY_EXIT_CODE=${PIPESTATUS[0]}

    if [ "$UNITY_EXIT_CODE" -eq 0 ]; then
      break
    fi

    if [ "$ACTIVATE_ATTEMPT" -lt "$ACTIVATE_MAX_ATTEMPTS" ] && grep -qE "$ACTIVATE_TRANSIENT_LICENSE_ERROR_PATTERN" "$ACTIVATE_LOG"; then
      echo "Unity activation failed with a known-transient licensing error (attempt $ACTIVATE_ATTEMPT/$ACTIVATE_MAX_ATTEMPTS) - retrying in ${ACTIVATE_RETRY_DELAY_SECONDS}s..."
      sleep "$ACTIVATE_RETRY_DELAY_SECONDS"
      continue
    fi

    break
  done
  rm -f "$ACTIVATE_LOG"
elif [[ -n "$UNITY_LICENSING_SERVER" ]]; then
  #
  # Custom Unity License Server
  #
  # This platform previously had no floating-license support at all -
  # UNITY_LICENSING_SERVER was silently ignored and activation always
  # attempted (empty) serial mode instead (game-ci/cli, found while
  # auditing for divergence from unity-builder's real source).
  echo "Requesting floating license"

  # Unity 6000.3+ moved UnityLicensingClient from Contents/Frameworks to
  # Contents/Helpers (https://docs.unity.com/en-us/licensing-server/client-config)
  # - a hardcoded Frameworks path 127'd ("No such file or directory") on
  # every 6000.3+ mac build using a license server (game-ci/unity-builder#842).
  UNITY_LICENSING_CLIENT_SUBDIR="Frameworks"
  if [[ "$UNITY_VERSION" =~ ^6000\.([3-9]|[1-9][0-9]) ]]; then
    UNITY_LICENSING_CLIENT_SUBDIR="Helpers"
  fi

  "/Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/$UNITY_LICENSING_CLIENT_SUBDIR/UnityLicensingClient.app/Contents/MacOS/Unity.Licensing.Client" \
    --acquire-floating > license.txt
  UNITY_EXIT_CODE=$?

  if [ $UNITY_EXIT_CODE -eq 0 ]; then
    PARSEDFILE=$(grep -oE '\"[^"]*\"' < license.txt | tr -d '"')
    export FLOATING_LICENSE
    FLOATING_LICENSE=$(sed -n 2p <<< "$PARSEDFILE")
    FLOATING_LICENSE_TIMEOUT=$(sed -n 4p <<< "$PARSEDFILE")

    echo "Acquired floating license: \"$FLOATING_LICENSE\" with timeout $FLOATING_LICENSE_TIMEOUT"
  fi
else
  #
  # NO LICENSE ACTIVATION STRATEGY MATCHED
  #
  echo "License activation strategy could not be determined."
  echo ""
  echo "Visit https://game.ci/docs/github/activation for more"
  echo "details on how to set up one of the possible activation strategies."

  # Immediately exit as no UNITY_EXIT_CODE can be derived.
  exit 1;
fi

#
# Display information about the result
#
if [ $UNITY_EXIT_CODE -eq 0 ]; then
  # Activation was a success
  echo "Activation complete."
else
  # Activation failed so exit with the code from the license verification step
  echo "Unclassified error occured while trying to activate license."
  echo "Exit code was: $UNITY_EXIT_CODE"
  exit $UNITY_EXIT_CODE
fi

# Return to previous working directory
popd
