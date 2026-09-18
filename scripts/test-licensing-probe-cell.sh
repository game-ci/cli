#!/usr/bin/env bash
#
# Tests for scripts/run-licensing-probe-cell.sh, the body of one capability
# matrix cell.
#
# The CLI is stubbed rather than run: this asserts what the cell does with a
# run's output, and the two preconditions that have already cost real runs -
# a project the CLI will accept, and a repository inside it for version
# detection to shell out to. Both are cheap to re-break, and neither is visible
# in a workflow diff.
#
# What a stubbed CLI cannot tell you is whether the real one behaves; that is
# what the fixtures in scripts/fixtures/licensing are for, and what the
# scheduled run of the matrix itself is for. This suite only pins the wiring
# between them.
#
# No Unity, no Docker, no network, no credentials.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURES="$REPO_ROOT/scripts/fixtures/licensing"
PROBE="$REPO_ROOT/scripts/run-licensing-probe-cell.sh"

WORK="$(mktemp -d)"
# The probe refuses a project outside the repo, so these live inside it, and go
# away with the trap whether the run passes or not.
SANDBOX="$REPO_ROOT/.probe-cell-test-$$"
trap 'rm -rf "$WORK" "$SANDBOX"' EXIT
mkdir -p "$SANDBOX"

PASS=0
FAIL=0

check_eq() {
  if [ "$2" = "$3" ]; then
    echo "  PASS $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL $1"
    echo "       expected: $3"
    echo "       actual:   $2"
    FAIL=$((FAIL + 1))
  fi
}

check() {
  if [[ "$2" == *"$3"* ]]; then
    echo "  PASS $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL $1"
    echo "       expected to contain: $3"
    echo "       actual:              $2"
    FAIL=$((FAIL + 1))
  fi
}

# A `bun` that replays a captured log instead of running a container.
STUB_BIN="$WORK/bin"
mkdir -p "$STUB_BIN"
cat > "$STUB_BIN/bun" <<'STUB'
#!/usr/bin/env bash
# The probe resolves the editor image by asking the CLI (`bun -e ...`) before
# the run. A fixed reference is the right answer for this stub: the point of
# that call is that the probe does not rebuild the tag itself, not that this
# fixture knows what the tag is.
for arg in "$@"; do
  if [ "$arg" = "-e" ]; then
    echo "unityci/editor:ubuntu-2020.3.49f1-linux-il2cpp-3"
    exit 0
  fi
done
cat "${STUB_LOG:?STUB_LOG must be set}"
STUB
chmod +x "$STUB_BIN/bun"

# A `docker` that records every pull and can be told to fail the first few, so
# the warm-up's retry, its give-up path and its permanent-error path are all
# reachable without a registry or a multi-gigabyte download. DOCKER_STUB_FAILURE
# is what the failing attempts print, so a test can say "this is a manifest
# that does not exist" as opposed to "this is a network that gave up".
cat > "$STUB_BIN/docker" <<'STUB'
#!/usr/bin/env bash
attempts="${DOCKER_STUB_ATTEMPTS:?DOCKER_STUB_ATTEMPTS must be set}"
count=0
[ -f "$attempts" ] && count="$(wc -l < "$attempts")"
echo "$*" >> "$attempts"
if [ "$count" -lt "${DOCKER_STUB_FAIL_FIRST:-0}" ]; then
  echo "${DOCKER_STUB_FAILURE:-net/http: request canceled while waiting for connection}" >&2
  exit 1
fi
exit 0
STUB
chmod +x "$STUB_BIN/docker"

# Runs one cell and leaves its exit status in CELL_STATUS, its output in
# CELL_OUT, and its result file at $WORK/out/results/<version>-<method>.txt.
run_cell() {
  local version="$1" method="$2" fixture="$3" control="$4" gating="${5:-true}"
  local out="$WORK/out"
  rm -rf "$out"
  mkdir -p "$out"
  rm -f "$WORK/docker-attempts"

  CELL_OUT="$(
    cd "$REPO_ROOT" && PATH="$STUB_BIN:$PATH" \
      STUB_LOG="$fixture" \
      CONTROL_VERDICT="$control" \
      GATING="$gating" \
      LICENSING_PROBE_PROJECT_DIR="$SANDBOX/probe-project" \
      LICENSING_PROBE_OUTPUT_DIR="$out" \
      LICENSING_PROBE_PULL_DELAY_SECONDS=0 \
      DOCKER_STUB_ATTEMPTS="$WORK/docker-attempts" \
      DOCKER_STUB_FAIL_FIRST="${DOCKER_STUB_FAIL_FIRST:-0}" \
      DOCKER_STUB_FAILURE="${DOCKER_STUB_FAILURE:-}" \
      bash "$PROBE" "$version" "$method" 2>&1
  )"
  CELL_STATUS=$?

  CELL_RESULT="$out/results/$version-$method.txt"
}

