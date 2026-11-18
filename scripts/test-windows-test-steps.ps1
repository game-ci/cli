#
# Tests how dist/platforms/windows/steps/test.ps1 grades a test run.
#
# Sibling of scripts/test-test-steps.sh. Unity can exit 0 without having run
# any tests: an editor that crashes at startup or is cut short writes no
# results file (cli#317, cli#318). A run is only a success when Unity's exit
# code says so AND the results file exists.
#
# Runs the real step on Linux pwsh against a stub Unity.exe: no Unity, no
# Docker, no network.

$ErrorActionPreference = 'Stop'
$repoRoot = Resolve-Path (Join-Path $PSScriptRoot '..')
$step = Join-Path $repoRoot 'dist/platforms/windows/steps/test.ps1'

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

$work = Join-Path ([IO.Path]::GetTempPath()) "windows-test-steps-$PID"

# A stand-in for Unity.exe: exits with $STUB_EXIT_CODE, and writes the file
# passed as -testResults when $STUB_WRITES_RESULTS is true, or names that file's
# platform. Given -builtTestRunnerPath, it builds that "player" as a copy of
# itself.
$unityRoot = Join-Path $work 'unity'
New-Item -ItemType Directory -Force -Path (Join-Path $unityRoot 'Editor') | Out-Null
$stubExe = Join-Path $unityRoot 'Editor/Unity.exe'
Set-Content -Path $stubExe -Value @'
#!/usr/bin/env bash
while [ $# -gt 0 ]; do
  if [ "$1" = "-testResults" ] && { [ "$STUB_WRITES_RESULTS" = "true" ] || [[ "$2" == *"/$STUB_WRITES_RESULTS-results.xml" ]]; }; then
    echo '<test-run result="Passed" />' > "$2"
  fi
  if [ "$1" = "-builtTestRunnerPath" ]; then
    mkdir -p "$(dirname "$2")" && cp "$0" "$2"
  fi
  shift
done
exit "${STUB_EXIT_CODE:-0}"
'@
chmod +x $stubExe

$testRunnerActionDir = Join-Path $work 'test-runner-action'
New-Item -ItemType Directory -Force -Path (Join-Path $testRunnerActionDir 'Assets/Editor') | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $testRunnerActionDir 'Assets/Player') | Out-Null

$caseNumber = 0

# Dot-sources the step the way entrypoint.ps1 does, in a child scope so its
# variables don't leak into the next case. Returns the step's exit code and output.
function Invoke-TestStep {
  param([string]$Platforms, [int]$ExitCode, [string]$WritesResults)

  $script:caseNumber++
  $workspace = Join-Path $work "workspace-$script:caseNumber"
  New-Item -ItemType Directory -Force -Path (Join-Path $workspace 'project') | Out-Null

  $Env:UNITY_PATH = $unityRoot
  $Env:GITHUB_WORKSPACE = $workspace
  $Env:PROJECT_PATH = 'project'
  $Env:ARTIFACTS_PATH = 'artifacts'
  $Env:COVERAGE_RESULTS_PATH = 'coverage'
  $Env:COVERAGE_ENABLED = 'false'
  $Env:TEST_RUNNER_ACTION_DIR = $testRunnerActionDir
  $Env:TEST_PLATFORMS = $Platforms
  $Env:STUB_EXIT_CODE = "$ExitCode"
  $Env:STUB_WRITES_RESULTS = $WritesResults
  $global:TEST_RUNNER_EXIT_CODE = $null

  $output = & { . $step *>&1 | Out-String -Stream } | Out-String
  return @{ ExitCode = $global:TEST_RUNNER_EXIT_CODE; Output = $output }
}

function Get-ErrorLine {
  param([string]$Output)
  return (($Output -split "`n") | Where-Object { $_ -like '*::error::*' }) -join "`n"
}

Write-Host '== test.ps1 grading =='

$result = Invoke-TestStep -Platforms 'editmode' -ExitCode 0 -WritesResults 'true'
Check 'a run with results passes' $result.ExitCode 0

$result = Invoke-TestStep -Platforms 'editmode' -ExitCode 2 -WritesResults 'true'
Check 'failing tests keep exit code 2' $result.ExitCode 2

$result = Invoke-TestStep -Platforms 'editmode' -ExitCode 0 -WritesResults 'false'
Check 'exit code 0 without a results file fails' $result.ExitCode 1
$errorLine = Get-ErrorLine $result.Output
CheckContains 'reports it as an error annotation' $errorLine 'wrote no test results'
CheckContains 'the error names the missing results file' $errorLine 'editmode-results.xml'

$result = Invoke-TestStep -Platforms 'editmode;playmode' -ExitCode 0 -WritesResults 'editmode'
Check 'a later platform without results still fails the run' $result.ExitCode 1

$result = Invoke-TestStep -Platforms 'standalone' -ExitCode 0 -WritesResults 'true'
Check 'a standalone run with player results passes' $result.ExitCode 0

$result = Invoke-TestStep -Platforms 'standalone' -ExitCode 0 -WritesResults 'false'
Check 'a standalone player without results fails' $result.ExitCode 1

$result = Invoke-TestStep -Platforms 'COMBINE_RESULTS' -ExitCode 0 -WritesResults 'false'
Check 'COMBINE_RESULTS writes no results file and passes' $result.ExitCode 0

Remove-Item -Recurse -Force $work

Write-Host ''
Write-Host "$script:pass passed, $script:fail failed"
if ($script:fail -gt 0) { exit 1 }
