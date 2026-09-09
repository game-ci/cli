#
# Behavioural tests for the Windows licensing helper scripts
# (dist/platforms/windows/licensing_method.ps1 - the *container* set - and
# dist/platforms/windows/steps/licensing_method.ps1 - the native host-mode
# set).
#
# Sibling of scripts/test-licensing-steps.sh, which covers the same ground
# for ubuntu/mac. No PowerShell test harness existed for these two files
# before game-ci/cli#256, which changed real behaviour in the container set
# (unifying its precedence order and return-strategy catch-all with the other
# three platforms) - a syntax check alone would not have caught a mistake in
# that change.
#
# Env vars are cleared before each case via Remove-Item so a stray value left
# over from a previous case (or the ambient environment) can't change which
# branch a later case takes.

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$containerScript = Join-Path $repoRoot 'dist/platforms/windows/licensing_method.ps1'
$stepsScript = Join-Path $repoRoot 'dist/platforms/windows/steps/licensing_method.ps1'

$licenseVars = @(
  'UNITY_LICENSING_METHOD', 'UNITY_SERIAL', 'UNITY_LICENSE', 'UNITY_LICENSE_FILE',
  'UNITY_LICENSING_SERVER', 'UNITY_EMAIL', 'UNITY_PASSWORD'
)

function Clear-LicenseEnv {
  foreach ($name in $licenseVars) {
    Remove-Item "Env:$name" -ErrorAction SilentlyContinue
  }
}

$script:pass = 0
$script:fail = 0

function Check {
  param([string]$Name, $Actual, $Expected)
  if ($Actual -eq $Expected) {
    Write-Host "  PASS $Name"
    $script:pass++
  } else {
    Write-Host "  FAIL $Name"
    Write-Host "       expected: $Expected"
    Write-Host "       actual:   $Actual"
    $script:fail++
  }
}

function CheckContains {
  param([string]$Name, [string]$Haystack, [string]$Needle)
  if ($Haystack -like "*$Needle*") {
    Write-Host "  PASS $Name"
    $script:pass++
  } else {
    Write-Host "  FAIL $Name"
    Write-Host "       expected to contain: $Needle"
    Write-Host "       actual:              $Haystack"
    $script:fail++
  }
}

function CheckNotContains {
  param([string]$Name, [string]$Haystack, [string]$Needle)
  if ($Haystack -notlike "*$Needle*") {
    Write-Host "  PASS $Name"
    $script:pass++
  } else {
    Write-Host "  FAIL $Name (unexpectedly contained: $Needle)"
    $script:fail++
  }
}

# Runs $Method in a fresh child pwsh process (dot-sourcing $Script first) so
# each case gets a clean function/variable scope, and captures stdout+stderr
# together the way a real CI log would show them.
function RunMethod {
  param([string]$Script, [string]$Method)
  $out = & pwsh -NoProfile -Command "`$ErrorActionPreference = 'Stop'; . '$Script'; $Method" 2>&1
  return ($out | Out-String).Trim()
}

# The return value itself, as a real `$x = Get-UnityLicensingMethod` caller
# would see it: Write-Host bypasses the pipeline entirely in normal use, but
# RunMethod's process-level capture mixes it in with the actual return value,
# so exact-match checks need this - the last line - not the combined blob
# CheckContains/CheckNotContains below deliberately want instead.
function LastLine {
  param([string]$Combined)
  $lines = $Combined -split "`r?`n"
  return $lines[-1]
}

