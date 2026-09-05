# Shared licensing helpers for the Windows *native host-mode* script set
# (steps/activate.ps1 / steps/return_license.ps1). The container equivalents
# live in ../licensing_method.ps1 - see runsteps.ps1's doc comment for why the
# two sets exist.

#
# Resolves which activation strategy the license steps should take.
#
# UNITY_LICENSING_METHOD, when set, is an explicit choice made by the caller
# (`--unityLicensingMethod`, see src/logic/unity/license/licensing-method.ts)
# and wins outright.
#
# Otherwise the chain below is used, and it is deliberately the *original*
# order this script has always had - file -> serial -> floating - which matches
# ubuntu and mac but NOT the container script set one directory up, which
# checks floating before serial. That divergence predates this file and is
# reproduced rather than unified, so no existing build silently changes which
# license it consumes.
#
# `personal` is appended as a new terminal branch, so it can only be reached by
# a credential combination that previously matched nothing and exited 1.
#
function Get-UnityLicensingMethod {
  if ($Env:UNITY_LICENSING_METHOD) {
    return $Env:UNITY_LICENSING_METHOD
  }

  $hasSerialCredentials = $Env:UNITY_SERIAL -and $Env:UNITY_EMAIL -and $Env:UNITY_PASSWORD

  if ((-not $hasSerialCredentials) -and ($Env:UNITY_LICENSE -or $Env:UNITY_LICENSE_FILE)) {
    return 'file'
  }
  if ($hasSerialCredentials) {
    return 'serial'
  }
  if ($Env:UNITY_LICENSING_SERVER) {
    return 'floating'
  }
  if ($Env:UNITY_EMAIL -and $Env:UNITY_PASSWORD) {
    return 'personal'
  }

  return ''
}

#
# Resolves which license the return step should hand back.
#
# Deliberately not just "whatever activate.ps1 used". The original
# return_license.ps1 keyed its branches off the raw env vars rather than off
# the activation strategy, so a .ulf run with UNITY_SERIAL also set still
# issued a serial return. Those conditions are reproduced verbatim.
#
# A return that used to happen and silently stops happening is a leaked seat,
# which degrades every subsequent run on the account rather than just this one.
# So this must never return '' for any combination where the original script
# would have returned something.
#
function Get-UnityLicenseReturnStrategy {
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

  # `personal` is only ever auto-selected when no serial, no license file and
  # no server are set - exactly where the original conditions did nothing - so
  # checking it first cannot shadow them.
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
