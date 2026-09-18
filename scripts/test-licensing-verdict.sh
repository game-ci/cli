#!/usr/bin/env bash
#
# Tests for scripts/licensing-verdict.sh against captured real Unity logs.
#
# Sibling of test-licensing-steps.sh, and deliberately the same shape - the
# difference is what it is testing. That suite asserts which client invocation
# a credential combination produces, using a *stub* client. This one asserts how
# a run's outcome is *graded*, using logs that real Unity editors actually
# emitted, because the gap between those two things is where every licensing
# incident in this repository has lived:
#
#   - The stub client answers --help, records argv, and exits 0. It cannot
#     reject a flag the real client 1.12.1 does not have, which is how a broken
#     fallback shipped three times.
#   - Every grading bug was invisible to the stub suite and to the TypeScript
#     unit tests, and each one was found by a user, in production.
#
# So the fixtures under scripts/fixtures/licensing are verbatim (trimmed) real
# logs, including the two that fooled a grader in opposite directions: one where
# Unity assigned a Personal serial on 2020.3.49f1 after the account had been
# declared incapable of it, and one that succeeded on a return path while
# printing "Error:" twice.
#
# No Unity, no Docker, no network, no credentials.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FIXTURES="$REPO_ROOT/scripts/fixtures/licensing"

# shellcheck source=scripts/licensing-verdict.sh
. "$REPO_ROOT/scripts/licensing-verdict.sh"

WORK="$(mktemp -d)"
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

# The single most important assertion in this file: a run where Unity declined
# to grant anything must never grade as a pass, however many reassuring lines it
# printed on the way.
refute() {
  if [[ "$2" != *"$3"* ]]; then
    echo "  PASS $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL $1 (unexpectedly contained: $3)"
    FAIL=$((FAIL + 1))
  fi
}

echo "Activation: positive evidence only"
check_eq "a granted editor-route activation passes" \
  "$(lv_grant_verdict personal "$FIXTURES/2020.3.49f1-personal-editor-route-granted.log")" \
  "pass"

check_eq "a client that processed a request and assigned nothing fails" \
  "$(lv_grant_verdict personal "$FIXTURES/2020.3.49f1-personal-client-route-no-seat.log")" \
  "fail:no-licence"

# #290's exact bug, as a standing regression test: the script printed
# "Activation complete." and "Successfully resolved entitlements" while the
# editor had already said it had no licence. Both lines are in the fixture.
check_eq "resolved entitlements without an assignment fails" \
  "$(lv_grant_verdict personal "$FIXTURES/2020.3.49f1-personal-resolved-entitlements-no-grant.log")" \
  "fail:no-licence"
refute "and never reports the script's own 'Activation complete.' as success" \
  "$(lv_grant_verdict personal "$FIXTURES/2020.3.49f1-personal-resolved-entitlements-no-grant.log")" \
  "pass"

# Records the same bug from the other side: the fixture *does* contain the
# Personal serial shape, so a grader that accepted it as evidence would pass.
check_eq "the granted fixture really is distinguishable" \
  "$(lv_grant_verdict personal "$FIXTURES/2020.3.49f1-personal-editor-route-granted.log")" \
  "pass"

cat > "$WORK/decoy.log" <<'DECOY'
Licensing method: personal
Some diagnostic text mentioning UnityPersonal in passing.
Activation complete.
DECOY
check_eq "a passing mention of UnityPersonal is not a grant" \
  "$(lv_grant_verdict personal "$WORK/decoy.log")" \
  "fail:no-grant-evidence"

cat > "$WORK/no-unity.log" <<'NOUNITY'
[ERROR] Error: Engine not detected from projectPath
NOUNITY
check_eq "a probe that never reached Unity is not a licensing finding" \
  "$(lv_grant_verdict personal "$WORK/no-unity.log")" \
  "unknown:never-reached-unity"

echo
echo "Return: success evidence first, everything else after"
check_eq "a return that succeeded while printing Error: lines still passes" \
  "$(lv_return_verdict "$FIXTURES/personal-return-success.log")" \
  "pass"

# The other direction: "no ULF file to return" is printed on the way to a
# successful entitlement return, so matching it before the success pattern
# would grade a real return as nothing having happened.
refute "and the ULF-not-found line did not pre-empt that" \
  "$(lv_return_verdict "$FIXTURES/personal-return-success.log")" \
  "none"

