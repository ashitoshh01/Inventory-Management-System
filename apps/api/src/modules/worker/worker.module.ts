import { Module } from '@nestjs/common';
import { QueueModule } from '../queue/queue.module';
import { ReportsModule } from '../reports/reports.module';
import { StockModule } from '../stock/stock.module';
import { AuditModule } from '../audit/audit.module';
import { LowStockProcessor } from './low-stock.processor';
import { ReportExportProcessor } from './report-export.processor';
import { ImportProcessor } from './import.processor';

@Module({
  imports: [QueueModule, ReportsModule, StockModule, AuditModule],
  providers: [LowStockProcessor, ReportExportProcessor, ImportProcessor],
  exports: [LowStockProcessor, ReportExportProcessor, ImportProcessor],
})
export class WorkerModule {}

