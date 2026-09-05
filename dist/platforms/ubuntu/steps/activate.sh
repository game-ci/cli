#!/usr/bin/env bash

STEPS_DIR="${STEPS_DIR:-/steps}"
source "$STEPS_DIR/resolve_unity_path.sh"
source "$STEPS_DIR/licensing_method.sh"

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

# Which strategy to activate with. Normally resolved by the CLI and passed in
# as UNITY_LICENSING_METHOD; resolve_unity_licensing_method() falls back to
# deriving it from the individual credentials, so the branch conditions below
# read the same either way. See licensing_method.sh.
LICENSING_METHOD="$(resolve_unity_licensing_method)"
echo "Licensing method: ${LICENSING_METHOD:-<none>}"

# Same known-transient Unity license-server flakiness as mac/windows (see
# mac/steps/build.sh's matching comment) - retried a few times, but only on
# those known-transient signatures, so a genuine activation failure (bad
# serial, expired license, etc.) still fails immediately.
UNITY_ACTIVATE_MAX_ATTEMPTS="${UNITY_LICENSE_RETRY_MAX_ATTEMPTS:-4}"
UNITY_ACTIVATE_RETRY_DELAY_SECONDS=20
UNITY_ACTIVATE_TRANSIENT_PATTERN='TimeoutPolicy did not complete|Access token is unavailable|entitlement groups and 0 free entitlements|License activation has failed|No valid Unity Editor license found|License is not active'

if [[ "$LICENSING_METHOD" == "file" ]]; then
  #
  # LICENSE FILE MODE
  #
  # Activates Unity using a manually-activated license file (.ulf).
  #
  # This was for years the only way to activate a PERSONAL license. It no
  # longer is: Unity removed manual (offline) activation for Personal seats,
  # so license.unity3d.com/manual redirects to /new and reports "Offline
  # activation is available only for Enterprise and Industry seats". A .ulf
  # can therefore only be obtained on an Enterprise/Industry seat now, and
  # free-tier users want the `personal` branch below instead.
  #
  # Kept fully working for the seats that can still produce a .ulf, and for
  # self-hosted runners with an existing valid one.
  echo "Requesting activation (license file)"

  # Set the license file path
  FILE_PATH=UnityLicenseFile.ulf

  if [[ -n "$UNITY_LICENSE" ]]; then
    # Copy license file from Github variables
    echo "$UNITY_LICENSE" | tr -d '\r' > $FILE_PATH
  elif [[ -n "$UNITY_LICENSE_FILE" ]]; then
    # Copy license file from file system
    cat "$UNITY_LICENSE_FILE" | tr -d '\r' > $FILE_PATH
  fi

  for ATTEMPT in $(seq 1 "$UNITY_ACTIVATE_MAX_ATTEMPTS"); do
    # Activate license
    ACTIVATION_OUTPUT=$(${ENGINE_LAUNCH_WRAPPER:-} unity-editor \
        -logFile /dev/stdout \
        -quit \
        -manualLicenseFile $FILE_PATH)

    # Store the exit code from the verify command
    UNITY_EXIT_CODE=$?

    # The exit code for personal activation is always 1;
    # Determine whether activation was successful.
    #
    # Successful output should include the following:
    #
    #   "LICENSE SYSTEM [2020120 18:51:20] Next license update check is after 2019-11-25T18:23:38"
    #
    ACTIVATION_SUCCESSFUL=$(echo "$ACTIVATION_OUTPUT" | grep 'Next license update check is after' | wc -l)

    # Set exit code to 0 if activation was successful
    if [[ $ACTIVATION_SUCCESSFUL -eq 1 ]]; then
      UNITY_EXIT_CODE=0
      break
    fi

    if [ "$ATTEMPT" -lt "$UNITY_ACTIVATE_MAX_ATTEMPTS" ] && grep -qE "$UNITY_ACTIVATE_TRANSIENT_PATTERN" <<< "$ACTIVATION_OUTPUT"; then
      # Exponential backoff - see mac/steps/activate.sh's matching comment.
      UNITY_ACTIVATE_RETRY_DELAY=$((UNITY_ACTIVATE_RETRY_DELAY_SECONDS * (1 << (ATTEMPT - 1))))
      echo "Unity activation failed with a known-transient licensing error (attempt $ATTEMPT/$UNITY_ACTIVATE_MAX_ATTEMPTS) - retrying in ${UNITY_ACTIVATE_RETRY_DELAY}s..."
      sleep "$UNITY_ACTIVATE_RETRY_DELAY"
      continue
    fi

    break
  done

  # Remove license file
  rm -f $FILE_PATH

