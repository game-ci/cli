#!/usr/bin/env bash
#
# The capability matrix's gate: does this run's set of cells actually entitle us
# to a green build?
#
# Lifted out of the workflow's `run:` block so it can be tested. Every licensing
# incident in this repository has been a grading error rather than an activation
# error, and this file is now the last place where a run's cells are turned into
# a pass or a failure - including the decision to tolerate a known upstream
# failure, which is a decision that fails open if it is wrong.
#
# Inputs, all from the environment:
#
#   HAS_ACCOUNT     true|false - whether this context had credentials at all.
#   CONTROL_VERDICT the control cell's verdict, e.g. "pass".
#   GATING          true|false - whether a regression asserts anything.
#   COLLECTED_DIR   directory of per-cell result files. Default "collected/results".
#   TODAY           optional ISO date, for testing the tolerance expiry.
#
# Exit 0 only when the run is entitled to green.
#
set -u

COLLECTED_DIR="${COLLECTED_DIR:-collected/results}"
TODAY="${TODAY:-$(date +%F)}"

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# shellcheck source=scripts/licensing-tolerated-cells.sh
. "$REPO_ROOT/scripts/licensing-tolerated-cells.sh"

if [ "${HAS_ACCOUNT:-}" != "true" ]; then
  echo "::notice::No account credentials in this context (fork PR?) - nothing to measure, which is not a failure."
  exit 0
fi

echo "Control verdict: ${CONTROL_VERDICT:-}"

# Before anything else, and in both directions. A run whose control could not
# activate cannot certify a version any more than it can condemn one - and the
# conclusion that 2020.3.49f1 can never take a Personal seat came from exactly
# this state.
if [ "${CONTROL_VERDICT:-}" != "pass" ]; then
  echo "::error::The control cell could not complete a Personal round trip (${CONTROL_VERDICT:-none}). This run measured the account, not Unity, so no cell here is evidence about any version. Check the account's seats at https://id.unity.com/ before reading anything else."
  exit 1
fi

shopt -s nullglob
cell_files=("$COLLECTED_DIR"/*.txt)

if [ "${#cell_files[@]}" -eq 0 ]; then
  echo "::error::The control passed but no cell produced a result - the matrix measured nothing, which is not the same as finding nothing wrong."
  exit 1
fi

regressions=""
inconclusive=""
leaked=""
tolerated=""
expired=""

for f in "${cell_files[@]}"; do
  unset unityVersion method verdict classification required tolerated toleratedUntil
  # shellcheck disable=SC1090
  . "$f"
  cell="${unityVersion:-?}/${method:-?}"

  case "${verdict:-}" in
    fail:seat-leaked*) leaked="$leaked $cell" ;;
  esac

  case "${classification:-}" in
    capability-regression)
      if [ -n "${tolerated:-}" ]; then
        # Past its review date a tolerance stops tolerating. Without this the
        # file above becomes a permanent list of things nobody looks at, which
        # is the state it exists to avoid.
        if [ "$TODAY" \> "${toleratedUntil:-9999-12-31}" ]; then
          expired="$expired $cell(review by ${toleratedUntil:-?})"
        else
          tolerated="$tolerated $cell(until ${toleratedUntil:-?})"
        fi
      else
        regressions="$regressions $cell"
      fi
      ;;
    inconclusive) inconclusive="$inconclusive $cell" ;;
  esac

  # The other direction, and the reason a tolerance can be removed rather than
  # forgotten: a cell that is being tolerated and now passes is a cleared
  # upstream failure, and nothing else in this run would say so.
  if [ -n "${tolerated:-}" ] && [ "${classification:-}" = "ok" ]; then
    echo "::notice::$cell is listed as a known upstream failure in scripts/licensing-tolerated-cells.sh but completed a round trip this run. If that holds, remove the entry - the tolerance has outlived its reason."
  fi
done

# Named on its own because it is the failure that damages every later run on the
# account, not just this one - and until this gate existed nothing failed on it:
# return_license.sh only warns, and the CLI exits 0 either way.
#
# Checked before the tolerance for the same reason: no annotation in this
# repository releases a seat.
if [ -n "$leaked" ]; then
  echo "::error::Seat leaked on:$leaked - activation succeeded but no return was observed. Release the seats at https://id.unity.com/ and fix the return path before re-running."
  exit 1
fi

if [ -n "$inconclusive" ]; then
  echo "::error::Probe never reached Unity on:$inconclusive. Not a licensing finding, but those combinations were not measured, and an unmeasured cell must not read as a pass. Re-run the job - a registry or network error pulling the editor image is the usual cause, and the cell now retries that itself."
  exit 1
fi

if [ -n "$expired" ]; then
  echo "::error::Tolerated known failure(s) past their review date on:$expired. Re-measure, then either remove the entry from scripts/licensing-tolerated-cells.sh or move its date on with a fresh reason."
  exit 1
fi

if [ -n "$tolerated" ]; then
  echo "::warning::Known upstream failure, tolerated and not gating:$tolerated. These were measured, are in the report, and are recorded in scripts/licensing-tolerated-cells.sh."
fi

if [ -n "$regressions" ]; then
  if [ "$GATING" = "true" ]; then
    echo "::error::Licensing regressed against the control on:$regressions. The control completed a round trip, so this is about those Unity versions, not the account."
    exit 1
  fi
  echo "::warning::Exploratory run (custom version list) - not gating. Regressions seen:$regressions"
fi

echo "All cells completed a full activate/test/return round trip, or are recorded known upstream failures."
