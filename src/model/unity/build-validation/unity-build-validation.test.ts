import { describe, it, expect } from 'bun:test';
import { UnityBuildValidation } from './unity-build-validation.ts';

describe('UnityBuildValidation.validateBuild', () => {
  it('does not throw for a clean build (Errors: 0, Build succeeded!)', () => {
    const output = `
###########################
#      Build results      #
###########################

Duration: 00:01:00.0000000
Warnings: 0
Errors: 0
Size: 12345 bytes

Build succeeded!
`;
    expect(() => UnityBuildValidation.validateBuild(output)).not.toThrow();
  });

  // Regression test for a real bug, confirmed live on unity-builder#844's
  // macOS jobs: Unity's own BuildSummary.totalErrors can be nonzero on a
  // build Unity itself considers Succeeded (BuildResult.Succeeded, which is
  // what prints "Build succeeded!" - see StdOutReporter.cs). Treating any
  // nonzero Errors count as fatal second-guesses Unity's own authoritative
  // result and rejects objectively successful builds.
  it('does not throw when Errors is nonzero but Unity itself reports Build succeeded!', () => {
    const output = `
###########################
#      Build results      #
###########################

Duration: 00:02:31.6922495
Warnings: 3
Errors: 1
Size: 289530813 bytes

Build succeeded!
`;
    expect(() => UnityBuildValidation.validateBuild(output)).not.toThrow();
  });

  it('throws when Errors is nonzero and there is no Build succeeded! confirmation', () => {
    const output = `
###########################
#      Build results      #
###########################

Duration: 00:01:00.0000000
Warnings: 0
Errors: 2
Size: 0 bytes

Build failed!
`;
    expect(() => UnityBuildValidation.validateBuild(output)).toThrow(/error building the project/);
  });

  it('throws when the Build results section is entirely missing', () => {
    expect(() => UnityBuildValidation.validateBuild('some unrelated log output')).toThrow(
      /error building the project/,
    );
  });
});
