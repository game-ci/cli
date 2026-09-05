#!/usr/bin/env bash

# Shared licensing helpers for activate.sh / return_license.sh.

#
# Resolves which activation strategy the license steps should take.
#
# UNITY_LICENSING_METHOD, when set, is an explicit choice made by the caller
# (`--unityLicensingMethod`, see src/logic/unity/license/licensing-method.ts)
# and wins outright.
#
# Otherwise the chain below is used, and it is deliberately the *original*
# order this script has always had - file -> serial -> floating - reproduced
# condition for condition, including the "serial credentials must all three be
# present" rule that lets a .ulf win when they are not. `personal` is appended
# as a new terminal branch, so it can only ever be reached by a credential
# combination that previously matched nothing and exited 1. Every setup that
# works today keeps taking exactly the branch it takes today.
#
# Note the windows *container* script set intentionally has a different order
# here (floating before serial) because that is the order it has always had -
# see dist/platforms/windows/licensing_method.ps1.
#
resolve_unity_licensing_method() {
  if [[ -n "${UNITY_LICENSING_METHOD:-}" ]]; then
    echo "$UNITY_LICENSING_METHOD"
    return 0
  fi

  if { [[ -z "${UNITY_SERIAL:-}" ]] || [[ -z "${UNITY_EMAIL:-}" ]] || [[ -z "${UNITY_PASSWORD:-}" ]]; } &&
     { [[ -n "${UNITY_LICENSE:-}" ]] || [[ -n "${UNITY_LICENSE_FILE:-}" ]]; }; then
    echo "file"
  elif [[ -n "${UNITY_SERIAL:-}" && -n "${UNITY_EMAIL:-}" && -n "${UNITY_PASSWORD:-}" ]]; then
    echo "serial"
  elif [[ -n "${UNITY_LICENSING_SERVER:-}" ]]; then
    echo "floating"
  elif [[ -n "${UNITY_EMAIL:-}" && -n "${UNITY_PASSWORD:-}" ]]; then
    echo "personal"
  else
    echo ""
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

  return 1
}
