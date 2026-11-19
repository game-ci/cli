#
# Behavioural tests for how dist/platforms/windows/steps/resolve_unity_path.ps1
# launches the Unity Editor: which argv Unity receives, and whether the step
# waits for Unity to exit.
#
# Runs on Linux pwsh against a stub executable: no Unity, no Docker, no network.

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$launchScript = Join-Path $repoRoot 'dist/platforms/windows/steps/resolve_unity_path.ps1'

. $launchScript

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

# A stand-in for Unity.exe that records each argument it receives on its own line.
$stubDir = Join-Path ([IO.Path]::GetTempPath()) "unity-launch-test-$PID"
New-Item -ItemType Directory -Force -Path $stubDir | Out-Null
$argvFile = Join-Path $stubDir 'argv.txt'
$stubExe = Join-Path $stubDir 'unity-stub'
Set-Content -Path $stubExe -Value "#!/usr/bin/env bash`nprintf '%s\n' `"`$@`" > '$argvFile'`nexit `${STUB_EXIT_CODE:-0}"
chmod +x $stubExe

# Cleared before every launch, so a launch that never ran cannot pass on an
# earlier case's argv.
function Reset-StubArgv {
  Remove-Item $argvFile -ErrorAction SilentlyContinue
}

function Get-StubArgv {
  if (-not (Test-Path $argvFile)) { return , @() }
  return , @(Get-Content $argvFile)
}

Write-Host '== Split-ArgumentString =='

$single = Split-ArgumentString '-nographics'
Check 'one parameter stays an array' ($single -is [array]) $true
Check 'one parameter keeps its word whole' ($single -join '|') '-nographics'

$several = Split-ArgumentString '  -nographics   -silent-crashes '
Check 'several parameters split on whitespace' ($several -join '|') '-nographics|-silent-crashes'

$none = Split-ArgumentString ''
Check 'no parameters give an empty array' ($none -is [array]) $true
Check 'no parameters give no words' $none.Count 0

Write-Host '== Invoke-UnityLaunch argv =='

Remove-Item Env:ENGINE_LAUNCH_WRAPPER -ErrorAction SilentlyContinue
$CustomParametersArray = Split-ArgumentString '-nographics'
Reset-StubArgv
Invoke-UnityLaunch -ExePath $stubExe -batchmode @CustomParametersArray | Out-Host
Check 'a single custom parameter reaches Unity as one argument' ((Get-StubArgv) -join '|') '-batchmode|-nographics'

$Env:ENGINE_LAUNCH_WRAPPER = 'env --unset=GAME_CI_UNUSED'
Reset-StubArgv
Invoke-UnityLaunch -ExePath $stubExe -batchmode @CustomParametersArray | Out-Host
Check 'a two-word launch wrapper passes the same argv through' ((Get-StubArgv) -join '|') '-batchmode|-nographics'
Remove-Item Env:ENGINE_LAUNCH_WRAPPER

Write-Host '== Invoke-UnityLaunch exit code =='

$Env:STUB_EXIT_CODE = '3'
Reset-StubArgv
Invoke-UnityLaunch -ExePath $stubExe -batchmode | Out-Host
Check 'Unity exit code reaches $LASTEXITCODE' $LASTEXITCODE 3
Remove-Item Env:STUB_EXIT_CODE

# PowerShell runs a GUI-subsystem executable such as Unity.exe in the background,
# without waiting for it or setting $LASTEXITCODE, when it is the last command of
# its pipeline (NativeCommandProcessor's _isRunningInBackground). Linux has no GUI
# subsystem to reproduce that with, so the invariant is checked on the syntax tree:
# every `&` launch inside Invoke-UnityLaunch must have a command after it.
Write-Host '== Invoke-UnityLaunch waits for Unity =='

$ast = [System.Management.Automation.Language.Parser]::ParseFile($launchScript, [ref]$null, [ref]$null)
$launchFunction = $ast.Find({
    param($node)
    $node -is [System.Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Invoke-UnityLaunch'
  }, $true)
$launches = @($launchFunction.FindAll({
      param($node)
      $node -is [System.Management.Automation.Language.CommandAst] -and
      $node.InvocationOperator -eq [System.Management.Automation.Language.TokenKind]::Ampersand
    }, $true))

Check 'Invoke-UnityLaunch has both launch branches' $launches.Count 2
foreach ($launch in $launches) {
  $elements = $launch.Parent.PipelineElements
  $isLast = [object]::ReferenceEquals($elements[$elements.Count - 1], $launch)
  Check "'$($launch.Extent.Text)' is not last in its pipeline" $isLast $false
}

Remove-Item -Recurse -Force $stubDir

Write-Host ''
Write-Host "$script:pass passed, $script:fail failed"
# Explicit, because GitHub's pwsh shell otherwise exits with $LASTEXITCODE,
# which the stub left non-zero on purpose.
exit [int]($script:fail -gt 0)
