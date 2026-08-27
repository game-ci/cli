# Windows equivalent of ../../ubuntu/steps/test.sh - see runsteps.ps1's doc
# comment.
#
# Shared by BOTH Windows test paths, deliberately: HostRunner's native
# host mode (via runsteps.ps1) and the Docker container flow (via
# ../entrypoint.ps1's RUN_TESTS branch, which dot-sources this file at
# c:\steps\steps\test.ps1). Everything container-specific is already
# handled by environment: resolve_unity_path.ps1 returns the image-baked
# $Env:UNITY_PATH when set, and $TestRunnerActionDir below falls back to
# the c:\UnityTestRunnerAction mount. Do not add host-only assumptions
# here without giving the container an equivalent.
#
# Standalone sub-flow: the Linux version wraps the built standalone test
# player in `xvfb-run` to give it a virtual X display. Windows has a real
# display session on an interactive self-hosted runner, so no virtual-
# display wrapper is used - the player is invoked directly, the same way
# build.ps1 invokes the Editor directly. KNOWN LIMITATION: on a headless
# Windows Server box with no interactive session (e.g. running as a
# Windows service with no desktop), the standalone player may still fail
# to start for the same fundamental reason `-nographics` alone doesn't
# always suffice on Linux without Xvfb - this is not handled here and has
# no Windows equivalent implemented.
$StepsDir = if ($Env:STEPS_DIR) { $Env:STEPS_DIR } else { $PSScriptRoot }
. (Join-Path $StepsDir 'resolve_unity_path.ps1')

$Env:UNITY_PROJECT_PATH = Join-Path $Env:GITHUB_WORKSPACE $Env:PROJECT_PATH
Write-Host "Using project path `"$($Env:UNITY_PROJECT_PATH)`"."

Write-Host "Using artifacts path `"$($Env:ARTIFACTS_PATH)`" to save test results."
$FullArtifactsPath = Join-Path $Env:GITHUB_WORKSPACE $Env:ARTIFACTS_PATH

Write-Host "Using coverage results path `"$($Env:COVERAGE_RESULTS_PATH)`" to save test coverage results."
$FullCoverageResultsPath = Join-Path $Env:GITHUB_WORKSPACE $Env:COVERAGE_RESULTS_PATH

Write-Host "Using custom parameters $($Env:CUSTOM_PARAMETERS)."
Write-Host "Using Unity version `"$($Env:UNITY_VERSION)`" to test."

#
# Setup token for private package registry.
#
if ($Env:PRIVATE_REGISTRY_TOKEN) {
  Write-Host 'Private registry token detected, creating .upmconfig.toml'

  $UpmConfigTomlPath = Join-Path $HOME '.upmconfig.toml'
  Write-Host "Creating toml at path: $UpmConfigTomlPath"

  $toml = "[npmAuth.`"$($Env:SCOPED_REGISTRY_URL)`"]`ntoken = `"$($Env:PRIVATE_REGISTRY_TOKEN)`"`nalwaysAuth = true`n"
  if ($Env:PRIVATE_REGISTRY_USER) {
    Write-Host "Adding user = $($Env:PRIVATE_REGISTRY_USER)"
    $toml += "user = `"$($Env:PRIVATE_REGISTRY_USER)`"`n"
  }
  Set-Content -Path $UpmConfigTomlPath -Value $toml
}

#
# Create an empty project for testing if in package mode
#
try {
  $UnityExePath = Get-UnityEditorExePath
} catch {
  Write-Host "Unity Editor could not be located: $($_.Exception.Message)"
  $global:TEST_RUNNER_EXIT_CODE = 1
  return
}

if ($Env:PACKAGE_MODE -eq 'true') {
  Write-Host 'Running tests on a Unity package rather than a Unity project.'

  Write-Host ''
  Write-Host '###########################'
  Write-Host '#    Package Folder       #'
  Write-Host '###########################'
  Write-Host ''
  Get-ChildItem $Env:UNITY_PROJECT_PATH

  Write-Host "Creating an empty Unity project to add the package $($Env:PACKAGE_NAME) to."
  $TempProjectPath = Join-Path (Get-Location) 'TempProject'

  Invoke-UnityLaunch -ExePath $UnityExePath -batchmode -createProject $TempProjectPath -quit | Out-Host

  Write-Host 'Adding package to the temporary project''s dependencies and testables...'
  Write-Host ''

  $PackageManifestPath = Join-Path $TempProjectPath 'Packages\manifest.json'
  if (-not (Test-Path $PackageManifestPath)) {
    Write-Host 'Packages/manifest.json was not created properly. This indicates a problem with the CLI, not with your package. Logging directories and aborting...'

    Write-Host ''
    Write-Host '###########################'
    Write-Host '#   Temp Project Folder   #'
    Write-Host '###########################'
    Write-Host ''
    if (Test-Path $TempProjectPath) { Get-ChildItem -Force $TempProjectPath }

    Write-Host ''
    Write-Host '################################'
    Write-Host '# Temp Project Packages Folder #'
    Write-Host '################################'
    Write-Host ''
    $PackagesDir = Join-Path $TempProjectPath 'Packages'
    if (Test-Path $PackagesDir) { Get-ChildItem -Force $PackagesDir }

    $global:TEST_RUNNER_EXIT_CODE = 1
    return
  }

  $Manifest = Get-Content -Raw $PackageManifestPath | ConvertFrom-Json -AsHashtable
  if (-not $Manifest.dependencies) { $Manifest.dependencies = @{} }
  $Manifest.dependencies['com.unity.testtools.codecoverage'] = '1.1.1'
  $Manifest.dependencies[$Env:PACKAGE_NAME] = "file:$($Env:UNITY_PROJECT_PATH)"
  $Manifest.testables = @($Env:PACKAGE_NAME)

  if ($Env:SCOPED_REGISTRY_URL -and $Env:REGISTRY_SCOPES) {
    $Manifest.scopedRegistries = @(
      @{ name = 'dependency'; url = $Env:SCOPED_REGISTRY_URL; scopes = @($Env:REGISTRY_SCOPES -split ',') }
    )
  }

  $Manifest | ConvertTo-Json -Depth 10 | Set-Content -Path $PackageManifestPath

  $Env:UNITY_PROJECT_PATH = $TempProjectPath
}

