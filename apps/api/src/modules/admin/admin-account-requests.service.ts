import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, Prisma, AccountRequestStatus } from '@repo/database';
import { AuditService } from '../audit/audit.service';
import {
  AdminPaginationDto,
  AdminCreateAccountRequestDto,
  AdminUpdateAccountRequestDto,
} from './dto/admin.dto';
import { AdminAccountRequestItem } from '@repo/types';

@Injectable()
export class AdminAccountRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: AdminPaginationDto & { status?: string }) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.AccountRequestWhereInput = {};

    if (query.status && Object.values(AccountRequestStatus).includes(query.status as AccountRequestStatus)) {
      where.status = query.status as AccountRequestStatus;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { phone: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [total, requests] = await Promise.all([
      this.prisma.accountRequest.count({ where }),
      this.prisma.accountRequest.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          handledBy: { select: { email: true } },
        },
      }),
    ]);

    const items: AdminAccountRequestItem[] = requests.map((r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone,
      email: r.email,
      status: r.status as AdminAccountRequestItem['status'],
      notes: r.notes,
      handledByEmail: r.handledBy?.email ?? null,
      handledAt: r.handledAt ? r.handledAt.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
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

  async create(dto: AdminCreateAccountRequestDto, adminUserId?: string) {
    const request = await this.prisma.accountRequest.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        email: dto.email ? dto.email.toLowerCase().trim() : null,
        notes: dto.notes ?? null,
      },
    });

    if (adminUserId) {
      await this.auditService.logEvent({
        actorUserId: adminUserId,
        action: 'account_request.create',
        entityType: 'AccountRequest',
        entityId: request.id,
        metadata: { name: request.name, phone: request.phone },
      });
    }

    return request;
  }

  async update(id: string, dto: AdminUpdateAccountRequestDto, adminUserId: string) {
    const existing = await this.prisma.accountRequest.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Account request ${id} not found`);
    }

    const data: Prisma.AccountRequestUpdateInput = {};
    if (dto.notes !== undefined) {
      data.notes = dto.notes;
    }

    if (dto.status && Object.values(AccountRequestStatus).includes(dto.status as AccountRequestStatus)) {
      data.status = dto.status as AccountRequestStatus;
      if (existing.status === AccountRequestStatus.PENDING && dto.status !== AccountRequestStatus.PENDING) {
        data.handledBy = { connect: { id: adminUserId } };
        data.handledAt = new Date();
      }
    }

    const updated = await this.prisma.accountRequest.update({
      where: { id },
      data,
      include: {
        handledBy: { select: { email: true } },
      },
    });

    await this.auditService.logEvent({
      actorUserId: adminUserId,
      action: 'account_request.update',
      entityType: 'AccountRequest',
      entityId: updated.id,
      metadata: { changes: dto, previousStatus: existing.status },
    });

    return {
      id: updated.id,
      name: updated.name,
      phone: updated.phone,
      email: updated.email,
      status: updated.status,
      notes: updated.notes,
      handledByEmail: updated.handledBy?.email ?? null,
      handledAt: updated.handledAt ? updated.handledAt.toISOString() : null,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
