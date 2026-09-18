#!/usr/bin/env bash
#
# Tests for scripts/licensing-matrix-gate.sh, the decision that turns a run's
# cells into a pass or a failure.
#
# The case that needs pinning hardest is the tolerated one, because a tolerance
# applied to the wrong thing fails OPEN: a leaked seat or an unmeasured cell
# would stop failing the build, and the gate would report green on a run that
# damaged the account. Every one of those combinations is asserted below, along
# with the inverse - that an untolerated regression still fails, so the
# mechanism cannot be used as a blanket silencer.
#
# No Unity, no Docker, no network, no credentials.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$REPO_ROOT/scripts/licensing-matrix-gate.sh"
TOLERATED_FILE="$REPO_ROOT/scripts/licensing-tolerated-cells.sh"

WORK="$(mktemp -d)"
CELLS="$WORK/cells"
trap 'rm -rf "$WORK"' EXIT

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

# The cell the repo itself records as a known upstream failure. Read from the
# file rather than hardcoded, so this suite follows the file it tests rather
# than drifting from it.
TOLERATED_CELL="$(sed -n 's/^\([^|#][^|]*\)|.*/\1/p' "$TOLERATED_FILE" | head -n 1)"
TOLERATED_VERSION="${TOLERATED_CELL%%/*}"
TOLERATED_METHOD="${TOLERATED_CELL##*/}"
check_eq "the tolerated list has an entry to test with" \
  "$([ -n "$TOLERATED_CELL" ] && echo yes || echo no)" "yes"

reset_cells() {
  rm -rf "$CELLS"
  mkdir -p "$CELLS"
}

# Writes one cell result file. Fields default to a cell that passed.
cell() {
  local version="$1" method="$2"
  shift 2
  local verdict="pass" classification="ok" tolerated="" toleratedUntil=""
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --verdict) verdict="$2"; shift 2 ;;
      --classification) classification="$2"; shift 2 ;;
      --tolerated) tolerated="$2"; shift 2 ;;
      --until) toleratedUntil="$2"; shift 2 ;;
      *) shift ;;
    esac
  done
  {
    echo "unityVersion='$version'"
    echo "method='$method'"
    echo "verdict='$verdict'"
    echo "classification='$classification'"
    echo "client='1.12.1+9338cad'"
    echo "required='true'"
    echo "note='control=pass'"
    echo "tolerated='$tolerated'"
    echo "toleratedUntil='$toleratedUntil'"
  } > "$CELLS/$version-$method.txt"
}

# The tolerated cell, with whatever overrides the caller passes.
tolerated_cell() {
  cell "$TOLERATED_VERSION" "$TOLERATED_METHOD" \
    --tolerated 'known upstream' --until 2026-12-31 "$@"
}

# gate <control> <gating> <has_account> <today>
gate() {
  GATE_OUT="$(cd "$WORK" && \
    HAS_ACCOUNT="$3" CONTROL_VERDICT="$1" GATING="$2" \
    COLLECTED_DIR="$CELLS" TODAY="$4" bash "$GATE" 2>&1)"
  GATE_STATUS=$?
}

run_gate() {
  reset_cells
  gate "$@"
}

echo "No credentials"
run_gate "" true false 2026-09-18
check_eq "a context with no account is not a failure" "$GATE_STATUS" "0"

echo
echo "The control decides first"
# The mistake that cost four rounds: concluding a version cannot activate from a
# run whose account could not activate anything.
run_gate "fail:no-activation(grant=fail:no-licence)" true true 2026-09-18
cell 2020.3.49f1 personal
gate "fail:no-activation(grant=fail:no-licence)" true true 2026-09-18
check_eq "a red control fails whatever the cells say" "$GATE_STATUS" "1"
check "and refuses to attribute it to a version" "$GATE_OUT" \
  "measured the account, not Unity"

