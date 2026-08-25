class UnityBuildValidation {
  /**
   * Checks for errors in the build output and throws an error if any are found.
   *
   * @param buildOutput String containing the output of the Unity build process
   * @throws Error if there are any errors in the build output
   */
  static validateBuild(buildOutput: string) {
    // StdOutReporter.ExitWithResult prints this literal text (and calls
    // EditorApplication.Exit(0)) only for BuildResult.Succeeded - Unity's
    // own most authoritative pass/fail signal, already used by System.run's
    // exit-code check to decide whether we even reach this function at all.
    //
    // BuildSummary.totalErrors (parsed below as a fallback) can be nonzero
    // on a build Unity itself considers Succeeded - a known Unity quirk
    // where totalErrors counts non-fatal issues logged during the build
    // (e.g. a benign asset-import or package-resolution warning) that don't
    // affect the produced player. Treating any nonzero count as fatal here
    // second-guesses Unity's own BuildResult and produces false failures on
    // objectively successful builds - confirmed live on unity-builder#844's
    // macOS jobs: "Errors: 1" alongside "Build Finished, Result: Success."
    // and "Build succeeded!", with a correctly-sized .app actually produced.
    if (buildOutput.includes('Build succeeded!')) return;

    // Check for errors in the Build Results section
    const match = buildOutput.match(/^#\s*Build results\s*#(.*)^Size:/ms);

    if (match) {
      const buildResults = match[1];
      const errorMatch = buildResults.match(/^Errors:\s*(\d+)$/m);
      if (errorMatch && Number.parseInt(errorMatch[1], 10) !== 0) {
        throw new Error(`There was an error building the project. Please read the logs for details.`);
      }
    } else {
      throw new Error(`There was an error building the project. Please read the logs for details.`);
    }
  }
}

export { UnityBuildValidation };
