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

# A machine-binding mismatch is permanent, not flaky: the .ulf is cryptographically
# bound to the machine that requested it, and no amount of retrying will bind it to
# this one. It has to be checked separately because the same failing activation also
# emits "Access token is unavailable" and "License activation has failed", both of
# which ARE in the transient list - so without this the run burned four attempts and
# ~2.5 minutes of backoff before reaching the fallback that was going to handle it
# anyway (observed on MirrorNetworking/Mirror, 2020.3.49f1).
UNITY_ACTIVATE_PERMANENT_PATTERN="Machine bindings don't match"

# `--include-personal` does not exist on every licensing client. Unity 2020.3.49f1
# ships Unity.Licensing.Client 1.12.1, which supports --activate-all/--username/
# --password but rejects --include-personal outright:
#
#   Option 'include-personal' is unknown.
#   ... CommandLine.UnknownOptionError ... Exit code was: 33
#
# Passing it unconditionally therefore made the machine-binding fallback fail on
# exactly the older versions it needed to rescue. Probe the client's own help text
# rather than guessing from the editor version - the client is versioned
# independently of the editor that bundles it, so a version comparison would be
# wrong the moment Unity backports or skips a client release.
unity_licensing_personal_flags() {
  local client_help
  client_help="$("$(unity_licensing_client_path)" --help 2>&1 || true)"

  if grep -q -- '--include-personal' <<< "$client_help"; then
    printf '%s' '--activate-all --include-personal'
  else
    printf '%s' '--activate-all'
  fi
}

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
  # self-hosted runners with an existing valid one. Falls back to activating
  # through the Unity account instead, further down, specifically when this
  # fails because the file's machine binding doesn't match this machine.
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

  # Unlike the serial/floating/personal branches below, this used to capture
  # Unity's output into a variable via command substitution instead of
  # streaming it through `tee` - so on a genuine (non-transient) activation
  # failure, the user got nothing but the generic "Unclassified error occured
  # while trying to activate license." at the bottom of this script, with the
  # actual reason Unity gave silently discarded. `tee` now mirrors it live to
  # the build log the same way every other licensing method here already
  # does (game-ci/cli#252).
  ACTIVATE_LOG="$(mktemp)"
  for ATTEMPT in $(seq 1 "$UNITY_ACTIVATE_MAX_ATTEMPTS"); do
    # Activate license
    ${ENGINE_LAUNCH_WRAPPER:-} unity-editor \
        -logFile /dev/stdout \
        -quit \
        -manualLicenseFile $FILE_PATH 2>&1 | tee "$ACTIVATE_LOG"

    # Store the exit code from the verify command
    UNITY_EXIT_CODE=${PIPESTATUS[0]}

    # The exit code for personal activation is always 1;
    # Determine whether activation was successful.
    #
    # Successful output should include the following:
    #
    #   "LICENSE SYSTEM [2020120 18:51:20] Next license update check is after 2019-11-25T18:23:38"
    #
    if grep -q 'Next license update check is after' "$ACTIVATE_LOG"; then
      UNITY_EXIT_CODE=0
      break
    fi

    if grep -qF "$UNITY_ACTIVATE_PERMANENT_PATTERN" "$ACTIVATE_LOG"; then
      # Permanent - stop here so the fallback below runs immediately.
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

  # A personal .ulf is bound to whichever machine originally requested it,
  # so loading it directly fails with "Machine bindings don't match" on any
  # *other* machine - which is every ephemeral CI container, every run. When
  # that is the exact failure and full account credentials are also
  # available, fall back to activating through the account instead, which
  # works on any machine. Gated on this one specific, recognisable failure
  # signature (not "any failure", and not a blanket preference applied
  # up front) so every setup that already worked keeps working exactly as
  # before - a self-hosted runner with a persistent, genuinely-matching .ulf,
  # or an older Unity version whose bundled licensing client never enforced
  # this check at all (confirmed live: 2020.3.49f1's activation succeeded via
  # plain file loading against MirrorNetworking/Mirror, the same repo that
  # hit "Machine bindings don't match" on 6000.6.0f1 - two earlier, narrower
  # fixes here either couldn't reliably reuse a real personal .ulf's embedded
  # serial, or unconditionally preferred personal over file and broke that
  # 2020.3.49f1 case outright, since its licensing client predates the
  # --activate-all/--include-personal flags personal activation needs;
  # see game-ci/cli#254/#255/#256's own history).
  if [[ "$UNITY_EXIT_CODE" -ne 0 ]] && [[ -n "$UNITY_EMAIL" ]] && [[ -n "$UNITY_PASSWORD" ]] &&
     grep -qi "Machine bindings don't match" "$ACTIVATE_LOG"; then
    echo "##[warning] The license file's machine binding doesn't match this machine - falling back to activating with the Unity account (UNITY_EMAIL/UNITY_PASSWORD) instead."
    rm -f "$ACTIVATE_LOG"
    ACTIVATE_LOG="$(mktemp)"

    for ATTEMPT in $(seq 1 "$UNITY_ACTIVATE_MAX_ATTEMPTS"); do
      "$(unity_licensing_client_path)" \
        $(unity_licensing_personal_flags) \
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

    if [ "$UNITY_EXIT_CODE" -ne 0 ]; then
      explain_personal_activation_failure "$ACTIVATE_LOG" || true
    fi

    # Consumed by resolve_unity_license_return_strategy (licensing_method.sh),
    # in the same shell session return_license.sh runs in (see runsteps.sh) -
    # only ever set on a successful fallback, since runsteps.sh exits
    # immediately on a failed activation without ever reaching the return
    # step at all.
    if [ "$UNITY_EXIT_CODE" -eq 0 ]; then
      export GAME_CI_ACTIVATED_VIA=personal
    fi
  fi

  rm -f "$ACTIVATE_LOG"

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
      $(unity_licensing_personal_flags) \
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
  echo "See the activation output above (starting at \"Requesting activation\") for the actual reason Unity gave."
  exit $UNITY_EXIT_CODE
fi

# Return to previous working directory
popd
