#!/usr/bin/env bash
#
# Runs one licensing capability cell: prepares a Unity project, drives a real
# one-container `game-ci test`, and grades the round trip with
# scripts/licensing-verdict.sh.
#
# The cell body lives here rather than in the workflow for two reasons. It is
# the same body for the control cell and for every matrix cell, and the parts of
# it that have ever gone wrong are shell, not YAML:
#
#   - Pointing the probe at a directory that is not a Unity project reports
#     "Engine not detected from projectPath" and dies before Unity is launched,
#     which is indistinguishable from "this combination cannot activate" unless
#     you already know. The first run of the capability matrix reported eight
#     "cannot activate" cells that were one broken probe.
#   - The project sits outside the checkout, and version detection shells out to
#     git; without a repository there it exits with "fatal: not a git
#     repository" before Unity is launched either. The second run reported eight
#     cells "never reached Unity" for that reason.
#
# Both are cheap to re-introduce and cheap to assert against, which is what
# scripts/test-licensing-probe-cell.sh does.
#
# Unlike the workflow it replaced, this activates and returns in ONE container,
# via the CLI's own entrypoint trap. That is the only shape in which a
# machine-bound seat can be returned at all - and the only shape a user runs.
#
# Usage: run-licensing-probe-cell.sh <unity-version> <personal|serial>
#
# Environment:
#   CONTROL_VERDICT   verdict of the control cell, for classification.
#   GATING            true|false - whether a regression here asserts anything.
#   UNITY_EMAIL, UNITY_PASSWORD, UNITY_SERIAL   credentials.
#   LICENSING_PROBE_PREPARE_ONLY   1 to prepare the project and stop (tests use this).

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

UNITY_VERSION="${1:-}"
METHOD="${2:-}"

if [ -z "$UNITY_VERSION" ] || [ -z "$METHOD" ]; then
  echo "usage: $(basename "$0") <unity-version> <personal|serial>" >&2
  exit 2
fi

case "$METHOD" in
  personal|serial) ;;
  *) echo "unknown method: $METHOD (expected personal or serial)" >&2; exit 2 ;;
esac

CONTROL_VERDICT="${CONTROL_VERDICT:-unknown:no-control}"
GATING="${GATING:-false}"

# Must be inside the checkout: the CLI refuses a project path that is not under
# the working directory, because it has to mount it into the build container
# ("Run game-ci from inside the project, or from a parent directory of it").
# Asserted here rather than left to the CLI, because the CLI's refusal appears
# in the log as one more error line among the licensing output, where it reads
# as "this combination cannot activate" - which is the misreading that made the
# first two runs of the capability matrix worthless. Overridable so the
# assertions in scripts/test-licensing-probe-cell.sh can exercise this path
# without writing into the working tree.
PROJECT_DIR="${LICENSING_PROBE_PROJECT_DIR:-$REPO_ROOT/probe-project}"
# Where cell.log and results/ land. The workflow uploads both from the repo
# root; overridable so tests do not write into the working tree.
OUTPUT_DIR="${LICENSING_PROBE_OUTPUT_DIR:-$REPO_ROOT}"
CELL_LOG="$OUTPUT_DIR/cell.log"

