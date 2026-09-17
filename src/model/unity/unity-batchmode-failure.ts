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
 */
class UnityBatchmodeFailure {
  static extractReason(stdout: string | undefined): string | undefined {
    const match = stdout?.match(/^Aborting batchmode due to failure:\n(.+)$/m);

    return match?.[1]?.trim() || undefined;
  }

  /** Returns a clearer error message when `stdout` contains Unity's own abort reason, or undefined otherwise. */
  static describe(stdout: string | undefined, originalMessage: string): string | undefined {
    const reason = UnityBatchmodeFailure.extractReason(stdout);
    if (!reason) return undefined;

    return String.dedent`
      Unity aborted before completing: ${reason}

      This is a failure inside the Unity Editor itself (commonly script
      compiler errors, a missing package, or a crash during startup) - not a
      docker/game-ci infrastructure problem. The full Unity log is above.

      Original error:
      ${originalMessage}
    `;
  }
}

export { UnityBatchmodeFailure };
