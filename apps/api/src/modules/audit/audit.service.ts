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
  }): Promise<unknown> {
    const sanitizedMetadata = params.metadata
      ? (this.sanitize(params.metadata) as Record<string, unknown>)
      : undefined;

    return this.prisma.auditEvent.create({
      data: {
        ...params,
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
}