echo
echo "A run that measured nothing"
CELLS="$WORK/does-not-exist"
gate pass true true 2026-09-18
check_eq "an empty table fails" "$GATE_STATUS" "1"
check "because finding nothing is not measuring nothing" "$GATE_OUT" \
  "measured nothing"

echo
echo "The ordinary outcomes"
run_gate pass true true 2026-09-18
cell 2022.3.62f3 personal
gate pass true true 2026-09-18
check_eq "all cells green passes" "$GATE_STATUS" "0"

reset_cells
cell 2022.3.62f3 personal
cell 2020.3.49f1 personal --classification capability-regression
gate pass true true 2026-09-18
check_eq "an untolerated regression fails" "$GATE_STATUS" "1"
check "naming the cell" "$GATE_OUT" "2020.3.49f1/personal"

reset_cells
cell 2020.3.49f1 personal --classification capability-regression
gate pass false true 2026-09-18
check_eq "but an exploratory run does not gate on it" "$GATE_STATUS" "0"
check "and says it is not gating" "$GATE_OUT" "not gating"

reset_cells
cell 2020.3.49f1 personal --verdict unknown:no-reach --classification inconclusive
gate pass true true 2026-09-18
check_eq "an unmeasured cell fails" "$GATE_STATUS" "1"
check "because unmeasured must not read as pass" "$GATE_OUT" \
  "must not read as a pass"
# The cell now fails its own job on this too, and both messages have to send
# the reader to the same next step: a registry timeout is the usual cause, and
# it is fixed by re-running rather than by changing the Unity version.
check "and sends the reader to a re-run, naming the usual cause" "$GATE_OUT" \
  "a registry or network error pulling the editor image is the usual cause"

reset_cells
cell 2020.3.49f1 personal --verdict "fail:seat-leaked(return=fail)" \
  --classification capability-regression
gate pass true true 2026-09-18
check_eq "a leaked seat fails" "$GATE_STATUS" "1"
check "pointing at the seats" "$GATE_OUT" "id.unity.com"

echo
echo "The tolerated cell"
reset_cells
tolerated_cell --classification capability-regression
gate pass true true 2026-09-18
check_eq "a recorded upstream failure does not fail the build" "$GATE_STATUS" "0"
check "but is reported rather than hidden" "$GATE_OUT" "tolerated and not gating"
check "in the report's own words" "$GATE_OUT" "Known upstream failure"

# The two ways a tolerance must NOT be able to help.
reset_cells
tolerated_cell --verdict "fail:seat-leaked(return=fail)" \
  --classification capability-regression
gate pass true true 2026-09-18
check_eq "a tolerance never covers a leaked seat" "$GATE_STATUS" "1"

reset_cells
tolerated_cell --verdict unknown:no-reach --classification inconclusive
gate pass true true 2026-09-18
check_eq "nor an unmeasured cell" "$GATE_STATUS" "1"

# A tolerance that is not yet due holds; the day after it is due, it does not.
reset_cells
tolerated_cell --classification capability-regression
gate pass true true 2026-12-31
check_eq "it holds on the review date itself" "$GATE_STATUS" "0"

reset_cells
tolerated_cell --classification capability-regression
gate pass true true 2027-01-01
check_eq "and stops holding the day after" "$GATE_STATUS" "1"
check "telling the reader what to do about it" "$GATE_OUT" "past their review date"

# Nothing else in a run would notice an upstream failure clearing, so the gate
# has to say so or the entry outlives its reason.
reset_cells
tolerated_cell
gate pass true true 2026-09-18
check_eq "a tolerated cell that now passes still passes" "$GATE_STATUS" "0"
check "and is reported as a stale tolerance" "$GATE_OUT" "outlived its reason"

echo
if [ "$FAIL" -gt 0 ]; then
  echo "Licensing matrix gate tests: $PASS passed, $FAIL FAILED"
  exit 1
fi

echo "Licensing matrix gate tests: $PASS passed"
