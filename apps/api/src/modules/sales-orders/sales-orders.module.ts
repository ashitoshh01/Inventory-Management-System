import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StockModule } from '../stock/stock.module';
import { SalesOrdersController, SalesController } from './sales-orders.controller';
import { SalesOrdersService } from './sales-orders.service';

@Module({
  imports: [AuditModule, StockModule],
  controllers: [SalesOrdersController, SalesController],
  providers: [SalesOrdersService],
  exports: [SalesOrdersService],
})
export class SalesOrdersModule {}
