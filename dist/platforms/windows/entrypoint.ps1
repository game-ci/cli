# Copy .upmconfig.toml if it exists
if (Test-Path "C:\githubhome\.upmconfig.toml") {
  Write-Host "Copying .upmconfig.toml to $Env:USERPROFILE\.upmconfig.toml"
  Copy-Item -Path "C:\githubhome\.upmconfig.toml" -Destination "$Env:USERPROFILE\.upmconfig.toml" -Force
} else {
  Write-Host "No .upmconfig.toml found at C:\githubhome"
}

# Import any necessary registry keys, ie: location of windows 10 sdk
# No guarantee that there will be any necessary registry keys, ie: tvOS
Get-ChildItem -Path c:\registry-keys -File | ForEach-Object {reg import $_.fullname}

# Register the Visual Studio installation so Unity can find it
regsvr32 C:\ProgramData\Microsoft\VisualStudio\Setup\x64\Microsoft.VisualStudio.Setup.Configuration.Native.dll

# Install Visual C++ 2013 Redistributables - Unity fails on some GitHub
# Actions Windows runners without this (see game-ci/cli#65, item 5).
& "c:\steps\install_vcredist13.ps1"

# Setup Git Credentials
& "c:\steps\set_gitcredential.ps1"

if ($Env:ENABLE_GPU -eq "true") {
  # Install LLVMpipe software graphics driver
  & "c:\steps\install_llvmpipe.ps1"
}

# Activate Unity
if ($Env:SKIP_ACTIVATION -ne "true") {
  & "c:\steps\activate.ps1"
} else {
  Write-Host "Skipping activation"
}

# Build the project
& "c:\steps\build.ps1"

# Free the seat for the activated license
if ($Env:SKIP_ACTIVATION -ne "true") {
  & "c:\steps\return_license.ps1"
}
