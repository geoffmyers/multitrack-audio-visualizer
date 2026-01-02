export class Logger {
  private isVerbose: boolean;
  private startTime: number;

  constructor(verbose: boolean = false) {
    this.isVerbose = verbose;
    this.startTime = Date.now();
  }

  setVerbose(verbose: boolean): void {
    this.isVerbose = verbose;
  }

  log(message: string, force: boolean = false): void {
    if (this.isVerbose || force) {
      console.log(`[CLI] ${message}`);
    }
  }

  info(message: string): void {
    this.log(message, true);
  }

  error(message: string): void {
    console.error(`[CLI] Error: ${message}`);
  }

  warn(message: string): void {
    console.warn(`[CLI] Warning: ${message}`);
  }

  success(message: string): void {
    console.log(`[CLI] ✓ ${message}`);
  }

  verbose(message: string): void {
    if (this.isVerbose) {
      console.log(`[CLI]   ${message}`);
    }
  }

  header(message: string): void {
    if (this.isVerbose) {
      console.log(`\n[CLI] ${message}`);
    }
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);

    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  }

  formatDuration(ms: number): string {
    return this.formatTime(ms / 1000);
  }

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  getElapsedTime(): number {
    return (Date.now() - this.startTime) / 1000;
  }

  logElapsed(prefix: string = 'Elapsed'): void {
    if (this.isVerbose) {
      console.log(`[CLI] ${prefix}: ${this.formatTime(this.getElapsedTime())}`);
    }
  }
}
