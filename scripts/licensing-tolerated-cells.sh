#!/usr/bin/env bash
#
# Cells this repository knows are failing, and has chosen to keep measuring
# without gating on.
#
# This file exists because the alternative is worse in both directions. A matrix
# that gates on a failure nobody here can fix is a red X that blocks every
# unrelated change until someone stops reading it, and a matrix that removes the
# cell stops measuring the thing that is broken. So the failure stays measured,
# stays visible in the report, and does not block - and every entry carries a
# date by which it has to be revisited, because a known-failure list with no
# expiry is how a gate quietly becomes decorative.
#
# This is NOT a general "flaky cell" escape hatch:
#
#   - A leaked seat is never tolerated. That is damage to the shared account
#     rather than a statement about a Unity version, and it is answered by
#     releasing the seat, not by adding an entry here.
#   - An inconclusive cell is never tolerated. It means the probe never reached
#     Unity, so nothing was measured, and "not measured" must not read as
#     "nothing wrong".
#   - A tolerance does not silence the cell. It is printed in the report as a
#     tolerated failure, and the run emits a warning.
#   - A tolerated cell that starts passing emits a notice saying so, so the
#     entry gets removed rather than outliving its reason.
#   - Past its review date the entry stops tolerating and the gate fails again.
#
# Format: one entry per line, three pipe-separated fields.
#
#   <version>/<method>|<review-by YYYY-MM-DD>|<one-line reason, no '|' or newline>
#
# Lines beginning with '#' and blank lines are ignored.
#
LICENSING_TOLERATED_CELLS='
2020.3.49f1/personal|2026-12-31|Unity refuses the account route for the licensing client bundled with this editor (1.12.1, which has no --include-personal). Measured granting a Personal seat on 2026-09-11 and refused on 2026-09-18 across four runs, each with the control cell and every other cell green - so this is neither a code regression nor a limit of the Unity version.
'

#
# Prints "<review-by><TAB><reason>" for a tolerated cell, or returns non-zero.
#
# $1 - "<version>/<method>"
#
licensing_tolerance() {
  local key="$1" entry cell

  while IFS= read -r entry; do
    case "$entry" in
      '' | '#'*) continue ;;
    esac

    cell="${entry%%|*}"
    if [ "$cell" = "$key" ]; then
      printf '%s\t%s\n' \
        "$(printf '%s' "$entry" | cut -d'|' -f2)" \
        "$(printf '%s' "$entry" | cut -d'|' -f3-)"
      return 0
    fi
  done <<< "$LICENSING_TOLERATED_CELLS"

  return 1
}
