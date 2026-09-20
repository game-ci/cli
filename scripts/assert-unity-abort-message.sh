#!/usr/bin/env bash
#
# Grades one CLI run against the MirrorNetworking/Mirror#4128 incident: a
# container that aborts Unity, where docker's own stderr leads with its benign
# pre-pull "Unable to find image '...' locally" status line.
#
# Usage: assert-unity-abort-message.sh <log-file>
#
# The log must be the combined stdout+stderr of a `game-ci build` or
# `game-ci test` run against the aborting-editor stub built by
# .github/workflows/engine-smoke-test.yml's unity-abort-message job - see that
# job for what the stub emits and why.
#
# What went wrong, so the assertions below make sense: the CLI used to append
# its own error text - docker's stderr, i.e. pull progress - under an
# "Original error:" heading. That made the message read as an editor failing to
# load a version, while Unity's actual reason sat two lines above it. Two
# maintainers went hunting for a version problem. Hence: the reason must be the
# last thing the user sees, and the noise must not be quoted as its cause.
#
# Why this lives in a script rather than inline in the workflow, and why it has
# a sibling test-assert-unity-abort-message.sh: same reasons as
# scripts/licensing-verdict.sh. It is shell, not YAML, and shell that only ever
# runs in CI is shell nobody has syntax-checked - tests.yml's `bash -n` sweep
# only proves it parses, not that it grades.

set -uo pipefail

LOG="${1:-}"
if [ -z "$LOG" ] || [ ! -f "$LOG" ]; then
  echo "usage: $(basename "$0") <log-file>" >&2
  exit 2
fi

# The stub's own stderr, and the proof that it actually ran.
#
# Both lines matter, and the second is the one doing the work: if the image
# were missing, docker would print the first line *itself* before failing to
# pull, which would make an "the stub ran" assertion pass on a run where it
# never did. Docker never prints "Pulling from" for an image it cannot pull -
# it prints "pull access denied" - so requiring the pair pins the stub.
NOISE_LEAD="Unable to find image 'game-ci/unity-abort-stub:latest' locally"
NOISE_PROOF="Pulling from game-ci/unity-abort-stub"

REASON="Unity aborted before completing: Scripts have compiler errors."

fail=0

require() { # <literal> <what its absence would mean>
  if ! grep -qF "$1" "$LOG"; then
    echo "::error::$2 (missing from the log: $1)"
    fail=1
  fi
}

forbid() { # <literal> <what its presence would mean>
  if grep -qF "$1" "$LOG"; then
    echo "::error::$2 (found in the log: $1)"
    fail=1
  fi
}

# --- Non-vacuous guards, on the raw log -------------------------------
# Every "must not contain" below could pass on a run that died before reaching
# the editor, so prove the incident was actually reproduced first. The noise is
# legitimately in the raw log: System.run streams both streams live, and the
# fix deliberately did not stop that - it stopped the *message* repeating it.
require "$NOISE_LEAD" "the stub's stderr half never reached the log, so the incident was not reproduced"
require "$NOISE_PROOF" "the aborting stub never ran - docker's own missing-image notice is not the same thing"
require "Aborting batchmode due to failure:" "the stub's stdout half never reached the log"

# --- The final message, and only it -----------------------------------
# log.error emits one [ERROR]-prefixed console.error call per invocation, with
# the multi-line message body following on the same call's later lines, so
# "from the last [ERROR] marker to EOF" is exactly what the user is shown as
# the cause. Scoping matters: the noise is streamed live above this point, so
# asserting its absence over the whole log would fail on a correct run.
#
# Not anchored to ^: this job captures the CLI directly, where the marker does
# start the line, but the same log re-read from GitHub's viewer carries a
# "2026-09-19T12:37:25.89Z " prefix - and an anchored match would report the
# misleading "no [ERROR] line at all" rather than grading the message. The last
# match is the CLI's final error either way, so trailing output after it is
# harmless: every assertion below is a containment check.
start="$(grep -n '\[ERROR\]' "$LOG" | tail -1 | cut -d: -f1)"
start="${start:-}"

if [ -z "$start" ]; then
  echo "::error::the CLI printed no [ERROR] line at all - the run failed some other way"
  fail=1
else
  FINAL="$(mktemp)"
  tail -n "+$start" "$LOG" > "$FINAL"

  if ! grep -qF "$REASON" "$FINAL"; then
    echo "::error::the final error does not name Unity's own reason (missing: $REASON)"
    echo "--- final error block ---"
    cat "$FINAL"
    echo "-------------------------"
    fail=1
  fi

  if grep -qF 'Unable to find image' "$FINAL"; then
    echo "::error::the final error quotes docker's pull noise back as the cause - this is the Mirror#4128 regression"
    fail=1
  fi

  rm -f "$FINAL"
fi

# --- The heading, over the whole log ----------------------------------
# Sound over the whole log because only two things can print it: the shm-size
# branch in Docker.run (unreachable on an abort path) and
# UnityBatchmodeFailure.describe, which emits it only when its caller passes an
# originalMessage - and Docker.run deliberately no longer does.
forbid 'Original error:' "the final error still carries an 'Original error:' section"

if [ "$fail" -ne 0 ]; then
  exit 1
fi

echo "Unity abort message verified: Unity's own reason in the final error, docker's pull noise left in the log above it"
