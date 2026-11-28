#!/usr/bin/env bash

#
# Sets up the container user that RUN_AS_HOST_USER switches to: one matching
# the UID/GID that owns the project on the host, so build output isn't left
# root-owned there. Sourced by entrypoint.sh as root, under `set -e`, with
# USERID/GROUPID/USERNAME/GROUPNAME taken from the project path.
#
# A missing group or user is created. One the image already has is reused,
# and GROUPNAME/USERNAME are set to its name: Ubuntu 24.04 based images ship
# an `ubuntu` user and group at 1000, the usual UID/GID of a self-hosted
# runner's account. UID 0 is reused: the project is root-owned on the host.
#
# An existing account Unity shouldn't or can't run as is refused, before any
# account is changed: a system account (UID 1-999, e.g. www-data), and one
# without a login shell (e.g. nobody, 65534), which `su` would refuse later
# and less clearly.
#

if existing_user="$(getent passwd "$USERID")"; then
  USERNAME="${existing_user%%:*}"
  existing_shell="${existing_user##*:}"

  if [[ "$USERID" -gt 0 && "$USERID" -lt 1000 ]]; then
    echo "Error: the project is owned by UID $USERID, which is the image's system account '$USERNAME'." >&2
    echo "runAsHostUser won't run Unity as a system account. Run the job as a regular user (UID 1000 or above), or disable runAsHostUser." >&2
    exit 1
  fi

  if [[ "${existing_shell##*/}" == nologin || "${existing_shell##*/}" == false ]]; then
    echo "Error: the project is owned by UID $USERID, which is the image's account '$USERNAME' with no login shell ($existing_shell)." >&2
    echo "Unmapped files show up as this account under rootless Docker, userns-remap or NFS root squash. Make the project owned by the user that runs the job, or disable runAsHostUser." >&2
    exit 1
  fi
fi

if existing_group="$(getent group "$GROUPID")"; then
  GROUPNAME="${existing_group%%:*}"
  echo "Reusing existing group $GROUPNAME (GID $GROUPID)"
else
  groupadd -g "$GROUPID" "$GROUPNAME"
fi

if [[ -n "$existing_user" ]]; then
  echo "Reusing existing user $USERNAME (UID $USERID)"
  # Match a created user: the host GID as primary group, so new files get it.
  usermod -g "$GROUPID" "$USERNAME"
else
  useradd -u "$USERID" -g "$GROUPID" "$USERNAME"
fi

usermod -aG "$GROUPNAME" "$USERNAME"
mkdir -p "/home/$USERNAME"
chown "$USERNAME:$GROUPNAME" "/home/$USERNAME"
