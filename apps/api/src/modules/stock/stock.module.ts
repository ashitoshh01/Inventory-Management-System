import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StockFoundationService } from './stock-foundation.service';
import { StockMutationService } from './stock-mutation.service';
import { StockController } from './stock.controller';

@Module({
  imports: [AuditModule],
  controllers: [StockController],
  providers: [StockFoundationService, StockMutationService],
  exports: [StockFoundationService, StockMutationService],
})
export class StockModule {}
