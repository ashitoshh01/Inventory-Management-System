import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService, Prisma } from '@repo/database';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';
import {
  AdminPaginationDto,
  AdminCreateOrganizationDto,
  AdminUpdateOrganizationDto,
} from './dto/admin.dto';
import {
  AdminOrganizationListItem,
  AdminOrganizationDetail,
  AdminMemberItem,
} from '@repo/types';

@Injectable()
export class AdminOrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: AdminPaginationDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.OrganizationWhereInput = {};
    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, orgs] = await Promise.all([
      this.prisma.organization.count({ where }),
      this.prisma.organization.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { [sortField]: sortDir },
        include: {
          _count: {
            select: { memberships: true },
          },
        },
      }),
    ]);

    const items: AdminOrganizationListItem[] = orgs.map((org) => ({
      id: org.id,
      name: org.name,
      slug: org.slug,
      isActive: org.isActive,
      memberCount: org._count.memberships,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
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

  async getById(id: string): Promise<AdminOrganizationDetail> {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        _count: { select: { memberships: true } },
        memberships: {
          include: {
            user: { select: { id: true, email: true, isActive: true } },
            role: { select: { name: true } },
          },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization ${id} not found`);
    }

    const members: AdminMemberItem[] = org.memberships.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      roleName: m.role.name,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
    }));

    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      isActive: org.isActive,
      memberCount: org._count.memberships,
      members,
      createdAt: org.createdAt.toISOString(),
      updatedAt: org.updatedAt.toISOString(),
    };
  }

  async create(dto: AdminCreateOrganizationDto, adminUserId: string) {
    const orgSlugBase = dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const slug = `${orgSlugBase}-${randomBytes(4).toString('hex')}`;

    const org = await this.prisma.organization.create({
      data: {
        name: dto.name,
        slug,
      },
    });

    await this.auditService.logEvent({
      organizationId: org.id,
      actorUserId: adminUserId,
      action: 'organization.create',
      entityType: 'Organization',
      entityId: org.id,
      metadata: { name: org.name, slug: org.slug },
    });

    return org;
  }

  async update(id: string, dto: AdminUpdateOrganizationDto, adminUserId: string) {
    const existing = await this.prisma.organization.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Organization ${id} not found`);
    }

    const updated = await this.prisma.organization.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
    });

    await this.auditService.logEvent({
      organizationId: updated.id,
      actorUserId: adminUserId,
      action: 'organization.update',
      entityType: 'Organization',
      entityId: updated.id,
      metadata: {
        changes: dto,
        previous: { name: existing.name, isActive: existing.isActive },
      },
    });

    return updated;
  }

  async getMembers(id: string): Promise<AdminMemberItem[]> {
    const org = await this.prisma.organization.findUnique({
      where: { id },
      include: {
        memberships: {
          include: {
            user: { select: { id: true, email: true, isActive: true } },
            role: { select: { name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!org) {
      throw new NotFoundException(`Organization ${id} not found`);
    }

    return org.memberships.map((m) => ({
      id: m.id,
      userId: m.user.id,
      email: m.user.email,
      roleName: m.role.name,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
    }));
  }
}
