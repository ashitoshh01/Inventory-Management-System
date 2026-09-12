import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@repo/database';
import { CreateOrganizationDto, UpdateOrganizationDto, CreateMembershipDto, UpdateMembershipDto } from './dto/organizations.dto';
import { randomBytes } from 'crypto';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  async create(userId: string, dto: CreateOrganizationDto) {
    const slug = `${dto.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${randomBytes(4).toString('hex')}`;
    
    return this.prisma.$transaction(async (tx) => {
      const org = await tx.organization.create({
        data: { name: dto.name, slug },
      });

      let ownerRole = await tx.role.findFirst({ where: { name: 'Owner' } });
      if (!ownerRole) {
        ownerRole = await tx.role.create({ data: { name: 'Owner', description: 'Organization Owner' } });
      }

      await tx.organizationMembership.create({
        data: {
          userId,
          organizationId: org.id,
          roleId: ownerRole.id,
        },
      });

      await this.auditService.logEvent({
        organizationId: org.id,
        actorUserId: userId,
        action: 'organization.created',
        entityType: 'Organization',
        entityId: org.id,
      });

      return org;
    });
  }

  async findAllForUser(userId: string) {
    const memberships = await this.prisma.organizationMembership.findMany({
      where: { userId, isActive: true },
      include: { organization: true },
    });
    return memberships.map((m) => m.organization);
  }

  async findOne(orgId: string) {
    const org = await this.prisma.organization.findUnique({
      where: { id: orgId },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async update(orgId: string, userId: string, dto: UpdateOrganizationDto) {
    const org = await this.prisma.organization.update({
      where: { id: orgId },
      data: dto,
    });

    await this.auditService.logEvent({
      organizationId: org.id,
      actorUserId: userId,
      action: 'organization.updated',
      entityType: 'Organization',
      entityId: org.id,
      metadata: dto as Record<string, unknown>,
    });

    return org;
  }

  async findMembers(orgId: string) {
    return this.prisma.organizationMembership.findMany({
      where: { organizationId: orgId },
      include: { user: true, role: true },
    });
  }

  async addMember(orgId: string, actorUserId: string, dto: CreateMembershipDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user) throw new NotFoundException('User with this email not found');

    const existing = await this.prisma.organizationMembership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: orgId } },
    });

    if (existing) {
      throw new BadRequestException('User is already a member of this organization');
    }

    const membership = await this.prisma.organizationMembership.create({
      data: {
        userId: user.id,
        organizationId: orgId,
        roleId: dto.roleId,
      },
      include: { user: true, role: true },
    });

    await this.auditService.logEvent({
      organizationId: orgId,
      actorUserId,
      action: 'membership.created',
      entityType: 'OrganizationMembership',
      entityId: membership.id,
      metadata: { addedUserId: user.id },
    });

    return membership;
  }

  async updateMember(orgId: string, memberId: string, actorUserId: string, dto: UpdateMembershipDto) {
    const membership = await this.prisma.organizationMembership.findFirst({
      where: { id: memberId, organizationId: orgId },
    });

    if (!membership) throw new NotFoundException('Membership not found');

    if (membership.userId === actorUserId && dto.isActive === false) {
      throw new ForbiddenException('Cannot deactivate your own membership');
    }

    const updated = await this.prisma.organizationMembership.update({
      where: { id: memberId },
      data: dto,
      include: { user: true, role: true },
    });

    await this.auditService.logEvent({
      organizationId: orgId,
      actorUserId,
      action: 'membership.updated',
      entityType: 'OrganizationMembership',
      entityId: memberId,
      metadata: dto as Record<string, unknown>,
    });

    return updated;
  }
}
