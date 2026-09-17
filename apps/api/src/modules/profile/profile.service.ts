import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '@repo/database';
import { AuditService } from '../audit/audit.service';
import { UpdateProfileDto } from './dto/profile.dto';
import { UserDto, ProfileResponse } from '@repo/types';

@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async getProfile(userId: string): Promise<ProfileResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        memberships: {
          where: { isActive: true },
          include: {
            organization: true,
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const memberships = user.memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      organizationId: m.organizationId,
      isActive: m.isActive,
      createdAt: m.createdAt.toISOString(),
      updatedAt: m.updatedAt.toISOString(),
      role: {
        id: m.role.id,
        name: m.role.name,
        description: m.role.description,
      },
      organization: {
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        isActive: m.organization.isActive,
        createdAt: m.organization.createdAt.toISOString(),
        updatedAt: m.organization.updatedAt.toISOString(),
      },
    }));

    const activeOrganization = memberships[0]?.organization ?? null;

    return {
      user: {
        id: user.id,
        email: user.email,
        isActive: user.isActive,
        isPlatformAdmin: user.isPlatformAdmin,
        mustChangePassword: user.mustChangePassword,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      memberships,
      activeOrganization,
    };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    const newEmail = dto.email.toLowerCase().trim();

    if (newEmail !== user.email) {
      const emailTaken = await this.prisma.user.findUnique({
        where: { email: newEmail },
      });

      if (emailTaken && emailTaken.id !== userId) {
        throw new ConflictException(`Email "${dto.email}" is already in use`);
      }
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        email: newEmail,
      },
      select: {
        id: true,
        email: true,
        isActive: true,
        isPlatformAdmin: true,
        mustChangePassword: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.logEvent({
      actorUserId: user.id,
      action: 'user.profile_updated',
      entityType: 'User',
      entityId: user.id,
      metadata: {
        previousEmail: user.email,
        newEmail: updated.email,
      },
    });

    return {
      id: updated.id,
      email: updated.email,
      isActive: updated.isActive,
      isPlatformAdmin: updated.isPlatformAdmin,
      mustChangePassword: updated.mustChangePassword,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    };
  }
}
