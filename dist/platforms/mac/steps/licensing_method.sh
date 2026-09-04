#!/usr/bin/env bash

# Shared licensing helpers for activate.sh / return_license.sh.

#
# Resolves which activation strategy the license steps should take.
#
# Normally UNITY_LICENSING_METHOD arrives pre-resolved from the CLI
# (src/logic/unity/license/licensing-method.ts, via
# UnityEnvironment.getVariables). The fallback below reproduces the same
# priority order for the cases where it doesn't: an older CLI driving a newer
# dist/, a container started by hand, or unity-builder sourcing these scripts
# directly. licensing-method.ts is the reference - keep the two in sync.
#
resolve_unity_licensing_method() {
  if [[ -n "${UNITY_LICENSING_METHOD:-}" ]]; then
    echo "$UNITY_LICENSING_METHOD"
    return 0
  fi

  if [[ -n "${UNITY_SERIAL:-}" && -n "${UNITY_EMAIL:-}" && -n "${UNITY_PASSWORD:-}" ]]; then
    echo "serial"
  elif [[ -n "${UNITY_LICENSE:-}" || -n "${UNITY_LICENSE_FILE:-}" ]]; then
    echo "file"
  elif [[ -n "${UNITY_LICENSING_SERVER:-}" ]]; then
    echo "floating"
  elif [[ -n "${UNITY_EMAIL:-}" && -n "${UNITY_PASSWORD:-}" ]]; then
    echo "personal"
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
