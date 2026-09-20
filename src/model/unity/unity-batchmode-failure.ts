/**
 * Unity prints this immediately before exiting whenever it refuses to run at
 * all - most commonly script compiler errors, but also things like a missing
 * required package. It's the single most useful line in the whole run, and
 * it lives in stdout (the container/host's own echoed Unity log) - not in
 * whatever a generic "command failed" error captures from stderr (for
 * Docker.run specifically, that's `docker run`'s own pull-progress noise,
 * not anything Unity printed - see System.run). Surfacing it turns "exit
 * code 1, go read the log above" into an actionable one-liner.
 *
 * Reported live: MirrorNetworking's CI (game-ci/unity-test-runner@v4, which
 * now delegates to `game-ci test --docker`) failed with nothing but "Test
 * run failed with exit code 1" - the real reason, "Scripts have compiler
 * errors.", was sitting ~1400 log lines earlier and never reached the final
 * error message at all.
 *
 * Reported live once more, from the opposite direction: the same CI then
 * appended that stderr under the "Original error:" heading below, burying
 * the reason it was supposed to support. Docker leads its stderr with the
 * benign pre-pull "Unable to find image '...' locally" line, so the message
 * read as an editor failing to load 6000.3.23f1 - two maintainers went
 * looking for a version problem while "Scripts have compiler errors." sat
 * two lines above it. Hence `originalMessage` is optional, and the one
 * caller whose error text is already in the log - Docker, via System.run's
 * live stderr passthrough - omits it.
 */
class UnityBatchmodeFailure {
  static extractReason(stdout: string | undefined): string | undefined {
    // \r?\n: the Windows step scripts (dist/platforms/windows) run Unity via
    // PowerShell, which can leave stdout CRLF-terminated - a bare \n would
    // silently stop matching there and lose this on Windows specifically,
    // the same platform HostRunner's --local path most needs it on.
    const match = stdout?.match(/^Aborting batchmode due to failure:\r?\n(.+)$/m);

    return match?.[1]?.trim() || undefined;
  }

  /**
   * Returns a clearer error message when `stdout` contains Unity's own abort
   * reason, or undefined otherwise.
   *
   * `originalMessage` is the caller's own error text, appended under an
   * "Original error:" heading. Omit it when that text is already in the log
   * above - the reason is the useful part, and repeating a stream the reader
   * has already scrolled past only buries it.
   */
  static describe(stdout: string | undefined, originalMessage?: string): string | undefined {
    const reason = UnityBatchmodeFailure.extractReason(stdout);
    if (!reason) return undefined;

    const message = String.dedent`
      Unity aborted before completing: ${reason}

      This is a failure inside the Unity Editor itself (commonly script
      compiler errors, a missing package, or a crash during startup) - not a
      docker/game-ci infrastructure problem. The full Unity log is above.
    `;

    if (!originalMessage) return message;

    return `${message}\n\nOriginal error:\n${originalMessage}`;
  }
}

export { UnityBatchmodeFailure };
