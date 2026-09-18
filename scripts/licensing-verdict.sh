#!/usr/bin/env bash
#
# Grades a licensing cell from the log of a real run.
#
# Why this is a script rather than a few grep lines inside the workflow: every
# licensing incident this project has had - four rounds, three shipped "fixes"
# - was a *grading* error, not an activation error.
#
#   - The probes printed "Activation complete" when Unity had assigned no seat,
#     so a broken activation read as a success and surfaced later as an
#     unrelated-looking licensing error (#268).
#   - The capability matrix awarded a pass for the *absence* of a known failure
#     string, and reported 2020.3.49f1/personal green while its own log said
#     "No seat available".
#   - A restated copy of the return-success pattern was already stale the first
#     time it ran, so a verified successful return graded as a failure (#278).
#   - The run that concluded "2020.3.49f1 cannot use a Personal seat" was graded
#     from an account that could not activate anything at that moment. Six days
#     earlier the same account had assigned a Personal serial on that exact
#     version (see the fixture of the same name).
#
# Grading logic buried in YAML can only be exercised by running the whole
# workflow against real Unity, which is how it stayed wrong through three
# fixes. Here it is a pure function of a log file, tested on every PR against
# captured real logs (scripts/test-licensing-verdict.sh).
#
# Three rules, each one paid for:
#
#   1. A pass requires POSITIVE evidence that the thing happened. Absence of a
#      known failure string only catches failures already seen.
#   2. Patterns already defined by the scripts under test are read out of those
#      scripts, so they cannot go stale behind a restated copy.
#   3. "The account cannot activate anything right now" and "this Unity version
#      cannot activate" are different verdicts, and the second may only be
#      concluded from a run where the first is known false. That distinction is
#      what lv_classify exists for, and its absence is what cost four rounds.
#
# Used as a library by scripts/test-licensing-verdict.sh, and as a CLI by
# .github/workflows/licensing-capability-matrix.yml:
#
#   licensing-verdict.sh roundtrip <method> <log>
#   licensing-verdict.sh grant     <method> <log>
#   licensing-verdict.sh return    <log>
#   licensing-verdict.sh classify  <control-verdict> <cell-verdict>

set -o pipefail

LICENSING_VERDICT_ROOT="${LICENSING_VERDICT_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"

# Unity, in its own words, reporting that it holds no licence it can give this
# machine. Split out from the generic "did the licensing module run at all"
# test below so that "cannot activate" is never confused with "the probe died
# before reaching Unity" - the first run of the capability matrix reported
# eight "cannot activate" cells that were really one broken probe.
LV_NO_LICENCE_PATTERN='No seat available|No license activation found for this computer|No valid Unity Editor license found|License is not active'

# Evidence that Unity's licensing machinery actually ran. Deliberately broad:
# this only has to separate "Unity tried and declined" from "Unity was never
# launched", and a narrower test here would misreport a broken probe as a
# finding about licensing.
LV_LICENSING_REACHED_PATTERN='Licensing::|Requesting activation|Licensing method:'

# The licence is bound to the machine that activated it, so a return from a
# different container is refused no matter how many times it is retried. As a
# verdict this is "not measured", not "failed" - but it is also the reason the
# matrix may never activate and return as two separate commands (see
# lv_classify's callers and the workflow's one-container cells).
LV_MACHINE_BINDING_PATTERN="Machine bindings don't match"

# lv_grant_pattern <method> -> a regex matching positive evidence that a seat
# was granted, or nothing if the method has no such evidence.
#
# The personal shapes are two because there are two routes: the licensing
# client reports a seat assignment, and the editor - used where the client is
# too old to request a Personal seat, as on 2020.3's 1.12.1 - reports a
# Personal serial being assigned instead. The editor shape is anchored on the
# assignment line: a bare "UnityPers" substring also matches unrelated
# diagnostic text, which combined with any other line would be a false pass.
lv_grant_pattern() {
  case "$1" in
    personal) printf '%s' 'Status: \[200\] ASSIGN_SEAT|Seat ID:|Serial number assigned to:.*UnityPers' ;;
    serial)   printf '%s' 'Serial number assigned to' ;;
    *)        return 1 ;;
  esac
}

# lv_return_success_pattern -> the return-success regex, read from the script
# that does the returning rather than restated here. A copy of this pattern was
# stale the first time it was used (#278), and a matrix that disagrees with the
# code it measures is worse than no matrix.
lv_return_success_pattern() {
  local script="$LICENSING_VERDICT_ROOT/dist/platforms/ubuntu/steps/return_license.sh"
  [ -f "$script" ] || return 1

  sed -n "s/^UNITY_LICENSE_RETURN_SUCCESS_PATTERN='\(.*\)'$/\1/p" "$script" |
    head -n 1
}

# The text the return script prints when there was no seat to give back. Not a
# failure: nothing was held. Read from the script for the same reason as the
# success pattern.
lv_return_nothing_held_pattern() {
  local script="$LICENSING_VERDICT_ROOT/dist/platforms/ubuntu/steps/return_license.sh"
  [ -f "$script" ] || return 1

  sed -n "s/^UNITY_LICENSE_RETURN_NO_ULF_PATTERN='\(.*\)'$/\1/p" "$script" |
    head -n 1
}

