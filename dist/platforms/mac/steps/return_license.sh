#!/usr/bin/env bash

STEPS_DIR="${STEPS_DIR:-$ACTION_FOLDER/platforms/mac/steps}"
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

# Permanent by construction - see the guards below.
UNITY_LICENSE_RETURN_PERMANENT_PATTERN="Machine bindings don't match"

# Not a failure to retry, and usually not a failure at all: it means there is
# no Unity_lic.ulf to hand back, because the seat this run holds is an
# entitlement rather than a file. See the personal branch below.
UNITY_LICENSE_RETURN_NO_ULF_PATTERN='Ulf license file not found'

# Unity returns the licence and THEN exits non-zero. Measured on 2022.3.62f3,
# same container, matching machine id:
#
#   [Licensing::Module] Error: Access token is unavailable; failed to update
#   [Licensing::Module] Error: Failed to return entitlement license
#   [Licensing::Client] Successfully returned ULF license with serial number: "..."
#   exit=1
#
# The seat really is returned - a following --return-ulf reports "Ulf license
# file not found". But the exit code says failure and the log carries "Access
# token is unavailable", which is in the transient list, so this retried four
# times against an already-returned licence and then warned that the return had
# failed. Reported by a user still seeing "attempt 3/4" on v0.1.64, whose own
# log showed the same machine id throughout - which ruled out the binding
# mismatch that release had fixed.
#
# So success is read from the log, not the exit code, exactly as activation
# already does for the same reason in the opposite direction.
# "Successfully returned the entitlement license" is the editor's wording for a
# Personal seat, and it is the line that matters: measured on 2020.3.49f1,
# 2022.3.62f3 and 6000.6.0f1 the seat really is handed back. The editor then
# tries a ULF return it cannot do and says "Serial number unavailable for ULF
# return", which IS in the transient list - so without this string 2020.3
# returned the same already-returned licence four times, burnt ~2.5 minutes of
# backoff, and warned that the return had failed.
UNITY_LICENSE_RETURN_SUCCESS_PATTERN='Successfully returned ULF license|Successfully returned floating license|Successfully returned the entitlement license|License has been returned'

if [[ "$RETURN_STRATEGY" == "floating" ]]; then
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

  # The Frameworks -> Helpers move in Unity 6000.3+ now lives in
  # resolve_unity_path.sh, so this and activate.sh can't drift apart.
  RETURN_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS"); do
    "$(unity_licensing_client_path)" \
      --return-floating "$FLOATING_LICENSE" 2>&1 | tee "$RETURN_LOG"
    RETURN_EXIT_CODE=${PIPESTATUS[0]}

    if grep -qE "$UNITY_LICENSE_RETURN_SUCCESS_PATTERN" "$RETURN_LOG"; then
      RETURN_EXIT_CODE=0
      break
    fi

    if [ "$RETURN_EXIT_CODE" -eq 0 ]; then
      break
    fi

    # "Machine bindings don't match" on a RETURN is permanent, exactly as it is
    # on an activation: the entitlement is bound to the machine that activated
    # it, and no retry rebinds it. It has to be checked separately because the
    # same failing return also emits "Access token is unavailable; failed to
    # update", which IS in the transient list - so the real reason was masked
    # and the run burned all four attempts and ~2.5 minutes of backoff before
    # warning anyway. Reported by a user as "we spend an extra 2-3m at the end
    # of the test action trying to return a license, which will fail every
    # time", and reproduced in this repo's own licensing matrix.
    if grep -qF "$UNITY_LICENSE_RETURN_PERMANENT_PATTERN" "$RETURN_LOG"; then
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
    echo "::warning::Failed to return floating license \"$FLOATING_LICENSE\" after $ATTEMPT attempt(s) - this seat may still be held by Unity's license server."
  fi
  rm -f "$RETURN_LOG"