elif [[ "$LICENSING_METHOD" == "serial" ]]; then
  #
  # PROFESSIONAL (SERIAL) LICENSE MODE
  #
  # This will activate unity, using the activating process.
  #
  # Note: This is the preferred way for PROFESSIONAL LICENSES.
  #
  echo "Requesting activation (professional license)"

  ACTIVATE_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_ACTIVATE_MAX_ATTEMPTS"); do
    # Activate license
    ${ENGINE_LAUNCH_WRAPPER:-} unity-editor \
      -logFile /dev/stdout \
      -quit \
      -serial "$UNITY_SERIAL" \
      -username "$UNITY_EMAIL" \
      -password "$UNITY_PASSWORD" 2>&1 | tee "$ACTIVATE_LOG"

    # Store the exit code from the verify command
    UNITY_EXIT_CODE=${PIPESTATUS[0]}

    if [ "$UNITY_EXIT_CODE" -eq 0 ]; then
      break
    fi

    if [ "$ATTEMPT" -lt "$UNITY_ACTIVATE_MAX_ATTEMPTS" ] && grep -qE "$UNITY_ACTIVATE_TRANSIENT_PATTERN" "$ACTIVATE_LOG"; then
      # Exponential backoff - see mac/steps/activate.sh's matching comment.
      UNITY_ACTIVATE_RETRY_DELAY=$((UNITY_ACTIVATE_RETRY_DELAY_SECONDS * (1 << (ATTEMPT - 1))))
      echo "Unity activation failed with a known-transient licensing error (attempt $ATTEMPT/$UNITY_ACTIVATE_MAX_ATTEMPTS) - retrying in ${UNITY_ACTIVATE_RETRY_DELAY}s..."
      sleep "$UNITY_ACTIVATE_RETRY_DELAY"
      continue
    fi

    break
  done
  rm -f "$ACTIVATE_LOG"

elif [[ "$LICENSING_METHOD" == "floating" ]]; then
  #
  # Custom Unity License Server
  #
  echo "Adding licensing server config"

  ACTIVATE_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_ACTIVATE_MAX_ATTEMPTS"); do
    "$(unity_licensing_client_path)" --acquire-floating 2>&1 | tee license.txt "$ACTIVATE_LOG" > /dev/null
    UNITY_EXIT_CODE=${PIPESTATUS[0]}

    if [ "$UNITY_EXIT_CODE" -eq 0 ]; then
      break
    fi

    if [ "$ATTEMPT" -lt "$UNITY_ACTIVATE_MAX_ATTEMPTS" ] && grep -qE "$UNITY_ACTIVATE_TRANSIENT_PATTERN" "$ACTIVATE_LOG"; then
      # Exponential backoff - see mac/steps/activate.sh's matching comment.
      UNITY_ACTIVATE_RETRY_DELAY=$((UNITY_ACTIVATE_RETRY_DELAY_SECONDS * (1 << (ATTEMPT - 1))))
      echo "Floating license acquisition failed with a known-transient licensing error (attempt $ATTEMPT/$UNITY_ACTIVATE_MAX_ATTEMPTS) - retrying in ${UNITY_ACTIVATE_RETRY_DELAY}s..."
      sleep "$UNITY_ACTIVATE_RETRY_DELAY"
      continue
    fi

    break
  done
  rm -f "$ACTIVATE_LOG"

  PARSEDFILE=$(grep -oP '\".*?\"' < license.txt | tr -d '"')
  export FLOATING_LICENSE
  FLOATING_LICENSE=$(sed -n 2p <<< "$PARSEDFILE")
  FLOATING_LICENSE_TIMEOUT=$(sed -n 4p <<< "$PARSEDFILE")

  echo "Acquired floating license: \"$FLOATING_LICENSE\" with timeout $FLOATING_LICENSE_TIMEOUT"

