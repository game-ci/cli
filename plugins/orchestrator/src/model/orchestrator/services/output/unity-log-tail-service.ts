import fs from 'node:fs';
import path from 'node:path';
import OrchestratorLogger from '../core/orchestrator-logger';

export interface UnityLogTailOptions {
  /** Files to tail. Files that don't exist yet are watched. */
  files: string[];
  /** Poll interval in ms while a file does not yet exist. Default 1000ms. */
  pollIntervalMs?: number;
  /**
   * Optional callback for each emitted line. Defaults to OrchestratorLogger.log.
   * Used by tests + integrations that want to forward to GHA core.info etc.
   */
  onLine?: (filePath: string, line: string) => void;
  /** Soft cap on bytes streamed per file. Prevents runaway log spam. */
  maxBytesPerFile?: number;
  /** Prefix every emitted line with the basename of the file. Default true. */
  prefixWithFilename?: boolean;
}

interface TailHandle {
  filePath: string;
  position: number;
  emittedBytes: number;
  watcher?: fs.FSWatcher;
  pollTimer?: NodeJS.Timeout;
}

/**
 * Live-tail Unity log files during a build, forwarding new lines to the
 * orchestrator logger so they show up in the GitHub Actions / CLI stream.
 *
 * Designed for the unity-builder host-side case where Unity is invoked with
 * `-logFile <path>` and writes to a stable file inside the workspace; the
 * orchestrator can `tail -f` that file from the host without depending on
 * `docker exec` or container hooks.
 */
export class UnityLogTailService {
  private readonly options: Required<Omit<UnityLogTailOptions, 'onLine'>> & {
    onLine: (filePath: string, line: string) => void;
  };
  private readonly handles = new Map<string, TailHandle>();
  private buffers = new Map<string, string>();
  private stopped = false;

  constructor(options: UnityLogTailOptions) {
    this.options = {
      files: options.files,
      pollIntervalMs: options.pollIntervalMs ?? 1000,
      maxBytesPerFile: options.maxBytesPerFile ?? 5 * 1024 * 1024,
      prefixWithFilename: options.prefixWithFilename ?? true,
      onLine: options.onLine ?? ((filePath, line) => OrchestratorLogger.log(line)),
    };
  }

  start(): void {
    for (const file of this.options.files) {
      this.beginTailing(file);
    }
  }

  stop(): void {
    this.stopped = true;
    for (const handle of this.handles.values()) {
      if (handle.watcher) handle.watcher.close();
      if (handle.pollTimer) clearInterval(handle.pollTimer);
      this.flushPartialLine(handle);
    }
    this.handles.clear();
    this.buffers.clear();
  }

  private beginTailing(filePath: string): void {
    const absolute = path.resolve(filePath);
    if (this.handles.has(absolute)) return;

    const handle: TailHandle = { filePath: absolute, position: 0, emittedBytes: 0 };
    this.handles.set(absolute, handle);

    if (fs.existsSync(absolute)) {
      this.attachWatcher(handle);
      this.readNewBytes(handle);
      return;
    }

    handle.pollTimer = setInterval(() => {
      if (this.stopped) return;
      if (fs.existsSync(absolute)) {
        if (handle.pollTimer) {
          clearInterval(handle.pollTimer);
          handle.pollTimer = undefined;
        }
        this.attachWatcher(handle);
        this.readNewBytes(handle);
      }
    }, this.options.pollIntervalMs);
  }

  private attachWatcher(handle: TailHandle): void {
    try {
      handle.watcher = fs.watch(handle.filePath, { persistent: false }, () => {
        this.readNewBytes(handle);
      });
    } catch (error: any) {
      OrchestratorLogger.logWarning(
        `[UnityLogs:tail] watch failed for ${handle.filePath}: ${error.message}, falling back to polling`,
      );
      handle.pollTimer = setInterval(() => this.readNewBytes(handle), this.options.pollIntervalMs);
    }
  }

  private readNewBytes(handle: TailHandle): void {
    if (this.stopped) return;
    let stat: fs.Stats;
    try {
      stat = fs.statSync(handle.filePath);
    } catch {
      return;
    }

    if (stat.size < handle.position) {
      handle.position = 0;
      handle.emittedBytes = 0;
    }
    if (stat.size === handle.position) return;

    const remainingBudget = this.options.maxBytesPerFile - handle.emittedBytes;
    if (remainingBudget <= 0) return;

    const bytesToRead = Math.min(stat.size - handle.position, remainingBudget);
    const buffer = Buffer.alloc(bytesToRead);
    let fd: number | undefined;
    try {
      fd = fs.openSync(handle.filePath, 'r');
      fs.readSync(fd, buffer, 0, bytesToRead, handle.position);
    } catch (error: any) {
      OrchestratorLogger.logWarning(
        `[UnityLogs:tail] read failed for ${handle.filePath}: ${error.message}`,
      );
      return;
    } finally {
      if (fd !== undefined) {
        try {
          fs.closeSync(fd);
        } catch {
          // ignore close failures
        }
      }
    }

    handle.position += bytesToRead;
    handle.emittedBytes += bytesToRead;

    const text = (this.buffers.get(handle.filePath) || '') + buffer.toString('utf8');
    const lines = text.split(/\r?\n/);
    const last = lines.pop();
    this.buffers.set(handle.filePath, last || '');

    const prefix = this.options.prefixWithFilename
      ? `[UnityLogs] ${path.basename(handle.filePath)}: `
      : '';
    for (const line of lines) {
      if (!line) continue;
      this.options.onLine(handle.filePath, prefix + line);
    }

    if (handle.emittedBytes >= this.options.maxBytesPerFile) {
      OrchestratorLogger.log(
        `[UnityLogs:tail] reached ${this.options.maxBytesPerFile} byte cap for ${handle.filePath}`,
      );
    }
  }

  private flushPartialLine(handle: TailHandle): void {
    const partial = this.buffers.get(handle.filePath);
    if (partial) {
      const prefix = this.options.prefixWithFilename
        ? `[UnityLogs] ${path.basename(handle.filePath)}: `
        : '';
      this.options.onLine(handle.filePath, prefix + partial);
      this.buffers.delete(handle.filePath);
    }
  }
}
