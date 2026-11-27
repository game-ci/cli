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
# runner's account. An existing system account (UID 1-999, e.g. www-data) is
# not reused: Unity would run as it, and a nologin shell makes `su` fail later
# and less clearly. UID 0 is reused: the project is root-owned on the host.
#

if existing_group="$(getent group "$GROUPID")"; then
  GROUPNAME="${existing_group%%:*}"
  echo "Reusing existing group $GROUPNAME (GID $GROUPID)"
else
  groupadd -g "$GROUPID" "$GROUPNAME"
fi

if existing_user="$(getent passwd "$USERID")"; then
  USERNAME="${existing_user%%:*}"
  if [[ "$USERID" -gt 0 && "$USERID" -lt 1000 ]]; then
    echo "Error: the project is owned by UID $USERID, which is the image's system account '$USERNAME'." >&2
    echo "runAsHostUser won't run Unity as a system account. Run the job as a regular user (UID 1000 or above), or disable runAsHostUser." >&2
    exit 1
  fi
  echo "Reusing existing user $USERNAME (UID $USERID)"
  # Match a created user: the host GID as primary group, so new files get it.
  usermod -g "$GROUPID" "$USERNAME"
else
  useradd -u "$USERID" -g "$GROUPID" "$USERNAME"
fi

usermod -aG "$GROUPNAME" "$USERNAME"
mkdir -p "/home/$USERNAME"
chown "$USERNAME:$GROUPNAME" "/home/$USERNAME"