elif [[ "$LICENSING_METHOD" == "personal" ]]; then
  #
  # PERSONAL (FREE) LICENSE MODE
  #
  # Acquires a Personal seat straight from Unity's licensing service using the
  # account credentials. This replaces the .ulf route for free-tier users:
  # Unity removed manual (offline) activation for Personal seats, so a .ulf
  # can no longer be obtained at all on a free account (see the `file` branch
  # above).
  #
  # Note this is the *licensing client*, not the editor. `unity-editor
  # -serial -username -password` is the serial path, which Unity documents as
  # not applying to Personal.
  #
  # The seat stays held until it is returned, unlike a .ulf. return_license.sh
  # has a matching branch, and runsteps.sh arms it on an EXIT trap so it runs
  # even when the build dies - a leaked Personal seat breaks every subsequent
  # run on the account, not just this one.
  echo "Requesting activation (personal license via Unity account)"

  # UNITY_PASSWORD is passed as an argument because the licensing client
  # offers no stdin or file-based alternative. It is therefore visible in this
  # container's process list for the duration of the call. Nothing here echoes
  # it, and no `set -x` is in effect on this path.
  ACTIVATE_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_ACTIVATE_MAX_ATTEMPTS"); do
    "$(unity_licensing_client_path)" \
      --activate-all \
      --include-personal \
      --username "$UNITY_EMAIL" \
      --password "$UNITY_PASSWORD" 2>&1 | tee "$ACTIVATE_LOG"

    UNITY_EXIT_CODE=${PIPESTATUS[0]}

    if [ "$UNITY_EXIT_CODE" -eq 0 ]; then
      break
    fi

    if [ "$ATTEMPT" -lt "$UNITY_ACTIVATE_MAX_ATTEMPTS" ] && grep -qE "$UNITY_ACTIVATE_TRANSIENT_PATTERN" "$ACTIVATE_LOG"; then
      # Exponential backoff - see mac/steps/activate.sh's matching comment.
      UNITY_ACTIVATE_RETRY_DELAY=$((UNITY_ACTIVATE_RETRY_DELAY_SECONDS * (1 << (ATTEMPT - 1))))
      echo "Personal activation failed with a known-transient licensing error (attempt $ATTEMPT/$UNITY_ACTIVATE_MAX_ATTEMPTS) - retrying in ${UNITY_ACTIVATE_RETRY_DELAY}s..."
      sleep "$UNITY_ACTIVATE_RETRY_DELAY"
      continue
    fi

    break
  done

  # Seat exhaustion and 2FA both surface as a generic non-zero exit, and need
  # completely different fixes - say which one it was while the log is still
  # around.
  if [ "$UNITY_EXIT_CODE" -ne 0 ]; then
    explain_personal_activation_failure "$ACTIVATE_LOG" || true
  fi
  rm -f "$ACTIVATE_LOG"

else
  #
  # NO LICENSE ACTIVATION STRATEGY MATCHED
  #
  # This will exit since no activation strategies could be matched.
  #
  echo "License activation strategy could not be determined."
  echo ""
  echo "Set one of the following:"
  echo "  * UNITY_EMAIL + UNITY_PASSWORD                 - Personal (free) seat"
  echo "  * UNITY_EMAIL + UNITY_PASSWORD + UNITY_SERIAL  - Pro/Plus seat"
  echo "  * UNITY_LICENSE or UNITY_LICENSE_FILE          - a .ulf (Enterprise/Industry)"
  echo "  * UNITY_LICENSING_SERVER                       - floating license server"
  echo ""
  echo "Visit https://game.ci/docs/github/getting-started for more"
  echo "details on how to set up one of the possible activation strategies."

  # Immediately exit as no UNITY_EXIT_CODE can be derrived.
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
