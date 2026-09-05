#!/usr/bin/env bash
#
# Behavioural tests for the licensing step scripts under
# dist/platforms/ubuntu/steps, run against a stub Unity.Licensing.Client.
#
# Sibling of validate-platform-scripts.sh, which only parses these files.
# Parsing is not enough here: the thing that actually matters about the
# licensing steps is *which* client invocation each credential combination
# produces, and whether the seat is given back on every exit path. Both are
# behaviour, and neither is visible to a syntax check or to a TypeScript unit
# test - the logic lives in bash.
#
# The seat-return case is the one worth the machinery. Unity's move of
# Personal onto per-organization seats means a leaked seat breaks every
# later run on the account, not just the run that leaked it, so
# "return_license ran even though the build hard-exited" is a real
# regression test rather than a hypothetical one.
#
# No Unity, no Docker, no network - the stub records its argv and exits with
# whatever the test asks for.

set -u

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STEPS_SRC="$REPO_ROOT/dist/platforms/ubuntu/steps"

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

export ARGV_LOG="$WORK/argv.log"
: > "$ARGV_LOG"

cat > "$WORK/Unity.Licensing.Client" <<'STUB'
#!/usr/bin/env bash
echo "CLIENT $*" >> "$ARGV_LOG"
echo "${STUB_OUTPUT:-stub output}"
exit "${STUB_EXIT:-0}"
STUB
chmod +x "$WORK/Unity.Licensing.Client"

# The serial and .ulf strategies drive the editor rather than the licensing
# client, so the backwards-compatibility checks below need it stubbed too.
cat > "$WORK/unity-editor" <<'STUB'
#!/usr/bin/env bash
echo "EDITOR $*" >> "$ARGV_LOG"
echo "LICENSE SYSTEM [CI stub] Next license update check is after 2099-01-01T00:00:00"
exit "${STUB_EXIT:-0}"
STUB
chmod +x "$WORK/unity-editor"
export PATH="$WORK:$PATH"

export UNITY_LICENSING_CLIENT_PATH="$WORK/Unity.Licensing.Client"
export ACTIVATE_LICENSE_PATH="$WORK/activate"
mkdir -p "$ACTIVATE_LICENSE_PATH"
export STEPS_DIR="$STEPS_SRC"

PASS=0
FAIL=0

