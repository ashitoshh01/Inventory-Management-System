import { Module, Global } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QUEUE_LOW_STOCK, QUEUE_REPORT_EXPORT, QUEUE_IMPORT } from './queue.constants';
import { QueueService } from './queue.service';

export function parseRedisConnection(redisUrlStr: string) {
  try {
    const url = new URL(redisUrlStr);
    return {
      host: url.hostname || 'localhost',
      port: parseInt(url.port || '6379', 10),
      username: url.username || undefined,
      password: url.password || undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    return {
      host: 'localhost',
      port: 6380,
      maxRetriesPerRequest: null,
    };
  }
}

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const redisUrl =
          configService.get<string>('REDIS_URL') ||
          process.env.REDIS_URL ||
          'redis://localhost:6380';

        return {
          connection: parseRedisConnection(redisUrl),
        };
      },
    }),
    BullModule.registerQueue(
      {
        name: QUEUE_LOW_STOCK,
      },
      {
        name: QUEUE_REPORT_EXPORT,
      },
      {
        name: QUEUE_IMPORT,
      },
    ),
  ],
  providers: [QueueService],
  exports: [BullModule, QueueService],
})
export class QueueModule {}