# lv_grant_verdict <method> <log> -> pass | fail:no-licence | fail:no-grant-evidence | unknown:never-reached-unity
lv_grant_verdict() {
  local method="$1" log="$2" pattern

  [ -f "$log" ] || { printf '%s' 'unknown:no-log'; return 0; }

  if ! grep -qE "$LV_LICENSING_REACHED_PATTERN" "$log"; then
    printf '%s' 'unknown:never-reached-unity'
    return 0
  fi

  pattern="$(lv_grant_pattern "$method" || true)"
  if [ -n "$pattern" ] && grep -qE "$pattern" "$log"; then
    printf '%s' 'pass'
    return 0
  fi

  if grep -qE "$LV_NO_LICENCE_PATTERN" "$log"; then
    printf '%s' 'fail:no-licence'
    return 0
  fi

  # Unity ran and never said it had no licence, but also never produced the
  # evidence shape we accept. Something changed that this grader does not know
  # about - which is a finding, not a pass, because the only alternative is
  # guessing that it probably worked. That guess is the bug in #290.
  printf '%s' 'fail:no-grant-evidence'
}

# lv_return_verdict <log> -> pass | none | unmeasurable | fail:unknown-outcome | unknown:never-reached-unity
lv_return_verdict() {
  local log="$1" success nothing_held

  [ -f "$log" ] || { printf '%s' 'unknown:no-log'; return 0; }

  if ! grep -qE "$LV_LICENSING_REACHED_PATTERN" "$log"; then
    printf '%s' 'unknown:never-reached-unity'
    return 0
  fi

  success="$(lv_return_success_pattern || true)"
  if [ -n "$success" ] && grep -qE "$success" "$log"; then
    printf '%s' 'pass'
    return 0
  fi

  # Checked after the success pattern, never instead of it: the "no ULF to
  # return" line is printed on the way to a successful entitlement return, so
  # treating it as "nothing held" in isolation would grade a real success as
  # nothing having happened.
  nothing_held="$(lv_return_nothing_held_pattern || true)"
  if [ -n "$nothing_held" ] && grep -qF "$nothing_held" "$log"; then
    printf '%s' 'none'
    return 0
  fi

  if grep -qF "$LV_MACHINE_BINDING_PATTERN" "$log"; then
    printf '%s' 'unmeasurable'
    return 0
  fi

  printf '%s' 'fail:unknown-outcome'
}

# lv_roundtrip_verdict <method> <log> -> pass | fail:seat-leaked | fail:no-activation | ...
#
# Grades one activation -> work -> return cycle from a single log, which is
# only possible when the cycle ran in a single container. That is the shape a
# real `game-ci build`/`test` has, and the shape the capability matrix now
# uses, because activating and returning as two commands is not something a
# user can do either.
lv_roundtrip_verdict() {
  local method="$1" log="$2" grant_verdict return_verdict

  grant_verdict="$(lv_grant_verdict "$method" "$log")"
  return_verdict="$(lv_return_verdict "$log")"

  if [ "$grant_verdict" = 'pass' ] && [ "$return_verdict" = 'pass' ]; then
    printf '%s' 'pass'
    return 0
  fi

  # Took a seat and gave nothing back. The most expensive outcome there is -
  # it degrades every later run on the account, not just this one (#277) - and
  # until now it was not failed anywhere, because return_license.sh only ever
  # warns and the CLI exits 0 either way.
  if [ "$grant_verdict" = 'pass' ] && [ "$return_verdict" != 'pass' ]; then
    printf '%s' "fail:seat-leaked(return=$return_verdict)"
    return 0
  fi

  printf '%s' "fail:no-activation(grant=$grant_verdict)"
}

# lv_classify <control-verdict> <cell-verdict> -> ok | capability-regression |
#   account-or-environment | inconclusive
#
# The discriminator this project spent four rounds without. A cell turning red
# means one of two very different things, and conflating them is what produced
# the claim that Unity 2020.3 cannot take a Personal seat - a claim made from a
# run where every cell was red for a reason that had nothing to do with 2020.3.
lv_classify() {
  local control="$1" cell="$2"

  # A control that could not activate means the account or the environment is
  # the variable. No conclusion about any version may be drawn from this run,
  # including a positive one: a green cell here is as untrustworthy as a red
  # one, because the next run may see a different account.
  case "$control" in
    pass) ;;
    *) printf '%s' 'account-or-environment'; return 0 ;;
  esac

  case "$cell" in
    pass)               printf '%s' 'ok' ;;
    unknown:*|fail:no-activation\(grant=unknown:*) printf '%s' 'inconclusive' ;;
    *)                  printf '%s' 'capability-regression' ;;
  esac
}

# --- CLI ---------------------------------------------------------------------

lv_main() {
  local command="$1"
  shift

  case "$command" in
    grant)     lv_grant_verdict "$@" ;;
    return)    lv_return_verdict "$@" ;;
    roundtrip) lv_roundtrip_verdict "$@" ;;
    classify)  lv_classify "$@" ;;
    *)
      echo "usage: $(basename "$0") {grant|return|roundtrip|classify} ..." >&2
      return 2
      ;;
  esac
}

if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  lv_main "$@"
fi
