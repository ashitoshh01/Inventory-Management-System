import { Injectable, OnModuleDestroy, ServiceUnavailableException, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@repo/database';
import Redis from 'ioredis';
import { StructuredLogger } from '../../common/logger/structured-logger.service';
import { StorageService } from '../storage/storage.service';

export interface LivenessResult {
  status: 'ok';
  uptimeSeconds: number;
  timestamp: string;
}

export interface ReadinessResult {
  status: 'ok' | 'degraded' | 'down';
  database: 'up' | 'down';
  redis: 'up' | 'down';
  storage?: 'up' | 'down';
  timestamp: string;
}

@Injectable()
export class HealthService implements OnModuleDestroy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly logger: StructuredLogger,
    @Optional() private readonly storageService?: StorageService,
  ) {}

  private redisProbeClient: Redis | null = null;

  onModuleDestroy(): void {
    if (this.redisProbeClient) {
      try {
        this.redisProbeClient.disconnect();
      } catch {
        // ignore
      }
      this.redisProbeClient = null;
    }
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

    // 2. Probe Redis using reusable cached client
    try {
      if (!this.redisProbeClient) {
        this.redisProbeClient = new Redis(redisUrl, {
          connectTimeout: 3000,
          maxRetriesPerRequest: 1,
          lazyConnect: true,
          enableOfflineQueue: false,
        });
      }
      if (
        this.redisProbeClient.status !== 'ready' &&
        this.redisProbeClient.status !== 'connecting'
      ) {
        await this.redisProbeClient.connect();
      }
      const pong = await this.redisProbeClient.ping();
      if (pong === 'PONG') {
        redisStatus = 'up';
      }
    } catch (err) {
      this.logger.warn(
        `Redis health probe failed: ${err instanceof Error ? err.message : String(err)}`,
        'HealthService',
      );
      try {
        this.redisProbeClient?.disconnect();
      } catch {
        // ignore
      }
      this.redisProbeClient = null;
    }

    // 3. Probe Storage (Cloudinary) if configured
    let storageStatus: 'up' | 'down' | undefined = undefined;
    if (this.storageService) {
      try {
        const isStorageUp = await this.storageService.ping();
        storageStatus = isStorageUp ? 'up' : 'down';
      } catch (err) {
        this.logger.warn(
          `Storage health probe failed: ${err instanceof Error ? err.message : String(err)}`,
          'HealthService',
        );
        storageStatus = 'down';
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
          ...(storageStatus ? { storage: storageStatus } : {}),
        },
      });
    }

    return {
      status: 'ok',
      database: databaseStatus,
      redis: redisStatus,
      ...(storageStatus ? { storage: storageStatus } : {}),
      timestamp: new Date().toISOString(),
    };
  }
}
