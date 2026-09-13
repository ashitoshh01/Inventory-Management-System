import { Injectable } from '@nestjs/common';
import { PrismaService, Prisma } from '@repo/database';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async logEvent(params: {
    organizationId?: string;
    actorUserId?: string;
    action: string;
    entityType: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
    requestId?: string;
    tx?: PrismaService | Prisma.TransactionClient;
  }): Promise<unknown> {
    const { tx, ...rest } = params;
    const client = tx ?? this.prisma;
    const sanitizedMetadata = rest.metadata
      ? (this.sanitize(rest.metadata) as Record<string, unknown>)
      : undefined;

    return client.auditEvent.create({
      data: {
        ...rest,
        metadata: sanitizedMetadata as Prisma.InputJsonValue,
      },
    });
  }

  public sanitize<T = unknown>(obj: T): T {
    if (!obj || typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitize(item)) as unknown as T;
    }

    const result: Record<string, unknown> = {};
    const sensitiveKeys = [
      'password',
      'token',
      'secret',
      'authorization',
      'cookie',
      'database_url',
    ];

    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      if (sensitiveKeys.some((sk) => k.toLowerCase().includes(sk))) {
        result[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null) {
        result[k] = this.sanitize(v);
      } else {
        result[k] = v;
      }
    }
    return result as T;
  }

  async getEventsForEntity(
    organizationId: string,
    entityType: string,
    entityId: string,
  ): Promise<
    Array<{
      id: string;
      action: string;
      actorUserId: string | null;
      createdAt: string;
      metadata?: Record<string, unknown>;
    }>
  > {
    const events = await this.prisma.auditEvent.findMany({
      where: {
        organizationId,
        entityType,
        entityId,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        entityId: true,
        action: true,
        actorUserId: true,
        createdAt: true,
        metadata: true,
      },
    });

    return events.map((e) => {
      const item: {
        id: string;
        entityId: string | null;
        action: string;
        actorUserId: string | null;
        createdAt: string;
        metadata?: Record<string, unknown>;
      } = {
        id: e.id,
        entityId: e.entityId,
        action: e.action,
        actorUserId: e.actorUserId,
        createdAt: e.createdAt.toISOString(),
      };
      if (e.metadata) {
        item.metadata = this.sanitize(e.metadata) as Record<string, unknown>;
      }
      return item;
    });
  }
}
