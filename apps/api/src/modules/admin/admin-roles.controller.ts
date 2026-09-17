import { Controller, Get, Param, UseGuards, NotFoundException } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { PlatformAdminGuard } from '../../common/guards/platform-admin.guard';
import { PrismaService } from '@repo/database';
import {
  AdminRoleItem,
  AdminRoleDetail,
  AdminPermissionItem,
} from '@repo/types';

@Controller('admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminRolesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('roles')
  async listRoles(): Promise<AdminRoleItem[]> {
    const roles = await this.prisma.role.findMany({
      include: {
        _count: {
          select: {
            permissions: true,
            memberships: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return roles.map((role) => ({
      id: role.id,
      name: role.name,
      description: role.description,
      permissionCount: role._count.permissions,
      membershipCount: role._count.memberships,
    }));
  }

  @Get('roles/:id')
  async getRole(@Param('id') id: string): Promise<AdminRoleDetail> {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            permissions: true,
            memberships: true,
          },
        },
        permissions: {
          include: {
            permission: true,
          },
        },
      },
    });

    if (!role) {
      throw new NotFoundException(`Role ${id} not found`);
    }

    const permissions: AdminPermissionItem[] = role.permissions.map((rp) => ({
      id: rp.permission.id,
      action: rp.permission.action,
      description: rp.permission.description,
    }));

    return {
      id: role.id,
      name: role.name,
      description: role.description,
      permissionCount: role._count.permissions,
      membershipCount: role._count.memberships,
      permissions,
    };
  }

  @Get('permissions')
  async listPermissions(): Promise<AdminPermissionItem[]> {
    const permissions = await this.prisma.permission.findMany({
      orderBy: { action: 'asc' },
    });

    return permissions.map((p) => ({
      id: p.id,
      action: p.action,
      description: p.description,
    }));
  }
}
