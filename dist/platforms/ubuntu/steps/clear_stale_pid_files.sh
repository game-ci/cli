#!/usr/bin/env bash

#
# Clear the helper PID files a previous container left in the project's Library.
#
# Unity records the PIDs of its helper processes there (the IL post-processing
# runner in Library/ilpp.pid, the MSBuild host in Library/MSBuild/buildhost.pid)
# and kills those PIDs as "lingering" helpers when it next starts, without
# checking what they now are. Every container starts its own PID numbering from
# 1, so a PID left by the previous container can belong to the new editor itself,
# which then dies with "Killed" (exit 137). No helper from a previous container
# survives into this one, so these files only ever point at the wrong process.
#

for staleUnityPidFile in "Library/ilpp.pid" "Library/MSBuild/buildhost.pid"; do
  staleUnityPidPath="$GITHUB_WORKSPACE/$PROJECT_PATH/$staleUnityPidFile"
  if [ -f "$staleUnityPidPath" ]; then
    echo "Removing $staleUnityPidFile (PID $(tr -dc '0-9' < "$staleUnityPidPath")) left by a previous container."
    rm -f "$staleUnityPidPath"
  fi
done
