import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import type { LowStockCheckJobPayload, ReportExportJobPayload, ImportJobPayload } from '@repo/types';
import {
  QUEUE_LOW_STOCK,
  QUEUE_REPORT_EXPORT,
  QUEUE_IMPORT,
  JOB_CHECK_LOW_STOCK,
  JOB_PROCESS_REPORT_EXPORT,
  JOB_PROCESS_IMPORT,
} from './queue.constants';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue(QUEUE_LOW_STOCK) private readonly lowStockQueue: Queue,
    @InjectQueue(QUEUE_REPORT_EXPORT) private readonly exportQueue: Queue,
    @InjectQueue(QUEUE_IMPORT) private readonly importQueue: Queue,
  ) {}

  /**
   * Enqueues a low-stock check job for an organization's product in a warehouse.
   * Uses idempotent job ID per (organizationId, productId, warehouseId) window
   * with bounded retries and exponential backoff.
   */
  async enqueueLowStockCheck(payload: LowStockCheckJobPayload): Promise<void> {
    try {
      // Deterministic job ID within a small deduplication window
      const jobId = `low-stock-${payload.organizationId}-${payload.productId}-${payload.warehouseId}-${Date.now()}`;

      await this.lowStockQueue.add(JOB_CHECK_LOW_STOCK, payload, {
        jobId,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: 100,
        removeOnFail: 500,
      });

      this.logger.debug(
        `Enqueued low stock check job for org=${payload.organizationId}, product=${payload.productId}, wh=${payload.warehouseId}`,
      );
    } catch (error) {
      // Log error but do not throw to prevent crashing caller (e.g. stock mutation transaction commit)
      this.logger.error(`Failed to enqueue low-stock check: ${(error as Error).message}`, (error as Error).stack);
    }
  }

  /**
   * Enqueues an asynchronous report export job.
   */
  async enqueueReportExport(payload: ReportExportJobPayload): Promise<void> {
    const jobId = `export-${payload.exportId}`;

    await this.exportQueue.add(JOB_PROCESS_REPORT_EXPORT, payload, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 50,
      removeOnFail: 200,
    });

    this.logger.log(`Enqueued report export job ${jobId} for reportType=${payload.reportType}`);
  }

  /**
   * Enqueues an asynchronous import processing job with bounded retries and exponential backoff.
   */
  async enqueueImport(payload: ImportJobPayload): Promise<void> {
    const jobId = `import-${payload.importId}`;

    await this.importQueue.add(JOB_PROCESS_IMPORT, payload, {
      jobId,
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: 50,
      removeOnFail: 200,
    });

    this.logger.log(
      `Enqueued import job ${jobId} for type=${payload.type} in org=${payload.organizationId}`,
    );
  }
}