case "$PROJECT_DIR" in
  "$REPO_ROOT"/*) ;;
  *)
    echo "::error::The probe project must be inside $REPO_ROOT (got $PROJECT_DIR) - the CLI mounts the project into the build container and refuses paths outside the working directory."
    exit 1
    ;;
esac

# Prepare the project every version is probed against. dist/BlankProject is the
# minimal project the CLI already ships.
prepare_project() {
  rm -rf "$PROJECT_DIR"
  cp -R "$REPO_ROOT/dist/BlankProject" "$PROJECT_DIR"

  # Its committed ProjectVersion pins one editor; the cell decides the version,
  # so rewrite it to match rather than relying on --engineVersion alone to
  # override a project that disagrees.
  echo "m_EditorVersion: $UNITY_VERSION" > "$PROJECT_DIR/ProjectSettings/ProjectVersion.txt"

  # Committing as well as initialising matters: an uncommitted tree is a dirty
  # branch, which versioning also refuses to build from.
  git -C "$PROJECT_DIR" init --quiet
  git -C "$PROJECT_DIR" config user.email "ci@game.ci"
  git -C "$PROJECT_DIR" config user.name "GameCI licensing probe"
  git -C "$PROJECT_DIR" add -A
  git -C "$PROJECT_DIR" commit --quiet -m "Licensing probe fixture"
}

# What this editor bundles, recorded for the report. The previous version of
# this workflow tried to grep the client version out of the log with a pattern
# that never matched, so the column read "unknown" on every cell of every run it
# ever produced - a capability matrix whose capability column was always blank.
extract_client_version() {
  grep -oE 'Version:[[:space:]]+[0-9]+\.[0-9]+\.[0-9]+(\+[0-9a-f]+)?' "$CELL_LOG" 2>/dev/null |
    head -n 1 |
    sed -E 's/^Version:[[:space:]]+//' ||
    true
}

prepare_project || {
  echo "::error::Could not prepare the probe project at $PROJECT_DIR"
  exit 1
}

if [ "${LICENSING_PROBE_PREPARE_ONLY:-}" = "1" ]; then
  echo "Project prepared at $PROJECT_DIR"
  exit 0
fi

mkdir -p "$OUTPUT_DIR/results"

# One invocation, one container: activate -> test -> return, with the seat
# return armed on the entrypoint's EXIT trap so it fires even when the test run
# hard-exits. --targetPlatform is explicit because the default resolves to the
# host's native target, and the base image cannot run test assemblies at all.
# --testPlatforms editmode and no coverage keep the cell short; neither affects
# licensing, which is what is being measured.
set -o pipefail
bun run src/index.ts test "$PROJECT_DIR" \
  --docker \
  --engineVersion "$UNITY_VERSION" \
  --targetPlatform StandaloneLinux64 \
  --testPlatforms editmode \
  --coverageEnabled false 2>&1 | tee "$CELL_LOG" || true

VERDICT="$(bash "$REPO_ROOT/scripts/licensing-verdict.sh" roundtrip "$METHOD" "$CELL_LOG")"
CLASSIFICATION="$(bash "$REPO_ROOT/scripts/licensing-verdict.sh" classify "$CONTROL_VERDICT" "$VERDICT")"
CLIENT="$(extract_client_version)"

# A cell this repository knows is broken upstream, recorded in one place with a
# review date. Recorded rather than hidden: the fields go into the result file
# so the report states it, and the gate below is the only thing it softens.
# shellcheck source=scripts/licensing-tolerated-cells.sh
. "$REPO_ROOT/scripts/licensing-tolerated-cells.sh"
TOLERANCE="$(licensing_tolerance "$UNITY_VERSION/$METHOD" || true)"
TOLERATED_NOTE=""
TOLERATED_UNTIL=""
if [ -n "$TOLERANCE" ]; then
  TOLERATED_UNTIL="${TOLERANCE%%$'\t'*}"
  TOLERATED_NOTE="${TOLERANCE#*$'\t'}"
fi

{
  echo "unityVersion='$UNITY_VERSION'"
  echo "method='$METHOD'"
  echo "verdict='$VERDICT'"
  echo "classification='$CLASSIFICATION'"
  echo "client='${CLIENT:-unknown}'"
  echo "required='$GATING'"
  echo "note='control=$CONTROL_VERDICT'"
  echo "tolerated='$TOLERATED_NOTE'"
  echo "toleratedUntil='$TOLERATED_UNTIL'"
} > "$OUTPUT_DIR/results/$UNITY_VERSION-$METHOD.txt"

echo
echo "Cell $UNITY_VERSION/$METHOD: $VERDICT ($CLASSIFICATION, control=$CONTROL_VERDICT)"
if [ -n "$TOLERATED_NOTE" ]; then
  echo "Known upstream failure, tolerated until $TOLERATED_UNTIL: $TOLERATED_NOTE"
fi

# Fail the job on the two outcomes somebody has to act on, so a red cell is
# visible as a red job rather than only as a row in a summary. The workflow's
# report job gates on the aggregate as well, because a matrix job's failure and
# a missing cell look the same from outside.

# A leaked seat fails whatever GATING says, and that asymmetry is deliberate.
# GATING=false means "this version list is exploratory, so its result is a
# finding rather than a verdict" - which is a statement about a Unity version.
# A leak is not a statement about Unity at all: it is damage to the shared
# account that degrades every later run, and it is worth failing a probe run to
# make someone go and release the seat.
#
# A tolerance never covers a leak, for the same reason: releasing the seat is
# the fix, and no amount of annotating this file releases it.
case "$VERDICT" in
  fail:seat-leaked*)
    echo "::error::$UNITY_VERSION/$METHOD took a seat and did not return it. Release the account's seats at https://id.unity.com/ - a leaked seat degrades every later run, not just this one."
    exit 1
    ;;
esac

# A regression is the one classification that asserts something about this Unity
# version, so it is the one that must respect GATING. A custom version list is
# someone investigating a report; failing their run on a version they chose to
# probe, on a PR that has nothing to do with it, is how a gate gets disabled by
# the people it is meant to protect.
if [ "$CLASSIFICATION" = "capability-regression" ]; then
  if [ -n "$TOLERATED_NOTE" ]; then
    echo "::warning::$UNITY_VERSION/$METHOD did not complete a licensing round trip while the control cell did. This is a recorded upstream failure, tolerated until $TOLERATED_UNTIL, so it does not fail the build - it is in the report as a tolerated failure. If Unity has since fixed it, remove the entry from scripts/licensing-tolerated-cells.sh."
    exit 0
  fi
  if [ "$GATING" = "true" ]; then
    echo "::error::$UNITY_VERSION/$METHOD did not complete a licensing round trip, and the control cell did. This is a statement about this Unity version, method or flag combination."
    exit 1
  fi
  echo "::warning::$UNITY_VERSION/$METHOD did not complete a licensing round trip while the control cell did, but this is an exploratory run (custom version list) and does not gate. Recorded as a finding to read, not a red build."
fi

exit 0
