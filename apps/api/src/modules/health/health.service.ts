import { Injectable, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@repo/database';
import Redis from 'ioredis';
import { StructuredLogger } from '../../common/logger/structured-logger.service';

export interface LivenessResult {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessResult {
  status: 'ok' | 'degraded' | 'down';
  database: 'up' | 'down';
  redis: 'up' | 'down';
  timestamp: string;
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly logger: StructuredLogger,
  ) {}

  onModuleDestroy(): void {
    this.logger.log('HealthService shutting down cleanly', 'HealthService');
  }

  checkLiveness(): LivenessResult {
    return {
      status: 'ok',
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
    };
  }

  async checkReadiness(): Promise<ReadinessResult> {
    const redisUrl = this.configService.get<string>('REDIS_URL', 'redis://localhost:6379');

    let databaseStatus: 'up' | 'down' = 'down';
    let redisStatus: 'up' | 'down' = 'down';

    // 1. Probe PostgreSQL via PrismaService
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'up';
    } catch (err) {
      this.logger.warn(
        `Database health probe failed: ${err instanceof Error ? err.message : String(err)}`,
        'HealthService',
      );
    }

    // 2. Probe Redis with timeout and guaranteed cleanup
    let redisClient: Redis | null = null;
    try {
      redisClient = new Redis(redisUrl, {
        connectTimeout: 3000,
        maxRetriesPerRequest: 1,
        lazyConnect: true,
      });
      await redisClient.connect();
      const pong = await redisClient.ping();
      if (pong === 'PONG') {
        redisStatus = 'up';
      }
    } catch (err) {
      this.logger.warn(
        `Redis health probe failed: ${err instanceof Error ? err.message : String(err)}`,
        'HealthService',
      );
    } finally {
      if (redisClient) {
        try {
          redisClient.disconnect();
        } catch {
          // ignore cleanup error
        }
      }
    }

    const isHealthy = databaseStatus === 'up' && redisStatus === 'up';

    if (!isHealthy) {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'One or more required infrastructure dependencies are unreachable.',
        details: {
          database: databaseStatus,
          redis: redisStatus,
        },
      });
    }

    return {
      status: 'ok',
      database: databaseStatus,
      redis: redisStatus,
      timestamp: new Date().toISOString(),
    };
  }
}
