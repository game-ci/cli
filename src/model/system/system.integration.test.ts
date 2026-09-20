import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { System } from './system.ts';

describe('System', () => {
  describe('run', () => {
    describe('integration', () => {
      if (!process.env.CI) {
        test("doesn't run locally", () => {
          expect(true).toBe(true);
        });
      } else {
        test('runs a command successfully', async () => {
          await expect(System.run('true')).resolves.not.toBeNull();
        });

        test('outputs results', async () => {
          const result = await System.run('echo test');
          expect(result.output.trim()).toBe('test');
        });

        test('succeeds when a command writes to stderr but exits 0', async () => {
          // Was 'throws when command writes to stderr' - codified the bug
          // this fixes (game-ci/cli#84): docker writes informational
          // messages to stderr on otherwise-successful runs, so stderr
          // content alone can't mean failure. Exit code does.
          await expect(System.run('echo fail >&2')).resolves.not.toBeNull();
        });

        test('throws when a command exits non-zero', async () => {
          await expect(System.run('exit 1')).rejects.toThrow();
        });

        // The contract Docker.run's Unity-abort handling rests on, asserted
        // against a real child process rather than the mocked System.run in
        // docker.test.ts - that mock hard-codes both streams, so it stays
        // green if the streams are ever folded together here, which is one of
        // the two ways the useful abort reason could go missing again
        // (game-ci/cli#288, reported live from MirrorNetworking's CI).
        //
        // Specifically: Unity's "Aborting batchmode due to failure:" line has
        // to arrive on stdout - build.sh runs the editor with `-logfile
        // /dev/stdout` - while docker's own pull noise arrives on stderr. That
        // split is the only reason the catch block can surface the reason and
        // drop the noise. The windowsSpecificCommand exists only so this runs
        // on a developer's Windows box too; System.run otherwise picks
        // powershell there and sh everywhere else.
        test('keeps stdout and stderr apart on a non-zero exit', async () => {
          const rejection: any = await System
            .run(
              "printf 'unity-reason\\n'; printf 'docker-noise\\n' >&2; exit 3",
              "Write-Output 'unity-reason'; [Console]::Error.WriteLine('docker-noise'); exit 3",
            )
            .catch((error) => error);

          expect(rejection.stdout).toContain('unity-reason');
          expect(rejection.stderr).toContain('docker-noise');

          // stderr is the whole of `message`; stdout must not be folded in, or
          // Docker.run would quote docker's noise as the cause again.
          expect(rejection.message).toContain('docker-noise');
          expect(rejection.message).not.toContain('unity-reason');
        });
      }
    });
  });
});