echo "Arguments"
OUT="$(bash "$PROBE" 2>&1)"; STATUS=$?
check_eq "no arguments is a usage error" "$STATUS" "2"
check "and says so" "$OUT" "usage:"

OUT="$(bash "$PROBE" 2020.3.49f1 floating 2>&1)"; STATUS=$?
check_eq "an unknown method is rejected" "$STATUS" "2"
check "naming the method it refused" "$OUT" "unknown method: floating"

# The CLI mounts the project into the build container and refuses a path
# outside the working directory. Left to the CLI that refusal lands in the log
# as one more error line among the licensing output, where it reads as "this
# version cannot activate".
OUT="$(LICENSING_PROBE_PROJECT_DIR="$WORK/elsewhere" bash "$PROBE" 2020.3.49f1 personal 2>&1)"; STATUS=$?
check_eq "a project outside the repo is refused before anything runs" "$STATUS" "1"
check "and explains why" "$OUT" "must be inside"

echo
echo "Project preparation"
LICENSING_PROBE_PROJECT_DIR="$SANDBOX/probe-project" \
  LICENSING_PROBE_PREPARE_ONLY=1 \
  bash "$PROBE" 2020.3.49f1 personal >/dev/null 2>&1
PREP="$SANDBOX/probe-project"

check_eq "the project pins the version being probed" \
  "$(cat "$PREP/ProjectSettings/ProjectVersion.txt" 2>/dev/null)" \
  "m_EditorVersion: 2020.3.49f1"

# Version detection shells out to git, and exits with "fatal: not a git
# repository" before Unity is ever launched if there is none here. The second
# run of the capability matrix lost every cell that way.
if git -C "$PREP" rev-parse --git-dir >/dev/null 2>&1; then
  echo "  PASS the prepared project is a git repository"
  PASS=$((PASS + 1))
else
  echo "  FAIL the prepared project is not a git repository"
  FAIL=$((FAIL + 1))
fi

check_eq "with a commit in it, not merely initialised" \
  "$(git -C "$PREP" rev-list --count HEAD 2>/dev/null)" \
  "1"

# Assert the status command *succeeded* before asserting it was empty.
# `git status --porcelain | wc -l` prints 0 both for a clean tree and for a git
# that failed to run at all, so on its own it grades a broken repository as a
# clean one - which is exactly the state this test exists to catch.
if STATUS_OUT="$(git -C "$PREP" status --porcelain 2>&1)"; then
  check_eq "and a clean tree, which versioning also requires" "$STATUS_OUT" ""
else
  echo "  FAIL git status could not be read (a 0 here would have meant 'clean')"
  echo "       actual:             $STATUS_OUT"
  FAIL=$((FAIL + 1))
fi

echo
echo "Grading, relative to the control"
run_cell 2020.3.49f1 personal "$FIXTURES/personal-roundtrip-success.log" pass
check_eq "a completed round trip exits 0" "$CELL_STATUS" "0"
check "records the verdict" "$(cat "$CELL_RESULT")" "verdict='pass'"
check "and calls it ok against a green control" "$(cat "$CELL_RESULT")" "classification='ok'"
# The previous workflow's capability column read "unknown" on every cell of
# every run it ever produced, because its pattern never matched this line.
check "and records which licensing client this editor bundles" \
  "$(cat "$CELL_RESULT")" "client='1.12.1+9338cad'"

# #290's bug, as an end-to-end regression test: a log that says "Activation
# complete." and "Successfully resolved entitlements" while granting nothing.
#
# Labelled 2022.3.62f3 rather than the version the log came from, deliberately:
# 2020.3.49f1/personal is the one combination in the tolerated list, and these
# assertions are about *grading*, which is version-independent. Leaving the
# label on a tolerated cell would test the tolerance instead, and would have
# quietly stopped covering the bug this test exists for.
run_cell 2022.3.62f3 personal \
  "$FIXTURES/2020.3.49f1-personal-resolved-entitlements-no-grant.log" pass
check_eq "a run that granted nothing fails the cell" "$CELL_STATUS" "1"
check "is reported as a regression, not as a pass" "$(cat "$CELL_RESULT")" \
  "classification='capability-regression'"
