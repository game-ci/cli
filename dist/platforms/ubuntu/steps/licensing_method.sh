#!/usr/bin/env bash

# Shared licensing helpers for activate.sh / return_license.sh.

#
# Resolves which activation strategy the license steps should take.
#
# UNITY_LICENSING_METHOD, when set, is an explicit choice made by the caller
# (`--unityLicensingMethod`, see src/logic/unity/license/licensing-method.ts)
# and wins outright.
#
# Otherwise the chain below is used: file -> serial -> floating -> personal,
# including the "serial credentials must all three be present" rule that lets
# a .ulf win when they are not. This is now the one canonical order every
# platform uses (game-ci/cli#256 unified the windows *container* script set,
# which used to check floating before serial - see
# dist/platforms/windows/licensing_method.ps1's own history for why that
# divergence existed and why it was safe to remove).
#
#
# Retry policy for licensing calls that fail with a known-transient error.
#
# Both halves live here - how long to wait, and what to tell the user while they
# wait - because they used to be copied into every retry loop in this
# repository: thirty-odd near-identical messages across two languages and four
# platforms, each with its own variable names. That made the wording impossible
# to change once and the delay impossible to tune at all, since the base was a
# bare literal in each file.
#
# The notice is a ::warning:: rather than a plain echo so it surfaces in the
# Actions UI where a user actually looks, instead of several thousand lines into
# a build log. Retrying is a decision this tool makes on the user's behalf, and
# a run that quietly re-tries for five minutes then succeeds looks identical to
# one that was never in trouble - which is information they are entitled to.
#
UNITY_LICENSE_RETRY_DELAY_SECONDS_DEFAULT=20

# Seconds to wait after a failed attempt, doubling each time: 20, 40, 80, 160.
# Override UNITY_LICENSE_RETRY_DELAY_SECONDS to widen or narrow the whole window
# without editing anything here.
#
# $1 - the attempt that just failed (1-based).
unity_license_retry_delay() {
  local attempt="$1"
  local base="${UNITY_LICENSE_RETRY_DELAY_SECONDS:-$UNITY_LICENSE_RETRY_DELAY_SECONDS_DEFAULT}"
  echo $((base * (1 << (attempt - 1))))
}

# $1 - what failed, e.g. "Unity activation". $2 - attempt. $3 - max. $4 - delay.
unity_license_retry_notice() {
  echo "::warning::$1 hit a known-transient Unity licensing error (attempt $2 of $3). This is normally a temporary problem at Unity's end rather than anything wrong with your project or credentials, so it will retry in $4s."
}

resolve_unity_licensing_method() {
  if [[ -n "${UNITY_LICENSING_METHOD:-}" ]]; then
    echo "$UNITY_LICENSING_METHOD"
    return 0
  fi

  local resolved
  if { [[ -z "${UNITY_SERIAL:-}" ]] || [[ -z "${UNITY_EMAIL:-}" ]] || [[ -z "${UNITY_PASSWORD:-}" ]]; } &&
     { [[ -n "${UNITY_LICENSE:-}" ]] || [[ -n "${UNITY_LICENSE_FILE:-}" ]]; }; then
    resolved="file"
  elif [[ -n "${UNITY_SERIAL:-}" && -n "${UNITY_EMAIL:-}" && -n "${UNITY_PASSWORD:-}" ]]; then
    resolved="serial"
  elif [[ -n "${UNITY_LICENSING_SERVER:-}" ]]; then
    resolved="floating"
  elif [[ -n "${UNITY_EMAIL:-}" && -n "${UNITY_PASSWORD:-}" ]]; then
    resolved="personal"
  else
    resolved=""
  fi

  warn_if_licensing_method_ambiguous "$resolved" >&2

  echo "$resolved"
}

#
# Warns whenever a credential that names a *specific* strategy was provided
# but a different strategy was auto-resolved instead - silently ignoring a
# credential like this is exactly what took two real regressions
# (game-ci/cli#254, #255) to fully diagnose, because nothing said out loud
# which of several plausible strategies actually got used.
#
# Only runs for auto resolution: an explicit UNITY_LICENSING_METHOD is a
# deliberate choice and is never second-guessed (resolve_unity_licensing_method
# returns before this is ever called in that case).
#
warn_if_licensing_method_ambiguous() {
  local resolved="$1"

  if [[ "$resolved" != "file" ]] && { [[ -n "${UNITY_LICENSE:-}" ]] || [[ -n "${UNITY_LICENSE_FILE:-}" ]]; }; then
    echo "##[warning] A Unity license file (.ulf) was provided, but '$resolved' activation is being used instead - Unity account credentials take precedence when both are present. Set UNITY_LICENSING_METHOD=file to force loading the file directly."
  fi
  if [[ "$resolved" != "serial" ]] && [[ -n "${UNITY_SERIAL:-}" ]]; then
    echo "##[warning] UNITY_SERIAL was provided, but '$resolved' activation is being used instead - serial activation needs UNITY_SERIAL, UNITY_EMAIL and UNITY_PASSWORD all set together. Set UNITY_LICENSING_METHOD=serial to force it, or provide the missing credential(s)."
  fi
  if [[ "$resolved" != "floating" ]] && [[ -n "${UNITY_LICENSING_SERVER:-}" ]]; then
    echo "##[warning] UNITY_LICENSING_SERVER was provided, but '$resolved' activation is being used instead. Set UNITY_LICENSING_METHOD=floating to force it."
  fi
}

