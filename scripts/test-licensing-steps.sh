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
# --help is a capability probe, not an activation - it is answered without
# touching ARGV_LOG so it cannot perturb the argv assertions below.
# STUB_CLIENT_NO_INCLUDE_PERSONAL=1 emulates Unity.Licensing.Client 1.12.1
# (bundled with 2020.3.49f1), which has --activate-all but not
# --include-personal. Default is a modern client that has both.
if [ "$1" = "--help" ]; then
  echo "  --username     Optional user name"
  echo "  --password     Optional password"
  echo "  --activate-all (Default: false) Activate all subscriptions"
  if [ -z "${STUB_CLIENT_NO_INCLUDE_PERSONAL:-}" ]; then
    echo "  --include-personal (Default: false) Include personal license"
  fi
  exit 0
fi
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

# Exit status matters as much as the message here: the no-seat bug was
# precisely a case where the script said the right thing and still succeeded.
# This file runs under `set -u` and not `set -e`, so a status has to be
# captured and asserted explicitly - checking output alone would pass even if
# the script exited 0.
check_failed() {
  if [ "$2" -ne 0 ]; then
    echo "  PASS $1"
    PASS=$((PASS + 1))
  else
    echo "  FAIL $1"
    echo "       expected a non-zero exit status, got: $2"
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

# Regression: the licensing client exits 0 when it has *processed* an
# activation request, not when it has been granted a seat. Unity 2020.3.49f1's
# client 1.12.1 ends a personal activation with "No seat available." and still
# exits 0, so activate.sh reported "Activation complete." and the build went on
# to fail later with an unrelated-looking licensing error. Measured against
# real editors by .github/workflows/licensing-capability-matrix.yml.
: > "$ARGV_LOG"
OUT=$(run_step UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  STUB_OUTPUT="Activation processed successfully.
No seat available.
Trying to update entitlement license file ...
No license activation found for this computer. (UnityEntitlementLicense.xml)" \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
NO_SEAT_STATUS=$?
refute "does not report success when no seat was assigned" "$OUT" "Activation complete."
check "and says so explicitly" "$OUT" "assigned no seat"
check_failed "and exits non-zero, not merely warning" "$NO_SEAT_STATUS"

# The inverse: a genuine seat assignment must still be treated as success.
: > "$ARGV_LOG"
OUT=$(run_step UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  STUB_OUTPUT="Activation processed successfully.
Seat ID: 1375199680824-UnityPersonal
Status: [200] ASSIGN_SEAT" \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
check "still reports success when a seat was assigned" "$OUT" "Activation complete."

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

echo "Ambiguous licensing method warning"
# A credential that names a specific strategy (a .ulf, a real serial, a
# licensing server) but gets silently overridden by a different strategy is
# exactly what took two real regressions (game-ci/cli#254, #255) to fully
# diagnose - nothing said out loud which of several plausible strategies
# actually got used. warn_if_licensing_method_ambiguous exists so it does.
OUT=$(run_step UNITY_LICENSE="<License/>" UNITY_SERIAL="F4-XXXX" UNITY_EMAIL="ci@example.com" \
  UNITY_PASSWORD="pw123456" \
  bash -c 'source "$STEPS_DIR/licensing_method.sh"; resolve_unity_licensing_method' 2>&1)
check "warns when a .ulf is overridden by a complete serial triple" "$OUT" \
  "A Unity license file (.ulf) was provided, but 'serial' activation is being used instead"

OUT=$(run_step UNITY_SERIAL="F4-XXXX" UNITY_LICENSING_SERVER="http://ls:8080" \
  bash -c 'source "$STEPS_DIR/licensing_method.sh"; resolve_unity_licensing_method' 2>&1)
check "warns when a bare serial is overridden by floating" "$OUT" \
  "UNITY_SERIAL was provided, but 'floating' activation is being used instead"

OUT=$(run_step UNITY_SERIAL="F4-XXXX" UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  bash -c 'source "$STEPS_DIR/licensing_method.sh"; resolve_unity_licensing_method' 2>&1)
refute "does not warn when a complete serial triple is the only thing given" "$OUT" "##[warning]"

OUT=$(run_step UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  bash -c 'source "$STEPS_DIR/licensing_method.sh"; resolve_unity_licensing_method' 2>&1)
refute "does not warn for a plain personal setup - nothing more specific was given" "$OUT" "##[warning]"

OUT=$(run_step UNITY_LICENSING_METHOD="file" UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  bash -c 'source "$STEPS_DIR/licensing_method.sh"; resolve_unity_licensing_method' 2>&1)
refute "does not warn when an explicit UNITY_LICENSING_METHOD is set" "$OUT" "##[warning]"

echo "License file activation output"
# Regression test for game-ci/cli#252: the .ulf branch used to capture
# unity-editor's output into a variable via command substitution instead of
# streaming it through `tee` like every other strategy here, so a genuine
# (non-transient) failure surfaced nothing but the generic "Unclassified
# error" summary - the actual reason Unity gave was silently discarded.
: > "$ARGV_LOG"
cat > "$WORK/unity-editor" <<'STUB'
#!/usr/bin/env bash
echo "EDITOR $*" >> "$ARGV_LOG"
echo "DistinctiveActivationFailureReason: seat already in use by another machine"
exit 1
STUB
chmod +x "$WORK/unity-editor"
OUT=$(run_step UNITY_LICENSE="<License/>" UNITY_LICENSE_RETRY_MAX_ATTEMPTS=1 \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
check "a failed license-file activation surfaces Unity's actual output" "$OUT" \
  "DistinctiveActivationFailureReason"
check "and still reports the generic summary alongside it" "$OUT" "Unclassified error"

# Restore the always-succeeding stub for every test below.
cat > "$WORK/unity-editor" <<'STUB'
#!/usr/bin/env bash
echo "EDITOR $*" >> "$ARGV_LOG"
echo "LICENSE SYSTEM [CI stub] Next license update check is after 2099-01-01T00:00:00"
exit "${STUB_EXIT:-0}"
STUB
chmod +x "$WORK/unity-editor"

echo "File-to-personal activation fallback"
# Regression coverage for game-ci/cli#254/#255/#256's own history: a personal
# .ulf is bound to whichever machine originally requested it, so loading it
# directly fails with "Machine bindings don't match" on any other machine -
# every ephemeral CI container, every run (reported live against
# MirrorNetworking/Mirror). Two earlier, narrower fixes here didn't hold up -
# one couldn't reliably reuse a real personal .ulf's embedded serial, the
# other unconditionally preferred personal over file and broke activation on
# Unity versions whose bundled licensing client predates the
# --activate-all/--include-personal flags personal activation needs (also
# confirmed live: 2020.3.49f1 had been activating fine via plain file
# loading). The fix that actually holds for both: try file first,
# unconditionally, and fall back to personal only on this one specific,
# recognisable failure signature.
cat > "$WORK/unity-editor" <<'STUB'
#!/usr/bin/env bash
echo "EDITOR $*" >> "$ARGV_LOG"
# Mirrors the real failure exactly (MirrorNetworking/Mirror 2020.3.49f1): a
# machine-binding mismatch also emits "Access token is unavailable", which IS a
# transient signature. Without both lines the retry-budget test below passes
# trivially, because nothing would have triggered a retry in the first place.
echo "[Licensing::Module] Error: Access token is unavailable; failed to update"
echo "[Licensing::Client] Error: Code 400 while processing request (status: Machine bindings don't match)"
exit 1
STUB
chmod +x "$WORK/unity-editor"

: > "$ARGV_LOG"
OUT=$(run_step UNITY_LICENSE="<License/>" UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  UNITY_LICENSE_RETRY_MAX_ATTEMPTS=1 \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
check "falls back to personal on a machine-binding mismatch" "$OUT" \
  "falling back to activating with the Unity account"
check "and the fallback actually succeeds" "$OUT" "Activation complete."
refute "and does not also report the generic failure summary" "$OUT" "Unclassified error"
check "the file activation is attempted first" "$(head -n 1 "$ARGV_LOG")" "EDITOR"
check "the fallback invokes the licensing client, not another editor call" "$(cat "$ARGV_LOG")" \
  "CLIENT --activate-all --include-personal --username ci@example.com --password pw123456"

# Regression: the fallback used to pass --include-personal unconditionally, which
# Unity.Licensing.Client 1.12.1 (bundled with 2020.3.49f1) rejects outright with
# "Option 'include-personal' is unknown" and exit 33 - so the fallback failed on
# exactly the older editors it existed to rescue. Observed against
# MirrorNetworking/Mirror's 2020.3.49f1 matrix cell. The flags are now probed from
# the client's own --help output.
: > "$ARGV_LOG"
OUT=$(run_step UNITY_LICENSE="<License/>" UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  UNITY_LICENSE_RETRY_MAX_ATTEMPTS=1 STUB_CLIENT_NO_INCLUDE_PERSONAL=1 \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
check "falls back to personal on an older licensing client too" "$OUT" \
  "falling back to activating with the Unity account"
check "and that fallback succeeds rather than erroring on an unknown option" "$OUT" \
  "Activation complete."
check "and omits --include-personal when the client does not support it" "$(cat "$ARGV_LOG")" \
  "CLIENT --activate-all --username ci@example.com --password pw123456"
refute "and really does not pass --include-personal" "$(cat "$ARGV_LOG")" "--include-personal"

# A machine-binding mismatch is permanent, so it must not burn the retry budget
# before reaching the fallback - the same failing activation also emits
# "Access token is unavailable", which IS a transient signature.
: > "$ARGV_LOG"
OUT=$(run_step UNITY_LICENSE="<License/>" UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  UNITY_LICENSE_RETRY_MAX_ATTEMPTS=4 \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
refute "does not retry a machine-binding mismatch as though it were transient" "$OUT" \
  "known-transient licensing error (attempt 1/4)"
check "the file activation is tried exactly once before falling back" \
  "$(grep -c '^EDITOR' "$ARGV_LOG")" "1"

: > "$ARGV_LOG"
OUT=$(run_step UNITY_LICENSE="<License/>" UNITY_LICENSE_RETRY_MAX_ATTEMPTS=1 \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
refute "does not fall back without account credentials to fall back with" "$OUT" \
  "falling back to activating with the Unity account"
refute "and never invokes the licensing client" "$(cat "$ARGV_LOG")" "CLIENT"
check "so it still reports the generic failure summary" "$OUT" "Unclassified error"

cat > "$WORK/unity-editor" <<'STUB'
#!/usr/bin/env bash
echo "EDITOR $*" >> "$ARGV_LOG"
echo "Some other, unrelated activation failure"
exit 1
STUB
chmod +x "$WORK/unity-editor"

: > "$ARGV_LOG"
OUT=$(run_step UNITY_LICENSE="<License/>" UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  UNITY_LICENSE_RETRY_MAX_ATTEMPTS=1 \
  bash -c 'source "$STEPS_DIR/activate.sh"' 2>&1)
refute "does not fall back for a different, unrelated failure" "$OUT" \
  "falling back to activating with the Unity account"
refute "and never invokes the licensing client either" "$(cat "$ARGV_LOG")" "CLIENT"

cat > "$WORK/unity-editor" <<'STUB'
#!/usr/bin/env bash
echo "EDITOR $*" >> "$ARGV_LOG"
echo "[Licensing::Client] Error: Code 400 while processing request (status: Machine bindings don't match)"
exit 1
STUB
chmod +x "$WORK/unity-editor"

OUT=$(run_step UNITY_LICENSE="<License/>" UNITY_EMAIL="ci@example.com" UNITY_PASSWORD="pw123456" \
  UNITY_LICENSE_RETRY_MAX_ATTEMPTS=1 \
  bash -c 'source "$STEPS_DIR/activate.sh"; resolve_unity_license_return_strategy' 2>&1)
check "a successful fallback returns a personal seat, not nothing" "$OUT" "personal"

# Restore the always-succeeding stub for every test below.
cat > "$WORK/unity-editor" <<'STUB'
#!/usr/bin/env bash
echo "EDITOR $*" >> "$ARGV_LOG"
echo "LICENSE SYSTEM [CI stub] Next license update check is after 2099-01-01T00:00:00"
exit "${STUB_EXIT:-0}"
STUB
chmod +x "$WORK/unity-editor"

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
