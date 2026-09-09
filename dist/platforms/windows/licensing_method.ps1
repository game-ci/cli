# Shared licensing helpers for the Windows *container* script set
# (activate.ps1 / return_license.ps1). The native host-mode equivalents live in
# steps/licensing_method.ps1 - see steps/runsteps.ps1's doc comment for why the
# two sets exist.

#
# Resolves which activation strategy the license steps should take.
#
# UNITY_LICENSING_METHOD, when set, is an explicit choice made by the caller
# (`--unityLicensingMethod`, see src/logic/unity/license/licensing-method.ts)
# and wins outright.
#
# Otherwise the chain below is used: file -> serial -> floating -> personal.
# This container script set used to check floating before serial, and its
# catch-all attempted a serial activation with whatever credentials happened
# to be set (including none at all) rather than reporting the same clear
# "could not be determined" message ubuntu/mac/steps/ already gave. Both
# divergences predated this file and are now removed (game-ci/cli#256):
# ubuntu, mac and steps/ already checked serial before floating, so this
# aligns the minority rather than the other way around, and only changes
# behaviour for a Windows container build that set *both* a complete serial
# triple *and* a licensing server (previously took floating, now takes serial,
# matching every other platform), or that set no usable credentials at all
# (previously attempted a doomed serial activation with empty credentials, now
# reports the same guidance message every other platform already gives).
#
function Get-UnityLicensingMethod {
  if ($Env:UNITY_LICENSING_METHOD) {
    return $Env:UNITY_LICENSING_METHOD
  }

  $hasSerialCredentials = $Env:UNITY_SERIAL -and $Env:UNITY_EMAIL -and $Env:UNITY_PASSWORD
  $resolved = ''

  if ((-not $hasSerialCredentials) -and ($Env:UNITY_LICENSE -or $Env:UNITY_LICENSE_FILE)) {
    $resolved = 'file'
  } elseif ($hasSerialCredentials) {
    $resolved = 'serial'
  } elseif ($Env:UNITY_LICENSING_SERVER) {
    $resolved = 'floating'
  } elseif ($Env:UNITY_EMAIL -and $Env:UNITY_PASSWORD) {
    $resolved = 'personal'
  }

  Write-LicensingMethodAmbiguityWarning -Resolved $resolved

  return $resolved
}

#
# Warns whenever a credential that names a *specific* strategy was provided
# but a different strategy was auto-resolved instead - silently ignoring a
# credential like this is exactly what took two real regressions
# (game-ci/cli#254, #255) to fully diagnose, because nothing said out loud
# which of several plausible strategies actually got used.
#
# Only runs for auto resolution: an explicit UNITY_LICENSING_METHOD is a
# deliberate choice and is never second-guessed (Get-UnityLicensingMethod
# returns before this is ever called in that case).
#
function Write-LicensingMethodAmbiguityWarning {
  param([string]$Resolved)

  if ($Resolved -ne 'file' -and ($Env:UNITY_LICENSE -or $Env:UNITY_LICENSE_FILE)) {
    Write-Host "##[warning] A Unity license file (.ulf) was provided, but '$Resolved' activation is being used instead - Unity account credentials take precedence when both are present. Set UNITY_LICENSING_METHOD=file to force loading the file directly."
  }
  if ($Resolved -ne 'serial' -and $Env:UNITY_SERIAL) {
    Write-Host "##[warning] UNITY_SERIAL was provided, but '$Resolved' activation is being used instead - serial activation needs UNITY_SERIAL, UNITY_EMAIL and UNITY_PASSWORD all set together. Set UNITY_LICENSING_METHOD=serial to force it, or provide the missing credential(s)."
  }
  if ($Resolved -ne 'floating' -and $Env:UNITY_LICENSING_SERVER) {
    Write-Host "##[warning] UNITY_LICENSING_SERVER was provided, but '$Resolved' activation is being used instead. Set UNITY_LICENSING_METHOD=floating to force it."
  }
}

