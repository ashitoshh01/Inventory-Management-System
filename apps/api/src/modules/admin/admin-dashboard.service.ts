import { Injectable } from '@nestjs/common';
import { PrismaService } from '@repo/database';
import { AdminDashboardStats, AdminRecentActivity } from '@repo/types';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<AdminDashboardStats> {
    const [
      totalOrganizations,
      totalUsers,
      activeUsers,
      totalProducts,
      totalWarehouses,
      totalStockEntries,
      totalPurchaseOrders,
      totalSalesOrders,
      totalTransfers,
    ] = await Promise.all([
      this.prisma.organization.count(),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.product.count(),
      this.prisma.warehouse.count(),
      this.prisma.stockBalance.count(),
      this.prisma.purchaseOrder.count(),
      this.prisma.salesOrder.count(),
      this.prisma.stockTransfer.count(),
    ]);

    return {
      totalOrganizations,
      totalUsers,
      activeUsers,
      totalProducts,
      totalWarehouses,
      totalStockEntries,
      totalPurchaseOrders,
      totalSalesOrders,
      totalTransfers,
    };
  }

  async getRecentActivity(limit = 20): Promise<AdminRecentActivity[]> {
    const events = await this.prisma.auditEvent.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        organization: { select: { name: true } },
      },
    });

    const actorUserIds = [
      ...new Set(events.map((e) => e.actorUserId).filter(Boolean)),
    ] as string[];

    const users = actorUserIds.length > 0
      ? await this.prisma.user.findMany({
          where: { id: { in: actorUserIds } },
          select: { id: true, email: true },
        })
      : [];

    const userMap = new Map(users.map((u) => [u.id, u.email]));

    return events.map((event) => ({
      id: event.id,
      action: event.action,
      entityType: event.entityType,
      entityId: event.entityId,
      description: `${event.action} on ${event.entityType}${event.entityId ? ` (${event.entityId.slice(0, 8)}...)` : ''}`,
      timestamp: event.createdAt.toISOString(),
      actorEmail: event.actorUserId ? userMap.get(event.actorUserId) ?? null : null,
      organizationName: event.organization?.name ?? null,
    }));
  }
}
