#!/usr/bin/env bash

STEPS_DIR="${STEPS_DIR:-/steps}"
source "$STEPS_DIR/resolve_unity_path.sh"
source "$STEPS_DIR/licensing_method.sh"

# Run in ACTIVATE_LICENSE_PATH directory
echo "Changing to \"$ACTIVATE_LICENSE_PATH\" directory."
pushd "$ACTIVATE_LICENSE_PATH"

# Which license to hand back. Not simply activate.sh's strategy - the original
# conditions here keyed off the raw env vars, and are preserved so that no
# return which used to happen stops happening. See licensing_method.sh.
RETURN_STRATEGY="$(resolve_unity_license_return_strategy)"

# A failed license *return* is worse than a failed activate/build: it leaks
# the seat back to Unity's license pool. Every subsequent job (this run and
# every other one sharing the same account, on any OS) then has one fewer
# seat/entitlement available, which surfaces as exactly the same "0
# entitlement groups"/"License is not active" symptoms elsewhere - a
# cascading failure mode that gets worse the longer a busy CI account runs,
# not a one-off flake. Neither branch below ever checked its exit code
# before now, so a failed return was silent - this retries on the same
# known-transient signatures build.sh/activate.sh already retry on (see
# mac/steps/build.sh) and, critically, logs loudly if every attempt is
# exhausted, since a genuinely leaked seat needs a human to know about it.
UNITY_LICENSE_RETURN_MAX_ATTEMPTS="${UNITY_LICENSE_RETRY_MAX_ATTEMPTS:-4}"
UNITY_LICENSE_RETURN_RETRY_DELAY_SECONDS=20
UNITY_LICENSE_RETURN_TRANSIENT_PATTERN='TimeoutPolicy did not complete|Access token is unavailable|entitlement groups and 0 free entitlements|License activation has failed|No valid Unity Editor license found|License is not active|Serial number unavailable'

if [[ "$RETURN_STRATEGY" == "floating" ]]; then
  #
  # Return any floating license used.
  #
  echo "Returning floating license: \"$FLOATING_LICENSE\""

  RETURN_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS"); do
    "$(unity_licensing_client_path)" --return-floating "$FLOATING_LICENSE" 2>&1 | tee "$RETURN_LOG"
    RETURN_EXIT_CODE=${PIPESTATUS[0]}

    if [ "$RETURN_EXIT_CODE" -eq 0 ]; then
      break
    fi

    if [ "$ATTEMPT" -lt "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS" ] && grep -qE "$UNITY_LICENSE_RETURN_TRANSIENT_PATTERN" "$RETURN_LOG"; then
      # Exponential backoff - see mac/steps/activate.sh's matching comment.
      UNITY_LICENSE_RETURN_DELAY=$((UNITY_LICENSE_RETURN_RETRY_DELAY_SECONDS * (1 << (ATTEMPT - 1))))
      echo "Floating license return failed with a known-transient licensing error (attempt $ATTEMPT/$UNITY_LICENSE_RETURN_MAX_ATTEMPTS) - retrying in ${UNITY_LICENSE_RETURN_DELAY}s..."
      sleep "$UNITY_LICENSE_RETURN_DELAY"
      continue
    fi

    break
  done
  if [ "$RETURN_EXIT_CODE" -ne 0 ]; then
    echo "##[warning] Failed to return floating license \"$FLOATING_LICENSE\" after $UNITY_LICENSE_RETURN_MAX_ATTEMPTS attempts - this seat may still be held by Unity's license server."
  fi
  rm -f "$RETURN_LOG"
elif [[ "$RETURN_STRATEGY" == "personal" ]]; then
  #
  # PERSONAL (FREE) LICENSE MODE
  #
  # Releases the Personal seat acquired by activate.sh's matching branch.
  #
  # This is the branch that did not exist before Unity moved Personal onto
  # seats: a .ulf was a file, so there was nothing to give back, and the whole
  # `file` strategy still has no return step for that reason. A Personal seat
  # is different - hold it and every later run on this account fails with "no
  # available seats", which is why runsteps.sh arms this on an EXIT trap.
  echo "Returning personal license seat"

  RETURN_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS"); do
    "$(unity_licensing_client_path)" --return-ulf 2>&1 | tee "$RETURN_LOG"
    RETURN_EXIT_CODE=${PIPESTATUS[0]}

    if [ "$RETURN_EXIT_CODE" -eq 0 ]; then
      break
    fi

    if [ "$ATTEMPT" -lt "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS" ] && grep -qE "$UNITY_LICENSE_RETURN_TRANSIENT_PATTERN" "$RETURN_LOG"; then
      # Exponential backoff - see mac/steps/activate.sh's matching comment.
      UNITY_LICENSE_RETURN_DELAY=$((UNITY_LICENSE_RETURN_RETRY_DELAY_SECONDS * (1 << (ATTEMPT - 1))))
      echo "Personal license return failed with a known-transient licensing error (attempt $ATTEMPT/$UNITY_LICENSE_RETURN_MAX_ATTEMPTS) - retrying in ${UNITY_LICENSE_RETURN_DELAY}s..."
      sleep "$UNITY_LICENSE_RETURN_DELAY"
      continue
    fi

    break
  done
  if [ "$RETURN_EXIT_CODE" -ne 0 ]; then
    echo "##[warning] Failed to return the Personal license seat after $UNITY_LICENSE_RETURN_MAX_ATTEMPTS attempts."
    echo "##[warning] That seat is likely still held. Release it at https://id.unity.com or"
    echo "##[warning] run 'game-ci return-license', otherwise later runs on this account will"
    echo "##[warning] fail with 'no available seats'."
  fi
  rm -f "$RETURN_LOG"
elif [[ "$RETURN_STRATEGY" == "serial" ]]; then
  #
  # PROFESSIONAL (SERIAL) LICENSE MODE
  #
  # This will return the license that is currently in use.
  #
  # -projectPath points at the scratch activation directory, not the built
  # project, so Unity doesn't reopen the real project (and reimport its
  # library against whatever the editor's default target is) just to
  # return the license (game-ci/cli#33).
  RETURN_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS"); do
    unity-editor \
      -logFile /dev/stdout \
      -quit \
      -returnlicense \
      -projectPath "$ACTIVATE_LICENSE_PATH" 2>&1 | tee "$RETURN_LOG"
    RETURN_EXIT_CODE=${PIPESTATUS[0]}

    if [ "$RETURN_EXIT_CODE" -eq 0 ]; then
      break
    fi

    if [ "$ATTEMPT" -lt "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS" ] && grep -qE "$UNITY_LICENSE_RETURN_TRANSIENT_PATTERN" "$RETURN_LOG"; then
      # Exponential backoff - see mac/steps/activate.sh's matching comment.
      UNITY_LICENSE_RETURN_DELAY=$((UNITY_LICENSE_RETURN_RETRY_DELAY_SECONDS * (1 << (ATTEMPT - 1))))
      echo "License return failed with a known-transient licensing error (attempt $ATTEMPT/$UNITY_LICENSE_RETURN_MAX_ATTEMPTS) - retrying in ${UNITY_LICENSE_RETURN_DELAY}s..."
      sleep "$UNITY_LICENSE_RETURN_DELAY"
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
