import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StockModule } from '../stock/stock.module';
import { PurchaseOrdersFoundationService } from './purchase-orders-foundation.service';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersController } from './purchase-orders.controller';

@Module({
  imports: [AuditModule, StockModule],
  controllers: [PurchaseOrdersController],
  providers: [PurchaseOrdersFoundationService, PurchaseOrdersService],
  exports: [PurchaseOrdersFoundationService, PurchaseOrdersService],
})
export class PurchaseOrdersModule {}
