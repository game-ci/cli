class UnityBuildValidation {
  /**
   * Checks for errors in the build output and throws an error if any are found.
   *
   * @param buildOutput String containing the output of the Unity build process
   * @throws Error if there are any errors in the build output
   */
  static validateBuild(buildOutput: string) {
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

export default UnityBuildValidation;
