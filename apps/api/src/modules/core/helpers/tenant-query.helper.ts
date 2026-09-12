import { BadRequestException } from '@nestjs/common';
import { EntityNotFoundException } from '../errors/domain.errors';

/**
 * Tenant Query Scoping Helper
 * Enforces multi-tenant isolation by ensuring every query strictly incorporates
 * the active organization ID.
 */
export class TenantQueryHelper {
  /**
   * Enforces that organizationId is present and merges it into a Prisma where clause.
   */
  static scopeToOrg<T extends Record<string, unknown>>(
    where: T,
    organizationId: string,
  ): T & { organizationId: string } {
    if (!organizationId || typeof organizationId !== 'string' || organizationId.trim() === '') {
      throw new BadRequestException(
        'Organization context is required for tenant-scoped operations',
      );
    }

    return {
      ...where,
      organizationId,
    };
  }

  /**
   * Validates that a fetched resource belongs to the expected tenant.
   * If not, throws an EntityNotFoundException rather than ForbiddenException
   * to avoid leaking the existence of resources owned by other organizations.
   */
  static assertTenantOwnership<T extends { organizationId?: string | null }>(
    resource: T | null | undefined,
    expectedOrgId: string,
    resourceName = 'Resource',
  ): T {
    if (!resource || resource.organizationId !== expectedOrgId) {
      throw new EntityNotFoundException(resourceName);
    }
    return resource;
  }

  /**
   * Constructs a secure tenant-scoped primary key lookup criteria.
   */
  static buildScopedLookup<T extends Record<string, unknown> = Record<string, unknown>>(
    id: string,
    organizationId: string,
    additionalWhere?: T,
  ): T & { id: string; organizationId: string } {
    if (!id || typeof id !== 'string' || id.trim() === '') {
      throw new BadRequestException('Resource ID is required');
    }
    return this.scopeToOrg({ ...(additionalWhere || ({} as T)), id }, organizationId);
  }
}
