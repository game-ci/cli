#!/bin/bash
# ─────────────────────────────────────────────────────────────────
# Mock RunUAT.sh — Unreal Automation Tool
#
# Faithfully replicates the real RunUAT.sh CLI interface, argument
# parsing, log output format, exit codes, and directory structure
# so that game-ci can reliably develop and test against the UE
# build pipeline without needing a real (50GB+) UE installation.
#
# Matches: UE 5.4 RunUAT / AutomationTool behavior
# ─────────────────────────────────────────────────────────────────

set -euo pipefail

VERSION="5.4.0"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ENGINE_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
LOG_DIR="${ENGINE_DIR}/Programs/AutomationTool/Saved/Logs"
TIMESTAMP=$(date '+%Y.%m.%d-%H.%M.%S')
EXIT_CODE=0

# ── Argument parsing (mirrors real AutomationTool ProjectParams.cs) ──
COMMAND=""
PROJECT=""
TARGET_PLATFORM="Linux"
SERVER_PLATFORM=""
CLIENT_CONFIG="Development"
SERVER_CONFIG="Development"
DO_BUILD=false
DO_COOK=false
DO_STAGE=false
DO_PACKAGE=false
DO_ARCHIVE=false
DO_PAK=false
DO_DEPLOY=false
DO_RUN=false
DO_CLEAN=false
ARCHIVE_DIR=""
STAGING_DIR=""
MAP_TO_COOK=""
VERBOSE=false
NO_P4=false
UNATTENDED=false
HELP=false

for arg in "$@"; do
  case "$arg" in
    BuildCookRun|BuildTarget|CookTarget|StageTargetCommand)
      COMMAND="$arg" ;;
    -project=*)       PROJECT="${arg#-project=}" ;;
    -targetplatform=*) TARGET_PLATFORM="${arg#-targetplatform=}" ;;
    -servertargetplatform=*) SERVER_PLATFORM="${arg#-servertargetplatform=}" ;;
    -clientconfig=*)  CLIENT_CONFIG="${arg#-clientconfig=}" ;;
    -serverconfig=*)  SERVER_CONFIG="${arg#-serverconfig=}" ;;
    -archivedirectory=*) ARCHIVE_DIR="${arg#-archivedirectory=}" ;;
    -stagingdirectory=*) STAGING_DIR="${arg#-stagingdirectory=}" ;;
    -map=*)           MAP_TO_COOK="${arg#-map=}" ;;
    -build)           DO_BUILD=true ;;
    -cook)            DO_COOK=true ;;
    -stage)           DO_STAGE=true ;;
    -package)         DO_PACKAGE=true ;;
    -archive)         DO_ARCHIVE=true ;;
    -pak)             DO_PAK=true ;;
    -deploy)          DO_DEPLOY=true ;;
    -run)             DO_RUN=true ;;
    -clean)           DO_CLEAN=true ;;
    -verbose)         VERBOSE=true ;;
    -noP4)            NO_P4=true ;;
    -unattended)      UNATTENDED=true ;;
    -help)            HELP=true ;;
  esac
done

# ── Logging (matches real AutomationTool log format) ──
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/UAT_${TIMESTAMP}.log"

log() {
  local level="$1"; shift
  local msg="[${TIMESTAMP}][${level}] $*"
  echo "$msg"
  echo "$msg" >> "$LOG_FILE"
}

log_header() {
  log "INFO" "======================================================================"
  log "INFO" "$*"
  log "INFO" "======================================================================"
}

# ── Help ──
if $HELP; then
  cat <<HELP
BuildCookRun Help:
  -project=Path              Path to .uproject file (required)
  -targetplatform=Platform   Target platform (Win64, Linux, Mac, Android, IOS)
  -clientconfig=Config       Build configuration (Development, Shipping, Debug, Test)
  -build                     Execute build step
  -cook                      Cook content for target platform
  -stage                     Copy to staging directory
  -pak                       Create .pak files
  -package                   Package for distribution
  -archive                   Archive build output
  -archivedirectory=Path     Output directory for archived build
  -deploy                    Deploy to device
  -run                       Launch after building
  -clean                     Clean before building
  -noP4                      Disable Perforce
  -unattended                Non-interactive mode
  -verbose                   Verbose logging
  -help                      Show this help
HELP
  echo "AutomationTool exiting with ExitCode=0 (Success)"
  exit 0
fi

# ── Header (matches real output) ──
log_header "Running AutomationTool (mock v${VERSION})"
log "INFO" "CL - built from changelist 99999999"
log "INFO" "Branch: ++UE5+Release-${VERSION}"
log "INFO" "Command: ${COMMAND:-BuildCookRun}"
log "INFO" "Arguments: $*"

# ── Validate project ──
if [ -z "$PROJECT" ]; then
  log "ERROR" "Missing required argument: -project"
  log "ERROR" "AutomationTool exiting with ExitCode=1 (Error_Unknown)"
  echo "AutomationTool exiting with ExitCode=1 (Error_Unknown)"
  exit 1
fi

