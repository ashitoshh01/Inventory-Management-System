import { Module } from '@nestjs/common';
import { PrismaModule } from '@repo/database';

@Module({
  imports: [PrismaModule],
  exports: [PrismaModule],
})
export class DatabaseModule {}
