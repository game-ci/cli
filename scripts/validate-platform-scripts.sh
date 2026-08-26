#!/usr/bin/env bash
#
# Validates the shell/PowerShell scripts under dist/platforms and
# dist/default-build-script - the ones the compiled CLI binary and default
# build script actually mount/copy at runtime (see release-cli.yml's
# `cp -r dist pkg/dist`). These are hand-maintained, not build outputs, so
# nothing else in CI ever parsed them at all until now.
#
# Added after a single session found five real bugs hiding in exactly this
# class of file - none would have compiled, typechecked, or unit-tested
# their way into visibility, because none of them are TypeScript:
#   - #159: unquoted $VAR expansion in a bash script word-split a path
#     containing spaces into multiple argv entries.
#   - #176: a Windows Copy-Item missing -Force broke retries.
#   - #180: $ACTIVATE_LICENSE_PATH (missing the required $Env: prefix)
#     silently resolved to an empty string throughout two PowerShell
#     scripts, and a separate -logfile call was missing its path argument
#     entirely.
# This script can't catch every one of those (word-splitting and a missing
# -Force are semantic, not syntactic), but it catches the ones that are
# mechanically detectable, and is the natural place to grow more checks as
# new instances of this class of bug turn up.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

fail=0

echo "== Syntax-checking bash scripts under dist/platforms =="
while IFS= read -r -d '' file; do
  if ! bash -n "$file"; then
    echo "FAIL: $file has a bash syntax error (see above)"
    fail=1
  fi
done < <(find dist/platforms -type f -name '*.sh' -print0)

echo
echo "== Syntax-checking PowerShell scripts under dist/platforms =="
if command -v pwsh >/dev/null 2>&1; then
  # One pwsh process for every file, not one-per-file - pwsh's own startup
  # cost dominates otherwise (each launch is real wall-clock time this
  # script pays per .ps1 file).
  if ! pwsh -NoProfile -Command '
    $ErrorActionPreference = "Stop"
    $failed = $false
    Get-ChildItem -Path "dist/platforms" -Filter "*.ps1" -Recurse | ForEach-Object {
      $err = $null
      [System.Management.Automation.PSParser]::Tokenize((Get-Content $_.FullName -Raw), [ref]$err) | Out-Null
      if ($err) {
        Write-Host "FAIL: $($_.FullName) has a PowerShell syntax error:"
        $err | ForEach-Object { Write-Host "  $($_.Message)" }
        $script:failed = $true
      }
    }
    if ($failed) { exit 1 }
  '; then
    fail=1
  fi
else
  echo "pwsh not available - skipping PowerShell syntax checks"
fi

echo
echo "== Checking for \$VAR where \$Env:VAR was meant (PowerShell) =="
# A bare $ACTIVATE_LICENSE_PATH-style reference to a name that's used as
# $Env:NAME *anywhere* across dist/platforms is almost certainly a missing
# $Env: prefix (see #180) rather than a deliberately-scoped local variable -
# real local variables in these scripts don't collide with env var names.
# Built from every $Env:NAME across the whole tree, not just the same file:
# the original #180 bug (dist/platforms/windows/activate.ps1) never once
# used $Env:ACTIVATE_LICENSE_PATH correctly *in that file*, so a same-file-only
# comparison would have missed the exact bug this check exists to catch.
all_ps1_code=$(find dist/platforms -type f -name '*.ps1' -exec grep -vE '^\s*#' {} \;)
known_env_names=$(grep -oE '\$Env:[A-Za-z_][A-Za-z0-9_]*' <<< "$all_ps1_code" | sed -E 's/\$Env://' | sort -u || true)

while IFS= read -r -d '' file; do
  # Strip comment-only lines (optional leading whitespace then #) first, so
  # prose that mentions $NAME (like this very script's own explanatory
  # comments) doesn't trip the check - only real code counts.
  code_only=$(grep -vE '^\s*#' "$file")
  while IFS= read -r name; do
    [ -z "$name" ] && continue
    # Match $NAME not preceded by "Env:" and not followed by a word char
    # (so $NAME doesn't false-positive on $NAMEEXTRA).
    matches=$(grep -nE "(^|[^:a-zA-Z0-9_])\\\$${name}([^a-zA-Z0-9_]|\$)" <<< "$code_only" | grep -v "\\\$Env:${name}" || true)
    if [ -n "$matches" ]; then
      echo "FAIL: $file references \$${name} without the \$Env: prefix - \$Env:${name} is used elsewhere in dist/platforms, so this is almost certainly a missing prefix"
      echo "$matches"
      fail=1
    fi
  done <<< "$known_env_names"
done < <(find dist/platforms -type f -name '*.ps1' -print0)

echo
echo "== Checking for -logfile/-logFile with no path argument (PowerShell) =="
# -logfile with nothing after it (immediately followed by a pipe, or by
# nothing at all) gives Unity no path to write to, and it exits immediately
# with "Unable to open log file, exiting." (exit code 127) - the same bug
# hit twice: once in activate.ps1/return_license.ps1 (#180), and again in
# build.ps1 (unity-builder#844 investigation) once activation itself was
# fixed and the pipeline finally reached the build step for the first time.
while IFS= read -r -d '' file; do
  code_only=$(grep -vE '^\s*#' "$file")
  matches=$(grep -inE -- '-logfile[[:space:]]*(\||`?[[:space:]]*$)' <<< "$code_only" || true)
  if [ -n "$matches" ]; then
    echo "FAIL: $file uses -logfile/-logFile with no path argument - Unity needs a real path or it exits immediately"
    echo "$matches"
    fail=1
  fi
done < <(find dist/platforms -type f -name '*.ps1' -print0)

echo
if [ "$fail" -ne 0 ]; then
  echo "One or more platform script checks failed - see FAIL lines above."
  exit 1
fi
echo "All platform script checks passed."
