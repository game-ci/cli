#!/usr/bin/env bash
#
# Drives scripts/assert-unity-abort-message.sh against synthetic logs, in both
# directions.
#
# Why this exists: the grader is the only thing standing between a regression
# and a green build, and a grader that fails open is worse than no grader. Its
# two "must not contain" assertions can only ever pass *vacuously* on a run that
# died early, so the cases below pin that it still fails when the stub degrades,
# and that the pre-#293 message really is rejected.
#
# Every log here is hand-written, which is the point: these cases assert the
# grader's own logic, not whether Unity emits what we think it does. The
# fidelity question is the engine-smoke-test job's problem, and a real log from
# a real run is what answers it.
#
# No Docker, no Unity, no network. Runs in tests.yml alongside the other
# scripts/*.sh suites.

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GRADER="$REPO_ROOT/scripts/assert-unity-abort-message.sh"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

pass=0
fail=0

# A log shaped like a correct run: the noise is streamed live (System.run does
# that on purpose and the fix did not change it), the reason is the last thing
# printed, and nothing repeats the noise under a heading.
faithful_log() {
  cat > "$1" <<'LOG'
Requesting activation (license file)
Successfully updated UnityEntitlementLicense.xml!
#   Testing in editmode  #
Unable to find image 'game-ci/unity-abort-stub:latest' locally
latest: Pulling from game-ci/unity-abort-stub
Aborting batchmode due to failure:
Scripts have compiler errors.
Build failed, with exit code 1
[ERROR] Error: Unity aborted before completing: Scripts have compiler errors.

This is a failure inside the Unity Editor itself (commonly script
compiler errors, a missing package, or a crash during startup) - not a
docker/game-ci infrastructure problem. The full Unity log is above.
    at Docker.run (src/model/docker.ts:169:13)
LOG
}

check() { # <name> <expected-exit> <log-file>
  local name="$1" expected="$2" log="$3" actual
  bash "$GRADER" "$log" > "$WORK/out" 2>&1
  actual=$?

  if [ "$actual" -eq "$expected" ]; then
    echo "ok   - $name"
    pass=$((pass + 1))
  else
    echo "FAIL - $name (expected exit $expected, got $actual)"
    sed 's/^/       /' "$WORK/out"
    fail=$((fail + 1))
  fi
}

echo "assert-unity-abort-message.sh"

# --- The direction that must pass -------------------------------------
faithful_log "$WORK/faithful.log"
check "accepts a correct run" 0 "$WORK/faithful.log"

# The same log as GitHub's log viewer renders it, every line timestamp-prefixed.
# The job captures the CLI directly, so this is not the path under test - but a
# grader that misreports a pasted log as "no [ERROR] line at all" wastes exactly
# the debugging time this whole change exists to save.
sed 's/^/2026-09-19T12:37:25.8974485Z /' "$WORK/faithful.log" > "$WORK/timestamped.log"
check "accepts a log carrying GitHub's timestamp prefixes" 0 "$WORK/timestamped.log"

# --- The regression itself --------------------------------------------
# The exact pre-#293 shape: the reason is right there, and the noise is quoted
# underneath it as the cause. This is the message two Mirror maintainers read.
cat > "$WORK/regression.log" <<'LOG'
Unable to find image 'game-ci/unity-abort-stub:latest' locally
latest: Pulling from game-ci/unity-abort-stub
Aborting batchmode due to failure:
Scripts have compiler errors.
[ERROR] Error: Unity aborted before completing: Scripts have compiler errors.

This is a failure inside the Unity Editor itself - not a docker/game-ci
infrastructure problem. The full Unity log is above.

Original error:
Unable to find image 'game-ci/unity-abort-stub:latest' locally
latest: Pulling from game-ci/unity-abort-stub
LOG
check "rejects the pre-#293 message that quotes the noise" 1 "$WORK/regression.log"

# The heading alone is enough to reject, even if the noise were stripped from
# it - a future edit could reintroduce the section with different contents.
cat > "$WORK/heading-only.log" <<'LOG'
Unable to find image 'game-ci/unity-abort-stub:latest' locally
latest: Pulling from game-ci/unity-abort-stub
Aborting batchmode due to failure:
Scripts have compiler errors.
[ERROR] Error: Unity aborted before completing: Scripts have compiler errors.

Original error:
something else entirely
LOG
check "rejects an 'Original error:' heading with any contents" 1 "$WORK/heading-only.log"

# --- The reason must survive to the end of the run ---------------------
# The original bug's shape: the reason was never in the message at all, so the
# user got a bare exit code.
cat > "$WORK/no-reason.log" <<'LOG'
Unable to find image 'game-ci/unity-abort-stub:latest' locally
latest: Pulling from game-ci/unity-abort-stub
Aborting batchmode due to failure:
Scripts have compiler errors.
[ERROR] Error: Test run failed with exit code 1
LOG
check "rejects a final error that never names the reason" 1 "$WORK/no-reason.log"

cat > "$WORK/no-error-line.log" <<'LOG'
Unable to find image 'game-ci/unity-abort-stub:latest' locally
latest: Pulling from game-ci/unity-abort-stub
Aborting batchmode due to failure:
Scripts have compiler errors.
LOG
check "rejects a log with no [ERROR] line at all" 1 "$WORK/no-error-line.log"

# --- The guards must not fail open ------------------------------------
# A degraded stub: it never wrote its stderr half, so every "must not contain"
# assertion would pass vacuously. This is the case that keeps the two above
# honest.
grep -vF 'Unable to find image' "$WORK/faithful.log" \
  | grep -vF 'Pulling from' > "$WORK/no-stderr-half.log"
check "rejects a run where the stub never emitted its stderr half" 1 "$WORK/no-stderr-half.log"

# Docker's own missing-image notice, with the stub never having run - the case
# a naive "the noise is present, so the stub ran" guard would wave through.
cat > "$WORK/docker-own-notice.log" <<'LOG'
Unable to find image 'game-ci/unity-abort-stub:latest' locally
docker: Error response from daemon: pull access denied for game-ci/unity-abort-stub, repository does not exist or may require 'docker login'.
[ERROR] Error: Command exited with code 125
LOG
check "rejects docker's own missing-image notice as proof the stub ran" 1 "$WORK/docker-own-notice.log"

# --- Bad invocation ---------------------------------------------------
bash "$GRADER" > "$WORK/out" 2>&1
if [ $? -eq 2 ]; then
  echo "ok   - exits 2 with no arguments"
  pass=$((pass + 1))
else
  echo "FAIL - exits 2 with no arguments"
  fail=$((fail + 1))
fi

bash "$GRADER" "$WORK/does-not-exist.log" > "$WORK/out" 2>&1
if [ $? -eq 2 ]; then
  echo "ok   - exits 2 for a missing log file"
  pass=$((pass + 1))
else
  echo "FAIL - exits 2 for a missing log file"
  fail=$((fail + 1))
fi

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
