import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PrismaService } from '@repo/database';
import { HealthService } from '../health/health.service';
import { AdminSystemHealth, AdminJobStats } from '@repo/types';

@Controller('admin/system')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminSystemController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly healthService: HealthService,
  ) {}

  @Get('health')
  async getHealth(): Promise<AdminSystemHealth> {
    const liveness = this.healthService.checkLiveness();
    let database = 'down';
    let redis = 'down';
    let storage: string | undefined = undefined;
    let overallStatus = 'down';

    try {
      const readiness = await this.healthService.checkReadiness();
      database = readiness.database;
      redis = readiness.redis;
      storage = readiness.storage;
      overallStatus = readiness.status;
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'getResponse' in err) {
        const response = (err as { getResponse: () => { details?: { database?: string; redis?: string; storage?: string } } }).getResponse();
        if (response?.details) {
          database = response.details.database ?? 'down';
          redis = response.details.redis ?? 'down';
          storage = response.details.storage;
        }
      }
      overallStatus = database === 'up' || redis === 'up' ? 'degraded' : 'down';
    }

    return {
      status: overallStatus,
      database,
      redis,
      ...(storage ? { storage } : {}),
      uptimeSeconds: liveness.uptimeSeconds,
      timestamp: new Date().toISOString(),
    };
  }

  @Get('jobs')
  async getJobStats(): Promise<AdminJobStats> {
    const [exportCounts, importCounts] = await Promise.all([
      this.prisma.exportJob.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      this.prisma.importJob.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
    ]);

    const exportMap = Object.fromEntries(
      exportCounts.map((c) => [c.status, c._count.status]),
    );
    const importMap = Object.fromEntries(
      importCounts.map((c) => [c.status, c._count.status]),
    );

    return {
      exportJobs: {
        pending: exportMap['PENDING'] || 0,
        processing: exportMap['PROCESSING'] || 0,
        completed: exportMap['COMPLETED'] || 0,
        failed: exportMap['FAILED'] || 0,
      },
      importJobs: {
        pending: (importMap['PENDING'] || 0) + (importMap['VALIDATING'] || 0),
        processing: importMap['PROCESSING'] || 0,
        completed: (importMap['COMPLETED'] || 0) + (importMap['PARTIALLY_COMPLETED'] || 0),
        failed: importMap['FAILED'] || 0,
      },
    };
  }

  @Get('notifications')
  async getNotificationStats() {
    const [total, unread] = await Promise.all([
      this.prisma.notification.count(),
      this.prisma.notification.count({ where: { isRead: false } }),
    ]);

    return {
      total,
      unread,
      read: total - unread,
    };
  }
}
