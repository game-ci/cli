#!/usr/bin/env bash
#
# Tests for dist/platforms/ubuntu/steps/setup_host_user.sh.
#
# RUN_AS_HOST_USER creates a container user matching the host UID/GID that owns
# the project. Ubuntu 24.04 based images already have an `ubuntu` user/group at
# 1000 - the usual UID/GID of a self-hosted runner's account - so creating it
# fails. RUN_AS_HOST_USER_REUSE_EXISTING=true reuses the existing one instead;
# without it the behavior is unchanged.
#
# The account commands are stubbed with shell functions over a fake passwd/group
# database, so this needs no root, no Docker, no network.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
STEP="$REPO_ROOT/dist/platforms/ubuntu/steps/setup_host_user.sh"
ENTRYPOINT="$REPO_ROOT/dist/platforms/ubuntu/entrypoint.sh"

failures=0
pass() { echo "PASS $1"; }
fail() { echo "FAIL $1" >&2; failures=$((failures + 1)); }
expect_line() {
  local name="$1" line="$2" output="$3"
  if grep -qxF -- "$line" <<<"$output"; then pass "$name"; else fail "$name (missing: $line)"; fi
}
expect_no_match() {
  local name="$1" pattern="$2" output="$3"
  if grep -q -- "$pattern" <<<"$output"; then fail "$name (unexpected: $pattern)"; else pass "$name"; fi
}

# Sources the step like entrypoint.sh does (as root, under set -e) with the
# account commands stubbed. EXISTING_GROUPS / EXISTING_USERS are "id:name"
# lists. Prints the commands it ran, then the final user/group names.
# shellcheck disable=SC2329 # the stubs are called by the sourced step
run_step() {
  local userid="$1" groupid="$2" username="$3" groupname="$4" reuse="$5"
  (
    set -e
    lookup() { # lookup <db> <id> -> name
      local entry
      for entry in $1; do [[ "${entry%%:*}" == "$2" ]] && { echo "${entry#*:}"; return 0; }; done
      return 2
    }
    getent() {
      local name
      if [[ "$1" == group ]]; then name="$(lookup "$EXISTING_GROUPS" "$2")" || return 2; echo "$name:x:$2:"
      else name="$(lookup "$EXISTING_USERS" "$2")" || return 2; echo "$name:x:$2:$2::/home/$name:/bin/bash"; fi
    }
    groupadd() {
      echo "groupadd $*"
      lookup "$EXISTING_GROUPS" "$2" >/dev/null && { echo "groupadd: GID '$2' already exists" >&2; return 4; }
      return 0
    }
    useradd() {
      echo "useradd $*"
      lookup "$EXISTING_USERS" "$2" >/dev/null && { echo "useradd: UID $2 is not unique" >&2; return 4; }
      return 0
    }
    usermod() { echo "usermod $*"; }
    mkdir() { echo "mkdir $*"; }
    chown() { echo "chown $*"; }

    export USERID="$userid" GROUPID="$groupid" USERNAME="$username" GROUPNAME="$groupname"
    export RUN_AS_HOST_USER_REUSE_EXISTING="$reuse"
    # shellcheck source=/dev/null
    source "$STEP"
    echo "result $USERNAME:$GROUPNAME"
  )
}

# Ubuntu 24.04 images: `ubuntu` already holds UID/GID 1000
EXISTING_GROUPS="0:root 1000:ubuntu"
EXISTING_USERS="0:root 1000:ubuntu"

# Default: a UID/GID the image doesn't have is created, as before
out="$(run_step 1001 1001 UNKNOWN UNKNOWN '')"
expect_line "default: creates the group" "groupadd -g 1001 UNKNOWN" "$out"
expect_line "default: creates the user" "useradd -u 1001 -g 1001 UNKNOWN" "$out"
expect_line "default: runs as the created user" "result UNKNOWN:UNKNOWN" "$out"

# Default: an existing UID/GID still fails, unchanged. Not run as an `if`
# condition: bash ignores `set -e` there, even inside the subshell.
set +e
out="$(run_step 1000 1000 ubuntu ubuntu '' 2>&1)"
status=$?
set -e
if [ "$status" -ne 0 ]; then pass "default: existing GID 1000 still fails"; else fail "default: existing GID 1000 should still fail"; fi
expect_no_match "default: stops at the failed groupadd" "^useradd" "$out"

# Opt-in: an existing UID/GID is reused, nothing is created
out="$(run_step 1000 1000 ubuntu ubuntu true)"
expect_no_match "reuse: does not create the group" "^groupadd" "$out"
expect_no_match "reuse: does not create the user" "^useradd" "$out"
expect_line "reuse: logs the reused group" "Reusing existing group ubuntu (GID 1000)" "$out"
expect_line "reuse: logs the reused user" "Reusing existing user ubuntu (UID 1000)" "$out"
expect_line "reuse: sets the host GID as primary group" "usermod -g 1000 ubuntu" "$out"
expect_line "reuse: prepares the user's home" "chown ubuntu:ubuntu /home/ubuntu" "$out"
expect_line "reuse: runs as the existing user" "result ubuntu:ubuntu" "$out"

# Opt-in: names come from the image, not from what stat reported
out="$(run_step 1000 1000 UNKNOWN UNKNOWN true)"
expect_line "reuse: takes names from the image" "result ubuntu:ubuntu" "$out"

# Opt-in: a UID/GID the image doesn't have is still created
out="$(run_step 1001 1001 UNKNOWN UNKNOWN true)"
expect_line "reuse: creates a missing group" "groupadd -g 1001 UNKNOWN" "$out"
expect_line "reuse: creates a missing user" "useradd -u 1001 -g 1001 UNKNOWN" "$out"

# Opt-in: existing UID with a new GID - create the group, reuse the user
out="$(run_step 1000 1001 ubuntu UNKNOWN true)"
expect_line "mixed: creates the missing group" "groupadd -g 1001 UNKNOWN" "$out"
expect_no_match "mixed: does not create the user" "^useradd" "$out"
expect_line "mixed: moves the user to the host GID" "usermod -g 1001 ubuntu" "$out"
expect_line "mixed: runs as the existing user" "result ubuntu:UNKNOWN" "$out"

# entrypoint.sh sets the user up through this step, before switching to it
step_line="$(grep -n 'setup_host_user.sh' "$ENTRYPOINT" | head -1 | cut -d: -f1)"
su_line="$(grep -n 'su -p' "$ENTRYPOINT" | head -1 | cut -d: -f1)"
if [ -n "$step_line" ] && [ -n "$su_line" ] && [ "$step_line" -lt "$su_line" ]; then
  pass "entrypoint.sh sets up the host user before switching to it"
else
  fail "entrypoint.sh does not set up the host user before switching to it"
fi

if [ "$failures" -gt 0 ]; then
  echo "$failures test(s) failed" >&2
  exit 1
fi
echo "All host user setup tests passed."