if [ -f "$PROJECT" ]; then
  PROJECT_DIR="$(dirname "$PROJECT")"
  PROJECT_NAME="$(basename "$PROJECT" .uproject)"
  log "INFO" "Project: ${PROJECT_NAME} (${PROJECT})"

  # Parse .uproject
  if command -v jq &>/dev/null; then
    ENGINE_ASSOC=$(jq -r '.EngineAssociation // "unknown"' "$PROJECT")
    MODULES=$(jq -r '.Modules | length' "$PROJECT" 2>/dev/null || echo "0")
    log "INFO" "EngineAssociation: ${ENGINE_ASSOC}"
    log "INFO" "Modules: ${MODULES}"
  fi
else
  log "WARNING" "Project file not found: ${PROJECT}"
  PROJECT_DIR="$(dirname "$PROJECT")"
  PROJECT_NAME="$(basename "$PROJECT" .uproject)"
fi

# ── Derive paths (matches real UE conventions) ──
if [ -z "$STAGING_DIR" ]; then
  STAGING_DIR="${PROJECT_DIR}/Saved/StagedBuilds"
fi

# ── Clean step ──
if $DO_CLEAN; then
  log_header "Cleaning ${PROJECT_NAME}"
  for dir in Binaries Intermediate Saved/StagedBuilds; do
    if [ -d "${PROJECT_DIR}/${dir}" ]; then
      log "INFO" "Cleaning: ${PROJECT_DIR}/${dir}"
      rm -rf "${PROJECT_DIR}/${dir}"
    fi
  done
  log "INFO" "Clean complete"
fi

# ── Build step ──
if $DO_BUILD; then
  log_header "Building ${PROJECT_NAME} [${TARGET_PLATFORM} ${CLIENT_CONFIG}]"

  BINARIES_DIR="${PROJECT_DIR}/Binaries/${TARGET_PLATFORM}"
  INTERMEDIATE_DIR="${PROJECT_DIR}/Intermediate/Build/${TARGET_PLATFORM}"
  mkdir -p "$BINARIES_DIR" "$INTERMEDIATE_DIR"

  log "INFO" "Using ${TARGET_PLATFORM} toolchain"
  log "INFO" "Configuration: ${CLIENT_CONFIG}"

  # Simulate compile steps
  log "INFO" "Compiling ${PROJECT_NAME}Editor..."
  log "INFO" "  [1/3] Gathering module info"
  log "INFO" "  [2/3] Compiling game modules"
  log "INFO" "  [3/3] Linking ${PROJECT_NAME}-${TARGET_PLATFORM}-${CLIENT_CONFIG}"

  # Create mock binary
  cat > "${BINARIES_DIR}/${PROJECT_NAME}" <<BIN
#!/bin/bash
echo "${PROJECT_NAME} (Mock UE ${VERSION} - ${TARGET_PLATFORM} ${CLIENT_CONFIG})"
BIN
  chmod +x "${BINARIES_DIR}/${PROJECT_NAME}"

  # Create build receipt (real UE creates these)
  cat > "${BINARIES_DIR}/${PROJECT_NAME}.target" <<RECEIPT
{
  "TargetName": "${PROJECT_NAME}",
  "Platform": "${TARGET_PLATFORM}",
  "Configuration": "${CLIENT_CONFIG}",
  "BuildId": "mock-${TIMESTAMP}",
  "Version": { "MajorVersion": 5, "MinorVersion": 4, "PatchVersion": 0 }
}
RECEIPT

  log "INFO" "Build complete: ${BINARIES_DIR}/${PROJECT_NAME}"
fi

# ── Cook step ──
if $DO_COOK; then
  log_header "Cooking ${PROJECT_NAME} [${TARGET_PLATFORM}]"

  COOKED_DIR="${PROJECT_DIR}/Saved/Cooked/${TARGET_PLATFORM}"
  mkdir -p "$COOKED_DIR/${PROJECT_NAME}/Content"
  mkdir -p "$COOKED_DIR/Engine/Content"

  log "INFO" "Cooking content for ${TARGET_PLATFORM}..."
  log "INFO" "  Source: ${PROJECT_DIR}/Content"
  log "INFO" "  Target: ${COOKED_DIR}"

  if [ -n "$MAP_TO_COOK" ]; then
    log "INFO" "  Maps: ${MAP_TO_COOK}"
  fi

  # Create mock cooked assets
  echo "COOKED_ASSET_V1" > "${COOKED_DIR}/${PROJECT_NAME}/Content/DefaultMap.umap"
  echo "COOKED_ASSET_V1" > "${COOKED_DIR}/Engine/Content/EngineMaterials.uasset"

  # Create cook metadata (real UE creates these)
  cat > "${COOKED_DIR}/CookedAssetRegistry.json" <<COOK
{
  "Version": 1,
  "Platform": "${TARGET_PLATFORM}",
  "CookTimestamp": "${TIMESTAMP}",
  "AssetCount": 2,
  "Assets": [
    "${PROJECT_NAME}/Content/DefaultMap.umap",
    "Engine/Content/EngineMaterials.uasset"
  ]
}
COOK

  log "INFO" "Cooking complete: 2 assets cooked"
fi

