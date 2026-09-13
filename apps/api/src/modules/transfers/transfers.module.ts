import { Module } from '@nestjs/common';
import { AuditModule } from '../audit/audit.module';
import { StockModule } from '../stock/stock.module';
import { TransfersService } from './transfers.service';
import { TransfersController } from './transfers.controller';

@Module({
  imports: [AuditModule, StockModule],
  controllers: [TransfersController],
  providers: [TransfersService],
  exports: [TransfersService],
})
export class TransfersModule {}
