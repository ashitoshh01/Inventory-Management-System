import { CanActivate, ExecutionContext, Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '@repo/database';

@Injectable()
export class OrganizationGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user?: { id: string }; activeOrganization?: unknown; activeMembership?: unknown }>();
    const user = request.user;
    
    if (!user) {
      // Should be run after JwtAuthGuard
      return false;
    }

    const orgId = request.headers['x-organization-id'] as string;
    if (!orgId) {
      throw new BadRequestException('Organization context missing (x-organization-id header required)');
    }

    const routeOrgId = request.params?.id || request.params?.organizationId;
    if (routeOrgId && routeOrgId !== orgId) {
      throw new ForbiddenException('Organization context mismatch: Header does not match route target');
    }

    const membership = await this.prisma.organizationMembership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: orgId,
        },
      },
      include: {
        organization: true,
        role: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    });

    if (!membership || !membership.isActive || !membership.organization.isActive) {
      throw new ForbiddenException('Invalid or inactive organization membership');
    }

    request.activeOrganization = membership.organization;
    request.activeMembership = membership;

    return true;
  }
}
