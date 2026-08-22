# Ported from ../../ubuntu/steps/set_extra_git_configs.sh (same behavior,
# native Windows host-mode script set - see runsteps.ps1's doc comment).
# GIT_CONFIG_EXTENSIONS is a newline-separated list of "key=value" pairs.
if ([string]::IsNullOrEmpty($Env:GIT_CONFIG_EXTENSIONS)) {
  Write-Host 'GIT_CONFIG_EXTENSIONS unset skipping'
} else {
  Write-Host 'GIT_CONFIG_EXTENSIONS is set configuring extra git configs'

  $lines = $Env:GIT_CONFIG_EXTENSIONS -split "`n" | Where-Object { $_.Trim() -ne '' }
  foreach ($line in $lines) {
    $separatorIndex = $line.IndexOf('=')
    if ($separatorIndex -lt 0) {
      Write-Host "Error parsing config: $line"
      exit 1
    }
    $key = $line.Substring(0, $separatorIndex)
    $value = $line.Substring($separatorIndex + 1)
    Write-Host "Adding extra git config: `"$key`" = `"$value`""
    git config --global --add $key $value
  }
}

Write-Host '---------- git config --list -------------'
git config --list

Write-Host '---------- git config --list --show-origin -------------'
git config --list --show-origin