check "and says it is a statement about the version" "$CELL_OUT" \
  "the control cell did"

# The outcome nothing failed on before this gate existed: return_license.sh
# only warns and the CLI exits 0 either way, so a leaked seat was invisible
# until the account ran out days later.
run_cell 2020.3.49f1 personal \
  "$FIXTURES/2020.3.49f1-personal-editor-route-granted.log" pass
check_eq "taking a seat and not returning it fails the cell" "$CELL_STATUS" "1"
check "and is named as a leak" "$(cat "$CELL_RESULT")" "verdict='fail:seat-leaked"
check "pointing at the seats to release" "$CELL_OUT" "id.unity.com"

# The mistake that cost four rounds: concluding a version cannot activate from
# a run whose account could not activate anything.
run_cell 2020.3.49f1 personal \
  "$FIXTURES/2020.3.49f1-personal-resolved-entitlements-no-grant.log" \
  "fail:no-activation(grant=fail:no-licence)"
check_eq "the same failing run does not fail once the control is red" "$CELL_STATUS" "0"
check_eq "it is attributed to the environment instead" \
  "$(cat "$CELL_RESULT" 2>/dev/null | sed -n "s/^classification='\(.*\)'$/\1/p")" \
  "account-or-environment"

# GATING is what separates "this version list is a statement about what we
# support" from "someone is investigating a report". A regression only asserts
# the first, so on an exploratory run it must be recorded and not enforced.
# Not a tolerated combination (see the label note above), or it would pass for
# the wrong reason.
run_cell 2022.3.62f3 personal \
  "$FIXTURES/2020.3.49f1-personal-resolved-entitlements-no-grant.log" pass false
check_eq "a regression on an exploratory run does not fail the cell" "$CELL_STATUS" "0"
check "it is still recorded against the version" "$(cat "$CELL_RESULT")" \
  "classification='capability-regression'"
check "and is surfaced as a warning to read" "$CELL_OUT" "does not gate"
check "rather than as an error to act on" "$CELL_OUT" "did not complete a licensing round trip while the control cell did"
check "and records that it was not required" "$(cat "$CELL_RESULT")" \
  "required='false'"

# A leak is the exception: it says nothing about Unity, it damages the shared
# account for every later run, and it fails even a probe someone ran casually.
run_cell 2020.3.49f1 personal \
  "$FIXTURES/2020.3.49f1-personal-editor-route-granted.log" pass false
check_eq "a leaked seat fails even when not gating" "$CELL_STATUS" "1"
check "for the same reason as a gated leak" "$CELL_OUT" "id.unity.com"

echo
echo "Recorded upstream failures"
# 2020.3.49f1/personal is the entry in scripts/licensing-tolerated-cells.sh: it
# fails for a reason this repository cannot fix, so it is measured and reported
# without blocking. The point of these assertions is that it is *recorded* -
# the fields go into the result file, so the report and the gate can both state
# it, rather than the failure disappearing.
run_cell 2020.3.49f1 personal \
  "$FIXTURES/2020.3.49f1-personal-resolved-entitlements-no-grant.log" pass
check_eq "a tolerated failure does not fail the job" "$CELL_STATUS" "0"
check "but is still recorded as a regression" "$(cat "$CELL_RESULT")" \
  "classification='capability-regression'"
check "and carries the reason, so the report can state it" \
  "$(cat "$CELL_RESULT")" "tolerated='Unity refuses the account route"
check "with the date it has to be revisited by" "$(cat "$CELL_RESULT")" \
  "toleratedUntil='2026-12-31'"
check "and the log says out loud that it is not gating" "$CELL_OUT" \
  "Known upstream failure, tolerated until"

# The leak above, on the tolerated combination, already covers the case that a
# tolerance must not cover a leak - it was run with GATING=true and still failed.
# This pins the same thing on the record itself, so the two cannot drift.
run_cell 2020.3.49f1 personal \
  "$FIXTURES/2020.3.49f1-personal-editor-route-granted.log" pass
check_eq "a tolerance never covers a leak, even on the tolerated cell" \
  "$CELL_STATUS" "1"

