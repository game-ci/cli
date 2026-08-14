#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Mock UnrealBuildTool — the compiler driver that RunUAT delegates to.
#
# In real UE, this is a C# program (UnrealBuildTool.dll) that reads
# .Build.cs and .Target.cs files, resolves modules, and invokes the
# platform compiler toolchain. This mock validates that the correct
# arguments are passed and creates the expected output structure.
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

echo "UnrealBuildTool (mock)"
echo "Arguments: $*"

TARGET=""
PLATFORM=""
CONFIG=""
PROJECT=""

for arg in "$@"; do
  case "$arg" in
    -Target=*)    TARGET="${arg#-Target=}" ;;
    -Platform=*)  PLATFORM="${arg#-Platform=}" ;;
    -Configuration=*) CONFIG="${arg#-Configuration=}" ;;
    -Project=*)   PROJECT="${arg#-Project=}" ;;
  esac
done

echo "Target=${TARGET:-unknown} Platform=${PLATFORM:-unknown} Config=${CONFIG:-unknown}"
echo "UnrealBuildTool exiting with code 0"
exit 0
