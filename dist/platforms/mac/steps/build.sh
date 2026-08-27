#!/usr/bin/env bash

#
# Set project path
#

UNITY_PROJECT_PATH="$GITHUB_WORKSPACE/$PROJECT_PATH"
echo "Using project path \"$UNITY_PROJECT_PATH\"."

#
# Display the name for the build, doubles as the output name
#

echo "Using build name \"$BUILD_NAME\"."

#
# Display the build's target platform;
#

echo "Using build target \"$BUILD_TARGET\"."

#
# Display the build profile
#

if [ -z "$BUILD_PROFILE" ]; then
  echo "Doing a default \"$BUILD_TARGET\" platform build."
else
  echo "Using build profile \"$BUILD_PROFILE\" relative to \"$UNITY_PROJECT_PATH\"."
fi

#
# Display build path and file
#

echo "Using build path \"$BUILD_PATH\" to save file \"$BUILD_FILE\"."
BUILD_PATH_FULL="$GITHUB_WORKSPACE/$BUILD_PATH"
CUSTOM_BUILD_PATH="$BUILD_PATH_FULL/$BUILD_FILE"

#
# Set the build method, must reference one of:
#
#   - <NamespaceName.ClassName.MethodName>
#   - <ClassName.MethodName>
#
# For example: `BuildCommand.PerformBuild`
#
# The method must be declared static and placed in project/Assets/Editor
#

if [ -z "$BUILD_METHOD" ]; then
  # User has not provided their own build command.
  #
  # Use the script from this action which builds the scenes that are enabled in
  # the project.
  #
  echo "Using built-in build method."
  # Create Editor directory if it does not exist
  mkdir -p "$UNITY_PROJECT_PATH/Assets/Editor/"
  # Copy the build script of Unity Builder action
  cp -R "$ACTION_FOLDER/default-build-script/Assets/Editor/" "$UNITY_PROJECT_PATH/Assets/Editor/"
  # Set the Build method to that of UnityBuilder Action
  BUILD_METHOD="UnityBuilderAction.Builder.BuildProject"
  # Verify recursive paths
  ls -Ralph "$UNITY_PROJECT_PATH/Assets/Editor/"
  #
else
  # User has provided their own build method.
  # Assume they also bring their own script.
  #
  echo "Using build method \"$BUILD_METHOD\"."
  #
fi

#
# Prepare Android SDK, if needed
#

if [[ "$BUILD_TARGET" == "Android" && -n "$ANDROID_SDK_MANAGER_PARAMETERS" ]]; then
  echo "Updating Android SDK with parameters: $ANDROID_SDK_MANAGER_PARAMETERS"
  ANDROID_INSTALL_LOCATION="/Applications/Unity/Hub/Editor/$UNITY_VERSION/PlaybackEngines/AndroidPlayer"
  export JAVA_HOME="$ANDROID_INSTALL_LOCATION/OpenJDK"
  export ANDROID_HOME="$ANDROID_INSTALL_LOCATION/SDK"
  yes | "$ANDROID_HOME/tools/bin/sdkmanager" "$ANDROID_SDK_MANAGER_PARAMETERS"
  echo "Updated Android SDK."
else
  echo "Not updating Android SDK."
fi

#
# Pre-build debug information
#

echo ""
echo "###########################"
echo "#    Custom parameters    #"
echo "###########################"
echo ""

echo "$CUSTOM_PARAMETERS"

echo ""
echo "###########################"
echo "#    Current build dir    #"
echo "###########################"
echo ""

echo "Creating \"$BUILD_PATH_FULL\" if it does not exist."
mkdir -p "$BUILD_PATH_FULL"
ls -alh "$BUILD_PATH_FULL"

echo ""
echo "###########################"
echo "#    Project directory    #"
echo "###########################"
echo ""

ls -alh "$UNITY_PROJECT_PATH"

#
# Build
#

echo ""
echo "###########################"
echo "#    Building project     #"
echo "###########################"
echo ""

# Reference: https://docs.unity3d.com/2019.3/Documentation/Manual/CommandLineArguments.html

# MANUAL_EXIT=true skips -quit so the build method can stay in play mode and
# call EditorApplication.Exit(0) itself (see game-ci/cli#13).
QUIT_FLAG="-quit"
if [ "$MANUAL_EXIT" = "true" ]; then
  QUIT_FLAG=""
fi

# BUILD_PROFILE (Unity 6) determines the target itself, so -buildTarget is
# omitted when one is set - matches real unity-builder's own handling.
#
# Arrays, not plain strings: BUILD_PROFILE is a path that can contain spaces
# (e.g. "Assets/Settings/Build Profiles/Sample WebGL Build Profile.asset").
# A plain string expanded unquoted ($BUILD_PROFILE_FLAGS) word-splits on
# those spaces into separate argv entries, silently truncating the value
# Unity actually receives for -activeBuildProfile to its first word - see
# game-ci/cli#159. "${arr[@]}" preserves each element intact regardless of
# internal whitespace, matching build.ps1's already-correct @(...) array.
BUILD_TARGET_FLAG=(-buildTarget "$BUILD_TARGET")
if [ -n "$BUILD_PROFILE" ]; then
  BUILD_TARGET_FLAG=()
fi
BUILD_PROFILE_FLAGS=()
if [ -n "$BUILD_PROFILE" ]; then
  BUILD_PROFILE_FLAGS=(-activeBuildProfile "$BUILD_PROFILE")
fi

