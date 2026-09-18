import { Logger } from '@nestjs/common';
import { Worker } from 'bullmq';

/**
 * WorkerCircuitBreaker protects BullMQ workers from entering high-frequency
 * unthrottled error spin loops when Redis rejections (e.g. quota limit, connection drops)
 * occur.
 *
 * It uses BullMQ's in-memory `worker.pause(true)` which executes zero Redis commands,
 * maintains a single active backoff timer, and exponentially backs off before resuming.
 */
export class WorkerCircuitBreaker {
  private isBackingOff = false;
  private failureCount = 0;
  private timer: NodeJS.Timeout | null = null;

  constructor(
    private readonly workerName: string,
    private readonly logger: Logger,
  ) {}

  async handleError(worker: Worker, err: Error): Promise<void> {
    this.logger.error(`[${this.workerName}] Worker error: ${err.message}`);

    // Prevent burst errors from scheduling multiple concurrent timers
    if (this.isBackingOff) {
      return;
    }

    this.isBackingOff = true;
    this.failureCount++;

    // Bounded exponential backoff: 5s, 10s, 20s, 40s, up to 60s maximum
    const delayMs = Math.min(5000 * Math.pow(2, this.failureCount - 1), 60000);
    this.logger.warn(
      `[${this.workerName}] Redis command/connection error detected (attempt ${this.failureCount}). Pausing worker for ${delayMs / 1000}s backoff...`,
    );

    try {
      // In-memory pause (doNotWaitActive = true) — generates 0 Redis commands
      await worker.pause(true);
    } catch (pauseErr) {
      this.logger.warn(
        `[${this.workerName}] Error during in-memory worker pause: ${(pauseErr as Error).message}`,
      );
    }

    if (this.timer) {
      clearTimeout(this.timer);
    }

    this.timer = setTimeout(async () => {
      this.isBackingOff = false;
      this.timer = null;
      try {
        await worker.resume();
        this.logger.log(`[${this.workerName}] Worker resumed after backoff.`);
      } catch (resumeErr) {
        this.logger.error(
          `[${this.workerName}] Failed to resume worker after backoff: ${(resumeErr as Error).message}`,
        );
      }
    }, delayMs);
  }

  reset(): void {
    if (this.failureCount > 0) {
      this.failureCount = 0;
    }
  }

  cleanup(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.isBackingOff = false;
  }
}
