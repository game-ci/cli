import Orchestrator from '../../orchestrator';

/**
 * Cache survival for interrupted builds.
 *
 * When `cacheSaveOnFailure` is enabled, installs a shell trap that saves
 * Library state when the build exits non-zero (OOM, timeout, crash).
 * Optional filters let users target specific failure types.
 *
 * Configuration (via orchestrator options / env vars):
 *   cacheSaveOnFailure: true | false
 *   cacheSaveOnFailureFilter: "all" | "oom,timeout,exit-code:137,exit-code:1"
 *   cacheRetentionDays: 0 (keep forever) | N days
 */
export class CacheCheckpointService {
  /**
   * Generate a shell trap that saves cache on build failure/signal.
   *
   * When filter is set, only matching failure types trigger the save:
   *   - "all" (default): save on any non-zero exit
   *   - "oom": save on exit code 137 (SIGKILL / OOM) or 139 (SIGSEGV)
   *   - "timeout": save on exit code 124 (timeout) or 143 (SIGTERM)
   *   - "exit-code:N": save on specific exit code N
   *
   * Multiple filters can be comma-separated: "oom,timeout,exit-code:1"
   */
  static generateFailureTrapScript(cachePath: string, filter: string): string {
    const filterCondition = CacheCheckpointService.buildFilterCondition(filter);

    return `
    # --- Cache Save on Failure ---
    # Saves partial Library cache when the build is interrupted, so next
    # build restores from here instead of starting from zero.
    _cache_save_on_failure() {
      local EXIT_CODE=$?
      if [ $EXIT_CODE -eq 0 ]; then return; fi
      ${filterCondition}
      if [ -d "$GITHUB_WORKSPACE/Library" ] && [ "$(ls -A "$GITHUB_WORKSPACE/Library" 2>/dev/null)" ]; then
        echo "[Cache Recovery] Build failed (exit $EXIT_CODE) — saving partial Library cache..."
        RECOVERY_DIR="${cachePath}/Library"
        mkdir -p "$RECOVERY_DIR"
        cd "$GITHUB_WORKSPACE"
        if command -v lz4 > /dev/null 2>&1; then
          tar -cf - Library | lz4 > "$RECOVERY_DIR/recovery-partial.tar.lz4" 2>/dev/null || true
        else
          tar -cf "$RECOVERY_DIR/recovery-partial.tar" Library 2>/dev/null || true
        fi
        echo "[Cache Recovery] Partial cache saved (exit code: $EXIT_CODE)"
      fi
    }
    trap _cache_save_on_failure EXIT SIGTERM
    `;
  }

  /**
   * Build the shell condition that gates whether a specific exit code
   * should trigger cache saving, based on the user's filter string.
   */
  private static buildFilterCondition(filter: string): string {
    if (!filter || filter === 'all') {
      return ''; // No condition — save on any non-zero exit
    }

    const parts = filter.split(',').map((f) => f.trim().toLowerCase());
    const exitCodes: number[] = [];

    for (const part of parts) {
      if (part === 'oom') {
        exitCodes.push(137, 139); // SIGKILL, SIGSEGV
      } else if (part === 'timeout') {
        exitCodes.push(124, 143); // timeout command, SIGTERM
      } else if (part.startsWith('exit-code:')) {
        const code = Number.parseInt(part.replace('exit-code:', ''), 10);
        if (!Number.isNaN(code)) exitCodes.push(code);
      }
    }

    if (exitCodes.length === 0) return '';

    // Generate shell case statement for matching exit codes
    const codeList = [...new Set(exitCodes)].join('|');
    return `case $EXIT_CODE in ${codeList}) ;; *) return ;; esac`;
  }

  /**
   * Generate shell commands for S3 cache retention cleanup.
   * Removes cache entries older than maxDays from the S3 bucket.
   */
  static generateRetentionCleanupScript(maxDays: number, bucketName: string): string {
    if (maxDays <= 0) return '';

    return `
      # Cache retention: remove entries older than ${maxDays} days
      CUTOFF_DATE=$(date -d "-${maxDays} days" +%s 2>/dev/null || echo "")
      if [ -n "$CUTOFF_DATE" ]; then
        BUCKET_PREFIX="s3://${bucketName}/orchestrator-cache/"
        aws $ENDPOINT_ARGS s3 ls "$BUCKET_PREFIX" --recursive 2>/dev/null | while read -r line; do
          FILE_DATE_STR=$(echo "$line" | awk '{print $1" "$2}')
          FILE_KEY=$(echo "$line" | awk '{print $4}')
          FILE_DATE_EPOCH=$(date -d "$FILE_DATE_STR" +%s 2>/dev/null || echo "0")
          if [ -n "$FILE_KEY" ] && [ "$FILE_DATE_EPOCH" -lt "$CUTOFF_DATE" ] 2>/dev/null; then
            aws $ENDPOINT_ARGS s3 rm "s3://${bucketName}/$FILE_KEY" 2>/dev/null || true
          fi
        done
        echo "[Cache Retention] Cleaned entries older than ${maxDays} days"
      fi`;
  }
}