echo
echo "Editor image warm-up"
# A cell that never launched Unity says nothing about licensing, and a green
# job beside it is read as "measured, and capable". This is the exact shape of
# the 2026-09-18 failure: a Docker Hub token request timed out, the cell
# reported (inconclusive), the job passed, and the aggregate gate failed the
# run - two components disagreeing about what the same cell meant.
#
# The fixture is a real round trip, so the verdict is "pass" only when the CLI
# stub is replayed; instead these assert on the warm-up's own behaviour, which
# is what the timeout exercised. DOCKER_STUB_FAIL_FIRST makes the pull fail the
# way the registry did.
DOCKER_STUB_FAIL_FIRST=1 run_cell 2020.3.49f1 personal \
  "$FIXTURES/personal-roundtrip-success.log" pass
check_eq "a failed pull is retried rather than costing the cell" \
  "$(wc -l < "$WORK/docker-attempts" | tr -d ' ')" "2"
check_eq "and the cell still exits on what it measured" "$CELL_STATUS" "0"
check "naming the attempt and the cause" "$CELL_OUT" \
  "hit a registry or network error (attempt 1 of 3)"
check "and attributing it to Docker Hub, not to this combination" "$CELL_OUT" \
  "temporary problem at Docker Hub rather than anything about this combination"
check "so the pull that follows it uses the resolved image" \
  "$(head -n 1 "$WORK/docker-attempts")" \
  "pull --quiet unityci/editor:ubuntu-2020.3.49f1-linux-il2cpp-3"

# A warm-up is not allowed to become a new way for a cell to go red, so the
# give-up path is not allowed to be fatal - and it must not write into cell.log,
# which is what the verdict is graded from.
DOCKER_STUB_FAIL_FIRST=99 run_cell 2020.3.49f1 personal \
  "$FIXTURES/personal-roundtrip-success.log" pass
check_eq "the warm-up gives up after the configured attempts" \
  "$(wc -l < "$WORK/docker-attempts" | tr -d ' ')" "3"
check_eq "giving up does not fail the cell" "$CELL_STATUS" "0"
check "and says the run continues anyway" "$CELL_OUT" \
  "Continuing anyway - the CLI pulls the image itself"
if grep -q "Could not warm the editor image" "$WORK/out/cell.log" 2>/dev/null; then
  echo "  FAIL the warm-up wrote into the graded log"
  FAIL=$((FAIL + 1))
else
  echo "  PASS the warm-up stays out of the log the verdict is graded from"
  PASS=$((PASS + 1))
fi

# A tag that does not exist will not exist on the third attempt either, and
# reporting it as a temporary problem at Docker Hub would be a claim the probe
# has no evidence for - on the one failure a reader most needs to see quickly.
DOCKER_STUB_FAIL_FIRST=99 \
DOCKER_STUB_FAILURE="manifest unknown" \
  run_cell 2020.3.49f1 personal "$FIXTURES/personal-roundtrip-success.log" pass
check_eq "a tag that does not exist is not retried" \
  "$(wc -l < "$WORK/docker-attempts" | tr -d ' ')" "1"
check "and is reported as permanent, not as a blip" "$CELL_OUT" \
  "Not retrying: this is not a transient error"
check_eq "without failing the cell either" "$CELL_STATUS" "0"

echo
echo "Unmeasured cells"
# The gate fails on these; the job has to agree with the gate. A log that never
# reached Unity is the shape both the registry timeout and the two broken-probe
# incidents took, so it is worth pinning that neither reads as a pass.
unmeasured="$FIXTURES/registry-timeout-never-reached-unity.log"

run_cell 2020.3.49f1 serial "$unmeasured" pass
check_eq "a cell that never reached Unity does not pass the job" "$CELL_STATUS" "1"
check "it is recorded as inconclusive" "$(cat "$CELL_RESULT")" \
  "classification='inconclusive'"
check "and refused as evidence about the version" "$CELL_OUT" \
  "was never measured - the editor did not start"
check "sending the reader to a re-run" "$CELL_OUT" "Re-run the job"
check "rather than to the Unity version" "$CELL_OUT" "not evidence about licensing either way"

# Same cell, exploratory run: recorded, surfaced, not enforced - the same
# treatment a regression gets, for the same reason.
run_cell 2020.3.49f1 serial "$unmeasured" pass false
check_eq "an unmeasured cell on an exploratory run does not fail the job" \
  "$CELL_STATUS" "0"
check "but is still surfaced as not measured" "$CELL_OUT" \
  "read the cell as absent rather than as capable"
check "and still recorded as inconclusive" "$(cat "$CELL_RESULT")" \
  "classification='inconclusive'"

echo
if [ "$FAIL" -gt 0 ]; then
  echo "Licensing probe cell tests: $PASS passed, $FAIL FAILED"
  exit 1
fi

echo "Licensing probe cell tests: $PASS passed"
