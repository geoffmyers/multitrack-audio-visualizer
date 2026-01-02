import cliProgress from 'cli-progress';
import { Logger } from './Logger.js';

export class ProgressReporter {
  private bar: cliProgress.SingleBar | null = null;
  private logger: Logger;
  private verbose: boolean;
  private startTime: number = 0;
  private currentPhase: string = '';

  constructor(logger: Logger, verbose: boolean = false) {
    this.logger = logger;
    this.verbose = verbose;
  }

  start(total: number, phase: string): void {
    this.currentPhase = phase;
    this.startTime = Date.now();

    if (!this.verbose) {
      // Create progress bar for non-verbose mode
      this.bar = new cliProgress.SingleBar({
        format: `${phase}... {bar} {percentage}% | {elapsed}s / {eta}s`,
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
      });
      this.bar.start(total, 0);
    } else {
      this.logger.header(phase);
    }
  }

  update(current: number, total?: number, message?: string): void {
    if (!this.verbose && this.bar) {
      const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
      const payload: any = { elapsed };

      if (total && current > 0) {
        const progress = current / total;
        const totalEstimatedTime = elapsed / progress;
        const eta = Math.floor(totalEstimatedTime - elapsed);
        payload.eta = eta;
      } else {
        payload.eta = '?';
      }

      this.bar.update(current, payload);
    } else if (this.verbose && message) {
      this.logger.verbose(message);
    }
  }

  increment(message?: string): void {
    if (!this.verbose && this.bar) {
      this.bar.increment();
    } else if (this.verbose && message) {
      this.logger.verbose(message);
    }
  }

  stop(): void {
    if (!this.verbose && this.bar) {
      this.bar.stop();
      this.bar = null;
    }

    const elapsed = (Date.now() - this.startTime) / 1000;
    if (this.verbose) {
      this.logger.verbose(`Completed in ${this.logger.formatTime(elapsed)}`);
    }
  }

  finish(message?: string): void {
    this.stop();
    if (message) {
      this.logger.success(message);
    }
  }

  error(message: string): void {
    if (this.bar) {
      this.bar.stop();
      this.bar = null;
    }
    this.logger.error(message);
  }
}
