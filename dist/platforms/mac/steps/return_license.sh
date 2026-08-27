#!/usr/bin/env bash

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

# A failed license *return* is worse than a failed activate/build: it leaks
# the seat back to Unity's license pool. Every subsequent job (this run and
# every other one sharing the same account) then has one fewer seat/entitlement
# available, which surfaces as exactly the same "0 entitlement groups"/
# "License is not active" symptoms build.sh and activate.sh already retry on
# - a cascading failure mode that gets worse the longer a busy CI account runs,
# not a one-off flake. Neither branch below ever checked its exit code before
# now, so a failed return was silent - this retries on the same known-transient
# signatures and, critically, logs loudly if every attempt is exhausted, since
# a genuinely leaked seat needs a human to know about it (nothing here can
# force Unity's server to release a seat it thinks is still in use).
UNITY_LICENSE_RETURN_MAX_ATTEMPTS="${UNITY_LICENSE_RETRY_MAX_ATTEMPTS:-4}"
UNITY_LICENSE_RETURN_RETRY_DELAY_SECONDS=20
UNITY_LICENSE_RETURN_TRANSIENT_PATTERN='TimeoutPolicy did not complete|Access token is unavailable|entitlement groups and 0 free entitlements|License activation has failed|No valid Unity Editor license found|License is not active|Serial number unavailable'

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

  RETURN_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS"); do
    "/Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/$UNITY_LICENSING_CLIENT_SUBDIR/UnityLicensingClient.app/Contents/MacOS/Unity.Licensing.Client" \
      --return-floating "$FLOATING_LICENSE" 2>&1 | tee "$RETURN_LOG"
    RETURN_EXIT_CODE=${PIPESTATUS[0]}

    if [ "$RETURN_EXIT_CODE" -eq 0 ]; then
      break
    fi

    if [ "$ATTEMPT" -lt "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS" ] && grep -qE "$UNITY_LICENSE_RETURN_TRANSIENT_PATTERN" "$RETURN_LOG"; then
      echo "Floating license return failed with a known-transient licensing error (attempt $ATTEMPT/$UNITY_LICENSE_RETURN_MAX_ATTEMPTS) - retrying in ${UNITY_LICENSE_RETURN_RETRY_DELAY_SECONDS}s..."
      sleep "$UNITY_LICENSE_RETURN_RETRY_DELAY_SECONDS"
      continue
    fi

    break
  done
  if [ "$RETURN_EXIT_CODE" -ne 0 ]; then
    echo "##[warning] Failed to return floating license \"$FLOATING_LICENSE\" after $UNITY_LICENSE_RETURN_MAX_ATTEMPTS attempts - this seat may still be held by Unity's license server."
  fi
  rm -f "$RETURN_LOG"
elif [[ -n "$UNITY_SERIAL" ]]; then
  #
  # SERIAL LICENSE MODE
  #
  # This will return the license that is currently in use.
  #
  RETURN_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS"); do
    /Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/MacOS/Unity \
      -logFile - \
      -batchmode \
      -nographics \
      -quit \
      -username "$UNITY_EMAIL" \
      -password "$UNITY_PASSWORD" \
      -returnlicense \
      -projectPath "$ACTIVATE_LICENSE_PATH" 2>&1 | tee "$RETURN_LOG"
    RETURN_EXIT_CODE=${PIPESTATUS[0]}

    if [ "$RETURN_EXIT_CODE" -eq 0 ]; then
      break
    fi

    if [ "$ATTEMPT" -lt "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS" ] && grep -qE "$UNITY_LICENSE_RETURN_TRANSIENT_PATTERN" "$RETURN_LOG"; then
      echo "License return failed with a known-transient licensing error (attempt $ATTEMPT/$UNITY_LICENSE_RETURN_MAX_ATTEMPTS) - retrying in ${UNITY_LICENSE_RETURN_RETRY_DELAY_SECONDS}s..."
      sleep "$UNITY_LICENSE_RETURN_RETRY_DELAY_SECONDS"
      continue
    fi

    break
  done
  if [ "$RETURN_EXIT_CODE" -ne 0 ]; then
    echo "##[warning] Failed to return the Unity license after $UNITY_LICENSE_RETURN_MAX_ATTEMPTS attempts - this seat may still be held by Unity's license server."
  fi
  rm -f "$RETURN_LOG"
fi

# Return to previous working directory
popd