check_eq "a return refused on machine bindings is unmeasurable, not failed" \
  "$(lv_return_verdict "$FIXTURES/serial-return-machine-bindings.log")" \
  "unmeasurable"

cat > "$WORK/returned.log" <<'RETURNED'
Licensing method: serial
[Licensing::Module] License has been returned
RETURNED
check_eq "the other success spellings in the script's own pattern still pass" \
  "$(lv_return_verdict "$WORK/returned.log")" \
  "pass"

cat > "$WORK/nothing-held.log" <<'NOTHING'
Licensing method: personal
Returning personal license seat
An error occured while trying to return the ULF license. Ulf license file not found (/root/.local/share/unity3d/Unity/Unity_lic.ulf) (1404)
No Personal license seat was held - nothing to return.
NOTHING
check_eq "nothing held is its own outcome, not a failure" \
  "$(lv_return_verdict "$WORK/nothing-held.log")" \
  "none"

echo
echo "Round trip: one container, so both halves are graded from one log"
check_eq "a full round trip passes" \
  "$(lv_roundtrip_verdict personal "$FIXTURES/personal-roundtrip-success.log")" \
  "pass"

# The most expensive failure there is, and the one that had no gate at all
# until now: return_license.sh only warns, and the CLI exits 0 either way.
check "taking a seat and giving nothing back is a leak, not a pass" \
  "$(lv_roundtrip_verdict personal "$FIXTURES/2020.3.49f1-personal-editor-route-granted.log")" \
  "fail:seat-leaked"

check "a round trip with no activation fails on the activation half" \
  "$(lv_roundtrip_verdict personal "$FIXTURES/2020.3.49f1-personal-client-route-no-seat.log")" \
  "fail:no-activation"

echo
echo "Classification: environment failure is not a capability finding"
check_eq "green control, green cell" "$(lv_classify pass pass)" "ok"
check_eq "green control, red cell is a real regression" \
  "$(lv_classify pass 'fail:no-licence')" "capability-regression"
check_eq "red control, red cell says nothing about the version" \
  "$(lv_classify 'fail:seat-leaked' 'fail:no-licence')" "account-or-environment"
# Asymmetric on purpose: a run whose control could not activate cannot certify a
# version any more than it can condemn one, so a green cell must not be read as
# a pass either. The run that declared 2020.3.49f1 incapable had exactly this
# shape, and it also reported other cells green.
check_eq "red control, green cell is still not evidence" \
  "$(lv_classify 'fail:no-licence' pass)" "account-or-environment"
check_eq "green control, dead probe is inconclusive rather than a regression" \
  "$(lv_classify pass 'unknown:never-reached-unity')" "inconclusive"

echo
echo "Patterns are read from the scripts, not restated"
PATTERN="$(lv_return_success_pattern)"
check "the return pattern is read from return_license.sh" \
  "$PATTERN" "Successfully returned the entitlement license"
check "and covers the floating spelling too" \
  "$PATTERN" "Successfully returned floating license"

# A renamed variable would otherwise leave the pattern empty, which must not
# quietly degrade into grading every return as a failure - or every one as a
# pass. An empty result has to be detectable by the caller, and the workflow
# treats it as an error for exactly this reason.
RENAMED="$(mktemp -d)"
mkdir -p "$RENAMED/dist/platforms/ubuntu/steps"
printf '%s\n' "UNITY_LICENSE_RETURN_SOMETHING_ELSE='x'" \
  > "$RENAMED/dist/platforms/ubuntu/steps/return_license.sh"
if (
  export LICENSING_VERDICT_ROOT="$RENAMED"
  # shellcheck source=scripts/licensing-verdict.sh
  . "$REPO_ROOT/scripts/licensing-verdict.sh"
  pattern="$(lv_return_success_pattern)"
  [ -n "$pattern" ]
); then
  echo "  FAIL a renamed pattern variable still produced a usable pattern"
  FAIL=$((FAIL + 1))
else
  echo "  PASS a renamed pattern variable leaves nothing to grade against"
  PASS=$((PASS + 1))
fi
rm -rf "$RENAMED"

echo
if [ "$FAIL" -gt 0 ]; then
  echo "Licensing verdict tests: $PASS passed, $FAIL FAILED"
  exit 1
fi

echo "Licensing verdict tests: $PASS passed"