#
# Resolves which license the return step should hand back.
#
# Deliberately not just "whatever activate.sh used". The original
# return_license.sh keyed its branches off the raw env vars rather than off the
# activation strategy, which means a .ulf run with UNITY_SERIAL also set still
# issued a serial return, and a run with UNITY_LICENSING_SERVER set always
# issued a floating return. Those conditions are reproduced verbatim below.
#
# That matters far more than the equivalent question on the activate side: a
# return that used to happen and silently stops happening is a leaked seat, and
# a leaked seat degrades every subsequent run on the account rather than just
# this one. So the rule here is that this function must never return "" for any
# combination where the original script would have returned something.
#
# `personal` is the one genuinely new strategy, and in auto mode it is only
# ever chosen when no serial, no license file and no server are set - exactly
# the combination where the original conditions did nothing at all - so
# checking it first cannot shadow any of them.
#
resolve_unity_license_return_strategy() {
  # activate.sh's file-mode fallback (see its own comment) activates through
  # the Unity account when a .ulf's machine binding doesn't match this
  # machine, regardless of what the static env vars below would resolve to -
  # they still say "file", which has nothing to return, and would silently
  # leak the personal seat that fallback actually consumed. GAME_CI_ACTIVATED_VIA
  # is set by that fallback, in the same shell session return_license.sh runs
  # in (see runsteps.sh), and always wins here for exactly that reason.
  if [[ "${GAME_CI_ACTIVATED_VIA:-}" == "personal" ]]; then
    echo "personal"
    return 0
  fi

  local method
  method="$(resolve_unity_licensing_method)"

  # An explicit --unityLicensingMethod governs the return too, otherwise
  # forcing a strategy would activate one license and return another.
  if [[ -n "${UNITY_LICENSING_METHOD:-}" ]]; then
    case "$method" in
      personal | floating | serial) echo "$method" ;;
      # 'file' has nothing to return - a .ulf is a file, not a seat.
      *) echo "" ;;
    esac
    return 0
  fi

  if [[ "$method" == "personal" ]]; then
    echo "personal"
  elif [[ -n "${UNITY_LICENSING_SERVER:-}" ]]; then
    echo "floating"
  elif [[ -n "${UNITY_SERIAL:-}" ]]; then
    echo "serial"
  else
    echo ""
  fi
}

#
# Turns a failed personal activation into something actionable.
#
# Personal seats fail in two ways that look identical from the exit code but
# need completely different fixes, and neither is obvious from Unity's own
# output. Takes the path to a log file containing the licensing client's
# output.
#
# The patterns are best-effort: Unity documents neither the licensing client's
# flags nor its error strings, so treat a miss as "fall through to the generic
# message", never as a reason to suppress the failure.
#
explain_personal_activation_failure() {
  local log_path="$1"

  if grep -qiE 'no (available )?seats|seat is not available|entitlement groups and 0 free entitlements|LICENSE_LIMIT|maximum number of' "$log_path"; then
    echo ""
    echo "##[error] Unity reports no available Personal seats for this account."
    echo ""
    echo "A Personal seat is held until it is returned. The usual causes are:"
    echo "  * A previous run leaked its seat (killed job, cancelled workflow, or a"
    echo "    crash before return_license ran). Sign in at https://id.unity.com and"
    echo "    release the stale seat, or run 'game-ci return-license'."
    echo "  * Concurrent jobs are sharing one account. Personal has far fewer seats"
    echo "    than a matrix typically has jobs - stagger them, or use a paid seat."
    return 0
  fi

  if grep -qiE 'two.?factor|2fa|verification code|verify your|authenticator|unauthorized|invalid (username|password|credentials)' "$log_path"; then
    echo ""
    echo "##[error] Unity rejected the account credentials, or wants a second factor."
    echo ""
    echo "Headless personal activation cannot answer a 2FA or device-verification"
    echo "challenge. Check that:"
    echo "  * UNITY_EMAIL / UNITY_PASSWORD are correct and are a Unity ID login"
    echo "    (not a Google/Facebook/Apple social login, which has no password)."
    echo "  * The account has two-factor authentication disabled."
    echo "  * Unity is not challenging an unfamiliar IP. Hosted runners change IP"
    echo "    between runs, so a new-device email may be waiting for confirmation."
    echo ""
    echo "Use a dedicated CI-only Unity account rather than a personal main one."
    return 0
  fi

  # Distinct from the "no seats" case above: that one means the account HAS a
  # Personal entitlement but every seat is currently held. This one is Unity
  # refusing the account-only route that editors this old depend on (their
  # licensing client predates --include-personal, so it is the only Personal
  # route they have).
  #
  # Not "this version is unsupported", which is what this said until it was
  # measured: the same route on the same editor and account has been observed
  # both granting a seat (2026-09-11) and failing (2026-09-18), so it is
  # unreliable rather than unavailable. Someone reading this has a build
  # that just failed and wants to know what to do next, so it is kept short:
  # what happened, then the three things that actually help.
  if grep -qiE 'No license activation found for this computer|No ULF license found' "$log_path"; then
    echo ""
    echo "##[error] Unity did not grant a Personal seat for this editor version."
    echo "This is not a credentials or seat-limit problem, and it does not mean the"
    echo "version is unsupported - this activation has succeeded on it before."
    echo "Try, in order:"
    echo "  1. Re-run the job. This has cleared by itself on a later attempt."
    echo "  2. Set UNITY_SERIAL too, if the account has a Pro/Plus seat."
    echo "  3. Use Unity 2022.3 or newer, which activates a different way."
    return 0
  fi

  return 1
}
