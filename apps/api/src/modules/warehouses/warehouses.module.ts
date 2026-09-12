import { Module } from '@nestjs/common';
import { WarehousesService } from './warehouses.service';
import { AuditModule } from '../audit/audit.module';

import { WarehousesController } from './warehouses.controller';

@Module({
  imports: [AuditModule],
  controllers: [WarehousesController],
  providers: [WarehousesService],
  exports: [WarehousesService],
})
export class WarehousesModule {}
