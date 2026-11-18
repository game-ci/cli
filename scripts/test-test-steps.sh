#!/usr/bin/env bash
#
# Tests how dist/platforms/ubuntu/steps/test.sh grades a test run.
#
# Unity can exit 0 without having run any tests: an editor that crashes at
# startup or is cut short writes no results file (cli#317, cli#318). A run is
# only a success when Unity's exit code says so AND the results file exists.
#
# Runs the real step against a stub unity-editor. No Unity, no Docker, no network.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STEP="$REPO_ROOT/dist/platforms/ubuntu/steps/test.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

failures=0
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1" >&2; failures=$((failures + 1)); }
check_equal() {
  if [ "$2" = "$3" ]; then pass "$1"; else fail "$1 (expected '$3', got '$2')"; fi
}
check_contains() {
  if grep -qF -- "$3" <<< "$2"; then pass "$1"; else fail "$1 (expected output to contain '$3')"; fi
}

# A stand-in for unity-editor: exits with $STUB_EXIT_CODE, and writes the file
# passed as -testResults when $STUB_WRITES_RESULTS is true, or names that
# file's platform. Given -builtTestRunnerPath, it builds that "player" as a copy of
# itself, which xvfb-run then starts.
mkdir -p "$WORK/bin"
cat > "$WORK/bin/unity-editor" <<'EOF'
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
EOF
chmod +x "$WORK/bin/unity-editor"
printf '#!/usr/bin/env bash\nshift 3\nexec "$@"\n' > "$WORK/bin/xvfb-run"
chmod +x "$WORK/bin/xvfb-run"
mkdir -p "$WORK/test-runner-action/Assets/Editor" "$WORK/test-runner-action/Assets/Player"

# Sources the step the way runsteps.sh does, and prints its output followed by
# a last line with TEST_RUNNER_EXIT_CODE.
run_step() {
  local workspace
  workspace="$(mktemp -d "$WORK/workspace.XXXX")"
  mkdir -p "$workspace/project"
  (
    # The step runs without strict mode in runsteps.sh too.
    set +euo pipefail
    export PATH="$WORK/bin:$PATH"
    export GITHUB_WORKSPACE="$workspace"
    export PROJECT_PATH=project
    export ARTIFACTS_PATH=artifacts
    export COVERAGE_RESULTS_PATH=coverage
    export COVERAGE_ENABLED=false
    export TEST_RUNNER_ACTION_DIR="$WORK/test-runner-action"
    export TEST_PLATFORMS="$1"
    export STUB_EXIT_CODE="$2"
    export STUB_WRITES_RESULTS="$3"
    # shellcheck source=/dev/null
    source "$STEP" 2>&1
    echo "TEST_RUNNER_EXIT_CODE=$TEST_RUNNER_EXIT_CODE"
  )
}

exit_code_of() { tail -n 1 <<< "$1" | sed 's/^TEST_RUNNER_EXIT_CODE=//'; }

output="$(run_step editmode 0 true)"
check_equal 'a run with results passes' "$(exit_code_of "$output")" 0

output="$(run_step editmode 2 true)"
check_equal 'failing tests keep exit code 2' "$(exit_code_of "$output")" 2

output="$(run_step editmode 0 false)"
check_equal 'exit code 0 without a results file fails' "$(exit_code_of "$output")" 1
error_line="$(grep -F '::error::' <<< "$output" || true)"
check_contains 'reports it as an error annotation' "$error_line" 'wrote no test results'
check_contains 'the error names the missing results file' "$error_line" 'editmode-results.xml'

output="$(run_step 'editmode;playmode' 0 editmode)"
check_equal 'a later platform without results still fails the run' "$(exit_code_of "$output")" 1

output="$(run_step standalone 0 true)"
check_equal 'a standalone run with player results passes' "$(exit_code_of "$output")" 0

output="$(run_step standalone 0 false)"
check_equal 'a standalone player without results fails' "$(exit_code_of "$output")" 1

output="$(run_step COMBINE_RESULTS 0 false)"
check_equal 'COMBINE_RESULTS writes no results file and passes' "$(exit_code_of "$output")" 0

if [ "$failures" -gt 0 ]; then
  echo "$failures test(s) failed" >&2
  exit 1
fi
echo "All test step tests passed."
