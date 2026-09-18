import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import * as fs from 'fs';
import * as path from 'path';
import { plainToInstance } from 'class-transformer';
import { PrismaService } from '@repo/database';
import type { ReportExportJobPayload } from '@repo/types';
import { QUEUE_REPORT_EXPORT, JOB_PROCESS_REPORT_EXPORT } from '../queue/queue.constants';
import { ReportsService } from '../reports/reports.service';
import { ExportReportDto } from '../reports/dto/reports-query.dto';
import { EXPORTS_STORAGE_DIR } from '../reports/reports.constants';
import { WorkerCircuitBreaker } from './worker-backoff.helper';

export { EXPORTS_STORAGE_DIR };

@Processor(QUEUE_REPORT_EXPORT, {
  concurrency: 1, // CPU/memory bound CSV serialization; serialize to prevent memory spikes
  drainDelay: 10, // 10s idle block ceiling
  stalledInterval: 60000, // Check stalled jobs once per minute
  maxStalledCount: 2,
  lockDuration: 30000,
})
@Injectable()
export class ReportExportProcessor extends WorkerHost implements OnModuleDestroy {
  private readonly logger = new Logger(ReportExportProcessor.name);
  private readonly circuitBreaker = new WorkerCircuitBreaker(ReportExportProcessor.name, this.logger);

  constructor(
    private readonly prisma: PrismaService,
    private readonly reportsService: ReportsService,
  ) {
    super();
    // Ensure exports directory exists
    try {
      if (!fs.existsSync(EXPORTS_STORAGE_DIR)) {
        fs.mkdirSync(EXPORTS_STORAGE_DIR, { recursive: true });
      }
    } catch (err) {
      this.logger.error(`Failed to create export storage directory: ${(err as Error).message}`);
    }
  }

  onModuleDestroy(): void {
    this.circuitBreaker.cleanup();
  }

  @OnWorkerEvent('error')
  async onError(err: Error): Promise<void> {
    await this.circuitBreaker.handleError(this.worker, err);
  }

  async process(job: Job<ReportExportJobPayload>): Promise<{ success: boolean; exportId: string }> {
    this.circuitBreaker.reset();
    if (job.name !== JOB_PROCESS_REPORT_EXPORT) {
      this.logger.warn(`Unknown job name: ${job.name}`);
      return { success: false, exportId: job.data.exportId };
    }

    const { exportId, organizationId, userId, reportType, queryParams } = job.data;
    this.logger.log(`Processing async export ${exportId} (${reportType}) for user ${userId} in org ${organizationId}`);

    // Verify ExportJob exists
    const exportRecord = await this.prisma.exportJob.findUnique({
      where: { id: exportId },
    });

    if (!exportRecord) {
      this.logger.error(`ExportJob ${exportId} not found in database.`);
      return { success: false, exportId };
    }

    // Mark PROCESSING
    await this.prisma.exportJob.update({
      where: { id: exportId },
      data: { status: 'PROCESSING' },
    });

    try {
      // 1. Authoritative generation via ReportsService
      const exportDto = plainToInstance(ExportReportDto, {
        reportType: reportType as ExportReportDto['reportType'],
        ...(queryParams ?? {}),
      });

      const { csvString, rowCount } = await this.reportsService.generateReportCsvString(
        organizationId,
        exportDto,
      );

      // 2. Write file to local secure storage
      if (!fs.existsSync(EXPORTS_STORAGE_DIR)) {
        fs.mkdirSync(EXPORTS_STORAGE_DIR, { recursive: true });
      }

      const fileName = `export-${exportId}.csv`;
      const filePath = path.join(EXPORTS_STORAGE_DIR, fileName);
      fs.writeFileSync(filePath, csvString, 'utf8');
      const fileSize = Buffer.byteLength(csvString, 'utf8');

      // 3. Update ExportJob COMPLETED
      await this.prisma.exportJob.update({
        where: { id: exportId },
        data: {
          status: 'COMPLETED',
          fileName,
          fileSize,
          rowCount,
          completedAt: new Date(),
        },
      });

      // 4. Emit EXPORT_READY notification
      const friendlyName = reportType.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      await this.prisma.notification.create({
        data: {
          organizationId,
          userId,
          type: 'EXPORT_READY',
          title: `${friendlyName} Export Ready`,
          message: `Your ${friendlyName} report export has finished processing (${rowCount.toLocaleString()} rows).`,
          metadata: {
            exportId,
            reportType,
            fileName,
            fileSize,
            rowCount,
            downloadUrl: `/api/v1/reports/exports/${exportId}/download`,
          },
        },
      });

      this.logger.log(`Successfully completed export ${exportId} (${rowCount} rows, ${fileSize} bytes)`);
      return { success: true, exportId };
    } catch (error) {
      this.logger.error(`Export ${exportId} failed: ${(error as Error).message}`, (error as Error).stack);

      // Update ExportJob FAILED
      await this.prisma.exportJob.update({
        where: { id: exportId },
        data: {
          status: 'FAILED',
          errorMessage: (error as Error).message,
        },
      });

      // Emit EXPORT_FAILED notification
      const friendlyName = reportType.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
      await this.prisma.notification.create({
        data: {
          organizationId,
          userId,
          type: 'EXPORT_FAILED',
          title: `${friendlyName} Export Failed`,
          message: `Unable to complete ${friendlyName} export: ${(error as Error).message}`,
          metadata: {
            exportId,
            reportType,
          },
        },
      });

      throw error; // Let BullMQ track failure and handle retries if configured
    }
  }
}
