#!/usr/bin/env bash

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

# Same UNITY_LICENSE_RETRY_MAX_ATTEMPTS as build.sh's matching retry - set
# from the real --licenseRetryMaxAttempts CLI option (see
# UnityEnvironment.getVariables), one knob covers all activation modes since
# they're the same underlying flakiness. --licenseRetryMaxAttempts=1
# disables retrying.
ACTIVATE_MAX_ATTEMPTS="${UNITY_LICENSE_RETRY_MAX_ATTEMPTS:-4}"
ACTIVATE_RETRY_DELAY_SECONDS=20
ACTIVATE_TRANSIENT_LICENSE_ERROR_PATTERN='TimeoutPolicy did not complete|Access token is unavailable|entitlement groups and 0 free entitlements|License activation has failed|No valid Unity Editor license found|License is not active'

# Serial mode is preferred over personal-license (below) whenever both are
# configured: a manually-activated .ulf is bound to the machine fingerprint
# of whatever machine originally requested it, which real CI evidence shows
# genuinely doesn't match every runner - confirmed via unity-test-runner's
# own CI, where the identical .ulf activates cleanly through this same
# script's ubuntu counterpart but fails windows with "Machine bindings
# don't match" every single time. Serial credentials have no such
# constraint, so given a choice, prefer them.
if [[ -z "$UNITY_SERIAL" || -z "$UNITY_EMAIL" || -z "$UNITY_PASSWORD" ]] && { [[ -n "$UNITY_LICENSE" ]] || [[ -n "$UNITY_LICENSE_FILE" ]]; }; then
  #
  # PERSONAL LICENSE MODE
  #
  # mac never had this branch at all - only ubuntu/steps/activate.sh did,
  # going all the way back to before the thin-wrapper migration (confirmed
  # against unity-builder's own pre-migration mac script). A repo whose only
  # configured credential is UNITY_LICENSE (no UNITY_SERIAL/EMAIL/PASSWORD -
  # exactly game-ci/unity-test-runner's actual repo secrets) had no way to
  # activate on mac at all: activation always fell through to serial mode
  # with empty credentials, producing the same "License is not active"/"0
  # entitlement groups" symptoms as genuine license-server flakiness, but
  # persistent and 100% reproducible rather than transient - no amount of
  # retrying a fundamentally missing credential ever helps.
  echo "Requesting activation (personal license)"

  FILE_PATH=UnityLicenseFile.ulf
  if [[ -n "$UNITY_LICENSE" ]]; then
    echo "$UNITY_LICENSE" | tr -d '\r' > "$FILE_PATH"
  elif [[ -n "$UNITY_LICENSE_FILE" ]]; then
    cat "$UNITY_LICENSE_FILE" | tr -d '\r' > "$FILE_PATH"
  fi

  ACTIVATE_LOG="$(mktemp)"
  for ACTIVATE_ATTEMPT in $(seq 1 "$ACTIVATE_MAX_ATTEMPTS"); do
    # The exit code for personal activation is always 1 - success is
    # determined from the log output instead (same as ubuntu's own personal-
    # license branch).
    /Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/MacOS/Unity \
      -logFile - \
      -batchmode \
      -nographics \
      -quit \
      -manualLicenseFile "$FILE_PATH" \
      -projectPath "$ACTIVATE_LICENSE_PATH" 2>&1 | tee "$ACTIVATE_LOG"

    if grep -q 'Next license update check is after' "$ACTIVATE_LOG"; then
      UNITY_EXIT_CODE=0
      break
    fi
    UNITY_EXIT_CODE=1

    if [ "$ACTIVATE_ATTEMPT" -lt "$ACTIVATE_MAX_ATTEMPTS" ] && grep -qE "$ACTIVATE_TRANSIENT_LICENSE_ERROR_PATTERN" "$ACTIVATE_LOG"; then
      # Exponential backoff (20s, 40s, 80s, ...): a genuine Unity license-
      # server outage can outlast a flat delay's total retry window, seen
      # live this session on both mac and windows - doubling the wait each
      # attempt gives meaningfully more headroom to ride one out without
      # slowing down the common case (most retries succeed on attempt 2).
      ACTIVATE_RETRY_DELAY=$((ACTIVATE_RETRY_DELAY_SECONDS * (1 << (ACTIVATE_ATTEMPT - 1))))
      echo "Unity activation failed with a known-transient licensing error (attempt $ACTIVATE_ATTEMPT/$ACTIVATE_MAX_ATTEMPTS) - retrying in ${ACTIVATE_RETRY_DELAY}s..."
      sleep "$ACTIVATE_RETRY_DELAY"
      continue
    fi

    break
  done
  rm -f "$ACTIVATE_LOG" "$FILE_PATH"
elif [[ -n "$UNITY_SERIAL" && -n "$UNITY_EMAIL" && -n "$UNITY_PASSWORD" ]]; then
  #
  # SERIAL LICENSE MODE
  #
  echo "Requesting activation"

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
      # Exponential backoff (20s, 40s, 80s, ...): a genuine Unity license-
      # server outage can outlast a flat delay's total retry window, seen
      # live this session on both mac and windows - doubling the wait each
      # attempt gives meaningfully more headroom to ride one out without
      # slowing down the common case (most retries succeed on attempt 2).
      ACTIVATE_RETRY_DELAY=$((ACTIVATE_RETRY_DELAY_SECONDS * (1 << (ACTIVATE_ATTEMPT - 1))))
      echo "Unity activation failed with a known-transient licensing error (attempt $ACTIVATE_ATTEMPT/$ACTIVATE_MAX_ATTEMPTS) - retrying in ${ACTIVATE_RETRY_DELAY}s..."
      sleep "$ACTIVATE_RETRY_DELAY"
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
