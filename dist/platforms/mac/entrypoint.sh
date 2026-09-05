#!/usr/bin/env bash

#
# Returns the license exactly once, however this script ends.
#
# A Personal seat stays consumed until returned, unlike a serial (re-activatable)
# or a .ulf (a file, not a seat), so a missed return breaks every later run on
# the account. Returning only on the happy path - which is all this script did
# before - is therefore a cascading failure mode now that free-tier users can
# activate. The EXIT trap covers a hard exit inside build.sh and a cancelled
# job's SIGINT/SIGTERM.
#
UNITY_LICENSE_RETURNED=false

return_license_once() {
  if [ "$UNITY_LICENSE_RETURNED" = "true" ]; then
    return 0
  fi
  UNITY_LICENSE_RETURNED=true

  source $ACTION_FOLDER/platforms/mac/steps/return_license.sh
}

# RETURN_LICENSE_ONLY=true (used by `game-ci return-license`) is the counterpart
# to ACTIVATE_ONLY below: it releases a seat left active by an earlier
# `game-ci activate` and stops.
if [ "$RETURN_LICENSE_ONLY" = "true" ]; then
  ACTIVATE_LICENSE_PATH="$ACTION_FOLDER/BlankProject"
  mkdir -p "$ACTIVATE_LICENSE_PATH"

  return_license_once
  rm -r "$ACTIVATE_LICENSE_PATH"
  exit 0
fi

#
# Perform Activation
#

if [ "$SKIP_ACTIVATION" != "true" ]; then
  UNITY_LICENSE_PATH="/Library/Application Support/Unity"
  if [ ! -d "$UNITY_LICENSE_PATH" ]; then
    sudo mkdir -p "$UNITY_LICENSE_PATH"
    sudo chmod -R 777 "$UNITY_LICENSE_PATH"
  fi

  ACTIVATE_LICENSE_PATH="$ACTION_FOLDER/BlankProject"
  mkdir -p "$ACTIVATE_LICENSE_PATH"

  source $ACTION_FOLDER/platforms/mac/steps/activate.sh
else
  echo "Skipping activation"
fi

# ACTIVATE_ONLY=true (used by `game-ci activate`) activates and stops here -
# no build, and the license is deliberately left active for a later step to
# use, so no return_license.sh either.
if [ "$ACTIVATE_ONLY" = "true" ]; then
  rm -r "$ACTIVATE_LICENSE_PATH"
  exit $UNITY_EXIT_CODE
fi

# Armed only once activation has succeeded and we know we're not in the
# deliberately-leave-it-active ACTIVATE_ONLY case above.
if [ "$SKIP_ACTIVATION" != "true" ]; then
  trap return_license_once EXIT
fi

#
# Run Build
#

source $ACTION_FOLDER/platforms/mac/steps/build.sh

#
# License Cleanup
#
# Note: $UNITY_LICENSE_PATH is intentionally left in place - it may be a
# shared system directory pre-existing across runs (e.g. on a reused
# self-hosted runner), not something this script necessarily created.

# Returned here on the happy path rather than left to the trap, so it runs
# before the activation directory is removed (return_license.sh pushd's into
# it). The trap is the safety net for the paths that never reach this line.
if [ "$SKIP_ACTIVATION" != "true" ]; then
  return_license_once
  rm -r "$ACTIVATE_LICENSE_PATH"
fi

#
# Instructions for debugging
#

if [[ $BUILD_EXIT_CODE -gt 0 ]]; then
echo ""
echo "###########################"
echo "#         Failure         #"
echo "###########################"
echo ""
echo "Please note that the exit code is not very descriptive."
echo "Most likely it will not help you solve the issue."
echo ""
echo "To find the reason for failure: please search for errors in the log above."
echo ""
fi;

#
# Exit with code from the build step.
#

exit $BUILD_EXIT_CODE