# Runs a step script with only the credentials a case explicitly sets, so a
# stray UNITY_* in the ambient environment can't change which branch is taken.
run_step() {
  # RETURN_LICENSE_ONLY/ACTIVATE_ONLY are cleared too: they select which branch
  # runsteps.sh takes, so one left set in the ambient environment would make a
  # case exercise a different path than its name claims. Assignments in "$@"
  # still win - env applies -u before them.
  env -u UNITY_LICENSING_METHOD -u UNITY_SERIAL -u UNITY_LICENSE \
      -u UNITY_LICENSE_FILE -u UNITY_LICENSING_SERVER -u UNITY_EMAIL -u UNITY_PASSWORD \
      -u RETURN_LICENSE_ONLY -u ACTIVATE_ONLY \
      "$@"
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

refute() {
  if [[ "$2" != *"$3"* ]]; then
    echo "  PASS $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL $1 (unexpectedly contained: $3)"
    FAIL=$((FAIL + 1))
  fi
}

echo "Personal activation"
: > "$ARGV_LOG"
OUT=$(run_step UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
check "email+password resolves to the personal strategy" "$OUT" "Licensing method: personal"
check "activation succeeds" "$OUT" "Activation complete."
check "invokes the licensing client, not the editor" "$(cat "$ARGV_LOG")" \
  "CLIENT --activate-all --include-personal --username ci@example.com --password pw123456"

echo "Personal return"
: > "$ARGV_LOG"
run_step UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  bash -c 'source "$STEPS_DIR/return_license.sh"' > /dev/null 2>&1
check "returns the seat with --return-ulf" "$(cat "$ARGV_LOG")" "CLIENT --return-ulf"

echo "Strategy precedence"
OUT=$(run_step UNITY_LICENSING_SERVER="http://ls:8080" UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
# Floating-server users commonly set account credentials too; personal must
# not steal those runs away from their license server.
check "a licensing server still wins over personal" "$OUT" "Licensing method: floating"

OUT=$(run_step UNITY_SERIAL="F4-XXXX" UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
check "a serial still wins over personal" "$OUT" "Licensing method: serial"

: > "$ARGV_LOG"
OUT=$(run_step UNITY_LICENSING_METHOD="personal" UNITY_SERIAL="F4-XXXX" \
  UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
check "an explicit method overrides detection" "$OUT" "Licensing method: personal"
check "and actually takes the personal branch" "$(cat "$ARGV_LOG")" "--activate-all"

OUT=$(run_step bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
check "no credentials still reports undetermined" "$OUT" "could not be determined"
check "and lists the personal option" "$OUT" "UNITY_EMAIL + UNITY_PASSWORD"

echo "Exhaustive precedence parity with the pre-personal script"
# The strongest guard available here: for all 64 combinations of the six
# licensing env vars, the strategy chosen today must equal the branch the
# original activate.sh took, with `personal` allowed only where the original
# matched nothing and exited 1.
#
# Spot checks miss this. Routing activation through a resolver is exactly the
# kind of change that looks equivalent and quietly reorders one branch for one
# credential combination that nobody on the team happens to use.
source "$STEPS_SRC/licensing_method.sh"

# The original chain, verbatim from before `personal` existed.
original_strategy() {
  if { [ -z "$UNITY_SERIAL" ] || [ -z "$UNITY_EMAIL" ] || [ -z "$UNITY_PASSWORD" ]; } &&
     { [ -n "$UNITY_LICENSE" ] || [ -n "$UNITY_LICENSE_FILE" ]; }; then
    echo "file"
  elif [ -n "$UNITY_SERIAL" ] && [ -n "$UNITY_EMAIL" ] && [ -n "$UNITY_PASSWORD" ]; then
    echo "serial"
  elif [ -n "$UNITY_LICENSING_SERVER" ]; then
    echo "floating"
  else
    echo ""
  fi
}

MATRIX_MISMATCHES=0
MATRIX_NEW=0
for mask in $(seq 0 63); do
  UNITY_LICENSING_METHOD=''
  (( mask & 1 ))  && UNITY_SERIAL='F4-XXXX'          || UNITY_SERIAL=''
  (( mask & 2 ))  && UNITY_EMAIL='ci@example.com'    || UNITY_EMAIL=''
  (( mask & 4 ))  && UNITY_PASSWORD='pw123456'       || UNITY_PASSWORD=''
  (( mask & 8 ))  && UNITY_LICENSE='<License/>'      || UNITY_LICENSE=''
  (( mask & 16 )) && UNITY_LICENSE_FILE='/tmp/a.ulf' || UNITY_LICENSE_FILE=''
  (( mask & 32 )) && UNITY_LICENSING_SERVER='http://ls:8080' || UNITY_LICENSING_SERVER=''

  before="$(original_strategy)"
  after="$(resolve_unity_licensing_method)"

  if [ "$before" = "$after" ]; then
    continue
  fi

  # The one sanctioned difference: a combination the original refused to
  # activate at all now resolves to personal.
  if [ -z "$before" ] && [ "$after" = "personal" ] &&
     [ -n "$UNITY_EMAIL" ] && [ -n "$UNITY_PASSWORD" ]; then
    MATRIX_NEW=$((MATRIX_NEW + 1))
    continue
  fi

  echo "  FAIL mask=$mask changed strategy: '$before' -> '$after'"
  echo "       SERIAL='$UNITY_SERIAL' EMAIL='$UNITY_EMAIL' PASSWORD='$UNITY_PASSWORD'"
  echo "       LICENSE='$UNITY_LICENSE' LICENSE_FILE='$UNITY_LICENSE_FILE' SERVER='$UNITY_LICENSING_SERVER'"
  MATRIX_MISMATCHES=$((MATRIX_MISMATCHES + 1))
done
unset UNITY_SERIAL UNITY_EMAIL UNITY_PASSWORD UNITY_LICENSE UNITY_LICENSE_FILE UNITY_LICENSING_SERVER UNITY_LICENSING_METHOD

check "all 64 credential combinations keep their original strategy" "$MATRIX_MISMATCHES" "0"
check "exactly one combination newly resolves to personal" "$MATRIX_NEW" "1"

echo "Backwards compatibility (pre-existing setups must not change branch)"
# These are the combinations most at risk from routing activation through a
# resolved strategy instead of the original inline conditions. Each asserts the
# branch this script took before `personal` existed.

OUT=$(run_step UNITY_LICENSE="<License/>" UNITY_LICENSING_SERVER="http://ls:8080" \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
check "a .ulf still beats a licensing server" "$OUT" "Licensing method: file"

OUT=$(run_step UNITY_SERIAL="F4-XXXX" UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw" \
  UNITY_LICENSING_SERVER="http://ls:8080" \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
check "serial credentials still beat a licensing server" "$OUT" "Licensing method: serial"

OUT=$(run_step UNITY_SERIAL="F4-XXXX" UNITY_LICENSE="<License/>" \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
# Incomplete serial credentials must still fall through to the .ulf, which is
# what the original "all three or nothing" condition did.
check "a bare serial does not beat a .ulf" "$OUT" "Licensing method: file"

# The dangerous direction: a return that used to happen must still happen.
# The original return conditions keyed off the raw env vars, not the strategy.
: > "$ARGV_LOG"
run_step UNITY_SERIAL="F4-XXXX" UNITY_LICENSE="<License/>" \
  bash -c 'source "$STEPS_DIR/return_license.sh"' > /dev/null 2>&1
check "a .ulf run with UNITY_SERIAL set still issues a serial return" "$(cat "$ARGV_LOG")" "EDITOR"
check "and it is a -returnlicense call" "$(cat "$ARGV_LOG")" "-returnlicense"

: > "$ARGV_LOG"
run_step UNITY_LICENSE="<License/>" UNITY_LICENSING_SERVER="http://ls:8080" \
  bash -c 'source "$STEPS_DIR/return_license.sh"' > /dev/null 2>&1
check "a run with a licensing server still issues a floating return" "$(cat "$ARGV_LOG")" "--return-floating"

: > "$ARGV_LOG"
run_step UNITY_LICENSING_METHOD="serial" UNITY_SERIAL="F4-XXXX" UNITY_LICENSING_SERVER="http://ls:8080" \
  bash -c 'source "$STEPS_DIR/return_license.sh"' > /dev/null 2>&1
# An explicit strategy has to govern the return too, or the run would activate
# one license and hand back a different one.
check "an explicit strategy governs the return" "$(cat "$ARGV_LOG")" "-returnlicense"
refute "and does not fall back to floating" "$(cat "$ARGV_LOG")" "--return-floating"

echo "Failure classification"
OUT=$(run_step UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  STUB_EXIT=1 STUB_OUTPUT="Error: no available seats for this organization" \
  UNITY_LICENSE_RETRY_MAX_ATTEMPTS=1 \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
check "seat exhaustion is named" "$OUT" "no available Personal seats"
refute "and not confused with 2FA" "$OUT" "second factor"

OUT=$(run_step UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  STUB_EXIT=1 STUB_OUTPUT="Error: verification code required" \
  UNITY_LICENSE_RETRY_MAX_ATTEMPTS=1 \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
check "a 2FA challenge is named" "$OUT" "second factor"

echo "Seat return on every exit path"
# A steps directory of the real licensing scripts plus a build.sh that hard-
# exits the way a crashed Unity does. Before runsteps.sh armed an EXIT trap,
# this path silently skipped return_license.sh and leaked the seat.
FAKE_STEPS="$WORK/steps"
mkdir -p "$FAKE_STEPS"
cp "$STEPS_SRC"/{activate.sh,return_license.sh,runsteps.sh,licensing_method.sh,resolve_unity_path.sh} "$FAKE_STEPS/"
echo 'true' > "$FAKE_STEPS/set_extra_git_configs.sh"
echo 'true' > "$FAKE_STEPS/set_gitcredential.sh"
printf '#!/usr/bin/env bash\necho "build starting"\nexit 42\n' > "$FAKE_STEPS/build.sh"

: > "$ARGV_LOG"
run_step STEPS_DIR="$FAKE_STEPS" UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  bash "$FAKE_STEPS/runsteps.sh" > /dev/null 2>&1
EXIT_CODE=$?
check "seat is returned even when the build hard-exits" "$(cat "$ARGV_LOG")" "CLIENT --return-ulf"
check "the build's exit code is still propagated" "$EXIT_CODE" "42"

printf '#!/usr/bin/env bash\necho "build ok"\nBUILD_EXIT_CODE=0\n' > "$FAKE_STEPS/build.sh"
: > "$ARGV_LOG"
run_step STEPS_DIR="$FAKE_STEPS" UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  bash "$FAKE_STEPS/runsteps.sh" > /dev/null 2>&1
check "the happy path returns exactly once, not twice" "$(grep -c -- '--return-ulf' "$ARGV_LOG")" "1"

: > "$ARGV_LOG"
run_step STEPS_DIR="$FAKE_STEPS" RETURN_LICENSE_ONLY=true \
  UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  bash "$FAKE_STEPS/runsteps.sh" > /dev/null 2>&1
check "RETURN_LICENSE_ONLY returns the seat" "$(cat "$ARGV_LOG")" "--return-ulf"
refute "RETURN_LICENSE_ONLY does not activate first" "$(cat "$ARGV_LOG")" "--activate-all"

: > "$ARGV_LOG"
run_step STEPS_DIR="$FAKE_STEPS" ACTIVATE_ONLY=true \
  UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  bash "$FAKE_STEPS/runsteps.sh" > /dev/null 2>&1
check "ACTIVATE_ONLY activates" "$(cat "$ARGV_LOG")" "--activate-all"
# Deliberate: `game-ci activate` hands a live license to a later step, which
# is what `game-ci return-license` then releases.
refute "ACTIVATE_ONLY leaves the seat held by design" "$(cat "$ARGV_LOG")" "--return-ulf"

echo
if [ "$FAIL" -gt 0 ]; then
  echo "Licensing step tests: $PASS passed, $FAIL FAILED"
  exit 1
fi

echo "Licensing step tests: $PASS passed"