elif [[ "$RETURN_STRATEGY" == "personal" ]]; then
  #
  # PERSONAL (FREE) LICENSE MODE
  #
  # Releases the Personal seat acquired by activate.sh's matching branch. A
  # Personal seat stays consumed until returned, so skipping this breaks every
  # later run on the account - see ubuntu/steps/activate.sh's fuller comment.
  echo "Returning personal license seat"

  # The return has to use the same route the activation used, and it picks it
  # the same way - by asking the bundled licensing client what it can do - so
  # the two stay in step by construction rather than by a flag one side has to
  # remember to set. activate.sh falls back to the editor when the client
  # predates --include-personal, and that route takes an *entitlement* seat
  # with no Unity_lic.ulf behind it, which --return-ulf can only answer with
  # "Ulf license file not found ... (1404)". See ubuntu/steps/return_license.sh
  # for the measured 2020.3.49f1 case.
  # -username/-password are not optional. Without them the editor cannot
  # refresh its access token, so the entitlement return fails and it falls
  # through to a ULF return it also cannot do:
  #
  #   [Licensing::Module] Error: Access token is unavailable; failed to update
  #   [Licensing::Module] Error: Failed to return entitlement license
  #   [Licensing::Module] Error: Serial number unavailable for ULF return
  #
  # Measured in this repo's own licensing matrix on 2020.3.49f1, 2022.3.62f3
  # and 6000.0.36f1, with an identical Machine Id either side of the return -
  # so this is the credentials, not a binding mismatch. The serial branch below
  # already passes them for the same reason (game-ci/unity-test-runner#310).
  if unity_licensing_client_supports_personal; then
    RETURN_PERSONAL_ROUTE=client
    RETURN_PERSONAL_COMMAND=("$(unity_licensing_client_path)" --return-ulf)
  else
    RETURN_PERSONAL_ROUTE=editor
    RETURN_PERSONAL_COMMAND=("/Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/MacOS/Unity" -logFile - -batchmode -nographics -quit -returnlicense -username "$UNITY_EMAIL" -password "$UNITY_PASSWORD" -projectPath "$ACTIVATE_LICENSE_PATH")
  fi

  RETURN_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS"); do
    "${RETURN_PERSONAL_COMMAND[@]}" 2>&1 | tee "$RETURN_LOG"
    RETURN_EXIT_CODE=${PIPESTATUS[0]}

    if grep -qE "$UNITY_LICENSE_RETURN_SUCCESS_PATTERN" "$RETURN_LOG"; then
      RETURN_EXIT_CODE=0
      break
    fi

    if [ "$RETURN_EXIT_CODE" -eq 0 ]; then
      break
    fi

    # The capability probe says which route activate.sh *would* take, not which
    # one it did. When the client route meets an entitlement seat it says so
    # plainly, so switch to the route that can hand it back rather than warn
    # about a seat no correct command was ever run against.
    if [ "$RETURN_PERSONAL_ROUTE" = client ] &&
       grep -qF "$UNITY_LICENSE_RETURN_NO_ULF_PATTERN" "$RETURN_LOG"; then
      echo "No ULF license file to return - this seat is entitlement-based; returning it through the editor instead."
      RETURN_PERSONAL_ROUTE=editor
      RETURN_PERSONAL_COMMAND=("/Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/MacOS/Unity" -logFile - -batchmode -nographics -quit -returnlicense -username "$UNITY_EMAIL" -password "$UNITY_PASSWORD" -projectPath "$ACTIVATE_LICENSE_PATH")
      continue
    fi

    # Nothing to hand back on the editor route either: no seat is being held,
    # so this is not the leak the warning below describes.
    if grep -qF "$UNITY_LICENSE_RETURN_NO_ULF_PATTERN" "$RETURN_LOG"; then
      echo "No Personal license seat was held - nothing to return."
      RETURN_EXIT_CODE=0
      break
    fi

    # "Machine bindings don't match" on a RETURN is permanent, exactly as it is
    # on an activation: the entitlement is bound to the machine that activated
    # it, and no retry rebinds it. It has to be checked separately because the
    # same failing return also emits "Access token is unavailable; failed to
    # update", which IS in the transient list - so the real reason was masked
    # and the run burned all four attempts and ~2.5 minutes of backoff before
    # warning anyway. Reported by a user as "we spend an extra 2-3m at the end
    # of the test action trying to return a license, which will fail every
    # time", and reproduced in this repo's own licensing matrix.
    if grep -qF "$UNITY_LICENSE_RETURN_PERMANENT_PATTERN" "$RETURN_LOG"; then
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
    echo "::warning::Failed to return the Personal license seat after $ATTEMPT attempt(s).%0AThat seat is likely still held. Release it at https://id.unity.com or run 'game-ci return-license', otherwise later runs on this account will fail with 'no available seats'."
  fi
  rm -f "$RETURN_LOG"
elif [[ "$RETURN_STRATEGY" == "serial" ]]; then
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

    if grep -qE "$UNITY_LICENSE_RETURN_SUCCESS_PATTERN" "$RETURN_LOG"; then
      RETURN_EXIT_CODE=0
      break
    fi

    if [ "$RETURN_EXIT_CODE" -eq 0 ]; then
      break
    fi

    # "Machine bindings don't match" on a RETURN is permanent, exactly as it is
    # on an activation: the entitlement is bound to the machine that activated
    # it, and no retry rebinds it. It has to be checked separately because the
    # same failing return also emits "Access token is unavailable; failed to
    # update", which IS in the transient list - so the real reason was masked
    # and the run burned all four attempts and ~2.5 minutes of backoff before
    # warning anyway. Reported by a user as "we spend an extra 2-3m at the end
    # of the test action trying to return a license, which will fail every
    # time", and reproduced in this repo's own licensing matrix.
    if grep -qF "$UNITY_LICENSE_RETURN_PERMANENT_PATTERN" "$RETURN_LOG"; then
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
    if grep -qF "$UNITY_LICENSE_RETURN_PERMANENT_PATTERN" "$RETURN_LOG"; then
      # Naming the cause matters: "this seat may still be held" sends people
      # hunting a leak on their Unity account, when the licence was bound to a
      # machine that no longer exists.
      echo "::warning::Could not return the Unity license: it is bound to a different machine than the one returning it.%0AThis is expected when activation and return happen on different machines or containers.%0AIf activations later run out, release them at https://id.unity.com."
    else
      echo "::warning::Failed to return the Unity license after $ATTEMPT attempt(s) - this seat may still be held by Unity's license server."
    fi
  fi
  rm -f "$RETURN_LOG"
fi

# Return to previous working directory
popd