run_unity_build() {
  /Applications/Unity/Hub/Editor/$UNITY_VERSION/Unity.app/Contents/MacOS/Unity \
    -logFile - \
    $QUIT_FLAG \
    -batchmode \
    -nographics \
    -username "$UNITY_EMAIL" \
    -password "$UNITY_PASSWORD" \
    -customBuildName "$BUILD_NAME" \
    -projectPath "$UNITY_PROJECT_PATH" \
    "${BUILD_TARGET_FLAG[@]}" \
    -customBuildTarget "$BUILD_TARGET" \
    -customBuildPath "$CUSTOM_BUILD_PATH" \
    -customBuildProfile "$BUILD_PROFILE" \
    "${BUILD_PROFILE_FLAGS[@]}" \
    -executeMethod "$BUILD_METHOD" \
    -buildVersion "$VERSION" \
    -androidVersionCode "$ANDROID_VERSION_CODE" \
    -androidKeystoreName "$ANDROID_KEYSTORE_NAME" \
    -androidKeystorePass "$ANDROID_KEYSTORE_PASS" \
    -androidKeyaliasName "$ANDROID_KEYALIAS_NAME" \
    -androidKeyaliasPass "$ANDROID_KEYALIAS_PASS" \
    -androidTargetSdkVersion "$ANDROID_TARGET_SDK_VERSION" \
    -androidExportType "$ANDROID_EXPORT_TYPE" \
    -androidSymbolType "$ANDROID_SYMBOL_TYPE" \
    $CUSTOM_PARAMETERS
}

# Unity's own licensing client occasionally fails to reach/handshake with
# Unity's cloud license service in time, independently of anything this
# script controls - observed on macOS CI runners as several distinct
# symptoms, all inside the license/entitlement handshake before any real
# build work starts: "Code 404 ... 0 entitlement groups", "Code 408" and
# "Code 1500 ... TimeoutPolicy did not complete within the timeout",
# "Access token is unavailable; failed to update". These are transient -
# a same-machine, same-license retry a few seconds later routinely
# succeeds - so a build that fails with one of these signatures is retried
# automatically rather than failing the whole job on what's effectively a
# flaky network call. A build that fails for a real reason (compile error,
# missing scene, etc.) never matches these patterns and is not retried.
# UNITY_LICENSE_RETRY_MAX_ATTEMPTS is set from the real --licenseRetryMaxAttempts
# CLI option (see UnityEnvironment.getVariables) - not a bare, undocumented env
# var - so a genuine (non-transient) license misconfiguration can be set to
# fail on the first attempt (--licenseRetryMaxAttempts=1) instead of always
# paying for 4 attempts with no way to turn it down.
UNITY_BUILD_MAX_ATTEMPTS="${UNITY_LICENSE_RETRY_MAX_ATTEMPTS:-4}"
UNITY_BUILD_RETRY_DELAY_SECONDS=20
UNITY_BUILD_TRANSIENT_LICENSE_ERROR_PATTERN='TimeoutPolicy did not complete|Access token is unavailable|entitlement groups and 0 free entitlements|License activation has failed|No valid Unity Editor license found|License is not active'

BUILD_LOG="$(mktemp)"
for ATTEMPT in $(seq 1 "$UNITY_BUILD_MAX_ATTEMPTS"); do
  run_unity_build 2>&1 | tee "$BUILD_LOG"
  BUILD_EXIT_CODE=${PIPESTATUS[0]}

  if [ "$BUILD_EXIT_CODE" -eq 0 ]; then
    break
  fi

  if [ "$ATTEMPT" -lt "$UNITY_BUILD_MAX_ATTEMPTS" ] && grep -qE "$UNITY_BUILD_TRANSIENT_LICENSE_ERROR_PATTERN" "$BUILD_LOG"; then
    echo "Unity build failed with a known-transient licensing error (attempt $ATTEMPT/$UNITY_BUILD_MAX_ATTEMPTS) - retrying in ${UNITY_BUILD_RETRY_DELAY_SECONDS}s..."
    sleep "$UNITY_BUILD_RETRY_DELAY_SECONDS"
    continue
  fi

  break
done
rm -f "$BUILD_LOG"

# Display logs
cat "$UNITY_PROJECT_PATH/out.log" 2>/dev/null || true

# Display results
if [ $BUILD_EXIT_CODE -eq 0 ]; then
  echo "Build succeeded";
else
  echo "Build failed, with exit code $BUILD_EXIT_CODE";
fi

#
# Permissions
#

# Make a given user owner of all artifacts
if [[ -n "$CHOWN_FILES_TO" ]]; then
  chown -R "$CHOWN_FILES_TO" "$BUILD_PATH_FULL"
  chown -R "$CHOWN_FILES_TO" "$UNITY_PROJECT_PATH"
fi

# Add read permissions for everyone to all artifacts
chmod -R a+r "$BUILD_PATH_FULL"
chmod -R a+r "$UNITY_PROJECT_PATH"

# Add execute permissions to specific files
if [[ "$BUILD_TARGET" == "StandaloneOSX" ]]; then
  OSX_EXECUTABLE_PATH="$BUILD_PATH_FULL/$BUILD_NAME.app/Contents/MacOS"
  find "$OSX_EXECUTABLE_PATH" -type f -exec chmod +x {} \;
fi

#
# Results
#

echo ""
echo "###########################"
echo "#       Build output      #"
echo "###########################"
echo ""

ls -alh "$BUILD_PATH_FULL"
