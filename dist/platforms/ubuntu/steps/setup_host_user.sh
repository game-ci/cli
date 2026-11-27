#!/usr/bin/env bash

#
# Creates the container user that RUN_AS_HOST_USER switches to: one matching
# the UID/GID that owns the project on the host, so build output isn't left
# root-owned there. Sourced by entrypoint.sh as root, under `set -e`, with
# USERID/GROUPID/USERNAME/GROUPNAME taken from the project path.
#
# By default the group and user are always created, which fails if the image
# already has that GID or UID. Ubuntu 24.04 based images ship an `ubuntu`
# user and group at 1000, the usual UID/GID of a self-hosted runner's account.
# With RUN_AS_HOST_USER_REUSE_EXISTING=true, an existing group or user with
# that id is used instead, and GROUPNAME/USERNAME are set to its name.
#

if [[ "$RUN_AS_HOST_USER_REUSE_EXISTING" == "true" ]] && existing_group="$(getent group "$GROUPID")"; then
  GROUPNAME="${existing_group%%:*}"
  echo "Reusing existing group $GROUPNAME (GID $GROUPID)"
else
  groupadd -g "$GROUPID" "$GROUPNAME"
fi

if [[ "$RUN_AS_HOST_USER_REUSE_EXISTING" == "true" ]] && existing_user="$(getent passwd "$USERID")"; then
  USERNAME="${existing_user%%:*}"
  echo "Reusing existing user $USERNAME (UID $USERID)"
  # Match a created user: the host GID as primary group, so new files get it.
  usermod -g "$GROUPID" "$USERNAME"
else
  useradd -u "$USERID" -g "$GROUPID" "$USERNAME"
fi

usermod -aG "$GROUPNAME" "$USERNAME"
mkdir -p "/home/$USERNAME"
chown "$USERNAME:$GROUPNAME" "/home/$USERNAME"
