#!/usr/bin/env bash
#
# Tests for dist/platforms/ubuntu/steps/clear_stale_pid_files.sh.
#
# Unity records the PIDs of its helper processes in the project's Library
# (Library/ilpp.pid, Library/MSBuild/buildhost.pid) and kills those PIDs as
# "lingering" helpers when it next starts, without checking what they now are.
# Every container starts its own PID numbering from 1, so in the next container
# a PID left by the previous one can belong to the editor itself: Unity 6000.6
# editors died with "Killed" (exit 137) when a build ran after another build or
# a test run on the same project.
#
# No Unity, no Docker, no network.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STEP="$REPO_ROOT/dist/platforms/ubuntu/steps/clear_stale_pid_files.sh"
ENTRYPOINT="$REPO_ROOT/dist/platforms/ubuntu/entrypoint.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

failures=0
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1" >&2; failures=$((failures + 1)); }
check() {
  local name="$1"
  shift
  if "$@"; then pass "$name"; else fail "$name"; fi
}

# Runs the step against a project directory, in a subshell like entrypoint.sh's environment.
run_step() {
  local project_path="$1"
  (
    export GITHUB_WORKSPACE="$WORK/workspace"
    export PROJECT_PATH="$project_path"
    # shellcheck source=/dev/null
    source "$STEP"
  )
}

# Removes both PID files and keeps everything else in Library
project="$WORK/workspace/My Project"
mkdir -p "$project/Library/MSBuild"
echo 352 > "$project/Library/ilpp.pid"
echo 118 > "$project/Library/MSBuild/buildhost.pid"
echo keep > "$project/Library/ArtifactDB"
output="$(run_step "My Project")"

check "removes Library/ilpp.pid" test ! -e "$project/Library/ilpp.pid"
check "removes Library/MSBuild/buildhost.pid" test ! -e "$project/Library/MSBuild/buildhost.pid"
check "keeps other Library files" grep -qx keep "$project/Library/ArtifactDB"
check "logs the removed PID file and its PID" grep -q "Library/ilpp.pid (PID 352)" <<<"$output"

# A project without a Library (first build) is fine
mkdir -p "$WORK/workspace/fresh"
if run_step "fresh" >/dev/null; then pass "succeeds without a Library"; else fail "fails without a Library"; fi

# entrypoint.sh clears the PID files before any step runs, as root, in every container
step_line="$(grep -n 'clear_stale_pid_files.sh' "$ENTRYPOINT" | head -1 | cut -d: -f1)"
runsteps_line="$(grep -n 'runsteps.sh' "$ENTRYPOINT" | head -1 | cut -d: -f1)"
if [ -n "$step_line" ] && [ -n "$runsteps_line" ] && [ "$step_line" -lt "$runsteps_line" ]; then
  pass "entrypoint.sh clears stale PID files before running the steps"
else
  fail "entrypoint.sh does not clear stale PID files before running the steps"
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures test(s) failed" >&2
  exit 1
fi
echo "All stale PID file tests passed."