foreach ($set in @(
    @{ Name = 'container'; Script = $containerScript },
    @{ Name = 'steps'; Script = $stepsScript }
  )) {
  $name = $set.Name
  $scriptPath = $set.Script

  Write-Host "Licensing method precedence ($name)"

  Clear-LicenseEnv
  $Env:UNITY_LICENSE = '<License/>'
  Check "$name`: a bare .ulf resolves to file" (LastLine (RunMethod $scriptPath 'Get-UnityLicensingMethod')) 'file'

  Clear-LicenseEnv
  $Env:UNITY_SERIAL = 'F4-XXXX'; $Env:UNITY_EMAIL = 'ci@example.com'; $Env:UNITY_PASSWORD = 'pw123456'
  Check "$name`: a complete serial triple resolves to serial" (LastLine (RunMethod $scriptPath 'Get-UnityLicensingMethod')) 'serial'

  Clear-LicenseEnv
  $Env:UNITY_LICENSE = '<License/>'; $Env:UNITY_SERIAL = 'F4-XXXX'
  $Env:UNITY_EMAIL = 'ci@example.com'; $Env:UNITY_PASSWORD = 'pw123456'
  Check "$name`: a complete serial triple beats a .ulf" (LastLine (RunMethod $scriptPath 'Get-UnityLicensingMethod')) 'serial'

  Clear-LicenseEnv
  $Env:UNITY_SERIAL = 'F4-XXXX'; $Env:UNITY_EMAIL = 'ci@example.com'; $Env:UNITY_PASSWORD = 'pw123456'
  $Env:UNITY_LICENSING_SERVER = 'http://ls:8080'
  Check "$name`: a complete serial triple beats a licensing server" (LastLine (RunMethod $scriptPath 'Get-UnityLicensingMethod')) 'serial'

  Clear-LicenseEnv
  $Env:UNITY_LICENSING_SERVER = 'http://ls:8080'
  Check "$name`: a bare licensing server resolves to floating" (LastLine (RunMethod $scriptPath 'Get-UnityLicensingMethod')) 'floating'

  Clear-LicenseEnv
  $Env:UNITY_EMAIL = 'ci@example.com'; $Env:UNITY_PASSWORD = 'pw123456'
  Check "$name`: email+password alone resolves to personal" (LastLine (RunMethod $scriptPath 'Get-UnityLicensingMethod')) 'personal'

  Clear-LicenseEnv
  Check "$name`: no usable credentials resolves to empty (not a doomed serial attempt)" (LastLine (RunMethod $scriptPath 'Get-UnityLicensingMethod')) ''

  Clear-LicenseEnv
  $Env:UNITY_LICENSING_METHOD = 'file'; $Env:UNITY_EMAIL = 'ci@example.com'; $Env:UNITY_PASSWORD = 'pw123456'
  Check "$name`: an explicit method always wins" (LastLine (RunMethod $scriptPath 'Get-UnityLicensingMethod')) 'file'

  Write-Host "Licensing return strategy ($name)"

  Clear-LicenseEnv
  $Env:UNITY_EMAIL = 'ci@example.com'; $Env:UNITY_PASSWORD = 'pw123456'
  Check "$name`: personal activation returns a personal seat" (LastLine (RunMethod $scriptPath 'Get-UnityLicenseReturnStrategy')) 'personal'

  Clear-LicenseEnv
  $Env:UNITY_LICENSE = '<License/>'
  Check "$name`: a .ulf has nothing to return" (LastLine (RunMethod $scriptPath 'Get-UnityLicenseReturnStrategy')) ''

  Clear-LicenseEnv
  Check "$name`: no usable credentials returns nothing (not a doomed serial return)" (LastLine (RunMethod $scriptPath 'Get-UnityLicenseReturnStrategy')) ''

  Write-Host "Ambiguous licensing method warning ($name)"

  Clear-LicenseEnv
  $Env:UNITY_LICENSE = '<License/>'; $Env:UNITY_SERIAL = 'F4-XXXX'
  $Env:UNITY_EMAIL = 'ci@example.com'; $Env:UNITY_PASSWORD = 'pw123456'
  $out = RunMethod $scriptPath 'Get-UnityLicensingMethod'
  CheckContains "$name`: warns when a .ulf is overridden by a complete serial triple" $out `
    "A Unity license file (.ulf) was provided, but 'serial' activation is being used instead"

  Clear-LicenseEnv
  $Env:UNITY_SERIAL = 'F4-XXXX'; $Env:UNITY_LICENSING_SERVER = 'http://ls:8080'
  $out = RunMethod $scriptPath 'Get-UnityLicensingMethod'
  CheckContains "$name`: warns when a bare serial is overridden by floating" $out `
    "UNITY_SERIAL was provided, but 'floating' activation is being used instead"

  Clear-LicenseEnv
  $Env:UNITY_SERIAL = 'F4-XXXX'; $Env:UNITY_EMAIL = 'ci@example.com'; $Env:UNITY_PASSWORD = 'pw123456'
  $out = RunMethod $scriptPath 'Get-UnityLicensingMethod'
  CheckNotContains "$name`: does not warn when a complete serial triple is the only thing given" $out '##[warning]'

  Clear-LicenseEnv
  $Env:UNITY_LICENSING_METHOD = 'file'; $Env:UNITY_EMAIL = 'ci@example.com'; $Env:UNITY_PASSWORD = 'pw123456'
  $out = RunMethod $scriptPath 'Get-UnityLicensingMethod'
  CheckNotContains "$name`: does not warn when an explicit UNITY_LICENSING_METHOD is set" $out '##[warning]'
}

Clear-LicenseEnv

Write-Host ""
Write-Host "Licensing step tests (PowerShell): $script:pass passed, $script:fail failed"
if ($script:fail -gt 0) { exit 1 }
