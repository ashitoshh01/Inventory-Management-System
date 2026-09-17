import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService, Prisma } from '@repo/database';
import * as argon2 from 'argon2';
import { AuditService } from '../audit/audit.service';
import {
  AdminPaginationDto,
  AdminCreateUserDto,
  AdminUpdateUserDto,
  AdminAddMembershipDto,
  AdminUpdateMembershipDto,
} from './dto/admin.dto';
import {
  AdminUserListItem,
  AdminUserDetail,
  AdminUserMembership,
} from '@repo/types';

@Injectable()
export class AdminUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async list(query: AdminPaginationDto) {
    const page = query.page && query.page > 0 ? query.page : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.min(query.pageSize, 100) : 20;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {};
    if (query.search) {
      where.email = { contains: query.search, mode: 'insensitive' };
    }

    const sortField = query.sortBy || 'createdAt';
    const sortDir = query.sortOrder === 'asc' ? 'asc' : 'desc';

    const [total, users] = await Promise.all([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
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

    const items: AdminUserListItem[] = users.map((user) => ({
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      isPlatformAdmin: user.isPlatformAdmin,
      membershipCount: user._count.memberships,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
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

  async getById(id: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        _count: { select: { memberships: true } },
        memberships: {
          include: {
            organization: { select: { id: true, name: true } },
            role: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }

    const memberships: AdminUserMembership[] = user.memberships.map((m) => ({
      id: m.id,
      organizationId: m.organization.id,
      organizationName: m.organization.name,
      roleId: m.role.id,
      roleName: m.role.name,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
    }));

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      isPlatformAdmin: user.isPlatformAdmin,
      membershipCount: user._count.memberships,
      memberships,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async create(dto: AdminCreateUserDto, adminUserId: string) {
    const email = dto.email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existing) {
      throw new ConflictException(`User with email "${email}" already exists`);
    }

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
      parallelism: 4,
    });

    const user = await this.prisma.$transaction(async (tx) => {
      const createdUser = await tx.user.create({
        data: {
          email,
          passwordHash,
          isActive: true,
        },
      });

      if (dto.organizationId) {
        const org = await tx.organization.findUnique({
          where: { id: dto.organizationId },
        });
        if (!org) {
          throw new NotFoundException(`Organization ${dto.organizationId} not found`);
        }

        let roleId = dto.roleId;
        if (!roleId) {
          const defaultRole = await tx.role.findFirst({
            where: { name: 'Owner' },
          });
          if (!defaultRole) {
            throw new BadRequestException('No default role available');
          }
          roleId = defaultRole.id;
        } else {
          const role = await tx.role.findUnique({ where: { id: roleId } });
          if (!role) {
            throw new NotFoundException(`Role ${roleId} not found`);
          }
        }

        await tx.organizationMembership.create({
          data: {
            userId: createdUser.id,
            organizationId: dto.organizationId,
            roleId,
          },
        });
      }

      return createdUser;
    });

    await this.auditService.logEvent({
      actorUserId: adminUserId,
      ...(dto.organizationId ? { organizationId: dto.organizationId } : {}),
      action: 'user.create',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        email: user.email,
        ...(dto.organizationId ? { organizationId: dto.organizationId } : {}),
      },
    });

    return {
      id: user.id,
      email: user.email,
      isActive: user.isActive,
      isPlatformAdmin: user.isPlatformAdmin,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    };
  }

  async update(id: string, dto: AdminUpdateUserDto, adminUserId: string) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`User ${id} not found`);
    }

    if (dto.email && dto.email.toLowerCase().trim() !== existing.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: dto.email.toLowerCase().trim() },
      });
      if (emailTaken) {
        throw new ConflictException(`Email "${dto.email}" is already in use`);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.email !== undefined ? { email: dto.email.toLowerCase().trim() } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      select: {
        id: true,
        email: true,
        isActive: true,
        isPlatformAdmin: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.logEvent({
      actorUserId: adminUserId,
      action: 'user.update',
      entityType: 'User',
      entityId: updated.id,
      metadata: {
        changes: dto,
        previous: { email: existing.email, isActive: existing.isActive },
      },
    });

    return updated;
  }

  async addMembership(userId: string, dto: AdminAddMembershipDto, adminUserId: string) {
    const [user, org, role] = await Promise.all([
      this.prisma.user.findUnique({ where: { id: userId } }),
      this.prisma.organization.findUnique({ where: { id: dto.organizationId } }),
      this.prisma.role.findUnique({ where: { id: dto.roleId } }),
    ]);

    if (!user) throw new NotFoundException(`User ${userId} not found`);
    if (!org) throw new NotFoundException(`Organization ${dto.organizationId} not found`);
    if (!role) throw new NotFoundException(`Role ${dto.roleId} not found`);

    const existingMembership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: dto.organizationId,
        },
      },
    });

    if (existingMembership) {
      throw new ConflictException('User is already a member of this organization');
    }

    const membership = await this.prisma.organizationMembership.create({
      data: {
        userId,
        organizationId: dto.organizationId,
        roleId: dto.roleId,
      },
      include: {
        organization: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    });

    await this.auditService.logEvent({
      actorUserId: adminUserId,
      organizationId: dto.organizationId,
      action: 'membership.create',
      entityType: 'OrganizationMembership',
      entityId: membership.id,
      metadata: {
        userId,
        organizationId: dto.organizationId,
        roleId: dto.roleId,
      },
    });

    return {
      id: membership.id,
      organizationId: membership.organization.id,
      organizationName: membership.organization.name,
      roleId: membership.role.id,
      roleName: membership.role.name,
      isActive: membership.isActive,
      createdAt: membership.createdAt.toISOString(),
    };
  }

  async updateMembership(
    userId: string,
    membershipId: string,
    dto: AdminUpdateMembershipDto,
    adminUserId: string,
  ) {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { id: membershipId, userId },
      include: { organization: true },
    });

    if (!membership) {
      throw new NotFoundException(`Membership ${membershipId} not found for user ${userId}`);
    }

    if (dto.roleId) {
      const role = await this.prisma.role.findUnique({ where: { id: dto.roleId } });
      if (!role) throw new NotFoundException(`Role ${dto.roleId} not found`);
    }

    const updated = await this.prisma.organizationMembership.update({
      where: { id: membershipId },
      data: {
        ...(dto.roleId !== undefined ? { roleId: dto.roleId } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
      },
      include: {
        organization: { select: { id: true, name: true } },
        role: { select: { id: true, name: true } },
      },
    });

    await this.auditService.logEvent({
      actorUserId: adminUserId,
      organizationId: membership.organizationId,
      action: 'membership.update',
      entityType: 'OrganizationMembership',
      entityId: updated.id,
      metadata: {
        changes: dto,
        userId,
      },
    });

    return {
      id: updated.id,
      organizationId: updated.organization.id,
      organizationName: updated.organization.name,
      roleId: updated.role.id,
      roleName: updated.role.name,
      isActive: updated.isActive,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
