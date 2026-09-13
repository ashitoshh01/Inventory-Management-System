import { Test, TestingModule } from '@nestjs/testing';
import { Job } from 'bullmq';
import * as fs from 'fs';
import { ReportExportProcessor, EXPORTS_STORAGE_DIR } from './report-export.processor';
import { PrismaService } from '@repo/database';
import { ReportsService } from '../reports/reports.service';
import { JOB_PROCESS_REPORT_EXPORT } from '../queue/queue.constants';
import type { ReportExportJobPayload } from '@repo/types';

jest.mock('fs');

describe('ReportExportProcessor', () => {
  let processor: ReportExportProcessor;
  let prisma: {
    exportJob: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    notification: {
      create: jest.Mock;
    };
  };
  let reportsService: {
    generateReportCsvString: jest.Mock;
  };

  const baseJobData: ReportExportJobPayload = {
    exportId: 'export-1',
    organizationId: 'org-1',
    userId: 'user-1',
    reportType: 'stock-movement',
    queryParams: {
      page: 1,
      limit: 20,
    },
  };

  const mockJob = (data: ReportExportJobPayload) =>
    ({
      name: JOB_PROCESS_REPORT_EXPORT,
      data,
    }) as unknown as Job<ReportExportJobPayload>;

  beforeEach(async () => {
    jest.clearAllMocks();
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);

    prisma = {
      exportJob: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'export-1',
          organizationId: 'org-1',
          userId: 'user-1',
          status: 'PENDING',
        }),
        update: jest.fn().mockResolvedValue({ id: 'export-1' }),
      },
      notification: {
        create: jest.fn().mockResolvedValue({ id: 'notif-1' }),
      },
    };

    reportsService = {
      generateReportCsvString: jest.fn().mockResolvedValue({
        csvString: 'Product,Quantity\nWidget,10',
        rowCount: 1,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportExportProcessor,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: ReportsService,
          useValue: reportsService,
        },
      ],
    }).compile();

    processor = module.get<ReportExportProcessor>(ReportExportProcessor);
  });

  it('should generate CSV, write to storage, update job to COMPLETED, and send notification', async () => {
    const result = await processor.process(mockJob(baseJobData));

    expect(result).toEqual({ success: true, exportId: 'export-1' });

    // Step 1: Status marked as PROCESSING
    expect(prisma.exportJob.update).toHaveBeenCalledWith({
      where: { id: 'export-1' },
      data: { status: 'PROCESSING' },
    });

    // Step 2: ReportsService called with orgId
    expect(reportsService.generateReportCsvString).toHaveBeenCalledWith(
      'org-1',
      expect.objectContaining({ reportType: 'stock-movement' }),
    );

    // Step 3: File written to storage
    expect(fs.writeFileSync).toHaveBeenCalled();

    // Step 4: Job updated to COMPLETED
    expect(prisma.exportJob.update).toHaveBeenCalledWith({
      where: { id: 'export-1' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        fileName: 'export-export-1.csv',
        rowCount: 1,
      }),
    });

    // Step 5: Notification created for the user
    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'EXPORT_READY',
        title: expect.stringContaining('Export Ready'),
      }),
    });
  });

  it('should mark ExportJob as FAILED and notify user if CSV generation throws an error', async () => {
    reportsService.generateReportCsvString.mockRejectedValue(
      new Error('Database timeout'),
    );

    await expect(processor.process(mockJob(baseJobData))).rejects.toThrow(
      'Database timeout',
    );

    expect(prisma.exportJob.update).toHaveBeenCalledWith({
      where: { id: 'export-1' },
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'Database timeout',
      }),
    });

    expect(prisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        type: 'EXPORT_FAILED',
        title: expect.stringContaining('Export Failed'),
      }),
    });
  });
});
