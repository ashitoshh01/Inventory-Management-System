import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './common/database/database.module';
import { StructuredLogger } from './common/logger/structured-logger.service';
import { AuthModule } from './modules/auth/auth.module';
import { WorkerModule } from './modules/worker/worker.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '../../.env'],
    }),
    DatabaseModule,
    AuthModule,
    WorkerModule,
  ],
  providers: [StructuredLogger],
  exports: [StructuredLogger],
})
export class WorkerAppModule {}
