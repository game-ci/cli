# Shared licensing helpers for the Windows *native host-mode* script set
# (steps/activate.ps1 / steps/return_license.ps1). The container equivalents
# live in ../licensing_method.ps1 - see runsteps.ps1's doc comment for why the
# two sets exist.

#
# Resolves which activation strategy the license steps should take.
#
# Normally UNITY_LICENSING_METHOD arrives pre-resolved from the CLI
# (src/logic/unity/license/licensing-method.ts, via
# UnityEnvironment.getVariables). The fallback below reproduces the same
# priority order for the cases where it doesn't: an older CLI driving a newer
# dist/, a container started by hand, or unity-builder invoking these scripts
# directly. licensing-method.ts is the reference - keep the two in sync.
#
function Get-UnityLicensingMethod {
  if ($Env:UNITY_LICENSING_METHOD) {
    return $Env:UNITY_LICENSING_METHOD
  }

  if ($Env:UNITY_SERIAL -and $Env:UNITY_EMAIL -and $Env:UNITY_PASSWORD) {
    return 'serial'
  }
  if ($Env:UNITY_LICENSE -or $Env:UNITY_LICENSE_FILE) {
    return 'file'
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
