import { core } from '../../../dependencies.ts';

class CloudRunnerLogger {
  private static timestamp: number;
  private static globalTimestamp: number;

  public static setup() {
    this.timestamp = this.createTimestamp();
    this.globalTimestamp = this.timestamp;
  }

  public static log(message: string) {
    log.info(message);
  }

  public static logWarning(message: string) {
    log.warning(message);
  }

  public static logLine(message: string) {
    log.info(`${message}\n`);
  }

  public static error(message: string) {
    log.error(message);
  }

  public static logWithTime(message: string) {
    const newTimestamp = this.createTimestamp();
    log.info(
      `${message} (Since previous: ${this.calculateTimeDiff(
        newTimestamp,
        this.timestamp,
      )}, Total time: ${this.calculateTimeDiff(newTimestamp, this.globalTimestamp)})`,
    );
    this.timestamp = newTimestamp;
  }

  private static calculateTimeDiff(x: number, y: number) {
    return Math.floor((x - y) / 1000);
  }

  private static createTimestamp() {
    return Date.now();
  }
}
export default CloudRunnerLogger;
