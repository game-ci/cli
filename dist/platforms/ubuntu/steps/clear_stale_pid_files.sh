#!/usr/bin/env bash

#
# Clear the helper PID files a previous container left in the project's Library.
#
# Unity and its tools record the PIDs of their helper processes there (the Burst
# compiler server in Library/burst.pid, the IL post-processing runner in
# Library/ilpp.pid, the MSBuild host in Library/MSBuild/buildhost.pid) and kill
# those PIDs as "lingering" helpers when the next editor starts, without checking
# what they now are. Every container starts its own PID numbering from 1, so a PID
# left by the previous container can belong to the new editor itself, which then
# dies with "Killed" (exit 137). Unity 6000.6 bundles the Burst client into the
# editor, which made this happen on most WebGL builds after the first. No helper
# from a previous container survives into this one, so these files only ever
# point at the wrong process.
#

staleUnityLibraryPath="$GITHUB_WORKSPACE/$PROJECT_PATH/Library"
for staleUnityPidPath in "$staleUnityLibraryPath"/*.pid "$staleUnityLibraryPath/MSBuild/buildhost.pid"; do
  if [ -f "$staleUnityPidPath" ]; then
    echo "Removing Library/${staleUnityPidPath#"$staleUnityLibraryPath/"} (PID $(tr -dc '0-9' < "$staleUnityPidPath")) left by a previous container."
    rm -f "$staleUnityPidPath"
  fi
done
