#!/usr/bin/env bash

#
# Ensure machine ID is randomized for personal license activation, to avoid
# machine-binding collisions between concurrent runner containers sharing a
# host (see game-ci/cli#65, item 4).
#

if [[ "$UNITY_SERIAL" = F* ]]; then
  echo "Randomizing machine ID for personal license activation"
  dbus-uuidgen > /etc/machine-id && mkdir -p /var/lib/dbus/ && ln -sf /etc/machine-id /var/lib/dbus/machine-id
fi

#
# Create directory for license activation
#

export ACTIVATE_LICENSE_PATH="$GITHUB_WORKSPACE/_activate-license~"
mkdir -p "$ACTIVATE_LICENSE_PATH"

#
# Prepare Android SDK, if needed - done here (before any RUN_AS_HOST_USER
# switch) to ensure it has root permissions.
#

fullProjectPath="$GITHUB_WORKSPACE/$PROJECT_PATH"

if [[ "$BUILD_TARGET" == "Android" ]]; then
  export JAVA_HOME="$(awk -F'=' '/JAVA_HOME=/{print $2}' /usr/bin/unity-editor.d/*)"
  ANDROID_HOME_DIRECTORY="$(awk -F'=' '/ANDROID_HOME=/{print $2}' /usr/bin/unity-editor.d/*)"
  SDKMANAGER=$(find $ANDROID_HOME_DIRECTORY/cmdline-tools -name sdkmanager)
  if [ -z "${SDKMANAGER}" ]
  then
    SDKMANAGER=$(find $ANDROID_HOME_DIRECTORY/tools/bin -name sdkmanager)
    if [ -z "${SDKMANAGER}" ]
    then
      echo "No sdkmanager found"
      exit 1
    fi
  fi

  if [[ -n "$ANDROID_SDK_MANAGER_PARAMETERS" ]]; then
    echo "Updating Android SDK with parameters: $ANDROID_SDK_MANAGER_PARAMETERS"
    $SDKMANAGER "$ANDROID_SDK_MANAGER_PARAMETERS"
  else
    echo "Updating Android SDK with auto detected target API version"
    # Read the line containing AndroidTargetSdkVersion from the file
    targetAPILine=$(grep 'AndroidTargetSdkVersion' "$fullProjectPath/ProjectSettings/ProjectSettings.asset")

    # Extract the number after the semicolon
    targetAPI=$(echo "$targetAPILine" | cut -d':' -f2 | tr -d '[:space:]')

    $SDKMANAGER "platforms;android-$targetAPI"
  fi

  echo "Updated Android SDK."
else
  echo "Not updating Android SDK."
fi

#
# Run steps, either as root or as a user matching the host's UID/GID
#

if [[ "$RUN_AS_HOST_USER" == "true" ]]; then
  echo "Running as host user"

  # Stop on error if we can't set up the user
  set -e

  # Get host user/group info so we create files with the correct ownership
  USERNAME=$(stat -c '%U' "$fullProjectPath")
  USERID=$(stat -c '%u' "$fullProjectPath")
  GROUPNAME=$(stat -c '%G' "$fullProjectPath")
  GROUPID=$(stat -c '%g' "$fullProjectPath")

  groupadd -g $GROUPID $GROUPNAME
  useradd -u $USERID -g $GROUPID $USERNAME
  usermod -aG $GROUPNAME $USERNAME
  mkdir -p "/home/$USERNAME"
  chown $USERNAME:$GROUPNAME "/home/$USERNAME"

  # Normally need root permissions to access when using su
  chmod 777 /dev/stdout
  chmod 777 /dev/stderr

  # Don't stop on error when running our scripts as error handling is baked in
  set +e

  # Switch to the host user so we can create files with the correct ownership.
  # Pass HOME/USER explicitly so the Unity Licensing Client (which writes to
  # ~/.config/unity3d) resolves a real, writable home directory rather than
  # falling back to root's environment - without this, a floating-license
  # server build under RUN_AS_HOST_USER could silently fall through to a
  # license lacking the requested platform support instead of raising an
  # error (game-ci/unity-builder#739, fixed there by #838). -p preserves the
  # rest of the env from root.
  su -p $USERNAME -c "HOME=/home/$USERNAME USER=$USERNAME LOGNAME=$USERNAME $SHELL -c 'source /steps/runsteps.sh'"
else
  echo "Running as root"

  # Run as root
  source /steps/runsteps.sh
fi

exit $?
