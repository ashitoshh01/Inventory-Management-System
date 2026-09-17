import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@repo/database';
import { AdminAuditQueryDto } from './dto/admin.dto';
import { AdminAuditEventItem } from '@repo/types';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: AdminAuditQueryDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AuditEventWhereInput = {};

    if (query.organizationId) {
      where.organizationId = query.organizationId;
    }

    if (query.userId) {
      where.actorUserId = query.userId;
    }

    if (query.action) {
      where.action = { contains: query.action, mode: 'insensitive' };
    }

    if (query.entityType) {
      where.entityType = { contains: query.entityType, mode: 'insensitive' };
    }

    if (query.search) {
      where.OR = [
        { action: { contains: query.search, mode: 'insensitive' } },
        { entityType: { contains: query.search, mode: 'insensitive' } },
        { entityId: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt.gte = new Date(query.dateFrom);
      }
      if (query.dateTo) {
        where.createdAt.lte = new Date(query.dateTo);
      }
    }

    const [total, events] = await Promise.all([
      this.prisma.auditEvent.count({ where }),
      this.prisma.auditEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          organization: { select: { name: true } },
        },
      }),
    ]);

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

    const items: AdminAuditEventItem[] = events.map((e) => ({
      id: e.id,
      organizationId: e.organizationId,
      organizationName: e.organization?.name ?? null,
      actorUserId: e.actorUserId,
      actorEmail: e.actorUserId ? userMap.get(e.actorUserId) ?? null : null,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      metadata: e.metadata as Record<string, unknown> | null,
      createdAt: e.createdAt.toISOString(),
    }));

    return {
      items,
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
