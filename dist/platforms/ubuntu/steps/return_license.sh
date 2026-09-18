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
UNITY_LICENSE_RETURN_MAX_ATTEMPTS="${UNITY_LICENSE_RETRY_MAX_ATTEMPTS:-5}"
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
  echo "Returning floating license: \"$FLOATING_LICENSE\""

  RETURN_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS"); do
    "$(unity_licensing_client_path)" --return-floating "$FLOATING_LICENSE" 2>&1 | tee "$RETURN_LOG"
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
      UNITY_LICENSE_RETURN_DELAY="$(unity_license_retry_delay "$ATTEMPT")"
      unity_license_retry_notice "Floating license return" "$ATTEMPT" "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS" "$UNITY_LICENSE_RETURN_DELAY"
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
  # Releases the Personal seat acquired by activate.sh's matching branch.
  #
  # This is the branch that did not exist before Unity moved Personal onto
  # seats: a .ulf was a file, so there was nothing to give back, and the whole
  # `file` strategy still has no return step for that reason. A Personal seat
  # is different - hold it and every later run on this account fails with "no
  # available seats", which is why runsteps.sh arms this on an EXIT trap.
  echo "Returning personal license seat"

  # The return has to use the same route the activation used, and it picks it
  # the same way - by asking the bundled licensing client what it can do -
  # so the two stay in step by construction rather than by a flag one side
  # has to remember to set.
  #
  # activate.sh falls back to the editor when the client predates
  # --include-personal (2020.3.49f1 ships 1.12.1). That route takes an
  # *entitlement* seat; nothing writes Unity_lic.ulf, so --return-ulf can only
  # ever answer:
  #
  #   An error occured while trying to return the ULF license.
  #   Ulf license file not found (/root/.local/share/unity3d/Unity/Unity_lic.ulf) (1404)
  #
  # Measured on a user's 2020.3.49f1 run which activated cleanly ("Serial
  # number assigned to: ...-UnityPers...", "Pro License: NO") and then
  # could not release the seat it had just taken - on exactly the versions the
  # editor fallback exists to rescue.
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
    RETURN_PERSONAL_COMMAND=(unity-editor -logFile /dev/stdout -quit -returnlicense -username "$UNITY_EMAIL" -password "$UNITY_PASSWORD" -projectPath "$ACTIVATE_LICENSE_PATH")
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

    # The capability probe above says which route activate.sh *would* take, not
    # which one it did - a cached seat, a fallback, or a future change to
    # activate.sh can leave the client route facing an entitlement seat. When
    # that happens the client says so plainly, so switch routes and try the one
    # that can actually hand it back, instead of warning about a seat no
    # correct command was ever run against.
    if [ "$RETURN_PERSONAL_ROUTE" = client ] &&
       grep -qF "$UNITY_LICENSE_RETURN_NO_ULF_PATTERN" "$RETURN_LOG"; then
      echo "No ULF license file to return - this seat is entitlement-based; returning it through the editor instead."
      RETURN_PERSONAL_ROUTE=editor
      RETURN_PERSONAL_COMMAND=(unity-editor -logFile /dev/stdout -quit -returnlicense -username "$UNITY_EMAIL" -password "$UNITY_PASSWORD" -projectPath "$ACTIVATE_LICENSE_PATH")
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
      UNITY_LICENSE_RETURN_DELAY="$(unity_license_retry_delay "$ATTEMPT")"
      unity_license_retry_notice "Personal license return" "$ATTEMPT" "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS" "$UNITY_LICENSE_RETURN_DELAY"
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
  # PROFESSIONAL (SERIAL) LICENSE MODE
  #
  # This will return the license that is currently in use.
  #
  # -projectPath points at the scratch activation directory, not the built
  # project, so Unity doesn't reopen the real project (and reimport its
  # library against whatever the editor's default target is) just to
  # return the license (game-ci/cli#33).
  #
  # -username/-password mirror the serial branch of activate.sh, and Unity
  # documents them on -returnlicense exactly as on activation:
  # https://docs.unity3d.com/Manual/ManagingYourUnityLicense.html (documented identically
  # for every Unity line game-ci tests: 2018.4, 2019.4, 2020.3, 2022.3, 6000.x)
  # Without them the returning editor starts a fresh licensing client that then fails to return the license.
  RETURN_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS"); do
    unity-editor \
      -logFile /dev/stdout \
      -quit \
      -returnlicense \
      -username "$UNITY_EMAIL" \
      -password "$UNITY_PASSWORD" \
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
      UNITY_LICENSE_RETURN_DELAY="$(unity_license_retry_delay "$ATTEMPT")"
      unity_license_retry_notice "License return" "$ATTEMPT" "$UNITY_LICENSE_RETURN_MAX_ATTEMPTS" "$UNITY_LICENSE_RETURN_DELAY"
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