#
# Resolves which license the return step should hand back.
#
# Deliberately not just "whatever activate.ps1 used". A return keyed off the
# activation strategy rather than the raw env vars would leak a seat the
# moment those two ever disagreed, and a leaked seat degrades every
# subsequent run on the account rather than just this one - so the rule is
# that this must never return '' for any combination that names a real
# strategy. Matches ubuntu/mac/steps/ exactly now (game-ci/cli#256); this set
# used to have its own catch-all that attempted a serial return for anything
# not floating, including combinations with no serial credentials at all.
#
function Get-UnityLicenseReturnStrategy {
  # activate.ps1's file-mode fallback (see its own comment) activates through
  # the Unity account when a .ulf's machine binding doesn't match this
  # machine, regardless of what the static env vars below would resolve to -
  # they still say "file", which has nothing to return, and would silently
  # leak the personal seat that fallback actually consumed. GAME_CI_ACTIVATED_VIA
  # is an actual process environment variable, set by that fallback - it
  # survives into return_license.ps1 even though entrypoint.ps1 invokes each
  # step script with `&` rather than dot-sourcing, because $Env: variables
  # are process-wide, not scoped to the invoking script.
  if ($Env:GAME_CI_ACTIVATED_VIA -eq 'personal') {
    return 'personal'
  }

  $method = Get-UnityLicensingMethod

  # An explicit --unityLicensingMethod governs the return too, otherwise
  # forcing a strategy would activate one license and return another.
  if ($Env:UNITY_LICENSING_METHOD) {
    if ($method -eq 'personal' -or $method -eq 'floating' -or $method -eq 'serial') {
      return $method
    }
    # 'file' has nothing to return - a .ulf is a file, not a seat.
    return ''
  }

  if ($method -eq 'personal') {
    return 'personal'
  }
  if ($Env:UNITY_LICENSING_SERVER) {
    return 'floating'
  }
  if ($Env:UNITY_SERIAL) {
    return 'serial'
  }

  return ''
}

#
# Turns a failed personal activation into something actionable.
#
# Personal seats fail in two ways that look identical from the exit code but
# need completely different fixes, and neither is obvious from Unity's own
# output. Returns $true when it recognised the failure.
#
# The patterns are best-effort: Unity documents neither the licensing client's
# flags nor its error strings, so treat a miss as "fall through to the generic
# message", never as a reason to suppress the failure.
#
function Write-PersonalActivationFailureHelp {
  param([string]$LogText)

  if ($LogText -match '(?i)no (available )?seats|seat is not available|entitlement groups and 0 free entitlements|LICENSE_LIMIT|maximum number of') {
    Write-Host ''
    Write-Host '##[error] Unity reports no available Personal seats for this account.'
    Write-Host ''
    Write-Host 'A Personal seat is held until it is returned. The usual causes are:'
    Write-Host '  * A previous run leaked its seat (killed job, cancelled workflow, or a'
    Write-Host '    crash before return_license ran). Sign in at https://id.unity.com and'
    Write-Host '    release the stale seat, or run ''game-ci return-license''.'
    Write-Host '  * Concurrent jobs are sharing one account. Personal has far fewer seats'
    Write-Host '    than a matrix typically has jobs - stagger them, or use a paid seat.'
    return $true
  }

  if ($LogText -match '(?i)two.?factor|2fa|verification code|verify your|authenticator|unauthorized|invalid (username|password|credentials)') {
    Write-Host ''
    Write-Host '##[error] Unity rejected the account credentials, or wants a second factor.'
    Write-Host ''
    Write-Host 'Headless personal activation cannot answer a 2FA or device-verification'
    Write-Host 'challenge. Check that:'
    Write-Host '  * UNITY_EMAIL / UNITY_PASSWORD are correct and are a Unity ID login'
    Write-Host '    (not a Google/Facebook/Apple social login, which has no password).'
    Write-Host '  * The account has two-factor authentication disabled.'
    Write-Host '  * Unity is not challenging an unfamiliar IP. Hosted runners change IP'
    Write-Host '    between runs, so a new-device email may be waiting for confirmation.'
    Write-Host ''
    Write-Host 'Use a dedicated CI-only Unity account rather than a personal main one.'
    return $true
  }

  return $false
}