Write-Host ''
Write-Host '###########################'
Write-Host '#    Artifacts folder     #'
Write-Host '###########################'
Write-Host ''
Write-Host "Creating `"$FullArtifactsPath`" if it does not exist."
if (-not (Test-Path $FullArtifactsPath)) {
  New-Item -ItemType Directory -Force -Path $FullArtifactsPath | Out-Null
}

Write-Host ''
Write-Host '###########################'
Write-Host '#    Project directory    #'
Write-Host '###########################'
Write-Host ''
Get-ChildItem $Env:UNITY_PROJECT_PATH

#
# coverageEnabled gates the code-coverage flags entirely (game-ci/unity-test-runner#311):
# some Unity versions/configurations crash or fail to compile with
# com.unity.testtools.codecoverage's instrumentation enabled. Default true
# to match prior behavior when unset.
#
$CoverageFlags = @()
if (-not $Env:COVERAGE_ENABLED -or $Env:COVERAGE_ENABLED -eq 'true') {
  $CoverageFlags = @('-coverageResultsPath', $FullCoverageResultsPath, '-enableCodeCoverage', '-debugCodeOptimization', '-coverageOptions', $Env:COVERAGE_OPTIONS)
} else {
  Write-Host 'Code coverage disabled (coverageEnabled=false).'
}

$CustomParametersArray = @()
if ($Env:CUSTOM_PARAMETERS) {
  $CustomParametersArray = $Env:CUSTOM_PARAMETERS -split '\s+' | Where-Object { $_ -ne '' }
}

$TestRunnerExitCode = 0

$Platforms = $Env:TEST_PLATFORMS -split ';' | Where-Object { $_ -ne '' }
foreach ($Platform in $Platforms) {
  $RunTestsArgs = @()

  if ($Platform -eq 'standalone') {
    Write-Host ''
    Write-Host '###########################'
    Write-Host '#   Building Standalone   #'
    Write-Host '###########################'
    Write-Host ''

    $EditorDir = Join-Path $Env:UNITY_PROJECT_PATH 'Assets\Editor'
    $PlayerDir = Join-Path $Env:UNITY_PROJECT_PATH 'Assets\Player'
    New-Item -ItemType Directory -Force -Path $EditorDir | Out-Null
    New-Item -ItemType Directory -Force -Path $PlayerDir | Out-Null

    # Host mode (HostRunner) sets TEST_RUNNER_ACTION_DIR outright; the mac
    # script set sets ACTION_FOLDER instead. In Docker mode neither is set,
    # and Docker.getWindowsCommand mounts dist/test-standalone-scripts at
    # c:\UnityTestRunnerAction - the Windows counterpart of the
    # /UnityTestRunnerAction that ubuntu/steps/test.sh already defaults to.
    $TestRunnerActionDir =
      if ($Env:TEST_RUNNER_ACTION_DIR) { $Env:TEST_RUNNER_ACTION_DIR }
      elseif ($Env:ACTION_FOLDER) { Join-Path $Env:ACTION_FOLDER 'test-standalone-scripts' }
      else { 'c:\UnityTestRunnerAction' }

    if (-not (Test-Path $TestRunnerActionDir)) {
      Write-Host "Standalone test scripts not found at `"$TestRunnerActionDir`". Set TEST_RUNNER_ACTION_DIR to the directory containing Assets\Editor and Assets\Player."
      $global:TEST_RUNNER_EXIT_CODE = 1
      return
    }
    Copy-Item -Path (Join-Path $TestRunnerActionDir 'Assets\Editor\*') -Destination $EditorDir -Recurse -Force
    Copy-Item -Path (Join-Path $TestRunnerActionDir 'Assets\Player\*') -Destination $PlayerDir -Recurse -Force

    Get-ChildItem -Recurse $EditorDir
    Get-ChildItem -Recurse $PlayerDir

    $BuiltTestRunnerPath = Join-Path $Env:UNITY_PROJECT_PATH 'Build\UnityTestRunner-Standalone.exe'
    $RunTestsArgs = @('-runTests', '-testPlatform', 'StandaloneWindows64', '-builtTestRunnerPath', $BuiltTestRunnerPath)
  } else {
    Write-Host ''
    Write-Host "###########################"
    Write-Host "#   Testing in $Platform  #"
    Write-Host "###########################"
    Write-Host ''

    if ($Platform -ne 'COMBINE_RESULTS') {
      $ResultsPath = Join-Path $FullArtifactsPath "$Platform-results.xml"
      $RunTestsArgs = @('-runTests', '-testPlatform', $Platform, '-testResults', $ResultsPath)
    } else {
      $RunTestsArgs = @('-quit')
    }
  }

  $LogPath = Join-Path $FullArtifactsPath "$Platform.log"

  # Same known-transient Unity license-server flakiness as the mac retry
  # (see mac/steps/build.sh's matching comment) - retried a few times, but
  # only when the exit code isn't a legitimate test-result code (0 = all
  # passed, 2 = some tests failed - both mean real results exist and are
  # never retried) and the log matches a known-transient signature, so a
  # real test failure or a real license misconfiguration still fails
  # immediately. Same --licenseRetryMaxAttempts / UNITY_LICENSE_RETRY_MAX_ATTEMPTS
  # knob as activate.ps1 and the mac scripts.
  $MaxAttempts = if ($Env:UNITY_LICENSE_RETRY_MAX_ATTEMPTS) { [int]$Env:UNITY_LICENSE_RETRY_MAX_ATTEMPTS } else { 4 }
  $RetryDelaySeconds = 20
  $TransientPattern = 'TimeoutPolicy did not complete|Access token is unavailable|entitlement groups and 0 free entitlements|License activation has failed|No valid Unity Editor license found|License is not active'

  for ($Attempt = 1; $Attempt -le $MaxAttempts; $Attempt++) {
    Invoke-UnityLaunch -ExePath $UnityExePath -batchmode -logFile $LogPath -projectPath $Env:UNITY_PROJECT_PATH @RunTestsArgs @CoverageFlags @CustomParametersArray | Out-Host
    $TestExitCode = $LASTEXITCODE
    $LogContent = if (Test-Path $LogPath) { Get-Content $LogPath -Raw } else { '' }
    if ($LogContent) { Get-Content $LogPath | Out-Host }

    if ($TestExitCode -eq 0 -or $TestExitCode -eq 2) { break }

    if ($Attempt -lt $MaxAttempts -and $LogContent -match $TransientPattern) {
      Write-Host "Unity test run failed with a known-transient licensing error (attempt $Attempt/$MaxAttempts) - retrying in ${RetryDelaySeconds}s..."
      Start-Sleep -Seconds $RetryDelaySeconds
      continue
    }

    break
  }

  if ($TestExitCode -eq 0 -and $Platform -eq 'standalone') {
    Write-Host ''
    Write-Host '###########################'
    Write-Host '#    Testing Standalone   #'
    Write-Host '###########################'
    Write-Host ''

    # Code Coverage currently only supports code ran in the Editor and not in Standalone/Player.
    $PlayerLogPath = Join-Path $FullArtifactsPath "$Platform-player.log"
    $PlayerResultsPath = Join-Path $FullArtifactsPath "$Platform-results.xml"

    & $BuiltTestRunnerPath -batchmode -nographics -logFile $PlayerLogPath -testResults $PlayerResultsPath | Out-Host
    $TestExitCode = $LASTEXITCODE

    if (Test-Path $PlayerLogPath) { Get-Content $PlayerLogPath | Out-Host }
  }

  if ($TestExitCode -eq 0) {
    Write-Host 'Run succeeded, no failures occurred'
  } elseif ($TestExitCode -eq 2) {
    Write-Host 'Run succeeded, some tests failed'
  } elseif ($TestExitCode -eq 3) {
    Write-Host 'Run failure (other failure)'
  } else {
    Write-Host "Unexpected exit code $TestExitCode"
  }

  if ($TestExitCode -ne 0) {
    $TestRunnerExitCode = $TestExitCode
  }

  Write-Host ''
  Write-Host "###########################"
  Write-Host "#    $Platform Results    #"
  Write-Host "###########################"
  Write-Host ''

  if ($Platform -ne 'COMBINE_RESULTS') {
    $ResultsPath = Join-Path $FullArtifactsPath "$Platform-results.xml"
    if (Test-Path $ResultsPath) {
      Get-Content $ResultsPath | Out-Host
      Get-Content $ResultsPath | Select-String 'test-run' | Select-String 'Passed'
    }
  }
}

$global:TEST_RUNNER_EXIT_CODE = $TestRunnerExitCode

if (Test-Path $FullCoverageResultsPath) {
  # nothing further to do - matches bash version's read-permission step, N/A on Windows
} elseif (-not $Env:COVERAGE_ENABLED -or $Env:COVERAGE_ENABLED -eq 'true') {
  Write-Host 'Coverage results directory does not exist. If you are expecting coverage results, please make sure the Code Coverage package is installed in your unity project and that it is set up correctly.'
}