# ── Pak step ──
if $DO_PAK; then
  log "INFO" "Creating pak file..."
  COOKED_DIR="${PROJECT_DIR}/Saved/Cooked/${TARGET_PLATFORM}"
  PAK_DIR="${PROJECT_DIR}/Saved/Paks/${TARGET_PLATFORM}"
  mkdir -p "$PAK_DIR"

  # Create mock .pak (real UnrealPak creates compressed archives)
  echo "MOCK_PAK_FILE_V1_${TIMESTAMP}" > "${PAK_DIR}/${PROJECT_NAME}-${TARGET_PLATFORM}.pak"
  log "INFO" "Pak file: ${PAK_DIR}/${PROJECT_NAME}-${TARGET_PLATFORM}.pak"
fi

# ── Stage step ──
if $DO_STAGE; then
  log_header "Staging ${PROJECT_NAME} [${TARGET_PLATFORM}]"

  STAGE_PLATFORM_DIR="${STAGING_DIR}/${TARGET_PLATFORM}"
  mkdir -p "${STAGE_PLATFORM_DIR}/${PROJECT_NAME}/Binaries/${TARGET_PLATFORM}"
  mkdir -p "${STAGE_PLATFORM_DIR}/${PROJECT_NAME}/Content/Paks"
  mkdir -p "${STAGE_PLATFORM_DIR}/Engine/Binaries/${TARGET_PLATFORM}"

  # Copy mock binary
  if [ -f "${PROJECT_DIR}/Binaries/${TARGET_PLATFORM}/${PROJECT_NAME}" ]; then
    cp "${PROJECT_DIR}/Binaries/${TARGET_PLATFORM}/${PROJECT_NAME}" \
       "${STAGE_PLATFORM_DIR}/${PROJECT_NAME}/Binaries/${TARGET_PLATFORM}/"
  fi

  # Copy mock pak
  if [ -f "${PROJECT_DIR}/Saved/Paks/${TARGET_PLATFORM}/${PROJECT_NAME}-${TARGET_PLATFORM}.pak" ]; then
    cp "${PROJECT_DIR}/Saved/Paks/${TARGET_PLATFORM}/${PROJECT_NAME}-${TARGET_PLATFORM}.pak" \
       "${STAGE_PLATFORM_DIR}/${PROJECT_NAME}/Content/Paks/"
  fi

  # Create manifest (real UE creates these for each staged build)
  find "${STAGE_PLATFORM_DIR}" -type f | while read -r f; do
    echo "$(date '+%Y-%m-%d %H:%M:%S')  ${f}"
  done > "${STAGE_PLATFORM_DIR}/Manifest_NonUFSFiles_${TARGET_PLATFORM}.txt"

  log "INFO" "Staged to: ${STAGE_PLATFORM_DIR}"
fi

# ── Archive step ──
if $DO_ARCHIVE && [ -n "$ARCHIVE_DIR" ]; then
  log_header "Archiving ${PROJECT_NAME}"

  mkdir -p "$ARCHIVE_DIR"

  # Copy staged content to archive
  if [ -d "${STAGING_DIR}/${TARGET_PLATFORM}" ]; then
    cp -r "${STAGING_DIR}/${TARGET_PLATFORM}/." "${ARCHIVE_DIR}/"
  fi

  # Create build manifest (useful for CI verification)
  cat > "${ARCHIVE_DIR}/build-manifest.json" <<MANIFEST
{
  "engine": "unreal",
  "engineVersion": "${ENGINE_ASSOC:-${VERSION}}",
  "projectName": "${PROJECT_NAME}",
  "platform": "${TARGET_PLATFORM}",
  "configuration": "${CLIENT_CONFIG}",
  "buildId": "mock-${TIMESTAMP}",
  "timestamp": "${TIMESTAMP}",
  "mock": true,
  "steps": {
    "build": ${DO_BUILD},
    "cook": ${DO_COOK},
    "stage": ${DO_STAGE},
    "pak": ${DO_PAK},
    "package": ${DO_PACKAGE},
    "archive": true
  }
}
MANIFEST

  log "INFO" "Archived to: ${ARCHIVE_DIR}"
  log "INFO" "Build manifest: ${ARCHIVE_DIR}/build-manifest.json"
fi

# ── Package step ──
if $DO_PACKAGE; then
  log "INFO" "Packaging for ${TARGET_PLATFORM}..."
  log "INFO" "Package complete"
fi

# ── Summary ──
log_header "BUILD SUCCESSFUL"
log "INFO" "Project:       ${PROJECT_NAME}"
log "INFO" "Platform:      ${TARGET_PLATFORM}"
log "INFO" "Configuration: ${CLIENT_CONFIG}"
log "INFO" "Steps:         $(printf '%s ' \
  $($DO_BUILD && echo Build) \
  $($DO_COOK && echo Cook) \
  $($DO_PAK && echo Pak) \
  $($DO_STAGE && echo Stage) \
  $($DO_PACKAGE && echo Package) \
  $($DO_ARCHIVE && echo Archive))"

echo "AutomationTool exiting with ExitCode=0 (Success)"
exit 0
