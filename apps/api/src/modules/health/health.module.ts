import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { StructuredLogger } from '../../common/logger/structured-logger.service';

@Module({
  controllers: [HealthController],
  providers: [HealthService, StructuredLogger],
  exports: [HealthService],
})
export class HealthModule {}
