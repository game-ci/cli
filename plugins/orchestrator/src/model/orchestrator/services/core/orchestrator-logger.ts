import * as core from '@actions/core';

class OrchestratorLogger {
  private static timestamp: number;
  private static globalTimestamp: number;

  public static setup() {
    this.timestamp = this.createTimestamp();
    this.globalTimestamp = this.timestamp;
  }

  public static log(message: string) {
    core.info(message);
  }

  public static logWarning(message: string) {
    core.warning(message);
  }

  public static logLine(message: string) {
    core.info(`${message}\n`);
  }

  public static error(message: string) {
    core.error(message);
  }

  public static logWithTime(message: string) {
    const newTimestamp = this.createTimestamp();
    core.info(
      `${message} (Since previous: ${this.calculateTimeDiff(
        newTimestamp,
        this.timestamp,
      )}, Total time: ${this.calculateTimeDiff(newTimestamp, this.globalTimestamp)})`,
    );
    this.timestamp = newTimestamp;
  }

  /**
   * Serialize an unknown error into a readable string.
   * JSON.stringify(error) on Error objects produces '{}' because Error properties
   * (message, stack, name) are non-enumerable. This method extracts them properly.
   */
  public static stringifyError(error: unknown): string {
    if (error instanceof Error) {
      return JSON.stringify(
        {
          name: error.name,
          message: error.message,
          stack: error.stack,
          ...error,
        },
        undefined,
        4,
      );
    }
    const serialized = JSON.stringify(error, undefined, 4);
    if (serialized === '{}' || serialized === undefined) {
      return String(error);
    }

    return serialized;
  }

  private static calculateTimeDiff(x: number, y: number) {
    return Math.floor((x - y) / 1000);
  }

  private static createTimestamp() {
    return Date.now();
  }
}
export default OrchestratorLogger;
